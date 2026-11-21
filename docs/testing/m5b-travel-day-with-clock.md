# Manual checks — m5b-travel-day-with-clock (F86, F87)

Needs the migration `20261112100000_fix_travel_day_with_clock.sql` on the project the preview uses (TEST). Until
then Next day into a new day is refused on the preview.

Use a campaign with a day-by-day travel mode (a pack with a travel budget), one GM and one player, an expedition
under way.

1. **F86.** As the GM on Scene, tap Move… and enter a cost above the day's points with a place name. The card says
   "Entering <place>, N more tomorrow".
2. Still the GM: go to Players. On the small time strip there, tap Next day. You should see "Next day, …" with Undo.
3. As the player, open Scene. The travel card shows the new day, and the party has arrived at the place. Tap Force
   march.
4. As the GM, back on Scene: Time options (⋯), Make camp.
5. As the player: "Rest due (forced march)" shows in camp's Sleep step, and the Rest day card is open.
6. **F87.** New day or new expedition. As the GM, Move… a small cost. Go to Players, tap Next day on the small strip.
   As the player, open Scene: the travel card shows the full new day's points (for example "Leagues 12 of 12"), not
   yesterday's.
7. **Undo.** As the GM on Scene, tap Next day, then Undo on the strip. The clock goes back and the travel card shows
   the day before as it was (its points spent, what was owed).
8. **Undo refused.** Tap Next day, then Move… on the new day, then Undo on the strip (not the move's toast). You
   should see "That's changed since. Undo the later change first." and nothing goes back. Undo the move (Log), then
   the strip's Undo works.
9. On Scene, Next day shows the same morning toast as before this change: "Day N, <points>, …" (unused points
   lost, or the arrival).

Gallery pictures expected to change: none.
