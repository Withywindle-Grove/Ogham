# Plan: the Scene's quick fixes (ruled 25 November)

Written by a designer worker on 2026-11-26, from the driver's brief. Plan only: no code, no ruling changed here. Row: `plan-scene-quickfix`.

**Why now.** Francis, 26 November: "Scene fixes and pack are top priorities." A builder seat is free; these rows need no frame of page 44.

**What it covers.** Of Francis's 27 notes on the Scene ([`../intents/scene-feedback-2026-11-25.md`](../intents/scene-feedback-2026-11-25.md), "the notes"), only:

- the eight his own words settled on 25 November: F1 a, F3 a, F7 a, F10, F11 a, F17, F18, F22;
- the faults the designer classed as bugs: F20 c and F21 b (a machine ID where a name belongs), and F20 a (a shown treasure that did not reach the players' Scene).

**Sources.** The ruling file `docs/design/rulings/scene-feedback-2026-11-25.md` is **not on `main` yet**: it is on the branch `design-scene-feedback` (pull request #102, a draft, read at f422129). Its `09` line of 25 November is copied to `main` with this plan. Everything else in that file (sf-2, sf-4 to sf-11, sf-13 to sf-18, the eleven questions of 26 November) waits for page 44's frames and is **not here**.

**Status: Q1, Q3, Q4, Q6, Q7 and Q8 are ready for a builder once this plan is on `main`. Q2 and Q5 wait for the driver's word:** each would be built twice (see "Two rows that would be built twice"). One question for Francis (⚑ 1) changes nothing a builder starts on.

## How it is built

- **These are changes to built screens, with no new frame.** Each visible row names the approved frame it departs from. It is **approved from pictures of the built screen, after Home Two's audit of it** (the rule for a piece already built). Its pull request shows the built screen beside that frame. Nothing is merged on the standing yes before Francis has seen those pictures.
- **Parts are changed, never copied.** A row that reaches a shared part says how far.
- **Nothing new reaches a player's device** in any row. A row that would need it stops (see "Held").
- **No new command, no migration, no stored data changed.** Row Q8 may find otherwise; then it stops and reports.
- **Examples are invented** (a Bog lurker, silver-tipped arrows, "3. The Breakwater").
- **Each batch adds its own layout spec file**, so batches never meet in one spec.

## Second pass: what the check against the code changed

Read against `main` at c61f0f4.

- **F22 is two things.** The GM's own rows already show the number (`MoveOnParts.tsx`, `keyedName`). The rows with no number are the players' rows. For a place the group knows **in the Area it is in**, the number is already on the player's device (the players' card's read, `place_card_for_players`, lists that Area's known places with their numbers), so Q2 can show it. A known place in another Area has its name on the device but not its number (the ways' read sends none), and a place not yet explored has neither: sending those numbers is the hidden-data ruling of 26 November (⚑ 6 there), with a change to the ways' read and frame 44-11. **Those are held, so Q2 alone leaves some rows without a number.**
- **F10 is ruled twice.** 25 November: the line folds with the top. 26 November: the row leaves the Scene (⚑ 4 there), which waits on frames 44-13 and 44-21. Q5 builds the first, small; the second removes it later.
- **Two rows meet the rule on rework** (`09`, 2026-11-13, [process]: each thing is built once, in its final place). Q5's line is ruled off the Scene; Q2's rows are redrawn by sf-9. Both are written out in full so they can start on a word, and both wait for that word.
- **F3 a reverses a built, approved order.** The code and frame TF1 put the fold mark after the menu button; his words put the menu last.
- **The machine IDs are stored words.** `composePackPlace` writes the pack's ids into a piece's GM-only columns when the place is made. Q7 names them when the line is drawn, so places already made are fixed too and nothing stored changes. sf-6 later replaces the line with a detail row; it needs the same look-up from an id to a name, so Q7 builds that as a helper sf-6 keeps.
- **F20 a has no cause yet.** `public.scene_pieces` sends every shown piece whatever its kind, and the players' card draws every kind. Q8 reproduces first.
- **The handover's numbers are not the ruling file's.** See "The handover's note".

## The rows

Sizes are a designer's guess, in builder turns low / likely / high. **Permission cases: none in any row** (no new command; `can()` is untouched).

| Row | Item, his words | What changes | Seen? It departs from | Files (likely) | Tests (purpose) | States and 375 px | Size |
|---|---|---|---|---|---|---|---|
| Q1 | **F1 a.** "Locations should be ordered sequentially, with locations that have no sequence at the beginning" | In every list of Locations: places with no map number first, in the pack's order; then by number, as numbers (0, 1, 2 … 9, 10, 11). "0" is a number and reads "0. Name". The lists: the Depart list's groups, a pack's tree in the place picker, "Near here", the GM's Locations list, the GM's "Where to?" rows and the players' "Where to?" rows (after Q2). **Not changed:** "Recently visited" (newest first), search results (best match first), hexes (already by map number), and rooms, floors, buildings and Areas (the pack's order, until their own sittings). One helper, used by all. | **Yes, order only.** No frame draws another order. It changes two written rules: the pack's order (`departLocationGroups`, `childrenOf`; page 24, DP1, approved 2026-11-18) and the players' rows by name (`playersDestinationsOf`; page 18, PL1, approved 2026-11-14) | `src/modules/expedition/placeTree.ts` (the helper; `childrenOf`, `rootsOf`, `nearHere`), `sceneTop.ts` (`departLocationGroups`), `moveOnWays.ts` (`destinationsOf`), `playersWays.ts` | Places with no number come first, in the pack's order. 2 comes before 10. 0 comes before 1 and reads "0. Name". Two places with one number keep the pack's order. Each of the six lists is in that order. Recently visited and search are unchanged. Rooms and hexes are unchanged. | No number at all; all numbered; 0; 999; a number with a letter ("4a"); one Location; forty; two Areas in one list; 375 px (order only, nothing moves) | 1 / 1.5 / 2.5 |
| Q2 | **F22.** "these should all be numbered even if unknown" (the half that sends nothing new) | On the players' "Where to?", a row whose place the group knows, in the Area the group is in, reads "N. Name" by the place page's own rule (`keyedName`), the number taken from the known places the players' card already reads. A place with no number keeps its name alone. **A known place in another Area keeps its name alone** (its number is not on the device; held with sf-9). The tap's pop-up title carries the number too ("To 3. The Breakwater, rowing"). A row not yet explored is **as built** (named by its way, "Not yet explored."). The GM's rows already show the number: a test pins it. | **Yes.** Page 18, PL1 and PL5 (approved 2026-11-14): the players' rows by name alone | `src/modules/expedition/playersWays.ts` (`playersDestinationsOf`, `wayTapWords`), `src/app/PlayersWhereTo.tsx` and its caller (`src/app/PartyGroups.tsx`) to hand it the known places | A known place of this Area with a number reads "N. Name". A known place of another Area reads by its name alone. A name that already starts with its number is not doubled. A known place with no number reads as today. An unexplored row is unchanged and carries no number. **Nothing new is read:** the ways' read (`campaign_ways_on`) is called as before and its answer is unchanged (the existing database test still passes, untouched). Every GM row shows its place's number where the pack gives one. | Known and numbered; known, no number; known, in another Area; not explored; a long name with a number; the stale list (PL9); loading; 375 px (the row's name wraps, the ways' buttons under it as built) | 0.7 / 1 / 2 |
| Q3 | **F3 a.** "'...' should be the rightmost buttons to the right of '-'" | In the Scene's band, during an expedition, the order is: the quick marks, Next turn, the fold mark, the menu button. The menu is last. Focus follows the same order. The fold mark keeps "−" and "+" (the chevron is sf-18, held). **On a phone nothing moves:** the fold mark stays at the heading's right, and the menu is already the last button of its line. | **Yes.** Page 24, TF1 (approved 2026-11-18 with fix): "the fold mark … after the menu button". TF1b (375 px) is unchanged | `src/app/SceneBand.tsx` (the band's order; its head comment), `src/app/SceneBand.css` (the mark's margins; the phone's grid) | On a tablet the menu button is the rightmost of the band's buttons and the fold mark is at its left. Each is 44 px with 8 px between. The Tab key reaches the fold mark before the menu. With no expedition (no fold mark) the band is unchanged. On a phone the band is unchanged. | Unfolded; folded; folded with a fact due; a long place name with its turn; Start session and Resume (no fold mark); the side column open (a narrow band); 375 px; dark | 0.3 / 0.5 / 1 |
| Q4 | **F7 a, F11 a.** "These buttons should be centered"; "These boxes should be centered" | During an expedition, on the GM's Scene and on the players', fewer than four fact tiles stand centred in their row, each keeping a quarter of the row (the width it has today). Four tiles: unchanged. Where the column fits fewer than four across (the side column open), each tile keeps today's width and a line that is not full stands centred. Between expeditions: unchanged (already centred, T4 and T5). **On a phone: unchanged** (two by two; ⚑ 1). | **Yes.** Page 16, T1 and T8a (approved 2026-11-14, st-1): the facts from the left. Page 18, PL1 (approved 2026-11-14) for the players' top | `src/app/SceneBand.css` (`.scene-facts`; a named variant beside `--centred`), `src/app/SceneBand.tsx` (`FactsRow`), `src/app/SceneTime.tsx` (the two places it is drawn) | With one, two and three facts the group's middle is the row's middle, and each tile is as wide as with four. With four facts nothing moves. A tile's value still keeps to one line. On a phone nothing moves. The players' top does the same. | 0 facts (no row), 1, 2, 3, 4; a fact due; Light in the dark; a long value (cut, as built); the side column open; 375 px (unchanged); dark; Larger text | 0.5 / 1 / 1.5 |
| Q5 | **F10.** "'encounter check, nothing due' should be part of the collapsed menu" | With the top folded, the quiet line "<what brought it>, nothing due" is not drawn. Unfolded, it is as built. Its toast still says it when it happens. A card with something due never folds ("Waiting for you" never folds). Between expeditions there is no fold: unchanged. *Short-lived: the ruling of 26 November takes the line off the Scene once frames 44-13 and 44-21 are approved.* | **Yes.** Page 24, TF1 (approved 2026-11-18): what folds is the facts, the strip and the encounter tables' row; the line stayed | `src/app/SceneTime.tsx` (the condition round `ReminderCard`'s empty line); `ReminderCard.tsx` unchanged | Folded, after a check that brought nothing, the line is not on the page. Unfolded, it is. Folded, a card with a due line still shows whole. The toast is unchanged. | Folded and unfolded; nothing due; one thing due; a town (no fold); 375 px; a reload while folded | 0.2 / 0.3 / 0.7 |
| Q6 | **F17.** "Better to remove the icon". **F18.** "the whole from the book section … generally i'm very happy with this section" | The crossed eye leaves the row "From the book, for the GM", with its spoken name ("Only for you: never sent"); the heading's own words say whose it is. The chevron stays, at the right. **F18: nothing changes.** The section stays whole, its boxed asides included, and its title stays as it is (never "…, plus"). | **Yes (F17).** Page 15, BT1, home B (ruled 2026-11-14, gt-1): the row "marked with the crossed eye". No (F18) | `src/app/PlaceFacts.tsx` (`BookTextFold`), `src/app/PlaceFacts.css` (`.book-text__eye`, `.book-text__marks`) | The row has no eye and no "never sent" name. The row is still one 44 px target with its chevron, folded and open. The heading still reads "From the book, for the GM". Open, the whole text shows, a boxed aside included, nothing trimmed (F18). The text is still never in a player's read. | Folded (the first line cut); open; a long first line; a text with a list and a boxed aside; no book text (no row); 375 px; dark | 0.2 / 0.3 / 0.5 |
| Q7 | **F20 c, F21 b** (bug). "[pack item ID] is a designation that is machine readable, but i need a human readable designation here" | The GM's small line on a piece names things as a person would: "Value stays yours (Item: Silver-tipped arrows)." and "The stat line never shows (Bog lurker ×6).", never the pack's id. The same for a named character ("NPC: …") and on the piece's kind line. The line's own words do not change. The name is found when the line is drawn, on the GM's device: an item from the setting's items (as the hoard sheet reads them), a creature from its stat block's name (`rowLinks.ts`), a character from the pack's entry. The stored columns keep the id. An id with no entry: the id is left out of the line (*Mine, to check*). **Not here:** the stat line or the item's rule at hand (sf-6, held). | **Yes, words only.** Page 23, LA1 (approved 2026-11-18): the GM's small line, drawn with a value | `src/app/PlaceCard.tsx` (`gmFactLine`, `kindLine`), a small pure helper beside `src/modules/expedition/placeFromPack.ts` (it knows the composer's three shapes), `src/app/GmPlacePage.tsx` (hands the names in) | An item's line shows the item's name and never its id. A creature's line shows the stat block's name and keeps its count and note. A character's line shows the character's name. A value with no item reads as today. An id nobody knows leaves no id on the line. A place made before this fix shows names too. Nothing of the line is in a player's read (the existing test, untouched). | A value alone; an item alone; both; a creature with a count and a note; a long name (wraps, never cut); an unknown id; reading ahead (the same line); 375 px; dark | 1 / 1.5 / 3 |
| Q8 | **F20 a** (bug). "neither of these rows will reveal to party"; then, to the driver that evening: the GM got the "shown" toast and the player saw nothing | **Find it first.** 1. Reproduce with the test seed: a Treasure piece shown at a Location, read as a player of the group there. Try a lone thing, and a hoard's piece (one piece for several things). 2. Rule out, in this order: the player's group is not the group at the place; the players' card does not read again when the log moves (it shows only after a reload); a hoard's piece or a magic item's second piece is shown by another path; the GM was reading ahead (no visit, so no show). 3. Fix it where it is the app's code and changes nothing seen or stored. **Stop and report** (a scope check) if it needs a migration, changes a screen, or changes what a player's device gets. | **No screen changes.** The players' card is built to page 18, PL1 (approved 2026-11-14); the fix makes it do what PL1 draws | Not known until reproduced. Likely: `src/app/PlayersPlaceCard.tsx`, `src/modules/expedition/placePlay.ts` (the show; the players' read), `supabase/tests/` (a test only) | A shown Treasure piece is in the players' read for the group at the place (database test). The players' card draws a Treasure piece. A piece shown while the players' Scene is open appears without a reload. A hidden one is not sent. A player in another group gets nothing. | A lone thing; a hoard's piece; shown, hidden, shown again; two groups; a player offline who comes back | 0.5 / 1.5 / 3 |

**In all:** 4.4 / 7.6 / 14.2 turns; without Q2 and Q5, 3.5 / 6.3 / 11.5. Q8 is the wide one: its cause is not known.

## Two rows that would be built twice

The rule (`09`, 2026-11-13, [process]): each thing is built once, in its final place; nothing is built onto a screen an approved redesign will replace. Whether to build these now is the driver's to say, with Francis where it is his.

| Row | Built now | Then | Lean |
|---|---|---|---|
| Q5 (F10) | The quiet line folds with the top: 0.3 turns, one picture for Francis | The ruling of 26 November takes the line off the Scene (frames 44-13, 44-21). Q5's condition and its tests are removed | **Hold.** The line goes once, with that row |
| Q2 (F22) | Numbers on the rows of known places in the group's own Area: 1 turn, pictures for Francis | sf-9 (frame 44-11) sends the number with the ways' read, adds "N. Unexplored" and the Area over its rows. Q2's hand-over of the known places is replaced; its use of `keyedName` and its tests stay | **Hold.** Built now, a known place in another Area and every unexplored row still show no number: to him it would read as his note missed a third time |

If the driver says build: Q5 goes last in batch A and Q2 after Q1 in batch C, as below.

## Batches

At most three rows a batch, one pull request each, a fresh worker per row.

| Batch | Rows | Files | Spec file | When |
|---|---|---|---|---|
| A, the top | Q3, Q4 (and Q5, on the driver's word) | `SceneBand.tsx`, `SceneBand.css`, `SceneTime.tsx` | `tests/layout/sceneQuickTop.spec.ts`; unit tests in `sceneBand.test.tsx`, `sceneTopOpen.test.tsx` | First |
| B, the place card | Q6, Q7 | `PlaceFacts.tsx`, `PlaceFacts.css`, `PlaceCard.tsx`, `GmPlacePage.tsx`, the new helper | `tests/layout/sceneQuickCard.spec.ts`; unit tests beside each file | Side by side with A: no file shared |
| C, the lists | Q1 (and Q2, on the driver's word) | `placeTree.ts`, `sceneTop.ts`, `moveOnWays.ts`, `playersWays.ts`; with Q2 also `PlayersWhereTo.tsx`, `PartyGroups.tsx` | `tests/layout/sceneQuickLists.spec.ts`; unit tests beside each file. Q1 first: Q2 sorts by its helper | Side by side with A and B: no file shared |
| D, the bug | Q8 | Not known until reproduced | A database test; a unit test | After B if it turns out to touch `PlaceCard.tsx`; else at any time. Alone, so an unknown cause holds no other row |

Every batch also edits `docs/06-screens-and-design.md` (the inventory): the known place for a small conflict between batches in flight.

**Overlap with open work (2026-11-26).** #102 (a draft; docs only) edits `docs/06`, `docs/09` and the notes' intent: no source file. #101 (a draft, the town) and #103 (the toast's rulings) edit `docs/06` and `docs/09` and no Scene file. The toast's build (`dec-17-toast-restyle.md`) starts after these rows and touches none of their files.

## Gallery pictures expected to change

Read against `src/gallery/` on `main`: **none expected in any batch.** The gallery draws none of the band, the facts row, the book's text row or a piece's GM line, and `move-on-parts.png` draws the destination row with names its specimen gives it (Q2 changes the name handed in, not the part). Each builder confirms it and keeps its pull request's line current (`docs/testing.md`, Announced redraws); if Q2 adds a numbered specimen, it announces the four `move-on-parts.png` pictures.

## The Components inventory (`docs/06-screens-and-design.md`)

The builder brings each row up in the same pull request.

| Row | Inventory row | Change |
|---|---|---|
| Q1 | Place picker; Move on (linked spots); Players' page | The order of Locations, and what keeps its own order |
| Q2 | Move on (linked spots), Destination row; Players' page | A known place's number on a player's row; the unexplored row as built |
| Q3 | Scene band | The order: marks, Next turn, the fold mark, the menu; the phone unchanged |
| Q4 | Facts row | A named variant: fewer than four during an expedition, centred at a quarter each |
| Q5 | Time strip; Reminder card | The quiet line folds with the top |
| Q6 | Place facts | The row without its eye |
| Q7 | Room GM layer; GM's place page | The GM's line names things; where the names are read |

## ⚑ For Francis

| ⚑ | Row | Question | Until he says |
|---|---|---|---|
| 1 | Q4 | **On a phone, do three tiles change?** Today they stand two by two, the third at the left. His pictures were a tablet's. Page 44's frame 44-12 draws the third tile at the row's whole width (the critique's finding 15); it is not approved. | The phone is left as built |

## Mine, to check

Small choices made here so a builder is not stopped. Each is shown in its pull request's pictures.

- **Q1: a number with a letter** ("4a") sorts after 4 and before 5, as the hexes' own order does.
- **Q1: two Areas in one "Where to?"** sort by number together, so two rows may both start "1." until the Area's name stands over its rows (sf-9, held). It is no worse than today's mixed order.
- **Q1: a list that mixes Locations with other kinds** keeps the others first, in the pack's order, then the Locations in number order.
- **Q5: every "<what brought it>, nothing due" line folds**, not only the encounter check's: it is one part.
- **Q7: an id nobody knows** is left off the line, not printed. The pack checker is where a wrong id is reported.

## Held: not in this plan

| What | Why | Where it waits |
|---|---|---|
| F22's other half and F13 b: "N. Unexplored" on a player's row; the number of a known place in another Area | It sends a map number a player's device does not get today (hidden data, ruled 26 November), with a change to `campaign_ways_on` and its tests | sf-9, frame 44-11 |
| F25: the Area over its rows | Ruled 26 November | sf-9, frame 44-11 |
| F9, and F10 as ruled 26 November: both encounter rows off the Scene, "Encounter tables" in the menu | Ruled 26 November | Frames 44-13, 44-21 |
| F3 b: the crossed swords; "Dismiss" | Ruled 26 November (the icon); drawn (the way to close) | Frame 44-1 |
| F1 c, F2: the Depart list folds; numbers in a pack's tree | Ruled 26 November; drawn | sf-2, frames 44-9, 44-10 |
| F19, F21 a to c, F4 d: stat lines and an item's rule at hand | Open: his pick of option a or b | sf-6, frame 44-5 |
| The one fold mark (the chevron); the band's words from 1180 px | The designer's own choices, not ruled | sf-18, frame 44-13 |
| F4 c: a revealed encounter not on the players' Scene | A bug in his words, but its fix is drawn with new words to send | sf-7, frames 44-19, 44-20 |
| F7 b, F1 b, F26, F27 | The pack's | The pack tools |

## The handover's note

The driver's note for this brief: "SF1 sort, SF2 IDs→names, SF3 … rightmost/no crossed eye/fold line, row 4 F20 shown treasure not on players' Scene". Its numbers are its own; the ruling file's sf-1 to sf-18 are another set (there sf-2 is the Depart list and sf-3 the band). This plan uses Q1 to Q8 so neither is mistaken for the other.

| The handover | Here | The ruling file |
|---|---|---|
| SF1 sort | Q1 | sf-1 |
| SF2 IDs→names | Q7 | F20 c, a bug (no sf number) |
| SF3 "… rightmost" | Q3 | sf-3, the band's order only |
| SF3 "no crossed eye" | Q6 | F17 |
| SF3 "fold line" | Q5 | F10, as ruled 25 November |
| Row 4, F20 | Q8 | F20 a. The file says "not reproduced"; Francis's answer that evening (the toast showed, the player saw nothing) came after it |
| Not in the note | Q2 | F22, sf-9 in part |
| Not in the note | Q4 | F7 a and F11 a, sf-12 |
| Not in the note | Q6, no change | F18 |

## What was not checked

- **No screen was drawn or run.** The self-review (the ten heuristics, every state, contrast, 44 px, 375 px, messy data) is each builder's, on the built screen; the states to picture are in each row.
- **Page 16's frames (T1, T8a) were read from the code's own notes**, not from the page: its file is not in `docs/design/mockups/december/` on `main`.
- **Q4's narrow column** (fewer than four across) is described, not measured.
- **Q7's read of names** is named from the code's helpers, not traced end to end; it is the row most likely to grow.
- **Q8 was not reproduced here.**
- The sizes are guesses.

## Departures

History only: a builder lists its departures in its pull request's own text.
