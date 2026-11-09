# Phase 4: Tablet Check-in - progress notes

Paste the ticks and the log row below into `IMPLEMENTATION_PLAN.md` (Phase 4 checkboxes and Section 17).

## Section 17 progress log row

| Phase | Date | Status | Automated tests (passed / total) | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 4 | 07 Nov 2026 | Built, waiting for your `.env` and human checks | Types, API unit, web unit and component: 314 pass here; database and integration tests need your `.env` | Phase 4: Tablet Check-in | OP4 in the API; S2, S3, S4, S5, M1 and tablet log out (M4); 15-second and 2-minute timers |

## Step 1: tests written first (Red)
- [x] Web: `screens/S2`, `S3`, `S4`, `S5`, `checkin` (whole flow), `checkin-timeout`, `components/PrivacyNoticeModal`, plus the S1 Privacy Notice test. They failed first ("Cannot find module").
- [x] Shared: `packages/types/src/time.spec.ts` (weekday and ISO date for the S2 header). Failed first.
- [x] API unit (extra, runnable here): `src/checkin/checkin.service.spec.ts`. Failed first.
- [x] API integration: `test/checkin.int-spec.ts` (T-US1-1, T-US1-3, T-US2-1, T-US3-1, T-INT-2, T-INT-11, T-INT-12, T-EDGE-3, T-BR14-1) and the T-SEC-21a/21b additions to `test/roles.int-spec.ts`.
- [ ] The integration specs need your hosted project, so I could not run them here.

## Step 2: Backend
- [x] `src/checkin/`: OP4 `POST /checkin` (`@Authenticated() @Roles('Check-in')`). It checks every answer with the shared rules, calls the database function `checkin` with the service role and `p_tablet_id` = the logged-in tablet, and answers with `queue_number`, `already_checked_in`, `urgent`, `has_file` only. BR14 (database error 54000) answers 429 with the exact message.
- [x] Facility name for the Check-in Header comes from OP3 (`profile.facilityName`).

## Step 3: Frontend
- [x] S2 (`app/checkin/page.tsx`), S3 (`details`), S4 (`visit`), S5 (`done`), M1 (`components/PrivacyNoticeModal.tsx`, also opened from S1), every state.
- [x] Answers are held in memory only (`components/CheckinProvider.tsx`); a reload shows S2.
- [x] 2-minute timer on S3 and S4 (restarts on every touch), 15-second timer on S5 (`app/checkin/timers.ts`), press-and-hold logo for 3 seconds opens M4 "Log out of this tablet?".
- [x] Under-18 text on S4 from the date of birth; consent box starts unticked (BR17).
- [x] Tablet sizes added to TextField, ChoiceButton, Checkbox and FieldError; new `DateOfBirthField`, `CheckinFrame`, Card `tone="error"`.

## Step 4: Refactor and full check
- [x] Lint and typecheck clean; 314 tests pass here (types, API unit, web unit, component); the API compiles and starts with route `POST /checkin`.
- [ ] `npm run check` needs your `.env` and the linked project.
- [ ] `next build` could not run here (no access to Google Fonts); `npm run dev` on your machine will show whether the page compiles.

## Step 5: Manual checks (human)
- [ ] On a real tablet on the Wi-Fi: check in Thandi Dlamini, then Palesa Molefe (urgent), then Joseph Mokoena with help; S5 shows each number.
- [ ] Switch the Wi-Fi off: the red banner shows and the buttons are disabled.
- [ ] S2 to S5 and M1 match their designs side by side at 1280 x 800, and the layout stacks in portrait.
- [ ] Hold the logo for 3 seconds: "Log out of this tablet?" opens; "Yes, log out" shows S1.
- [ ] T-E2E-1 (Flow 1 of PRD 7.1) ticked.

## Human steps before the integration tests
1. Fill `.env`, link the project, `npx supabase config push`, `npm run db:reset`.
2. `npm run test:int`. The BR14 test makes 41 Check-ins with its own tablet account and closes those Visits afterwards (best effort).

## Decisions and deviations to confirm
1. **Shared rules package.** `@pholo/types` had no way to be loaded by the API at run time (its entry was a `.ts` file). Now: `main` is `dist/index.js`, `module` and `types` are `src/index.ts`; the API `dev` and `build` scripts build the package first; Jest maps `@pholo/types` to its `src`. `@pholo/types` is added as a dependency of `apps/api` and `apps/web`.
2. **Shared messages.** `CHECKIN_MESSAGES` (S3 and S4 wording) lives in `packages/types/src/messages.ts` so the web app and OP4 use the same words.
3. **File locations.** The plan allows no new folders, so the screens are `StartScreen.tsx`, `details/DetailsScreen.tsx`, `visit/VisitScreen.tsx`, `done/DoneScreen.tsx` beside each `page.tsx` (Next.js pages cannot export extra names), and the shared parts are in `apps/web/components/`.
4. **Stitch screenshots versus the PRD.** The screenshots you sent show wording that is not in the PRD ("Welcome • Wamkelekile", a queue status card, "Check in for Care", "Staff & Clinician Log In", a language switcher, sub-captions on the reasons, "Family planning", "Baby or child check", a progress bar). I used the PRD wording everywhere, as the plan says the PRD wins. Tell me if you want any of the extra items.
5. **Date of birth boxes** show the placeholders "DD", "MM" and "YYYY" with "/" between them, which reads "DD / MM / YYYY".
6. **Field labels** read "ID number (optional)" and "Cellphone number (optional)".
7. **S2 clears the answers** each time it opens (Done, a timer, "Back", a reload).
8. **What counts as a touch** for the 2-minute timer: pointer down, touch, mouse down and key press.
9. **Status codes of OP4:** success 200, wrong answers 400, BR14 limit 429, not allowed 403, session ended 401, server problem 500. If the tablet's login has ended during a Check-in, the tablet goes to S1.
10. **Extra unit spec** for the OP4 service so the rules and error mapping are checked without Supabase.
