# Plan: the whole town, built once

Written by the lead on 2026-11-14; rewritten for release the same night from the rulings of 14 November and page 19's approved frames. It covers the Scene when the party is in a settlement, for the GM and for players, **below the top band**: the town's page, a place and a person, a shop's stock and buying, rumours and the board, the encounter tables, the town's map, the players' town, the phone and the states.

The top band (the town's top, the three tiles, the sun and moon tile, the players' top) is `docs/plans/dec-9-the-whole-scene.md` rows S5, S6, S8, S13, S15. Not repeated here.

**Status: RELEASED to the Builder on 2026-11-14, except one part:** opening a person on their own sheet (W8, ⚑ 3) stops before the screen until its frame is drawn and approved. Everything else may be built. po-4: the town goes live **whole**, from its held stack `dec-3-town-stack`, never row by row.

Drafted for the lead by a drafting agent from the rulings and page 19's captions; checked and corrected by the lead, who answers for it.

First play, 5 December: a short meet-up in a port with some buying; coin is spent by hand from the toast (tn-1, ap-7).

## How it is built
- **Two streams.** Rows a person can see are built on the held branch `dec-3-town-stack`, stacked, and merge together once Francis has seen ONE set of as-built pictures (tablet and phone, GM and player, light and dark). Rows of data and logic only go to main one by one.
- **Mockups first.** Every visible row names its frame and the approval's id and date. A row with neither stops before the screen. A ruling in words is not an approval of a screen.
- **Pictures of record:** branch `design-december-mockups`, page `docs/design/mockups/december/19-the-town-whole.html`. Read for this plan at commit 3656467d. ap-13 names f7d0a110 for the stock table. The lead names the Studio's final commit to the Builder.
- **In the book's type** (po-3) and on the shared stylesheet (ms-1, pq-1). Buttons in a sheet's or card's foot right-justified (ft-1). Stacked buttons by stk-2. Targets by t44-1.
- **One accent a screen** by `accentOwner` (#785's rule). The ask card no longer takes the accent (ap-14): it goes back to Move on.
- **What a shop is today.** A shop is a town service of kind `buy` from the rules set's `settlement.services` (`src/modules/expedition/town.ts`, `TownService`: id, name, kind, rate, note). A service has **no list of its own things**. So "a shop's stock" lists every item for sale, by each item's own `availability` (an object `{ where?, chance?, rarity?, note? }` in the packs). Per-shop stock lists from a pack wait (dec-2-3; after 5 December, dec-night "Open").

## What is ruled
| File | Ids that bear on the town |
|---|---|
| `dec-scene-whole-2026-11-14.md` | po-4, sm-1, st-8, gt-1, rm-1 |
| `dec-midday-2026-11-14.md` | ic-1, ic-2, dw-1, st-11, st-12 |
| `dec-afternoon-2026-11-14.md` | do-1, pq-1, ms-1, bs-1, bs-2, pk-12 |
| `dec-late-2026-11-14.md` | ua-2 (nothing cut), stk-2, wd-1, hr4 |
| `dec-evening-2026-11-14.md` | tn-4, rm-2, rm-3, lv-2 |
| `dec-pack-town-players-2026-11-14.md` | ap-7, ap-8, tn-1, tn-2, tn-3, fr-1, fr-2, tr-1, ge-1, bu-1, ft-1 |
| `dec-town-stock-2026-11-14.md` | ap-12, tn-5, ap-13, tn-6, dl-1 |
| `dec-town-ask-card-2026-11-14.md` | ap-14, tn-7, tn-8, sps-1, t44-1, wh-1 |
| `dec-night-2026-11-14.md` | np-1, ap-15, np-2, np-3, np-4, pn-1, sm-2, wh-2 |
| Older, kept for their ids | mc-15 to mc-19, mc-65 to mc-74, ds-7, ds-7a, ds-9, pg-1, pf-15 |
| **File pending** (given in conversation, 14 November) | **w12-1** (the stock record and its read); **ic-4**, **ic-5** (button words and icons; the picture piece, TW13); **ap-17**, **ap-18** (Scene side only) |

### Rulings in force not yet in a file (cite with "(file pending)")
| Id | Ruling, in short |
|---|---|
| w12-1 | A shop's stock for the day is a new record. The GM reads and writes all of it. A player reads only the lines in stock today (Francis) |
| w12-2 | A thing with no availability information is in stock by default; the GM switches off what is not there (Francis) |
| sps-2 | Where a rules set marks its special seasons GM-only, an option's override gives players nothing of them and the weather is the GM's roll (Francis; not a town row) |
| av-1 | The settlement's chance by town size, as the rules set prints it, stays readable by players: it is the players' book's own rule (the lead's, on W21's question 1) |
| ic-4, ic-5 | "Start expedition" in the band reads "Depart" (ic-5 replaced ic-4's "Journey"). In town only, "Next part of day" reads "Advance time" (ic-5). The picture piece: the row keeps the thumbnail, "Picture" and its eye, and loses its two buttons; a tap opens it large in the standing pop-up, whose foot carries "Change" and "Take it off" (TW13). For first play; may be reworked |
| ap-17, ap-18 | The folded campaign rail keeps the sigil and a Retired tile; the sun-and-moon tile may carry its tints. Scene side (dec-9 S5, S6); named here only because the town's top depends on them |

## Page 19's frames
Read from the frames' captions and the mockup index. "Approved" means the caption opens with Francis's approval and its id.

| Frame | What it shows | Approval | Status |
|---|---|---|---|
| TW1, TW1b | The GM's town in full on the new place page (tablet), card in two pictures | 2026-11-14, ap-8 (TW1 also fr-2) | Of record. Its ask card later changed by ap-14 (see TW8g) |
| TW1c | The town's facts row: three tiles centred, sun-and-moon rightmost | 2026-11-14, ap-8, fr-2 | Of record **for dec-9 S5** (top band), not this plan. Its fourth-tile row is "not chosen" |
| TW2, TW2 at 375 | A place that is not a shop, in the wide sheet | 2026-11-14, ap-8 | Of record. Its keeper's box is the short form (ap-15, caption note) |
| TW2b, TW2b at 375 | A person opened from their place: each line a piece with its eye; "In a fight" for the GM | 2026-11-14, ap-8 | Of record as drawn, but drawn **before** np-1, ap-15 and np-2 (see W8) |
| TW2c | A place with two people, boxes stacked | Drawn to np-1 and ap-15. Francis approved this box and this stacking on 2026-11-14 from a private page showing two people of his own pack ("Yes with fixes, all npcs in the pack"; "Stack vertically"); TW2c is the same drawing with invented names | Of record on the lead's word: the approval was of the same part and arrangement, not of this frame's own picture |
| TW3 | A shop's sheet for the GM; stock as the book's table | 2026-11-14, ap-8; its stock table ap-13 | Of record (stock part by ap-13; sentences on "Roll its chance" describe the older row) |
| TW3b | The shop's sheet as a player sees it: things on, Buy or Order a row | 2026-11-14, ap-8 | Of record; its stock list follows later (tn-1) |
| TW4a | Buying as built: Ask for…, the GM's answer, Buy it; the "Spend N" toast and Undo | 2026-11-14, ap-8 | Of record; its card changed by ap-14; tn-7 note in caption |
| TW4b | Buying from the stock; what Order does (a proposal inside) | 2026-11-14, ap-8 (by the page's rule for TW1 to TW7) | Picture of record, but **not for first play** (tn-1: no Order button that night; stock list with Buy follows later) |
| TW4c | Ask for… form and the GM's Price… on the shared stylesheet | 2026-11-14, ap-12 | Of record |
| TW5, TW5 at 375 | The players' town, tablet and phone | 2026-11-14, ap-8, fr-2 | Of record |
| TW5b | A place as a player sees it | 2026-11-14, ap-8 | Of record |
| TW5c | Question 3's other answer | Not chosen (ap-8) | **Not a mockup of record** |
| TW6, TW6b | The GM's town at 375 px | 2026-11-14, ap-8 (TW6 also fr-2) | Of record; ask card changed by ap-14 |
| TW7 | A town from flat notes; a town made by hand | 2026-11-14, ap-8 | Of record |
| TW7b | Loading, a failed read, offline | 2026-11-14, ap-8 | Of record |
| TW8 | The GM's stock for the day, sixty things, form (B) | 2026-11-14, ap-13 (tn-4, tn-5) | Of record |
| TW8b | A thing's entry; the entry with "Rarity" and "Sold in"; the player's empty stock | Second entry card 2026-11-14, ap-13; the other two "assembled from approved frames" (05 S5, S6, 2026-11-12) | Of record |
| TW8c, TW8d, TW8e, TW8h, TW8i | Older stock rows and variations | Superseded by the stock table (ap-13) | **Not mockups of record** |
| TW8f | The three-position toggle as a part | Part ruled tn-4; approved in the stock table, ap-13, 2026-11-14 | Of record |
| TW8g | The "asks for" card with the toggle, the chance as the table writes it, "Price…" beside it; at 375 | 2026-11-14, ap-14, "with its two fixes drawn" | Of record |
| TW8j, TW8k | The stock as the book's table, forms (A) and (B); at 375 and Larger text | Form (B) 2026-11-14, ap-13 | (B) of record; **(A) superseded** |
| TW9 | The rumour table | 2026-11-14, ap-12 | Of record; built (W13) |
| TW9b | Who hears a rumour; what the player gets | 2026-11-14, ap-12 | Of record; built (W13) |
| TW9c | The public board and a notice | 2026-11-14, ap-12 | Of record |
| TW10 | The two encounter tables as one sheet over the Scene | 2026-11-14, ap-12 | Of record |
| TW11 | The town with its map beside the list, wide window | 2026-11-14, ap-12 | Of record; ask card changed by ap-14 |
| TW11b | The players' map before and after it is shared | 2026-11-14, ap-12 | Of record |
| TW12 | Messy: forty places, a long name, a hamlet, a place inside a place | 2026-11-14, ap-12 | Of record |
| TW13 | The picture piece: the row, and the picture opened with its two actions | Ruled 2026-11-14, ic-4 (file pending), "for first play" | Of record for first play |

Page 16 frames the town relies on (dec-9's, for reference): T4 (in town) and T9f (players' top in town), both approved 2026-11-14 (st-1 to st-8). T5 (downtime) is "not final" (dw-1).

Older pages (09, 03, 05, 11) are sources only now: page 19 assembled each approved older frame into the town's page of record.

## The rows
"Stack" = `dec-3-town-stack` (held; goes live whole). "Main" = data and logic only, merged alone.

| # | Row | Rulings | Picture (approval, date) | Built today | Needs first | Size | Goes to |
|---|---|---|---|---|---|---|---|
| W1 | **The town's page structure**: the card in page 11's order on the new place page; the book's two heading levels; one accent by `accentOwner`; the facts and prose on the card | pg-1, mc-69, ds-7, ds-7a, po-3, ap-8 | TW1, TW1b (ap-8, 2026-11-14) | Today's town page (`TownScreen.tsx`, the town section of `PlaceCard.tsx`, piece 2c): an older card with a "Safety and encounters" fact | dec-9 S5, S6 (the top) on #785's branch | to be sized by the Builder | Stack |
| W2 | **The overview**: the facts line; "About the town" folded with eyes; "Tables"; the watch's box (a group keeps its own lines, np-4); the book's text row | ds-7a, mc-69, gt-1, np-4, ap-8 | TW1 (ap-8, 2026-11-14) | Facts, prose, tables and the watch read on the GM's device (`PlaceCard.tsx`, `PlaceFactsBody`, 2c); gt-1's row is dec-9 S14 | W1 | 2c built; S14 "small" | Stack |
| W3 | **Places in town**: numbered rows with eyes, the count, "Hide all"; "Closed today."; a find field past about twenty; "Show all N"; a place inside a place ("Inside", one level); a town with places of its own lists those, the generic services and lodgings only for a town with none | mc-15, mc-17, 2b, tn-3, ap-8, ap-12 | TW1b (ap-8); TW12 (ap-12), 2026-11-14 | Rows, eyes and Open · Closed built (`townPlaces.ts`, `town.ts`); places carry a parent in data (m8b-0); the "Inside" list and tn-3's rule not found built | W1 | 2b "small after #532" (dec-2-3); rest to be sized by the Builder | Stack (tn-3's rule as a pure function may go to main first) |
| W4 | **A place opened**: the wide sheet in two columns (picture and keeper's box left; description, parts, Services, stock right); one column on a phone; "Open today" as a toggle; no "Back to the town" | mc-70, mc-71, mc-72, mc-15, ds-9, ap-8 | TW2, TW2 at 375, TW3 (ap-8, 2026-11-14) | A centred pop-up (2c Departure 2); the wide sheet not built | W1 | to be sized by the Builder | Stack |
| W4b | **A player reads a place's shown description, parts, picture and keeper's lines while their group is in that town** (tr-1, within the lead's limits: one level under the town of the current visit; exactly what a shown piece sends; the place's own row stays the GM's; no person unless written into a shown piece; nothing after the group leaves) | tr-1 | none: data and logic only | Not built (no branch or migration found) | His yes: given (tr-1) | to be sized by the Builder | Main |
| W4c | **The GM may open the eye on a part of a place in town** while the party is in the town but not in that place; every other check stays | ge-1 | none: data and logic only | Not built (not found) | His yes: given (ge-1) | to be sized by the Builder | Main |
| W5 | **Things to do**: a short list, an entry with a note folding | pg-1, ap-8 | TW1b (ap-8, 2026-11-14) | Built on today's screen (the setting's `other` services) | W1 | to be sized by the Builder | Stack |
| W6 | **Encounters in town**: the check as one line under "Encounters", no toggle (the tile in the top switches it); the two tables as one sheet with "By day" / "By night" as the two-sided switch, opening on the half lit in the tile; the GM's alone | mc-15, mc-18, mc-69, sm-1, ap-12 | TW1b (ap-8); TW10 (ap-12), 2026-11-14 | "Safety and encounters" fact and its pop-up, two separate switches (`TownScreen.tsx`) | dec-9 S6 (the tile, its command change) | to be sized by the Builder | Stack |
| W7 | **Pieces and Notes**: pieces with their eyes, picture first, "+ Piece", "+ Picture", "Hide all"; Notes folded | pg-1, mc-17, ap-8 | TW1b (ap-8, 2026-11-14) | Built on today's card | W1 | with 5b (dec-7-5: "1½ to 2") | Stack |
| W7b | **The picture piece**: the row keeps the thumbnail, "Picture" and its eye; a tap opens it large in the standing pop-up; its foot "Change" (easel) and "Take it off" (cross), right-justified; Take it off at once with Undo | ic-4 (file pending), ft-1, ic-1 | TW13 (ic-4, 2026-11-14, for first play) | Today's row with "Change picture" and "Take it off" buttons | W7 | to be sized by the Builder | Stack |
| W7c | **"Try again" on a place's picture that fails to load** (added 2026-11-19, from the evening sitting, answer 26). Where a place's picture cannot be opened, the line that says so carries a "Try again" button that asks for the picture again; while it asks, the still placeholder shows. The part is the shared `PlacePicture`, **every place's**: the picture row and its pop-up (W7b), the wide sheet's left column (W4), the older place card, in town and out of it. Never the accent; 44 px. **Whether a player gets the button too: ⚑ 14. Its words and where it sits in the small picture row: shown to him built, ⚑ 15** | "Yes, add it" (Francis, 2026-11-19, answer 26: "should the GM get a "Try again" button?"). W20 (a failed read: "Try again"). No rulings file: its pull request records its `09` line | **None exists** (TW13 draws no failed picture; TW7b's "Try again" is a failed read of the town, not of a picture). His ruling of 2026-11-19: **built from his words and shown to him as a built picture**; it is approved from that picture | The failed state is one line, "The picture couldn't be opened. Check your connection.", with no way to ask again but leaving the page (the stack's Departures, W7b, 3: "left open") | W7b (on the stack). `PlaceCard.tsx` is changed on the held stack, so it is built there, once | S | Stack (#861) |
| W8 | **A person in the short form**: the boxed aside "Name—Role" (the dash with the name), a description, then Demeanour (alignment in brackets), Speech, Desires, then optional lines; each line with its eye; people of one place always stacked; a role "Title, Place". A player sees only revealed lines, no placeholders | np-1, ap-15, np-2, np-3, np-4, mc-18, mc-71, 2d | The box in a place: TW2, TW3 (ap-8), the short form ruled from it (ap-15, 2026-11-14); TW8's keeper's box (ap-13); two people stacked TW2c: **no approval found**. **Opening a person** (np-2: the same box on its own sheet): TW2b (ap-8) draws a person's sheet, but as lines-as-pieces with "In a fight", before np-1. **No approved picture of np-2's sheet: that part stops before the screen** | 2d on its branch (`origin/dec-2d-place-people`, e07f380e), not merged | 2d brought up to np-1 to np-4; W4; a frame for np-2 (⚑ 3) | 2d "about 2.5 to 3 turns" (dec-2-3); rework to be sized by the Builder | Stack |
| W9 | **The GM's stock as the book's table**: heads Item, Price, Availability, Stocked?; Availability only the die's icon and "x-in-y", or "Always"; "Stocked?" the three-position toggle on "?" until flipped; a thing with no chance: empty cell and "?" (also a note in words alone, and a size-sold thing in a town of unknown size, tn-6); nothing by rarity or size on the row (a listed size is "Always", another size is off); form (B): the things to decide in the table, "Always to be had" and "Not sold in <size>" folded under; a short shop's table carries every thing; a find field; "Reset" puts every thing with a chance back on "?". A thing's entry gains "Rarity" and "Sold in". No "Roll its chance", no "Roll all…", no roll pop-up | mc-73, mc-74, tn-4, tn-5, tn-6, ap-12, ap-13 | TW8j form (B), TW8k (B), TW8, TW3, TW8f, TW8b's second entry card (ap-13, 2026-11-14, at f7d0a110) | Not built. The chance shows only on the GM's request card; `townTrade.ts` reads an item's `availability` only as a string | W12; the three-position toggle added to 06's inventory; the book table's stacked form at 375 (now in the shared stylesheet, per TW8k) | 3–6 with W10 and W12 (december-first-play, tier 2); toggle and stacked table to be sized by the Builder | Stack |
| W10 | **A player's stock list**: only things in stock today, prices, a name opening its entry; nothing off or undecided, no chance; "Ask for…" as a row; empty: one line and "Ask for…" | mc-73, mc-71, mc-72, w12-1 (file pending), tn-1 | TW3b (ap-8); TW8b's empty stock (assembled from 05 S5, approved 2026-11-12) | Not built | W12; **tn-1: the list with Buy on a row follows later** (⚑ 8) | within W9's 3–6 | Stack (after first play unless the lead says otherwise) |
| W10a | **The at-once answer**: a request for a thing already decided today is answered by the app with today's answer line, through a command, logged; no card for the GM; flipping the thing later does not unsend it; a player learns "Not here" only for the thing asked for | tn-7, tn-8 | The answer card as built (TW4a step 3, ap-8, 2026-11-14) | Not built | W12 | to be sized by the Builder | Stack (it changes live behaviour once defaults exist: "Always" things read in) |
| W11 | **Asking and buying on first play**: Ask for… and Price… as TW4c; the GM's card carries "Stocked?" with the toggle in place of "In stock" / "Not here", the chance as the table writes it, "Price…" beside it; the card appears only for a thing on "?" or not listed; card and table flip the same record. "Buy it" adds the thing and charges nothing; the toast says the cost is not spent and offers "Spend N" and Undo. No Order button that night | mc-73, ic-1, ap-14, tn-1, tn-7, ap-7, bu-1 | TW8g (ap-14); TW4a (ap-8); TW4c (ap-12), 2026-11-14. The card as redrawn on TW1, TW4a, TW6, TW11 ("changed by ap-14"): **checked by the lead on 2026-11-14** at b658e5b2 (opened: TW8g light, TW1 dark, TW6 light; not opened: TW4a, TW11): the card reads as TW8g and each frame keeps one accent | Ask for… → the GM's In stock / Not here / Price… → Buy it / Leave it (`TownActions.tsx`, `TownRequestCards.tsx`, `townRequests.ts`) | W12, W10a, W11b | to be sized by the Builder | Stack |
| W11b | **Undo on "Buy it"** (a sixth exception to hard rule 4): the buyer's own Undo removes their bought item while untouched; the log keeps a full copy; refused once touched; a spend from the toast is separate; the GM's general Undo still refuses a purchase. Hard rule 4's text in `CLAUDE.md` changes from five to six in the same pull request | bu-1, hr4 | none: data and logic only (its button sits in W11's toast) | Not built: "Buy it's made line… isn't undone (hard rule 4)" (`townRequests.ts` header) | His yes: given (bu-1, hr4) | to be sized by the Builder | Main |
| W12 | **Shop stock for the day, the record**: keyed by campaign, `buy` service id, item id and campaign day; in / out / undecided; defaults computed from the item's `availability` object; GM-only commands (set, reset) with Undo; a new day reads clean, nothing deleted; a player reads only lines in force **in** | mc-74, w12-1 (file pending), tn-4 to tn-8, ap-13, ap-14 | none: data and logic only | Not built. Brief: `docs/plans/briefs/dec-3-w12-day-stock-brief.md` | His yes: given (w12-1, w12-2: a thing with no availability is in stock by default). The main database push is covered if the dry run shows only its migration (20261115110000) | see W9 | Main |
| W13 | **The rumour table and who hears it**: book's table, truth under the crossed eye; a row given to a character or the party; stored as "A rumour"; the way back as the link under the title | mc-65, rm-1, rm-2, rm-3, wh-1, wh-2 | TW9, TW9b (ap-12, 2026-11-14) | **Done.** dec-12 E (#821) and its follow-up (#835), in the Calls to adventure sheet reached from the card's calls line. rm-2 and rm-3's migrations are on the main database (2026-11-14, on Francis's yes at that step; backup main-20261114-2126). Remains: the database refusal of a rumours table named as a weather table (pack:check errs today) | the weather fix's migration | dec-12 E "1½" (built) | Main (the remaining migration) |
| W14 | **The board and a notice**: the board is a place in town; a notice a section with its own eye; a call to adventure's mark; one tap shares it whole; players may keep it | mc-66, mc-67, ap-12 | TW9c (ap-12, 2026-11-14) | Not built (dec-12 F). dec-12 C (the player's card) not built: it is dec-9-the-players-scene P7 | dec-12 B and D (merged); C | dec-12 F "1" | Stack |
| W15 | **The town's map**: the pack's picture whole with its eye and tools; beside the list on a wide window; under "Waiting for you" on a tablet; after the card on a phone; players: "No map shared yet." until its eye opens; no tags or pins. A shared map is read by every member (sm-2) | mc-19, mc-58, mp-1 to mp-3, 5m, sm-2, ap-12 | TW11, TW11b (ap-12, 2026-11-14) | 5a built; 5m-1, 5m-2 merged, unmounted (dec-9 S13 mounts them on the Scene) | dec-9 S13 | "3–5" (december-first-play, the map) | Stack |
| W16 | **The players' town**: the card as shown; Knowledge; "Places you know" with number and name as soon as listed (tn-2), under the players' name where the GM gave one (pn-1); "In town" as tiles; the map once shared; a place as a player sees it | mc-69, mc-71, mc-72, st-7, tn-2, pn-1, np-3, ap-8 | TW5, TW5 at 375, TW5b (ap-8, 2026-11-14) | Today's players' town (`TownLine`, `TownActions.tsx`). pn-1 done (#846: `scene_town`, `known_places` send the players' name) | W1, W4b | to be sized by the Builder | Stack |
| W17 | **The phone**, GM and players: one column; "Waiting for you" first; three places, then "Show all 13"; Move on above the tab bar; "Depart" in the bar's menu; "Advance time" in town | mc-70, st-6, ic-5 (file pending), ap-8 | TW6, TW6b, TW2 at 375, TW2b at 375, TW5 at 375 (ap-8); TW8k (ap-13); TW8g at 375 (ap-14), 2026-11-14 | Today's phone layout | each row | with each row | Stack |
| W18 | **A town from flat notes; a town made by hand; a hamlet**: a part with nothing in it is left out, not shown empty; source "Made by you" | mc-69, pg-1, ap-8, ap-12 | TW7 (ap-8); TW12's hamlet (ap-12), 2026-11-14 | Today's screen shows what it has | W1 | to be sized by the Builder | Stack |
| W18b | **"Town." on the foot line only for a settlement** (added 2026-11-19, from the evening sitting, answer 23). A place from a pack that the GM marks Safe or Hostile, and that its pack does not mark a settlement (a keyed room, a camp), keeps the pack's own word on its foot line: "Room. From your adventure: …", not "Town. …". A pack's settlement still reads "Town." whatever type its pack gives it (W18). Only the foot line's word changes: what else a Safe or Hostile mark does to a place is not touched. **A place made by hand and marked Safe or Hostile: ⚑ 13** | "Only settlements" (Francis, 2026-11-19, answer 23; closes the ⚑ of the stack's Departures, W18, 8). pg-1 (the foot line: the kind, then the pack's name). No rulings file: its pull request records its `09` line | None new: nothing shows that an approved frame does not draw. "Town." on a settlement is TW1, TW7 (ap-8) and TW12 (ap-12), 2026-11-14; the pack's own word on any other place is page 11's foot line (pg-1). The row changes which of the two a marked room or camp shows. Its built picture goes in the pull request | On the stack (W18, #985's review): the foot line says "Town." on any place marked Safe or Hostile, so a keyed room the GM marks Hostile ends "Town. From your adventure: …" | W18 (on the stack: `placeFootLine` exists only there) | S | Stack (#861) |
| W19 | **Icons on every button**, the word under; a row that opens a screen takes a leading icon. Page 19's icons (jigsaw-piece, easel, clockwise-rotation, and the reused ones) are approved on their frames; their credits go in the app's icon table | ic-1, ic-2, st-6, ic-4, ic-5 (file pending), ap-8, ap-13 | per row, as above | Partly (the shared stacked button, #803) | dec-9 S17 | with each row | Stack |
| W20 | **Every state**: loading (band at once, still bars); a failed read (keeps what it had, "Try again"); offline (an eye kept "Waiting to send.", still a tap); overflow (forty places, sixty things, a long name, 999 crowns); Larger text | standing rule, t44-1, ap-8, ap-12, ap-13 | TW7b (ap-8); TW12 (ap-12); TW8, TW8k (ap-13), 2026-11-14 | Some built on today's screen | each row | with each row | Stack |
| W21 | **Hidden means hidden tests**, as a player, on what the database sends | hard rule 5 | none: data and logic only | **Done** (#825). pn-1's two `it.fails` turned to passing by #846. The stock and rumours `it.todo` marked covered, and the file's header and two test names tidied (W21's last pull request, `dec3-w21-tests`). Remains: add the new cases below as each row lands | each row | with each row | Main |

### Never sent to a player
| Never sent | The rule | Test state |
|---|---|---|
| A place in town not shown; a hidden piece and its lead | mc-15, 2c; `scene_town` | Covered |
| A place's own name where it has a players' name | pn-1 | Covered, fixed (#846) |
| The town's GM notes, facts, tables, the watch, the book's text row | ds-7a, gt-1, 2c Departure 1 | Covered (#825) |
| A place's parts, picture or keeper's lines not shown; anything of a place after the group leaves the town; a place more than one level under the town | tr-1 and its limits | To add with W4b |
| A person (name, leads, stat block) unless written into a shown piece; a person's line not revealed, and any mark of a hidden line | 2d, mc-18, np-3 | `it.todo` (W8) |
| A keeper's box line not revealed; a page reference into a GM's book | mc-71, mc-72, pf-15 | `it.todo` (W4, W8) |
| A stock line out or undecided: its row, its thing's id, a count; the day's answers and any chance | w12-1, mc-74, tn-8 | Covered (`dec-3-w12-shop-stock.test.ts`, `dec-3-stock-reader-narrow.test.ts`, `fix-856-1-shop-stock-read.test.ts`); named in W21's header |
| "Not here" for anything but the thing the player asked for | tn-8 | To add with W10a |
| A rumours table, open or not; a rumour's truth and notes; a rumour not given; the table's name on a give | rm-1, rm-2, rm-3 | Covered (`dec-12e-rumours*.test.ts`); named in W21's header |
| A notice not shared; a hook not sent | mc-66, ca-1 to ca-3 | Hooks covered; notices `it.todo` (W14) |
| The town's map until its eye is open | 5m-3, mc-44a | GM-only covered; the eye `it.todo` (W15) |
| A rule the GM switched off | mc-51a | Covered |
| The encounter tables | mc-18, TW10 | Covered (tables) |
| A rules set's special seasons where it marks them GM-only | sps-1 (its own fix, `origin/sps-1-special-seasons-gm-only`; not a town row) | With sps-1 |

## Needs the product owner's yes
| Row | What changes who may read or write | His yes |
|---|---|---|
| W12 | A new record; a player reads only lines in stock today | **Given**: w12-1 (file pending), "Yes" to the brief's words |
| W12 | The default for a thing with no availability | **Given**: w12-2 (file pending): in stock by default |
| W12 | Whether a player reads a log line of a thing coming in | **Still needed** (⚑ 2); built as the GM's alone meanwhile |
| W4b | A player reads a place's shown parts while in that town | **Given**: tr-1 |
| W4c | The GM opens an eye on a place the party is not in | **Given**: ge-1 |
| W11b | Undo removes a bought item: a sixth exception to hard rule 4; the rule's text changes | **Given**: bu-1, hr4 |
| W10a | The app answers a request at once, logged | **Given**: tn-7 (tn-8 is the lead's inside it) |
| W13 | A rumour given is read by its hearer; rumours tables never readable | **Given**: rm-1, rm-3 (rm-3's main push "on his yes at that step": not confirmed here) |
| W16 | Players' names of places | **Given and done**: pn-1 (#846) |
| W8 | A player sees only revealed lines of a person | **Given**: np-3 |
| W10, TW4b | Buy from the stock list with no GM step (the player writes the item) | **Still needed**, after first play (⚑ 7) |
| W14 | A notice a player keeps, if it needs a new read | **Still needed** if so (the Builder says when it reads the code) |
| W21 Q1 | The setting's chance by town size is readable by players today | **Not needed**: it stays readable (av-1, the lead's: the players' book's own rule); hiding it would remove a read and would need his yes |

## ⚑
Open; none decided here.
1. ~~w12-1's open case~~ **Ruled** (w12-2, Francis, 2026-11-14): a thing with no `availability` at all is in stock by default. The brief's "undecided in the meantime" is lifted.
2. **A player and the log line of a thing coming in** (W12 brief, item 6). Meanwhile, built as the GM's alone.
3. **Opening a person (np-2):** no frame draws "the same box on its own sheet". TW2b (ap-8) draws lines-as-pieces with "In a fight", before np-1. A new frame, or the lead's word that TW2b stands with the short form's lines? *Before release.*
4. ~~TW2c's approval~~ **Settled by the lead:** of record; Francis approved the same box and stacking from a private page of his own pack's people (ap-15); TW2c is that drawing with invented names.
5. ~~The ask card as redrawn~~ **Checked by the lead** on 2026-11-14 (TW8g, TW1, TW6 opened; TW4a, TW11 not opened). W11 is released.
6. **Order** after first play: TW4b's proposal (a request for a thing made or fetched; nothing added until the GM hands it over). Not ruled. tn-1 rules only "no Order button that night".
7. **Buy from the stock list with no GM step** (TW4b): a new player write; needs his yes in plain words. After first play.
8. **The player's stock list (W10):** tn-1 says it "follows later". The lead's lean, from tn-1: after 5 December; W9, W10a, W11 and W12 serve first play.
9. ~~The setting's chance by town size~~ **Ruled by the lead** (av-1): it stays readable by players, as the players' book prints it; tn-5 only keeps it off the stock row.
10. **The town's facts row (fr-1, fr-2, TW1c)** belongs to dec-9 S5, whose row names neither. For the dec-9 plan.
11. **The stack's base** is the Builder's to decide (technical). The town's page shares `PlaceCard.tsx` with #785's held Scene stack. The lead's lean: branch `dec-3-town-stack` from #785's branch, so the two never disagree about that file; the town then goes live with or after the Scene, which is the order of the build anyway.
12. **ap-17, ap-18** (file pending): Scene side; confirm nothing on the town's top changes beyond dec-9 S5, S6.
13. **W18b: a place made by hand and marked Safe or Hostile.** His answer ("Only settlements") was to a question about a room or camp from a pack. A place made by hand has no pack and no settlement mark: its Safe or Hostile mark is what makes it a town (bq3-1), and TW7 draws it "Town. Made by you.". W18's own ⚑ also asked whether a hand-made one should have no foot line; that half was not put to him. W18b leaves it as TW7 draws it until he says.
14. **W7c: does a player get "Try again" too?** He was asked about the GM. `PlacePicture` is also what a player's "where you are" draws, and there the same line shows when the picture is one the player may not, or may no longer, read: asking again would not help. Built for the GM until he rules; a player's line stays as it is.
15. **W7c: its words and its place.** No frame draws it. For his look at the built picture, not asked before: whether the line's words change beside the button; where the button sits in the picture row's small thumbnail; whether the map's failed picture (a warning line, "Try again", one more line) is the pattern to follow.

## Not in this plan
- The top band: dec-9 S5, S6, S8, S13, S15 (and fr-1, fr-2, ap-17, ap-18 there).
- The long form for people (np-2: after 5 December; new pack fields).
- Lodging tracked and its fact (after 5 December: the lodging intent; dt-11, dt-12, dt-24, sf-2). Its place in the row stays free.
- Downtime (dw-1, st-12).
- A city map with numbered keys, pins and ways (parked).
- Per-shop stock lines from a pack's place text (after 5 December).
- Sharing a map with one group (sm-2: after 5 December).
- Fights; prices charged on buying (pk-6).
- The players' card for a call to adventure (dec-9-the-players-scene P7, dec-12 C).
- sps-1 (its own fix).

## Files and tests: the rows of 19 November (W7c, W18b)

From the evening sitting, [`../design/notes/sitting-2026-11-19-evening.md`](../design/notes/sitting-2026-11-19-evening.md). Paths and line numbers checked on 2026-11-19 against `main`, and against the held stack `dec-3-town-stack` at 629241c1 where a thing exists only there (said each time). Each test is written first as a plain sentence. Both rows add a layout check at 375 px and on a tablet, light and dark.

| # | Files it will touch | Tests it must add |
|---|---|---|
| W7c | `src/app/PlaceCard.tsx` (`PlacePicture`: `:329` on `main`, `:348` on the stack; its failed line `:362` on `main`, `:381` on the stack; a player's use of it, `PlaceLine`, `:963-970` on `main`), `src/app/PlaceCard.css`. The nearest built pattern is the map's failed picture (`src/ui/MapParts.tsx:307-325`, `MapWait`). Tests in `src/app/placeCard.test.tsx` or `src/app/locationView.test.tsx` (`:184` states the failed line today), and `tests/layout/pictureRow.spec.ts` | A picture that fails to load shows its line with "Try again"; a tap asks again and shows the picture once it loads; a second failure shows the line again; the button measures 44 px and is never the accent; a player's line is unchanged (until ⚑ 14) |
| W18b | On the stack only: `src/app/GmPlacePage.tsx` (`placeFootLine`, `:578`; its call, `:261`; `inTown`, `:119`). On `main` and the stack: `src/modules/expedition/placePlay.ts` (`isSettlement`, `:94`: a pack's settlement mark or a Safe or Hostile mark; the foot line needs the first alone). Tests on the stack: `src/app/townPage.test.tsx` (`:453-457` state the foot line today), `tests/layout/townW18.spec.ts` | A keyed room from a pack, marked Hostile, ends "Room. From your adventure: …"; a pack's settlement ends "Town. From your adventure: …" whatever its type; a town made by hand still ends "Town. Made by you." (until ⚑ 13); nothing else of a marked place changes |

**Committed tests.** W18b changes what `townPage.test.tsx:453` allows (`inTown` alone no longer gives "Town"), and W7c adds to what `locationView.test.tsx:184` states: each takes an ordinary branch on the stack, not a `fix-` branch.

**The `09` lines their pull requests record** (neither has a rulings file):
- W18b: `2026-11-19 — [ui] A place's foot line says "Town." only for a settlement; a room or camp the GM marks Safe or Hostile keeps the pack's own word (Francis: "Only settlements") — a marked room read "Town."`
- W7c: `2026-11-19 — [ui] A place's picture that fails to load offers "Try again", on every place; no frame: built from his words and approved from the built picture (Francis: "Yes, add it") — a failed picture left the GM no way to ask again`

Docs each updates in the same pull request: 06 (the place page's foot line; the picture's part in the inventory and its Code column).

## Stack order
Two streams. They touch different files: stream A `supabase/migrations`, `src/modules/*`, `src/testing/*`; stream B `src/app/*`.

**Stream A, to main (data and logic only):**
1. W12, the stock record (briefed; local builder with a database session; migration 20261115110000).
2. W11b, Undo on "Buy it", with hard rule 4's text (hr4).
3. W4b, the player's read of a place's shown parts (tr-1).
4. W4c, the GM's eye on a place not entered (ge-1).
5. W13's remainder: the database refusal of a rumours table named as a weather table, after the weather fix.
6. W21's additions with each row.

**Stream B, on `dec-3-town-stack` (held; base per ⚑ 11):**
1. W1, W2, W3, W5, W7, W7b (the page), with W19 and W20.
2. W4 and W8 (a place; a person in the short form). W8's opened sheet waits for ⚑ 3.
3. W6 (encounters), after dec-9 S6.
4. W9 (the GM's stock), after W12.
5. W10a and W11 (the at-once answer; the ask card; Buy it's toast), after W9 and W11b.
6. W16, W17, W18 (players, phone, flat and hand-made).
7. W14 (the board).
8. W15 (the map), after dec-9 S13.
9. One set of as-built pictures to Francis (po-4, bs-1's three facts). Then the stack merges in order.
10. W10 (the player's stock list): after first play unless ⚑ 8 says otherwise.
11. W18b and W7c (the evening sitting of 2026-11-19): small rows on the stack, W18b after W18 and W7c after W7b; they share no file with each other. W7c's built picture goes to Francis with the stack's as-built set (step 9) or on its own, the driver's call.

**A cloud seat could take** (logic or tests only, each with a checkable result):
- W12's defaults as a pure function (the item's `availability` object → in / out / undecided, the open case isolated), and `townTrade.ts` reading the object: unit tests.
- tn-3's rule (a town's own places, else the generic services and lodgings) as a pure function in `town.ts`: unit tests.
- W21's additions: mark the rumours case covered; tidy the header and names; `it.todo` for tr-1, tn-8 and np-3, each naming its row. A database job result on the pull request.
- ck-1 holds: a cloud pull request touching `src/` gets one full local check before merge.

## What the first night needs most
The port meet-up with buying: the town's page with its places and people (W1 to W8), the GM's stock and the ask card (W9, W10a, W11, W12), Buy it with "Spend N" and Undo (W11, W11b), the players' town (W16) and the phone (W17). Rumours are built (W13); the board (W14) and the map (W15) may be run from the book if not done by the cut line.

## What could not be established
- **TW2c's own picture was not shown to Francis.** He approved the same box and stacking on a private page (ap-15); see the frames table.
- **A frame for opening a person in the short form** (np-2). None found; TW2b predates np-1.
- **TW4a and TW11 as redrawn with the ask card** were not opened by the lead (TW8g, TW1 and TW6 were).
- **TW4b's status.** It is approved under ap-8 by the page's rule for TW1 to TW7, but its caption calls it "a proposal" and tn-1 puts its content later. Read here as a picture of record that is not built for first play.
- **Files for w12-1, w12-2, ic-4, ic-5, ap-17, ap-18, sps-2, uf-2, av-1:** given on 2026-11-14 and not yet in a rulings file; the lead writes them up in the next docs batch.
- (Settled: rm-2 and rm-3's migrations are on the main database, 2026-11-14.)
- **Whether tr-1, ge-1 and bu-1 are being built.** No branch, migration or status file found.
- **Whether 2b's "Inside" list and tn-3's rule are built.** Places carry a parent in data; no screen or rule found.
- **Whether dec-9 S5 and S6 (the town's top, the tile's command change) are built** on #785's branch. Not checked.
- **Sizes** other than those quoted from dec-2-3, dec-7-5, dec-12 and december-first-play.
- **The day function** W12 should use: the brief leaves it to the builder to find.
- **Frames after their approval.** Many captions add "Tidied to the measured sizes, 2026-11-14" and ruling notes after the approval. Whether each tidy was shown to Francis is not recorded on the page.
- **"W4b" in the W21 brief.** The brief names a row W4b that the old plan did not have. Used here for tr-1's read; the brief's meaning is not stated.
- **Page 18** (the players' Scene) was not read frame by frame; the plan relies on dec-9-the-players-scene for it.

## Departures
(The builder keeps this section current in the same pull request.)

- **W11b, Undo on "Buy it" (2026-11-15, branch `dec3-w11b-buy-undo`).** Built as the row says (bu-1, bu-2, hr4), with these departures. (1) The buy toast today has no "Spend N" (W11 is not built), so only Undo was added to it; nothing else visible changed. (2) The command is `request.undoBuy` and a database function `undo_buy(request)`, copying `undo_activity`'s shape; it finds the bought line through the purchase's own request id and marks the request undone (the buyer's Buy it / Leave it card does not come back). (3) "Touched" is the line's version still being the one the purchase gave it (a new line is version 1), the line's version unchanged since it was made (bu-2); also refused when a light is lit from the line or something is put in it. (4) `CLAUDE.md` hard rule 4 now says six, with bu-1's sentence word for word; `docs/09` is left to the lead (dl-1).
  - **Fixed forward, two more migrations** (the first, `20261115180000`, applied on TEST, is never edited): `20261115190000_dec3_w11b_buy_undo_archived.sql` refuses the Undo once the buyer's character is archived (the cloud review's VB4); `20261115200000_dec3_w11b_buy_undo_touched.sql` (bu-2b) also counts a line as touched once any logged change to it, to a light that ever pointed at it, or to its hidden charges follows the event that made it, which supersedes (3)'s version-only test. Both replace `undo_buy` alone; nothing is dropped, renamed or deleted. All three are applied on TEST; the main push waits for Francis (out of order, so it needs `--include-all`: `docs/plans/w11b-fix-forward.md`, 5).
  - **The shared permission cases' fixture fixed (w11b-ff-1, 2026-11-18; tests only):** the four `undoBuy` cases used `freshOffer()`, a Sell offer, which the real database rightly refuses as "no purchase", so CI's database shard 3 failed while the stand-in passed. They now use a new `freshPurchase()`: in the database world a real Buy… answered In stock and replied Buy it with its line, through the commands (as `boughtLantern`); in the stand-in a Buy answered In stock and accepted, with a unit test that it stays so. The line's own facts (bought, version 1, the buyer's creating event) exist only in the database world: the stand-in checks `can()` against the request alone. `undo_buy` and the migrations are unchanged.
  - **(4) brought up to `main`:** hard rule 4 in `CLAUDE.md` is `main`'s text, which already carries bu-1 in its ruled words and now counts seven exceptions (ls-5 joined on 2026-11-17); this branch's "six" sentence was the merge's only conflict and gave way to it.

**W12** (`dec-3-w12-day-stock`, migration 20261115110000):
- The default is worked out twice, by the same rules: on the device (`stockDefault`, for the GM's table) and in the database (`private.stock_default`, for the players' reader, which never trusts a device's list; the lead's review of #856). A database test keeps the two in step. The reader takes each item for sale in the campaign (its winning version), the day's stored answer if any, else that default; the device's list only narrows it. The database reads the item's whole entry, its GM-only part included, for both whether it is for sale and its availability (only ids come back, never the entry). Words are trimmed in the database as JavaScript trims them. One extra public function, `shop_stock_default_check`, callable by the service role only, lets the database test reach the database's default directly.
- A GM's stored in on a thing not for sale isn't shown to players: the reader lists only items for sale.
- No place size reaches the reader yet, so the database reads the town's size as unknown: a thing sold by size is undecided for players until a size is wired in.
- The day is not worked out by the database (the clock holds seconds; the day's length is the pack's): the commands and the reader take the day number, from `readClock(seconds, units).day` on the device.
- **For W9:** the GM sets today only, but nothing in the database stops a set or reset for another day number, and a player can read the `in` rows of any day the GM has prepared (the read rule and the reader take any day).
- Order inside the default when an item says more than one thing: sold by size in a town of unknown size first (undecided, tn-6, before any chance); then not sold in this size (out); then sold in this size with no chance (in); then a chance ("always" in, "x-in-y" undecided); then rarity or note alone (undecided).
- `stock.set` takes in or out only, as the brief says; putting one thing back on "?" by itself (the toggle's third position) is not built.
- `townTrade.ts` still shows an item's `availability` on the GM's buy card only when it is a string: changing those words is a visible change, left to W11's card.

**W9's reader, narrowed** (`dec-3-stock-reader-narrow`, migration 20261115150000; the lead's ruling sh-1 (a), 2026-11-15; mockup: none, data and logic only):
- For a pack's shop (a `place:<entry id>` key), `shop_stock_in` returns only the things the GM stored as in for the day, still only items for sale in the campaign; it computes no default and ignores the device's `offered` list. A setting's shop reads as before. Narrowing only.
- LATER (Francis's yes, not built): a pack shop's own list read on the server, "in" by default for its "always" and no-availability lines (w12-1, w12-2). ⚑ To rule with it (ls-2, 2026-11-17): does a shop's own list decide what it sells, whatever the campaign-wide "for sale" says? Until then a GM's "in" on a thing not for sale at a pack shop stays unseen by players and the GM is told nothing.

- **W21 (#968).** W21: the it.todo lines for tr-1, tn-8 and np-3 are left to their own rows (#968).
