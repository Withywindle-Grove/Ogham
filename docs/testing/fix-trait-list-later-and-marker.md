# Manual checks: fix-trait-list-later-and-marker

The look-back review of #663 (pf-16), Important 1: Decide later on a list rolled more than once no longer drops the
spell rolled under a pick, and saves nothing when nothing changed. Needs a setting whose trait list has `rolls: 2`
and an entry with a spell roll (`spells.roll`); the test project's fixtures don't have one, so this is easiest on a
private pack with such a list, or skip to the automated tests below.

1. Start a new character in guided creation and go to the list rolled twice. Pick the entry that brings a rolled
   spell, tap the spell you rolled, then tap **Decide later**. You should land on the review with the list under To
   finish.
2. Tap **Do it now** on that list. You should see your pick and the spell you tapped still ticked.
3. Without changing anything, tap **Decide later** again. You should go back to the review with no new toast (no
   "… added to your pack." again), and the character's log should show no new lines for it.
4. Send the character, open the sheet, open the list from the To finish card, and tap **Decide later** without
   changing anything. The pop-up closes; the spell is still on the sheet beside the pick.

Gallery pictures: none should change (no screen changed).

Automated: `npx vitest run src/app/languagesAndTraits.test.tsx src/app/traitLists.test.tsx -t "fix of #663"`
should show 3 passed.
