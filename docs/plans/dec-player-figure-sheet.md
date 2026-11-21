# Plan: a figure's sheet in one tap, and the Saves line

Written by the lead on 2026-11-14 (night). Francis, on the built Player screen: "Saving throw is missing die icon simplify explanation to just what it takes to pass the check"; "This is two clicks away from the saving throw, it should be what's seen after the first click"; "Remove 'the rule' header and the 'for brannock' section entirely. What it changes for brannock gets relabeled 'Modifiers'"; "Yes to modifiers".

Rulings: sv-1, sv-2, sv-2a, sv-2b in `docs/design/rulings/dec-player-screen-2026-11-14.md`. Everything else ruled for this screen: `docs/design/notes/player-screen-ruled-so-far-2026-11-14.md`.

## What it is for
A player taps a save, a score, armour class or attack and reads, on the one sheet that opens, what the figure is and its rule. Today the rule is a second sheet behind a row. And the Saves section says in one line what it takes to pass, in place of the rulebook's paragraph.

## What this plan does not cover
The Player screen's new order, head, stacked buttons, toggles and pins (ps-2 to ps-10, sb-2, tg-1, pin-1). They wait for their own plan and for Francis's word on when. Nothing here moves a part on the screen: the Saves line stays where the paragraph is today, and its move into the heading's row (sv-3) comes with the redesign.

## The pieces

| # | Piece | Rulings | Picture (approved) | Size | Notes |
|---|---|---|---|---|---|
| 1 | **The figure's sheet shows its rule at once.** The part that opens when a figure is tapped (the Breakdown sheet in 06) loses its row that opens the rule: the rule's words sit in the sheet, under the figure and its parts, with no "The rule" heading, each of the rule's lines keeping its lead-in. Then the source line. One ✕, no Close. | sv-2, sv-2a | `docs/design/mockups/december/14-player-screen-for-the-player.html`, frames P7 and P7b, branch `design-december-mockups` at 93abd7f6; approved 2026-11-14 (redrawn to sv-2a, opened by the lead) | the builder sizes it first | One part, changed once: every figure that opens this sheet gets it (saves, scores, armour class, attack, and any other). Only a save and a score are drawn: see "Before merge" |
| 2 | **A score's sheet: "Modifiers".** Under the score's name and number, the heading "Modifiers" and each thing the score changes for this character, once, with what it gives ("Melee, to hit: +1."); an effect that gives nothing is still listed ("Forcing a door: no change."). No effect named twice. | sv-2a | the same, frame P7b | with piece 1 | #773 already stopped the doubled line; this is the heading and the order |
| 3 | **A save's sheet.** The save's name and number; the die line with that save's own number ("Roll d20: 16 or higher succeeds."); the rule's lines; the source. A "Modifiers" section only when a score really changes that save, saying what it gives; none when nothing does. No section about the character's class and level. | sv-1, sv-2a, sv-2b | the same, frames P7 and P7b | with piece 1 | The "Modifiers" section on a save is not drawn: built to its data and tests, and shown to Francis as built |
| 4 | **The Saves line.** On the Player screen and the full sheet, the Saves section's paragraph becomes one line: the d20 glyph (the standard Die glyph, ds-3) and "Roll d20: your save's number or higher succeeds." | sv-1 | words approved by Francis, 2026-11-14 ("Agree on wording"); the glyph is the standard part; the line is drawn in frame P1 | small | The line is BUILT from the rules set's `rolls.save` (pf-20), never typed in: a setting that rolls under reads "or lower". A rules set without the key shows no line. The key's reader and the line's builder are the cloud piece `docs/plans/briefs/dec-rolls-key-and-rule-lines-cloud-brief.md`; this piece puts the line on the screen once that has merged |

## Rules for the builder
- Read the part and its callers first, and tell the lead before building: how the rule's row is built today, and where the Saves paragraph comes from. The Builder has already found that no rules set carries the pass condition as data: pf-20 adds it.
- The rule's words are the pack's own, verbatim. The app adds no words of its own to a rule.
- Hidden means hidden: a hidden or unidentified bonus stays out of a player's sheet, as today.
- No new arithmetic: the sheet shows what the figure already counts.
- No real game, book or adventure names in code, tests or fixtures: invented saves and scores.

## Tests (each written first as a plain sentence)
- A tap on a save opens one sheet that shows the rule's words; there is no row that opens a second sheet.
- The sheet has no heading "The rule" and no section named for the character.
- A score's sheet lists each effect once under "Modifiers", including one that gives nothing.
- A save's sheet shows "Modifiers" when a score changes that save, and does not when none does.
- The Saves line reads "or higher" for a rules set that passes at or over the number and "or lower" for one that passes at or under it, and carries the d20 glyph.
- A rules set with no die or no pass condition shows no line.
- A player's sheet never shows a bonus hidden from them.

## Before merge
Pictures of the real sheets, phone light and tablet dark, to the lead for Francis: a save, a score, armour class and attack (the last two are not drawn; a piece already built is approved from pictures of the real screen), and a save that a score changes.

## ⚑ For Francis
None open. The mockup is approved; the two undrawn sheets come to him as built.

## Estimate
Not given: the builder reads the part against this plan and sizes it before starting (a plan row is checked against the code before a date is promised).

## Departures
(The builder keeps this section current in the same pull request.)

Builder, 2026-11-14 (branch `dec-player-figure-sheet`):
- **Size, as found.** One shared part (`BreakdownSheet`) changed once, plus the two sheets that pass it something new (a save's in `FigureSheets.tsx`, a score's in `CharacterSheet.tsx`) and small pure functions (`modifierEffects`, `saveModifierLines`). AC, attack, level, title, XP bonus and skills pass no rule today, so they change only by losing nothing; none had a "The rule" row.
- **The head (the lead's ruling on ⚑ 2, 2026-11-14): built to P7 and P7b** as a named variant of the Sheet's head, **Figure head** (`Dialog`'s `figure`, `BreakdownSheet`'s `figureHead`): on a save's, a score's, armour class's and attack's sheet the number sits large at the right of the head, level with the name, before ✕. Every other sheet's head is unchanged (the level, the title, the XP bonus and a skill keep the figure in bold under the head). The title is set at the save tile's size (`--text-save`), the number at AC's (`--text-ac`, 36 px; P7 draws 40 px, for which there is no token). Attack's title is now its name alone ("Attack"), since the number is beside it.
- **A save's kindred and class lines (the lead's ruling on ⚑ 1, 2026-11-14):** the class-and-level line is dropped (it says where the number comes from; it is not a modifier). A kindred's or class's bonus that changes this save goes under "Modifiers", worded as a score's line, "Vs poison: +3 from Stone kin.", "To the roll: +2 from Lantern Warden.": the kindred's bonus by its Constitution row (`saveBonusByCon`, for the saves it names) and the kindred's and class's `saveBonus`.
- **A save modifier a score drives** (`saveModifiers` `{ from, plusRaceField }`) is split into its parts (#784's review): the score's part from its filled row ("Spell ward: +1 from Lore.") and the kindred's `plusRaceField` part on its own line ("Spell ward: +2 from Stone kin."), each only when it gives something. The pack does not say which save such a modifier belongs to (it applies by situation, named in its name), so it shows on every save's sheet (left as built, the lead). Those lines leave the rule's lines (no line twice); a fixed save modifier stays with the rule's lines, as today.
- **A score's sheet:** "what it affects" ("Melee, doors, carrying") shows only when the setting has no modifier table for the score, since it names the effects a second time; the blurb and the note are the rule's lines. **The source line is added** (the lead's ruling, P7b): the pack whose rules set gives the score's table or note. A score outside its table's ranges lists nothing, as the tile's words do (#784's review).
- **The rule's lines are the pack's own, one paragraph each.** Lead-ins show where the pack writes them; the app splits and labels nothing.
- **Piece 4 and the save sheet's die line are built on #776's reader and line builders** (`savesLine`, `saveOwnLine` in `src/modules/library/rolls.ts`, nothing copied). `SaveTiles` takes the rules sets and draws both, so the Player screen and the full sheet show the same line. Both use the standard Roll row (the glyph, the words in bold at body size); frame P1 draws the words at normal weight.
- **The full sheet's paragraph under the tiles is gone** (the rule's first sentence, A2): the Saves line takes its place. No pack carries `rolls` yet, so until each rules pack gains it from its own book, neither screen shows a line under the saves; the rule's words are still on every save's sheet.
