# Manual checks: the coin line and the coin's sheets (K9, K10)

On the pull request's Vercel preview (it uses the test database). You need a campaign whose setting names its coins, a GM account and two players, each with an approved character (here Wren and Moss).

1. As the GM, give Wren some coin (until K15 there is no GM screen for it: a test-database helper or the database's `purse_add` gives it). As Wren's player, open the campaign and tap **Pack**. Under the load you should see one bold line with the amounts in the setting's own coin names ("12 crowns, 30 herons"), a chevron at its right, and nothing under it. A coin Wren has none of is not in the line.
2. Sign in as Moss's player and open Moss's Pack. You should see only Moss's coin (or "No coin"), never Wren's amounts.
3. As Wren's player, tap the coin line. A sheet titled **"Wren's coin"** lists every coin the setting names (a coin she has none of shows 0), then **Spend…** and **Give to…**, with no sentence under them and no coloured button.
4. Tap **Spend…**. The sheet becomes **"Spend"** with "‹ Wren's coin" at its top. Each coin has its own row with "Wren has 30." under its name and a box showing a pale 0. Type 2 under the herons; the button at the bottom right reads **"Spend 2 herons"**. Type a few words under **What for** and tap it. The sheet closes, the coin line shows 2 fewer herons at once, and a toast reads "Wren spent 2 herons: <your words>" with **Undo**. Tap Undo: the herons come back.
5. Open Spend again and type more herons than Wren has; tap the button. Nothing is spent; under the herons row you should see the warning sign and "Wren has 30 herons."; the button is still a normal button. Clear the box and tap again: "Say how many: a whole number, 1 or more."
6. Tap "‹ Wren's coin", then **Give to…**. You should see **Party** (Party stash), then **People** (the other characters by name, no amounts). Type 5 herons, tap Moss: the button reads **"Give Moss 5 herons"**. Tap it: the toast reads "Wren gave Moss 5 herons", with Undo. As Moss's player, Moss's coin line shows 5 more herons.
7. Give 10 herons to the Party stash: the button reads **"Put in 10 herons"** and the toast "Wren put 10 herons in the stash".
8. Open the **Log**: each of these lines is there in the same words for Wren's player; Moss's player sees the give to Moss, and not Wren's spend.
9. Coin weighs nothing: the load's figure above the coin line is the same before and after.
10. On an iPad held sideways, the coin line sits in the right-hand column under the load; on a phone (375 px) under the load and above At hand. Try both light and dark.

## Gallery pictures

None expected to change: the gallery draws no coin line, and the layout pictures of the Pack only show coin with the harness's new `coin=1` switch, which no existing scene uses. The new layout spec `tests/layout/packCoin.spec.ts` saves its own screens in `test-results/layout-screens/pack-coin-*.png`.
