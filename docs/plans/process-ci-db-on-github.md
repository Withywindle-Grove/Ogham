# Plan: the database shards on GitHub's machines (cq-4)

Written by the Builder, 2026-11-13, from Francis's yes relayed by the lead ("built, with a [amount removed] limit to start").

## Why
The PC has one database lane: each shard starts a local Supabase on fixed ports, so only the runner labelled `db` takes them. On 13 November cloud pull requests kept that lane full all afternoon, and main's runs waited more than an hour behind them, so nothing merged after 18:57 UTC deployed.

## The change
| What | Where |
|---|---|
| The three database shards run on `ubuntu-latest` by default | `.github/workflows/check.yml`, `database-shard` `runs-on` |
| `DB_RUNNER` = `self` sends them back to the PC's `db` runner; `CI_RUNNER` = `github` still sends everything to GitHub | the same line |
| Every other job (changes, check, the database summary, layout, review, preview, deploy, the night run) stays on the PC | unchanged |
| A test pins the line | `scripts/ci-jobs.test.mjs`, "which machine runs the jobs" |
| testing.md says so; the local check no longer waits for database runs; by day the `ready` label isn't added | `docs/testing.md`, CI |

No migration, no app code, no screen. Mockup: none, process only.

## Cost
About 4 billed minutes a shard (12 a run), so about [amount removed] a run at the org's [amount removed] a minute. On 13 November about 44 runs ran the shards: about [amount removed] a day. The org's Actions budget stops paid usage at its limit; Francis sets it.

## Left out
- Closing the gap where a docs merge deploys code whose own main database run hasn't finished: it needs a docs merge on main to run the shards too (about [amount removed] a day) or a wait across runs. For the lead.
- Skipping the shards when no file the database tests reach changed: sized (it would spare about half of the runs), not built.

## Departures
None.
