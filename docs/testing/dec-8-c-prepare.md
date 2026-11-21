# Manual checks: dec-8 C, Prepare

Built to `docs/design/mockups/magic/06-prepare-and-rest.html`, the Prepare frames (approved 2026-11-10). Use the pull request's Vercel preview (the test project), signed in as a player whose character casts spells: one with a spell book and one who prays (chooses from the whole list), each with spells ready today.

1. Open the campaign, tap **Magic** in the tab bar. The first row reads **Prepare**, with "For your next rest" under it. With nothing ready and nothing chosen, "Nothing ready" has under it: "You haven't chosen since your last rest. Choose in Prepare; they're ready after you rest."
2. Tap **Prepare**. A full screen titled **Prepare** opens, with ✕ at the top right. The first line reads "For <name>'s next rest. Ready today stays as it is: …" and names today's ready spells (or "Nothing is ready today.").
3. Under it, **Same as yesterday** lists today's ready spells, with **Pick** at the right.
4. Each level reads like "Level 1, 2 a day. 1 chosen". Each spell has its name, a quiet line (duration, range) and − N + at the right. With nothing chosen since the last rest, the numbers match what is ready today.
5. Tap **+** on a spell where the level has room. The number goes up, the level line counts it, and the foot changes ("Saved as you go. 1 slot still empty" becomes "Saved as you go" when all are full). No toast.
6. Close Prepare with ✕ and look at the Magic tab: **today's ready spells have not changed** (choosing is for the next rest).
7. Open Prepare again: your choice is still there.
8. On a full level, tap **+** on another spell. A pop-up "Level 1 is full" says "<name> has 2 a day at level 1 and both are chosen. Take one out first." Close it: nothing changed.
9. Tap **−** on a chosen spell: it goes down at once. Tap **−** on a spell at 0: a pop-up "<spell> isn't chosen" says "<name> hasn't chosen <spell> for the next rest, so there's none to take out." Close it: nothing changed.
10. Tap **Pick** on Same as yesterday. A toast reads "Picked …" with Undo, and the steppers show today's set. Tap **Undo**: your earlier choice comes back.
11. Tap a spell's name: it opens over Prepare as on the Magic tab (Level, Range, Duration as lines, the whole description, its page); **Got it** or ✕ closes it. Prepare and its pop-ups are in the book's type, like the Magic tab.
12. As the praying character: the chosen spells come first; the rest are under a fold row "N more at level 1" with their names under it and a + square at its right (− once open; fix 1, 2026-11-18). Tap it to open; + on one of them moves it up among the chosen.
13. Messy data: a character whose ready spells are more than their slots now (the GM lowered a level). Tap **Pick**: a pop-up "Same as yesterday" says "Yesterday's spells no longer fit your slots. Choose again." and nothing is picked.
14. At 375 px wide, a very long spell name wraps beside its stepper; nothing runs off the screen. Check light and dark.
15. A book caster with an empty spell book: Prepare says "No spells in your book yet. Your GM adds one when you learn it." under its first line, alone: no level line, no stepper, and the foot says "Saved as you go" (fix 3, 2026-11-18). A book with spells at level 1 only, for a caster who also has level 2 slots: level 2 says "Nothing to choose at level 2." under its level line (fix 2), and the foot doesn't count level 2's slots. If the GM empties a book while a spell is chosen, that spell still shows under the note with its stepper, and − takes it out.
16. Offline: tap +. It says why it couldn't save and the numbers go back to the choice as saved (what you saw before the tap, unless another device changed it meanwhile: then that device's choice).

**Gallery pictures expected to change:** only the new section `prepare` (four new pictures: phone and tablet, light and dark), added last so no other section moves: the Stepper row variant, Prepare for frame 06's book caster and praying caster, messy data and an empty book. No existing picture changes: `SpellLevel` and the other `ListRow` variants are untouched. Pictures of the built Prepare (book caster, full level pop-up, praying caster, the "no longer fits" pop-up, the empty spell book), phone light and tablet dark, go to Francis with the pull request, since the screen differs from its frame (see the plan's Departures, piece C).
