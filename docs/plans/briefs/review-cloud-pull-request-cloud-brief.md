# Brief for a cloud session: review one pull request (read-only; the rule since 2026-11-13, rv-3)

Written by the lead on 2026-11-13 (ruling rv-2, `docs/design/rulings/process-cloud-reviewer-2026-11-13.md`). The message that sent you here names **one** pull request. Review that one only.

For this task you are a **reviewer, not a builder**. `docs/plans/briefs/README.md` does not apply, except its rule on names: invented names only, in anything you write.

## Before you start: is it yours to review?
- **Never review your own work.** If this session wrote, refreshed or pushed to the pull request's branch at any time, stop and say so in your final message. Do nothing else.
- **Widened on 2026-11-15 (rv-4, Francis: "Yes"):** you give the **first read on any pull request**, a migration, a component, a route or CSS included. The local reviewer then keeps only what needs a running app, the pictures or the test database. You still stop for a workflow file (`.github/`), and you never review your own work.
- **For a migration or a definer function (be-5):** it has not reached the test database yet and can still change. Try each new function and policy in your head with ids and arguments a client could forge: another player's row, a null, a row of another campaign, a row of another kind, a draft. Say for each new read exactly who can read what, in one line, and whether that is what the ruling quoted in the migration's header allows. A read that is wider than its quoted ruling is Important.
- **For a screen:** you cannot see it. Judge the code against its frame's words in the plan row, the listed parts in `docs/06-screens-and-design.md` (a part copied where one exists is Important), a pop-up opened from inside a sheet (it must keep its own form), text in a decoration colour, new words not in the frame, buttons without icons. Say plainly that the pictures were not seen.

## What to read
1. `.claude/agents/reviewer.md` (how a reviewer works here) and `REVIEW.md` at the root (the three passes, what Important means, the cap on nits, what not to report, the output format).
2. The pull request: its description, its status file under `docs/status/`, and its diff against **the branch it is opened against** (`git fetch origin`, then `git diff origin/<base>...origin/<branch>`; the base is often a held stack, not `main`).
3. The plan or brief it was built from (the description names it), with its Departures, and the ruling it cites. Read only the sections of `docs/` the diff touches.
4. For a pull request that was only brought up to main: `docs/plans/briefs/refresh-held-pull-request-cloud-brief.md`, its row. The question there is narrower: did both sides survive the merge, did anything main gained go missing or change, did a test get weaker, and did anything change beyond what the merge needed.

## What you may do
- Read. Run `git diff`, `git log`, `git show`. Run `npm ci` and the pull request's own test files with vitest if that helps you check a claim; say which you ran.
- Nothing else. No edit, no commit, no push to the pull request's branch, no label, no approval, no merge, no database tests.

## What you hand back
**One comment on the pull request**, in `REVIEW.md`'s output format: most serious first, each finding as `file:line — the problem — why it matters — a suggested fix`, tagged with its pass and Important or nit; then one line on what you could not check; the tally `Important: N · nits: N` last, on its own line. Head the comment "Cloud review (trial, rv-2)". If it is clean, say so in one line above the tally.

If you cannot post a comment: write the same text to `docs/status/review-<pull request number>-2026-11-13.md` on a **new** branch `review-<pull request number>`, push it, and open no pull request. Say in your final message which of the two you did.

## Judgement
- A finding is a fact you can point at: a line, a test, a ruling. No guesses presented as findings; a suspicion goes under "could not check".
- Do not report what the plan's ⚑ list already hands to Francis, style the linter owns, or generated files.
- You cannot see the private packs, the database or a running app. Say so where it limits a finding.
- If unsure whether something is a fault, say what you saw and why you are unsure. Don't guess.

## Final message, short
The pull request, where the review is (comment or file), the tally, and anything that stopped you.
