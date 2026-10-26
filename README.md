# CareCard — Your Health, Remembered

A local, single-user health journal built from your CareCard prototype. Basic local journaling requires no package installation or build step. Gemini features require your own API key in a local `.env` file. Requires Node.js 22 or newer (tested with Node 24).

## Run it

1. Clone this repository: `git clone https://github.com/sar-py/CAC-Carecard.git`.
2. Open the cloned `CAC-Carecard` folder in VS Code, then open its terminal.
3. Run `npm start`.
4. Open **http://127.0.0.1:3000** in Chrome or Edge. Do not double-click index.html; the API needs the server.
5. Keep the terminal open. Press Ctrl+C there to stop.

On Windows, you can also double-click `Start CareCard.cmd`. If PowerShell blocks `npm.ps1`, run `npm.cmd start` or `node Server/server.js`.

If port 3000 is occupied, stop the other CareCard terminal, or in PowerShell run `$env:PORT=3001` followed by `npm start`, then open http://127.0.0.1:3001. The server intentionally accepts connections only from this computer. This is not a public deployment.

## Automatic Gemini assistance

Copy `.env.example` to `.env` beside package.json, set the complete `GEMINI_API_KEY`, and restart the server. The default model is `gemini-3.5-flash-lite`; change `GEMINI_MODEL` if your project uses another compatible model. Keep the key server-side and do not include `.env` when sharing.

Once configured, clicking Save note automatically runs Gemini analysis. There is no AI toggle or analysis button. Urgent local CareGuard warnings appear immediately, independent of Google. AI results enrich symptom tags, conditional severity and optional follow-ups. A newly recognized rated symptom can show an optional rating panel after saving. Summary paragraphs generate automatically after journal changes and when the date range changes; unchanged reports are cached for the page session. Provider failures keep local journaling and the local summary available and display an explanation. Label photo reading remains an explicit action and always requires confirmation.

Note text, recent symptom context, and summary notes go to Google for these features. Photos are sent only when Read label with Gemini is clicked. No API key is served to the browser. A configured key does not guarantee model access, quota, or clinical accuracy.

## What works

- Free-form notes, automatic timestamps, optional backdated event time, persistent local storage, editing and deletion.
- Browser speech-to-text with editable results, start/stop, and error/fallback messages. The browser may send audio to its speech provider; consent is requested first.
- Rule-based extraction of 19 symptom categories, common synonyms, coordinated negations and simple resolved wording. Numerical severity is extracted when explicit; a visible 1–10 slider is optional for symptoms suited to intensity ratings (including pain, nausea, dizziness, fatigue, and rash). Unknown symptoms remain in the original note.
- Chronological timeline with search, symptom/type filters, oldest/newest sorting.
- EvidenceLink tags open the original note and highlight the exact extracted phrase.
- CareScan uploads/camera capture, local image resizing and metadata removal through canvas re-encoding, manual product/activity confirmation. EAN-13/EAN-8/UPC-A image decoding uses native BarcodeDetector where available and a bundled ZXing fallback elsewhere. Decoded or typed barcode numbers are looked up in Open Food Facts; returned names are displayed with attribution and require manual confirmation. Unknown products and network/decoding failures retain manual entry. Only the barcode number leaves the app for this lookup; image contents are not medically interpreted.
- Recurring symptom counts and repeated product/activity → symptom timing within six hours. At least two matched symptom entries are required. Evidence references are preserved. These are descriptive counts, not statistical correlations or causal evidence.
- CareGuard immediately displays predefined emergency warning signs while typing and after saving. A second mention within 30 days, natural recurrence wording such as “again” or “still”, or a relevant symptom combination can trigger up to two symptom-specific questions. The optional questionnaire opens after a new note is saved, so it is visible without searching below the form. Users can skip it or resume through the entry’s Optional questions button. Editing an existing entry does not automatically open it. Answered/dismissed fields are suppressed for 30 days. Emergency warnings bypass questions.
- CareSummary date filtering, symptoms, timing observations, product events, context answers, suggested appointment questions, original-note references, and browser printing / Save as PDF.
- JSON export, individual deletion, and all-data deletion with explicit confirmation.

## Privacy and boundaries

Notes and re-encoded photos are stored in `data/entries.json`. It is created on first save. This file is **not encrypted**. Protect the computer and backups. This version has no login, multi-user access controls, cloud sync, analytics, or analytics collection. Configured Gemini requests are sent to Google as described above. It is appropriate for a local demonstration; do not expose it on the internet or use it as a hosted clinical product.

Export from CareSummary before deleting. The export includes photos and health information. There is no import button; for a complete backup, stop the server and copy the entire `data` folder. Restore it only while the server is stopped. Deleting journal data does not erase exported copies, filesystem backups, or browser download copies.

CareCard is not medical advice, a diagnosis, an emergency service, or a clinically validated triage system. Rules can miss symptoms, misread context, and overflag historical, hypothetical, or third-person wording. Absence of an alert never means a symptom is safe. Emergency wording uses U.S. 911 with a local-number alternative. Warning examples are conservatively informed by [CDC stroke signs](https://www.cdc.gov/stroke/signs-symptoms/), [NHS chest pain](https://www.nhs.uk/symptoms/chest-pain/), [NHS shortness of breath](https://www.nhs.uk/symptoms/shortness-of-breath/), and [London Ambulance emergency examples](https://www.londonambulance.nhs.uk/our-services/emergency-care/calling-999/). Sources checked October 25, 2026. No clinical validation or HIPAA compliance is claimed.

## Code guide for both students

| File | Responsibility |
| --- | --- |
| `Server/server.js` | HTTP routes, validation, safe local origin checks, static frontend serving |
| `Server/database.js` | JSON persistence with write-then-rename; no successful response on disk failure |
| `public/organizer.js` | Shared extraction, CareGuard rules, follow-up selection, timing patterns |
| `public/index.html` | Accessible sections and forms for journal, timeline, scan, report |
| `public/style.css` | Responsive visual system, mobile layouts, reduced-motion and print rules |
| `public/app.js` | API calls, rendering, image processing, editing, EvidenceLink, report and export |
| `public/voice.js` | Your original speech-recognition approach, with privacy notice and error handling |
| `test/carecard.test.js` | Extraction and full API lifecycle regression checks |

Person A can maintain Server/, organizer.js and tests. Person B can maintain public/ UI and voice.js. Both share the entry contract below. Read `CHANGES.md` for the original project audit and integration decisions.

## API contract

Same-origin JSON API. Successful writes return `{entry}`. Errors return `{error}` with an appropriate HTTP status. Clients cannot set derived symptom tags, evidence, safety, or IDs; the server recomputes them.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Startup check |
| POST | `/api/analyze` | `{description, excludeId?}` → `{analysis}` without saving |
| GET | `/api/entries` | `{entries}` newest first |
| POST | `/api/entries` | Create from entry input |
| PUT | `/api/entries/:id` | Replace editable fields; keeps ID and original creation time |
| DELETE | `/api/entries/:id` | Delete entry; send `{}` |
| DELETE | `/api/entries` | Clear journal; requires `{confirm:"DELETE ALL"}` |
| GET | `/api/barcode/:code` | Validated barcode lookup in Open Food Facts; `{product}` or a clear 400/404/503 error |
| GET | `/api/trends` | `{trends}` with counts and evidence pairs |

Entry input: `description` (1–5,000 characters), optional ISO `recordedAt`, integer `severity` (1–10), `image` (JPEG/PNG/WebP data URL, decoded maximum 500 KB), `product` (`{name,type,confirmed:true}`; type food/drink/medication/activity/other), `answers` (question-key → text), and `dismissed` (question keys). PUT uses the same complete input shape; the UI supplies existing fields. No server upload directory is publicly served. The journal is capped at 2,000 entries; photos can make the JSON file large. No import or legacy SQLite migration is implemented because the supplied archive contained no database.

## Test and demonstrate

Run `npm test`. Tests use a disposable temporary journal and do not touch your own data. If Windows sandbox permissions reject temp-file rename, set `CARECARD_TEST_TMP` to a writable scratch folder, then rerun. See `TESTING.md` for verified coverage, remaining device checks, and a short demo script.

The scanner bundles @zxing/library 0.23.0 (Apache-2.0); see public/vendor/README.md and its retained license. Open Food Facts data is community-maintained; follow the source link and check the package. Lookup requires internet access and has an eight-second timeout. There is no OCR, medication database, QR identity inference, or automated symptom-image diagnosis. See FEATURE-FIXES.md for the latest root causes and end-to-end verification.
