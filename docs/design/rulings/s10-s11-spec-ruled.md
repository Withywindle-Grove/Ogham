---
status: absorbed
milestone: m4b
absorbed-into: docs/07-content-packs.md (Rule hooks; Hook fields), docs/04-data-model.md
supersedes: —
---

# S10/S11 spec proposal — rule hooks and pack fields (DRAFT)

Status: **RULED 2026-10-22**: all six approved, with these amendments:
- (1) The grammar adds `[ ]` key lookup and `has(map, key)`.
- (2) 07 lists planned additions: a race-bonus fill source (M4b), an `initiativeModifier` target (M6), and a `lootSplit` event for treasure XP (M7).
- (3) A reminder fires once per clock jump, with a count.

Creation legality (class requirements, race–class limits) is guided-creation logic in M4b, not hooks. Race fields keep the pack's names (`classMaxLevels`, `saveBonusByCon`).
Goal: one vocabulary that the spec (07), the editor, the converter skill and the private test pack all share.

---

## Part 1 — Rule hooks (S10)

### 1.1 Principles
- Hooks are **data, not code.** The app runs a small, fixed expression language. Packs can't loop, assign or call anything outside a fixed list.
- **Warnings never block.** GM fiat always wins. Every hook that changes a number shows a preview and is logged.
- **A hook that can't run is skipped**, never guessed. The GM sees "A rule couldn't be checked: <hook id>" in the log (GM-only).
- **Same evaluator everywhere.** The M3 formula evaluator grows into this language. Formulas stay valid expressions.

### 1.2 Hook fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique within the pack |
| `kind` | yes | `fill` · `warn` · `factor` · `remind` |
| `when` | yes | An event from the list in 1.3 |
| `appliesTo` | no | Who it's about: `pc` · `retainer` · `mercenary` · `specialist` · `any` (default `any`) |
| `test` | no | Expression; the hook runs only when it's true. No test = always runs |
| `message` | warn, remind | Text shown, with `{placeholders}` (1.5) |
| `offer` | no (warn) | A one-tap fix: `swap` · `stowOther` |
| `target` | fill, factor | What it changes (1.6) |
| `value` | fill | Expression for the new value. Use either `value` or `from` |
| `from` | fill | A built-in fill source: `abilityModifiers` · `classProgression` |
| `respectEdited` | no (fill) | Default `true`: values the player edited by hand get the Use/Keep choice |
| `multiplier` | factor | Number or expression |
| `every` | no (remind) | `{value, unit}`; repeats on the game clock |
| `note` | no | For the GM and the editor only; never shown at the table |

**Changes from today:**
- `from` now names only a built-in source; `rulesSets[0].abilityModifiers`-style paths go away.
- `test` replaces `if`.
- `scope` (used once in 07's example) goes away.

### 1.3 Events (`when`)

Each event provides the names a `test` or `message` can use.

| Event | Fires when | Names available |
|---|---|---|
| `characterCreated` | A character is submitted | `character` |
| `abilityScoreChanged` | An ability score changes | `character` |
| `levelUp` | Level-up is confirmed | `character`, `fromLevel`, `toLevel` |
| `levelLoss` | "Lose a level" is confirmed | `character`, `fromLevel`, `toLevel` |
| `xpAwarded` | XP is awarded (per recipient) | `character`, `amount` |
| `equip` | An item is equipped | `character`, `item`, `equipped` |
| `useItem` | An item is used (cast from a scroll, spend a charge) | `character`, `item` |
| `hire` | A hireling is added | `employer`, `hireling` |
| `wageDue` | A recurring wage comes due | `employer`, `hireling`, `wage` |
| `turnAdvanced` | The game clock moves | `campaign`, `expedition`, `turns` |
| `lightBurning` | Each turn, once per lit light | `light`, `carrier` |
| `adventureEnded` | The GM ends an adventure | `campaign`, `party` |

`lightBurning` is new. It replaces the pack's `turnAdvanced` + `lightSource` test, so the "once per light" behaviour is defined, not guessed.

### 1.4 The `test` language

**It's the formula language plus comparisons and logic.**
- **Values:** numbers, `"text"`, `true`, `false`, `null`, lists `[a, b]`
- **Names:** dotted paths from the event (`item.slot`, `character.class.id`, `equipped.shield`, `employer.CHA`, `campaign.flags.wartime`)
- **Maths:** `+ - * /`, parentheses
- **Compare:** `== != < <= > >=`, and `x in [a, b]`
- **Logic:** `and`, `or`, `not`
- **Dice** (formulas only; the app shows them, never rolls): `1d6`, `level d6`

**Functions (fixed list):**

| Function | Returns |
|---|---|
| `floor(x)` `ceil(x)` `min(a,b)` `max(a,b)` | Maths |
| `count(list)` | How many |
| `lookup(tableId, key, column?)` | A value from a pack table or a rules-set reference section, e.g. `lookup("abilityModifiers.CHA", employer.CHA, "maxRetainers")` |
| `allows(rule, item)` | Whether a class's `armourAllowed` or `weaponsAllowed` permits the item (rules in 1.7) |
| `primeXp(character)` | The XP multiplier from the class's `primeXp` rules (handles "any" and "all") |

**Rules**
- A missing name is `null`. Any comparison with `null` is false, except `== null` and `!= null`.
- `equipped.shield` is the item or `null`, and `equipped.hand` is the main-hand item or `null`.
- A test can be at most 300 characters.
- A syntax error is caught at import (the preview lists it), not at the table.

### 1.5 Message placeholders
`{character.name}`, `{character.class.name}`, `{item.name}`, `{equipped.armour.name}`, `{light.name}`. Any name from the event works. An unknown placeholder shows as blank and the import preview warns about it.

### 1.6 What `target` can be
- **For `fill`:** `abilityModifiers`, `hitDice`, `attack`, `saves`, `spellSlots`, `skills`, `title`, or a campaign field key from the sheet layout.
- **For `factor`:** `xp`, `wage`, `share` (a loot share).

New targets are added to the spec when a milestone needs them, never invented by a pack.

### 1.7 What `allows()` checks

| Rule | The item passes when |
|---|---|
| `armourAllowed` (armour) | `types` is `"any"`, or includes `item.armourType`. `chosen` passes, and the GM picks the base armour |
| `armourAllowed` (shield) | `shields` is `true`; or it's `"wood"` / `"metal"` and that's in `item.material`. A shield whose material is both asks once: "Wooden or metal?" |
| `weaponsAllowed` | Mode `any`: not in `exclude`. Mode `list`: in `ids`, or carries a tag in `alsoAllowTags`. Mode `tags`: carries a tag in `allowTags`; with `oneHandedMelee`, also any 1-handed melee weapon. `optional` ids pass only when their option is on |

### 1.8 The 17 setting-1 hooks, rewritten (the proof)

The numbers below are invented (2026-10-29, C12): they keep each hook's meaning, and the setting's own numbers stay in the private pack.

```json
{ "id": "fill-ability-mods", "kind": "fill", "when": "abilityScoreChanged", "from": "abilityModifiers", "target": "abilityModifiers" }
{ "id": "fill-level-progression", "kind": "fill", "when": "levelUp", "from": "classProgression", "target": ["hitDice", "attack", "saves", "spellSlots", "skills", "title"], "respectEdited": true }
{ "id": "factor-prime-xp", "kind": "factor", "when": "xpAwarded", "appliesTo": "pc", "target": "xp", "multiplier": "primeXp(character)" }
{ "id": "factor-retainer-xp", "kind": "factor", "when": "xpAwarded", "appliesTo": "retainer", "target": "xp", "multiplier": 0.4 }
{ "id": "factor-wartime-wages", "kind": "factor", "when": "wageDue", "appliesTo": "mercenary", "test": "campaign.flags.wartime == true", "target": "wage", "multiplier": 3 }
{ "id": "warn-armour-not-allowed", "kind": "warn", "when": "equip", "test": "item.slot == \"armour\" and not allows(character.class.armourAllowed, item)", "message": "{character.class.name} can't wear {item.name}. The GM can allow it." }
{ "id": "warn-shield-not-allowed", "kind": "warn", "when": "equip", "test": "item.slot == \"shield\" and not allows(character.class.armourAllowed, item)", "message": "{character.class.name} can't use this shield." }
{ "id": "warn-weapon-not-allowed", "kind": "warn", "when": "equip", "test": "item.slot == \"hand\" and not allows(character.class.weaponsAllowed, item)", "message": "{character.class.name} can't use {item.name}." }
{ "id": "warn-two-handed-shield", "kind": "warn", "when": "equip", "test": "(item.hands == 2 and equipped.shield != null) or (item.slot == \"shield\" and equipped.hand.hands == 2)", "message": "A two-handed weapon can't be used with a shield.", "offer": "stowOther" }
{ "id": "warn-second-armour", "kind": "warn", "when": "equip", "test": "item.slot == \"armour\" and equipped.armour != null", "message": "Already wearing {equipped.armour.name}. Swap?", "offer": "swap" }
{ "id": "warn-scroll-type", "kind": "warn", "when": "useItem", "test": "item.category == \"scroll\" and item.castingType != character.class.spellcasting.castingType", "message": "This scroll isn't for your kind of magic." }
{ "id": "warn-retainer-level", "kind": "warn", "when": "hire", "appliesTo": "retainer", "test": "hireling.level > employer.level", "message": "Retainers must be of equal or lower level than their employer." }
{ "id": "warn-max-retainers", "kind": "warn", "when": "hire", "appliesTo": "retainer", "test": "count(employer.retainers) >= lookup(\"abilityModifiers.CHA\", employer.CHA, \"maxRetainers\")", "message": "{employer.name} already has as many retainers as their CHA allows." }
{ "id": "remind-light", "kind": "remind", "when": "lightBurning", "test": "light.remaining <= light.type.warnAt", "message": "{light.name} is about to go out." }
{ "id": "remind-rest", "kind": "remind", "when": "turnAdvanced", "every": { "value": 5, "unit": "turn" }, "test": "expedition.setting == \"dungeon\"", "message": "Time to rest, or tiredness sets in." }
{ "id": "remind-wandering-dungeon", "kind": "remind", "when": "turnAdvanced", "every": { "value": 3, "unit": "turn" }, "test": "expedition.setting == \"dungeon\"", "message": "Encounter check due." }
{ "id": "remind-wandering-wilderness", "kind": "remind", "when": "turnAdvanced", "every": { "value": 2, "unit": "day" }, "test": "expedition.setting == \"wilderness\"", "message": "Encounter check due." }
{ "id": "remind-retainer-loyalty", "kind": "remind", "when": "adventureEnded", "appliesTo": "retainer", "message": "Loyalty check for each retainer." }
```

That's 18: the wandering-monster check splits into dungeon and wilderness. Every one can be written without new syntax. Two new names are needed, and are covered in Part 2: `campaign.flags` and `expedition.setting`.

---

## Part 2 — 07 catches up with the pack (S11)

**Rule:** 07 adopts the pack's shapes. **Only the core fields are needed for the app to work.** Everything system-specific is optional, so a homebrew pack can be tiny.

### 2.1 Any entry
- `source` — a page reference, e.g. `"Core rules p. 42"`, or an object keyed by class when pages differ. Shown in rules popups (M4).
- `notes` — up to three short sentences.
- `shareable` — informational.

### 2.2 classes

| Field | Core? | Meaning |
|---|---|---|
| `id`, `name`, `xpTableId` | core | |
| `hitDie` | core | e.g. `"d8"` |
| `progression` [{level, xp, hitDice, saves, spellSlots?}] | optional | Level-up fill. **Attack:** `attack` (one number), or `thac0` + `attackBonus` (both kept); `conModifierApplies` (false once CON stops adding) |
| `requirements`, `primeRequisites`, `primeXp` | optional | `primeXp` rules: `any` / `all` thresholds |
| `maxLevel`, `levelTitles`, `languages`, `vision`, `restrictions`, `demihuman` | optional | Display and creation checks |
| `creationMethods` | optional | Which creation options allow this class |
| `armourAllowed`, `weaponsAllowed` | optional | Shapes from 07 (2026-10-21); read by `allows()` |
| `weaponProficiencyCategory` | optional | Text |
| `abilities` [{name, fromLevel, notes}] | optional | |
| `skills` {names, die, gmRolls, byLevel} | optional | `names`: code → label; `die`: `"%"` or `"d6"`; `gmRolls`: codes the GM rolls secretly; `byLevel`: per-level values. Replaces `{codes, byLevel}` |
| `spellcasting` {listId, type, castingType, maxSpellLevel, fromLevel} | optional | |
| `turningTableId`, `trackingByLevel` | optional | System-specific references |

### 2.3 items (additions)
- `properties` [{name, note}]
- `container`
- `usableBy` (class ids or tags)
- `charges` {initial, rechargeable, note?}: `initial` is a number or dice expression
- `castingType` on a **found** scroll instance (`arcane` / `divine`, chosen when the GM hands it out)
- Shield `material` is a list

### 2.4 spells (additions)
- A duration can be `{formula, unit, text?}`: `text` keeps the book's wording beside the worked-out formula.
- **Any** field may be keyed by class when it differs between lists (not just range, duration and notes).

### 2.5 statBlocks
Already matches: `abilities`, `description`, `group`, `groupAbilities`, `hpVaries`, `hpAverage` (null when `hpVaries`).

### 2.6 tables (additions)
- Rows may have `group` (sub-heading), `note`, and `values` (several values per row).
- A table may have `dieNote`, `option` (shown only when that option is chosen) and `roll` (die text for lookups).
- No `gmOnly` on tables: they're GM-only already.

### 2.7 rulesSets
**Settings the app uses:** `time`, `currency`, `initiative`, `encumbrance`, `xpPartySplit`, `startingMoney`.

**Reference sections:** free-form, readable through `lookup()`, and used by later milestones. They are:
- `abilityModifiers`, `abilities`, `abilityAdjustment`
- `attack`, `saveCategories`, `saveRule`, `monsterSaves`
- `hitPoints`, `combat`, `morale`, `healing`
- `procedures`, `movement`
- `xp`, `primeRequisiteXp`, `levelUp`, `inheritance`
- `monsters`, `magicItems`
- `strongholds`, `retainers`, `mercenaries`

The importer keeps them untouched. **New:** `levelLoss` and `campaignFlags` (below).

### 2.8 New: `levelLoss` (for M7's "Lose a level")
```json
"levelLoss": { "xp": "midpoint", "hp": "enter", "note": "Short note" }
```
- **`xp`:** `midpoint` (halfway through the new level), `levelStart` (the new level's minimum), or a formula.
- **`hp`:** `enter` (the player types the new maximum; the default) or `removeLast` (subtract the last level's roll if the app has it).
- Missing `levelLoss` = `xp: levelStart, hp: enter`.

### 2.9 New: `campaignFlags` (for the wartime wages hook)
```json
"campaignFlags": [ { "id": "wartime", "name": "At war", "default": false } ]
```
- Each flag is a switch in campaign settings, readable as `campaign.flags.<id>`.
- Changing one is logged.

### 2.10 Expeditions: `expedition.setting`
- `dungeon` or `wilderness`, chosen by the GM when starting an expedition (M5).
- It lets packs give different reminders and encounter timing to each.

### 2.11 options
`requires` is `{optionId: choiceId}` or `{optionId: [choiceIds]}`. The option is offered only when that option has one of those choices; otherwise it's hidden and uses its default.

### 2.12 startingKits
Already in 07. The test pack now has five, marked as invented test data.

---

## Part 3 — What changes where

| Where | Change | When |
|---|---|---|
| 07 | Replace the hooks section with Part 1; add Part 2's fields | On ruling |
| Editor (M3) | Hook form: `test`, `value`/`from` (named sources only), `every`, `respectEdited`, `appliesTo`, `offer`; class form: skills shape, attack fields; `campaignFlags` and `levelLoss` forms | M4b, before the runner |
| Importer and checker | Check `test` syntax and placeholders at import; warn about unknown events, targets and functions | M4b |
| Converter skill | Writes Part 1 hooks and Part 2 fields; reports anything else | On ruling |
| Test pack | Rewrite the 17 hooks as the 18 above; add `campaignFlags` (wartime) and `levelLoss` | I do it after the ruling |
| 04 data model | Campaign `flags`; expedition `setting`; scroll instance `castingType` | On ruling |

---

## Critic review (honest risks)

1. **Expression languages grow.** Every new hook will tempt "just one more function". *Mitigation:* the function list lives in 07, and adding one needs a scope check.
2. **`primeXp()` and `allows()` hide logic in the app.** They're system-flavoured. *Mitigation:* both read pack data and contain no numbers. Another system with different prime rules would need a new function, which is acceptable for now. ◈ A general rule engine stays out of scope.
3. **`from: "classProgression"` is really an app feature**, not a hook. It's kept as a hook so a pack can turn it off or limit its targets.
4. **Test coverage.** Every function and every setting-1 hook needs unit tests in M4b, so a pack typo can't take down the table.
5. **`expedition.setting` is coarse.** Some games mix dungeon and wilderness rules. Two values are enough for R1.

---

## ⚑ Rulings needed

1. **⚑ Hook fields** (1.2): approve, or edit.
2. **⚑ Event list** (1.3), including the new `lightBurning`: approve, or edit.
3. **⚑ The `test` language and function list** (1.4–1.7): approve, or edit.
4. **⚑ 07 adopts the pack's shapes, with core vs optional** (Part 2): approve, or edit.
5. **⚑ New fields:** `levelLoss`, `campaignFlags`, `expedition.setting`, `source`: approve each.
6. **⚑ Skills shape** `{names, die, gmRolls, byLevel}` replaces `{codes, byLevel}`: approve.
