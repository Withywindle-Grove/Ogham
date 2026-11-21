# Cloud brief: a save modifier that reads a kindred's field alone (logic only)

First read `docs/plans/briefs/README.md`. Then read this whole brief. If anything is unclear, stop and say so in the pull request; don't guess.

Written by the lead on 2026-11-14. Branch: `save-modifier-kindred-field` (pushed empty from main). One pull request, logic and tests only: no screen, no component, no CSS, no migration, no pack edits.

## The objective
A rules set's `saveModifiers` entry may give its `value` as `{ "raceField": "<field>" }` (pf-21): the number in that field of the character's kindred, alone. Today the reader knows two shapes only (`{ fill }` and `{ from: <score>, plusRaceField: <field> }`), so a modifier written the new way shows nothing.

## Read
- The ruling pf-21 in `docs/design/rulings/dec-player-screen-2026-11-14.md`.
- `docs/07-content-packs.md`, `saveModifiers` ("shown beside the saves, never added in").
- The reader in `src/` that turns a save modifier's `value` into what the sheet shows (it handles `{ fill }` and `{ from, plusRaceField }` today; find it from `saveModifiers`), its tests, and `pack:check`'s rule for the key.

## What to build
1. The reader accepts `{ "raceField": "<field>" }`: the value is the number in that field of the character's kindred. A kindred without the field, or with nought there, gives no line for that character.
2. `pack:check` accepts the shape, and notes a `raceField` that no kindred in the checked stack carries.
3. `docs/07-content-packs.md`: one or two lines beside `saveModifiers` with an invented example. Mark pf-21.
4. Nothing else: the two existing shapes behave exactly as before; a save's number is never changed by a modifier; which rules set's `saveModifiers` is read is not touched.

## Rules
- Invented names only ("Marsh-born", "vs hexes"). No real game, book or adventure names, no numbers from a book.
- Hidden means hidden: nothing new is sent to anyone.
- No new dependency. Integers.

## Tests (write each test's purpose as a plain sentence first)
- A character whose kindred carries the field with a number sees the modifier beside the save, with that number and its sign.
- A character whose kindred lacks the field, or has nought there, sees no such line.
- The save's own number is the same with and without the modifier.
- The two shapes read today still give what they gave (existing tests untouched).
- `pack:check` accepts the shape and notes a field no kindred carries.

## Output
One pull request with its status file `docs/status/<date>-save-modifier-kindred-field.md` and `docs/testing/save-modifier-kindred-field.md`. Do not merge. A cloud session other than you reviews it (rv-3). One push when finished.
