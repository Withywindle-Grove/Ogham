# Manual checks: dec-1a-patrons (the cleric's Patron step)

Rewritten for the rework of 2026-11-12 (pt-9, pt-10, Francis's rulings): the Patron step is its own step after Class, the review names the patron in its first card, a patron switched off by its option is hidden and kept, and the sheet shows the patron's whole ladder.

**Before anything:** the migration `20261111130000_dec_1a_patrons.sql` must be applied on the project the preview uses (it is, on both, per the brief of 2026-11-12). Without it a pack with `patrons` cannot be imported.

You need: a campaign with the classic rules attached (its cleric), and the port pack with its patrons attached above it, at start level 2. As the GM, open the campaign's Rules and switch the port pack's patron option **on**.

**The step**
1. [ ] **Option off.** Switch the patron option off. As a player, start a guided character and pick the cleric. You go straight on (Adjust scores, or Who they are): no Patron step, no empty page, nothing about patrons. Note the count on Who they are ("Step N of M").
2. [ ] **Option on.** Switch it on and do the same. Picking the cleric opens a step titled **Patron** with "Your patron sets or narrows your alignment." under the count. Who they are is now one step later, of one more ("Step N+1 of M+1").
3. [ ] **Its rows.** One row per patron, each with ⓘ, its name, its one line and who may follow ("Reed or Lantern followers"), and **Pick**. The patron that needs the GM sits under a fold, "1 more needs the GM's approval" with +. The foot says "No patron yet".
4. [ ] **Not for other classes.** Start a fighter: no Patron step.
5. [ ] **A pick.** Tap Pick on a patron. The row reads **Picked ✓** on the wash, a toast "<name> picked" offers **Undo**, the foot says "<name> picked", and you stay on the step. Tap Undo: the pick goes.
6. [ ] **Next without a patron.** With none picked, tap **Next**. A pop-up **Pick a patron first** says "A Cleric follows a patron. Pick one to go on, or go back and choose another class." Tap **Choose a patron**: it closes and you stay. Tap Next again, then **Back to class**: the Class step opens.
7. [ ] **The GM's patron.** Open the fold and pick the patron that needs approval. Its row carries the warning sign and "Needs the GM's special approval"; the fold stays open while it is the pick; the foot says "<name> picked. Your GM decides on the review".
8. [ ] **Reading one.** Tap a row's ⓘ. The entry opens as #636 built it (its line, the description, then depiction, who follows, holy symbol, garb by tier, strictures, prayer, spells, marks, realm), with **Pick <name>** at the foot. You should not see its cult as a player.
9. [ ] **Class changed.** Pick a patron, go back to Class and pick another class. A toast says "Class changed. Your patron was cleared." with **Undo**. Tap Undo: the old class and the patron are back.
10. [ ] **Who they are.** Pick a patron whose followers have one alignment and go on. On Who they are the alignment group shows only that row, already picked, with a line saying why; Affiliation (on the sheet) holds the patron's name. With a patron of two alignments only those two rows stay.

**Decide later and the review**
11. [ ] **Decide later.** On the Patron step tap **Decide later**: you go on. At the review the first card reads **Kindred, class and patron** with "Patron: Not picked yet" (to finish). Tap **Send to the GM**: a toast says "Choose a patron first: a cleric needs one before your GM can approve." and the Patron step opens. Pick one and tap Next: you are back on the review, and Send now goes.
12. [ ] **The review's line.** With a patron picked, the first card is **Kindred, class and patron**: Kindred, Class, then "Patron: <name>", each with its own **Change**. "Who they are" no longer names the patron. Tap the patron's Change: the Patron step opens; Back to review returns. Pick another patron there and tap Next: back on the review with the new name, and a toast saying what it changed.
13. [ ] **No patron.** A fighter's review: the first card is "Kindred and class", no patron line.
14. [ ] **The GM's card.** Send a character with the GM's patron: the review's last card lists the patron with the pack's note; the GM's card shows it under the exceptions with **Allow it**.

**Gear, spells and the sheet**
15. [ ] **Garb.** On the Gear step, a group **From <patron>** lists the garb of tiers 0 and 1 (a level-2 cleric casts level-1 spells). Both items are in the Pack, at no cost, as the **player**.
16. [ ] **The sheet.** After approval, open the full character sheet. The **Patron** section's heading has the patron's name beside it, in the heading's style, not underlined, with a small ⓘ after it; tap it: the entry opens. Under it: "**Holy symbol:** …", "**Prayer:** …", "**Strictures:** …", then **Holy garb** (a bulleted list, one line per tier: "**At creation:** … (reached)", "**From level-3 spells:** … (to come)"), **Alternative spells** (each swap, reached or to come) and **Marks** (a bulleted list, each opening with its tier in bold, reached or to come). There is no row labelled "Patron".
17. [ ] **Preparing spells.** On the Player screen, tap **Prepare spells**. At level 1 the patron's spell is listed in place of the one it replaces, marked ", from <patron>".
18. [ ] **Option off, hide and keep.** As the GM switch the patron option off. The cleric's sheet has no Patron section (and no "pack not attached"); the GM's card and the review show no patron; the garb stays in the Pack. Switch it on again: the patron is back everywhere, as before.
19. [ ] **A pack not attached.** (GM, optional.) Detach the port pack: the sheet names the patron "<name> (pack not attached)". Attach it again.
20. [ ] **Same-named patrons.** (Only if two attached packs carry a patron of the same name.) Each row shows the pack after the name ("<name>, <pack's name>").

## Gallery pictures

A new gallery section, **The patron: its creation step and the sheet's section** (`src/gallery/PatronSpecimens.tsx`), placed last so no other section's picture moves. Its pictures are new (no baseline yet); CI draws them and they go to Design:
- **Patron step as it opens** (14-01): new.
- **Full sheet, the Patron section**: new (Francis, 2026-11-12: the name beside the heading, plain with a small ⓘ, his pick of the two treatments; the book's ladder, the garb and the marks one line per tier, reached or to come). The underlined treatment's specimen is gone.

No existing picture should change: the step reuses the Pick row, the approval fold, the step shell and the pop-up as they are; the sheet section adds `labelAction` to `SheetSection`, which no other section passes.
