# Brief for a cloud builder: the pack checker learns three ruled fields (scripts only)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `pack-check-three-fields`. Pull request title: "pack:check knows a rule kept for the GM, a check's name and a coin's singular (pf-12d, rp-6, pf-17)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch; carry nothing over.

## Read
- `docs/design/rulings/dec-pack-formats-2026-11-11.md`: the row pf-12d. `docs/design/rulings/dec-place-rules-for-players-2026-11-13.md`: the rows rp-3 and rp-6. `docs/design/rulings/dec-purse-screens-2026-11-13.md`: the rows pf-17 and pu-6.
- `docs/07-content-packs.md`: where a place's rules, an encounter check and a rules set's currency list are described. Read only; do not edit it.
- `scripts/check-pack.mjs`, its helpers and their tests: what the checker already says about each of the three. Find out; do not assume.

## The task
`npm run pack:check -- <file>` checks three fields the app now reads. In each case, a pack that does not use the field reports exactly what it reports today.

| Field | Check |
|---|---|
| A place's rule marked `gmOnly` (pf-12d) | `gmOnly` must be true or false: anything else is an error naming the rule. A rule that is `gmOnly` **and** carries a `button` gets a warning (a button players would see for a rule they may never read). |
| An encounter check's `name` (rp-6) | If present it must be non-empty text: otherwise an error naming the check. No name is fine and silent (the app says "Encounter check"). |
| A coin's `unitName` and `pluralName` in a rules set's currency list (pf-17) | Each, if present, must be non-empty text. One given without the other is a warning. Neither is fine and silent (the app prints the coin's label as given). Two coins with the same key in one list is an error. |

Words in the checker's existing style.

## Tests (purpose first), in a new `scripts/*.test.mjs` with invented fixtures
Each row's error, warning and silent case; an existing fixture reports as before.

## Fences particular to this piece
- Scripts and their tests and fixtures only. Nothing under `src/`.
- If the pack's shape for any of the three is not what this brief assumes (for example, where a rule's `gmOnly` or a check's `name` lives), do not guess: check that field as far as the files let you, and write the question down.
