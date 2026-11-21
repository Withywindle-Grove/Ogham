# Cloud brief: K14, who and when on a stash row (logic only, read from the log)

**Blocked means stop and report; never reach the end another way.** If a guard, a hook or a permission check blocks you, stop and write what happened in the pull request. Do not try another tool, branch or command for the same result.
Test files are changed only with the Edit tool. If the hook refuses, stop and report.
If you're unsure, stop and write the question in the pull request. Don't guess.

## Objective
For the party stash, work out who put each thing in and when, plus the stash's last thing in and last thing out. Read it all from the log the party already reads, storing nothing new. This is row K14 of `docs/plans/dec-6-the-whole-pack-tab.md` (released as "none: data and logic only"; the Builder's sizing chose a read of the log, not a stored field).

## Output
- **Branch:** `dec-6-k14-stash-history`, from `main`. **One pull request against `main`.**
- **Logic and tests only:** a new module, `src/modules/inventory/stashHistory.ts`, and its tests. No screen files; the screen is K11, later. Do not edit `src/app/PackScreen.tsx`, `src/app/PlaceCard.tsx` or `src/app/PlayerScreen.tsx`. No migration.
- **Status file:** `docs/status/<date>-dec-6-k14-stash-history.md`.

## Read first
- The plan's row K14 and ruling **pk-4**. The Pack page's stash frames (`docs/design/mockups/pack/08-the-pack-tab-whole.html` on design-december-mockups) show how "who" and "when" are drawn.
- `src/core/events.ts`, and how the party's log lines for the stash are read today (the log's read rule and audience), so you read only what a member may already read.
- `src/modules/inventory/`: `inventory.move`, the stash as a carrier, and Give to… and Put in.

## What to build
- **"Who":** a character's name. When the GM did it: "Your GM".
- **Per row:** who put it IN, and when. That is the latest put-in for what's on that row.
- **The stash's two facts:** the last thing in and the last thing out, each with who and when.
- **Things only:** coin has its own sheet and lines, and counts toward neither fact.
- **"When":** the campaign's day as the Pack page draws it ("today", "day 2"), from the event's campaign day where it has one, else the event's date. Name the fields you find in the status file.
- **Which events count:** every event that moves a thing into or out of the stash's carrier. That includes a give to the stash, Put in, a take by today's Give to… flow, and the GM's send to the stash once K16b exists. List the event types you found in the status file.
- An undone event doesn't count. A thing that left play keeps its history in the log, but it has no row.
- A loader reads those lines with today's reads only.

## Tests (each written first as a plain sentence)
- In, out, a partial take from a stack, an undone move, the GM as "Your GM".
- Coin counts toward neither fact.
- "today" and "day N".
- A player reads nothing they couldn't already read: run it as a player through the stand-in database (`src/testing/fakeDb.ts`).
- Invented names only.

## Boundaries
- No migration and no change to who may read anything. If the log doesn't carry what's needed, stop and say what's missing.
