# Cloud brief: K28, the log lines and Undo for finds and Take (logic only)

**Blocked means stop and report; never reach the end another way.** If a guard, a hook or a permission check blocks you, stop and write what happened in the pull request. Do not try another tool, branch or command for the same result.
Test files are changed only with the Edit tool. If the hook refuses, stop and report.
If you're unsure, stop and write the question in the pull request. Don't guess.

## Objective
Give the Pack tab's new actions their log lines and Undo, in words, ahead of their screens. This is row K28 of `docs/plans/dec-6-the-whole-pack-tab.md` (released as "none: data and logic only").

## Output
- **Branch:** `dec-6-k28-log-lines`, from `main`. **One pull request against `main`.**
- **Logic and tests only.** No screen files. Do not edit `src/app/PackScreen.tsx`, `src/app/PlaceCard.tsx` or `src/app/PlayerScreen.tsx`. No migration.
- **Status file:** `docs/status/<date>-dec-6-k28-log-lines.md`.

## Read first
- The plan's row K28, rulings **pu-7**, **pu-9** and **pk-3**, and hard rule 4.
- `docs/design/rulings/dec-purse-screens-2026-11-13.md`, for the purse's words and voice ("Your GM took 10 herons from the stash").
- `src/core/events.ts` and `src/core/events.test.ts`: how a log line's words are made today. The purse's lines are already built there.
- `src/modules/inventory/`: `inventory.move` and its callers (Take exists today as a move out of the stash), and the load tiers (for Take's toast).

## The words (the lead's, in pu-7's voice)
Use characters' names, never players'; the GM is "Your GM".
- **A find to a character:** "Your GM gave <Name> <thing>, from <hoard> at <place>."
  - A whole hoard: the things listed, commas between.
  - Where the piece names no hoard: "Your GM gave <Name> <thing>, at <place>."
- **A find to the stash:** "Your GM put <thing> in the party stash, from <hoard> at <place>."
- **Coin in a find:** a purse's amounts reach only those who may read that purse (pu-9, hard rule 5).
  - The line read by that character's player and the GM names the amount: "Your GM gave <Name> 40 herons, from …".
  - The line everyone else reads says "coin", with no amount: "Your GM gave <Name> coin, from …".
- **Take of a thing:** "<Name> took <thing> from the party stash."
  - A stack: "<Name> took 2 torches from the party stash."
  - The toast adds what it did to the taker's load, as pk-3 requires: "Took <thing>. Load: <tier>."

## What to build
1. The words above, as functions in `events.ts` (or beside it, as the purse's are).
2. A find's command is a later row (K16b), so build only the words, taking the event's shape as K16b will write it. Write that assumed shape in the status file for K16b.
3. Take uses today's `inventory.move`; this row gives its line's words when the source is the party stash, and the toast text.
4. **An item leaving play is deleted, with its copy kept in the log (hard rule 4).** Check that the lines you add keep that copy, so Undo can restore it.
5. **Every action carries Undo in its toast,** through the existing undo path (`undoLatest` or `undoChange`).

## Tests (each written first as a plain sentence)
- Each line's words, with invented names, coins and places.
- The coin amount appears on the receiver's player's and the GM's line, and "coin" on everyone else's.
- A stack's count.
- Take's toast names the load tier.
- Undo of Take restores the stash.
- An item that left play is restorable from its log copy.

Use invented fixtures only: no game-system names, rules or numbers from any book.

## Boundaries
- No migration and no change to who may read or write anything. If a line needs either, stop and say so.
- The purse's built lines stay as they are.
