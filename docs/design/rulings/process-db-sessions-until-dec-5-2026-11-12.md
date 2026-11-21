---
status: absorbed
milestone: December first play (process)
absorbed-into: `.claude/agents/builder.md` (Database); docs/09-decisions-log.md (2026-11-12)
supersedes: until 2026-12-05 only, "Francis runs the main push himself" (the builder's instructions) and the standing instruction "no migrations pushed without my yes" for the migrations db-s1 covers
---

# Database sessions until 5 December (2026-11-12)

Ruled by Francis after database session 3, when asked whether the steps he runs by hand could be run for him: "app is not 'live' until dec 5. we can loosen those restrictions a bit". He then said yes to the wording below, and yes to the Builder's refinement (db-s2, db-s3).

| Id | Ruling |
|---|---|
| db-s1 | Until 5 December 2026 the coordinating Builder runs a database session itself for migrations that only add, and reports to Francis afterwards: the backup, the TEST push, the main dry run, the main push, the check that nothing is left, the advisors. |
| db-s2 | Francis's yes comes first, in plain words, for any migration that drops, renames or deletes data, **and for any migration that changes who may read what** (an access rule, a read function that runs with the definer's rights). The yes is a word from him; the Builder still runs the steps. |
| db-s3 | A session stops by itself, and says so, if: the backup fails; a dry run lists any file the Builder did not announce; the advisors show a new line it did not announce; or another builder has a migration part-way to TEST. |
| db-s4 | A backup before every push to the main project stays. One TEST turn at a time stays. Every migration still goes to TEST first. |
| db-s5 | On 5 December 2026 the earlier rule returns: the main push is Francis's. |
| db-s6 | The commands are allowed in the Builder's session by Francis himself, and he gives it the rule in its own window; no session changes its own permissions or another's. |

## Why
Francis ran three sessions by hand on 12 November (seven steps each). Before the first night of play the main project holds only test campaigns, and each session is backed up first.

## Honest notes
- "Only adds" is not "harmless": a migration can delete nothing and still widen who reads what. db-s2 exists for that; most of December's migrations are read rules, so most sessions still begin with his yes.
- Session 3's advisors showed one new line (a new read function) that had not been announced beforehand; under db-s3 that would now stop a session until it is explained.
