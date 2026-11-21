# Manual checks: dec-give-character-reassign (the GM gives a character to a player)

Use the preview of the pull request (the test database). As the GM, make a character in a campaign with at least one player.

1. Open the campaign, then **Players**. Your new character has a row after the players' rows, its small line **"Yours"**, with View sheet, Pack, **Give to a player…** and Remove….
2. Tap **Give to a player…**. A sheet titled "Give to a player" opens with the character's name in its small line. Each player is a row, with "plays …" or "no character yet". There is no "You, the GM" row.
3. Tap a player. The sheet closes. The toast says "<character> given to <player>." with **Undo**. The row now names the player.
4. Tap **Undo**. The character is yours again ("Yours").
5. Give it again, then open **Give to a player…** on its row. A line with a tick says "<player> has <character> now."; **You, the GM** is the first row; that player isn't a row. Tap **You, the GM**: the toast says "<character> is yours again."
6. Open the **Log**. As the GM: "You gave … to …." / "You took … back from …."
7. Sign in as the player who was given it, in a campaign where they had no character in play. The character is theirs in play at once. In **Your characters** its card says **"From your GM, today"**. In their log: "Your GM gave you …."
8. On a phone (375 px wide), the row's buttons wrap under the name; the sheet rises from the bottom; long names wrap.

The database's own checks are run by the coordinating Builder on TEST: `npm run test:db -- supabase/tests/dec-give-character-reassign.test.ts supabase/tests/commands.test.ts supabase/tests/m3-health.test.ts`.

Gallery pictures: none change. The as-built pictures are in `docs/design/pictures-for-approval/give-character/` on `pictures-for-approval`.
