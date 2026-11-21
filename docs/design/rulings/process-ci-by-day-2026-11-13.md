---
status: absorbed
milestone: December first play (the CI lanes on Francis's PC; the patron and garb fix)
absorbed-into: `CLAUDE.md` (the merge rule, here); `docs/testing.md` and `.claude/README.md` (the CI lines) with the Builder's pull request for cq-3; docs/09-decisions-log.md (2026-11-13); docs/05-features.md (gs-5, the Patron step)
supersedes: the note "Not yet ruled" at the foot of `process-ci-queue-2026-11-13.md` (both questions are settled here); cq-1a, cq-2 and cq-2a stand
---

# Database tests by day, one full run each night (2026-11-13)

Francis, after the Builder's count of what CI had caught: "What happens if we drop ci except for db tests", then "yes".

| Id | Ruling | Whose |
|---|---|---|
| cq-3 | **Until 2 December, by day only the database tests gate a merge and the deploy.** On a pull request and on main's run after a merge the database job runs as before; the check and layout jobs report "deferred to the night run". A piece that passes merges and goes live at once. | Francis: "yes" |
| cq-3a | **One full run each night** on main (check, every database shard, every layout shard), starting by itself at 07:00 UTC, under the heavy-job queue (cq-1a). A load failure re-runs once, alone. A real failure is in the Builder's report by 7 am local time and is fixed first thing that day. New gallery baselines come from the night run and are committed the next day. | with cq-3 |
| cq-3b | **From 2 December full runs before every merge return**, switched back by hand in a one-line pull request; the date lives in the plan and `docs/testing.md`, not in code. Nothing unchecked goes into the 5th. | with cq-3 |
| cq-3c | Unchanged: the local check before every commit; the local reviewer before auto-merge (rv-1); mockups first and pictures of the built screen; migrations and database sessions; a full run by hand at any time (2026-11-09), used at the Builder's judgement for a large visible piece before it merges. Batching (cq-2) stays allowed and is seldom needed by day. | the lead's |
| cq-3d | Closed by cq-3: CI only at night ("build by day, CI by night", the same morning's draft, never in force), and moving runs to GitHub's own machines for money (measured at about [amount removed] a full run, [amount removed] to [amount removed] on past whole days; not taken up). | Francis, by choosing cq-3 |

## What is traded
- A screen changed by accident, a tap target under 44 px, sideways scrolling on a phone or an accessibility fault can be live for up to a day before the night run finds it. The data stays guarded: the database tests are the only CI job nothing local repeats (about 14 real catches since 8 November).
- The check job's content is run by every builder before committing; the night run repeats it on the merged result.
- With the PC free of heavy CI by day, it holds four builders; the unstarted December pieces start from the agreed order as each batch clears.

## The patron and garb fix: its failure toast
| Id | Ruling | Whose |
|---|---|---|
| gs-5 | When the garb can't be swapped after a change of patron, one toast says both things: the patron line as it reads today, then **"Couldn't swap your patron's garb. Check your connection and try again."** It is the existing error toast and the ruled pattern ("Couldn't load the pack. Check your connection and try again."). "Try again" must be true: the builder says what retries it, or stops. A swap that fails partway never later takes what the player added (hard rule 4). | The lead's; a picture of the built toast goes to Francis with the closed patron's follow-up |

## Honest notes
- The first review of the garb fix found two faults that mattered (the new garb never arriving from one starting point; a failed swap leaving a record that could later take a player's own items). It was pulled from the day's first batch and fixed tests first.
- cq-3's mechanism is a workflow change: its own run is its test, as the heavy-job queue's was.
- Nobody has yet measured how many layout faults a day reach main under cq-3; the first week's night runs will say.
