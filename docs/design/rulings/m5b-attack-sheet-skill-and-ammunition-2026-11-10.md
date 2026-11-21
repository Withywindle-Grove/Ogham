---
status: absorbed
milestone: m5b (a follow-up to the Attack sheet, built after its pull request and before the rewalk's sitting 2)
absorbed-into: docs/05-features.md (Pack and Player: the Attack sheet, weapon skill and magic ammunition), docs/06-screens-and-design.md (Skills block, Roll card row), docs/07-content-packs.md (`attack.ammunitionBonus`), docs/04-data-model.md (weaponSkills), docs/08-roadmap.md (M6), docs/09-decisions-log.md (2026-11-10), the pull request m5b-attack-sheet-as4
supersedes: mw-4's reach (`m7-found-spells-and-rolled-results-2026-11-05.md`): it stands for magic ammunition from a magic launcher and no longer covers a plain launcher (mw-5). sq-4's departure "specialisation isn't in the figure" ends (as-4).
---

# The Attack sheet: weapon skill and plain-launcher ammunition (2026-11-10)

From the Tester's sweep of a classic-advanced test campaign during the M5b gate rewalk's pause (finding F37, `design/notes/gate-m5b-rewalk-2026-11-10.md`) and from the Pack Creator's question on the modes fill. Ruled one at a time with Francis. Ids `as-4`, `mw-5`.

The reason for all of it: the Attack sheet now says "Roll 1d20 + X to hit" in plain words (as-1), so X has to be right. Before as-1 these waited for M6.

- **as-4 Weapon skill reaches the two rolls.** Three parts, each a row under its card (as-1, layout B) and counted in the card's line; the same totals wherever At hand or the item sheet shows them.
  - **Specialised.** A character specialised in the weapon, with the specialisation option on, gets the rules set's `weaponProficiency.specialisation.bonus` to hit and to damage: one row "Specialised" in each card. No option or no `bonus` in the pack: the mark shows as today and there is no row. A variant is covered by its base type's specialisation, as for the skill itself (09, 2026-11-08).
  - **Not a skill.** A weapon the character hasn't picked gets the rules set's penalty to hit: a row "Not a weapon skill of yours".
  - **Not the class's weapon, approved or not.** A weapon outside the class gets the penalty to hit, row "Not your class's weapon", **also when the GM approved it as an exception** (09, 2026-11-08, R3-5: "usable with the penalty"). The app was dropping the penalty once the weapon was picked; the fix carries a test that would have caught it.
- **mw-5 Magic ammunition from a plain launcher counts.** In a setting with no `attack.ammunitionBonus` rule: when the launcher has no magic bonus, the drawn ammunition's own `magicBonus` adds to hit and to damage, as its own row ("<Ammunition>, magic +1"), with no note for the GM. When the launcher has one, mw-4 stands: the launcher's counts, the ammunition's is not added and shows as the GM's note. With `ammunitionBonus: "add"` both count, unchanged (mw-3). The packs stop carrying the ammunition's bonus as a mode's `toHit`: the bonus lives on the ammunition item (mw-1).

| Launcher | Ammunition | Rules set says | To hit and damage |
|---|---|---|---|
| plain | magic | nothing | the ammunition's bonus (mw-5) |
| magic | magic | nothing | the launcher's; the ammunition's is the GM's note (mw-4) |
| magic | magic | `add` | both (mw-3) |
| magic | plain | either | the launcher's (mw-1) |

**Built, not ruled (the Builder's ⚑ list, `docs/plans/`, for the grouped list):** a launcher whose bonus is 0 (treated as none) or negative (treated as magic: the silent case); the ammunition's `bonusVs` shown as a note that names the ammunition ("<Ammunition>, +3 vs <against>"), never added; a character specialised in a weapon outside the class (the class penalty wins; whether both should show); whether the penalty also shows on the sheet's weapon-skills line and the GM's exception card (not built).

**Pack side (the Pack Creator, held until the reader is live):** fae-woodland drops the magic-ammunition modes' `toHit` the evening the Attack sheet goes live (its rules set says `add`, so the bonus would count twice); classic-advanced and the conversion drop theirs once this ruling's pull request is live, not before, or the bonus would vanish from the sheet in between.

09: 2026-11-10 — [sheet] A specialised weapon's bonus (to hit and damage) and the penalty for a weapon that isn't the character's skill or the class's weapon show as part rows on the Attack sheet and count in its lines, in a follow-up before the rewalk's sitting 2 instead of M6; a weapon outside the class keeps its penalty when the GM approved it as an exception (as-4) — The sheet now says "Roll 1d20 + X" in plain words, so X must be right; the pack already carries the bonus; R3-5's own words are "usable with the penalty" and the app dropped it on a picked weapon — `design/rulings/m5b-attack-sheet-skill-and-ammunition-2026-11-10.md`
09: 2026-11-10 — [fight] With no `attack.ammunitionBonus` rule, magic ammunition's own bonus counts to hit and damage from a plain launcher; only magic ammunition from a magic launcher stays the GM's note (mw-5, narrows mw-4) — The book is silent on adding two bonuses, not on the arrow itself — `design/rulings/m5b-attack-sheet-skill-and-ammunition-2026-11-10.md`
