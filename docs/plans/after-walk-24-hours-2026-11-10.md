# The 24 hours after the walk (draft, 2026-11-10)

**Status: a draft for Francis's review. Nothing here starts before he approves it.** He asked (2026-11-10, evening): after the walk there are about 24 hours before the weekly usage reset (Thursday 6 am local time), with about 43% of the week unused and Fable at 13% of its half; how to get the most from it. His answer to the outline: "Yes. Plan on a review after we process the walk's feedback. We'll build the plan then kick it off overnight."

## The order of the evening

1. The walk's sitting ends.
2. The grouped list (ruled · needs a ruling · technical): F1 … F54, the players' 11 items, the Builder's built-not-ruled list for as-4. One ruling at a time.
3. This plan, reviewed and corrected with what was just ruled.
4. Kick-off overnight.

## The principle

Usage is not the limit; two other things are. **CI:** one lane, one local check at a time, so about one pull request every hour or two whatever is spent. **Rulings:** work built on a guess is rework. So the usage goes first to work that needs neither CI nor Francis until its end, and builds come last. Unused usage costs less than a day of rework.

## The lanes (to confirm at the review)

| Lane | Session, model | Work, in order | Needs from Francis first | Ends with |
|---|---|---|---|---|
| 1 Design | Designer, Fable | The readability standard for race and class text (mockup: a race sheet and a class sheet, before and after; F53). Creation's small fixes from the players' items (4, 8, 9, 11; F7, F12, F13, F19) as one mockup set. Then the owed sessions as proposals: statuses and scars (with F25's modifiers), the party map and M8b, downtime, Notes; the conversion question. | Which sessions, in which order; anything he wants left alone | One proposal file and its mockups per topic, each with its questions one at a time, for his rulings in the morning |
| 2 Packs | Pack Creator | The converter's errors from the scan (leaked keys and captions, lost paragraph breaks), regenerate. The four race-specific classes (F49), once ruled. The per-pack clean-up plan. Review areas 5 to 7 if he says yes. | A yes for areas 5 to 7; the F49 rulings; the standard for book references (after lane 1's proposal) | Builds held, a report of what changed, nothing in `_current` without the usual checks and his batch approval |
| 3 Reviews | Project Review, Fable; a reviewer per look-back | The five look-back reviews. Project Review's questions 2 and 3. After the gate passes: the fresh-session review, the security advisor, the code health check. | The go for questions 2 and 3; whether the gate has passed | Reports in `docs/health/` and on the pull requests; findings as a list, nothing fixed unasked |
| 4 Tester | Tester, Sonnet, Chrome | The classic-advanced sweep again with race limits off. fae-woodland's classes, one of each. The conversion stack (base setting, fae-woodland, the conversion). Each screen at 375 px if a way is found to set the width. | A second player account, if hidden-stays-hidden is to be swept | One message per character to Design, majors first |
| 5 Builds | Builder and its builders | as-4 (ruled). Then the after-gate list's small fixes, batched into few pull requests, in the order the grouped list gives. | The grouped list's rulings; merges overnight as already ruled (green pull requests merge; migrations wait for him) | Pull requests with their status files; a morning report |

## Front-loading the builders (Francis: "builders use tokens, CI doesn't, so we can run CI when we're out of tokens")

Lane 5 changes shape: builders write and check code while there is usage; the one CI lane works through the queue afterwards, unattended, into Thursday. What makes it work, to confirm at the review:

- **Independent slices only.** Each builder takes a slice that touches different files from the others; two branches on the same screen clash at merge, and the fix costs usage after the reset. The Builder picks the slices from the grouped list and names the files each one owns.
- **Finished before pushed.** Each pull request gets its local full check (one at a time across sessions: this is the pace-setter, not usage), its local review (the 2026-11-10 rule) and its status file while there is usage; then one push.
- **Prefer slices with no picture change.** A changed picture needs a CI round, a commit of the redrawn baselines and a second round, with a session awake in between; those finish after the reset, or the builder leaves the redraw as the one remaining step, written in the status file.
- **A red run waits for Thursday.** Nobody is there to fix it, so the queue order is safest first; a failed pull request doesn't block the ones behind it unless they are stacked. No stacking overnight.
- **Migrations:** built and tested on the test project in turn, never merged overnight (already ruled).
- **What can be built** beyond as-4 and the after-gate small fixes is Francis's call at the review: the magic slices (`plans/m5c-1` … `m5c-4`, mockups approved) are the largest block of ruled, planned work; M6 stays on hold apart from slice 2a.

## Trial: a lead and a design studio (Francis: "Yes, let's try it", 2026-11-10)

His point: orchestration is management and judgment, not dispatching, so it belongs on the most capable model. What was read (search summaries, not the full pages): Anthropic's write-up of its multi-agent research system (a lead that plans, briefs workers running in parallel and combines their results; the most capable model as lead with cheaper workers beat a single agent in their evaluation; about 15 times a chat's tokens), and "Building effective agents" (the orchestrator-workers pattern; start simple). On 2026-11-10 the Designer session relayed all afternoon and designed nothing.

| Who | Does | Doesn't |
|---|---|---|
| The lead (this Designer session, Fable) | Plans; writes each worker's brief (objective, output format, files to read, boundaries); reviews what comes back with the self-review list; decides what is a ruling; writes rulings, 09 and specs; Francis's single voice | Draw mockups while it is leading |
| Design Studio (a second session: `claude --agent designer --worktree design-studio`, Fable, high) | Mockups and proposal notes from its brief; reports to the lead | Ask Francis for a ruling; edit rulings, 09 or specs |
| The Builder's coordinator | The CI and deploy watch, check turns, merged and live lines | Answer a design question (it forwards) |

- **Set-up:** Francis starts the studio at kick-off; its first prompt is "Read your brief at <path> and begin." It starts from the brief and the files, not from history. Its own board row. No agent file or `.claude/README.md` changes unless the trial is kept.
- **First brief (to confirm at the review):** the readability standard for race and class text (F53), which needs nothing from the walk.
- **Judged by** (Project Review, after the gate): proposals ready by morning; how many the lead sent back; rulings each needed from Francis; Fable usage.

## For the review: where sessions run, and short-lived workers (Francis's question, 2026-11-10)

He talks to one session and reaches the others remotely; could the others leave the PC (memory for CI), and could workers be started and ended by need (tokens, context)?

- **Must stay on the PC:** the Tester (it drives Chrome there), the Pack Creator (private files that never enter the repo), the lead (it must reach the others).
- **Could move to the cloud or be started per task:** single builders, reviewers and look-backs, the design studio, Project Review: work that starts from a file and ends in a pull request.
- **Catches:** a cloud session receives a message and can't answer one yet, so it reports through its pull request and status file (builders fit; conversational roles don't); a cloud builder needs the project set up there (install, the test database's keys, the browser for layout tests): **not verified**. If it works, cloud builders run their checks in parallel, where the PC allows one at a time.
- **Short-lived workers:** the pattern in the write-up and what the Builder already does with its builders. A session open 16 hours costs context and drifts. The lead session, as configured, can't start a session: that would have to be switched on.
- **Step proposed for tomorrow:** one builder in the cloud on a small slice with no database work, to see whether its full check runs there. If yes: builders, reviewers and the studio become workers started per task from a brief; the lead, the Tester and the Pack Creator stay open on the PC.

## For the review: letting the lead start workers (a proposed edit, Francis's to approve)

Today `.claude/agents/designer.md` gives the lead these tools: `Read, Grep, Glob, Edit, Write, Bash, WebSearch, SendMessage, ListAgents`. It can message a session that exists and can't start one.

- **The edit:** add the tool that starts a subagent to that line (`Agent`; older versions of Claude Code call it `Task`: to check against the installed version before editing). Nothing else in the file changes for the trial. It takes effect the next time the lead session is started, so at a restart, not mid-gate.
- **What it gives:** workers started by the lead on the PC, per task, from a brief; they return their result to the lead and end, so they use memory only while they run and each starts with a clean context.
- **What it doesn't give:** cloud sessions that answer (they receive and can't reply yet).
- **The rule for where a task goes:** cloud for a clear brief with a checkable result (a small build from a plan file, a review); a local short-lived worker for anything that needs a conversation (diagnosis, design, pack questions, database work, since the test project has one turn at a time). A cloud worker's brief carries: "if unsure, stop and write the question in the pull request; don't guess."
- **Limits to write into the lead's prompt if this is kept:** how many workers at once (the PC's memory); which agent files it may start (`builder`, `reviewer`, `scout`, `designer` as the studio; never `tester` or the pack agents, which need the browser and the private files of their own sessions); it never starts a worker to do what it was itself refused.

## Effort (Francis: "we can also increase the effort where it makes sense to do so")

Raise it where a deeper pass finds things a quick one misses, and where no CI run is waiting on the answer: the reviews (look-backs, the fresh-session review, the security look, code health); the design proposals (each with its self-review and a critic pass); the pack scrutiny (the full read, book × pack × app, then a second pass). Leave it as it is for routine builds and the Tester's sweep, where the lane and the browser set the pace, not the thinking. To confirm at the review: the effort setting per lane.

## Limits

- At most four sessions working at once on this PC (a second CI lane crashed Linux at its memory cap on 2026-11-10); one local full check at a time; one CI lane.
- **Gate first:** if sitting 1 or 2 leaves a blocker, its fix comes before everything in this table.
- Nothing irreversible overnight: no main database push, no pack into `_current` without its checks, no merge of a migration.
- Each lane writes where it stopped, so a session that runs out mid-task loses nothing.

## Not known yet

- How much each lane burns in an hour: the first two hours overnight will say; lanes 1 to 3 can be widened (a second design topic in parallel, more look-backs) if the pace is low.
- Whether sitting 2 happens inside the 24 hours; if it does, the Designer and the Tester are on it and lanes 1 and 4 pause.
- Whether the gate passes; lane 3's after-gate reviews wait for it.
