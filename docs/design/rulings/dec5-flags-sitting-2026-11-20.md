---
status: absorbed
milestone: December first play (the open ⚑ that hold rows for 5 December: the players' Scene, the GM's Scene point to point, the test feedback of 19 November)
absorbed-into: docs/05-features.md (Places for players: the players' Where to?, d5-1, d5-2; the GM's view as the player, d5-21, d5-22; the notices, d5-20; Encounter tables, full screen: the tags, d5-12 to d5-14); docs/06-screens-and-design.md (the Darkness row, d5-20; the Destination row's way buttons, d5-11; the load bar's pop-up, d5-19); docs/07-content-packs.md (Common player actions and the pf-18 fields, d5-16, d5-17); docs/10-open-questions.md (five ⚑ of the test feedback removed); plans dec-9-the-players-scene.md, scene-point-to-point.md, test-feedback-2026-11-19.md; docs/09-decisions-log.md (2026-11-20)
supersedes: nothing as a file. Inside it: d5-11 replaces "a way with neither shows its word and time alone" (the B16 row of plans/scene-point-to-point.md, as built in #1014) with pf-25's generic way mark; d5-18 replaces the driver's interim call on #1090 (no Activities card before anything is shown); d5-9 moves B15 from "after its mockup" to the 5 December cut; d5-20 narrows tfn-2's "No light" (above every tab but Scene) to the Player tab's notices box and Scene
---

# The open ⚑ for 5 December (second sitting, 2026-11-20)

A short design sitting (Driver 32's brief), after the P4 sitting of the same day (`p4-sitting-2026-11-20.md`). Francis ruled on his phone, one question at a time, small picks in batches. Each ⚑ was read in its own file before it was asked; those found already ruled are listed first and were not asked again.

## Already ruled (not asked; the docs only tidied)

| ⚑ (where) | Why it was closed already |
|---|---|
| The mode button's look under ic-1 (players' plan ⚑ 2, Hole 4) | Page 18, frame PL7, arrangement (A): the icon, the word, the time on three lines. Approved 2026-11-14 (ap-10); built by B16 (#1003, #1014, #1022). |
| Does a player's top fold (players' plan ⚑ 8) | No: "The GM's alone: the players' Scene has no fold" (`plans/scene-point-to-point.md`, B12b, answer 17 of 2026-11-19). TF1b itself was approved on 2026-11-18. |
| Day weather once a day, for players (players' plan ⚑ 5) | p2p-flag10, "Day weather" (09, 2026-11-18). A player's Weather fact shows that day's weather; nothing more to word. |
| PL1b: a proposal or approved (players' plan ⚑ 7) | Approved as drawn on 2026-11-18 (09, "Page 24 approved whole"). |
| With a grip chosen, that grip's roll lines alone (`docs/10`) | "Yes to grip" (09, 2026-11-20); built in C16 (#1081). |

**Still waiting, skipped:** the top line of a skill rolled low or by percentage (`dec-test-feedback-skills-2026-11-19.md`, ⚑ 1): the Pack Creator's answer to E6 has not come back.

## Part 1: the players' Scene

| ID | ⚑ (where) | Ruling | Francis said |
|---|---|---|---|
| d5-1 | p2p-flag6 for players: a place with no Locations (players' plan ⚑ 6) | Once the place is shown and the players' read gives no ways, **"Where to?" is left out**, as Activities is when the pack has none. No new words and no new data: a place typed in by hand and a Location whose ways are all hidden look the same to a player. PL2's line ("None to choose from yet…") stays for a place not shown yet. | "A: leave it out" |
| d5-2 | The players' "End expedition" row has no frame (players' plan ⚑ 4, p2p-flag4) | **No frame is drawn.** It is built from two approved parts: the GM's row (page 24, WY1d: the door mark, the words, the chevron), last in "Where to?"; and the pop-up of a tap on a way (page 18, PL4c), titled "End expedition" with "Your GM ends the expedition." under it. Francis approves it from pictures of the real screen, as p2p-flag3 and p4s-4. | "A: real screen" |
| d5-3 | The marching order before anything is shown (players' plan ⚑ 9) | It stays, with its Rest button, though PL2 draws none: the order belongs to the party, not the place. | "Yes to all six" |
| d5-4 | Split party, the Reference lines and Recently, which PL1 does not draw (players' plan ⚑ 10, the rest) | They stay where P1 put them for 5 December. Their final place is settled after. | (same) |
| d5-5 | From what width two columns (players' plan ⚑ 11) | From 768 px, as built. | (same) |
| d5-6 | A rule button of words on the players' card (players' plan ⚑ 12) | Its own line under the place's name, at the right, as built; an icon button stays beside the name. | (same) |
| d5-7 | #1088 ⚑ 1: the lights' line in a split party | As PL6 draws: "Your group. Ash and Tam are elsewhere." takes the lights' line's place; each lit circle still shows its light. | (same) |
| d5-8 | #1088 ⚑ 2: a player with characters in two groups | "Marching order: Group 1", "Marching order: Group 2", no "Your group" line, as built (with of-9). | (same) |
| d5-15 | #1090 ⚑ a: which activities the card lists | The pack's common player actions that carry a rule (`exploration.playerActions`), as built; not the modes' activities. | "Yes to all four" |
| d5-16 | #1090 ⚑ b: the rule set out like the book (01-08j draws a roll line, a titled table and a lead-in) | **`exploration.playerActions[].text` is a fifth pf-18 field**: a plain string or `{ "blocks": [ … ] }`, in pf-18's shape exactly, as pf-18b ruled for a location's GM sections. One reader, one checker rule, the rule text's one look (RuleText); a plain string looks as today. A small follow-up for a builder (widen `readPlayerActions`, which the GM reference shares) and a task for the Pack Creator. | (same) |
| d5-17 | #1090 ⚑ c: the source line | "From your setting: <the action's source>", as built. The Pack Creator writes the source whole ("Fen Rules, p. 88"), never a bare page. | (same) |
| d5-18 | #1090 ⚑ d: Activities before anything of the place is shown | **The card shows there too** (with d5-3): Activities belong to the setting, not the place, and the card would otherwise blink away at each new Location. A small change to #1090. | (same) |

## Part 2: the GM's Scene, point to point

| ID | ⚑ (where) | Ruling | Francis said |
|---|---|---|---|
| d5-9 | B15: a hoard as one piece, a magic item's truth as a piece (p2p-28, p2p-29). Wanted for 5 December? | **Yes, for the 5th.** Offered "after the 5th" as the designer's pick, with its cost said (a drawing, a database session, hidden data); he chose the 5th. Its frames are owed: see "Owed: B15's frames" below. | "B: for the 5th" |
| d5-10 | B12b: how the top starts on a phone the first time (plan ⚑ 13) | Open, on every device; then as the GM left it. B12b is already written so. | "A: open" |
| d5-11 | B16: a way the app has no picture for (plan ⚑ 12) | **The generic way mark (the two pins) above its word**, so every button in a row keeps one shape: pf-25 and the note on PL7. The built "word alone" followed the older mc-79a. A small follow-up, not pressing: the island's ways are row, swim and walk. | "A: the pins mark" |
| d5-12 | The tags in "Which table?" (the tables-row fault's ⚑ 1) | A place's own table always reads "this place": also when the place's own check is the one that hit (today "this check"), and when the check belongs to the Area or Region the Location sits in. | "Yes to all three" |
| d5-13 | The same, ⚑ 2: the method's tables at a place whose check stands in | They stay in the list, with no tag: "this check" would be untrue there. | (same) |
| d5-14 | The same, ⚑ 3: a place's check that does not stand in, or is switched off | Nothing changes: the row suggests the method's table, as built. | (same) |

## Part 3: the test feedback of 19 November

| ID | ⚑ (where) | Ruling | Francis said |
|---|---|---|---|
| d5-19 | The burden's levels as a pop-up in the GM's character overview and creation's Gear step (book-format ⚑ 1; plan ⚑ 12) | Yes, a pop-up there too: tfb-4's "everywhere the load bar shows". A small follow-up; the overview is itself a pop-up, so the levels' pop-up keeps its own form (`SheetScope`). | "otherwise yes" |
| d5-20 | "No light" on the Pack and Magic tabs (notices ⚑ 1; plan ⚑ 14) | **Removed from those two tabs.** The designer's pick was "as built, above the tab"; he changed it. "No light" shows in the Player tab's notices box (tfn-2) and on Scene, nowhere else. | "2. remove it - no light notices dont need to be on those tabs." |
| d5-21 | The five more actions that are the player's alone (gm-view ⚑ 1; plan ⚑ 10) | Closed to the GM in the player's view, each explaining in a pop-up, as tfg-5's four: taking back a sheet change, answering the GM's offer, Stay here, undoing a purchase, putting away the New mark on finds. docs/03 does not change. | "otherwise yes" |
| d5-22 | What "View sheet" opens for a character with no Player tab yet (gm-view ⚑ 5; plan ⚑ 15) | The full sheet, as today; the GM reviews from it. **Carried forward:** before the Full sheet page is retired (of-8, after 5 December) that review needs its own home. | "otherwise yes" |

## Owed: B15's frames (page 30)

d5-9 puts B15 in the 5 December cut, and B15 has a visible piece with no approved mockup, so it is not handed to a builder yet (mockups first). **Page 30 was not drawn in this sitting:** a studio worker wrote a first draft and was stopped by the worktree guard before anything was rendered, measured or shown to Francis. Nothing of page 30 is approved.

What the page is to draw, as briefed (frames HM1 to HM5, each a proposal):

| Frame | What it shows | Assembled from |
|---|---|---|
| HM1 | The GM's Location card with a hoard as one piece in the book's words and a magic item's piece, both hidden | Page 23, LA1 (2026-11-18); page 08, PK5 (2026-11-14) |
| HM2 | A tap on the hoard's piece: its things, one row each with its count; Send | Page 08, PK5 and PK5b |
| HM3 | The magic item's eye tapped: the toast with Undo; the piece on the players' card | Page 24, PL1b (2026-11-18) |
| HM4 | The item as its holder sees it, before and after the show | Page 26, M2n (2026-11-19); 05, Unidentified items |
| HM5 | The GM's card at 375 px with messy data; the hoard after everything was sent | Page 23, LA4; page 08, PK5b |

**To be ruled with the page, none decided here:**
- ⚑ What Undo of the show, and a later hide, do to an item already revealed. The designer's pick (the rulings file of 2026-11-18, "For his explicit yes", 3): Undo of the show takes both back, the piece and the item's real name; hiding the piece later leaves the item as the players now know it (05: a fact revealed once stays revealed).
- ⚑ Three places where approved frames disagree, found by the draft: a tap on a piece's words edits it on LA1 and opens the hoard on PK5; PK5's quiet line "Value stays yours (…)" against p2p-17's "no explaining lines"; PK5's kind word "Treasure." against LA1's "no kind words" (the draft leads with the hoard's own name).

**Checked for the plan (2026-11-20):** the app already reveals an item's hidden fields: `inventory.reveal` (`revealItemField`, `src/modules/inventory/inventory.ts`) and the GM's Reveal and "Tell them everything" (05, Unidentified items). B15's show can use it; the plan's "may need building from scratch" was a search for the wrong names.

## Docs to update
- `docs/05-features.md`: Places for players (d5-1, d5-2); the GM's view as the player (d5-21, d5-22); the notices (d5-20); Encounter tables, full screen (d5-12 to d5-14).
- `docs/06-screens-and-design.md`: the Darkness row (d5-20); the Destination row's way buttons (d5-11); the load bar's pop-up (d5-19).
- `docs/07-content-packs.md`: the pf-18 fields (d5-16).
- `docs/10-open-questions.md`: five ⚑ of the test feedback removed (four ruled here, the grip's already answered).
- Plans: `dec-9-the-players-scene.md` (P2, P6, P8, Hole 4, ⚑ 2 and 4 to 12); `scene-point-to-point.md` (the status line, B15, B12b, ⚑ 12 and 13, the three tag ⚑); `test-feedback-2026-11-19.md` (C7, ⚑ 10, 12, 14, 15).
- Left to their own pull requests: #1090 (P6: the card before anything is shown, d5-18, and 05's line for it); B12b's pull request (06's "the fold starts open and is kept only while the Scene is open").
- `docs/09-decisions-log.md`, 2026-11-20 (below).

## 09 lines
- 2026-11-20 — [ui] The players' Scene, the open ⚑ for 5 December: "Where to?" is left out once the place is shown and no ways are sent (a place with no Locations, d5-1); the players' "End expedition" row gets no frame, built from WY1d's row and PL4c's pop-up and approved from the real screen (d5-2); the marching order and the Activities card stay before anything is shown; two columns from 768 px; a words rule button on its own line; PL6's split line in place of the lights' line; a player in two groups keeps "Marching order: Group N" (d5-3 to d5-8, d5-18) — Francis: "A: leave it out"; "A: real screen"; "Yes to all six"; "Yes to all four" — `design/rulings/dec5-flags-sitting-2026-11-20.md`
- 2026-11-20 — [packs] A common player action's `text` (`exploration.playerActions[].text`) is a fifth pf-18 field, a plain string or blocks, so an activity's rule can be set out like the book (01-08j); its `source` is written whole, never a bare page; the players' Activities card lists the pack's common player actions that carry a rule (d5-15 to d5-17) — Francis: "Yes to all four" — `design/rulings/dec5-flags-sitting-2026-11-20.md`
- 2026-11-20 — [expedition] Point to point: B15 (a hoard as one piece, a magic item's truth as a piece) is wanted for 5 December (d5-9); the GM's top starts open the first time on every device (d5-10); a way with no picture carries the generic way mark, the two pins, above its word (d5-11, replacing "its word alone"); in "Which table?" a place's own table always reads "this place", the method's tables stay untagged where the place's check stands in, and a check that does not stand in changes nothing (d5-12 to d5-14) — Francis: "B: for the 5th"; "A: open"; "A: the pins mark"; "Yes to all three" — `design/rulings/dec5-flags-sitting-2026-11-20.md`
- 2026-11-20 — [ui] From the test feedback of 19 November: the burden's levels open as a pop-up in the GM's character overview and creation's Gear step too (d5-19); "No light" is removed from the Pack and Magic tabs and shows in the Player tab's notices box and on Scene only (d5-20, narrowing tfn-2); five more player-only actions are closed to the GM in the player's view (d5-21); View sheet opens the full sheet for a character with no Player tab yet, and that review needs its own home before the Full sheet page is retired (d5-22) — Francis: "2. remove it - no light notices dont need to be on those tabs. otherwise yes" — `design/rulings/dec5-flags-sitting-2026-11-20.md`
