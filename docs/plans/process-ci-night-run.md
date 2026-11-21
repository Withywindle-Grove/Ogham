# Plan: process — database only by day, one full run each night (cq-3)

Written by the Builder, 2026-11-13, from Francis's ruling ("yes", 2026-11-13), relayed by the lead: `cq-3` to `cq-3d` in `docs/design/rulings/process-ci-by-day-2026-11-13.md`. Technical only: no app behaviour, no migration, no screen. Mockup: none, CI only.

## The problem
With one heavy job at a time on the PC (cq-1, cq-1a), every pull request's check and layout shards wait in one line, and the line grew long by day. The check job repeats what the pre-commit hook already ran locally (`npm run check`), and the layout shards cost the most. Database tests can't run locally in full (the shared test project is too small), so they stay by day.

## Build order
1. `scripts/ci-jobs.mjs`: one exported switch, `DEFER_BY_DAY = true`, and a new plan value `deferred` for check and layout. A code change (kind exactly `code`) on a `pull_request` or `push` event defers both; database follows its old rules; docs-only keeps its fast path; an empty or odd kind still runs. With the switch on, layout never waits for the ready label (the label code stays, for when the switch goes off). No date logic in code.
2. `.github/workflows/check.yml`:
   - a `schedule` trigger at `0 7 * * *` (07:00 UTC);
   - the changes job reads `schedule` like `workflow_dispatch` (an empty file list: everything runs);
   - on `deferred` check prints "Deferred to the night run (cq-3): the local check covers this by day." and layout "Deferred to the night run (cq-3): the pictures and browser checks run at 07:00 UTC.", and neither does any work (check's working steps run only on `run`, and an unknown check plan fails, as layout's already did);
   - the night run gets its own top-level concurrency group (`check-<sha>-night`), so a run on the same commit can't push it out of the line;
   - unchanged: the required check names, the heavy-job queue (still keyed on `check_plan == 'run'`, so a deferred check doesn't join it), deploy-production (only `push` to main), triage (only `pull_request`), the full run by hand.
3. `docs/testing.md` (The GitHub check) and `.claude/README.md` (Saving CI minutes).
4. The ruling file and its 09 line are the lead's (#676).

## Tests (purpose first), in `scripts/ci-jobs.test.mjs`
- The switch ships on.
- A pull request push gives check and layout deferred and database run, with or without the ready label.
- Adding a label never makes layout wait and still reuses a passed database.
- Main's push gives check and layout deferred and database run.
- Docs-only and the skips are unchanged.
- The night run (schedule) runs everything, including from the values the workflow passes.
- A run by hand still runs everything.
- An unknown kind isn't deferred.
- With the switch off, today's behaviour returns, the label wait included (and the old label tests now run with the switch off).
- The workflow has the schedule at `0 7 * * *`, read as everything changed.
- The night run never deploys or triages and has its own concurrency group.
- The deferred paths print their notes, do no work and don't join the heavy queue.
- An unknown check plan fails check.
- The command line prints `deferred`.

## What it can't catch
- Two green pull requests that break only together are found at night, not before the merge.
- Check and layout faults go live by day (main deploys on database alone) and are fixed forward the next morning.
- A merge of screen files only or of the pack scripts only runs no CI test at all by day: `docs/testing.md`, The GitHub check, "What it can't catch by day".
- GitHub may start a scheduled run late, or drop it, when it's busy; a missing night run has to be noticed in the morning.

## After 2 December
A one-line pull request sets `DEFER_BY_DAY = false` (`cq-3b`). Whether the night run stays is a separate choice.

## Departures
- none
