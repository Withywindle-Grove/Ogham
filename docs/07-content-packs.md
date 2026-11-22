# 07 — Content Packs (format spec)

Content packs hold everything game-specific: items, classes, races, XP tables, rules settings and options, spells, stat blocks, conditions, light types, tables, treasure types, starting kits, rule hooks, calendars and sheet layouts. The app ships with **none**.

In the app's UI a pack is called **Setting rules**, and its options are **Optional rules**. The file format and developer terms stay as they are (`tabletop-pack`, this document).

- A pack's `meta.kind` is `setting` (rules, classes, items…) or **`adventure`** (an adventure's encounter tables, new monsters, handouts). Same format, same import, same privacy. A campaign attaches one or more settings and any number of adventures. A pack may also be **`homebrew`** (house rules); every homebrew pack, the campaign's own included, sits in the homebrew layer above all setting and adventure packs (ruled 2026-10-24).
- Converting is done by the `content-pack-converter` skill: a manager with five specialists (see Adventure packs (format version 3), The converter).

## IP rules

- Packs are **private** to the account that imports them and the campaigns they're assigned to. No sharing between accounts in R1.
- Packs are never committed to the app repo. `.gitignore` excludes `packs/`.
- **Private packs may keep the books' exact wording** (rules text, item and monster descriptions) when the owner has the book: the pack stays private to the account and its campaigns, and rules must be exact (ruled 2026-11-03, [ip]). The 8-word copying check is information only.
- The example data in this document is invented and generic.
- Private packs may use the real names and content of books the owner has. The app's code, docs and tests never ship them.
- Any entry may carry `source`, a page reference such as `"Book p. 42"` (or an object keyed by class when pages differ).
- **A pack carries nothing written for the app that isn't in its book** (cw-10, 2026-11-06, `design/rulings/m5b-gate-creation-words-2026-11-06.md`): test content written for the app comes out of the packs, and the gate's kit checks use a real pack's kits.
- **Pictures for the homebrew packs** (art-1, Francis, 2026-11-14) are proposed only from public-domain and free-licence sources, each with its source and licence recorded: historical works to about the 1540s, modern fantasy art, and later works depicting an earlier time. Nothing enters a pack without Francis's pick.

### Adventure packs: content rules

- Aim for completeness: everything the app tracks or could show players.
- Mechanics in full.
- Every entry carries a page reference (printed pages).
- Descriptions as long as needed, in the book's wording or your own (ruled 2026-11-03).
- Clues listed one by one.
- Exact quotes only where the wording is the clue (riddles, inscriptions, passwords, verses, spoken lines).
- Images from the owner's own copy: maps, handouts and player-facing art (GM only or can reveal), plus crops of read-aloud boxes and room descriptions (always GM only).
- Nothing else copied word for word.

## Two accepted formats

1. **JSON** (canonical). What the app stores and exports.
2. **Structured Markdown** (human-friendly). The app converts it to JSON with a simple, deterministic parser: no AI.

The app does **not** read PDFs. Converting a PDF happens outside the app, using the `content-pack-converter` skill with Claude, or any LLM given the instructions in the appendix. `npm run pack:check -- <file>` checks a pack with the app's own reader before importing: the counts the import preview will show, anything left out and why, and entries the in-app editor would ask to fix, plus format notes on the parts the app reads from M7 (Characters, XP and spells). Empty values may be left out or written as `null`.

## JSON format (version 1)

The format ID "tabletop-pack" is frozen. It does not change if the product is renamed.

```json
{
  "format": "tabletop-pack",
  "formatVersion": 1,
  "meta": {
    "name": "My table's gear and monsters",
    "shortName": "Table gear",
    "version": "1.0",
    "source": "Personal conversion of my own books",
    "author": "Francis",
    "notes": "Private use"
  },
  "fieldTemplates": [],
  "items": [],
  "classes": [],
  "xpTables": [],
  "rulesSets": [],
  "conditions": [],
  "lightTypes": [],
  "statBlocks": [],
  "tables": [],
  "calendars": []
}
```

`meta.shortName` (optional, from M4): a short name for rules popups ("From your setting: Table gear · p. 12"); without it, the pack's name is used.

`meta.id` (every pack kind, from M8b): a stable slug that never changes with the pack's name. References to a pack use it; a pack without one falls back to the slug of its `shortName`.

`meta.replaces` (optional, every pack kind; ruled 2026-10-30): `["<old id>", …]`, the ids this pack used before. It lets a pack change its `meta.id` without becoming a new pack. The app's support for it lands before the M6 pack candidates are imported (08).

| Where | A replaced id… |
|---|---|
| Update pack | A file whose `replaces` lists an imported pack's id is that pack: a new version, not a new pack (the preview, the log line and the campaigns using it work as for any update). |
| `meta.requires` | Naming an old id resolves to the pack that replaces it. |
| Overlay `links[].packId` (Encounters and fights) | The same: an old id finds the replacing pack. |
| `npm run pack:check` | Checks `replaces`: a list of ids, never the pack's own `meta.id`, and never the id of another pack in your library (one that isn't the pack being replaced). It reads one file, so it can't see the library, and says so. |

**Principle.** The app ships with almost no rules of its own; rules come from setting rules and homebrew. Where the app still has a default (containers add capacity, side initiative and so on), it's a fallback, used only when no attached pack says otherwise.

Every array is optional. Every entry needs an `id` (lowercase, dashes), unique among the pack's entries of the same kind. An id is a label for the machine and can reach a player's device unseen (a given rumour carries its table's id and the row's range; a sent call to adventure its entry's id), so an id must never carry a spoiler: name the table "quay-rumours", not the secret it leads to (ls-4, 2026-11-17).

### items
```json
{ "id": "rope-50ft", "name": "Rope, 50 ft", "category": "gear",
  "weightCoin": 50, "slots": 1, "stack": 1,
  "value": { "gp": 1 }, "container": null, "lightTypeId": null, "notes": "" }
```
- `weightCoin` for coin-based campaigns; `slots` for slot-based. Include whichever you have; the app uses the campaign's mode.
- `forSale` (optional true/false, ruled 2026-10-23): whether the item is on shop lists. Players' Add item shows only items for sale; the GM always sees everything. When no pack says, items count as for sale except the magic categories (category `magic` or `magic-…`). The converter sets `false` for anything not on the source's shop lists.
- `bundle` (optional whole number) and `unitName` (optional text), ruled 2026-10-23: an item sold as a bundle ("Torches (6)", bundle 6, unitName "Torch"). Buying one adds `bundle` units as a stack named `unitName` ("Torch × 6"); the item's weight and cost are for the whole bundle, divided per unit (the pack's weight for any number of units is worked out from the bundle's, rounded to a whole number). `pack:check` warns about an item whose name says how many ("(12)", "pouch of 20") with no `bundle` (area 3 re-check, 2026-11-03).
- `weightFactor` (optional number, default 1, ruled 2026-10-23): the item weighs its base weight × weightFactor, rounded once to a whole number when the line is created (hard rule 8). Not only for magic items: homebrew can use it for any lighter armour. Built in M4b with choosing the base armour at hand-out: for armour marked `"chosen"`, the line's weight is the base armour's weight × weightFactor (e.g. 500 × 0.5 → 250), and armour mode uses the base type's row through `armourTypes`.
- `appearsAs` and `noticed` (optional text; M4b, tentative, ruled 2026-10-24): for an unidentified item, what players see it as (fallback: its category's singular name, `itemCategories[].singular`) and "What you notice" (observations through any sense, never conclusions such as magic, cursed, enchanted, sentient, +N or "of <power>"; the leak check flags those). Either may be empty (an empty `noticed` shows no line); they are the starting words, and the GM changes them on the item from its sheet any time after hand-out (k22-1, k22-3).
- `looks` (optional text; ⚑ 5 of `plans/k22-reveal.md`, Francis, 2026-11-22): the look line players see under an item's name ("A plain band of old bronze."), unlike `description`, which is what it does; it travels on an unidentified item's face, and the GM's own note on the line overrides it. `pack:check` warns when it isn't words.
- `gmOnly` (ruled 2026-10-24) takes only these facts: `name`, `bonus`, `properties`, `cursed`, `charges`, `notes`, plus labelled custom fields (`"fields.<label>"`: that field alone stays the GM's while the rest of `fields` reaches players — the importer honours it from G-70's build, ruled 2026-11-02; before that only the whole `fields` block could be hidden). `pack:check` warns about anything else, and about a label that doesn't exist.
- `stack`: how many fit in one slot (e.g. 20 arrows, 100 coins).
- Containers: `"container": { "capacityCoin": 400, "capacitySlots": 6 }`. Whether containers add capacity is a campaign setting. Optional `"fixedWeightCoin"` for containers that always weigh the same. Optional `"weightEmpty"` and `"weightFull"` (eq-5, ruled 2026-11-04; whole numbers in the encumbrance unit, coins in coin mode and slots in slot mode) for a bag whose weight scales with how full it is; equal values mean a fixed weight. An item's `"carryBonus"` (eq-6; a whole number above 0, the same unit) raises its wearer's limit while it's worn or held, not while carried (it needs a `slot` to be put on; `"slot": "worn"` for gloves and rings, mb-5).
- Light items: `"lightTypeId": "torch"`.
- **`food`** (optional; ruled 2026-10-30): `"fresh"` | `"preserved"` | `"cooked"`, for items eaten at camp (05, Eating suggests cooked first, then fresh, then preserved). Portions made by cooking are `"cooked"`.

### lightTypes
```json
{ "id": "torch", "name": "Torch", "duration": 6, "unit": "turn", "radius": "30 ft", "warnAt": 1 }
```

### classes
```json
{ "id": "lantern-warden", "name": "Lantern Warden", "xpTableId": "warden-xp",
  "hitDie": "d8", "fields": { "primeStat": "WIS" }, "notes": "" }
```

### xpTables
```json
{ "id": "warden-xp", "levels": [ { "level": 2, "xp": 2000 }, { "level": 3, "xp": 4000 } ] }
```

### rulesSets (campaign settings presets)
```json
{ "id": "my-house-rules", "name": "House rules",
  "encumbrance": {
    "mode": "coin",
    "armour": { "maxLoadCoin": 1500, "movement": [ { "armour": "none", "withoutTreasure": "100 ft", "withTreasure": "70 ft" } ],
                "armourTypes": { "quilted": "light", "iron-scale": "heavy" } },
    "coin": { "coinsPerUnit": 1, "maxLoadCoin": 1500, "miscGearCoin": 60, "miscGearCategories": ["gear", "light"],
              "tiers": [ { "label": "Light", "max": 500, "effect": "Normal pace" },
                         { "label": "Heavy", "max": 1000, "effect": "Slowed" } ],
              "overMax": "Can't move" },
    "slot": { "baseSlots": 12, "coinsPerSlot": 50,
              "tiers": [ { "label": "Burdened", "maxSlots": 12, "effect": "Slowed" } ], "overMax": "Can't move" },
    "treasureWeights": { "gem": 1, "potion": 10, "scroll": null },
    "containers": { "default": "add", "byOption": { "bags=hold": "hold-only" } },
    "byOption": { "load=none": { "mode": "none" } } },
  "time": { "roundSeconds": 6, "turnMinutes": 10, "dayHours": 24 },
  "currency": [ { "key": "gp", "label": "Gold", "valueInBase": 1, "countsForWeight": true } ],
  "initiative": { "mode": "side", "rangeMin": 1, "rangeMax": 6, "rerollEachRound": true, "order": "high", "ties": "party" },
  "xpPartySplit": "even" }
```
All numbers are examples only.

**Currency** (pf-17, `design/rulings/dec-purse-screens-2026-11-13.md`). A coin in `currency` may carry `unitName` and `pluralName`, as a stack does; the app uses them where given ("1 crown", "30 crowns"). Where a coin gives one label, the label is printed as given after the number whatever the amount; the app never invents a singular.

**Item categories** (optional, ruled 2026-10-23): `rulesSets[].itemCategories` [{ id, name, order, unidentified?, singular? }] gives the item categories friendly names and an order for Add item's grouped list (`{ "id": "magic-misc", "name": "Wondrous items", "order": 9 }`). `unidentified: true` (M4b, tentative, ruled 2026-10-24) makes items of that category start unidentified (any cursed item does too: `cursed: true`, or a negative magic bonus); the database then stores such an item as its face and sends players nothing of its truth until the GM tells it (K22a, 2026-11-22). `singular` (optional text, ⚑ 4 of `plans/k22-reveal.md`, 2026-11-22): one of the category ("Ring"), what an unidentified item of it reads as with no `appearsAs`; without it, the category's `name` as given. `pack:check` warns when it isn't words. A category it doesn't name shows as a tidied id ("Magic misc"), after the named ones. (In the rules set rather than a top-level list, so it needs no new kind of entry.)

**Encumbrance** (ruled 2026-10-23). The modes sit side by side, so switching mode loses nothing:
- `mode`: `none` (not tracked), `armour`, `coin` or `slot`: the one used unless an option changes it. From M4b the campaign's choice is one optional-rules row, "Encumbrance" (ruled 2026-10-24; see 05).
- `separateCategories` (optional list of item categories, ruled 2026-10-24): items of these categories (animals, tack and harness, vehicles, boats) go in the Pack's "Other" section, never counted in the load. With none given, items with an animal or vehicle block count.
- `armour`: `maxLoadCoin`, `movement` rows [{armour: none | light | heavy, withoutTreasure, withTreasure}] (exactly those three words), and `armourTypes`, which maps the items' `armourType` values to a row (`{ "quilted": "light" }`). The heaviest equipped armour decides the row; armour whose type isn't mapped counts as none. Magic armour with `armourType: "chosen"` uses the base type picked when the GM hands it out. An armour that names `armour.type` is read by that for the row (and for any load rule keyed on the armour's category), not by `armourType`; chosen-base armour carries as the picked base unless it names its own; the load breakdown says why ("carries as light · magic"; al-1, 2026-11-05; the app after the M5b gate). Only treasure counts toward the load.
- `coin`: `coinsPerUnit`, `maxLoadCoin`, `tiers` [{label, max, effect, movement?}], optional `overMax` (text shown past the max), optional `miscGearCoin` with `miscGearCategories` (below).
- `slot`: `baseSlots`, optional `coinsPerSlot`, `tiers` [{label, maxSlots, effect, movement?}], optional `overMax`. A tier's `movement` and an armour row's `withoutTreasure` and `withTreasure` are text (`"120 ft"`); a whole number (`30`) is read too, and `pack:check` notes it (text preferred; pack review area 2, 2026-11-03). Items give `slots` and `stack` (how many share one slot); containers give `capacitySlots`.
- `treasureWeights`: keys are item categories. An item is treasure when its category is a key; it weighs its `weightCoin`, or else the category's value (`null` = use the item's `weightCoin`). Carried coins count from M7, when purses arrive. `pack:check` warns when a category of items the pack places as treasure (a location's `treasure[].itemId`) isn't a key (area 3 re-check, 2026-11-03).
- `containers`: `add` (containers add capacity) or `hold-only`, or `{ "default": …, "byOption": { … } }`.
- **Modes offered:** "Not tracked" always. Armour, coin and slot are offered only when an attached pack or the homebrew supplies that mode's data; otherwise they're not shown at all (Francis, M4 gate run). There is no built-in slot mode.
- **Containers** (ruled 2026-10-23): with `add`, a carried container raises the max and every tier's limit by its capacity, so a bigger bag never pushes anyone into a slower tier; with `hold-only`, what it holds still counts and nothing moves. A bag's `fixedWeightCoin` may sit inside its `container` block or next to it; the bag always weighs that, and nothing inside it counts. **By fill** (eq-5, built 2026-11-04): a bag with both `weightEmpty` and `weightFull` (inside the block or next to it; they win over a `fixedWeightCoin` it also gives) weighs `weightEmpty` plus the share of the difference that its contents fill of its capacity (`capacityCoin` in coin mode, `capacitySlots` in slot mode; the contents' own weights, at any depth, rounded once to a whole number), never more than full; with no capacity it weighs full. Nothing inside it counts, and under `add` it adds no room. The Pack's row reads "300 of 600 · half full" (empty, nearly empty, a quarter, half, three quarters, nearly full, full). **Carry bonuses** (eq-6, built 2026-11-04): each worn or held item's `carryBonus` raises the max and every tier's limit (coin and slot modes) or the treasure limit (armour mode); with slot bands the room goes to the **stowed** band, and `pack:check` notes a `carryBonus` item in a banded stack (cb-1, 2026-11-05; the note after the M5b gate); the load's breakdown (tap the tier) names each one. The database's tier line ("<name> is now <tier>") reads both the same way. `pack:check` notes a lone or non-whole weight, a full weight under the empty one, a pair with no capacity, and a `carryBonus` that isn't whole or sits on an item with no `slot`.
- **Slot limits** (ruled 2026-10-23): the bar is full at the maximum, the last tier's `maxSlots`, with tier marks along it. `baseSlots` defaults to that maximum and is kept only for future modifiers (strength, say).
- **Weightless items** count 0 and show "—". In coin mode, `coin.miscGearCoin` is added once when a character carries any weightless item whose category is in `coin.miscGearCategories`. Other weightless items (magic items, say) count 0 until a pack gives a weight.

**byOption in a section.** Besides the rules set's top-level `byOption`, any section may carry its own (`encumbrance.byOption`, `encumbrance.containers.byOption`, `initiative.byOption`), merged into that section. The top-level one applies first, then the section's own: the more specific wins. The import preview shows the result.

**Charges.** `magicItems.charges` gives the starting dice per item category (`"wand": "2d10"`), `rechargeable` (the default for items that don't say) and `hidden` (true or false), which decides who sees an item's charges. An item may carry its own `charges` {initial (a number or dice), rechargeable?} (homebrew can override per item) and `recharge` {amount (number or dice), every (e.g. `"day"`)}. Every item with charges keeps a count of what's left; at zero it is **spent**: the GM gets a quiet note and sees "Spent"; with visible charges the holder sees "0 left · spent" and "Use a charge" greys out; with hidden charges, using the last charge looks normal, and using it with none left shows the holder "Nothing happens. <item> seems spent." and marks it Spent (ruled 2026-10-24, replacing "nothing changes until Reveal: spent"); the GM's Reveal then shows the count like a visible-charge item. Whether an item can be recharged: the item's `rechargeable`, then `magicItems.charges.rechargeable`, then the campaign setting "Charged items can be recharged" (default No); the GM can always **Recharge (fiat)** (an amount, or a roll through the roll prompt), logged. Timed `recharge` prompts the GM from M5 ("<item> recharges today", one tap to confirm; never silent). Visible: whoever adds the item enters the roll for its starting charges, and everyone sees the count. Hidden: the GM enters the roll, when handing it out or later from the item's flag ("Charges not set (2d10)"); the holder sees "Charges: ?" and can still tap "Use a charge" (logged); the GM sees what's left and is told at zero. Hidden counts live with the GM-only item data and never reach players' devices.

**Settings the app uses:** `time`, `currency`, `initiative`, `encumbrance`, `death` and `pursuit` (Encounters and fights), `xpPartySplit`, `startingMoney`, `startingGear` (`{ "shop": false }` hides the shop at creation; set through `byOption` when an option decides it — cf-4, 2026-11-02), `creation.kits.pick` (how many kits a character may take, a positive whole number; absent, 1; Gear's heading reads "To choose (pick N)"; a kit past it is still takeable, said with the sign in the footer and flagged for the GM; the top rules set that says wins; `pack:check` notes a value that isn't a positive whole number — Design, 2026-11-07, final drafts D), `startingEquipment` (item ids everyone starts with: a Given group on Gear), `hitPoints` (`{ startMinimum?, minimumPerDie?, reroll?: { atMost, option?, note? } }` — cf-1, cf-2, 2026-11-02; the rest of the section is reference text), plus `levelLoss` and `campaignFlags` (below), `abilities` (Sheet, skills, effects and options), `dungeonExit` (Exploration) and `xp` (Characters, XP and spells). **Reference sections** are free-form, kept untouched by the importer, readable through `lookup()` and used by later milestones: `abilityModifiers`, `abilityAdjustment`, `attack`, `saveCategories` (each may carry **`short`**, a one-word name for tiles, only where the name's first word is wrong; G-216), `saveRule`, `monsterSaves`, `hitPoints`, `combat` (its `spellDisruption` is structured from M7; see Encounters and fights), `morale` (read from M6; see Encounters and fights), `healing` (shown as text at a full rest, M5), `procedures`, `movement`, `primeRequisiteXp`, `levelUp`, `inheritance`, `monsters`, `magicItems`, `strongholds`, `retainers`, `mercenaries`, and the exploration reference sections listed under Exploration (G-07).

**GM-only sections:** `monsters`, `magicItems` and `procedures`, plus any section a pack marks `"gmOnly": true` at section level. The one way back: a **table** may carry `"gmOnly": false` (ruled 2026-11-02, `design/rulings/m5b-0c-first-spells-table-2026-11-02.md`) and campaign members read it — meant for the tables a class's `firstSpells.rollTable` names; `pack:check` warns when such a table lacks it. `magicItems` is GM-only except its `charges` sub-section (the hidden switch, the dice per kind, the `rechargeable` default), which players' devices receive (ruled 2026-10-23). Every other section is player-readable (from M4b; see Who sees what).

`levelLoss` (for "Lose a level", R2; moved from M7 on 2026-10-28): `{ "xp": "midpoint", "hp": "enter", "note": "Short note" }`. `xp` is `midpoint` (halfway through the new level), `levelStart` (the new level's minimum) or a formula; `hp` is `enter` (the player types the new maximum; the default) or `removeLast` (subtract the last level's roll if the app has it). Without it: `xp: levelStart, hp: enter`.

`campaignFlags`: `[ { "id": "flooding", "name": "The river is in flood", "default": false } ]`. Each flag is a switch in campaign settings, readable as `campaign.flags.<id>`; changing one is logged.

A rules set may also give `startingMoney` (text or dice, e.g. `"4d4 × 5 gp"`; invented). Guided creation shows it as a roll prompt and the player enters what was rolled at the table (ruled 2026-10-25).

Race and class **requirements** are written `{ "<ABILITY>": <minimum> }` (e.g. `{ "STR": 9 }`; ruled 2026-10-25): a choice whose scores fall short is greyed out at creation, with the reason.

### conditions
```json
{ "id": "stunned", "name": "Stunned", "defaultRounds": 1, "notes": "Short reminder text" }
```
A condition may carry **`icon`** (a name from the app's fixed list of symbols; without one it shows its first letter in a circle) and **`stacks: true`** (each mark adds 1: "×2"). Ruled 2026-10-25. **The status symbols** (R3-6, 2026-11-08, mockup `design/mockups/players/03-status-symbols.html`): `icon` names one of 25: `flame`, `star`, `ghost`, `shield`, `arrow-forward`, `arrow-back`, `bolt`, `eye-slash`, `eye-half`, `sun-slash`, `lock`, `chain`, `bed`, `moon`, `stone`, `spiral`, `hand`, `drop`, `blot`, `feather`, `bread`, `cup`, `snowflake`, `skull`, `crack`; any other value shows the first letter, and `pack:check` warns. A condition may carry **`tone`** (new 2026-11-08, R3-6): `light`, `harm`, `boon` or `neutral`, the colour of its Status ring on the Player screen (the lit-light glow, danger, info or ink); without one, or with any other value, the ring is ink, and `pack:check` warns on a value outside the four. `tone` is the ring's colour only: **`family`** keeps its meaning below (the pack's grouping in + Status). Invented example: `{ "id": "fen-sting", "name": "Fen sting", "icon": "drop", "tone": "harm", "notes": "Slow for a turn" }`. `notes` is the **brief effect** shown under the status's name everywhere (M5 gate B6, 2026-11-01); `pack:check` warns when it's missing. A condition may carry **`family`** (ruled 2026-11-01, B6; G-46): a short name shared by related conditions (the pack's kinds of poison, say); the + Status pop-up groups them behind one row named after it. Families come only from the pack: the app has no list of its own. A condition may instead have **ordered levels** (ruled 2026-10-30, WA3): a status that steps up and down through named levels, shown by its current level's name: **`levels: [{ id, name, effects }]`**, in order, with step up and step down (confirmed 2026-10-30; invented example: Dazed → Reeling → Out cold). The inebriation rule, a fae-woodland option, is the first user. A condition with **`appliesTo: "item"`** is a damaged-item state (bent, broken; G-52, 2026-11-01; Format additions from the zine-compendium survey).

### statBlocks
```json
{ "id": "bog-lurker", "name": "Bog lurker", "hp": "3d8", "hpAverage": 13,
  "fields": { "AC": "6", "Move": "60 ft", "Attacks": "1 bite (1d6)", "Morale": "8" },
  "tags": ["swamp"], "notes": "Hides under still water." }
```
- `fields` is free-form label → value, so any system's stat line fits.
- `hp` may be a dice expression; the GM rolls or uses `hpAverage`.
- Behaviour fields (`profile`, `nudges`, `abilities`, `triggers`, `actionMenu`, `tables`) are optional; see Encounters and fights (M6-13). `variants` (one block in several sizes) and `parts` (body parts with their own hit points) are in Format additions from the zine-compendium survey (G-60, G-59; 2026-11-01).

### tables
```json
{ "id": "my-surprise", "name": "Surprise", "die": "d6",
  "rows": [ { "min": 1, "max": 2, "result": "Surprised" },
            { "min": 3, "max": 6, "result": "Not surprised" } ] }
```
- Used by the GM add-ins (disposition, surprise, encounter tables). A table may carry uses from the **table uses registry** (M6-10, revised 2026-10-29; see Encounters and fights).
- **Row ranges** (ruled 2026-10-29): every row has `min` and `max`. In the quick builder, a range typed at the start of a line ("1", "2-4", "5-6") sets them. Gaps and overlaps warn and never block.
- Encounter table rows may add "statBlockId" and "count" (e.g. "1d4"), or **`statBlockIds`** (a list: a party met as one encounter; Add foes adds every member at the band the GM picks once — ruled 2026-11-02, G-68, M6 follow-up). Each `statBlockIds` entry is a plain id (the row's `count` covers the group) or `{ statBlockId or statBlockRef, count }`, so each creature carries its own count; where every entry has one the row's `count` is ignored, and an entry without one takes the row's (pf-2, 2026-11-11).
- All numbers here are invented examples.

### fieldTemplates (sheet layouts)

Sheet layouts (`fieldTemplates` in the file) set a character sheet's fields.
```json
{ "id": "classic-six", "appliesTo": "pc",
  "fields": [ { "key": "STR", "label": "STR", "type": "number", "group": "Abilities", "showOnCard": true } ] }
```
A field may carry `required: true` (ruled 2026-10-24): character creation asks for it. A field may carry **`atCreation: false`** (ruled 2026-11-03): creation never asks it (not on Who they are, not as a step) and it stays on the sheet, e.g. an affiliation that comes from play; `pack:check` notes a value that isn't true or false. HP is required only when a sheet layout marks its HP field so; a field keyed `hp` is the character's own HP (2026-10-25).

A field `from` a table may carry **`alsoFills: "<field key>"`** (cw-12, 2026-11-06, `design/rulings/m5b-gate-creation-words-2026-11-06.md`): a pick in it also fills that field, which stays editable (a knight's liege fills their Affiliation).

**Score columns that are plain values (ruled 2026-11-05, a gate bug from the early walk).** A rules set may carry **`abilityModifierColumns: { <column>: "value" }`** for the columns of `abilityModifiers` that a book prints as plain figures, not bonuses (how many retainers, their loyalty, extra languages). A value column shows its label first and no sign ("loyalty 7, max retainers 4"); every other column is a modifier and keeps its sign ("+1 melee"); the default is modifier, so packs without the key don't change. A text cell is shown as written. **A modifier of zero isn't printed at all** (an average score lists only what it changes); a value is always printed. A rules set may also carry **`alignmentBlurbs: { <name>: "one line" }`** beside `alignmentNotes`, keyed the same way: the Name step's row shows the blurb and the name opens the full note; with no blurb the row shows the name alone. `pack:check` knows the key, warns on a column it names that no row has, and warns when a text cell repeats its column's name ("open doors open doors").

A field may carry **`fill`** (ruled 2026-10-25): the filled value it shows, named like hook targets: `abilityModifiers.<KEY>`, `saves.<key>`, `attack`, `hitDice`, `spellSlots`, `skills.<code>`, `title` (invented: `{ "key": "saveR", "label": "Save vs river", "type": "number", "fill": "saves.R" }`). The field shows the filled value; a hand edit follows the keep-or-use rule. Filled values no field claims show in a read-only "From your setting" block.

### calendars (basic calendar in M5; the rest R3)
```json
{ "id": "my-world", "name": "Reckoning of the river towns",
  "daysPerWeek": 7, "weekdays": ["..."],
  "months": [ { "name": "...", "days": 28, "season": "spring",
                "extraDays": [ { "id": "lanternsday", "name": "Lanternsday", "inWeek": false } ] } ],
  "moons": [ { "name": "...", "cycleDays": 28, "offset": 0 } ],
  "events": [ { "name": "...", "month": 1, "day": 1, "recurring": true, "notes": "" } ] }
```
**Extra days** (ruled 2026-10-25): a month may list `extraDays: [{id, name, inWeek}]`, counted after its last day, in that month's season and in the day total. `inWeek` defaults to false: an extra day doesn't move the weekday on. Each has a stable `id` (for R3 holidays). A month's `moon` and `seasonPhase` are kept, unused until R3.

**Who reads it** (ruled 2026-10-30): players see the date and season, so a campaign's members read its calendars' names, months and seasons (through the database's `campaign_calendars`); a calendar's `gmOnly` fields stay the GM's. See Who sees what.

**`defaultStart`** (optional; ruled 2026-10-29, confirmed 2026-10-30): the calendar's suggested start date, `{ "month": 1, "day": 1 }` (months counted from 1, as in `events`). It prefills the campaign's **Calendar start** (05, Seasons, weather and the calendar); without it the time strip shows "Day N" until the GM sets a date or answers "Which season?". Leave it out unless the book gives one (no invented rules).

## JSON format version 2 (additions)

Version 2 keeps everything in version 1 and adds the kinds and fields below. They were found by converting a complete published system as a private test (2026-10-18), and adopted from that pack's shapes (2026-10-22). **Only the core fields are needed for the app to work**; everything system-specific is optional, so a homebrew pack can be tiny. The importer accepts both versions.

**Any entry** may carry `source` (a page reference such as `"Book p. 42"`, or an object keyed by class when pages differ; shown in rules popups from M4 as "From your setting: <short name> · <page>", where the short name is the pack's optional `meta.shortName` or else its name; no line when there's no source; a class-keyed source shows the character's class, else all), `notes` (up to three short sentences) and `shareable` (informational).

**Formulas.** Wherever a number can depend on level, a pack may give `{ "formula": "6 + level" }` instead of a number. Allowed: numbers, `level` (the caster's or owner's level), `+ - * /` (also `×` `÷`), brackets, `floor()`, and dice such as `1d6`, `d8`, `level d6` or `(level + 1)d4`. The app works out the number or dice expression (e.g. `1d6 + floor(level / 2)` at level 3 is `1d6 + 1`); it never rolls. Results are whole numbers: a fraction is rounded down and shown as "(rounded down)". Anything else stays text, as written. Limits: levels 1–99, at most 100 dice, 200 characters. ◈ Variables other than level are deliberately left open.

**options** (rules choices made when a campaign attaches the pack)
```json
{ "id": "lantern-oil", "name": "Lanterns need oil", "default": "on", "changeLater": "allow",
  "choices": [ { "id": "on", "name": "Yes" }, { "id": "off", "name": "No" } ],
  "requires": null, "notes": "" }
```
`notes` explain the rule, and each choice may carry its own `notes`; the app shows them when the GM taps the rule's name. `requires` is `{optionId: choiceId}` or `{optionId: [choiceIds]}`: the option is offered only when that option has one of those choices; otherwise it's hidden and uses its default.
**Short labels for choices (ruled 2026-11-03, `design/rulings/m5b-test-feedback-2026-11-03.md` tf-3).** An option's choice may carry `short` (about 14 letters, e.g. "Roll again"). A choice name of up to 14 letters counts as its own short label (ruled 2026-11-03, reading A). With up to 3 choices that all have one, the Rules row shows them side by side as a segmented control; otherwise the row shows the current choice with ▾ and "1 of N" (one of N choices). `pack:check` notes a 2–3 choice option with a longer name and no `short` (the row would fall back to the button).

**Options that behave (ruled 2026-11-03, `design/rulings/m5b-options-format-2026-11-03.md`, of-1 … of-11).** An option may carry `extends: "<base option id>"`: its choices join the base option's, shown as one option labelled by pack; `ruleKey` stays for whole-rule rivals (`pack:check` warns on both) (of-1). One switch per rule, owned by the book that defines it; the app never asks for picks from an empty list level (of-2). **Any entry** (item, class, race, spell, kit, table, field) may carry `option` (exists only while the option or choice is on) and `byOption` (its fields under a choice); in `byOption`, a section set to `null` is off (of-3, of-10). Sheet fields take `forRaces` beside `forClasses` (of-3); a field whose option is off is hidden everywhere, its value kept, and the option's row says what it adds (of-9). A check's modifier may carry `onlyWithOption` (of-4). `dungeonExit` without a `roll` offers Use safe paths (of-5). `known.listLevel?: <n>`, default 0 (of-6; `pack:check` notes only a level the class's list has no spells at; a level with fewer spells than the count asks for what's there, bq3-15). A trait list rolled more than once may carry `distinct: true` (of-7). The rules set's `attack.weaponDamage: "<dice>"` (usually under `byOption`) sets every weapon's damage (of-8). In `startingEquipment`, a pick is a line: `{ "pick": { "tableId", "upTo" } }` (of-11).

**Several choices, and patches (ruled 2026-11-03, `design/rulings/m5b-options-format-2-2026-11-03.md`).** `option` may be a list of choices (any of them; of-12); a `byOption` key may list several choices, comma-separated. A pack may carry `patches[]` `{ byOption, match: { kind, category?, ids? }, change: { field: value | { delta } } }` or `option: null` (removed under those choices), applied to the entries it matches in attached packs; breakdowns name the reason (of-13).

**`sheetFields` (ruled 2026-11-04, `design/rulings/m5b-sheet-review-2026-11-04.md` sr-10).** A setting pack may list its printed character sheet's fields: `sheetFields: [{ name, home }]`, `home` naming a layout field key, an app figure (`name`, `class`, `portrait`, `hp`, `ac`, `attack`, `level`, `xp`, `saves`, `movement`, `skills`, `traits`, `magic`, `languages`, `notes`) or `pack` (the Pack tab). A field may carry `option` (of-3/of-12): it counts only while that choice is on. A rules overlay (`meta.requires`) may carry its own `sheetFields` for the fields its rules add, gated the same way. `pack:check` lists any printed field with no home, across the stack it's given (technical confirmation 2026-11-04, after the packs' `sheetFields`; coins wait for M7b's purses).

**Options from a newer edition (ruled 2026-11-04, `design/rulings/m5b-pack-review-area-4-2026-11-04.md`, fi-6).** An option whose full rule isn't in the books a pack is built from is carried only when its one-line summary is the whole rule, enactable with no guess: default off, `source` = "newer edition, checklist summary". Otherwise it stays out of the pack, listed in the pack's private open-items until the books are owned.

**Equipment (ruled 2026-11-04, `design/rulings/m5b-pack-review-area-3-2026-11-04.md`, eq-1 … eq-9).** Magic weapons and armour carry `baseId` (a class list accepts the id or the base; eq-1). Race weapon and armour limits are read by the equip check in play (eq-2). Treasure suggests "Carrying treasure" under basic encumbrance; the GM switches it per character (eq-3). The same item id in two attached packs: the pack on top wins, the entry says "also in <pack>", `pack:check` lists clashes (eq-4). **The same name with different ids** (sn-1, 2026-11-05, `design/rulings/packs-same-names-and-content-note-2026-11-05.md`): two entries of one kind (class, kindred, spell, item, stat block) from different packs each show their pack's short name where both can appear; truly identical ones (the same numbers and rules text) are listed once, the later pack pointing at the first by id; where the two packs don't require each other, the add-on carries its own entry with **`sameAs: "<pack id>:<id>"`** and the app lists one when both are loaded (sn-1a); `pack:check` lists same-named pairs and checks a `sameAs` pair is identical. A trait-list entry (a cult, a deity) may carry its own `weaponsAllowed`, replacing the class's while chosen (ao-4, M7). **`meta.contentNote`** (cn-1, same file): one or two lines in the pack author's words, shown at the top of the import preview before the GM loads the pack; nothing more. Containers' `weightEmpty` / `weightFull`, scaled by fill (eq-5). Items' `carryBonus` while worn or held (eq-6). The rules set's `weaponRules: [{ category, classCategories, exceptClasses?, note? }]` (eq-7; `exceptClasses` names classes the rule doesn't apply to, whose own list alone decides, mb-4, 2026-11-04): `category` is a weapon tag the item carries (or the item's `category`), matched without regard to case; `classCategories` are classes' `weaponProficiencyCategory`; a class with none follows its list; the pack on top's rule for a category is read first; `pack:check` notes an entry the app can't read, a class category no class carries and an `exceptClasses` id that isn't a class. Classes' `forms: [{ id, name, weaponsAllowed?, armourAllowed?, note }]` with a current form per character (eq-8): a form's limit replaces the class's; one it leaves out is the class's own; a character who never switched is in the first form; `pack:check` notes a form without an id, a repeated id and a form with no limits. Kit rolls' `forClasses` (eq-9).

**An add-on's study, familiars, demonic treasure and bargaining** (ao-1, ao-2, ao-6, ao-7, 2026-11-05, `design/rulings/packs-demon-lore-add-on-2026-11-05.md`). Study, sigils and rituals are text panels, a trait saying the character has studied and a typed list of sigils on the sheet, run by the GM from the text; a ritual kind is designed once, with downtime's second stage (ao-1). A bound familiar is a hireling-like companion whose effects are text the GM applies; a companion whose bonuses count on its owner's sheet waits for the hirelings session (M9; ao-2). Treasure that may turn demonic is a GM reference panel stating the rule plus the add-on's tables, rolled by hand; no shape patches a chance onto every table (if ever wanted, it goes with M7's treasure hand-out, rr-1; ao-6). Bargaining is a table and a GM reference panel with its modifiers in the pack's own words; the app keeps no memory of earlier dealings with one creature (ao-7).

**Magic items and their base (ruled 2026-11-04, `design/rulings/m5b-magic-items-base-2026-11-04.md`, mb-1 … mb-3).** A magic weapon whose type is picked when found carries **`weapon.baseWeapon: { choose: [<weapon item ids>] }`**, the twin of `armour.baseArmour.choose`: the GM's pick fills `baseId`; unpicked, it is carried and equippable with no damage figure and the class check accepts it when any offered base fits (mb-1). A magic item whose ordinary form the pack lacks names the nearest listed item as `baseId` and says so in its `note` (mb-2). An item's own figure (`ac`/`aac`, a weapon's `damage`) beats the chosen base's; the base sets everything else (mb-3). `pack:check` warns on a `choose` id of the wrong kind and accepts a figure beside `choose`. **A weapon's magic bonus (mw-1, 2026-11-05, `design/rulings/m6-weapon-magic-bonus-2026-11-05.md`; G-147):** `weapon.magicBonus` is a whole number (negative when cursed) counted in attack and damage alike; `weapon.bonusVs: [{ against, bonus }]` gives the **total** bonus against a kind of foe (`against` in plain words), replacing `magicBonus` there, and is shown as a note until foes carry kinds the app can match. An unidentified weapon's bonus doesn't change the player's numbers until it's revealed, as with armour; the GM sees the true figure. `pack:check` warns when the bonus text (`fields.Bonus`) and `magicBonus` disagree and on a top-level `bonus` key. The app reads both from 2026-11-10 (brought forward from M6 into the Attack sheet; 05 At hand). Magic **ammunition** carries its bonus the same way, `weapon.magicBonus` on the ammunition item; an item whose category is ammunition is never a weapon in its own right. **Follow-ups (mw-2, mw-3, 2026-11-05, `design/rulings/m6-weapon-magic-bonus-2-2026-11-05.md`):** a `bonusVs` entry may carry `damage` in place of `bonus` (`{ against, damage }`: the total damage bonus against that kind, the attack bonus unchanged; never both, and `pack:check` warns on an entry with both or neither); a rules set may say `attack.ammunitionBonus: "add"` (magic ammunition's bonus adds to a magic launcher's; with no rule the ammunition's bonus counts as its own row to hit and damage when the launcher has no magic bonus, mw-5; when the launcher has one, the launcher's counts and the ammunition's is the GM's note, mw-4; a negative ammunition bonus, a curse, always counts whatever the launcher and the rule, as-5, and the ammunition's `bonusVs` always shows, to whoever may see the ammunition's bonus, as a note naming it, as-6, 2026-11-10). **A weapon's range (G-219, as-2, 2026-11-10, `design/rulings/m5b-attack-sheet-clarity-2026-11-10.md`):** `range: { unit, wildernessUnit?, from?, bands: [{ name, upTo, toHit }] }` on `weapon`, or on a mode in `weapon.modes.list` (a spear's Thrown: a weapon with a Grip has `range` only on its throwing mode); `unit` and `wildernessUnit` are words ("feet", "yards"), `from` where the first band starts, each band's `upTo` its far end and `toHit` what it does to the roll, every number whole and each band reaching further than the last. The Attack sheet reads the mode in use's `range`, else the weapon's; a range missing its unit, with no bands, a figure that isn't whole or bands that don't reach further is ignored, and the quality's text ("Missile (70/140/210)") says the range as before. Invented example: `"range": { "unit": "feet", "wildernessUnit": "yards", "from": 5, "bands": [{ "name": "Short", "upTo": 160, "toHit": 1 }, { "name": "Medium", "upTo": 320, "toHit": 0 }, { "name": "Long", "upTo": 480, "toHit": -1 }] }`. A rolled result that adds fields to an item already found (special powers, oddities, what a wand casts) has no carrier yet: it is designed in M7 with the treasure hand-out and stays text until then (rr-1, `design/rulings/m7-found-spells-and-rolled-results-2026-11-05.md`).

**Weapon modes (ruled 2026-11-08, G-211; the At hand ruling ah-3/ah-4, `design/rulings/m5b-at-hand-actions-2026-11-08.md`).** A weapon used in more than one way carries `weapon.modes: { button, list }`. `button` is the mode button's word: `quiver` (bows, crossbows), `pouch` (slings), `grip` (melee / thrown / braced) or `stance` (normal / braced, normal / charge). Each entry of `list` is `{ id, name, draws?, qualities?, damage?, toHit?, note? }`: `draws: { itemId }` is the stack one use spends (an item whose `baseId` is that id counts as the same stack unless another mode draws it; with none, nothing is spent; ammunition whose effect differs, such as silver or magic arrows, is its own mode); `qualities` are those of the weapon's own `qualities` that hold in this mode (absent: all), and a quality the mode leaves out takes the `weaponTags` entry of the same name with it; under a `grip`, a quality whose first word is followed by figures ("Missile 5-20/21-40/41-60", "Missile (70/140/210)") also takes the `weaponTags` entry of that first word, unless a quality the mode keeps still names it, so the grip shows its own roll lines alone (C16, 2026-11-20); `damage` and `toHit` only where the book gives the mode its own figure. The first entry is the default. A weapon with one mode carries no block; charged items are a spend, not a mode. Invented example: a Lantern Warden's hookstaff with `{ "button": "stance", "list": [{ "id": "normal", "name": "Normal", "qualities": ["Melee"] }, { "id": "braced", "name": "Braced", "qualities": ["Brace", "Melee"] }] }`.

**Patches in detail (of-14, ruled 2026-11-04, `design/rulings/m5b-builder-questions-3-2026-11-04.md` bq3-17).** `change` names a dotted path (`"armour.ac"`; a numeric step is always an object key, and a patch never sets into, makes or pads a list: pf-19c, 2026-11-14, replacing pf-19b's wording); `{ delta }` adds (on dice, to the modifier), `{ times }` multiplies; a path the entry lacks changes nothing (`pack:check` warns), except a **set** value, which creates the missing keys on its way, objects only: never a list, never over a text, number or list in the way, never a `__proto__`, `constructor` or `prototype` step, and `pack:check` lists each one (pf-19, 2026-11-13, `design/rulings/dec-patch-sets-path-and-homebrew-batch-2026-11-13.md`); a patch never sets, changes or creates a field hidden from players by name for its kind (a patron's cult, its stat block), by any operation, and never creates a section a rules set lacks: such a patch changes nothing and `pack:check` names it as an error (pf-19a, 2026-11-13, `design/rulings/dec-evening-2026-11-13.md`); a set value may be an object or a flag (`value`, `forSale`; ov-2); deltas and multipliers from several patches add, set values follow the pack on top; a patch applies after the entry's own `byOption`, to every attached pack's entries and the winning copy; a removed entry a character carries stays by name, "Off · <choice>"; every changed figure's breakdown names the patch. **Who reads a patch** (fresh-session review, 2026-11-04; look-back review of #437, approved 2026-11-10): a patch is player-facing only when the kind its `match` names is; a patch on a GM-only kind (a stat block, a table, a location, a GM reference panel) or with no `match.kind` reaches only the GM, in the library, the log and a pack update's line, and `pack:check` says so. It is also the GM's when it changes a hidden field: a path starting at a rules set's `monsters`, `magicItems`, `procedures` or `gmReference`, at `gmOnly`, or at a field an entry it may match keeps in its `gmOnly` (by id, or by category); `pack:check` warns on each. A patch naming items in `match.ids` reaches a player only while that player may read every one of them (for sale, known, or in a kit); in the log and a pack update's line, only while each is for sale where the pack is attached. A patch matching a whole category names no item and stays player-facing. **Treasure** (bq3-9): a category `encumbrance.treasureWeights` names, or an item's `treasure: true`.

`ruleKey` (optional): a shared topic name such as `initiative` or `encumbrance`. Options from different attached packs with the same ruleKey form one group, and the GM picks one choice for the group. The default comes from the pack priority order (homebrew on top). Adding a pack that brings a clashing rule shows "New choice for <topic>" with a preview and changes nothing until the GM confirms. Removing a pack falls back to the next pack's choice, and that's logged. An option that `requires` another option is an **add-on** to that rule, not a rival: it keeps `requires` and carries **no `ruleKey`** of its own (ruled 2026-11-02), so it is offered only once the GM has chosen the parent. `pack:check` warns when two packs in a library carry same-named options with no `ruleKey` (ruled 2026-11-02: the clash a missing key hides). Options without a ruleKey stand alone. Suggested keys: `initiative`, `initiative-ties`, `encumbrance`, `containers`, `weapon-damage`, `ac-style`, `morale`, `creation-method`, `spell-books`, `exploration` (packs that define exploration modes; 2026-10-25). (Grouping is built in M5b step 0d (#283, 2026-11-02; 07 said M4b in error — until then each pack kept its own choice and nothing resolved by key); a losing pack's own `byOption` keys and gates still read that pack's own choice (ruled 2026-11-02). Packs can carry ruleKey now.)
**Creation methods** (ruled 2026-10-25): each choice of an option with ruleKey `creation-method` may say **`races`**: `"none"` (the class is the race; no race is picked), `"required"`, or `"optional"` (the step can be skipped for the rules set's `defaultRace`; without one it's required); missing means optional. A choice may instead carry **`methods`**, a list of other choice ids: the player picks one of those methods for each character, and that method's `races` and class filters apply. Classes are offered when their `creationMethods` include the method; once a race is picked, also by the race's `classMaxLevels` (when it's a list of classes) and `npcOnlyClasses`; and by requirements. If no attached pack has races, the race step is skipped whatever the method says. `npm run pack:check` warns when a choice says `"required"` and the pack has no races (another attached pack may supply them). Invented example: `"choices": [ { "id": "classic", "name": "Class is kin", "races": "none" }, { "id": "split", "name": "Kin and class", "races": "required" }, { "id": "either", "name": "Player's choice", "methods": ["classic", "split"] } ]`.
`category` (optional, display only, ruled 2026-10-24): a heading the optional-rules list groups the option under within its pack (the converter sets `"Adventure mechanics"` on an adventure's mechanics). It never affects choices.
A rules set can then carry `"byOption": { "lantern-oil=off": { ... settings ... } }`, merged over its defaults when that choice is picked.

**races**
```json
{ "id": "marsh-folk", "name": "Marsh folk", "abilityModifiers": { "DEX": 1 }, "vision": "sees in the dark 30 ft",
  "languages": ["Common", "Reedspeak"], "classMaxLevels": { "lantern-warden": 8 }, "abilities": [ { "name": "Hold breath", "note": "Short note" } ] }
```
**A class reaching other packs' races (G-06's race side; ruled 2026-11-03, `design/rulings/m5b-packs-g80-g06-2026-11-03.md` pg-2; built in M5b).** A class may carry `raceMaxLevels: { "<raceId>": <level> | null }` (`null` = no limit). Wherever a race's class limits are read (creation's class offer, level-up's cap), every attached class's `raceMaxLevels` merges into that race's `classMaxLevels`. The race wins when it already names the class (`pack:check` warns of the clash); an unknown race id is a warning; a race not named stays closed to the class.

A race's `classMaxLevels` as an empty table (`{}`) means no class limits: every class is offered (a conversion may lift limits this way; `npm run pack:check` notes it; ruled 2026-10-26). Races may also carry `requirements`, `npcOnlyClasses`, `saveBonusByCon` {saves, byCon [{con, bonus}]} and `optionalAbilities` (used when an option is on).

**classes.** Core: `id`, `name`, `xpTableId`, `hitDie` (e.g. `"d8"`). Optional:
- `progression` [{level, xp, hitDice, saves {...}, spellSlots? [...], hpGain?}], with the attack as `attack` (one number) or `thac0` + `attackBonus` (both kept), and `conModifierApplies` (false once CON stops adding). When present, the app uses it to fill the sheet on level-up. **`hpGain`** (ruled 2026-10-29, E44): `{ "fixed": 2, "addCon": false }` on a row whose HP gain is a set number instead of a roll (`addCon`: whether the CON modifier is added); level-up then hides the roll tiles. The app never guesses a fixed gain from `hitDice` text.
- **`race`** (ruled 2026-10-29, B10): for the "class is the race" creation method, the id of the race this class stands for; the Race row shows it. Without it the Race row is hidden for that class (no matching by name).
- `requirements`, `primeRequisites`, `primeXp`: `{ "type": "standard" }` (read the rules set's `primeRequisiteXp` table, `[{ range, xp }]`) or `{ "type": "rules", "rules": [{ "all" | "any": { "<ABILITY>": <min> }, "bonus": <n> }] }` (a threshold per ability); the rules set's `primeRequisiteRule: "lowest"` makes the lowest prime decide, and without it the highest does; the optional text `primeRequisiteNote` is the setting's own sentence on how several prime abilities count, shown on a class entry's "Prime requisite" line only for a class with two or more primes (the app writes none of its own; P10, 2026-11-06); a class without `primeXp` shows no XP modifier (ruled 2026-11-03, #347 ⚑ 1 and 2;, `design/rulings/m5b-0c-creation-recheck-2026-11-03.md` rc-1).
- `maxLevel`, `levelTitles`, `languages`, `vision`, `restrictions`, `demihuman`, `creationMethods` (which creation options allow the class), `weaponProficiencyCategory` (text).
- `armour`, `weapons` (text); `armourAllowed` {types: [armour types] | "any", shields: true | false | "wood" | "metal", note?}; `weaponsAllowed` {mode: `any` | `list` | `tags`, ids?, exclude?, alsoAllowTags?, allowTags?, oneHandedMelee?, optional? {ids, option}, note?}; read by `allows()`.
- `abilities` [{name, fromLevel?, note, blurb?, uses?}]. `uses` makes it a limited-use power with dots (M7-5, ruled 2026-10-28): `{ count, per }` or `{ byLevel: [{level, count}], per }`; `per` is when the uses come back: `day`, `rest`, `fight` or `week` (see Characters, XP and spells). The older `refill` is replaced by `per`. Uses that grow with level are always `byLevel` rows (ruled 2026-10-29, E40: the converter writes them; there's no per-level form such as `usesPerDayPerLevel`). Races may carry `abilities` the same way.
- `skills` {names (code → label), die (`"%"` or `"d6"`), gmRolls (codes the GM rolls secretly), byLevel (per-level values), notes?, note?}. **`notes`** (G-210, 2026-11-08) is what each class skill does, `{ "<skill code>": "<words>" }`, keyed like `names` and `byLevel`; the skill's breakdown sheet shows it as its paragraph (a rules set skill's own `notes` come first). **`note`** is one line for the class's skills as a whole, shown muted at the top of the Skills list (Player screen and full sheet). An older pack's `notes` written as one string is read as `note` (shown as that line), never as a skill's words. `npm run pack:check` notes a `notes` that is neither a map nor a string, a value that isn't words, and a key that isn't in `names` or `byLevel`.
- `spellcasting` {listId, type: `book` | `divine`, castingType: `arcane` | `divine`, maxSpellLevel, fromLevel, blockedBy?, statusName?, recover?, firstSpells?, learnByLevel?, scrollCopy?, known?} (absent for non-casters). `known` (spells known rather than slotted: cantrips, runes; G-49, G-63, 2026-11-01) is in Format additions from the zine-compendium survey; spell list level 0 is allowed.
  - **`firstSpells`** (ruled 2026-10-29, E43; every caster carries one from 2026-11-01, cr-13: a caster whose `fromLevel` is above 1 writes `{ given: [], note }`, and the step is skipped): a book caster's spells at creation, `{ choose?: N, given?: [spell ids], rollTable?: <table id> | [<table ids>] }` (choose N from the class list, spells given outright, or tables rolled at the table and tapped: one roll per table, in the list's order; each table marked `"gmOnly": false` with `spells` on its rows — ruled 2026-11-02).
  - **`learnByLevel`**: `[{ level, count }]`, how many new spells a level brings (Learn a spell at level-up; at creation above level 1, the Spells step's "Learned at level N" groups, offered from the spell levels the progression's `spellSlots` cast at that level, capped by `maxSpellLevel`, else the first spells' level). Without it there's no Learn a spell step. An older `knownByLevel` maps to it.
  - **`scrollCopy`** (E42): `{ note, consumesScroll: true }`, the copy-into-book rule shown as text, and whether copying uses the scroll up (default true).
  - `blockedBy` (ruled 2026-10-25, B25): gear that stops this class casting, `{ armour: [armour types] | "any", shields?: true | "wood" | "metal", tags?: [item tags], castingTypes?: [casting types this applies to], note }`. Such gear can still be equipped (if `armourAllowed` permits it); the character gets a derived status while it's worn. `statusName` names that status (default "Can't cast").
- `turningTableId`, `trackingByLevel` (system-specific references).

**spells** and **spellLists**
```json
{ "id": "glimmer", "name": "Glimmer", "lists": { "lantern-warden": 1 }, "range": "30 ft",
  "duration": { "formula": "2 + level", "unit": "turn" }, "lightTypeId": "glimmer-light", "conditionId": null, "notes": "Short note" }
{ "id": "list-lantern-warden", "name": "Warden spells", "levels": [ { "level": 1, "spells": ["glimmer"] } ] }
```

**A list's own words for its levels (pf-22, pf-23a, ruled 2026-11-14, `design/rulings/dec-midday-2026-11-14.md`).** A spell list may carry `levelNames`, a map from a level to `{ one, many }` (invented example: `"levelNames": { "0": { "one": "glimmer", "many": "glimmers" } }`): `many` for a heading or a count, `one` for a single spell; "Level N" where the list names nothing (the app writes no word of its own, lv-1). The words are stored as the book prints them mid-sentence; the app capitalises where a name starts a title or a line. It is read after patches; an add-on names another pack's level with a patch, the highest pack winning. `pack:check` notes a key that is not a whole number of 0 or more and an entry missing `one` or `many`.

**A list that joins another class's list (G-80; ruled 2026-11-03, `design/rulings/m5b-packs-g80-g06-2026-11-03.md` pg-1; built in M7).** A spell list may carry `extends: { "listId": "list-lantern-warden", "option": "<option id>", "levelShift"?: 0 }`: while the option is on, every spell in this list also appears on the target list at its level plus `levelShift`. Turning the option off removes them from the list; spells already learned stay in the book (a log line). `pack:check` warns when `listId` matches no list in the attached packs.

**Spells found in play (us-1, 2026-11-05, `design/rulings/m7-uncommon-spells-2026-11-05.md`; G-149; the app in M7).** A spell that is on no class's list until a character finds it is an entry in `spells` with no `lists`, in no list's `levels`, carrying `uncommon: { lists: { <list id>: <rank> }, foundAt: [{ placeId?, hex?, note? }] }`: the list and rank it joins for a character once the GM gives it to them, and where it is found (words or a hex until the place has an id). Nothing that reads the lists offers it. `pack:check` warns on an uncommon spell with `lists`, an unknown list id, or a `placeId` no attached pack has. An uncommon spell is **GM-only until the GM gives it to a character**; then that character's player reads it (us-2, 2026-11-05; row-level security, built in M7). Until M7 builds that, packs keep such spells out of `spells`.

**Area 5's rulings (a5-1 … a5-7, 2026-11-05, `design/rulings/m5c-magic-area-5-2026-11-05.md`; read with magic in play, M5c).** `reversible` and the reversed form are read by list like range and duration (a5-1). A caster class may say **`spellcasting.duplicates: false`** when the same spell can't be prepared twice (default `true`); the rest of a rules set's magic section is reference text behind Rules › (a5-3). **`spellcasting.listId` may be a list** of choices, one picked at creation and confirmed by the GM (a5-6). A spell may carry **`reversed: { name, range?, duration? }`**, the reversed form's own figures (`reversedName` is read as `reversed.name`; a5-7), and **`conjures: [{ statBlockId, count?, note? }]`**: a creature the spell brings, as a temporary companion of the caster and a combatant on the party's side, `count` a number, dice or a formula in the caster's level, `note` what limits the caster's control; `statBlockId` may be a list, a choice the caster makes at casting (one creature of the kind chosen); a stat block variant may carry **`casterLevel: { min, max? }`** and is then picked by the caster's level (a5-5). A drain may name its own `levelLoss.xp` (`midpoint` | `minimum`; the rules set's is the default; read in M7; a5-4). **Turning** (mp-11 … mp-13, 2026-11-05; settles a5-2 and ao-3): a class's turning ability points at a table (`turningTableId`; laid out by turner level and creature kind, or by roll bands, which a pack writes as a table where its book gives none) and may carry `turning: { outcomes: [words], uses?: { count, per }, note? }`: the outcome words for the log's chips, a limit on attempts and when it comes back, and a note for a special case, which the app never matches. A stat block the table covers names its column (`turnAs`), read by the GM's console in an encounter (M6).

Spells may also carry `castingTypes` [`arcane` | `divine`], `reversible` and `reversedName`, `saves` [save keys], and `concentration`. A duration can be `{value, unit}`, `{formula, unit, text?}` (`text` keeps the book's wording beside the worked-out formula), `{roll, unit}` (rolled by the GM) or plain text. **Any** field can instead be an object keyed by class id when it differs between lists.

**tables** (new shapes)
- Composite dice: `"die": "d4/d10"` with a `"key"` on each row (e.g. `"3/7"`).
- Nested: a row's result may name another table, or the table gives `"nextTablePattern": "wild-{result}"`. Table ids match whatever their case, and a trailing marker on the result (`*`, `†`, `‡`) is dropped: the cell `B-Animal*` opens `wild-b-animal`. `pack:check` notes a filled-in id that isn't a table in the pack, and an `onHit.columns` or `encounterColumn` label that isn't a column of its table (the app opens the first column instead; pack review area 2, 2026-11-03).

- Nested: a row's result may name another table, or the table gives `"nextTablePattern": "wild-{result}"`. The result is matched **normalised** (lower case; spaces and punctuation as hyphens), and `pack:check` warns when it matches no table (ruled 2026-11-03, `design/rulings/m5b-pack-review-area-2-2026-11-03.md` ex-1).
- `"kind": "matrix"` (rows × columns, e.g. level × target): `columns` [labels] and rows `{ "level", "results": [...] }`; `"kind": "lookup"` (key → value, no die): rows `{ "key", "value" }` or `{ "key", "values": [...] }`.
- Rows may carry **`spells`** (a list of spell ids; ruled 2026-11-02): the spells the roll gives, read by First spells — a whole-book row lists every spell of the book; `pack:check` warns on a `rollTable` row without it. Rows may have `group` (a sub-heading) and `note`. A table may have **`group`** (ruled 2026-11-09, G-215): the book's heading over it, which the sheet's Details ledger groups by; none where the book has none. A table may have `dieNote`, `option` and `roll` (die text for lookups), and **`description`** (ruled 2026-11-01, M5 gate B2; G-44): one line saying what the table covers, shown under its name in the GM's table list. In the table itself every row shows a one-line description at every level: its `note`, or, when the result names a stat block, that block's `description` (converters fill `note` where the book gives one; `pack:check` warns when either isn't text). `option` is `"<optionId>"` (shown when that option's choice is `on`) or `"<optionId>=<choiceId>"` (shown for that choice), written like `byOption` keys (ruled 2026-10-24; the same meaning on every adventure entry, see Adventure packs §14). Tables are GM-only without any `gmOnly`; `"gmOnly": false` opens one to campaign members (GM-only sections, above). A row may carry **`tableId`** beside `result` to open a sub-table from its own text (G-42, ruled 2026-11-01; see Format additions from the zine-compendium survey).

**treasureTypes** (may also carry `name` and `averageGp`, as text)
```json
{ "id": "tt-k", "letter": "K", "kind": "hoard", "entries": [ { "chance": 40, "amount": "2d6 × 100 sp" }, { "chance": 10, "amount": "1 magic item" } ] }
```

**items** (new optional fields): typed blocks `weapon`, `armour`, `animal`, `vehicle`; free-form `fields`; `slot` (`armour`, `shield`, `hand`, or `worn` for things worn without taking a hand or the armour place — gauntlets, rings, cloaks, boots; any number may be worn, bonuses count while worn; mb-5, 2026-11-04); `hands` (1 or 2); `armourType` (a type named in classes' `armourAllowed`, or `chosen` when the GM picks the base armour on handing it out; it alone decides who may wear the armour); `armour.type` (the `armour` block's `type`, below: the category the armour **carries as**, for load and movement; defaults to `armourType`; magic armour that is lighter to carry names the lighter category here; `pack:check` lists items where the two differ; al-1, 2026-11-05, G-145); `weaponTags` (e.g. `Melee`, `Missile`, `Blunt`); **`weapon.improvised`** (optional boolean, R3-12, 2026-11-08): true for an improvised weapon (a chair leg, a reed pole), which is not a weapon type, so never a weapon skill pick; a variant (an item with `baseId`) isn't one either, its base type's skill covering it; `pack:check` names an `improvised` that isn't true or false; `material` on shields; `cursed`; **`availability: { where?: [settlement sizes], chance?, rarity?, note? }`** (a6-2, 2026-11-05, G-121: where the item is sold, in the setting's own size names as `settlement.availability.bySize` writes them; its chance of being in stock, "x-in-6" or "always"; the book's rarity word; anything else as a note; shown on the GM's buy card after the M5b gate, and used by Ask for… once places have sizes, M8b); `charges` {initial (a number or dice), rechargeable, note?}; `gmOnly` (list of field names hidden from the holder until revealed); `fuelItemId`; `properties` [{name, note}]; `container`; `usableBy` (class ids or tags); `shareable` (informational in R1). Shield `material` is a list (`["wood", "metal"]`). A **found** scroll carries `castingType` (`arcane` / `divine`), chosen when the GM hands it out. `unitName` and `pluralName` (ruled 2026-10-26): one unit of a stackable item ("torch") and two or more ("torches"), for toasts and the how-many prompt; without them the app says "Torch ×3". The checker warns when they aren't text.

**The `armour` block on items** (ruled 2026-10-29): `{ base?, ac?, aac?, acBonus?, type?, magicBonus?, baseArmour? }`, every number a whole number. `base` is the AC in the rules set's AC direction; `ac` is the descending value and `aac` the ascending one (a pack may give both); `acBonus` is a shield's or a bonus item's bonus; `type` is `"light"`, `"medium"` or `"heavy"`: the category the armour **carries as** (load and movement), defaulting to `armourType` (al-1, 2026-11-05; see `armourType` above); `magicBonus` is a magic bonus that makes AC better. **`baseArmour: { choose: [item ids] }`** (ruled 2026-10-29) is magic armour whose base is picked when it's found: each id is an armour item (slot `armour`, with its own AC); the choice is stored per item, and AC is the chosen base's plus `magicBonus` (05). `armour.class` and `armour.bulk` aren't format keys: write `type`. A plain number (`"armour": 4`) means `base`. A shield's bonus is its `armour.acBonus`, else the rules set's `attack.shieldBonus`. The AC direction is the rules set's `attack.style` (`"ascending"` or `"descending"`), then the campaign's AC-style option, then the style `attack.unarmouredAC` names, else ascending. A hidden (unidentified) bonus doesn't change the player's numbers until it's revealed (2026-10-24); the GM sees the true AC. `npm run pack:check` warns about any other key in the block (naming `type` for `class` and `bulk`), about a value that isn't a whole number, and about a `baseArmour.choose` id that isn't an armour item in the pack.

```json
{ "id": "bog-iron-coat", "name": "Bog-iron coat", "category": "armour", "slot": "armour", "armour": { "ac": 5, "aac": 14, "type": "medium" } }
{ "id": "reed-buckler", "name": "Reed buckler", "category": "armour", "slot": "shield", "armour": { "acBonus": 1 } }
```

Hooks read `slot`, `hands`, `armourAllowed`, `spellcasting` (with `blockedBy`) and `castingType`. Gear the class's `armourAllowed` or `weaponsAllowed` doesn't permit is blocked from being equipped (ruled 2026-10-25); `blockedBy` gear is allowed, with the derived status.

**startingKits** [{id, name, classIds?, items [{itemId, qty}], costGp?, rolls?, classItems?}] — `qty` may be dice and `itemId` may name a required pack's item (G-57, 2026-11-01; Format additions from the zine-compendium survey)
```json
{ "id": "warden-kit", "name": "Warden's kit", "classIds": ["lantern-warden"],
  "items": [ { "itemId": "rope-50ft", "qty": 1 } ], "costGp": 20 }
```
A kit without `costGp` is free. A **rolled kit** has `rolls` [{name, die, times?, rows [{min, max, items [{itemId, qty}]}]}]: the player rolls `die` at the table `times` times (1 if not said) and taps the row they rolled; a row with no items gives nothing. A roll without a name, a die or rows, or a row without whole `min` and `max`, is left out, and `pack:check` warns (area 3 re-check, 2026-11-03). A roll may carry `forClasses: ["<class id>"]` (eq-9): only characters of those classes see it, so one quick kit can hold every class's rolls; a roll without it is for everyone. `pack:check` warns when `forClasses` isn't a list of class ids, or names a class the same file doesn't have. Where a kit's items land isn't a pack field: the app places them as Add item would (worn, in hand, then the first container; ruled 2026-10-26). `classItems` is text for something the kit names in words only ("A charm of your choosing"), shown on the card. Which kits a class may take: `classIds` (none means any class), or every kit when the campaign turns on "Any class can take any kit" (ruled 2026-10-26).
```json
{ "id": "fen-kit", "name": "Fen walker's kit", "classIds": ["fen-walker"], "items": [],
  "rolls": [ { "name": "Armour", "die": "d6", "rows": [ { "min": 1, "max": 3, "items": [] },
    { "min": 4, "max": 6, "items": [ { "itemId": "quilted-coat", "qty": 1 } ] } ] } ] }
```

**lightTypes**: `warnAt` is the pack's warning time and wins; without it the warning comes one turn before burnout (ruled 2026-10-30, A6). `duration` may be a formula; `fuelItemId` names the item consumed when it runs out. A light item is marked **`consumed: true`** (it leaves play when it burns out) or is a holder with **`fuel: "<item id>"`** (it stays; one fuel item is used); with neither, the GM is asked once per light type. **`warnAt`** (`{value, unit}`, per light type) sets when the warning shows; by default one step before it runs out. Ruled 2026-10-25.

**statBlocks** (new optional fields): `abilities` [{name, note}], `hpAverage`, `description` (one short line), `group` and `groupAbilities` (shared by every member of a family, e.g. great cats), `hpVaries` (true when Hit Dice depend on age, size or summoning; the app asks the GM for HD before working out hp).

**Structured Markdown** stays version 1 in R1 (item, light, class, xp, condition, statblock, field, rules, calendar, table). The new kinds are JSON only.

## Exploration (rules sets; ruled 2026-10-25)

Built in M5 (the engine and dungeon play) and M5b (wilderness play); hexes in M8b. All examples invented. A rules set's **`exploration`** holds `modes`, `playerReadable` (true: players see every procedure as a reference list) and an optional `note`. The exploration fields found in real packs were ruled in one pass (G-07, 2026-10-29); `npm run pack:check` checks every shape below and names the new shape when a pack writes an old one.

**Everywhere in exploration** (G-07):
- Free text is **`note`** (modes, checks, movement, rest, camp, steps, terrain, activities, `exploration` itself). `notes` is read as an alias.
- **`source`** (a page reference) may sit on any object or sub-object.
- **`option: "<option id>[=<choice id>]"`** (ruled 2026-11-01, G-40; the older `onlyWithOption: "<option id>[:<choice id>]"` is read as an alias) is the one way to say "only when this optional rule is on" (weather effects, a rules variant…): with no choice id the option's `on` choice. Any activity, camp step, check or table may carry it (ruled 2026-10-30, WA1); the app hides it while that option is off, and `npm run pack:check` checks it wherever it sits.
- **`icon`** comes from a closed list of 19 (ruled 2026-10-29): `time`, `light`, `listen`, `door`, `search`, `rest`, `camp`, `travel`, `weather`, `encounter`, `star`, `note`, `watch`, `describe`, `course`, `lost`, `monster`, `forage`, `hunt`. Any other value shows the plain dot and the checker warns.

**Modes.** A mode's `id` never starts with `app:`: those ids are the app's own (04, Expedition), and a mode written with one is left out. Each mode has `id`, `name`, `step` (`{value, unit}`: a turn, a day…), `procedure`, `checks`, `movement`, `rest`, and optional `terrain`, `terrainClasses`, `camp`, `activities` (the app offers them in day modes; turn-mode activities stay valid in a pack but Act… is in the parking lot, ruled 2026-10-30, DG12) and `weather` (day-by-day modes; overriding the rules set's). **`other`** (default true) shows **Other…** on the activities row. **`rest: null`** means the mode has no rest reminder. When two attached packs define modes, they form an optional-rules group with **ruleKey `exploration`**: the GM picks one pack's modes, all or nothing.

```json
"exploration": { "playerReadable": true, "modes": [
  { "id": "creep", "name": "Creeping", "step": { "value": 1, "unit": "turn" }, "procedure": [], "checks": [], "movement": {}, "rest": {} },
  { "id": "roam", "name": "Roaming", "step": { "value": 1, "unit": "day" }, "procedure": [], "checks": [], "movement": {}, "rest": {},
    "terrain": [], "camp": {}, "activities": [], "weather": {} } ] }
```

**GM reference panels** (`gmReference`, ruled 2026-11-01, M5 gate B4; G-45): on a rules set or an adventure, GM-only: `[ { "id", "title", "entries": [ { "heading", "text", "tableId"?, "source"? } ] } ]`. Each panel shows after the app's standard ones (Combat, Dungeons, Class abilities, Equipment, Tables) on the GM reference screen (05), tagged with where it came from; `text` is the book's rule in the pack's own words with its page in `source`; `tableId` names a table the entry opens. `npm run pack:check` warns when a panel has no entries or an entry no text. Read from M5b.

**Common player actions** (`exploration.playerActions`, added 2026-10-31 for Something else…, 05; shown on the GM reference screen's Dungeons panel from the M5 gate, B4): `[ { "id", "name", "group", "text", "source"? } ]` on the rules set, player-readable. `group` is a short heading the pop-up sorts under ("Doors", "Searching", "Light"); `text` is the rule in the pack's own words with its page in `source`. It is reference only: no cost, chance or table (those are activities, offered in day modes). `npm run pack:check` warns on a missing `group`.

**Procedure steps:** `{id, name, icon, kind, note?, …}`. Kinds: `note` (a quiet line), `roll` (a table: `tableId`, the GM enters the die result; `tableId` may be left out, and the GM then types the result with the step's `note` as the prompt; **`tableBySeason`** `{ <season id>: <table id> }` picks the table by season), `check` (`checkId`, from the mode's checks), `camp`, `watches` (in camp: `watchLength`), `auto` (done by the app: lights burning down, the clock moving). `note` is allowed on any step. Without an `icon`, a plain dot.

**Slot bands, terrain tables, set chances, best-of skills** (ruled 2026-11-03, `design/rulings/m5b-pack-review-area-2-gaps-2026-11-03.md`). `encumbrance.slot.bands { equipped: [{ maxSlots, speed }], stowed: [...] }` with `combine: "slowest"` (ga-1). A table row's `next: { byTerrain: { <terrain or class>: tableId }, default }` (ga-2), or `next: { regional: true }` to open the party's region's table from `wildEncounters.regionalTables` (the region list when the region isn't known; `pack:check` warns when no `regionalTables` exist; fi-8, 2026-11-04); in a column matrix, `next: { byColumn: { "<column>": { regional: true } | "<tableId>" }, default? }` branches by the column rolled (`pack:check` warns on a key that isn't a column; fi-8b). A modifier's `chance: { on: [faces] }` sets the chance (with `ifClass`, `onlyOnTerrain`); the best for the party wins (ga-3). A skill's `fill: { best: ["base", { classSkill: "<code>" }] }` (ga-4).

**Party modifiers, skill lists, budgets, options run by hand** (ruled 2026-11-03, `design/rulings/m5b-pack-review-area-2-2026-11-03.md`). A check's or activity's `modifiers` may carry `ifPartyHas: { "class": id } | { "skill": id }` and `who: "self"` (ex-2). An activity's `chance.skill` may be a list; the best target counts (ex-3). A day budget is named in points unless one point is one mile; the book's distances may show as a second line (ex-6). An option may carry `manual: true` (the app doesn't apply it yet): shown as "Run by hand", the choice saved, listed by `pack:check` (ex-7). A book-optional rule defaults off unless the book recommends it, then on with a `note` (ex-4).

**Checks** use the encounter-check shape (adventure packs, §4; its `tableId` stays valid) plus `byTerrain` (the chance comes from the current terrain), **`terrainChance`**: `"lostChance"` or `"wanderChance"` (with `byTerrain`, which of the terrain's chances it uses; ruled 2026-10-29; without it the app guesses from the symbol of the step that runs the check, `lost` meaning `lostChance`, and `npm run pack:check` warns), `when` (`start`, `middle` (half the budget spent) or `end` of a day-long step; otherwise procedure order) and **`onHit`** (G-07): `{ tableId? | tableChoices?: [table ids] (the GM picks one, e.g. by depth), columns?: [labels] (the GM picks a column of a shared table, e.g. road or wild), regionTables?: true (then the region's table, through the rules set's `wildEncounters`), note? }`. `onHit` with no table is a note-only result. The importer reads the older **`column: "a|b"`** as `columns` split on `|` (`["a", "b"]`; ruled 2026-10-29), so old and homebrew packs keep working. Inside modes `onHit.tableId` is preferred to the check's own `tableId`. The table a hit rolls is the GM's pick, then the place's default, then the terrain's `encounterTableId` (checks using `wanderChance` only), then `onHit`; a lost check always rolls its own `onHit` (05). Checks no step runs are placed by `when` (no `when`: after the procedure). Their **modifiers** come from a fixed list: `weatherTag` (`add` faces), `routeType` (`never`, or an override `chance`) and `trackId` (the `byTrack` shape). Any modifier may carry `onlyWithOption` (or `option`): while that option is off it doesn't apply and the prompt doesn't list it (of-4). Anything situational uses the GM's "+ Modifier". **`secret`** (default `true`; ruled 2026-10-29): players see the result of a secret check only at the next Downtime or when the GM reveals it; set `false` for an open roll, whose result players see at once. **`alsoWhen`** (M5b; ruled 2026-10-30, D9) prompts the check on an event as well as on its clock: `{ "leaveRoute": "<route id>" }` prompts it on a Move… that leaves that route (e.g. `{ "leaveRoute": "road" }`); the four keys are **`leaveRoute`**, **`enterRoute`**, **`enterTerrain`** and **`leaveTerrain`** (confirmed 2026-10-30; only `leaveRoute` is used by a pack today). `npm run pack:check` checks it. **`onlyWhen`** (M5b; ruled 2026-10-30, settlement dry run, ST4): `"outDay"` (the check runs only while **Out and about today** is on) or `"activeNight"` (only while **Active tonight** is on), for a town's encounter checks (05, Settlements).

```json
{ "id": "roam-astray", "name": "Going astray", "every": { "value": 1, "unit": "day" }, "when": "start",
  "chance": { "die": "d6", "on": [1] }, "byTerrain": true, "terrainChance": "lostChance", "onHit": { "tableId": "roam-astray-result" },
  "modifiers": [ { "weatherTag": "fog", "add": 1 }, { "routeType": "road", "never": true } ], "note": "Fog makes it worse." }
{ "id": "creep-wander", "name": "Wandering things", "every": { "value": 2, "unit": "turn" },
  "chance": { "die": "d8", "on": [1] }, "onHit": { "tableChoices": ["creep-shallow", "creep-deep"], "note": "Pick by depth." } }
```

**Movement.** Turn by turn: `{ "kind": "perStep", "formula": "…", "familiarFormula": "…", "unit": "ft" }`, shown as information. Day by day: `{ "kind": "budget", "name": "…", "unit": "points" | "miles", "perDay": "<formula of speed>", "forced": { "factor"?: <number>, "add"?: <int>, "stack"?: "once" | "add", "note"? }, "routes": [{ "id", "name", "cost"?, "column"?, "note"? }], "mounted": <int>, "vehicle": <int>, "costPer": { "value": 4, "unit": "mile" } }`. **`unit`** defaults to `"ft"`. `perDay` is rounded down; **`mounted`** and **`vehicle`** are whole-number speeds that replace the party's speed in `perDay` when it rides or has a cart (confirmed 2026-10-30). Format names confirmed 2026-10-30:
- **`routes`**: the pack's routes (Wild, Road, River…), each with an optional `cost`, the encounter-table `column` it uses, and a `note`. A route's `id` is what checks' `routeType` modifiers and `alsoWhen` name. It replaces `roads` and `tracks` (the private packs move in their next candidates).
- **`forced`**: either `factor` (the pack's factor on the day's budget, rounded down) or `add` (whole points); **`stack`** says whether repeats stack (`"add"`) or not (`"once"`, the default). **`costPer`** (G-07) is the distance one terrain cost covers (it replaces `terrainCostPer` and `movement.hexSize`; the hex size itself stays on `hexGrid`, G-05).

**Terrain:** `terrain: [{id, name, class?, cost?, searchCost?, lostChance?, wanderChance?, mounts?, vehicles?, encounterTableId?, encounterColumn?, note?}]` and `terrainClasses: [{id, name?, cost, searchCost, lostChance, wanderChance, mounts: "ride" | "lead" | "none", vehicles}]`, both **inside the mode**. A terrain names a `class` and takes its numbers unless it overrides them, or gives its numbers inline with no class (both are valid). `encounterTableId` is the table rolled when a wandering check (one using `wanderChance`) hits there; **terrain faces** with no die use the check's own die if it has one, else the mode's **`chanceDie`** (`"d6"`, a mode field), else d6 (ruled 2026-10-29), and the prompt reads "1–2 on d6"; **`encounterColumn`** picks that table's column by terrain (it beats the check's `onHit.columns` when both are set). Locations carry `terrain`; adventure packs may add terrain types (prefixed with their code). The converter turns percentage-style rules into costs and chances and lists the conversions in its report.

**Camp:** `camp: { procedure: [steps], quick: { option: "<option id>" }, note? }`, or **`camp: { sameAs: "<mode id>" }`** to reuse another mode's camp (it replaces `camp.procedure` written as a mode id). By default only `watches`, the night `check` and the sleep `roll` prompt; a sleep step may carry `onGoodRest` effects (e.g. `[{ "heal": 1 }]`), which the app offers with one confirm, and **`onBadRest`** `[{ "condition": "<condition id>" }]`, offered the same way. A dungeon mode may define its own camp. M5b additions (ruled 2026-10-30; names fixed the same day, and revised that night):
- The camp's `procedure` gives the order (05: set up → fire, cooking, campfire talk → eat → watches → night check → sleep); steps it leaves out are skipped.
- **`cooking`** (D15; confirmed final 2026-11-01, engine reconcile ⚑ 1): `{ "ingredients"?: […], "portions": <int> | "<dice>" (per ingredient), "bonus"?: [effects], "note"? }`. A portion counts as the day's food and is `cooked` food (items, `food`); `bonus` uses the `onGoodRest` effect shape, offered the same way.
- **`sleep`** (D19; it replaces the earlier `camp.bedding` and the sleep step's `difficulty`): `{ "difficulties": [{ "id", "name", "result": "good" | "check" | "bad", "add"? }], "rows": [{ "season"?: [<season id>], "fire"?: true | false, "bedding"?: "none" | { "any": [<item id>] } | { "all": [<item id>] }, "difficulty": "<difficulty id>" }], "beddingItems": [{ "id": "<item id>", "shares"?: <int> }], "modifiers": [{ "when", "add", "note"? }], "checkAbility"?: "<ABILITY>", "note"? }`. A modifier's `when` names a camp fact: `campfire-talk`, `campfire-talk-fumbled`, `cooking` (a meal that worked) or `cooking-fumbled` (sl-1, 2026-11-04, `design/rulings/m5b-camp-facts-sleep-2026-11-04.md`); a step shows its Fumbled button only when a fact of that step is named. The first row a character matches sets their difficulty, shown with its reasons; each difficulty's **`result`** (confirmed 2026-10-30, replacing the provisional `roll`) is `"good"` (a good rest, no roll), `"bad"` (a bad rest, no roll) or `"check"` (the pack's sleep check, with the difficulty's `add` and the `modifiers`, campfire talk say). Invented example: easy `good`; moderate `check`; difficult `check` with a penalty as its `add`; impossible `bad`. `beddingItems` are the items that count as bedding; `shares` is how many characters one covers (a tent covers two). `checkAbility` names the ability the sleep roll uses. Without `sleep`, everyone rolls as before.
- The **campfire** (D16) is a light type (`lightTypes`, with `fuelItemId` naming the firewood item); `camp.fire` `{ "lightTypeId": "<id>", "note"? }` names it.

**Activities** (offered in day modes, M5b; G-07; turn-mode Act… in the parking lot, ruled 2026-10-30, DG12): `[{id, name, icon, cost, chance?, requires?, who: "one" | "several" | "party", maxActors?, bestOf?, secret?, modifiers?, result?, tableId?, tableByTerrain?, bySeason?, bySpecialSeason?, onlyIn?, onlyOnTerrain?, seasons?, note?}]`, shown only when usable.
- **`cost`**: `{ steps: <int> }` (steps of a turn mode), `{ budget: <int> | "all" }`, `{ time: {…} }`, or `{ fromTerrain: "<terrain field>" }` (e.g. `"searchCost"`; it replaces the text `"terrain.searchCost"`).
- **`requires`**: `{ skill?: <skill id>, item?: <item id> }` leaves out characters without it (`classSkill` becomes `skill`; an item named only in words stays as `note`).
- **`chance`**: `{ skill: "<id>" }`, `{ skill: ["<id>", "<id>"] }` (the character's best of those they have counts, compared as chances of success, the first on a tie; the roll line names it, ex-3) or `{ abilityCheck: "<ABILITY>" }` (the rules set's `abilityCheck` rule).
- **`maxActors`** caps how many act; **`bestOf: true`** has several roll and the best counts.
- **`modifiers`**: `[{ when: "fullDay" | "<condition>", add: <int>, note? }]` (it replaces `ifFullDay`).
- **`result`**: text or dice. **`tableId`** (it replaces `onSuccessTableId`) is rolled on success; **`tableByTerrain`** `{ <terrain id>: <table id> }` picks it by terrain; **`bySeason`** `{ <season id>: <dice or text> }` (it replaces `seasonResult`) and **`bySpecialSeason`** `{ <special season id>: <text> }` (it replaces an activity's `specialSeasons`) change the result.
- **`onlyIn`** lists **modes** (as 05 says; ruled 2026-10-29, fixing 07's earlier "terrain ids"); **`onlyOnTerrain`** lists terrain ids. The converter or pack author moves an `onlyOnTerrain` naming terrains the mode lacks into the activity's `note` until G-05; `npm run pack:check` flags it (ruled 2026-10-29, reworded 2026-10-30). That keeps the activity usable on the GM's judgement instead of never showing.
- **`yields`** (M5b; planned 2026-10-30, built in M5b by D3; confirmed that night): `{ item: "<item id>", dice: "<dice>" }` names the item a forage or hunt result gives and how many; it goes into the finder's pack (05 Activities). An activity's **`bySeason`** dice override `yields.dice` for that season. **`units`** in place of `dice` (G-108, ga-5, with G-92's `units`; built 2026-11-04) counts single pieces of a bundled item, as dice or a whole number: `{ "item": "<week's rations>", "units": "1d3" }` gives 1–3 days, the line the same item as buying it (the player's count asks for single pieces, "How many Ration day (…)?"); `dice` counts whole items, each its `bundle` (as a kit line's `qty`). `pack:check` says a yields with no count or both, a count that isn't dice, an item the pack lacks, and `units` on an item with no bundle. **Table rows' `items[]` take the same `units`** (technical, 2026-11-04: magic ammunition in rolled amounts on treasure rows, `{ "itemId", "units": "2d6" }`; `qty` counts whole items, or whole bundles when the item has a `bundle`, and may be dice too, as on kit lines (G-57); read with area-3 order 12).

```json
{ "id": "gather-reeds", "name": "Gather reeds", "icon": "search", "cost": { "fromTerrain": "searchCost" },
  "chance": { "abilityCheck": "WIS" }, "who": "several", "maxActors": 3, "bestOf": true,
  "modifiers": [ { "when": "fullDay", "add": 1, "note": "A whole day at it" } ],
  "result": "1d4 bundles", "onlyIn": ["roam"], "onlyOnTerrain": ["marsh"] }
```

**Seasons and weather:** `seasons: [{id, name}]`; **`weather`** sits at the rules-set level as the default for day-by-day modes (a mode's own `weather` overrides it): `weather.tables` keyed by season id or `any`, rolled once a day unless **`rollEvery`** `{ value, unit }` says otherwise, with rows carrying `tags` (`poor-visibility`, `impeded`, `wet`…); `weather.onlyWithOption` (it replaces `weather.option`): with that option off, the whole weather block and every procedure step of kind weather (a `roll` with the `weather` icon) are skipped, with no prompt (ruled 2026-10-29). **`weather.tags`** (ruled 2026-10-25) is keyed by tag id: `{name, budget?, note?, warn?}`. **`note`** (one field; confirmed 2026-10-30, merging the provisional `effect` into it, which the importer keeps reading as an alias — ruled 2026-11-01, engine reconcile ⚑ 4; A11) is the pack's player-facing text for the tag, shown after its name ("Wet · lighting a campfire is hard"), with any number it changes ("Travel impeded · −2 travel points"); it shows on the weather card and the weather prompt (fires, food). A rolled weather lasts until the next `rollEvery` step (A12). `budget` is added to today's travel budget (shown on the budget line: "Weather −2"); `warn` is text the GM sees when the party moves (nothing is ever blocked). Changes to check chances stay as checks' `weatherTag` modifiers. Players see the weather, the budget line and each tag's name and effects in plain words (ruled 2026-10-30, D1, replacing "never tag names"); the weather tables stay GM-only. Invented example: `"tags": { "mired": { "name": "Mired", "budget": -2 }, "fog": { "name": "Fog", "warn": "Hard to keep your bearings" } }`. Special seasons: `{id, name, weatherTableId?, weatherFrom?, encounterSwap?, effects?, start? (kept for R3)}`; **`encounterSwap`** `{ chance: { die, on: [ints] }, tableId }` (singular; it replaces `encounterSwaps`); `weatherFrom` is a season id, `effects` text. Daylight: optional sunrise and sunset, **`daylight.byMonth`** `[{ month, sunrise: "HH:MM", sunset: "HH:MM" }]` (by season works the same way).

**Rest:** per mode, `rest: { every: {…}, length: {…}, condition: "<condition id>", note? }`, or `null` for no rest in that mode.

**Time lengths:** `time.turnsPerHour` (a whole number; when given it wins over the hour worked out from `turnMinutes`; confirmed 2026-10-29, and `npm run pack:check` warns when `turnMinutes` × `turnsPerHour` isn't 60). `time.extra: [{id, name, minutes | hours | days, showOnClock?}]`, usable in reminders' `every`. At most one shows on the clock, and only if it divides a day evenly.

**Leaving the dungeon** (ruled 2026-10-29, D24; 2026-10-30, DG17–DG19): a rules set's **`dungeonExit`** turns on the **Leave the dungeon** button and its escape rolls (05) when it's present (and its `onlyWithOption` is on, if it has one):

```json
"dungeonExit": { "roll": { "save": "breath" },
  "modifiers": [ { "id": "map", "name": "Has a map", "value": 2 }, { "id": "known-way", "name": "Knows a safe way out", "value": 3 } ],
  "depth": { "per": 1, "value": -1 }, "onFail": { "table": "lost-below" }, "safePaths": "Short note on using safe paths." }
```
- `roll` (optional, of-5): without one the rule offers **Use safe paths** only (no roll, its `safePaths` note shown; `pack:check` asks for the note, and no `onFail`). `{ save: <save id> }` or `{ check: <check id> }`, with the flat `modifiers` and `depth` below (fae-woodland's escape roll uses a save); **or** (ruled 2026-10-30, DG19) a die rolled under a chosen base: `{ "die": "<dice>", "rollUnder": true, "base": { "choose": [{ "id", "name", "value" }] } }` with **`levelGap`** `{ "compare", "per", "value" }` (a modifier for the gap between two levels, `value` for every `per` levels) and **`limits`** `{ "min", "max" }` on the target. Both shapes are tested (the second with an invented sample rule in a private homebrew test pack).
- **`who`** (ruled 2026-10-30, DG18): `"each"` (the default: each character rolls) or `"party"` (one roll for the party). Players enter their own rolls; the GM previews each outcome before sending it (05, Leave the dungeon).
- `modifiers`: switches on the prompt, each with its value; `depth` `{ per, value }` means "`value` for every `per` levels down" (confirmed 2026-10-29), the levels counted below the first (the stepper reads "levels below the first", T3): `{ "per": 2, "value": -1 }` gives −1 on 2–3 levels below, −2 on 4–5 (worked out by the app).
- `onFail.table`: the table the GM rolls for a character who fails; `safePaths` (optional note): the pack's procedure, shown by "Use safe paths".

**Settlements** (M5b; ruled 2026-10-30, settlement dry run, ST1–ST12; 05 Settlements): a settlement mode's `step` is a part of the day (morning, afternoon, night). The town screen reads the pack's settlement services (used goods, a jeweller…), lodgings with their rates, the lifestyle option's daily cost, the availability chance for buying, the sale-price rule and the town activities. **Fields (ruled 2026-11-03, `design/rulings/m5b-settlement-switches-2026-11-03.md` st-2):** `settlement.services[] { id, name, kind: buy | sell | identify | store | loan | other, rate?, note }` (a seller's `rate` is the share of the price it pays; `other` is offered as a town activity); `settlement.availability { bySize: [{ size, chance }] }` (the Hit / Miss on Ask for…); **a settlement's own place** in a region or adventure pack may carry `settlement: { size, population? }` (ruled 2026-11-05, G-157): `size` is one of the sizes the rules set's `bySize` names (the checker says so when it isn't) ; `population` is a whole number for the GM's card. **The app keeps no size on a place today** (the builder's check, 2026-11-05: the GM's buy card lists every size's chance and the GM picks; nothing reads pack locations into places yet), so both are carried by the pack until M8b reads locations: then one size on the place, a GM picker with the rules set's sizes, Ask for… showing that one chance, filled from the pack's location; `settlement.salePrice { default, byService? }`; a town mode's `step: { "value": 1, "unit": "partOfDay" }` (morning, afternoon, night). Lodgings, stored places, loans and lifestyles: the Downtime section's shapes (dt-46). A setting without a settlement mode (classic-advanced) still gets the town screen (05).

**Rules-set sections the engine reads** (G-07): **`wildEncounters`** `{ typeTableId, commonTables: { <type>: <table id> }, regionalTables: { <region>: <table id> }, aquaticTableId, activityTableId, lairChance, lairMultiplier, surprise, distance }`, used by `onHit.regionTables`; `regionalTables` is keyed by region name until G-05 rules regions, then by region id.

**Reference only** (free-form, no engine; `gmOnly` honoured): `lost`, `unencumberedMovement` and `defaultSpeed` (the mode's check and formulas are what the engine uses), `hunger`, `hazards`, `dungeon`, `settlement`, `vehicles`, `fairyRoads`, `leyLines`, `shrines`, `surprise`, `encounter`, `encounters`, and `exploration.note`.

**Waiting for G-05** (the hex maps and regions design session, before M8b's design): `hexGrid` at the rules-set level and its extra fields, and the pack-root `regions` kind stay as they are; the checker leaves them alone.

**Hexes, roads and hidden features** (adventure and setting packs; M8b). A region may carry **`hexGrid`**: `size`, `orientation` (`flat` | `pointy`), `coords` (`offset-odd-columns`, `offset-even-columns`, `offset-odd-rows`, `offset-even-rows`), `keyFormat` (e.g. `CCRR`), and `defaultTerrain` for blank hexes; hex locations carry `hex` keys and, like any location, **`terrain`** (a terrain id from the mode's list; the checker accepts it; a hex with two terrains keeps the second in text; G-155, 2026-11-05). Roads and tracks are routes with `type: "road" | "track"` and a `distance`; a feature may be `seenFromRoad: true`. **`hiddenUntilSearched: true`** works on secrets, clues and sub-locations. A map image may carry **`gridOverlay`** (`{ origin: {x, y}, hexWidth }` in image pixels), reserved for tapping hexes in R2.

## Sheet, skills, effects and options (ruled 2026-10-25)

All examples invented.
- **`traitLists`** (a kind, CS-1; the format ruling for G-04, closed 2026-10-28): `{id, name, die?, notes?, help?, source?, entries: [{id, name, min?, max?, notes?, blurb?, source?, effects?}]}`, for backgrounds, affiliations, signs, secondary skills. `help` (optional, ruled 2026-11-02) is the list's own Help me choose text; without it the app's own words name the list (creation retest 4, T5, 2026-11-09: help is keyed by the step and its list, so `creationGuide.traits.help` no longer stands in for a list without help). With a `die`, each entry's `min` and `max` give its roll range (rolled at the table, then tapped). A sheet field uses one with `type: "list", from: "<traitList id>"`. Effects use the existing hooks and fills. `npm run pack:check` checks the kind; the app imports it as a kind players read, and offers it at creation and on the sheet (M5b step 0b, ruled Now 2026-11-01). An entry's `gmOnly` list hides its own fields from players, like any other kind's. Entries may also carry `items` (starting gear) and `spells` (list changes): see Format additions from the zine-compendium survey (G-48, G-62; 2026-11-01).
  - **`rolls`** and **`distinct`** (pf-16, ruled 2026-11-13): `rolls: N` is how many times a character rolls or picks on the list at creation (a whole number of 1 or more; absent is 1); `distinct: true` means no result twice (without it the same entry may be taken twice). Example: `{ "id": "mire-marks", "name": "Mire marks", "die": "d4", "rolls": 2, "distinct": true, "entries": [ … ] }` gives each character two different marks. The step asks for N picks ("1 of 2 picked"); Decide later keeps those made; the field keeps them joined by "; ". `pack:check` names a `rolls` that isn't a whole number of 1 or more.
- **Sheet field types:** `number`, `text`, `longtext`, `checkbox`, `list` (with `choices`, or `from` a trait list), `ref` (later).
- **Abilities:** the rules set's **`abilityAffects`** maps each ability to at most 4 words (`{ "STR": "Melee, doors, carrying" }`), shown as its caption; **`abilityModifierNotes`** maps each ability to a sentence or two on what the score does, shown in its popup and at creation (ruled 2026-10-25, matching the packs). **`abilities`** is `[{ key, name, short?, blurb? }]` (ruled 2026-10-28, N3 and N23; shape confirmed 2026-10-29, B6): `{ "key": "MUS", "name": "Muscle", "short": "MUS", "blurb": "Lifting, shoving and hitting hard." }`. `short` (default the key) shows where people glance (score tiles, the scores steps, the check step), `name` in pop-ups and explanations ("+1 from Muscle"), `blurb` as the first line of the ability's pop-up (tap a score; ruled 2026-10-29) and under each ability on creation's scores step (M7). A plain key (`"MUS"`) is still read, with no long name. **Which name shows:** a GM's custom label on the ability's campaign field wins everywhere (tiles, creation, cards, pop-ups), then the pack's `name`, then the key (B6, replacing "a campaign field's label doesn't rename them").
- **Damage from a score** (ruled 2026-11-01, the M5 gate's C3 follow-up): the rules set's **`attack.damageScore`** names the ability score (its key, as in `abilities`) whose modifier adds to weapon damage, for rules that have one (invented: `"attack": { "damageScore": "MUS" }`). The modifier is that score's row in `abilityModifiers`, its `melee` or `missile` column by the weapon's Melee / Missile tags (the columns the attack bonus reads), so a score with only a melee modifier adds to melee damage alone. Weapons at hand show it ("+1 · 1d8+1"); absent, the damage die shows alone. `npm run pack:check` accepts it, and warns when it isn't a key or names an ability the rules set's `abilities` doesn't list. A free-text `attack.damage` stays a reference note.
- **AC with nothing worn** (ruled 2026-10-28, N22): the rules set's **`attack.unarmouredAC`**, one number or one per AC style (`{ "descending": 9, "ascending": 10 }`); the style is `attack.style`, else the campaign's choice of the option with `ruleKey: "ac-style"` (its id starting with the style's name, "descending-…"), else the first given. With no armour or shield worn and no AC typed in, the sheet and the Player screen show it plus the ability modifier (the shown AC always includes the modifier; ruled 2026-10-29, B9). With armour worn, the item's armour value (its `armour` block, above) is the base. With no value anywhere the app shows "—" and a quiet Set AC link, never a guessed number. A save category's short description may be `notes` (or `note`), shown in its pop-up.
- **Creation guidance** (rules set; ruled 2026-10-25): **`literacyNote`**, what each literacy level means (`{ "Illiterate": "…", "Basic": "…", "Literate": "…" }`, keyed as the INT fills name them); **`alignments`** and **`alignmentNotes`** `{ general, <alignment>: note }` (the three-button choice and its explanation); **`defaultRace`**, a race's id: the race a character gets when the player skips the race step (ruled 2026-10-26; there's no app default, so without it the race is required even where the creation method says optional; `npm run pack:check` warns when it names no race in the pack). Classes and races carry a one-line **`blurb`** for the option rows (Characters, XP and spells); an older `summary` is read as its alias (ruled 2026-10-29, E39).
- **`weaponProficiency`** (rules set; ruled 2026-10-25): `{ option, note, byCategory: { <category>: { start, gainEvery, penalty } }, specialisation?: { option, categories, cost, bonus: { attack, damage }, note }, restrictedWeapons?: { option, note }, source }`. Categories are the classes' `weaponProficiencyCategory` (e.g. martial, semi-martial, non-martial): `start` picks at level 1, one more every `gainEvery` levels, `penalty` to attack with a weapon not picked. `option` names the optional rule that switches it on (the picker shows only then); specialisation spends `cost` picks on one weapon for its `bonus`; `restrictedWeapons` lets a class's forbidden weapons be used with the penalty when its option is on. **At creation** (ruled 2026-11-01, `design/rulings/m5b-0-weapon-skills-and-traits-2026-11-01.md`): picks are the setting's **weapons** (items with a `weapon` block) the class may use by `weaponsAllowed`, never groups (a pack that groups proficiencies is G-47, parked); restricted weapons are shown but not picked; specialisation is one weapon. `npm run pack:check` warns when the option exists but a class names no `weaponProficiencyCategory`, or names one `byCategory` lacks.
- **`saveModifiers`** in the rules set: `[{id, name, value, appliesWhen}]` (e.g. `{ "id": "vs-hexes", "name": "vs hexes", "value": "WIS modifier", "appliesWhen": "magic" }`); shown beside the saves, never added in.
  - A `value` may be **`{ "raceField": "<field>" }`** (pf-21, 2026-11-14): the number in that field of the character's kindred, alone (`{ "id": "vs-hexes", "name": "vs hexes", "value": { "raceField": "hexWard" } }`, with a kindred `{ "id": "marsh-born", "name": "Marsh-born", "hexWard": 2 }`). The line shows for a character whose kindred carries the field with a whole number other than nought, and for no one else; beside `{ fill }` and `{ from, plusRaceField }`, one shape to a value (the app reads `fill`, then `raceField`, then `from`). `pack:check` notes a `raceField` no kindred in the checked packs carries with a whole number other than nought, and one beside `fill` or `from`.
- **`skills`** in the rules set: `[{id, name, die ("d6" or "%"), default, fill, rollMode?, notes?}]` (`notes`: what the skill does, shown as the paragraph of its breakdown sheet; without it, or a class's `skills.notes` entry, the sheet says the setting doesn't describe it — R3-13, 2026-11-08), merged with classes' `skills` (and `gmRolls`); activities use them through `chance: { "skill": "<id>" }`. **`rollMode`** (CS-5a): `"x-in-6"` (default, shown "2-in-6") or `"equal-or-over"` (succeed at or above the target, shown "5+ on d6", the die's glyph between; tfs-3, 2026-11-19).
- **`movement.unit`** and **`movement.explorationUnit`** (ruled 2026-11-09, G-214; `explorationUnit` rests on G-214 alone, its 09 line names only `movement.unit`): the book's own words for the unit of `movement.default` and of an exploration figure given as a formula (invented: `"unit": "paces per watch"`), so the sheet prints the figure with its unit and never invents one.
- **`movement.combat`:** feet per round, beside the exploration modes' movement: a number, or `{formula, unit}` (an `inMelee` text stays a note; ruled 2026-10-25).
- **Encumbrance:** `encumbrance.labels` (e.g. `{ "equipped": "On hand" }`), `encumbrance.slots: { equipped, stowed, adjust }` and speed **`bands`**; **`unencumbering: true`** on items or item categories (they go in a collapsed Tiny section).
- **Effects:** an item, spell or potion with a duration may carry **`durationHidden: true`** (the holder sees the symbol without its time left).
- **Activities** (day modes in R1, DG12; the full shape is in Exploration): `chance: { "skill": "<id>" }`, `who: "one" | "several" | "party"`, `secret: true` (the GM's prompt and result only), `requires` (`{ skill?, item? }`), `onlyIn` (modes) and `onlyOnTerrain` (terrains).
- **Options:** `category` on each option, with the rules set's **`optionCategories`** (their order; "Other" last), and `presets` (preset ids) on options, named in **`optionPresets`** (`[{id, name, notes}]`).
- **Spellcasting:** `reverseAt: "memorise" | "cast"` (default `cast`).

## Characters, XP and spells (M7 and M7b; ruled 2026-10-28)

All fields are optional, and all examples are invented. `npm run pack:check` checks each of them and says plainly what's off (it never stops an import); the app reads them from M7 (money parts from M7b). Every shape and step name below was confirmed on 2026-10-29 (E33).

- **`blurb`** (any entry of any kind: spells, classes, races, their `abilities`, the rules set's `abilities`, items, starting kits, trait-list entries): one line saying what the entry does in play, about 8 to 12 words, in the pack author's own words (the 8-word copying check applies). Shown 14 px under the name on choice rows (M7-4). Without one, a spell's row shows its duration and range. One field name on every kind (E39): an older **`summary`** is read as an alias; when both are there, `blurb` wins.
- **`creationGuide`** (rules set): guidance per creation step, keyed by step: `method`, `scores`, `race`, `class`, `who`, `spells`, `gear`, `languages`, `weaponSkills`, `traits`, `details` (cs-1: the optional Details step, always last before the review whatever the order). Each is a line (the why-line), or `{ why, help, title? }`: `why` is the step's one short line, `help` the longer guidance behind **Help me choose**, `title` the pack's word for the step ("Kindred"; ruled 2026-11-02, else the app's word). Without it the app uses its own why-line and its own Help me choose paragraph. A pack's own step help (`guide.help`) follows the app's shape: one short paragraph, no labels, what the term means, what it decides, then a closing line for the unsure player, ending "or ask your GM" where a GM can help (cw-4, 2026-11-06, replacing 2026-11-01's blurbs side by side). The steps after `who` (gear, languages, weapon skills, traits) follow the order this object names them in (ruled 2026-11-01).
- **`creation.require`** (rules set): a list of those step names the pack makes required; a required step has no Decide later. Example: `"creation": { "require": ["languages"] }`.
- **`spellcasting.recover`** (class): how spells come back: `rest` (a full rest), `restAndStudy` (a rest plus study time, in the class's `note`) or `prayer`. Read by the GM's rest prompt and End expedition ("Casters get their spells back").
- **`uses.per`** (class and race abilities, and other powers): `day`, `rest`, `fight`, `week`, and from 2026-11-05 `turn` (a turning attempt, mp-13), `year` and `ever` (a power used once a year or once ever, mp-16: `year` returns when the campaign's date passes it, `ever` never does) (see classes, `abilities`). Rest and day uses come back with the GM's rest prompt, fight uses at End fight, week uses when downtime passes a week.
- **Treasure XP**: the rules set's `xp.treasure` `{ perGp, note? }` is the pack's default for whether treasure gives XP (`perGp` above 0 means it does); the campaign option **Treasure gives XP** overrides it. The checker points the older `xp.treasureXpPerGp` here (E34).
- **Retainer share**: `xp.retainerShare`, a fraction (`0.5`), read by Award XP when retainers join Who shares in M9 (E34, E35). The checker points the older `xp.retainerXpPenalty` and `retainers.xpPenalty` here.
- **XP bonuses** (E38): the prime requisite bonus is read directly (classes' `primeXp` and the rules set's `primeRequisiteXp`); any other bonus is a `factor` hook with the target `xpAward`.
- **XP rounding**: `xp.rounding`: `nearest` (the default: half shares round up), `down` or `up`.
- **One-level cap:** `xp.maxOneLevelPerSession: true` turns on Award XP's Cap / Keep (G-18).
- **When characters can level**: `levelUp.when`: `downtime` (the default) or `anyTime`; the campaign can override it.
- **Classes' spell and HP fields** (E42–E44): `spellcasting.firstSpells`, `learnByLevel` and `scrollCopy`, and progression rows' `hpGain`: see classes (JSON format version 2). Classes' `race` (B10) is there too.
- **`traitLists`**: see Sheet, skills, effects and options.

```json
{ "id": "fen-rules", "name": "Fen rules",
  "creationGuide": { "languages": "Words you can speak and read in the fens.",
                     "scores": { "why": "Your scores shape what you're good at.", "help": "Roll in order; trade later if the rules allow it." } },
  "creation": { "require": ["languages"] },
  "levelUp": { "when": "downtime" },
  "xp": { "treasure": { "perGp": 1 }, "retainerShare": 0.5, "rounding": "nearest", "maxOneLevelPerSession": true } }
```

A similar invented pack is the checker's test fixture (`scripts/fixtures/m7-format.fixture.json`).

## Character files (`tabletop-character`, version 1; M7b)

A character downloaded with **Download a copy** (05, Characters) is a JSON file. Like `tabletop-pack`, the format ID names no product and is frozen (ruled 2026-10-28, M7-9).

```json
{ "format": "tabletop-character", "version": 1, "exportedAt": "2026-12-10T20:15:00Z",
  "campaignName": "The Ash Barrows",
  "packs": [ { "id": "fen-rules", "version": "1.2" } ],
  "character": { "name": "Wren", "level": 2, "xp": 2400, "fields": {}, "scores": {}, "hp": { "current": 9, "max": 11 },
                 "class": { "pack": "fen-rules", "id": "lantern-warden", "name": "Lantern Warden" },
                 "race": { "pack": "fen-rules", "id": "marsh-folk", "name": "Marsh folk" }, "statuses": [], "notes": "" },
  "inventory": [ { "pack": "fen-rules", "id": "rope-50ft", "name": "Rope, 50 ft", "qty": 1 } ],
  "spellBook": [], "prepared": [], "usesSpent": {}, "purse": { "gp": 12 },
  "portrait": "data:image/webp;base64,…" }
```

**What version 1 carries** (ruled 2026-10-29, E46): the character row (fields, scores, XP, level, class, race, HP, statuses), the inventory (each item with its pack's `meta.id`, its entry id and its name), the spell book, prepared spells, ability uses, the character's own purse, the portrait as a small embedded image, and each setting pack's `meta.id` and version. The field names above are illustrative (confirmed 2026-10-29): the build fixes them, and this section is corrected to the real names in the same pull request.
- Ids that mean something only inside one campaign's database (the character's id, campaign, owner, company, the GM's review note) are left out.
- **Never in a player's download:** GM-only data (hidden item facts, GM notes, anything the player can't see in the app).
- **Restore** reads `tabletop-character` version 1 and the older `grimoire-character` version 1 (the same shape). Each entry is matched by its pack's `meta.id` plus its entry id, then by exact name within the same kind; what still doesn't match (class, items, spells) is listed for the GM and kept as plain text on the sheet.

## Encounters and fights (rules sets, stat blocks, new kinds; ruled 2026-10-26, built in M6)

Every field below is optional: a pack without them still works, with the generic fallbacks 05 describes. All names and numbers in the examples are invented. `npm run pack:check` checks `pursuit`, `death`'s structured helps, `morale.triggers`, reaction rows' `meaning` and `grantsTempHp` against the shapes below, and names the new shape for `abilityLoss.pick`.

**Rules set fields**
- **`death`** (M6-5; read by the death panel, revised 2026-10-29): `{ at, belowZero, note, dying?: { startAt, perRound: { hp } | { chance: { die, on } }, deadAt?, helped, note }, byOption }`. `at` is the threshold (the HP at which the character is marked Down; with no `dying`, the plain rule: the panel offers Dies and Not yet); `belowZero` says whether HP can go below zero; `dying` turns on the dying rules: `startAt` where they begin, `perRound` what happens by itself at each new round (`{ hp }`: an automatic HP loss; `{ chance }`: a prompt for the death roll, Dies / Survives), `deadAt` the final point, and `helped` what being helped does. Without `death`, the panel asks "0 HP: dies?".
  - **`helped`** may stay text (shown as the rule) or be structured (2026-10-29): `{ wake: { roll, unit } }` (a wake-up timer from a roll the GM enters) or `{ hp, abilityLoss: { roll, enter: true } }` (HP restored plus a permanent ability loss rolled at the table, the result entered; ruled 2026-10-29, replacing `pick: true`, since the loss is rolled, not chosen), each with an optional `note`. Invented example: `"helped": { "hp": 2, "abilityLoss": { "roll": "1d3", "enter": true }, "note": "Back on their feet, but scarred." }`. Healed and Stabilised use the same shape where the rule offers them (`healed`, `stabilised`, optional).
  - **The cases the panel must cover** (both test settings, each with its death's-door option off and on, four in all; described generically): a plain threshold with no dying rule; dying with an automatic HP loss each round; dying with a death roll each round; and Helped as a wake-up timer, or as HP back with a permanent ability loss. A death's-door option switches `dying` on (or changes it) through `byOption`. **Confirmed against both candidate packs** (2026-10-29): each one's death fields fit these cases, with the option off a plain threshold, and with it on either an automatic HP loss each round down to a final point with Helped as a wake-up timer, or a death roll each round with Helped as HP back plus a rolled ability loss. The field names inside `helped` are illustrative until the build fixes them; this section is corrected in the same pull request.
- **`morale`** (M6-6; it was a reference section and is now read): `roll` (the dice), `breaksWhen` (how the roll compares with the score), `triggers` [{ id, event: `firstDeath` | `halfDown` | `firstWound` | `hpAtOrBelow` (with a `fraction`) | `leaderDown` | `employerDown` (a retainer's or hireling's employer drops; added 2026-10-29), scope: `group` | `alone`, name }], `oneRollPerSide`, `maxChecksPerEncounter`, `passesToStop` (enough passes and the side fights to the end), `neverChecksAt`, `alwaysBreaksAt`, `noModifiersAt`, `modifierRange`, `result` (the text shown on a break) and `explain` (the short explanation behind ⓘ About morale). Retainers' `loyaltyCheck` gains `breaksWhen` and its list of occasions. **Morale prompts come only from these triggers** (ruled 2026-10-29): the app has no triggers of its own, so "leader down" or "employer drops" appear only when the pack lists them. A pack with only a written rule shows it, with no automatic triggers. Invented example: `"morale": { "roll": "2d6", "breaksWhen": "above", "triggers": [ { "id": "first-fall", "event": "firstDeath", "scope": "group", "name": "First of them falls" } ], "maxChecksPerEncounter": 2, "explain": "Foes may flee when a fight turns." }`.
- **`naturals`** (M6-9): per roll type (`attack`, `save`, `abilityCheck`, `skill`), `{ die, high: { on, text }, low: { on, text } }`. Shown as text on save and skill prompts ("a 1 always fails"); never automated.
- **`rolls`** (pf-20, `design/rulings/dec-player-screen-2026-11-14.md`): beside `naturals` and keyed the same way by roll type (`save`, `abilityCheck` and, since tfs-2, `skill`), `{ "die": "d20", "pass": "atOrOver" | "atOrUnder" }`, as in `"rolls": { "save": { "die": "d20", "pass": "atOrOver" }, "abilityCheck": { "die": "d20", "pass": "atOrUnder" } }`. The Saves line and the scores' line are built from it and nothing else ("Roll d20: your save's number or higher succeeds."; sv-1, sv-3); a rules set without the key for a roll type shows no line. Each roll type is read from the highest rules set (in the campaign's pack order) that carries that roll type (rl-1, Francis 2026-11-15: by loaded-pack priority, per roll type): a set above that carries only `save` leaves a lower set's `abilityCheck` in force. A roll type in a form the app doesn't know, on the highest set that carries it, shows no line; it never falls through to a lower set's. `pack:check` refuses a `die` the app can't draw (d4, d6, d8, d10, d12, d20, d100) and a `pass` it doesn't know, and notes a rules set with `saveCategories` and no `rolls.save`. Optional: both rules packs of the December stack carry it (classic-advanced `save` and `abilityCheck`, fae-woodland `save`). A third roll type, `skill` (tfs-2, 2026-11-19): the same shape, `"skill": { "die": "d6", "pass": "atOrOver" }`, gives the Skills heading its line ("Roll d6: target or higher succeeds."), by the same rules as the others. It is apart from a skill's own `rollMode`, which gives that skill's figure.
- **`combat.spellDisruption`** (M6-9; structured 2026-10-29, E41): `{ "lostWhenHit": true, "beforeActing": true, "note": "…" }`. The `note` shows in each spell's rules pop-up beside **Spent**. From M7, with `lostWhenHit` (and `beforeActing`: only a caster who hasn't acted this round), the damage pad shows a quiet "Spell lost?" line for a hit caster (05, Spells). The app keeps no casting declaration. Plain text is still read as the note, with no line on the pad.
- **`defaultRace`** (ruled 2026-10-26): a race's id, the race a character gets when the player skips the race step; there's no app default (see Creation guidance).
- **`initiative`** timing (read in M6; ruled 2026-10-29): `rerollEachRound` `true` means initiative is rolled every round, so the GM's round-start "which side won" tap appears each round; `false` means once per fight (the tap appears once, at the start). `ties` (`party` | `opponents` | `reroll` | `simultaneous`) decides ties. The same side can act twice in a row (the end of one round and the start of the next).
- **Acts last, initiative modifier, per-round heal** (read in M6; ha-2, ruled 2026-11-04; G-12, G-13, G-16): a weapon quality `slow` or `initiative: "last"` on a stat block makes its holder act last when the round order is made; an `initiativeModifier` (a fill target, below) is added to the roll when `initiative.mode` is individual; a status can heal an amount at each new round (the engine's `healPerRound`). "Rises again unless killed a certain way" stays R2.
- **`pursuit`** (read by We run and by the encounter's Avoid; ruled 2026-10-29): `{ note, evade?, drop?, source? }`: `note` is the pursuit rule in the pack author's own words; `evade` the evasion rule for avoiding an encounter; `drop` the rule for dropping food or treasure to slow pursuers. All text: the GM reads it and taps **Got away** or **Caught**; the app never decides (a chase tool waits for the table test, 11 G-01). Without it, the Escape step shows Got away and Caught alone.
- **Reaction tables** (ruled 2026-10-29): a reaction table's rows may carry `meaning`, one short line on what that result means at the table ("Wary: keeps its distance, may talk"), shown in the reaction ⓘ with the table's `note`. A result is a starting attitude, never a limit: Fight, Talk and Avoid are always offered.

**Temporary HP** (`grantsTempHp`; ruled 2026-10-29, read from M7; 11 G-23): spells, class and race abilities, and items may carry `grantsTempHp` `{ dice | formula, duration }`, for example `{ "dice": "1d6", "duration": "1 turn" }` or `{ "formula": "level", "duration": "until rest" }` (invented). Using the source gives the target that much bonus HP (the roll entered at the table; a formula worked out for the user), with a timer from `duration` (05, Bonus HP). In M6 bonus HP is entered by hand (Add bonus HP…).

**Stat block behaviour fields** (M6-13; read by the foe nudges, M6-2a):
- `profile` { wants, appearance, voice, intelligence, morality?, other?: [{ label, text }] }: the foe card shows the named lines in that order, then `other` (any further book line); `pack:check` warns on an unknown profile key (fi-7, 2026-11-04).
- `nudges` [{ text, when: `start` | `winning` | `losing` | `belowHalf` | `alone` | `leaderDown` | `any` }]: one or two lines show by the fight's state; untagged lines show first.
- `abilities` [{ id, name, text, uses?: { count, per: `day` | `fight` | `round` }, trigger? }]: limited uses show as dots.
- `triggers` [{ event: `firstSight` | `death` | `belowFraction` (with a `fraction`) | `eachRound` | `round` (with `n`) | `firstWound`, text }]: ▲ reminders for the GM, never automatic outcomes.
- `actionMenu` { pick, options: [abilityIds] }: reference text under More, not something the GM sets.
- `tables` { tactics?, signs?, lair?, other: [ids] }: Roll tactics appears only with a `tactics` table.
- Invented example: `{ "id": "bog-lurker", "name": "Bog lurker", "hp": "3d8", "profile": { "wants": "Warm things to drag under" }, "nudges": [ { "text": "Waits for the last in line", "when": "start" }, { "text": "Slips back into the water", "when": "belowHalf" } ], "abilities": [ { "id": "mire-grip", "name": "Mire grip", "text": "Holds a victim fast.", "uses": { "count": 2, "per": "day" } } ] }`.

**New kinds** (M6-13):
- **`modifications`**: { id, name, statChanges: { hd?, ac?, morale?, hp?, … }, adds: { abilities?, nudges? }, notes }. Chosen in Add foes ("Elite", invented); applying one changes the stats shown and adds its lines.
- **`overlays`**: { id, name, keepNumbers: true (default) | false, links: [{ packId?, statBlockId, behaviourId }], behaviours: [{ id, name, profile, nudges, abilities, triggers, actionMenu, tables, numbers? }] }. An overlay lays one source's behaviours on another pack's stat blocks: with `keepNumbers` the stat block's numbers stay and only the behaviour is added. Explicit `links` come first; otherwise the app suggests a name match and the GM confirms once per campaign (remembered); nothing links silently. `npm run pack:check` validates both kinds and lists each link and whether its stat block exists in the packs it names.

**Table uses registry** ("table of tables"; M6-10, ruled 2026-10-29, replacing the closed `use` list): a table carries **`uses: [paths]`**, dotted paths shown in collapsible groups: Encounters · Fights · Treasure · Places · People · World · Other. A single string is read as a one-item list, and the older **`use`** is read as an alias for `uses`. A table can have several uses; tables with none leave it out. **An item's own table** (it-1, 2026-11-04, `design/rulings/m5b-item-tables-2026-11-04.md`): an item may name a table in `refs.tableId`; that table's use says when it's rolled — `treasure.itemFound` (the GM, at hand-out; the result is written onto the item as its identity; GM-only until then), `treasure.itemUse` (the holder, from the item's pop-up; GM-only row parts as usual) or `treasure.itemReference` (replacing the plain `treasure` use on such tables); `pack:check` warns on an item's table with none of the three; the app reads them in M7.

| Group | Base registry paths (in the app) |
|---|---|
| Encounters | `encounters`, `encounters.reaction`, `encounters.signs` |
| Fights | `fights.tactics`, `fights.crit`, `fights.fumble` |
| Treasure | `treasure` |
| Places | `places.dressing` |
| People | `people.names`, `people.traits` |
| World | `world.weather`, `world.rumours` |

- **Packs add uses** through **`meta.tableUses: [{ path, name, group }]`** (invented example: `{ "path": "places.bog-smells", "name": "Bog smells", "group": "Places" }`); the converter writes any new use it finds there. A use that's neither in the base registry nor declared gets a `npm run pack:check` warning and is filed under Other.
- **Rumours:** `"kind": "rumours"` (Adventure packs, §7) is read as `uses: ["world.rumours"]`; the converter migrates old tables (ruled 2026-10-29: one concept, not two).
- The `encounters`, `fights.tactics`, `fights.crit` and `fights.fumble` uses drive Add foes' Encounters list, Roll tactics and the GM's Crit · Fumble buttons. The quick table builder picks uses from the same registry.
- Invented example: `{ "id": "fen-signs", "name": "Signs in the fen", "die": "d6", "uses": ["encounters.signs"], "rows": [ … ] }`.
- **Creation slots and `join`** (ct-5, ct-7, 2026-11-06, `design/rulings/m5b-creation-tables-2026-11-06.md`; G-201, G-192; built in #529): a table names its creation slot in `uses`: `creation.names`, `creation.details` or `creation.trinket`. Creation offers any attached pack's table for a slot the chosen kindred doesn't fill, the GM's pack order deciding between packs; it is optional and Next never checks it. A name table may carry **`join`**, how its columns join (default a space): with `""` two halves make one word, at creation and in the GM's Tables, the app dropping one hyphen on each side of the seam ("Adder-" and "-bald" give "Adderbald").
- **`forRaces` on a creation-slot table** (G-203, ruled 2026-11-07, a): a table whose uses include `creation.names`, `creation.details` or `creation.trinket` may carry **`forRaces: [raceIds]`** (one id is read as a list), so an overlay pack can offer a kindred tables of its own. Slot by slot, the kindred's own `tables` show first, then the tables bound to it (every attached pack, in the GM's order), each "Optional, from <pack>" (one row per name table, one row per details table; Design, 2026-11-07: offered to that kindred, not instead of its own). A bound table displaces the unbound slot tables (ct-5) for the slots it fills. The trinket is one table: the kindred's own, else the first bound one. A table bound to other kindreds is never offered. `pack:check` notes a race id the pack doesn't have (fine if another attached pack has it), `forRaces` on a table with no creation slot, and a `forRaces` that isn't a list of ids. Invented example: `{ "id": "otter-names", "name": "Otter kin names", "die": "d6", "uses": ["creation.names"], "forRaces": ["otter-kin"], "gmOnly": false, "rows": [ … ] }`.
- **`rollPrompt` on a describing table** (R3-2, ruled 2026-11-08): an optional string, the pack's own words for the first line of the table's sheet at creation ("Roll d6 twice: a reed name, then a pool name."). Without it the app says only "Roll d<N>, then tap the rows."; the app never composes a prompt from the parts' names. `pack:check` names a `rollPrompt` that isn't words. Invented example: `{ "id": "otter-names", "name": "Otter kin names", "die": "d6", "uses": ["creation.names"], "columns": ["Given", "Pool"], "rollPrompt": "Roll d6 twice: a given name, then a pool name.", "gmOnly": false, "rows": [ … ] }`.

**Matrices and lookups** (`kind: "matrix"`, `kind: "lookup"`) stay pack-only: the quick table builder can't make them, and the in-app editor can't create one from scratch; to get a new one, copy an existing table and edit the copy (ruled 2026-10-29). On a copy, a **lookup** table's rows can be edited (the step 7c forms); a **matrix** table changes only its name, die and notes, and its rows stay as they are (ruled 2026-10-30). To change a matrix's rows, export the pack and fix them with the converter (editing matrix rows in the app is in the parking lot, 08).

**Book text stays private.** Behaviour text, names and tables from books live only in private packs, in the book's exact wording or the GM's own (ruled 2026-11-03; the 8-word copying check is information only). Test packs (private, in `packs/` and on Drive): classic-advanced 0.5.6 or later and fae-woodland 0.2.9 (death, morale, naturals, defaultRace); slot-test-homebrew 0.5.0 (invented tactics, crit and fumble tables); monster-overlay 0.1.0 (an overlay and modifications on classic-advanced's stat blocks).

## Format additions from the zine-compendium survey (ruled 2026-11-01)

Twenty-one register rows (11, G-42 and G-48 to G-67) from one six-issue zine converted as a rules overlay on classic-advanced, ruled with Francis in `design/rulings/m5b-zine-gaps-2026-11-01.md`. The **format** is settled here so the pack session writes the data once; the **build** release of each is in 08 (M6, M7, M8b, or after R1) and the register. All examples are invented. A field below is read by the app only from the release named; until then the importer keeps it and the preview shows it as text.

**Rules overlay packs (G-55).** A pack with `meta.requires` and no rules set of its own (kind `homebrew` or `setting`) may carry any kind the setting may — `options`, `tables`, `traitLists`, `conditions`, `items`, `classes`, `spells`, `statBlocks`, `locations` (below) and GM reference panels — and **a rules-set fragment** (ov-1, 2026-11-04, `design/rulings/m5b-overlay-rules-fragment-2026-11-04.md`): `rulesSets: [{ id, extends: "<the required setting's rules set id>", settlement?, downtime?, … }]`, any rules-set field; lists merge by id (the overlay's entry wins on the same id, a new id is appended), scalars follow the pack on top; entries may carry `option`; `pack:check` lists the overrides. **`gmReference`** may sit at the pack's **top level** as well as on a rules set or an adventure; the GM reference screen's pack switcher merges a pack's top-level panels with those on its rules sets, tagged with the pack. **`meta.sources[]`** (optional): `[{ "part": "issue 5", "pages": "12–21", "kinds": ["traitLists", "conditions"] }]`, which part of a growing source each stage came from; shown in Settings › Packs ("from 6 parts"). **`meta.sourceTitles`** (optional, G-212, ruled 2026-11-09): `{ "<code>": "<the book's own title>" }`, so the app never prints a bare code ("i3 p. 8"). A `source` that starts with a code reads "<title>, <the rest>", the longest code winning ("Vol. 10" before "Vol. 1"; codes may hold spaces and apostrophes), the page tidied ("p96" and "p.116" read "p. 96" and "p. 116"); the key `""` is the pack's own book, for a bare "p. 12"; a source no code matches is shown as written (some are notes, like "classes[].progression"). `pack:check` checks the map. The overlay link is `meta.requires` alone (no `meta.overlays`: `overlays` is already the behaviour-overlay kind under Encounters and fights).

**Tables: a row's range written as text.** A row without whole `min`/`max` may give its range in `roll`, `level` or `key` as "2", "3-4" (or "3–4"), "8+" (8 or more) or **"≤2"** (2 or less, a modified roll below the die's lowest too; read by the app's table reader from 2026-11-05, `m5b-small-followups`). The database's weather roll doesn't read "≤N" yet: keep weather tables to the other forms.

**Tables: a row that opens a sub-table (G-42).** `rows[].tableId` beside `result`: the row keeps its own text, and the GM taps it to roll on the named table (B2: the row is the target); the sub-table's `description` heads the result. Read from M8b.

**Background lists and body figures for another pack's kindred (ruled 2026-11-09, G-217, G-218).** `traitLists[].forRaces: [raceIds]` with `uses: ["creation.background"]` binds a background list to kindreds the way `forRaces` binds creation-slot tables (G-203): the kindred's own list first, then bound lists. A top-level **`raceUsual: [{ forRaces, usual: { age?, height?, weight? } }]`** in the races' `usual` shape (`{ base, dice, unit }`) fills only what the race's own `usual` leaves out.

**Trait-list entries that grant gear or spells (G-48, G-62).** `traitLists[].entries[].items: [{ itemId | name, qty? }]`, the starting-kit shape: a picked entry fills them into the pack at creation like a kit. `traitLists[].entries[].spells: { add?: [spellId], replace?: [{ spellId, with }] }`: a picked entry (a cult, a bloodline, a pact) changes the class's spell list for that character; M7's spell step applies it. Garb, strictures and marks stay in the entry's `notes` and `blurb`; there is no deities kind.

**Trait-list entries that grant powers (G-213, ruled 2026-11-09).** `traitLists[].entries[].abilities: [{ name, note, uses?, spellId? }]`, the classes' `abilities` shape: once the entry is picked or rolled, its powers join the sheet's Abilities rows. `uses` is `{ count, per }` ("day", "rest", …): the power gets the Player screen's Use row and dots, and its row says the uses in words; without `uses` no dots. `spellId` names the spell the power casts, resolved in any attached pack's spells (the checker accepts another pack's spell when `meta.requires` names one). A power with uses whose name a class or race power with uses already has stays with the class or race, so it shows once. `pack:check` checks the shape.

**Rolled quantities and other packs' items on kit lines (G-57).** `qty` on `startingKits[].items[]` and on trait-list `items` may be a number or dice (`"1d6"`): the creation step rolls, shows "1d6 → 4 torches" and lets the player edit the result. An `itemId` on a kit or entry line may name an entry of any pack in `meta.requires`; the checker resolves against them instead of warning.

**Spells known, not slotted (G-49, G-63).** A class's `spellcasting.known: { byLevel: [{ level, count }], usesPerDay?, memorise?: "all" | <n>, listLevel?: <n> (default 0; of-6) }`: cantrips (a known count by caster level, memorised beside the slotted spells, `listLevel` 0) and learned lists (a rune per level, each usable `usesPerDay` times). A class may have slots, `known`, or both; no new `type` value. Spell list level **0** is allowed. Read from M7: the spell step offers the picks, the sheet shows known entries with pips when `usesPerDay` is set.

**Items that put a condition on someone (G-53).** `items[].applies: { conditionId, save, saveMod?, onset?, noticed? }`: when the item is used on a target the GM's damage pad offers "apply <condition>"; `onset` and `noticed` show as text to the GM (no timer). From M6.

**Damaged items (G-52, with G-35).** A condition may carry `appliesTo: "item"` (`{ "id": "bent", "name": "Bent", "appliesTo": "item", "effects": [...], "notes": "−2 to hit until straightened" }`): the GM sets it from the item's menu; the item line shows it beside the name. Repair as a town service comes later (parking lot).

**Drop-in places in rules packs (G-58).** `locations` (Adventure packs §2) are allowed in rules and overlay packs, with `parentId` and region optional: an inn with its keeper and secrets as GM notes, its services table and its happenings as `encounterCheck`. Dropping one into a session is designed with the prep space (before M8b).

**Stat blocks: sizes and parts (G-60, G-59).** `statBlocks[].variants: [{ name, fields, hp?, hpAverage? }]`: one block printed in several sizes; Add foe offers "Mud elemental · small / medium / large" and the variant's fields override (M6). `statBlocks[].parts: [{ name, hp, count }]`: body parts with their own hit-point pools; the fight screen's part pips are an M6 follow-up (G-59 stays open for the screen; see G-02).

**Level-scaled class features (G-61) and armour tiers (G-65).** `progression[].armourClass` (an unarmoured class's AC by level, feeding the AC line when no armour is worn) and `progression[].extra: { "<label>": value }` (shown as read-only lines on the sheet, filled at level-up); powers known use `spellcasting.known`. `items[].armour.tier`: an existing `armourType` id ("leather") such that a class whose `armourAllowed` names that type may wear this one too; the armour-warning hook and `allows()` read `armourType` or `tier` (built 2026-11-03, area 3 re-check).

**Level 0 (G-50; M7).** `rulesSets[].levelZero: { hitDie, attack, saves?, note }`: a creation path with no class and a background instead of a kit; **Graduate** (GM, at the first XP award) picks the class, rolls its hit points and keeps the higher.

**Materials (G-51; after R1).** `rulesSets[].materials: [{ id, name, costFactor, ac?, attack?, damage?, weightFactor?, onNatural1?: "bend" | "break" }]` and `materialId` on an item line, picked at hand-out; meanwhile a homebrew item carries the numbers.

**Point-buy skills (G-66, G-208; ruled 2026-11-20, `design/rulings/g208-expertise-points-2026-11-20.md`).** `classes[].skills.points: { atStart, perLevel, base, best, name? }` (whole numbers; invented: `{ "atStart": 3, "perLevel": 1, "base": 1, "best": 4, "name": "Expertise" }`): every class skill starts at `base`, each point moves one skill one step toward `best` and never past it, **up for `rollMode` x-in-6 and down for equal-or-over** (the skill's or the class's `rollMode`); the character has `atStart + perLevel × (level − 1)` points. With `points` in force the class's `byLevel` row is not read for its skills. An option switches it on through the class's `byOption` or a `patches[]` entry on another pack's class (which may also change `names` and `die`); `manual` goes once it is built. `name` titles the step and the sheet's line (else "Skill points"). The Expertise step and the To finish line follow weapon skills (05, 06). `pack:check` notes a `best` not past `base` in the skill's direction, a value that isn't a whole number, and `points` on a class whose skills' `die` isn't one die. Supersedes `{ mode: "points", pool, cap }` (2026-11-01).

**Item-count encumbrance (G-67; after R1).** `encumbrance.mode: "items"` with `bands.equipped` and `bands.packed` (count → speed; the slower wins) and an optional `strengthAdjust`; At hand (M6) counts as equipped.

**XP as the treasure was split (G-56; M7).** Award XP started from a treasure split offers "Split: evenly / as the treasure was split"; `retainers.xpShare` on the rules set names the retainers' share when the app applies one.

**Not modelled.** A two-class character switching daily with one hit-point pool (G-64) stays text on the race. Downtime projects costing weeks and gold (G-54) wait for the downtime design session with G-32.

## Patrons, and the December additions (ruled 2026-11-07 to 2026-11-12)

All optional; a pack without them reads as before. Examples are invented. The town, place, person, hoard, hook, map-key and region fields of pf-2 … pf-12b are in `design/rulings/dec-pack-formats-2026-11-11.md` until the pull request that reads each one lands (those read so far are written where they are read: pf-2 under encounter rows, pf-3 under pieces, pf-6 under `treasure`, pf-5's links and pf-5a under Links, pf-5's place facts and pf-12a under Place facts, pf-7 in §7a, pf-12 and pf-12b below).

**`patrons`** (a kind; `design/rulings/m5b-patrons-session-2026-11-07.md` pt-1 … pt-8, `dec-patrons-2026-11-12.md` pt-9 … pt-14). A god or other power a class may follow. Every text is the pack's own words; anything missing reads as empty.

| Field | What it is |
|---|---|
| `id`, `name`, `title?`, `blurb?`, `description?`, `depiction?`, `realm?`, `source?` | The entry's lines |
| `alignment?` | The patron's own alignment: shown, never applied |
| `followers: { classes: [classId], alignments?: [name] }` | Who may follow it. A class it names gets the Patron step; no alignments listed means any |
| `holySymbol?`, `prayer?`, `strictures?` | Text |
| `holyGarb: [{ atSpellLevel, text, itemIds?, costGp? }]` | Garb by tier: `atSpellLevel` 0 is worn from creation, a higher tier from the first spells of that level. The items are given free; `costGp` is what the pack says they would cost |
| `spells: { extends?: classId, swap: [{ level, replaces, with }], note? }` | Spells its followers cast in place of the class's |
| `marks: [{ atSpellLevel, text }]` | Marks of favour: a line on the sheet from that tier |
| `approval?: "gm"`, `approvalNote?` | Picking it needs the GM's approval |
| `cult?` | The GM's; never sent to a player |
| `option` | The optional rule it depends on. Every pack's patrons hang off the one option "Expanded cleric creation" (pt-9): a second switch in another pack is a fault |

A patron whose followers' alignments can't meet the class's own limit is closed to that class, never a dead end; one outside a class's usual alignments goes to the GM with the reason (2026-11-13, `design/rulings/dec-pack-and-rules-sweeps-2026-11-13.md` wk-1).

**`meta.statBlockLayout`** (pf-13, pf-13a, pf-13b): inside the pack's `meta`, `{ descriptor: [field…], groups: [[[field…]…]…], hide: [field…] }`. `groups` is three levels deep: groups, each a list of lines, each a list of field names. A name matches a creature's field exactly, case included. `hp`, in lower case only, is reserved for hit points with their average ("2d8 (9)"); a field a pack spells "HP" is an ordinary field, and hiding one never hides the other. A layout at the pack's top level gets the app's one compact group (each pack moves it into `meta` at its next build). With no layout the app draws one group in the creature's own order; a figure the layout neither places nor hides is drawn after the groups. The app's own bookkeeping fields (tags, links, behaviour) never show (sb-1a, 2026-11-12).

**`procedure` on a place and on the rules set** (pf-14, pf-14a). The list the exploration modes already carry, `[{ id, name, icon?, kind?, checkId?, text? }]`, may also sit on a location (a region or a place in it) and on the rules set as its default. The Scene shows the first it finds: the place's, the mode's, the rules set's, then the app's own five steps. `text` is the step's own words from the book, carried whole: rule text (Rule text set out like the book, below).

**Icons** (pf-12c). A step's `icon` and a rule's `button` name an icon from the app's set. Every name a pack already uses on a step's `icon` keeps resolving (the app maps old names to new pictures); an unknown name falls back to the step's number, or to a plain mark with the button's words. **A rule's `button`** (pf-12e, additive) is either **words** or **`{ "icon", "words" }`**. Words that name an icon of the set are that icon; any other words show on the button beside the generic mark. With `{ icon, words }`, `icon` names the icon and `words` are its label, for a screen reader (and a long press, once the app has one); an `icon` the set doesn't have falls back to the generic mark with `words` showing. An icon's label is its `words`, else the rule's `name`. Where the icon resolves, the button is the icon alone (mc-49). `pack:check`: `button` is non-empty words, or an object with a non-empty `icon` and, when given, non-empty `words` (anything else is an error); an `icon` not in the set is a note. Invented example: `"button": { "icon": "water-splash", "words": "Someone fell in" }`.

**A rule the book keeps from the players** (pf-12d). A rule in a place's `rules` may carry `gmOnly: true`. Absent means open to players once the place has been shown to them. It marks a whole rule; a rule is not split to hide a line.

**A place's `rules` and its own check, as the app reads them** (pf-12, pf-12b; read from December dec-7 piece 3). A location's `rules: [{ id, name, text, tableId?, button?, gmOnly? }]`: `text` in the rule-text block shape (`{ blocks: [{ p, lead? } | { h } | { list } | { table: { title, columns, rows } } | { source }] }`, or plain text, paragraphs split at blank lines; a block of another shape still shows its words). A rule with no `id` or `name` is skipped. `encounterCheck.replacesScheduled: true` makes the location's check stand in for the mode's scheduled encounter check while the party is there or inside it; `encounterCheck.when: "eachMove"` raises it on each move rather than on the clock; `encounterCheck.name` names it on the Rules sheet (else "Encounter check"). Rules and the check cover the places inside (`parentId`, same pack): the party at a spot reads the spot's rules and every enclosing place's, and the nearest place with a check decides. `tableId` on a rule is not shown yet.

**Whose book a page reference points into** (pf-15; adds to `meta.sourceTitles`, above). An entry of `meta.sourceTitles` may be `{ title, audience: "players" | "gm" }`; a bare string still reads as a title, its audience treated as the GM's. A bare "p. N" in a pack's text means that pack's own book; a reference into another book is written `[[ref:CODE|p. N]]`. A player's screen keeps a reference into a players' book and drops one into the GM's; the GM's screen shows all. Accepted in principle; final once the app's side is sized.

**Links** (pf-5, pf-5a). Anywhere in a pack's text, `[[kind:id|label]]` links to a thing: `kind` is one of place, npc, item, table, statBlock, spell, rule, adventureHook; `id` is this pack's, or `packId:id` for another pack's (`[[kind:packId:id|label]]`). The label shows; the id links. An unread or unresolved link shows its label as plain text. In a player's piece a link is a tap only to what that player can already see; otherwise the label shows plain. One way to point at a thing: no separate reference field.

**Place facts** (pf-5, 2026-11-11; pf-12a, 2026-11-12; read from December piece 2c). All the GM's. Any location may carry `identity` (the one line under the title), `facts: [{ lead, text }]` (bold lead-in lines in the pack's order), `gm.sections: [{ heading, text }]` (headed prose, folded under each heading; `gm.notes` stays for unheaded notes) and `tableIds: [ids]` (the place's own tables in page order, each keeping its own visibility; encounter tables stay on `encounterCheck`). A settlement may carry `watch: { text, leads: [{ lead, text }], statBlockId? }` (the town watch's box); a lodging may add `grade?` (the quality word) and `placeId?` (the inn that offers it). A lead-in's word comes from the pack, never from the app; the app sets it bold and keeps the pack's order. An area's full text, set out as its book sets it out, is `gm.text` (pf-12a), in the rule-text block shape (below); the players' pieces stay `playerView.text` and `aspects`. `pack:check` warns on an aspect without a `lead`, a person's leads out of the pack's order, a link that resolves to nothing, and a link inside a player's piece. A shop's and a person's pf-5 fields stay in the ruling until they are read.

**`pinnedFrom`** (sn-1b, `design/rulings/dec-pinned-source-2026-11-13.md`). An entry may carry `pinnedFrom`: the id of the pack it was copied from, as a plain string, on the entry itself (beside `id` and `name`). For a **class** or a **race**, an entry that carries it is treated, for the source line, as belonging to the pack it names when that pack is attached to the campaign: the pinned one reads "From <the named pack's short name>", a same-named entry beside it "From <its own pack's short name>".

### Rule text set out like the book (pf-18)

`design/rulings/dec-rule-text-blocks-2026-11-13.md`. A place rule's `text`, an area's `gm.text`, a location's GM section's `text` (`gm.sections[].text`; pf-18b, `design/rulings/dec-place-sections-blocks-2026-11-18.md`), a procedure step's `text` and a common player action's `text` (`exploration.playerActions[].text`; d5-16, `design/rulings/dec5-flags-sitting-2026-11-20.md`, ruled 2026-11-20, not read yet: until it is, an action whose `text` is not a string is left off the players' Activities card) have one shape. The value is either a plain string (always valid) or an object `{ "blocks": [ … ] }`; never a bare list. A block is an object with one marker key; there is no `kind` word.

| Block | Shape | Required |
|---|---|---|
| Paragraph | `{ "p": "…" }` | `p` |
| Sub-heading | `{ "h": "…" }` | `h` |
| Bold lead-in | `{ "lead": "Term", "text": "…" }` | both; `text` never empty |
| List | `{ "list": ["…", "…"], "numbered": true }` | `list`, of strings only; `numbered` optional |
| Titled table | `{ "table": { "title", "die", "columns": […], "rows": [[…]] } }` | `title`, `columns`, `rows`; `die` optional; a column header may be empty, as printed |
| Table by id | `{ "tableRef": "<table id>" }` | `tableRef` |
| Titled box | `{ "box": [ blocks… ], "title": "…" }` | `box`; `title` optional |
| Source line | `{ "source": "p. 10, p. 12" }` | `source`; always the last block |

One level of nesting: a box holds blocks, never another box; a list holds strings only; a list that belongs under a lead-in is written as the lead-in, then a separate list block. Inside any text the one mark is the link (Links, above), read in plain strings too; no bold or italic inside text: bold exists only as a lead-in's term.

A trait's text takes the shape too (tfb-5, 2026-11-19): a class's or a kindred's `abilities[].note`. A trait written as a plain string always reads as today.

```json
{ "blocks": [
  { "h": "Crossing the Mire" },
  { "p": "Each hour in the bog, the [[table:mire-hazards|Mire hazards]] table is rolled." },
  { "lead": "Sinking", "text": "A wader who fails a check sinks to the waist." },
  { "list": ["Drop the pack", "Grab a rope", "Call the lantern warden"], "numbered": true },
  { "table": { "title": "Mire hazards", "die": "d4", "columns": ["d4", "Hazard"], "rows": [["1-2", "Leeches"], ["3-4", "Sinkhole"]] } },
  { "box": [ { "p": "Optional rule: a bog lurker takes the last in line." } ], "title": "Bog lurkers" },
  { "source": "p. 12" } ] }
```

## Creation rules as data (ruled 2026-11-01, `design/rulings/m5b-0c-creation-rebuild-2026-11-01.md` cr-19 … cr-24)

Guided creation can enforce only what a pack says as data. Both test settings kept these rules as prose; from m5b-0c the app reads the shapes below and `npm run pack:check` says what's missing. All examples invented.

- **`rulesSets[].scores`** (required for the Scores step; the tiles start at the dice average rounded down, ruled 2026-11-02): `{ "dice": "3d6", "min": 3, "max": 18, "startOver"?: { "everyAtMost"?: 8, "countAtMost"?: { "count": 2, "value": 6 }, "option"?: "<option id>", "note"? } }`. The tiles start at the dice's average; Next checks the range; `startOver` is the setting's "you may start over" rule, offered when it triggers (gated by `option` when given). The checker warns when a rules set has classes but no `scores`.
- **`rulesSets[].abilityAdjustment`** as data: `{ "lowerBy": 2, "raiseBy": 1, "lowerable": ["STR", "INT", "WIS"] | "nonPrime", "raise": "prime", "floor": 9, "cap"?: 13, "classExceptions"?: [{ "classId": "knight", "cannotLower": ["STR"] }], "note", "source" }`. A string stays legal as reference text and gives no Adjust scores step (the checker says so).
- **`rulesSets[].languages`**: `{ "common": ["common"], "alignment": true | false, "list": [{ "id", "name", "blurb"?, "note"?, "source"? }], "extraFrom": "INT" }`; the ability modifier table's **`extraLanguages`** column is a whole number ("Native + 1" in words is the old way; the checker names the column). Races' and classes' `languages` name ids of the list; a bare name is matched by name with a warning. The option that turns alignment tongues off works through `alignment`.
- **`rulesSets[].alignmentVisibility`**: `"owner"` (the character's owner and the GM) or `"all"` (default): who sees a character's alignment (03).
- **Derived sheet fields** carry **`fill`** (Sheet, skills, effects and options): creation asks only for fields with no `fill` that no step owns (hit points are the app's own, rolled from the class's `hitDie` and the rules set's `hitPoints`: `startMinimum` the floor, `reroll { atMost, option?, note? }` the Roll again / Keep it callout — ruled 2026-11-02). The app keeps no list of derived fields; a layout that leaves `fill` off a worked-out field gets asked for it, and the checker warns on the usual names (AC, movement, attack, saves, title, literacy).
- **Abilities' `kind`** on classes' and races' `abilities[]`: `"advantage"` (default) or `"disadvantage"`, for the entry pop-up's headings (requirement · score changes · advantages · disadvantages · languages · open classes).
- Already in 07 and read by the same step: `creationGuide` (`why` and `help` per step; `help` is about the choice), `creation.require`, `spellcasting.firstSpells` and `known`, `startingKits`, `startingMoney` (dice; `byOption` for a setting whose money depends on an option), `weaponProficiency`, `traitLists` with `entries[].items`, items' `blurb`.

**The survey's fields (ruled 2026-11-03, `design/rulings/m5b-0c-creation-survey-2026-11-03.md`, cs-1 … cs-7; G-81 … G-94).**

- **Races:** `tables { names?, trinket?, details?: [tableIds], growth? }` (cs-1); `firstSpells` (the class shape) and `startingItems` as item ids, added to the class's (cs-2); `classMaxLevels` entries may be `{ maxLevel, soft: true }` — the one place for class limits by race, hard or soft (soft = special approval; cs-3; `classes[].kindreds`, `races[].forbiddenClasses` and a rules set's `creationRestrictions` are folded into it, and `pack:check` warns on them); `byOption` with the fields an option's choice changes (any of the race's fields, `npcOnlyClasses`, `classMaxLevels`, `abilities` and `abilityModifiers` included; cs-5, `design/rulings/m5b-builder-questions-2-2026-11-03.md` bq2-1); `armourSubstitutes` and `weaponsAllowed` read at Gear (cs-6); `acBonus` and `saveBonus` with an optional `when` condition, counted only when true (cs-7). Read (creation survey PR 5): `acBonus` is a whole number or `{ value, when? }`; the app reads armour words in `when` (unarmoured, light, medium or heavy armour, joined by "or" or commas) against the worn armour's `type`; any other `when` ("vs Large") is named in AC's breakdown and counted at the table. `saveBonus` is a whole number, `{ bonus, vs?, saves? }` or a list of them, shown beside each save it names (all without `saves`) as "+4 to the roll vs poison" (`vs: "all other"` reads "otherwise"), never added in (as `saveBonusByCon`, bq-8). `pack:check` names other shapes and an AC `when` it can't read.
- **Classes:** `alignments` (hard, or `{ ids, soft: true }`); a kindred-class's `race` and `replacesRaceTraits` (cs-4); `spellcasting` and `firstSpells` on kindred-classes (cs-2); progression `acBonus` (cs-7; a whole number per level, always counted) and `acBonus` / `saveBonus` as races have them.
- **Sheet fields:** `fields[].forClasses` (a field only some classes are asked) and `fields[].help` (the ⓘ line); a field `from` a table whose rows carry `alignment` sets the alignment (the knight's liege; cs-3).
- **Gear:** a kit roll may carry `distinct: true` (a row can't be picked twice; a second tap on a picked row untaps it, sq-3, 2026-11-04; repeats are allowed by default; `design/rulings/m5b-builder-questions-2026-11-03.md` bq-1); kit rows `ifSize` swaps and `oneOf` items; `startingEquipment.pick { tableId, upTo }`; lines `{ itemId, qty, units? }` (`units` counts single pieces of a bundled item; cs-6). Read at Gear (creation survey PR 4): `ifSize` (by the kindred's `size`) and `armourSubstitutes` on every kit line; `oneOf` and dice `units` (`"1d6"`) only on a kit's own `items` (the choice comes ticked at its `itemId`; dice units are a roll to tap), elsewhere the line gives its `itemId` or one bundle; a pick's table must be shared (`"gmOnly": false`) and only its rows with `items` are offered. `pack:check` says each.
- **Languages:** `languages.list[].roll` (a die range for rolling extra languages) and `learnableBy` (creature types); an overlay's `languages.list` merges into its base's (cs-6).
- **Trait-list entries:** `money` (a number or dice, added to starting money) and `spells.roll { listId, level }` (one spell of that list level, the level's spells numbered for the die: the roll opens under the entry's pick on its own step, tapped or typed, kept with the pick and shown on the review and the sheet; amended 2026-11-04, `design/rulings/m5b-builder-questions-3-2026-11-04.md` bq3-18; dice `money` is noted by `pack:check` and the GM adds it, bq3-19); entry items and kit lines prefer item ids, a `{ name }` line becomes a one-off item and `pack:check` notes it (`design/rulings/m5b-0c-creation-recheck-2026-11-03.md` rc-2, rc-3). Limits are **hard** when the book says must, cannot or only, **soft** when it says uncommon, typically or with the GM's leave (rc-5).

- **Trait-list entries:** `money` (a number or dice, added to starting money) and `spells.roll { listId, level }` (a roll added to the Magic step); entry items and kit lines prefer item ids, a `{ name }` line becomes a one-off item (approved with the new character, bq3-6) and `pack:check` notes it (`design/rulings/m5b-0c-creation-recheck-2026-11-03.md` rc-2, rc-3). Limits are **hard** when the book says must, cannot or only, **soft** when it says uncommon, typically or with the GM's leave (rc-5).
- **Later:** `spells[].usage { per, times? }` and the runes' level-band form (M7, with G-63).

## Downtime (ruled 2026-11-02, `design/rulings/m7-downtime-format-2026-11-02.md`, dt-46 … dt-50)

A `downtime` section carried by any pack, usually a homebrew or overlay pack, so a downtime supplement sits on any setting. No new pack kind. Ids resolve within the section (activities refer to each other). The app reads the fields in stages (dt-46: **1** M7, **2** M7 or just after, **3** with M8b); a field not read yet shows to the GM as one plain line in the activity's terms. Survey: `design/notes/downtime-pack-shapes-2026-11-02.md`. Examples invented.

- **`activities[]`**: `id`, `name`, `blurb`, `rules` (own words), `kind` (`significant` | `upkeep` | `free`; free takes no action slot, dt-50), `skippable` (upkeep; default true; a skip counts as the worst band, dt-38), `period` (upkeep; dt-41), `duration` (`{ amount, unit }`, unit `day` · `week` · `month` · `downtime`, or text), `costs[]` (`{ amount, per?, from? }`), `roll`, `progress`, `troubles` (a table id), `atTheEnd` (`{ text, grants? }`), `target` (`npc` · `place` · `item`, stage 3), `catalogue` (a list of variants with their own length and effect, e.g. fighting techniques). [stage 1: kind, skippable, period, fixed duration and costs, text atTheEnd]
- **Formulas** (stage 2): `amount`, `duration.amount`, step lengths and `roll.modifier` accept a formula in the rule-hook test language (below): of `step`, `level`, `spellLevel`, `itemPrice`, dice (`"2d6 * level"`).
- **`roll`**: `{ dice, modifier?, bands[], natural? }`. `modifier` is an ability, a formula, named choices (`[{ label, value }]`, e.g. teacher tiers) or another activity's step. Each band: `{ range, label, result?, progress?, table?, finishIn?, skipNextRoll?, needs? }` (roll another table; set a delivery in N downtimes; the next attempt needs no roll; advance only once a need is met). `natural`: bands on the dice alone (`{ dice: 2, label, table? }`), shown as a chip (dt-48). [stage 1: bands with `progress` and text; the rest stage 2]
- **`progress`**: `{ steps[]: { name, detail, cost?, grants?, branch?, wall? }, lengths?, start?, secret? }`. `lengths` or a formula for variable trackers; `start: "gm"` lets the GM pick the starting step; `secret` hides unreached steps (dt-47); `branch` opens a new activity; `wall` stops progress until the GM lifts it. [stage 1: named steps; the rest stage 3]
- **Trouble tables** are ordinary `tables`; rows may add `clock` (`{ amount, unit }`, optional), `blocks: true`, `repeats` (`{ amount, per: "downtime" }`), and `whenItRunsOut` (`{ text, progress?: -1 | "reset", ends?: true }`) (dt-49).
- **`grants`** (stage 3): `xp: "spent"` (XP equal to gold spent, into the XP pot), `spell`, `item` (`{ kind, pickPropertyFrom }`), `table`, `step` on another activity, a timed bonus.
- **Rules set** (`downtime` in a rules set or the section): `abilityModifiers` (a downtime-only score-to-modifier table), `modifierCap`, `defaultRoll`, `xpForSpending` (behind an option).
- **Settlements**: `lodgings[]` (`name`, `rate`, `per`, `sleeps?`, `storage?`, `tableId?` for an arrival table, `onGoodRest?` the sleep step's effect list, offered at the morning; also on a lifestyle and as `settlement.overnight.onGoodRest`, the most specific winning, `[]` = no healing; a rest-day activity may carry the same list and its `heal` may be dice, typed at the table when offered; a setting with no rest-day activity keeps its full-day heal as text until M7's Rest action (sq-5); sf-2, 2026-11-04), `storedPlaces[]` (`name`, `kind`, `fee?` as an amount or a share with `freeAfter?`, `holdsItems?`), `loans` (`{ rate, per, against }`), `lifestyles[]` behind an option (one daily cost by tier replacing lodging and meals). These settle the M5b settlement field names.
- **Worldbuilding prompts** go in `gmReference`.

## Rule hooks (format v2) — settled 2026-10-22

Setting rules may include `hooks`: small rules the app interprets. The runner is built in M4b; remind hooks switch on in M5, factor hooks and the scroll warning in M7, retainer warnings and the loyalty reminder in M9.

### Principles
- Hooks are **data, not code.** The app runs a small, fixed expression language. Packs can't loop, assign or call anything outside a fixed list.
- **Warnings never block.** GM fiat always wins. Every hook that changes a number shows a preview and is logged.
- **A hook that can't run is skipped**, never guessed. The GM sees "A rule couldn't be checked: <hook id>" in the log (GM only).
- **One evaluator everywhere.** The formula evaluator grows into this language; every formula stays a valid expression.

### Hook fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique within the pack |
| `kind` | yes | `fill` · `warn` · `factor` · `remind` · `modify` (exploration prompts, 2026-10-25) |
| `when` | yes | An event from the list below |
| `appliesTo` | no | Who it's about: `pc` · `retainer` · `mercenary` · `specialist` · `any` (default `any`) |
| `test` | no | An expression; the hook runs only when it's true. No test means it always runs |
| `message` | warn, remind | Text shown, with `{placeholders}` |
| `offer` | no (warn) | A one-tap fix: `swap` · `stowOther` |
| `target` | fill, factor | What it changes (one target, or a list for fill) |
| `value` | fill | An expression for the new value. Use either `value` or `from` |
| `from` | fill | A built-in fill source: `abilityModifiers` · `classProgression` (names only, never paths) |
| `respectEdited` | no (fill) | Default `true`: values the player edited by hand get the Use/Keep choice |
| `multiplier` | factor | A number or an expression |
| `every` | no (remind) | `{value, unit}`; repeats on the game clock |
| `note` | no | For the GM and the editor only; never shown at the table |

### Events (`when`)

Each event provides the names a `test` or `message` can use. Every event also provides `campaign`, for its flags (`campaign.flags.<id>`, as in the examples below; 2026-10-25).

| Event | Fires when | Names available |
|---|---|---|
| `characterCreated` | A character is submitted | `character` |
| `abilityScoreChanged` | An ability score changes | `character` |
| `levelUp` | Level-up is confirmed (also at creation: from level 0 to the starting level, ruled 2026-10-25) | `character`, `fromLevel`, `toLevel` |
| `levelLoss` | "Lose a level" is confirmed | `character`, `fromLevel`, `toLevel` |
| `xpAwarded` | XP is awarded (per recipient) | `character`, `amount` |
| `equip` | An item is equipped | `character`, `item`, `equipped` |
| `useItem` | An item is used (cast from a scroll, spend a charge) | `character`, `item` |
| `hire` | A hireling is added | `employer`, `hireling` |
| `wageDue` | A recurring wage comes due | `employer`, `hireling`, `wage` |
| `turnAdvanced` | The game clock moves | `campaign`, `expedition`, `turns` |
| `lightBurning` | Each turn, once per lit light | `light`, `carrier` |
| `adventureEnded` | The GM ends an adventure | `campaign`, `party` |
| `checkDue` | An exploration check or activity prompts (2026-10-25) | `check`, `party`, `location`, `weather`, `mode`, and `actor` for activities |

A reminder fires **once per clock jump**, with a count: moving the clock six turns at once shows "Encounter check due (×3)", not three reminders.

### The `test` language

The formula language plus comparisons and logic:
- **Values:** numbers, `"text"`, `true`, `false`, `null`, lists `[a, b]`.
- **Names:** dotted paths from the event (`item.slot`, `character.class.id`, `equipped.shield`, `employer.CHA`, `campaign.flags.wartime`), and `[ ]` key lookup (`character.race.classMaxLevels[character.class.id]`).
- **Maths:** `+ - * /`, brackets.
- **Compare:** `== != < <= > >=`, and `x in [a, b]`.
- **Logic:** `and`, `or`, `not`.
- **Dice** (formulas only; shown, never rolled): `1d6`, `level d6`.

| Function | Returns |
|---|---|
| `floor(x)` `ceil(x)` `min(a, b)` `max(a, b)` | Maths |
| `count(list)` | How many |
| `has(map, key)` | Whether a map has that key |
| `lookup(tableId, key, column?)` | A value from a pack table or a rules-set reference section, e.g. `lookup("abilityModifiers.CHA", employer.CHA, "maxRetainers")` |
| `allows(rule, item)` | Whether a class's `armourAllowed` or `weaponsAllowed` permits the item (below) |
| `primeXp(character)` | The prime requisite XP modifier from the class's `primeXp` (`standard`: the rules set's `primeRequisiteXp` row; `rules`: the `all` / `any` thresholds; rc-1, see classes) |
| `partyWith(path, value)` | The party members matching, e.g. `partyWith("class.id", "lantern-warden")` (2026-10-25) |

Rules:
- A missing name is `null`. Any comparison with `null` is false, except `== null` and `!= null`.
- `equipped.shield` is the item or `null`; `equipped.hand` is the main-hand item or `null`.
- A test is at most 300 characters.
- Mistakes are caught at import (the preview lists them), not at the table.

### Message placeholders
`{character.name}`, `{character.class.name}`, `{item.name}`, `{equipped.armour.name}`, `{light.name}`: any name from the event works. An unknown placeholder shows as blank, and the import preview warns about it.

### What `target` can be
- **fill:** `abilityModifiers`, `hitDice`, `attack`, `saves`, `spellSlots`, `skills`, `title`, or a campaign field key from the sheet layout.
- **factor:** `xpAward` (each character's part of an XP award; ruled 2026-10-29, E38, as the name Award XP reads; `xp` is read as the older name), `wage`, `share` (a loot share).
- **modify** (on `checkDue`, 2026-10-25): `chance` (add or remove faces), `afterHit` (a follow-up chance: "if astray, a guide finds the way again on 1–3"), `note` (a line on the prompt). Each shows on the prompt with its source.

New targets are added to this spec when a milestone needs them, never invented by a pack.

### What `allows()` checks

| Rule | The item passes when |
|---|---|
| `armourAllowed` (armour) | `types` is `"any"`, or includes `item.armourType` or `item.armour.tier`. `chosen`: the chosen base's type (or tier) is checked; before a base is chosen it passes when one of the bases in `armour.baseArmour.choose` fits (or none are listed), and is blocked when none fits (area 3 re-check, 2026-11-03; `plans/m5b-review-area-3.md`) |
| `armourAllowed` (shield) | `shields` is `true`; or it's `"wood"` / `"metal"` and that's in `item.material`. A shield of both asks once: "Wooden or metal?" |
| `weaponsAllowed` | Mode `any`: not in `exclude`. Mode `list`: in `ids`, or carries a tag in `alsoAllowTags`. Mode `tags`: carries a tag in `allowTags`; with `oneHandedMelee`, also any one-handed melee weapon. `optional` ids pass only when their option is on |

### Examples (invented)

```json
{ "id": "warn-warden-armour", "kind": "warn", "when": "equip",
  "test": "item.slot == \"armour\" and not allows(character.class.armourAllowed, item)",
  "message": "{character.class.name} can't wear {item.name}. The GM can allow it." }
{ "id": "factor-flood-wages", "kind": "factor", "when": "wageDue", "appliesTo": "mercenary",
  "test": "campaign.flags.flooding == true", "target": "wage", "multiplier": 2 }
{ "id": "remind-lamp", "kind": "remind", "when": "lightBurning",
  "test": "light.remaining <= light.type.warnAt", "message": "{light.name} is about to go out." }
{ "id": "remind-bog-check", "kind": "remind", "when": "turnAdvanced", "every": { "value": 3, "unit": "turn" },
  "test": "expedition.mode == \"dungeon\"", "message": "Check for bog lurkers." }
```

### Planned additions
- A race-bonus fill source (M4b).
- An `initiativeModifier` target (M6).
- A `lootSplit` event for treasure XP (M7).

Every new event, target or function needs a scope check (`08-roadmap.md`, Scope checks). ◈ A general rule engine stays out of scope.

## Homebrew

- A GM can make a homebrew pack (rules, setting, adventure or anything else) and load it alongside other setting rules.
- Packs stack in **one priority order**, in two layers (ruled 2026-10-24): every homebrew pack sits above all setting and adventure packs, and the order inside each layer is freely draggable; the higher pack wins an entry both have (same kind and id). Exceptions are per entry, chosen by the GM in the setting-rules browser (decided 2026-10-22; earlier wording said Optional rules). Optional rules never compete: each pack keeps its own.
- Each campaign has an automatic **campaign homebrew pack** holding its one-off items, custom tables and custom foes. It is made the first time something is saved into it; otherwise it's like any homebrew pack (ruled 2026-10-24, replacing "never shows in the Rules library and can't be removed"): listed, ordered, exported and removed (removing one with entries asks first). It stays with its campaign and is never shared (ruled 2026-10-25): its ⋯ has **Copy to Rules library**, which makes an independent homebrew pack, "<campaign> homebrew (copy)"; later edits to either don't affect the other.
- Imported homebrew packs are edited only from the Rules library (**Edit pack**), which shows "Used by N campaigns" before saving (ruled 2026-10-25): editing a shared pack from inside one campaign would quietly change the others.
- Each homebrew pack's ⋯ has **Export as pack file**: a homebrew pack file with its `meta.id` and no campaign state.
- Full in-app homebrew editor (every kind, including classes, rules and spells): **M3** (brought forward from R2, 2026-10-21). The converter skill can also build homebrew packs.

## Structured Markdown format

One file can hold many entries. A level-2 heading starts an entry: `## <kind>: <name>`. Lines of `key: value` follow. Anything else becomes notes.

```markdown
# Pack: My table's gear
source: Personal conversion
version: 1.0

## item: Rope, 50 ft
category: gear
weight: 50
slots: 1
value: 1 gp

## light: Torch
duration: 6 turns
radius: 30 ft

## statblock: Bog lurker
hp: 3d8 (13)
AC: 6
Move: 60 ft
Attacks: 1 bite (1d6)
Morale: 8
Hides under still water.

## xp: Lantern Warden
2: 2000
3: 4000

## table: Surprise
die: d6
1-2: Surprised
3-6: Not surprised
```

Kinds: `item`, `light`, `class`, `xp`, `condition`, `statblock`, `field`, `rules`, `calendar`, `table`. Unknown keys on a stat block become `fields`. The importer shows a preview and lists anything it couldn't parse before saving. Parsing is lenient on format and strict on meaning: key case, extra spaces and trailing punctuation are ignored; units written after numbers are accepted ("50 coins", "6 turns", "1 gp"); synonyms and abbreviations are not guessed. Unknown keys on stat blocks become fields; on other kinds they appear as warnings in the preview and are never dropped silently. Nothing is saved until the preview is confirmed.

## In-app editor

Every kind has a simple form that writes the same JSON (M3). Inside a campaign, entries are saved in the campaign's own homebrew, started on the first save (ruled 2026-10-25, replacing "the top homebrew pack, or one the GM picks"); imported homebrew packs are edited from the Rules library. Editing an entry from other setting rules makes a homebrew version with the same kind and id, which wins (homebrew is above every setting and adventure pack; it asks once if a higher homebrew already has the entry or a per-entry exception points elsewhere) and leaves the original untouched, so updating that pack from a newer file never loses an edit; deleting the homebrew version brings the original back. Forms keep any keys they don't show (and say which: "Kept as it is: progression"), and an entry is checked before saving (a name, whole numbers, formulas using level, complete rows). Every change to homebrew entries is logged in the campaign (players see lines for the kinds they can read), changes can be undone, and a retired campaign's homebrew can't change.

Built in steps: 7a items, stat blocks, conditions, light types and XP tables (the ones a GM makes mid-session); 7b classes, races, spells, spell lists and starting kits; 7c tables, treasure types, rules sets, optional rules, hooks (as text) and sheet layouts. A plain table's rows are ranges, a result, and optionally how many and a monster; a lookup table's rows are key and value; a matrix table's rows are kept as they are (only its name, die and notes change; ruled 2026-10-30). Lookup and matrix tables are edited only from a pack's table (as a homebrew version, or a copy): **+ New homebrew entry → Table** makes plain tables only (ruled 2026-10-29). A rules set's form covers time lengths, coins and starting money, keeping the rest. Treasure types, XP tables, hooks and sheet layouts need no name. An optional rule needs at least two choices (ids made from their names) and a default among them. Quick creation from the fight screen and "Not listed?" when adding an item come with those screens and use the same forms.

## Who sees what

Players in a campaign see the player-facing kinds of its attached setting rules: classes, races, items, spells, spell lists, conditions, light types, starting kits, optional rules and (from M4 step 4, pulled forward from M4b on 2026-10-23) rules sets without their GM-only sections. Stat blocks, tables, treasure types, XP tables, hooks, sheet layouts and calendars are GM-only (XP tables and hooks from M4b, calendars from M5, and sheet layouts from m5b-0c — cf-5, 2026-11-02: a layout holds nothing secret and a player's device needs its per-race lists and option gates — became readable; a table marked `"gmOnly": false` too); the database enforces it.

**From M4b (ruled 2026-10-23): hooks run on the player's device.** Campaign members can also read XP tables and hooks (rules sets' player-readable sections already from M4 step 4). Still GM-only: stat blocks, tables (unless a table says `"gmOnly": false`, 2026-11-02), treasure types, item secrets and the rules set's GM-only sections. The access rules change at the start of M4b, before the hook runner, with visibility tests per kind run as a player. `npm run pack:check` warns when a hook that runs on a player's device (events `characterCreated`, `abilityScoreChanged`, `levelUp`, `levelLoss`, `xpAwarded`, `equip`, `useItem`) reads GM-only data through `lookup()` or a path. An entry's `gmOnly` fields (and the list) are kept apart by the database and never sent to players; showing one to an item's holder comes with inventory (M4).

**From M5 (ruled 2026-10-30): the calendar for players.** Players see the date and season (05, S17-11), so campaign members read calendars too, without their `gmOnly` fields (the database hands members only that part; calendars still don't come with the other setting rules). A rules set's **special seasons** reach players without each season's `start` (its start chance) and `encounterSwap` (an encounter chance and table); the GM gets them whole. The database enforces both, with a test run as a player.

**From M5b (ruled 2026-10-30, D1): weather effects for players.** Players read a rules set's `weather.tags` (names and effects) and the tags of today's result, in a mode's `weather` too; the weather tables themselves stay GM-only. The database enforces it, with a test run as a player.

**From M4b (ruled 2026-10-25): discovery first.** Players' devices get a setting-rules item only if it's for sale (`forSale`) or known to the party: someone in the party has held it, it's in the Party stash or a starting kit, or the GM has sent it as loot (M6) or shown it (shops and Show with Handouts, M8b); items on monsters or at places stay unknown until looted or shown (ruled 2026-10-29, A1–A5; 03). The GM's per-entry exceptions are GM-only, so their names never reach players. Known items are kept per campaign and stay known after the item leaves the party. For an unidentified item only what was learned is sent (appearsAs, noticed, revealed facts); a fact revealed once stays revealed. Everything else stays GM-side, enforced by the database, with a visibility test run as a player. The GM brings an item into play by handing it out, stocking it in a shop, or setting "For sale in shops: Yes" in homebrew. Built with unidentified items (28).

**From 2026-11-07 (Francis, the zine's Q1 and Q2):** a class or race may carry **`description`**, the book's descriptive paragraph in the pack's own words (plain text), shown behind the one-line `blurb` when the name is tapped (the entry sheet); optional, and without it today's behaviour; the zine first, the other packs later. A **GM reference panel may carry `"gmOnly": false`**: campaign members then read it in the players' reference, panel by panel; GM-only stays the default; enforced like a table's `gmOnly: false` (a panel's entries reach a player's device only when it is false), with a visibility test run as a player.

## Deleting

The GM can delete setting rules from their library. If no campaign uses them, a plain confirm. If any does, a warning lists each campaign and what it loses (the pack's optional rules; the rules behind characters' classes and races, which keep their names; its items, monsters and tables), and **Delete for good** or **Cancel** follow. Each affected campaign's log records the removal.

## Versions

The importer reads `formatVersion` 1, 2 and 3. The importer reads what a file actually contains. If the stated `formatVersion` doesn't match (a version-1 file using version-2 kinds), it imports it and warns in the preview instead of refusing. A `formatVersion` the app doesn't know is warned about too. Meta keys the app doesn't use (author, licence…) are kept with the pack and shown under "About this file".

Updating a pack from a newer file writes a line in the log of every campaign using it: players' line names what changed among the kinds they can see; the GM's names the rest. Neither can be undone.

## Adventure packs (format version 3)

Ruled 2026-10-24. It extends this document for `meta.kind: "adventure"` and is built in **M8b**, apart from the clock pieces in M5 (08). The content rules are under IP rules above. All examples are invented.

### 1. Pack basics (ruling 1, ruling 13)

- Adventure kinds arrive in **`formatVersion: 3`**. Version 3 keeps everything in versions 1 and 2. The importer reads all three, and as before it imports what a file actually contains.
- **`meta.id`** (every pack kind): a stable slug that never changes when the pack is renamed. References to a pack use it. A pack without one falls back to the slug of its `shortName`.
- **`meta.kind: "adventure"`.**
- **`meta.code`:** 2–6 lowercase letters. Every id in an adventure pack starts with it plus a dash (`mf-…`), so an adventure's entries never override a setting's entries by accident.
- **`meta.requires`:** `[ { "packId": "river-rules", "minVersion": "1.0" } ]`. The import preview warns when one is missing, and never refuses.
- **`meta.pageOffset`:** printed page = PDF page − offset. Page references use **printed** numbers.

### 2. `locations` (ruling 2, ruling 11)

One kind for every place, nested through `parentId`: region → site → floor or area → room (or building), to any depth (an island holding a harbour holding areas holding the inside of a wreck; rg-1, 2026-11-12).

```json
{ "id": "mf-abbey-14", "name": "Chapter house of the drowned", "key": "14",
  "type": "room", "parentId": "mf-abbey-lower",
  "playerView": {
    "name": "Flooded hall",
    "text": "A low vaulted hall, knee-deep in black water. Benches float against the far wall.",
    "people": [ { "description": "A hunched figure in a reed cloak", "npcId": "mf-npc-oswy" } ],
    "exits": [ "Stairs up (north)", "Archway (east)" ],
    "shopId": null },
  "gm": { "notes": "A drowned acolyte rises if the benches are disturbed.",
          "secrets": [ "A loose flagstone under the lectern hides the abbey seal." ] },
  "clues": [ { "text": "Wet footprints lead from the water to the lectern and back.",
               "source": "p. 31", "pointsTo": "mf-abbey-14" } ],
  "quotes": [ { "text": "…", "kind": "inscription", "source": "p. 31" } ],
  "readAloud": [ { "imageId": "mf-crop-031-a", "source": "p. 31" } ],
  "contents": [ { "statBlockId": "mf-drowned-acolyte", "count": "1", "appearance": "A hunched figure in a reed cloak, very still" } ],
  "treasure": [ { "text": "Abbey seal (silver)", "itemId": "mf-abbey-seal", "value": { "gp": 40 } } ],
  "hazards": [ { "name": "Benches", "appearance": "The benches look unsteady", "trigger": "Disturbed", "effect": "The acolyte rises", "source": "p. 31" } ],
  "encounterCheck": null, "mapId": "mf-map-abbey-lower", "hex": null, "imageId": null,
  "source": "p. 31" }
```

- **`type`** is `region`, `site`, `area`, `floor`, `room` or `building`. It's informational only.
- **`key`** is the map label. **`hex`** is an optional grid coordinate; point-crawl adventures leave it null and use routes.
- **`playerView`** is what players notice: a few short lines, never a secret.
  - **`name`** is the name players see. Without one, players see "Unknown place" until the GM names it.
  - **`people`** are described, never named, until the GM introduces them.
  - **`exits`** are plain text and never name a hidden route. An exit may instead be `{ "text": "Archway (east)", "to": "<location id>" }` (ruled 2026-10-30, D6): players see the text only; `to` (the room it leads to) is the GM's and feeds Ways on (05, G-05).
- **`gm`** holds notes and secrets, in your own words and as long as needed.
- **`clues`** lists each clue separately, with its page. `pointsTo` (optional) is the location, NPC, item or faction it leads to (factions added 2026-11-01, G-41: a coat of arms or a cult's outpost points at a faction).
- **`quotes`** is exact wording only. `kind` is `riddle`, `inscription`, `password`, `verse` or `spoken`.
- **`readAloud`** lists the GM-only crops, in page order.
- **`treasure`** entries carry **`value`**: coin key to whole number (`{ "cp": 7 }`, `{ "gp": 127, "cp": 7 }`), the same shape as item values and shop prices (ruled 2026-10-24). The importer accepts the old `valueGp` and converts it to `{ "gp": n }`, with a note. Totals use the rules set's `currency` values; a coin the campaign's setting doesn't define is warned about at import and shown as written. **Coin to hand out (pf-24, pf-24a, ruled 2026-11-14; built K16a, K21):** an entry's **`coins`** (the setting's currency ids to whole numbers) is coin the hoard hands out; `value` is worth only, and one entry may carry both; an entry with no `coins` hands out none. A coin word the setting lacks: the amount sits under the coin it is read as, with **`coinsReadAs: { printed, note }`**. `pack:check` notes a key that is not a currency id, an amount that is not a whole number of 0 or more, and `coinsReadAs` without `coins` or missing a part. A treasure entry may name its **`hoard`**: entries sharing a name at one place are one hoard, handed out whole or one thing at a time; coin is an entry like any other (pf-6, 2026-11-12).
- **A hoard and its counts** (ruled 2026-11-18, not built yet: p2p-28, `design/rulings/scene-point-to-point-2026-11-18.md`; additive): a hoard may carry its own line of words, and then shows as one piece in the book's words, with the things to hand out, and how many of each, behind it; a treasure entry may carry a count.
- **A magic item's truth as a piece** (ruled 2026-11-18, not built yet: p2p-29; hidden data): a pack may give a magic item's real name and powers as a piece of its own, the GM's alone until its eye is tapped; nothing of it is sent to a player before that. The tap shows it to the players, and shows the same real name and powers on the item itself, wherever it is held (a character's pack, the stash).
- **Two marks on a Location** (ruled 2026-11-18: p2p-31; additive): "a way out" (p2p-22; **read by the app from B10**): **`wayOut: true`** on the location, for example `{ "id": "the-anchorage", "name": "The Anchorage", "type": "area", "wayOut": true }` (invented); Move on's list there ends with the row "End expedition", which ends the expedition, and Leave the dungeon counts the party at a way out there. Only a plain `true` is the mark, and it is that place's alone, as "no camp here" is; the pack checker says so where it is written as anything but true or false, or on a `site` or `region`. And "no camp here" (p2p-23; **read by the app from B18**): **`noCamp: true`** on the location, for example `{ "id": "the-wreck", "name": "The Wreck", "type": "area", "noCamp": true }` (invented). Only a plain `true` is the mark, and it is that place's alone: a mark on an Area or a Region is not read for the Locations in it. It is meant for a Location (`type: "area"`); a place of any other type may carry it too, and the app reads it wherever the party stands. Make camp is then blocked there with a pop-up. The pack checker says so where it is written as anything but true or false, or on a `site` or `region`.
- **`contents`** holds creatures and their counts. **`hazards`** holds the trigger or trap. A creature that a trap springs goes in `contents`, and its trigger in `hazards`.
- **Pieces for Show players** (ruled 2026-11-01, M5 gate B1; G-43): the app shows a room to players **piece by piece** (05, the room's GM layer). The pieces come from `playerView.text` (the description), each `playerView.exits[]`, each `playerView.people[]` (its `description`), each `clues[].text`, each `treasure[].text` (never `value`, `itemId` or the item's hidden fields: a magic item shows its appearance only), each `contents[]` and `hazards[]` entry's optional **`appearance`** (a one-line look players may be shown; a `contents` entry without one falls back to the matching `playerView.people[]` description, and a `hazards` entry without one isn't showable). Never a piece: `gm`, `quotes`, `readAloud`, `trigger`, `effect`, `statBlockId`, `count`. Read from M8b; `pack:check` warns when `appearance` isn't text. **`playerView.aspects: [{ lead, text }]`** (pf-3, 2026-11-11; mc-17): each aspect is a piece of its own, hidden until shown, in the pack's order, its `lead` shown bold before the text; `playerView.text` stays the short read-aloud.
- **The location browser** (M8b) has search by key or name and a "recently visited" list, so any room is two or three taps away.

### 3. `routes` and the hour unit (ruling 3)

```json
{ "id": "mf-route-ford-abbey", "from": "mf-ford", "to": "mf-abbey",
  "travel": { "value": 3, "unit": "hour" }, "type": "path", "hidden": false, "oneWay": false, "notes": "" }
```

- **`travel`** is one amount, as above, or a list of ways of moving, each with its own time (ruled 2026-11-11, pt-f1): `"travel": [{ "by": "row", "name": "Rowing", "value": 1, "unit": "turn" }, { "by": "swim", "name": "Swimming", "value": 3, "unit": "turn" }]`. `by` is a short id and `name` its words, both on the route; there is no list of ways on the mode. Old packs (one amount) stay valid. `unit` is `round`, `turn`, `hour`, `day` or `week`; `value` is a whole number.
- **A way's icon** (pf-25, 2026-11-14; p2p-30, 2026-11-18, `design/rulings/scene-point-to-point-2026-11-18.md`: already ruled, not built yet): a way may name its `icon`, and otherwise its `by` is read (`row`, `swim`, `climb`, `walk`); the pictures are the ones picked on 12 and 14 November (row: the paddles; swim: the two fish; walk: the leather boot); climb's is page 18's climber (`mountain-climbing`, Caro Asercion), ruled 2026-11-19 (⚑ 11 of `plans/scene-point-to-point.md`: "Go with proposed").
- **Imported** as library entries of kind **`route`**, one per route (December step 4, piece a). The kind is the GM's: no route entry reaches a player's device, hidden or not. Players read the ways on from where their group is through a narrow answer of the database's (ruled 2026-11-11, mc-28, changing pt-f3's "players see no ways on"; 03, The ways on): never a hidden route, a type, a note or one of these ids; each way's `by`, `name`, `value` and `unit` are sent (ruled mc-28a, 2026-11-12), and nothing else of `travel`. `npm run pack:check` checks each route's places, type, flags and travel.
- **`type`** is `path`, `road`, `river`, `door`, `stairs`, `secret` or `other`. Routes with `hidden: true` are GM only. **`oneWay: true`** lists the route only from its `from` (pt-f3).
- **`barrier`** (pf-12, pf-12f; "Obstacle" on screen, mc-41) marks something in the way: `"barrier": { "name": "the weir's gap", "extraTurns": 2, "needsApproval": true, "through": "mf-weir", "note": "…" }`. `name` is optional (pf-12f): the obstacle is shown as "Obstacle: <name>", else by the name of its `through` place, else as "Obstacle" alone (pack:check notes a barrier with neither); a player may learn the name only after the GM's No (dp-5) or, in the line after a move, the GM's Yes (ppf-8), never anything else of it. `extraTurns` is the whole turns more a crossing takes (0 or more; missing is 0); `needsApproval: true` has the GM decide whether the party gets through ("Do they get through?"; missing is false); `through` is the id of a place the crossing passes, whose own encounter chance then applies; `note` is the book's words for the GM. Read by `readBarrier` (`src/modules/library/routes.ts`); a broken `extraTurns` leaves the barrier out. The barrier is the GM's alone: its note, its need for approval, its extra time and its place never reach a player (mc-28a, dp-5). `npm run pack:check` checks each field.
- **`hour`** is a time unit worked out from the rules set's `time.turnMinutes` (or given by `time.turnsPerHour`, which wins; G-07). The clock keeps the exact time underneath, counted in seconds (ruled 2026-10-29), so a turn length that doesn't divide 60 still works. `hour` can be used in `travel`, `every` and reminders.
- **M5:** the GM's one advance is Next turn (Next day in a day-by-day mode); other moves of the clock go through Travel (M8b) or Set time… (a logged correction; ruled 2026-10-29, D19, replacing the +1 hour button).
- **M8b: Travel** in Explore pre-fills the route's time. The GM can change it before confirming, and it's logged and undoable. Checks that fall due along the way show once, with a count.

### 4. `encounterCheck` (ruling 4)

It sits on a location and covers everything inside it unless a child location has its own.

```json
"encounterCheck": {
  "every": { "value": 1, "unit": "turn" },
  "chance": { "die": "d6", "on": [1, 2] },
  "tableId": "mf-abbey-encounters",
  "onlyAt": null,
  "byTrack": [ { "trackId": "mf-flood", "min": 0, "max": 5, "chance": { "die": "d6", "on": [1, 2, 3] } } ],
  "note": "Also roll when the party is noisy." }
```

- **`chance: null`** means always roll the table. **`onlyAt`** is `"day"`, `"night"` or null.
- **`name`** (optional; approved by Francis 2026-11-13, dec-7 ⚑ 1): the check's own name, shown on the place's Rules sheet where the check stands in for the setting's; without it (or blank) the app says "Encounter check".
- **`atNight`** (ruled 2026-11-01, G-39): `{ "chance": { "die": "d6", "on": [1] }, "tableId": "mf-abbey-night" }`, a different chance and table while the Day / Night switch says night; the check's own `chance` and `tableId` are the daytime ones. Either part may be left out to keep the day value. Read from M8b; until then it shows as text on the check.
- **`byTrack`** changes the chance while a track's value is in a range. It's one fixed shape, not an expression.
- **In the app** (M5's Hit and Miss check, with dice at the table):
  - a **Day / Night** switch on the time strip (one tap, logged, shown to players on Scene; the GM decides when night falls);
  - **Check now**, which runs a check on demand;
  - the **active check** shown on the Explore panel, with its source ("Abbey · from the adventure" or "Every 2 turns · yours").
- **The GM's own encounter-check reminders** (ruled 2026-10-24): in M5 a GM reminder can be marked "Encounter check", separate from other checks. While the party is in a location with its own check, that check replaces the GM's encounter-check reminders; all other reminders keep running. **Use my check here instead** (one tap, per location, logged) keeps the GM's reminder there. On leaving, the GM's reminder resumes from the current time, with no catch-up backlog.

### 5. `npcs` and `factions` (ruling 5)

```json
{ "id": "mf-npc-oswy", "name": "Oswy the reed-cutter", "role": "Hermit",
  "locationId": "mf-abbey-14", "factionId": null, "imageId": null,
  "playerView": { "description": "Hunched, reed cloak, smells of peat" },
  "gm": { "wants": "To keep the seal hidden", "secrets": [ "Knows the lower door" ], "notes": "" },
  "statBlockId": "mf-npc-oswy-stats", "source": "p. 30" }

{ "id": "mf-faction-tollmen", "name": "The Tollmen", "memberIds": [ "mf-npc-garr" ],
  "gm": { "goals": "Tax the ford", "notes": "" }, "source": "p. 12" }
```

- **A unique NPC with stats** gets their own stat block, with an id based on the NPC's.
- **`relations`** on a faction (ruled 2026-11-01, G-33): `{ "<factionId>": "<stance>" }`, this faction's view of each other faction, in the pack's own words (`"unknown"`, `"antipathy"`, `"neutral"`, `"tolerates"`, `"prefers"`, `"fears"` in the first pack that uses it; the app shows the word, it doesn't interpret it). GM only; shown in the GM's faction panel (M8b). A book's stance matrix is written this way, not as a table.
- **Introduce** is one tap and logged. Introduced NPCs appear in **Handouts → People** with their name and `playerView.description`.
- **NPC status is campaign state.** The GM marks alive, dead, missing or absent, and friendly, neutral or hostile. It's logged, and GM only unless the GM shares it.
- **Faction reputation** is R2.
- **Read from dec-3** (2026-11-15, town row W8): the importer keeps each of `npcs` as a GM-only library entry (kind `npc`; never sent to a player), its fields as written. No screen shows them yet; `factions` are still left out.

### 6. `shops` (ruling 6)

```json
{ "id": "mf-shop-chandler", "name": "The chandler", "locationId": "mf-ford-3",
  "stock": [ { "itemRef": "river-rules:rope-50ft", "price": { "gp": 1 } },
             { "itemId": "mf-eel-pie", "price": { "sp": 2 }, "qty": "1d6", "note": "Fresh daily" },
             { "itemId": "mf-wish-knot", "price": "One true secret" } ],
  "services": [ { "name": "Read a letter", "price": { "gp": 1 } } ],
  "buys": "Pelts and herbs at half value",
  "gm": { "notes": "Overcharges strangers by half" }, "source": "p. 14" }
```

- **Buying in the shop charges the shop's price**, not the item's list price.
- **Remaining stock is campaign state.** The GM enters rolled quantities when the shop first opens. Buying lowers them, and an empty line shows "Sold out".
- **A price can be text.** The GM confirms those sales by hand.
- **Services** take coin and write a log line. **Selling** follows `buys`, and the GM confirms the amount.
- **Players browse an open shop** until the GM closes it. `gm` never shows.
- **Read from dec-3** (2026-11-15, town row W9; sh-1, sh-2): the importer keeps each of `shops` as a GM-only library entry (kind `shop`; never sent to a player), its fields as written (each stock line's `itemRef`, price and availability unchanged). A stock line's item is read as the bare item id (the `<pack>:` prefix dropped) in one place, `src/modules/library/packShops.ts`. No screen shows them yet.

### 7. Rumours (ruling 7)

- Rumours are a table with the `world.rumours` use (Table uses registry); the older `"kind": "rumours"` is read as that use (ruled 2026-10-29). Rows may carry **`truth`**, always one of the strings `"true"`, `"false"` or `"partial"` (ruled 2026-10-24). It's GM only and never sent. The importer quietly converts plain `true` and `false`, with a note in the preview. A rumours table is the GM's: one marked `"gmOnly": false` is skipped at import, in words, and named by pack:check, since opening it would send every row's truth to players (dec-12 E, hard rule 5), and the database keeps it the GM's whatever it says (rm-3); a rumour reaches players when the GM gives its row, as its words only, named "A rumour" (rm-1, rm-2). A rules set may not name a rumours table as a weather table: pack:check's error (a player rolling the weather would read its rumours).
- **Told rumours are campaign state,** dimmed for the GM. Rolling a told one offers "Already told: roll again?".
- **Send** shares a row's text in one tap and keeps it in Handouts by default.

### 7a. `adventureHooks` (pf-7, pf-7a)

- An adventure carries every hook its book offers: **`adventureHooks: [{ id, name, text, pays, giverNpcId? }]`**, the text in the book's own words, GM-only until sent. `giverNpcId` is optional: a hook may be posted at a place and shared from a shareable section rather than given by a person.
- Not `hooks`: that name is the format's rule hooks (Rule hooks). "Call to adventure" is a word for the screen, never for the format.
- A link may name a hook: `[[adventureHook:id|label]]` (Links, in the December additions).

### 8. `tracks` (ruling 8, ruling 10)

```json
{ "id": "mf-flood", "name": "The flood", "start": 12, "end": 0, "visibility": "players",
  "thresholds": [ { "min": 6, "max": 12, "message": "The ford is still crossable." },
                  { "min": 0, "max": 5, "message": "The ford is closed; night checks rise." },
                  { "min": 5, "max": 5, "once": true, "message": "The bridge washes out." } ],
  "remind": { "every": { "value": 1, "unit": "day" }, "message": "Dawn: roll for the flood (1d4)." },
  "roster": { "die": "d66", "visibility": "gm",
              "states": [ { "id": "drowned", "name": "Drowned", "movesTrack": true },
                          { "id": "rescued", "name": "Rescued", "movesTrack": false } ],
              "entries": [ { "key": "11", "npcId": "mf-npc-ansel", "startsIn": null },
                           { "key": "12", "name": "Novice Edda", "note": "Afraid of water", "startsIn": null } ],
              "takenRule": "next",
              "onTick": "Roll 3-in-6: a relative reports a ghost." },
  "source": "p. 8" }
```

- **`visibility`** applies to the count. The roster has its own visibility. **Thresholds notify only the GM.** A threshold with `once: true` is a one-off beat.
- **Each roster entry has `npcId` or an inline `name`, never both** (ruled 2026-10-24). `note` is optional with `name`. The converter uses `npcId` when the book gives that person more than a line anywhere else. **"Make NPC"** on a roster entry (GM, M8b) turns an inline person into an NPC in the campaign's homebrew, keeping their roster place and state.
- **States are defined by the pack**, and each says whether it moves the track. `startsIn` covers people already in a state when the adventure starts.
- **Several at once:** the GM enters how many, then the roll for each, or taps names. When a rolled entry is already taken, `takenRule: "next"` moves to the next free one. The whole thing is one logged change.
- **`onTick`** is a GM-only nudge on each change. **Manual ticks** are allowed any time.
- **Dice stay at the table:** the GM enters every roll.

### 9. `images` (ruling 9)

```json
{ "id": "mf-map-abbey-lower", "file": "maps/abbey-lower.webp", "type": "map",
  "title": "Abbey, lower level", "alt": "Plan of a flooded lower level with fourteen rooms",
  "visibility": "gm", "playerVersionId": null, "locationIds": [ "mf-abbey-lower" ], "source": "p. 29" }
```

- **`type`** is `map`, `handout`, `art` or `crop`. **`visibility`** is `gm` or `revealable`. Crops are always `gm`.
- **`alt` is required.** **`playerVersionId`** points to a player-safe version of a map.
- **`imageId`** can be set on locations, NPCs, stat blocks and items, so "Show players" sits right on them.
- **Which art goes in:** art showing something players could see. Decorative art is skipped and listed in the coverage report.
- **Files:** WebP; maps up to 2400 px on the long edge, art up to 1600 px, crops at about 160 dpi. Maps open with pinch-to-zoom.
- **`pins`** (`[{locationId, x, y}]`, as percentages) are reserved for R2.
- **Storage:** the files sit in a Google Drive folder the GM picks at import, and the importer checks that each named file is there. A reveal copies the whole image or a GM-cropped rectangle into app storage.
- **Read from dec-7 piece 5m-1** (2026-11-14): the importer keeps each `map` as a GM-only library entry (kind `map`; never sent to a player), its other fields as written; handouts, art and crops are left out, said once. The importer and `npm run pack:check` say, as warnings: a type it doesn't know or none (skipped); no `alt` (required: skipped); no `file` (skipped); no `title` (its id shows); a `locationIds` entry that isn't one of the pack's places, or none (kept). How a map's file gets in is the plan's (`plans/dec-7-5-place-page-and-map.md`, 5m-2: a copy per campaign, from the GM's device).
- **A pack's pictures arrive with it** (ruled 2026-11-18, not built yet: p2p-27, `design/rulings/scene-point-to-point-2026-11-18.md`): one bundled file holds the pack and its pictures, uploaded as a pack is today; the app ties each map to its places and names any picture that is missing; a pack with no pictures imports as now; a map stays the GM's alone until its eye is tapped. Additive: no pack in use stops working.

### 10. `timeline` (ruling 10)

```json
{ "id": "mf-beat-day3", "day": 3, "gm": "The Tollmen raise the toll.", "source": "p. 9" }
```

- **Day-based only.** Beats set off by a track are thresholds with `once: true` (section 8).
- **Start adventure** (one tap, logged) sets the adventure's day 1 to the campaign's current day.
- **Beats remind the GM** when their day comes, and the adventure overview lists what's coming.
- **Conditional beats** ("if the party does nothing…") stay as GM notes with their page.

### 11. `premades` (ruling 12)

```json
{ "id": "mf-pre-hild", "name": "Hild", "classRef": "river-rules:lantern-warden", "level": 1,
  "abilities": { "STR": 10, "WIS": 14 }, "hp": 6, "itemRefs": [ "river-rules:rope-50ft" ],
  "notes": "A drowned ferryman's daughter", "use": "replacement", "source": "p. 78" }
```

- **Offered at every character creation** (joining, a new character, a replacement in the death flow): any pre-made from the campaign's attached adventures that isn't **claimed** or **dead**.
- **Claiming:** submitting claims it. If the GM declines it or the player cancels, it's free again.
- **Dead:** a pre-made whose character died is never offered again, unless the GM frees it by fiat (logged).
- **What players see:** the pre-made's sheet details, while choosing.
- **The pre-made fills the guided form,** and the player edits it. **The GM always approves before play, even when character approval is switched off.**
- **Missing class:** freeform, with the details kept as notes.
- **`use: "retainer"`** pre-mades are NPCs with stat blocks until hirelings (M9).
- **The GM can hide** a pre-made. All are offered by default.

### 12. Existing kinds in adventure packs

`statBlocks` (the adventure always carries its own printed stat blocks, prefixed), `items`, `tables` (encounter tables, night events, getting lost; nested tables per v2), `treasureTypes` and `hooks`.

### 13. References between packs (ruling 13)

- **`itemRef`, `classRef`, `statBlockRef`, `itemRefs` and an encounter check's `tableRef`** take the form `"<meta.id>:<id>"`. **`encounterCheck.tableRef`** (ruled 2026-11-05, G-154) names a table in a required pack (a region's hexes rolling the setting's regional table); `tableId` stays for a table in the same pack, one or the other, never both; the checker wants the pack in `meta.requires` and, when that pack is given, the table to exist; the app reads it with hex travel. Same-pack references use `itemId`, `statBlockId` and `tableId`. In a pack with `meta.requires`, a plain `itemId` on a kit or trait-list line may also name a required pack's item (G-57, 2026-11-01).
- **A reference resolves through the campaign's pack priority order,** so homebrew edits apply.
- **Pins in a conversion pack** (ruled 2026-11-04; items after the area 3 re-check, stat blocks `design/rulings/m5b-pack-review-area-4-2026-11-04.md` fi-2). When two settings in one stack share an id, the conversion pack between them carries one entry for that id, so the order of the two settings no longer decides: for items the base setting's entry, for stat blocks the setting being played (conv-fae-woodland-to-classic: classic-advanced's 35 items, fae-woodland's 27 monsters). `npm run pack:check`, given the packs in stack order, warns once per stat-block or item id that two packs share with different stats when no pack above both carries it ("add it to a conversion pack or put the right one on top"). With no conversion attached, the pack on top wins (eq-4). G-130 stays ◈ for a format answer.
- **Unresolved references** are listed in the import preview ("3 items need River Rules"). Those entries still import and show by name with a "needs …" mark.

### 14. Turning mechanics off (toggle rule; ruled 2026-10-24)

- **Adventure-specific mechanics** (each track, roster, `byTrack` and the timeline reminders) are written by the converter as the pack's **optional rules**: one switch per mechanic, with **no `ruleKey`** (a shared ruleKey would merge them into one choice) and the display-only **`"category": "Adventure mechanics"`**. The optional-rules list shows them together under that heading within their adventure. `category` never affects choices.
- **`option`** links an entry to its switch, on any adventure entry (tracks, timeline beats, encounter checks, tables):
  - `"<optionId>"`: live when that rule's choice is `on`;
  - `"<optionId>=<choiceId>"`: live for that specific choice (written like `byOption` keys).
  - The same meaning applies to `option` on tables in every pack.
  - **One name** (ruled 2026-11-01, G-40): `option` is the word on every entry, tables included. The Exploration section's `onlyWithOption` is the same idea under an older name; the importer reads it as an alias, `npm run pack:check` stops asking for it, and this document uses `option` everywhere. A technical step for the builder.
- **Dependent pieces follow their parent:** a `byTrack` line is skipped while its track is off, and the check falls back to its base chance.
- **Off** means the mechanic becomes a GM note with its page reference.
- **App automations used by every adventure** are switches in **Campaign → During play**:
  - Travel moves the clock;
  - shop stock counts;
  - told rumours marked;
  - the active check shown.
- **Defaults are on,** and every switch says what "off" does.

### 15. Campaign state (not pack data)

Campaign state is kept per campaign and never written back into the pack:
- the adventure's start day;
- opened and visited locations, and the one currently open;
- day or night;
- told rumours;
- NPC introductions and status;
- shop stock;
- track values and roster states;
- claimed and dead pre-mades;
- revealed images and Handouts;
- locations marked reviewed in prep mode.

The pack can be updated from a newer file without losing any of it.

### 16. Who sees what (ruling 11)

| Data | Players see |
|---|---|
| Location `playerView` (with `playerView.name`) | When the GM opens it; one open location at a time, until closed or another is opened. With "Rename for players" removed (p2p-11, 2026-11-18, not built yet), players see the pack's name for a place |
| Location `gm`, `clues`, `quotes`, `readAloud`, `contents`, `treasure`, `hazards` | Never (the GM may Send a clue or quote as text) |
| Routes | Never (exits are plain text; an exit's `to` link is GM-only) |
| NPCs | `playerView.description` when introduced; then name and description in Handouts → People |
| Shops: stock, services, `buys`, prices | While the shop is open |
| Rumours | Only what's sent; `truth` never |
| Tracks | The count, if `visibility: players`; roster entries, if the roster's visibility is `players` |
| Images | Revealed copies only (whole or cropped); crops never |
| Day / Night | Shown on Scene |
| Pre-mades | Sheet details while choosing a character |
| Timeline, stat blocks, tables | Never |

The database enforces all of this. M8b adds a visibility test per new kind, run as a player.

### 17. Prep mode (prep mode ruling)

- **A GM walk-through** of the adventure's locations in page order on a tablet: each location's summary, clues and player view beside its crop, with inline editing and a **Reviewed** mark.
- **Edits save into the campaign's homebrew,** following the editor's rule, so updating the pack later never loses them.
- **Built in M8b,** reusing the location browser's screens.

### 18. The converter (ruling 14)

| Skill | Writes |
|---|---|
| `content-pack-converter` (manager) | The job plan; merges the pieces, runs checks, the final pack |
| `pack-reader` (runs first) | `outline.md`, `id-plan.json`, page map (printed ↔ PDF), read-aloud box positions |
| `pack-mechanics` | Tables with their checks, stat blocks, items, treasure, shops, hooks |
| `pack-places` | Locations (both layers), routes, clues, quotes, NPCs, factions, rumours, tracks, timeline, pre-mades, the adventure-mechanics optional rules |
| `pack-images` | Images and crops (WebP), the manifest, the Drive folder |
| `pack-reviewer` (fresh agent) | `coverage-report.md`; it reports and fixes nothing |

- **Skills stay copyright-clean:** instructions and invented examples only.
- **PDF rendering and cropping** use PyMuPDF, so the same skills run in the cloud or on Windows.
- **Read-aloud boxes** are found by their print style through the PDF's text layer. If a book has none, the Reader asks the GM to confirm the boxes.
- **Maps that draw no links** (the converter's standard, ruled with pf-12, 2026-11-12, `design/rulings/dec-pack-formats-2026-11-11.md`): read the book's movement rule first (it decides what a link is); propose links to each spot's nearest neighbours, never across a drawn wall, cliff or water edge without a way; anything drawn that blocks a straight line becomes a `barrier` on the links that cross it, never a missing link; every keyed spot gets at least one link, one reached only by a climb or a swim getting that way; entry and exit points come from the book's text; times are the book's, else one turn a link, marked as an estimate; one picture of the proposal for the GM to confirm or change before the pack ships; each link's note records its origin ("our reading", "accepted by", "added by") and the date; the reading lives in the routes and the book's text is never altered. Not needed for hex maps, square grids, plans with drawn doors and corridors, or a book that prints its own link list or travel table.
- **Order:**
  1. The Reader goes first.
  2. Mechanics, Places and Images run at the same time, splitting big books by page range and joined by the ID plan.
  3. The manager merges and checks the result: against a JSON schema of this spec until M8b, then with `pack:check`.
  4. The Reviewer checks.
- **Fixes** go back to the specialist responsible. **At most two review rounds;** anything still open goes to the GM as a list.
- **The Reviewer sees** only the pack, the PDF, this spec and the ID plan (ruled 2026-10-24), limited to its ids, kinds and pages: never the builders' notes or the outline's commentary. It also counts keyed rooms, table rows, stat blocks and named people per page from the PDF on its own, and flags differences both ways (missing from the pack, or missing from the plan).
- **Scaling:** a small homebrew uses Mechanics and the Reviewer; a rulebook adds the Reader; an adventure uses all five.
- **File names** (ruled 2026-10-30): at intake the converter asks "What's this source called?", pre-filled from the PDF's title, and slugs it (an edition or publisher suffix when two sources clash). The private files say what they contain:

| File | Name |
|---|---|
| Pack | `packs/<source-slug>/<source-slug>-<version>.pack.json` |
| Build candidate | `packs/<source-slug>/build/<source-slug>-candidate-<version>.pack.json` |
| Conversion | `conv-<from-slug>-to-<to-slug>-<version>.pack.json` |
| Reports (gap report, changelog) | Beside the pack |

`meta.id` stays the neutral alias; the real name lives only in the file names and `meta.name`. The repo (docs, tests, commits) uses the neutral alias.

### 19. The coverage report (ruling 15)

`coverage-report.md`, delivered privately (the owner's git-ignored packs folder, and to the owner as a file), never to the repo:

1. **A one-screen summary:** problems by type with counts and pages (leaks, clues pointing nowhere, copying flags, broken links, doubts).
2. **The prep checklist:** every location in page order with its page, facts and clues, player view and crops, each with a checkbox. It matches prep mode.
3. **Pages:** captured, partly captured or skipped, with the reason.
4. **Counts** compared with the ID plan.
5. **Leak check:** player names, text, people and exits checked against secrets, clues and hidden routes.
6. **Copying check:** 8 or more words in a row matching the book are listed for information (ruled 2026-11-03: private packs may keep the exact wording).
7. **Links:** every reference resolves (or is listed as needing another pack), and every keyed room on a map has a location.
8. **Spot checks:** 5 random locations to compare with the book. This is the minimum.
9. **Doubts,** each with its page.

## Appendix: instructions shown in the app ("Convert with an AI")

The app shows this text with a copy button (Rules library → **Convert a book with an AI…**), followed by this document's format sections, read from this file when the app is built. It works with Claude, ChatGPT or any capable LLM:

These instructions are for setting and homebrew packs. Adventures use the converter skill and the adventure rules (Adventure packs (format version 3)).

> Convert the attached rules content into a tabletop-pack content pack.
> Output a single JSON object with `"format": "tabletop-pack"` and `"formatVersion": 2`, following the spec below exactly.
> Keep the rules exact: use the book's own wording wherever it states a rule, and every number as printed. The pack is private to the person who owns the book. Put each fact in its proper field, not in a note.
> Use lowercase-dash ids. Put any stat that doesn't have its own key into `fields` as label → value.
> If something is ambiguous, add it to `meta.notes` instead of guessing.
> [The JSON format section of this document is appended here.]
