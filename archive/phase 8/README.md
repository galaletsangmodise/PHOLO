# Pholo CMS (Clinic Management System)

Pholo CMS helps South African public clinics check in patients on a tablet at the entrance, so waits shrink and paper files disappear.

This README is a skeleton. It is completed in Phase 11 (see `IMPLEMENTATION_PLAN.md`, Section 13).

## What is in this repository

| Folder | What it holds |
| --- | --- |
| `apps/web` | Next.js app: the Check-in Tablet screens and the staff screens |
| `apps/api` | NestJS API: business rules and backend operations |
| `packages/types` | Shared TypeScript types and rule checks |
| `supabase` | Database migrations, seed data and database tests |
| `docs` | The PRD |

## Setup

1. Install Node.js 20 LTS or newer, and Git.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the values from your Supabase project (Project Settings, API). Never commit `.env`.
4. Link the Supabase CLI to your development project: `npx supabase login`, then `npx supabase link --project-ref <your-project-ref>`.

## Commands

| Purpose | Command |
| --- | --- |
| Start the app (web on 3000, API on 3001) | `npm run dev` |
| Reset the development database | `npm run db:reset` |
| Unit tests | `npm run test:unit` |
| Component tests | `npm run test:component` |
| Database and permission tests | `npm run test:db` |
| Integration tests | `npm run test:int` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Full check (run before every "done") | `npm run check` |
| Build for release | `npm run build` |

`npm run db:reset` wipes the linked Supabase project. Use a project that holds test data only.

## Test accounts

Created by `npm run db:reset` (see `supabase/seed.sql`). They are for testing only; never use them with real data.

| Role | Email |
| --- | --- |
| Check-in | tablet1@ubuntu-clinic.example |
| Reception | busisiwe.naidoo@ubuntu-clinic.example |
| Clinical | nomsa.khumalo@ubuntu-clinic.example |
| Manager | farouk.patel@ubuntu-clinic.example |

Test-only password for all four: `PholoTest-2026` (PRD 10.4).

`npm run db:reset` puts today's date (SAST) on the 4 sample Visits, so run it before each demo day.

## Log-in settings and known limits

The Supabase Auth settings are kept in `supabase/config.toml` (no self sign-up, passwords of at least 10 characters with a letter and a number, no email confirmation for accounts the administrator creates). They reach your hosted project with `npx supabase config push` after the project is linked. You can also set the same values in the Supabase dashboard (Authentication).

Known limits (plan Section 18, #8 and #9):
- **Log-in lock (BR12).** The 60-second lock after 5 wrong passwords is kept in the API's memory. Someone who holds the public anon key could call Supabase Auth directly and skip it, and the count is lost when the API restarts. Switch on the Supabase Auth rate limits in the project settings as a second layer.
- **Changing your own email or phone.** The app has no screen or operation for it. Supabase Auth has no setting that blocks it for a logged-in user, so a user who calls Supabase Auth directly could request the change. `double_confirm_changes = true` means the change only applies after confirmation from both addresses.
- **Inactivity (BR11).** The 15-minute timer runs in the browser. There is no server-side limit.
