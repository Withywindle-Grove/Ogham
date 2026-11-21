# Manual checks: the Attack sheet, weapon skill and plain-launcher ammunition (m5b-attack-sheet-as4)

Ruling `design/rulings/m5b-attack-sheet-skill-and-ammunition-2026-11-10.md` (as-4, mw-5). Use the pull request's Vercel preview (the test project), a campaign whose rules set has weapon proficiency (and its specialisation option) turned on, and a character of a class that names a proficiency category.

1. Give the character a weapon they are **specialised** in and put it in hand. On the **Player** screen, in **At hand**, tap **Attack** beside it. The to-hit card should have a row "Specialised" with the pack's to-hit bonus, and the damage card a row "Specialised" with the damage bonus. Each card's top line includes them (for a +1/+2 bonus, one and two more than before).
2. Close the sheet. The weapon's At hand line (for example "+3, 1d6+3") should carry the same totals. Tap the weapon's row, then its **Attack** row: the same two cards, the same numbers.
3. Turn the specialisation option off in the campaign's Rules. The "Specialised" rows go, and the totals drop back.
4. Put a weapon in hand that the class may use but the character **hasn't picked**. Tap **Attack**: the to-hit card has a row "Not a weapon skill of yours" with the penalty (for example −2), counted in its line. The damage card has no such row.
5. As the GM, approve a pick of a weapon **outside the class** (the restricted-weapons option on), then put it in the character's hand. Tap **Attack**: the to-hit card has a row "Not your class’s weapon" with the penalty, even though it is a picked weapon.
6. Turn weapon proficiency off for the campaign. None of these rows show, on any weapon.
7. In a setting whose rules set has **no** `attack.ammunitionBonus` rule, give a plain bow (no magic bonus) a Quiver of magic arrows (`weapon.magicBonus: 1` on the arrows) and pick them in the Quiver. Tap **Attack**: both cards have a row "<arrows>, magic +1", counted in each line. Look as the GM too: no "Not added" note.
8. Same setting, a **magic** bow drawing those arrows: the bow's row counts, the arrows' doesn't, and only the GM sees "<arrows>, magic +1. Not added: the rules don't say." under each card.
9. Mark the magic arrows cursed and look as the **player**: no arrows row, the numbers leave it out. As the GM: the row is there, marked "(hidden from the player)".
10. Arrows with a `bonusVs` entry drawn by a plain bow: a quiet note under the right card reads "<arrows>, +3 vs <foe>" (or "<arrows>, damage +4 vs <foe>" under the damage card), and the sum doesn't include it. Drawn by a magic bow (no rule), only the GM sees that note.
11. A magic bow in a category the rules set marks unidentified, drawing magic arrows: the **player** sees the arrows' row and no bow row; the **GM** sees the bow's row marked "(hidden from the player)" and the "Not added" note for the arrows.
12. A weapon the class's list lacks but a rules-set weapon rule allows (or the class form in play allows): no "Not your class’s weapon" row, matching the Pack, where it can be equipped.
13. At 375 px wide, open the Attack sheet of a weapon with the "Not a weapon skill of yours" row: the row's label wraps cleanly beside its figure. Check light and dark mode.

## Gallery pictures expected to change

- `phone-light-at-hand-actions`, `phone-dark-at-hand-actions`, `tablet-light-at-hand-actions`, `tablet-dark-at-hand-actions`: four new Attack sheet specimens in that section: magic arrows from a plain bow with no rule (mw-5), a specialised weapon, a weapon that isn't the character's skill, and a GM-approved weapon outside the class (as-4). The specimens already there are unchanged.

No other picture should change.
