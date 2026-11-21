# Manual checks: dec-pf16-trait-list-rolls

A trait list rolled more than once (pack format ruling pf-16). You need a test campaign whose setting has a trait list
with `rolls: 2` (the held zine 0.5.58 has three: one without `distinct`, two with). Open the pull request's Vercel
preview and sign in as a player.

1. Create a character and walk to a list with `rolls: 2`. The fold's line reads "0 of 2 picked" and the foot "0 of 2
   picked. Pick 2 more, or Decide later". Tap one row's ✓: they read "1 of 2 picked" and "1 of 2 picked. Pick 1
   more, or Decide later".
2. Tap Next with one picked. A pop-up says "Pick 1 more, or Decide later." and you stay on the step.
3. Pick a second one, then tap a third row. A pop-up says "2 of 2 picked: unpick one first."
4. On the list without `distinct`, tap the same row twice. The row reads "×2" after its name.
5. On a list with `distinct`, tap a picked row's ✓ before picking a second. A pop-up says "Already yours: roll again."
   Tap the row's name: its pop-up offers Unpick.
6. Pick one of two, tap Decide later. On the review, the list's card shows the one pick, and To finish lists the list;
   Do it now opens the step with that pick kept.
7. Finish with two picks. The review card lists both names; the sheet shows both, separated by a comma.
8. On a list with `rolls: 2`, tap Other…, type a name and a note with a semicolon in it ("from a well; dry"), tap Add.
   A pop-up says "A name or note can't contain a semicolon here." and nothing is added.
9. A list without `rolls` behaves exactly as before (one tap picks, another replaces).

Gallery pictures: none should change (a list without `rolls` draws as before; no gallery scene uses `rolls`).
