# Pack review area 2 fixes (2026-11-03)

**Source:** the independent re-check of pack review area 2 (2026-11-03), Francis's list of app issues, items 1, 2, 3 and 5. Technical only: tolerance in how the app reads a pack, and warnings in `pack:check`. No design change, no migration, no new screen. Branch `m5b-review-area-2-fixes`.

**Not here:** item 4 (`onlyWhen`, ST4) is a scope question for Francis: the settlement set (ST1–ST12) has no M5b build plan.

## Build order

1. **Speed from numbers.** `src/modules/inventory/encumbrance.ts` reads a weight tier's `movement` and an armour row's `withoutTreasure` / `withTreasure` as text or a whole number (`30` is read as `"30"`), so `speedOf` gives the travel budget a speed. Test: "a setting whose weight tiers give movement as the number 30 gives the travel budget a speed of 30."
2. **Next-table lookup.** `nextTableId` (`src/modules/expedition/tables.ts`) matches table ids whatever their case and drops a trailing marker (`*`, `†`, `‡`) from the result. The `known` argument becomes a `TableLookup` (`tableLookup(ids)`) that returns the table's own id, so the case-folded match opens the right table; the three screens that use it (`EncounterTables.tsx` twice, `GmReference.tsx`) build it from their tables. Test: "a matrix cell 'B-Animal' with pattern 'wild-{result}' opens the table 'wild-b-animal'."
3. **Encounter column pre-pick.** `pack:check` notes an `onHit.columns` label, or a terrain's `encounterColumn`, that isn't a column of the table it picks from (the terrain's `encounterTableId`, else the mode's check tables). The app's fallback (the first column) is unchanged.
5. **`pack:check` notes.** A number-valued `movement` (tier) or `withoutTreasure` / `withTreasure` (armour row): the app reads it, text preferred. A `nextTablePattern` whose filled-in ids aren't tables in the pack, matched the way the app matches (it uses the app's own `rowLeadsTo`).

The checks live in a new `scripts/pack-links.mjs` (tested in `scripts/pack-links.test.mjs`), called from `formatNotes`. Sample pack: `scripts/fixtures/m5b-review-area-2.fixture.json` (invented).

## Departures

- Item 2 is tolerance only, no design change (the coordinator's reading, technical): the app already opened a table named by a result; it now also finds it when the case differs or a footnote marker trails.
- Item 2's `known` changed shape (a lookup returning the id, not a yes/no), because a case-folded match must open the table under its own id. Three call sites changed by one line each; no screen looks different.
- The note for a terrain's `encounterColumn` with no `encounterTableId` of its own checks the mode's check tables and speaks only when none of them has the column (the column could be meant for any of them).
- Tables this file doesn't hold, and tables with fewer than two columns, are left alone by the column note (another attached pack may hold them; a one-column table has no pick).
- 07 gains two sentences saying what the app now reads (a number for movement; ids matched in any case, a trailing marker dropped) and what `pack:check` notes.
- **G-114** (docs/11; `design/notes/area-2-exploration-review-2026-11-03.md` §10, item 11): item 2 is also G-114's app side, fixed here (ids matched whatever their case, a trailing "*" ignored; test: a result "Fen-Beast*" leads to "next-fen-beast"). The city / settled split (one result, two tables by terrain) stays open for the designer. G-114's row is on PR #350, not yet on main, so its status line wasn't changed here: whoever merges second updates it.
