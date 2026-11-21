# Manual checks: the Attack sheet made clear (m5b-attack-sheet-clarity)

Ruling `design/rulings/m5b-attack-sheet-clarity-2026-11-10.md` (as-1 … as-3, layout B) and a weapon's magic (mw-1 … mw-4, brought forward on 2026-11-10). Use the pull request's Vercel preview (the test project), a campaign with a character who has a weapon in hand.

1. Open the character's **Player** screen. In **At hand**, tap **Attack** beside a melee weapon. You should see two cards first: "Roll 1d20 + N to hit" with a yellow d20 drawing, then "Roll 1dX + N for damage" with its die. Under each card's line, one row per part (for example "Fen warden, level 2 · +1", "Might 16 · +1"). Each row shows only its own number; the card's line carries the sum.
2. Pick a character whose bonuses cancel out (for example +1 from the class and −1 from a score). The line should read "Roll 1d20 to hit", with no "+ 0", and the rows still show +1 and −1.
3. Tap **Attack** beside a bow. The damage card should show "Might · not added to a missile" when the setting adds Might to melee damage only. If the pack gives the bow a `range` field, a "Range, in feet (yards outdoors)" heading shows below the cards with three bands ("Short", "5 to 160", "+1 to hit"…). If it doesn't, there's no Range heading and the range stays in the qualities' text, as before.
4. On a weapon whose qualities already say "Two-handed", the **Qualities:** line says it once.
5. In a campaign using descending armour class, tap **Attack**. The to-hit line should read "Roll 1d20 + N" with no "to hit", and under it "The GM reads the hit from the roll and the foe's armour." The class's row reads "hits armour 0 on 19" (the class's figure).
6. With a magic weapon (a pack item with `weapon.magicBonus: 1`): its At hand line shows the bonus counted in (for example "+3, 1d8+2"), and on the Attack sheet both cards have a row "<weapon>, magic · +1". With a `bonusVs` entry, a quiet line under the right card reads "+3 vs bog lurkers" (or "damage +4 vs …" under the damage card), and the sum doesn't include it.
7. Mark that weapon cursed (or use one in a category the rules set marks unidentified) and look as the **player**: no magic row, no note, and the numbers leave the bonus out. Look as the **GM** on the same screen: the row is there, marked "(hidden from the player)".
8. A bow with a Quiver drawing magic arrows (`weapon.magicBonus` on the arrows): where the rules set says `attack.ammunitionBonus: "add"` the arrows get their own row ("Ember arrows, magic · +1"). With no rule, the player sees nothing extra and the GM sees a note under each card's rows: "Ember arrows, magic +1. Not added: the rules don't say."
9. Magic arrows don't show up as a weapon: they keep **Fire** in At hand, they get no Wield or Attack, and the class check never blocks them.
10. Tap the weapon's row in At hand (not its Attack button) to open the item's sheet, then its **Attack** row. The same two cards should show, with the same numbers as the Attack sheet and the At hand line.
11. At 375 px wide (a phone, or the browser's device mode), open the Attack sheet of a weapon with a long name: the name wraps in the sheet's head and each card's line stays on its own line. Check light and dark mode.

## Gallery pictures expected to change

- `phone-light-at-hand-actions`, `phone-dark-at-hand-actions`, `tablet-light-at-hand-actions`, `tablet-dark-at-hand-actions`: the Attack sheet is redrawn as two Roll cards with their parts (as-1), the bow's range under its own heading (as-2), "Two-handed" said once (as-3), and five new Attack sheet specimens: melee, messy (a long name, a zero, a minus), a target figure, a magic weapon with notes, and magic arrows from a magic bow under the add rule.

No other picture should change.
