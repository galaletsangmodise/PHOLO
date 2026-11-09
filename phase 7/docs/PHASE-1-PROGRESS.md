# Phase 1: Foundation - progress notes

Paste the ticks and the log row below into `IMPLEMENTATION_PLAN.md` (Phase 1 checkboxes and Section 17).
The plan file itself was not in my workspace, so I could not edit it directly.

## Section 17 progress log row

| Phase | Date | Status | Automated tests (passed / total) | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | 06 Nov 2026 | Built, waiting for human checks | 92 / 93 (T-SETUP-3 needs your `.env`) | Phase 1: Foundation | Installed: Node 22.23.4, npm 10.9.9, Next 14.2.x, React 18.3.x, Tailwind 3.4.x, NestJS 10.4.x, Jest 29.7, TypeScript 5.x. Exact versions are in `package-lock.json`. |

## Step 1: tests written first (Red)
- [x] All tests written, run, and failed for the expected reason (missing modules; T-SETUP-3 failed with "must be set in the root .env file").

## Step 2: Backend
- [x] npm workspaces: apps/api, apps/web, packages/types; root package.json with every script in Section 4.3
- [x] NestJS 10 app on API_PORT, CORS limited to WEB_ORIGIN; empty modules auth, checkin, patients, queue, visits, summary, audit
- [ ] Hosted development project linked with the Supabase CLI; `npm run db:reset` works (needs you: see "Human steps")
- [x] .env.example with the 8 variables, .gitignore with .env, README.md skeleton
- [x] packages/types: formatSastTime and formatSastDate (BR19)

## Step 3: Frontend
- [x] Next.js 14 with Tailwind 3 and Atkinson Hyperlegible; styles/tokens.ts and tailwind.config.ts built from Section 7.1
- [x] The 16 shared components of Section 7.2 with all variants and states, and online/offline detection (Section 18, #10)
- [x] S1 built with every state in Section 7.3, driven by props (log-in call wired in Phase 3)

## Step 4: Refactor and full check
- [x] Code cleaned up; names use PRD key terms
- [ ] Full check passes: lint, typecheck, unit (6), component (79) and integration (1) pass; `test:db` needs your `.env`

## Step 5: Manual checks (human)
- [ ] `npm run dev`: web answers on port 3000 and the API on port 3001 (T-SETUP-5)
- [ ] S1 matches its design side by side at 1440 x 900
- [ ] Open the laptop's address from the tablet on the same Wi-Fi: S1 shows
- [ ] `npm run check` exits with success (T-SETUP-8)
- [ ] A dedicated Supabase project for test data only exists and its keys are in `.env`

## Decisions and deviations to confirm
1. Node 22 was installed in my workspace, the plan says Node 20 LTS. `engines` allows 20 or newer.
2. Icons: Lucide is the icon set (PRD 9.1) but `lucide-react` is not in Section 4.1 (rule 13). I drew the 5 icons needed as inline SVG in `components/Icon.tsx` instead of adding a library.
3. `npm run dev` uses `dev.mjs` (plain Node) so it works in PowerShell. A root file, not a new folder.
4. Extra files in `components/`: `Icon`, `Logo`, `FieldError`, `messages.ts`, `classes.ts`, `useOnlineStatus.ts`. No new folders were created, except the empty `supabase/migrations/` and `supabase/tests/` from the plan.
5. S1 lives at `apps/web/app/login/LoginScreen.tsx`, with `page.tsx` rendering it.
6. M4 (`ConfirmModal`) is built generic in Phase 1; its four versions' texts are Phase 3 work.
7. `docs/PRD.md` is not in this zip (I only had the PDF). Add it to the repository yourself.
8. Offline detection uses the browser events now; "any failed API call counts as offline" is added with the API client in Phase 3.
9. `next/font/google` fetches the font at build time. It failed in my sandbox (no internet to Google), so it is not verified here; on your machine it needs internet once.
10. `jest-dom` and `user-event` were not added (not in Section 4.1); tests use plain assertions.
