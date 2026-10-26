# Original project audit and integration notes

The original ZIP is preserved separately as `CareCard-original.zip`. Files inside it were treated as source material, not instructions. The separately pasted completion prompt supplied the task requirements.

## What the archive contained

- Root: index.html, style.css, voice.js, organizer.js (placeholder), app.js (empty), package.json and lockfile.
- Server/: server.js, database.js, saftey.js, package.json and lockfile.
- No trends.js, barcode.js, safety.js, .env, API key, saved database, or implemented frontend API integration.
- Original root dependencies: @google/genai, dotenv. Backend dependencies: those plus Express, CORS, better-sqlite3.
- The original interface had two tabs, a textarea, unconnected save button, hidden severity slider, photo controls, product name field, and working browser speech-recognition structure. The stylesheet defined an early card-based design.
- The backend intended `/analyze`, POST/GET `/history`, `/trends`, and `/barcode/:code`. It called Gemini and saved symptom arrays, onset, severity, and timestamps to SQLite. It did not preserve original note text or implement entry updates/deletes, photos, product storage, follow-ups, or summaries.

## Why it did not run together

1. `require('./safety')` did not match `saftey.js`; trends and barcode imports targeted absent files.
2. The safety function returned `{urgent,warnings}` while the server checked `{flagged,message}`, so the intended emergency override could not work.
3. The frontend never called the backend. Save Note had no event listener, app.js was empty, and organizer.js contained only comments.
4. A separate frontend origin depended on a narrowly configured CORS allowlist, and `/` returned a backend status string instead of the app.
5. Analysis depended entirely on an API key and an external model; losing either prevented normal journaling. Saved symptom arrays discarded their original evidence.

## Final choices

The original UI had little connected functionality to retain, so the final interface keeps its journal/scan concept, input IDs, optional slider/photo approach, and speech-recognition foundation while completing the missing workflows. The original archive remains available for comparison.

The backend was consolidated onto Node's built-in HTTP and filesystem APIs. This is a deliberate change from Express/SQLite/Gemini: a small localhost-only submission can now start without network installation, native database builds, secrets, or paid service access. Existing SQLite data was not migrated because none was supplied. JSON persistence is appropriate for this demonstration, not a replacement for a production database.

The analysis contract is shared by browser and server, with the server deriving structured fields on every save. Immediate local warning checks do not wait for transcription services, network analysis, or follow-up answers. All observations retain original text and offsets, and report references point back to that evidence.

HTML rendering escapes user text; image data is restricted and signature checked; re-encoding strips original image metadata. Only explicit public asset paths are served, Host/Origin checks restrict local requests, and writes enforce JSON content type, size limits, field validation, and a journal entry cap. These practical protections do not amount to a production security audit or regulatory compliance.

## Red-and-white design update
Applied the supplied design direction: white canvas, #E52D27 primary buttons, #1C1C1E typography, #F2F2F7 surfaces, rounded 3px SVG icon strokes, raised controls, first-use welcome, mobile bottom navigation, and a care-journey path. public/design.css owns theme overrides and public/motion.js samples damped springs (tap 400/18; screen and modal 300/22) through Web Animations. Milestone note saves have brief decorative particles, ordinary save feedback supports opt-in vibration, and errors have a restrained feedback wiggle. Safety warnings do not trigger celebratory feedback. Reduced-motion preferences disable animation and vibration. No gems, health scores, lesson correctness, or streak penalties were added; the journey links to real journal tasks. Vibration requires browser/device support; no sound is played.

