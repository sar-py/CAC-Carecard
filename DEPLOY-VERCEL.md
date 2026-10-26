# CareCard Vercel deployment

Current site: https://cac-carecard.vercel.app

Current interface: private browser journals, with NO email sign-in. You do not need to configure Supabase email templates, SMTP or auth redirect URLs for this version.

## New deployment setup

1. Create a Supabase project and run the SQL files in `supabase/migrations` in order. The first is retained for earlier account-journal compatibility; the second creates the active browser-private tables, ownership policies and AI budgets. Keep row-level security enabled.
2. Import this repository into Vercel (Framework Other, Node 24.x, build `npm run build`, output `public`). Configure your Vercel account's GitHub login connection for automatic Git deployments. Alternatively deploy the reviewed source using Vercel's API/CLI.
3. Set production environment variables:

| Variable | Value |
| --- | --- |
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_PUBLISHABLE_KEY | Its publishable key, or legacy anon key |
| GEMINI_API_KEY | Your private Google key, server-side only |
| GEMINI_MODEL | gemini-3.5-flash-lite, or a compatible model your Google project can access |

The current no-sign-in mode does not use ALLOWED_EMAILS. Do not use a service-role key in this project. No keys belong in GitHub or the public asset folder.

## Private browser sessions

`GET /api/config` issues an unpredictable 256-bit cookie if this browser has none. It is Secure, HttpOnly, SameSite=Strict, host-only, and valid for up to one year. The server sends a SHA-256-derived device identifier to Supabase in a request header. RLS compares that request identifier with the row owner, so the public publishable key alone cannot retrieve anyone's journal. A request without a device identifier sees no device rows.

Mutation requests require the same origin; data responses are private/no-store. Other browsers receive independent journals. Existing account-owned records are preserved in their protected table, not merged into random browser journals.

Clearing site data/cookies can lose access to the old browser journal; there is no email recovery or cross-device account synchronization. Export before clearing browser data. Uninstalling a home-screen web app may affect its browser storage depending on the device.

The application uses Supabase database storage, not Vercel's temporary filesystem. Journal photos are bounded, resized data URLs in note records; monitor database plan limits if adding many photos. Private export copies must be protected separately.

## Live verification

Use synthetic notes first. Verify that:

- The home page opens directly into the journal without sign-in.
- Saving runs Gemini and persists after reload.
- A second browser/private session does not show the first browser's notes.
- Optional severity and questionnaires work, and urgent CareGuard warnings appear immediately.
- The summary follows the selected notes, and unknown product labels do not invent identities.
- The service worker caches no API/health-note responses.
- No .env, server source or Gemini key is publicly served.

AI budget: 30 requests per browser per minute, 200 per day for this deployment. Ordinary note saves fall back to rule-based extraction if AI is unavailable or the budget is exceeded. Configure Google quotas too. Rate counters are in the private database schema and cannot be modified by ordinary clients.

## Phone installation

Open the HTTPS site. Safari on iPhone: Share > Add to Home Screen. Chrome on Pixel: menu > Install app/Add to Home screen. Use a consistent browser profile. Cloud journaling requires connectivity; the static shell can load offline but notes are not cached offline.

Official references:
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/environment-variables
- https://supabase.com/docs/guides/database/postgres/row-level-security
