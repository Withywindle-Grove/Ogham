# The packs on the ruled creation shapes: the inner shapes used (pack session, 2026-11-03)

fae-woodland 0.3.13, classic-advanced 0.6.14 and the zine overlay 0.5.6 now carry the creation fields of 07 ("The survey's fields", cs-1 … cs-7, rc-1 … rc-5). Where 07 names a field but not its inside, the packs use the shapes below. They are a proposal for the builder's plan (`plans/m5b-0c-creation-survey.md`); if a PR reads them differently, the pack follows. Examples invented.

| Field | Shape in the packs | Notes |
|---|---|---|
| `races[].tables` | `{ "names": "<tableId>", "trinket": "<tableId>", "details": ["<tableId>", …], "growth"?: "<tableId>" }` | Tables are ordinary, `gmOnly: false` |
| A name table | `columns: ["First name", "Surname"]`; rows `{ min, max, result: "Brindle · Ashcombe", cells: ["Brindle", "Ashcombe"] }` | `result` keeps today's readers working; `cells` follows `columns` |
| `races[].classMaxLevels` | `{ "<classId>": <level> \| { "maxLevel": <level>, "soft": true } }` | Every open class is listed, so a class left out is closed (hard) |
| `races[].byOption` | `{ "<optionId>=<choiceId>": { "npcOnlyClasses"?, "classMaxLevels"?, "abilities"?, "abilityModifiers"? } }` | Same key form as a rules set's `byOption`. `abilityModifiers` is one more than cs-5 names: one setting's human gains two score bonuses when limits are lifted |
| `races[].firstSpells` | the class shape: `{ "rollTable": "<tableId>", "note" }` | "Rolled or chosen": the player taps the row they rolled or chose |
| `races[].startingItems` | `["<itemId>"]` | |
| `races[].armourSubstitutes` | `{ "<itemId>": "<itemId>" }` | |
| `races[].weaponsAllowed` | the class shape: `{ "mode": "tags", "allowTags": ["small", "medium"] }` or `{ "mode": "any", "exclude": ["<itemId>", …] }` | |
| `classes[].alignments` | `["Lawful", "Neutral"]` (hard) | No soft case in either setting |
| A class-gated field | `{ "key": "liege", "type": "text", "forClasses": ["<classId>"], "from": "<tableId>", "help" }` | The table's rows carry `alignment` |
| Kit line, size swap | `{ "itemId": "<id>", "qty": 1, "ifSize": { "Small": { "itemId": "<id>" } } }` | |
| Kit line, a choice | `{ "itemId": "<default id>", "oneOf": ["<id>", "<id>"], "qty": 1 }` | `itemId` is the default, so today's editor accepts the line |
| `languages.list[].roll` | `{ "die": "d6", "min": 2, "max": 3 }` | |
| `languages.list[].learnableBy` | `["mortal"]` (hard) or `{ "types": ["fairy"], "soft": true }`; `{ "types": [], "soft": true }` = anyone, with the GM's leave | Mirrors the hard / soft form of class limits |
| An overlay's `languages.list` | `[{ id, name, source }]`, no `common` | pack:check (overlay alone) flags base ids until the merge is built |
| Trait-list entry | `"money": 50`; `"spells": { "roll": { "listId": "<list>", "level": 0 } }` | |
| `startingEquipment` | `[{ "itemId", "qty" }]` | See the cost below |
| A part-bundle line | `{ "itemId": "arrows", "qty": 1, "units": 10 }`; `units` may be dice (`"1d6"`) | `units` wins over `qty`; `qty` 1 so today's reader gives one bundle (20), not ten (200). Zine overlay only: fae-woodland's and classic-advanced's bundled lines give whole bundles |

## Found while moving
- **Weapons' size wasn't a tag.** The app's `weaponsAllowed` reads `weaponTags`; fae-woodland kept size only in `weapon.size`, so a size-limited class matched no weapon. Size is now also a tag (fixed in the pack; no app change).
- **The bard's kit had no instrument** (the book gives one, stringed or wind). Added as a `oneOf` line.
- **Two tables were paraphrased** in 0.3.9, before the exact-wording ruling (the growth table and the liege table). Restored word for word.

## Costs until the builder's PRs land
- `startingEquipment` as `{ itemId, qty }`: today's reader takes ids only, so the general kit (clothes, backpack, rations…) is missing at creation until PR 4.
- Part-bundle lines give one whole bundle until `units` is read.
- The zine overlay's own languages show as pack:check notes until the overlay merge (cs-6) is built.

## Not moved
- `startingEquipment.pick { tableId, upTo }`: 07 doesn't say where `pick` sits when `startingEquipment` is a list. The adventuring-items rule stays as reference text.
- classic-advanced's language limits by race or class (one race's tongue, a class's tongue): `learnableBy` takes creature types only. They stay as notes.
- The knight's alignment in classic-advanced follows a liege the book doesn't list: text only.
