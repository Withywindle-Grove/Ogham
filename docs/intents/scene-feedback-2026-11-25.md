# Intent: Scene feedback, 25 November 2026

Author: Francis · Date: 2026-11-25 · Status: draft (collecting)

Francis's notes on the Scene screens (the GM's Scene and the players' Scene), sent one at a time on 2026-11-25. Numbered F1, F2, … in the order he sent them. His words are quoted as he sent them. Nothing is decided here; the driver processes the items after the collection ends. Pictures go in `docs/intents/scene-feedback-2026-11-25/` and are linked from their items.

## Items

### F1. The Depart pop-up's place list

Screen: GM's Scene, the Depart pop-up ("Where?"). It lists the places of one adventure in two headed groups, then "From your packs" (each pack with its count of places and a + to open it, one opened to its area row), then "Other… a place that isn't listed".

Picture: two screenshots, not committed. They show a private pack's adventure, area and place names (hard rule 2). The driver can ask Francis for them. What they show: the places are listed in no clear order (for example 2, Arrival, 5, 7, 3, 6, 4, 8, 1, 9, 11, 10, then 12, 7, 10, 9, 4, 15, 5 in the second group). The pop-up opened on the adventure the party last started.

> Locations should be ordered sequentially, with locations that have no sequence at the beginning "Arrival" - in fact "Arrival" should be "0. Arrival." These lists should be collapsable.
>
> I'm assuming it defaulted to the island adventure because that's where the party last started - is that correct? [setting] is an area but it's subtype is Settlement which will impact how players interact with it. Outside the scope of this test but note for later it should not be treated the same as an exploration or dungeon or point-to-point

Reads as: four parts. (a) Sort places by their number, with places that have no number first. (b) "Arrival" becomes "0. Arrival". (c) Each group in the list can be folded. (d) Later, not for this test: an area of subtype Settlement behaves differently from an exploration, a dungeon or a point-to-point area. He also asks a question for the driver to answer: does the pop-up open on the adventure the party last started?

### F2. The Depart pop-up: a way back, and unnumbered places in the pack tree

Screen: GM's Scene, the Depart pop-up ("Where?"). Two states:
1. The first view: "Search places by name or map number" (a text box), "Recently visited" (four rows, each a place with its kind in brackets, for example "(Area)" or "(Location)"), "From your packs" (three packs, each with its count of places and a +), and "Other… a place that isn't listed".
2. One pack opened as a tree: pack → region → area → its places, each level with a − or + to fold it. The places show their kind in brackets but no map number. They are in the same mixed order as in F1.

Picture: two screenshots, not committed (private pack names, hard rule 2).

> This screen should have a back button or navigation to get me to the initial screen. Locations are not numbered or ordered.

Reads as: the grouped place list from F1 has no way back to the first view (search, recently visited, packs). In the pack tree, places show no map number and are not in number order.
Question: which screen has no way back: the grouped list in F1, or the opened pack tree?

### F3. The Scene's top buttons, the swords button, and the encounter check

Screen: GM's Scene during an expedition. Top right, left to right: a crossed-swords button, "Next turn" (hourglass), "…" (more), and "−". The "…" menu holds "Advance by…", "Reminders", "End expedition" ("You'll be asked whether the party is somewhere safe") and "End session" ("Stop playing for today; the clock keeps its place"). Below, "Waiting for you" holds a "Due now" card for the encounter check, with an "Enter roll…" button. Tapping it opens a d20 encounter table inside the card ("Roll d20, then tap the row.").

Pictures: [F3-more-menu.png](scene-feedback-2026-11-25/F3-more-menu.png) (the "…" menu, open). Three more screenshots are not committed: they show a private pack's encounter text (hard rule 2).

> "..." should be the rightmost buttons to the right of "-"
> clicking the swords (needs a better icon) creates an encounter  and no means of closing the encounter without resolving, aside from undo.
>
> Encounter check is narrow and long. it should be a centered pop-up when "enter roll" is clicked

Reads as: three parts. (a) Move "…" to the far right, after "−". (b) The crossed-swords button needs a better icon. Once it starts an encounter, the GM can only end the encounter by resolving it or by Undo; he wants a way to close it. (c) "Enter roll…" opens the encounter table as a pop-up in the middle of the screen, not inside the narrow card.

## Problem
To be filled in by the driver when it processes the items.

## Outcome
To be filled in by the driver.

## Touches
The Scene screens (GM and players), `06-screens-and-design.md`, `05-features.md`.

## Constraints
Hard rules 2 (IP-clean) and 7 (calm UI).

## Out of scope
To be filled in by the driver.

## Open questions
- ⚑ The clarifying questions, if any, sit under their items.

## Links (filled in later)
Ruling: — · Plan: — · Pull request: — · Status report: —
