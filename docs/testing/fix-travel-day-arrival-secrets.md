# Manual checks: fix-travel-day-arrival-secrets

Only after the migration `20261114100000_fix_travel_day_arrival_secrets.sql` is on the database you test against (the
pull request's Vercel preview uses the test project). You need a campaign with a wilderness expedition under way, you
as the GM, and one player on a second device.

1. As the GM, on Scene, open the travel card and tap **Move…**. Type a place name the players have never seen (for
   example "The Sunken Causeway") and a cost larger than the points left today. You should see "Entering The Sunken
   Causeway, N more tomorrow".
2. On the player's device, the travel card should say the party is entering the next place, with no name.
3. As the GM, tap **Next day**. The toast should say the party arrived at The Sunken Causeway, and Scene's place
   should be The Sunken Causeway (before this fix: no place name).
4. As the GM, tap **Undo** on that toast. The clock goes back a day, and the travel card again says "Entering The
   Sunken Causeway" with the same points owed. The player's card still shows no name.
5. Tap **Next day** again, then **Move…** with a small cost and no place: the party moves on as usual.

Gallery pictures expected to change: none (no screen changes).
