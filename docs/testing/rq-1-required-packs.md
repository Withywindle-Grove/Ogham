# Manual checks: rq-1-required-packs

On the pull request's preview (test project), as a GM. Packs below are any two in your library where one names the other in `meta.requires` (a conversion pack and the pack it converts).

1. Make a campaign and attach only the conversion pack (not the pack it needs). Open the campaign, then **Rules**.
2. On the conversion's row, under its "Version …, N items" line, you should see the warning sign and, in bold, "<Conversion> needs <Base>, which isn't attached to this campaign.", then a small button **Attach <Base>**.
3. Tap **Attach <Base>**. If it has optional rules, they open first: tap **Add to this campaign**. You should see "<Base> was added to this campaign."; the line on the conversion's row is gone, and <Base> is in the list.
4. Remove <Base> from the campaign again (its row's ⋯, Remove from this campaign): the line comes back.
5. With a pack whose required pack is not in your library at all: the line ends "Import it into your library first." and has no button.
6. New campaign, the setting rules step: pick a pack that needs two packs and pick one of them. Its line reads "Needs: <the other>." only. Pick both: "needs <A>, <B> ✓".
7. At phone width (375 px): the line wraps and the button sits under it, nothing cut off.

Gallery pictures expected to change: none (no gallery scene has an attached pack with a missing required pack). Pictures of steps 2 and 5 go to Francis before the merge.
