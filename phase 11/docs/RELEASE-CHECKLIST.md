# Release checklist (plan Section 16, tests T-REL-1 to T-REL-8)

"Done here" means I checked it in the cloud workspace. "Human" means it needs your Supabase project, a real tablet or a laptop.

| Check | Status | Notes |
| --- | --- | --- |
| T-REL-1 Fresh clone: `npm install`, `npm run db:reset`, `npm run check` pass | Human | `npm install` worked here, and lint, type check and the 661 unit and component tests pass. `db:reset`, `test:db` and `test:int` need your project. |
| T-REL-2 `npm run build` builds the API and the web app | API: done here. Web: human | The API builds. The web app builds all 12 routes (type check and lint included) when the font is not downloaded; with the font it needs internet, which this workspace does not have. |
| T-REL-3 The 5-minute demo script runs without errors | Human | Script is in `README.md`. Run it on the real tablet and laptop. |
| T-REL-4 `README.md` explains setup, every command, the test accounts and how to run the tests | Done here; human reads it | Rewritten in this phase. |
| T-REL-5 `.env.example` lists every variable; no key in the files | Done here | `apps/web/__tests__/env.test.ts` (now also checks every `process.env.X` the code reads is listed; no gap found). Git history: the workspace has no Git history, so run the history scan yourself after your first push (command below). |
| T-REL-6 The tablet on the same Wi-Fi opens the laptop's address and Check-in works | Human | Steps in `README.md` ("Running on one Wi-Fi"). |
| T-REL-7 Each of the 4 accounts lands on its main screen | Human (logic tested here) | Check-in to S2, Reception and Clinical to S6, Manager to S10. The routing is covered by `session.test.tsx` and `navigation.test.tsx`. |
| T-REL-8 App against PRD: no gaps | Partly | See the gap list in `PHASE-11-PROGRESS.md`. |

History scan after your first push (PowerShell or bash):

    git log -p --all | Select-String -Pattern "eyJ[A-Za-z0-9_-]{10,}\.","sb_secret_","sbp_[a-f0-9]{20}"

(In bash: `git log -p --all | grep -E "eyJ[A-Za-z0-9_-]{10,}\.|sb_secret_|sbp_[a-f0-9]{20}"`.) No output means no key was committed. If a key shows up, rotate it in Supabase.

## Section 16, one line each
- [ ] All phases complete; every box in Sections 13 and 15 ticked (human).
- [ ] Full check passes on a clean install (human, T-REL-1).
- [ ] Runs on the real tablet and a laptop on the same Wi-Fi (human, T-REL-6).
- [ ] Demo script runs from start to finish (human, T-REL-3).
- [x] README explains setup, every command, the test accounts and how to run the tests.
- [x] README states the two known limits of the BR12 lock (a direct call to Supabase Auth skips it; the count is lost when the API restarts) and that the Supabase Auth rate limits should be switched on where offered.
- [x] `.env.example` lists every variable; no key in the files (history scan is yours).
- [ ] Final comparison against the PRD shows no gaps (see the gap list).
