# Plan: creation retest 3 and statuses as rings

Written by the design agent, 2026-11-08. Rulings: `docs/design/rulings/m5b-creation-retest-3-2026-11-08.md` (R3-1 … R3-6). Mockups: `docs/design/mockups/creation/final/10-roll-for-a-name.html`, `docs/design/mockups/players/02-status-rings.html` (both approved 2026-11-08). Francis: "95 % there; careful with regressions." Two pull requests, in this order, after #558 (D) merges and before the app-wide sweep.

## PR 1 · creation (m5b-creation-retest-3)

### A · Roll for a name (R3-1, R3-2)
1. Who they are: the Name tables fold row goes. Under the Name field one plain button **Roll for a name** with the die glyph of the table it opens (the first table's die when several). No describing table of kind names in any attached pack → no button. On a tablet (the step's 65ch column with room) the button sits beside the field.
2. One table → its sheet opens at once (the sheet approved as R2-8, with tabs per part, numbered rows, ✓ on the pick). Several → a sheet listing them (name, pack, dice) with Open; ← in a table's sheet returns to the list.
3. The sheet's first line is the pack's **`rollPrompt`** when the table has one; otherwise "Roll d<N>, then tap the rows." **Use this name** (the sheet's one accent) joins the picked parts in the pack's part order, fills the field and closes; under the field a line "From <table>, rolled 3 and 14" stays while the field holds that name; editing the field keeps the line off. Roll for a name stays for a re-roll.
4. `rollPrompt` is a new optional string on describing tables (07; pack:check accepts it; Pack Creator fills the homebrew pack and bumps it). The app never composes a prompt from part names.

### B · Tables start collapsed (R3-4)
5. Every describing table on a creation step (trinkets, backgrounds, the rest) starts collapsed under its row; the row or its button opens it. Names are covered by A.
5b. (R3-4b) In a long table's sheet (d100 and the like) rows are grouped by 25 ("1–25", "26–50", …), each group the inventory's fold row, all collapsed; opening one shows its rows; the picked row's group stays open; a d20 or shorter table has no groups.
5c. (R3-7, mockup creation/final/11) Adjust scores and the Class step: the small two-column table from the rules set's `primeRequisiteXp` (range, experience %) lives inside Help me choose, the row the character's prime falls in washed and marked "you" (the lower prime with two); the step keeps one line under the lead: the modifier now and the next band's threshold; the Class rows' fit line says the experience now as today; a pack without the data draws no table.
5d. (R3-8) A pick-up-to-N table (Gear's starting items, any describing table with `pick` > 1) allows the same row more than once: Pick on a picked row adds one, the button reads "Picked ×2" (×3…), a − square beside it puts one back; "n of N picked" counts picks, not rows; each pick and put-back is one toast with Undo; the items land in the pack as a stack or as separate items per the item's own stacking rule.
5e. (R3-9) No option row's Pick is the accent (Race, Class, any pick list): plain Pick everywhere, Next the one accent. Remove the first-row accent.
5f. (R3-10) The item entry sheet (weapons, armour, gear) shows the pack's full text: description, qualities, damage and use, cost, weight, source, Pick at the foot.

### C · Gear's words (R3-3)
6. The Gear lead ("Your character has … to spend") and its Help me choose quote the coin rule in force: the kit rule's dice when a kit rule applies to this class, else the setting's. One source for the Roll row, the lead and the Help.

### D · Non-class weapons (R3-5)
7. Weapon skills: the "Not your class's weapons" group keeps its fold row, collapsed, with the pack's rule text as its line. Its rows gain Pick; a picked one carries the sign and "Needs the GM's special approval", lands on the GM's card as an exception with the pack's rule text as the why; the review names it. Same path as a closed class (final drafts C ⚑3), same tests.

### E · No pill chips in creation (R3-6)
8. The review (mockup creation/final/12, approved): race, class and alignment are plain text on their cards ("Race: Phase Elf"); **Derived values are tiles** (the Score tile with the name, the figure, and the parts line under; a word figure at 16 px; three across, four past 1000 px), no commas between; **the saves are their own group** under a "Saves" label (five across on a tablet, three on a phone, the pack's count); a tile opens the figure's breakdown sheet as today.
9. Adjust scores' trade chips take the square chit (4 px corner). No `border-radius` above the tokens' 4 px anywhere in creation.

## PR 2 · statuses as rings (m5b-player-status-rings)

### F · The Status ring (R3-6, players/02)
10. New inventory part **Status ring** (06, Code column): a 52 px ring, 5 px stroke, track in the rule token, arc = time left / full span in the tone's colour token (light → glow; harm → danger; boon → info; neutral → ink); the status's symbol in the middle in the same colour; name (bold, two lines max, then …) and the time left in words under it; a 72 × 88 px tile, 12 px between; dashed track and no arc when the status has no end. 84 px, 7 px stroke in its sheet.
11. The Player screen's Statuses row uses it; the row and its heading are not drawn with no statuses. **Encumbered is not a status** (the load bar); remove it from the row if it is one today.
12. Tap → sheet: the big ring, "<n> of <m> <units> left", when and by whom, what the status does, Source, Set by, the log line (chevron), and the player's one action where a command exists (Put out, Drink, End rest); GM-only changes named in a line, not offered. The GM's sheet adds a stepper for the time left and End it now; both logged with Undo.
13. The symbol set is `docs/design/mockups/players/03-status-symbols.html` (approved 2026-11-08): 25 symbols (flame, star, ghost, shield, arrow-forward, arrow-back, bolt, eye-slash, eye-half, sun-slash, lock, chain, bed, moon, stone, spiral, hand, drop, blot, feather, bread, cup, snowflake, skull, crack), SVG stroke 2, added to the app's `icon` list. A condition's **`icon`** (the existing field) names its symbol; a new optional **`tone`** (light, harm, boon, neutral) gives the ring's colour (glow, danger, info, ink); `family` keeps its meaning (the pack's grouping). With no icon: an ink ring and the first letter; with no tone: ink.
14. Over the span (extended past its start): a full ring and the words. Run out: an empty ring and the status's own ending words ("burnt out") until its rule ends it.

## Rests on
R2 rulings and #555; the R2-8 sheet; the Score tile and Breakdown sheet (D, #558); the closed-class approval path; the Pack's load bar; the clock's units on statuses (if a status has no unit, the ring is dashed and the words say what the app knows: a scope check if that is common).

## Tests (purpose first)
- No name table → no button; one → its sheet; two → the list, Open, ← back.
- Use this name fills the field in part order and writes the "From …" line; editing clears the line; re-roll replaces it.
- The sheet's first line is the pack's rollPrompt when present, the fallback otherwise.
- Trinket and background tables start collapsed; the row opens one.
- Gear's lead and Help show the kit rule's dice for a class under a kit rule and the setting's for one without.
- A non-class weapon can be picked; it shows the sign; the GM's card lists it with the pack's text; approving or refusing works as for a closed class.
- The review draws derived values as tiles with no separators; a tile opens its breakdown.
- A status with 4 of 6 turns draws a two-thirds arc in its family's colour; one with no end a dashed track; none → no row; 999 and 0 draw; a 40-character name clips at two lines.
- The status sheet shows the count and the one action; the GM's stepper and End it now log with Undo.
- No element in creation or the Player screen has a border radius over the token.

## Scope checks (write one and stop)
No change to the R2-8 sheet's internals beyond the prompt line and Use this name. No new status kinds. No change to how statuses are set or timed; the ring only reads what exists. Encumbrance stays on the load bar; if any rule depends on the Encumbered status, write the check.

## ⚑
1. A status whose clock has no unit the ring can read: dashed with the words, or hidden? (Proposed: dashed with the words.)
2. The Player screen's other chips (if any beyond statuses): square chits, assumed under R3-6.

## Estimate (for the Builder to confirm)
PR 1: A one day; B, C half a day together; D half a day; E half a day: about 2.5 days. PR 2: F one day. One builder, after #558, before the sweep (the sweep then inherits the chit rule).

## Departures
(The Builder keeps this current in the same pull request.)
