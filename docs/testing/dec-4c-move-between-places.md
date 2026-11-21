# Manual checks: dec-4c-move-between-places

This piece has no screen, and its migration is held (applied nowhere). So nothing can be tapped through yet. The checks below are for later, once the Move on sheet (piece b) is in and migration `20261111150000_dec_4c_move_between_places.sql` is on the test project, on the pull request's preview.

Set up: a campaign with an adventure pack of linked places, an expedition under way in a turn-scale mode, one character with a light lit that has 2 turns left, and a status on them with 2 turns left. Nothing of the place the ways lead to has been shown to the players yet.

1. [ ] As the GM, tap **Move on** and pick a way that takes 1 turn. The place card shows the new place and the clock is 1 turn on. The light is still lit.
2. [ ] Pick a way that takes 3 turns. The clock is 3 turns on, the light has burnt out and the status is gone.
3. [ ] Open the log (Simple). There is one line for each move, such as "You moved the party to The Moth Gallery: Rowing, 3 turns.", with what ran out after it. There is no separate "moved the clock on" line for the same move.
4. [ ] Sign in as a player (another browser). Their log says "The party moved on: 3 turns.", with no place name and no way. It never says "moved the clock on". They see nothing of where the ways lead.
5. [ ] As the GM, show the players one piece of the new place. Reload the player's log: the same line now reads "The party moved to …: 3 turns.", with the name players see for that place.
6. [ ] As the GM, tap **Undo** on the 3-turn move. The party is back at the place it left, the clock is back, the light is lit again with its item back in the pack, and the status is back. The GM's log says "You undid the move to …: the party is back at …."
7. [ ] The player's log says "The party went back." If a piece of the place they are back at had been shown to them, it says "The party is back at …." instead.
8. [ ] Go back to a place where a piece was shown earlier. The piece is shown again, and the log has one line for the move, not two.
9. [ ] Split the party (one character into a group of their own), then tap **Move on** and pick a way. It is refused with "Join the party up first: for now a move between linked places takes the whole party." in a pop-up, and nothing moves. Move on is still there to tap (not greyed out, not hidden). Join up, and the move works.
10. [ ] On two GM devices, advance the clock on one, then tap Move on from the other without refreshing. It is refused with "That's changed since. Here's the latest.", and the party has not moved.

Gallery pictures expected to change: none.
