---
status: absorbed
milestone: December first play (how the project is run from 19 November)
absorbed-into: CLAUDE.md, .claude/README.md, .claude/agents/ (driver, builder, designer), docs/testing.md (the hook's row; the GitHub check, rvw-6 and rvw-7), docs/status/README.md (history only), docs/00-start-here.md; docs/09-decisions-log.md (2026-11-17); rvw-8 was the cut itself (#923)
supersedes: the lead and the Design Studio trial (2026-11-10) and the coordinating Builder session; the board and one status file per pull request (2026-11-01, 2026-11-04, 2026-11-05); manual checks in `docs/testing/<branch>.md` (2026-11-05); cloud seats as builders (be-7) and a cloud seat's first review on every pull request (rv-4) while a stack is held; pictures for approval per row. cq-3 (checks by day) ends early under rvw-6. The order ord-2 and ord-3 stands, with rvw-9 in front of it.
---

# How the project is run after the independent review (2026-11-17)

Francis read `docs/reviewer/project-review-2026-11-17.md` and ruled the same day, in chat with the reviewing session. His words are in quotes. Evidence for each line is in the review.

| Id | Ruling | Francis |
|---|---|---|
| rvw-3 | **One driver, on Opus.** Francis talks to one session. It orders the work, writes each worker's brief, starts builders and a reviewer as short-lived workers, looks at pictures, and merges. There is no separate coordinating Builder session and no standing lead on Fable | "let's go with one driver on opus" |
| rvw-4 | **Fable only for a short design sitting** that ends in a ruling file: a question that touches the data model, permissions or hidden data; a screen with no approved mockup; anything that failed twice on Opus. The driver stops and says so when it meets one | "Yes" |
| rvw-5 | **Short conversations.** A fresh driver each morning, and whenever its conversation passes about 150,000 tokens, started from a handover file the driver writes itself. A hook warns any session past that size (`scripts/context-warn.mjs`). Francis gets a morning reminder | "Yes" |
| rvw-6 | **The full checks come back by day before the first stack lands** on `main`; the red night run of 16 November is fixed before anything else (the initial review's risk 8) | "approve" |
| rvw-7 | **A check that fails when a migration rewriting the log, Undo or pack-import function is not built on the newest version** of it. Splitting those functions waits until after 5 December (risk 1) | "approve" |
| rvw-8 | **The process is cut** as this file says; the rules are cut in one pull request that only removes and merges: `CLAUDE.md` back to a page, `.claude/README.md` and the agent files rewritten to match, the hard rules untouched (risk 9) | "approve"; "Yes" |
| rvw-9 | **Finish before starting.** One screen at a time, taken all the way to live; no new screen is opened while one is held. The order: `main` green; the unsaved work saved (rvw-17); the waiting pull requests merged or closed; the Scene stack to live; the Player screen; the town's buying path; the Pack's first-night seven | "Yes" |
| rvw-10 | **At most four sessions at once:** the driver, two builders on the same screen (rows that share no file), one reviewer on demand. Merges, conflicts, watching CI and look-ups go to Sonnet or Haiku workers. **Exception:** when the week's meter shows usage will be left at the reset, the driver may add seats for work that opens no new screen (see below) | "My only concern with this limit is when we approach the usage reset, if we have any usage remaining i want to use all of it"; then "Yes, as worded" |
| rvw-11 | **No cloud seats for building** until the three stacks are live; one may stay for first reviews | "Yes" |
| rvw-12 | **No status file per pull request, no board, no per-branch test list.** The pull request's own text carries what was built, the migrations, the tests, what is fragile, the ⚑, the manual checks and the departures. The old files stay as history | "Yes" |
| rvw-13 | **Decisions once a day.** The driver settles anything reversible that sits inside an approved mockup and lists it for Francis afterwards; everything else comes to him in one sitting | "Yes" |
| rvw-14 | **Pictures once per whole screen,** not per row, unless a row departs from its mockup | "Yes" |
| rvw-15 | **Every worker's brief starts with `Row: <id>`** and the pull request's title carries it. The usage report (`npm run usage:report`) is run at each Thursday reset, so a row's cost can be read | "Yes" |
| rvw-16 | **No new process rules until 5 December.** A failure is fixed by checking an existing rule | "Yes" |
| rvw-17 | **The unsaved work is saved first.** Right after `main` is green the driver commits and pushes, as drafts, the work in the eleven folders the review session listed; only then is a local session archived | "Yes" |
| rvw-18 | **A builder may still use Fable, on Francis’s yes each time,** for the steps `.claude/agents/builder.md` lists under "Escalating to Fable" (a migration touching access rules or data, the command and event core, anything that failed twice on Opus). rvw-4 does not end this | "Yes, keep it" |

## The exception to rvw-10

The limit of four is for while usage is scarce. The day before the reset, the driver reads the week's meter with Francis. If usage will be left over, it may add seats, on work from this list only, so that nothing new is left held:
- rows of the next screen that are data and logic only (they stop before the screen);
- tests, and the look-back reviews still owed;
- the checks for rvw-6 and rvw-7;
- clean-up that touches no file a live row holds.

Never a second screen's visible rows, and never more seats than the PC's memory allows.

## Docs to update

`CLAUDE.md`; `.claude/README.md`; `.claude/agents/` (a new `driver.md`; `builder.md`; `designer.md`; `coordinator.md` removed or retired); `docs/testing.md` (the hook's row, with the scripts' pull request); `docs/status/README.md` and `docs/status/board.md` (a line saying they are history); `docs/09-decisions-log.md`.

09 lines:
- 2026-11-17 — [process] From 19 November one driver on Opus leads and starts short-lived workers; Fable is for short design sittings only; a fresh driver each morning and at 150,000 tokens, with a hook's warning (rvw-3, rvw-4, rvw-5), and a builder may still use it on his yes each time (rvw-18) — Francis, from the independent review: half of all usage went to replies carrying over 400,000 tokens, and leading cost more than building — `design/rulings/process-after-review-2026-11-17.md`
- 2026-11-17 — [process] One screen at a time to live, in a fixed order; at most four sessions; no cloud seats for building while a stack is held; no status files, board or per-branch test lists; decisions once a day; pictures once per screen; every brief names its row; no new process rules until 5 December; unsaved work saved first (rvw-9 to rvw-17), with more seats allowed for work that opens no new screen when usage would be left at the reset — Francis: "Yes to everything else" — `design/rulings/process-after-review-2026-11-17.md`
- 2026-11-17 — [testing] The full checks return by day before the first stack lands, and a check will fail a migration that rewrites the log, Undo or pack-import function from an old version (rvw-6, rvw-7) — Francis: "approve", the initial review's risks 8 and 1 — `design/rulings/process-after-review-2026-11-17.md`
