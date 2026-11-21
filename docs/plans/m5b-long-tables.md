# Plan: m5b-long-tables (long describing tables in a sheet, 2026-11-09)

Francis's creation retest 4 (2026-11-09): the groups of 25 "look sparse" and the sheet "can be wider". Design drew four ways (`docs/design/mockups/creation/final/13-long-tables.html` on `design-gate-m5b-walk`), and the ruling is **option B with C's field**. Branched from `m5b-retest-4-fixes` (#570), which made every table sheet the Dialog variant `table`. #567, #568, #569 and #570 merge first; `origin/main` is merged in before the push if any has landed.

No migration.

## The ruling, as relayed by Design

1. A long describing table in a sheet takes the full tablet width, in **two columns**.
2. A **range bar** (1–25 … 76–100) scrolls the list to its range without hiding the rest, and it **stays at the top** while the list scrolls.
3. A **typed-roll field** at the top filters to the row the number falls in. Whole numbers only: "37" means 37, never 3. Ranged rows are honoured (a row covering 31–40 matches 37). A number no row covers shows a plain line saying so, and the number stays in the field.
4. The **folds of 25 go**.
5. On a phone, follow the mockup: one column, the same bar (it wraps to two lines) and the same field.

### Round 2 (Design on #571, 2026-11-09)

6. **⚑ 1, yes:** name tables get the same bar and box. One table sheet for both; the fold-by-25 goes everywhere, `NameTableSheet` included, with its code paths and tests.
7. **The ranges go by the number of rows, not the die.** No bar under 24 rows. Otherwise the rows split into bands of about 25 rows each, each labelled by the die values it covers ("1–25", "26–50" for a d100 with a row per value; "1–40", "41–80", "81–100" for ranged rows). No band ends up with two or three rows.
8. **The box is sticky too**, above the bar: it's the main way in.

### Round 3 (Design on #571, 2026-11-09)

9. **The bar only from 40 rows**; 24–39 rows scroll fine in two columns. From 40, bands of 25–40 rows.
10. **The typed box doesn't depend on the bar**: any table with a die has it (the 15-row d30 trinket too), the fast path for a rolled result. Only the bar has a threshold.
11. **Phone:** the strip is the box and the bar, one line each: the box 88 px wide with **Show** beside it, the bar a single-line horizontal scroller; no helper line inside the strip; "Whole numbers only" and the no-row line only when needed, under the strip.

### Final round (Design on #571, 2026-11-09)

12. **The bar starts at 50 rows**, with bands of 25–40 from there; 40–49 rows just scroll. The Departures are accepted.
13. **At Large text** the phone's line may wrap to two lines, as long as the box and Show stay together on one line: one group that never wraps.
14. **The title drops ": roll dN"** on every describing or name table sheet: the Roll row under it owns the die ("Reed trinkets", not "Reed trinkets: roll d100").

## How it's built

- **Which tables:** a describing table opened in its sheet (`OneTableSheet`: Details, Gear's trinket, Who they are's field from a table) whose die reaches past 20, the same line the folds used (`topOf`). A d20 or shorter is unchanged: one list, no bar, no field.
- **Named variant, not a copy:** `TableSheet` (`src/ui/creation.tsx`) gains the **long variant** (`long`): the Roll row, then "What you rolled" (the same field as `RolledNumber`, `inputmode="numeric"`), then the range bar (`ButtonRow`, the bar's ranges from `rowGroups`, which stays), then the rows as `PickRow`s, one block per range. On a tablet each block lays out in two columns (column-first, so 1–13 run down the left and 14–25 down the right); on a phone, one. Recorded in 06's Components (Table sheet row) with its Code.
- **The bar:** `position: sticky` at the top of the sheet's scroll. A tap scrolls the sheet so the range's first row sits just under the bar; the tapped range shows pressed. A tap while a number filters the list empties the field first, so the whole table is there to scroll.
- **The field:** filtering only, on the device: it writes nothing and starts no command, so no busy check is needed. Digits only ("37" is 37; "3.5", "3a" say "Whole numbers only."). The match is the row whose range holds the number (`rowFor`). While it matches, only that row shows, and the line under the field says so; no match says "No row has 140." and the whole table stays.
- **Opening with a pick:** the sheet scrolls to the picked row (the folds used to open the picked row's group).
- **Folds removed** from the describing table sheet. `TableSheet`'s `fold` groups go.

## Tests (purpose first)

1. Typing 37 shows row 37, never row 3 (whole numbers only).
2. Typing 37 on a table whose row covers 31–40 shows that row.
3. A number no row covers (140, 0) shows "No row has 140." with the number kept and every row still there.
4. Tapping a range on the bar scrolls to its range and the bar stays at the top while the sheet scrolls (layout spec, real browser; the unit test checks the bar's ranges and the tap clearing the field).
5. At tablet width a long table's rows sit in two columns; at phone width one (layout spec).
6. A long table's sheet has no folds; a d20's has no bar and no field.

## Gallery

A new section, **Creation: long tables**, last in the gallery so no approved picture moves: the long table (the gallery draws it at tablet and phone width), the filtered state (37) and the no-match state (140). A button there opens the real sheet, for the layout spec. No baseline is committed; none existing changes.

## Estimate

| Part | Hours |
|---|---|
| Two columns | 1 |
| The sticky range bar | 1.5 |
| The typed filter | 1.5 |
| Removing the folds, tests, gallery and docs | 2 |
| **Total** | **6** |

## ⚑ for Francis (via Design)

1. ~~The name table sheet still folds by 25: should it get the bar too?~~ **Ruled yes** (round 2, item 6).
2. ~~Round 3: 40 to 49 rows can't split into bands of 25–40; should the bar start at 50?~~ **Ruled: the bar starts at 50** (final round, item 12).

## Departures

1. ~~Only the bar is sticky.~~ **Round 2:** the box and the bar share one sticky strip. On a phone, with the bar on two lines, the strip covers about a third of the sheet (seen in a 375 px screenshot).
2. **The bar's pressed range is the last one tapped.** It doesn't follow a scroll by hand (that would need the rows watched as they scroll); nothing hides either way.
3. **A range tapped while a number filters the list empties the field**, so the whole table is there to scroll to.
4. **Opened on a pick, the sheet starts at the picked row**, in place of the folds' "the picked row's group starts open".
5. ~~The ranges are the old fold headings.~~ **Final round:** `rowBands` gives no bar under 50 rows; from 50 it splits the rows evenly into floor(rows ÷ 25) bands, so every band holds 25–40 rows (tested from 50 to 1,000 rows). A 1,000-row table gets 40 buttons on the scrolling bar.
6. **The filtered row shows alone at the full width** (one row needs no columns).
7. ~~Phone: the bar wraps to two lines.~~ **Round 3:** on a phone the strip is two lines, the box with Show and the bar, which scrolls sideways on its one line; one column of rows.
8. **The Roll row's words are unchanged** ("Roll d100, then tap the row.", or the pack's own prompt); the field's label and line say the rest.
9. **Which tables:** the box on any table with a die; two columns from 24 rows; the bar from 50. A table with no die and under 24 rows is the plain list, as before.
10. **The name sheet:** the box filters to the open part's cell on the shown row and keeps it when the part tab changes. A row with no cell in the open part reads "No row has 37." The name sheet drawn beside the step (only the gallery draws it so; the app always opens a sheet) keeps the strip in place rather than sticking to the page.
11. **Round 2, gallery:** the `creation-who` section's 25-row Surnames table now shows the box and bar, so its four baselines are deleted for CI to redraw. The `creation-long-tables` specimen's table is now 25 rows of four (1–4 … 97–100), so it shows the bar.
12. **Round 3, Show:** with a Show button, the list filters on **Show** (or Enter), not as you type, so the button always does something; typing alone changes nothing. A shown row has **Show every row** under it (mockup C's "Browse all"), the way back now that there's no helper line saying "delete the number".
13. **Round 3, the 88 px box:** `calc(var(--tap) * 2)` (the tap token, 44 px, twice), no raw value. To fit "What you rolled", the box and Show on one line at 375 px, Show is the small secondary button (still 44 px tall) and the label doesn't wrap. At the Large and Larger text sizes the label goes above; the box and Show are one group that never wraps (final round; the layout spec checks it at Large on a 375 px phone).
14. **Round 3, the bar scrolls sideways at every width** (it only overflows on a phone, or with many bands). The gallery's real sheet is now a d200 of 200 rows (8 bands), so the phone's bar overflows and the layout spec can check it.
15. **Title fix:** only the describing table sheet (`OneTableSheet`) carried ": roll dN"; the name table sheet's title was already the table's name. The kit roll titles from `rollTitle`/`settleTitle` are left alone: no sheet uses them as a title (the kit's Roll sequence is titled with the kit's name, its step line "Step 2 of 3: Tools, twice").
