# Intent: one module for "Undo my last change"

Author: architecture pass 1 (loop step 7), from Francis's rulings · Date: 2026-11-28 · Status: accepted (arch1-1, Francis: "A")

## Problem
A toast's Undo is written out in 29 files, 37 times. Each copy finds the person's newest change of a kind, undoes it, picks the words and refreshes. The look-up (`latestChange`, `src/core/undo.ts`) answers "none" when the read failed, so a network fault shows "Nothing to undo." That is false.

## Outcome
One module does the work once. A screen asks it to undo the person's newest change of a kind. The module answers with one of three endings: undone, nothing to undo, could not check. The screen keeps only its own words and its own refresh.

Nothing a player or GM sees changes. No stored data changes.

## Touches
- `src/core/undo.ts`: the module and its three-way answer (arch1-4).
- The 29 calling files in `src/app/` and `src/modules/` (`grep -rl "latestChange(" src`).
- No migration, no permissions, no events, no command added.

## Constraints
- Mockup: none: data and logic only.
- Each screen shows the words it shows today, on every ending (arch1-2). The callers differ: 22 show "Nothing to undo.", 5 answer "There was nothing to undo.", one shows "Couldn't undo that. Check your connection and try again." Each keeps its own.
- The module makes its own small three-way answer. It does not wait for a general answer for reads (arch1-3).
- Hard rule 3: the undo still runs through `runCommand` and `undoChange`.

## Tests
- New: the module's own tests, one per ending, with a read that fails.
- Kept unchanged: every screen test that taps a toast's Undo. They must pass as they are.
- Deleted: none.

## Tickets (about 3)
1. The module in `src/core/undo.ts` and its tests. No caller moves.
2. Move the first half of the callers (about 15 files).
3. Move the second half. `latestChange` stops being called from a screen.

Tickets 2 and 3 share no file and can run side by side after ticket 1.

## Out of scope
- New words for "could not check" (a ⚑ in `docs/10-open-questions.md`; its own small ticket after a design ruling).
- The log's own Undo on a log line.
- A general three-way answer for every read (architecture pass 1, candidate 3).

## Ruling
`docs/design/rulings/arch-pass-1-2026-11-28.md`, arch1-1 to arch1-4.
