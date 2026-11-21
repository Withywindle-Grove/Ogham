---
name: pack-images
description: Makes the images of a Grimoire adventure pack from the user's own PDF: maps, handouts and player-facing art, crops of read-aloud boxes and room descriptions (WebP), the image manifest with alt text and visibility, and the folder the GM uploads to Google Drive. Used by content-pack-converter; not run on its own unless asked.
---

# Pack images

You render the pictures the GM needs and write the manifest that names them. Follow `docs/07-content-packs.md` (07): "Adventure packs: content rules" and §9 and §16. **Where this skill and 07 differ, 07 wins.**

Inputs from the manager: the PDF, the job folder, `id-plan.json` (every image and crop id, what it's for), `page-map.json` and `boxes.json`. Write the files under `packs/<source-slug>/images/` and the manifest to `packs/<source-slug>/pieces/images.json` as `{ "images": [ ... ], "_pages": {...}, "_newIds": [...], "_notes": [...] }`.

Rendering uses `skills/content-pack-converter/scripts/crop.py` (PyMuPDF and Pillow; `py` on Windows, `python3` elsewhere; `-h` shows usage). If either library is missing, stop and tell the manager, who asks the user before installing. PDF page numbers go to the script; printed pages go in `source`.

## What goes in

- **Maps** (`type: "map"`): every map. A GM map with secrets is `visibility: "gm"`. If the book has a separate player map, make it its own image (`revealable`) and point the GM map's `playerVersionId` at it. Don't paint out secrets yourself; if there's no player version, leave `playerVersionId` null and note it.
- **Handouts** (`type: "handout"`): anything meant to be shown to players, `revealable`.
- **Art** (`type: "art"`): only art showing something players could see (a creature, a place, a person), `revealable`. Decorative art is skipped and listed in `_pages.skipped` with "decorative", so the coverage report can list it.
- **Crops** (`type: "crop"`): every read-aloud box and every room description, as planned. **Always `visibility: "gm"`.** Places links them from each location's `readAloud`.

## Sizes (07 §9)

| Type | Command | Size |
|---|---|---|
| map | `crop.py BOOK.pdf <pdf page> images/maps/<name>.webp --kind map [--bbox …]` | at most 2400 px on the long edge |
| art, handout | `--kind art` or `--kind handout` | at most 1600 px on the long edge |
| crop | `crop.py BOOK.pdf --boxes boxes.json --out-dir images/crops` | about 160 dpi |

- `--bbox x0,y0,x1,y1` is in PDF points from the top left, as `find_boxes.py` prints them. For room descriptions, run `find_boxes.py --style "<heading style>"` (the Reader names it) to find where each keyed entry starts, and crop from its heading to the next one in the same column. An entry over two columns or pages gets one crop per part (`-a`, `-b`).
- Open a few results of each kind and check they're readable and nothing is cut off.
- Two-page map spreads: render both pages and say so in `_notes`; don't stitch by hand unless the manager asks.

## The manifest

```json
{ "id": "mf-map-abbey-lower", "file": "maps/abbey-lower.webp", "type": "map",
  "title": "Abbey, lower level", "alt": "Plan of a flooded lower level with fourteen rooms",
  "visibility": "gm", "playerVersionId": null, "locationIds": [ "mf-abbey-lower" ], "source": "p. 29" }
```

- **`alt` is required** on every image: a plain description of what it shows, in your own words. For a crop, say what it's for ("Boxed text for the flooded hall, room 14"), never the text itself.
- `file` is the path inside the Drive folder; the importer checks each named file is there.
- `locationIds` lists the locations the image belongs to; maps also list every keyed room you can read on them in `_notes` (the Reviewer checks every key has a location).
- `pins` are reserved for R2; leave them out.
- Ids come from the ID plan; propose extras in `_newIds`.

## The Drive folder

The GM uploads the contents of `packs/<source-slug>/images/` to one Google Drive folder and picks it at import (07 §9):

```
images/
  maps/       maps/abbey-lower.webp
  handouts/
  art/
  crops/      crops/mf-crop-031-a.webp
```

Every `file` in the manifest is relative to that folder. Nothing else goes in it.

## Rules

- Images come only from the user's own copy, and stay in the git-ignored `packs/` folder until the GM uploads them to their Drive.
- Copyright-clean: the manifest's titles and alt text are your own words.

## Hand back

The manifest's path, counts per type, pages skipped (and why), images you weren't sure about, and maps without a player version.
