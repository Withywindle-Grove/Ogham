# Plan: creation tables from any pack (G-201, G-192)

Written by the design agent, 2026-11-06. Ruling: `docs/design/rulings/m5b-creation-tables-2026-11-06.md` (ct-1 … ct-8). Francis's priority: second, after the players' creation test and before the gate's places slice. This file makes no rulings. Opus, medium; no migration.

## What this step delivers
1. **Slots on `uses`** (ct-5): `creation.names`, `creation.details`, `creation.trinket`. `kindredTables` falls back, slot by slot, to any attached pack's table that names the slot when the chosen race has none; the GM's pack order decides between packs.
2. **"Optional · from <pack>"** (ct-6) on Roll a name, the trinket and each Details row that came from the fallback; Next never checks them (as today for Details).
3. **`join` on a name table** (ct-7): read with the table (default a space), used when tapped name parts are put together at creation and when the GM's Tables show a rolled row of a table that has it.
4. **`pack:check`:** knows the creation uses; notes an unknown use; notes a creation-slot table without `"gmOnly": false` (players couldn't read it); knows `join`. 07's registry row.
5. **Careers through the pack's optional rule** (ct-8): only what the answer to ⚑ 1 leaves to build.

## Already built (the builder's read of main 677fdd6a)
`kindredTables(race, tables)` (`kindredTables.ts`) reads `race.tables` only; five call sites (`Characters.tsx` ×3, `StartingGear.tsx`, `KindredTables.tsx`); UI in `NameRoll`, `DetailsStep`, `OneTableSheet`. Nothing in `src` reads a table's `uses`; the registry is only in 07. Tapped name parts join with a space in `nameFrom`; the GM's Tables use a separate path (`rowText`). The Details step shows four rows then a folded "N more"; a tap opens one table with a go-to-number box. A trait list is asked at creation only when a visible sheet field points at it (`traitSteps`). The app never rolls.

## Tests (purpose first)
- A race with no tables of its own is offered an attached pack's names, details and trinket, each marked optional with its pack.
- A race with its own names keeps them and still gets the pack's details.
- Two packs offering one slot: the higher in the GM's order wins.
- Next goes on with every offered table untouched.
- A two-column name table with `join: ""` gives one word at creation and in the GM's Tables; without `join`, a space.
- A player's device can read a creation-slot table marked `gmOnly: false` and no GM-only table (database test as a player).
- 375 px: the labels wrap; rows 44 px.

## Scope checks (write one and stop)
No rolling by the app. No typed-over details. No change to a race that has its own tables. Nothing from the creation layout rework.

## ⚑
1. **ct-8's shape (to the pack session and the builder, then Francis):** can a Homebrew pack with no `requires` and no rules set carry an optional rule that gates a sheet-layout field pointing at its own trait list, so that the existing `traitSteps` asks it and the sheet shows it, with no new code? If yes, careers are pack work. If no, what is missing?
2. **ct-8's default:** on or off when the pack is attached.
3. Where the Career field sits on the sheet (the setting's own groups, by the layout; the sheet's order is ruled in `plans/m5b-sheet.md`).

## Estimate (the builder's)
Slots, fallback and label: 12–16. `pack:check`: 3–4. Tests: 5–7. `join` on both paths: 5–6. Careers as a new kind of step: 8–12, or about none if ⚑ 1 is yes. **Total 25–33, up to 45.**

## Departures
(The builder keeps this current in the same pull request.)
