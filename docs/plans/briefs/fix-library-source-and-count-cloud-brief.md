# Brief for a cloud builder: two faults in the library's lines (each fixed test first)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `fix-library-source-and-count`. Pull request title: "Fix: a library entry's source line names its own pack; the count line counts rules sets and uses the setting's word".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch; carry nothing over.

## What was seen (the Tester's walk of 2026-11-13, on the live app, with several packs attached to one campaign)
1. **A library entry's source line names another setting.** In the Rules browser an entry (a class, a spell, an item) shows a line saying which pack it comes from. For some entries the line named a different attached pack, not the pack the entry is in.
2. **The count line under a pack in the library** (a) said "Nothing in it yet" for a pack whose only content is a rules set, while the attach step counted the same pack as "1 rules set"; and (b) said "kindreds" where the campaign's Setting rules page says "races" for the same kind.

## The task
For each fault, **first write a test that fails on main and shows the fault**, then fix it. A fix branch may not edit an existing test (a guard checks this): add tests only.

- Fault 1: an entry's source line always names the pack the entry itself is in. Find how the line picks its pack (search for the line's words), reproduce with two invented packs that each carry entries, and fix the choice. Related and already ruled, do not undo it: two same-named entries of one kind each show "From <pack>" (`src/modules/library/namesakes.ts`).
- Fault 2a: the count line counts a rules set like any other kind ("1 rules set"); "Nothing in it yet" only when the pack truly has nothing.
- Fault 2b: one word for a kind everywhere. The count line uses the same word the Setting rules page uses for that kind in that campaign (find where that page gets its word, and read the same source). Say in the status file which source it reads.

## If you cannot reproduce a fault
Do not guess at a fix. Write what you tried, with the fixtures, in the status file, fix the faults you could reproduce, and say plainly which one is left.

## Fences particular to this piece
- These are existing screens: change only which words the lines print. No layout, no CSS, no new line, no new component.
- Do not touch creation's steps or the sheet.
