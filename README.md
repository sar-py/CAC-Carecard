# CareCard

Private health notebooks with automatic Gemini assistance, conditional severity ratings, optional follow-up questions, barcode/product recognition and an appointment summary.

Live app: https://cac-carecard.vercel.app

## No sign-in

The hosted app opens immediately. Each browser receives a random private HttpOnly/Secure cookie; the server uses its hashed identifier to access that browser's own Supabase rows. Database policies independently block other browser journals. No email, password or Supabase Auth setup is required for the current interface.

Different browsers and devices have separate journals. Clearing cookies/site data, private-browsing cleanup or cookie expiry can disconnect a browser from its stored notes. Export notes before clearing browser data. This version has no account-based recovery or cross-device synchronization. Earlier email-account tables remain protected for backward compatibility and are not exposed through the current browser-journal interface.

The cookie is a bearer capability: protect your browser profile and exports. App code cannot read the HttpOnly cookie. API and sign-in responses are not cached by the service worker. Notes and photos are stored in Supabase, and Google receives selected content for Gemini features.

## Run locally

Install Node.js 24, clone this repository and run:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:3000. This local desktop mode still stores its independent journal in `data/entries.json` and needs no Supabase account. Add your own Gemini key in a local `.env` file. Never commit `.env`, API keys or personal journal data.

## Deploy

See [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md). The current Vercel project and database are already configured. Changing GitHub code does not currently auto-deploy: the Vercel account needs its GitHub login connection linked before Git integration can be enabled. The current site was uploaded directly through Vercel's deployment API.

## Add to a phone

Open the HTTPS site on your phone. iPhone: Safari > Share > Add to Home Screen. Pixel/Android: Chrome menu > Install app or Add to Home screen. No Xcode or Android Studio is needed for this web app. Use the same browser/home-screen profile consistently to keep the same journal.

## Behavior

- Save note automatically runs Gemini when configured. Immediate local CareGuard warnings never wait for Google. Ratings and questionnaires stay optional.
- A failed AI request does not discard an otherwise successful database save; the note keeps rule-based analysis and a visible fallback explanation.
- Barcode decoding stays in the browser; supported foods are looked up in Open Food Facts. Photo label reading sends the selected image only on the explicit Gemini label button. Confirm the name before saving; unknown products keep manual entry.
- Summaries update automatically and link back to the original notes. Check AI drafts against those notes.
- The home-screen app caches only static files. Opening/saving a cloud journal needs internet access; there is no offline journal synchronization. Leave unsaved text open until connection returns.
- AI is limited to 30 requests per browser per minute and 200 requests per day across this personal deployment. Database-enforced counters persist across Vercel instances. Also configure the owner's Google project quota.

CareCard is a personal journal, not a diagnosis, emergency service or clinically validated tool. Absence of a warning does not mean symptoms are safe. No compliance certification is claimed.

## Verify

```sh
npm run build
npm test
npm run test:phone
```

Tests cover extraction/safety/scanning regression, cookies and cross-site protection, private journal isolation, real PostgreSQL policies and phone browser save/reload/severity/questionnaire/summary flows. Browser tests use a separate headless Chrome and synthetic data. Set CARECARD_CHROME to your Chrome executable if needed.

Main hosted files: `api/handler.js`, `Server/cloud.js`, `Server/supabase.js`, `Server/device-session.js`, `cloud/auth.js`, `vercel.json`, and the SQL files under `supabase/migrations`. The auth.js filename is retained for asset compatibility; the current client has no sign-in form or email-auth SDK.

Earlier Markdown implementation notes describe historical versions; this README and DEPLOY-VERCEL.md describe the current hosted app.
