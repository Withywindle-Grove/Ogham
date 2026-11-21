# Options audit: every optional rule against what it should do (pack session, 2026-11-03)

Francis (2026-11-03): audit every optional rule against what it should do, in the creation reviews already done and in every review and pack creation from now on. Completeness over speed; the last pass is a fresh `pack-reviewer`. This file supersedes the creation-only table `plans/m5b-0c-creation-options.md` as the record of what each option does. That table stays the source of the creation tests (O1 … O29, cited below).

**Scope.** Every option, choice, `ruleKey` group and preset in classic-advanced 0.6.14, fae-woodland 0.3.14, the zine overlay 0.5.7 and deathcaster-class 0.5: 104 options. The wilderness add-on (0.2) and monster-overlay (0.1.0) have no options and gate nothing on their base's options. Checked against the books, the packs (a script listed every place each option id is referenced), and `src/` on `main` read-only.

**Key.** Screens: **C** creation · **S** full sheet · **P** Player screen · **K** Pack tab (load, slots, equip checks) · **Sc** Scene and play (time, checks, rest, camp, fights) · **G** GM reference · **R** Rules for this campaign · **chk** pack:check. **Today:** works (does what the book says on every screen that exists today) · partly (some screens) · broken (does the wrong thing today) · unread (nothing reads it yet; the milestone is named where one is planned). An on/off option has one row for its non-default choice; off is the book's standard rule unless a row says otherwise. Book descriptions are in neutral words: no rules text or numbers.

## Across all packs
| Id | Finding | Today | Where |
|---|---|---|---|
| X1 | An add-on option's `requires` isn't read: the Rules screen offers it even when its parent is off (six options) | broken | `readOptions` drops `requires`; nothing else reads it |
| X2 | Option presets (`optionPresets`, each option's `presets`: both settings' beginner preset) aren't read | unread | no reader in `src/` |
| X3 | The GM reference shows every variant of a rules-set section in words (`byOption` keys as "Option · Choice"), whatever the campaign chose, and doesn't mark the one in use | partly | `gmReference.ts` (by design it shows the book) |
| X4 | A sheet field that exists only for an option (secondary skill, moon sign, combat talents) is hidden at creation when the option is off, but the full sheet shows it whatever the option | partly | `traitSteps` reads the field's `option`; the campaign's fields keep no option |
| X5 | A `byOption` resolves against the choices stored when the pack was attached. An option a pack update adds has no stored choice, so a `byOption` keyed on its default is skipped, while gates (`option`, `onlyWithOption`) read the default | latent | `resolveRules(e.data, pack.optionChoices)` in `campaignSetting.ts`; `choiceInPlay` fills defaults, `resolveRules` doesn't |
| X6 | A `ruleKey` group takes the top pack's option as the topic's one choice: an overlay's on/off add-on method (the zine's item encumbrance) replaces the base's three-way method row ("Decided above") | works since #382 (was broken) | `ruleGroupsOf`, Rules for this campaign |
| X7 | The rules browser and the GM reference list option-gated classes, kits and tables whatever the option | partly | `entryOptionOn` is read only by creation (classes, kits) |

## classic-advanced — 6 works · 7 partly · 2 broken · 24 unread (39 rows)
| Option | Choice | Book says | Pack data | Should change (screen: what) | Today | Note |
|---|---|---|---|---|---|---|
| `creation-method` | basic · advanced · either | Race and class are one choice, two, or each player's pick | option `ruleKey: creation-method`; choices' `races` / `methods`; classes' `creationMethods` | C: the Race step and the class list | **works** | O1, tested |
| `multiple-classes` | on | Up to three classes: XP split, best saves and attack, hit points divided | none; `requires` creation-method advanced / either | C: two or three classes; S; level-up (M7) | **unread** | G-11 (R2). R: shown even with the basic method (X1) |
| `race-limits` | enforced | Races keep their class lists and level caps | races' `classMaxLevels` | C: the class list; level-up cap | **works** | Hard limits (rc-5) |
| `race-limits` | lifted | No race class or level limits; humans gain optional abilities | races' `byOption[race-limits=lifted]` (`classMaxLevels: {}`; the human's abilities and score bonuses) | C: every class open, the human's abilities in its entry; level-up cap (M7) | **unread** | Fixed today (0.6.14); read by the creation-survey plan's PR 1 (cs-5) |
| `demihuman-priests` | allowed | Non-human clerics and druids are open to players | the default: no `npcOnlyClasses` outside `byOption` | C: priest classes offered to races | **works** | Fixed today: the app's always-on `npcOnlyClasses` no longer refuses them |
| `demihuman-priests` | npc-only | Non-human priests only as GM characters | races' `byOption[demihuman-priests=npc-only].npcOnlyClasses` | C: refused, with the reason | **unread** | PR 1 (cs-5) |
| `ac-style` | descending (table) · descending (target number) · ascending | How AC and attacks are written; the odds don't change | `ruleKey: ac-style`; `attack.unarmouredAC` per style; progression `thac0` and `attackBonus`; `attack.matrix` | S: AC and the attack field; P: AC and weapons at hand; G | **partly** | AC direction and unarmoured AC follow (X3 for G). The sheet's attack field shows the target number in every style (`fills.ts`: `attack ?? thac0`); weapons at hand use the bonus in every style; the matrix is never shown |
| `weapon-damage` | fixed die (default) · variable | Every weapon deals the same die, or each its own | none | K and P: each weapon's damage | **broken** | The default (one die for all) is never applied: every weapon shows its own die. G-97 |
| `encumbrance` | none · armour · detailed | How load affects speed | `encumbrance.byOption` sets `mode` | K: the load method and speed; P: speed; Sc: travel speed | **partly** | Sets the campaign's load method when the campaign is created; changing the rule later leaves the app setting as it was. With the zine overlay on top, its on/off rule takes this group's row (X6): G-101 |
| `containers-add-capacity` | add | Containers add to the load limit | `encumbrance.containers.byOption` | K: the maximum load | **works** | Read by `encumbrance.ts` (coin method) |
| `initiative` | side · individual | Sides roll, or each combatant with DEX | `initiative.byOption` | Sc: fights (M6); G | **unread** | M6. G shows both (X3) |
| `initiative-ties` | reroll · simultaneous · party | What a tie does | `initiative.byOption` | Sc: fights (M6) | **unread** | M6. `party` is the pack's house rule |
| `morale` | off · on | Monsters and hirelings may break and flee | rules set `morale` (no variant for off) | Sc: morale prompts (M6); off removes them | **unread** | M6. Nothing in the data says what off removes: G-99 |
| `weapon-proficiency` | on | Trained weapons; a penalty with the rest | `weaponProficiency.option` | C: Weapon skills; S: the skills line; P and K: the penalty on an unpicked weapon; level-up picks (M7) | **partly** | O3 tested; the sheet line follows the option. The penalty isn't counted on weapons at hand |
| `weapon-proficiency` | on-specialisation | As on, plus a specialised weapon | `weaponProficiency.specialisation.option` | C; P: the specialisation bonus | **partly** | O4 tested; the bonus isn't counted on weapons at hand |
| `secondary-skills` | on | A background trade, rolled or picked | trait list and sheet field `option`; table `onlyWithOption` | C: the trait step; S: the field | **partly** | O2 tested. S: the field shows whatever the option says (X4): G-98 |
| `reroll-low-hp` | on | Re-roll a very low first hit die | `hitPoints.reroll.option` | C: Who they are's Roll again | **works** | O6 tested |
| `spell-books` | advanced | Unlimited book; copying a spell needs a roll | classes' `scrollCopy.onlyWithOption`; the copy-chance table | S and level-up: learning and copying (M7) | **unread** | M7 |
| `arcane-staves` | on | Arcane casters may also fight with a staff | classes' `weaponsAllowed.optional { ids, option }` (three classes, one in deathcaster-class) | K and P: the equip check; C: Weapon skills, kit | **works** (re-checked 2026-11-04, area 5) | The setting drops `optional` while the option is off (option gate), so `equipBlocks` sees the staff only with the rule on |
| `turning-limits` | on | Turning undead limited per encounter | none (ability text) | Sc: turning (M6/M7) | **unread** |  |
| `death-limits` | on | A cap on returns from death, each with a roll | table `onlyWithOption` | Sc: raising the dead (M6/M7) | **unread** |  |
| `combat-charging · combat-two-weapons · combat-missiles-into-melee · combat-parrying · combat-subduing · combat-splash · combat-invulnerabilities` | on (each) | Seven optional fighting rules | `combat.optional` (a text per option id) | Sc: fight actions (M6); G | **unread** | M6. G lists all seven whatever the choices (X3) |
| `crossbow-reload` | on | Crossbows fire every other round | none | Sc: fights (M6) | **unread** |  |
| `age-lifespan` | on | A rolled starting age and lifespan | none (tables in another book) | C: Details (cs-1) | **unread** | O9; can't model without the tables |
| `restricted-weapons` | on | Forbidden weapons usable with the penalty | `weaponProficiency.restrictedWeapons.option` | C: the folded group; K: the equip check | **partly** | O5 tested; the penalty isn't counted in play |
| `fighter-dominance` | on | Extra attacks against weak foes | none | Sc: fights (M6) | **unread** | Data at the fights review (area 4) |
| `backstab-increase` | on | A bigger back-stab multiplier at higher levels | none | S: the ability by level; Sc (M6) | **unread** | Data at the fights review (area 4) |
| `advanced-hit-dice` | on | Larger hit dice for some classes | none (another book) | C and level-up: the hit die | **unread** | O13; can't model without the source |
| `deaths-door` | on | A dying state before death | `death.byOption[deaths-door=on]` | P and Sc: the death panel (M6-5) | **unread** | M6 |
| `high-level-play` | on | Humans advance past the usual cap | none | Level-up and XP tables (M7) | **unread** | Whether the book gives the extra levels wasn't checked: area 5 |
| `training` | on | Levelling needs time and money with a mentor | none | Level-up and downtime (M7) | **unread** | Downtime design (dt rulings) |
| `xp-magic-items` | on | XP for magic items | none | Award XP (M7) | **unread** |  |
| `wind-conditions` | on | The detailed daily wind roll for sea travel (the plain one is the standard rule) | both wind tables as reference (0.6.16), the detailed one `onlyWithOption`; no water mode | Sc: a waterborne mode | **unread** | Reference only until a water mode exists (G-106) |
| `blinded-attacks` | on | Blind characters fight with penalties instead of not at all | none | Sc: the blinded status (M6) | **unread** |  |
| `slow-weapons` | (removed) | Slow weapons act last | the rule is in `initiative.notes` | Sc: fights (M6) | **removed** | fi-1 (2026-11-04): a base rule in the book, always on; crossbow reloading is the only option |
| `magic-armour-size` | on | Magic armour fits one size | none | K: the equip check | **unread** |  |
| `magic-blade-light` | on | Drawn magic blades shed light | none | Sc: lights | **unread** |  |
| `cantrips` (stale id: not in classic-advanced 0.6.21; the zine's `zc-i5-opt-cantrips` is the switch) | on | Arcane casters know level-0 spells by level (the zine's rule) | classes' `spellcasting.known.option` | C: First spells' cantrip picks; S | **stale row** (re-checked 2026-11-04, area 5) | The base has no `cantrips` option any more; the classes' `known.option` names the zine's `zc-i5-opt-cantrips` (next row) |
| `sub-par-characters` | on | A very weak set of scores may be rolled again | `scores.startOver.option` | C: Scores' start-over callout | **works** |  |

## fae-woodland — 6 works · 6 partly · 0 broken · 21 unread (33 rows)
| Option | Choice | Book says | Pack data | Should change (screen: what) | Today | Note |
|---|---|---|---|---|---|---|
| `encumbrance` | weight · basic-weight · slots | Coins, armour bulk, or slots | `encumbrance.byOption` sets `mode` | K, P, Sc: load and speed | **partly** | Set at campaign creation only (as classic-advanced) |
| `quick-camping` | on | Skip the sleep check when the gear suits the weather | `camp.quick.option` | Sc: the camp card's quick camp | **works** |  |
| `asleep-on-watch` | on | A watcher may doze off | camp step `onlyWithOption` (added today) | Sc: the camp card | **works** | Fixed today (0.3.14); not tried in the app |
| `lifestyle-expenses` | on | A daily cost by lifestyle | table `onlyWithOption` | Sc: settlements and downtime (M7) | **unread** | Downtime format (dt-46 …) |
| `treasure-valuation` | on | Jewellers value items for a fee | none | Treasure (M7) | **unread** |  |
| `safe-paths` | on | Known routes travelled quickly | none (procedure text) | Sc: a quick route in turn mode | **unread** |  |
| `dungeon-exit` | safe-paths | Leave by a known route | none that reads it: `dungeonExit` needs a roll | Sc: Leave the dungeon, safe paths only | **unread** | G-104 |
| `dungeon-exit` | escape-roll | Each character saves to escape; a failure rolls on the doom table | `dungeonExit` `onlyWithOption: dungeon-exit:escape-roll` (added today) | Sc: Leave the dungeon's escape rolls | **works** | Fixed today (0.3.14): the section was missing, so the roll never appeared. The stepper's "levels down" must mean levels beyond the first (T3) |
| `initiative-ties` | reroll · simultaneous | What a tie does | `initiative.byOption` | Sc: fights (M6) | **unread** |  |
| `combat-two-weapons · combat-charging · combat-parrying · combat-pushing · combat-splash` | on (each) | Five optional fighting rules | `combat.optional` ("See option.") | Sc: fight actions (M6); G | **unread** | M6 |
| `missile-into-melee` | penalty · penalty-stray | A stray missile may hit someone else | `combat.optional` | Sc (M6) | **unread** |  |
| `combat-nonlethal` | on (default) | Non-lethal damage tracked apart | `combat.optional` | S and P: a second damage track (M6) | **unread** |  |
| `deaths-door` | on | A dying state with a chance each round | `death.byOption`; a status | P and Sc: the death panel (M6-5) | **unread** |  |
| `weather-effects` | on · off | Only the weather's effects are optional; it's rolled every day | weather always rolled; the tags' effects under `byOption[weather-effects=on]` (fixed today) | Sc: the weather card; P: today's effects; travel budget | **partly** | Fixed today: off used to switch the weather off. The lost check's poor-visibility modifier still applies when off: G-100. Default now off (0.3.16): the book marks the effects optional |
| `lost-off-course` | secret (default) · open | Off-course results kept from the players, or told to them | an option (0.3.16); no data | none: the GM's handling (the app keeps no map) | **unread** | Reference only, by design (area 2 re-check) |
| `dungeon-adversity` | on | Doors resist, denizens see in the dark, lights may sputter out | rules set `dungeon.adversity.option`; a delve check `onlyWithOption` (added today) | Sc: the lights check; G: the rest | **partly** | The check is new today; doors and sight stay reference text |
| `shrine-blessing-for-all` | on | Non-casters may receive a saint's blessing | `shrines.option` (reference) | Sc and S: blessings (M7) | **unread** | Notes added today |
| `xp-magic-items · xp-milestones · xp-deeds · xp-spending · xp-exploration` | on (each) | Five extra kinds of XP award | none; the milestone table isn't gated | Award XP (M7) | **unread** | Notes added today |
| `replacement-xp` | on | A new character starts with part of the old one's XP | none | C: starting XP (M7) | **unread** | Notes added today |
| `custom-class-skills` | on | Three classes set their skills with points | classes' `skillsCustomisable.option` | C and S: skills; level-up | **unread** | O21 |
| `disallowed-gear` | off · on | With it on, forbidden armour may be worn but some abilities stop | none | K: the equip check; S: abilities | **unread** | Off is how the app already behaves (warnings); on needs data: G-103 |
| `inebriation` | on | Drink levels with penalties | none | P: statuses | **unread** |  |
| `smoking` | on | A thinking bonus with companions | none | Sc: checks | **unread** |  |
| `sub-par-characters` | on | Start over after very poor scores | `scores.startOver.option` | C: the start-over callout | **works** | O19 |
| `reroll-low-hp` | on | Re-roll a very low first hit die | `hitPoints.reroll.option` | C | **works** | O6 |
| `buy-equipment` | on | Buy gear instead of rolling it | `byOption[buy-equipment=on]` (shop, money) | C: Gear | **works** | O16 |
| `buy-equipment` | off | Class kits and up to four adventuring items | kits' `option`; the items table `onlyWithOption` | C: Gear's kits and the pick | **partly** | O17: kits work; the pick isn't read (`startingEquipment.pick` not placed: ⚑ F7) |
| `basic-literacy` | on | Low INT reads only basic words | none | S: literacy | **unread** | O20. Notes added today |
| `moon-signs` | on | A birth moon with a small effect; fairies don't roll | trait list and field `option`; `excludeRaces` | C: the step; S: the field | **partly** | O18 tested. S: the field shows whatever the option (X4) |
| `kindred-classes` | on | A kindred-class replaces kindred plus class | classes' and kits' `option` | C: the class list, binding (cs-4); rules browser | **partly** | O15 tested; the binding is PR 2 (cs-4); the rules browser lists them always (X7) |
| `training` | on | No XP until training is done | none | Level-up and downtime (M7) | **unread** |  |
| `simple-spell-books` | on | One spell book per caster | none | S and K: spell books (M7) | **unread** |  |
| `fairy-quests` | on | Gaining a rune is a quest | none | Downtime (M7) | **unread** |  |

## zine overlay — 0 works · 2 partly · 2 broken · 19 unread (23 rows)
| Option | Choice | Book says | Pack data | Should change (screen: what) | Today | Note |
|---|---|---|---|---|---|---|
| `zc-i5-opt-cantrips` | on | Arcane casters know level-0 spells by level | a count table `onlyWithOption` | C: cantrip picks; S and level-up (M7) | **partly** (re-checked 2026-11-04, area 5) | Creation reads it through the classes' `known.option` (`firstSpells.ts`); the sheet and level-up wait for M7. F6 settled: one switch, the zine's |
| `zc-i5-opt-read-magic-cantrip` | on | A scroll-reading cantrip for free | none; `requires` the cantrips option | C and S | **unread** | R: offered with cantrips off (X1) |
| `zc-i5-opt-level-0` | on | Ordinary folk with no class, a background by hit points | `levelZero.option`; four trait lists' `option` | C: the level-0 path (M7, rc-4); S | **unread** | G-50 |
| `zc-i5-opt-level-0-demihumans` | on | Some level-0 folk are of another race | none; `requires` level 0 | C (M7) | **unread** | X1 |
| `zc-i5-opt-weaker-materials` | steel · bronze · stone · bone | Which material is ordinary; others cost more and break | a cost table with the old `option` (several choices) | K and the shop: prices and breakage | **unread** | G-102 |
| `zc-i5-opt-enhanced-materials` | on | Special metals to order | two cost tables `onlyWithOption` | The shop | **unread** | G-102 |
| `zc-i4-opt-buying-potions` | on | Potions for sale from casters | none | The shop | **unread** |  |
| `zc-i4-opt-potion-ingredients` | on | Brewing needs a creature part | table `onlyWithOption` | Downtime (M7) | **unread** |  |
| `zc-i2-opt-haggling` | on | A roll sets the share offered for loot | table `onlyWithOption` | Selling (M7) | **unread** |  |
| `zc-i2-opt-valuation` | on | Gem values stay secret until appraised | none | K: treasure values | **unread** |  |
| `zc-i2-opt-treasure-share-xp` | on | Treasure XP by the share each was given | none | Award XP (M7) | **unread** |  |
| `zc-i2-opt-quick-equipment` | on | A basic kit plus rolls on class tables | the kit's `option`; nine tables `onlyWithOption` | C: Gear | **partly** | O23: the kit works; the class tables' rolls aren't read |
| `zc-i4-opt-grimoire-spells-common` | on | Ten grimoire spells join the arcane list | an `extends` list behind the option (fixed today) | C: First spells; S and level-up (M7) | **unread** | Fixed today: they were on the list all the time, so off didn't work. On waits for M7 (pg-1) |
| `zc-i1-opt-firearms` (stale id: not in the zine 0.5.11) | none · four eras | Which guns exist | none (the gun items are always there) | K and the shop: which guns are offered | **unread** | G-102 |
| `zc-i1-opt-armour-penetration` | on | Guns hit metal armour more easily | none; `requires` firearms | Sc (M6) | **unread** | X1 |
| `zc-i2-opt-energy-weapons` | none · three levels | How common energy weapons are | none | The shop and prices | **unread** | G-102 |
| `zc-i2-opt-set-to-stun` | on | Energy weapons may stun | none; `requires` energy weapons | Sc (M6) | **unread** | X1 |
| `zc-i3-opt-thieves-studded-leather` | on | Three classes may wear one more armour, with skill penalties | none | K: the equip check; S: skills | **unread** | G-103 |
| `zc-i1-opt-combat-talents` | on | A fighter picks talents at set levels | the trait list's `option`; a sheet field (added today, `forClasses`) | C: the talent step for fighters; S; level-up (M7) | **partly** | Fixed today: there was no field, so no step. Until `forClasses` is read (cs-3), every class gets the step |
| `zc-i1-opt-d6-thief-skills` | on | Thief skills on a small die, raised with points | none | S: skills | **unread** |  |
| `zc-i1-opt-repeating-checks` | on | Searches and locks may be retried at a time cost | none | Sc: turn mode | **unread** |  |
| `zc-i2-opt-item-encumbrance` | on | Count items instead of coins | `byOption[…=on].encumbrance` (fixed today), mode `items` | K: load; P and Sc: speed | **broken** | No app method counts items; and its `ruleKey: encumbrance` takes the base's row (X6, G-101) |
| `zc-i2-opt-item-encumbrance-str` | on | STR raises the item limits | `strengthAdjust.option` | K | **unread** | X1 |

## deathcaster-class — 1 works · 0 partly · 0 broken · 1 unread (2 rows)
| Option | Choice | Book says | Pack data | Should change (screen: what) | Today | Note |
|---|---|---|---|---|---|---|
| `deathcaster-spells` | class | The class is open to players | the class's `option` | C: the class list | **works** |  |
| `deathcaster-spells` | magic-user | No class; its spells join the magic-user list | an `extends` list behind the choice | C: First spells; level-up (M7) | **unread** | pg-1, M7 |

## wilderness add-on and monster-overlay
No options, no `byOption` keys and no gates on their base's options (a full reference scan). Nothing to audit; re-run when either gains one.

## Data fixed today (private packs)
- **fae-woodland 0.3.14:**
  - `dungeonExit` added behind the escape-roll choice. Leave the dungeon never offered the roll, because the section was missing.
  - Weather always rolls; only the tags' effects sit behind weather-effects. Before, turning it off switched the whole weather off, which the book doesn't do.
  - The adversity's lights check (a delve check behind the option).
  - A falling-asleep-on-watch camp step behind its option.
  - Notes from the books on nine options that had none, so the GM's tap on the name explains the rule.
- **zine overlay 0.5.7:**
  - The item-count encumbrance moved under `byOption` (before, it merged into every campaign whatever the option said).
  - The ten grimoire spells moved off the plain arcane list onto an `extends` list behind their option. A new caster could pick them with the option off.
  - The combat-talents sheet field (ruled B in PR F, never added).
- **classic-advanced:** nothing in this audit (0.6.14's race `byOption` already fixed the demihuman-priests default).
- pack:check: only the notes already known (shapes not yet read). Copy check: information only. All synced to `_current` and Drive.

## For the builder (app problems; not fixed here)
| # | Problem | Rows |
|---|---|---|
| A1 | `requires` on options: hide an add-on until its parent has the needed choice | X1 |
| A2 | The staff gate: `weaponsAllowed.optional.option` must be on before `optional.ids` are allowed | arcane-staves |
| A3 | The encumbrance option sets the campaign's load method only at creation; a later change of the rule doesn't follow | encumbrance (both settings) |
| A4 | The attack field and weapons at hand don't follow `ac-style` (target number in every style on the sheet, bonus in every style at hand) | ac-style |
| A5 | The non-proficiency penalty and the specialisation bonus aren't counted on weapons at hand | weapon-proficiency, restricted-weapons |
| A6 | `byOption` and stored choices: resolve with the default for an option that has no stored choice | X5 |
| A7 | Option-only sheet fields on the full sheet (needs F2 first) | X4 |
| A8 | Option presets | X2 |

## Gaps added to 11
G-97 … G-105. Those marked **(format ruling)** need the designer before a pack can carry them.
- G-97 a rule that sets every weapon's damage **(format ruling)**
- G-98 a sheet field tied to an option, beyond creation **(format ruling)**
- G-99 a choice that switches a rules-set section off **(format ruling)**
- G-100 a check modifier behind an option
- G-101 an overlay's choice joining a base option's group **(format ruling)**
- G-102 items offered only under an option's choice **(format ruling)**
- G-103 a class's armour or abilities changed by an option **(format ruling)**
- G-104 leaving the dungeon by safe paths, with no roll
- G-105 a sheet field asked only of some races **(format ruling)**

## Format questions for the designer
**Ruled 2026-11-03:** F1 of-8 · F2 of-9 · F3 of-10 · F4 of-1 · F5 of-3 · F6 of-2 · F7 of-11; G-100 of-4, G-104 of-5 (`design/rulings/m5b-options-format-2026-11-03.md`; build: `plans/options-gates.md`).

- **F1 (G-97):** how does a rule set every weapon's damage? For example `attack.weaponDamage: "<dice>"` under `byOption`.
- **F2 (G-98, X4):** does the full sheet hide a field whose `option` is off, or show it greyed with a reason? (The data already says `option`.)
- **F3 (G-99):** how does a choice remove a section (morale off, a death rule off)? `merge` can't delete, so perhaps `"<section>": null` or `"off": true`.
- **F4 (G-101, X6):** an overlay brings a fourth encumbrance method. Should its choice join the base option's choices, or stand as its own add-on with no `ruleKey`?
- **F5 (G-102, G-103, G-105):** where may an option or a choice gate, beyond classes, kits, lists and fields? Items (eras and rarity), classes' limits and abilities (`byOption` on classes), and fields asked of some races only (`forRaces`).
- **F6:** cantrips have two switches, the base's `cantrips` (read) and the overlay's `zc-i5-opt-cantrips` (unread). Which pack owns the rule? Either way the creation-options table's O7 or O26 row changes.
- **F7:** `startingEquipment.pick { tableId, upTo }`: where does `pick` sit, now that `startingEquipment` is a list of `{ itemId, qty }` lines?

## Technical (no ruling needed)
- T1: G-104 is small. `dungeonExit` without `roll` could still offer "Use safe paths".
- T2: weather-effects off still names the tags (with "No effect" notes), and the lost check's modifier applies (G-100).
- T3: Leave the dungeon's stepper says "levels down" from 0. fae-woodland's penalty counts levels beyond the first, so the first level must count as 0. A label "levels below the first" would remove the doubt.

## Passes
- **Pass 1:**
  - A script listed every reference to every option id across the six packs.
  - Each gate kind was traced in `src/`: `entryOptionOn`, `resolveRules`, `onlyWithOption` in expedition, `layoutHints`, `weaponSkills`, `firstSpells`, `equipBlocks`, `combineEncumbrance`, `ruleGroupsOf`, the GM reference and the Rules screen.
  - The books were read for every option whose pack text was empty or suspect.
- **Pass 2:**
  - Re-checked the risky claims in code: weapons at hand, the sheet's weapon-skills line, how encumbrance combines, the stored choices, the steps that honour `onlyWithOption` (checks and camp steps do; mode procedure steps don't).
  - New this pass: the weather's whole-block gate, the missing `dungeonExit`, the grimoire spells always on the list, the missing combat-talents field, the duplicate cantrips switch.
- **Pass 3:**
  - Coverage by script: all 104 options have a row.
  - pack:check and the copy check on the rebuilt packs.
  - Nothing new.
- **Not checked:** the app on screen (code read only; the new data was not tried in a campaign); whether the book's high-level tables exist (area 5); the fights options' exact data (area 4).
- **Independent re-check:** pending. A fresh `pack-reviewer` session runs it; its prompt is in the pack session's report. Disagreements will be reconciled here.

## Run by hand (`manual: true`, ruling ex-7)
Ruling ex-7 (`design/rulings/m5b-pack-review-area-2-2026-11-03.md`) marks the options the app doesn't apply yet. A script took every option whose rows here are all **unread**, plus those nothing reads at all. Marked 2026-11-03; remove a mark when the app reads the option.
- **classic-advanced (29), from 0.6.17:** multiple-classes, weapon-damage, initiative, initiative-ties, morale, spell-books, turning-limits, death-limits, the seven combat options, crossbow-reload, age-lifespan, fighter-dominance, backstab-increase, advanced-hit-dice, deaths-door, high-level-play, training, xp-magic-items, wind-conditions, blinded-attacks, slow-weapons, magic-armour-size, magic-blade-light.
- **fae-woodland (29), from 0.3.17:** lifestyle-expenses, treasure-valuation, safe-paths, initiative-ties, the seven combat options (combat-nonlethal included), deaths-door, shrine-blessing-for-all, the five XP options, replacement-xp, custom-class-skills, disallowed-gear, inebriation, smoking, basic-literacy, training, simple-spell-books, fairy-quests, lost-off-course.
- **zine overlay (21), from 0.5.8:** every option except quick equipment and combat talents (both partly read).
- **deathcaster-class:** none (its class choice works).

Defaults changed by ruling ex-4 (book-optional rules default off):
- classic-advanced's morale (off) and encumbrance (none);
- fae-woodland's weather-effects (off).

Non-lethal combat stays on in fae-woodland: it's a core rule in its book, and its option carries a note saying so.

## Area 5 re-check (magic and advancement, 2026-11-04)
Every option in the area, re-read against the books and `src/` (`design/notes/area-5-magic-review-2026-11-04.md`, §5).
| Option | Today | Changed in the pack |
|---|---|---|
| `spell-books` (classic-advanced) | unread (M7) | notes and both choices in the book's words |
| `turning-limits` | unread (M6/M7) | the "on" choice carries all three guidelines (mixed groups was missing) |
| `training` (both settings), `multiple-classes`, `death-limits`, `magic-blade-light`, `magic-armour-size` | unread | none |
| `arcane-staves` | works | none (row above corrected) |
| The five XP award options and `replacement-xp` (fae-woodland) | unread (M7) | notes in the GM's volume's words |
| `simple-spell-books`, `fairy-quests` | unread (M7) | notes in the book's words |
| `zc-i5-opt-cantrips` | partly | notes in the issue's words; F6 settled (row above) |
| `zc-i5-opt-read-magic-cantrip`, `zc-i4-opt-grimoire-spells-common` | unread (M7) | notes in the issues' words |
| `zc-i5-opt-level-0`, `zc-i5-opt-level-0-demihumans` | unread (M7, G-50) | none |
| `zc-i2-opt-treasure-share-xp` | unread (M7) | none |
| `deathcaster-spells` | class: works; magic-user: unread (M7, pg-1) | none |
