# Brief for a cloud builder: dec-12 D, how Notes are grouped (logic only)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `dec-12-d-notes-grouping`. Pull request title: "dec-12 D (logic): Notes grouped by pinned and by day (mc-68)".

If you have just finished another brief in this same session: this is a new, separate piece. Start from a clean checkout of this piece's branch (bring it up to `origin/main` first); carry nothing over.

## Read
- `docs/plans/dec-12-calls-to-adventure-and-notes.md`: piece D. You build a small slice of it: **the grouping's logic only**. The Notes screen is built later by someone else, from its approved pictures.
- `docs/design/rulings/dec-mockup-rulings-sets3-5-2026-11-12.md`: the rows mc-68 and mc-68a.
- How notes are stored and read today (search for the notes table's type and the code that lists notes). Do not change it.

## The task
Pure functions with tests; no component, no screen, no command, no database.

Given the notes one person may read, which side of the switch is chosen (the party, or one character), and "today", return what the Notes list shows (mc-68):

- **Which notes belong to the chosen side**: the party's notes are those about no character; a character's are those about that character.
- A **"Pinned" group first**, holding the pinned ones, newest first. (If notes carry no pin today, take "pinned" as a field of your input type, say so, and do not add storage.)
- Then **days, newest first**: one group a day, each with its **count** always known, its notes in the order they were written.
- **Which groups start open**: today and the day before; the rest start folded. Pinned starts open.
- A kept thing and the notes written under it stay together: if the data links a note to the thing it sits under, keep them adjacent and in order; if it does not, say so in the status file and group by day only.
- A note the GM added is marked as the GM's (the screen will show "GM:"): carry that through as a flag, do not format words.
- Nothing kept at all: an empty result the screen can show as its empty state.

**Which day?** Use the day a note already carries. If notes carry an in-game day, group by it. If they carry only the time they were written, group by that time's calendar date and write the question down plainly: the lead will rule which it should be.

Tags are not in this piece (mc-68a: after 5 December).

## Tests (purpose first)
The party's side and a character's side; pinned first; days newest first with counts; today and yesterday open, older folded; a day with nine notes; a note pinned and written today appears once, under Pinned; the GM's flag carried; nothing kept; long names untouched.

## Fences particular to this piece
- Hidden means hidden: these functions only arrange what they are given. Add no read of notes, and nothing that widens who may read one.
- Do not touch the notes table, its commands or any screen.
