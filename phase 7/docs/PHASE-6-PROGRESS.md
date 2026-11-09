# Phase 6: Live Queue and calling (F3) - progress notes

Paste the ticks and the log row below into `IMPLEMENTATION_PLAN.md` (Phase 6 checkboxes and Section 17).

## Section 17 progress log row

| Phase | Date | Status | Automated tests (passed / total) | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 6 | 07 Nov 2026 | Built, waiting for your `.env` and human checks | Types, API unit, web unit and component: 444 pass here (394 from earlier phases + 50 new); database and integration tests need your `.env` | Phase 6: Live Queue and calling | OP5, OP6, OP8 in the API; S6 and M4 wired; Reception and Clinical views |

## Step 1: tests written first (Red)
- [x] Web: `screens/S6.test.tsx` (T-US6, T-US7, T-US8, every S6 state, 5-second refresh, offline pause, call next, M4 flow). Failed first ("Cannot find module").
- [x] API unit (runnable here): `queue/queue.spec.ts`, `queue/queue.service.spec.ts`. Failed first.
- [x] API integration: `test/queue.int-spec.ts` and T-SEC-23a/b, T-SEC-24a/b in `test/roles.int-spec.ts`. Each test uses its own clinic. **Never run (need your hosted project).**

## Step 2: Backend
- [x] `src/queue/` (module, controller, service, logic). Routes: `GET /queue?tab=active|done` (OP5), `POST /queue/call-next` (OP6, Clinical only), `POST /queue/:id/left` (OP8).
- [x] OP5 first closes earlier days' open Visits (`close_stale_visits`), then reads `visits_for_reception` for today (SAST).
- [x] OP6 uses `call_next_patient()` with the user's token: urgent first, then oldest check-in; audit `called_next`.
- [x] OP8 uses `mark_visit_left()`; audit `marked_left`.

## Step 3: Frontend
- [x] S6 (`app/queue/QueueScreen.tsx`, `page.tsx`): all states, 5-second refresh (paused offline), toasts, tabs, Reception and Clinical buttons. M4 via `ConfirmDialog kind="markLeft"`.
- [x] `queueApi.ts`; `StatusBadge` gets "Paper file" and "Helped"; `MESSAGES.offlineQueue`.
- [x] Phase 3 route shell replaced.

## Step 4: Refactor and full check
- [x] Lint and type check clean. 444 tests pass here.
- [x] API compiles. [ ] `npm run check` and `next build` need your setup (no Google Fonts here).

## Step 5: Manual checks (human)
- [ ] Reception on a second computer + check-in on the tablet: row shows on both within 5 seconds (T-US7-1).
- [ ] Clinical: call next, urgent comes first, toast "Calling number N: First Surname".
- [ ] S6 matches its design at 1440 x 900.
- [ ] T-E2E-3 (partly; completes in Phase 7).

## Decisions and deviations to confirm
1. Message "This visit can no longer be marked as left." (409) is mine; the PRD has none.
2. OP8 goes through the Phase 2 function `mark_visit_left`, because Reception cannot read the visits table.
3. OP6 answers 200 `{none_waiting:true}` when nobody is waiting; the screen then just refreshes.
4. Routes `POST /queue/call-next` and `POST /queue/:id/left` (plan fixes only operation names).
5. `counts.uncalled` added so "Call next patient" disables correctly; the "Waiting" chip counts Waiting + Called.
6. "Today" = check-in since SAST midnight; counts cover the whole day.
7. Integration test "finished visit refused" uses an already-Left visit.
8. "Start consultation" and "Continue" just go to `/visits/:id` (built in Phase 7).
9. Fixed the API `dev`/`build` scripts ("No workspaces found") with `--prefix ../../packages/types`.
10. Not run here: database tests, integration tests, `next build`. Commit message: "Phase 6: Live Queue and calling".
