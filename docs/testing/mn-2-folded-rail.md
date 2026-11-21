# Manual checks: mn-2-folded-rail (what the folded rail keeps)

Ruled ap-17 (2026-11-14), mockup `design/mockups/december/16-the-scenes-top-in-every-state.html`, frame T13. The
automatic tests check this in a pretend browser and in WebKit at 1024 px; they don't use a real iPad. These checks do.
Use the pull request's Vercel preview on an iPad held landscape (the menu column only shows at 1024 px wide and wider).

1. Sign in as the GM and open a live campaign with the menu folded (the default). **You should see** the campaign's
   sigil (its picture, or its first letter) at the top of the folded menu, above the Scene, Players and Rules icons.
   No "Retired" tile.
2. Tap the sigil. **You should see** the menu open: the sigil and the campaign's name, Scene, Players, Rules, as before.
   Tap the sigil or the name there: "Edit the campaign" opens, as before.
3. Fold the menu with the handle. Open a **retired** campaign (Your campaigns, "Retired: 1"). **You should see** the
   sigil, then under it a tile with a lock and the word "Retired", in the warning colour, then the icons.
4. Tap the "Retired" tile. **You should see** a small pop-up titled "Retired campaign" beside the tile, with "Retired
   on (date). Everyone can still read it, but nothing in it can change." and a **Bring back** button with a sunrise
   above its word. The ✕ or a tap outside closes it.
5. Tap **Bring back**. **You should see** the pop-up close, the "Retired" tile go, and the campaign editable again
   (Players → Invite a player is back).
6. Retire it again (Rules → Retire campaign… → Retire), then open the menu. **You should see** the banner with the same
   words and the same Bring back button (sunrise above the word; it was a plain word button before).
7. Turn the iPad upright, or use a phone. **You should see** no change from before: the campaign's heading and the
   banner in full, tabs at the top or bottom, no sigil-only rail and no "Retired" tile.
8. Dark mode (Settings → Display, or the app's theme): repeat step 3. **You should see** the tile's lock and word
   readable in the dark theme's warning colour.

## Gallery pictures this step changes

None expected: the gallery has no GM campaign screen and no Retired banner. The layout check's own screens (not
compared pixel by pixel) change where they show a GM campaign folded at 1180 px (the sigil now heads the rail) and
the `gm-retired` scene (Bring back is now a stacked button with the sunrise).
