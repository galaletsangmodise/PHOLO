# Phase 5: Patient File (F2) - progress notes

Paste the ticks and the log row below into `IMPLEMENTATION_PLAN.md` (Phase 5 checkboxes and Section 17).

## Section 17 progress log row

| Phase | Date | Status | Automated tests (passed / total) | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 5 | 07 Nov 2026 | Built, waiting for your `.env` and human checks | Types, API unit, web unit and component: 394 pass here (314 from earlier phases + 80 new); database and integration tests need your `.env` | Phase 5: Patient File | OP9 to OP12 in the API; S7, S8 and M2; Reception and Clinical views |

## Step 1: tests written first (Red)
- [x] Web: `screens/S7.test.tsx` (T-US4-1, T-US4-2, T-S7-1..9 and the page flow incl. "New patient"), `screens/S8.test.tsx` (T-US5-1, T-US12-1, T-S8-1..9), `components/PatientDetailsModal.test.tsx` (T-US5-2, T-M2-1..9). They failed first ("Cannot find module").
- [x] Shared: `packages/types/src/patients.spec.ts` (M2 messages, BR5, BR6) and age additions to `time.spec.ts`. Failed first.
- [x] API unit (extra, runnable here): `src/patients/patients.service.spec.ts` (BR13, OP10 to OP12, the duplicate ID message, audit calls). Failed first. Two of its tests then failed because of a wrong id in my own fixture; I fixed the fixture, not the checks.
- [x] API integration: `test/patients.int-spec.ts` (T-US4-1, T-US4-2, T-BR13-1..6, T-INT-5, T-INT-6, T-INT-7, T-INT-13, T-BR16-2, T-EDGE-8, T-US5-2, T-US14-2) and the T-SEC-24a/24b additions to `test/roles.int-spec.ts`.
- [x] Database: T-EDGE-8 added to `supabase/tests/checkin.test.ts`.
- [ ] **The integration and database tests need your hosted project. I could not run them here, so they have never been run (not even to see them fail).** They compile and lint clean.
- T-E2E-2 is manual (below).

## Step 2: Backend
- [x] `src/patients/` (module, controller, service). Routes: `GET /patients?q=` (OP9), `GET /patients/:id` (OP10), `POST /patients` (OP11, Reception only), `PATCH /patients/:id` (OP12). All use `@Authenticated()` and `@Roles(...)`.
- [x] OP9 (BR13): under 2 characters gives "Type at least 2 characters to search."; a 13-digit number is an exact ID search; `PH-` and 6 digits is an exact file number search (capitals ignored); anything else is a name prefix on surname and on first name (`%` and `_` are plain characters); at most 20, sorted by surname then first name. Only the last 4 digits of the ID number leave the server.
- [x] OP10: Patient and Visits with the user's token; Visits come from the view `visits_for_reception` (date, number, reason, status, urgent: no symptoms, notes, ICD-10 codes or outcome). Writes `opened_patient_file`.
- [x] OP11: shared M2 checks (BR5, BR6), cellphone saved as +27..., file number from the database trigger, default status "No paper file", writes `created_patient`.
- [x] OP12: the five details only; `file_number` and `paper_file_status` are never taken from the request; writes `updated_patient`.
- [x] Duplicate ID number (database unique index) answers 409 "A patient with this ID number already exists. Open their file instead." with `field` and `existing_patient_id`, so M2 can offer "Open their file". Nothing is saved or audited.

## Step 3: Frontend
- [x] S7 (`app/patients/page.tsx`, `FindPatientScreen.tsx`): every state. "New patient" for Reception only, in the title row and in the no-result state.
- [x] S8 (`app/patients/[id]/page.tsx`, `PatientFileScreen.tsx`): every state; Patient card and Visits side by side on desktop; "Record paper file history" is a placeholder until Phase 9.
- [x] M2 (`components/PatientDetailsModal.tsx`): create and edit, every state.
- [x] New small parts: `patientsApi.ts`, `useGuardedApi.ts` (a 401 logs out and goes to S1), `flash.ts` (carries "Patient file created." from S7 to S8), icons `search` and `calendar`, `ApiError.data`, PATCH in `apiRequest`.

## Step 4: Refactor and full check
- [x] Lint and type check clean. 394 tests pass here (types, API unit, web unit, web component).
- [x] The API compiles and registers the four routes.
- [ ] `npm run check` needs your `.env`, the linked project and `npm run db:reset` (it also runs `test:db` and `test:int`).
- [ ] `next build` was not run here (no access to Google Fonts, as in Phase 4).

## Step 5: Manual checks (human)
- [ ] As Reception on the laptop: search "Dlamini", open her file, change her cellphone number, see the toast "Details saved.".
- [ ] As Reception: create "Nomvula Pillay" (11 / 03 / 1990, 083 555 0198, "Paper file - not yet digitised") and see the toast "Patient file created.".
- [ ] As Clinical: no "New patient" button shows on S7 (title row and no-result state).
- [ ] S7, S8 and M2 match their designs side by side at 1440 x 900.
- [ ] T-E2E-2 (Flow 2 of PRD 7.1): S7 search, S8, "New patient", M2, S8 with the toast.

## Human steps before the integration tests
1. Fill `.env`, link the project, `npx supabase config push`, `npm run db:reset`.
2. `npm run test:db` and `npm run test:int`. The new integration spec makes Patients with random letter names and deletes those without Visits at the end.

## Decisions and deviations to confirm
1. **`visits_for_reception` is a view, not a function.** The plan and the migration make it a view; OP10 reads it with the user's token.
2. **Clinical sees the same Visit list as Reception for now.** The plan gives Clinical's "Show details" (symptoms, notes, ICD-10, outcome, clinician) to Phase 7, so OP10 does not return clinical fields yet, to anyone.
3. **HTTP verbs and answers** (the plan fixes only the messages): OP12 is `PATCH`; create answers 201; a bad field 400 with `message` and `field`; duplicate ID 409; unknown or invalid Patient id 404 "We could not open this file. Please try again."; not allowed 403; session ended 401; server problem 500.
4. **Dates on S7 and S8 are written as in BR19** ("3 May 1954", no leading zero). The PRD sample for S7 shows "03 May 1954", while the plan's test T-S7-4 and BR19 use "14 Aug 1997". Tell me if you want the zero.
5. **Age:** "1 yr" for exactly one year, "0 yrs" under one year, otherwise "N yrs" (Section 18 #24 and the PRD samples).
6. **Cellphone on S8 and in M2** is shown as stored ("+27825550147"); typing "082 555 0147" is still accepted and saved as +27.
7. **History from paper file** shows only the rows that have text; "Nothing recorded yet." when all three are empty.
8. **S8 "← Back"** uses the browser's back step; a file opened directly in a new tab has nothing to go back to.
9. **Search by file number** needs the hyphen ("PH-000003"). The Stitch samples without the hyphen ("PH000003") are not matched, as BR4 and the plan test say "PH-" and 6 digits.
10. **The field "Search"** has no visible label, only the placeholder (and the same text as its accessible name), as in the PRD layout.
11. **Shared code added to `@pholo/types`:** `patients.ts` (M2 messages, `patientFormErrors`, API shapes) and `ageInYears` / `formatAge` in `time.ts`. The web `ageOn` now uses `ageInYears`.
12. **Existing build script problem (not from this phase):** `npm run build -w apps/api` fails with "No workspaces found" because the script uses `-w packages/types` from inside `apps/api`. I built the two parts by hand to check the routes. Tell me if you want it fixed now or in a later phase.
13. **Not run here:** database tests, integration tests and `next build`. Nothing was committed (there is no Git repository in the zip); the commit message for you is "Phase 5: Patient File".
