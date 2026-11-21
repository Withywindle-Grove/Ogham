# Plan: M5b step g3 — encounter tables, full screen (B2)

Written by the design agent, 2026-11-01 (M5 gate B2 ruling). Read the specs it names; this file makes no rulings. Opus, medium. **Absorbs the table-pick half of the old `m5b-2-encounters.md`**; the Encounter waiting queue stays there.

## What this step delivers
A Hit opens **Which table?** full screen (one flat list: session pins, then the candidates with the likely one first, then the rest; each row name · why · die · description); tapping a row opens **the table** full screen; **tapping the rolled row is the result**; nested tables, Go to number, column chips only when the setting's tables have columns; **pins per session, set in prep**; the Explore row "Encounter tables · Abbey likely · 1 pinned ›". No Enter roll anywhere.

## Already built (verify first)
`EncounterTablePanel`, `CurrentTableRow`, `TableRoll`, `readTable` / `rowFor` (M5 steps 6, 10); the candidate order of D12 in 05.

## Rests on
- 05: *Encounter tables, full screen* (B2); *Which table a hit rolls* (D12 order); *After Hit*.
- 06: *Encounter tables (full screen)* row; *Explore*; `design/mockups/m5-gate/b2-encounter-tables.html`.
- 07 tables: `description` (G-44), rows' `note`, stat blocks' `description`; `pack:check` warns when either isn't text (the small builder item on the board).

## Build order
1. **Which table?** screen: list builder (pins → D12 candidates → rest → All N tables ›), rows with the why-tag and description; Back returns to the console with the hit still open.
2. **The table** screen: header (name, die), rows range · result · description at every level (row `note`, or the stat block's `description`); tap = result (logged Simple, Undo); nested table opens with breadcrumb; Go to number for tables over 20 rows; column chips when `columns` exist, pre-picked from the route.
3. **Pins:** a session-scoped list on the session record (ends with the session); the pin button only in the Tables › library; pins made before Start session belong to the next session.
4. **Explore row** replaces `CurrentTableRow`; opened without a hit, a tap is "rolled by hand" (logged, Undo).
5. **Remove** Enter roll… and the old panel; Weather table variant keeps working (it picks a table, no roll).

## Tests (purpose first)
- The list order is pins, then D12's order with the suggestion first, then the rest.
- Tapping a row logs the check's result and Undo removes it.
- A nested row opens its table and the breadcrumb reads "Abbey › Mortal".
- Chips appear only for a table with columns and start on the route's column.
- Pins vanish at End session and reappear nowhere.
- 375 px: rows wrap, the Go to number box stays reachable (layout test).

## Scope checks (write one and stop)
- No fight start from a row (M6 adds Add foes).
- No per-campaign pins.
- No automatic rolling.

## ⚑ for Francis (ask at the start)
None.

## Estimate
20–25 builder turns. Independent of g2, g4, g5.

## Departures
(The builder keeps this current in the same pull request.)

1. **Pins live in their own GM-only table, not on the session record** (technical). `sessions` is readable by every member, and pins made before Start session have no session yet. `table_pins` (GM-only by row-level security) holds them; a pin counts while no session (not undone) has ended since it was made (`public.table_pins_now`). So pins made between sessions belong to the next one, pins end with their session, nothing is removed at End session, and undoing End session brings them back.
2. **A row tapped without a hit needs a record**: new GM-only table `table_reads`, command `tables.readByHand` (Simple). With a hit, the tap is the existing `check.setRoll` (Simple), the row's range as the roll and "Abbey › Mortal: Pilgrims · 1d6" as the row text.
3. **Log levels not ruled**: `tables.pin` and `tables.unpin` are Verbose (prep, not play), GM-only lines. The log has no table names, so a pin reads its id in words ("lower-abbey" → "Lower abbey").
4. **Why-words**: D12 names no words beyond the mockup's examples. Used: "this place", "this terrain", "this region", the season's name (a special season's swap), "this check" (the check's own onHit, including a GM reminder's table). "From the adventure" waits for adventure places (M8b); "this level" needs a level source (not built).
5. **Tables › shows for the GM whenever Scene is open**, not only during an expedition: pins are made before Start session, when there's usually no expedition yet.
6. **The library is for reading**: a table opened from Tables › has rows that aren't buttons (nothing recorded); a row leading to another table shows that table as a link under the rows. Only Explore's row and a hit record taps.
7. **Hit card kept**: Which table? opens by itself on a hit when the check has candidates (or is an encounter check) and the setting has tables. The small hit card stays on the console with "Rolled: …", **Encounter tables ›** (open again), Reveal to players, Send to players… and Done. A check with only a note shows its note there and doesn't open the tables.
8. **Column with no route known**: the terrain's column, else the first the check names, else the table's first column. Route types (travel) arrive in M8b.
9. **Go to number** shows on tables over 20 rows; it moves to and focuses the row (it records nothing).
10. **The Weather table variant** no longer uses the old panel: a ButtonRow pick of the weather tables and the typed roll (`TableRoll`), as before. `TableRoll` moved to `EncounterTables.tsx`; `EncounterTable.tsx` is gone.
11. **Not in the component gallery** (no gallery baseline change); covered by four new layout scenes at every size and a 375 px block.
