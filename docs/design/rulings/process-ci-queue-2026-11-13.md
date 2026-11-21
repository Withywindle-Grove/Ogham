---
status: pending
milestone: December first play (the CI lanes on Francis's PC)
absorbed-into: pending. `docs/testing.md` (the CI lanes) with the heavy-job queue's pull request; `.claude/README.md` (Saving CI minutes) once the batch has run once; docs/09-decisions-log.md (2026-11-13)
supersedes: cq-1's words "every other job still runs side by side" in `dec-night-and-morning-2026-11-13.md` (cq-1a here); the rest of that file stands
---

# The CI queue: one heavy job at a time, and batches (2026-11-13)

Francis asked where the bottleneck is. The answer was his one PC: CI, the builders' own checks and the picture-taking share it. These rulings are about spending fewer of its hours on CI.

| Id | Ruling | Whose |
|---|---|---|
| cq-1a | **One heavy job at a time: the check job and the layout shards share one queue; the database job runs beside them.** A waiting job queues; nothing running is cancelled. Only a check that really runs the code's tests joins the queue (a docs-only check doesn't wait). cq-1 as worded (layout shards only) would not have stopped the failure that followed it within the hour: the check job's app tests timed out beside a single browser shard. | The lead's, technical, within the purpose Francis ruled cq-1 for; told to him the same morning; his to overturn |
| cq-2 | **Small reviewed fixes are tested and merged as one batch.** Each stays its own change with its own local review first (rv-1). A batch branch from main merges them in order; one check, one run, one merge, as a merge commit so every member's commits land whole. A real fault in a batch: the culprit's merge is dropped, the batch re-runs once, and the culprit waits for the next batch. A large piece still travels alone. | Francis: "Yes batch" |
| cq-2a | **The repeat run after a merge is skipped when the tree is identical** to the one the pull request's run passed. (Already written by the Builder; it moves up the queue behind the first batch.) | Francis, with cq-2 |

## Why (the Builder's numbers, 2026-11-13)
- A run costs the same whatever the size of its change: about 12 minutes of the heavy queue, and about 12 more for main's run after the merge; with waiting, 45 to 60 minutes a pull request at one at a time.
- Since CI moved to the PC (8 November): 485 runs. 34 went green on a plain re-run with no change (load, and caught nothing). What only CI catches: the database tests (about 14 real catches; nothing local runs them), the real-browser checks (pictures missing or changed, tap sizes, accessibility: some of about 25), and two pull requests that each pass and break together (once).
- The night of 12 to 13 November: main failed on load and sat red for five hours, because the watcher followed the pull request's run and nothing followed main's run after an auto-merge. From now the Builder's watch covers main after every merge and re-runs a load failure once, alone, at once; a second failure stops and reports.

## Honest notes
- The lead told Francis that cq-1 would leave "almost none" of the load failures. That was wrong as worded; cq-1a is the correction.
- The queue uses an option that is new on GitHub and untried on a job that runs in shards. Its first run is its test.
- Not yet ruled, and not here: whether CI runs only at night, and whether any of it moves to GitHub's own machines for money. Both are open with Francis.
