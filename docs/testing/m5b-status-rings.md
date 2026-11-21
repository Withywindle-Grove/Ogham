# Manual checks: m5b-status-rings (statuses as rings, plan m5b-creation-retest-3 F)

Open the pull request's Vercel preview (it uses the test project). You need a campaign where you are the GM, a player with an approved character, and a pack condition with an `icon` and a `tone` (an invented homebrew one is fine, e.g. `{ "id": "fen-sting", "name": "Fen sting", "icon": "drop", "tone": "harm", "notes": "Slow for a turn" }`).

1. **No statuses, no row.** As the player, open the character's Player screen. You should see no "Statuses" heading and no rings between the header and the vitals.
2. **A timed status.** As the GM, open the marching order (Scene), tap the character, + Status, find Fen sting, choose Other… → Turns → 6, Add. Then move the clock on 2 turns. As the player, the Player screen now shows a "Statuses" heading and one ring: a red (danger) ring two thirds full, a drop in the middle, "Fen sting" in bold and "4 turns" under it.
3. **No end.** As the GM, add a custom status "Muddy boots" with Until removed. As the player: a second ring, dashed grey, an "M" in the middle, "until removed" under it.
4. **A long name.** As the GM, add a custom status with a 40-character name. As the player: the name stops after two lines with "…". Tap it: the full name is the sheet's title.
5. **The player's sheet.** Tap the Fen sting ring. A sheet opens with the big ring, the character's name, "4 of 6 turns left", "Ends in 4 turns.", "Slow for a turn", then rows Source, Set by (the GM's name) and Log (the newest log line, with a chevron). Under them: "Only the GM changes the time left." and one button, Remove. Tap the Log row: the sheet closes and the Log opens.
6. **Remove, with Undo.** In the sheet, tap Remove. The ring goes at once and a toast says "Removed Fen sting from <name>" with Undo. Tap Undo: the ring comes back.
7. **The GM's sheet.** As the GM, from the marching order open the character and tap Fen sting. The sheet shows the same rows, no "Only the GM…" line, and **End it now** instead of Remove. Tap it: it ends at once, the toast reads "Ended Fen sting on <name>" with Undo; Undo puts it back. (There is no stepper for the time left yet: see the status file.)
8. **A secret timer.** As the GM, add a status with a timer and Hide time left from players. As the player: a ring with no arc and "time hidden"; its sheet says "Time left is the GM's".
9. **Can't cast.** Give a caster armour that stops their casting (a pack class with `spellcasting.blockedBy`). The Player screen's Statuses row shows a dashed ink ring with its first letter, the pack's name ("Can't kindle") and "while worn"; the tap explains why. Take the armour off: the ring goes (and with no other statuses the heading goes too).
10. **Encumbered is not a status.** Load the character past their limit on the Pack. Back on the Player screen, no "Encumbered" ring appears; the Pack's load bar shows the load.
11. **The light's ring (option B).** As the player, light a torch-like light on the Player screen's Light section. Its row starts with the same ring: a flame in the amber glow, the arc full, emptying as the GM moves the clock; on the last turn the words turn the warning colour with a warning sign before them. A light that never runs out shows a dashed ring with no arc and "burns on". The light is not in the Statuses row.
12. **Phone, tablet, dark.** At 375 px wide the rings wrap four to a row with space between; on a tablet they sit on one row. Switch to dark mode: the rings keep their colours (glow, danger, info, ink) and the words stay readable.

## Gallery pictures this step changes

- **players-standard** (phone and tablet, light and dark): the "Status chips" specimen is replaced by "Status rings" (tones, a long name, 0 left, 999, no end, an unknown icon, a hidden time, Can't cast, and two big sheet rings). The four committed baselines (`tests/layout/gallery-baselines/*-players-standard.png`) are deleted; CI draws new ones for Design to approve.
- No other section should change: `StatusSymbol` (marching order, overview, lights) and the other icons are untouched (the icon family's default stroke stays 1.6; only the status symbols draw at 2).
