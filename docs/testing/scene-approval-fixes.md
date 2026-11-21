# Manual checks: scene-approval-fixes (#958)

The approval's six fixes on the held Scene stack (into `dec-7-5b-gm-place-page`). Run `npm run dev` first and open the URL it prints.

1. Open `/layout.html?as=gm&placePage=spots&session=running&daylight=1`, open the campaign (a dungeon). The band has no "hours of light left" line, and the Light fact names a torch, not "No light". The right column starts with "Waiting for you" and "Nothing waits.", then Spots here. The band has "Encounter tables ›" and no "Table library ›".
2. Tap "Encounter tables ›": at the screen's foot, "Table library ›" opens the library with a pin on each table.
2a. Open `/layout.html?as=gm&placePage=spots&session=running&daylight=1&outdoors=1` (a day-by-day mode): the band says "2 hours of light left." beside Next day.
2b. With no expedition open (`/layout.html?as=gm`, open the campaign): the band's link reads "Table library ›".
3. Open `/layout.html?as=gm`, open the campaign, Start session, Depart, Start, Next turn twice: in the Due card, Hit and Miss sit on one row, and −1, +1 and + Modifier on the row below.
4. Open `/layout.html?as=gm&placePage=spot&session=running&party=five`: Ash's long status reads as wrapped lines, "B" at the start and "×12" at the end. At 375 px wide (a narrow circle, the words dropped) the mark and the count sit one small gap apart, and a status with no count sits centred under the portrait.
5. Open `/layout.html?as=gm&placePage=spots&session=running&map=wanted`, open the campaign. On the place page tap **+ Map** and pick any picture: the toast says "Map added (hidden): The Drowned Harbour". Tap the map's eye: the toast now says "Shown to the players: ..." (the first toast and its Undo are gone; toasts show one at a time). Open the **Log** tab, tick **Verbose**, tap the line "You added a map to The Drowned Harbour (hidden)", then its **Undo**. You should see "Undone."; back on the Scene the row shows "+ Map" again; in the Log, with Verbose, a line "You took a map back from the players" stands above it.
6. In the day view (a mode that counts travel by the day), at a place with nothing waiting: "Waiting for you" says "Nothing waits.". On a phone the empty panel is still left out.

## Gallery pictures expected to change

- The GM's Scene pictures taken during an expedition: the band loses its "Tables ›" line; in a dungeon it also loses the sun's "hours of light left" line (⚑ 1 ruled).
- Any picture with the library's link (the band with no expedition, the Encounter tables screen's foot): "Tables ›" reads "Table library ›" (⚑ 2 ruled).
- gm-place-page-spots: "Waiting for you" with "Nothing waits." now first in the right column.
- gm-scene-due and gm-scene-check: the card's two rows of buttons.
- Any marching-order picture with a long status: whole lines; in a narrow circle, the mark-to-count gap is one space-1, not two.
- Any day-view picture of the place page with nothing waiting: "Nothing waits." now shows (the #958 review: only a phone leaves it out).

No others.
