# Manual checks: fix-patron-change-garb

On the live app after the merge, in a campaign with patrons switched on and a class that follows a patron (the one you used when you found it):

1. Tap **Create your character**, then **Guided**. Pick the class, then a patron (call it patron A). Go on through the steps to **Gear**.
2. On Gear you should see a group **From <patron A>** with A's garb. Buy or take one other thing (a kit or a shop item), then go on to the review.
3. On the review, in the first card, tap **Change patron**. Pick a different patron (patron B), then **Next**. You should be back on the review.
4. Open the gear on the review (or Gear from it): A's garb should be gone, B's garb there once, and what you bought or took from the kit still there.
5. Tap **Change patron** again, tap B (it's taken off), then **Decide later**. B's garb should leave the pack; your bought gear stays.
6. If the class's leaning is set by the patron, the leaning on Who they are should follow the patron you picked.
7. A patron picked first from the review: Start over, pick the class, tap **Decide later** on the Patron step, and go on through Gear to the review. Tap **Change patron**, pick patron A, then **Next**. A's garb should now be in the pack, once.
8. A failed swap (needs a way to drop the connection, such as aeroplane mode on the tablet): with patron A picked, turn the connection off, tap **Change patron**, pick patron B, then **Next**. One toast should give the patron line, then "Couldn't swap your patron's garb. Check your connection and try again." It is an error toast and goes after the usual few seconds, like every error toast today. Turn the connection back on, tap **Change patron**, then **Next** with B still picked: B's garb should arrive once, and nothing you bought should be gone. (Opening **Change Gear** from the review finishes it too.) This one is hard to set up by hand: with the connection off from the start, the patron change itself can't save, and that failure's own toast shows instead. The garb toast shows only when the patron saved and the garb didn't; the automated test covers it.

You can then Start over to delete the test draft.

Gallery pictures expected to change: none (no screen changed).
