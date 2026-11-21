# Manual checks: fp1-weapon-keys-follow-pack

Ruling fp-1 (2026-11-10): on a pack item, a weapon's modes, range, magic bonus and bonus against a foe follow the pack as it is now.

1. On the pull request's preview, open a campaign whose setting pack has a bow with modes, and a character who has owned that bow since before the latest pack update, with magic arrows in the pack.
2. Open the character's Pack and tap the bow's Quiver; pick the magic arrows.
3. Open the bow's Attack sheet. You should see the arrows' magic as one row ("<arrows>, magic +1"), and no second +1 from the mode itself: the to-hit line is one lower than before this change.
4. If the bow had a mode chosen that the pack has since renamed, the Quiver shows the first arrows it can fire, as for a new bow.
5. Pick a character who has owned a stack of magic arrows since before the pack corrected their bonus (or their bonus against a kind of foe). Choose those arrows in a plain (non-magic) bow's Quiver and open the Attack sheet. You should see "<arrows>, magic +N" with the pack's current number, and under the to-hit the note "<arrows>, +N vs <foe>" as the pack has it now, not the old one.
6. A typed one-off weapon (added by hand, not from the pack) looks exactly as before.

No gallery pictures are expected to change.
