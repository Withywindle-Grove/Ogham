# Manual checks: the GM's coin on a character's Pack (K15's coin)

On the pull request's Vercel preview (it uses the test database). You need a campaign whose setting names its coins, a GM account and two players, each with an approved character (here Wren and Moss).

1. As the GM, open the campaign, tap **Players**, then the **Pack** button on Wren's row. Under the load you should see Wren's coin line, the same as her player sees it ("No coin" if she has none), with a chevron at its right and nothing under it.
2. Tap the coin line. A sheet titled **"Wren's coin"** lists every coin the setting names (a 0 for none), then **Give coin…** and **Take coin…**, with no sentence under them and no coloured button. (No Spend… or Give to…: those are the player's.)
3. Tap **Give coin…**. The sheet becomes **"Give coin"** with "‹ Wren's coin" at its top, a row a coin with "Wren has N." under it and a box. There is no list of people. Type 40 under the herons: the one coloured button reads **"Give Wren 40 herons"**, an open palm above the words. Tap it. The sheet closes, the coin line shows 40 more herons, and a toast reads "Your GM gave Wren 40 herons" with **Undo**. Tap Undo: the herons go back.
4. Open the coin line again, tap **Take coin…**. The sheet is **"Take coin"**. Type 10 herons: the button reads **"Take 10 herons"**. Tap it: the line shows 10 fewer, the toast reads "Your GM took 10 herons from Wren" with Undo. No other purse (Moss, the stash) gains them. Tap Undo: they come back.
5. Take again, typing more herons than Wren has, and tap the button. Nothing is taken; under the herons row you should see the warning sign and "Wren has 30 herons." (her real amount); the button is still a normal button.
6. Sign in as Wren's player and open the **Log**: "Your GM gave Wren 40 herons" and "Your GM took 10 herons from Wren" are there (with their undos). Her coin line shows what the GM left her, and her own sheet still offers **Spend…** and **Give to…**.
7. Sign in as Moss's player and open Moss's Pack: only Moss's coin, never Wren's amounts.
8. Do 1 to 5 on a phone (375 px) and on an iPad sideways, in light and in dark.

## Gallery pictures

None expected to change: the gallery draws no coin line, and only the `coin=1` harness switch shows coin. The layout spec `tests/layout/packCoin.spec.ts` gains the GM's five scenes at 375 and 1024 (`test-results/layout-screens/pack-coin-gm*.png`).
