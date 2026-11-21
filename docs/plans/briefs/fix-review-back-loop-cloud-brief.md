# Brief for a cloud builder: Back from creation's review walks backwards, it does not loop (a test-first fix)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `fix-review-back-loop`. Pull request title: "Fix: Back from the review walks back through the steps instead of looping with the last one (cs-39a)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

## The fault
Found by the tests added in pull request #732 (`src/app/creationStepsBothWays.test.tsx`, the case marked `.fails`, "to the review and back"): from the review, Back opens the last step (Gear); Back from there returns to the review; and so on for ever. A player on the review cannot walk back past the last step with Back.

## The rule (cs-39a, the lead's; it follows cs-39, `docs/design/rulings/dec-patch-sets-path-and-homebrew-batch-2026-11-13.md`)
**Back returns to where Next came from, from the review too.**
- From the review, Back opens the step Next left from to reach it, as an ordinary step of the walk.
- From that step, Back goes on to the step before it, and so on to the first step. No step appears going back that was skipped going forward, and none is missed.
- From any of those steps, Next goes forward again as usual, ending on the review.
- **Unchanged:** a step opened from the review by its **Change** button still returns to the review, by Back and by its own way of finishing, exactly as today. Only a step reached by Back from the review is an ordinary step.

## The task
1. Start from `origin/main`. If #732 has merged, the failing case is there. If it has not, take the branch `guard-adjust-scores-both-ways` in first (`git merge origin/guard-adjust-scores-both-ways`) and say so in the pull request: its diff then includes #732's commit until that merges.
2. This is a `fix-` branch: a test file changes only by adding tests marked `.fails` or by removing `.fails`. First commit: only new failing tests, if you need more than the one that exists (see below). Second commit: the fix, removing `.fails` from each.
3. Tests the fix must hold (add as `.fails` first where they do not exist):
   - the existing "to the review and back" case, for a walk with a trade and a walk without (the cloud review of #732 noted the no-trade half never ran: it must run and pass);
   - a step opened by the review's Change still returns to the review on Back (it should pass today: if a test already holds it, name it in the status file and add none);
   - after Back from the review to the last step, Next returns to the review.
4. The fix is in creation's step logic (`src/app/GuidedCreation.tsx` and what it calls). No screen, no words, no CSS change.

## Fences particular to this piece
- Change nothing about what Change does, about the review's content, or about which steps exist.
- If making Back walk backwards from the review cannot be done without changing what Change-opened steps do, stop and write down exactly why; do not choose.
- Departures in the status file: anything you did that this brief does not say.
