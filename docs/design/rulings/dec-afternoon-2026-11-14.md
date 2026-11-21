---
status: pending
milestone: December first play (the whole Pack tab; the whole Scene; the players' Scene; how a screen is put to Francis)
absorbed-into: pending, with each piece's pull request: 03, 04, 05, 06, 07; docs/09-decisions-log.md (2026-11-14)
supersedes: nothing as a file. Inside it: pf-19c replaces the wording of pf-19b in `dec-midday-2026-11-14.md`; pq-1 adds a prerequisite to every approval Francis gives from now on.
---

# 14 November, the afternoon: the order of design, the Pack tab drawn as one, and the book's format as a prerequisite (2026-11-14)

The lead wrote the whole-screen plans po-4 asks for (`docs/plans/dec-9-the-players-scene.md`, `docs/plans/dec-6-the-whole-pack-tab.md`); the town's is still to come. Francis ruled from his phone. Three times in one day he had asked whether a picture carried the latest style and the book's format, and three times the answer was no; pq-1 is the result.

## Francis's rulings

| Id | Ruling | Whose |
|---|---|---|
| do-1 | **The order of design work to first play: the Pack tab, the city, the map; the map is the reach goal.** They are worked on when they do not take seats from the path to build. | "Priority in design is pack tab, city, map with map as the reach goal" |
| pw-1 | **A player proposing a way is fine in principle and is built after 5 December**, or sooner if it comes up at the table. For first play the players' Where to? is built to its rows and a tap on a way's button explains, in a pop-up, that the GM moves the party. | "I think it's fine but can we wait till after the fifth or it comes up? Not needed for 5th" |
| ap-6 | **The Pack tab drawn as one page is approved in its first sitting** (`pack/08-the-pack-tab-whole.html`, frames PK1 to PK7b, at b474da61), with the lead's fixes and the Studio's picks: two columns on a tablet; no row of four facts (the load line, the coin line, a "Party stash" row, and a "New" card only when something is new); Add item at the list's foot; a chevron as the fold mark; offline, Take stays a button and explains; the stash's three facts as labelled lines with coin its first row; a find card to that character's player alone and a quiet toast for a stash arrival; an over-loaded taker warned, not blocked. His condition, that it carry the book's format and the current stylesheet, is met as fact: the page takes its type, book-format, button, sheet-head and toast rules from the shared mockup stylesheet alone. The second sitting (the item sheets, give and put in, drop and use, the GM's views) is not yet put to him. | "Approve your changes assuming book formatting and up to date style sheet are present" |
| pq-1 | **The book's format and the current stylesheet are a prerequisite for his approval.** Nothing is put to him unless it carries both, verified as fact and not by eye. | "Make those conditions (book format and style sheet) pre requisite for my approval moving forward" |
| wl-1 | **A player's weather roll is refused against a table players cannot read.** The GM's own rolls are untouched. The stricter rule (only the table in force) is not covered and comes back to him with the weather work. | "Yes close weather Leak too" |
| pk-12 | **When the GM sends a find from a hoard, one action adds the things and the coin together, and the GM's Undo takes both back in one step.** | "Yes to both" |
| pk-13 | **A player marks their new finds as seen: one mark the player writes on their own character, readable only by that player and the GM.** The lead narrows it: on the player's own approved character; only the player writes it; kept in a table of its own; a time set by the server; logged as a message's read time is, with no Undo. | "Yes to both" |

He also confirmed that the Scene's top (page 16) is redrawn on the shared stylesheet: "Yes redraw".

## How pq-1 is applied

| Id | Ruling | Whose |
|---|---|---|
| ms-1 | **Every mockup page links one shared stylesheet** (`docs/design/mockups/shared/book.css` and its pass, on `design-december-mockups`) and restates none of its rules. Its values come first from the app as built (the tokens of 06, the built parts), then from rulings, then from the Scene page as approved. So: the app's type scale only (14, 16, 20, 24, 30, 36, 48; the mockups' 18 and 22 are gone); the app's corners (4 for controls, 8 for cards, 20 for sheets); the app's toast, with Undo's arrow beside its word (ic-2); the book's faces everywhere, which is the target the app reaches screen by screen. The Studio's report on a page states, as fact, that it links the shared file and restates nothing. | The lead's |
| ms-2 | **Page 16's pictures of record move to 0fbaa95f** (from 662d45fa): cards' corners 8; card headings and row titles 20; sheet titles 20; a book table's title bar on the accent ground; the app's toast; stacked buttons one line each at one shared width, so the first waiting card's three buttons fall on two rows. Layout, words and behaviour are unchanged. | The lead's; "Yes redraw" (Francis) |
| bs-1 | **A piece's own surface goes into the book's scope when it is built or re-taken** (its sheet, its tab's content, its card); what surrounds it and belongs to another piece waits for that piece. As-built pictures state three facts in their README: the screen is in the book's scope and which part wraps it; main is merged in; every picture was taken at the final commit, named. | The lead's |
| bs-2 | **Inside the book's scope a list row's title is 20 px**; a figure row's name beside its figure and a field label keep 16. Its own small shared-part pull request. Boxes inside a card take the 8 px corner; controls keep 4. | The lead's |
| ms-3 | **Still open, for the sweep:** which zero the book's face shows (the mockups slash it; the app's book block does not); and six places where the app as built and a ruling or drawing differ: the pop-up centred on every width against rising from the foot on a phone; the toast inverting with the theme; Undo as an underlined word against a bordered button; the section label at 20 against the Pack's group heads at 14 (psw-1); a book table's title bar on the accent against an ink ground; the Pack list's card title against psw-1's small capitals. | The lead's |

## The pack format

| Id | Ruling | Whose |
|---|---|---|
| pf-19c | **In a patch's change path a numeric step is always an object key; a patch never sets into, makes or pads a list.** Replaces pf-19b's wording, which wrongly said a step could index an existing array: pf-19 already refused any path through one, and that stands. | The lead's |

## Also decided, without an id
- The Pack tab's rows released on 14 November: logic only, to cloud seats, K28, K14, K16a, K27 (briefs in `docs/plans/briefs/`), then K20's table and command and K16b's send; and, once ap-6's condition was met, the rows its first sitting draws (K9 and K10, K1 and K2, K3, K11 and K13, K12, the visible parts of K18 to K20, K21, the drawn states, the phone, and K16c after the Scene's place page).
- Two further gaps beside wl-1's (a hidden weather table's die; a readable table's own GM-only fields) wait with the stricter rule after 5 December: no weather table in the campaign's packs is the GM's alone.
- A brief that touches who may read or write is checked against Francis's exact words by a second reader before it goes out. The first draft of pk-13's brief let the GM write the mark and allowed it on a column every reader of a character could read; it was narrowed before anything was built.

## Honest notes
- The lead told Francis the Scene page's approved pictures would change "only in a button and the toast"; they also changed in heading sizes and corners, and he was told so before the redraw.
- The mockup pages had each carried their own copy of the type rules, with sizes and corners the app does not have; nobody had tied them to the app's stylesheet.
- Two older shared files (`creation/final/final.css`, `pack/pk.css`) still name the older display face in a few rules; the shared pass overrides them. Pages 05 to 07 and creation's sweep pages move onto the shared file when each is next touched.
- The lead opened two of the Pack page's eleven first-sitting frames on the shared stylesheet, and one of page 16's twenty-one after its redraw; the Studio opened all eleven of the first and four of the second.
