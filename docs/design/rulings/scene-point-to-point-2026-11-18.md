---
status: absorbed
milestone: December first play (the Scene at a place of linked Locations: point to point; the players' Scene; maps arriving with a pack)
absorbed-into: docs/03-roles-permissions.md (the marching order's row, p2p-21; the call-to-adventure send row, p2p-15), docs/04-data-model.md (Expedition's method, p2p-6), docs/05-features.md (Sessions and Depart, p2p-4, p2p-5; Point to point: Move on, the trail and reading ahead, p2p-2, p2p-6 to p2p-9; the encounter check, p2p-14, p2p-18, p2p-19; End expedition, leaving and Make camp, p2p-22, p2p-23; Calls to adventure, p2p-15; Places for players, p2p-11), docs/06-screens-and-design.md (words: p2p-1, p2p-3, p2p-17; one height, p2p-16; the inventory rows Procedure strip, Marching order, Place rules, Move on, GM's place page with the Locations panel and reading ahead, Scene band with the Depart sheet and the folding top: p2p-4, p2p-5, p2p-7 to p2p-15, p2p-18 to p2p-22), docs/07-content-packs.md (the bundled file, p2p-27; a hoard and its counts, p2p-28; a magic item's piece, p2p-29; a way's icon, p2p-30 with pf-25; two marks on a Location, p2p-31; players' names, p2p-11), docs/10-open-questions.md (the four ⚑); plans dec-9-the-players-scene.md (status, p2p-25, p2p-26; P4, p2p-24), dec-9-the-whole-scene.md (S5, S12, S13, S14), dec-7-5-place-page-and-map.md (the trail, p2p-8); docs/09-decisions-log.md (2026-11-18). Most of it is ruled and not built yet; the specs say so
supersedes: nothing as a file. Inside it: p2p-4 replaces the with-no-session half of fno-1 and S5's "Depart shows in every session state"; p2p-8 replaces the trail's tap that moved the party (dec-7-5, 5b); p2p-10 and p2p-11 change page 11's frame 1b (the description under the name, the "Pieces" heading, the kind words, "Players see" and Rename); p2p-13 changes gt-1 (S14); p2p-15 changes mc-61; p2p-21 removes the marching order's lock; p2p-24 changes page 18's PL1 in one place. Kept as they were: pw-1, mo-3, cl-1, mc-53 (a plain strip).
---

# The Scene, point to point: a paper dry run after the live test (2026-11-18)

Francis tested the live Scene on 18 November with the island adventure and found it "incomplete/broken" with "a lack of guidance or order of play". His priority for 5 December: "point to point, then dungeon, then wilderness." This sitting walked one point-to-point session at the adventure's harbour, from "the GM opens the app" to "the party makes camp or leaves", as the GM and as a player. The walk itself: `../notes/scene-point-to-point-dry-run-notes.md`. Names here are invented (Saltwick Island, The Drowned Harbour, The Anchorage, 1. The Jetty); the pack's own names and words stay in the private pack.

He said afterwards what he had meant by guidance: "i meant the whole page was overwhelming but i think my feedback is reducing the noise."

## Rulings

### A. Words and places

| Id | Ruling | His words |
|---|---|---|
| p2p-1 | **Region, Area, Location.** On screen a place's spots are **Locations** (the pack's `area`), the place that holds them is an **Area** (the pack's `site`), and a **Region** stays a Region. "Spots here" becomes "Locations". The pack format's `type` values do not change. | "Areas should be renamed 'locations.' Sites should be renamed 'Areas.' 'Regions' stay as is."; "'Locations' not 'Spots Here'" |
| p2p-2 | **The party stands only at a Location, so Move on always works.** Depart's "Where?" and every other way of placing the party offer Locations only, never an Area or a Region. | "If we are driving by Area, then I should only be able to pick areas. In other words, Move on should always work." |
| p2p-3 | **A numbered Location reads "1. The Jetty"**: the number, a full stop, the name. The full stop is the app's; the name's capitals are the pack's (title case, a pack task). | "'1. …' not '1 …'" (his example was the pack's first Location, in title case) |

### B. Starting the night, and the way of exploring

| Id | Ruling | His words |
|---|---|---|
| p2p-4 | **Depart appears only while a session is running.** With no session, or a paused one, the band shows Start or Resume alone. | "we should not see an option to depart unless we have a session running. so once started, the depart button can appear, but when a session needs resuming or starting, there is no option to depart." |
| p2p-5 | **The Depart sheet**: "Where?" first, Locations only, grouped under their Area; then **"Exploration method"** (not "Exploring how?"), a three-way choice of Dungeon, Wilderness and Point to point, filled in from the place and open to the GM's change, with no blank space beside it; then Start, carrying the campfire as the band's Start does. | "Yes" to the sheet as proposed; from his test: "Exploring How -> Exploration Method. Where? should tell you how. Ex the harbor is point to point… Start button should match the Start button at the top of scene (fire)" |
| p2p-6 | **Point to point is a third exploration method**, beside Dungeon and Wilderness. It belongs to the app, not to a rules pack. It takes its unit of time and its ways of travelling from the place (the pack's `travel`), its encounter check from the place, and its strip from p2p-7. Light and rest keep running by the setting's rules for that unit of time. A change to the data model, put to him in plain words (see "For his explicit yes", 1). | "Yes" to the sheet that carries it; then "Yes" to the data-model wording |
| p2p-7 | **In point to point the strip is the app's own five steps** (Describe, Question, Act, Test, Resolve) with their approved icons, unless the place carries steps of its own. The strip stays plain, with no state. | "for point to point use our generic process flow strip as opposed to wilderness or dungeon"; "keep the strip plain for now, we can talk about adding effects to it after the 5th" |

### C. The GM's page at a Location

| Id | Ruling | His words |
|---|---|---|
| p2p-8 | **The trail reads and never moves the party.** A tap on the Area opens a panel of its Locations: the Area itself first, the party's own row marked "The party is here.", every other row opening that Location. A tap on the Region opens the same kind of panel of its Areas. There is no "Locations" button. The party moves only through Move on. | "remove the locations button, the trail is sufficient and never moves the party. the popup is good"; "Yes" |
| p2p-9 | **Reading ahead.** A Location opened from the panel shows its own page to read, with its pieces and working eyes; the party does not move. One line at the top says "Reading ahead. The party is at <Location>." with "Back to the party" (on a phone, in the fixed bar at the foot). The top and the right column stay the party's. | "Yes, eyes included" |
| p2p-10 | **The Location's card.** The name at the left; the rule's icon button and Move on at its right. The description shows once, as the first written piece, in the book's format: a word in it that names another piece is bold and underlined; each further piece is led by its own word and has its eye. No "Pieces" heading and no kind words. The count and "Hide all" sit at the foot, beside "+ Piece". | "buttons should be at right and descriptions at left"; "I also dont need 'Pieces' as a Header"; "Description is included twice… It should only appear once"; "APPROVED" (the frames) |
| p2p-11 | **"Players see" and "Rename for players" are removed everywhere.** Players see the pack's name for a place. | "I dont need the 'players see' strip nor rename for players"; "Yes, everywhere" |
| p2p-12 | **Notes is a fully folded row**: the word and the fold mark, no preview words. The source line lives inside it. With nothing to say the row is absent. | "Notes: should be fully collapsed, not with partial words showing. Source should be part of notes." |
| p2p-13 | **"From the book, for the GM" leaves the place page** once a pack's pieces are checked complete (a pack task comes first). | "Here the Pieces are formatted properly and complete. if they continue in this fashion i dont need the 'from the book' section at all." |
| p2p-14 | **The encounter check's card gives the pack's own sentence**, with the die's icon; no sentence written by the app. | "Encounter check is not giving me the rule properly… which is present in the rules button when clicked (without die icons)" |
| p2p-15 | **"Calls to adventure" shows only in a settlement**, never at a Location of an adventure. | "it doesn't belong on a location as it's something that is given before an adventure (though rumors often arrive in settlements)"; "Yes" |
| p2p-16 | **Controls side by side in one row share one height** (a button beside a button, an icon button beside a button). App-wide. | "buttons/icons next to each other in a row should be the same height" |
| p2p-17 | **No explaining lines.** The Move sheet's foot line about the log and Undo goes. | "I dont need the 'one step in the log' descriptions - we agreed to avoid that kind of overexplaining." |
| p2p-18 | **A check never shows a machine name.** It shows its own name, else its table's name, else "Encounter check". | "ik-…-check is machine text, i want human readable." |
| p2p-19 | **A check with a table and no chance is a roll on the table**: the die's icon, the pack's sentence and one button to enter the roll. No Hit, no Miss, no modifiers. | "there is no hit or miss, or modifies, it's always a hit. So it's really not a 'Check' it's a 'Pick from table'" |
| p2p-20 | **The Scene's top folds away** (the facts, the strip and the encounter tables' row) to save space. How it folds is frame TF1, a proposal still to be shown to him. | "I think they should be collapsable to save space" |
| p2p-21 | **The marching order has no lock.** Every player and the GM may rearrange it at any time; each change is logged, with Undo. (A change to who may do what; he was told so in those words.) | "I dont' need locked marching order - that's a functionality that will never be used and takes up space on both player and gm screens."; "Yes" |
| p2p-22 | **Leaving is Move on.** At a Location the pack marks as a way out, Move on's list carries one more row that ends the expedition (its words, "End expedition" or "Leave the area", are his pick from the frame). There is no Leave button in point to point. **End expedition stays in the menu, for the GM, from anywhere. End session stays the GM's.** | "Leave is just another way to say 'Move On' so we can use that button to leave the area"; "Gm should also be able to 'end expedition' from anywhere - this reflects the reality that sometimes we just want to wrap things up and assume palyers get home safel."; "End Session stays with the GM." |
| p2p-23 | **Make camp** is possible at any Location the pack does not mark otherwise, and never while an encounter waits. On 5 December the players decide and the GM taps it. The players' own request to make camp comes after 5 December, built with the caller proposing a way. | "Make Camp should be a player choice at any time where a location allows it (not during encounters obviously)"; "b and after the 5th" |

### D. The players' Scene

| Id | Ruling | His words |
|---|---|---|
| p2p-24 | **A shown piece appears on the player's card itself**, under the Location's name, in the book's format, as the GM taps its eye; nothing for the player to open. "What everyone knows" keeps what the party has learned of the Area. | "Player Scene is one column, doesn't reflect revealed information by GM."; "Yes" |
| p2p-25 | **The cut for 5 December.** Must: the page in two columns (P1); Where to? with each way and its time, a tap saying the GM moves the party (P2); the Location's card with shown pieces, "What everyone knows" and the Rules row (P4, with p2p-24); the marching order as circles, no lock (P8); today's prompts in their slot (P9); the phone, the states and the hidden-data tests with each (P11, P13, P14). Next in line, if seats allow: the players' map (P5), Activities (P6), a tap on a fact (P10), the call's card (P7, in the town's plan). | "Yes, that's the right cut" |
| p2p-26 | **pw-1 stands.** On 5 December the GM's Move on moves the party; the caller proposing a way is built after. | "keep the 14th ruling." |

### E. Packs and the pack format

| Id | Ruling | His words |
|---|---|---|
| p2p-27 | **A pack's pictures arrive with it, in one bundled file** that holds the pack and its pictures. It is uploaded as a pack is today; the app ties each map to its places and names any picture that is missing. A pack with no pictures imports as now. A map stays the GM's alone until its eye is tapped. | "when I upload a pack, I also upload the pictures. I'd rather not have to select a folder for each packs pictures… (with a check to make sure there are none missing"; "a" |
| p2p-28 | **A hoard shows as one piece, in the book's words**, with the things to hand out, and how many of each, behind it. A pack-format addition: a hoard may carry its own line of words; a treasure entry may carry a count. | "keep treasure in one line as described in the book… I imagine 9 swords and daggers translates to X daggers +Y swords"; "yes to all four" |
| p2p-29 | **A magic item's truth may be a piece of its own**, hidden until the GM taps its eye. That tap tells the players the item's real name and what it does, **and shows the same on the item itself**, wherever it is held (a character's pack, the stash). Hidden data, put to him in plain words. | "Add a seperate piece for 'Magic Item. …' and it's full effects as written, with the eye. Gm likely will not show this to players but should have the option."; "yes, but if i show it, it should also reflect in the pack" |
| p2p-30 | **The ways' icons were already ruled; they are only unbuilt.** pf-25 (2026-11-14) lets a way name its `icon` and otherwise reads its `by` (row, swim, climb, walk); the pictures were picked on 12 and 14 November (Row the paddles, Swim the two fish, Walk the leather boot, ap-10). No new format line and no pack task: the island adventure's ways are already named row, swim and walk. The rule button's picture for "someone fell in" (the water splash) is in the studio's set too; the pack names it once the app's set has it. | "what's going on with the icons, are they comnig later?"; "i'm pretty sure we already selected icons in an earlier design session. look for them before starting from scratch" (he was right) |
| p2p-31 | **Two marks on a Location**: "a way out" (p2p-22) and "no camp here" (p2p-23). A pack-format addition. | "yes to all four" |

## For his explicit yes (plain words, as they were put to him)

1. **p2p-6, the data model. Given: "Yes".** Today an expedition's way of exploring is one the rules pack gives (Dungeon, Wilderness). A yes adds a third, "Point to point", which belongs to the app. An expedition records it as its method. Nothing is deleted or renamed, and expeditions already started are untouched. If the database needs a change for it, it is add-only and goes through a database session.
2. **p2p-27, p2p-28 and p2p-31, the pack format. Given: "yes to all four".** A hoard may carry its own line of words and then shows as one piece, and a treasure entry may carry a count; a Location may be marked a way out, or as having no camp; a pack may arrive as one bundled file with its pictures. All additive: no pack in use stops working. (The fourth item put to him, an icon for a way of travelling, was already ruled as pf-25: see p2p-30.)
3. **p2p-29, hidden data. Given, with a change: "yes, but if i show it, it should also reflect in the pack".** A pack may give a magic item's real name and powers as a piece. It is the GM's alone until its eye is tapped; nothing of it is sent to a player before that. That tap shows it to the players. He was offered "the item keeps its plain look either way" and changed it: showing the piece also shows the item's real name and powers on the item itself. Not checked in the sitting: whether the app already has a way to reveal an item's hidden name and notes that this can use (the builder says), and what closing the eye again does to an item already revealed (the designer's pick: Undo of the show takes both back; a later hide leaves the item as the players now know it).

Also given in the sitting, in plain words: p2p-21 (who may move the marching order) and p2p-11 (the players' name of a place).

## Builder pieces

A piece with a visible part names its mockup and the day he approved it. Pages 23 and 24 are on the branch `design-p2p-reading-ahead` (cut from `design-december-mockups`). "A proposal" means drawn and not yet shown to him: it is not handed to a builder.

| # | Piece | Rulings | Mockup |
|---|---|---|---|
| B1 | The words Region, Area, Location; "N. Name" | p2p-1, p2p-3 | Page 23, LA1 to LA4, approved 2026-11-18 |
| B2 | The trail reads and never moves; the Locations panel; reading ahead | p2p-8, p2p-9 | Page 23, LA1 to LA4, approved 2026-11-18. The Region's panel (LA2b) is a proposal |
| B3 | The Location's card redrawn: the head, the description once, pieces led by their words, the count at the foot, Notes folded, no "Players see", no Rename, no calls line, the check's own sentence | p2p-10 to p2p-12, p2p-14, p2p-15 | Page 23, LA1, LA3, LA4, approved 2026-11-18 |
| B4 | One height in a row | p2p-16 | Page 23, LA1, approved 2026-11-18 (the band, the map's tools); elsewhere at the sweep |
| B5 | Placing the party offers Locations only | p2p-2 | None: data and logic only (it shows in B7's sheet) |
| B6 | Depart only while a session runs | p2p-4 | Needs a mockup: page 24, DP2, a proposal |
| B7 | The Depart sheet | p2p-5 | Needs a mockup: page 24, DP1, a proposal |
| B8 | Point to point as a method; its strip | p2p-6, p2p-7 | None: data and logic only (the strip is page 16's, approved 2026-11-14) |
| B9 | A check's name; the roll on the table; the Move sheet without its foot line | p2p-17 to p2p-19 | Needs a mockup: page 24, WY1, a proposal |
| B10 | Leaving through Move on at a way out | p2p-22, p2p-31 | Needs a mockup: page 24, WY1 (d), a proposal |
| B11 | The marching order without its lock, for the GM and the players | p2p-21 | Page 23, LA1, approved 2026-11-18 (drawn without it); page 18, PL1, approved 2026-11-14 |
| B12 | The Scene's top folds | p2p-20 | Needs a mockup: page 24, TF1, a proposal |
| B13 | The players' Scene, the must rows: P1, P2, P4, P8, P9, with P11, P13, P14 | p2p-24 to p2p-26 | Page 18, PL1 to PL10, approved 2026-11-14 (ap-10). The shown pieces on the card (p2p-24) need a mockup: page 24, PL1b, a proposal |
| B14 | A pack arrives with its pictures | p2p-27 | Needs a mockup: page 24, IM1, a proposal. The unpacking is data and logic; a new library would need his yes (hard rule 9) |
| B15 | A hoard as one piece with counts; a magic item's piece, whose showing also shows the item's real name and powers on the item | p2p-28, p2p-29 | Needs a mockup (the magic item's piece, and the item once shown; the hoard's rows are the Pack page's PK5, approved 2026-11-14) |
| B16 | Icons on the ways' buttons (pf-25's reader; the paddles, the two fish and the leather boot into the app's set, with their credits), and the water splash for a rule's button | p2p-30 | Page 18, PL7, approved 2026-11-14 (ap-10); the GM's Move on rows, page 12, MO1, approved 2026-11-13 |
| B17 | "From the book" leaves the place page | p2p-13 | None: a removal (page 23 draws the card without it, approved 2026-11-18). Waits on the pack check |
| B18 | Make camp never while an encounter waits; "no camp here" | p2p-23, p2p-31 | None: data and logic only (a blocked tap explains in a pop-up) |
| B19 | Calls to adventure only in a settlement | p2p-15 | None: logic only (page 23 draws a Location without the line) |

**Faults for a builder, no ruling needed** (the live page against its approved drawings):
- The rule's button and Move on sit under the description, not at the right of the name (page 11, frame 1b).
- A step's label breaks inside a word ("Wanderin-g") at a larger text size.
- The Depart sheet's switch leaves blank space at its right (page 16, T6).
- The top lists the Dungeon encounter tables at a place that has its own table.
- The ways' buttons (Row, Swim) carry no icon (B16).
- Drawn versus built, ruled 2026-11-18: the frames agree (pages 11 and 16 draw the footprints on Move on); the app draws the map pin. Francis: "Yes, footprints" (in the driver's chat). Built in B3.

## Pack tasks (the Pack Creator; data, no app change)

1. The island adventure's unnumbered starting Location carries one sentence: move the book's whole block onto it, with its four pieces. Two of them sit on the Area today; two are in no piece.
2. Location names in title case.
3. Name the water splash as the icon of the place rule whose button shows words and the generic mark (once B16 has put it in the app's set).
4. Notes hold only what no piece says (the first Location's notes repeat a piece).
5. Check every Location's pieces against the book, so that B17 can go ahead. Only the first Location was opened in the sitting.
6. The first Location's hoard: one entry in the book's words, the things with counts behind it, the magic item's piece (after the format yes). The book gives no split of the blades: propose one to Francis.
7. Mark the way out; mark any Location with no camp.
8. The build produces the one bundled file (p2p-27).

## After 5 December

- The caller proposing a way (pw-1, P3b), and with it the players' own request to make camp (p2p-23).
- Holding one circle to drag it beside another (mo-3): "after the fifth".
- Effects on the strip (a lit step): "we can talk about adding effects to it after the 5th".
- The day's guided flow (mc-30), as already ruled.
- Players choosing the caller (cl-1), as already ruled.

## Withdrawn during the run

- Depart's Start also starting the session (replaced by p2p-4).
- A strip of four steps for point to point (replaced by p2p-7), and a strip that lights the step in play.
- A "Locations" button beside Knowledge and Rules (replaced by the trail, p2p-8).
- Picking the pack's folder, or its pictures, at import (replaced by the one bundled file, p2p-27).
- A Leave button offered only at a way out (replaced by the row in Move on, p2p-22).

## Not walked

- A dungeon session and a wilderness session: his next two priorities, each its own sitting.
- A fight, a split party, the town, and crossing from one Area to the next. The pack does link the harbour's last two Locations to the next Area's first four; nobody walked it on screen.
- p2p-2 for places with no Locations of their own (a wilderness Region, a place made by hand): for the dungeon and wilderness sittings.

## Open, small (⚑ for Francis)

- Ruled 2026-11-18 (page 24, WY1d approved with fixes): the row that ends the expedition in Move on reads "End expedition".
- Ruled 2026-11-18 (drawn versus built): Move on carries the footprints, as every approved frame draws it; the pin goes from that button. Francis: "Yes, footprints" (in the driver's chat).
- ⚑ What becomes of a name the GM already changed for players, now that Rename is gone (p2p-11): the designer's pick is that it stays as it is until the place's pack gives one.
- Ruled 2026-11-18 (page 24, DP1 approved with fix): "Where?" on the Depart sheet is needed before Start (it was optional, st-3); Start with nothing picked opens a pop-up that reads "An expedition starts at a Location."

## 09 lines (in `docs/09-decisions-log.md`, 2026-11-18)

- 2026-11-18 — [words] On screen a place's spots are Locations, the place holding them an Area, a Region stays a Region ("Spots here" goes); a numbered Location reads "1. The Jetty"; the pack's `type` values are unchanged (p2p-1, p2p-3) — Francis's words after his live test
- 2026-11-18 — [expedition] The party stands only at a Location, so Move on always works; the trail reads and never moves the party: a tap on the Area opens a panel of its Locations, on the Region a panel of its Areas, and a Location opened from it is read ahead with working eyes (p2p-2, p2p-8, p2p-9) — a tap on the trail had left the party at an Area with no ways on
- 2026-11-18 — [expedition] Depart shows only while a session runs; the Depart sheet asks Where? first (Locations only), then "Exploration method", filled in from the place (p2p-4, p2p-5; replaces part of fno-1) — "which goes first is ambiguous"
- 2026-11-18 — [expedition] In point to point the strip is the app's own five steps, plain; effects on the strip wait until after 5 December (p2p-7; mc-53 stands) — he wanted a quieter page, not a lit strip
- 2026-11-18 — [ui] The Location's card: description once as the first piece in the book's format, pieces led by their own words, no "Pieces" heading, no "Players see" or Rename anywhere, Notes fully folded with the source inside, the check's own sentence from the pack; "From the book" leaves the page once a pack's pieces are checked complete (p2p-10 to p2p-14; changes page 11's frame 1b and gt-1) — "the whole page was overwhelming"
- 2026-11-18 — [ui] Controls side by side in one row share one height; no explaining lines on a sheet; a check never shows a machine name; a check with a table and no chance is a roll on the table, with no Hit or Miss; the Scene's top folds (p2p-16 to p2p-20) — Francis, from the live page
- 2026-11-18 — [adventure] "Calls to adventure" shows only in a settlement (p2p-15; changes mc-61) — a call is given before an adventure
- 2026-11-18 — [perm] The marching order has no lock: every player and the GM may rearrange it at any time, logged with Undo (p2p-21) — "a functionality that will never be used"
- 2026-11-18 — [expedition] Leaving is a row of Move on at a Location marked a way out; End expedition stays in the GM's menu from anywhere; Make camp anywhere not marked otherwise and never during an encounter, the players' own request after 5 December (p2p-22, p2p-23) — "sometimes we just want to wrap things up"
- 2026-11-18 — [ui] The players' Scene: a shown piece appears on the player's card as its eye is tapped; for 5 December the rows P1, P2, P4, P8 and P9 are built, P5, P6, P7 and P10 next in line; the caller proposing a way stays after (p2p-24 to p2p-26; pw-1 stands) — page 18 was approved on 14 Nov and never released
- 2026-11-18 — [packs] A pack's pictures arrive with it in one bundled file; missing pictures are named; a map stays the GM's until its eye (p2p-27) — a web app cannot read the folder beside a picked file

- 2026-11-18 — [data] Point to point is a third exploration method, the app's own, beside the rules pack's Dungeon and Wilderness: an expedition records it; its unit, ways and check come from the place; add-only (p2p-6) — Francis's plain yes; the island adventure's harbour is travelled that way and nothing read it
- 2026-11-18 — [packs] Pack format, additive: a hoard may carry its own words and shows as one piece, a treasure entry a count; a Location may be marked a way out or as having no camp; a magic item's real name and powers may be a piece, the GM's until its eye, and showing it shows the same on the item wherever it is held (p2p-28, p2p-29, p2p-31) — "yes to all four"; "if i show it, it should also reflect in the pack"
- 2026-11-18 — [ui] The ways' icons need no new ruling: pf-25 and the pictures of 12 and 14 November stand (Row the paddles, Swim the two fish, Walk the leather boot); they are unbuilt (p2p-30) — Francis: "look for them before starting from scratch"

## Docs to update

- `03`: the marching order's row (no lock; p2p-21); the call-to-adventure send row (settlements only).
- `04`: Expedition, its mode (p2p-6, after his yes).
- `05`: Sessions and Depart (p2p-4, p2p-5); Move on, the trail and reading ahead (p2p-2, p2p-8, p2p-9); encounter checks (p2p-18, p2p-19); leaving and camp (p2p-22, p2p-23); calls to adventure (p2p-15); the place's name for players (p2p-11).
- `06`: words and voice (Region, Area, Location; no explaining lines); the one-height rule; the components inventory rows for the place page, the Locations panel, the Depart sheet, the strip, the marching order, the check's card.
- `07`: the bundled file (p2p-27); after his yes, a treasure entry's count and a hoard's words, the magic item's piece, a way's icon, the two marks on a Location; `playerView.name` under p2p-11.
- `10`: the four ⚑ above.
- Plans: `dec-9-the-players-scene.md` (its status, and P4 under p2p-24); `dec-9-the-whole-scene.md` (S5's Departures under p2p-4, S12 and the lock, S13 and "+ Map", S14); `dec-7-5-place-page-and-map.md` (the trail's tap).
