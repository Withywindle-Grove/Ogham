---
status: absorbed
milestone: m8b
absorbed-into: docs/07-content-packs.md (Adventure packs, format version 3), docs/05-features.md (Adventures), docs/06-screens-and-design.md (Location browser)
supersedes: —
---

# S16 — Adventure packs (format version 3): RULED

Status: RULED 2026-10-24 (15 rulings, the toggle rule, prep mode, and follow-up rulings a–e after the first real-pack checks, in the design Project). It extends `07-content-packs.md` for `meta.kind: "adventure"` and is built in **M8b**, apart from the clock pieces noted for M5. All examples are invented.

Already ruled earlier the same day, and assumed here:
- Adventure packs aim to be complete.
- Page references go on everything.
- Descriptions are in your own words, with clue fields.
- Exact quotes are allowed only where the wording is the clue.
- Images come from the owner's copy, and page crops are GM only.
- Images live in the GM's Google Drive, and revealed copies go to app storage.
- Content is GM-only by default, and every location has two layers.
- There's a Handouts list.
- Tracks are built in M8b.
- The converter is a manager with five specialists.

---

## 1. Pack basics (ruling 1, ruling 13)

- Adventure kinds arrive in **`formatVersion: 3`**. Version 3 keeps everything in versions 1 and 2. The importer reads all three, and as before it imports what a file actually contains.
- **`meta.id`** (every pack kind): a stable slug that never changes when the pack is renamed. References to a pack use it. A pack without one falls back to the slug of its `shortName`.
- **`meta.kind: "adventure"`.**
- **`meta.code`:** 2–6 lowercase letters. Every id in an adventure pack starts with it plus a dash (`mf-…`), so an adventure's entries never override a setting's entries by accident.
- **`meta.requires`:** `[ { "packId": "river-rules", "minVersion": "1.0" } ]`. The import preview warns when one is missing, and never refuses.
- **`meta.pageOffset`:** printed page = PDF page − offset. Page references use **printed** numbers.

## 2. `locations` (ruling 2, ruling 11)

One kind for every place, nested through `parentId`: region → site → floor or area → room (or building).

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
  "contents": [ { "statBlockId": "mf-drowned-acolyte", "count": "1" } ],
  "treasure": [ { "text": "Abbey seal (silver)", "itemId": "mf-abbey-seal", "value": { "gp": 40 } } ],
  "hazards": [ { "name": "Benches", "trigger": "Disturbed", "effect": "The acolyte rises", "source": "p. 31" } ],
  "encounterCheck": null, "mapId": "mf-map-abbey-lower", "hex": null, "imageId": null,
  "source": "p. 31" }
```

- **`type`** is `region`, `site`, `area`, `floor`, `room` or `building`. It's informational only.
- **`key`** is the map label. **`hex`** is an optional grid coordinate; point-crawl adventures leave it null and use routes.
- **`playerView`** is what players notice: a few short lines, never a secret.
  - **`name`** is the name players see. Without one, players see "Unknown place" until the GM names it.
  - **`people`** are described, never named, until the GM introduces them.
  - **`exits`** are plain text and never name a hidden route.
- **`gm`** holds notes and secrets, in your own words and as long as needed.
- **`clues`** lists each clue separately, with its page. `pointsTo` (optional) is the location, NPC or item it leads to.
- **`quotes`** is exact wording only. `kind` is `riddle`, `inscription`, `password`, `verse` or `spoken`.
- **`readAloud`** lists the GM-only crops, in page order.
- **`treasure`** entries carry **`value`**: coin key to whole number (`{ "cp": 7 }`, `{ "gp": 127, "cp": 7 }`), the same shape as item values and shop prices (ruling e). The importer accepts the old `valueGp` and converts it to `{ "gp": n }`, with a note. Totals use the rules set's `currency` values; a coin the campaign's setting doesn't define is warned about at import and shown as written.
- **`contents`** holds creatures and their counts. **`hazards`** holds the trigger or trap. A creature that a trap springs goes in `contents`, and its trigger in `hazards`.
- **The location browser** (M8b) has search by key or name and a "recently visited" list, so any room is two or three taps away.

## 3. `routes` and the hour unit (ruling 3)

```json
{ "id": "mf-route-ford-abbey", "from": "mf-ford", "to": "mf-abbey",
  "travel": { "value": 3, "unit": "hour" }, "type": "path", "hidden": false, "oneWay": false, "notes": "" }
```

- **`type`** is `path`, `road`, `river`, `door`, `stairs`, `secret` or `other`. Routes with `hidden: true` are GM only.
- **`hour`** is a time unit worked out from the rules set's `time.turnMinutes`. The clock keeps exact minutes underneath, so a turn length that doesn't divide 60 still works. `hour` can be used in `travel`, `every` and reminders.
- **M5:** with the expedition setting `wilderness`, the time strip shows **+1 hour** in place of +1 round.
- **M8b: Travel** in Explore pre-fills the route's time. The GM can change it before confirming, and it's logged and undoable. Checks that fall due along the way show once, with a count.

## 4. `encounterCheck` (ruling 4)

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
- **`byTrack`** changes the chance while a track's value is in a range. It's one fixed shape, not an expression.
- **In the app** (M5's Hit and Miss check, with dice at the table):
  - a **Day / Night** switch on the time strip (one tap, logged, shown to players on Scene; the GM decides when night falls);
  - **Check now**, which runs a check on demand;
  - the **active check** shown on the Explore panel ("Abbey · 1–2 on d6 each turn").

## 5. `npcs` and `factions` (ruling 5)

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
- **Introduce** is one tap and logged. Introduced NPCs appear in **Handouts → People** with their name and `playerView.description`.
- **NPC status is campaign state.** The GM marks alive, dead, missing or absent, and friendly, neutral or hostile. It's logged, and GM only unless the GM shares it.
- **Faction reputation** is R2.

## 6. `shops` (ruling 6)

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

## 7. Rumours (ruling 7)

- Rumours are a table with `"kind": "rumours"`. Rows may carry **`truth`**, always one of the strings `"true"`, `"false"` or `"partial"` (ruling b). It's GM only and never sent. The importer quietly converts plain `true` and `false`, with a note in the preview.
- **Told rumours are campaign state,** dimmed for the GM. Rolling a told one offers "Already told: roll again?".
- **Send** shares a row's text in one tap and keeps it in Handouts by default.

## 8. `tracks` (ruling 8, ruling 10)

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
- **Each roster entry has `npcId` or an inline `name`, never both** (ruling a). `note` is optional with `name`. The converter uses `npcId` when the book gives that person more than a line anywhere else. **"Make NPC"** on a roster entry (GM, M8b) turns an inline person into an NPC in the campaign's homebrew, keeping their roster place and state.
- **States are defined by the pack**, and each says whether it moves the track. `startsIn` covers people already in a state when the adventure starts.
- **Several at once:** the GM enters how many, then the roll for each, or taps names. When a rolled entry is already taken, `takenRule: "next"` moves to the next free one. The whole thing is one logged change.
- **`onTick`** is a GM-only nudge on each change. **Manual ticks** are allowed any time.
- **Dice stay at the table:** the GM enters every roll.

## 9. `images` (ruling 9)

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

## 10. `timeline` (ruling 10)

```json
{ "id": "mf-beat-day3", "day": 3, "gm": "The Tollmen raise the toll.", "source": "p. 9" }
```

- **Day-based only.** Beats set off by a track are thresholds with `once: true` (section 8).
- **Start adventure** (one tap, logged) sets the adventure's day 1 to the campaign's current day.
- **Beats remind the GM** when their day comes, and the adventure overview lists what's coming.
- **Conditional beats** ("if the party does nothing…") stay as GM notes with their page.

## 11. `premades` (ruling 12)

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

## 12. Existing kinds in adventure packs

`statBlocks` (the adventure always carries its own printed stat blocks, prefixed), `items`, `tables` (encounter tables, night events, getting lost; nested tables per v2), `treasureTypes` and `hooks`.

## 13. References between packs (ruling 13)

- **`itemRef`, `classRef`, `statBlockRef` and `itemRefs`** take the form `"<meta.id>:<id>"`. Same-pack references use `itemId`, `statBlockId` and `tableId`.
- **A reference resolves through the campaign's pack priority order,** so homebrew edits apply.
- **Unresolved references** are listed in the import preview ("3 items need River Rules"). Those entries still import and show by name with a "needs …" mark.

## 14. Turning mechanics off (toggle rule; rulings c, d)

- **Adventure-specific mechanics** (each track, roster, `byTrack` and the timeline reminders) are written by the converter as the pack's **optional rules**: one switch per mechanic, with **no `ruleKey`** and the display-only field **`"category": "Adventure mechanics"`**. The optional-rules list shows them together under that heading within their adventure. `category` never affects choices.
- **`option`** links an entry to its switch, on any adventure entry (tracks, timeline beats, encounter checks, tables):
  - `"<optionId>"`: live when that rule's choice is `on`;
  - `"<optionId>=<choiceId>"`: live for that specific choice (written like `byOption` keys).
  - The same meaning applies to `option` on tables in every pack.
- **Dependent pieces follow their parent:** a `byTrack` line is skipped while its track is off, and the check falls back to its base chance.
- **Off** means the mechanic becomes a GM note with its page reference.
- **App automations used by every adventure** are switches in **Campaign → During play**: Travel moves the clock, shop stock counts, told rumours marked, the active check shown.
- **Defaults are on,** and every switch says what "off" does.

## 15. Campaign state (not pack data)

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

## 16. Who sees what (ruling 11)

| Data | Players see |
|---|---|
| Location `playerView` (with `playerView.name`) | When the GM opens it; one open location at a time, until closed or another is opened |
| Location `gm`, `clues`, `quotes`, `readAloud`, `contents`, `treasure`, `hazards` | Never (the GM may Send a clue or quote as text) |
| Routes | Never (exits are plain text) |
| NPCs | `playerView.description` when introduced; then name and description in Handouts → People |
| Shops: stock, services, `buys`, prices | While the shop is open |
| Rumours | Only what's sent; `truth` never |
| Tracks | The count, if `visibility: players`; roster entries, if the roster's visibility is `players` |
| Images | Revealed copies only (whole or cropped); crops never |
| Day / Night | Shown on Scene |
| Pre-mades | Sheet details while choosing a character |
| Timeline, stat blocks, tables | Never |

The database enforces all of this. M8b adds a visibility test per new kind, run as a player.

## 17. Prep mode (prep mode ruling)

- **A GM walk-through** of the adventure's locations in page order on a tablet: each location's summary, clues and player view beside its crop, with inline editing and a **Reviewed** mark.
- **Edits save into the campaign's homebrew,** following the editor's rule, so updating the pack later never loses them.
- **Built in M8b,** reusing the location browser's screens.

## 18. The converter (ruling 14)

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
- **Order:**
  1. The Reader goes first.
  2. Mechanics, Places and Images run at the same time, splitting big books by page range and joined by the ID plan.
  3. The manager merges and checks the result: against a JSON schema of this spec until M8b, then with `pack:check`.
  4. The Reviewer checks.
- **Fixes** go back to the specialist responsible. **At most two review rounds;** anything still open goes to the GM as a list.
- **The Reviewer sees** only the pack, the PDF and this spec.
- **Scaling:** a small homebrew uses Mechanics and the Reviewer; a rulebook adds the Reader; an adventure uses all five.

## 19. The coverage report (ruling 15)

`coverage-report.md`, delivered privately (the owner's git-ignored packs folder, and to the owner as a file), never to the repo:

1. **A one-screen summary:** problems by type with counts and pages (leaks, clues pointing nowhere, copying flags, broken links, doubts).
2. **The prep checklist:** every location in page order with its page, facts and clues, player view and crops, each with a checkbox. It matches prep mode.
3. **Pages:** captured, partly captured or skipped, with the reason.
4. **Counts** compared with the ID plan.
5. **Leak check:** player names, text, people and exits checked against secrets, clues and hidden routes.
6. **Copying check:** 8 or more words in a row matching the book are flagged, except ruled `quotes` and names.
7. **Links:** every reference resolves (or is listed as needing another pack), and every keyed room on a map has a location.
8. **Spot checks:** 5 random locations to compare with the book. This is the minimum.
9. **Doubts,** each with its page.

## 20. Where it's built

| What | Milestone |
|---|---|
| `hour` unit, exact minutes, +1 hour in wilderness | M5 |
| Current location and encounter tables built to this spec | M5, M6 |
| Everything else in this spec: v3 import, location browser, open location, Travel, Day / Night, Check now, NPCs, shops from adventures, rumours, tracks, timeline, pre-mades, images and reveal, Handouts, prep mode, toggles, visibility tests | M8b |
| Map pins, faction reputation | R2 |
