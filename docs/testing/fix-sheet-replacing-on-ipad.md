# Manual checks: fix-sheet-replacing-on-ipad

A sheet on a tablet (creation's pop-ups, the Pack's, the players' screens') used to jump, flicker or slide when a row
in it was tapped, on an iPad held sideways. These checks need a real iPad: a desktop browser has no home bar or
Safari toolbar, which is what set the loop off.

1. On the iPad, held sideways, open the pull request's Vercel preview (the link in the pull request, "Visit Preview";
   or the app itself once this is merged). Sign in as a player.
2. Start a character (or open one being created) and go to **Details**. Tap the **Face** row to open its table.
   You should see the table open beside the row you tapped, and stay there.
3. Tap three rows in the table, one after another (if a tap closes it, open it again from the Face row each time).
   The sheet must not move, jump, slide or flicker, and the text must never look doubled.
4. With a table open, scroll the page a little so Safari's toolbar shows or hides. The sheet may move up once to stay
   on screen, then it must hold still.
5. With the Face table open, turn the iPad from sideways to upright, then back. Each time the sheet should sit next
   to the Face row again, whole on the screen (nothing past either side or the bottom), tall enough to read several
   rows, and a row can still be tapped.
6. Upright, scroll so a row with a short pop-up sits low on the screen (near the bottom), open it, then turn the iPad
   sideways. The pop-up should keep its full height (not shrink to a thin strip), sit next to its button, whole on
   the screen, and a row in it can still be tapped.
7. Do the same on an earlier step with a sheet (for example a kit's rolls, or Roll for a name on Who they are): open
   it, tap rows, roll; it stays put, and its last row and foot stay on the screen.
8. On a phone (or the iPad's split view under 700 px wide), open the same table: it still comes up from the bottom,
   the full width, as before.

Gallery pictures: none should change (the gallery's long table opens as a Sheet only with `?sheet=1`, which the
picture check never uses).
