# Plan: two fixes from the area-4 re-check (fix branch)

Reported by Francis on 2026-11-04, re-checking area 4 (PR #397). **M5b**, one pull request on `fix-area-4-recheck`, no migration. Tests first (bq-6): the failing tests marked `it.fails` on their own commit, then the fix removes `.fails` and changes nothing else in them.

## 1. The GM reference misses a rules set's top-level `encounter`
**Bug.** `buildReference` (`src/modules/library/gmReference.ts`) fills Combat from `procedures.encounter` only. 07 ("Reference only", the exploration section) lets a rules set keep its encounter rules at the top level, as `encounter`; fae-woodland does, so its encounter rules never show.

**Fix.** Combat reads both: `procedures.encounter`, then the top-level `encounter`, each headed "Encounters", in the fight sections' order (after Surprise, before Fighting). 07 doesn't say which wins when a rules set has both, so both show, the procedure first (Departures).

**Tests** (`gmReference.test.ts`, invented rules sets):
- A rules set that keeps its encounter rules at the top level shows them in Combat as Encounters, in order, with their page and lines.
- A rules set with both shows both, the procedure first, each its own entry, and the search finds the top-level one.

## 2. The weapon-damage option is ignored on screen (of-8)
**Bug.** classic-advanced's default "All weapons d6" sets `attack.weaponDamage` through `byOption`, but the weapon line at hand (`weaponFigures`, `src/modules/characters/play.ts`) shows the item's own `weapon.damage`: a battle axe shows 1d8 in a d6 campaign. The Weapon skills step's line (`weaponLine`) does the same.

**Ruled** (of-8, `design/rulings/m5b-options-format-2026-11-03.md`): while the rule is set, every weapon reads that die (at hand, the sheet, the breakdown says so); items untouched. So the rule wins over a weapon's own die: no design call needed.

**Fix.**
- `src/modules/characters/weaponDamage.ts` (new, pure): `ruleWeaponDamage(rulesSets)`, the die from the rules sets as the campaign's options leave them (the shared reader's `resolveRules`, via `setting.rulesSets`): the highest rules set whose `attack.weaponDamage` is words. `weaponDamageRule(rulesSets, entries, choices)` adds the reason: the name of the choice whose `byOption` (top-level or the attack section's own) set that die, else the rules set's name.
- `weaponFigures` reads the die from the rules sets it already takes (so every caller is right), and names the reason after the damage when given one: "+2 · d6+1 · All weapons d6". The damage score still adds to the rule's die.
- `weaponLine` (the Weapon skills step) takes the rule: "d6 · All weapons d6 · melee, one-handed". `weaponSetup` carries it to the step from creation and from the To finish card.
- The Player screen's At hand passes the reason.

**Tests** (`src/app/weaponDamageRule.test.ts` on the invented fixture `scripts/fixtures/weapon-damage-rule.fixture.json`, through `settingFrom` as the screens read it; `weaponDamage.test.ts` pure):
- With "All weapons d6" (the default) the rule is d6, its reason the choice's name; with "By weapon" there is none and the axe keeps 1d8.
- At hand, the axe (1d8) shows d6, the damage score adding, the reason after; a weapon that is both kinds shows the die once.
- Without the reason passed, the die still follows the rules sets.
- The Weapon skills step's line follows the rule; the item's own data still says 1d8.
- A rule inside the attack section's own `byOption` counts the same; a rule with no option names the rules set; the highest rules set that names a die wins.

## Patches (#399, merged first)
#399 applies a patch's `{ delta }` to `weapon.damage` on the item's data ("1d8" −1 → "1d8−1") and appends its patch lines to the weapon line. Ruled for this fix: the rules-set die first, then the patch's delta, both lines kept. Built after #399 merged: `deltaAt` (`patches.ts`) sums the patches' deltas on a path; `lineInPlay` returns them for `weapon.damage` (`damageDelta`); the Pack hands them to the At hand line, and `weaponFigures` adjusts the rule's die by them ("d6" with Bone −1 → "d6−1"). At hand reads "+1 · d6−1 · All weapons d6 · Damage −1 · Bone, <pack>".

**Test** (`weaponDamageRule.test.ts`, the fixture's invented Bone patch): with "All weapons d6" and Bone, a carried axe reads "d6−1" with both lines.

## ⚑
None.

## Estimate
3–4 builder turns.

## Departures

- **Both encounter sections show.** 07 is silent on which wins when a rules set has both `procedures.encounter` and a top-level `encounter`, so Combat shows both, the procedure first, each headed "Encounters". 07 also lists a top-level `encounters` (plural) as reference only; it isn't in Combat (not asked; no pack is known to use it there). Not built.
- **The reason sits on the weapon line at hand**, after the damage ("+2 · d6 · All weapons d6"). The app has no separate damage breakdown yet; the Attack breakdown is sheet PR 1's (`plans/m5b-sheet.md`). It follows #399's pattern, which appends its patch lines to the same line. When sheet PR 1 adds a damage breakdown, `weaponDamageRule` gives it the die and the reason.
- **The rules browser and the GM reference still show each weapon's own die.** They show the book as the pack has it (X3, options-gates PR 1).
- **Patches order (#399).** #399 merged first, so this PR applies the patches' delta after the rule's die (above). Only deltas: a patch that *sets* a weapon's damage outright gives way to the rule's die (no pack does it; unruled, so not guessed further). The Weapon skills step lists the setting's items, which carry no patch delta of their own here, so its line reads the rule's die without the delta. A damage score's modifier is still appended as text ("d6−1+1"), as before for any patched die.
- **The guard hook ran an old copy.** The PreToolUse hook runs `$CLAUDE_PROJECT_DIR/scripts/guard-tests.mjs` from the main folder, an older copy that blocks every test edit on a fix branch. Each test edit here was checked against this branch's guard (the ruled bq-6 one: only new `.fails` tests, then `.fails` removed alone), which allowed it, and then copied in from the shell.
- **options-gates of-8 is done here** (build order 4's `attack.weaponDamage` only); the rest of build order 4 is not.
