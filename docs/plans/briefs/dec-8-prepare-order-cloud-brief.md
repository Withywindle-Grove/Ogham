# Cloud brief: Prepare's list in order, in the view-model (logic only)

First read `docs/plans/briefs/README.md`. Then read this whole brief. If anything is unclear, stop and say so in the pull request; don't guess.

Written by the lead on 2026-11-14. Branch: `dec-8-prepare-order` (pushed empty from main). **Start only once pull request #743 has merged**: this changes the file it adds. One pull request, logic and tests only: no screen, no component, no CSS, no migration.

## The objective
The Prepare screen must not sort or fold anything itself. `prepareView` (`src/modules/characters/magicView.ts`) returns each level's spells already in the order the screen shows them.

## Read
- `docs/plans/dec-8-magic-first-cut.md`: piece C, and "Answers to the view-models' questions", answers 1 and 3.
- The ruling mp-1 (find it by its id in `docs/09-decisions-log.md` and the magic rulings under `docs/design/rulings/`): a caster who keeps a spell book chooses from the book; a caster who chooses from the whole class list sees "chosen first, the rest folded".
- `magicView.ts` and its tests as merged, and how the caller tells the two kinds of caster apart today (the function takes `candidates` per level: read where they come from in `playState.ts`).

## What to build
1. `prepareView` returns, for each level, its steppers in this order: the spells with a count above nought first, in the order they were chosen; then the rest, in the order the candidates were given.
2. For a caster who chooses from the whole class list, each stepper of "the rest" carries a mark that it belongs under the fold, and the level says how many are folded. For a caster with a spell book nothing is folded. How the function learns which kind of caster it is: follow what the caller already knows; if it cannot be known from what is passed today, add one plain argument and say so in the status file.
3. Nothing else about `prepareView` changes: the counts, `mayAdd`, `mayRemove`, `fullLevels`, `sameAsYesterday` and the rest stay as merged, and every existing test still passes untouched.

## Rules
- Invented spell and class names only. No real game, book or adventure names, no numbers from a book.
- No words for the screen are added here (no "Show N more"): the screen's words come with piece C.
- No new dependency.

## Tests (write each test's purpose as a plain sentence first)
- A caster who chooses from the whole list: the chosen spells come first in the order chosen, the rest follow in the list's order and are marked as folded, and the level counts them.
- A caster with a spell book: the same order, nothing folded.
- Nothing chosen: every spell is in the list's order; for the whole-list caster all are folded and the count says so.
- Choosing one more of a folded spell moves it among the chosen on the next read.
- Messy data: a chosen spell that is no longer among the candidates stays in the chosen part by its id.

## Output
One pull request with its status file `docs/status/<date>-dec-8-prepare-order.md` and `docs/testing/dec-8-prepare-order.md`. Do not merge. A cloud session other than you reviews it (rv-3). One push when finished.
