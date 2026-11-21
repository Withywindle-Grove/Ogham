# Manual checks: a figure's sheet in one tap (`dec-player-figure-sheet`)

Plan `docs/plans/dec-player-figure-sheet.md`; rulings sv-2, sv-2a, sv-2b; mockup `docs/design/mockups/december/14-player-screen-for-the-player.html`, frames P7 and P7b.

Open the pull request's Vercel preview, sign in as a player with an approved character in a campaign whose setting has saves and scores.

1. **A save, one tap.** Open the Player screen. Tap a save tile. One sheet opens: the save's name with its number large beside it, then the setting's words on saves, then "From your setting: …". There is no "The rule" row and no second pop-up, and no line "… for a <class> at level N"; there is one ✕ at the top right. If the kindred or class gives a bonus to this save, it is under "Modifiers" ("Vs poison: +3 from <kindred>.").
2. **The same on the full sheet.** Open the full character sheet, tap a save: the same sheet.
3. **A score.** On the full sheet, tap a score tile. The score's name has its number large beside it. Under them: the heading "Modifiers" with each thing the score changes, one line each ("Melee: +1."); a middling score still lists its effects with "no change". Under them, with no heading, the setting's words on the score, then "From your setting: …". No effect is named twice.
4. **A save a score changes.** In a setting whose rules have a save modifier from a score (a bonus against hexes from a score, say), with a character whose score gives it something: tap any save. "Modifiers" shows the line ("Against hexes: +1 from <score>."). With a score that gives nothing, there is no "Modifiers" heading.
5. **Armour class and attack.** Tap AC and the attack figure: each sheet has its number large beside its name ("Attack", not "Attack 18"); the rest is as before (AC's "Clear the AC set by hand" row is still there when AC was set by hand). Tap a language or a spell: its sheet's head is as before, with no number.
6. **Phone and dark mode.** At 375 px wide and in dark mode, repeat 1 and 3: nothing runs off the side, the heading "Modifiers" is readable.

7. **The Saves line, with today's packs.** No pack carries `rolls` yet. Under the save tiles on both screens there is no line, and the full sheet no longer shows the rule's first sentence there. Tap a save: the rule's words are on its sheet.
8. **The Saves line, with a rules set that has it.** On the test project, give a test rules set `"rolls": { "save": { "die": "d20", "pass": "atOrOver" } }`. Under the save tiles on both screens: the yellow d20 glyph and "Roll d20: your save's number or higher succeeds." Tap a save with 16: its sheet reads "Roll d20: 16 or higher succeeds." with the glyph. Change `pass` to `"atOrUnder"`: both lines read "or lower".

## Gallery pictures expected to change
- Players' standard section: the save's breakdown sheet (the rule's words on the sheet, no chevron row; a roll line), and a new specimen, a save with "Modifiers".
- Full sheet section: the score's breakdown sheet ("Modifiers" heading and one effect per line).
