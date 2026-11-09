# Phase 3: Staff log-in and roles - progress notes

Paste the ticks and the log row below into `IMPLEMENTATION_PLAN.md` (Phase 3 checkboxes and Section 17).

## Section 17 progress log row

| Phase | Date | Status | Automated tests (passed / total) | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 3 | 07 Nov 2026 | Built, waiting for your `.env` and human checks | Unit 49, component 169 pass here; database and integration tests need your `.env` | Phase 3: Staff log-in and roles | OP1 and OP3 in the API; S1 wired; route guard, inactivity timer, M4 (4 versions) |

## Step 1: tests written first (Red)
- [x] Web: `session.test.tsx`, `screens/navigation.test.tsx`, S1 log-in tests, `StaffHeader`, `CheckinHeader`, `ConfirmModal` (M4) tests. They failed first ("Cannot find module").
- [x] API unit specs (extra, runnable here): `login-lock.spec.ts`, `auth.service.spec.ts`, `roles.guard.spec.ts`. One failed first and showed a real bug (the count did not restart after the 60 seconds); fixed.
- [x] API integration: `apps/api/test/auth.int-spec.ts`, `roles.int-spec.ts` (T-US11, T-AUTH, T-BR12-4, T-INT-1, T-INT-9, T-SEC-26a/b).
- [ ] The integration specs need your hosted project, so I could not run them here.

## Step 2: Backend
- [x] `src/auth/`: token check (AuthGuard), role guard (RolesGuard, `@Roles`, `@Authenticated`), active check, exact "session ended" and "not allowed" answers
- [x] OP1 log in (`POST /auth/login`) with the 60-second lock per email after 5 wrong passwords, in memory
- [x] OP3 (`GET /auth/me`): role, full_name, Facility name
- [x] Supabase Auth settings in `supabase/config.toml`; the limit on changing your own email or phone is in the README
- [x] Route shells for S2, S6 and S10 (title only)
- [ ] `npx supabase config push` applied to your project (you: see "Human steps")

## Step 3: Frontend
- [x] S1 wired to log in (OP1), all states
- [x] Route guard (`components/AppShell.tsx`), role redirects (`components/roles.ts`), Staff Header and Check-in Header rules, inactivity timer (in `SessionProvider`), log out (OP2, Supabase `signOut`)
- [x] M4 with its four versions (`components/ConfirmDialog.tsx`)
- [x] "No internet" also from failed API calls (Phase 1 decision 8 is now done)

## Step 4: Refactor and full check
- [x] Lint and typecheck clean; unit 49, component 169 and the setup integration test pass here
- [ ] `npm run check` needs your `.env` and the linked project

## Step 5: Manual checks (human)
- [ ] Log in with each of the 4 test accounts on the laptop and tablet: each lands on its main screen
- [ ] 5 wrong passwords: the button is disabled for 60 seconds
- [ ] S1 and M4 (4 versions) match their designs side by side
- [ ] T-AUTH-4 (Section 15): an under-18 person cannot be given an account (the administrator's rule; no code)

## Human steps before the integration tests
1. Fill `.env` (all 8 variables) and link the project (`npx supabase link`).
2. `npx supabase config push` (applies the Auth settings), then `npm run db:reset`.
3. `npm run test:int`.

## Decisions and deviations to confirm
1. **T-AUTH-11 (change own email or phone).** Supabase Auth has no switch that blocks it. The test checks that the change is refused or at least not applied (`double_confirm_changes` keeps it pending). If your project applies it at once, the test fails and the README limit stands; tell me how you want it handled.
2. **Disabled account at log-in** gets the normal "Email or password is not correct" message (it does not reveal the account exists). With a token it gets "Your session has ended".
3. **Where the web helpers live.** New folders need a plan change, so the session, route guard, API client and Supabase client are files in `apps/web/components/` (plus `LoginContainer.tsx` in `app/login/`).
4. **The 60-second lock in the browser** disables the button for any email for 60 seconds (the screen has no per-email state). The server lock is per email.
5. **Extra unit tests** for the API (`*.spec.ts`) so the lock and guards are checked without Supabase. The plan only lists integration tests.
6. **S2 shell** has the Check-in Header and the title "Check-in". Holding the logo (M4 "Log out of this tablet?") is wired in Phase 4.
7. **Status codes.** Wrong details 401, locked 429, not allowed 403, session ended 401, server problem 500. The plan fixes the messages, not the codes.
8. `@supabase/supabase-js` added to `apps/api` and `apps/web` (it is in plan Section 4.1).
