# Brief for a cloud builder: one reader for rule text set out in blocks (logic and the checker; no screen)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `rule-text-reader`. Pull request title: "Rule text in blocks: one reader, plain words, and the checker (pf-18, pf-18a)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch; carry nothing over.

## Read
- `docs/design/rulings/dec-rule-text-blocks-2026-11-13.md`: **all of it. It is the format of record and your definition of done.**
- `docs/design/rulings/dec-place-rules-for-players-2026-11-13.md`: the row rp-5.
- How rule text is read as words today: `src/modules/library/gmReference.ts` (its `words()`), `src/app/RulesBrowser.tsx`, and how the app resolves a `[[kind:id|label]]` link. Read them; change as little as you can.
- `scripts/check-pack.mjs` with its helpers and tests.

## The task
Logic, tests and the checker. **No screen**: how blocks are drawn is another piece.

1. **A typed reader** in the library module (a new file): given the value of a rule's `text`, an area's `gm.text` or a procedure step's `text`, return either the plain string, or the typed blocks, plus a list of what was left out and why. A string stays a string. An object with a `blocks` list becomes blocks. Anything else, a block with no known marker key, a block that breaks a "required" rule, a box inside a box, a list item that is not a string: left out and named, never thrown.
2. **Plain words**: one function that turns the reader's result into plain words in reading order (as pf-18a says), with link marks shown as their labels. Where `words()` and the Rules browser read one of the three fields today, make them go through it, so a pack that carries blocks shows readable words everywhere at once and never raw JSON. A pack that carries plain strings must read exactly as today (test this with an existing fixture).
3. **The links inside**: a function listing the links a text carries (kind, pack id if given, id, label), for blocks and plain strings alike, so a later piece can decide what a player may tap. Do not build any player-facing behaviour here.
4. **The checker**: one shared function validating the shape, called for the three fields wherever a pack may carry them (and from the procedure check if it is already on main; if it is not, leave a one-line note in your status file). Errors for a wrong shape; a warning for a `source` block that is not last, an empty `title`, a `tableRef` or a link that names nothing the pack carries (it may live in another attached pack: say so in the words).

## Tests (purpose first)
Every block kind read; every "left out" case; plain words for the ruling's own example; a plain string unchanged end to end; the links listed from blocks and from a plain string, in both the two-part and three-part form; each checker error and warning; an existing fixture reports as before. Invented names only (the ruling's example is already invented: use it).

## Fences particular to this piece
- No component, no CSS, no route. Do not change what any screen shows for a pack that carries plain strings.
- Do not touch `src/modules/expedition/procedure.ts`, the place panel's player view, or anything under `supabase/`.
- Do not edit `docs/07-content-packs.md`: put your proposed 07 paragraph (the table from the ruling, in 07's style) in your status file; the lead adds it with this pull request's review.
