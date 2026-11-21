# Manual checks: the app-wide sweep and the Tome rename (`m5b-players-e-sweep`)

Open the pull request's Vercel preview (it uses the test project) on the iPad, then on a phone. Light and dark mode.

## The name
1. **Signed out.** Open the preview. You see **TOME** in even, spaced capitals, a short line under it, then "Here beginneth a tale of valour and of daring." in grey. No other line across the screen. "Under the old oaks" is gone. The browser tab says "Tome". On the iPad and a tall phone (700 px or more of screen height) the block starts about a third of the way down; on a short phone (an iPhone SE) it sits high, and tapping Email leaves the field above the keyboard (N1, kept for short screens).
2. **The loading screen.** Reload the page while signed in (on a slow connection you see it longer). For a moment: **TOME**, and under it "tome, noun, from the Greek *tomos*, one volume of a work: a large and weighty book. What the table remembers." No phonetics, no header.
3. **Your campaigns.** After signing in: **TOME** at the top left, smaller (about 20 px), with ⋯ at the right.
4. **Inside a campaign.** Open any campaign: the name appears nowhere (no wordmark, no "Tome" in the top row).
5. **Home-screen icon.** If the app is installed, the icon is unchanged; a fresh install names it "Tome".

## No disabled buttons
6. **Sign in, Send a new code.** Ask for a code, then tap "Send a new code (Ns)" during the countdown: a sheet "Wait a moment" says a new code can be sent when the button's countdown ends. Nothing is sent.
7. **Add item, One fewer.** In the Pack, Add item, pick a thing: at 1, tap −: a sheet "Can't go lower" says one is the fewest.
8. **The GM's item sheet.** As the GM, open a charged item: Recharge, Reveal the count, Approve and Decline are never greyed. Tap twice quickly: it happens once.
9. **Empty a container to someone.** In a container's sheet, Give everything to…, tap Give without choosing anyone: a sheet "Give to whom?".
10. **A locked optional rule.** In a running campaign's Setting rules, open a rule marked Locked and tap its other choice: a sheet says it can't change once the campaign starts.
11. **Marching order, locked.** As a player, with the GM's lock on, hold a name to drag it: a sheet says why it can't move.
12. **Ask for a different level** (GM, approval): choose the level it already is and tap Ask: a sheet "Same level".
13. **Rules browser, At level.** At level 1, tap −: a sheet "Can't go lower".
13a. **A second picture while the first saves.** On Your characters, tap a card's picture and pick a photo, then at once pick another: a sheet "Still saving"; only the first is kept. The same on the portrait picker and a pack's "Update from a new file".
13b. **Companies (GM).** Move one character to a company and at once another: the second says "Still saving"; choose it again and it moves.
13c. **Character fields (GM), editing.** Open a field to edit it, then press and hold inside its label box or on Save: no "Can't move fields now" sheet. Hold on another field's row: the sheet says why it can't move.
13d. **Company page.** The take-back buttons read "Take back the invite" and "Take back the request".

## No middle dot
14. Walk the Player screen, Pack, full sheet, Scene (time strip, camp, travel, weather, encounter cards), Players (GM), Rules, the log and Your campaigns. No "·" anywhere. Lines read with commas ("Rushlight, 6 turns left"), or a colon after a label ("Retired: 2", "2nd watch: Reed, Moss", "Off: <choice>").
15. **Old log lines** written before the sweep may still show "·" (they were saved with it). That's expected.

## The warning sign, not ▲
15a. Give or move an item to a full container: the full row shows the warning sign (a triangle with "!") beside "Full", never a plain ▲.

## The full sheet's figures as tiles
15b. Open the full sheet of a character whose setting works out more figures than the four (a movement figure, a save target, a weapon line): they show as tiles after Hit points, Armour, Attack and Level, each opening where the number comes from. Beside the Player screen (landscape tablet) they head "More combat details".

## Square chits
16. Every chip (trait chips, trade chips on Adjust scores, languages on the full sheet, the log's filter chip, the marching order names, the rest marker, the offline pill) has square-ish 4 px corners, never a pill.

## Gallery
16a. **Player screen, Light.** Light a torch: the ring sits at the left; beside it "<light>, N turns left", and under that line Put out, Keep lit and ⓘ, never under the ring.
17. Open `/gallery.html` on the preview. In "The players' screens" the new **Light** specimen shows three lights: a full ring (Storm lantern, 6 turns left), a ring at its last sixth with the warning sign before "Rushlight, 1 turn left", and a dashed ring (Glow-moss jar).

## Pictures expected to change
Review round: **colour** (the "Never colour alone" specimen's name) and **choosing** (the destination list's warning sign) also change. Almost every gallery section changes, because the sweep touches shared parts: middle dots became commas or colons in specimen text and in shared parts (chips, rule rows, pack lists, log lines, cards), and every chip lost its pill corner. The baselines this pull request changes were removed so CI draws them fresh; they go to Design in one batch.
