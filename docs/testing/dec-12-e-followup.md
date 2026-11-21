# Manual checks: dec-12-e-followup

The E follow-up (rm-2, rm-3, TW9 and TW9b) on the pull request's Vercel preview (test project). Sign in as the GM of a campaign with an adventure attached that has a table of rumours, and in a second window as one of its players.

1. On the GM's Scene, tap **Calls to adventure**, then the adventure, then its rumours row. Under the title "Rumours" you should see the link **‹ <the adventure's name>**, and no Back button at the foot. Under the table you should see "3 more rows." followed by the underlined link **Show all 8**. Tap the link: every row shows.
2. Tap **‹ <the adventure's name>**: you are back on the adventure's hooks and rumours.
3. Open the table again and tap a row. Under "Who hears it?" you should see the link **‹ <the table's name>** and no Back at the foot. Tap **Party**.
4. On the player's device nothing yet shows the rumour (piece C's card isn't built). The check here is only that the player's device never shows the table, its truth or its note anywhere, including Rules.
5. If you have a pack whose rumours table is marked open (`"gmOnly": false`), import it through `npm run pack:check -- <file>` first: it is named there. The importer refuses it too.
6. Open a hook, tap **Character**: under "Who hears it?" you should see **‹ <the hook's name>** and no Back at the foot; the same on a rumour's Character step (wh-1, B's step too).
7. On a phone (375 px wide): the links wrap rather than run off, and the table fits.

Pictures expected to change: none in the gallery. As-built pictures of frames 5 and 6 (the links, and no Back in the foot) go to the lead with pq-1's three facts.
