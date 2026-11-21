# Manual checks: dec-7 piece 3, a place's own check and its rules

Branch `dec-7-3-place-check-and-rules`. You need the preview (it uses the TEST database, after the coordinator's TEST session for `20261113120000_dec_7_3_place_check_and_rules.sql`) and an adventure pack whose region carries `rules` and an `encounterCheck` with `replacesScheduled: true` and `when: "eachMove"` (the island-keep adventure's harbour does, from 0.2.9). Use two devices or two browsers: the GM and one player.

1. As the GM, start an expedition and use **Change place** to pick a spot inside the harbour (for example the jetty). The place card now has a **Rules** button next to Change place.
2. Tap **Rules**. You should see the harbour's encounter check first, with a toggle that is on, and the line "The Drowned Harbour's own rule. It stands in for the setting's … while the party is here." (with the harbour's and your setting's own names). Under it is "This place's other rules", one row per rule, each with an eye. A rule the pack keeps for the GM has a struck-through eye and says "The book keeps this for the GM."
3. Tap a rule's name. Its sheet opens with the book's words, the table under a coloured title, and the source line. Close it with ✕.
4. Tap the toggle. It goes off at once and says "Not in force." A toast says the harbour's check is off and the setting's applies here. Tap **Undo**: the toggle is on again.
5. With the toggle on, tap **Next turn** a few times. The mode's wandering check never comes up while the party is in the harbour. ⋯ → **Encounter check** still rolls the harbour's check.
6. As the player, before the GM shows anything of the spot: the place line shows nothing, and there are no rule buttons.
7. As the GM, show the spot's description. As the player, the place line shows the description and a button with the scales mark and the rule's button words (for example "Someone fell in"), at the LEFT under the description (rp-10); with two such rules, two buttons in a row that wraps on a phone. Tap it: the rule's sheet opens with the book's words, the spot's own name and "Rules" under the name (for example "1 The jetty. Rules": the harbour was never shown to them, so its name isn't sent), and only ✕ to close. Then move the party to the harbour itself, show it, and come back: the same sheet now says "The Drowned Harbour. Rules".
8. As the GM, tap that rule's eye in the Rules sheet. As the player, within a moment, the button is gone. Undo on the GM's toast brings it back.
8a. As the player, open "Someone fell in" and keep its sheet open. As the GM, close that rule's eye. On the player's screen the sheet stays, its words go and "Your GM has closed this rule." shows, with only ✕ to close. As the GM, open the eye again: the words come back on the player's open sheet (rp-8).
9. As the GM, tap the crossed eye of the rule the book keeps for the GM. A pop-up says "The book keeps this for the GM: players never see it." and nothing changes; as the player, that rule never appears.
9a. As the GM, start an expedition, set the party in the harbour, go to **Players** and tap **Next turn** twice on the compact strip. The mode's wandering check never comes due there.
10. Check the log as the GM: one line per switch ("opened … to players", "switched off …"). As the player, none of those lines show.
11. Phone (375 px wide): the Rules sheet fills the screen, long rule names wrap, and the rule table scrolls sideways inside its box rather than widening the page.
12. Light and dark mode: the sheet, the table title and the buttons read clearly in both.

## Gallery pictures expected to change
- **Places section**: one new specimen, "A place's rules for players (dec-7 piece 3)". It shows the place line with the rule button and a rule's text with its table. A new picture; no existing picture should change.

## Not checkable yet
- The players' Encounter check fact ("On every move", the die, "1 in 6") has no screen yet (scope check 1 in the status file); only its data is built.
- Raising the harbour's check on each move waits for piece 4 (Move on).
