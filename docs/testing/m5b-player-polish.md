# Manual checks: m5b-player-polish

Open the pull request's Vercel preview (it uses the test database), sign in as a player with an approved character,
and open the campaign so the Player screen shows. iPad first, then a phone.

1. **The HP box.** Under the statuses: "hit points", then the figure (e.g. "8 of 8") at the left and two squares,
   − and +, side by side at the right, then the bar. There is no Damage or heal pop-up any more.
2. **A burst.** Tap − three times quickly. The figure drops by 3 at once; one toast reads "Took 3 damage, 5 of 8"
   (your numbers) and updates with each tap. Wait 3 seconds, open Log (verbose): one line, "You set <name>'s HP to 5
   (was 8)."
3. **Undo.** Tap − twice, then Undo in the toast straight away: the figure goes back, and after 3 seconds the log has
   no new line. Tap − once, wait 3 seconds, then Undo: the figure goes back (the log now shows the change and the
   change back).
4. **At the most.** At full hit points, tap +: nothing changes, and the toast says "<name> is at the most already,
   8 of 8", with no Undo.
5. **At 0.** Tap − until the figure stops at 0: the toast ends "0 of 8, the lowest it goes" (or "0 of 8: Down" if
   your setting's rules mark 0 as Down). Another − says "<name> is at the lowest already".
6. **Typing.** Tap the figure: a small "Hit points" Sheet opens with the number; type 4 and tap Set.
7. **The ring symbol.** On a lit light (Light row) and any status ring, the symbol sits in the middle of the ring and
   is about half its width; the flame no longer sits small and high.
8. **The avatar.** Tap the character's initial or portrait at the top: a "Portrait" Sheet opens with "Add a portrait
   (optional)" (or the picture with Change and Remove). Choose a picture (on an iPad, "Take Photo" is in the same
   menu), tap Save portrait: the toast says it was saved and the picture shows.
9. **Retired campaign** (optional): in a retired campaign, − or the avatar opens a Sheet saying the campaign is
   retired; nothing changes.
10. **The GM's views** (Scene's Heal prompt after a rest, the fight's controls) still use the Damage or heal pop-up.

Gallery pictures expected to change: **players-standard** (phone and tablet, light and dark): the status ring symbols
are larger and centred, and the page gains the HP box specimens. Its four baselines are deleted in this pull request;
CI draws new ones for Design.
