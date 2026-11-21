# Brief for the Design Studio: the GM gives a character to a player

Written by the lead on 2026-11-13 (night). You are a worker: mockups and a proposal note only; you report to the lead, never ask Francis for a ruling, never edit rulings, 09 or specs. If unsure, stop and ask the lead; don't guess.

## The objective
A small set of frames for one new action: the GM gives a character to a player of the campaign. Plan and rulings: `docs/plans/dec-give-a-character-to-a-player.md` (gp-1 to gp-4). Francis is making a character as GM tonight that waits for this, so it is the next thing in your queue; it is small.

## Frames
1. **Where the action lives**, on the GM's view of a character: one row or button, "Give to a player…". Propose its place (the GM's card for a character on the Players page; the sheet's own menu), in the place the GM already looks for who plays whom. Not an accent.
2. **The sheet it opens**: "Give to a player", the character's name in the small line, the campaign's players as option rows (56 px), each with the player's name and, in the muted line, the character they have in play now ("plays Wren" or "no character yet"). A tap gives the character at once (gp-2). The current owner, if a player, is marked and not offered.
3. **After**: the Undo toast, and the GM's card now naming the player. Words: yours, in the app's voice (short, no explainer); the log line too ("Your GM gave Ash to Sam." as a start).
4. **The player's side**: what the receiving player sees (the lean: a notice in their mailbox and the character in their list; no pop-up). One frame.
5. **States**: no players in the campaign yet (what the sheet says, and where the GM goes to invite one); one player; twelve players with long names; a very long character name; the phone.

## Format
One HTML page in `docs/design/mockups/december/` on `design-december-mockups` (suggest `13-give-a-character-to-a-player.html`), light and dark side by side, buttons as plain blocks, tokens from `docs/06` only, existing parts (the option row, the sheet head with its X and no Close, the Undo toast with its action wrapping under on a phone). PNGs with index rows. A short note in `docs/design/notes/` with your picks, what you checked (the uiux self-review) and what you could not.

## Boundaries
- Only the GM gives; only to a player of this campaign; at once with Undo; the character stays approved (gp-1 to gp-3). Draw nothing that implies a player can give a character away, or a confirm dialog.
- No new behaviour beyond the plan. Anything you must invent is marked ⚑ for the lead.
- Read today's GM Players page and a character's card from the built pictures or the source in your worktree; take the words from what is built.
- When done, tell the lead the page's path, the commit, and the things you are least sure of.
