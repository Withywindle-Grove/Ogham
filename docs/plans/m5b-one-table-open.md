# Plan: m5b-one-table-open (2026-11-09)

Ruled by Francis via Design, relayed to the builder in the task brief (no separate rulings file). About 30 minutes, no migration.

## The rule

A creation step whose content is a single table or trait list starts with that list open, never collapsed (a pack's backgrounds step, a sign step, any pack's one-list step). Tables that sit beside other content stay collapsed, as R3-4 has them: Who they are's short tables, Gear's picks.

## How

- "The step holds only one list" is decided from what the step renders, not from pack names. The trait-list step (`TraitListStep.tsx`) always renders exactly one list (plus the Other… row, which is not a list), so it passes `alone` to `TableFold`.
- `TableFold` (`src/ui/creation.tsx`) gains `alone`: it starts open; without it, open only with a pick inside (unchanged).
- Who they are (`Characters.tsx`) and Gear (`StartingGear.tsx`) are unchanged: their tables sit beside the name, hit points, coin and kits.
- The fold row stays (it names the count and the pick), and a tap still folds the list shut.

## Tests (purpose first; invented pack data)

- A one-list step (the fixture's backgrounds step) renders its rows without a tap (`kindredTables.test.tsx`; replaces the R3-4 test that asserted it folded).
- A step with two tables (Gear with two given picks) keeps both folded (`kitLines.test.tsx`).

## Docs

06 (Table fold variant; the trait-list step's row), a 09 line.

## Gallery

No gallery picture shows a trait-list step, so no baselines change.

## ⚑

None.

## Departures

- No plan file existed when the step was handed over; this one was written by the builder from the brief, in this pull request.
