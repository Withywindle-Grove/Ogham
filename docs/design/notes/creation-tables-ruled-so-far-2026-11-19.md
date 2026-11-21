# Creation's tables, sheets and pop-ups: ruled so far (2026-11-19)

Compiled before drawing mockup page 24 (`creation/final/24-table-sheet-and-one-format.html`) for the intent `../../intents/creation-table-sheet-2026-11-19.md`. One row per ruling in force, newest word on each part, with its source. `09` is `docs/09-decisions-log.md`; `06` is `docs/06-screens-and-design.md`. A working sheet: it rules nothing.

**Since ruled (2026-11-19):** the first three items under "Not settled" and the intent's questions are answered in `../rulings/dec-creation-table-sheet-2026-11-19.md` (cts-1 to cts-7); the build is `../../plans/creation-table-sheet.md`. The tables below are the state before that ruling, as the page was drawn from them.

## Creation's tables

| Part | In force | Source |
|---|---|---|
| The table's look | A table a player rolls on and taps takes the book's table style, each row still a tap; a table's parts are the two-sided switch; a number the character can't take stays as a muted row with its reason | cs-7, Francis, 2026-11-12 (`../rulings/dec-creation-sweep-2026-11-12.md`; 09, 2026-11-12 `[ui]`) |
| Mark, then confirm | On a long table a tap marks the row and one button at the foot confirms: "Take it"; a pack's pick-up-to-N table, "Take these". Nothing is taken at once; the ✕ closes with nothing taken; per-row Pick buttons and "Done" go. A kit's rolls keep Next | cs-15, Francis ("B"), 2026-11-12 (same ruling; 09, 2026-11-12 `[ui]`) |
| What "long" means | More than 12 rows, as built (`isLong`). No ruling gives the number; 06's Table sheet row records it | 06, Table sheet row; `src/modules/characters/kindredTables.ts` |
| A short table today | A list with Pick on each row; a tapped row on a short detail table closes its sheet. No mockup shows a short table in the book's format | 06, Table sheet row; the intent |
| The same row twice | A pick-up-to-N table allows the same row more than once (one ✓ a time, − puts one back; the count counts picks) | R3-8, Francis, 2026-11-08 (09, 2026-11-08 `[ui]`) |
| The typed roll | "What you rolled", a box and Show, on any table sheet with a die; the range bar from 50 rows only; two columns on a tablet from 24 rows | 09, 2026-11-09 `[ui]` (m5b-long-tables); on a phone the strip may be three lines (lt-1, 09, 2026-11-14 `[sheet]`) |
| The row is the tap | No typed number is needed: the row is the tap | Francis, 2026-11-07 (06, Table sheet row) |
| The player's own words | A describing table's sheet offers "Or type your own" at its foot; its row on the step then reads "Rolled 7: …" or "Typed: …", with Change | final drafts D (06, Table sheet row; `src/app/KindredTables.tsx`, `filledWords`) |
| Where a table opens | Tables beside other content (Who they are's short tables, Gear's picks) stay folded in the page; a step that is one table starts open | m5b-one-table-open, Francis via Design, 2026-11-09 (09, 2026-11-09 `[ui]`). **The intent changes this for Gear's picks** |
| Gear's rows | A pack's pick table under its own heading with one state line; the trinket's row naming whose table it is, with Open; the shop as a row with Open; no roll row over a row that only opens a table: the die is named in the table's sheet | cs-22, the lead, 2026-11-12 (`../rulings/dec-creation-sweep-2026-11-12.md`) |
| The accent while marks wait | "Take these" is the screen's one accent while marks wait; marks the same as what is taken do nothing and say nothing | cs-42, cs-43, the lead under cs-30 (09, 2026-11-14 `[sheet]`; `../../plans/dec-10-creation-sweep.md`) |
| A blocked tap | A tap that can't do what was asked answers in one sentence, as a toast: "Tap a row first.", "2 of 2 marked: take one off to mark another." | cs-27, cs-50 (06, Creation step shell row) |
| The fold mark | In creation the chevron, down folded and up open; "+" means add. One mark app-wide (+ and −) only after 5 December | cs-9, Francis, 2026-11-12; 09, 2026-11-18 `[words]` (pl-1 amended) |
| Creation as built | Creation in the book's type is approved as built | cs-40, Francis, 2026-11-13 (09, 2026-11-13 `[ui]`) |
| Explaining lines | Creation keeps its explaining lines; the rest of the app drops them | tfw-2, Francis, 2026-11-19 (09, 2026-11-19 `[words]`) |
| His fixes on the fold (#991, not on `main`) | "Take these" closes the table; the row names what was taken ("3 of 3 picked: Reed rope, Eel hooks ×2"); coming back, the table starts closed | Francis, 2026-11-18, in pull request #991's text |
| The fold does not go live | Creation's long tables wait for the sheet | Francis, 2026-11-19: "Wait for the sheet" (the intent) |

## Sheets and pop-ups

| Part | In force | Source |
|---|---|---|
| The sheet | Slides over the dimmed page from the foot on a phone (under 700 px: full width, top corners rounded, at most 90% of the height); on a tablet it opens beside the button that opened it. ✕, Escape or a tap outside closes it. Never opens the keyboard | A7, final drafts A, 2026-11-07 (06, Sheet row) |
| A table's sheet on a tablet | Takes the screen's width, up to 1,024 px | T4, retest 4, 2026-11-09 (06, Sheet row, variant Table) |
| One Close | A bare ✕ at the top right; a sheet with an ✕ has no Close button of its own | tf-8, 2026-11-03 (09, 2026-11-03); mc-43a (06, Sheet row) |
| An ✕ or buttons | A pop-up has an ✕ or buttons, never both | cs-27, the lead, 2026-11-12 |
| The foot | Buttons right-justified as a group, side by side in code order; a lone accent at the right at its own width; they stack only when they don't fit | ft-1, 2026-11-14 (09, 2026-11-14 `[ui]`) |
| One height in a row | Controls side by side in one row share one height | one of p2p-16 to p2p-20, Francis, 2026-11-18 (09, 2026-11-18 `[ui]`) |
| A pop-up from a sheet | A pop-up opened from inside a sheet keeps its own form | cm-1, Francis, 2026-11-15 (09, 2026-11-15 `[process]`; root `CLAUDE.md`) |
| Calm UI | Never a disabled button; Undo over confirm; one accent a screen; colour alone carries a distinction only where its mockup shows it with the hue taken away | root `CLAUDE.md`, hard rule 7 (relaxed 2026-11-12) |
| Mockups first | Nothing a person can see is built without a mockup Francis approved; a ruling in words is not an approval of a screen | 09, 2026-11-12 `[process]` |
| The book's format and the stylesheet | Nothing is put to him unless it carries both, verified as fact; every mockup page links the one shared stylesheet and restates none of its rules | pq-1, ms-1, 2026-11-14 (`../rulings/dec-afternoon-2026-11-14.md`; 09, 2026-11-14 `[process]`) |

## Not settled (collected, not decided)

- ⚑ The intent's three: which tables open as a sheet; whether a short table marks then confirms; what the step shows once the sheet is closed.
- ⚑ A typed answer on a table that marks and confirms: as built it is kept as it is typed, with no confirm.
- ⚑ (technical) Two columns on a tablet start at 24 rows; a 20-row table is one column.
- ⚑ From #991's text, never ruled: whether a fourth thing is named or the row shows three and "…".
- Every button carries an icon, app-wide (ic-1, 2026-11-14, said for the Scene, the Player screen and magic). Creation was approved as built with plain word buttons the day before (cs-40); the sweep decides when it reaches creation. Page 24 draws creation's buttons as built.

## Where the specs would move if he approves

06: the Table sheet row (a short table closes on a tap; long by `isLong`), the Fold row row (it lists `PickTableFold` among creation's folds), the Tapped table row (where it is used). 05: creation's Gear and Details. Nothing is changed before he approves.
