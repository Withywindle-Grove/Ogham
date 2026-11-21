# Pack review, area 6: settlements, hirelings, downtime, treasure (pack session, started 2026-11-05)

Method: `docs/plans/pack-review-method.md` (lessons from area 5 applied: number lines are kept unless at a page's edge,
tables printed inside entries are checked, every text is the book's own). Area 6 is read by M7 (downtime converts at
M7 step 1); only a fix to something in play now is built at once. Shapes and counts only here: no page numbers,
dice or rules text.

## 1. Map

**The books.**

| Pack | Chapters for area 6 |
|---|---|
| classic-advanced | Players' volume: Hired Help (retainers, mercenaries, specialists), Strongholds (and domain management), wealth. GM's volume: Designing a Base Town, Strongholds, Treasures (placing treasure, treasure types, magic item tables), the Magic Items chapter (every category), sentient swords |
| fae-woodland | Players' volume: settlements, services, retainers and hirelings, equipment's trade goods. GM's volume: Settlements, the Treasures and Oddments chapter (placing treasure; gems and art objects; magic items in twelve kinds; trade goods; enchanted oddments; rare comestibles, fungi and herbs) |
| zine overlay | Town services, hiring retainers, specialists, potions (costs, ingredients, sampling, descriptions), magic sword traits, inns, energy weapons in treasure, magic armaments |
| downtime-reference | The whole booklet (a reference for M7's downtime design, not a playable pack) |

**The packs today** (classic-advanced 0.6.42, fae-woodland 0.3.36, zine 0.5.27).

| Part | classic-advanced | fae-woodland | zine |
|---|---|---|---|
| Treasure types | 22 | none | none |
| Treasure tables | gem values, jewellery, the top-level magic item tables (two), sentient sword powers | none | sword traits (four), potion descriptions (four), energy weapons in treasure |
| Magic items | 252 (misc 125, weapons 41, potions 21, rings 16, wands 16, staves 11, armour 11, rods 8, scrolls 3) | none | potions 5, misc 5 |
| Hirelings | rules set `retainers`, `mercenaries`; mercenary and specialist tables; hiring reaction | `retainers` (finding, loyalty, wages, applicants, kindred and class tables) | `retainers`, retainer tables, specialists |
| Strongholds | rules set `strongholds` | none | none |
| Settlements and downtime | `settlement.services` | `settlement` (services, sizes, availability, sale price), `downtime` (lodgings, lifestyles) | `settlement` (reference text), `downtime.lodgings`, inn tables |

**Parts** (each its own pass, then one re-check for the area): A classic-advanced treasure and magic items; B fae-woodland's treasures and oddments; C hirelings, strongholds and settlements in every pack; D the zine; E downtime-reference (its format question first).

## 2. Part A: classic-advanced treasure and magic items (done, 0.6.46–0.6.48)

- **Treasure types:** all 22 match the GM's volume field by field.
- **Tables:** 39 checked cell by cell: the magic item type tables (their rows now open each category's table), every category roll table, the tables printed inside fourteen item entries (each item points at its table), seven sentient-weapon tables (they replace a cut-down list), gems and jewellery (jewellery in the book's words).
- **Items:** every magic item with a book entry carries its opening description and labelled parts word for word; the generic magic armour carries the book's general sections; 31 enchanted and cursed weapons the tables name were missing and are added on their ordinary base (typeless axes and bows pick their type when found, like swords: mb-1 extended); one treasure map item added.
- **Worn items** (mb-5): rings and the magic items worn on the body carry `slot: "worn"` (58); carried charms do not.
- New gap: items pointing at their own table (G-144).

## 3. Part B: fae-woodland's treasure (done, 0.3.41)

The pack had none of the GM's volume's treasure chapter. Built from it in the book's words:
- 36 treasure types (coins, riches and magic codes, as the stat blocks' hoard lines name them; every code a monster uses exists);
- 58 tables: the hoard table, the magic item type table (each row opens its kind's table), coin appearance, gems and art, and each kind's roll, appearance, power and oddity tables; trade goods;
- 286 items: twelve kinds of magic item, enchanted oddments, rare comestibles, rare fungi and rare herbs (the pack's twenty herbs were the common ones);
- magic armour sits on its ordinary armour (the book's bonus, weight and bulk rule); "armour and shield" results give both items;
- rings, amulets and garments are worn (mb-5);
- the chapter's rules (placing treasure, coins, gems, art, each kind's limits and use) as one GM reference panel;
- 25 items whose names the other setting also uses get their own ids, so the conversion's pinning stays on ordinary gear.

## 4. Part C: hirelings, strongholds and settlements (done)

- **classic-advanced (0.6.52):** the hired-help and stronghold panels were stitched summaries: now the book's whole sections (duties, recruitment, shares, experience, loyalty, ill will; mercenaries and specialists; construction steps in order, permission, structure descriptions, domain management, interior features). New panels: designing a base town (with its population table) and wealth (with the coin conversion table). The guard town service added; the hiring reaction table's cells as printed; the mercenaries table gains each troop's equipment. A "Lodgings" town activity was left out: the app has its own lodging picker.
- **fae-woodland (0.3.43):** retainer, specialist and settlement texts whole; the specialist services panel; mercenary wages and the builder's costs, which the pack lacked; five hireling stat blocks; four town activities; storage and loans.
- **Overnight healing (sf-2):** fae-woodland heals a fixed amount a night in a settlement, and nothing on the wretched lifestyle; its full day of rest offers the book's rolled heal. classic-advanced's book heals only per full day of complete rest: `settlement.overnight.onGoodRest: []`, and its full-day heal stays text until M7's downtime gives it a home (sq-5).

## 5. Part D: the zine (done, 0.5.33–0.5.35)

107 fixes: hiring, potions, town services, inns, magic swords, energy weapons and tavern games panels whole; potion sampling, ingredient and sword tables as printed; a dungeon mount accessories table. The overlay's rules set now extends classic-advanced's and carries its town services (valuation behind its option), sale price, storage and loans (ov-1); potion prices come through five option patches (ov-2).

## 6. The fourth independent re-check, reconciled (2026-11-05)

It covered parts A and B and the text standard. Verdict: not clean (9 disagreements, 13 missed). Reconciled:
- **classic-advanced magic items:** the entry parser let entries run into the next section, a category's general rules or a table. Rebuilt by the book's headings: 284 items carry only their own entry; variants printed inside an entry are named properties; charges as printed; the treasure map and cursed armour whole; every magic roll table row gives its item; the magic items panel whole, and a "Treasure rules" panel with the chapter's rules the pack lacked (placing treasure, items of value, sentient swords).
- **fae-woodland:** magic armour keeps its ordinary armour's category for who may wear it (it had been made lighter for that too) and carries its AC figure; the lighter bulk waits on G-145. Four texts cut at a page break whole; the magic items overview; magic weapons (none existed); charges on rods, staves and wands; instruments' weight; more worn items.
- **Tools:** strings inside lists (class restrictions, procedure steps) and short rules lines now count as rules text (round 3: 92 replaced); the cell audit now reads single-value rows and short results (round 2: 31 set, 7 tables rebuilt to the printed columns, rolled tables keep their ranges with the printed cells); column headings are recorded by position (a bug had flattened seven tables' heading lists).
- **App gaps routed to Build:** lookup tables blank on the GM tables screen (being fixed before the gate); the worn slot was already read on main.

**Versions:** classic-advanced 0.6.56, fae-woodland 0.3.46, zine overlay 0.5.35, deathcaster-class 0.12, conversion 0.2.31. Remaining unexplained rules texts and cells: 0 in every pack (kept texts listed with reasons). A fifth re-check follows.
