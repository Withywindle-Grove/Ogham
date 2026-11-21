# Manual checks: fix-toast-undo-stale-lines

Logic only: no screen changes, and no gallery pictures are expected to change.

1. As the GM, open a campaign whose setting has a mode with a wandering check every 2 turns. On Scene, tap **Start expedition**.
2. Go to **Players**. The compact time strip shows at the top. Tap **Next turn** twice. The second toast says "Next turn, 1 thing on the card".
3. Tap **Next turn** once more, then **Undo** in its toast. You should see "Put the clock back".
4. Go to **Scene**. The wandering check from step 2 should still be on the card ("Due"). Before the fix it was gone.
5. Start a new expedition. On Scene, tap **+ Reminder**. Make a check every 2 turns. Tap **Next turn** until it comes due, then ⋯ › **End expedition**, and close the summary. The reminder is still on the card.
6. Tap the strip's **Next turn** (in town), then **Undo** in its toast. The clock goes back, and the reminder should still be on the card. Before the fix it was taken off.
