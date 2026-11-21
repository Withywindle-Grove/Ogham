# Manual checks: fm1-group-log-audience (fm-1: a group's travel lines, and the player's Undo of a forced march)

On the pull request's Vercel preview (test project), **after** the migration `20261111100000_fm1_group_log_audience.sql` has been applied to the test project in its turn. Two players and the GM, three browser windows (or two devices and a private window). A campaign in the wilderness with an expedition under way and a setting whose travel rules have a forced march.

**The party together**
1. GM: open **Scene**. The day starts by itself. Player A: open **Scene**, look at **Recently**. You see "<GM's name> started day 1 for the party: N points." (before, a player saw no travel line at all).
2. GM: **Move…**, pick a terrain that costs more than the points left, type a place name the players have not been shown, **Move**. Player A's Recently says "<GM> moved the party on: N more tomorrow to enter the next place." and Player A's travel card says "Entering the next place, N more tomorrow". The place's name is **nowhere** on Player A's screen. The GM's own line and card name the place.
3. Player A: tap **Force march**. The toast says "Forced march, +N points, … rest due this evening" and has **Undo**. Recently says "You forced the march with the party: +N points, rest due this evening." Player B's Recently says "<Player A's name> forced the march with the party: …".
4. Player A: tap **Undo** on the toast (within 6 seconds). The points go back at once, with no question asked; the log shows the march undone.
5. Player A: Force march again. Open **Log**, tap the line "You forced the march…", tap **Undo**. It is undone the same way.
6. Player B: open **Log**, tap Player A's forced march line. There is **no Undo** for Player B.

**Once the points are spent**
7. Player A: Force march. GM: **Move…** somewhere that uses the extra points. Player A: Log, tap the forced march line, **Undo**. A message says "That's changed since. Undo the later change first." and nothing changes. The GM gets the same message for that line; after the GM undoes the Move…, the march can be undone.

**A split party (hidden means hidden)**
8. Player B: **Split the party** (a group of their own). GM: start the day for both groups, Move… each group once. Player A's Log shows only the party's travel lines; Player B's Log shows only Group 2's ("… for Group 2"). Neither sees the other group's moves, points or places.
9. Player B: rejoin the party. GM: change the party's budget (**Set by hand…**). Player B sees that new line, and still not the party's moves made while they were away.
10. Player A: Split the party (Player A now gets "Group 2", the number Player B's group had). Player A's Log does **not** show the lines of Player B's earlier Group 2.

**Notes**
11. Player A: Log, tap one of their group's travel lines, **Add a note to this**, write a few words. Player A and the GM see the note under the line; a player who can't see the line doesn't see the note.

**The place being entered (the GM's until it's shown)**
12. GM: let the group arrive at a place (the next day pays what's owed), then on the place card add a piece and **Show** it to the group. Move the group on somewhere else, then **Move…** back toward that place with a cost above the points left. Player A's card and line now name the place ("Entering <place>, N more tomorrow"). If the place has a players' name that differs from the GM's, Player A sees the players' name; the GM sees their own.
13. The earlier line from step 2 still says "the next place" for Player A: a line keeps what was known when it was written.
14. GM: with a group entering a place, tap **Undo** on the Move… toast. The card goes back to what it showed before (the earlier place owed again, if there was one), for the GM by name.

**375 px**
15. On a phone-width window, the forced march toast with Undo fits on the screen and the Undo button is easy to tap.

Gallery pictures expected to change: none (the toast with Undo is the existing toast; no new part; the gallery doesn't draw a group entering a place, nor travel lines in Recently).
