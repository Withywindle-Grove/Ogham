# Brief for a cloud builder: the library's count line counts rules sets (lr-2a)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it**, with one exception named below. Your branch: `library-count-rules-sets`. Pull request title: "The library's count line counts a rules set (lr-2a)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

## Read
- `docs/design/rulings/dec-rules-row-and-library-count-2026-11-13.md`: the row lr-2a and its "why". `docs/design/rulings/m5b-0d-library-and-campaign-rules-2026-11-02.md`: lr-2, which stands.
- `src/modules/library/libraryList.ts` and its tests; `src/app/libraryCountLine.test.tsx`.

## The task
A pack row's count line counts every kind the pack holds, **a rules set included** ("1 rules set", "2 rules sets", after the other counts, in the line's existing form and separators). "Nothing in it yet" only when the pack truly holds nothing. The counts stay in the pack's own words where the pack gives them (lr-2: "kindreds" when the pack says so): do not change that.

As-built pictures approved by Francis, 2026-11-14: `pictures-for-approval` @ d0403312, `docs/design/pictures-for-approval/library-count-701/`.

## The exception to "existing tests: add, never edit"
This is a normal branch, not a fix branch, and it changes ruled behaviour on purpose. You **may** change the existing tests that assert the old count line, and you **must** do these two things in `src/app/libraryCountLine.test.tsx`:
- turn the `.fails` test for the rules-set count into a passing test;
- **delete** the `.fails` test about "kindreds" against "races": that was not a fault (lr-2 rules the pack's own word).

Say in the status file exactly which existing tests you changed and why.

## Fences particular to this piece
- Change only what the count line prints. No layout, no CSS, no new line, no new component.
- Update the pack row's description in `docs/06-screens-and-design.md` only if it states the counts in a way this makes untrue; do not touch its Code column.
