# Plan: the Attack sheet, made clear

Written by the design agent, 2026-11-10, during the pause of the M5b gate rewalk. Francis ruled it in (`design/rulings/m5b-attack-sheet-clarity-2026-11-10.md`, as-1 … as-3) and picked layout B from mockup `design/mockups/players/09-attack-sheet-clarity.html`. One small pull request, branch `m5b-attack-sheet-clarity`, wanted before he resumes the walk.

## What it delivers

The Attack sheet (At hand's Attack, on the Pack and the Player screen) reordered so the two rolls come first and read as plain lines, with their parts as rows; the range under its own heading; no repeated word.

## Rests on

| Read | For |
|---|---|
| The ruling, as-1 … as-3, and the mockup (B; its "other cases" are drawn as A but are built as B) | the sheet |
| `design/rulings/m5b-at-hand-actions-2026-11-08.md` ah-1 … ah-4 | the content that stays: every part with its source, the rules that bear, what it inflicts, the fight-rules line, the mode's spend |
| The Builder's read of 2026-11-10: `weaponBreakdown` returns running totals with the parts named in the labels; each part's own figure is there | rows show parts, the line shows the sum |
| 06 Components (the breakdown sheet's rows; the dice icons) | build from listed parts; name the roll card as a variant there |

## Build order

1. **The roll card** (a named component): the die's icon, the line, the rows. Two on the sheet: to hit, then damage.
2. **The line's words.** "Roll <die> + N to hit" and "Roll <dice> + N for damage"; zero dropped from the line; "− N" for a negative; a floor or a dice-changing rule in words under the line. For a setting whose attack is a target or a table, the line names the die and what to add, and the pack's words say how the hit is read: no "to hit" sum is invented.
3. **The rows:** one per part with its own figure (the class at its level, the score, the mode, the weapon's die, a score that doesn't add said in words). No running totals.
4. **The range** under "Range, in <unit>" as bands, when the weapon carries `weapon.range` (G-219, from the Pack Creator); otherwise the quality's text stays under Rules that bear, as today.
5. **as-3:** the app's own "two-handed" is skipped when a quality already says it, whatever the case.
6. **The rest of the sheet** unchanged, below: Rules that bear, Inflicts, the fight-rules line, the spend button.
7. Gallery and layout scenes for the sheet (a bow with a range, a melee weapon with a bonus on both rolls, a long name with nothing to add and a minus, a target-figure setting), 375 px and tablet, both themes; the components inventory's Code column; 05 and 06 updated in the same pull request (the ruling's absorbed-into list).

## Tests (each purpose as a plain sentence first)

- The to-hit line shows the sum of its rows, and each row shows its own figure, not a total.
- A sum of zero drops "+ 0" from the line while the rows still show their zeros.
- A damage penalty reads "− 1" on the line.
- A weapon whose quality says "Two-handed" shows the word once.
- A weapon with a range field shows three bands with the unit; one without shows the quality's text as before.
- In a setting with a target figure, the line names the die and invents no sum.
- At 375 px a 50-character weapon name wraps in the sheet's head and the line stays whole.

## Pictures

This redraws an approved sheet from an approved mockup, so its pictures are announced changes: they merge first with the `design-look` label, and Design looks after (`docs/testing.md`, The component gallery).

## ⚑ for Francis (collected, not decided)

1. **A magic weapon's bonus:** mw-1 and mw-3 rule that it counts in attack and damage, as M6 app work. Without it this sheet's new line leaves a magic weapon's bonus out. Bring that reading into this pull request, or keep it for M6 and say so on the sheet? Asked 2026-11-10; the Builder is sizing it.

## Estimate

The Builder's, when it claims it: it called either layout "cheap to build" on 2026-11-10; a picture round follows.

## Departures

Kept by the builder (2026-11-10).

- **The magic bonus is in (the ⚑ above, answered yes by Francis on 2026-11-10).**
  - mw-1: `weapon.magicBonus` is a row in both rolls, counted in At hand's line and the item sheet's breakdown.
  - mw-2: each `bonusVs` entry is a note under the roll it changes, never added.
  - mw-3: the drawn ammunition's bonus is a row under `attack.ammunitionBonus: "add"`.
  - mw-4: with no such rule, the GM alone sees a note in the ruling's words, "Ember arrows, magic +1. Not added: the rules don't say."
  - An unidentified or cursed weapon's bonus is hidden from the player, and the GM sees it marked.
  - Ammunition, by its category, no longer counts as a weapon, even with a `weapon` block carrying its bonus (the Pack Creator's watch-out).
- **The range follows G-219 as agreed on #588.**
  - The shape is `range: { unit, wildernessUnit?, from?, bands: [{ name, upTo, toHit }] }`, on the weapon or on a mode; the mode in use is read first, then the weapon.
  - The first band reads "5 to 160" with `from`, else "up to 70"; later bands read "up to 320".
  - The heading isn't expedition-aware: "Range, in feet (yards outdoors)" whenever the pack gives a `wildernessUnit`, plain "Range, in feet" without one. The Pack and Player screens have no clean reader for a wilderness expedition. Design accepted this on 2026-11-10.
  - Bad data falls back to the quality's text.
- **The item sheet's Attack row (sq-4) opens the same Roll cards** (Design, 2026-11-10), so the two never disagree. No gallery specimen opens it, so no extra picture changes.
- **Notes on the card.** The target figure's note sits just under the line. The notes the sum leaves out (bonusVs, the GM's ammunition note) sit under the rows (Design, 2026-11-10).
- **The card's edge** is the passive rule colour, not the control colour the mockup drew: the card isn't tappable.
- **A floor or a dice-changing rule under the line** has no pack field yet, so nothing shows for it.
- **The log never shows a weapon mode's id** (Design, 2026-11-10, after #596 brought pack-entry modes to owned items). When the line's own copy doesn't name the chosen mode, the line reads "Sam changed how Eel spear is used." (`describeEntry`, `src/core/events.ts`; tested). Showing the real name for a mode that exists only on the pack entry is a follow-up on the after-gate list.
