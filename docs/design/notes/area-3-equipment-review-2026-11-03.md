# Pack review, area 3: equipment and encumbrance (pack session, 2026-11-03)

The third rule area of `plans/pack-review-method.md`, with the options audit (step 5). Packs:
- classic-advanced 0.6.19 → 0.6.20 → **0.6.21** (after the re-check)
- fae-woodland 0.3.19 → 0.3.20 → **0.3.21** (after the re-check)
- the zine overlay 0.5.10 → **0.5.11** (after the re-check)
- the conversion (conv-fae-woodland-to-classic) 0.2.0 → 0.2.1 → 0.2.2 → **0.2.3**, rebuilt from fae-woodland 0.3.21, with classic-advanced's shared items pinned

Shapes only here: no rules text, numbers or names from the books. The parsers are kept with the private packs (`packs/_design/review_tools/`).

## 1. Map
| Book chapters | Pack parts | App (read-only, `main`) |
|---|---|---|
| classic-advanced, players' volume: adventuring gear, weapons and armour, weapon qualities and combat stats, poison, vehicles and animals (animals of burden, dogs, tack, land vehicles, water vessels, ship weapons, vessel combat and crew), encumbrance, wealth (coins, starting money) | `items`, `itemCategories`, rules set `encumbrance` (armour, coin, containers, treasure weights), `currency`, `startingMoney`, `startingKits` | `modules/inventory/*` (encumbrance, equip checks, pack view), `app/AddItem`, `PackScreen`, `StartingGear`, creation's Gear step |
| fae-woodland, players' volume: equipment, services and animals (gear, light, camping, holy items, tools, clothing, coinage, weapons, armour, ammunition, qualities, special metals, horses and vehicles, hounds, lodgings and food, beverages, pipeleaf, fungi and herbs), encumbrance (weight, basic, slots) | the same, plus `itemSlotRules`, `weaponQualities`, `specialMetals`, `vehicles` | the same |
| The zine overlay: firearms, energy weapons, the expanded gear list, dungeon mounts, materials, potions, quick equipment, item encumbrance | its items, cost tables and options | the same |

## 2. Values by script
| Pack | Checked | Result |
|---|---|---|
| fae-woodland | 97 gear, weapon, armour and ammunition rows: cost, weight, capacity, damage, size, qualities, AC, bulk. 73 horse, vehicle, hound, drink, pipe, pipeleaf and herb rows: cost, load, vehicle stats, availability. Every item's slots against the slot table | All match except the items below |
| classic-advanced | 73 gear, weapon, ammunition, armour and combat-stat rows; container capacities; the animal, dog, land-vehicle and 14 vessel rows; tack; treasure weights; currency and starting money | All match except the items below |
| The zine overlay | 82 priced rows in the six issues (firearms by era, energy weapons, gear, mounts and their gear) | All match (the checker's few flags were its own name matching) |

## 3. Fixed today
**fae-woodland 0.3.20:**
- **Two-use items:** the oil flask (burning) and the torch (flaming) are in the book's weapon table, but the items had no weapon data. They now carry it, and holy water gets its size. The book names these items in the friar's and magician's weapon lists, so every kit stays usable (checked).
- **Uncommon items:** the 29 gear items the book prints in italics are sold only in towns and cities. Marked with the `availability` word the pack already uses on services (G-121 asks for a ruled field).
- **Load:** mounts, tack, vehicles and vessels sit outside a character's load (`separateCategories`, as classic-advanced has).

**classic-advanced 0.6.20:**
- **Dogs:** their travel figures added.
- **Rafts:** both added (makeshift and professional).
- **Ship weaponry:** catapult, shot, pitch shot, and both rams.
- **Vessels:** every vessel's combat stats (AC, hull points, mercenaries, ram, catapults) and crew table (captain, rowing and sailing crews, miles a day, movement).
- **Land vehicles:** carts' and wagons' AC and hull points.
- **Animal armour:** dog armour's and horse barding's AC.

**Tried and reverted:** giving classic-advanced's oil flask, holy water and torches their weapon data, as fae-woodland now has. Their book keeps them as gear with separate weapon rows. Its classes' weapon lists don't name them, so the magic-user's, cleric's, druid's and acrobat's own kits were refused. The separate weapon items stay.

**The conversion 0.2.1:** rebuilt from fae-woodland 0.3.20. The kit check on the fae-woodland + classic-advanced + conversion stack is clean, and so is classic-advanced + the zine + deathcaster-class.

**After the independent re-check (§8):** fae-woodland 0.3.21, classic-advanced 0.6.21, the zine 0.5.11 and the conversion 0.2.3.

## 4. Book × pack × app
Corrected after the independent re-check: five rows said "works" where they didn't hold.

| Rule | Pack | App | Verdict |
|---|---|---|---|
| Item cost, weight, bundles, slots | every item | read (Add item, the load, bundles' `perUnits`) | works since the re-check: the zine's darts, candles, chalk, caltrops and marbles had no bundle (fixed in 0.5.11) |
| Containers' capacity, hold-only or adding | `container.capacityCoin`, `containers` | read | works since the re-check: the zine's belt pouch, iron boxes and chests had no container block (fixed). The magic bag's weight is given only when full: G-124 |
| Weapon size and the size-limited classes | `weapon.size` plus the size tag (area 1) | the equip check reads tags | works in fae-woodland. In the conversion stack, classic-advanced's weapons are pinned (§8) and carry no size |
| Armour types and bulk | `armourType` (area 2) | read (equip check, basic load) | works since the re-check in the two settings. The zine's five types had no row in the basic load (mapped in 0.5.11); whoever may wear them goes by `armour.tier`, which the app doesn't read yet (G-65, ruled); studded leather's tier was wrong (fixed) |
| Misc gear as a flat weight | `miscGearCoin` with `miscGearCategories` | read in coin mode | works in classic-advanced. In fae-woodland it could never apply (no categories, and every gear item has a weight): now reference text |
| Treasure weights by category | `treasureWeights` | read | works since the re-check: fae-woodland's map didn't name `treasure`, so basic weight counted no treasure (fixed) |
| A carry-limit bonus from an item (gauntlets) | text in the item's properties | not read | G-123 |
| Firearms by a class's martial category | weapon tags `Firearm` plus the kind; the rule in notes | not read | G-125 |
| A rolled trinket's weight | the trinket tables' description | not read | G-126 |
| Special metals (cost factor, damage against fairies) | `specialMetals` (reference) | not read | reference |
| Where an item is sold, and its chance in stock | `availability` (text) | not read | G-121 |
| Armour worn by an animal | `armour.for` | not read | G-122 |
| Mounts' loads and travel figures; vehicles' and vessels' stats | `animal`, `vehicle` | loads in the load bar; travel speeds only through the mode's `mounted` / `vehicle` | partly (water travel: G-106) |

## 5. Options (method step 5)
Encumbrance, containers, buy equipment, disallowed gear, the zine's materials, firearms, energy weapons, quick equipment and item encumbrance are in `plans/options-audit-2026-11-03.md`. None changes status here. The materials and energy-weapons gate is with the designer (a gate on several choices).

## 6. Gaps
- **G-121:** item availability as data (towns and cities only, a chance in stock, by inn quality).
- **G-122:** armour worn by an animal.
- **G-123:** a carry-limit bonus from an item.
- **G-124:** a container whose weight depends on how full it is.
- **G-125:** weapon use by a class's martial category, beside the class's own list.
- **G-126:** the weight of an item rolled on a table (trinkets).

## 7. Passes
- **Pass 1:** the map, the full read, the item checkers for both settings and the zine, the slot check.
- **Pass 2:**
  - The fixes rebuilt, and every checker re-run.
  - The kit check on each stack. It found the classic-advanced regression above, now reverted.
- **Pass 3:** pack:check on every changed pack (only the known notes), idempotent rebuilds, the copy check (information only). Nothing new.
- **Not checked:**
  - The app on screen.
  - Poisons (they belong with fights, area 4).
  - Magic items (area 5).
  - Lodgings, services and food prices (area 6).
- **Independent re-check:** done by a fresh `pack-reviewer`; reconciled in §8.

## 8. The independent re-check, reconciled
**fae-woodland 0.3.21:**
- `treasureWeights` names `treasure`.
- Small trinkets' weight in each trinket table's description (G-126 for a field the creation step reads).
- Rider weights on each horse and in the coin notes.
- The misc-gear simplification is reference text: its fields were unread and could never apply.

**classic-advanced 0.6.21:**
- The five magic and cursed shields get `material` wood and metal, like the plain shield (knights and druids were refused them).
- The magic bag notes that its weight is given only when full (G-124). The app counts 600 always, the safe side for the load.
- The strength gauntlets: the Encumbrance heading had merged into the unarmed-attacks property; now its own property (G-123).
- Notes on the lifeboat (its weight comes out of its ship's cargo), the canoe (two can carry it) and the river boat (a roof costs extra).

**The zine overlay 0.5.11:**
- Studded leather's tier is chainmail; the thieves' optional use is in its notes.
- The overlay maps its five armour types to light or heavy (merged over the base's map).
- Dungeon-mount barding is tack, not armour (it put 800 coins on the rider's load).
- Bundles, five containers and two light types (candles, the bullseye lantern).
- Quick equipment as 11 kits in the 07 rolled-kit shape, one per class line or group of identical lines. Crossbow rows give 20 bolts (`units`). With the option on: 3d6 gp and no shop.
- The STR bonus adds to packed items only; the weaker-materials note lists every unaffected item.
- Firearms carry `Firearm` and their kind as tags (G-125).
- The phase elf's fighter-phase armour and weapons are what the app checks; the other phase stays text (G-64, wontfix).
- Every level-0 background item has a category; the jewelled dagger has its weapon line; the showy jewellery its value. The zine gives none of them a weight.
- Power cells lose a weight the zine never gave (a weapon's weight includes its cell).

**The conversion 0.2.2 and 0.2.3:** classic-advanced and fae-woodland share 35 item ids with different stats. In a campaign the higher pack's entry is used; the GM can pick another per item. A new setting pack lands on top. With fae-woodland on top, its armour (typed light, medium, heavy) is refused by the converted classes: the kit check finds 23 blocked lines, against 0 with classic-advanced on top. Ruled 2026-11-04 (Francis): the conversion pins classic-advanced's entry for all 35 ids. Conversion **0.2.3** carries them, and the kit check finds 0 blocked lines in both orders.

**Checked after the fixes:** pack:check on all four (no new notes); every build script run twice (idempotent); the kit check on classic + zine + deathcaster (0 blocked) and on the conversion stack in both orders. Not checked: the app on screen; the quick kits in the creation step. The copy check is information only (the private packs may keep the books' wording).

**Not covered by the quick-equipment kits:** the zine's own twenty classes have no line in its table, so they get no quick kit.
