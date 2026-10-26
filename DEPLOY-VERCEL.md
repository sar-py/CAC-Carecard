# Deploy CareCard to Vercel

This guide deploys a private phone-friendly web app with Supabase sign-in and database storage. You must create the accounts, database project and environment variables. The repository alone does not create them.

## 1. Create Supabase

1. Create an account at https://supabase.com/dashboard and a project named CareCard. Store its database password privately. Choose the region you want for your health records.
2. Open SQL Editor > New query. Copy the contents of `supabase/migrations/20261026_carecard.sql` from this repository and run it **once**. It creates the notes table, row-level security policies, and an authenticated per-account AI budget. Do not disable RLS.
3. In the project's settings/Connect dialog, find its Project URL and **publishable key** (or legacy `anon` key). These identify the project and are designed for public client use. Do not use the `service_role` or `sb_secret_` key anywhere in this app.
4. Keep email sign-in and email verification enabled. The app uses sign-in links, not passwords.

## 2. Create Vercel and import GitHub

1. Create an account at https://vercel.com/signup. Connect GitHub and import `sar-py/CAC-Carecard`.
2. Use Framework Preset **Other**, root directory the repository root, build command `npm run build`, output directory `public`, and Node.js **24.x**. The committed `vercel.json` provides these settings and maps `/api/*` to the serverless handler. Do not deploy only the public folder; the API function must be included.
3. Add these environment variables in Vercel for Production (and Preview if you test previews):

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | Your project URL, e.g. `https://your-project.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | The public publishable/anon key from that project |
| `ALLOWED_EMAILS` | Your own sign-in email; comma-separate any other invited emails |
| `GEMINI_API_KEY` | Your private Google key; set it here, never in GitHub |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite`, or a supported compatible model your Google project can access |

4. Deploy. With missing configuration, CareCard stays locked rather than exposing a journal. Copy the final HTTPS production address.
5. Environment changes require redeploying. Vercel must be able to reach Supabase, Google and Open Food Facts. Google project access/quota is separate from Vercel.

## 3. Configure the sign-in links in Supabase

1. Under Authentication > URL Configuration, set Site URL to your production HTTPS Vercel address, and allow the same address with a trailing `/` as a redirect URL. Add only the exact preview/local URLs you intentionally use; broad wildcard redirects are unnecessary for personal use.
2. Under Authentication > Email Templates, edit BOTH **Magic Link** and **Confirm Signup** to use this link:

```html
<h2>Open your private CareCard</h2>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in to CareCard</a></p>
<p>If you did not request this email, ignore it.</p>
```

The app verifies this one-time token hash, removes it from the address bar, and stores the Supabase session. Keep the link on the root `/` URL; there is no separate `/auth/confirm` page. The auth client also supports standard PKCE code returns, but this configured template is the documented/tested callback path.

3. Supabase's built-in mail sender is restricted and rate limited, including restrictions on recipient addresses. For your initial personal test, use the email associated with your Supabase organization. To invite other recipients reliably, configure your own SMTP provider in Supabase. Do not turn off email verification as a workaround. See the official email delivery documentation below.
4. Sign in with an email listed in `ALLOWED_EMAILS`. The app may send an email to other addresses, but the server will refuse journal/AI access unless that account is invited. Keep the list to your own testers to control Google costs.

## 4. Test before entering personal records

Use synthetic notes first:

1. Open the URL on Pixel Chrome and iPhone Safari. Sign in and verify that signed-out access to `/api/entries` returns 401.
2. Save `Synthetic test: headache again, rated 4/10`. Check the conditional severity slider, optional questions and AI status. Skip questions without losing the saved note.
3. Type the synthetic urgent example `my chest hurt severely and I had slurred speech`. The local warning should appear immediately; save should not wait for an AI warning decision.
4. Open CareSummary and check that the automatic paragraph has original-note references. Change date filters and check that the paragraph follows the selected notes.
5. Reload and sign in on a second device with the SAME account: the stored note should be there. Sign in with a DIFFERENT invited account: the first account's notes must not appear. Test edit/delete isolation as well.
6. Test barcode lookup and a product-label photo. Confirm the name before saving. Unknown labels must allow manual entry rather than making up a product.
7. Try airplane mode after loading the page. Local urgent checks can still run, but the cloud app cannot save offline. Leave unsaved text open until the connection returns.
8. Export a JSON copy, test sign-out, and check the installed home-screen app. Do not use real health records until authentication and ownership checks pass on your actual deployment.

## 5. Add it to your phone

- iPhone: open the HTTPS site in Safari, tap Share, then Add to Home Screen.
- Pixel/Android: open it in Chrome, tap its menu, then Install app/Add to Home screen. CareCard Settings also has an install-help button.

The PWA caches only known static assets. API, sign-in and journal responses are excluded, as are URLs with callback query parameters. Access tokens stay in the Supabase client session store, not in the service-worker cache. Sign out on shared devices. There is no offline cloud-journal mode.

## Notes and limits

- Hosted notes/photos reside in your Supabase Postgres project; the Vercel function writes no journal files. The desktop version remains separate. Existing local notes are not automatically uploaded or migrated.
- Photos are resized and stored as bounded data URLs in note records; this personal-app design is simple, but large photo collections consume database space. Review your Supabase plan limits before adding many images.
- AI calls are limited to 30 per account per minute in PostgreSQL. Requests over that budget fall back for ordinary note saving or show an error for summary/photo analysis. Configure Google's project quota/spend controls too.
- No service-role key is needed. The server verifies the user's Supabase session, then queries Postgres with that SAME user's token. RLS is a second layer of separation.
- The sample remains a personal health journal, not a certified clinical product. There is no automated import, account deletion UI, or medical compliance guarantee.

Official documentation:
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/environment-variables
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp
