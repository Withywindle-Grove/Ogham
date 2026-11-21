# Brief for a cloud builder: dec-7 piece 4, the GM's queue of proposed ways (a reducer only)

Written by the lead on 2026-11-13. **First read `docs/plans/briefs/README.md` and follow it.** Your branch: `dec-7-4-proposal-queue`. Pull request title: "dec-7 piece 4 (logic): the GM's queue of proposed ways, first in, first out".

## Read
- `docs/plans/dec-7-linked-spots-screens.md`: piece 4 in the table and the "Notes of 2026-11-13". You build a small slice of piece 4: **the queue's logic only**. The sheet, the rows and the buttons are built later by someone else.
- `docs/design/rulings/dec-mockup-rulings-2026-11-12.md`: the rows mc-42 and mc-42a. `docs/design/rulings/dec-linked-spots-picks-2026-11-13.md`: the row dp-4.
- How the app holds a player's request to the GM today (the requests module), only to name things the same way. Do not change it.

## The task
A pure reducer (state and events in, state out) with tests, in a new file beside the expedition code; no component, no screen, no command, no database, no timers.

What it models: players propose a way to move on; each proposal reaches the GM as a sheet that **opens by itself**; several waiting are **counted** ("1 of 3") and worked **first in, first out**.

- A proposal arrives and nothing is open: it becomes the open one.
- A proposal arrives while a proposal's sheet is open: it joins the end of the queue; the open one is **not displaced**; the count updates.
- A proposal arrives while **some other sheet** is open (the reducer is told so): it joins the queue and waits; it opens when the reducer is told that sheet has closed.
- The GM answers the open one (Yes or No): it leaves; the next in line becomes the open one.
- **Not now** on the open one: it stops being open and stays as a **waiting row** (kept, in arrival order, not opened again by itself); the next in line that has not been put off becomes the open one.
- The GM taps a waiting row: it becomes the open one.
- A proposal is withdrawn by its player, or replaced because the same group proposed again (one proposal a group at a time; a new one replaces the last): the old one leaves wherever it is; if it was the open one, the next in line becomes the open one.
- The count is "the open one's place of all not yet answered" (put-off ones included in the total); say in the status file exactly how you counted, with an example.

## Tests (purpose first)
Each bullet above as a test, plus: three arrive in order and are answered in that order; an answer for a proposal that has already left changes nothing; the same event twice changes nothing the second time; an empty queue has nothing open and no count.

## Fences particular to this piece
- Do not touch `src/modules/expedition/procedure.ts` (another piece is changing it) or the requests module.
- Nothing about an obstacle's note, extra time or chance belongs in this state: the queue holds only what identifies a proposal and its order.
- If a rule above cannot be decided from the files, write the question down and build the rest.
