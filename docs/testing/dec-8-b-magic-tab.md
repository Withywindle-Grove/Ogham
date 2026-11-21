# Manual checks: dec-8-b-magic-tab (the Magic tab, December step 8 piece B)

Built to `docs/design/mockups/magic/04-magic-tab.html` (approved 2026-11-10). No migration: it uses piece A's state, so piece A's database session must be on the project the preview uses (TEST).

## On the pull request's preview, a phone (or a narrow window, 375 px)
1. Sign in as a player whose character casts spells (a class with spell slots). The tab bar at the foot reads **Player, Scene, Pack, Magic, Log**; Magic's icon is a crescent moon with a small spark.
2. Open **Player**. There is no Spells section any more; Traits, At hand, Skills and Saves are as before.
3. Open **Magic**. The tab's words are in the book's type (the same faces as character creation); the bar at the foot is not. The first row is **Prepare**, a spell-book icon before the word and a chevron at the right; under it the heading **Spells**. With nothing ready it says **Nothing ready**.
4. Tap **Prepare**. The Prepare spells pop-up is the one the Player screen had. Take one spell twice and save. The toast says "Prepared 2 spells" with Undo.
5. Back on Magic: one row for that spell (not two), with two filled dots after its name, its duration and range under it, and **Cast** at the right: an open palm with a star above the word Cast. The level line reads like "Level 1, 2 a day".
6. Tap **Cast**. At once, no question asked: the toast says "<spell> cast" with **Undo**, and one dot turns hollow (filled first, hollow last). Tap **Undo**: both dots are filled again.
7. Tap the spell's name (not Cast). The spell opens in the book's type (mm-12): its name as the book's heading; **Level**, **Range** and **Duration** each a line with its label first ("Range 30 ft"), worked out for the character; no "Rules" label; then the spell's whole description as the pack sets it out (a bold lead-in, a list's items each on its own line); its page last ("From your setting's rules: …"); **Cast** at the foot. Tap **Cast** there: the sheet closes and one dot goes hollow.
8. Tap **Cast** on the row again. The spell is now crossed out, its line says **Cast**, there is no Cast button, and it sits below any other spell of that level. Tap it: its rules open with **Got it** at the foot (a tick above the words), no Cast.
9. Open **Log**. The casts read "You cast <spell> for <character>" (the spell's name, not "a level 1 spell"), and the Undo as "took back a cast".
10. Sign in as a player whose character casts nothing (a fighter). The bar is four tabs: Player, Scene, Pack, Log. No Magic tab.
11. Light and dark mode (the device setting): repeat 5 and 8. The crossed-out spell still reads "Cast" in words; the dots are filled and hollow shapes, not only colours.

## A tablet in landscape
12. The caster's left column lists Player, Scene, Pack, **Magic**. On Magic: the play column on the left, the full character sheet on the right (as on Player). In the sheet's Magic section there is **no "Prepared" tab**; it opens on the Spell book for a book caster.
13. Open the full sheet on its own (a phone: Player, then "Full character sheet"). Its Magic section **does** have its Prepared tab.

## Messy data
14. A spell with a very long name wraps inside its row; Cast (the icon above its word) stays at the right, at least 44 px wide and tall, and the row is no taller than the name's lines or the button.
17. Other rows with a button (a trait's **Use** on Player, a weapon's **Fire**) still show the small word button, no icon.
15. Open a spell with a long description on a phone: the sheet scrolls, the heading and the ✕ stay usable, Cast is reachable at the foot. A spell with no notes and no blurb shows its labelled lines and its page only.
16. A place's rules (a GM's place card, **Rules**; a player's rule button) read exactly as before: `RuleText` only moved.

## Gallery pictures expected to change
Eight pictures: `{phone,tablet}-{light,dark}-molecules.png` and `{phone,tablet}-{light,dark}-phone-navigation.png` in `tests/layout/gallery-baselines/`, for the two specimens below.
- **"Use dots (2 of 3 left, none left) and the Magic tab's spells by level (dots a casting, Cast; a cast one crossed out, last)"**: new (it replaces "Use dots … and prepared spells by level (highest open; …)"); the Spell level is now the Magic tab's (level line, Cast, dots), not a folding list.
- **"Tab bar, a caster's phone: five, Magic current (mm-2)"**: new.
- Any layout picture of a caster's Player screen: its Spells section is gone, and the bar has Magic.
