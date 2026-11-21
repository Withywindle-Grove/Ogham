---
status: absorbed
milestone: post-gate (G-208)
absorbed-into: docs/04-data-model.md (PC extras: expertise), docs/05-features.md (Guided creation revisited: expertise points), docs/06-screens-and-design.md (Components: Expertise step, Stepper's figure variant, Skills block, To finish card), docs/07-content-packs.md (Point-buy skills), docs/09-decisions-log.md (2026-11-20), docs/11-modelling-gaps.md (G-66, G-208), docs/plans/g208-expertise-points.md
supersedes: the format of G-66 in 07 (`skills: { mode: "points", pool, cap }`, 2026-11-01) and G-208's proposed `byOption` shape (2026-11-08)
---

# G-208: expertise points (design sitting, 2026-11-20)

Francis, 2026-11-20, in the driver's chat: "we need to model this as it's an optional rule for character creation", then "start the design sitting for G-208 now, if we can build it in for dec 5 i want it". The option is the zine overlay's "thief skills on a d6 with expertise points", run by hand today and On in his campaign. Ruled so far: `../notes/g208-expertise-ruled-so-far-2026-11-20.md`. Mockup: `../mockups/december/29-g208-expertise-points.html` on branch `design-g208-mockup`, its pictures `../mockups/december/png/29-*.png` (approved 2026-11-20). Every example below is invented.

## Rulings

| # | Ruling | Francis's words |
|---|---|---|
| ex-1 | **One format for both books, and fae-woodland's three classes now.** A class's `skills` gains `points: { atStart, perLevel, base, best, name? }`; the option switches it on through the class's `byOption` (fae-woodland) or a `patches[]` entry on the base book's class (the zine overlay); a skill moves one step per point, **the direction from the skill's `rollMode`** (x-in-6: up; equal-or-over: down), never a second setting. Supersedes G-66's `mode`, `pool`, `cap` and G-208's `byOption`-with-`max` proposal. | "Yes, both now" |
| ex-2 | **Spending follows the weapon skills rule** (m5b-0 §2): before approval the owner moves points freely; after approval the owner only **adds** unspent points (logged, Undo); moving a point already spent is the GM's (fiat, logged). The add-only rule is held by the database, as weapon skills' is. | "yes, same rule, and make sure what we build fits our design and formatting standards" |
| ex-3 | **The Expertise step** (frames X1–X4): on the creation step shell, after the class, in the pack's `creationGuide` order (key `expertise`); one line ("Each point makes one skill better."), Help me choose, a heading "Spend N points" with its count ("2 of 3 spent"), one muted line with the die's glyph ("Every skill starts at 1-in-6; at best 4-in-6."), then one card per class skill: the name (a tap opens the skill's words), under it the points on it at the left and **− and +** with the skill's figure between them in the pack's style at the right; a card with points is on the wash with the edge. Every limit is a tap that says why ("Work locks is at its best: 4-in-6.", "All 3 points spent: take one back first.", Next: "Spend 3 points, or Decide later."). Tablet: the list at the left, the skill's words in a pane at the right (as Weapon skills, E7). Present only while the option is on (ct-10). | "Otherwise approve" (page 29) |
| ex-4 | **The foot on one line** (his fix to page 29): what is left on its own line, then Decide later, Back and Next on one line. | "these buttons have room to be on the same line, the way they are staggered is ugly" |
| ex-5 | **After a level** (X5), while M7's level-up screen is unbuilt: "Expertise, N to spend" on the To finish notice opens the same step; the heading names the new points ("1 new point, for level 2"); a card says which points are new ("2 points, 1 new"); − on a point spent before says "Spent before: ask your GM to move it."; **Done** saves the visit as one logged change with Undo. When M7's level-up screen is built it lists "Expertise · N to spend · Choose ›" beside Learn a spell. | approved with page 29 |
| ex-6 | **The sheet** (X6): the skills' rows are unchanged (only the figures move); the skill's pop-up (page 26, M2c) gains one labelled line, **Expertise**, "2 points. Every skill starts at 1-in-6; at best 4-in-6", before the source. The GM's view of that pop-up adds a plain **Move points** beside Got it, opening the step with − and + free (logged as the GM's). Points are not hidden data. | approved with page 29 |
| ex-8 | **An existing character when the option goes on:** the class skills drop to the base and To finish asks for every point the level gives (⚑ 1). | "yes to both flags" |
| ex-9 | **The foot on one line on every creation step** (⚑ 2): the shared creation step shell's foot, not only Expertise's: what is left on its own line, then Decide later, Back and Next on one line; built in E3 with pictures of two other steps. | "yes to both flags" |
| ex-7 | **Review** (X7): one Expertise card with Change; with Decide later it says what waits ("Decided later: 3 points to spend, on the To finish list"). The GM's approval reads the same card. | approved with page 29 |

## Technical (the designer's, inside the rulings above)
- **Data:** `actors.expertise`, `{ "<skill code>": <whole number ≥ 1> }` (a skill with no points has no key), next to `weapon_skills`; a new additive column with a guard trigger (owner add-only after approval; the GM any change). The number allowed, `atStart + perLevel × (level − 1)`, and each skill's ceiling (`best`) are the app's to work out and say, as for weapon skills; the database keeps the shape and the add-only rule. **One migration, additive: drops and changes no data.**
- **Fills:** with `points` in force, `skills.<code>` for each class skill is `base` moved by the points toward `best` (never past it); the class's `byLevel` row is not read for those skills.
- **Name:** the step's title and the sheet's line use `points.name` (the pack's word, e.g. "Expertise"), else "Skill points".
- **An existing character when the option is switched on** (the option's `changeLater: "warn"` already warns the GM): their class skills read `base` with no points, and the To finish notice asks for every point their level gives. ⚑ 1.

## ⚑ for Francis (both answered 2026-11-20: "yes to both flags, and let's start with the next free builder lane")
1. **An existing thief when the option goes on** (his campaign has it On today): the skills drop to the base and the To finish notice asks for all the points the level gives; the player (or the GM) spends them. Recommended: yes, as drawn.
2. **The foot on one line on every creation step?** ex-4 is ruled for the Expertise step. The foot is the shared creation step shell's, and the built foot can stagger the same way, so the fix belongs to the shell (all steps). Recommended: yes, in this batch's pull request, with pictures of two other steps.

## Docs to update
04 PC extras (expertise), 05 Guided creation (expertise points), 06 Components (Expertise step; the Stepper's figure variant; Skills block; To finish card), 07 Point-buy skills, 09 (2026-11-20), 11 G-66 and G-208, the plan `docs/plans/g208-expertise-points.md`. Pack work (Pack Creator, private): the zine overlay's patch on the base book's thief and fae-woodland's three classes under their option, `manual` dropped once built.

## 09 lines
- 2026-11-20 — [packs] Expertise points (G-208, G-66): one format for both books, `classes[].skills.points { atStart, perLevel, base, best, name? }` under the option, the direction from the skill's `rollMode`; fae-woodland's three classes come in now — Francis, "Yes, both now".
- 2026-11-20 — [ui] Every creation step's foot: what is left on its own line, then Decide later, Back and Next on one line (ex-9); an existing character takes the base and spends all its points when the expertise option goes on (ex-8) — Francis, "yes to both flags".
- 2026-11-20 — [characters] Expertise points are spent like weapon skills: an Expertise step at creation and "Expertise, N to spend" on To finish after a level; before approval free, after it the owner only adds and the GM moves points; the skill's pop-up gains an Expertise line and the GM's view Move points; mockup page 29 approved with the foot on one line — Francis, 2026-11-20.
