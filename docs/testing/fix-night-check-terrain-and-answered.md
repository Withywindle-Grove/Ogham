# Manual checks: fix-night-check-terrain-and-answered

The night encounter (gate walk finding, 2026-11-10). Nothing on screen looks different: only the odds and whether the night check asks again change. Use the pull request's Vercel preview (test project), a campaign with a day-by-day mode whose encounter check goes by terrain, and a camp with a night check.

1. As the GM, start a session and an expedition in the day-by-day mode. Open the time strip's ⋯ and tap **Encounter check**. The Due card shows the check with its own odds (before any move there's no ground yet). Tap **Miss**.
2. On the travel card tap **Move…**, pick a terrain with different wander odds (and a route that isn't one that rules the check out), and tap **Move**.
3. Without reloading, tap ⋯ › **Encounter check** again. The Due card now shows that terrain's odds (the same numbers the Move sheet showed), not the check's own odds and not "the GM's call".
4. Tap **Hit**: if that terrain names its own encounter table (and the place has none), Which table? offers it.
5. Tap ⋯ › **Make camp**. Then ⋯ › **Encounter check** and answer the night check (Hit or Miss) from the card.
6. Tap **Next day**. It moves straight to the next day: no "The night check first, then Next day again" toast, and the night check isn't on the card again.
7. Regression: make camp again without answering anything, tap **Next day**. It still stops first at the night check, as before.
8. Midday: on a fresh day, before making camp, tap ⋯ › **Encounter check** and answer it. Then **Make camp** and **Next day**: it still stops at the night check (a midday check isn't the night's).
9. Undo: **Move…** into another terrain, then tap **Undo** on the move's toast. Without reloading, ⋯ › **Encounter check** shows the odds of the terrain the party is back on.

Gallery pictures expected to change: none (no layout or wording change).
