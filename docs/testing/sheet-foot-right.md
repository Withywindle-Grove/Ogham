# Manual checks: sheet-foot-right

The lead's ruling ft-1 (2026-11-14; Francis's standard, "buttons are right justified"; `docs/design/rulings/dec-pack-town-players-2026-11-14.md`): the buttons in a sheet's or pop-up's foot are right-justified as a group, side by side in code order, which is reading order; the order within the group is the screen's approved drawing, and where no drawing settles it the accent comes first. They stack, right-aligned, only when they don't fit one row; a lone accent sits at the right at its own width. It reaches every Dialog and sheet foot and the kit's roll sequence, not a creation step's own foot. Drawn in the approved Pack frames PK3 ("Got it"), PK5 ("Send all"), PK10b ("Add to Wren's pack") and the shop's TW4a ("Buy it", "Leave it").

1. Run `npm run dev`, open the address it prints with `/gallery.html` on the end, and scroll to the last section, **"A sheet's foot (ft-1)"**, on a tablet-sized window. You should see four pop-ups:
   - "Storm lantern": **Add to Wren's pack** at the right of the card, only as wide as its words.
   - "Lanterns need oil": **Save** then **Cancel** on one line, the pair against the card's right edge.
   - "Storm lantern, 4 herons": **Buy it**, **Leave it**, **Ask the price** on one line at the right.
   - "New in your pack": the stacked **Got it** (tick above the word) at the right, its own small size.
2. Make the window phone width (375 px): the first, second and fourth look the same; the third now stacks: **Buy it** on top, then **Leave it**, then **Ask the price**, each against the right edge.
3. Still at 375 px, scroll up to **Creation: Gear, the kit's Roll sequence**: in each roll sequence's foot, **Back** then **Next** sit at the right, Next only as wide as its word (unchanged in the picture: it already was; now a rule and a test keep it so).
4. On a keyboard, in "Lanterns need oil", click **Save** and press Tab: focus moves right to **Cancel**: the order on screen and the Tab order agree.
5. In the app, open a character's sheet and tap a figure (a save or a score) that opens its breakdown: **Got it** sits at the right of the sheet's foot, not across it. On a phone, the same.
6. Start a new character and, on the Patron step, tap Next with no patron picked: **Back to Class** then **Choose a patron** (that screen's order, unchanged) at the right, side by side where they fit, stacked at the right on a narrow phone. The creation step's own foot under each step (its Next) is unchanged.

## Gallery pictures expected to change

See the status file, section 6: the exact list from a local comparison, each with why it moves: `molecules`, `creation-final-d`, `patron-first`, `creation-long-tables`, `creation-who`, `sheet-revised` and the new `sheet-foot` (the one the lead opens).
