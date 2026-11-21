# Plan: the Attack sheet, weapon skill and plain-launcher ammunition (as-4, mw-5)

Written by the builder, 2026-11-10, from the coordinator's brief and the ruling `design/rulings/m5b-attack-sheet-skill-and-ammunition-2026-11-10.md` (as-4, mw-5; Francis via Design, 2026-11-10). One pull request, branch `m5b-attack-sheet-as4`, built on #594 (the Attack sheet's Roll cards). Sized 2.5–3 hours.

## What it delivers

The Attack sheet's "Roll 1d20 + X" made right for weapon skills and for magic arrows from a plain bow:

1. **Specialised.** With the specialisation option on and a `bonus` in the pack, a specialised weapon gets a row "Specialised" in the to-hit card and the damage card, counted in each line. A variant is covered by its base type's specialisation (R3-12).
2. **Not a skill.** A weapon the character hasn't picked gets the rules set's penalty: a to-hit row "Not a weapon skill of yours".
3. **Not the class's weapon, approved or not (R3-5).** A weapon outside the class gets the penalty, row "Not your class’s weapon", also when the GM approved it as a pick. `weaponPenalty` checks the class before a pick returns nothing; a test that would have caught it.
4. **mw-5.** With no `attack.ammunitionBonus` rule, magic ammunition drawn by a launcher with no magic bonus counts to hit and damage as its own row ("Ember arrows, magic +1"), with no note. A magic launcher with magic ammunition keeps mw-4; "add" unchanged (mw-3).
5. **The ammunition's `bonusVs`** shows as notes that name it ("Ember arrows, +3 vs bog lurkers"; "Ember arrows, damage +4 vs bog lurkers"), never added. The launcher's own stay as #594 prints them.

The same totals wherever they show: At hand's line, the item sheet's Attack row and the Attack sheet. sq-4's departure "specialisation isn't in the figure" ends.

## Build order

1. `weaponPenalty` (`weaponSkills.ts`): the class check first; a `label` for the row; a specialisation with no bonus brings nothing.
2. `weaponFigures`, `weaponBreakdown`, `weaponRolls` (`play.ts`): an option `skill`, a part before the magic.
3. `weaponMagic`: mw-5 and the ammunition's named `bonusVs` notes.
4. The Player screen works out the skill from the character's picks, the class and the proficiency; `CarrierItems` passes the line's pack entry id.
5. Gallery: four specimens in the at-hand-actions section (specialised, not a skill, an approved out-of-class weapon, magic arrows from a plain bow with no rule); the 4 at-hand-actions baselines deleted in the same commit, the new ones taken from the run's `gallery-baselines-N`.
6. Docs: 04, 05, 06, 07, 08, 09 and the ruling's absorbed-into (docs-sync).

## Tests (each purpose a plain sentence)

- A weapon outside the class that the GM approved as a pick still carries the penalty (would have caught R3-5).
- Specialised in an out-of-class weapon, the class penalty wins.
- A variant is specialised through its base; a specialisation with no bonus, and a rule with no penalty, bring nothing.
- A specialised weapon's bonus is a row in both cards, counted in each line.
- A weapon that isn't the character's skill shows the penalty to hit only.
- At hand's line and the item sheet's breakdown count the skill too.
- With no rule, magic arrows from a plain bow count as their own row, with no note; from a magic bow, the GM's note stands (mw-4).
- A launcher bonus of 0 is none; a negative one is a bonus.
- A cursed arrow's bonus stays hidden from the player under mw-5, the GM seeing it marked.
- "add" counts both, unchanged.
- The ammunition's `bonusVs` notes name it and are never added; the launcher's own stay as they were.
- The gallery draws 14 specimens, the four new ones with their rows and sums.

## ⚑ for Francis (built, not ruled: collected, not decided)

1. **A launcher's magic bonus of 0** is treated as none (so magic arrows count, mw-5); **a negative one** as a bonus for the GM (the arrows don't count and the GM sees the note: the silent case).
2. **A launcher bonus the viewer can't see** (unidentified, cursed or negative, from the player's view) counts as none for that viewer: the arrows count per mw-5, so the missing bow row doesn't give the bow away. The GM's view is unchanged (#606 review, built).
3. **The ammunition's `bonusVs`** is shown as a note naming the ammunition ("Ember arrows, +3 vs bog lurkers"; "Ember arrows, damage +4 vs bog lurkers"), never added; only where its bonus counts ("add", or mw-5). Under mw-4 the GM alone sees it, beside the mw-4 note (#606 review, built).
4. **A character specialised in a weapon outside the class** gets the class penalty alone (the function returns one modifier); whether both should show.
5. **The penalty isn't shown** on the sheet's Weapon skills line or the GM's exception card (not built).

## Estimate

2.5–3 hours, one picture round.

## Departures

Kept by the builder.

- This plan file was written by the builder from the coordinator's brief and the ruling, which was on `main` when the step began; there was no plan file before.
- A specialisation whose pack `bonus` is zero on both rolls brings no row (the ruling: "no `bonus` in the pack: no row").
- A weapon line with no pack entry (a homebrew line typed in) gets no weapon-skill row: the skill is matched by the entry's id.
- **#606 review, 4 findings, all fixed.** "Not your class’s weapon" now reaches the equip check's verdict (`classAllowsWeapon`, `equipWarnings.ts`: the class form in play, eq-8, and the rules sets' weapon rules, eq-7), not `weaponsAllowed` alone. A launcher bonus the viewer can't see counts as none for them (⚑ 2). The ammunition's `bonusVs` shows only where its bonus counts, the GM's alone under mw-4 (⚑ 3). Every weapon line's figure carries the entry id and the class verdict (`lineFigureParts`), not only At hand's.
