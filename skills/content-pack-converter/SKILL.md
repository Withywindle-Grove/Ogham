---
name: content-pack-converter
description: Convert a user's own tabletop RPG material (rulebook or adventure PDF, Markdown, text or page images) into a private Grimoire content pack, as the manager of five specialist skills. Setting and homebrew packs (format "tabletop-pack" version 2) hold items, classes, races, XP tables, spells, stat blocks, tables, optional rules, hooks and the like; adventure packs (version 3) add locations, routes, NPCs, shops, tracks, images and the rest. Use when the user asks to convert, import or ingest rules or adventure material for Grimoire.
---

# Content pack converter (manager)

Turns material the user owns into a Grimoire pack the app imports (Rules library → Import a file). The pack is private to the user's account; it never goes into the app's code, tests, docs or examples.

The single source of truth is `docs/07-content-packs.md` (07): versions 1 and 2, the IP rules, "Adventure packs: content rules", and "Adventure packs (format version 3)", especially §18 The converter and §19 The coverage report. Read the parts the job needs before starting. **Where this skill and 07 differ, 07 wins.**

**How a job goes from start to finish** (survey, fit check, stages, scripts, checks, the modelling-gaps register, hand-over, and the lessons learned so far) is in `PLAYBOOK.md`, next to this file. Read it after this file, before starting a job.

You are the manager. You plan the job, own the ID plan, pick the specialists, run them, merge their pieces, check the result, send fixes back, and hand the user the finished pack with the open list. You don't convert entries yourself except in the smallest jobs (see Team).

## The team

| Skill | Writes |
|---|---|
| `pack-reader` (runs first) | `outline.md`, `id-plan.json`, `page-map.json`, `boxes.json` |
| `pack-mechanics` | Tables with their checks, stat blocks, items, treasure, shops, hooks; for setting and homebrew packs, all the setting kinds |
| `pack-places` | Locations (both layers), routes, clues, quotes, NPCs, factions, rumours, tracks, timeline, pre-mades, the adventure-mechanics optional rules |
| `pack-images` | Images and crops (WebP), the image manifest, the Drive folder |
| `pack-reviewer` (fresh agent) | `coverage-report.md`; it reports and fixes nothing |

Pick only who the job needs (07 §18, Scaling):
- **Small homebrew** (a few house rules, a short list): Mechanics, then the Reviewer. You write the small ID plan yourself.
- **Rulebook or setting section:** Reader, Mechanics, Reviewer.
- **Adventure:** all five.

Start each specialist as a subagent (the Agent tool), telling it to follow its skill file (`skills/<name>/SKILL.md`) and giving it the job folder, its page range and its part of the ID plan. Start Mechanics, Places and Images in one message so they run at the same time. If subagents aren't available, run the specialists one after another yourself, each from its own skill file.

## Before you start

1. **Rights and scope.** Only material the user says they own or may use. Ask what to convert if they didn't say. Setting books: one section at a time ("the wilderness encounter sub-tables", "monsters A–C", "chapter 4 spells"). Adventures: the whole adventure (07 asks for completeness), split by page range if it's big.
2. **Source name.** Ask "What's this source called?", with the answer pre-filled from the PDF's title. Slug it into the **source slug** (lowercase, dashes); if it clashes with another source's slug, add an edition or publisher suffix. The private files are named after it (07 §18, File names): the folder `packs/<source-slug>/`, the pack `<source-slug>-<version>.pack.json`, build candidates `build/<source-slug>-candidate-<version>.pack.json`, a conversion `conv-<from-slug>-to-<to-slug>-<version>.pack.json`; reports (gap report, changelog) sit beside the pack. The real name lives only there and in `meta.name`, never in the repo.
3. **Kind and version.**
   - `setting` or `homebrew`: `"formatVersion": 2`.
   - `adventure`: `"formatVersion": 3`.
   - Every pack has **`meta.id`**: a stable slug that never changes when the pack is renamed (`river-rules`, `mire-ford`). References from other packs use it. It stays the neutral alias, not the source slug.
   - Adventures also have **`meta.code`** (2–6 lowercase letters, e.g. `mf`; every id in the pack starts with `mf-`), **`meta.requires`** (`[ { "packId": "river-rules", "minVersion": "1.0" } ]`, for each setting pack the adventure refers to) and **`meta.pageOffset`** (printed page = PDF page − offset; from the Reader). Ask the user for the code and which setting packs the adventure goes with; propose a code from the title if they have no preference.
4. **Python tools (PDF jobs).** The scripts in `skills/content-pack-converter/scripts/` use Python with PyMuPDF (rendering, text layer) and Pillow (WebP). Check with `py -c "import pymupdf, PIL"` (Windows) or `python3 -c "import pymupdf, PIL"`. If either is missing, tell the user what it is and why, and **wait for a yes** before running `py -m pip install pymupdf pillow` (or `python3 -m pip install pymupdf pillow`). Every script prints a usage line with `-h`. The checks on finished packs (`check_adventure.py`, `copy_check.py --text`) need no installs.
5. **Job folder.** Everything for the job lives in the user's git-ignored `packs/` folder, never in the repo:

```
packs/<source-slug>/
  job.md                    your plan: scope, kind, code, team, page ranges, status
  outline.md, id-plan.json, page-map.json, boxes.json     (Reader)
  pieces/mechanics-p001-060.json, pieces/places-p001-060.json, pieces/images.json
  images/maps/, images/handouts/, images/art/, images/crops/   (Images: the Drive folder)
  <source-slug>-<version>.pack.json   the merged pack (you)
  build/<source-slug>-candidate-<version>.pack.json   staged builds (PLAYBOOK §4)
  GAP-REPORT.md, CHANGELOG.md   reports, beside the pack (PLAYBOOK §2 and §4)
  check.txt                 checker output (you)
  coverage-report.md        (Reviewer)
  open-items.md             what's left for the user (you)
```

## Steps

1. **Plan.** Write `job.md`: the scope, kind, `meta.id`, code, the team, and (after the Reader) the page ranges per specialist. Big books: split Mechanics and Places by page range along chapter breaks (roughly 40–60 pages each); Images can take the whole book.
2. **Reader first** (rulebooks and adventures). It writes the outline, the ID plan, the page map and the read-aloud box positions. Read `outline.md` and check `id-plan.json` yourself: every id follows the code, kinds match 07, and every entry has one owner. **You own the ID plan from here:** only you change it. A specialist that finds something unplanned proposes the id in its piece (`_newIds`); you accept, rename or merge it, update the plan, and tell the others.
3. **Specialists at the same time.** Each writes only the entries the plan gives it, into its own piece file in `pieces/`. A piece is shaped like a pack (the same top-level kinds) plus:
   - `_pages`: `{ "captured": [...], "partly": [ { "page", "reason" } ], "skipped": [ { "page", "reason" } ] }` in printed pages;
   - `_newIds`: proposed ids `{ id, kind, name, page, why }`;
   - `_notes`: doubts, each with its page;
   - Mechanics only: `_encounterChecks`: `[ { "locationId", "encounterCheck" } ]`, merged into those locations.
4. **Merge.** Join the pieces into `<source-slug>-<version>.pack.json`: concatenate each kind, put each `_encounterChecks` entry on its location, set the image manifest as `images`, and drop the `_` keys (keep their contents for the Reviewer's doubts and your open list). The same id from two pieces is a conflict: keep the plan owner's version and note the other. Put the pieces' doubts in `meta.notes`.
5. **Check.**
   - **Adventures (until M8b's importer exists):** `py skills/content-pack-converter/scripts/check_adventure.py packs/<source-slug>/<source-slug>-<version>.pack.json --id-plan packs/<source-slug>/id-plan.json --other-pack <the required setting pack file>`. It checks the v3 JSON schema (`schema/adventure-pack-v3.schema.json`), the code prefix, links, cross-pack references, images, page references and possible leaks. Then also run `npm run pack:check -- packs/<source-slug>/<source-slug>-<version>.pack.json` for the version 1 and 2 kinds (stat blocks, items, tables, treasure types, hooks, options). Until M8b it warns that it doesn't know version 3 and leaves out the new kinds (locations, routes and so on): that's expected; everything else it says counts.
   - **Setting and homebrew:** `npm run pack:check -- packs/<source-slug>/<source-slug>-<version>.pack.json`. It prints the counts the app's import preview will show, anything left out and why, and entries the in-app editor would ask to fix. Fix and re-check until nothing is left out; explain anything the editor still asks about.
   - Save the output in `check.txt`. Send each problem back to the specialist who owns the entry (step 7), not fix it yourself, unless it's a merge slip.
6. **Off-spec list.** Walk each kind's fields and their shapes against 07 (the adventure checker lists v3 ones as `offSpec`). Record every field or shape 07 doesn't define in `meta.proposedExtensions` (as `"items[].properties"`-style paths) and say plainly: "These aren't in the spec yet: rule on them, or I'll remove them." Don't drop them silently, and don't keep them silently. **Never invent a new shape when one in the spec fits.**
7. **Review.** Start the Reviewer as a **new, fresh agent** (not a fork, no summary of the work so far). Give it only: the merged pack, the source PDF, 07, the ID plan (for its counts section, 07 §19.4), the image folder and the scripts. Nothing else: no outline, pieces, notes or your opinions. It writes `coverage-report.md`.
8. **Fixes.** Sort the report's problems by owner: a location, clue, NPC, leak or quote problem → Places; a stat block, table, item, shop or hook → Mechanics; a missing, wrong or unreadable image or crop, or missing alt text → Images; a page map or ID plan problem → you (with the Reader if needed). Send each specialist its list, re-merge, re-check, and run a **new** fresh Reviewer. **At most two review rounds.**
9. **Hand over.** Write `open-items.md`: everything still open after round two, each with its page and what the user should decide or check. Then tell the user, in a few short lines:
   - where the pack, the images folder and the coverage report are;
   - the counts per kind and the checker's result;
   - the off-spec list;
   - the open list (or "nothing open");
   - for adventures: upload the contents of `images/` to a Google Drive folder and pick that folder at import (07 §9).

## Field mapping reminders (setting and homebrew; also the v1/v2 kinds in adventures)

The specialists follow these; check them when you merge.
- Ids: lowercase letters, digits and dashes, unique per kind (`bog-lurker`, `warden-xp`; in adventures `mf-bog-lurker`). Links between entries use ids (`xpTableId`, `lightTypeId`, `statBlockId`, a spell's `lists` keyed by class id). Links to another pack use `"<meta.id>:<id>"` (`itemRef`, `classRef`, `statBlockRef`, `itemRefs`).
- Whole numbers where the format has numbers (weights, slots, costs, levels, chances). A value that is genuinely not a number ("permanent", "Instant") stays as text; don't invent one.
- Level-based numbers as formulas: `{ "formula": "6 + level", "unit": "turn" }`.
- Each entry carries `source`, its page reference (`"Book p. 196"` for setting packs; `"p. 31"`, printed pages, for adventures).
- Empty is left out rather than written as `null` or `""`.
- Setting and homebrew packs: rules in the book's exact wording where it carries the rule (ruled 2026-11-03: private packs may keep the books' wording); the copy check is information only. Which fields are book text and which are the pack's own, and how to extract and check them: PLAYBOOK §11. Adventures follow 07's "Adventure packs: content rules" (own words, as long as needed; exact quotes only where the wording is the clue).
- Anything ambiguous goes in `meta.notes` rather than a guess.

The full list is in `skills/pack-mechanics/SKILL.md`.

## Guardrails

- Only convert material the user says they own or have rights to use.
- Packs, pieces, images and coverage reports stay in the user's git-ignored `packs/` folder or are handed over as files. Never commit them, never paste their content into the repo, its tests, seeds, docs or examples; tests use invented content only.
- These skills stay copyright-clean: instructions and invented examples only.
- If asked to share a pack publicly, say that's out of scope and needs its own IP review.

## Testing this skill

- **Setting pack:** convert one section of a real source, check it with `npm run pack:check`, import it in the app (Rules library → Import a file), and check the counts in the report match the app's preview and library.
- **Adventure:** a short adventure end to end: `check_adventure.py` clean, the coverage report read with the user, and (from M8b) an import with the images folder.
- **Scripts:** `py -m unittest discover -s skills/content-pack-converter/scripts/tests` (invented text, no PyMuPDF needed).

## Review standard (ruled 2026-11-03)
Every conversion follows `docs/plans/pack-review-method.md`: read every chapter in full, check every table and per-level value by script, check each rule against the book, the pack and the app, run passes until one is clean, then have the read-only `pack-reviewer` agent re-check in a fresh session. A pack isn't handed over until that re-check is reconciled. Every review and conversion includes the options audit (method step 5): each option and choice against what it should change on every screen. Private packs keep the books' exact wording; the copy check is information only.
