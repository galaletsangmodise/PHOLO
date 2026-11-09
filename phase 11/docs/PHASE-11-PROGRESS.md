# Phase 11: Release - progress notes

Paste the ticks and the log row below into `IMPLEMENTATION_PLAN.md` (Phase 11 checkboxes, Section 16 and Section 17).

## Section 17 progress log row

| Phase | Date | Status | Automated tests (passed / total) | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 11 | 08 Nov 2026 | Built, waiting for your release checks | Types, API unit, web unit and component: 661 pass here (660 from Phase 10 + 1 new); database and integration tests need your `.env` | Phase 11: Release | README completed, release checklist, env coverage test, builds checked |

## What was done
- [x] `README.md` completed: what the app is, requirements (PowerShell and bash), setup step by step with where each `.env` value comes from, every command, test accounts and where each lands, running on one Wi-Fi (IP, firewall, tablet address), the 5-minute demo script, and the known limits (BR12 lock, own email or phone change, inactivity timer).
- [x] `docs/RELEASE-CHECKLIST.md`: Section 16 and T-REL-1 to T-REL-8, each marked "done here" or "human", with the Git-history secret scan command for PowerShell and bash.
- [x] T-REL-5: `apps/web/__tests__/env.test.ts` gets a test that every `process.env.X` the code reads is listed in `.env.example`. It passed at once (no variable was missing). The file scan for keys already existed and passes.
- [x] API build works (`tsc`, packages/types first). The web app builds all 12 routes, with type check and lint, **when the Google font is not downloaded** (I swapped the font out for the build check only and put `layout.tsx` back unchanged). With the font, `next build` needs internet, which this workspace does not have.
- [x] Full automated check here: lint and type check clean, 661 tests pass (types, API unit, web unit, web component).

## Not done here (human)
- [ ] T-REL-1: fresh clone, `npm install`, `npm run db:reset`, `npm run check` (database and integration tests have never run in any phase).
- [ ] T-REL-2: `npm run build` with internet (the font).
- [ ] T-REL-3: the demo script on the real tablet and laptop; T-REL-6: tablet on the laptop's Wi-Fi address; T-REL-7: the 4 accounts land on their screens.
- [ ] Git-history secret scan after your first push (no Git history existed here).
- [ ] Section 16 fully ticked; Sections 13 and 15 ticked from the earlier phases' manual checks.

## T-REL-8 gap list (app against the PRD)
These are the gaps and open items I know of. I could not compare every screen with its design.
1. **No design comparison was possible.** The Stitch designs for S1 to S10 and M1 to M4 were never available (plan Section 18, #1: "to be added"). Every screen was built from the PRD text. Compare each screen side by side at 1440 x 900 (staff) and 1280 x 800 (tablet) and note differences.
2. **Database and integration tests have never been run** (Phases 2 to 10). They compile and lint clean, but nobody has seen them pass or fail against Supabase. This is the biggest risk before release; run `npm run test:db` and `npm run test:int` first and bring me any failures.
3. **`docs/PRD.md` is not in the repository** (only the PDF was available). Add it, and write the answers of plan Section 18 into the PRD change log.
4. **Deviations waiting for your confirmation:** each `docs/PHASE-N-PROGRESS.md` ends with "Decisions and deviations to confirm" (Phases 2 to 10). Read them once and accept or reject each; the ones that most affect behaviour are: Phase 6 (message "This visit can no longer be marked as left.", `mark_visit_left` used for OP8), Phase 7 (messages "This visit can no longer be changed." and "This visit cannot be started."; "Open full file" asks before leaving unsaved text), Phase 8 (S10 shows only the message when nobody has checked in), Phase 10 (error filter; PRD contrast figure 14.1 is really 14.05; S5 follows the PRD S5 layout rather than the single sentence in PRD 6.2).
5. **Known limits kept as designed:** the BR12 lock lives in API memory and a direct call to Supabase Auth skips it (switch on the Supabase Auth rate limits); the 15-minute inactivity timer runs in the browser only; a logged-in user could change their own email or phone by calling Supabase Auth directly (`double_confirm_changes = true`).
6. **Speed and layout limits of the tests:** T-NFR-1 and T-NFR-4 can only be proven in the browser on the real devices (3 seconds, real widths); they are in the manual checks of Phase 10.

## Commit message
Phase 11: Release
