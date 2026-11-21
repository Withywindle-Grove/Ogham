# Manual checks: dec-hd2-ways-on-read

Run on the pull request's Vercel preview (it uses the test project), once the migration is on TEST. Until then the preview can't load a campaign's setting rules (the app asks for a function the database doesn't have yet): expected, not a bug in the preview.

You need a GM account and a player account, and two campaigns of that GM that both use one setting pack, with the player in both.

1. **Nothing changed for one campaign.** As the player, open the first campaign: Add item, the Rules screen and character creation list what they listed before. As the GM: the same, with the GM-only entries.
2. **A reveal stays in its campaign.** As the GM, in the first campaign, give a character an item that isn't for sale (so the party knows it). As the player, reopen the first campaign: the item is in Add item. Open the second campaign: the item is not there.
3. **A sale stays in its campaign.** As the GM, in the first campaign's homebrew, mark an item of the shared pack "For sale in shops". As the player: it shows in the first campaign's Add item, not in the second's.
4. **Stored copies.** As the player, after this update, the first start downloads the setting rules again once (the stored copies are replaced). Later starts are as fast as before.
5. **The ways on (no screen yet).** Nothing to tap: the Move on sheet (step 4, piece b) draws them. Until then the database tests are the check (`supabase/tests/dec-hd2-ways-on-read.test.ts`, run by CI).

No gallery pictures should change: no screen changed.
