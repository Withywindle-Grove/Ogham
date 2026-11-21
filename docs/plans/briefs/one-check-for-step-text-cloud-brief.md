# Brief for a cloud builder: a procedure step's text is checked once (a small follow-up, scripts only)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `one-check-for-step-text`. Pull request title: "pack:check checks a procedure step's text once, with the shared rule-text check".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

## Why
Two pieces merged the same day each check a procedure step's `text`: the procedure check (it accepts a non-empty string or an object whose `blocks` is a non-empty list) and the shared rule-text check (the format of record, `docs/design/rulings/dec-rule-text-blocks-2026-11-13.md`, pf-18 and pf-18a: "one checker rule"). They word their findings differently and, for `{ "blocks": [] }`, at different levels. A pack maker would see one fault reported twice, two ways.

## The task
1. Find both checks in `scripts/` (the procedure check and the rule-text check) and their tests.
2. A procedure step's `text` is checked **once**, by the shared rule-text check, with its words and its levels. The procedure check keeps everything else it checks about a step (its id, its name, a `checkId`, a duplicate id) and hands `text` to the shared function.
3. Decide nothing new about the shape: where the two disagree today, the shared rule-text check and the ruling's table win. Say in the status file exactly which messages a pack would have seen before and sees now, for: a step's `text` that is a number; a bare list; `{ "blocks": [] }`; a block with no known marker key.
4. Tests: one fault in a step's `text` is reported once; each case of point 3; an existing fixture with a valid procedure reports as before.

## Fences particular to this piece
- Scripts and their tests and fixtures only. Nothing under `src/`.
- This is a normal branch: where an existing test asserts the procedure check's own wording for `text`, you may change that assertion to the shared wording; say which tests.
- The checker must not print anything new for a pack that is valid today.
