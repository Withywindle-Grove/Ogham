# Brief for a cloud builder: dec-9 C, the pack checker reads a `procedure` (scripts only)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `dec-9-c-procedure-check`. Pull request title: "dec-9 C (checker): pack:check reads a procedure on a place and on the rules set (pf-14, pf-14a)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch; carry nothing over from the last one.

## Read
- `docs/plans/dec-9-the-strip-and-next-turn.md`: piece C. You build a small slice of it: **the checker's rules only**. The strip itself, and the code that picks which procedure is in force, are built later by someone else.
- `docs/design/rulings/dec-mockup-rulings-set2-2026-11-12.md`: the rows pf-14 and pf-12c. `docs/design/rulings/dec-mockup-rulings-sets3-5-2026-11-12.md`: the row pf-14a. For "the rt-1 block shape", find rt-1 in `docs/design/rulings/` and in `docs/07-content-packs.md`.
- `scripts/check-pack.mjs` and its helpers and tests: what it already says about an exploration mode's `procedure`, if anything. Find out; do not assume.

## The task
`npm run pack:check -- <file>` checks a `procedure` wherever the format allows one: on an exploration mode (as today, if it does), **on a place** (a region or a location) and **on the rules set** as its default.

| Case | Result |
|---|---|
| No procedure anywhere | Fine and silent |
| A `procedure` that is not a list of steps `{ id, name, icon?, kind?, checkId?, text? }` | Error, saying where |
| A step with no `id` or no `name`, or two steps of one procedure with the same `id` | Error |
| A step's `text` that is not the rt-1 block shape | Error, saying which step |
| A step's `checkId` that names no check the pack carries | Warning (it may live in another attached pack: say so in the words) |
| A step's `icon` | No check here: an unknown icon name falls back in the app (pf-12c). Do not warn |
| A `procedure` on a kind of entry that is not a mode, a place or the rules set | Warning, naming the entry |

Words in the checker's existing style. A pack with no procedure, and a pack whose modes already carry valid procedures, report exactly what they report today.

## Tests (purpose first), in a new `scripts/*.test.mjs` with invented fixtures
Each row of the table; a valid procedure on a place and one on the rules set pass silently; an existing fixture with a mode's procedure reports as before.

## Fences particular to this piece
- Scripts and their tests and fixtures only. Nothing under `src/`: in particular do not touch `src/modules/expedition/procedure.ts` (another piece is changing it).
- Step names in fixtures are invented or the app's own five (Describe, Question, Act, Test, Resolve); no book's words.
