# Brief for a cloud session: bring one held pull request up to main (no new work)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it**, with the differences below. The message that sent you here names **one** pull request and its branch: do that one only.

Francis lifted the hold "until after the M5b gate" on 2026-11-13 (ruling mh-1, `docs/design/rulings/dec-creation-order-and-closed-patrons-2026-11-13.md`). These pull requests are finished and reviewed work that has fallen behind main. Your task is mechanical: make the branch current and green. **You build nothing new and change no behaviour.**

## What to do
1. Check out the pull request's own branch (not a new one). Read its description and its status file, so you know what it does.
2. Merge `origin/main` into it (a merge commit; never rebase, never force-push).
3. Resolve the conflicts so that **both sides survive**: everything main gained since stays exactly as main has it, and the pull request's own change is carried on top. Where the two truly cannot both stand, do not choose: stop on that file, write it down, and resolve the rest.
4. `npm ci`, then `npm run check`. Fix only what the merge broke (an import that moved, a renamed helper, a test of the pull request's own that needs main's new shape). Do not edit a test main added. Do not weaken any test.
5. One push to the pull request's branch. Add to its status file a section "Brought up to main, 2026-11-13": which files conflicted, how each was resolved in one line, what you changed beyond the merge and why, the check's result with the test count, and every question.
6. Do not label it, do not set auto-merge, do not merge it.

## Fences for all three
- No new feature, no new words, no new test beyond what the merge needs. Nothing under `supabase/`. No workflow file.
- Invented names only; the pre-commit hook scans for real ones.
- If the merge needs a judgement about behaviour, stop and write the question down.

## The three, each with what it must not disturb
| Pull request | Branch | Must not disturb |
|---|---|---|
| #486, the pack checker's rules from the gate (scripts only) | `pack-check-after-gate` | **Everything checker-related that landed on main since**: in `scripts/check-pack.mjs` and `scripts/pack-format.mjs` main now carries the procedure errors, the rule-text errors, the three ruled fields, an adventure's hooks, and possibly a creature's stat block layout, all in the one "Errors (n):" section that sets the exit code. Keep every one of them and their tests; add #486's rules beside them in the same style. List in the status file every new line #486 can make the checker print, since a private pack must not start failing by surprise. |
| #611, the spell step reads known powers | `after-gate-spell-step-known` | `src/modules/characters/magicState.ts` if it exists (another piece owns it); the spells learned above level 1 at creation and the patron's swapped spells, which landed on main since; today's row marks for a list rolled more than once. It changes a creation screen: say in the status file exactly what a player sees differently, so pictures can be taken. |
| #523, post-gate polish | `m5b-after-gate-fixes` | The standard parts that landed today (the toggle, the eye, the die glyph, sheet heads, the table's heading rule): keep main's version of every one and change none; `src/ui/organisms.tsx`, the rule rows and `words.ts` will conflict: main's structure wins, #523's polish is re-applied on it. List in the status file every visible change the pull request makes, one line each, so pictures can be taken. |

## Added the evening of 2026-11-13: five more, behind main but never held

Finished and reviewed work that has fallen behind main. The same task and the same fences as above ("Brought up to main, 2026-11-13" in each pull request's own status file). The message that sent you here names which row is yours.

| Pull request | Branch | Must not disturb, and what is particular |
|---|---|---|
| #618, the attack sheet's follow-up | `as4-followup-curses-skills` | Main's version of the standard parts and of everything in creation that landed since 10 November. It carries four gallery pictures (`tests/layout/gallery-baselines/*-at-hand-actions.png`): you cannot take pictures, so where one conflicts **take main's file** and list it in the status file as "to be re-taken from a night run". `docs/07-content-packs.md` and `docs/05`/`06`: main's text stays, the pull request's own lines are carried on top; where a line of its own now repeats what main says, drop its copy and say so. |
| #621, the words while checking for a new version | `au-followup-checking-words` | `src/ui/ToastHost.tsx`: main's toast now wraps its action under the words (tw-1); keep that exactly and carry this pull request's change on it. It changes what a person sees: list each visible change in one line, so four pictures can be taken. |
| **The encounter chain, one session, in this order** | | Three pull requests stacked on one another (each later branch contains the earlier one's commits). Do one, push it, then the next; a status-file section in each. |
| 1. #639, a table row's links across packs | `dec-5a-cross-pack-rows` | Merge `origin/main`. Main's place card, its Rules row and sheets, the standard parts and the same-named-entries source line landed since: keep all of them as main has them. |
| 2. #640, several creatures on one row | `dec-5b-several-creatures` | First merge your refreshed `dec-5a-cross-pack-rows` into it, then `origin/main`: the conflicts you settled in 1 come with it and are not settled a second time. `scripts/pack-additions.mjs`: main's checker work stays. |
| 3. #642, a creature's stat block in full | `dec-5c-stat-block-in-full` | First merge your refreshed `dec-5b-several-creatures`, then `origin/main`. Three things particular to it. **(a) The fonts**: its two font packages, its `fonts.css` imports and its `--font-book-*` tokens may by now be on main from a small pull request that lifted them out byte for byte; if so they merge as identical, and main's copy is the one that stays. They are this pull request's reviewed dependency, not a new one. **(b) `docs/07-content-packs.md`**: main already carries the stat block layout's paragraph (pf-13, pf-13a, pf-13b); take main's 07 whole and drop this pull request's own bullet about the layout. This is the one case where your merge touches 07, and only by taking main's side. **(c) Exact case** (pf-13b, `docs/design/rulings/dec-linked-spots-picks-2026-11-13.md`): the layout reader in `src/modules/library/statBlockLayout.ts` must match a layout's field name to a creature's field exactly, case included; `hp` in lower case only is the reserved name; a field spelt "HP" is an ordinary field, and hiding one never hides the other. If the reader folds case today, change it and its tests to the ruling (this one change of behaviour is asked for; say in the status file which tests you changed and add one for "HP" beside "hp"). Nothing else changes. |
