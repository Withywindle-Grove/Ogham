---
status: absorbed
milestone: m6 (mw-4), m7 (us-2, rr-1)
absorbed-into: docs/07-content-packs.md (spells: uncommon spells; Equipment: a weapon's magic bonus), docs/08-roadmap.md (M7), docs/09-decisions-log.md (2026-11-05), docs/10-open-questions.md (two ⚑ removed), docs/05-features.md (At hand; ammunition note, mw-4, as built 2026-11-10)
supersedes: —
---

# Three follow-ups: hidden uncommon spells, the ammunition note, rolled results on items (design ruling, 2026-11-05)

The two open questions left by us-1 and mw-3, and one new question from the pack session. Ruled with Francis (yes to each proposal). Ids `us-2`, `mw-4`, `rr-1`.

- **us-2 An uncommon spell is hidden until it is given.** Before a character holds it, an uncommon spell (us-1) is GM-only: it is not sent to players' devices and does not show in their Rules library or any list. Once the GM gives it to a character, that character's player reads it like any spell they hold; other players still don't. Enforced by row-level security, not the screen (hard rule 5); built in M7 with learning a spell in play.
  - **Until M7 builds it, packs keep uncommon spells out of `spells`** (the app would show them): the pack session prepares them in the ruled shape in a side file and adds them when the app hides them.
- **mw-4 The ammunition note.** In a setting with no `attack.ammunitionBonus` rule (mw-3), the app adds nothing and shows the ammunition's bonus as a **note for the GM** on the attack line ("Reed arrows · magic +2, not added: the rules don't say"), so a silent book stays the GM's call at the table.
- **rr-1 A rolled result that adds fields to an item waits for M7's design.** One setting builds most magic items from rolled powers and oddities (roughly sixty results that change a number the app shows, and as many rolled picks for what a rod, wand or staff casts; the pack session's rough count); the other has few. The carrier (a result row saying what the item gains, applied when the GM records the roll on the item) is the mechanism it-1 left for M7 ("the result is written onto the item"), so it is designed there, once, with the treasure hand-out. **Until then these results stay as text** and no format word is added; mw-2's `{ against, damage }` stands for fixed items.

**Pack session:** nothing to add to the packs now. The sixteen spells and the rolled powers stay as text; keep the side file for the spells.

Docs to update: 07, 08 (M7), 09, 10.

09: 2026-11-05 — [perm] An uncommon spell is GM-only until the GM gives it to a character; then that character's player reads it; row-level security, built in M7; until then packs keep such spells out of `spells` (us-2) — `spells` is player-readable, so the sixteen would show in the Rules library; hidden means hidden — `design/rulings/m7-found-spells-and-rolled-results-2026-11-05.md`
09: 2026-11-05 — [fight] With no `attack.ammunitionBonus` rule the app adds nothing and notes the ammunition's bonus for the GM on the attack line (mw-4) — A silent book stays the GM's call, but the bonus shouldn't vanish from view — `design/rulings/m7-found-spells-and-rolled-results-2026-11-05.md`
09: 2026-11-05 — [packs] A rolled result that adds fields to an item (special powers, oddities, what a wand casts) is designed once in M7 with the treasure hand-out; text until then, no new format word (rr-1) — It is the mechanism it-1 left open and touches most magic items in one setting; not a one-off for one power — `design/rulings/m7-found-spells-and-rolled-results-2026-11-05.md`
