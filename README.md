# Learn56

Learn56 is a responsive, multi-page education website prototype focused on primary-level learning experiences.

## Live Website

After GitHub Pages is enabled for this repository, the site is available at:

- https://jodankyi.github.io/Learn56/

## Project Highlights

- Multi-page static website (HTML, CSS, JavaScript)
- Responsive layout across desktop, tablet, and mobile
- Interactive maths practice experience with:
  - Grade-based question sets (P1 to P6)
  - Feedback and solution steps
  - Progress visuals and badges
- Side navigation utilities with modal popups:
  - Editable timetable modal
  - Messages modal with response area
  - Teacher comments modal
- Local persistence for:
  - Timetable edits
  - Message thread updates

## Main Pages

- index.html
- Math.html
- PrimaryMath.html
- PrimaryMathPractice.html
- Teacher.html

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Font Awesome (CDN)
- Node.js API (Express) for auth and OTP delivery
- SQLite database (user store)
- bcrypt password hashing
- Twilio (SMS)
- SendGrid (Email)

## Local Development

This is a static project. No build step is required.

1. Clone the repository.
2. Open the project in VS Code.
3. Open index.html in a browser.

## Auth + OTP API Setup (Production Flow)

Registration, sign-in, and password reset are handled by the backend API in `server.js`.

1. Install dependencies:
  - `npm install`
2. Copy env template:
  - `cp .env.example .env`
3. Fill credentials in `.env`:
  - Database: `DB_PATH`, `BCRYPT_ROUNDS`
  - Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
  - SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
4. Start API:
  - `npm start`
5. Keep frontend open as usual.

### API Endpoints

- `POST /api/auth/register` with `{ name, email, role, password }`
- `POST /api/auth/login` with `{ email, password }`
- `POST /api/auth/reset-password` with `{ email, newPassword, recoveryMethod, code? }`
- `POST /api/otp/request` with `{ email, channel, phone? }`
- `POST /api/otp/verify` with `{ email, code }`

### Frontend API Base URL

By default, frontend uses `http://localhost:8787` on localhost.

For deployed environments, set this global before loading `site.js`:

```html
<script>
  window.LEARN56_API_BASE_URL = "https://your-api-domain.com";
</script>
```

## Repository Structure

- Images/ : site assets and illustrations
- global.css : shared global styles
- style.css : component and page styles
- *.html : pages and page-specific markup

## Deployment (GitHub Pages)

1. Open repository Settings on GitHub.
2. Go to Pages.
3. Set Source to Deploy from a branch.
4. Select branch main and folder /(root).
5. Save and wait for deployment.

## License

This project is for learning and demonstration purposes.
