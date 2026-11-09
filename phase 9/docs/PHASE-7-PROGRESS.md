# Phase 7: Visit record (F4) - progress notes

Paste the ticks and the log row below into `IMPLEMENTATION_PLAN.md` (Phase 7 checkboxes and Section 17).

## Section 17 progress log row

| Phase | Date | Status | Automated tests (passed / total) | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 7 | 08 Nov 2026 | Built, waiting for your `.env` and human checks | Types, API unit, web unit and component: 536 pass here (444 from earlier phases + 92 new); database and integration tests need your `.env` | Phase 7: Visit record | OP7, OP14, OP15, OP16 in the API; S9; M4 "Complete visit" and "Leave without saving"; S8 "Show details" for Clinical; S6 "Start consultation" starts the Visit |

## Step 1: tests written first (Red)
- [x] Web: `screens/S9.test.tsx` (T-US9-1..3, T-US10-1, T-US10-2, T-S9-1..11, T-M4-8, T-EDGE-6; the screen and the page). Failed first ("Cannot find module").
- [x] Web: T-S8-10 added to `screens/S8.test.tsx`; the S6 test for "Start consultation" changed (see deviation 10). Both failed first.
- [x] API unit (runnable here): `visits/visits.service.spec.ts`, extra cases in `patients/patients.service.spec.ts`. Failed first.
- [x] API integration: `test/visits.int-spec.ts` (T-US9-1..3, T-US10-1, T-INT-4, T-INT-8, T-INT-16, T-BR8-1..6, T-BR9-3, T-EDGE-10) and T-SEC-23a/23b (OP7, OP14, OP15, OP16) in `test/roles.int-spec.ts`. **Never run (need your hosted project).**
- [x] Shared: `packages/types/src/visits.spec.ts` (BR8 rules). I wrote this spec and `visits.ts` in one step, so it was not seen failing first.
- [ ] T-E2E-3 and T-E2E-4 are manual (below).

## Step 2: Backend
- [x] `src/visits/` (module, controller, service). Routes: `GET /visits/:id` (OP14), `POST /visits/:id/start` (OP7), `PUT /visits/:id/draft` (OP15), `POST /visits/:id/complete` (OP16). All `@Authenticated()` and `@Roles('Clinical')`.
- [x] Updates run with the user's token, only while the Visit has the expected status (Called for OP7, In consultation for OP15 and OP16), so `visits_guard` and the policies still apply. AuditLog rows `started_consultation`, `saved_draft`, `completed_visit` through `write_audit`.
- [x] OP16 checks BR8 on the server with the shared rules (symptoms 1 to 1000, outcome one of five, notes up to 2000, up to 5 ICD-10 codes). A fault answers 400 with `message` and `field`.
- [x] BR9: a Completed or Left Visit answers 409 "This visit can no longer be changed." and nothing is written or logged.
- [x] OP10 for Clinical now also returns symptoms, notes, ICD-10 codes, outcome and the clinician's name (from `visits`). Reception still reads the view and gets none of them.

## Step 3: Frontend
- [x] S9 (`app/visits/[id]/page.tsx`, `VisitScreen.tsx`): every state, "Save draft", "Complete visit", M4 versions, "Open full file", unsaved-text protection on Back and Log out.
- [x] S6: "Start consultation" calls OP7 and then opens S9; "Continue" opens S9.
- [x] S8: "Show details" / "Hide details" for Clinical (`PatientFileScreen.tsx`, `patientsApi.ts`).
- [x] `visitsApi.ts`, `startConsultation` in `queueApi.ts`, PUT in `apiRequest`.

## Step 4: Refactor and full check
- [x] Lint and type check clean. 536 tests pass here (types, API unit, web unit, web component).
- [x] The API compiles. [ ] `npm run check` and `next build` need your setup.

## Step 5: Manual checks (human)
- [ ] Clinical: call, "Start consultation", type on S9, "Save draft", leave and "Continue" (text is back), "Complete visit", "Yes, complete visit": S6 shows "Visit completed." and S8 shows the Visit with "Show details".
- [ ] Reception: S8 shows the Visit with no clinical details; opening `/visits/<id>` shows the not-allowed message.
- [ ] S9 and S8 match their designs side by side at 1440 x 900; T-E2E-3 and T-E2E-4 ticked.

## Decisions and deviations to confirm
1. **Routes** (the plan fixes only operation names): `GET /visits/:id`, `POST /visits/:id/start`, `PUT /visits/:id/draft`, `POST /visits/:id/complete`.
2. **Two messages are mine** (not in the PRD): "This visit can no longer be changed." (409, BR9) and "This visit cannot be started." (409, OP7 on a Visit that is not Called).
3. **OP7 on a Visit that is already In consultation** answers 200 without a second AuditLog row, so "Continue" and a double tap are harmless.
4. **OP14 answers any status.** S9 then goes to S6 (Waiting, Called) or S8 (Completed, Left) with no message (Section 18, #23).
5. **A draft stores empty texts as nothing (null)**, because the database does not allow an empty symptoms text. The length and code checks still apply to a draft (400 with the field message); no field is required.
6. **"Open full file" with unsaved text asks "Leave without saving?" first.** The PRD lists M4 only for "Back to queue" and Log out; I added it so typed text is never lost silently. "Leave without saving" then opens S8.
7. **A server fault on "Complete visit"** shows the red text inside M4 (and keeps it open); a 400 field message closes M4 and shows under the field; a 409 closes M4 and shows above the buttons.
8. **S6 "Start consultation" fails** (someone else started or finished it): the server message shows as a toast, the list is read again, S9 does not open.
9. **OP10 for Clinical reads the `visits` table** (policy `visits_select_clinical`) and the clinician names from `staff_profiles` (policy `staff_linked_to_visit`). Check this against your hosted project.
10. **An earlier test was changed:** `S6.test.tsx` T-S6-11 now waits for "Start consultation" to call OP7 before S9 opens; the Continue part is the same.
11. **The Patient strip is one line** in a heading: "Nkosi, Sipho · 40 yrs · File PH-000002 · Queue number 2".
12. **Not run here:** database tests, integration tests and `next build`. Nothing was committed; the commit message for you is "Phase 7: Visit record".
