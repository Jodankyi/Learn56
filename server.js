const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const twilio = require('twilio');
const sendgridMail = require('@sendgrid/mail');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const otpTtlSeconds = Number(process.env.OTP_TTL_SECONDS || 600);
const otpRateLimitSeconds = Number(process.env.OTP_RATE_LIMIT_SECONDS || 60);
const corsOrigin = process.env.CORS_ORIGIN || '*';
const logOtpCodes = String(process.env.LOG_OTP_CODES || 'false').toLowerCase() === 'true';
const bcryptRounds = Number(process.env.BCRYPT_ROUNDS || 12);
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'learn56.sqlite');

app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin }));
app.use(express.json());

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new sqlite3.Database(dbPath);

const otpStore = new Map();

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

if (process.env.SENDGRID_API_KEY) {
  sendgridMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function dbRun(sql, params) {
  return new Promise(function (resolve, reject) {
    db.run(sql, params || [], function (error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params) {
  return new Promise(function (resolve, reject) {
    db.get(sql, params || [], function (error, row) {
      if (error) {
        reject(error);
        return;
      }
      resolve(row || null);
    });
  });
}

async function initializeDatabase() {
  await dbRun(
    'CREATE TABLE IF NOT EXISTS users (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      'name TEXT NOT NULL,' +
      'email TEXT NOT NULL UNIQUE,' +
      'role TEXT NOT NULL DEFAULT "student",' +
      'password_hash TEXT NOT NULL,' +
      'phone TEXT,' +
      'profile_json TEXT,' +
      'created_at INTEGER NOT NULL,' +
      'updated_at INTEGER NOT NULL' +
    ')' 
  );
  try {
    await dbRun('ALTER TABLE users ADD COLUMN profile_json TEXT');
  } catch (error) {
    if (!String(error && error.message).includes('duplicate column name')) {
      throw error;
    }
  }
  await dbRun('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
}

function nowMs() {
  return Date.now();
}

function cleanupExpiredOtps() {
  const now = nowMs();
  for (const [email, record] of otpStore.entries()) {
    if (record.expiresAt <= now) {
      otpStore.delete(email);
    }
  }
}

function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}

function normalizePhone(input) {
  return String(input || '').trim();
}

function cleanString(input) {
  return String(input || '').trim();
}

function cleanStringArray(input, maxLength) {
  const rawItems = Array.isArray(input)
    ? input
    : String(input || '').split(',');
  return rawItems
    .map(function (value) {
      return String(value || '').trim();
    })
    .filter(Boolean)
    .slice(0, maxLength || 25);
}

function normalizeRoleProfile(role, profileInput) {
  const profile = profileInput && typeof profileInput === 'object' ? profileInput : {};

  if (role === 'student') {
    const studentProfile = {
      schoolName: cleanString(profile.schoolName),
      teacherNames: cleanStringArray(profile.teacherNames, 30)
    };
    if (!studentProfile.schoolName) {
      throw new Error('School name is required for student registration.');
    }
    return studentProfile;
  }

  if (role === 'parent') {
    const parentProfile = {
      studentNames: cleanStringArray(profile.studentNames, 30),
      gradeLevel: cleanString(profile.gradeLevel),
      schoolInfo: cleanString(profile.schoolInfo)
    };
    if (!parentProfile.studentNames.length || !parentProfile.gradeLevel || !parentProfile.schoolInfo) {
      throw new Error('Student names, grade level, and school information are required for parent registration.');
    }
    return parentProfile;
  }

  const teacherProfile = {
    schoolName: cleanString(profile.schoolName),
    subjectsTaught: cleanStringArray(profile.subjectsTaught, 30)
  };
  if (!teacherProfile.schoolName || !teacherProfile.subjectsTaught.length) {
    throw new Error('School and subjects taught are required for teacher registration.');
  }
  return teacherProfile;
}

function parseProfileJson(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function toPublicUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone || null,
    profile: parseProfileJson(row.profile_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getUserByEmail(email) {
  return dbGet('SELECT * FROM users WHERE email = ?', [email]);
}

async function sendByEmail(payload) {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!process.env.SENDGRID_API_KEY || !fromEmail) {
    throw new Error('Email provider not configured');
  }

  await sendgridMail.send({
    to: payload.toEmail,
    from: fromEmail,
    subject: 'Learn56 password reset code',
    text: `Your Learn56 password reset code is ${payload.code}. It expires in ${otpTtlSeconds / 60} minutes.`,
    html: `<p>Your Learn56 password reset code is <strong>${payload.code}</strong>.</p><p>It expires in ${otpTtlSeconds / 60} minutes.</p>`
  });
}

async function sendByText(payload) {
  const fromPhone = process.env.TWILIO_FROM_NUMBER;
  if (!twilioClient || !fromPhone) {
    throw new Error('SMS provider not configured');
  }

  await twilioClient.messages.create({
    body: `Learn56 reset code: ${payload.code}. Expires in ${otpTtlSeconds / 60} minutes.`,
    from: fromPhone,
    to: payload.toPhone
  });
}

app.get('/api/health', function (_req, res) {
  res.json({ ok: true });
});

app.post('/api/auth/register', async function (req, res) {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    const email = normalizeEmail(req.body && req.body.email);
    const role = String((req.body && req.body.role) || 'student').trim().toLowerCase();
    const phone = normalizePhone(req.body && req.body.phone);
    const password = String((req.body && req.body.password) || '');
    const allowedRoles = new Set(['student', 'parent', 'teacher']);

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    if (!allowedRoles.has(role)) {
      return res.status(400).json({ error: 'Role must be student, parent, or teacher.' });
    }

    let normalizedProfile = null;
    try {
      normalizedProfile = normalizeRoleProfile(role, req.body && req.body.profile);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    const now = nowMs();

    await dbRun(
      'INSERT INTO users (name, email, role, password_hash, phone, profile_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, role || 'student', passwordHash, phone || null, JSON.stringify(normalizedProfile), now, now]
    );

    const created = await getUserByEmail(email);
    return res.status(201).json({ ok: true, user: toPublicUser(created) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to register user.' });
  }
});

app.post('/api/auth/login', async function (req, res) {
  try {
    const email = normalizeEmail(req.body && req.body.email);
    const password = String((req.body && req.body.password) || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    return res.json({ ok: true, user: toPublicUser(user) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to sign in.' });
  }
});

app.post('/api/otp/request', async function (req, res) {
  try {
    cleanupExpiredOtps();

    const email = normalizeEmail(req.body && req.body.email);
    const channel = String((req.body && req.body.channel) || '').trim().toLowerCase();
    const phone = normalizePhone(req.body && req.body.phone);

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    if (channel !== 'email' && channel !== 'text') {
      return res.status(400).json({ error: 'Channel must be email or text.' });
    }
    if (channel === 'text' && !phone) {
      return res.status(400).json({ error: 'Phone number is required for text channel.' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'No account found for that email.' });
    }

    const existing = otpStore.get(email);
    if (existing && existing.nextAllowedAt > nowMs()) {
      const retryAfterSeconds = Math.ceil((existing.nextAllowedAt - nowMs()) / 1000);
      return res.status(429).json({ error: `Please wait ${retryAfterSeconds}s before requesting another code.` });
    }

    const code = generateCode();
    const expiresAt = nowMs() + otpTtlSeconds * 1000;
    const nextAllowedAt = nowMs() + otpRateLimitSeconds * 1000;

    if (channel === 'email') {
      await sendByEmail({ toEmail: email, code });
    } else {
      await sendByText({ toPhone: phone, code });
    }

    otpStore.set(email, {
      code,
      channel,
      phone,
      expiresAt,
      nextAllowedAt,
      attempts: 0
    });

    if (logOtpCodes) {
      console.log(`[OTP] ${email} code=${code} channel=${channel}`);
    }

    return res.json({ ok: true, expiresInSeconds: otpTtlSeconds });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to send OTP.' });
  }
});

app.post('/api/otp/verify', function (req, res) {
  cleanupExpiredOtps();

  const email = normalizeEmail(req.body && req.body.email);
  const code = String((req.body && req.body.code) || '').trim();

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required.' });
  }

  const record = otpStore.get(email);
  if (!record) {
    return res.status(400).json({ error: 'No active reset code found. Request a new code.' });
  }

  if (record.expiresAt <= nowMs()) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'Reset code has expired. Request a new code.' });
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    otpStore.delete(email);
    return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
  }

  if (record.code !== code) {
    return res.status(400).json({ error: 'Invalid reset code.' });
  }

  return res.json({ ok: true });
});

app.post('/api/auth/reset-password', async function (req, res) {
  try {
    cleanupExpiredOtps();

    const email = normalizeEmail(req.body && req.body.email);
    const newPassword = String((req.body && req.body.newPassword) || '');
    const recoveryMethod = String((req.body && req.body.recoveryMethod) || 'email').toLowerCase();
    const code = String((req.body && req.body.code) || '').trim();

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'No account found for that email.' });
    }

    if (recoveryMethod !== 'direct') {
      if (!code) {
        return res.status(400).json({ error: 'Reset code is required.' });
      }

      const record = otpStore.get(email);
      if (!record) {
        return res.status(400).json({ error: 'No active reset code found. Request a new code.' });
      }

      if (record.expiresAt <= nowMs()) {
        otpStore.delete(email);
        return res.status(400).json({ error: 'Reset code has expired. Request a new code.' });
      }

      record.attempts += 1;
      if (record.attempts > 5) {
        otpStore.delete(email);
        return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
      }

      if (record.code !== code) {
        return res.status(400).json({ error: 'Invalid reset code.' });
      }

      otpStore.delete(email);
    }

    const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);
    await dbRun('UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?', [passwordHash, nowMs(), email]);

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to reset password.' });
  }
});

initializeDatabase()
  .then(function () {
    app.listen(port, function () {
      console.log(`Learn56 Auth API listening on http://localhost:${port}`);
      console.log(`Using SQLite database at ${dbPath}`);
    });
  })
  .catch(function (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
