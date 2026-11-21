# Pack review, area 4: fights and monsters (pack session, 2026-11-04)

The fourth rule area of `plans/pack-review-method.md`, with the options audit (step 5). Francis ruled on 2026-11-04 to finish it now, beside the M5b gate work, in the books' exact wording ("these are important details to capture"). Packs:
- classic-advanced 0.6.21 → **0.6.22** → **0.6.23** (fi-1)
- fae-woodland 0.3.21 → **0.3.22** → 0.3.23 → **0.3.24** (fi-3); (the prime-ability rule as data: the lowest score decides, as the book says)
- the zine overlay 0.5.11 → **0.5.12**
- the monster overlay 0.1.0 → **0.2.0**
- the conversion (conv-fae-woodland-to-classic) 0.2.3 → 0.2.4 → 0.2.5 → 0.2.6 → 0.2.7 (fi-2) → **0.2.8**, rebuilt from fae-woodland 0.3.23 with classic-advanced 0.6.23's shared items pinned

Shapes only here: no rules text, numbers or names from the books. The parsers are kept with the private packs (`packs/_design/review_tools/`: `ca_monsters_book.py`, `fw_monsters_book.py`, `zine_monsters_check.py`, `booktext.py`, and the compare scripts). Each pack's fix scripts sit in its own build folder.

## 1. Map
| Book chapters | Pack parts | App (read-only, `main`) |
|---|---|---|
| classic-advanced, players' volume: saving throws; damage, healing and death; encounters (surprise, distance, reactions, actions, movement); evasion and pursuit (dungeon, wilderness, waterborne); combat; other combat issues; morale (optional); combat tables. Referee's volume: monster statistics and general notes, combat tables (monster saves, attack matrix), every monster description | rules set `initiative`, `surprise`, `procedures.encounter`, `pursuit`, `combat` (+ `optional`), `morale`, `death`, `healing`, `attack`, `monsterSaves`, `monsters`, `naturals`; `conditions`; `statBlocks`; reaction table; options | GM reference's Combat panel (`modules/library/gmReference.ts`: initiative, surprise, procedures.encounter, combat, morale, death, pursuit); the encounter card (a block's name and `description`); the library editor (`description`, `hp`, `hpAverage`, `fields`, `abilities {name, note}`, `tags`); statuses (`conditions`). Fights themselves are M6 |
| fae-woodland, players' volume: core rules (saving throws, attack rolls), encounters, combat, other combat matters (all optional), camping and settlement rest. Monster volume: the bestiary, adventurers, everyday mortals, animals, every monster's traits, encounters, lairs, names and own tables | the same rules-set sections; `statBlocks` with `saves`; the monster tables (new) | the same |
| The zine overlay: the monster articles of five issues (46 stat blocks), poisons, damaged items | `statBlocks` (+ `variants`, `parts`), `conditions` | the same |
| The monster overlay's book: 20 behaviours, their tables, the d20 modifications, the reaction table | `overlays`, `modifications`, `tables` | not read yet (M6-13); `pack:check` names them as unknown parts |

## 2. Values by script
| Pack | Checked | Result |
|---|---|---|
| classic-advanced | 323 book entries against 328 blocks: AC, HD, attacks, THAC0, move, saves, morale, alignment, XP, number appearing, treasure type, hp and its average, the special-ability count. The monster save table and the attack matrix row by row | Every number matches, except: 17 treasure types had swallowed the whole ability list; 2 were cut short; about 30 values kept line-end hyphens; the four 1-hp creatures had 1d8 hit points |
| fae-woodland | 173 book blocks against 173: level, AC, HP and average, saves (and the `saves` object), attacks, speed (with fly, swim, burrow, webs), morale, XP, number appearing, lair chance, size, type, intelligence, alignment, hoard | Every number matches, except ten values that lost their condition (a morale that rises in a lair or a larger group; a speed when mounted or on webs) |
| The zine | 46 blocks against the issues (the four elementals' three sizes in `variants`) | Every number matches, except two AC fields that had swallowed page text (one of them also the wrong AC) |
| The monster overlay | 20 behaviours' numbers; 23 links; 28 tables' dice and rows; 20 modifications | See §8 |

**Wording, by script:**
- classic-advanced: the 0.5 build kept each ability's first sentence and each description's. Of the book's 1,042 abilities, 299 were cut and 91 missing.
- fae-woodland: the abilities were paraphrases. Of 661, 4 matched the book, and 543 had no entry under their own name (95 only as a tag). Every description, and the Behaviour, Speech and Possessions lines, were missing.
- The zine: paraphrased (3 of 154 abilities matched).

## 3. Fixed today
**classic-advanced 0.6.22** (`fixes_fights_statblocks_2026_11_04.py`, `fixes_fights_rules_2026_11_04.py`):
- Every stat block's `description`, `abilities` and `groupAbilities` in the book's words (1,042 abilities, now all equal to the book).
- The swallowed and cut treasure types, the hyphens, and the 1-hp creatures.
- `variants` for the 14 blocks printed with several sizes. Each size's HD, hp, THAC0 and XP come from the book's lists; "By HD" THAC0 and saves come from the book's attack matrix and save table.
- `Person` on the book's 47 persons; the missing `Undead` tag on one block.
- The fight rules in the book's words: initiative, surprise (now the rules set's `surprise`, which the GM reference reads), the encounter sequence, actions and movement, `pursuit` (new), combat (sequence, declarations, movement, missiles, spell casting and disruption, melee, invulnerabilities, damage, attack rolls, ascending AC, rear attacks, blindness, bombing, paralysed opponents, spacing, unarmed, unstable surfaces, water, saves, poison) and the seven optional rules, morale (with mercenaries and retainers), death (with destroyed items and the optional limits on returning), healing, and the monster notes.
- Conditions: light sensitivity (all the book's monsters that have it, in bright light only) and blinded. New `exhausted-running` (after running for a set number of rounds); its own id, because fae-woodland's `exhausted` is a different rule.

**fae-woodland 0.3.22** (`fixes_fights_statblocks_2026_11_04.py`, `fixes_fights_rules_2026_11_04.py`, `fixes_fights_monster_tables_2026_11_04.py`):
- Every stat block's `description` (146), `abilities` (661, plus each adventurer class's notes and four sidebars printed among the tables: variant monsters, alternative forms, a spell list, a curse), and Behaviour, Speech, Possessions and Hoard in `fields`. The ten conditional values as printed.
- **307 monster tables** in the book's words (traits, encounters, lairs, names and each monster's own), linked from 87 stat blocks as `tables { lair, other }`. Two-column tables and their inline rows are read in order.
- The fight rules in the book's words: saves, attack and damage rolls, surprise and awareness, encounters (sides, attacking, evasion, parley, waiting, reactions, conclusion), initiative, `pursuit` (new), combat (time, actions, declarations, sequence, melee, movement, attacks and modifiers, spacing, magic, disruption, item saves), the "other combat matters" marked optional as the book does (water, invisible opponents, paralysed opponents, switching weapons, unarmed, unstable surfaces) and the seven optional rules, morale, death's door, and healing in the wild and in settlements.
- Morale: `maxChecksPerEncounter` removed (the book sets no cap), and the source corrected.

**The zine 0.5.12** (`fixes_fights_statblocks_2026_11_04.py`): every description and ability in the issues' words, read from the PDFs' layout (154 abilities); two AC fields corrected.

**The build session's fixes** (passed on 2026-11-04; `fixes_build_session_2026_11_04.py` in fae-woodland and the zine):
- fae-woodland's starting adventuring-items pick table is `gmOnly: false`.
- bq3-5 A: no `known` count at Level 1 for the enchanter and two glamour kindred-classes. A third kindred-class's knack has the same pattern and is left for a ruling.
- The zine's material cost table names all four choices (of-12).
- In the options audit: the stale ids and X6.

**The conversion 0.2.4:** rebuilt; the kit check finds 0 blocked lines in both orders.

## 4. Book × pack × app
| Rule | Pack | App | Verdict |
|---|---|---|---|
| Stat lines (AC, HD, attacks, saves, morale, XP, number appearing, treasure) | `fields` | the editor and the GM reference show them; fights are M6 | works (values checked) |
| Abilities and descriptions | `abilities {name, note}`, `description` | the editor; the encounter card shows `description` | works since today. 07's behaviour abilities say `text`: G-128 |
| Several sizes | `variants` | not read (G-60, M6) | ruled |
| A monster's own tables | `statBlocks[].tables` + tables | the tables appear in the Tables list; the links aren't read | G-129 |
| Situational stats ("12 in lair") | the book's words in `fields` | — | G-134 |
| Persons, undead, constructs | tags | not read | G-135 |
| Initiative, surprise, encounter, combat, morale, death, pursuit | the rules-set sections, now in the books' words | the GM reference's Combat panel shows each | works; the extra `pursuit` parts are flagged by `pack:check` (G-127) |
| Morale triggers, death's door, naturals | structured fields (unchanged) | M6 | unread until M6 |
| Statuses | `conditions` | read (Statuses) | works |
| Two settings' monsters in one campaign | 27 shared ids | the top pack wins (eq-4) | G-130, a ruling |

## 5. Options (method step 5)
Every fight option is in `plans/options-audit-2026-11-03.md`, rows 29–57 and 74–78: initiative, ties, morale, weapon damage, AC style, death's door, limits on returning from death, the combat options, crossbow reload, fighter dominance, back-stab increase, attacking when blinded and slow weapons. None changes status (unread until M6). Today's reading adds three points:
- **Slow weapons:** in classic-advanced's book the slow quality and "slow weapons act last" are base rules. The pack's `slow-weapons` option defaults to off, so it turns a base rule off. This is a ruling (§6).
- **fae-woodland's other combat matters:** the book makes them all optional, at the Referee's discretion. Six have no switch; their text now says they're optional (ex-4: optional rules default off, but these are GM judgement, not options).
- **Rules from the options checklist:** the source of fighter dominance, back-stab increase, attacking when blinded and the death's-door details isn't on this machine, so they're not checked against it.

## 6. Rulings pressed on (one at a time; all four ruled 2026-11-04, `design/rulings/m5b-pack-review-area-4-2026-11-04.md`, PR #401)
1. **Slow weapons** (classic-advanced): **ruled fi-1 (2026-11-04):** always on; crossbow reloading is the only option (default off). Applied in classic-advanced 0.6.23 (the option removed; conversion 0.2.6).
2. **Shared monster ids** (G-130): **ruled fi-2 (2026-11-04):** the conversion pins fae-woodland's 27 monsters, restated in classic-advanced terms (the pin carries the setting being played); encounter rows don't name their pack. Applied in conversion 0.2.7 (either stack order now finds fae-woodland's monster).
3. **A kindred-class's knack:** **ruled fi-3 (2026-11-04):** bq3-5 applies; no Level-1 `known` count. Applied in fae-woodland 0.3.24 (conversion 0.2.8). G-119 stays open for M7.
4. **The zine's own twenty classes have no quick-equipment kit** (open since area 3): **ruled fi-4 (2026-11-04):** no kit in the pack (packs follow the book; a GM adds one as campaign homebrew); the Gear step gets a one-line empty state (builder). Closed.

## 7. Passes
- **Pass 1:** the map; the full read of every chapter in §1; the stat-block and table checkers for both settings, the zine and the overlay (by a subagent, §8).
- **Pass 2:** the rebuilds. Every checker was re-run on the new versions (0 differences in values and abilities). Every fix script runs twice with no second change. The kit check ran on each stack.
- **Pass 3:**
  - The split-word scan (every description, ability, table row and rules section: 0 split words; one join fixed in a table's notes; the book's own spellings are kept).
  - `pack:check` on every changed pack: only format notes. They are the `pursuit` parts (G-127), the elementals' size lists beside their variants, and one checker note that's out of date: the checker calls a table's `option` "the old way", while 07 (of-3) allows it. That one is for the builders.
- **Not checked:**
  - The app on screen.
  - The options checklist's rules (no source here).
  - The copy check (information only, ruled 2026-11-03).
  - The campaign volume's NPC stat blocks (area 7) and the everyday mortals' kinds and tables (area 6).
- **Independent re-check:** next, by a fresh `pack-reviewer`.

## 8. The monster overlay
Checked by a subagent (`pack-tools`) against the book by script, then rebuilt by the same agent (`fixes_area4_exact_2026_11_04.py` in the overlay's build folder; text lifted from the PDF, idempotent), and verified here.

**The check (0.1.0):**
- All 20 behaviours' HD, hp averages and morale match the book, and all 23 links resolve.
- The tables have the book's dice and row counts, but about 10 lost dice, ranges or durations, and 2 were mis-filed.
- Fight rules sat only in `numbers` (immunities, damage reduction), so the app would never show them.
- Many attacks' and abilities' numbers were lost.
- 16 of 20 modifications had no stat changes.
- The book's tables for the dragon, the vampire, the werewolf and the zombie had not been imported.
- The shape didn't match 07: `meta.overlays` instead of `meta.requires`, and reaction rows with no `result`.

**The rebuild (0.2.0):**
- The behaviours' profiles, numbers, abilities (immunities, damage reduction, weaknesses, uses), triggers and nudges, in the book's words.
- 35 tables (7 added) with every die, range and duration; the reaction table's rows carry a `result`; `uses` set.
- The modifications' notes, `statChanges` and `adds.abilities`; the lich's minion as a stat block.
- 36 links (13 added, every stat block present in classic-advanced).
- `meta.requires`, kind homebrew.

**Verified here, by script:** 481 of 496 table cells, 50 of 51 abilities, 6 of 7 triggers and all 20 modification notes appear word for word in the book. The rest are joined cells (the reaction table's "A; B") and two items assembled from several cells. 13 nudges have no book line and keep the GM's own words (07 allows either). `pack:check`: clean, except that the checker and importer don't know `overlays` and `modifications` yet (07 says the checker validates them: a builder item). Gaps: G-131, G-132, G-133.

## 9. The independent re-check, reconciled
A fresh `pack-reviewer` found 13 data items and one ruling. All are fixed or ruled. Versions after: classic-advanced **0.6.25**, fae-woodland **0.3.25**, the zine **0.5.13**, the monster overlay **0.2.1**, the conversion **0.2.10** (all in `_current`, Drive synced).

**fae-woodland 0.3.25** (the area-4 chain from 0.3.21, then `fixes_recheck_area4_2026_11_04.py`):
- Six secondary blocks had their whole page as `description`; the book gives them none, so they have none.
- A block with no abilities in the book kept the old paraphrases (two invented abilities). Now the book's list is used even when it's empty.
- Split words: the parser joined a real line-end hyphen with a space and missed drop capitals. Fixed in the joiner, so every block, table and section was re-read.
- Bracketed table headings are read: one monster's two trait tables (they had run into an ability), another's day and night encounters.
- Ranged tables (a reaction table read on 2d6), 55 monster-rumour tables, the monster stats by level table, and the Monster Statistics explainer as the rules set's `monsters`.
- The wyrm overview page: its vulnerabilities table is linked from all four wyrms (it had gone to the block on the previous page), and its rules are on each wyrm as abilities.
- Non-lethal attacks and missile fire into melee: each gets an off choice and defaults off (the book makes every "other combat matter" optional).
- Speed as printed, without the added comma.
- The empty `known` count left by fi-3 is written as a count of 0 (the checker needs a list).

**classic-advanced 0.6.25** (`fixes_recheck_area4_2026_11_04.py`):
- The mercenary morale by troop type table.
- Light and surprise in the book's words ("usually"), replacing an unread true/false.
- **Ruling fi-6** (2026-11-04): an option known only from the newer edition's checklist stays only if its one line is the whole rule, enactable with no guess. Six are kept (default off, source "newer edition, checklist summary"); two of them, training and magic armour size, as "the GM picks" the choice the summary leaves open, each with a `note` (the fi-6 footnote). Five are dropped to the pack's private open-items, "returns when the books are owned"; death's door is one of them, with its `death.byOption`.

**The zine 0.5.13:** two last abilities before an article break no longer run into the next article.

**The monster overlay 0.2.1:**
- **Ruling fi-7:** each behaviour's `profile.morality` in the book's words. The book has no further labelled lines, so `other` is unused.
- Links checked against the book's index: two spider links dropped (the index doesn't pair them); bugbear, dogs, revenant and the rest kept on the index's own lines (34 links).

**Checked after the fixes:**
- The stat-block compare: 0 differences.
- Every fix script runs twice with no second change.
- The kit check: 0 blocked lines on every stack, both orders.
- `pack:check` on every changed pack: only the notes already known (G-127, the elementals' size lists, the checker's table-`option` note the builders are removing).
