# Manual checks: fix-place-players-name (pn-1)

After the migration is on the project you test against (TEST for the preview):

1. As the GM, in a campaign with a pack attached, make a town from a pack location that has a players' name (in the pack, `playerView.name`). Start an expedition there.
2. Show players the town's description, then show players one place in town.
3. On a player's device, open the Scene. The town's box should read "In <the players' name>", never the town's own name.
4. Repeat 1 to 3 with a pack location that has no players' name. On the player's device, the box should now read "In <the town's own name>".

No gallery pictures should change.
