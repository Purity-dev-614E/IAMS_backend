# Resend API key setup

The backend uses Resend via `src/services/emailService.js`:

```js
const resend = new Resend(process.env.RESEND_API_KEY);
```

If `RESEND_API_KEY` is missing from `.env`, the server will crash at startup.

## Required `.env` variables
Add these to `c:/Users/USER/Desktop/IAMS/Backend/.env`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=onboarding@resend.dev
```

## Restart
After updating `.env`, restart:

```bat
npm run dev
```

