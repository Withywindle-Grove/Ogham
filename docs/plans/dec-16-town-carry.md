# Plan: the town, brought into Ogham

Written by a designer worker on 2026-11-25 (row plan-town-carry), from the driver's brief. Plan only: no code, no spec or ruling changed here.

The town was built on the old repository's held branch `dec-3-town-stack` (read at 629241c) and never went live. This plan carries that work into this repository, adds what the stack never built, and applies the nine findings of the `impeccable audit` of the stack (Home Two, 2026-11-25), which Francis ruled the same day: "Approve with those fixes".

The stack's own plan, with its Departures, is `docs/plans/dec-3-the-whole-town.md` **on that branch** (rows W1 to W21, frames TW1 to TW13). The copy of that file here is older and lacks most Departures: a builder reads the branch's copy. Row numbers "W…" below are that plan's.

**Status: draft, for Francis.** Nothing here is released to a builder until this plan and row TC0 (the pictures) are on `main`, and the ⚑ a row names is answered.

## How it is built
- **A carry is a port by hand, never a merge.** The two histories share no commit, and the files the stack changed have moved a long way here since (measured 2026-11-25, lines that differ between the stack's file and this `main`'s: `GmPlacePage.tsx` 597, `PartyGroups.tsx` 303, `layoutHarness.tsx` 761, `fakeDb.ts` 545, `parts.tsx` 266, `parts.css` 259). A builder copies the stack's **new** files, then makes the stack's changes to shared files again against today's code, reading the stack's diff as the guide.
- **What is already here is not rebuilt.** See "What Ogham already has".
- **Mockups first.** The pictures of record are page 19 (`19-the-town-whole.html`, frames TW1 to TW13), which is **not in this repository yet**: row TC0 brings it in. Every visible row names its frame and approval. A row with no approved frame stops before the screen (TC8, and the parts named in ⚑).
- **Where page 19 and a later approved frame differ on a shared part, the later frame wins**, and the row says so: the place page's card was redrawn by page 23 (LA1 to LA4, approved 2026-11-18, p2p-8 to p2p-15) after page 19 (2026-11-14). ⚑ 1 asks Francis to confirm that for the town.
- **Parts are composed, never copied** (06, Components): the shared `Dialog` (Side variant; focus back to the opener since #90), `ListRow`, `RowList`, `StackedButton`, `Switch`, `EyeButton`, `SkeletonRows`, `BookTextFold`, `CallsLine`, `PictureSection`, `PlacePicture`. A pop-up opened from inside the place's sheet is wrapped in `SheetScope.Provider value={false}` and gets a layout check.
- **Invented names only** (hard rule 2). The stack's layout pages use invented towns ("Reedmouth", "The Lantern Chapel"); keep them.
- **Every row's pull request** shows its built screen beside its frame and brings the Code column of `docs/06-screens-and-design.md` up to date.
- **Each batch adds its own layout spec file**, so batches never meet in one spec.

## What Ogham already has (checked on `main` at 10d5578, 2026-11-25)
| Thing | State here | So |
|---|---|---|
| **Migrations** | Every migration on the stack is here already (W12 `20261115110000`, the people and shop kinds `…120000` and `…140000`, W4b and W4c `…130000`, the narrowed stock read `…150000`, W11b's three `…180000` to `…200000`, `20261118090000`). The stack has 221 files, this `main` 239, and none of the stack's is missing | **The carry itself needs no migration.** New ones: TC6 and TC12 only (below) |
| The data and logic rows W12, W11b, W4b, W4c, W13, W21's base | Here: `src/modules/requests/shopStock.ts` (`stock.set`, reset, `stockDefault`), `townRequests.ts` (`undoBuy`), `src/modules/expedition/townParts.ts` (`town.showPiece`, `town.hidePiece`, the players' two reads), `src/modules/library/packShops.ts` | Not carried again |
| W7b, the picture piece (TW13) | **Built here** on the place page: `PictureSection`'s `row` and `add` forms in `src/app/PlaceCard.tsx`, with the easel and the cross in the pop-up's foot | No carry. A town gets it when TC1 puts the town on the place page |
| "From the book, for the GM" (gt-1), the rule's icon button by Move on, the "Calls to adventure" line in a settlement (p2p-15), "+ Piece" with the jigsaw, Hide all with the closed eye (hx-2) | Built here on `GmPlacePage` | They reach the town with TC1; TC1 tests each in a town |
| The Dialog's Side variant, `wide`, `bookHeading`, `over`; focus back to the opener (#90) | Here. The Side variant **made wide** (the stack's "Side, wide") is not | TC3 adds that one named variant |
| The town's top (page 16, T4) | Here (`townTop.test.tsx`) | Not in this plan |
| The stack's screens | **None here.** Missing: `TownOverview`, `TownPlaces`, `TownPlaceSheet`, `PlacePeople`, `PlayersTown` (each `.tsx` and `.css`), `playersTown.ts`, `placePeople.ts`, `StockToggleSpecimens.tsx`, `townPlacesFor` and `townOverviewWords` in `town.ts`, `placeSheetParts` and `loadPlaceSheet`, `newestPicture`, the tokens `--card-widest`, `--rail-edge`, `--sheet-side-column`, and their tests. A town here still shows the old `TownScreen` from `PartyGroups.tsx` | Rows TC1 to TC5, TC9 |
| W9 (the table), W10a, W11 | Built nowhere. Only W9a's toggle exists, in the stack's gallery | Rows TC9 to TC13, new work from the frames |

## Page 19's frames used here
Approvals as page 19's captions and the rulings files give them. TW2d, TW6c and TW1d were approved after the stack's plan was written.

| Frame | Shows | Approval |
|---|---|---|
| TW1, TW1b | The GM's town in full | 2026-11-14, ap-8 (the accent corrected to page 16's T4) |
| TW1d | "Still shown from before" | 2026-11-15, ap-21 |
| TW2, TW2 at 375 | A place opened, the wide sheet | 2026-11-14, ap-8; the keeper's box in the short form ap-15; stacked people ap-22 (2026-11-15, from the built screen) |
| TW2d | A person opened on their own sheet | 2026-11-15, ap-19, with its fix (no crossed eye for first play) |
| TW3 | A shop's sheet for the GM | 2026-11-14, ap-8; its stock table ap-13 |
| TW4a, TW4c | Buying as built; Ask for… and Price… | 2026-11-14, ap-8; ap-12 |
| TW5, TW5b | The players' town; a place as a player sees it | 2026-11-14, ap-8 |
| TW6, TW6b, TW6c (A) | The phone | 2026-11-14, ap-8; TW6c form A 2026-11-15, ap-20 |
| TW7, TW7b, TW12 | Flat and hand-made towns; states; messy data | 2026-11-14, ap-8, ap-12 |
| TW8, TW8b (second card), TW8f, TW8j (B), TW8k (B) | The stock as the book's table, form (B); the toggle; the entry card | 2026-11-14, ap-13 |
| TW8g | The "asks for" card with the toggle | 2026-11-14, ap-14 |
| TW9c, TW10, TW11, TW11b | The board; the encounter tables; the map | 2026-11-14, ap-12 |
| TW13 | The picture piece | 2026-11-14, ic-4, for first play |
| Page 23, LA1 to LA4 | The Location's card as redrawn | 2026-11-18 (already in this repository) |

## The rows: Francis's minimum for 5 December (ord-2)
W1 to W4, W7b, W9, W11 and W10a, with the audit's fixes. Sizes are a designer's guess read against `main` (10d5578), in builder turns low / likely / high.

| Row | What it is | Frame (approval) | Files | Tests (purpose) | States and 375 px | Size | State |
|---|---|---|---|---|---|---|---|
| TC0 | **Page 19 comes into this repository.** The page, its pictures for the frames in the table above, and their rows in the mockup index. Docs only | The page itself | `docs/design/mockups/december/19-the-town-whole.html`, `png/19-*.png`, `docs/design/mockups/index.md` | `npm run docs:check` passes; every frame this plan names has its light and dark picture | n/a | 0.5 / 1 / 1.5 | **Ready** (a docs worker). Risk: the page leans on the shared `december.css` and `december.js`, which have moved on here; if it no longer draws, the pictures are copied as they are and the page says so |
| TC1 | **The town on the place page (W1, W2; the stack's T-a).** A town shows on `GmPlacePage`, not the old town screen, between expeditions too. On the card, in order: the trail, the name and its line, the rule's icon button and Move on, "From the book, for the GM", Knowledge and Rules, the Calls to adventure line; then the facts with "Overview", "About the town" folded, "Tables", the watch's box. **From the audit:** Tables rows take the table icon and regular weight, not bold; a fact that names an entry draws its link | TW1, TW1b (ap-8, 2026-11-14); the card's shared parts as page 23 LA1 (2026-11-18) | New: `src/app/TownOverview.tsx`, `.css`, `src/app/townPage.test.tsx`, `tests/layout/townCarryPage.spec.ts`. Changed: `GmPlacePage.tsx`, `PartyGroups.tsx`, `PlaceFacts.tsx`, `.css`, `TownScreen.tsx`, `.css`, `sceneWaiting.tsx`, `src/modules/expedition/town.ts`, `placeTree.ts`, `src/testing/layoutHarness.tsx`, `fakeDb.ts` | A GM in a town sees the place page, during an expedition and between them. In a town the card shows the rule's button, the book's row (where the pack gives text), the calls line and the picture row, each once. The Overview fact reads the town's Safe or Hostile and its cost of living. A Tables row carries its icon and is not bold. Between expeditions Move on and an eye open their pop-up and write nothing. One accent on the screen. A player is sent none of the facts, tables, watch or book text | Loading (still bars); a failed read keeps what it had with Try again; a town with no facts, no About, no tables; a long town name; forty facts not expected (one long fact); 375 px; light and dark; Larger text | 2.5 / 4 / 6 | **Waits for ⚑ 1.** "About the town" has no eyes (the stack's ruled departure, T-a item 3; abt-1 allows them, as its own row after 5 December). A fact's link to a **person** is plain words until the person's sheet exists (after 5 December) |
| TC2 | **Places in town and Things to do (W3, W5; the stack's T-b).** Numbered rows with eyes, "N of M shown", Hide all only while something is shown; eight rows then "Show all N" (three on a phone); a find field past twenty; "Closed today."; a town with its own places lists those, else the setting's services and lodgings (tn-3); "Still shown from before" for leftovers; Things to do as rows with a folding note | TW1b (ap-8), TW12 (ap-12), 2026-11-14; TW1d (ap-21, 2026-11-15) | New: `src/app/TownPlaces.tsx`, `.css`, `src/app/townPlaces.test.tsx`, `src/modules/expedition/townOwnPlaces.test.ts`, `supabase/tests/dec-3-town-own-place-names.test.ts`. Changed: `town.ts`, `townPlaces.ts`, `placePlay.ts`, `GmPlacePage.tsx`, `layoutHarness.tsx`, `fakeDb.ts` | A pack town lists its own places in the key's order. A town with none lists the setting's. The count covers everything players can see, and Hide all hides exactly that, in one log line with one Undo. A leftover shows under "Still shown from before" only while shown. A place's own name is never sent where it has a players' name (database test). A failed read of the places says so with Try again | None, one, eight, nine, forty places; a very long name; a place inside a place; closed; offline eye ("Waiting to send." is M9: not built); 375 px; dark | 2 / 3 / 4.5 | **Ready after TC1.** Use this repository's `numberedName` ("1. The Jetty", p2p-3), not the stack's |
| TC3 | **A place opened: the wide sheet (W4; the stack's T-d, T-e).** The Dialog's Side variant made wide, beside the folded rail from 1,024 px, the whole screen under 700 px; the book's heading with the town's name over it; two columns from 960 px when there is a picture or people, else one; description and parts parted by the dotted rule; "Open today" as the switch; "Inside". **From the audit:** closing the sheet returns focus to the row that opened it (finding 3: a test, the shared Dialog already does it); at 375 px a place opens, closes with Escape, and a third place then opens (finding 4: the builder tries it by hand first and fixes it if it is real) | TW2, TW2 at 375, TW3 (ap-8, 2026-11-14) | New: `src/app/TownPlaceSheet.tsx`, `.css`, `tests/layout/townCarrySheet.spec.ts`. Changed: `src/ui/Dialog.css` (Side, wide), `src/ui/tokens.css` (`--rail-edge`, `--sheet-side-column`, and `--card-widest` unless a token here already says 1,120 px), `src/ui/bookFaces.css`, `src/ui/creation.css`, `src/modules/expedition/placeFromPack.ts`, `placePlay.ts`, `TownPlaces.tsx`, `06` (the variant's name) | The sheet's title is drawn once. Focus goes back to the opening row on ✕, Escape and a tap outside. Open, Escape, open another, Escape, open a third: each opens, at 375 and 1,024 px. Two columns only with something at the left. The sheet's edge clears the folded rail at 1,024 px. A failed read of the words says so and keeps the sheet open | A place with no description; no parts; twenty parts; a long title; a place inside a place; a failed read; 375 px; an iPad upright (one column); dark; Larger text | 2 / 3 / 4.5 | **Ready after TC2** |
| TC4 | **The keeper's box (W8a), the keeper first.** Each person of the place in a box at the left under the picture (last on a phone): "Name—Role" with the dash kept on the name's line, the description, then the pack's lines; people stacked. **From the audit (finding 8):** the keeper comes first, as TW2 draws it | TW2, TW3 (ap-8); the short form ap-15 (2026-11-14); stacked ap-22 (2026-11-15) | New: `src/app/PlacePeople.tsx`, `.css`, `src/modules/expedition/placePeople.ts`. Changed: `TownPlaceSheet.tsx`, `TownPlaces.tsx`, `layoutHarness.tsx`, `fakeDb.ts` | The dash never starts a line. People stack at every width. The alignment prints after "Demeanour" only. A player reads none of a place's people. A failed read of the people says so and the rest of the sheet opens. **The order follows ⚑ 2's rule** | No people; one; three; a long name and role; 375 px; dark | 1 / 1.5 / 2.5 | **Ready after TC3; the order waits for ⚑ 2** (by name, as built, until then) |
| TC5 | **The eyes on a place's sheet (audit finding 1).** An eye on the description, on each part and on the picture's row, in the places the stack kept empty (`TownPlaceSheet.tsx`, the `SheetLine` slot). Wired to `town.showPiece` and `town.hidePiece`, which are here. A line that is the GM's alone carries the crossed eye, "Only for you: never sent" | TW2, TW2 at 375 (ap-8, 2026-11-14) | `TownPlaceSheet.tsx`, `.css`, `TownPlaces.tsx`, `placePlay.ts` (the place's own row and pieces, made when first shown), `townCarrySheet.spec.ts`, `supabase/tests` (W21's `it.todo` for tr-1 turned into cases) | A tap on an eye shows that piece to the group at once, with a toast and Undo. The eye reads its state without colour alone. Between expeditions an eye opens "Not shown yet" and writes nothing. A player is sent only shown pieces, nothing once the group leaves the town, nothing of a place two levels down (database tests). Every eye is 44 px with 8 px between | All hidden; some shown; a place the party has not entered (ge-1); offline; 375 px; dark | 2 / 3 / 5 | **Ready after TC3.** The largest unknown here: the stack never drew an eye on this sheet, so how a place in town gets its own row and pieces is unbuilt screen-side. **⚑ 3:** nothing shows a player these pieces until TC14 |
| TC7 | **The picture piece (W7b). Nothing to build.** It is on this repository's place page as TW13 draws it. **Audit finding 6:** "+ Picture" goes once a picture exists. No ruling says "one picture per place" in those words, but the later frame does: page 23's LA1 (approved 2026-11-18; Francis, 2026-11-19: "Yes, as the frame") keeps "+ Picture" only "while there is no picture", and the data holds one picture a place (`place.setPicture`; "Change" replaces it). So the built behaviour stands and TW13's foot is superseded on that point | TW13 (ic-4, 2026-11-14); page 23 LA1 (2026-11-18) | none | TC1's test that a town's page draws the picture row and its pop-up | as built | 0 | **No row to hand out** (⚑ 4 only if Francis wants TW13's foot back) |
| TC8 | **A picture that fails to load (audit finding 7).** Where the picture's file does not arrive, a quiet line in the picture's place, not the browser's broken mark: "The picture couldn't load. Try again.", with Try again. The words fit the voice guide's Error pattern ("What happened. What to do."). Today a failed **link** already says "The picture couldn't be opened. Check your connection."; one line should serve both | **None. No frame draws a failed picture** (TW13 and TW7b do not) | `src/app/PlaceCard.tsx` (`PlacePicture`: every place's picture, the players' card too) | The image's own failure is caught. Try again asks for the picture again. Nothing is drawn broken | Row, pop-up, the small variant at a card's head, the players' card; 375 px; dark | 0.5 / 1 / 1.5 | **Stops before the screen: needs a frame** (⚑ 5). Its catch and retry may be built to tests first |
| TC9 | **The three-position toggle (W9a), carried.** `StockToggle`: "?" in the middle, the cross at the left, the tick at the right; two 44 px halves 8 px apart; the keys of a radio group. Gallery section and layout spec with it | TW8f (ap-13, 2026-11-14) | `src/ui/parts.tsx`, `parts.css`, new `src/ui/stockToggle.test.tsx`, `src/gallery/StockToggleSpecimens.tsx`, `Gallery.tsx`, `tests/layout/stockToggle.spec.ts`, `06` | Left half always out, right half always in; the side it is on does nothing. One tab stop; arrows move without choosing. A half's focus ring is never painted over. It writes nothing itself | "?", out, in; 375 px; dark; Larger text | 0.5 / 1 / 1.5 | **Ready.** Its three states differ by glyph and position, not colour alone |
| TC10 | **The GM's stock as the book's table (W9b). New.** In a shop's sheet: heads Item, Price, Availability, Stocked?; Availability the die's icon and "x-in-y", or "Always", or empty; "Stocked?" the toggle; form (B): the things to decide in the table, "Always to be had" and "Not sold in <size>" folded under; a find field; "Reset" puts every thing with a chance back on "?"; at 375 px each row stacks (name, then availability, price, toggle) | TW8j form (B), TW8k (B), TW8, TW3 (ap-13, 2026-11-14) | New: `src/app/ShopStock.tsx`, `.css`, test, `tests/layout/townCarryStock.spec.ts`. Changed: `TownPlaceSheet.tsx` (its `stock` seam), `TownPlaces.tsx`, the book table's stacked form in the shared stylesheet (`src/ui/creation.css`, `.book-table`), `layoutHarness.tsx`, `06` | A flip writes today's answer at once, with Undo. Reset writes one line with one Undo. A thing with no chance shows an empty cell and its default. The table and the ask card (TC13) show the same answer. A player is sent only lines in stock (the tests exist; re-run) | No things; three; sixty; a very long name; 999 of a coin; a town of unknown size; a pack's shop and a setting's; a failed read; 375 px; Larger text; dark | 2.5 / 4 / 6 | **Ready after TC3 and TC9.** Known gap (the stack's W12 note): no town size reaches the players' read yet, so a thing sold by size stays undecided for players |
| TC11 | **A thing's entry gains "Rarity" and "Sold in" (W9c). New** | TW8b's second entry card (ap-13, 2026-11-14) | The item entry's panel (the builder names the file), `townTrade.ts` | The two lines show only where the pack gives them. A player's entry never shows a chance | With and without each; 375 px | 0.5 / 1 / 1.5 | **Ready** |
| TC12 | **The at-once answer (W10a). New, data and logic.** A request for a thing already decided today is answered by the app with today's answer, logged, with no card for the GM; a later flip does not unsend it; a player learns "Not here" only for the thing asked for (tn-7, tn-8) | none: data and logic only (the answer shows on the card as built, TW4a step 3, ap-8) | New migration (a function that answers, and the command's row in `public.logged_commands`), `src/modules/requests/townRequests.ts`, `src/testing/permissionCases.ts`, `fakeDb.ts`, `supabase/tests` | A decided thing is answered at once; an undecided or unlisted one still reaches the GM. The answer is one log line. Forged ids and another campaign's shop are refused. A player never learns "Not here" for a thing they did not ask for | n/a | 1.5 / 2.5 / 4 | **Ready** (his yes: tn-7). **A new migration: it adds a function and one row, and drops, renames or deletes nothing.** Reviewed before it goes to the test database (be-5); the main push is Francis's |
| TC13 | **Asking and buying (W11). New.** Ask for… and Price… as drawn; the GM's card carries "Stocked?" with the toggle in place of "In stock" and "Not here", the chance as the table writes it, "Price…" beside it; the card shows only for a thing on "?" or not listed; "Buy it" adds the thing and charges nothing, and the toast says so with "Spend N" and Undo. No Order button | TW8g (ap-14), TW4a (ap-8), TW4c (ap-12), 2026-11-14 | `src/app/TownRequestCards.tsx`, `RequestCard.tsx`, `TownActions.tsx`, `townTrade.ts`, tests, `tests/layout/townCarryBuying.spec.ts` | The card and the table flip the same record. The card never takes the accent (ap-14). "Spend N" spends from the buyer's purse in one line with its own Undo; Undo of the purchase is refused once the thing is touched. The toggle inside the card keeps 44 px at 375 px | A long item name; a price of 0 and of 999; no chance; two requests waiting; 375 px; dark | 2 / 3 / 5 | **Ready after TC9 and TC12** |

**In all, the minimum:** 17.5 / 28 / 43.5 builder turns (TC0 to TC13, without TC7), before review rounds.

## The rows: after the minimum
Carried or built once Francis places them (ord-2: "the town's extras where he next places them"). Sized roughly; not batched.

| Row | What it is | Frame (approval) | State |
|---|---|---|---|
| TC6 | **The keeper's lines' eyes (the rest of audit finding 1).** An eye a line in the keeper's box. Needs a store of which of a person's lines are open, a players' read of revealed lines only (np-3, np-5), and the index change idx-1 allowed | TW2 (ap-8); ap-19's fix: no crossed eye for first play | **Waits for ⚑ 6.** A new migration, and a new read for players. idx-1's yes was given while the table "has not reached main"; it has since. 2.5 / 4 / 6 |
| TC14 | **A place as a player sees it, and "Places you know" (part of W16).** The stack's `PlayersTown` and `playersTown.ts` | TW5, TW5 at 375, TW5b (ap-8, 2026-11-14) | **Waits for ⚑ 3.** The players' Scene here was rebuilt since (page 18, page 24), so this is a re-fit, not a copy. 2.5 / 4 / 6 |
| TC15 | A person opened on their own sheet (W8, np-2) | TW2d (ap-19, 2026-11-15) | After TC6. 1.5 / 2.5 / 4 |
| TC16 | Encounters as one line; the two tables as one sheet (W6) | TW1b (ap-8), TW10 (ap-12) | Until then the "Safety and encounters" fact stays, after Things to do. 1.5 / 2.5 / 4 |
| TC17 | The player's stock list (W10) | TW3b (ap-8) | After first play (tn-1) |
| TC18 | The board and a notice (W14) | TW9c (ap-12) | Not built anywhere. 1 / 1.5 / 2.5 |
| TC19 | The town's map (W15) | TW11, TW11b (ap-12) | The players' map is built here (P5): mostly a mount. Not sized |
| TC20 | The phone's fixed bar in town: "Depart" (W17) | TW6c form A (ap-20, 2026-11-15) | 0.5 / 1 / 2 |
| TC21 | Flat and hand-made towns, a hamlet (W18): the foot line and its tests | TW7 (ap-8), TW12 (ap-12) | Mostly falls out of TC1 and TC2; the foot line now lives in Notes (p2p-12), so the stack's `placeFootLine` is re-read first. 0.5 / 1 / 2 |
| TC22 | "About the town" with eyes (abt-1) | TW1 (ap-8) | A new players' read: a brief and a second read first. Not sized |

## The audit's findings, each to its row
| # | Finding | Goes to |
|---|---|---|
| 1 | High, W4: no eyes on the description, parts or keeper's lines | TC5 (description, parts, picture); TC6 (keeper's lines, ⚑ 6) |
| 2 | High: W9, W10a, W11 not built | TC10, TC11, TC12, TC13 |
| 3 | Medium, W4: focus does not return to the row | TC3, as a test |
| 4 | Medium, W4 at 375: a third place did not open after Escape | TC3: tried by hand, fixed if real, and a test |
| 5 | Low, W19: the drawn icons | "+ Piece" has its jigsaw here already. Rename is gone from every card (p2p-11, 2026-11-18): no quill. Tables rows: TC1. "+ Picture" with the easel: page 23 keeps it a word button (⚑ 4) |
| 6 | Low, W7b: "+ Picture" goes once a picture exists | TC7: stands, by page 23 |
| 7 | Low: the broken-image mark | TC8, needs a frame (⚑ 5) |
| 8 | Low, W4: the keeper first | TC4, by ⚑ 2's rule. np-1 and ap-15 give no order; ap-15 rules only that people stack. The order was parked on 2026-11-15 "until after 5 December"; the audit's ruling takes it up again |
| 9 | Low: rail tabs at 40 px | No row: `docs/plans/dec-14-player-audit-fixes.md` row 1 fixes the shared rail |
| TW1 | The rule's icon button by Move on | Here already on the place page; arrives with TC1 |
| TW1 | "From the book, for the GM" | Here already (gt-1). It leaves the page once a pack's pieces are checked complete (p2p-13): a ruled departure from TW1 |
| TW1 | Facts' links and the "Overview" row | TC1 |
| TW1 | The Calls to adventure line | Here already, shown in a settlement (p2p-15); arrives with TC1 |
| W2 | "About the town" has no eyes | The stack's ruled departure (T-a item 3): no data shares a section. abt-1 since allows it: TC22 |
| W2 | Tables rows lack the icon and are bold | TC1 |

## ⚑ For Francis
None decided here. Each has the designer's lean.

1. **The town's card: page 19 or page 23 where they differ?** TW1 (14 Nov) draws "Players see" with Rename, a "Pieces" heading with kind words, and "+ Picture" as a stacked easel. Page 23 (18 Nov) removed all of those from the place card, "the town's card too" (plan scene-point-to-point, B3). *Lean: page 23 wins; the town is the same card. TC1 waits for this.*
2. **Who comes first among a place's people?** No pack field names a keeper, and the library keeps no pack order, so today people sort by name. (a) The pack's own order: the importer keeps each person's position, the pack's writer puts the keeper first; no migration, and it takes effect at the pack's next import. (b) A new pack field on a place naming its keeper. *Lean: (a). It needs a line in 07.*
3. **Eyes with nobody to see them.** The minimum has the GM's eyes (TC5) but not the player's view of a place (TC14, part of W16). Without TC14 an opened eye shows a player nothing on 5 December. *Lean: add TC14's place sheet and "Places you know" to the 5 December set, after TC5.*
4. **"+ Picture" as a stacked easel button** (TW1b, TW13) or the word button page 23 keeps? *Lean: leave it as page 23 has it; one card everywhere.*
5. **A failed picture has no frame.** *Lean: one small frame (the row, the pop-up, the players' card; light and dark) on a new page, with the words "The picture couldn't load. Try again." replacing today's "couldn't be opened" line too.*
6. **The keeper's lines' eyes need a migration on a table now on the main database.** idx-1 said yes to replacing one index while the table was hours old. It removes no data. *Lean: ask again in plain words before TC6; TC6 after 5 December unless he places it sooner. For first play the GM reads the keeper's lines aloud.*
7. **Which lines on a place's sheet are the GM's alone?** TW2 draws one ("The tally") with a crossed eye, but the packs keep such things in the notes' prose, which nothing reads into lines. *Lean: only the place's one line (shown when there is no description) takes the crossed eye; the notes stay on the place page.*
8. **The 5 December set is larger than the days left allow at the likely size** (28 turns, two or three batches in flight). *Lean: if it must be cut, cut TC11, then TC8, then TC4's order; never TC5, TC10, TC12 or TC13.*

## Batches
At most three rows a batch, one pull request each, a fresh worker per row.

| Batch | Rows | Shared files | Spec file | When |
|---|---|---|---|---|
| 0 | TC0 | docs only | none | First, with this plan |
| A | TC1, TC2 | `GmPlacePage.tsx`, `PartyGroups.tsx`, `town.ts`, `layoutHarness.tsx`, `fakeDb.ts` | `townCarryPage.spec.ts` | After 0 and ⚑ 1 |
| B | TC3, TC4, TC5 | `TownPlaceSheet.tsx`, `TownPlaces.tsx`, `Dialog.css`, `tokens.css` | `townCarrySheet.spec.ts` | After A |
| C | TC9, TC11, TC12 | `parts.tsx`, `parts.css`, `Gallery.tsx`; `townRequests.ts`, a migration; the entry panel | `stockToggle.spec.ts` | Side by side with A: no file shared with A but `fakeDb.ts` (TC12), a small conflict to expect |
| D | TC10, TC13 | `TownPlaceSheet.tsx` (the stock seam), `TownRequestCards.tsx`, `RequestCard.tsx`, `townTrade.ts` | `townCarryStock.spec.ts`, `townCarryBuying.spec.ts` | After B and C |
| E | TC8 | `PlaceCard.tsx` | `townCarryPicture.spec.ts` | After its frame (⚑ 5); not beside A or B |

Every batch also edits `docs/06-screens-and-design.md`: the known place for a small conflict between batches in flight.

**Overlap with open work (2026-11-25).**
- **#50 (`k22-k2-screens-2`)** and **#66 (`pack-k11-k12-k13`, draft)** both change `src/testing/layoutHarness.tsx`, `src/ui/parts.css` and `docs/06`; #66 also `src/ui/parts.tsx`, #50 also `fakeDb.ts`. They meet batches A, C and D there. Best: both merged before batch C opens, or C merges `main` in before its final push.
- **#84 (account deletion, draft)** adds two migrations and changes `src/core/database.types.ts` and `src/core/undo.ts`: TC12's migration takes a later timestamp and regenerates the types after it.
- **`dec-14` row 1 (the rail)** changes `SectionNav.css` and `DividerHandle.css`: the handle moves 12 px. TC3's `--rail-edge` is measured after it merges, not copied from the stack's 98 px.
- **#93 and #25** are plans: no file shared.

## The Components inventory (Code column, `docs/06-screens-and-design.md`)
| Row | Inventory row | Change |
|---|---|---|
| TC1, TC2 | GM's place page; Town place row | The town on the page; `TownOverview`, `TownPlacesList`, "Still shown from before" |
| TC3 to TC5 | Sheet (the Dialog row); a new row for the place's sheet | "Side, wide"; `TownPlaceSheet`, `SheetLine` with its eye; the three tokens |
| TC4 | Keeper's box (new row) | `PlacePeople`, `personHeading` |
| TC9, TC10 | Toggle (a named variant); Book table (the stacked form) | `StockToggle`; the stock table |
| TC13 | Request card | The "asks for" card with the toggle; the buy toast |

## Not in this plan
The town's top (built). Rumours (built). The long form for people, lodging tracked, downtime, a city map with pins, per-shop stock lists read on the server (sh-4), Order, and buying from the list with no GM step: all after 5 December, as the stack's plan lists them.

## What was not checked
- **No test, browser or build was run.** Sizes and file lists are read from the two code bases, not measured.
- **Page 19 was read from its source and captions, not looked at as pictures.** Whether it still draws against this repository's shared mockup stylesheet is untried (TC0).
- **The audit's own text was not read**: only the brief's summary of its nine findings.
- **Each shared file's port was not walked line by line.** The line counts above say how far the files have moved, not how hard each change is.
- **Whether "Spend N" has a command to call here** (the purse commands are here; the toast's wiring was not read).
- **How a place in town gets its own row and pieces from the screen** (TC5): the stack built the data and never the eye.
- **Whether this repository's `RuleText` draws a fact's links as TW1 has them** (TC1).
- **TC12's shape** (one function, or the existing request function widened) is the builder's; only "adds, removes nothing" is asserted here, from the row's rule.
- **The main database's state** was not read: "every migration is here" is about files, not about what has been pushed.

## Departures
The builder keeps this section current in the same pull request as the change.
