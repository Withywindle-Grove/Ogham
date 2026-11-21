# Brief for a cloud builder: creation's steps walked both ways, the cases the fix could not carry (tests only)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `guard-adjust-scores-both-ways`. Pull request title: "Creation's steps both ways: the reported case, a class through a second pack, and the review and back".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

## Why
The fix for Back in creation (ruling cs-39, `docs/design/rulings/dec-patch-sets-path-and-homebrew-batch-2026-11-13.md`) merged with a guard test, `creationStepsBothWays.test.tsx`. Its review asked for three more cases and one sturdier line. They could not go on the fix's own branch, because a `fix-` branch may only add tests marked `.fails` or remove `.fails`. This branch is not a `fix-` branch.

The rule the tests hold: **Back returns to where Next came from.** From "Who they are", Back lands on Adjust scores only when a trade is possible, else on the Patron step when the class has one, else on Class. Next skipping Adjust scores when no trade is possible is right and does not change.

## The task (tests only)
1. **The reported case.** Every score is 10, so nothing can be lowered and no trade is possible. Next from Scores skips Adjust scores; Back from "Who they are" does not land on it. (The existing "no trade" case puts the prime score at its cap instead; keep it and add this one.)
2. **A class that reaches the character through a second pack.** A fixture of two invented packs, where the class comes from the second and the kindred from the first, as a conversion pack brings another setting's classes. The same walk, forward and back, with a trade possible and without.
3. **To the review and back to the start.** Walk Next to the review, then Back step by step to the first step: every Back lands on the step the matching Next left from; no step appears going back that was skipped going forward, and none is missed.
4. **The Back button by its exact name.** In the existing file, replace the loose match (`getAllByRole('button', { name: /Back/ })[0]`) with the exact accessible name, in every place it is used.

## If a new test fails
That is a fault found, not a test to bend. Do not change anything under `src/` outside test files. Keep the failing case marked `.fails`, with one sentence above it saying what happens and what should, and put it at the top of the status file as a question. Finish the other cases.

## Fences particular to this piece
- Test files and their fixtures only. No change to creation's code, screens or words.
- This is a normal branch: you may edit the existing test file for point 4 and to share helpers; do not weaken or remove any existing case.
- Invented names for packs, classes and kindreds.
