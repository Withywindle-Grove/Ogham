---
status: absorbed
milestone: December first play (character creation; `docs/plans/creation-table-sheet.md`)
absorbed-into: docs/09-decisions-log.md (2026-11-19, three lines); docs/06-screens-and-design.md (the Table sheet row with its new Pick table variant, the Detail row's new pick table variant, the Tapped table row, the Creation step shell's toasts and its Gear passage); docs/05-features.md (creation's steps: gear); `docs/plans/creation-table-sheet.md` (the build; its ⚑ 1 and ⚑ 2 answered as cts-8 and cts-9); `docs/intents/creation-table-sheet-2026-11-19.md` (its questions closed)
supersedes: nothing as a file. Inside it: cts-1 replaces "Gear's picks stay folded" (m5b-one-table-open, 09, 2026-11-09) and cs-22's pick table "under its own heading with one state line" (`dec-creation-sweep-2026-11-12.md`); cts-2 widens cs-15 of the same file from long tables to every table of Looks and manner and ends the Pick on a short table's rows; cts-4 changes when a typed answer is kept (final drafts D, as built); cts-5 replaces the words "Roll d20, or choose." on the pick table, "Tap a row first." and "then tap the row" on Details; cts-6 holds back the fold of pull request #991
---

# Creation's tables: the pop-up sheet and one format (cts-1 to cts-9; ruled 2026-11-19)

Francis's intent of 19 November (`../../intents/creation-table-sheet-2026-11-19.md`) asked two things of character creation. Of the starting items table on Gear: "when does the starting adventurer items fix go in (making "take these" collapse the menu) - in fact it should be a pop up sheet." Of the Details step: "Looks and manner has two formats 1 for backgrounds, 1 for the other 8 tables. they should all use the backgrounds format".

The designer drew mockup page 24 (`creation/final/24-table-sheet-and-one-format.html`, eight frames, TS1 to TS8), with a pick drawn for each open question. Francis ruled from the pictures on 19 November, in three answers the driver relayed:

1. On TS2 and TS5: "Approve with fix". The one fix: the roll sentence (cts-5 a).
2. On TS1, TS3 and TS6: "Approve with fixes". The two fixes: the answer to an empty "Take it" (cts-5 b) and the Details step's line (cts-5 c).
3. After seeing TS7, to the driver's question "On a tablet, should a table's sheet be narrower than the full screen?": "Keep full width".

Examples are the mockup's invented ones.

## Ruled by Francis

| Id | Ruling | Against what stood | His words |
|---|---|---|---|
| cts-1 | **A pick table on Gear opens as a pop-up sheet over the step, whatever its length.** Nothing folds open in the page. The sheet is titled with the table's name and its count ("Travelling odds: pick up to 4"), then the roll line, "What you rolled" with Show, the table in the book's style, and a foot that stays in view: what is marked ("4 of 4 marked: Reed rope, Eel hooks ×2, Tallow candles ×3", two lines at most) and "Take these" at the right. A tap marks a row, a tap again marks it twice, − puts one back; the ✕ closes with nothing taken (TS2, TS3) | Replaces the fold in the page (m5b-one-table-open: "Gear's picks stay folded"; cs-22). cs-15's mark and confirm, R3-8's same row twice and "Take these" stand, moved into the sheet. The intent's first question | "in fact it should be a pop up sheet"; "Approve with fix" (TS2); "Approve with fixes" (TS3) |
| cts-2 | **Every table of Looks and manner uses one format, the Backgrounds one, whatever its length:** the book's table (its name on the band, the die over its column, banded rows, each row a tap), and a tap marks the row, with "Take it" at the foot's right. No "Pick" on a row; a tap no longer takes a row and closes the sheet (TS5) | cs-7 already gave every rolled table the book's style; the build kept a list with Pick for 12 rows or fewer. cs-15 said "on a long table": it now holds at any length here. The 12-row line (`isLong`) no longer decides a table's look or its confirm. The intent's second question | "they should all use the backgrounds format"; "Approve with fix" (TS5) |
| cts-3 | **Once the sheet is closed, the pick table is one row on Gear, like the trinket's row under it:** its name and "pick up to 4"; under it "0 of 4 picked. 20 to choose from" with **Open** before anything is taken, then what was taken by name ("4 of 4 picked: Reed rope, Eel hooks ×2, Tallow candles ×3") with **Change**. A long list keeps to two lines, then "…". "N to choose from" shows only before anything is taken. No chevron: the row opens a sheet, it does not unfold. "Take these" closes the sheet and the toast says what went into the pack, with Undo (TS1) | Replaces the folded row with its chevron for this table (cs-22); cs-9's chevron stands for what folds. Keeps his fix on #991, 18 November: the row names what was taken. The intent's third question | "Approve with fixes" (TS1) |
| cts-4 | **A typed answer waits for "Take it", like a row.** On a table that offers "Or type your own", the player's own words are the marked answer (the edge, bold and a tick on the box; no row marked) and "Take it" takes them. Opened again by Change, what was taken comes marked, and Clear takes it off (TS6) | As built (final drafts D) the words were kept as they were typed, with no confirm | "Approve with fixes" (TS6) |
| cts-5 | **The words, his three fixes.** (a) The pick table's roll line is the Looks tables' sentence: "Roll d20, then mark your row." (it read "Roll d20, or choose."); "pick up to 4" stays in the title. (b) "Take it" or "Take these" with nothing marked answers "Mark a row first." (it read "Tap a row first."); on a table that takes the player's own words it answers "Mark a row or type your own first." (c) The Details step's roll line reads "then mark your row", not "then tap the row" | The toast of cs-15 and cs-50, reworded; cs-22's die "named in the table's sheet" stands | (a) "Approve with fix"; (b) and (c) "Approve with fixes" |
| cts-6 | **The fold built in pull request #991 does not go live as a stopgap:** creation's pick table waits for the sheet | #991, "Take these folds its table", approved with fixes on 18 November | "Wait for the sheet" |
| cts-7 | **On a tablet a table's sheet keeps the full width,** as built (the screen's width, up to 1,024 px). The tablet frames stand as drawn (TS4, TS7, TS8) | Nothing changes: T4 of retest 4 (06, the Sheet's Table variant) stands | Asked "On a tablet, should a table's sheet be narrower than the full screen?": "Keep full width" |

With cts-7 the columns stay as built: a table takes two columns on a tablet from 24 rows, so a 20-row table is one column (m5b-long-tables, 2026-11-09). His answer was about the width; nothing was asked of the columns and nothing changes.

### Ruled the same evening (the plan's ⚑ 1 and ⚑ 2)

Asked by the driver at Francis's evening sitting (`../notes/sitting-2026-11-19-evening.md`, rows 13 and 14).

| Id | Ruling | Against what stood | His words |
|---|---|---|---|
| cts-8 | **The trinket's table and a kindred's roll at a level take cts-2's format too, whatever their length:** a tap marks, "Take it" takes. No frame of their own: TS5's format | Widens cts-2 beyond Looks and manner's describing tables; as built a trinket table or roll at a level of 12 rows or fewer took on the tap | Asked "Do the trinket table and a kindred's roll at a level use the same mark, then "Take it" format?": "Yes, same format" |
| cts-9 | **Latest wins between typed words and a marked row.** Marking a row after typing moves the mark to the row and leaves the words in the box, unmarked; typing in or tapping the box moves the mark back to the words; "Take it" takes what is marked; Clear takes off a typed answer as it does a row | Not drawn; the designer's thought in the plan's ⚑ 2, now ruled | Asked whether the row or the typed words win (explained: latest wins, or typed words win): "latest wins" |

## The frames approved

All eight, 2026-11-19. The phone frames carry the fixes of cts-5; the pictures were rendered again (page 24 at commit `c3f4f7c3` on `design-creation-table-sheet-mockup`; pictures `creation/final/png/24-TS…`).

| Frame | What it shows | Ids | His words |
|---|---|---|---|
| TS1 | Gear with the pick table closed, on a phone: nothing taken, two taken, four taken with the toast, a very long list | cts-3 | "Approve with fixes" |
| TS2 | The sheet over Gear on a phone: 20 rows, "pick up to 4" reached, the foot in view | cts-1, cts-5 | "Approve with fix" |
| TS3 | The sheet's states: nothing marked, two marked, a fifth tap at the limit | cts-1, cts-5 | "Approve with fixes" |
| TS4 | The same sheet on a tablet | cts-1, cts-7 | "Keep full width" |
| TS5 | Looks and manner on a phone: a short table beside a long one, in one format | cts-2 | "Approve with fix" |
| TS6 | A short table's states (nothing marked, a typed answer, opened again) and the step once closed | cts-4, cts-5 | "Approve with fixes" |
| TS7 | The short table on a tablet | cts-2, cts-7 | "Keep full width" |
| TS8 | The long table on a tablet | cts-2, cts-7 | "Keep full width" |

## Not ruled

- The plan's ⚑ 1 and ⚑ 2 were ruled the same evening: cts-8 and cts-9 above. A long field's table on Who they are was not asked; it already marks and confirms (it is long), and its roll line's words are the plan's ⚑ 7.
- Who they are's folded short lists (a liege: rows with an ⓘ and Pick) are pick rows with entries, not this table. They stay as they are.
- The name table ("Use this name") and a kit's rolls (Next) keep their own confirms, as cs-15 has them.
- Every button carrying an icon (ic-1) is not applied to creation here; creation's buttons are plain words, as approved on 13 November (cs-40).

## Honest notes

- The designer did not see Francis's answers; the driver relayed them, with the frames each covered and his words.
- The phone frames were approved before the three fixes were applied; he has not seen the corrected pictures. He answered the tablet question after seeing TS7; the driver's relay does not say he opened TS4 and TS8, which are the same sheet at the same width.
- Measured on page 24 with the mockups' measuring script (the frames' contents have not changed since): no contrast failure in light or dark, nothing under 14 px, no target under 44 px. Larger text, offline, loading and a failed "Take these" are not drawn; the last three are unchanged from the build.
- A pick table of 50 rows or more would take the range bar in its sheet, and "pick up to 1" one mark with "Take it": neither is drawn.
- Nothing visible is built from this file alone: the plan names page 24's frames and this date (Mockups first, 2026-11-12).

Docs to update: done with this file (see `absorbed-into`). The gate list's lines on Gear's pick table (`docs/testing.md`) are the designer's to bring in line when the row is built.
09 lines: 2026-11-19 — [ui] creation's pick tables open as a pop-up sheet and every table of Looks and manner takes the Backgrounds format (cts-1 to cts-6) — Francis, from the phone frames of mockup page 24. 2026-11-19 — [ui] a creation table's sheet keeps the full width on a tablet (cts-7) — "Keep full width".
