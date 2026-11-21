# Manual checks: dec-12-b-calls-to-adventure

These need the three migrations on the project the preview uses: `20261113210000_dec_12b_calls_to_adventure.sql` and `20261113220000_dec_12b_send_hook_refusals.sql` and `20261113230000_dec_12b_send_hook_same_words.sql` (all three live on TEST and main; the last at 00:13 UTC on 2026-11-14).

1. As the GM, import an adventure pack with two or more `adventureHooks` (an invented one is fine: each `{ id, name, text, pays, giverNpcId? }`, and an `npcs` entry with a `locationId` for one of them) and attach it to a campaign. Start an expedition and set a place. **You should see:** on the place's card, under its name, a line "Calls to adventure" with "0 of N sent" at the right.
2. Tap the line. **You should see:** a sheet titled with the adventure's name, the place's name in the small line under it, a "Hooks" heading, and one row per hook: its name, "Pays …", and "From <giver>, at <place>" for the one with a giver. There is no Back button.
3. Tap a hook. **You should see:** its words in paragraphs, "Pays" and "Given by" lines, "From your adventure: <name>.", a pencil (quill) beside the ✕, "Who hears it?" and two big buttons, Character (crown) and Party (three figures), and Back at the foot.
4. Tap Party. **You should see:** a toast "Sent to the party: <hook>" with Undo, the sheet back on the hooks list with "Sent to the party, day N" under that hook, and the card's line now saying "1 of N sent".
5. Open the same hook again and tap Party. **You should see:** "It wasn't sent again: the party already has it. Nothing changed."
6. Tap Undo on a fresh send's toast. **You should see:** the "Sent to …" line go away and the count drop by one.
7. Open a hook, tap the pencil, change the words, tap "Back to the book's words" (the book's words return), change them again, and tap "Use these words". **You should see:** the hook's sheet with your words. Send it; then open Rules for the campaign and confirm the pack's own hook is unchanged.
8. Tap Character. **You should see:** "Who hears it?" with the characters in play as option rows, each with its name and, under it in muted words, its player's name, or "you" for a character you play; no line between the last row and Back. Tap one; the toast says "Sent to <name>: <hook>".
9. Attach a second adventure with a hook. Open the line again. **You should see:** the list of adventures first, each with "x of y sent" (or "All sent"), and Back on an adventure's hooks returns to the list.
10. Sign in as a player in the campaign. **You should see:** no Calls to adventure line anywhere, and nothing of an unsent hook (piece C will show the sent one as a card).
11. Send one hook to the party, then at once a second hook to the party (before the first toast goes). Tap Undo on the toast showing. **You should see:** the hook that toast names lose its "Sent to the party" line, and the other keep it.
12. Open a hook with a long giver ("A debt come due" on the layout page). **You should see:** "Given by" and the giver's words on one line, running on and wrapping under it, like "Pays". Tap the pencil. **You should see:** on a phone, Cancel and "Use these words" side by side at the right of the foot.
13. At 375 px wide, repeat steps 2 and 3. **You should see:** the sheet across the screen, the two answers still side by side, nothing cut off.

Gallery pictures: none change (the line shows only on a card with an attached adventure, and no gallery specimen has one).
