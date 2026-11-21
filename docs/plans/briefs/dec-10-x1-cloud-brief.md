# Brief for a cloud builder: dec-10 X1 (experience at a higher starting level)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `dec-10-x1-starting-experience`. Pull request title: "dec-10 X1: a character made above level 1 starts with its level's minimum experience (cs-13)".

## Read
- `docs/plans/dec-10-creation-sweep.md`: the row **X1** in the pieces table, and the paragraph on the class's level table that ends "here and in X1". Build X1 only; nothing else in that plan.
- `docs/design/rulings/dec-creation-sweep-2026-11-12.md`: the row cs-13.
- The code that makes a character at the campaign's starting level and the code that reads a class's experience table. Find them by searching; do not guess paths.

## The task
**cs-13: a character made above level 1 starts with the minimum experience its class needs for that level.** Logic and tests only; no screen.

- Level 1: experience as today.
- Level 2 or higher: the class's own threshold for that level.
- A class reads **its own** experience table, by its own table id **within its own pack's place in the campaign's stack**, never through a map merged across packs. Two attached packs may each carry a class of the same name whose tables differ in length: test that each gets its own figure (invented fixtures).
- A class with no experience table: no experience is invented; keep what happens today and say what that is in the status file.
- "Two tracks" in the plan's row: if the code has a notion of a class or character with more than one experience track, test it (each track gets its own minimum). If the code has no such notion, do not invent one: write the question down and build the rest.

## Fences particular to this piece
- **Characters already made above level 1 are not changed**: no backfill, no migration, no command that rewrites existing characters.
- If experience at creation cannot be set without a database change, stop that part and write the question down.
- Do not touch the creation screens' layout or words.
