# Seeded edge-case characters (for the tester, 2026-11-05)

One extra seeded campaign for looking at screens with messy data. **Not part of the gate run:** it never touches the fourteen Seed campaigns the gate uses. The seed script reads every number from the pack, so nothing here is a figure from a book; where a value depends on the pack, this note gives the rule and the script works it out.

## The campaign

| | |
|---|---|
| Name | **Seed · fae-woodland · edge cases** |
| Stack | fae-woodland alone, its default options (as "Seed · fae-woodland · defaults") |
| Members | the seed GM; every character held by the same seed player and **approved** |
| Kits | the class's default starting kit, unless the row says otherwise |
| Anything not named | as the defaults campaign seeds it |

If it's cheap, a twin **Seed · fae-woodland · edge cases · slots** with the pack's slot-encumbrance option on, same eight characters, so the two load bars (equipped, stowed) get the same treatment. Skip it if it isn't cheap.

## The characters

Scores are given **in the pack's own order of abilities** (first to sixth). "Average" means what the seed script already uses.

| # | Name | Kindred and class | Level and XP | Scores | Carries | What it's for |
|---|---|---|---|---|---|---|
| A | **Bram Alder** | the human kindred; the plain fighting class | level 1, 0 XP | 17, 5, 13, 9, 10, 8 | default kit | modifiers above and below zero on the tiles, saves and skills; an XP bonus from a high prime score |
| B | **Marrowby Thistledown of the Farthest Fen** (40 characters) | any kindred; the thief class | level 1, 0 XP | average | default kit | the heading and every place a name shows at 375 px |
| C | **Odo Quillfeather** | any kindred that may take it; the book-magic caster class | **level 5**, XP **halfway** between the level-5 and level-6 thresholds of its XP table, rounded down | average, except the class's prime score at 16 | default kit; spells as First spells gives them, then, if the script can, the rest of what the class knows at level 5, taken in list order | the Advancement bar mid-way, "N to level 6", spell pips, "lv N" traits already earned |
| D | **Tansy Underbough** | **the kindred and class whose traits add up to the most** (the script counts each kindred's and each class's `abilities` and takes the largest sum among allowed pairs) | level 1, 0 XP | average | default kit; if a trait has uses, one of them spent | the most trait chips, drawbacks, later-level traits, a spent pip |
| E | **Garrick Two-Sacks** | any kindred; a class that may wear the heaviest armour | level 1, 0 XP | average | default kit, the heaviest armour the class may wear, then the heaviest ordinary item added until the load is **over the rules set's most** (`maxLoadCoin`; with the slot option, both bands over their last row) by at least 1 and no more than a tenth | the load bar past its end, the "cannot move" words, Movement with no figure |
| F | **Old Hesper Many-Winters** | as E | level 1, 0 XP | average | as E, but stopped **exactly at** the top tier's limit | the boundary: the last tier, not over |
| G | **Ix** | the human kindred; a class with no first spells | level 1, 0 XP, hit points 1 | average | **nothing** (no kit, no coins) | every empty state: no items, no spells, no weapons at hand |
| H | **Wend the Unbowed** | any kindred; the plain fighting class | **the class's last level**, XP 999,999 | average | default kit | Advancement with no next level; a long number |

Notes:
- Where a row says "any kindred", use the first the class allows, and not the same one twice if another fits.
- A, G and H together cover a prime score that gives a bonus, none, and whatever average gives.
- If the script can't seed something a row asks for (the level-5 spells, a spent use, bonus hit points), leave it out and say so in the status report: don't hand-edit rows.
- All names are invented.

## What Design will look at

The full sheet and the Player screen at tablet and 375 px for each, light and dark: nothing clipped, no line starting with a separator dot, every empty section either absent or saying what's missing in words, numbers of five and six digits fitting their tiles.
