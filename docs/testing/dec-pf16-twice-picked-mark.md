# Manual checks: dec-pf16-twice-picked-mark

The takes mark (the lead's rulings of 2026-11-13: one tick a take, the pop-up the same) and the new semicolon words.

1. Run `npm run dev` and open the gallery at the URL it prints plus `/gallery.html`. Scroll to the last section,
   "Creation: a trait list rolled more than once". The Heron row (a long name) has its button under the name, at the
   right, reading **Picked ✓✓**; Frog in frost reads **Picked ✓**; Eel reads **Pick**. No "×2" or number anywhere on
   the rows. The line beside Decide later reads "Heron at dawn over the drowned causeway ✓✓, Frog in frost picked".
2. Narrow the window to phone width (375). The Heron button sits under the name without touching it, and the page
   does not scroll sideways.
3. In a campaign whose setting has a trait list with `rolls: 2` and no `distinct`, make a character and reach that
   list. Tap Pick on one entry: it reads Picked ✓. Tap Pick on the same entry again: it reads Picked ✓✓ and the fold
   says "2 of 2 picked". Tap the entry's name: its pop-up's button also reads Picked ✓✓. Close it and tap Pick once
   more: it goes back to Picked ✓. (On a list with `rolls: 3`, three taps read Picked ✓✓✓.) With one entry taken
   twice and another once, the line beside Decide later reads "<first> ✓✓, <second> picked"; the review after Next
   still lists the first entry twice.
4. On the same list, tap Other…, type "Frog; bone" and tap Add. A pop-up says "A name or note can't hold a semicolon
   on this list. Use a comma instead." and nothing is added.
5. With a screen reader (VoiceOver on the iPad), focus the twice-taken button: it says "Pick <name>, picked twice",
   checked; in the entry's pop-up, "Pick <name>, picked twice", pressed; the line beside Decide later says
   "<name>, picked twice, …".

## Gallery pictures this changes

- New section `creation-trait-list` (phone and tablet, light and dark): an entry with a long name taken twice
  (Picked ✓✓), one taken once (Picked ✓) and one not picked, and the foot line naming each entry once. A new picture for Design; no other section's picture should change (it is
  last).
