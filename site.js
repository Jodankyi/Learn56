(function () {
  'use strict';

  const storageKeys = {
    session: 'learn56.session.v1'
  };
  const defaultApiBase =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8787'
      : '';
  const apiBase = String(window.LEARN56_API_BASE_URL || window.LEARN56_OTP_API_BASE_URL || defaultApiBase).replace(/\/$/, '');
  let signInModalApi = null;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // Ignore storage write failures (private mode or quota limits).
    }
  }

  function buildApiUrl(path) {
    return apiBase ? apiBase + path : path;
  }

  async function postApi(path, payload) {
    const response = await fetch(buildApiUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload || {})
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || 'Request failed. Please try again.');
    }

    return data;
  }

  function updateFooterYear() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('.footer-copyright').forEach(function (el) {
      el.textContent = el.textContent.replace(/\b20\d{2}\b/, year);
    });
  }

  function setActiveNavLink() {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a[href]').forEach(function (link) {
      const href = link.getAttribute('href') || '';
      if (href === current) {
        link.classList.add('active-nav-link');
      }
    });
  }

  function wireJoinButtons() {
    document.querySelectorAll('.auth-buttons .btn-join').forEach(function (btn) {
      btn.setAttribute('href', 'register.html');
      btn.setAttribute('data-auth', 'join');
    });
  }

  function createSignInModal() {
    const overlay = document.createElement('div');
    overlay.id = 'signin-modal-overlay';
    overlay.className = 'auth-modal-overlay';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = [
      '<div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="signin-title">',
      '  <button type="button" class="auth-modal-close" id="signin-modal-close" aria-label="Close sign in">&times;</button>',
      '  <h2 id="signin-title">Sign In</h2>',
      '  <p class="auth-modal-subtitle">Welcome back. Continue your learning journey.</p>',
      '  <form id="signin-form" class="auth-form">',
      '    <label for="signin-email">Email</label>',
      '    <input id="signin-email" name="email" type="email" autocomplete="email" required>',
      '    <label for="signin-password">Password</label>',
      '    <input id="signin-password" name="password" type="password" autocomplete="current-password" required>',
      '    <div class="auth-actions">',
      '      <button type="submit" class="btn btn-join auth-submit">Sign In</button>',
      '      <button type="button" class="btn btn-signin auth-cancel" id="signin-modal-cancel">Close</button>',
      '    </div>',
      '    <button type="button" class="auth-link-btn" id="signin-forgot-toggle">Forgot password?</button>',
      '    <div class="password-recovery" id="password-recovery-panel" hidden>',
      '      <h3 class="password-recovery-title">Reset Password</h3>',
      '      <p class="password-recovery-message">Recover your account using a reset code by email/text, or reset directly on this page.</p>',
      '      <label for="recovery-method">Recovery method</label>',
      '      <select id="recovery-method" name="recoveryMethod">',
      '        <option value="email">Send code by email</option>',
      '        <option value="text">Send code by text</option>',
      '        <option value="direct">Reset password on this page</option>',
      '      </select>',
      '      <label for="recovery-email">Account email</label>',
      '      <input id="recovery-email" name="recoveryEmail" type="email" autocomplete="email">',
      '      <div id="recovery-phone-row" hidden>',
      '        <label for="recovery-phone">Phone number</label>',
      '        <input id="recovery-phone" name="recoveryPhone" type="tel" autocomplete="tel">',
      '      </div>',
      '      <button type="button" class="btn btn-signin auth-recovery-send" id="recovery-send-code">Send reset code</button>',
      '      <div id="recovery-code-row" hidden>',
      '        <label for="recovery-code">Enter reset code</label>',
      '        <input id="recovery-code" name="recoveryCode" type="text" inputmode="numeric" pattern="[0-9]{6}">',
      '      </div>',
      '      <label for="recovery-new-password">New password</label>',
      '      <input id="recovery-new-password" name="recoveryNewPassword" type="password" minlength="6" autocomplete="new-password">',
      '      <label for="recovery-confirm-password">Confirm new password</label>',
      '      <input id="recovery-confirm-password" name="recoveryConfirmPassword" type="password" minlength="6" autocomplete="new-password">',
      '      <button type="button" class="btn btn-join" id="recovery-reset-btn">Reset password</button>',
      '      <p class="auth-modal-feedback" id="recovery-feedback" aria-live="polite"></p>',
      '    </div>',
      '    <p class="auth-modal-feedback" id="signin-feedback" aria-live="polite"></p>',
      '  </form>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    const modal = overlay.querySelector('.auth-modal');
    const closeBtn = document.getElementById('signin-modal-close');
    const cancelBtn = document.getElementById('signin-modal-cancel');
    const form = document.getElementById('signin-form');
    const feedback = document.getElementById('signin-feedback');
    const emailInput = document.getElementById('signin-email');
    const forgotToggleBtn = document.getElementById('signin-forgot-toggle');
    const recoveryPanel = document.getElementById('password-recovery-panel');
    const recoveryMethodSelect = document.getElementById('recovery-method');
    const recoveryEmailInput = document.getElementById('recovery-email');
    const recoveryPhoneRow = document.getElementById('recovery-phone-row');
    const recoveryPhoneInput = document.getElementById('recovery-phone');
    const recoverySendCodeBtn = document.getElementById('recovery-send-code');
    const recoveryCodeRow = document.getElementById('recovery-code-row');
    const recoveryCodeInput = document.getElementById('recovery-code');
    const recoveryNewPasswordInput = document.getElementById('recovery-new-password');
    const recoveryConfirmPasswordInput = document.getElementById('recovery-confirm-password');
    const recoveryResetBtn = document.getElementById('recovery-reset-btn');
    const recoveryFeedback = document.getElementById('recovery-feedback');

    function setRecoveryFeedback(message, isError) {
      if (!recoveryFeedback) {
        return;
      }
      recoveryFeedback.textContent = message || '';
      recoveryFeedback.classList.toggle('is-error', Boolean(isError));
    }

    function updateRecoveryMode() {
      if (!recoveryMethodSelect) {
        return;
      }
      const mode = recoveryMethodSelect.value;
      const requiresCode = mode !== 'direct';

      if (recoveryPhoneRow) {
        recoveryPhoneRow.hidden = mode !== 'text';
      }
      if (recoverySendCodeBtn) {
        recoverySendCodeBtn.hidden = !requiresCode;
      }
      if (recoveryCodeRow) {
        recoveryCodeRow.hidden = !requiresCode;
      }
    }

    function resetRecoveryState() {
      if (recoveryMethodSelect) {
        recoveryMethodSelect.value = 'email';
      }
      if (recoveryCodeInput) {
        recoveryCodeInput.value = '';
      }
      if (recoveryPanel) {
        recoveryPanel.hidden = true;
      }
      if (forgotToggleBtn) {
        forgotToggleBtn.textContent = 'Forgot password?';
      }
      setRecoveryFeedback('', false);
      updateRecoveryMode();
    }

    function openModal() {
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      setTimeout(function () {
        emailInput.focus();
      }, 0);
    }

    function closeModal() {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      form.reset();
      feedback.textContent = '';
      feedback.classList.remove('is-error');
      resetRecoveryState();
    }

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closeModal();
      }
    });

    closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeModal);
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !overlay.hidden) {
        closeModal();
      }
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const formData = new FormData(form);
      const email = String(formData.get('email') || '').trim().toLowerCase();
      const password = String(formData.get('password') || '');

      try {
        const response = await postApi('/api/auth/login', {
          email: email,
          password: password
        });

        writeJson(storageKeys.session, {
          id: response.user && response.user.id,
          email: response.user && response.user.email,
          name: response.user && response.user.name,
          role: (response.user && response.user.role) || 'student',
          signedInAt: Date.now()
        });

        feedback.textContent = 'Signed in successfully.';
        feedback.classList.remove('is-error');
        setTimeout(closeModal, 500);
      } catch (error) {
        feedback.textContent = error.message || 'Invalid email or password.';
        feedback.classList.add('is-error');
      }
    });

    if (forgotToggleBtn && recoveryPanel) {
      forgotToggleBtn.addEventListener('click', function () {
        const isOpening = recoveryPanel.hidden;
        recoveryPanel.hidden = !isOpening;
        forgotToggleBtn.textContent = isOpening ? 'Hide password recovery' : 'Forgot password?';
        if (isOpening && recoveryEmailInput) {
          recoveryEmailInput.value = emailInput.value.trim().toLowerCase();
          recoveryEmailInput.focus();
        }
      });
    }

    if (recoveryMethodSelect) {
      recoveryMethodSelect.addEventListener('change', function () {
        if (recoveryCodeInput) {
          recoveryCodeInput.value = '';
        }
        setRecoveryFeedback('', false);
        updateRecoveryMode();
      });
      updateRecoveryMode();
    }

    if (recoverySendCodeBtn) {
      recoverySendCodeBtn.addEventListener('click', async function () {
        const mode = recoveryMethodSelect ? recoveryMethodSelect.value : 'email';
        const email = String((recoveryEmailInput && recoveryEmailInput.value) || '').trim().toLowerCase();
        const phone = String((recoveryPhoneInput && recoveryPhoneInput.value) || '').trim();

        if (!email) {
          setRecoveryFeedback('Enter your account email first.', true);
          return;
        }

        if (mode === 'text' && !phone) {
          setRecoveryFeedback('Enter your phone number to receive a reset code by text.', true);
          return;
        }

        recoverySendCodeBtn.disabled = true;
        try {
          await postApi('/api/otp/request', {
            email: email,
            channel: mode,
            phone: mode === 'text' ? phone : undefined
          });
          const channel = mode === 'text' ? 'text message' : 'email';
          setRecoveryFeedback('Reset code sent by ' + channel + '. Check your inbox/messages.', false);
        } catch (error) {
          setRecoveryFeedback(error.message, true);
        } finally {
          recoverySendCodeBtn.disabled = false;
        }
      });
    }

    if (recoveryResetBtn) {
      recoveryResetBtn.addEventListener('click', async function () {
        const mode = recoveryMethodSelect ? recoveryMethodSelect.value : 'email';
        const email = String((recoveryEmailInput && recoveryEmailInput.value) || '').trim().toLowerCase();
        const codeInput = String((recoveryCodeInput && recoveryCodeInput.value) || '').trim();
        const newPassword = String((recoveryNewPasswordInput && recoveryNewPasswordInput.value) || '');
        const confirmPassword = String((recoveryConfirmPasswordInput && recoveryConfirmPasswordInput.value) || '');

        if (!email) {
          setRecoveryFeedback('Enter your account email.', true);
          return;
        }

        if (newPassword.length < 6) {
          setRecoveryFeedback('New password must be at least 6 characters.', true);
          return;
        }

        if (newPassword !== confirmPassword) {
          setRecoveryFeedback('New password and confirmation do not match.', true);
          return;
        }

        if (mode !== 'direct' && !codeInput) {
          setRecoveryFeedback('Enter the reset code that was sent to you.', true);
          return;
        }

        try {
          await postApi('/api/auth/reset-password', {
            email: email,
            newPassword: newPassword,
            recoveryMethod: mode,
            code: codeInput || undefined
          });

          setRecoveryFeedback('Password reset successful. You can now sign in with your new password.', false);
          emailInput.value = email;
          if (recoveryNewPasswordInput) {
            recoveryNewPasswordInput.value = '';
          }
          if (recoveryConfirmPasswordInput) {
            recoveryConfirmPasswordInput.value = '';
          }
          if (recoveryCodeInput) {
            recoveryCodeInput.value = '';
          }
        } catch (error) {
          setRecoveryFeedback(error.message, true);
        }
      });
    }

    if (modal) {
      modal.addEventListener('click', function (event) {
        event.stopPropagation();
      });
    }

    return {
      open: openModal,
      close: closeModal,
      overlay: overlay
    };
  }

  function getSignInModal() {
    if (!signInModalApi) {
      signInModalApi = createSignInModal();
    }
    return signInModalApi;
  }

  function wireSignInButtons() {
    document.querySelectorAll('.auth-buttons .btn-signin, .js-open-signin').forEach(function (btn) {
      if (btn.tagName === 'A') {
        btn.setAttribute('href', '#');
      }
      btn.setAttribute('data-auth', 'signin');
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        const modal = getSignInModal();
        if (modal && typeof modal.open === 'function') {
          modal.open();
        }
      });
    });
  }

  function markSignedInUser() {
    const session = readJson(storageKeys.session, null);
    if (!session || !session.name) {
      return;
    }

    document.querySelectorAll('.auth-buttons').forEach(function (authArea) {
      if (authArea.querySelector('.signed-in-label')) {
        return;
      }
      const label = document.createElement('span');
      label.className = 'signed-in-label';
      label.textContent = 'Hi, ' + session.name;
      authArea.appendChild(label);
    });
  }

  function isHomePage() {
    const page = window.location.pathname.split('/').pop();
    return !page || page === 'index.html';
  }

  function isAfrikomiksPage() {
    const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
    return page === 'afrikomiks.html' || page === 'afrikomiks';
  }

  function isAfrikomiksReaderPage() {
    const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
    return page === 'afrikomiksreader.html' || page === 'afrikomiksreader';
  }

  async function fetchJsonWithFallback(paths) {
    const tried = [];
    for (let i = 0; i < paths.length; i += 1) {
      const path = paths[i];
      if (!path || tried.indexOf(path) !== -1) {
        continue;
      }
      tried.push(path);
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (response.ok) {
          return response.json();
        }
      } catch (_) {
        // Try next candidate URL.
      }
    }
    return null;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function loadHomeContent() {
    if (!isHomePage()) {
      return;
    }

    try {
      const response = await fetch('home-content.json', { cache: 'no-store' });
      if (!response.ok) {
        return;
      }

      const content = await response.json();
      renderHomeContent(content);
    } catch (_) {
      // Keep static HTML fallback when JSON is unavailable.
    }
  }

  async function loadAfrikomiksContent() {
    if (!isAfrikomiksPage()) {
      return;
    }

    try {
      const currentDir = window.location.pathname.replace(/[^/]*$/, '');
      const content = await fetchJsonWithFallback([
        'afrikomiks.json',
        './afrikomiks.json',
        currentDir + 'afrikomiks.json',
        currentDir + 'Afrikomiks.json'
      ]);
      if (!content) {
        return;
      }
      renderAfrikomiksContent(content);
    } catch (_) {
      // Keep static HTML fallback when JSON is unavailable.
    }
  }

  async function loadAfrikomiksReaderContent() {
    if (!isAfrikomiksReaderPage()) {
      return;
    }

    try {
      const currentDir = window.location.pathname.replace(/[^/]*$/, '');
      const content = await fetchJsonWithFallback([
        'afrikomiks.json',
        './afrikomiks.json',
        currentDir + 'afrikomiks.json',
        currentDir + 'Afrikomiks.json'
      ]);
      if (!content) {
        return;
      }
      renderAfrikomiksReaderContent(content);
    } catch (_) {
      // Keep static fallback when JSON is unavailable.
    }
  }

  function hashSeed(seed) {
    const value = String(seed || 'seed');
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function pickFrom(list, seedHash) {
    if (!Array.isArray(list) || !list.length) {
      return '';
    }
    return list[seedHash % list.length];
  }

  function createCartoonAvatarDataUri(seed, label) {
    const hash = hashSeed(seed);
    const skins = ['#f6ccb1', '#eab892', '#dba27b', '#bd8464', '#946246'];
    const hairs = ['#111111', '#2a1d14', '#4b2e1f', '#2b3340', '#5b3a1f'];
    const shirts = ['#2f68b8', '#3a9965', '#c2473d', '#6a4bb8', '#d0801d'];
    const backgrounds = ['#f8f4ea', '#f5efe4', '#faf7ee', '#f6f2e8', '#f8f3e9'];
    const eyeOffset = 10 + (hash % 5);
    const smileCurve = 3 + (hash % 7);
    const browLift = 1 + (hash % 3);
    const noseShift = (hash % 5) - 2;
    const collarWidth = 20 + (hash % 10);
    const sleeveTilt = (hash % 9) - 4;

    const skin = pickFrom(skins, hash);
    const hair = pickFrom(hairs, hash >> 1);
    const shirt = pickFrom(shirts, hash >> 2);
    const background = pickFrom(backgrounds, hash >> 3);
    const ink = '#101010';

    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="' + escapeHtml(label || 'Character') + '">',
      '<rect width="120" height="120" fill="' + background + '"/>',
      '<path d="M14 16 L106 16 L106 104 L14 104 Z" fill="none" stroke="#c9b9a0" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>',
      '<g opacity="0.4" stroke="#cdbba2" stroke-width="0.8">',
      '  <path d="M18 24 L34 20"/><path d="M40 26 L58 22"/><path d="M66 24 L84 19"/><path d="M88 27 L102 23"/>',
      '  <path d="M18 98 L36 94"/><path d="M44 96 L62 92"/><path d="M70 98 L88 93"/><path d="M92 97 L104 94"/>',
      '</g>',
      '<circle cx="60" cy="47" r="25" fill="' + skin + '" stroke="' + ink + '" stroke-width="2.4"/>',
      '<path d="M33 43 C38 17, 82 17, 87 43 L87 31 C82 11, 38 11, 33 31 Z" fill="' + hair + '" stroke="' + ink + '" stroke-width="2"/>',
      '<path d="M35 54 Q44 ' + (44 - browLift) + ' 50 47" fill="none" stroke="' + ink + '" stroke-width="2" stroke-linecap="round"/>',
      '<path d="M70 47 Q76 ' + (44 - browLift) + ' 85 54" fill="none" stroke="' + ink + '" stroke-width="2" stroke-linecap="round"/>',
      '<ellipse cx="' + (60 - eyeOffset) + '" cy="48" rx="3" ry="3.6" fill="#ffffff" stroke="' + ink + '" stroke-width="1.5"/>',
      '<ellipse cx="' + (60 + eyeOffset) + '" cy="48" rx="3" ry="3.6" fill="#ffffff" stroke="' + ink + '" stroke-width="1.5"/>',
      '<circle cx="' + (60 - eyeOffset) + '" cy="49" r="1.2" fill="' + ink + '"/>',
      '<circle cx="' + (60 + eyeOffset) + '" cy="49" r="1.2" fill="' + ink + '"/>',
      '<path d="M' + (60 + noseShift) + ' 50 L' + (59 + noseShift) + ' 56 L' + (63 + noseShift) + ' 56" fill="none" stroke="' + ink + '" stroke-width="1.7" stroke-linejoin="round"/>',
      '<path d="M45 61 Q60 ' + (61 + smileCurve) + ' 75 61" fill="none" stroke="' + ink + '" stroke-width="2.2" stroke-linecap="round"/>',
      '<path d="M37 66 L43 67 M77 67 L83 66" stroke="' + ink + '" stroke-width="1.3" stroke-linecap="round"/>',
      '<path d="M30 79 Q60 70 90 79 L90 109 L30 109 Z" fill="' + shirt + '" stroke="' + ink + '" stroke-width="2.4"/>',
      '<path d="M' + (60 - collarWidth / 2) + ' 79 L60 90 L' + (60 + collarWidth / 2) + ' 79" fill="#ffffff" stroke="' + ink + '" stroke-width="1.6"/>',
      '<path d="M31 90 Q40 ' + (95 + sleeveTilt) + ' 48 106" fill="none" stroke="' + ink + '" stroke-width="1.5" opacity="0.8"/>',
      '<path d="M89 90 Q80 ' + (95 - sleeveTilt) + ' 72 106" fill="none" stroke="' + ink + '" stroke-width="1.5" opacity="0.8"/>',
      '</svg>'
    ].join('');

    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function renderAfrikomiksReaderContent(content) {
    if (!content || typeof content !== 'object') {
      return;
    }

    const stories = Array.isArray(content.comicStories) ? content.comicStories : [];
    if (!stories.length) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const storyId = params.get('story');
    const story = stories.find(function (item) {
      return item.id === storyId;
    }) || stories[0];

    const titleEl = document.getElementById('comic-reader-title');
    const metaEl = document.getElementById('comic-reader-meta');
    const summaryEl = document.getElementById('comic-reader-summary');
    const stripEl = document.getElementById('comic-character-strip');
    const panelsEl = document.getElementById('comic-panels');
    const prevEpisodeEl = document.getElementById('comic-prev-episode');
    const nextEpisodeEl = document.getElementById('comic-next-episode');
    const episodeStateEl = document.getElementById('comic-episode-state');

    const seriesId = story.seriesId || story.id;
    const seriesEpisodes = stories
      .filter(function (item) {
        return (item.seriesId || item.id) === seriesId;
      })
      .sort(function (a, b) {
        return (Number(a.episodeNumber) || 1) - (Number(b.episodeNumber) || 1);
      });
    const currentIndex = seriesEpisodes.findIndex(function (item) {
      return item.id === story.id;
    });
    const prevEpisode = currentIndex > 0 ? seriesEpisodes[currentIndex - 1] : null;
    const nextEpisode = currentIndex >= 0 && currentIndex < seriesEpisodes.length - 1
      ? seriesEpisodes[currentIndex + 1]
      : null;

    if (episodeStateEl) {
      const currentEpisode = Number(story.episodeNumber) || (currentIndex + 1) || 1;
      episodeStateEl.textContent = 'Episode ' + currentEpisode + ' of ' + String(seriesEpisodes.length || 1);
    }

    if (prevEpisodeEl) {
      if (prevEpisode) {
        prevEpisodeEl.href = 'AfrikomiksReader.html?story=' + encodeURIComponent(prevEpisode.id);
        prevEpisodeEl.classList.remove('is-disabled');
        prevEpisodeEl.setAttribute('aria-disabled', 'false');
      } else {
        prevEpisodeEl.href = '#';
        prevEpisodeEl.classList.add('is-disabled');
        prevEpisodeEl.setAttribute('aria-disabled', 'true');
      }
    }

    if (nextEpisodeEl) {
      if (nextEpisode) {
        nextEpisodeEl.href = 'AfrikomiksReader.html?story=' + encodeURIComponent(nextEpisode.id);
        nextEpisodeEl.classList.remove('is-disabled');
        nextEpisodeEl.setAttribute('aria-disabled', 'false');
      } else {
        nextEpisodeEl.href = '#';
        nextEpisodeEl.classList.add('is-disabled');
        nextEpisodeEl.setAttribute('aria-disabled', 'true');
      }
    }

    if (titleEl) {
      titleEl.textContent = story.title || 'Comic Story';
    }
    if (metaEl) {
      metaEl.textContent = story.meta || '';
    }
    if (summaryEl) {
      summaryEl.textContent = story.summary || '';
    }

    const characters = Array.isArray(story.characters) ? story.characters : [];
    if (stripEl && characters.length) {
      stripEl.innerHTML = characters.map(function (character) {
        const imgSrc = createCartoonAvatarDataUri(character.seed || character.name, character.name);
        return [
          '<div class="comic-character-card">',
          '<img class="comic-character-avatar" src="' + imgSrc + '" alt="' + escapeHtml(character.name || 'Character') + '">',
          '<p class="comic-character-name">' + escapeHtml(character.name || 'Character') + '</p>',
          '</div>'
        ].join('');
      }).join('');
    }

    const characterMap = {};
    characters.forEach(function (character) {
      characterMap[character.id] = character;
    });

    const panels = Array.isArray(story.panels) ? story.panels : [];
    if (panelsEl && panels.length) {
      panelsEl.innerHTML = panels.map(function (panel, index) {
        const character = characterMap[panel.characterId] || characters[0] || { name: panel.speaker || 'Narrator' };
        const imgSrc = createCartoonAvatarDataUri(character.seed || character.name, character.name);
        const bubbleStyle = escapeHtml(panel.bubbleStyle || 'speech');
        return [
          '<article class="comic-panel comic-panel-' + bubbleStyle + '">',
          '<div class="comic-panel-head">',
          '<span class="comic-panel-number">Panel ' + String(index + 1) + '</span>',
          '<span class="comic-panel-speaker">' + escapeHtml(panel.speaker || character.name || 'Narrator') + '</span>',
          '</div>',
          '<div class="comic-panel-body">',
          '<img class="comic-panel-avatar" src="' + imgSrc + '" alt="' + escapeHtml(character.name || 'Character') + '">',
          '<p class="comic-panel-text comic-bubble comic-bubble-' + bubbleStyle + '">' + escapeHtml(panel.text || '') + '</p>',
          '</div>',
          '</article>'
        ].join('');
      }).join('');
    }
  }

  function renderAfrikomiksContent(content) {
    if (!content || typeof content !== 'object') {
      return;
    }

    function setAfrikomiksTitle(titleElement, titleText) {
      if (!titleElement) {
        return;
      }
      if (titleText === 'AfriKomiks') {
        titleElement.setAttribute('aria-label', titleText);
        titleElement.innerHTML = [
          '<span class="afrikomiks-title-part afrikomiks-title-part-sun">Afri</span>',
          '<span class="afrikomiks-title-part afrikomiks-title-part-sky">Ko</span>',
          '<span class="afrikomiks-title-part afrikomiks-title-part-leaf">miks</span>'
        ].join('');
        return;
      }
      titleElement.removeAttribute('aria-label');
      titleElement.textContent = titleText;
    }

    const heroSection = document.getElementById('afrikomiks-hero');
    const kicker = document.getElementById('afrikomiks-kicker');
    const title = document.getElementById('afrikomiks-title');
    const subtitle = document.getElementById('afrikomiks-subtitle');
    const grid = document.getElementById('afrikomiks-grid');
    const footerResources = document.getElementById('afrikomiks-footer-resources');

    const backgroundLayers = Array.isArray(content.hero && content.hero.backgroundLayers)
      ? content.hero.backgroundLayers.filter(Boolean)
      : [];
    if (heroSection && backgroundLayers.length) {
      heroSection.style.background = backgroundLayers.join(', ');
    }

    if (kicker && content.hero && content.hero.kicker) {
      kicker.textContent = content.hero.kicker;
    }
    if (title && content.hero && content.hero.title) {
      setAfrikomiksTitle(title, content.hero.title);
    }
    if (subtitle && content.hero && content.hero.subtitle) {
      subtitle.textContent = content.hero.subtitle;
    }

    const resourceLinks = Array.isArray(content.footerResources) ? content.footerResources : [];
    if (footerResources && resourceLinks.length) {
      footerResources.innerHTML = resourceLinks.map(function (item) {
        const label = escapeHtml(item.label || 'Resource');
        const href = escapeHtml(item.href || '#');
        return '<li><a href="' + href + '">' + label + '</a></li>';
      }).join('');
    }

    if (!grid) {
      return;
    }

    const stories = Array.isArray(content.stories) ? content.stories : [];
    if (!stories.length) {
      return;
    }

    function resolveStoryHref(storyId, explicitHref) {
      let resolvedHref = explicitHref || '#';
      if (storyId && (!explicitHref || explicitHref === '#')) {
        const allComics = Array.isArray(content.comicStories) ? content.comicStories : [];
        const firstEpisode = allComics
          .filter(function (item) {
            return (item.seriesId || item.id) === storyId;
          })
          .sort(function (a, b) {
            return (Number(a.episodeNumber) || 1) - (Number(b.episodeNumber) || 1);
          })[0];
        const storyTarget = firstEpisode ? firstEpisode.id : storyId;
        resolvedHref = 'AfrikomiksReader.html?story=' + encodeURIComponent(storyTarget);
      }
      return escapeHtml(resolvedHref);
    }

    function cleanCardMeta(metaText) {
      return String(metaText || '')
        .replace(/\bEpisodes?\b/gi, '')
        .replace(/\b\d+\b/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+\|\s+/g, ' | ')
        .replace(/\s*\|\s*/g, ' | ')
        .replace(/^\|\s*/g, '')
        .replace(/\|\s*$/g, '')
        .trim();
    }

    grid.innerHTML = stories.map(function (story) {
      const coverClass = story.coverClass ? ' ' + escapeHtml(story.coverClass) : '';
      const coverImage = story.coverImage ? escapeHtml(story.coverImage) : '';
      const coverImageAlt = escapeHtml(story.coverImageAlt || story.title || 'Story image');
      const buttonText = escapeHtml(story.buttonText || 'Read Story');
      const buttonHref = resolveStoryHref(story.storyId, story.buttonHref);
      const secondaryTitle = escapeHtml(story.secondaryTitle || '');
      const secondaryCoverClass = story.secondaryCoverClass ? ' ' + escapeHtml(story.secondaryCoverClass) : '';
      const secondaryCoverImage = story.secondaryCoverImage ? escapeHtml(story.secondaryCoverImage) : '';
      const secondaryCoverImageAlt = escapeHtml(story.secondaryCoverImageAlt || story.secondaryTitle || 'Story image');
      const secondaryMeta = escapeHtml(cleanCardMeta(story.secondaryMeta || ''));
      const secondarySummary = escapeHtml(story.secondarySummary || '');
      const secondaryButtonText = escapeHtml(story.secondaryButtonText || 'Read Story');
      const secondaryButtonHref = resolveStoryHref(story.secondaryStoryId, story.secondaryButtonHref);
      const secondaryStoryHtml = story.secondaryTitle ? [
        '<div class="afrikomik-secondary">',
        '<div class="afrikomik-secondary-cover' + secondaryCoverClass + '">',
        (secondaryCoverImage ? '<img src="' + secondaryCoverImage + '" alt="' + secondaryCoverImageAlt + '" class="afrikomik-secondary-cover-image">' : ''),
        '</div>',
        '<h3 class="afrikomik-title afrikomik-title-secondary">' + secondaryTitle + '</h3>',
        '<p class="afrikomik-meta">' + secondaryMeta + '</p>',
        '<p class="afrikomik-summary">' + secondarySummary + '</p>',
        '<a href="' + secondaryButtonHref + '" class="btn btn-join">' + secondaryButtonText + '</a>',
        '</div>'
      ].join('') : '';

      return [
        '<article class="afrikomik-card">',
        '<div class="afrikomik-cover' + coverClass + '">',
        (coverImage ? '<img src="' + coverImage + '" alt="' + coverImageAlt + '" class="afrikomik-cover-image">' : ''),
        '<span class="afrikomik-badge">' + escapeHtml(story.badge || '') + '</span>',
        '</div>',
        '<div class="afrikomik-body">',
        '<h2 class="afrikomik-title">' + escapeHtml(story.title || '') + '</h2>',
        '<p class="afrikomik-meta">' + escapeHtml(cleanCardMeta(story.meta || '')) + '</p>',
        '<p class="afrikomik-summary">' + escapeHtml(story.summary || '') + '</p>',
        '<a href="' + buttonHref + '" class="btn btn-join">' + buttonText + '</a>',
        secondaryStoryHtml,
        '</div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderHomeContent(content) {
    if (!content || typeof content !== 'object') {
      return;
    }

    renderGradeCards(content.gradeSection);
    renderCourseCards(content.courseSection);
    renderFeatures(content.featuresSection);
    renderReviews(content.reviewsSection);
  }

  function renderGradeCards(section) {
    if (!section) {
      return;
    }

    const title = document.getElementById('grade-section-title');
    const subtitle = document.getElementById('grade-section-subtitle');
    const grid = document.getElementById('grade-cards-grid');
    if (!grid) {
      return;
    }

    if (title && section.title) {
      title.textContent = section.title;
    }
    if (subtitle && section.subtitle) {
      subtitle.textContent = section.subtitle;
    }

    const cards = Array.isArray(section.cards) ? section.cards : [];
    if (!cards.length) {
      return;
    }

    grid.innerHTML = cards.map(function (card) {
      const listHtml = (Array.isArray(card.list) ? card.list : []).map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      }).join('');

      const labelHtml = card.label ? '<span class="card-label">' + escapeHtml(card.label) + '</span>' : '';
      const iconHtml = card.iconClass
        ? '<div class="card-icon"><i class="' + escapeHtml(card.iconClass) + '"></i></div>'
        : '<div class="card-icon">' + escapeHtml(card.iconText || '') + '</div>';
      const buttonText = escapeHtml(card.buttonText || 'Explore');
      const buttonHref = escapeHtml(card.buttonHref || '#');

      return [
        '<div class="card">',
        labelHtml,
        iconHtml,
        '<h3 class="card-title">' + escapeHtml(card.title) + '</h3>',
        '<p class="card-message">' + escapeHtml(card.message) + '</p>',
        '<ul class="card-list">' + listHtml + '</ul>',
        '<a href="' + buttonHref + '" class="btn btn-explore">' + buttonText + '</a>',
        '</div>'
      ].join('');
    }).join('');
  }

  function renderCourseCards(section) {
    if (!section) {
      return;
    }

    const title = document.getElementById('course-section-title');
    const grid = document.getElementById('course-cards-grid');
    if (!grid) {
      return;
    }

    if (title && section.title) {
      title.textContent = section.title;
    }

    const cards = Array.isArray(section.cards) ? section.cards : [];
    if (!cards.length) {
      return;
    }

    grid.innerHTML = cards.map(function (card) {
      const buttonText = escapeHtml(card.buttonText || 'Learn more');
      const buttonHref = escapeHtml(card.buttonHref || '#');
      return [
        '<div class="course-card">',
        '<img src="' + escapeHtml(card.image) + '" alt="' + escapeHtml(card.alt) + '" class="course-card-image">',
        '<h3 class="course-card-title">' + escapeHtml(card.title) + '</h3>',
        '<p class="course-card-description">' + escapeHtml(card.description) + '</p>',
        '<a href="' + buttonHref + '" class="btn btn-learn-more">' + buttonText + ' &rarr;</a>',
        '</div>'
      ].join('');
    }).join('');
  }

  function renderFeatures(section) {
    if (!section) {
      return;
    }

    const title = document.getElementById('features-section-title');
    const subtitle = document.getElementById('features-section-subtitle');
    const grid = document.getElementById('features-grid');
    if (!grid) {
      return;
    }

    if (title && section.title) {
      title.textContent = section.title;
    }
    if (subtitle && section.subtitle) {
      subtitle.textContent = section.subtitle;
    }

    const items = Array.isArray(section.items) ? section.items : [];
    if (!items.length) {
      return;
    }

    grid.innerHTML = items.map(function (item) {
      return [
        '<div class="feature-item">',
        '<div class="feature-icon"><i class="' + escapeHtml(item.iconClass) + '"></i></div>',
        '<div class="feature-content">',
        '<h3 class="feature-title">' + escapeHtml(item.title) + '</h3>',
        '<p class="feature-message">' + escapeHtml(item.message) + '</p>',
        '</div>',
        '</div>'
      ].join('');
    }).join('');
  }

  function renderReviews(section) {
    if (!section) {
      return;
    }

    const title = document.getElementById('reviews-section-title');
    const subtitle = document.getElementById('reviews-section-subtitle');
    const grid = document.getElementById('reviews-grid');
    if (!grid) {
      return;
    }

    if (title && section.title) {
      title.textContent = section.title;
    }
    if (subtitle && section.subtitle) {
      subtitle.textContent = section.subtitle;
    }

    const items = Array.isArray(section.items) ? section.items : [];
    if (!items.length) {
      return;
    }

    grid.innerHTML = items.map(function (item) {
      const starsCount = Math.max(0, Math.min(Number(item.stars) || 0, 5));
      const stars = new Array(starsCount).fill('<i class="fas fa-star"></i>').join('');
      return [
        '<div class="review-card">',
        '<div class="review-stars">' + stars + '</div>',
        '<p class="review-text">' + escapeHtml(item.text) + '</p>',
        '<p class="review-name">' + escapeHtml(item.name) + '</p>',
        '</div>'
      ].join('');
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateFooterYear();
    setActiveNavLink();
    wireJoinButtons();
    wireSignInButtons();
    markSignedInUser();
    loadHomeContent();
    loadAfrikomiksContent();
    loadAfrikomiksReaderContent();
  });
})();
