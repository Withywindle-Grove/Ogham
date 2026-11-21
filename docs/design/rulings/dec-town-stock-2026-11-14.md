---
status: pending
milestone: December first play (the town: its second sitting and the GM's stock); how sessions act after a refusal
absorbed-into: pending, with each piece's pull request: 05, 06, 07, `docs/testing.md`, `.claude/README.md`; docs/09-decisions-log.md (2026-11-14); `docs/plans/dec-3-the-whole-town.md` row W9
supersedes: nothing as a file. Inside it: tn-5 and ap-13 replace the stock rows of page 05 frames S1 to S3 (mc-73, mc-74) and the row forms tn-4 was first drawn in; the three fixes of ap-12 remove "Roll its chance", "Roll them all at the table…" and the roll pop-up.
---

# 14 November: the town's second sitting, the stock as the book's table, and two rules after a refusal (2026-11-14)

## Francis's rulings

| Id | Ruling | Whose |
|---|---|---|
| ap-12 | **The town's second sitting is approved with fixes** (page 19: TW7, TW7b, TW9, TW9b, TW9c, TW10, TW11, TW11b, TW12, TW4c). The fixes: "Roll all…" and the roll pop-up are dropped, since the row carries the chance and the answer; "Reset" puts every thing with a chance back on "?" for a new day. He made it conditional on the fae-woodland pack; the stock rows did not meet that as first drawn (below) and were redrawn. | "Approve with fixes assuming it works with" the pack |
| tn-5 | **The stock list's "Availability" column** shows only the die's icon (for a die of that many sides) with "x-in-y" in the pack's own form, or "Always". No rarity on the row: it is read in the thing's entry. By settlement size is a mechanic and is never shown in a column: in a settlement of a listed size the thing is "Always"; in another it is off. | "Like this" (a table from his book); "Use availability as column header and [y die icon] x-in-y or always. No rarity indicator that can be included in the detailed description. By size is good mechanic but doesn't need to be displayed in a column" |
| ap-13 | **The GM's stock as the book's table is approved** (page 19: TW8j, TW8k, TW8, TW3, TW8b's second entry card; `design-december-mockups` at f7d0a110): the book's table part with heads Item, Price, Availability, Stocked?; the three-position toggle (tn-4) as the last column; a thing with no chance has an empty cell and its toggle on "?"; the things to decide in the table, with "Always to be had" and "Not sold in <size>" folded under it; a short shop's table carries every thing; a thing's entry gains labelled lines "Rarity" and "Sold in". He did not name form (A) or (B): the whole screens he approved are drawn in (B). | "Stock table approved" |
| gd-4 | **After a combined command is refused, a session may run its ordinary parts one at a time as plain commands**, so the check can read each one. It leaves out anything that deletes, restores or reaches outside its own folder. If a plain part is refused too, it stops for him. | "Yes to both" |
| gd-5 | **A worker may remove its own temporary test, never committed, with the Edit tool** (the one the guard watches). On a fix branch the guard's own rule (gd-1) still applies. | "Yes to both" |

## The lead's rulings

| Id | Ruling | Whose |
|---|---|---|
| tn-6 | **Inside tn-5, by extension:** a note in words alone on a thing's availability is not shown on the row either (empty cell, "?", the note on the entry's "Sold in" line); the line about a place's quality is off the stock list and lives in the rules text; no by-size figure is drawn. In a town whose size is not known, a thing sold by size has an empty cell and its toggle on "?". | The lead's; told to Francis, who did not object |
| dl-1 | **A builder's pull request adds no line to the decisions log.** A fact worth a line is written in its status file under "09 line for the lead", ready to paste; the lead appends them in docs batches. Six pull requests needed an extra merge round on 14 November only because two sides had appended to the log's end. | The lead's, on the Builder's proposal |
| un-1 | **After "End expedition" the card says nothing about the last turn**: its title is cleared with the last advance's lines, as page 16 frame T11 (ap-11) draws it. It rides the fix that stops a toast Undo taking a GM line off the card after ending. | The lead's |

## What the pack check found
The fae-woodland pack states a thing's availability four ways, and the port pack repeats them; the Pack Creator confirmed each against the book's own pages:
- a chance on the thing, "always", "3-in-6" or "1-in-6" (40 things);
- sold only in settlements of some sizes, with no roll (50 things; the rules set's by-size figure is 0 or 100);
- a rarity word, where a place's quality decides how many of each it keeps: a count the GM picks, never a roll (33 things);
- a note in words alone (one thing).
No pack used on 5 December states a stock chance any other way. The book does not say how often the roll is made; the app's rule stands (the day's stock, reset at a new day). The region pack, not used that night, gives some shops their own stock lines as place text; turning those into toggles would be new format work, after 5 December.

## Open when this was written
- **The card that answers a player's request** ("Wren asks for…", approved with "In stock" and "Not here" as buttons): one proposal frame (page 19, TW8g) draws it with the three-position toggle; not yet asked.
- **The three-position toggle is a new part** and is not yet in 06's inventory; the book table has no stacked form for 375 px in the shared mockup stylesheet (page 19 owns it for now).
- **A rules set that lists its special seasons as GM-only still shows players the seasons' names** (the default, seasons without their start chance and encounter swap, is ruled, 2026-10-30). No pack in use does this. Whether an explicit GM-only mark hides them whole removes a read and waits for his yes.
- The three guard events behind gd-4 and gd-5, as told to him: a worker's own debug test removed with the Edit tool on the Builder's word after a shell command to do it was refused; a second builder's combined picture command refused, then its picture step alone first allowed by the Builder and then held; the lead's own plain unzip after a combined command that began with a delete was refused.

## Honest notes
- The lead's first fix "drop the percent row" gave a wrong reason: the format's by-size figure is a percent, though no pack has one between 0 and 100. tn-5 settles it: nothing by size is displayed.
- The lead read the pack file, not the book's source folder: its listing of that folder was refused by a guard (the folder's name was read as a shell command) and was not retried; the Pack Creator read the book.
- The stock rows were drawn five times on 14 November (two ways; four variations; row (4); the pack's shapes; the table) before he approved them.
- The Undo fix merged that day (#829) put one line on the live town card that was not there before ("Next turn, nothing due" after ending an expedition and taking a town step); un-1's fix removes it.
