# Brief: the rulings catch-up, a sample of ten (row: rulings-catch-up)

Never route round a guard: if a command, hook or permission is refused, stop and report it; do not try another way.

**For:** one `docs-sync` worker (Sonnet), started by the driver. Docs only. Opens no new screen, so it may use a spare seat under rvw-10's exception.
**Asked by:** Francis, 2026-11-17, at the end of the look-back sitting: "In the past some of these design notes were missed."

## Why

Of 151 ruling files in `docs/design/rulings/`, 89 say `status: pending`. The independent review counted 87 two days earlier. Two rulings were found unwritten on 17 November: bu-1 (ruled 14 November, missing from hard rule 4 for three days) and pk-13's seen mark (built, with no line in `03` or `04`). Nobody knows how many of the 89 are truly unwritten and how many were written and never re-marked. This sample is to find out, before the whole pass is sized.

## The ten files

Oldest first, because their work is built and merged, so "pending" there is most likely a miss:

1. `m4b-retest-rulings-2026-10-28.md`
2. `fight-dry-run-2026-10-29.md`
3. `m5-gate-rulings-2026-11-01.md`
4. `m7-downtime-2026-11-02.md`
5. `hedge-audit-2026-11-04.md`
6. `m5b-small-questions-2026-11-04.md`
7. `m5b-item-tables-2026-11-04.md`
8. `m6-named-sides-2026-11-05.md`
9. `m5c-magic-in-play-2026-11-05.md`
10. `dec-pack-town-players-2026-11-14.md` (a recent one, for contrast: bu-1 came from it)

## For each ruling in each file

Read the ruling's row, then look for it in the place it belongs (`03` to `08`, the plan it names, the root `CLAUDE.md` for a hard rule) and for its line in `09`. Put it in one of four piles:

| Pile | Meaning | What you do |
|---|---|---|
| A | Written in the specs and in `09` already | Nothing to the specs |
| B | Built or in force, and missing from the specs or `09` | Write the missing line in its one home, short, with the ruling's id and date |
| C | Not built yet, and its file says the spec waits for the pull request | Leave it; this is a fair "pending" |
| D | The specs, the code or a later ruling say something different | Change nothing; list it for Francis |

To tell B from C, check `origin/main`: is the thing there? Read code only as far as that question needs.

When every ruling in a file is in pile A or B, set its header to `status: absorbed` and fill `absorbed-into`. A file with any C or D stays `pending`.

## Limits

- Never change a ruling's content: only the header's `status` and `absorbed-into`.
- Do not edit the root `CLAUDE.md`. A hard rule or process rule that is missing there goes in pile D, for Francis's own yes.
- Do not edit `src/`, `supabase/` or `docs/generated/`. No database commands.
- Aliases and invented examples only (`docs/CLAUDE.md`).
- Stop at ten files. Do not start the other 79.

## Done looks like

- One branch, `docs-rulings-catch-up-sample`, one push, one docs pull request; `npm run docs:check` passes.
- In the pull request's text, one table: file | rulings | A | B | C | D | now absorbed (yes/no). Then one line per D, with the ruling's id and the two things that disagree.
- One short report to the driver: the table's totals; how long the ten took; and from that, an honest size for the remaining 79 (in turns), saying which kinds of file were slow.
- Say what you could not check.

## Not in this brief

- A check in `docs:check` that fails an old pending ruling, and one home for "after 5 December" items. Both are new rules; Francis ruled none before 5 December (rvw-16), so they wait for his word.
- The sitting to replace hard rule 4's list with a principle (`10`).
