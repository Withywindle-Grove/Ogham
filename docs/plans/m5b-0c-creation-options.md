# Creation options: every option at creation, and its test (m5b-0c second test, PR F; ct-10)

> Superseded as the record of what each option does by `options-audit-2026-11-03.md` (every option, every screen). This table stays the source of the creation tests.

Linked from `docs/plans/m5b-0c-creation-rebuild.md`, Departures, "Second test, PR F". Francis's words (ct-10, 2026-11-02): "a table of every creation-relevant option in both settings with an on/off test each; an option you can't model goes to Departures with the reason, never dropped silently."

The list starts from the pack session's table in the plan ("Creation options by pack", 2026-11-02: classic-advanced 0.6.8, fae-woodland 0.3.7, the zine overlay 0.5.3), plus one option it left out (O5, restricted weapons, which the Weapon skills step reads). Setting names are the repo's aliases.

- **Stand-in:** the invented option in `scripts/fixtures/m5b-creation.fixture.json` with the same data shape; no real names or numbers.
- **Test:** `src/app/creationOptions.test.ts`, one `it` per row id ("O3 …"), each checking on → present and off → absent through the app's own readers.
- **Status:** tested, or **can't model** with the reason.
- Two tests keep this file honest: `creationOptions.test.ts` checks that every tested row's stand-in is in the fixture and has its test; `creationOptions.realPacks.test.ts` (local only, skipped where `packs/` is missing, as `allClasses.test.ts` is) checks that every option id below is in the newest private packs.

| Id | Setting | Option (choice) | What it gates at creation | How the data ties it | Stand-in | Status |
|---|---|---|---|---|---|---|
| O1 | classic-advanced | `creation-method` (basic, advanced, either) | the Race step; callings that are also a race | the option's `ruleKey: creation-method`, each choice's `races` and `methods`; classes' `creationMethods` | `creation-path` | tested |
| O2 | classic-advanced | `secondary-skills` | the secondary skill's trait-list step | `traitLists[].option` (bare) and the sheet field's `option` written `…=on`; its table's `option` | `fen-omens`, the field spelled `fen-omens=on` | tested |
| O3 | classic-advanced | `weapon-proficiency` (on) | the Weapon skills step | `rulesSets[].weaponProficiency.option` | `fen-weapon-drill` (on) | tested |
| O4 | classic-advanced | `weapon-proficiency` (on-specialisation) | the step, its "specialisation on" count line, a second Pick marking Specialised ✓✓ | `weaponProficiency.specialisation.option` written `…=on-specialisation`: a third choice of the same option | `fen-weapon-drill` (on-drill-master) | tested; was broken twice (see Departures, PR F item 1) |
| O5 | classic-advanced | `restricted-weapons` | the folded "Not your class's weapons" group | `weaponProficiency.restrictedWeapons.option` | `fen-odd-weapons` | tested (added: not in the pack session's list) |
| O6 | classic-advanced, fae-woodland | `reroll-low-hp` | Who they are's Roll again callout | `rulesSets[].hitPoints.reroll.option` | `fen-second-wind` | tested |
| O7 | classic-advanced | `cantrips` | the cantrip picks on First spells | `classes[].spellcasting.known.option` | `fen-small-charms` (on the Fen Cantor) | tested |
| O8 | classic-advanced | `spell-books` (advanced) | nothing at creation | `classes[].spellcasting.scrollCopy.onlyWithOption` (copying spells from scrolls happens in play); a table names bare `spell-books`, whose choices are standard and advanced, so it is never live | — | can't model: nothing at creation reads it; the table's `option` wants `spell-books=advanced` (pack) |
| O9 | classic-advanced | `age-lifespan` | a starting age | none | — | can't model: no data, and age isn't a creation field (a design and a 07 field first) |
| O10 | classic-advanced | `multiple-classes` | two or three classes | none | — | can't model: creation makes one class; multi-class creation isn't designed |
| O11 | classic-advanced | `race-limits` (lifted) | a race's class and level caps | `races[].optionalAbilities.whenOption` (a race's optional abilities) | — | can't model: `optionalAbilities` isn't a field the app reads, and the caps aren't tied to the choice |
| O12 | classic-advanced | `demihuman-priests` (npc-only) | priest classes open to non-human races | none | — | can't model: no data (an `option` on a class's open races would be a 07 field) |
| O13 | classic-advanced | `advanced-hit-dice` | the hit die rolled | none | — | can't model: the hit die comes from the class's progression; the alternative isn't data |
| ~~O14~~ | ~~classic-advanced~~ | ~~`no-alignment-languages`~~ | struck 2026-11-03 (`design/rulings/m5b-builder-questions-2-2026-11-03.md` bq2-4): the option was dropped (rc-5) |||||
| O15 | fae-woodland | `kindred-classes` | the kindred-as-class classes | `classes[].option: "kindred-classes=on"` | `fen-kin-callings` | tested |
| O16 | fae-woodland | `buy-equipment` (on) | the shop and the starting money on Gear | `rulesSets[].byOption["buy-equipment=on"]` | `fen-market` (`byOption["fen-market=off"]`, the same shape from the other side) | tested |
| O17 | fae-woodland | `buy-equipment` (off) | the class kits and the adventuring-items table | `startingKits[].option: "buy-equipment=off"`; the table's `option` | `fen-market-bundle` (`fen-market=off`) | tested (the kits); the table isn't read at creation |
| O18 | fae-woodland | `moon-signs` | the moon sign's trait-list step | `traitLists[].option` and the sheet field's `option` (both bare) | `fen-omens` | tested |
| O19 | fae-woodland | `sub-par-characters` | Scores' start-over callout | `rulesSets[].scores.startOver.option` | `fen-cruel-dice` | tested |
| O20 | fae-woodland | `basic-literacy` | literacy | none | — | can't model: no data; literacy at creation comes from the scores' column |
| O21 | fae-woodland | `custom-class-skills` | a class's skills, chosen | `classes[].skillsCustomisable.option` | — | can't model: class skills aren't chosen at creation (not read) |
| O22 | fae-woodland | `disallowed-gear` | gear a class may not take | none | — | can't model: no data names the gear |
| O23 | zine overlay | `zc-i2-opt-quick-equipment` | the quick kit on Gear | `startingKits[].option` (bare); nine tables' `option` | `fen-quick-kit` | tested (the kit); the tables aren't read at creation |
| O24 | zine overlay | `zc-i5-opt-level-0` | a level-0 character with a background by hit points | `rulesSets[].levelZero.option`; four trait lists' `option` | — | can't model: level 0 is its own creation path (07 G-50, M7); the four lists have no sheet field, so no step either way (scope check, PR F item 4: ruled B, the pack adds the field) |
| O25 | zine overlay | `zc-i1-opt-combat-talents` | a fighter's combat talent | `traitLists[].option` | — | can't model: no sheet field points at the list, so it makes no step on or off (scope check, PR F item 4: ruled B, the pack adds the field; then this row is testable) |
| O26 | zine overlay | `zc-i5-opt-cantrips` | how many cantrips | a count table's `option` | — | can't model: First spells reads `spellcasting.known`, not a table; the overlay could tie it with `known` on its classes (pack) |
| O27 | zine overlay | `zc-i1-opt-d6-thief-skills` | thief skills on a d6 | none | — | can't model: thief skills aren't shown at creation |
| O28 | zine overlay | `zc-i5-opt-level-0-demihumans` | level 0 for non-humans | none | — | can't model: follows O24 |
| O29 | zine overlay | `zc-i5-opt-read-magic-cantrip` | a read-magic cantrip | none | — | can't model: no data |
