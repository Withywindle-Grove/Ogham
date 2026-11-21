# Manual checks: player-review-fixes

The Player stack's second review: two Important fixes and three nits. Open the layout page's shared test character
(`npm run dev`, then `/layout.html?as=player&p1=1`), on the branch `player-review-fixes`.

1. **A lit lantern stays one row when its only action is the light.** At hand shows the storm lantern once, as the
   light's rows (lit, 4 turns left), with no "Put out" button and no second Storm lantern row. Tap the name
   "Storm lantern": the lantern's item sheet opens.
2. **A lit light with another action keeps its row.** Not reachable from the test character without editing data; the
   automated test covers it (`PlayerAtHand.test.tsx`, "keeps the row of a lit light that has charges"). Expect: the
   lantern's item row with **Use a charge**, and no Light or Put out button on that row.
3. **Literacy with no Languages field.** Not reachable from the shipped packs; covered by `sheetRevised.test.tsx`
   ("keeps the literacy in Details when the layout has no / a hidden Languages field"). Expect: Literacy as a Details
   line.
4. **Unpin, then Undo, keeps the order.** On a character with three traits with uses (covered by
   `PlayerTraits.test.tsx` if none is at hand), pin three traits (open each trait's sheet, tap the star). Open the middle one
   in At hand, tap the star to unpin, then tap **Undo** in the toast: it comes back between the other two, not last.
5. **Same-named traits.** Only with a pack whose class and kindred both give a trait of the same name; covered by
   `PlayerTraits.test.tsx`. Expect: two rows, each opening its own words.

Gallery pictures: none expected to change (no change to any drawn state of the test character or the specimens).
