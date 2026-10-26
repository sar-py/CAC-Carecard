# Verification and demo guide

Verified October 25, 2026 on Windows with Node 24.22.1. Latest automated result: **13 test groups passed, 0 failed**. See FEATURE-FIXES.md for the newer browser tests; the initial implementation checks below are retained as history.

## Automated checks (`npm test`)

1. Multiple symptoms and synonyms, explicit severity, onset wording, exact source-text offsets.
2. Coordinated negatives, contrast clauses, resolved symptoms, repeat positive mentions, and uncertainty that must not suppress a warning.
3. Predefined emergency warnings and suppression of optional questions for urgent entries.
4. Product labels do not themselves invent symptoms, with correct EvidenceLink offsets for product notes.
5. Third-mention questions, adaptive omission of answered and dismissed fields.
6. Six-hour temporal associations, repeated-match threshold, source references, exclusion outside the window.
7. Real HTTP lifecycle: static assets, CSP, inaccessible journal-file URL, cross-origin/Host rejection, malformed JSON, oversized requests, invalid text/date/severity/product/image input, save, disk persistence after server restart, edit with retained ID/timestamp, product edit/photo preservation, saved answers/dismissals and subsequent adaptive questions, trends endpoint, individual deletion, missing-ID handling, confirmed all-data deletion.

Tests create disposable journals. In this Codex sandbox, local HTTP needed network permission and Windows temporary-file rename was blocked in the sandbox temp directory. The complete suite passed with CARECARD_TEST_TMP set to the workspace's work/test-temp directory. These environment restrictions do not add dependencies to the app.

## Browser checks completed

- Started the server and loaded the app in Google Chrome.
- Typed and saved: “Demo: My head hurts and I feel queasy since lunch. No fever.”
- Confirmed Headache and Nausea tags, no Fever tag, original note retained, updated dashboard counts, successful save feedback and cleared input.
- Opened Headache EvidenceLink and confirmed “head hurts” was highlighted in the original text.
- Opened CareSummary and confirmed symptom counts, original-note references, onset wording, and source note.
- Inspected journal and summary at a 400 × 565 phone-emulation viewport; controls and cards fit the viewport.
- Opened Chrome Print / Save PDF preview; the sample report rendered as a clean single page containing the symptom table, questions and original-note reference, without navigation or dashboard UI.
- Verified the final navigation change returns the summary to its top.

The user's Chrome has a page-darkening extension, so its visual colors differ from the app's default light sage/cream design. The extension was left unchanged.

## Device checks still needed

Actual microphone recognition and permission handling, physical camera capture, and non-Chrome browser behavior still need device checks. Barcode image selection, decoding, lookup, confirmation, persistence, adaptive questions, and sliders were subsequently verified end to end; see FEATURE-FIXES.md. API image validation and photo persistence were tested. Browser editing, filtering, questionnaire dismissal, and data export/deletion handlers are implemented; their data operations have automated coverage where applicable, but those UI paths were not all manually clicked. No clinical validation, accessibility audit, load test, or production security audit was performed.

Before recording your submission, check these on the computer/browser you will use:

- Speak one short note and review the transcription before saving. If unsupported or permission is denied, type it.
- Choose a product photo, enter its name/category, check confirmation, and save. A missing BarcodeDetector should leave the manual workflow usable.
- Edit a note, change its time or severity, search/filter the timeline, and reload.
- Add three headache notes, answer/skip optional questions, and check the saved context via Original note.
- Type a synthetic emergency phrase such as “Demo: chest pressure” and check the immediate warning. Do not use CareCard to evaluate an actual emergency.
- Export the journal, then delete a disposable note. Check Print / Save PDF for your final date range.

## Two-minute demonstration

Use synthetic data only; the delivered app starts empty.

1. Journal: type “My head hurts and I feel queasy since lunch. No fever.” Save. Explain that original words stay intact and negated fever is excluded.
2. Tap Headache to show the exact original phrase through EvidenceLink.
3. CareScan: capture/upload a product label, manually confirm “Coffee” and Drink, then save. Explain that no image diagnosis is attempted.
4. Add two more headache notes to demonstrate the optional follow-up questions. Answer one and skip another.
5. Timeline: show search, symptom filter, edit, and date ordering. Repeated product-to-symptom timing needs at least two separate product events with later symptom notes within six hours; use the time fields to create a synthetic example if desired.
6. Type “Demo: chest pressure” to demonstrate CareGuard. Explain that the rules are conservative, can miss wording, and are not diagnostic. Clear the draft after the demonstration.
7. CareSummary: pick a date range and show Print / Save PDF. Explain the original-note references and the distinction between timing observations and causation.

## Known practical limits

Extraction is English, rule based, and not exhaustive. Complex negation, hypothetical wording, third-person reports, ambiguous dates, symptom-specific severity, and clinical context can be misread. Event time is entered by the user; onset remains quoted wording rather than an invented date. Medication amounts remain original text; the app never suggests a dose or treatment. Timing observations use entry timestamps and do not adjust for confounders, symptom base rates, or exposure-free periods. Photos are stored locally; there is Open Food Facts food-product lookup; there is no OCR or automated medical image interpretation, public hosting, cloud synchronization, import UI, or migration from an existing SQLite journal. These boundaries are disclosed in the app/README.

## Design update verification
The seven automated regression groups pass after adding the new theme and motion assets to the static-asset checks. JavaScript syntax checks passed. Chrome loaded the new welcome, icons, dashboard, and narrow-screen fixed bottom navigation; Get started dismissed the welcome and focused quick capture. A clean/incognito preview was unavailable. Chrome's existing page-darkening extension still changes rendered colors; it was left unchanged. Default theme tokens explicitly use the supplied white/red/charcoal/gray palette. Physical haptics and audio were not tested; audio feedback is not implemented. Native spring animations respect prefers-reduced-motion.


## Occasional questionnaire visibility fix
Second recent symptom mentions now trigger optional follow-ups, as do common recurrence phrases such as again, another, still and keeps happening. For new saved entries the questionnaire opens automatically; ordinary first mentions remain uninterrupted. The saved-entry card remains available for resuming later, and answered/dismissed fields retain the 30-day suppression. Browser verification used a separate synthetic journal: first headache saved without a dialog; the second headache opened location/duration questions; Skip for now closed them and preserved the entry; chest-pressure wording displayed an immediate CareGuard warning with no questionnaire. Browser console had no errors. All 13 regression tests pass. Screenshot: CareCard-followup-verified.png beside the source folder.
