---
status: absorbed
milestone: m5b
absorbed-into: docs/06-screens-and-design.md (Components: Traits section), docs/09-decisions-log.md (2026-11-04), docs/plans/m5b-sheet.md (build order 2)
supersedes: sr-3's "rows" (`m5b-sheet-review-2026-11-04.md`): the traits are chips that wrap; the rest of sr-3 stands
---

# Traits as wrapped chips (design ruling, 2026-11-04)

Francis, from the test campaign on the iPad (2026-11-04 midday): the traits panel showed one trait per line, a tall single column wasting the panel. The sheet plan's build order 2 (sr-3) hadn't been built yet, so the shape changes before it is. Ruled with A, B, synthesis.

- **tc-1 (synthesis) Shape.** Traits are **chips that wrap**, several per row (the `Chip` component; 8 px gaps; 44 px tall; left-aligned; a chip wider than the panel takes its own row), **grouped by source** with a small heading each (Kindred or Race · Class · from options, at most three). Each chip opens its entry (ct3-11).
- **tc-2 Detail stays inside the chip** (so nothing sr-3 carried is lost): use pips as dots after the name; a drawback as the word "· drawback"; a later-level trait as "· lv N" in the quiet colour. Words, never colour alone.
- **tc-3 Fold.** After 12 chips (about three rows) the group folds with "+ N more"; tap shows all.
- **tc-4 One component** for the Player screen's traits panel and the full sheet; at 375 px the same chips wrap two to a row.
- **Cost:** none beyond order 2 (not built yet); a layout test at 375 px with a long name and 13 traits.
