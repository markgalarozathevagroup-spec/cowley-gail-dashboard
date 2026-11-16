# Gail's Dashboard — Cowley Associates

Next.js (App Router) + Google Sheets backend, deployed on Vercel. Each module has its own API route so one failure never blanks the app.

## Environment variables (server-side only)

```
GOOGLE_SHEET_ID=1-V8ufB35Wri2TTQu851caYzjieNTnyeLcoOo5CFRm3Y
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Put them in `.env.local` (git-ignored). Never prefix with `NEXT_PUBLIC_`.

## Google Cloud setup

1. Open Google Cloud Console and create project **Cowley Dashboard**.
2. Enable **Google Sheets API**.
3. Create a **service account** and download its JSON key.
4. Copy `client_email` and `private_key` from the JSON into the env vars above.
5. Open the Cowley dashboard Google Sheet, click Share, add the service-account email as **Editor**.

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000/mailchimp
npm run lint
npm run build
```

## Status

Phase 1 (Mailchimp) complete. See CHANGELOG.md.
