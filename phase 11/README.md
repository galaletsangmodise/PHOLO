# Pholo CMS (Clinic Management System)

Pholo CMS helps South African public clinics check in patients on a tablet at the entrance, so waits shrink and paper files disappear.

- **Check-in Tablet** (S1 to S5): a patient, or the Door Assistant for them, checks in. The tablet shows only a queue number afterwards, never a name.
- **Reception** (S6, S7, S8): sees the live queue, finds and edits Patient Files, records paper file history. Never sees the nurse's notes.
- **Clinical** (S6, S9, S8): calls the next patient (urgent first), writes symptoms and notes, completes the visit.
- **Manager** (S10): sees today's counts and the average waiting time. No patient names.

Built with Next.js (`apps/web`), NestJS (`apps/api`), shared types and rules (`packages/types`) and Supabase (`supabase`: migrations, seed, database tests). The product requirements are in the PRD and the step-by-step plan in `IMPLEMENTATION_PLAN.md`; what each phase built is in `docs/PHASE-N-PROGRESS.md`.

## What is in this repository

| Folder | What it holds |
| --- | --- |
| `apps/web` | Next.js app: the Check-in Tablet screens and the staff screens |
| `apps/api` | NestJS API: business rules and backend operations (OP1 to OP17) |
| `packages/types` | Shared TypeScript types, messages and rule checks |
| `supabase` | Database migrations, seed data and database tests |
| `docs` | The progress notes of every phase and the release checklist |

## Requirements

- Node.js 20 LTS or newer, and Git.
- A **Supabase project that holds test data only** (a free project is fine). `npm run db:reset` wipes it.
- The commands below work in Windows PowerShell and in bash; where they differ, both are shown.

## Setup

1. Install the packages: `npm install`
2. Create your settings file:
   - PowerShell: `Copy-Item .env.example .env`
   - bash: `cp .env.example .env`
3. Fill in `.env` (never commit it; `.gitignore` already ignores it). Find the Supabase values in the dashboard under Project Settings, API:

   | Variable | What to put |
   | --- | --- |
   | `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` | the Project URL |
   | `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon` (publishable) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` (secret) key. Server only. Never in the browser or on GitHub. |
   | `API_PORT` | `3001` |
   | `NEXT_PUBLIC_API_URL` | `http://localhost:3001` on one computer, or `http://<laptop-wifi-ip>:3001` (see "Running on one Wi-Fi") |
   | `WEB_ORIGIN` | `http://localhost:3000`, or `http://<laptop-wifi-ip>:3000` |

4. Link the Supabase CLI to your project: `npx supabase login`, then `npx supabase link --project-ref <your-project-ref>` (the ref is the part of the Project URL before `.supabase.co`).
5. Send the log-in settings to the project: `npx supabase config push`
6. Create the tables, rules and test data: `npm run db:reset` (**this wipes the linked project**).
7. Start the app: `npm run dev`. The web app is on http://localhost:3000 and the API on http://localhost:3001.

## Commands

| Purpose | Command |
| --- | --- |
| Start the app (web on 3000, API on 3001) | `npm run dev` |
| Reset the development database (wipes it, then loads the seed) | `npm run db:reset` |
| Unit tests (no database needed) | `npm run test:unit` |
| Component tests (no database needed) | `npm run test:component` |
| Database and permission tests (need `.env` and a reset database) | `npm run test:db` |
| Integration tests of the API (need `.env` and a reset database) | `npm run test:int` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Full check (lint, type check, every test; run before every "done") | `npm run check` |
| Build for release (API, then web) | `npm run build` |

Notes:
- The web build downloads the Atkinson Hyperlegible font from Google Fonts, so `npm run build` needs internet.
- `npm run db:reset` puts today's date (SAST) on the 4 sample Visits, so run it before each demo day.
- `test:db` and `test:int` create their own clinics and accounts, so they can run on a reset database without disturbing the sample data. Run them with `--runInBand` (the scripts already do).

## Test accounts

Created by `npm run db:reset` (see `supabase/seed.sql`). They are for testing only; never use them with real data.

| Role | Email | Lands on |
| --- | --- | --- |
| Check-in | tablet1@ubuntu-clinic.example | S2 Check-in start |
| Reception | busisiwe.naidoo@ubuntu-clinic.example | S6 Queue |
| Clinical | nomsa.khumalo@ubuntu-clinic.example | S6 Queue |
| Manager | farouk.patel@ubuntu-clinic.example | S10 Daily summary |

Test-only password for all four: `PholoTest-2026` (PRD 10.4).

## Running on one Wi-Fi (laptop and Check-in Tablet)

1. Put the laptop and the tablet on the same Wi-Fi.
2. Find the laptop's Wi-Fi address: `ipconfig` in PowerShell (the IPv4 Address of the Wi-Fi adapter, for example `192.168.1.20`).
3. In `.env` set `NEXT_PUBLIC_API_URL=http://192.168.1.20:3001` and `WEB_ORIGIN=http://192.168.1.20:3000` (use your address), then restart `npm run dev`.
4. Allow Node.js through the Windows firewall for private networks when it asks.
5. On the tablet open `http://192.168.1.20:3000` and log in with the Check-in account. Staff open the same address on their computers.

## The 5-minute demo script

Run `npm run db:reset` first, then:

1. (0:30) On the tablet (S2), tap "Check in with help" and check in Joseph Mokoena through S3 and S4. S5 shows his number.
2. (1:00) Check in a second patient, Palesa Molefe, and answer "Yes" to the urgent question. S5 shows the red urgent card.
3. (1:30) On a second computer, log in as Reception. S6 shows both Visits within 5 seconds, the urgent one first.
4. (2:30) Search "Dlamini" on S7 and open S8. Then create a new Patient in M2 and record paper file history in M3.
5. (4:00) Log in as Clinical. Tap "Call next patient", "Start consultation", type on S9, "Save draft", then "Complete visit" and confirm in M4. S6 shows "Visit completed."
6. (4:20) Back as Reception, open the same Patient File on S8: the notes are hidden.
7. (5:00) Log in as Manager and show S10 with today's numbers and the average waiting time.

## Log-in settings and known limits

The Supabase Auth settings are kept in `supabase/config.toml` (no self sign-up, passwords of at least 10 characters with a letter and a number, no email confirmation for accounts the administrator creates). They reach your hosted project with `npx supabase config push` after the project is linked. You can also set the same values in the Supabase dashboard (Authentication).

Known limits (plan Section 18, #8 and #9):
- **Log-in lock (BR12).** The 60-second lock after 5 wrong passwords is kept in the API's memory. Someone who holds the public anon key could call Supabase Auth directly and skip it, and the count is lost when the API restarts. Switch on the Supabase Auth rate limits in the project settings as a second layer.
- **Changing your own email or phone.** The app has no screen or operation for it. Supabase Auth has no setting that blocks it for a logged-in user, so a user who calls Supabase Auth directly could request the change. `double_confirm_changes = true` means the change only applies after confirmation from both addresses.
- **Inactivity (BR11).** The 15-minute timer runs in the browser. There is no server-side limit.
