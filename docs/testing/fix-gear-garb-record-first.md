# Manual checks: fix-gear-garb-record-first

Nothing on screen changed: this fix only changes the order in which the Gear step saves and takes garb out, when it opens on a patron changed since. The failure it guards against needs the connection to drop at one exact moment, so it can't be set up by hand; the automated test covers it. What you can check is that the ordinary path still works.

On the live app after the merge, in a campaign with patrons switched on and a class that follows a patron:

1. Tap **Create your character**, then **Guided**. Pick the class, then a patron (patron A). Go on through the steps to **Gear**. You should see A's garb in the pack.
2. Go on to the review. Tap **Change patron**, pick patron B, then **Next**. You should be back on the review.
3. Tap **Change Gear**. A's garb should be gone and B's garb there once; anything you bought stays.
4. Tap **Back to review**, then **Change Gear** again. Nothing should change: B's garb still there once, nothing of A's, nothing you bought gone.

You can then Start over to delete the test draft.

Gallery pictures expected to change: none (no screen changed).
