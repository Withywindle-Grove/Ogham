# Manual checks: m5b-tile-full-names (gate finding F8, gate check 69)

Delivers the 2026-11-09 ruling "Tiles name things in full": a Save tile shows the pack's short name, else the first word of the save's name, never the key; a Score tile shows the ability's full name. A label never breaks inside a word: the row takes fewer columns instead, one height per row.

1. Open the pull request's Vercel preview on a phone (or a browser 375 px wide), sign in as a player and open a character in a **fae-woodland** campaign (its saves have no short names: this was the "D" bug). On the Player screen, each save tile shows a word, the first word of the save's name, never a single letter. No tile ends in "…" and no word is split across two lines. All tiles in a row are the same height.
2. Open the menu (≡) and tap **Full character sheet**. Under **Saves**: the same words as on the Player screen. Under **Scores**: each tile shows the ability's full name ("Strength", not "STR"). The three tiles in each row are the same height, even if one has no modifier line under its number. If a name has a word too long for three across, the scores sit two to a row instead, still with whole words.
3. Open a character in a **classic-advanced** campaign: the save tiles show the pack's one-word short names (Death, Wands, Paralysis, Breath, Spells).
4. Tap a save tile and a score tile: each opens its breakdown sheet titled with the full name.
5. On an iPad in landscape, the sheet beside the Player screen shows the same words, whole, one height per row.
6. Optional: the component gallery (`/gallery.html` on the preview) at phone width. In *The players' screens*, the second Save tiles row ("Breath of the drowned") sits as three and two. In *The full sheet*, "Score tiles, messy" sits two to a row. No word is split in either.

Gallery pictures this step expects to change (14):

- `players-standard` (phone and tablet, light and dark: 4): the Save tile labels lose their letter-spacing. The long short name wraps between words, and on a phone its row re-flows to three and two.
- `full-sheet-standard` (4): the Score tiles show full names without letter-spacing; on a phone the messy row ("Stubbornheartedness of the drowned bells") re-flows to two columns.
- `molecules` (4): the Skills and saves specimen's Save row has new words ("River", "Mire", "Save X" in place of "River", "M", "X") and no letter-spacing.
- `creation-review` (phone light, phone dark: 2): the review's Derived values tile "Armour of the long cold of the drowned abbey" was cut after two lines and now wraps whole. On a tablet it fits in two lines, so the tablet pictures stay as they are.
