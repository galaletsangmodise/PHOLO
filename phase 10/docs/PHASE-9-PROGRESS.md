# Phase 9: Paper file digitisation (F7) - progress notes

Paste the ticks and the log row below into `IMPLEMENTATION_PLAN.md` (Phase 9 checkboxes and Section 17).

## Section 17 progress log row

| Phase | Date | Status | Automated tests (passed / total) | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 9 | 08 Nov 2026 | Built, waiting for your `.env` and human checks | Types, API unit, web unit and component: 608 pass here (563 from earlier phases + 45 new); database and integration tests need your `.env` | Phase 9: Paper file digitisation | OP13 in the API; M3; S8 history rows, badge and "Record paper file history" wired; M2 already offers the paper file status |

## Step 1: tests written first (Red)
- [x] Web: `components/PaperFileHistoryModal.test.tsx` (T-US15-1, T-US15-2, T-M3-1..7). Failed first ("Cannot find module").
- [x] Web: `screens/S8.test.tsx` additions (T-S8-11, T-US15-1, T-US15-2, T-M3-6, T-M3-7, Clinical, 401). Failed first (M3 did not open).
- [x] Web: `components/PatientDetailsModal.test.tsx` additions (T-US14-1, T-US14-2). **These passed at once**: M2 and its paper file status dropdown were built in Phase 5, so there was nothing new to turn green. They now pin that behaviour.
- [x] Shared: `packages/types/src/patients.spec.ts` (M3 messages, limits, BR18 check). Failed first (missing exports).
- [x] API unit (runnable here): `patients/patients.service.spec.ts`, 9 new cases for OP13. Failed first (`recordPaperHistory` did not exist).
- [x] API integration: `test/patients.int-spec.ts` (T-US14-1, T-US15-1, T-US15-2, T-BR18-1..4, T-INT-13, T-INT-20) and `test/roles.int-spec.ts` (T-SEC-24a, T-SEC-24b for OP13). **Never run (need your hosted project), so never seen failing either.** They compile and lint clean.
- [ ] T-E2E-7 is manual (below).

## Step 2: Backend
- [x] `src/patients/`: OP13 `recordPaperHistory` (service) and `PATCH /patients/:id/paper-history` (controller, `@Authenticated()` and `@Roles('Reception', 'Clinical')`).
- [x] The three texts are checked with the shared M3 rules (500 / 300 / 500 characters, box ticked with all three empty). With the box ticked the update also sets "Paper file - digitised"; BR18 is enforced by the trigger `patients_guard` (a refusal, error code 23514, answers 400).
- [x] Runs with the user's token (policy `patients_update_reception_clinical` applies); writes AuditLog `recorded_paper_history` through `write_audit`. `file_number` and `paper_file_status` are never read from the request.

## Step 3: Frontend
- [x] M3 `components/PaperFileHistoryModal.tsx`: title, three long-text fields with the PRD placeholders, checkbox only for "Paper file - not yet digitised" (unticked), every state (Normal, Empty, Loading "Saving...", Error, Offline, Success through S8).
- [x] S8 page: "Record paper file history" opens M3; after Save the history rows, the badge "Paper file - digitised" and the toast "Paper file history saved." show, and the file is not opened (or logged) a second time.
- [x] M2: already offers "No paper file" and "Paper file - not yet digitised" for new patients (Phase 5); no change needed.
- [x] `recordPaperHistory` in `patientsApi.ts`; shared `PAPER_HISTORY_*` and `paperHistoryErrors` in `@pholo/types`.

## Step 4: Refactor and full check
- [x] New `components/ModalFrame.tsx` (backdrop, card, offline banner, title, button row) is now used by M2 and M3, so the shell is not written twice. M2's tests pass unchanged.
- [x] Lint and type check clean. 608 tests pass here (types, API unit, web unit, web component).
- [x] The API compiles (`npm run build -w apps/api` works) and registers the new route.
- [ ] `npm run check` (it also runs `test:db` and `test:int`) and `next build` need your setup.

## Not run here
Database tests, integration tests (the new OP13 ones included), `next build` and `npm run check`. Nothing was committed; the commit message for you is "Phase 9: Paper file digitisation".

## Step 5: Manual checks (human)
- [ ] As Reception (`busisiwe.naidoo@ubuntu-clinic.example`): S7, "New patient", create a Patient with "Paper file - not yet digitised" (S8 shows the toast "Patient file created."), "Record paper file history", type "Penicillin" under Allergies, tick "Mark the paper file as digitised", "Save": S8 shows the allergy, the badge "Paper file - digitised" and the toast "Paper file history saved.".
- [ ] M3 matches its Stitch design side by side (the DESIGN prompt is "M3 Paper file history").
- [ ] As Clinical: "Record paper file history" works too.
- [ ] T-E2E-7 (Flow 7 of PRD 7.1): S7, "New patient", M2, S8, M3 with the box ticked, S8 with the toast.

## Decisions and deviations to confirm
1. **Route** (the plan fixes only the operation name): `PATCH /patients/:id/paper-history`. Body: `chronic_conditions`, `allergies`, `current_medication` (texts or null) and `mark_digitised` (true or false). Answers 200 with the Patient, 400 `{ message, field }`, 403, 404, 500 as in OP10 to OP12.
2. **The three texts replace what is stored.** M3 opens filled with the stored text and sends all three, so an emptied field clears the stored text. Texts are trimmed; an empty text is saved as null.
3. **Status rules go through the trigger.** "Digitised" is accepted only from "Paper file - not yet digitised" with one text filled in. From "No paper file" the trigger refuses and OP13 answers 400 with the BR18 message ("Add at least one item ...") because the PRD has no message for a wrong starting status; M3 never shows the box then, so a person cannot reach it from the screen.
4. **History can be saved without the box**, also for "No paper file" Patients (the status stays). The PRD does not forbid it and M3 is open to every Patient File.
5. **A file already "Paper file - digitised"** has no checkbox, but its history can still be corrected in M3.
6. **PRD M3 sample (1) is Joseph Mokoena with the box ticked**, but the seed has him already digitised (no box shown). The component test uses a "not yet digitised" Patient for that sample.
7. **The long-text fields have no `maxLength`**, so the "can be at most N characters" message can be reached by typing or pasting more (the check happens on Save).
8. **History rows on S8** are unchanged from Phase 5: only rows with text show, and "Nothing recorded yet." when all three are empty (T-S8-11 read that way).
9. **M2 and M3 share `ModalFrame`.** No visible change to M2.
10. **Not run here:** see "Not run here" above.
