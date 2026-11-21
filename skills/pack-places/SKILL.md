---
name: pack-places
description: Writes the places and people of a Grimoire adventure pack (format version 3) from the user's own adventure: locations with their player view and GM layer, routes, clues, quotes, NPCs, factions, rumours, tracks, timeline, pre-mades and the adventure-mechanics optional rules. Used by content-pack-converter; not run on its own unless asked.
---

# Pack places

You write what the GM runs and what players are allowed to notice. Follow `docs/07-content-packs.md` (07): "Adventure packs: content rules" and §2, §3, §5, §7, §8, §10, §11, §13, §14 and §16. **Where this skill and 07 differ, 07 wins.**

Inputs from the manager: the PDF, your page range, the job folder, and `id-plan.json` (your entries, plus the ids of stat blocks, tables, items, shops, images and crops you link to). Write your piece to `packs/<source-slug>/pieces/places-p<first>-<last>.json`. Write only planned entries with their planned ids; propose anything else in `_newIds` (`{ id, kind, name, page, why }`). Record pages in `_pages` (captured, partly with the reason, skipped with the reason) and doubts in `_notes`, each with its page.

## Locations (both layers)

One kind for every place, nested by `parentId`: region → site → floor or area → room or building. Shape as in 07 §2:

```json
{ "id": "mf-abbey-14", "name": "Chapter house of the drowned", "key": "14", "type": "room",
  "parentId": "mf-abbey-lower", "mapId": "mf-map-abbey-lower",
  "playerView": { "name": "Flooded hall",
    "text": "A low vaulted hall, knee-deep in black water. Benches float against the far wall.",
    "people": [ { "description": "A hunched figure in a reed cloak", "npcId": "mf-npc-oswy" } ],
    "exits": [ "Stairs up (north)", "Archway (east)" ] },
  "gm": { "notes": "A drowned acolyte rises if the benches are disturbed.",
          "secrets": [ "A loose flagstone under the lectern hides the abbey seal." ] },
  "clues": [ { "text": "Wet footprints lead from the water to the lectern and back.", "source": "p. 31", "pointsTo": "mf-abbey-14" } ],
  "readAloud": [ { "imageId": "mf-crop-031-a", "source": "p. 31" } ],
  "contents": [ { "statBlockId": "mf-drowned-acolyte", "count": "1" } ],
  "treasure": [ { "text": "Abbey seal (silver)", "itemId": "mf-abbey-seal", "value": { "gp": 40 } } ],
  "hazards": [ { "name": "Benches", "trigger": "Disturbed", "effect": "The acolyte rises", "source": "p. 31" } ],
  "source": "p. 31" }
```

- **`playerView`** is what players notice on arrival: a few short lines in your own words, **never a secret**.
  - `name`: what players would call it ("Flooded hall"), not the GM's name if that gives something away. Leave it out when players wouldn't know; they see "Unknown place".
  - `people`: described, never named ("A hunched figure in a reed cloak"); `npcId` links the NPC for the GM.
  - `exits`: plain text, and never a hidden or secret route.
  - `shopId` when a shop is here.
- **`gm`**: notes and secrets in your own words, as long as needed.
- **`clues`**: one entry per clue, each with its page; `pointsTo` (optional) is the location, NPC or item id it leads to.
- **`quotes`**: exact wording **only where the wording is the clue**: `kind` is `riddle`, `inscription`, `password`, `verse` or `spoken`. Nothing else is copied word for word.
- **`readAloud`**: the planned crop ids for this location (boxed text and the room description), in page order. Never retype boxed text; the crop is the GM's copy.
- **`contents`**: creatures and counts by `statBlockId`, each with an **`appearance`**: one player-safe line of what the party sees (B1, 2026-11-01). **`hazards`**: triggers and traps, each with an `appearance` where something shows before it goes off (none when nothing does). A creature a trap springs goes in `contents`, its trigger in `hazards`. Never a stat, a trigger or an effect in an appearance.
- **`treasure`**: `text`, optional `itemId`, and `value` in whole coins as printed (`{ "cp": 7 }`, mixed allowed; never `valueGp`).
- `key` is the map label; `hex` only on hex maps. Leave `encounterCheck` to Mechanics (it's merged in).

## Routes (07 §3)

`{ "id": "mf-route-ford-abbey", "from": "mf-ford", "to": "mf-abbey", "travel": { "value": 3, "unit": "hour" }, "type": "path", "hidden": false, "oneWay": false }`. `type` is `path`, `road`, `river`, `door`, `stairs`, `secret` or `other`. Secret ways get `hidden: true` and stay out of every `exits` list.

## NPCs and factions (07 §5)

- NPC: `name`, `role`, `locationId`, `factionId`, `playerView.description` (what players see when introduced, no name), `gm` { `wants`, `secrets`, `notes` }, `statBlockId` (the planned `-stats` id when they have stats), `source`.
- Faction: `name`, `memberIds`, `gm` { `goals`, `notes` }, `source`.

## Rumours (07 §7)

A table with `"kind": "rumours"`; rows carry `truth`, always the string `"true"`, `"false"` or `"partial"`, which is GM only. Row text in your own words.

## Tracks and timeline (07 §8, §10)

- Track: `start`, `end`, `visibility` (`players` or `gm`, for the count), `thresholds` (`min`, `max`, `message`, `once` for one-off beats), `remind`, and an optional `roster` (`die`, its own `visibility`, `states` each with `movesTrack`, `entries` each with `npcId` or an inline `name` (optional `note`), never both: use `npcId` when the book gives the person more than a line anywhere else; `startsIn`, `takenRule`, `onTick`). Messages are GM nudges in your own words.
- Timeline: day-based beats only: `{ "id": "mf-beat-day3", "day": 3, "gm": "The Tollmen raise the toll.", "source": "p. 9" }`. Beats set off by a track are thresholds with `once: true`. Conditional beats ("if the party does nothing…") stay as GM notes with their page.

## Pre-mades (07 §11)

`name`, `classRef` (`"river-rules:lantern-warden"`), `level`, `abilities`, `hp`, `itemRefs`, `notes`, `use` (`replacement`, or `retainer` for NPCs with stat blocks), `source`.

## The adventure-mechanics optional rules (07 §14)

Each track, roster, `byTrack` and the timeline reminders get their own optional rule, as planned: one switch each, with **no `ruleKey`** (a shared one would merge them into one choice) and `"category": "Adventure mechanics"` (display only):

```json
{ "id": "mf-opt-flood", "name": "The flood track", "category": "Adventure mechanics",
  "default": "on", "changeLater": "allow",
  "choices": [ { "id": "on", "name": "On" }, { "id": "off", "name": "Off" } ],
  "notes": "Off: the flood becomes a GM note (p. 8).", "source": "p. 8" }
```

The notes say what "off" does: the mechanic becomes a GM note with its page reference.

Link each mechanic to its switch with `option` on the entry (tracks, timeline beats, encounter checks, tables): `"mf-opt-flood"` (live when its choice is `on`) or `"mf-opt-flood=slow"` (live for that choice). A `byTrack` line follows its track, so it needs no `option` of its own.

## Before handing back

- **Leak check yourself:** read every `playerView` against the location's `gm`, `clues`, the NPCs' names and the hidden routes. Nothing secret, no names, no hidden exits.
- **Copying check:** `py skills/content-pack-converter/scripts/copy_check.py <your piece> BOOK.pdf --offset <pageOffset>` flags 8+ words in a row matching the book (quotes and names are skipped). Reword what it flags.
- Every entry and every clue has its printed page. Links use planned ids only.
- Copyright-clean: your piece stays in the git-ignored `packs/` folder.

## Hand back

Your piece's path, counts per kind, pages partly captured or skipped, proposed new ids, off-spec fields (any field 07 doesn't define, with its path) and doubts with pages.
