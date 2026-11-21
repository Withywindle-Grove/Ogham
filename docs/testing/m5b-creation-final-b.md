# m5b-creation-final-b: creation's final drafts, slice B (Scores and Adjust scores)

Open the pull request's preview (test project). Use the creation fixture campaign, or a campaign with fae-woodland attached. The phone (375) first, then the iPad upright (820). Compare with `docs/design/mockups/creation/final/01-method-scores-adjust.html` on `design-gate-m5b-walk`.

1. **Phone. Scores, nothing touched.** Create, Guided, go to Scores.
   - Under the bar: one line of what the step is (your setting's own line if it has one, else "Six numbers say what your character is naturally good at."), then the die and the bold "Roll 3d6 at the table for each score, then enter what you rolled.", then Help me choose.
   - Every score shows the average in lighter grey, with "Average value, replace with your roll" under it.
   - The foot reads "0 of 6 rolled". Next is the dark accent button.
2. **Phone. Scores, touching.** Tap + on the first score, then − (back to the average).
   - The number is full weight now, and the line under it is the score's own caption (or blank), not the average's line.
   - Type a number in another score: the same. The foot reads "2 of 6 rolled".
3. **Phone. Kept on the device.** Type one score, tap ⋯, Save and leave. Create again, Continue. The typed score is still full weight and the others still show the average's line.
4. **Phone. Adjust scores, one prime.** Go on through Kindred and a class with a trade (the fixture's Lantern Warden; on fae-woodland a fighter-type class).
   - The lead: "**Your prime is …**, the …’s main score. A higher prime earns experience faster. Lower another score by 2 to raise your prime by 1. Nothing may go under 9." (your setting's numbers).
   - The prime's tile has "Prime" beside its name and only a **+**. Every other tile has only a **−**.
   - Under each tile, the next step in the direction its button goes: on a − tile "+0 now, −1 at 8" or the like; on the prime "+1 now, +2 at 16, +5% experience" (when the score earns a bonus); a tile with no button says only "+0 now".
   - A score at the floor (type it on Scores, Back) has no − and says "At the floor: can't go lower". A score under the floor has no − and shows the warning sign with "Already under 9: can't be lowered".
5. **Phone. A trade.** Tap − on a score.
   - A toast: "Charm 11 → 9: now raise Might by 1" with **Undo**. Tap Undo: the score is back. Tap − again.
   - Tap + on the prime. The toast changes to "Charm 11 → 9, Might 13 → 14" (your scores), with **Undo**. The foot reads "1 trade made".
   - Tap Undo: both scores go back and the foot reads "No trades yet".
   - Make two trades, then tap the first chip's ✕ under the tiles: only that trade goes.
   - Tap − only, then Next: the foot and a toast say "1 to spend: raise a prime, or undo the lowering".
6. **Phone. Help me choose on Adjust** shows the setting's trade rule with its page.
7. **Two primes** (a fae-woodland class with two primes). The lead reads "**Your primes are … and …**" with the setting's own line on how two primes count. Both primes have only a +; the lower one says "Sets your experience". On classic-advanced the line isn't there yet (the pack session adds it); nothing else is said in its place.
8. **The review and the GM's card.** Walk on to the review without touching some scores. Under the scores: "Wit 10, Lore 10: the average, not rolled". Send it; as the GM, the approval card shows the same line.
9. **iPad (820).** Scores and Adjust are one wide column with the tiles three across, the name and the number centred. No empty side column.
10. **Long names (phone).** In the gallery's creation section, the score called "Nimbleness of the long-gone marsh wardens" has its name on its own line, broken only between words, with the stepper under it at the right. "Might" stays beside its stepper.
11. **Messy data.** Type 2 and 16 (or your setting's ends): the thresholds stop at the table's ends (a − tile at the bottom says only "−2 now"). A long ability name wraps in its tile.

## Gallery pictures that change (for Design)

No pictures are committed with this branch. These sections draw differently:
- **creation-final**: three new specimens, Scores (untouched tiles with the average's line), Adjust scores (one prime: + only, − only, at the floor, under it with the sign) and Adjust with two primes.
- **creation-shell, creation-review, creation-who, creation-gear**: captions only. "▲" now reads "the sign" (Design's nit from slice A).
