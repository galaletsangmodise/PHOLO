# Phase 8: Daily summary (F6) - progress notes

Paste the ticks and the log row below into `IMPLEMENTATION_PLAN.md` (Phase 8 checkboxes and Section 17).

## Section 17 progress log row

| Phase | Date | Status | Automated tests (passed / total) | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 8 | 08 Nov 2026 | Built, waiting for your `.env` and human checks | Types, API unit, web unit and component: 563 pass here (536 from earlier phases + 27 new); database and integration tests need your `.env` | Phase 8: Daily summary | OP17 in the API; S10 for the Manager |

## Step 1: tests written first (Red)
- [x] Web: `screens/S10.test.tsx` (T-US13-1, T-US13-2, T-S10-1..9, the page, and the `summaryApi` mapping). Failed first (missing modules).
- [x] API unit (runnable here): `summary/summary.service.spec.ts` (T-US13-1, T-INT-10, errors). Failed first.
- [x] API integration: `test/summary.int-spec.ts` (T-US13-1, T-US13-2, T-BR15-1..4, T-INT-10) and T-SEC-22a/22b in `test/roles.int-spec.ts`. **Never run (need your hosted project).** Visits are placed relative to 00:00 SAST so the answers do not depend on the time of day; T-BR15-4 skips itself before 03:10 SAST (same as the database test).
- [ ] T-E2E-6 is manual (below).

## Step 2: Backend
- [x] `src/summary/` (module, controller, service). Route: `GET /summary` (OP17), `@Authenticated()` and `@Roles('Manager')`.
- [x] The service calls `daily_summary` with the Manager's own token (the function checks the role again and counts only the caller's Facility). Only the seven numbers and the six reasons leave the API; any other key is dropped.

## Step 3: Frontend
- [x] S10 (`app/summary/page.tsx`, `SummaryScreen.tsx`): heading "Today at <clinic>", date, seven cards, table "Reasons for visit today", "Updated at HH:MM" and "Refresh", every state. Refreshes every 5 seconds, paused while offline. The Phase 3 route shell is replaced.
- [x] `summaryApi.ts`; shared `summary.ts` in `@pholo/types`.

## Step 4: Refactor and full check
- [x] Lint and type check clean. 563 tests pass here.
- [x] The API compiles. [ ] `npm run check` and `next build` need your setup.

## Step 5: Manual checks (human)
- [ ] Log in as Manager (`farouk.patel@ubuntu-clinic.example`): S10 shows the numbers of the sample data (4, 1, 2, 0, 47 min, 0, 1 if the seed visits are from today).
- [ ] Check a Patient in on the tablet: the "Checked in" number goes up within 5 seconds without pressing "Refresh".
- [ ] S10 matches its design at 1440 x 900; T-E2E-6 ticked.

## Decisions and deviations to confirm
1. **Route** (the plan fixes only the operation name): `GET /summary`.
2. **Empty state replaces the cards.** When nobody has checked in today, S10 shows only the message "No check-ins yet today. Numbers will appear after the first patient checks in." (no zero cards or table). The footer "Updated at" and "Refresh" stay.
3. **The reasons table is sorted most frequent first** (ties in the tablet's order), as in the PRD sample (1, 1, 1, 1, 0, 0). The API sends them in the tablet's order.
4. **"Updated at"** shows the time the numbers were last read, in SAST.
5. **Error message** "We could not load the summary. Please try again." is used for the API's server problem as well (same words as the screen).
6. **A failed background refresh** keeps the numbers on screen and shows nothing; only a failed first load or "Try again" shows the error.
7. **Heading and table column names:** the table has the headings "Reason" and "Patients"; the PRD gives none.
8. **Not run here:** database tests, integration tests and `next build`. Nothing was committed; the commit message for you is "Phase 8: Daily summary".
