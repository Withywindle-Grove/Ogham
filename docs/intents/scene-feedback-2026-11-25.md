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

### F4. The encounter card after the roll: clean-up, details at hand, reveal not reaching players

Screen: GM's Scene, "Waiting for you" (1 of 2), after the encounter roll. The card shows the rolled result as "Rolled: <table name>: <result>", then "Encounter tables ›", "Done", "Reveal to players" and "Message…". Below it, a second row for the same encounter check with a "Start" button. After "Reveal to players", the card says "Players see this result." in that button's place. "Start" opens a pop-up, "Started: <check name>", with the result, the creature's stat line and "View", ending "Run it at the table. Fights come in a later update."

Pictures: four screenshots, not committed: they show a private pack's encounter text, a stat line and a character name (hard rule 2).

> This screen needs impeccable-cleaning. The encounter Tables menu needs redesign, and in this case we dont need an encounter table because we already rolled on one "[encounter result]" The encounter was revealed but never appeared on the players scene, that seems like a bug. I need the details of each encounter check. This may require a design session. For example, for this encounter I need stat lines and descriptions for the skeletons close at hand so that I can run the encounter. or in another example i would want npc info for [NPC].

(The quoted result is a row from the pack's encounter table: three skeletons board the party's boat. [NPC] is a named character in another row of the same table.)

Reads as: four parts. (a) The encounter card needs a clean-up pass (an `impeccable` critique). (b) "Encounter tables ›" needs a redesign; once the table has been rolled, the card does not need it. (c) Bug: after "Reveal to players", the encounter did not appear on the players' Scene. (d) Each encounter check's result should bring its details close at hand: the creatures' stat lines and descriptions, or a named character's notes. He thinks (d) may need a design session.

### F5. Two encounter cards for one encounter; the stat pop-up's header

Screen: GM's Scene, "Waiting for you". Two cards for the same encounter:
1. The card from F4 ("<check name>, now", "Rolled: …", "Encounter tables ›", "Done", "Reveal to players", "Message…"), with a second row below it ("<check name>…" and "Start").
2. A card "An encounter waits": "<check name>, now, Turn 1." then the result as a link, with "Start" (accent) and "Dismiss".

Tapping the result link opens a pop-up. Its title is "Encounter waiting: <check name>, now", then the creature's name as a large heading, "How many: 3", the stat line, a short special-rules paragraph, "From your setting: <source>, p. <page>", and "‹ Back to the encounter". The close (X) sits beside the title, above the creature's name.

Pictures: three screenshots, not committed: they show a private pack's encounter text and a stat line (hard rule 2).

> It's not clear why there are two encounter notifications, that seem to describe the same notification. The second notification seems to be the more relevant one. Designing based on that, I dont need "[check name]" or "[check name] turn 1." The encounter description is a sufficient start. The third image is exactly what i need for stats but i dont need the description above "Skeleton" and the "X" should be aligned with skeleton.

([check name] is the pack's name for the encounter check.)

Reads as: three parts. (a) One encounter shows as two cards; keep one, built on the "An encounter waits" card. (b) On that card, drop the check's name and "Turn 1"; the encounter result alone starts the card. (c) The stat pop-up is right, but drop its title line ("Encounter waiting: …") and put the X on the line of the creature's name.

### F6. The encounter pop-up behind "Back to the encounter" and "Start"; the result link

Screen: GM's Scene. "‹ Back to the encounter" (in the stat pop-up from F5) opens a pop-up titled "Encounter waiting: <check name>, now". It shows "Turn 1, <check name>, 2", the result, "<creature>, 3" in bold, the stat line, and "View". "Start" on the "An encounter waits" card opens the same layout. The result on that card is an underlined text link.

Pictures: two screenshots, not committed: they show a private pack's encounter text and a stat line (hard rule 2).

> clicking "Back to the encounter" brings this screen which is less well organized and containst he same information.
> This underlined link looks ugly, and should be a tapabble button or other interface.
> "Start" encounter brings me back to the first picture above, when "View" is what i really need.

Reads as: three parts. (a) "Back to the encounter" opens a pop-up that holds the same facts as the stat pop-up, less well laid out. (b) The result on the "An encounter waits" card is an underlined link; make it a button or another tappable control. (c) "Start" opens that same less-organised pop-up; he wants it to open what "View" opens (the stat pop-up from F5).

### F7. The Scene's tracker tiles not centred; the wrong icon on "Someone fell in"

Screen: GM's Scene during an expedition. A row of three tiles, aligned to the left: "Light" ("⚠ No light", picked, with a blue outline), "Rest" ("In 6 turns", "1 turn in 6."), and the encounter check ("On every move"). Elsewhere, a button "Someone fell in" with a scales icon.

Pictures: two screenshots, not committed: they show a private pack's check name and procedure (hard rule 2).

> These buttons should be centered. Someone fell in is using the incorrect button. It should be a splash icon as designed.

Reads as: two parts. (a) Centre the row of tiles (Light, Rest, encounter check). (b) "Someone fell in" shows a scales icon; its mockup has a splash icon.

### F8. A place's Knowledge leaves out its area's knowledge; the encounter tables page

Screen: GM's Scene at a place (breadcrumb: region › area › place). Buttons "Someone fell in", "Move on" (accent), "Knowledge" and "Rules". "Knowledge" opens a pop-up: "The pack gives no knowledge for this place." and "From your adventure: <adventure>, p. 10." A row lower on the Scene, "Encounter tables, <check name> likely ›", opens a full page: a back button, the table's name, "Rolled by hand", the roll line, then the table as numbered rows (large serif numbers, plain sans-serif text, dotted rules between rows).

Pictures: three screenshots, not committed: they show a private pack's place names and encounter table (hard rule 2).

> The knowledge for this place should also check for the area knowledge and display it here (Pg10 of the source material contains it.) Encounters is not formatted properly with our latest standards and book formatting

Reads as: two parts. (a) When a place has no knowledge of its own, "Knowledge" also shows the knowledge of its area (the source has it on p. 10). (b) The encounter tables page does not follow the current table and book styles.
Question: for (b), which standard do you mean: the d20 table inside the "Due now" card (F3), or another ruling or mockup?

### F9. The encounter rows on the Scene may not be needed

Screen: GM's Scene, low on the page. Two rows: "Encounter check, nothing due", and "Encounter tables, <check name> likely ›".

Picture: one screenshot, not committed: it shows a private pack's check name (hard rule 2).

> It's not clear i need the encounter rows shown when i have the encounter button next to "next turn" which serves a similar purpose.

Reads as: the two encounter rows may repeat what the crossed-swords button beside "Next turn" (F3) already does; he questions whether they stay on the Scene.

### F10. "Encounter check, nothing due" shows with the header folded

Screen: GM's Scene, the header folded (its button shows "+"). The header shows the session and region, "<place>, turn 1", the date and season, "⚠ No light", and the crossed-swords, "Next turn", "…" and "+" buttons. Under it, the line "Encounter check, nothing due" still shows.

Picture: one screenshot, not committed: it shows a private pack's region and calendar names (hard rule 2).

> "encounter check, nothing due" should be part of the collapsed menu

Reads as: when the header is folded, "Encounter check, nothing due" is hidden with the rest of the header's folded part.

### F11. The tracker tiles not centred (a second view)

Screen: a Scene with the left rail open (the campfire icon picked) and a "‹ <campaign>" back link at the top. Header: "Session 10.", "<place>, turn 1", the date and season. Then a row of three tiles, aligned to the left: "Light" (a character's name, cut off, "24 turns left."), "Rest" ("In 6 turns", "1 turn in 6.") and "Encounter check" ("On every move").

Picture: one screenshot, not committed: it shows a character's name and a private pack's calendar name (hard rule 2).

> These boxes should be centered

His follow-up note, sent right after:

> And collapsible on the player scene too

Reads as: this view is the players' Scene. Two parts. (a) The same ask as F7 (a): centre the row of tiles. (b) The players' Scene header (with its tiles) can be folded, like the GM's (F10).

### F12. Players' Scene: an unvisited place shows; where "Rules" sits

Screen: players' Scene. A card headed with the area's name. Inside: a "Rules" button (scales icon, the rule's name below it, "›"), then a place row "2. <place>" with the start of its description and "›". The party is at "Arrival", not at that place.

Picture: one screenshot, not committed: it shows a private pack's area, rule and place text (hard rule 2).

> This is player scene. Why is the frigate showing? Rules should be on the left

Reads as: two parts. (a) The players' Scene lists a place in the area, with its description, that the party has not reached; he asks why. (b) "Rules" should sit on the left.
Question: "on the left" of what: the page's left column (or rail), or inside this card?

### F13. Players' Scene: unexplored places by map number; a map without its key

Screen: players' Scene, on his tablet. Left: breadcrumb (region › area), the place "Arrival" with its read-aloud text, "Someone fell in", then "Where to?" with two rows: "<place 2's name>" and a row named like the travel choice ("Not yet explored."), each with "Row" (1 turn) and "Swim" (3 turns) buttons. Right: the area map the GM revealed, with its printed key (numbers and every place's name) at the bottom, zoom buttons, and the area's "Rules" card below.

Picture: one screenshot, not committed: it shows a private pack's map, place names and text (hard rule 2).

> Not sure how [place] was revealed, maybe an prior test. Players will navigate to unexplored locations by map key. So they should see as options - 1. Unexplored 2. Unexplored
> The map that the gm revealed shows the labeled key. Do we think the pack creator can separate the key from the map so that the players get only the map? That version could display by default and the gm could later reveal the full key.

([place] is the place at map number 2, shown by name.)

Reads as: three parts. (a) He does not know how place 2's name came to show to players; perhaps an earlier test revealed it. (b) Players pick a destination by its map number; an unexplored place shows as "<number>. Unexplored", not by name. (c) He asks whether the pack builder can split the map from its printed key: players see the map alone by default, and the GM can reveal the full key later. Part (c) is a question for the driver and the pack tools.

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
