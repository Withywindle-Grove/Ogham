# Manual checks: m5b-phone-test-fixes

Use the pull request's Vercel preview, on a phone (or a browser window about 390 px wide).

1. **A row rolled twice.** Start a new character and go to Gear. Pick a kit with a roll made twice (step reads
   "…, twice"). Tap the same row two times. You should see **✓✓** at the right of that row, and no "twice" or
   "Picked ×2" in the row's words. The − square beside it is still there; tap it and the row goes back to one ✓.
   The line at the foot still lists what you tapped ("Eel knife, Eel knife").
2. **Rules tab, a group opened.** As the GM, open the campaign's **Rules** tab. Tap the first group (Characters) open,
   scroll down, then tap an **Optional rules: <pack>** group. The page should jump so that group's heading sits right
   under the top bar, with its first rule showing under it (not the middle of the list).
3. **Same on set-up.** Start a new campaign and reach the Optional rules step. Open a group: its heading lands at
   the top the same way.
4. **Tablet.** On an iPad, open two Rules groups one after the other: each one opened scrolls to its heading; the
   other stays open.

## Gallery pictures expected to change

- `creation-gear` (phone and tablet, light and dark): the Roll sequence specimen's twice row now shows ✓✓ instead of
  "Picked ×2". Its four baselines are deleted in this pull request; the layout check makes new ones for Design to
  approve.
