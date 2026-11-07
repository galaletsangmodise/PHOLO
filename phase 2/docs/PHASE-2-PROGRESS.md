# Phase 2: Data and security - progress notes

Paste the ticks and the log row below into `IMPLEMENTATION_PLAN.md` (Phase 2 checkboxes and Section 17).

## Section 17 progress log row

| Phase | Date | Status | Automated tests (passed / total) | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 2 | 07 Nov 2026 | Built, waiting for your `.env` and human checks | Unit 27 / 27 here. Database tests written but not run against Supabase (see below) | Phase 2: Data and security | 9 migrations, seed, shared rules, 11 database test files |

## Step 1: tests written first (Red)
- [x] `packages/types/src/rules.spec.ts` (T-BR5, T-BR6, T-BR8 unit parts) written first and failed (missing `./rules`).
- [x] `supabase/tests/*.test.ts` written: schema, rls, seed, checkin, queue, status, rules, summary, audit, patients (T-DB-1 to 19, T-BR1 to BR9, BR14 to BR19, T-SEC-1a to 26b).
- [ ] The database tests could not be run in my workspace (no route to supabase.com), so I could not watch them fail. You run them.

## Step 2: Backend
- [x] Migrations 1 to 9 of Section 8.6, in order
- [x] Triggers patients_set_file_number, patients_guard, patients_set_updated_at, visits_guard, audit_logs_append_only
- [x] Functions is_valid_sa_id, normalise_cellphone, next_file_number, write_audit, checkin, call_next_patient, close_stale_visits, daily_summary, admin_correct_visit; view visits_for_reception
- [x] RLS on every table, the Section 9 policies, checkin / write_audit / admin_correct_visit only for the service role
- [x] `supabase/seed.sql` with the PRD 8.4 data and the 4 logins
- [x] `packages/types`: domain values and the BR5, BR6, BR8 checks (plus the status-change table)

## Step 3: Frontend
- [x] Not applicable

## Step 4: Refactor and full check
- [x] Lint, typecheck, unit (27), component (79), integration (1) pass here
- [ ] `npm run test:db` and `npm run check` need your `.env` and the linked project

## How I checked the SQL without Supabase
I ran all 9 migrations and the seed on a local PostgreSQL 18 with a small stand-in for Supabase's `auth` schema and roles, and ran 55 checks as the four roles (read rules, writes, status changes, call next, Check-in, stale clean-up, audit, summary, catalog). All passed. This does not replace your run of `npm run test:db`.

## Step 5: Manual checks (human)
- [ ] After `npm run db:reset`, the 4 test accounts exist and each can log in
- [ ] The tables and columns in the Supabase dashboard match Section 8.1
- [ ] Your test-data project has the Auth setting "Allow new users to sign up" off (Phase 3 tests this)

## Decisions and deviations to confirm
1. **mark_visit_left function (added).** The plan's policy `visits_update_left` cannot work alone for Reception: Postgres needs a read policy to find the row to update, and Reception has none on `visits` (SEC11). I added the function `mark_visit_left(visit_id)` (Reception and Clinical) that does the update and writes `marked_left`. The policy `visits_update_left` is kept as in the plan. T-SEC-15a runs through the function.
2. **test_catalog function (added, migration 9).** T-DB-15, T-DB-17 and T-BR19-3 must read the catalog, and `.env` has no database connection string. `test_catalog()` returns table, index and column facts only, and only the service role can run it.
3. **audit_logs has one deny-everything policy.** T-DB-17 wants at least one policy per table, SEC19 wants no read policy. The policy `audit_logs_no_access` says false for everyone, so the table is closed to app roles and still counts as covered.
4. **Check-in matching.** BR4 says match by ID number, else by name and date of birth when no ID is typed. If an ID is typed that matches nobody, I only fall back to name and date of birth for a Patient who has no ID on file, so two different IDs never merge into one Patient.
5. **BR14 counts per tablet account** (`audit_logs` rows `checked_in` in the last 10 minutes, 40 or more refuses). Duplicate Check-ins (BR3) write no row.
6. **Visit delete** is refused for every app role. The administrator (service role) may still delete, as SEC17a requires.
7. **Seed times.** Visit 2 `started_at` equals its `called_at` (08:02) and Visit 1 `started_at` equals its `called_at` (07:48): the PRD gives one time for both.
8. **Seed password.** `seed.sql` holds the test-only password (PRD 10.4) because the logins need one. The plan file itself does not.
9. **T-BR15-1 uses its own pattern.** The seed has fixed morning times, so "waited over 3 hours" would depend on the clock. The test builds the same 4-Visit pattern relative to midnight SAST. T-BR15-4 (over 3 hours) skips itself before 03:10 SAST.
10. **T-DB-19 runs `npm run db:reset` twice** from inside the test (it sends "y" to the confirmation). It wipes the test project, so tests that follow build their own data. Run it only against the dedicated test project.
11. **Test data piles up.** Visits cannot be deleted by the app and the audit log is append-only, so each test makes its own Facility. `npm run db:reset` clears them.
12. **Local Postgres is 18, Supabase uses 15.** Only standard features are used.
13. Draft fields: a draft "with every field empty" is saved as empty values (null), not empty text, because symptoms must be 1 to 1000 characters when filled in.
