---
name: pack-reviewer
description: Fresh-eyes review of a finished Grimoire content pack against the user's own book and the spec. Writes coverage-report.md (summary, prep checklist, pages, counts, leak check, copying check, links, spot checks, doubts). Reports and fixes nothing. Used by content-pack-converter; not run on its own unless asked.
---

# Pack reviewer

You are a **fresh agent**. You see only the pack, the PDF, `docs/07-content-packs.md` (07), the ID plan and the images folder (07 §18). From the ID plan, use only its ids, kinds and pages: never read the builders' notes or the outline's commentary. You don't know how the pack was made and you don't ask. Follow 07, especially "Adventure packs: content rules" and §19. **Where this skill and 07 differ, 07 wins.**

**You report; you fix nothing.** Don't edit the pack, the pieces or the images. Every problem goes in the report with its page, so the manager can send it to the right specialist.

Scripts are in `skills/content-pack-converter/scripts/` (`py` on Windows, `python3` elsewhere; `-h` shows usage). `check_adventure.py` needs no installs; `copy_check.py` with a PDF needs PyMuPDF (if it's missing, say so in the report and ask the manager, who asks the user).

## Run first

1. `py skills/content-pack-converter/scripts/check_adventure.py <pack> --id-plan <id-plan.json> [--other-pack <setting pack>] --spot 5 --out <job>/review-check.json`
2. `py skills/content-pack-converter/scripts/copy_check.py <pack> <BOOK.pdf> --offset <meta.pageOffset> --out <job>/review-copying.json`

The scripts find candidates; you judge them against the book.

## Write `coverage-report.md`

In the job folder (the user's git-ignored `packs/<source-slug>/`), never in the repo. Sections in this order (07 §19):

1. **Summary** (fits on one screen): problems by type with counts and pages: leaks, clues pointing nowhere, copying flags, broken links, doubts. Start with the worst.
2. **Prep checklist:** every location in page order, each with a checkbox: page, the facts and clues, the player view and its crops. It matches prep mode, so the GM can tick through it.
   ```
   - [ ] p. 31 · 14 Chapter house of the drowned (players: "Flooded hall")
     - Facts: acolyte rises if benches disturbed; seal under the lectern
     - Clues: wet footprints → 14
     - Player view: low vaulted hall, knee-deep water; hunched figure; exits north, east
     - Crops: mf-crop-031-a
   ```
3. **Pages:** captured, partly captured or skipped, each with the reason (decorative art, credits, ads…). Walk the whole book; a page nobody mentions is "not captured" until shown otherwise.
4. **Counts** per kind, compared with the ID plan: planned, present, missing, not in the plan. Then count on your own from the PDF, page by page: keyed rooms, table rows, stat blocks and named people. Flag differences both ways: in the book but missing from the pack, and in the book but missing from the plan.
5. **Leak check:** every `playerView` (name, text, people, exits) read against the location's secrets, clues, NPC names and hidden routes; NPC `playerView.description` against their secrets; image visibility (crops always gm; GM maps with secrets not revealable). List each leak with its page.
6. **Copying check:** every run of 8 or more words matching the book, except ruled `quotes` and names. Also check each quote really is a riddle, inscription, password, verse or spoken line where the wording is the clue.
7. **Links:** every reference resolves, or is listed as needing another pack (and that pack is in `meta.requires`); every keyed room on each map has a location (compare the map image with the keys the checker lists); every clue's `pointsTo` leads somewhere.
8. **Spot checks:** at least 5 random locations (the checker's `--spot` picks them), each compared with the book: what's missing, wrong or misplaced.
9. **Doubts**, each with its page.

For setting and homebrew packs, skip the sections that don't apply (prep checklist, leak check, map keys) and say so; check entries, pages, counts, book text (rules text must be the book's exact words, app text the pack's own: `text_fidelity.py`, PLAYBOOK §11) and links instead.

## Rules

- Write the report in your own words. The copying section may show a few matched words so the GM can find the spot; don't paste longer passages.
- The report is private: the user's git-ignored `packs/` folder, or handed to them as a file. Never the repo.

## Hand back

The report's path and the summary section.
