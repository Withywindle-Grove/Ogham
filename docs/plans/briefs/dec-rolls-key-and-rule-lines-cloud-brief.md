# Cloud brief: the `rolls` key and the two rule lines (logic only)

First read `docs/plans/briefs/README.md`. Then read this whole brief before touching anything. If anything is unclear, stop and say so in the pull request; don't guess.

Written by the lead on 2026-11-14. Branch: `dec-rolls-key-and-rule-lines` (pushed empty from main). One pull request, logic and tests only: **no screen, no component, no CSS, no migration.**

## The objective
Give the app what it needs to say, in one line, what a roll takes to pass, built from the pack and never typed in:
- for saves (sv-1): "Roll d20: your save's number or higher succeeds."
- for a check against a score (sv-3): "Roll d20: your score or lower succeeds."

## Read
- The rulings: `docs/design/rulings/dec-player-screen-2026-11-14.md`, rows sv-1, sv-3 and pf-20.
- The pack format: `docs/07-content-packs.md`, the rules set's `naturals` key (per roll type: `attack`, `save`, `abilityCheck`, `skill`), which `rolls` sits beside and is keyed like.
- How `naturals` is typed, read and checked today (find its type, its reader and its `pack:check` rule), and follow the same pattern.
- The Die glyph's list of dice the app can draw (06, the Die glyph row; its source file), for the check on `die`.

## What to build
1. **The format key.** A rules set may carry `rolls`: an object keyed by roll type, today `save` and `abilityCheck`, each `{ "die": "d20", "pass": "atOrOver" }` or `"atOrUnder"`. Add it to the pack's types and to whatever validates a pack on import, beside `naturals`. It is optional and additive: a pack without it loads exactly as today.
2. **`pack:check`.** Refuse a `die` the app cannot draw and a `pass` that is neither value, each with a message that names the rules set and the roll type. Note (not refuse) a rules set that has saves and no `rolls.save`.
3. **The reader.** One function that, given the campaign's rules in force (follow how `naturals` is resolved across the stack of packs: the same rule for which rules set wins), returns the roll for a roll type, or nothing.
4. **The two lines.** One function for each line that returns the parts a screen needs, not a finished string glued to a glyph: the die's name (for the glyph and for the words), and the words. With `atOrOver`: "Roll d20: your save's number or higher succeeds." and "Roll d20: your score or higher succeeds."; with `atOrUnder`: "…or lower succeeds." in each. For a single save's own sheet, a variant that carries that save's number: "Roll d20: 16 or higher succeeds." Nothing is returned when the rules carry no roll for that type.
5. **`docs/07-content-packs.md`:** the key, in two or three lines beside `naturals`, with an invented example. Mark pf-20.

## Rules
- Rules-agnostic and IP-clean: invented names and numbers only ("Save vs river", a made-up rules set). No real game, book or adventure names, no numbers from a book.
- The words above are ruled: use them exactly. They live in one place.
- No new dependency. Integers. No LLM.
- Nothing in `src/` that draws: no component, no CSS. If you find you need one, stop and say so.

## Tests (write each test's purpose as a plain sentence first)
- A rules set with `rolls.save` of d20, at or over, gives the saves line "…or higher succeeds." with the d20.
- At or under gives "…or lower succeeds."
- The score's line follows `rolls.abilityCheck` the same way, and is absent when the key is.
- A rules set with no `rolls` gives no line for either.
- Where two packs in the stack each carry `rolls`, the one that wins is the one `naturals` would take from.
- A save's own sheet line carries that save's number.
- `pack:check` refuses an unknown die and an unknown `pass`, and names where; it only notes a rules set with saves and no `rolls.save`.
- A pack without the key imports as before (an existing fixture still passes untouched).

## Output
One pull request from the branch, with: the status file `docs/status/<date>-dec-rolls-key-and-rule-lines.md` (what was built, what was not, anything fragile, any ⚑ for the lead), and the manual checks in `docs/testing/dec-rolls-key-and-rule-lines.md` (there will be few: it has no screen). Do not merge. A cloud session other than you reviews it (rv-3).

## Boundaries
- Do not edit any pack, any migration, any screen, or any ruling.
- Do not add the key to a pack: each rules pack gains it from its own book, by the pack's own session.
- One push when finished.
