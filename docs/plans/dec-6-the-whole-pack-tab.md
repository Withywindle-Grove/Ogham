# Plan: the whole Pack tab, built once

Written by the lead on 2026-11-14. It covers the Pack tab whole: a character's pack (its lists and load), the coin line and the purse's sheets, the party stash as a screen of its own, a find arriving from the GM with its card, and the short actions on an item. Rule po-4 (`docs/design/rulings/dec-scene-whole-2026-11-14.md`): before any piece of a screen with an approved redesign goes to a builder, its plan covers the whole screen's drawing; a drawn part with no row stops the hand-out; every visible row names its mockup and the date Francis approved it, or says "none: data and logic only". A ruling in words is not an approval of a screen.

**Status, 2026-11-15: the seven first-night rows are RELEASED** (K7, K11, K12, K13, K15, K16, K21; the table "The first-night seven" below names each one's approved frame). The Pack tab's page is drawn whole and approved: `docs/design/mockups/pack/08-the-pack-tab-whole.html` on `design-december-mockups`, frames PK1 to PK7b by ap-6 (2026-11-14, at b474da61), PK6b and PK8 to PK13 by ap-7 (2026-11-14), PK8b to PK8d by ap-9; the purse's frames, page 07, at 395076bb (2026-11-13). The other rows are released in Francis's order (ord-2: the rest of the Pack tab after 5 December); their "Mockup" cells below still read as written on 14 November and are brought up to the frames when each is handed out. **What follows in this paragraph is the status as first written, kept for the record:** NOT RELEASED. It cannot be released until the Pack tab's drawing is whole and approved. Only the purse's frames (page 07) carry Francis's approval today. Drafted from the sources by a worker and reviewed by the lead. Francis put the Pack tab first in the order of design work (2026-11-14: "Priority in design is pack tab, city, map with map as the reach goal"); the Studio's brief is `docs/design/notes/brief-pack-tab-whole-2026-11-14.md`.

## The first-night seven (released 2026-11-15; ord-2)
Each row is built to its frame, and "as designed" is judged against the frame (fd-1): before a row is called done its builder lists anything the frame draws that this table does not say. The Pack screen's first row splits `PackScreen.tsx` by section (be-3). The Player screen's C14 and C6 share that file: one builder in it at a time, in the order K15, C14, C6, then these rows.

| Row | Frame (page 08 unless said) | Approved | What the frame draws beyond the row's words below |
|---|---|---|---|
| K7 | PK10b | ap-7, 2026-11-14 | Fields for where it goes and how many; the cost above its button; "No cost" gives a plain toast; after a purchase the toast offers Undo and "Spend N", which opens the Spend sheet (page 07, PC4) with the amount filled in; nothing is charged by itself (tn-1). The line "Cost noted; purses arrive later." goes |
| K11 | PK4, PK6 (phone), PK7b (empty, offline), PK9b, PK12, and PK1 for the "Party stash" row on the Pack tab | ap-6 (PK1, PK4, PK6, PK7b), ap-7 (PK9b, PK12), 2026-11-14 | Three facts each with who and when; no accent; "Put something in" at the foot; the taker's room; "You are taking for" chips only for a player with more than one character; a player's own lines keep Undo while they can be undone |
| K12 | PK4b, PK4's rows, PK7b | ap-6, 2026-11-14 | Over the limit the taker is warned in the toast and not blocked; the toast names the effect on the taker's load; offline, Take stays a button and explains itself. The row stays as ruled, not PK12's one-line proposal |
| K13 | Page 07, PC6 and PC6b; its place first on PK4 | 2026-11-13 ("i approve with your changes", pu-3, pu-5); ap-6 for PK4 | Every coin the setting names, nought shown as 0; the refusal line ("The stash has 40 herons."); the toast with Undo; the accent reads the amount ("Take 10 herons"); coin goes in by "Give to…" from a player's own coin (PC5) |
| K15 | Page 07, PC7 to PC9 (coin); PK11 (the chips and the GM's stash) | 2026-11-13 for PC7 to PC9; ap-7 for PK11 | The GM's stash has no Take (the GM gives); "Put in" on the GM's stash starts PK5's hand-out with the stash as taker; chips never cut a long name; the log's words for a gift; "Put in 20 herons" as the accent for the stash. Take's icon is provisional until Francis picks one |
| K16 (K16a its rows, K16b the send, K16c on the place page) | PK5, PK5b; the Treasure row on page 11's place card (pg-1, 2026-11-13) | ap-6, 2026-11-14 | Both answers on the Send sheet equal, no accent; "Send all" and a tap on one row; after sending, the piece says where it went with a tick and words; a half-sent hoard keeps its sheet; to the stash it happens on the tap with Undo (pk-2); the GM sees the over-limit warning before sending |
| K21 | PK3 (the find card naming coin), PK5 (the hoard's coin row) | ap-6, 2026-11-14 | Coin lands in the purse, not the lists; "New" on the coin line until Got it; the Pack icon's count counts coin as one; a card naming coin goes to that character's player alone and others see a log line with no amount; a coin word only the book prints is kept as printed, with a note |

Not pinned to a commit: ap-7 names none; the frames are read at the mockup branch's head. Francis saw six of page 07's frames on 13 November; if PC6b or PC7 to PC9 were not among them, their as-built pictures are his first sight of them.

**Released on 2026-11-14, logic only ("none: data and logic only"), to cloud seats:** K28 (the log lines and Undo for finds and Take), K14 (who and when on a stash row, read from the log), K16a (a hoard's rows from a Treasure piece) and K27 (the hidden-means-hidden tests). Their briefs are `docs/plans/briefs/dec-6-k28-…`, `dec-6-k14-…`, `dec-6-k16a-…` and `dec-6-k27-…`. Everything with a visible piece waits for the Studio's page `pack/08-the-pack-tab-whole.html` on the shared mockup stylesheet (pq-1) and Francis's approval of it (ap-6, given for its first sitting on the condition that it carries the book's format and the current stylesheet). The Builder's sizing of 2026-11-14: about 30 turns (27 to 34), about 24 for the first night without K17, K22 and K23; the serial path is `PackScreen.tsx` (K9+K10, K1+K2, K3+K8, K11+K13, K12, K7, K26, then K24 and K25).

Rulings: `pack-rework-rulings-2026-11-11.md` (pk-1 to pk-6, tb-1); `dec-pack-and-rules-sweeps-2026-11-13.md` (psw-1 to psw-7); `dec-purse-screens-2026-11-13.md` (pu-1 to pu-9, pf-17); `dec-afternoon-2026-11-13.md` (pu-10); `dec-evening-2026-11-13.md` (pk-11, pu-11); `dec-pack-formats-2026-11-11.md` (pf-6); `dec-midday-2026-11-14.md` (ic-1, ic-2). Plans: `dec-6-purse.md`, `december-first-play.md`.

Drawings (branch `design-december-mockups`, folder `docs/design/mockups/pack/`): pages 01 to 07, below.

## Where the drawing stands

| Page | Shows | Ruled by | Francis approved the frames | A later ruling changes it |
|---|---|---|---|---|
| 01 `01-pack-tab.html` (mockup a) | The tab standing; a find arrived; four ways of counting a load; coin C1 to C3; empty, sixty things, loading, failed, offline; wide PC; phone | pk-5 (New, the card, the tag); pk-6 (coin) | No record. The index calls its pictures "a proposal, not ruled" | pu-1 to pu-5 replace C1 to C3 (and the purse plan calls them dashed); psw-1 (chevron the one fold mark; small capitals heads); psw-2 ("Weight" head, unit once on the load's line); psw-3 (foot counts things once); ic-1 (icons on every button, word under) |
| 02 `02-a-find-arrives.html` (mockup d) | The GM sends a find from the place (frames 1 to 7); a table's row and "Share it out" (A, B); the player's card (P1 to P6, P2b coin); to the stash (S1); a later reveal (R1); states; wide; phone | pk-1, pk-2, pk-5; pf-6 (a row may name its hoard); pk-11 (a hoard's oddly printed coin read as gold, with a note) | No record | pu-3, pu-5 (coin's one pattern; coin was drawn in dashes); pg-1 (the place page, page 11, approved 2026-11-13) replaces 02's place card: treasure is now a "Treasure" piece there; ic-1 |
| 03 `03-party-stash.html` (mockup b) | A player's stash (1 to 3, 3b coin); the GM's stash; a Down character's pack; states; wide; phone | pk-2, pk-3, pk-4 | No record | pu-3: the stash's coin is a chevron row first in the open stash, no button on it (03 drew coin as a fourth fact and a row with Take…); ic-1 |
| 04 `04-short-actions.html` (mockup c) | An item's sheet; Give to…; how many; Put in…; Empty…; Drop; use one; put into the stash; coin (frame 12); refusals; wide; phone | pk-3 (Take, drawn in 03) | No record | psw-4 (an action sheet keeps the app's title); psw-5 (the sheets' words, one way out, the two-sided switch); psw-6 (Give and Put in one sheet with a link back); pu-1 to pu-5 (coin); pin-1 (the star stays the pin's mark, approved 2026-11-07); ic-1 |
| 05 `05-sweep-a-pack-tab.html` (sweep A) | PA1 to PA6: the built tab dressed; over the limit; nothing carried; the stash opened inside the tab; the GM's chips; the tablet | psw-1, psw-2, psw-3, psw-7 | No record of the frames. Pre-approved by Francis through the lead: "Actually pre approval stands but still share the mock ups" (2026-11-13) | ic-1. Its own note: "The approved Pack rework (pack/01 to 04) is not built and is not drawn here" |
| 06 `06-sweep-b-actions.html` (sweep B) | PB1 to PB10, PB9b: a thing's sheet, a container's sheet, Give, how many, Put in, Drop, Add item, after a purchase, a container's note, Tiny things, waiting for the GM | psw-4, psw-5, psw-6 | As page 05 | ic-1 |
| 07 `07-purse.html` | PC1 to PC10, PC6b, PC9 (GM's stash): the coin line, its sheet, Spend, Give to, the stash's coin, Take coin, the GM's give and take, the tablet | pu-1 to pu-9, pf-17 | **2026-11-13**, at commit 395076bb: "i approve with your changes" (he saw six of the frames) | pu-10 (the pack's coin labels as written, "30 Gold"); pu-11 (two refusals named); ic-1 (the accent buttons "Spend 2 herons" and the rest take an icon) |

## What must be drawn or redrawn before any row is handed out

A brief for the Design Studio. Nothing here is designed by the lead.

1. **One consolidated Pack tab page** that brings pages 01 to 06 up to every ruling in force, in the swept dress (05, 06) and the book's type:
   - pk-2: a find and a taken thing land loose; no "Where it goes" for the GM.
   - pk-3: every stash row ends in Take (a stack asks how many).
   - pk-4: the stash's own screen; who and when on each row; three facts; the taker's room; recent lines.
   - pk-5: the card, the count on the Pack's icon, New and the row's tag until Got it; the stash's announcement quieter; several merged.
   - pk-6, pu-1 to pu-6, pu-10: coin in the one pattern; replaces 01's C1 to C3, 03's coin fact and 3b, 04's frame 12.
   - psw-1 to psw-6: heads, chevrons, the Weight head, the foot's count, sheet titles, the action sheets' words, Give and Put in as one sheet.
   - psw-7: the tablet's right column, which the rework fills (01 drew the stash, the new and the waiting there).
   - pg-1: the GM's hand-out starts from page 11's Treasure piece, not 02's older place card.
   - pin-1: the pin stays a star (04's question 3 asked for a row).
   - ic-1, ic-2: an icon on every button with its word under; a row that opens a screen takes a leading icon.
2. **Coin in a hoard and on a find card** (pf-6, pk-11, pu-3, pu-5). Needed for 5 December: the first night's finds include coin, and piece c of `dec-6-purse.md` lists both. Page 07 left them out "as their own page, from pack/02's approved frames".
3. **The Pack tab's states** in the new dress: loading, offline (03's question 6: Take explains itself offline), a failed save, empty pack, empty stash. Needed for 5 December: the self-review requires every state, and 07 says loading, offline and a failed save were not checked.
4. **Larger text.** Can wait: no source requires it before 5 December; pages 01 to 07 all list it as not checked.
5. **A Down or dead character's purse open to the party** (ruled 2026-10-29; piece a built its read rule). 03 drew the pack; no purse frame. Can wait: fights are the reach goal for 5 December; but the purse plan's "Done when" includes it (to confirm).
6. **Another player's view of a pack.** Can wait: "there is no screen that opens another character's pack" (07).
7. **A hireling's purse as its employer sees it.** Can wait: hirelings are not on the December path.

## The rows

| # | Piece | Rulings | Picture | Today | Needs first | Size |
|---|---|---|---|---|---|---|
| K1 | **The tab's layout and facts**: whose pack, one line, the facts row (Load, In hand, New, Party stash, if ruled), two columns on a tablet, Add item in the band | pk-4, pk-5, psw-7 | no approved picture: stops before the screen (01, standing) | Built as one column; the load alone at the top | Item 1; ⚑ 1, 2, 4 | to be sized by the Builder |
| K2 | **The load line**: tier, bar, figure, unit once; over the limit with its sign | psw-2 | no approved picture: stops before the screen (PA1, PA2) | Built | Item 1 | to be sized by the Builder |
| K3 | **The lists and rows**: At hand, Worn and in hand, each container, Carried, Tiny things, Other; the Weight head; chevron folds; the foot "11 items" | psw-1, psw-2, psw-3 | no approved picture: stops before the screen (PA1 to PA4) | Built in today's type | Item 1 | to be sized by the Builder |
| K4 | **The item, stack and container sheets**; a container's note under its head | psw-4, psw-6, pin-1 | no approved picture: stops before the screen (PB1, PB2, PB9; 04 s1 to s3) | Built (`ItemSheet.tsx`) | Item 1; ⚑ 11, 12, 14 | to be sized by the Builder |
| K5 | **Give and Put in** as one sheet with a link back; how many | psw-5, psw-6 | no approved picture: stops before the screen (PB3 to PB5; 04 gv1, hm, pi) | Built (`ItemMoves.tsx`), two sheets | Item 1; ⚑ 16 | to be sized by the Builder |
| K6 | **Drop, use one, Empty…**, each with its toast and Undo | psw-5 | no approved picture: stops before the screen (PB6; 04 dr, us, emp) | Built | Item 1; ⚑ 13, 15 | to be sized by the Builder |
| K7 | **Add item and after a purchase** ("Bought / No cost" as the two-sided switch; the pack's coin word) | psw-5 | no approved picture: stops before the screen (PB7, PB8) | Built (`AddItem.tsx`); still says "Cost noted; purses arrive later." | Item 1; ⚑ 17 | to be sized by the Builder |
| K8 | **Tiny things; the card "waiting for the GM"** | psw-1 | no approved picture: stops before the screen (PB9b, PB10) | Built | Item 1 | to be sized by the Builder |
| K9 | **The coin line** under the load, a chevron row; "No coin" | pu-1, pu-6, pu-10, pf-17 | 07 PC1, PC2, PC10, approved 2026-11-13 | Built to data only: the words (`coinWords.ts`), the commands (#757) | The 6b migrations on the main database; ic-1 on its sheets | dec-6-purse piece c: "2 turns, with pictures" (with K10, K13, K21) |
| K10 | **The coin's sheet, Spend, Give to**: a row a denomination, a box, one accent naming the amount, refusals under the row | pu-2, pu-4, pu-5, pu-8 | 07 PC3 to PC5, approved 2026-11-13 | Built to data only | As K9 | in K9's 2 turns |
| K11 | **The party stash as its own screen**: title, three facts, the lists, the taker's room, recent lines | pk-4 | no approved picture: stops before the screen (03, 1 to 3) | A fold at the foot of each Pack; the GM's console screen | Item 1; ⚑ 7 | "the refreshed Pack screen and the stash as its own screen (5–8)" (december-first-play, tier 2) |
| K12 | **Take on every stash row**: a single thing at once with Undo and its load in the toast; a stack asks how many; lands loose | pk-2, pk-3 | no approved picture: stops before the screen (03, 2 and 3) | Done today by Give to… in four steps | Item 1 | to be sized by the Builder |
| K13 | **Coin in the stash**: the chevron row first; "Party stash's coin"; Take… for a player | pu-3, pu-5 | 07 PC6, PC6b, approved 2026-11-13, drawn in the stash as built | Built to data only | Its place on K11's screen redrawn (item 1) | in K9's 2 turns |
| K14 | **Who and when on a stash row**; the stash's last in and last out | pk-4 | none: data and logic only (its screen is K11) | Not built: the log alone has it | The Builder says whether it is a field or a read of the log | to be sized by the Builder |
| K15 | **The GM's views**: the chips a pack; the GM's stash; Give coin…, Take coin… | pu-3, pu-8, psw-1 | 07 PC7 to PC9, approved 2026-11-13; the chips PA5 and 03's GM frame: no approved picture | Chips built; coin built to data only | Item 1 for the chips and the GM's stash | to be sized by the Builder |
| K16 | **The GM sends a find**: tap a Treasure piece, whole hoard or one thing; Send to a character (then which) or to the party stash; Something else… searching the adventure's pack first | pk-1, pk-2, pf-6, pg-1 | no approved picture: stops before the screen (02, frames 1 to 7, on the old place card) | GM gives today from the character's Add item | Item 1; the Scene's plan (`dec-9-the-whole-scene.md`) has no Treasure row: one plan must own it | "Finds handed to a character or the stash (pk-1 … pk-5) 3–5" (december-first-play, tier 1; covers K16 to K20) |
| K17 | **A table's row of things sent in one tap**; "Share it out…" | pk-1 (the lead's reading: "built if time allows") | no approved picture: stops before the screen (02, A, B) | Not built | ⚑ 10; the pack carrying a row's things as items | 02: "the Builder sizes it at 1 to 2 turns" |
| K18 | **The player's find card**, wherever they are; several merged; the stash's quieter | pk-5 | no approved picture: stops before the screen (02, P1, P2, P5, S1) | Not built: a log line only | Item 1; ⚑ 9 | in K16's 3–5 |
| K19 | **The count on the Pack's icon** | pk-5 | no approved picture: stops before the screen (02, P1) | Not built | Item 1 | in K16's 3–5 |
| K20 | **New until Got it**: the New fact, a card, a tag on the row | pk-5 | no approved picture: stops before the screen (01, arrived) | Not built | Item 1; where "seen" is kept (the Builder) | in K16's 3–5 |
| K21 | **Coin in a hoard and on the find card**, the hoard's printed words with pk-11's note | pf-6, pk-11, pu-3, pu-5 | no approved picture: stops before the screen (not drawn; item 2) | Not built | Item 2 | in K9's 2 turns (dec-6-purse piece c) |
| K22 | **What a player notices of an unidentified find**; the GM's eyes; Tell them everything | 05's unidentified rulings (not built) | no approved picture: stops before the screen (02, frame 4, P3, P4, P6, R1) | Mostly not built; a per-field Reveal exists | ⚑ 8; whether it is this plan's | "hidden information on an item (2–3)" (december-first-play, tier 2) |
| K23 | **A Down or dead character's pack and purse** open to the others, every take logged | 2026-10-29; pu-7's line | no approved picture: stops before the screen (03, Down frame; no purse frame) | Purse: read rule and take built (pieces a, b); screen not built | Item 5 | to be sized by the Builder |
| K24 | **The phone**: each of the above at 375 px; Add item above the tabs | psw-1 to psw-6, pu-1 | 07 PC1 approved 2026-11-13; the rest no approved picture | Built in today's type | Item 1 | with each row |
| K25 | **Icons on every button** (word under); Undo's icon | ic-1, ic-2 | no approved picture: stops before the screen (no Pack frame drawn with them) | Not built on the Pack | Item 1 | to be sized by the Builder |
| K26 | **Every state**: loading, offline, failed save, empty pack and stash, over the limit, messy data | — | no approved picture: stops before the screen (01's and 03's states predate the sweep) | Today's states; offline refuses with a raw error (the proposal, not checked) | Item 3; ⚑ 6 | with each row |
| K27 | **Hidden means hidden** (tests on what the database sends): another living character's purse, to any player (piece a's read rule); a purse line's amount to anyone who can't read that purse (dec-6-purse); a find's card naming coin, to anyone but that character's player (02); an unidentified thing's true name, bonus or curse, before the GM tells (02); a place's Treasure piece and its value, to players (pg-1, "Value stays yours"); a Down purse, once the character recovers (2026-10-29) | hard rule 5; pu-9, pu-11 | none: data and logic only | Purse cases built (33 database, 27 stand-in); finds and stash none | — | with each row |
| K28 | **The log lines and Undo**: the purse's lines in pu-7's words; a find's line naming the place and hoard; Take's line; every action with Undo in its toast; an item leaving play deleted with its copy in the log | pu-7, pk-3, hard rule 4 | none: data and logic only | Purse lines built (`events.ts`); finds and Take not | — | with each row |

## Needs the product owner's yes

- **The purse's two migrations on the main database** (`20261114090000`, `20261114093000`): merged in #757, applied on TEST; whether they are on main was not found in the status files: the Builder confirms. Until 5 December add-only migrations go through the Builder's database sessions (db-s1 to db-s6); from then the main push is Francis's again.
- **Who and when on a stash row** (K14), if it is stored: a new field, a new migration.
- **New until Got it** (K20), if "seen" is stored: a new thing a player writes about their own character.
- **A find card that names coin** reaches only that character's player: who reads it, in plain words, before it is built.
- **A player seeing another living character's load when giving** (04's variant A) would open something new to read. Variant B opens nothing.

## ⚑

These are the questions the pages themselves raised that no ruling answers. The Studio draws its pick for each on the consolidated page and lists them; Francis rules them on the page, not one by one in words. K16 (the GM's hand-out from a Treasure piece) is owned by this plan; the Scene's plan shows the Treasure piece as a piece and takes no row for its tap.

1. The Pack in two columns on a tablet, the stash and what is new beside it?
2. Four facts at the top (Load, In hand, New, Party stash), coin its own line under them?
3. Add item at the top, in the title band?
4. A find field once a pack passes about twenty things?
5. 01 asked chevron or +; psw-1 rules a chevron for the sweep: does it hold for the rework too?
6. Offline, does Take from the stash wait and say why?
7. The stash's facts: what is in it, the last in, the last out (coin now a row, pu-3, not a fact)?
8. What a thing really is, shown with the eye, one per hidden fact?
9. Does a find card show to the other players too, or only the log?
10. "Share it out…" for the first night, or the stash and Take enough?
11. An item's sheet in the panel at the right edge, or the centred sheet as built?
12. Every action a row with an icon and one line saying what it does (against mc-46's "no explainer line")?
13. "Eat one", "Drink one", "Use one" on a stack's sheet as well as At hand?
14. The − and + on a stack become "Correct the count…"?
15. Drop's line says "It is gone"? And "Use a charge" at 0 stays a row that explains?
16. May a player see the others' load when giving: the figure (A) or a warning only (B)?
17. After a purchase, what replaces "Cost noted; purses arrive later." now purses exist?
18. An over-loaded taker is warned, not blocked, and the GM sees it before sending?
19. No Split: some of a stack moves by Give, Put in or Drop?

## Not in this plan

- The Player screen's quiver, pouch, wield modes and pins (md-1, pin-1, stk-1 said as sb-2, tog-1 said as tg-1): the Player screen's own plan.
- The party fund and treasure shares; coin's weight; prices charged on buying; change between coins (pk-6, "Not in the first cut").
- Due and repeating spends: not found in the sources.
- Hirelings, and a hireling's purse as its employer sees it.
- Rumours sent from a table's row (tb-1): their own piece, though the send sheet is shared with K16.
- The shop's StockRow and gear in creation (cs-21, cs-42 to cs-44): creation's plan; a Pack sheet that buys reuses the part, never rebuilds it.
- The Scene's place page itself (pg-1, `dec-9-the-whole-scene.md`), except the Treasure piece's tap (K16).

## Stack order

1. The drawing made whole and approved (items 1 to 3).
2. The purse's migrations on the main database.
3. K9, K10, K13, K15's coin, K21 (piece c), on the redrawn tab.
4. K1 to K8, K24 to K26: the tab in its new dress, built once.
5. K11, K12, K14: the stash's own screen and Take.
6. K16, K18 to K20: the hand-out and the announcement.
7. K22, K23, K17: as Francis rules and time allows.
8. K27 and K28 run with every step. One set of as-built pictures goes to Francis, then the stack merges in order.

## Departures
(The builder keeps this section current in the same pull request.)

### K9 + K10, the coin line and the coin's sheets (branch `pack-k9-k10-coin`, 2026-11-14)
1. **The GM's coin line and sheets arrive with K15** (accepted by the lead, 2026-11-14). Until then the coin line shows to the character's own player only, and the Pack asks the database for no purse but its own player's character's.
2. **The accents' icons were named by the lead, 2026-11-14**, as the frames draw none: Spend `two-coins` (the coin icon Buy carries), Give `open-palm`, Put in (coin into the stash) `open-chest` (as PK4 draws on the stash's Put in); never `swap-bag`. They use the shared `StackedButton` (#803), icon above the words; the words keep the amount on one line (the button's cap lifted to the sheet's width, at least 88 px), wrapping only where a very long receiver's name can't fit the sheet at all. `open-palm` and `open-chest` were added to `src/ui/iconSet.ts` from the Studio's folder at b474da61, by Skoll as its CREDITS.md gives (no link: as far as I know the set's licence file gives none for Skoll; to check). In the same edit, the Studio's plain names: run, trail, night-vision, cancel, awareness, confirmed renamed, magic-palm and spell-book renamed, the two new ones named; `character` and `present` were not in the table.
3. **A row's label is the coin's name with a capital first letter** ("Herons" from "herons"), as the frames draw; the coin line, the buttons and the toasts keep the name as written (pu-10).
4. **Two coins at once are named in the setting's order** on the button and the toast ("Spend 1 crowns, 2 herons"); the log line (`src/core/events.ts`) orders them by key, so a two-coin toast may name them in another order than its log line. One coin reads the same in both.
5. **Not drawn, built on the item Give's words:** Give with nobody chosen says "Choose who gets it." as a toast (the item Give sheet's words); nothing typed is refused under the first coin's row; a refusal from the database (a race) under the first coin typed.
6. **A setting that names no coin, with an empty purse, shows no coin line** (nothing to show or spend); a purse holding coin under keys the setting doesn't list still shows them, as written (pu-6).

### K15's coin, the GM's Give coin… and Take coin… (branch `dec-6-k15-gm-coin`, 2026-11-15)
1. **No new read, no migration.** The read rule of 6a (`private.may_read_purse`) already lets the GM read every character's purse but another person's draft; the commands `purse.add` and `purse.remove` (6b) already did the GM's give and take. Only the Pack's ask for the purse widens, to the GM on a character's pack (players unchanged). Item 1 of K9 + K10 above is closed for the coin line and its sheets.
2. **Settled (Francis, 2026-11-18): Take coin… carries `grab` by Lorc and Give coin… `receive-money` by Delapouite** ("grab is fine to use, but let's use receive-money for give coin"); the player's Give to… keeps `open-palm`. Before the ruling Take carried Spend's `two-coins` provisionally and Give coin `open-palm`.
3. **Take coin says nothing about where the coin goes** beyond the frame's rows, "Take 10 herons" and the toast "Your GM took 10 herons from Wren" (the log line's words, pu-7): kept exactly as PC8 draws it (the lead, 2026-11-15). The coin leaves play (`purse.remove`); Undo puts it back.
4. **The GM's give has no ceiling in the sheet:** what she has shows under each row; past 999,999,999 the database refuses (pu-8) and the refusal shows under the coin's row.
5. **Not built:** the chips (PA5) and the GM's stash coin (PC9), out of this piece's scope.
6. **Settled (Francis, 2026-11-18): a GM who owns the character keeps the player's sheet as built** (Spend… and Give to…), with no Give coin… or Take coin… ("a gm will only ever briefly own a character, no need for exceptions").
7. **Another person's draft never reaches the GM's coin line:** the Pack's carriers are approved characters only (`loadCarriers`), so a draft's pack is not opened there and no purse is asked for; no test added (nothing to hide).

### K16b, the GM sends a find (branch `dec-6-k16b-send-find`, 2026-11-15)
1. **The Undo is its own GM-only function, `public.undo_find`**, not a change to `coin_action_lines` and `undo_as_gm` as the brief said: the generic Undo can't remove a made line (the lead's option (b) on #828). The generic Undo still refuses a find, for the GM and players alike.
2. **The place and the hoard rows are on one GM-only line of the send** (rp-4, the lead on #828), not on every line as K28's shape has it: the party's lines carry `{"find":{"to","coin"?}}` only. So a player's log line names no place, even one their group was shown ("Your GM gave Wren Moon opal ×2, coin."); the GM's reads "…, at <place>." K28's reader takes the place from the line that names it.
3. **The rows the send took (`"rows"`, as `"2:thing"`) are on that GM line**, a key K28 doesn't list, so "Sent to <Name>" is read from the GM's log.
4. **No `hoardId`:** K16a's hoards have no id, so the GM's line reads "…, at <place>." without a hoard.
5. **pk-11's printed words are not kept** (K28: ids only); the coin sent is what the row was read as.
6. **The Undo also takes back the knowledge of an item the send taught the party** (uf-2, Francis, 2026-11-14: "Yes"), recorded at the send on the GM line (`after.learned`), and only while no line the party holds still has one (`private.held_by_party`; an NPC's copy doesn't count, the lead's reading).

### K21, its logic half (branch `dec6-k21-coin-logic`, 2026-11-15; no screen)
1. **Built on K16a and K16b, not beside them:** `hoardCoin` reads the hoard's rows (`hoardRows`) and `findCoinOf` reads the find's own purse line, both beside the code they build on (`src/modules/expedition/hoard.ts`, `findSend.ts`); `findCardCoin` words the card's coin. No new module, and no new link between modules.
2. **A coin at 0 is left out** of a hoard's coin and of a find card (the brief: "never a '0' line"); K16a's coin row still keeps it as the pack wrote it.
3. **Never guessed, refused by reason:** a key that isn't one of the setting's coins, an amount that isn't a whole number of 0 or more, and a coin added up past the database's own limit for a send (999,999,999, `give_find`). Each is left out and named (the status file's ⚑ 1 to 3).
4. **The book's words and pk-11's note are kept per coin row** as the pack gives them (`coinsReadAs.note`), never reworded; the find card names the coin in the setting's words (PK3 draws "40 herons"), with no note.
