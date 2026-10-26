# CareCard

A red-and-white health notebook with automatic Gemini assistance, optional symptom ratings and follow-up questions, product barcode lookup, and an appointment summary linked to original notes.

**Hosted on Vercel:** private email sign-in with Supabase Auth; notes and resized photos in Supabase Postgres with row-level ownership policies. Works on iPhone Safari and Android Chrome, with Add to Home Screen support. AI keys stay server-side.

**Local desktop mode:** `npm start` keeps the original single-user journal in `data/entries.json`, without requiring Supabase. It accepts connections only from the same computer.

## Put it online

Follow [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md). You need your own Vercel and Supabase accounts. The code is deployment-ready, but the database, sign-in email templates, invited emails and environment variables must be configured before the hosted app works. No Vercel project or live Supabase database is provisioned by this repository.

## Run locally

Install Node.js 24, clone the repository, then run:

```sh
git clone https://github.com/sar-py/CAC-Carecard.git
cd CAC-Carecard
npm ci
npm run build
npm start
```

Open http://127.0.0.1:3000. On Windows, `Start CareCard.cmd` also starts the local server. If PowerShell blocks npm.ps1, use `npm.cmd`.

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` for local Gemini. No real key or journal data belongs in Git. The local version does not use cloud sign-in. To test hosted functions locally, use Vercel CLI `vercel dev` after linking your Vercel project and environment variables; ordinary `npm start` deliberately stays local.

## Phone use

Open your HTTPS Vercel URL in Safari or Chrome. Sign in with an email in the owner's `ALLOWED_EMAILS`. Then:

- iPhone: Safari > Share > Add to Home Screen.
- Pixel/Android: Chrome menu > Install app or Add to Home screen.

The installed web app uses the same private cloud journal across signed-in devices. It is a web app, not an App Store or Play Store binary. Photo upload/camera selection and browser/keyboard dictation depend on the phone browser. No native development tools are needed.

## Features and privacy

- Save note automatically runs Gemini when configured, with immediate local CareGuard rules and optional ratings/questions. An AI outage or quota limit does not discard a successfully stored note; it falls back to rule-based analysis.
- Hosted notes and photos are stored under the authenticated account. Every data/AI route verifies the session and invitation; Postgres enforces ownership independently. No Supabase service-role key is used.
- Server-side per-account AI limits persist across Vercel instances. The owner must set Google project quotas and monitor their own usage.
- CareScan decodes EAN/UPC images locally and looks up supported foods in Open Food Facts. Unknown products retain manual entry. Gemini label reading sends the selected image only on the explicit label button. Every suggested product requires confirmation.
- The summary is generated automatically from the selected notes with evidence references. AI can misread or invent details; check against your originals.
- The PWA caches only a static shell. Journal data, sign-in responses and API results are never put in its service-worker cache. The cloud app needs internet access to open or save notes; it does not offer offline journal storage/sync. Keep unsaved text open until you reconnect.
- Hosted privacy differs from local privacy: notes live in your Supabase project, and selected text/images are processed by Google for AI. Browser speech can send audio to the browser's provider. Exports are independent private files.

CareCard is a personal journal, not medical advice, a diagnosis, or an emergency service. It is not clinically validated and makes no compliance certification claim. Absence of a CareGuard warning does not mean symptoms are safe.

## Checks

```sh
npm run build
npm test
npm run test:phone
```

`npm test` covers extraction, API regression, hosted authentication and isolation, Supabase REST contracts, and real PostgreSQL RLS/AI-budget execution via PGlite. `npm run test:phone` uses a separate headless Chrome with synthetic auth/database responses to check the bundled sign-in UI, private save, ratings, questionnaires, summary, sign-out, 320/390/430px layouts, and PWA static-cache boundaries. Set `CARECARD_CHROME` to your Chrome executable if needed.

These tests do not prove a real Supabase project, email delivery, Vercel deployment, or physical iPhone has been configured correctly. Complete the live checks in the deployment guide.

## Main files

| File | Purpose |
| --- | --- |
| `api/handler.js`, `vercel.json` | Serverless entry point, routing, security headers |
| `Server/cloud.js` | Authenticated cloud API and server-side Gemini calls |
| `Server/supabase.js` | Verified user sessions and user-token-scoped database requests |
| `supabase/migrations/20261026_carecard.sql` | Database table, ownership policies and per-account AI budget |
| `cloud/auth.js` | Supabase email-link sign-in client |
| `public/sw.js`, `public/manifest.webmanifest` | Static-shell home-screen app support |
| `Server/server.js`, `Server/database.js` | Original local desktop server and JSON storage |
| `Server/gemini.js`, `public/organizer.js` | AI integration and immediate local safety/analysis rules |

Earlier implementation/design notes in the other Markdown files are historical; this README and DEPLOY-VERCEL.md describe current hosted behavior.
