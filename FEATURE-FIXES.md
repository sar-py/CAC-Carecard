# Three feature fixes — verified October 25, 2026

Changes were made directly in this existing source folder. The frontend's red/white styling and existing journal, timeline, voice, image, report, and persistence workflows remain in place. This folder is not a Git checkout.

| Feature | Root cause | Fix |
| --- | --- | --- |
| Conditional severity | The slider was nested inside a closed details panel, used 0–10, and the frontend never consumed `/api/analyze`. Intensity eligibility covered mostly pain. | Move the slider outside details, enforce 1–10, expand the rated-symptom registry, consume debounced server analysis with stale-response protection, and retain immediate local preview. A rating is saved only when explicitly included or written in the original note. |
| Adaptive questionnaires | Only a third mention triggered generic questions; there were no recurrence-wording or combination rules. History changes could invalidate fields already issued to a saved entry. | Recent recurrence and explicit-recurrence/combination rules select symptom-specific questions. Already saved/dismissed fields are suppressed. Issued fields remain answerable even after history changes. A nonblocking post-save card offers questions; pending questions can be resumed after reload. Save/skip/dismiss never gate ordinary logging. Urgent CareGuard stays independent and suppresses questionnaires. |
| CareScan | Native BarcodeDetector was the sole decoder, with no fallback and no product API. The UI explicitly said lookup was not connected. | Bundle ZXing 0.23.0 locally, add native-to-ZXing image decoding, validate EAN/UPC checksums, and use `/api/barcode/:code` to query Open Food Facts. Display the returned name and source, require confirmation, retain barcode/photo on save, and provide loading, timeout, invalid/not-found/unreadable-image feedback and manual entry. Stale lookups are aborted/ignored and cannot overwrite newer input. |

## Changed files

- `public/organizer.js`: conditional rating policy, 30-day recurring/clarification rules, symptom-specific questions.
- `public/app.js`: server-analysis rendering, optional questionnaire lifecycle/resume, scanner integration, rating/barcode persistence through editing.
- `public/index.html`: visible conditional slider, analysis status, optional follow-up card, scanner lookup/result controls and source/privacy copy.
- `public/design.css`: small additive control/result styles matching the existing design.
- `public/scanner.js` (new): local barcode decoding, Open Food Facts lookup UI, loading, confirmation reset, cancellation and manual fallback.
- `public/vendor/*` (new): pinned, unmodified ZXing bundle with license, provenance and hash.
- `Server/barcode.js` (new): checksum validation, fixed-host lookup, eight-second timeout, one-hour bounded cache, normalized sourced result, explicit failures.
- `Server/server.js`: barcode endpoint, scanner assets, blob image CSP permission for local decoding, severity validation, stable issued-question acceptance.
- `test/carecard.test.js`, `test/features.test.js`, `test/fixtures/*.png`: regressions, API contracts, independent real decoder fixture, deterministic upstream failures.
- `README.md`, `TESTING.md`, this report: updated behavior, API and verification boundaries.

## Verification results

**Automated: 12 passed, 0 failed** (`npm test`, Node 24.22.1). JavaScript syntax checks passed. Tests cover conditional rating eligibility, 1/10 boundaries and rejection of 0, negations, routine versus triggered questions, answer/dismissal suppression, changing history while questions are pending, independent urgent warnings, actual decoding of an independently generated EAN-13 PNG using the bundled library, checksum validation, confirmed product persistence, unknown/nameless/invalid upstream responses, network failure, rate limiting, existing CRUD/persistence/security regressions and static assets.

**Chrome end-to-end, isolated journal on port 3001:**

1. Typed a synthetic headache note; the 1–10 slider appeared without expanding options. Moved it using keyboard controls to 7; saving showed **Severity 7/10** in the timeline. A negated headache/fever note hid the slider. Ordinary first and second headache notes did not open questions.
2. A third headache saved immediately and displayed a nonblocking optional card. Opened it, saved location and duration, then recorded another headache: only the associated-symptoms question remained. Dismissed that question successfully. Typing synthetic chest pressure displayed CareGuard immediately without waiting for save or questions.
3. Explicit “Recurring nausea” triggered nausea-specific meal-timing/duration questions on its first recorded mention. Reloaded, resumed through **Optional questions**, then skipped; the note remained and pending-question controls disappeared.
4. Selected `test/fixtures/nutella-ean13.png` through the actual Windows file picker. CareScan decoded **3017620422003**, queried the real Open Food Facts API, and displayed **Nutella**, **Nutella, Ferrero**, **400 g e** with a source link. The confirmation checkbox remained unchecked. An unconfirmed save was blocked; confirming saved exactly one product entry with its photo and barcode. The timeline and local JSON were checked.
5. Barcode **3017620422004** produced an invalid-checksum error. Barcode **2999913370424** produced a real Open Food Facts not-found response, an empty name field, and re-enabled manual controls. A manually confirmed synthetic product saved successfully after lookup failure.
6. Selected the blank `no-barcode.png` fixture through the file picker. CareScan reported **No readable barcode found**, displayed no identity, and retained typed-barcode/manual-entry controls. Loading was observed during lookup and cleared after failure. Browser console contained no application errors in the final check.

The extension file-upload helper lacked local-file access; the native Windows picker was used instead. No browser security settings were changed. The scanner screenshot is provided alongside this source as `CareCard-product-recognition.png`. All browser data was synthetic and stored outside the deliverable source folder, in `work/feature-e2e-data`; no user's journal was cleared or used as a test fixture.

## Remaining limitations

- Open Food Facts covers community-maintained food/drink records, not every product or medication. Names may be missing, inaccurate or stale; users must check and confirm the package. Unknown identities are never guessed.
- Image decoding supports EAN-13, EAN-8 and UPC-A. A valid 14-digit GTIN may be entered manually. UPC-E and arbitrary QR payloads are not interpreted as food identities.
- Clear PNG fixtures were tested, not physical camera hardware or every real-world glare/rotation/blur condition. The camera capture/file-picker entry point is preserved. Other browsers and devices, microphone and haptics were not retested in this change.
- Internet is required for lookup. Photos decode locally; only the barcode number is sent to Open Food Facts. Notes/photos are not uploaded there. The lookup has an eight-second timeout; service availability and database coverage are outside CareCard's control.
- Extraction/question rules remain nonclinical, English, and not exhaustive. Severity is a single optional entry-level intensity value, not a separate score per symptom. CareGuard can miss wording and never rules out an emergency.

Sources used for implementation: [ZXing library](https://github.com/zxing-js/library) and [Open Food Facts product API](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v2/products/get-product-by-code/). Live source attribution is displayed in CareScan.
