---
status: pending
milestone: December first play (`docs/plans/december-first-play.md`, tier 1: a place of linked spots; tier 2: the map)
absorbed-into: pending, with the pull requests that build each page (05 moving between linked places, a place's knowledge and rules; 06 Components: the toggle, the eye, the map card; 07 regions); docs/09-decisions-log.md (2026-11-12)
supersedes: pf-11's "shareable" as a gate (mc-35); the eye's box and word (ds-2); the lead's reading of ds-1 that a toggle has its meaning written beside it (ds-1a); rg-4's fixed stand-in (rg-5 makes it a switch)
---

# The December mockups, set 1: Francis's rulings on the walk (2026-11-12)

Ruled by Francis picture by picture on the Design Studio's set 1 (`docs/design/mockups/december/01-place-of-linked-spots.html`, branch `design-december-mockups`), after his rule that nothing visual is built without a mockup he approved (planning answer 43). The set's final pictures still go to him for one last look; nothing here is built before that. Examples are the mockup's invented ones.

## The page of a place that holds places
| Id | Ruling | His words |
|---|---|---|
| mc-31 | On an iPad and a PC the map is the body of the page, the spots listed beside it; on a phone the spots come first. | "A" |
| mc-32 | The map shown is the pack's own picture exactly as its book prints it: never redrawn, restyled, tinted, cropped or drawn over. | "the map should be the exact image from the book" |
| mc-43 | The map opens whole in a wide pop-up: fitted first, then zoom and drag, with Fit to return; its zoom controls are two small magnifier icons (plus, minus) under the picture, never over it. | "Map images look good but I think zoom in/out icons (pictured) small under the map would be a good add" |
| mc-44 | A tap on a map opens it whole; there is no button for that. The card shows it can be opened by a change of tone on hover and on press. | "no 'show it whole' just click on map to show it whole. see how color changes in the two images to indicate it's possible? do that" |

## Knowledge and Rules
| Id | Ruling | His words |
|---|---|---|
| mc-33 | A rule's row carries the rule's name as its book heads it and no summary written by the app; its page is the book's words set out as the book sets them (rt-1). | "make sure rules are verbatim and formatted as source wherever possible" |
| mc-34 | A place's knowledge and rules carry the book's full text and formatting to the greatest extent possible. Nothing is trimmed or hidden by default; where length hurts, alternatives are put to Francis, never a silent trim. | "full verbatim text and source formatting to the greatest extent possible. (if we need to trim, hide let's propose alternatives)" |
| mc-40 | Knowledge shows its sections folded under their headings with the book's own first line; the full text is one tap away; the facts at the top stay open. Chosen from three ways of handling length. | "C" |
| mc-35 | The GM may share any section of a place's knowledge. The pack's `shareable` mark (pf-11) no longer decides what can be shared. | "you can share any of them" |
| rg-5 | A place's rule that stands in for the setting's (rg-4) is a toggle on that rule's line, on by default as the pack says; off puts the setting's rule back in force there, at once, with Undo. A place's other rules, which stand in for nothing, have no toggle (the lead's reading). The setting's rule is named in the sentence as a reference tap; there is no separate link line. | "'In force' should be a toggle, on by default as we've already ruled"; of the link: "not stylistically united with the rest of the sheet. too long name, not sure it's needed" |

## Moving on, and what players see
| Id | Ruling | His words |
|---|---|---|
| mc-36 | A destination is one row, with its ways as modes on the row (how, how long), for the GM and for players; a tap on a mode proposes that way. What a way needs (a boat) is told at the table for now. | "to the wreck should be 1 row with two modes (Row/Swim). Row is only possible if players are in the boat but we can keep that narrative for now" |
| mc-41 | A way with an obstacle says so plainly, "The players meet an obstacle" with its name, and asks "Do they get through?", answered Yes or No. "Obstacle" is the word on screen; the format's field stays `barrier`. | "'Yes'/'No' these buttons are awkward… be more clear 'Players encounter an obstacle: XYZ'" |
| mc-42 | A proposed way reaches the GM as one sheet that shows the obstacle, if there is one, before the GM answers. | "steps 2 and 3 should be combined. if it has an obstacle, show me before I accept" |
| mc-37 | Once the GM has shared the map, the players' page shows it in a frame opened on where the party is, moved by drag and pinch, with a way back to where they are. | "I'd expect to see the map image here, zoomed to fit on where the players currently are (tap and pinch to move the frame)" |
| mc-38, mc-45 | The players' page reminds them what the party can do here: the rules pack's own turn actions, in the pack's words and order, each a tap that proposes it to the GM. No "Other". Absent when the pack names none. | "maybe there is a reminder of actions (take a turn to explore, rest, etc.…)"; "things should naturally populate from packs" |
| mc-39 | The players' Encounter check fact says nothing of who rolls or how: its icon and its name. Its look is being redrawn. | "Remove 'your GM's rolled in secret'… i often have the players roll these"; "encounter check looks ugly - give me better effort" |

## Two standard parts
| Id | Ruling | His words |
|---|---|---|
| ds-1a | A toggle carries no state words beside it; the row's name says what it switches. A label for screen readers stays. (Corrects the lead's reading in `dec-stock-and-toggle-2026-11-12.md`.) | "doesn't need 'In force here' - player knows what a toggle does!" |
| ds-2 | The eye is an open eye when a thing is shown to the players and a closed eye when it is hidden: no box around it and no word beside it. Its target stays 44 px; it is read aloud as shown or hidden. The crossed eye is kept for one meaning: the GM's alone, never sent. Screens already built adopt it when next touched. | "eye open eye closed. i dont need the whole square around it with 'Shown/hidden' just the eye" |

## Costs and caveats
- The map frame for players (mc-37) roughly doubles the map piece: about 6 to 8 builder turns in all, with a smaller copy of a large picture made at import and a size limit; no new dependency.
- rg-5 adds 1 to 1½ turns and a small migration to rg-4 (3½ to 4½ in all).
- Zoomed far enough to read a tag, a map's key is off the screen; listing the key beside the picture (pf-8's positions) is for after the first night.
- Dropping the eye's word leaves a new GM nothing that says a tap shares, until the Undo toast; a first-use line was offered and not asked for.
- Not seen on a device: every gesture here is judged from pictures.

Docs to update: 05 (a place of linked spots: its page, knowledge, rules, moving on, what players see), 06 (Components: the toggle without words, the eye, the map card and pop-up; words: verbatim text, "obstacle"), 07 (regions: `shareable` no longer gates; a way's requirement, later), `docs/plans/dec-4-point-travel.md`, 09.

09 lines:
- 2026-11-12 — [ui] A place that holds places has its map as the body of its page on an iPad and a PC; the map is the pack's own picture untouched, opens whole on a tap with zoom, drag and Fit, and for players sits in a frame opened on where the party is (mc-31, mc-32, mc-37, mc-43, mc-44) — Francis, on the December mockups: "the map should be the exact image from the book" — `design/rulings/dec-mockup-rulings-2026-11-12.md`
- 2026-11-12 — [ui] A place's knowledge and rules are the book's full words set out as the book sets them, never trimmed by default; knowledge folds under its headings with the book's first line; the GM may share any section (mc-33, mc-34, mc-35, mc-40; changes pf-11) — "Full verbatim text and source formatting to the greatest extent possible" (Francis) — `design/rulings/dec-mockup-rulings-2026-11-12.md`
- 2026-11-12 — [adventure] A place's rule that stands in for the setting's is a toggle on its line, on by default; off puts the setting's rule back in force there (rg-5) — "'In force' should be a toggle, on by default" (Francis) — `design/rulings/dec-mockup-rulings-2026-11-12.md`
- 2026-11-12 — [ui] A destination is one row with its ways as modes; a proposed way reaches the GM as one sheet that shows any obstacle before the answer, asked "Do they get through?" Yes or No; players are reminded of the rules pack's own turn actions; their encounter-check fact is its icon and name (mc-36, mc-38, mc-39, mc-41, mc-42, mc-45) — Francis, on the December mockups — `design/rulings/dec-mockup-rulings-2026-11-12.md`
- 2026-11-12 — [ui] A toggle carries no state words beside it; the eye is an open eye when shown and a closed eye when hidden, with no box and no word (ds-1a, ds-2) — "Player knows what a toggle does!"; "just the eye" (Francis) — `design/rulings/dec-mockup-rulings-2026-11-12.md`

## The last look (2026-11-12, later): approvals and changes

Francis's last look at set 1, picture by picture. **Approved:** the page; Knowledge; Move on; the one sheet for a proposed way; the map pop-up; the rule sheet an activity opens; the players' page; the players' page before anything is shown. Each with the changes below, which the Design Studio has drawn. Where a row here differs from one above, this one stands.

| Id | Ruling | His words |
|---|---|---|
| mc-46 | No line on a screen explains what the screen already shows. Words that carry a fact or a consequence stay (what an answer does, what was logged); an empty screen may say why it is empty. | "these kind of explainers are wasting space"; of the empty players' page: "an explainer here helps since they dont know what they can't see" |
| mc-47 | A spot carries its number from the map's key, as the key writes it ("1 The jetty"). The party's spot is first and marked; no "The party is here". | "The Jetty should be Numbered like the key"; "We don't need 'the party is here'" |
| rg-5a | The in-force toggle (rg-5) is on the place's page as on the Rules sheet. | "In force still not a toggle" |
| ds-1b | A toggle has a soft glow when on. | "make it soft glow when on" |
| ds-3 | Wherever a die is named or a roll is called for, the matching Die glyph (06's own) is shown with it as the call to action; the app adds no label of its own for a roll. The book's words stay verbatim and gain the glyph; the glyph takes the size of its text and, on an accent fill, the text's colour; no glyph where a roll names no die. | "Our standard is that every time we see a die (d6, d12, etc) or call for a roll, we use the appropriate die icon as a call to action" |
| mc-48 | A table's column headings sit over a stronger rule than its rows. | "Make the line between headings and other rows more distinct" |
| mc-49, pf-12c | A rule's own action button is an icon with no words; its words are its label for screen readers and show on a long press. The lead's reading, drawn and still his to confirm: the pack names the icon from a small set the app carries; with none named, or one unknown, the button falls back to a generic mark with its words. | "use an icon, no words" |
| mc-41a | The obstacle block is headed "Obstacle: <its name>" and sits on a slightly different background tone. | "Obstacle: the Breakwater's gap"; "Make the obstacle box a slightly different background color" |
| mc-42a | A proposed way opens its sheet by itself for the GM; several waiting are counted beside the X ("1 of 3") and worked first in, first out; Not now leaves one as a waiting row. To be tested in play. A sheet's small line and its title have more air between them, on every sheet. | "I assume it will pop up, with (x of y) indicator, and i work through them FIFO"; "move 1 of 3 to next to the X. crowded at the top" |
| mc-43a | In the map pop-up the percentage sits to the left of the two magnifiers; a sheet or pop-up with an X has no Close button. | "% to the left of icons not in between. we have X for close, dont need a close button" |
| mc-44a | A map card is the picture alone: no heading, no caption. Under it, in one row: the map's title at the left where it adds something, and its tools at the right (magnifiers, then the eye for the GM or a locate icon for players). | "the map again does not need the explainer text"; "use something like the above icon from google maps"; "meant move icons to the right, under the map"; "put map title (scaled to fit) to the left of the icons" |
| mc-36a | A way's mode is a stacked button, the action word over its time, at the right of the destination's row, every button one size. The players' heading over the destinations is "Where to?". | "Keep stacked button as the standard"; "buttons for the moves need to be on the right, not in two rows"; "change 'ways on' to 'Where to?'" |
| mc-45a | The players' block is "Activities": a player aid, not modelled behaviour. It lists only the activities whose rules the pack carries; a tap opens the rule in the book's words; nothing is proposed by tapping. Proposing returns only for activities the app models. (Replaces mc-38 and mc-45.) | "these are ideas for narrative action… That is a player aid and augment, not a modeled behavior"; "call this 'Activities'" |
| mc-39b | Players see the Encounter check fact as the GM does: when it is rolled, on one line, and its chance with the die glyph. Before a place is shown to them, it shows the last shown place's check. (Replaces mc-39.) A fact's value never wraps. | "it should show what the gm sees… On every move resized to one line. drop 'this place's rule' it's 1 in 6 with the die icon" |
| mc-50 | Before anything of a place is shown, the players' page keeps its right column in place and empty, so they see where the map and what is shared will land. | "we should have the right column present but empty, to fill a bit of space and let the players know where info will land" |

**More costs.** Players reading the in-force check's timing and chance needs a read rule (about half a turn, the stronger model); with rg-5 the regional check is about 4 to 5 turns. Activities as an aid removes the proposal flow for actions from the build. The icon set for rules' buttons is about a dozen marks to draw and a field for packs to name one.

09 lines:
- 2026-11-12 — [ui] Standards from the December mockups: no line explains what the screen already shows; a toggle glows softly when on; the matching die glyph goes wherever a die is named or a roll is called for; a sheet with an X has no Close button; a table's headings sit over a stronger rule (mc-46, ds-1b, ds-3, mc-43a, mc-48) — Francis, on set 1's last look — `design/rulings/dec-mockup-rulings-2026-11-12.md`
- 2026-11-12 — [ui] On a place of linked spots: spots are numbered as the map's key; a way's mode is a stacked button at the right of its row under "Where to?"; a proposed way opens its sheet by itself, counted and worked first in, first out; a rule's action button is an icon with no words; the players' "Activities" are an aid that opens each rule; players see the encounter check as the GM does (mc-47, mc-36a, mc-42a, mc-49, mc-45a, mc-39b, mc-50) — Francis, on set 1's last look — `design/rulings/dec-mockup-rulings-2026-11-12.md`
