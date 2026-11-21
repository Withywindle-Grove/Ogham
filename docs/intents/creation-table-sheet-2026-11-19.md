# Intent: creation's long tables open as a pop-up sheet

Author: Francis · Date: 2026-11-19 · Status: done

## Problem
Francis, 19 Nov, to the driver, with a picture of creation's folded row "Starting adventuring items: pick up to 4 / 4 of 4 picked. 20 to choose from":

> "when does the starting adventurer items fix go in (making "take these items" collapse the menu) - in fact it should be a pop up sheet."

Today a long pick-from table in character creation (the starting adventuring items, 20 to choose from) opens in the page itself. The player scrolls a long list inside the creation step, and after "Take these" the list stayed open (the fold is built in #991, not yet live).

A second note the same day, on the Looks and manner step, with two pictures (the Backgrounds pop-up as the book's table: a band title, a die column, striped rows, "Roll d20, then mark your row"; and the Demeanour pop-up as the older list: "1: Cheerful, easy to like" with a "Pick" button on every row):

> "Looks and manner has two formats 1 for backgrounds, 1 for the other 8 tables. they should all use the backgrounds format"

As built, a table of more than 12 rows takes the book's format with mark-and-confirm (cs-7 and cs-15, `design/rulings/dec-creation-sweep-2026-11-12.md`); a table of 12 rows or fewer keeps the list with a Pick button per row. cs-15 ruled the Pick buttons gone on long tables only, and no mockup shows a short table in the book's format.

## Outcome
The long table opens as a pop-up sheet over the creation step. The player picks there, takes the items, and is back on a short, calm step that says what was picked.

Every table of Looks and manner looks and works the same way, the Backgrounds way, whatever its length.

## Touches
- Character creation's tables (05, 06; the creation mockups in `docs/design/`).
- The fold built in #991 (`creation-test-fixes`): "Take these folds its table; Details shows every table".
- The Components inventory in 06 (a sheet, and a pop-up opened from a sheet keeps its own form).

## Constraints
- This changes an approved screen: nothing is built before Francis approves a mockup (Mockups first, 2026-11-12).
- Calm UI, tokens only, 44 px targets, 375 px width, never a disabled button.
- Rules-agnostic: the mockup uses invented items.

- #991's fold does not go live as a stopgap: creation's long tables wait for the sheet (Francis, 19 Nov: "Wait for the sheet").

## Out of scope
- What the tables hold (the packs' content).
- Creation's other steps.

## Open questions
- Answered 2026-11-19 (cts-1): which tables open as a sheet. Every pick table on Gear, whatever its length.
- Answered 2026-11-19 (cts-2, cts-4): a short table in the Backgrounds format marks, then confirms with "Take it", and a typed answer waits for it too.
- Answered 2026-11-19 (cts-3): once the sheet is closed the step shows one row naming what was taken, with Change.
- Answered 2026-11-19 (cts-7): on a tablet the sheet keeps the full width ("Keep full width"), and a 20-row table stays one column, as built.

## Links (filled in later)
Ruling: `../design/rulings/dec-creation-table-sheet-2026-11-19.md` (cts-1 to cts-6) · Plan: `../plans/creation-table-sheet.md` · Pull request: #1047 (the mockup, the ruling and the plan) · Status report: —
