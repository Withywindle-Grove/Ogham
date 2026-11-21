# Manual checks: dec-1b-spells-by-level

Spells learned above level 1, at creation (plan `docs/plans/dec-1-creation.md`, 1b). On the pull request's Vercel preview (the test project), with a campaign whose setting has a book caster with `learnByLevel` (the December campaign's packs do).

1. As the GM, open the campaign's settings and set the start level to **Fixed level: 2**. You should see "You start at level 2." when a player creates a character.
2. As a player, create a character with **Guided** creation and pick a book caster (a class that keeps a spell book). Walk to the Spells step.
   You should see the first spells' groups as before, then, last, a group titled **"Learned at level 2: pick 1"** with "0 of 1 picked", listing 1st-level spells.
3. Pick all the first spells. The foot should say **"1 spell to go"**. Tap **Next**: a message says "1 spell to go, or Decide later" and the step stays.
4. In the learned group, tap a spell you already picked above. You should see **"Already yours: pick another."**
5. Tap a new spell in the learned group. The group says "1 of 1 picked"; tap another: **"1 of 1 picked: unpick one first."** Tap the picked one again to unpick it, then pick it again.
6. Tap a spell's name in the learned group: its full rules open, with Pick at the foot.
7. Tap **Next**, then walk on to the review. The Spells card should list the learned spell with the first spells.
8. Tap **Change** on the Spells card: the step opens with the learned spell still picked in its group.
9. Start a second character, pick the same class, and on the Spells step leave the learned group empty and tap **Decide later**. On the review, the To finish box should list the Spells step. Send it; as the GM, the waiting character's card should show "To finish: First spells".
10. As the GM, set the start level to **Fixed level: 3** and create another caster: there should be two groups, "Learned at level 2: pick 1" and "Learned at level 3: pick 1", the second also offering 2nd-level spells.
11. With the start level at **1**, create a caster: no "Learned at level" group, and the step is as before.
12. Create a fighter (no spells) at level 2: no Spells step. A prayer caster with nothing to choose at level 2: no Spells step.
13. At a 375 px width (phone), check the learned group's title fits and wraps between words.

Gallery pictures expected to change: none (no gallery screen shows a caster made above level 1).
