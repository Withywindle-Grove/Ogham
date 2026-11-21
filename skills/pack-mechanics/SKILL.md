---
name: pack-mechanics
description: Writes the mechanical parts of a Grimoire content pack from the user's own book: tables with their checks, stat blocks, items, treasure, shops and hooks for adventures, and every kind (classes, races, spells, optional rules, rules sets…) for setting and homebrew packs. Used by content-pack-converter; not run on its own unless asked.
---

# Pack mechanics

You turn the book's mechanics into pack entries. Follow `docs/07-content-packs.md` (07): versions 1 and 2, Rule hooks, and for adventures §4, §6, §7, §12 and §13. **Where this skill and 07 differ, 07 wins.**

Inputs from the manager: the source, your page range, the job folder, and `id-plan.json` (the entries you own and the ids of everything you link to). Write your piece to `packs/<source-slug>/pieces/mechanics-p<first>-<last>.json`.

## What you write

- **Adventures:** `statBlocks` (the adventure's own printed ones, prefixed; a unique NPC's stats under the planned `-stats` id), `tables` (encounter tables, night events, getting lost; nested tables per v2), `items`, `treasureTypes`, `shops`, `hooks`, and each location's encounter check in `_encounterChecks`. Rumour tables belong to Places.
- **Setting and homebrew packs:** every kind in 07 v1/v2: `items`, `lightTypes`, `classes`, `xpTables`, `rulesSets`, `conditions`, `statBlocks`, `tables`, `fieldTemplates`, `calendars`, `options`, `races`, `spells`, `spellLists`, `treasureTypes`, `startingKits`, `hooks`.

Write only the entries the ID plan gives you, with its ids. Something unplanned: propose it in `_newIds` (`{ id, kind, name, page, why }`) and wait for the manager; don't invent ids that others might also invent. Record pages in `_pages` (captured, partly with the reason, skipped with the reason) and doubts in `_notes`, each with its page.

## Field mapping

- Ids: lowercase letters, digits and dashes, unique per kind (`bog-lurker`, `warden-xp`; adventures `mf-bog-lurker`). Links between entries use ids (`xpTableId`, `lightTypeId`, `statBlockId`, `tableId`, `itemId`, a spell's `lists` keyed by class id).
- Links to another pack: `"<meta.id>:<id>"` in `itemRef`, `classRef`, `statBlockRef`, `itemRefs` (`"river-rules:rope-50ft"`). Use them when the adventure leans on the setting's entries instead of copying them.
- Whole numbers where the format has numbers (weights, slots, costs, levels, chances). A value that is genuinely not a number ("permanent", "Instant") stays as text; don't invent one.
- Level-based numbers as formulas: `{ "formula": "6 + level", "unit": "turn" }`. Allowed: numbers, `level`, `+ - * /`, brackets, `floor()`, dice like `1d6` or `level d6`. Anything else stays text.
- Values that differ by class (a spell's range, duration or notes) as an object keyed by class id.
- Tables: `die` and rows `{ min, max, result }`, a one-line `description` on the table and a `note` on each row where the book gives one (B2, 2026-11-01; the GM's table list and the row list show them); encounter rows may add `count` ("1d6") and `statBlockId`; composite dice (`d4/d10`) rows carry a `key`; `"kind": "lookup"` rows are `{ key, value }`; `"kind": "matrix"` has `columns` and rows `{ level, results }`.
- Stat blocks: `hp` (dice) and `hpAverage`; the stat line in `fields` as label → value; `abilities` as `{ name, note }`.
- Class and race abilities: `{ name, fromLevel?, note }`.
- Hooks follow 07's Rule hooks exactly: its fields, events, test language and fixed functions (`from` names only a built-in source). Anything a source needs beyond that goes in `_notes` as off-spec, never into new syntax.
- Optional rules: `choices` (`{ id, name, notes? }`), `default` (a choice id), `changeLater` (`allow`, `warn` or `never`), and `notes` explaining the rule (the app shows them when the GM taps the rule's name).
- Empty is left out rather than written as `null` or `""`.
- Each entry carries `source`: `"Book p. 196"` (setting; an object keyed by class id when pages differ), or `"p. 31"` (adventure, printed page).
- **Never invent a new shape when one in 07 fits.** Only when nothing fits, add the field and list it in `_notes` as off-spec, with its path (`"items[].properties"`); the manager puts it in `meta.proposedExtensions`.

## Adventure shapes

- **Encounter checks** (07 §4), one per location that has one, in `_encounterChecks`:
  ```json
  { "locationId": "mf-abbey", "encounterCheck": {
      "every": { "value": 1, "unit": "turn" }, "chance": { "die": "d6", "on": [1, 2] },
      "tableId": "mf-abbey-encounters", "onlyAt": null,
      "byTrack": [ { "trackId": "mf-flood", "min": 0, "max": 5, "chance": { "die": "d6", "on": [1, 2, 3] } } ],
      "note": "Also roll when the party is noisy." } }
  ```
  `chance: null` means always roll. `onlyAt` is `"day"`, `"night"` or null. A child location with its own check gets its own entry. `hour` is a valid unit.
- **Shops** (07 §6): `stock` lines with `itemRef` or `itemId`, a `price` (`{ "gp": 1 }`, or text such as "One true secret"), optional `qty` (`"1d6"`) and `note`; `services`; `buys`; `gm.notes`. The price is the shop's, not the item's list price.
- **Stat blocks:** the adventure always carries its own printed ones, even when the setting has a creature of the same name.

## Writing rules

- **Setting and homebrew:** names, numbers and short notes in your own words, up to three sentences. Never copy flavour text, descriptive paragraphs or long book text.
- **Adventures:** mechanics in full; descriptions in your own words, as long as needed; nothing copied word for word.
- Read tables as page images when the text layer scrambles columns.
- Check your piece for copying before handing back: `py skills/content-pack-converter/scripts/copy_check.py <your piece> BOOK.pdf --offset <pageOffset>` (or `--text <source.txt>` for a text source) and reword anything it flags.
- Ambiguous? Write it in `_notes` with its page rather than guessing.
- Copyright-clean: your piece stays in the git-ignored `packs/` folder.

## Hand back

Your piece's path, counts per kind, pages partly captured or skipped, proposed new ids, off-spec fields and doubts.
