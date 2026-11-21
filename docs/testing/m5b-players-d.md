# Manual checks: m5b-players-d (the full sheet on the standard, slice D)

Plan `docs/plans/m5b-players-screens-standard.md` (slice D), mockup `players/01-player-pack-sheet-standard`. Open the pull request's Vercel preview (it uses the test database), sign in as a player with an approved character that has a class, ability scores and saves (a caster too, for step 9), and open the campaign.

## On a phone (or the browser at 375 px wide)

1. **Open it.** On the Player screen, tap the last row, **Full character sheet**. The bar reads ← at the left, "Full sheet" in the middle, ⋯ at the right. No Edit in the bar.
2. **The head.** The portrait, then one line in the pack's words: "<Name>, <Class> <level>, <Kindred>, <Alignment>" with commas, no "·". Tap the class or the kindred in that line: its entry opens as a sheet.
3. **Combat.** Four tiles, two across: hit points with "1d8 a level" under it (the die, no score modifier), AC (the campaign's own word for it, if its sheet layout has an AC field) with what you wear, the attack with "melee +1, missile +0" (commas), Level with "120 of 1,500 experience". Tap each: a sheet rises from the bottom with the number first and the parts under it. No "Got it" button; ✕ or a tap on the dimmed page closes it.
4. **Scores.** Six small tiles in **two rows of three**: the pack's short name ("MUS"), the score, and one modifier under it ("+1"), never two side by side. Tap one: the sheet's title is the full name ("Muscle"), the score first, then what it does and its modifiers in the pack's words ("+1 melee, −1 AC").
5. **Saves.** Five small tiles (the same as on the Player screen). Tap one: the same sheet as on the Player screen.
6. **The fold rows.** Movement, Skills, Traits, Languages and (for a caster) Magic each show as one full-width row, the same row as the Pack's Gear and Party stash: the name in bold (not small capitals), a short line under it kept to one line (a long one ends in "…" at the row's end) ("Speed 40, Exploring 120"; "5: Hark 6+, …"; "Fen common, Heron-tongue"), and a square with **+** at the right edge. Tap a row: it opens in place and the square shows **−**; tap again to close it. Leave one open, go back and come in again: it's still open.
7. **Skills, opened.** One row per skill: the name, the kindred's note under it where there is one, the value at the right, a chevron. A long group ends with a small button "N more" (no "›"). Tap a skill: the sheet starts with the odds in words ("Succeeds on 5 or 6, 2 in 6").
8. **Traits, opened.** The chips under small headings that read "Kindred: <kindred>" and "Class: <class>" (a colon, no "·"); a drawback chip reads "<name>, drawback".
9. **Magic, opened** (a caster). The tabs read "Spell book: 4", "Prepared: 1" (a colon). A long tab ends with "N more" as a small button.
10. **The foot.** At the very bottom: "Up to date" at the left, then **Back** and **Edit**, both plain (neither in the accent colour). Tap Edit: the edit form; Cancel. Tap Back: the Player screen.
11. **After a save.** Edit, change Notes, Save: the foot's line reads "Saved.".
12. **Offline.** Turn the network off (airplane mode, or the browser's offline switch) with the sheet open: the foot's line reads "Offline. Saved on this device" with the warning sign, on one line. Turn it back on: "Up to date".
13. **No dots or arrows.** Anywhere on the sheet and in every sheet it opens: no " · ", no "›", no "▲" (the Pack load section's insides are slice C's).

## On a tablet in landscape (or the browser at 1180 × 820)

14. **The split.** The play column on the left has no Skills and no Saves. The sheet on the right, from the top: Level as a row with "<N> of <M> experience" and its bar (a tap opens its breakdown), the class form if any, Scores (six tiles, two rows of three), Saves (tiles), then **Movement** and **Languages** as rows with a chevron, then Skills, Traits and Magic folded with + at the edge, then the Pack load and the rest.
15. **The rows beside.** Tap Movement: its figures open in a sheet beside the row. Tap Languages: the languages, each opening its entry.
16. **Folded beside.** Tap Skills: it opens in place (−); tap again to close it.

## On a tablet in portrait (or the browser at 834 px wide)

17. The full sheet from ⋯: two columns, Combat, Saves, Movement, Pack load and Skills on the left, Scores, Traits, Magic, Languages and the rest on the right; the foot at the bottom with Back and Edit.

## Gallery pictures this pull request changes (for Design)

- **full-sheet-standard** (new): the Score tiles (six; messy: a long short name, 0 and 999, a score not filled in), the fold rows (redrawn after Design's review on #558: the Pack's fold row, full width, the bold name, the summary one line ending in "…" at the row's end, the square at the right edge), the Level row with its bar and Movement and Languages as rows, a score's breakdown sheet, and the foot (up to date; offline).
- **molecules**: the trait chips' group titles read "Kindred: Reed kin" and "Calling: Lantern keeper"; a drawback chip ", drawback" and a later one ", lv N" (no middle dot).
- **sheet-magic**: the Magic tabs read "Spell book: 5" (a colon), and a long tab's "N more" is a small button.
- The **molecules** and **sheet-magic** baselines are left out of this pull request (after the merge with main), so CI draws them fresh for Design's look.
- The layout scenes that show the full sheet change too (full-sheet, full-sheet-open, full-character, sheet-edit, the magic scenes): the identity line, the Score tiles, the Save tiles, the fold rows, the foot, and beside the Player screen the one-column sheet with Skills and Saves moved over.
