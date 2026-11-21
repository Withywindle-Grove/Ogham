# Plan: table rows of every shape (fix branch)

Found by the pack session's fourth re-check, 2026-11-04. **M5b**, one pull request on `fix-table-row-shapes`, no migration. Tests first (bq-6): the failing tests marked `it.fails` on their own commit, then the fix removes `.fails` and changes nothing else in them.

## The bug
The table screens (the GM's tables screen and Which table?, Tables ›, the GM reference's Tables, the table pop-up that reads a typed roll) read a row's words only from `result`, `value` and `results` (`readRow`, `src/modules/expedition/tables.ts`), and a row needed a range or a composite key. So:
- lookup rows `{ key, values }` and non-range `{ key, value }` were dropped: 66 of the 876 tables in the private packs showed nothing (they weren't listed at all), and 5 more lost some rows; 15 of the 71 are treasure tables;
- matrix rows whose `level` is words ("Scant", "No fire, no bedding", "2 or less") were dropped too (counted in the 71);
- a rolled row's `cells` showed as its joined `result`, with column chips that changed nothing; `items` were never read.

## What 07 allows (tables, and tables (new shapes))
Plain `{ min, max, result }`; composite `"key": "3/7"`; matrix `{ level, results }` with `columns`; lookup `{ key, value }` or `{ key, values }`; rows' `spells`, `tableId`, `group`, `note`; table-row `items` (the kit line's shape; 07 Gear, "only its rows with `items` are offered"). `cells` is not in 07; it is the shape the pack session proposed for name tables (`design/notes/pack-ruled-shapes-2026-11-03.md`, "`cells` follows `columns`") and creation already reads (`kindredTables.ts`).

## Fix
- `readRow` reads every shape: a lookup's key, or a matrix row's level, that isn't a range becomes the row's `label`; `cells`, or a lookup's `values`, become the row's `cells`; `items` are read (a line's `name`, else its `itemId`, and `qty`).
- **`rowText(table, row, column)`**, the one reader of a row's words: a matrix's result in the column picked (all, joined, when none is or the table names no columns); else the cells, each under its column header ("First name: Brindle · Surname: Ashcombe"); else the result; else the item list ("Reed lantern ×2, Wick"); "—" when nothing. `TableRows` (every screen above) and `rowFor` (the typed-roll pop-up) both use it, so the log and the toast say the same words.
- **`pickColumns(table)`**: column chips only for a matrix (rows with `results`); a table whose columns head `cells` or `values` shows no chips.
- `rowLabel` returns the label; `TableRows` draws a label in words in the variant `table-rows__range--key` (body size, wraps, at most 40% wide) so a long key can't push the row sideways at 375 px.
- Go to number shows on a long table only when a number can find a row (a lookup by key has none).

## Tests (`src/app/tableRowShapes.test.tsx`)
- A lookup row `{ key, value }` shows its key and its value.
- A lookup row `{ key, values }` shows its key and every value under its header, with no column chips.
- A rolled row with cells shows one cell per column with its header, and no column chips.
- A row with items and no words shows its item list.
- The real packs (read in place from `packs/_current`, or `PACKS_DIR`; skipped when absent): no table renders a row empty, and no row is left out. **Still marked `.fails`**: see Departures.

## ⚑
1. The real-pack test's one edit (Departures 1).

## Estimate
3–5 turns.

## Departures
1. **The real-pack test stays `it.fails` (needs Francis's OK to change it).** It counts a row showing "—" as empty. After the fix, all 876 tables in `packs/_current` read every row, and one row shows "—" because the book prints a dash there: zine-compendium's "Arms and armour cost by material", row "Dominant: bone", column Bone (the same material, so no change in cost). That's the book's words, not an empty row. On a fix branch the guard allows only removing `.fails`, so the test can't be corrected here. Proposed one-line change, on Francis's word (or in a non-fix follow-up): count only rows with no words (`''`) as empty, not "—". Until then the test reports "expected fail" locally (CI has no packs and skips it). The zero count was checked by a scratch script with the same reader: 876 tables, 0 empty, 1 book dash.
2. **Items when a row has words.** Every row with `items` in the packs also has `result` (the item's name), so `items` show only as the fallback when a row has no words, and by a one-off's `name`, else the `itemId` (the screens have no item list to look names up). Showing the item list beside a result would be a design change; not done.
3. **Two small layout guards beyond the brief:** the `--key` label variant and Go to number hidden for a lookup by key (both above). Without them a long key scrolled the row sideways and Go to number could never find a row.
4. **Pack notes for the pack session (no app change):** `dc-speak-with-dead` (deathcaster) gives `columns` as one string ("Time Since Death") instead of a list, so its values show without headers; `zc-i2-haggling` and several lookups write ranges as "2 or less" / "6 or lower", which 07's ranges ("2", "3–4", "8+") don't cover, so those rows show and are tappable but a typed roll can't find them.
