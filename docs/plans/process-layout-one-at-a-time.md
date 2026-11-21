# Plan: process — one heavy CI job at a time (check and the layout shards)

Written by the Builder, 2026-11-13, from Francis's ruling on the CI capacity question (2026-11-13, "A"; cq-1 in `docs/design/rulings/dec-night-and-morning-2026-11-13.md`: one layout job at a time; not B, fewer workers; not C, a third lane), relayed by the lead, and the lead's widening to check (cq-1a in `docs/design/rulings/process-ci-queue-2026-11-13.md`). Technical only: no app behaviour, no migration, no screen. Mockup: none, CI only.

## The problem
On the night of 12–13 November six CI runs failed on load alone (about 3 hours of runner time), each time with two WebKit layout shards on the two PC lanes beside other work. Re-runs on a quiet PC all passed. Merges were late by 1 to 1½ hours.

## Build order
1. `check` and `layout-shard` in `.github/workflows/check.yml` get one job-level concurrency group shared by both jobs, every shard and every run (`heavy-one-at-a-time`), with `cancel-in-progress: false` and `queue: max`. The default queue keeps only one waiting job and cancels the rest; `queue: max` keeps up to 100 in line (GitHub, May 2026). Every other job still runs side by side.
2. `docs/testing.md`, the layout paragraph of The GitHub check: one heavy job at a time, why, and the cost.
3. The 09 lines and rulings are the lead's: cq-1 (#673) and cq-1a (#675). Only a check that runs the code's tests joins the queue; a docs-only or reused check runs at once in a group of its own.

## Tests (purpose first)
- Check and the layout shards share one queue that waits rather than cancels; database is outside it (`scripts/ci-jobs.test.mjs`).
- The pull request's own run is the live check: `pull_request` runs the branch's workflow, so a rejected `queue` key would fail it at once, and its check and three shards must run one after another.

## Cost
A shard takes 2 to 4 minutes and check about 3 when the PC is quiet, so one run takes about 8 to 11 minutes longer; a pull request may also wait for another's jobs.

## After a week (by 2026-11-20)
Two numbers for Francis via the lead: runs failed on load alone, and the longest wait a pull request had for its check and layout jobs.

## Departures
- 2026-11-13: widened from "one layout job at a time" (cq-1) to check and the layout shards in one queue (cq-1a, the lead's ruling the same morning, within Francis's purpose of ending load failures). Evidence: main's run 43419092528 after #672, check's app tests timed out at 15 s beside a single layout shard, which cq-1 as worded allows.
