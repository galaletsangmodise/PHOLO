# Phase 10: Hardening - progress notes

Paste the ticks and the log row below into `IMPLEMENTATION_PLAN.md` (Phase 10 checkboxes and Section 17).

## Section 17 progress log row

| Phase | Date | Status | Automated tests (passed / total) | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 10 | 08 Nov 2026 | Built, waiting for your `.env` and human checks | Types, API unit, web unit and component: 660 pass here (608 from earlier phases + 52 new); database and integration tests need your `.env` | Phase 10: Hardening | Two real bugs fixed (responsive classes, raw API errors); NFR, security and edge tests added |

## What the hardening found and fixed
1. **Responsive classes that did nothing (found by T-NFR-4).** `tailwind.config.ts` defines only two breakpoints (`tablet` 640 px and `desktop` 1024 px) and replaces Tailwind's defaults, so `md:` and `sm:` produce no CSS at all. S6 (the Queue list became a table-like row from `md:`) and S10 (the card grid used `sm:`) were written with them in Phases 6 and 8, so on a laptop S6 would have stayed in the stacked "card" layout and S10 in one column. Both now use `tablet:`. The test scans every file in `app/` and `components/` so this cannot come back.
2. **Raw errors could reach the user (T-INT-19).** Nest's default errors ("Bad Request", "Cannot GET /x", "Internal server error", and `statusCode` fields) were sent as they were for a broken JSON body, an unknown route or an unexpected bug. New `src/common/exception.filter.ts` (registered in `app.setup.ts`): our own exact messages pass through unchanged (with `field`); everything else becomes the PRD 12.2 message for its status (401 session ended, 403 not allowed, 429 too many tries, otherwise "Something went wrong on our side. Please try again.").
3. **Logging (T-INT-18).** The same filter logs only server problems, only as `METHOD /path -> status ErrorType` (no query, body, header, token or message text). There was no other logging in the API.
4. **Integration tests now run through the real error filter** (`test/helpers.ts` calls `configureApp`).

## Step 1: tests written (Red, then Green)
- [x] `web/__tests__/nfr/layout.test.tsx` (T-NFR-4, T-NFR-5): the unknown-prefix scan failed first (fix 1); dates, times and +27 numbers.
- [x] `web/__tests__/nfr/accessibility.test.tsx` (T-NFR-6): contrast of the PRD 9.4 pairs, sizes, 44 px, 72 px and the 3 px focus outline; every control on S6, S9, S10 and the dialogs has a name; every badge has a word; a form error has a red border, an icon and a message. **These passed at once** (Phases 3 to 9 already followed the tokens).
- [x] `web/__tests__/nfr/offline.test.tsx` (T-NFR-3): the three offline messages, the banner going away by itself, S6, S9, S10 and M3 offline. **Passed at once.**
- [x] `web/__tests__/nfr/speed.test.tsx` (T-NFR-1): S6, S9 and S10 show a loading placeholder at once while the answer is slow. **Passed at once.**
- [x] `web/__tests__/nfr/messages.test.ts` (T-INT-19, in the web unit project): the 13 exact PRD 6.2 and 12.2 texts exist in the code. **Passed at once.**
- [x] `api/src/common/exception.filter.spec.ts` (T-INT-18, T-INT-19): failed first (module missing).
- [x] `api/test/nfr.int-spec.ts` (T-NFR-2, T-NFR-7, T-NFR-8) and `api/test/security.int-spec.ts` (T-INT-17, T-INT-18, T-INT-19). **Never run (need your hosted project).**
- [x] T-DB-17 and the earlier edge-case tests (T-EDGE-1 to T-EDGE-10) are in their earlier files and run with the full check; the database and integration ones need your project.
- [ ] T-E2E-1 to T-E2E-7 are manual (Section 15).

## Step 4: full check
- [x] Lint, type check and API build clean. 660 tests pass here.
- [ ] `npm run check`, `test:db`, `test:int` and `next build` need your setup.

## Step 5: Manual checks (human)
- [ ] Tablet: switch Wi-Fi off during S3 and S4: the banner shows, nothing typed is saved, and it goes away by itself when the Wi-Fi is back.
- [ ] Walk through the 7 flows (T-E2E-1 to T-E2E-7) and tick each in Section 15.
- [ ] PRD 3.1 goals: (G1) 10 people (at least 3 aged 60 or over): at least 9 of 10 finish a Check-in within 90 seconds on their own and 9 of 10 assisted ones within 2 minutes; (G2) every Completed Visit has symptoms and an outcome; (G3) a new Check-in shows on a second screen within 5 seconds, 10 of 10 tries, and every called Visit has `called_at`.
- [ ] On Chrome, Edge and Safari: Check-in screens from 800 px wide, staff screens from 1024 px, rows become cards under 640 px (S6 and S7 especially, after fix 1).
- [ ] Every screen against its design, side by side.

## Decisions and deviations to confirm
1. **PRD contrast figure:** the text colour `#1A2B2B` on `#F7FAFA` is really 14.05 to 1; the PRD writes 14.1. The test accepts a figure within 0.1 of the PRD value and always at least 4.5.
2. **S5 "already checked in":** PRD 6.2 writes one sentence ("You are already checked in. Your number is 3."), but PRD S5 specifies a heading plus a number card. The code follows S5, and the message test checks the heading text.
3. **Speed (T-NFR-1)** is tested as "a loading placeholder shows at once", which is what a component test can prove. The 3-second check on the real tablet is manual.
4. **Layout (T-NFR-4)** can only test the breakpoints and classes in jsdom (there is no real layout engine); real widths are in the manual checks.
5. **T-NFR-7** builds the 300 Check-ins as the administrator (two bulk inserts) instead of 300 API calls, to keep the test short.
6. **Not run here:** database tests, integration tests and `next build`. Nothing was committed; the commit message for you is "Phase 10: Hardening".
