# Manual checks: m5b-hidden-data-cache-and-patches

Run on the pull request's Vercel preview (it uses the test project), once the migration is on TEST. You need a GM account and a player account in the same campaign, on two devices or two browsers.

1. **A patch on an item players can't see.** As the GM, import a small homebrew pack with an item marked not for sale (`"forSale": false`) and a patch naming it by id, then attach it. As the player, open Add item: the item isn't there, and the Rules screen shows no line about that patch. As the GM, show the party the item. Reload as the player: the item and its patch's figure now show.
2. **A patch on a hidden field.** In the same pack, add a patch on a rules set's `monsters` section and one on a field an item keeps in `gmOnly`. Re-import. As the player: neither patch shows anywhere, and the update line in the log doesn't name them. As the GM: both show, and the GM's update line names them.
3. **Stored copies refresh.** As the player, open the campaign once (the device stores its copies). As the GM, in the campaign homebrew, mark an item not for sale. As the player, close and reopen the app: the item has left Add item.
4. **Two campaigns.** With the same player in two campaigns that both use one setting pack: reveal an item in the first, then remove the reveal. Reopen the second campaign as the player: the item is gone there too.

No gallery pictures should change: no screen changed.
