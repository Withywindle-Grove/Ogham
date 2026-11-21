---
name: pack-reader
description: First step of a content-pack conversion of a rulebook or adventure PDF. Writes the outline, the ID plan, the page map (printed ↔ PDF pages, meta.pageOffset) and the read-aloud box positions the other specialists work from. Used by content-pack-converter; not run on its own unless asked.
---

# Pack reader

You run first. You don't write pack entries: you map the book so Mechanics, Places and Images can work at the same time without clashing. Follow `docs/07-content-packs.md` (07), especially §1 and §18. **Where this skill and 07 differ, 07 wins.**

Inputs from the manager: the source PDF, the job folder `packs/<source-slug>/`, the kind, `meta.id` and (adventures) `meta.code`. Scripts are in `skills/content-pack-converter/scripts/` (`py` on Windows, `python3` elsewhere; `-h` shows usage). They need PyMuPDF; if it's missing, stop and tell the manager, who asks the user before installing.

## 1. Page map → `page-map.json`

`py skills/content-pack-converter/scripts/page_map.py BOOK.pdf --out packs/<source-slug>/page-map.json --text-dir packs/<source-slug>/text`

- It finds the printed number on each page and proposes `pageOffset` (printed page = PDF page − offset). Look at the pages it lists as differing (front matter, inserts, two-page spreads) and say in `outline.md` how they map.
- No numbers found: ask the user which PDF page is printed page 1.
- From here on, **every page reference is a printed page**. PDF pages are used only to run the scripts.

## 2. Outline → `outline.md`

One line per chapter or section, in page order: printed page range, what's there, and who owns it (Mechanics, Places, Images). Mark pages with nothing to convert (credits, ads, decorative art) and why: the Reviewer's pages section needs that. For big books, propose page ranges for the manager to split on (chapter breaks, roughly 40–60 pages each). Use your own words; quote nothing.

## 3. ID plan → `id-plan.json`

Every entry the pack will have, before anyone writes it, so pieces can link to each other:

```json
{ "packId": "mire-ford", "code": "mf", "pageOffset": 2,
  "entries": [
    { "id": "mf-abbey-lower", "kind": "locations", "name": "Abbey, lower level", "pages": [29], "owner": "places" },
    { "id": "mf-abbey-14", "kind": "locations", "name": "Chapter house of the drowned", "key": "14",
      "parentId": "mf-abbey-lower", "pages": [31], "owner": "places" },
    { "id": "mf-drowned-acolyte", "kind": "statBlocks", "name": "Drowned acolyte", "pages": [31], "owner": "mechanics" },
    { "id": "mf-map-abbey-lower", "kind": "images", "type": "map", "pages": [29], "owner": "images" },
    { "id": "mf-crop-031-a", "kind": "images", "type": "crop", "pages": [31], "for": "mf-abbey-14", "owner": "images" }
  ] }
```

- **Ids:** lowercase letters, digits and dashes; adventures start every id with the code and a dash (`mf-`). Unique per kind. Stable, readable slugs: `mf-abbey-14` (site + map key), `mf-npc-oswy`, `mf-route-ford-abbey`, `mf-shop-chandler`, `mf-flood` (track), `mf-beat-day3`, `mf-pre-hild`, `mf-map-abbey-lower`, `mf-crop-031-a` (printed page + letter).
- **A unique NPC with stats** gets a stat block with an id based on the NPC's (`mf-npc-oswy-stats`), owned by Mechanics.
- **Kinds and owners** follow 07 §18: locations, routes, NPCs, factions, rumour tables, tracks, timeline, pre-mades and the adventure-mechanics optional rules → `places`; stat blocks, other tables, items, treasure types, shops, hooks → `mechanics`; images and crops → `images`. Setting and homebrew jobs: every kind → `mechanics`.
- **Plan the joins:** each location's parent, map (`mapId`), crops (`for`), shop, encounter table, and each mechanic that needs an optional rule (each track, roster, `byTrack` and the timeline reminders, 07 §14).
- **Crops:** plan one per read-aloud box and one per room description (a description that runs over columns or pages gets `-a`, `-b`…).
- **Counts:** add a `counts` object (`{ "locations": 42, "statBlocks": 18, … }`); the Reviewer compares the pack with it.

## 4. Read-aloud boxes → `boxes.json`

Found by their print style through the PDF's text layer (07 §18):

1. `py skills/content-pack-converter/scripts/find_boxes.py BOOK.pdf --pages <a sample range>` lists the text styles; the body text is marked. Read-aloud text is usually a different font, size, colour or italic, often on a shaded or framed shape.
2. Compare the likely style with two or three page images. Headings for keyed rooms are usually another distinct style: note it too, so Images can find where each room's description starts and ends.
3. `py skills/content-pack-converter/scripts/find_boxes.py BOOK.pdf --style "<style key>" --offset <pageOffset> --out packs/<source-slug>/boxes.json`
4. Add each box's planned crop `id` from the ID plan to its entry in `boxes.json`, so `crop.py --boxes` names the files.
5. **No text layer, or no distinct style:** say so and ask the user to confirm the boxes (from page images: which pages, which boxes). Don't guess.

## Hand back

Tell the manager: the offset and any odd pages, the outline's page ranges, the planned counts per kind, the box style found (or that the user must confirm boxes), and anything unclear, each with its page.

## Rules

- Copyright-clean: your files hold structure, names, ids and pages, never book text. `boxes.json` keeps only a few first words per box to tell boxes apart.
- Everything stays in the git-ignored `packs/<source-slug>/` folder.
