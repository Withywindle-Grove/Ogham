# Manual checks: dec13-fix-p1-departures (the Player screen brought to frame P1)

Open the pull request's Vercel preview, then `/layout.html?as=player&p1=1`, and tap "The Storm Lantern Road".
Compare with frame P1 (`docs/design/mockups/december/png/14-P1-tablet-at-rest-light.png` at commit 4303bd32).

1. Tablet held sideways (1180 × 820). The menu at the left shows three icons. Tap the small handle beside them: the menu opens and reads "Player", "Scene", "Pack" in words.
2. The two tiles under hit points read "Armour class" and "Attack" in ordinary letters (not small capitals); the six score boxes read "Muscle", "Nimbleness" and so on the same way; "Hit points" keeps its small capitals. The Attack tile's figure reads "+1" (with its plus sign, as P1's "+2").
3. The "Lore 9" box has nothing under the 9 (no "+0"); "Muscle 15" still shows "+2".
4. The top row's icons, right to left: ⋯, then the envelope (Messages), then the open book (Log). The book comes first.
5. Movement: the left card reads "120 paces" large and, under it, "Speed, 40 paces in a fight". Tap it: its sheet lists Exploring too.
6. The right card reads "Light", its bar, then "260 of 1,200 coins’ weight", all at the left and upright (not slanted).
7. At hand, "Eel knife": the star before the name ("★ Eel knife"); under it a d20 glyph with "d20 +3" and a d4 glyph with "d4". No "+20, 1d4".
8. Traits, "Steady flame": a black dot (ink, not the accent colour) before "1 of 1 left, back each day". Tap the name, tap the star in its sheet's head to pin it: in At hand it reads "★ Steady flame", the star before the name. Tap Undo.
9. At the foot, "Abilities" reads "Oath of light, Experience bonus" (no "Steady flame"); "Traits" and "Notes" are still there.
10. The weapon in hand (Reed spear) reads "d20 +3 to hit" and "d6 damage".
11. At phone width (375 px), light and dark: nothing runs off the side; the knife's dice line and the dot fit.

Gallery pictures expected to change: the Player screen's whole-screen pictures and every `player-*` layout picture of `?p1=` (the labels, the Attack tile's sign, the top row, the dice lines and the star before the name, Movement in paces, the ink pips and the foot); the Pack tab's and the full sheet page's top row (the Log now before Messages); any full-sheet picture with a score whose modifier is nothing (no "+0" now). No component gallery section changes (its At hand rows don't take the Player screen's `playerAtHand`; the ink pips and the star before the name are new variants, so the old parts draw as before).
