# classic-advanced, the zine overlay and deathcaster-class: character creation, the books against the packs and the app (pack session, 2026-11-03)

For ct3-12. This survey follows the fae-woodland one (`design/notes/fae-woodland-creation-survey-2026-11-03.md`) and uses the same standard. Every chapter that touches the character was read in full: in the Player's volume, both creation methods, multiple classes, scores, alignment, weapon proficiency, languages, secondary skills, all 22 classes, all 10 races, advancement and level titles; the zine overlay's six issues for its creation pieces; the class supplement behind deathcaster-class.

The values were checked by script against the books, then reviewed again until a pass came back clean. The packs are classic-advanced 0.6.11, zine-compendium 0.5.4 and deathcaster-class 0.4. I checked the app read-only on `main`. These are shapes only: no rules text, no numbers, no names from the books. The Referee's volume was used for the copy check only, since it holds no creation rules. No printed character sheet is in the source folder; the book says several are offered online.

**Key.** **Fit**: the pack has it and the app uses it. **Pack only**: the pack has the data and the app doesn't read it. **Missing**: no data in the pack. **Fixed today**: a pack error found here and corrected.

## 1. The book's steps (both methods)

| # | Step (basic method · advanced method) | Pack | App | Verdict |
|---|---|---|---|---|
| 1 | Roll the six scores in order; the referee may allow a fresh roll for a very weak set | `scores`; option and `startOver` **added today** | Scores step, start-over callout | Fit (**fixed today**) |
| 2 | Advanced: choose a race (requirements; its score modifiers, kept within the score range) | races, `requirements`, `abilityModifiers` | Race step; modifiers applied | Fit |
| 3 | Choose a class (requirements; basic: the class sets the race) | classes, `requirements`, `creationMethods` | Class step; race-classes offered in the basic method only | Fit |
| 3a | The race's class list and level caps; some races' clerics and druids only as NPCs **at the referee's option** | `classMaxLevels`, `npcOnlyClasses`, option `demihuman-priests` (default: allowed) | Limits read; **`npcOnlyClasses` always applied, whatever the option says** | **Conflict**: with the option at its default, demihuman priests are still refused (G-94) |
| 3b | Optional: up to three classes | option `multiple-classes` | Not supported | Missing (G-11, R2) |
| 3c | Optional: lift the race limits; humans then gain optional abilities | option `race-limits`; human `optionalAbilities` | **Neither read**: limits always apply; the human gains nothing | Pack only (G-94) |
| 4 | Adjust: lower STR, INT or WIS to raise a prime, with a floor; some classes can't lower STR | `abilityAdjustment` as data, `classExceptions` | Adjust step | Fit |
| 5 | Note the modifiers (melee, open doors, languages, literacy, magic saves, AC, missile, initiative, HP, reactions, retainers, loyalty) | `abilityModifiers` with named columns | Tiles' affects line | Fit |
| 6 | THAC0 (or the attack bonus with ascending AC) | progression, option `ac-style` | Fill | Fit |
| 7a | Saves and the class's and race's abilities | progression; `abilities`; races' `saveBonusByCon` (CON-based resilience), `vision` | Saves filled; abilities in the entry pop-up; **`saveBonusByCon` not read**; no traits box on the sheet | Pack only (G-85) |
| 7b | A spell book's first spell: the referee picks (or lets the player) | `firstSpells { choose: 1 }`; divine casters as data | First spells step | Fit |
| 7c | Optional: weapon proficiencies before buying gear (by combat aptitude, also limited by the race) | `weaponProficiency`, `specialisation` | Weapon skills step | Fit; **race weapon limits** (no longbows or two-handed swords for the small folk) are text only (G-88) |
| 8 | HP: the class die plus CON, at least 1; optional re-roll of a 1 or 2 | `hitPoints` with `reroll` | Who they are | Fit |
| 9 | Alignment; some classes limit it (not lawful; must be lawful; lawful or neutral; neutral; the liege's) | `alignments`; class limits only in `restrictions` text | Who they are; **class limits not read** | Pack only (G-84) |
| 10 | Languages: the race's (or class's), Common and the alignment tongue; extra by INT, rolled or chosen from a d20 list at the referee's leave | `languages` list with ids, race and class lists, `extraLanguages`, the d20 table | Languages step (pick); the roll isn't offered | Fit; the roll **pack only** (G-90) |
| 11 | Buy gear with the rolled coin | `startingMoney`, items, shop | Gear: shop | Fit |
| 12 | AC: armour plus DEX; unarmoured base; small races' bonus against large foes | `attack.unarmouredAC`; the bonus as text | AC worked out | Fit (the conditional bonus is text) |
| 13 | Level 1, 0 XP | — | Default | Fit |
| 14 | Optional: a secondary skill, rolled on a d100 (or chosen), one row giving two skills | Trait list behind its option | Trait step | Fit; "roll for two" needs ct3-6's pick 2 |
| 15 | Name (no tables in this book) | — | Typed | Fit |

**Tally (21 rows):** 15 fit (one fixed today) · 4 pack only · 1 missing · 1 conflict.

## 2. Per race (all ten, values checked against the book)

Class lists, level caps, NPC-only marks, requirements, score modifiers and languages match the book for all nine demihuman races. The human has no limits and no modifiers. Its optional abilities (two score bonuses, rolling HP twice, winning initiative ties, retainer loyalty) are in `optionalAbilities` and are not read.

| Race | What the app misses |
|---|---|
| drow, elf, half-elf | infravision (`vision`, read only by party travel); the immunity and detection abilities are text (fine) |
| dwarf, duergar, gnome, halfling | CON-based save bonus (`saveBonusByCon`, not read); no longbow or two-handed sword (text, G-88) |
| gnome, halfling, svirfneblin | armour tailored to size; the +2 AC against large foes (text) |
| drow, duergar, svirfneblin | light sensitivity (a disadvantage, text) |

## 3. Per class (all 22)

Checked against the book and matching for every class:
- stat blocks (requirements, primes, hit die, level cap, armour, weapons, languages);
- the full level table (XP, hit dice, THAC0, five saves, spells by level);
- the skill tables of the acrobat, assassin, barbarian, half-orc and thief, including in-6 and modifier columns;
- which skills the GM rolls (the book's player-knowledge rule);
- level titles; first spells and spell start levels for all 11 casters;
- weapon proficiency numbers;
- every ability heading, which maps to an ability, the spellcasting block, `restrictions`, `vision` or the skills table.

**Fixed today:**
- The half-elf's high-level stronghold offers two choices (a human barony or an elven forest hold); the pack had only the elven one.
- The ranger's tracking chance by level was only words; it is now a skill table.

## 4. The zine overlay's creation pieces

Checked against the six issues and matching:
- **Classes:** all 20 level tables, including the extra columns (AC by level, unarmed damage).
- **Races:** all 11 (class limits, requirements, modifiers).
- **Lists:** the four level-0 background lists, combat talents, mutations, fiendish appearance and gifts, draconic bloodlines, deities, and the 12 cantrips.
- **Copy check:** 0 on all six issues.

Two problems remain:
- **Fixed today (0.5.4):** race and class languages were in the old shape (names, with Common and the alignment tongue). They are now classic-advanced's ids, extras only.
- **Still open:**
  - Four tongues aren't in classic-advanced's list and stay as names. An overlay can't add to its base pack's list yet (G-93).
  - Background lines giving "10 arrows" multiply the quiver bundle and give 200 (G-92).

## 5. deathcaster-class

Checked against its book and matching: the stat block, all 14 levels (XP, HD, THAC0, saves, spells), the race limits (`raceMaxLevels`), first spells, and the 60 new spells' durations and ranges. The copy check is 0. Its two fields (`raceMaxLevels`, the list `extends`) wait for their builds (M5b follow-up, M7).

## 6. The copy check (information only)
classic-advanced shows 77 runs of 8+ words against the Player's volume and 1,926 against the Referee's volume, almost all in magic-item and stat-block prose. **Francis ruled (2026-11-03, [ip]):** private packs keep the books' exact wording, because they are his own non-commercial copies and rules must be exact. So no rewrite is needed. The earlier rewordings in fae-woodland (15 fields) and deathcaster-class (4 lines) were restored (fae-woodland 0.3.11, deathcaster-class 0.5).

## 7. Format fields and app changes I'd need

1. **Race fields gated by an option:** a race `byOption` (or the option naming the fields it changes), so that `npcOnlyClasses` applies only with "NPCs only", the class limits drop with "lifted", and the human's `optionalAbilities` apply with "lifted" (G-94).
2. **Class alignment limits as data, read by Who they are:** the same field as fae-woodland's G-84 (here five classes).
3. **Race weapon limits and the small races' size:** `weaponsAllowed` on races, read with the class's (G-88).
4. **`saveBonusByCon` read** for saves (G-85).
5. **An overlay adding languages** to its base pack's list (G-93).
6. Other-languages roll (G-90), "roll for two" secondary skills (ct3-6), and part-bundle quantities (G-92), as in fae-woodland.

## 8. Where it presses on a ruling
- **ct-10** (options at creation, on/off tested): two of classic-advanced's creation options do nothing today (race limits lifted; demihuman priests), and one default contradicts the data (G-94).
- **ca-3** (special approval): races' NPC-only classes are refused outright. With the option, they should be refused, allowed, or flagged for the GM's approval.
- **ct3-6**: "roll for two skills" on the secondary-skill list.

## 9. Passes
- **Pass 1:** the full read and the value scripts. Found the half-elf stronghold, the ranger's tracking table and the zine's language shape (the copy check is information only).
- **Pass 2:** found the missing weak-scores re-roll (now an option with `startOver`), and that the option-gated race fields are unread.
- **Pass 3:** checked the spell lists by name (all four match) and re-ran pack:check and the copy checks on the new versions. Nothing new.

## Gaps
G-93 and G-94 are new in `docs/11-modelling-gaps.md`. G-11, G-84, G-85, G-88, G-90 and G-92 now also list classic-advanced or the zine overlay.

## 10. The independent re-check (2026-11-03)
A fresh `pack-reviewer` session re-checked creation. It found errors the passes had missed. They are reconciled and fixed:
- **classic-advanced 0.6.12:**
  - `alignmentVisibility` owner.
  - The no-alignment-languages option now works; it's a house rule (neither volume has it; ⚑ keep or drop).
  - The spells guide (the drow's single spell; the referee picks the first spell).
  - The drow's kit (holy symbol) and the druid's harvested mistletoe. The paladin needs no symbol at 1st level.
- **zine-compendium 0.5.5:**
  - Six combat categories re-derived from the progression (all 20 checked).
  - `weaponsAllowed` on seven classes.
  - 68 background lines given item ids (49 new items).
  - The arcane bard's hear-noise is no longer GM-rolled.
- **Still open:** the bolt and arrow lines (G-92), coins and a random cantrip on two lines (G-96), and the phase elf's limits by phase (G-64).
