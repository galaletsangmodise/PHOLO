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
