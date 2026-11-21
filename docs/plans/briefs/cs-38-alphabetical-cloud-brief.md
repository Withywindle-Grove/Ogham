# Brief for a cloud builder: creation lists kindreds and classes alphabetically (cs-38)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `cs-38-alphabetical`. Pull request title: "Creation: kindreds and classes in alphabetical order (cs-38)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

**Francis asked for this today, from the live app: the two same-named kindreds from different packs sit far apart in the list, and it confuses.**

## Read
- `docs/design/rulings/dec-creation-order-and-closed-patrons-2026-11-13.md`: the section cs-38. It is your definition of done.
- How creation's Kindred step and Class step build and order their rows today (`src/app/GuidedCreation.tsx` and what it calls; `src/modules/library/namesakes.ts` for the "From <pack>" line). Find where the order comes from before changing anything.

## The task
1. **A test that fails on main first**: two attached packs, each with a kindred of the same name and others around them; on main the two same-named rows are not adjacent. The same for classes. Invented packs and names.
2. Then the rule: on the Kindred step and the Class step the open rows are in alphabetical order by the name shown, ignoring capitals, whatever pack each comes from; a name with a bracket sorts by its whole text; two of the same name sit together, the campaign's stack order deciding between them.
3. A row that is closed to this character stays where the step puts closed rows today; within that place, alphabetical.
4. Nothing else moves: the other steps, the review, the sheet and the Rules browser keep their order. Test that one other list is unchanged.

## A piece in flight next to yours
Another builder is changing how the "From <pack>" line is decided (`sn-1b`, branch `sn-1b-pinned-source`, in `namesakes.ts` and the same rows). Keep your change to the ORDER only and in as few lines as you can, so the two merge cleanly; do not touch how the line itself is chosen.

## Fences particular to this piece
- Order only: no change to a row's words, its line, its layout or its CSS.
- A normal branch: where an existing test asserts the old order as such, you may change that assertion; say which tests, and why, in the status file.
- If the order turns out to come from the pack's own listing and something else depends on it (the roll tables, "Help me choose", a kindred-class pairing), do not break that: sort only what the two steps show, and write down what you found.
