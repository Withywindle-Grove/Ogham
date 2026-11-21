# Plan: December steps 2 and 3, places from the pack and the port as a settlement

Written by the lead, 2026-11-11. Part of `docs/plans/december-first-play.md`. From Francis's planning answers ("places absolutely need to be ready and pickable"; a short port scene with buying), his rulings on the town page (mc-15 … mc-20, `docs/design/rulings/scene-mockup-rulings-2026-11-11.md`) and the Builder's sizing of the same day. Mockup: `docs/design/mockups/scene/09-place-and-settlement.html` (variant B).

## What the first night needs, and what waits
| Needed on 5 December | Waits (after the cut line, or M8b) |
|---|---|
| A pack's place picked at Start, Set and Move, with its pieces and GM notes (the picker, #532) | A place's own encounter check and night table feeding the time strip (nc-2; 6 to 10 turns, Fable) |
| A town's and a harbour's child places listed and opened | Introduce, and people players can be told of by name (a read rule); people for the GM are piece 2d, below |
| The place panel and the town page in the redesigned form, reading what the pack gives today | Per-shop stock and prices from the pack (12 to 20 turns) |
| The town's size, so its services fit a city | The town's map |
| Buying as today: Ask for…, the GM's In stock or Not here, the item added | Prices charged to a purse (needs the purse) |

## Pieces
| | Piece | Size | Migration | Model |
|---|---|---|---|---|
| 2a | **#532 to merge**: main merged in, the review finding fixed (done by the Builder, 2026-11-11), its words brought under rule 11. Its migration keeps its stamp (already on TEST); Francis's main push for it is the `--include-all` form after a backup, first in the order of held migrations | 2 to 4 turns, mostly done | Yes (held; adds `places.settlement`, replaces four functions, changes no row) | Opus |
| 2b | **Child places**: a place that has places inside it (a town's buildings, a harbour's points) lists them, numbered as the pack numbers them, each opening in the right panel (mc-16); "Inside" in the picker | small after #532 | No, unless #532's shape needs it: say | Opus |
| 2c | **The place panel and the town page, redesigned**: the title and one line of identity; the facts the pack gives (a hamlet may have two); GM notes behind folding headings where the notes have them, else one block with a label-and-colon line set as a bold lead-in (the mockup's "honest fallback", frame 13); pieces with their eyes and the word Shown or Hidden; the keyed places as rows with the eye only (mc-15); Safety and encounters as one fact that opens a sheet; no People section (mc-18); the accent as mc-20 and mc-27 rule | 3 to 5 turns, with pictures | Small: a nullable `lead` on a place's pieces (pf-3), empty for every existing piece | Opus |
| 3a | **The town's size**: a size on the place, read from a pack settlement and set by the GM for a hand-made town, so the setting's services list fits the town | 2 to 4 turns | Small | Opus |

Buying needs no new piece for the night: requests, stock chance and the GM's trade card exist. With no purse the cost is "noted", as today.

## What 2c reads from the pack (pf-3, pf-5: `docs/design/rulings/dec-pack-formats-2026-11-11.md`)
`identity`, `facts`, `gm.sections`, `playerView.aspects` (each a piece with its bold lead-in), `tableIds`, `settlement.watch`, a lodging's `grade` and `placeId`. A link's marks are never shown raw: the label as plain text at the least; a tap to a place, a table or a stat block where that is cheap. In the picker a pack's group is headed by the pack's own name. All optional: a pack with flat notes reads as the mockup's fallback frame.

## Added the same day: piece 2d, people for the GM
Francis, on the port's places: "Make sure that you have relevant NPCs like the proprietor included." So people are read before the cut line, as a first cut (the Builder: about 2.5 to 3 turns, Opus, stacked on 2c):
- `npcs` imported as a GM-only kind (`npc`): never player-facing, no read-rule change, no Introduce, no state. A migration for the library's kind check only, stamped after 2c's.
- On the GM's place panel, one box per person whose `locationId` is this place: name and role, the portrait, the pack's leads in order (pf-5); the stat block as a link once step 5a's resolver is in, else its name; a tap opens the person in the right panel (mc-16, mc-18).
- "How they look" (`playerView.description`) becomes a piece of kind person on that place when it is picked, hidden until shown.
- Players are sent nothing of a person but a shown piece. The name reaches players only if the GM writes it into a piece (05).

## Order
2a first (it is the prerequisite for step 4 too); 2b and 2c together; 3a last. 2c's words and its pictures go to the lead before the label.

## Boundaries
- What players are sent does not widen: a place's GM notes, hidden pieces and unshown child places stay the GM's. 2c's player side shows only what is shown today.
- A pack with flat notes must still read well: nothing in 2c may depend on fields the packs don't carry yet. The Pack Creator's richer town shape (aspects as separate pieces, mc-17) is read when present.
- Migrations are built and held: no TEST turn and no push without Francis's word through the lead.

## ⚑
1. Where a pack settlement gives no size, what the town screen assumes: ask the lead.
2. Whether a child place's own child places (a room in a building in a town) need more than one level on the night: the harbour and the port need one level; build one, say what a second would cost.
3. nc-2 (a place's own check and night table): held for Francis as the Builder's scope check; not in this plan.

## Done when
On the live app, with an invented adventure pack: the GM starts a session at a pack's town, sees the town page as mockup 09's variant B from flat notes, opens a child place in the panel, shows one piece and sees it reach a player, sets the town's size and gets a city's services, and a player's Ask for… is answered In stock. Manual checks in `docs/testing/<branch>.md`.

## Estimate
8 to 14 turns in all, one held migration beyond #532's.

## Departures
(The builder keeps this current in each pull request.)

**2c (pull request `dec-2c-place-and-town`, stacked on #532):**
1. **Where the GM's facts live.** `identity`, `facts`, `gm.sections`, `tableIds` and `settlement.watch` are read from the pack's library entry on the GM's device each time the place card opens, not copied into the campaign's place at the pick. That keeps the migration to the one `lead` column and keeps them off every player's device (library entries never reach a player's place view). The cost: a pack update changes what the GM's panel shows for these parts, while pieces and notes stay as picked. ⚑ 1.
2. **No right-edge panel yet.** mc-10 and mc-16's panel at the right is the Scene redesign's component and isn't built: the place card stays where it is, and a place in town opens in the existing centred pop-up (`Dialog`), where Open or Closed is set (mc-15). ⚑ 2.
3. **Links: labels everywhere, taps through rows.** A link's marks never show raw; the label shows as plain text in the prose, the facts, the notes and the pieces. "Cheap" turned out to be a table: every table the place's GM text links to joins its Tables rows, each a tap that opens it. A tap inside a line of prose would be under 44 px, so no link is a tap in place. Place links wait for 2b (a child place in the panel); stat block links stay plain (the app has no stat block view; the watch names its stat block by name). The marks are stripped from pieces and notes when the place is made, so players never receive a link's id. ⚑ 3.
4. **Safety and encounters** is one fact (an `OpenCard`) opening a pop-up with the checks and the two switches, as mc-15 rules; Safe or Hostile is said on the fact but not set there (it is set where #527 put it, at End expedition).
5. **"Only for you"** under About the town (the mockup) is left out: B16 (M5 gate) ruled the GM's card never says "Only you see this".
6. **The accent (mc-20)** is on the watch box's edge only. Links aren't taps (3), a table's row keeps `TableListItem`'s look, and the keyed places' numbers are 2b's rows.
7. **Notes from a pack** read with their lead-ins (frame 10) and an **Edit notes** button opens the five fields; a typed place keeps the fields as before.
8. **The eye's word** (Shown or Hidden) is on a piece's eye; the town's rows and the picture keep the square eye.
9. **A lodging's grade and inn** are read where lodgings live today (a rules set's `downtime.lodgings`): the grade joins the row's words for the GM and players, and `placeId` names the pack's inn on the GM's row and pop-up.
10. **Tests of approved behaviour changed by the rulings:** the town screen's Open or Closed (now inside the place, mc-15) and Encounters (now behind the fact), the eye's word, and the picker's group line (now the pack's name and its count only).
11. **pack:check** gained the ruling's four warnings (`scripts/pack-town.mjs`): an aspect without a lead, a person's leads out of the pack's order, a link that resolves to nothing (another pack's and a rule's links aren't checked), a link in a player's piece.

**pf-18b (pull request `pf-18b-section-blocks`; `design/rulings/dec-place-sections-blocks-2026-11-18.md`, page 22 approved 2026-11-18):**
1. **An empty section** (a heading with no words, no `text`, `{ "blocks": [] }`, or blocks holding only a table by id, a box with no title holding only one included) keeps its heading and opens to nothing. Ruled by Francis, 2026-11-18 (his look at the real screens, ⚑ 1 of this pull request): the muted line "The pack gives no words for this section." is only for a section the app can't read (the reader left something out), pick 1. Since the fold is shared, the Knowledge sheet's empty fold also opens to nothing.
2. **The opened fold only.** The fold row is the app's as built (a left ›, no divider, the fold's words not indented); page 22 draws page 19's row, which is dec-3 W2's. The comparison with page 22 covers what an opened fold holds.
3. **Tables a section names by id** (`tableRef`) join `tableIds` as main's reader already puts them since #785: after the place's own and the linked tables, each once. A section whose only block is a `tableRef` draws nothing and is an empty section (1): its heading, and its table a row under Tables.
4. **Brought up to #785 (the Scene's place page, merged 2026-11-18).** #785 had begun drawing sections in blocks with the looser `ruleBlocks`; this piece keeps its shape and its shared fold (`SectionFold`, also the Knowledge sheet's), and changes only what pf-18b rules: a section's blocks are read by the strict reader (`readRuleText`, then `blocksOfRead`), and on the town page and the Knowledge sheet alike (one fold, one look) a section the app can't read keeps its heading with the muted line, while an empty one opens to nothing (1). A section's `text` keeps #785's meaning: its plain words (pf-18a), which the Knowledge sheet folds to a first line.
5. **Francis's fixes after his look (2026-11-18, "Approve with fixes"):** a plain section's paragraphs are drawn through `RuleText` too, so they keep its gap between paragraphs (no new variant); an empty section opens to nothing (1); the opened fold's chevron, turned a quarter, overhangs the card's left edge into the page's side margin, unclipped on screen; only the saved picture's crop cut it, so the layout check now measures it and the picture takes in the margin. The light box's missing fill is accepted as built.
