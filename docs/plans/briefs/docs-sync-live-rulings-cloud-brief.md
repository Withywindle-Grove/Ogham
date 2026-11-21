# Brief for a cloud session: bring 05 and 06 in line with what went live on 12 and 13 November (docs only)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md`** (its fences and its "if unsure, stop" apply; its lines about tests and `npm run check` do not: this piece is docs only, and the check to run is `npm run docs:check`). Then read `docs/CLAUDE.md` and `.claude/agents/docs-sync.md`. Your branch: `docs-sync-live-rulings-2026-11-13`. Pull request title: "Docs: 05 and 06 say what went live on 12 and 13 November".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch; carry nothing over.

## The task
Specs say what is true now. These rulings are **built and live**; check, id by id, whether `docs/05-features.md` and `docs/06-screens-and-design.md` already say them, and add only what is missing, in the section where that screen or feature already lives, in the specs' own short style.

| Ruling file (in `docs/design/rulings/`) | Ids |
|---|---|
| `dec-night-and-morning-2026-11-13.md` | tw-1 (a toast's action drops under its message); cp-1's closed row and fold **as built** (not its five fixes, which are not built yet); tp-1 to tp-5 (a row taken more than once); mv-1 (movement in whole numbers) |
| `dec-pack-and-rules-sweeps-2026-11-13.md` | wk-1 to wk-4 (what the creation walk found), pf-16 (a list rolled more than once) |
| `dec-patrons-2026-11-12.md` and `m5b-patrons-2026-11-07.md` | the Patron step as built (read the code's behaviour from `src/modules/characters/patrons.ts` and the step's tests before writing; write only what both the ruling and the code agree on) |

For each id, your status file says one of: "already in 05/06 at <section>", "added to <section>", or "not added: <why>" (for example the ruling and the code disagree: then stop on that id and write the question down).

## Fences particular to this piece
- Edit **only** `docs/05-features.md` and `docs/06-screens-and-design.md`, plus your status file. Do not edit `docs/07-content-packs.md`, `docs/09-decisions-log.md`, any ruling, any plan, or anything outside `docs/`.
- In 06, do not touch the components inventory's Code column (builders keep it), and do not add or rename a token.
- Do not mark any ruling "absorbed" and do not change any ruling's header: the lead does that after reading your pull request.
- Do not write into the specs anything that is ruled but not built (the Pack and Rules sweeps, the purse's screens, the place of linked spots, magic): if in doubt whether something is live, leave it out and list it under "not added".
- One home for each fact: link, don't repeat. No real game, book or adventure names.
- Run `npm run docs:check` and fix what it names.
