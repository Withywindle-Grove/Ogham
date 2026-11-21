# Plan: the GM gives a character to a player

Written by the lead on 2026-11-13 (night). Francis: "It needs to be assigned to a player - we can do this as a one-off. I can make him manually then you change the player assignment", then, told that nothing in the app does it and that nobody changes an owner by hand in the database, "Wait on give to player": he makes the character as GM and it waits for this.

## What it is for
- A character the GM made (it starts as the GM's own, already approved) is given to a player of the campaign, who then owns and plays it.
- The same action covers a player leaving and another taking the character over, and characters the GM makes ahead for players.

## What exists (the Builder's facts, 2026-11-13)
- No command, screen or button does it. "Give to…" moves items and coin only.
- A GM-made character has owner kind "gm", no owner, approval "approved".
- The database's own guard already lets the GM change a character's owner; the owner's kind and the owner must change together.
- Nothing about who may read what needs to change: a purse's read follows the owner, so the new player reads it at once; who may change the pack follows the owner; notes move with the character; the GM's own details stay the GM's.
- The log keeps, on each line, who owned the character when it was written: lines that were the old owner's alone stay hidden from the new player.

## The piece
| # | Piece | Rulings | Picture (approved) | Size | Notes |
|---|---|---|---|---|---|
| 1 | **`character.reassign`: "Give to a player…"** on the GM's view of a character: a list of the campaign's players; a tap gives the character at once, with Undo; the log says so to the GM, the new player and (when there was one) the old | gp-1 to gp-4 below | **none yet: the Design Studio's frames (brief of 2026-11-13, `docs/design/notes/brief-give-a-character-to-a-player-2026-11-13.md`), approved by Francis before the screen is built** | 3 to 5 builder hours | One add-only migration (the command's row among the logged commands). No read rule changes. A permission case for each of: the GM (yes); the owner, another player, a target who is not a player of this campaign (no) |

Until the frames are approved, the piece is built to its data, rules and tests and stops before the screen.

## Ruled by the lead (to be shown to Francis with the frames)
| Id | Ruling |
|---|---|
| gp-1 | Only the GM gives a character to a player, and only to a member of that campaign with the player's role. A player cannot give their character away, and nobody takes one. |
| gp-2 | It happens at once, with Undo (it is reversible: Undo gives it back to whoever had it). No confirm dialog. |
| gp-3 | The character stays approved. If the player has no character in play, this one becomes theirs in play; if they have one, nothing about it changes and this one joins their list. |
| gp-4 | Log lines that were the old owner's alone stay theirs: the new player does not read them (hidden means hidden). The line for the hand-over itself is read by the GM, the new owner and the old one. |

## ⚑ For Francis
1. The frames, when drawn.
2. Whether a player who is given a character should be told on their own screen (a notice, as a call to adventure is), or simply finds it in their list. The lean: a notice in their mailbox, no pop-up.

## Departures
The data half (`character.reassign`, pull request on `dec-give-character-reassign`, 2026-11-14); the screen comes after.
- **gp-6 (the lead, 2026-11-14), recorded here:** Undo gives the character back to whoever had it, whatever the receiver changed meanwhile; it moves the owner only (and the in-play marks the give set or cleared). Tested in `supabase/tests/dec-give-character-reassign.test.ts`.
- **The migration does more than the logged-command row.** "One add-only migration (the command's row)" grew two triggers, still add-only (`20261114120000_dec_give_character_reassign.sql`): the database refuses a new owner who isn't a player of the campaign (also on Undo); takes the character out of play for whoever had it; puts it in play for a new player who has none (gp-3: nothing else did it, the existing trigger only fires on approval); and moves the alignment row's copy of the owner (`character_alignments.owner_user_id`, kept only when fields change), so the alignment's reading follows the owner as the purse's does. No access rule or reading function changed.
- **Only an approved character still in the campaign** can be given (the app's rule; an archived one is restored first). Any kind of character, as the plan says "a character"; only a player character is put in play.
- **gp-4, amended by the lead (2026-11-14): the hand-over line is read by every member, not only the three.** A line about an approved character is everyone's (`private.log_audience_actors`); it stays so, and no reading function changes. The old owner's own lines stay theirs, as ruled.
- **gp-6's limit:** Undo is refused ("That's changed since. Undo the later change first.") once the receiver has switched to another character in play since the give, because the in-play mark the give set has changed. The GM can still give the character back with the command (the sheet's "You, the GM", or the other player's row).
- **The GM's own characters on the Players page (the lead's ruling, 2026-11-14).** The built page listed only players' characters; it now lists the campaign's characters that are the GM's own (player characters, not NPCs, creatures or hirelings), after the players' rows, with the same buttons and the small line "Yours" (page 13's word). After a take-back the character shows there.
- **The screen is in this pull request (second round), with these differences from page 13:** the sheet is the app's own (on a phone it rises from the bottom, not the whole screen of P2), until the redesign's panel exists; a player's "plays …" names their character in play, else their first approved one; the row's buttons on a tablet wrap as today's rows do ("Remove…" can drop to a second line).
- **The notice in the player's Messages is not built.** Messages are read from the `messages` table, with a read mark per reader and an unread count on ✉. A notice read from the log line could not be marked read, or counted, without somewhere to keep that (a new table or column), so it stops here. The player finds the character in Your characters, with "From your GM, today".

**The give follow-ups (gp-8, gp-9; pull request on `give-followups`, 2026-11-14):**
- **gp-9, the words (the lead, 2026-11-14):** when Undo would hand a character back to a player who has left the campaign, the database refuses (its owner rule fires on Undo too) and the toast says "<Player> has left the campaign, so <Name> can't go back to them." The give stays. Built in the app only (`src/core/undo.ts`), no migration.
- **gp-9, the name (the lead's Q1):** once the leaver shares no campaign with the GM, the database's rule on profiles hides their name, so the toast says "That player has left the campaign, so <Name> can't go back to them." Where the name can still be read (they share another campaign), it is used. No migration and no new access rule; the app asks for the name as any read does, and the rule decides.
- **gp-9's limit (the lead's Q2):** when the leaver had the character in play, their in-play mark left with them, so Undo is refused first with the standing words, "That's changed since. Undo the later change first.", with no second wording.
- **The alignment copy line (gp-8, confirmed by the lead):** the log line a give writes for the alignment row's copy of the owner is read by the new owner and the GM only, as built (`private.log_audience_character_alignments`); tested in `supabase/tests/dec-give-character-reassign.test.ts`, section 7.
- **The stand-in's Undo now applies the owner rule** (`src/testing/fakeDb.ts`), as the database's trigger does; before, it handed a character back to a player who had left.
- **There is no "leave the campaign" command.** A player leaves when their membership row is removed; the tests model it so.
