# Manual checks: m5b-creation-final-followup (creation's small follow-up)

Run `npm run dev`, open the URL it prints, sign in as a player in a campaign with a setting pack (the fen sample, or your own test campaign), tap **Create your character**, then **Guided**. Check on a phone width (375 px, the browser's device toolbar), on an iPad upright (820 × 1180) and on its side (1180 × 820).

## Adjust scores (items 1 and 3)

1. Pick a class with one prime and a prime-XP table. On **Adjust scores**, the prime's tile reads its experience, for example "+5% experience now, +10% at 16"; a prime under the first step reads "+0% experience now, +5% at 13". The other tiles still read the modifier ("+0 now, −1 at 8").
2. Lower a score and raise the prime: the prime's line moves with it (at 16, "+10% experience now").
3. Pick a class with two primes. Both tiles are tagged **Prime**, each with its own experience line; neither says "Sets your experience". The lead carries the pack's line on how two primes count (if the pack has one). Lowering a score still says "now raise Might or Wit by 1".

## One bar (item 2)

4. On the iPad upright (820 wide), open any creation step: only creation's bar shows (← Back, the title, ⋯). The app's row (the sheet icon, its ⋯) is gone. ⋯ opens the menu with Leave (or Save and leave) last. Leave creation: the app's row is back. Same on its side and on the phone.

## Who they are (items 4 and 8)

5. With a kindred that has name tables, **Name tables: N** has its + square at the row's right edge, like **Derived values** below it.
6. A knight (or any class whose field is fed by a short table, such as the liege or an oath): the group's heading is the field's name alone ("Liege"), then a Roll row with the die ("Roll d8, or choose."), then the rows.

## Languages and Gear on a tablet (item 5)

7. At 820 wide on **Languages**: the second column holds **You speak** (the given languages, marked Given). Tap a language's name: its entry takes the column. Close it (✕): You speak is back. On the phone, You speak heads the list as before, with no second column.
8. At 820 wide on **Gear**: the left has the coin, To choose, the trinket and the shop; the right has **Yours so far**: Gold to spend, Undo last (after a buy), the load with its bar, then **Yours already**'s folds. Tap a kit's name: its entry takes the column. On the phone the tally stays under the step.

## Loading (item 6)

9. Open creation on a fast connection: no skeleton flashes. With the browser's network throttled to Slow 3G, the line ("Loading your setting's rules…") and the grey rows appear after a moment, not at once.

## Gear from the review (item 7)

10. Finish a character to the review and tap **Change** on Gear. Change nothing: both foot buttons read **Back to review**. Type a different coin: Next reads **Done**. Put the coin back as it was: Back to review again. Buy something and put it back: still Back to review.

## Roll rows (item 8)

11. Take a kit with rolls on **Gear**: the sheet's line reads "Step 1 of 4: Armour", and under it a Roll row with the die ("Roll d6 at the table, then tap what you rolled.").
12. A kit with a pick-up-to-N table ("Pick up to 2"): a Roll row "Roll d4, or choose." above its rows; the heading's note says only "0 of 2 picked".

## Gallery pictures (CI draws them; for Design)

- `creation-final`: the Adjust tiles' experience lines; the two-primes specimen without "Sets your experience".
- `creation-who`: the name tables' + at the right edge.
- `creation-gear`: the roll sequence's shorter line and its Roll row.
