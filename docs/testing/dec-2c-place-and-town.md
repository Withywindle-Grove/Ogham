# Manual checks: dec-2c-place-and-town (December piece 2c, the place panel and the town page)

Stacked on #532 (the place picker): merge #532 first. The migration (`20261111170000_dec_2c_piece_lead.sql`) is held: these checks need it on the project the preview uses, after Francis's word.

You need an invented adventure pack with one town location that has `identity`, `facts`, `gm.sections`, `tableIds`, `settlement.watch` and `playerView.aspects` (with `lead`), one table and one stat block, attached to a test campaign; a GM account and one player account.

1. As the GM, open the Scene, start an expedition and pick the town from **From your packs**. The pack's group is headed by the pack's own name with "N places" under it, not "Region pack" or "Adventure".
2. On the place card: under the town's name, its one line of identity. Below, the facts, each with its lead-in in bold ("Ruler." then the words). No `[[` or `]]` anywhere on the screen.
3. **About the town**: one row per heading, each folded; tap one and its prose opens. A pack with one heading shows it open.
4. **Tables**: one row per table (and any table the GM text links to). Tap one: it opens full screen with its rows. Close it with ✕.
5. **The watch**: a box with a dark-red left edge; its words, its bold lead-ins, and "In a fight." with the stat block's name (never its id).
6. **Pieces**: each piece's eye says **Hidden** beside the icon; an aspect reads "**Sign.** A brass lantern…". Tap the eye of the description and of one aspect: each says **Shown**, with an Undo toast.
7. As the player, open the Scene: the place line shows the description and the aspect with its bold lead-in, and nothing of the hidden aspect. Open **What we know**: the same, the lead-in bold.
8. As the GM, open **Notes**: the notes read as lines, a "Label: words" line with the label in bold. Tap **Edit notes**: the five fields appear with the notes as stored.
9. Town page (the setting's services): under Overview, one row **Safety and encounters** with "Safe" and "Out and about today: Off" (as they are). Tap it: a pop-up with the checks and the two switches; flip one, see the toast with Undo, close with ✕.
10. A place in town (a shop): its row has its name and the eye only, no Open / Closed. Tap the name: a pop-up with "Today it is" Open / Closed. Tap Closed, close the pop-up: the row now says "Closed today.". As the player, that shop (once shown) says Closed.
11. A lodging with a grade (and a `placeId` naming the inn): its row says "Lodging, Comfortable, 2 sp a night, at The Eel and Lantern" (your pack's words).
12. Messy data: a 120-character town name and a fact with a long text wrap at 375 px wide (phone), nothing pushed off the screen; a pack location with only `gm.notes` shows no About, Tables or watch.
13. Run `npm run pack:check -- <your pack file>` on a copy with an aspect without `lead`, a link to a table id that doesn't exist, and a link in `playerView.text`: three warnings, in words.

## Gallery pictures expected to change
- **Place picker** specimens (the group line now reads "N places", without the pack's kind): all four picker pictures that show a pack's group.
- **Town screen** pictures, if any show a town place row or the Encounters section: Open / Closed leave the row; Encounters becomes the Safety and encounters row.
- Any picture with a **piece's eye** (the place card): the eye now carries the word Shown or Hidden and is wider.
- **New** (no baseline yet): "A town from its pack (2c): identity under the name, …" and "A place's notes as the pack carries them today (2c, the fallback): …" in the Places section.
