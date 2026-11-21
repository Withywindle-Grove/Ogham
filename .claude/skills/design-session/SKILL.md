---
name: design-session
description: Runs a paper dry run with Francis (a play scenario walked step by step through the app on paper), collects ⚑ as they come up, then compiles the rulings, 09 lines and docs to update. Use for "dry run", "paper test" or "walk through a session".
---

# Paper dry run

A paper dry run plays a short stretch of a real session against the design, one step at a time, before anything is built. It finds what the app gets wrong at the table. Examples: `docs/design/notes/*-dry-run-notes.md`.

Rules throughout: **collect ⚑, never decide them** (Francis rules); one step per reply, short enough to read on a phone; aliases and invented examples only (no real game names, rules text or book numbers in anything written to the repo).

## 1. Setup (one reply, then wait for "go")
- **Scenario and goal:** what the group is doing and what the run must reach (for example "travel into the forest, forage, camp for the night").
- **Pack(s):** which setting-rules pack(s) by alias and version, and any adventure or homebrew test pack. When two packs differ, add a short table of the topics each pack handles differently: the run must touch each topic (topics only in the repo; the pack's actual rules stay in `packs/`).
- **Characters:** invented party (names and roles, any hireling and whose), starting place, lights, season and other state that matters.
- **Screens:** which screens and mockups the run uses, and which rulings are still provisional.
- **What it tests:** what's already built and what's being designed.

## 2. Steps (one at a time)
For each step, write:
1. **At the table:** what happens in play, in plain words.
2. **The app shows:** who sees what (GM, each player, the shared table view), hidden information kept hidden.
3. **Taps:** who acts and how many taps; compare with the tap budgets in `docs/06`.
4. **Questions** for Francis about this step only. Then wait.

Record his answers under the step as they come: **Francis:** (his view), **Francis asks:** (a question, with your answer), **Francis (corrects):** (a correction of your proposal). Each new decision becomes a ⚑ line under the step. Answers often reshape later steps: adapt the next step, don't defend the plan. A ⚑ he takes back is marked withdrawn, not deleted. Items for later go to the **parking lot** or the **roadmap** by name, never quietly dropped. Check claims about a pack against the pack itself before stating them.

## 3. After the run
1. **Rulings to confirm (⚑):** one numbered list grouped by theme, each ruling one or two lines, saying which earlier ruling or spec line it changes. Then **Not walked, already covered**, **Withdrawn during the run**, and **Pack tasks** (data work, no app change).
2. Francis approves, changes or rejects each; take them one at a time if he prefers.
3. **Rulings file:** `docs/design/rulings/<milestone>-<topic>.md` with the header from `docs/CLAUDE.md` (`status: pending`), each ruling with an id (`<milestone>-<topic>-1`, …).
4. **09 lines:** propose one line per ruling, `date — [topic] decision — why`.
5. **Docs to update:** list each spec section (05–08, 10, 11) and the components inventory rows each ruling touches.
6. Save the walk itself (steps and answers, aliases only) as `docs/design/notes/<topic>-dry-run-notes.md`.
