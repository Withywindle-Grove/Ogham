---
status: absorbed
milestone: process (the cloud builders' trial of 2026-11-13)
absorbed-into: `.claude/README.md` (the reviewer's line); docs/09-decisions-log.md (2026-11-13). The trial was judged the same day and made the rule: rv-3, `dec-evening-2026-11-13.md`
supersedes: nothing. The local review rule (2026-11-10) and rv-1 stand; rv-2 adds a second reviewer for one kind of pull request
---

# A cloud session may review a cloud pull request (a trial) (2026-11-13)

Why: by the evening of 13 November four cloud builders had finished seven pull requests, and all seven waited on the coordinating Builder's one local reviewer, which also reviews the PC's own work. Building had stopped being the limit; review had.

| Id | Ruling | Whose |
|---|---|---|
| rv-2 | **A trial: a cloud session may do the review of record** for a pull request written by another cloud session, when that pull request is logic or scripts only. | Francis: "yes try it" |

## The terms (the lead's, as put to Francis)
| Point | Rule |
|---|---|
| What it may review | Logic or scripts only: no screen (component, route, CSS), no migration, no access rule, no workflow file. Those stay with the local reviewer, as does all of the PC's own work |
| Never its own | A session does not review a branch it wrote, refreshed or pushed to |
| How | `REVIEW.md`, the three passes, read-only; one comment on the pull request headed "Cloud review (trial, rv-2)"; brief `docs/plans/briefs/review-cloud-pull-request-cloud-brief.md` |
| Rounds | A cloud session cannot message another: the lead reads the comment and sends the round to the author |
| Merge | Unchanged: the coordinating Builder sets auto-merge, after the lead has told it the review is clean or its round is closed (rv-1's order) |
| First batch | The pack checker's rules from the gate, brought up to main (scripts only) |

## How the trial is judged
- The lead reads each cloud review in full against the diff for the first three, and says to Francis what it caught, what it missed that the lead could see, and whether its Importants were real.
- It ends, or becomes the rule, on his word. Project Review may look at it with the lead-and-workers trial.

## Honest notes
- The cloud reviewer is the same model with the same rules as the local one, and like it cannot see the private packs or a running app. It is no better at what both miss.
- Whether a cloud session can post a comment on a pull request was not known when this was written; the brief gives it a file on a branch as the fallback.
- The lead asked for "the four waiting logic-only pull requests". By the time Francis answered, the local reviewer had taken or finished three of them, and the fourth was written by the session that would review. The first batch is therefore one pull request.
