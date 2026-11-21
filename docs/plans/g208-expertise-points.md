# Plan: G-208 expertise points

Written by the designer on 2026-11-20 from the ruling [`g208-expertise-points-2026-11-20.md`](../design/rulings/g208-expertise-points-2026-11-20.md) (ex-1 to ex-7), for Francis's words of 2026-11-20 in the driver's chat ("we need to model this as it's an optional rule for character creation"; "if we can build it in for dec 5 i want it"). Row: `G-208`.

**Status, 2026-11-20: ruled, every frame approved, ready to hand out.** ⚑ 1 and ⚑ 2 answered yes the same day (ex-8, ex-9): "yes to both flags, and let's start with the next free builder lane".

Pictures of record: frames X1 to X7 of `docs/design/mockups/december/29-g208-expertise-points.html` on the branch `design-g208-mockup` (on `design-tf-player-mockups`); the pictures are on `main` in `docs/design/mockups/december/png/29-X…`. **All seven approved by Francis on 2026-11-20** ("Otherwise approve"), with his one fix drawn in: the foot's Decide later, Back and Next on one line (ex-4).

Each piece follows `REVIEW.md`, the self-review and hard rules 1 to 9 (hard rule 2: every example invented; the books' figures stay in the private packs). Builder: Opus. Never route round a guard.

## The rows

| # | What it builds | Ruling | Mockup, approved | Size |
|---|---|---|---|---|
| E1 | **The format and the figures.** Read `classes[].skills.points { atStart, perLevel, base, best, name? }` from the merged class (after `byOption` and `patches`); points allowed at a level; each class skill's figure from `base` and its points toward `best` (up for x-in-6, down for equal-or-over, the skill's or class's `rollMode`), never past `best`; with `points` in force, `byLevel` is not read for those skills (`fills.ts`). `pack:check` notes (07). One pure module, `expertise.ts`, beside `weaponSkills.ts`: allowed, spent, unspent, figure, "at its best", "spent before" | ex-1 | None: data and logic only | M |
| E2 | **Where the points live, and who may change them.** One additive migration: `actors.expertise jsonb not null default '{}'` with a shape check (an object of skill codes to whole numbers ≥ 1, small) and a guard trigger copied from `guard_weapon_skills`: before approval the owner freely; after approval the owner may only **raise** values or add keys, never lower or remove; the GM any change. `editCharacter` carries `expertise`; the command checks `can()`; logged like weapon skills (no new logged command). Allowed/not-allowed cases in `permissionCases.ts`; `db:types` | ex-2 | None: data and logic only | M |
| E3 | **The Expertise step, Review's card and the foot.** The step (X1–X4) on the Creation step shell after the class, in `creationGuide` order (key `expertise`), present only while `points` is in force (ct-10: a test with the option on and off); the Stepper's **figure** variant (a variant, not a copy); Help me choose from `creationGuide.expertise.help`; Decide later to To finish; the tablet pane (as `WeaponSkillsStep`'s); the limit toasts (X2, X3); Review's Expertise card with Change (X7); the foot on one line **on every creation step**, in the shared shell (ex-4, ex-9; pictures of two other steps in the pull request) | ex-3, ex-4, ex-7, ex-9 | X1, X2, X3, X4, X7, 2026-11-20 | L |
| E4 | **After a level, the sheet and the GM.** "Expertise, N to spend" on the To finish notice while unspent, reopening the step in its after-approval form (X5: the new points named, "N points, 1 new", − on an earlier point says why, **Done** saves the visit as one `editCharacter` with Undo); the skill's pop-up's **Expertise** line (X6); the GM's **Move points** on that pop-up opening the step with − and + free | ex-5, ex-6 | X5, X6, 2026-11-20 | M |

**Batches** (one check run per batch, at most three rows): **A = E1 + E2** (logic and the migration; files `src/modules/characters/`, `supabase/`); **B = E3 + E4** (the screens; files `src/app/`, `src/ui/`). B branches from `main` after A is merged. A carries a migration, so it merges only after Francis has pushed it to the main project (CLAUDE.md, Database changes; the db-session folder's rule until 5 December).

**Pack work** (Pack Creator, private, never committed; with batch A so B can be tested on real packs): the zine overlay's `patches[]` entry on the base book's thief under its option (`die` d6, the extra skill in `names`, `points`); fae-woodland's three classes' `byOption` under their option; `creationGuide.expertise` `why` and `help` in each pack's own words; `manual: true` dropped from both options once B is live. `pack:check` on both.

## What stays as it is
- Weapon skills, their step and their rule; the creation step shell on every other step (⚑ 2 asks about the foot); the skills' rows on the Player tab and the full sheet; the skill pop-up's first line (page 26's open question 13 is not this plan's).
- M7's level-up screen is not built here: when it is, it lists "Expertise · N to spend · Choose ›" (ex-5).

## Files and tests

Paths checked against `main` (41f82cbc) on 2026-11-20.

| # | Files it will touch | Tests it must add |
|---|---|---|
| E1 | `src/modules/characters/expertise.ts` (new), `src/modules/library/fills.ts` (class skills under `points`), `src/modules/characters/play.ts` (`skillsOf` reads the filled figure; nothing else), `scripts/check-pack.mjs` (and its `pack-*.mjs` helpers), `docs/07` (written) | A skill with no points reads its base; each point moves an x-in-6 skill up and an equal-or-over skill down; no skill passes its best; points allowed grow with the level; with the option off the class's `byLevel` figures are read as before; a patch on another pack's class switches it on; `pack:check` notes a best not past the base |
| E2 | `supabase/migrations/<new>_g208_expertise.sql`, `src/modules/characters/commands.ts` (`expertise` in `editCharacter`), `src/testing/permissionCases.ts`, `src/core/database.types.ts` (`db:types`), `supabase/tests/` | The owner may raise and lower before approval; after approval the owner may raise but not lower or remove (the database refuses); the GM may lower after approval; another player may not change it; a malformed value is refused |
| E3 | `src/app/ExpertiseStep.tsx` (new, on `CreationStep`), `src/ui/` Stepper (figure variant), `src/app/GuidedCreation.tsx` (the step), `src/app/CreationReview.tsx` / `creationReview.ts` (the card), `src/modules/characters/creationGuide.ts` (`expertise` key), `docs/06` Code column, layout checks | Option on: the step is there; off: it isn't (ct-10); + past the best says why and changes nothing; + with every point spent says why; Next with points unspent says "Spend N points, or Decide later."; Decide later puts the line on To finish; Review's card lists the skills with points; layout at 375 px and tablet: Decide later, Back and Next on one line |
| E4 | `src/app/FinishCreation.tsx` / `toFinish.ts` (the line), `src/app/ExpertiseStep.tsx` (the after-approval form), `src/app/FigureSheets.tsx` (`SkillSheet`'s line), the GM's view of the pop-up, `docs/06` Code column | A level that gives points puts "Expertise, 1 to spend" on To finish; − on an earlier point says "Spent before: ask your GM to move it." and changes nothing; Done saves once with Undo; the pop-up shows "Expertise" with the points; Move points shows for the GM only |

## ⚑ for Francis (answered yes, 2026-11-20: ex-8, ex-9)
1. **An existing thief when the option goes on** (his campaign has it On today): the skills drop to the base and To finish asks for every point the level gives. Recommended: yes, as drawn. Touches E1 and E4.
2. **The foot on one line on every creation step?** Ruled for this step (ex-4). The foot is the shared shell's, so the clean fix is the shell (all steps). Recommended: yes, inside E3, with pictures of two other steps. Touches E3 only.

## Estimate and 5 December
- **Priority (Francis, 2026-11-20, after approving page 29):** "we will want to prioritizes implementing this change which impacts character creation and the player screen (including leveling up)". The driver places batch A first in the next free builder lane and batch B with the Player tab work; the order between them and the Scene rows is the driver's to set with him.
- **Batch A:** about 8–12 builder turns, plus Francis's push of the migration to the main project. **Batch B:** about 10–14 turns, plus his look at the built screens beside page 29. **Pack work:** about 2–3 Pack Creator turns. In all about 20–29 turns.
- **Fits before 5 December if** batch A starts as soon as a builder lane is free after the Scene and the Player tab rows (rvw-9: those come first) and the migration's push is not held up. The bottleneck is the migration: A cannot merge until Francis has pushed it, and B waits for A. Batch A touches no screen file, so it can run beside the Scene and Player tab batches without clashing.
- **Departures** go in each pull request's own text.
