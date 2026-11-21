# Manual checks: the creation walk's small fixes (`creation-walk-small`, cut from `fix-creation-walk-small`)

On the pull request's Vercel preview (the test database).

## Play as on the joined toast
1. As the GM, open a campaign → **Rules** → **Rules for this campaign** → **Characters**, and set **New characters need approval** to No.
2. As a player of that campaign who already plays one approved character (call it Ash), open ⋯ → **Your characters** → **+ Make another character**, and make a character (call it Reed) to the review. The review's button reads **Create character**. Tap it.
3. You land on Ash's Player screen. The toast reads **"Reed has joined the party."** with **Play as Reed** on its right. Ash is still the one played until you tap it.
4. Tap **Play as Reed** before the toast goes (6 seconds). A toast reads **"Reed is now your active character."** and, within a second, the screen shows Reed's Player screen.
5. Let the toast go without tapping (make a third character): nothing changes; the new one waits in Your characters, where tapping its card plays it as before.
6. A brand-new player of the same campaign, with no character yet: make a first character and tap **Create character**. The toast reads "<name> has joined the party." with **no** Play as, and the screen shows that character (it became active by itself).
7. With a long name (25 letters or more), at 375 px wide: the toast's text and its **Play as …** wrap inside the toast; nothing runs off the screen.

## The First spells foot
8. Make a book caster whose First spells step has a Pick group, a roll table and cantrips (in the fen fixture, the Reed Witch). With nothing picked, the foot reads **"2 spells, 1 roll and 2 cantrips to go"** (the numbers follow the class).
9. Pick every spell in the Pick group. The Pick group reads "2 of 2 picked" and the foot now reads **"1 roll and 2 cantrips to go"** (before: "1 spell and 2 cantrips to go").
10. Pick the cantrips: the foot reads "Roll d4 at the table, then tap what it shows" (unchanged). Tap a row: the foot reads "<N> spells in your book" (unchanged).

## Gallery
No picture changes: the gallery shows neither the First spells step nor this toast.
