# Pack review, area 5: magic and advancement (pack session, started 2026-11-04)

Method: `docs/plans/pack-review-method.md`. Areas 4–7 are reviewed and ruled now, planned and built in their own
milestone (area 5: M7). Only a fix to something already in play is built at once. The private packs keep the books'
exact wording. This note names shapes and counts only: no page numbers, dice or rules text (those stay in the
private packs and in chat).

## 1. Map

**The books** (every chapter below is read in full in step 2).

| Pack | Chapters for area 5 |
|---|---|
| classic-advanced | Players' volume: Advancement (experience, level titles); Magic (spells, turning the undead, spell books, magical research, the four spell lists); the four spell chapters by level; each casting class's entry (spells per day, turning table, spell books, research); the multiple-classes optional rule. GM's volume: Awarding XP; magic items that cast or store spells (scrolls, spell books) |
| fae-woodland | Players' volume: Advancement (in the opening chapter); Magic (arcane, fairy magic: glamours and the three rune tiers, holy magic, the burrowkin's knacks); each casting class and the five kindred-class appendices; the appendix on religion (saints, for holy spells). GM's volume: Awarding XP; magic items |
| zine overlay | Every issue's casting classes with their powers, runes and spells; the common spells; the deities' spells (trait-list `spells`); the cantrips option; level 0 (M7) |
| deathcaster-class | The whole booklet: the class, its spell list, its spells by level |

**The packs today** (classic-advanced 0.6.34, fae-woodland 0.3.30, zine 0.5.22, deathcaster 0.5).

| Part | classic-advanced | fae-woodland | zine | deathcaster |
|---|---|---|---|---|
| `spells` | 182 | 150 (spells, glamours, runes, knacks) | 71 (runes, powers, spells) | 66 |
| `spellLists` | 4 | 5 | 3 | 2 (its own; one for magic-users, behind an option) |
| Casting classes (`spellcasting`) | 11 | 8 | 6 | 1 |
| Spell fields | id, name, `lists` {list: level}, `castingTypes`, range, duration, notes, source, blurb; saves, concentration, reversible / `reversedName`, `conditionId`, `lightTypeId` on some | the same, plus `prayerName`, `saint`, `magnitude`, `tiers` | the same, plus `fields` | the same, plus `refs` |
| Spellcasting fields | `type`, `castingType`, `listId`, `fromLevel`, `maxSpellLevel`, `reverseAt`, `firstSpells`, `learnByLevel`, `scrollCopy`, `known` | the same, plus `runesListId`; glamours by level in `progression` | the same | the same |
| Progression (per level) | xp, hitDice, hpGain, thac0, attackBonus, saves, `spellSlots` | the same, plus glamours, skills, combat talents, AC bonus | the same, plus `extra`, `armourClass` | the same |
| Turning | classes' `turningTableId` → a table per class (2) | (to map in step 2) | none | none |
| Advancement | rules set `xp` (sources, one level a session, excess, the split, retainers' share, monster XP table), `levelUp.autoFill`, `levelLoss`, `primeRequisiteXp`, classes' `primeXp`, `levelTitles`, `xpTables` (22) | `xp`, prime requisite rule and table, `xpTables` (14) | `xpTables` (20), `levelZero` (M7) | `xpTables` (1) |

**The app today** (read-only grep; the full book × pack × app table is step 4). Creation reads `firstSpells` (the first-spells step) and the class's spell list. Play reads `spellSlots` (the Player screen's prepared spells; the sheet's slots). Level-up fills the `levelUp.autoFill` columns. Not read yet (M7): turning tables, `learnByLevel`, `scrollCopy`, `reverseAt`, the XP award rules (`xp`), level titles, level loss, magical research, spell books as items.

## 2. classic-advanced (read in full; values by script)

| What | Compared | Result |
|---|---|---|
| Spells | 212 book entries (every list): list, level, duration, range, reversed name (`review_tools/ca_spells_book.py`) | 0 differences after the fixes below |
| Turning tables | both classes' tables, row by row | equal |
| Monster XP table | every HD band, base and bonus | equal |
| Advanced spell-book INT table | every row (the book's column read from a rendered image) | equal |
| Level titles | every class (22) | equal |
| Spells learned per level (magic-user) | against the growth in spells per day | equal |
| Spells per day, XP tables, HD, saves | area 1 | (done in area 1) |

**Fixed (0.6.35 → 0.6.37):**
- Four spell durations had extraction spacing, one scrambled: now the book's line.
- A spell reversible on one list only (the other list's entry has no reversed form) was reversible on both: now keyed by list (07). The pop-up reads that key for range and duration, not for `reversible`: G-137.
- The two turning classes' "turn undead" notes were summaries missing what turned and destroyed undead do and that excess Hit Dice are wasted: now the class entry's own section. The optional turning-limits rule had dropped one of its three guidelines: now all three, in the book's words.
- The XP rules (`xp`) were summaries: now the book's lines (one level a session, levelling up, the prime-requisite modifier, the division among survivors, the referee's bonuses and penalties). The app-read keys are unchanged.
- The spell-book option's notes were summaries: now the book's paragraphs (standard; advanced, optional).
- New `rulesSets[].magic` reference section, the book's words: spells, memorising, casting, spell effects, arcane and divine (when a spell is reversed, deity disfavour, reversed spells by alignment), spell books lost and captured, magical research. No format home: G-139.

**Checked, right:** every caster's `reverseAt` (arcane at memorising, divine at casting: 11 classes); the retainers' half share (from the hired-help chapter).

**Gaps:** G-137 (a spell field keyed by list, read for range and duration only), G-138 (the turning procedure as data), G-139 (a setting's general magic rules).

**Also fixed (0.6.38, 0.6.40):** every spell's `notes` is now its full book text (the exact-wording ruling; they were summaries): 182 spells, 10 keyed by list where the lists' texts differ. The reincarnation spell's four sidebar tables were missing (the text layer had run them into the next spell): added as tables, ranges and Hit Dice read from the rendered page. The level-loss note and the multiple-classes option in the book's words (the `midpoint` value was already right).

## 3. fae-woodland (read in full; values by script)

| What | Compared | Result |
|---|---|---|
| Spells, glamours, runes, knacks | 150 entries, every section: rank, duration, range, prayer name (`review_tools/fw_spells_book.py`) | 0 differences |
| Random tables | the six arcane rank tables, glamours, the three rune tiers, knacks, rune granted | equal |
| Magic rules (`magic` section) | every structured value (spells per book, mentor, study, research, rewrite, failure chance, rune usage) | equal |
| Milestone and deed XP table | every row | equal |

**Fixed (0.3.31 → 0.3.35):** every entry's `notes` is its full book text (were summaries); two sidebar tables inside spells were missing (a confusion behaviour table, a teleport result table; one cell read from the rendered page): added. The `magic` section gains each part's book text beside its values. The cleric's and friar's turning were summaries missing that concealed undead are unaffected: now each class's own section. The `xp` text fields and the six optional XP award options, simple spell books, quests for runes and training: the books' words.

## 4. The zine overlay (read in full; values by script)

| What | Compared | Result |
|---|---|---|
| Spells, powers, runes | 71 entries, each found in its issue: duration, range (`review_tools/zine_spells_book.py`) | 0 differences after the fixes |
| Cantrips known | the count table | equal |
| Grimoires (spell books found as treasure) | five tomes' spell lists | equal |

**Fixed (0.5.23 → 0.5.26):** every entry's notes in its issue's words; six reworded durations to the issue's line; the nine powers gain the duration and range they lacked; the three magic options and the five grimoires in the issues' words (author and spells as printed).

## 5. deathcaster-class

72 booklet entries: the class's 66 own spells (0 differences after the fixes) and 6 base-setting spells its list reuses by id, printed identically in both books (checked). **Fixed (0.6, 0.7):** the 66 notes in the booklet's words; eleven reworded durations and one range to the booklet's line.

## 6. Options (method step 5)

Every magic and advancement option re-checked against the books and `src/`: `plans/options-audit-2026-11-03.md`, "Area 5 re-check". Two rows were stale and are corrected: the staff gate works now, and the cantrips have one switch (the overlay's), read by creation. The rest are unread until M7; their notes now carry the books' words.

## 7. Passes

- **Pass 1:** the values above, by script, per pack.
- **Pass 2:** each spell's `saves` and `concentration` against its own (now full) text. Found: 35 spells whose text calls for a save the pack didn't list (12, 4 and 19 by pack; the overlay listed none), and save keys written as words in two packs while their rules set keys them by letter (80 normalised). Seven overlay entries held by concentration lacked the flag. Bonuses to saves are not saves (not added). Fixed; re-run clean (0 mismatches in all four packs).
- **Pass 3:** the remaining summaries in the area (level loss, multiple classes, training), and every comparison re-run on the final versions: 0 differences; every kit clean in every stack order; `pack:check` on each campaign stack shows only the known notes plus G-137's.
- **Not checked by script:** spells per day, XP tables and the class columns (area 1 did them); the art of the spells' own embedded tables (kept as running text in the notes).

**Gaps:** G-137 (a spell field keyed by list: the pop-up and the checker), G-138 (the turning procedure as data), G-139 (a setting's general magic rules).

**Versions:** classic-advanced 0.6.40, fae-woodland 0.3.35, zine overlay 0.5.26, deathcaster-class 0.7, conversion 0.2.27 (all in `_current`, Drive synced).

## 8. The independent re-check, reconciled

A fresh `pack-reviewer` (2026-11-04) parsed the books itself before reading this note: 9 disagreements, 13 missed items. Its most serious find was in this session's own tools: every parser, and the shared text helper, dropped any line holding only a number as a page number, so the number columns of tables printed inside spells were lost from the notes while the comparisons still said "0 differences". **Fixed at the root:** a number line counts as a page number only near the top or bottom of its page (`review_tools/pagenums.py`); every parser re-run, every note re-lifted.

| # | Finding | Outcome |
|---|---|---|
| D1 | Numbers lost from tables inside spells (seven spells, four packs) | fixed (the root cause above) |
| D2 | Tables inside spells kept only as text | fixed: added as tables (seven classic-advanced, three overlay). fae-woodland's two take its `s2-` prefix, since classic-advanced now has tables with the same ids |
| D3 | A knack's text ran into the next chapter | fixed (the parser stops at a chapter opener) |
| D4 | Seven overlay entries whose Duration is concentration lacked the flag | fixed (every entry with that duration) |
| D5 | Level loss: two rules by source, one value | the note quotes both with their sources; G-140 |
| D6 | The XP and death reference panels and the monster XP notes were summaries | fixed (the books' words). The panel's death's-door entry is removed: that option left the pack under ruling fi-6 |
| D7 | classic-advanced's training option isn't in these books | no change: kept under ruling fi-6 (a newer-edition option, labelled as such, default off) |
| D8 | The cantrip spells weren't gated by the cantrips option | fixed (`option` on each) |
| D9 | The turning gap assumed one shape | G-138 now names both settings' shapes |
| M1, M2 | Two classes lacked their research ability; the casters' research notes were summaries | fixed (the class entries' words, seven classes and the deathcaster) |
| M2 | The staves options, the overlay's mental powers and rune magic were summaries | fixed (the books' words; one more class's mental powers too) |
| M3 | The overlay's power-use and talisman paragraphs were missing | fixed |
| M4 | The GM's advancement and research-balance guidance was missing | fixed (`xp`, `magic` sections) |
| M5 | Conjured creatures have no stat blocks | G-141 |
| M6 | Cult spells sit on every cleric's list | G-62 extended (stays until M7 reads the deity's add and replace) |
| M7 | The overlay's spells-join-the-list option needs `extends` | G-80 extended |
| M8 | Blurbs cut off mid-word | fixed (rebuilt from the entry's first sentence) |
| M9 | A class whose list is the GM's choice | G-142 |
| M10 | A reversed form's own range | G-143 |
| M11 | Hyphenation leftovers | fixed (line-end hyphens joined; real compound hyphens kept) |
| M12 | A stray heading; knack tiers and the shrine option were summaries | fixed (the books' words; the shrine section gains its text) |
| M13 | Three deathcaster tables reworded | fixed (the booklet's words) |

**Re-run on the final versions:** every spell comparison 0 differences (the deathcaster's six reused base spells by design); every spell's notes are its book text in all four packs; concentration and saves consistent with the text; every kit clean in every stack order.

**Versions:** classic-advanced 0.6.42, fae-woodland 0.3.36, zine overlay 0.5.27, deathcaster-class 0.8, conversion 0.2.28.

**Not checked (the reviewer's list and this session's):** the app on screen; scrolls and magic items as items (area 6); the conversion pack's own entries; glamour and rune counts per level (area 1).

**Gaps from area 5:** G-137 … G-143 (and G-62, G-80 extended).

## 9. The second independent re-check, reconciled (2026-11-05)

Verdict: not clean (4 disagreements, 7 missed). All reconciled:
- One table number at a page's very bottom edge was still dropped (a deathcaster spell): the page-number rule now also requires the number to be close to the page's own number. Fixed and re-lifted.
- Soft hyphens were joined with a space in texts lifted by the shared helper: it always joins now.
- Casting classes' magic abilities in fae-woodland, the overlay and the deathcaster, and a few overlay options, were still summaries: replaced by the books' words in the text pass (`text-pass-areas-1-3-2026-11-05.md`). classic-advanced's were already fixed in its unsynced build.
- fae-woodland's arcane and holy magic texts gain their chapters' opening rule sentences; rune use reads as printed.
- The overlay's runes lose an invented range; the deathcaster gains its own staves option (its gate was the base setting's), its pack note is current, and its six copied spells cite the booklet's pages.
- Blurbs cut with an ellipsis are app wording: the rewrite pass after the text pass.

**Versions:** classic-advanced 0.6.45, fae-woodland 0.3.38, zine overlay 0.5.29, deathcaster-class 0.10, conversion 0.2.29. A third re-check covers this and the text pass together.

## 10. The third independent re-check, reconciled (2026-11-05)

It covered area 5 and the text pass together. Verdict: not clean (6 disagreements, 9 missed). The spell data was right throughout: every spell's duration and range, saves, concentration, reversed forms, list levels, the turning tables and every class table. The faults were in the text pass:
- **Scope:** the pass read five field names only, so about 216 rules texts under other keys were still the pack's words (save rule, ability and alignment notes, magic and shrine panels, combat, dungeon and hazard lines, seasons, class kindreds…), and table cells kept as lists were never checked. Both tools now read every string except app text, names and references, and a new cell audit reads lookup tables. Round 2 replaced 161 texts and 79 cells and rebuilt 6 tables to their printed columns (`text-pass-areas-1-3-2026-11-05.md`, Round 2).
- **Lost values:** some replacements dropped numbers the old text held (the overlay's poison detection and outcomes, two stronghold costs, two class abilities cut to their opening sentence). The apply step now refuses a replacement that loses a number unless the proposal says where the pack holds it, and all were restored.
- **Wrong passage:** three class abilities had pulled in a level table's legend. The apply step now refuses a legend that wasn't in the old text.
- **Hyphens:** real compound hyphens split at line ends were joined (a chance written as "x-in-y", "human-sized"…). The line joiner keeps a hyphen before a number; a scan compares every pack word with the book's mid-line forms; 26 restored across the packs.
- **Regressed:** the level-loss note is back to both book rules with which drains use which; text-dump page markers cut; the known-cantrips note is the overlay's words; one option's question no longer claims the odds are equal.

**Versions:** classic-advanced 0.6.50, fae-woodland 0.3.41 (with area 6 part B), zine overlay 0.5.31, deathcaster-class 0.11, conversion 0.2.30. A fourth re-check follows.
