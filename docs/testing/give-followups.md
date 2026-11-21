# Manual checks: give-followups

These run on the pull request's preview, which uses the TEST project. You need a GM account and two player accounts in one campaign.

1. **Undo of an older give is refused.**
   1. As the GM, open the Players page.
   2. Give a character to the first player.
   3. Give the same character to the second player.
   4. Open the log and tap Undo on the **first** give.

   You should see "That's changed since. Undo the later change first." The character stays with the second player.
2. **Undo to a player who has left.**
   1. As the GM, give a character from the first player to the second player. Use one the first player did **not** have in play.
   2. Remove the first player from the campaign. The app has no button for this: ask the Builder to remove their membership on TEST.
   3. Tap Undo on that give.

   You should see "That player has left the campaign, so <the character> can't go back to them." It shows the player's name instead if they still share another campaign with you. The character stays with the second player.

Gallery pictures expected to change: none (only a toast's words change).
