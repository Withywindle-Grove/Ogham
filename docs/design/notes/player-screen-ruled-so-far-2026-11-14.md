# The Player screen: what is ruled so far

Written by the lead on 2026-11-14, after two misses in one night (the pin's star, the status ring's symbol). One sheet of every ruling in force for the Player screen, part by part, so a drawing or a build starts from it. From now on a sheet like this goes into every Studio brief before anything is drawn.

How to read it: the newest ruling wins. "Tonight" means Francis's rulings of 2026-11-14 on mockup page 14 (`docs/design/mockups/december/14-player-screen-for-the-player.html`), which are being written into the evening rulings file. Sources: `09` = `docs/09-decisions-log.md` (by date), `05`, `06`, PLAN = `docs/plans/m5b-players-screens-standard.md`, R3 = `docs/design/rulings/m5b-creation-retest-3-2026-11-08.md`. Compiled from a scout's list; three ruling files were not opened (see the end).

## The whole screen

| Ruling | Source |
|---|---|
| The glance screen for play; each part shows only when the character has it; each figure opens its rules in one tap | 09, 2026-10-26 |
| Order, tablet (tonight, ps-2 to ps-5). Left: the head; hit points; armour class and attack; the weapon in hand; At hand; Details last. Right: scores; saves; movement and load with its bar; the list of traits with uses; skills; languages; the full character sheet | tonight |
| Order, phone (tonight, ps-2a): the left column, with the saves directly under hit points and armour class; then the right column | tonight |
| No marching order and no party list on this screen; they live on Scene (ps-4) | tonight |
| The tablet's left is for what the player does now, the right for reference; nothing shows on both | 09, 2026-11-09 |
| iPad and PC first; the phone a distant third (mc-9) | 09, 2026-11-11 |
| No line explains what the screen already shows (mc-46) | 09, 2026-11-12 |
| Never a disabled button; one accent button; 44 px targets with 8 px between; nothing under 14 px; Undo over confirm | 06 |
| Colour may carry a distinction alone only where its mockup shows it with the hue removed and Francis approves (cr-c1) | 09, 2026-11-12 |
| A sheet has one bare ✕ at the top right and no Close button | 06; mc-43a |
| **A row's button is the stacked button**: the icon above, its word under, every button one size, at the right of its row (mc-36a, "Keep stacked button as the standard"; the Scene's Way button). On this screen: Attack, Wield, Put out, Use, Edit | 09, 2026-11-12; tonight |
| An icon with no fitting picture in the set takes the set's generic mark over its words (pf-12e) | 09, 2026-11-13 |
| Commas, never a middle dot, and no "… ›" links | PLAN A |
| "Arrange this screen" is gone: the order is fixed | 09, 2026-10-26 |
| The book's type everywhere (ts-1 to ts-3; cs-40, cs-40a, cs-40b for tiles and lone number boxes) | 09, 2026-11-12 and 2026-11-13 |
| Icons are medieval or fantasy, from the one icon set, each credited (ds-5, ds-6, ds-6a) | 09, 2026-11-12 |

## The head

| Ruling | Source |
|---|---|
| The bar reads name, "the" kindred, title; a larger portrait; class beside the level with the experience bar; the company (ps-3, ps-5) | tonight |
| The title is the class's level title from the pack, overridable, hidden if there is none | 05 |
| A tap on the portrait opens the portrait sheet (choose, take a photo, remove) | 09, 2026-11-08 |
| A kindred-as-class character shows the kindred its class names | 09, 2026-10-29 |
| A same-named kindred or class from two packs shows "(from <pack>)" (sn-1) | 06 |

## Statuses

| Ruling | Source |
|---|---|
| Rings, not chips: a ring in the tone's colour that empties with the time left; **the status's symbol in the middle**; name and time in words under; dashed with no end; the count and the actions on the tap (R3-6) | 09, 2026-11-08; R3 |
| 25 approved symbols (mockup players/03); a pack names each status's symbol and its tone (light, harm, boon, neutral). A letter is only the fallback when a pack names no symbol | 09, 2026-11-08 |
| The symbol is centred, about half the ring's width; the ring is 52 px with a 5 px stroke ("the ring's size is right") | 09, 2026-11-08; 06 |
| To the right of the portrait; four in view, the rest one tap away; a tap opens that status's details (ps-5) | tonight |
| Time hidden reads "time hidden"; run out reads "ran out" | 09, 2026-11-08 |
| Encumbered is not a status: it is the load bar's job | 09, 2026-11-08 |
| No row and no heading when there are none | 06 |

## Hit points

| Ruling | Source |
|---|---|
| Change in place: the figure at the left (48 px, the screen's one focal number; a tap types a value), − and + squares together at the right (56 px, 8 px apart), each tap applied at once, taps within two seconds folded into one logged change with one Undo | 09, 2026-11-08 (mockup players/04, alternative C) |
| The segmented bar under the figure: one segment per hit point up to 12, one per 5 above; never a plain bar; bonus hit points are a separate band | 05; 06; tonight ("Hp gets its bar back") |
| − stops at 0, + at the maximum, and the toast says so | 06 |
| No maximum recorded: the number alone and a small "Set max"; no hit points yet: "—, tap to set" | 05; 06 |
| Someone who can't change it still sees the squares; a tap says who may | 06 |

## Armour class and attack

| Ruling | Source |
|---|---|
| Armour class shows whenever the sheet or setting has one. With no value anywhere: "—" and a quiet "Set AC", never a guessed number | 05; 06 |
| Attack: one figure with a sub-line "Melee +1, missile −1" | 05 |
| A tap on either opens its one sheet. Tonight (sv-2, sv-2a, sv-2b): one sheet, the rule shown at once, no "The rule" heading, no "For <name>" section, what changes the figure headed "Modifiers" | tonight |
| Hidden or unidentified bonuses stay out of the player's numbers | 05 |

## The weapon in hand, attack rows, dice

| Ruling | Source |
|---|---|
| Wherever a die is named, its glyph goes with it (ds-3); glyph colours by die | 09, 2026-11-12; 06 |
| A pinned weapon not in hand shows **Wield**; in hand it shows **Attack**; one button per row (ah-2) | 09, 2026-11-08 |
| The Attack sheet opens with the two rolls, to hit then damage, each with its glyph and one line; the app never rolls | 09, 2026-11-08 to 2026-11-10 |
| A weapon with modes has one mode button beside its action, named Quiver, Pouch, Grip or Stance, never "Mode" (ah-3, ah-4) | 09, 2026-11-08 |

## At hand

| Ruling | Source |
|---|---|
| Fills itself with what is in hand and with worn or held things that have uses, each only if it has an action; pins add the rest | 09, 2026-10-23, 2026-11-07, 2026-11-08 |
| **The pin is a star**: in the head of a thing's sheet beside ✕, empty "Pin to top", filled "Unpin"; a pinned line starts with the small filled star alone; a toast with Undo both ways | PLAN C; 09, 2026-11-07 |
| On the Player screen an unpinned thing that is there by itself has no star | 09, 2026-11-08 |
| Each thing shows once | 05 |
| A memorised or ready spell can be pinned to At hand and cast from there (mp-15). Not found built | 05 |
| A pinned trait with uses shows in At hand and leaves the right's list (tonight: the approved star extended). Not built | tonight |
| A row's body opens the thing's sheet; its button acts | PLAN |

## Light

| Ruling | Source |
|---|---|
| A lit light leads with the status ring as its glyph (a flame, the glow tone, the arc is the burn left), then its words and buttons; one that never runs out is dashed | 09, 2026-11-08 |
| Lights kept their own "Light" section on this screen. Tonight's order does not name it: see "Not settled" | 09, 2026-11-08 |

## Saves and scores

| Ruling | Source |
|---|---|
| Saves are tiles in the pack's order with the pack's one-word short name; five across at 375 px, a word too wide makes three and two; a name wraps between words, never inside one | 09, 2026-11-09; 06 |
| The saves' rule line is one sentence with the d20 glyph, built from the rules: "Roll d20: your save's number or higher succeeds." (sv-1), in the heading's own row (sv-3) | tonight |
| Scores are tiles with the score's full name and one modifier under; **always two rows of three**; **every tile the same size**, with or without a modifier | 09, 2026-11-09; gate walk 2026-11-05; tonight |
| The scores get a matching rule line with the die glyph in their heading's row, where the rules have such a check (sv-3) | tonight |

## Movement and load

| Ruling | Source |
|---|---|
| Movement: one figure per mode, whole numbers, in the book's unit (mv-1) | 09, 2026-11-13 |
| The load bar: its tier marks and label, the tier's name first | 06 |
| On this screen, movement and load sit third on the right, the speed said once | tonight |

## Traits with uses

| Ruling | Source |
|---|---|
| The list is headed **Traits**, not Abilities: one word, one meaning on a screen | 09, 2026-11-05 |
| Each row has Use (one tap, Undo in the toast); with none left it stays a button and says why | PLAN B |
| One dot per use, filled while left, hollow when spent, with "N left" in words; giving a use back is in the trait's sheet | 06; PLAN B |

## Skills and languages

| Ruling | Source |
|---|---|
| Skills are rows: the name at the left, the odds in the pack's own style, a chevron; the sheet states the odds both ways | PLAN B; 05 |
| Languages are boxes with one line on reading and writing | 09, 2026-11-08 |

## Spells and coin

| Ruling | Source |
|---|---|
| A caster has a Magic tab; this screen has no Spells section (mp-20, mp-21) | 09, 2026-11-05 and 2026-11-12 |
| Coin is on the Pack tab (pu-1 onward); nothing puts a coin line on this screen today | 09, 2026-11-13 |

## The full character sheet

| Ruling | Source |
|---|---|
| A row with a chevron on the phone; beside the screen on a tablet, with Edit by its heading | PLAN |
| One Edit screen: details save at once; a score, a level or maximum hit points goes to the GM | 09, 2026-11-08 |

## Added by the second audit (2026-11-14)

| Ruling | Source |
|---|---|
| A weapon with modes carries its mode button beside its action, and its line names the mode in use ("Quiver: Arrows ×18"); a spent mode blocks the action, which explains (ah-3, ah-4) | `m5b-at-hand-actions-2026-11-08.md`; 06, Pack groups |
| A lit light's row has Put out, Keep lit (a toggle that stays pressed, with ⓘ) and, for a holder, Refill (N left) | 05; 06, Light section |
| Tile labels: whole words only, no letter-spacing, never a break inside a word (F8) | 06; 09, 2026-11-09 |
| A player's tablet top row is the campaign link, Log (the open book), Messages, ⋯ | 06 |
| Units with a space, in the book's unit ("60 ft") | words and voice, rule 5; mv-1 |
| The Skills section opens with the class's skills note when the pack has one | 06 |
| The tablet's fold handle sits on the divider between the rail and the column (lr-4) | 06 |
| Prompts (the urgent strip with the weather, "No light", Waiting for you) sit above hit points, their space collapsing when empty; only a prompt carries the screen's accent button | 06; 09, 2026-11-09 |
| Down shows quietly at 0 and opens the death panel; bonus hit points are their own band | 06 |
| A class with forms has its form switch by the level | 06 (eq-8) |
| Sheet changes waiting for the GM show the old figure with a Waiting line | 09, 2026-11-08 |
| End turn and Delay live on this screen in a fight (M6, not built) | `m6-fight-screens-review-2026-11-01.md` |

## Not settled

- Whether lights keep a "Light" heading of their own or sit in At hand with their ring.
- Four status rings beside the portrait have no room for names under them: the ruling says names under, tonight's says a tap gives the details.
- Whether the 25 status symbols are redrawn from the icon set.
- Pinning a spell and pinning a trait: sizes from the Builder.
- Whether every rules set carries a check against a score in a form the line can be built from.

## Specs that have fallen behind the log (to fix in one docs pass)

`05` still describes a Spells section, a damage pad on hit points, skills in two columns and one quiet explainer line under the tiles; `06` still names the old type pair and "statuses as chips"; PLAN still says the play column leaves out saves. The log is right in each case.

## Not opened when this was compiled

`docs/design/rulings/words-and-voice-ruled.md`, `m6-fight-screens-review-2026-11-01.md`, `m5b-sheet-review-2026-11-04.md`.
