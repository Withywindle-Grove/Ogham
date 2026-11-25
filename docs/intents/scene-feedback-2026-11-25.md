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

### F14. Players' Scene: the travel pop-up has too much empty space

Screen: players' Scene. Tapping a travel button ("Row", from F13) opens a pop-up: the title "Row", the X, "1 turn.", and "Your GM moves the party. Say where you want to go.", with wide gaps between the lines.

Picture: [F14-row-popup.png](scene-feedback-2026-11-25/F14-row-popup.png) (cropped to the pop-up; the map behind it is cut out).

> Too much empty space, needs formatted with impeccable and latest design standards.

Reads as: tighten the pop-up's spacing; run it through an `impeccable` critique against the current design standards.

### F15. The "Move on" pop-up: better layout, less space

Screen: the "Move on" pop-up (GM's Scene). Eyebrow "Move on", title "Row to 1. <place>", the X. Two label rows: "Takes" (hourglass) "1 turn." and "Then" (crossed swords) "a roll on <check name>." Then a full-width accent "Move" button, a rule, and "Back" at the bottom right.

Picture: one screenshot, not committed: it shows a private pack's place and check names (hard rule 2).

> same story, can be formatted better and with less open space

Reads as: the same ask as F14 for this pop-up: a tighter, better layout with less empty space.

### F16. Knowledge can be shared with the party

Screen: GM's Scene, the "Knowledge" pop-up for "Arrival" (as in F8): "The pack gives no knowledge for this place." and "From your adventure: <adventure>, p. 10." It has no share control.

Picture: one screenshot, not committed: it shows a private pack's adventure and place names (hard rule 2).

> knowledge should be shareable to party. in this case maybe i dont see it because there is no knowledge

Reads as: the GM can share a place's knowledge with the party from this pop-up. He thinks the share control may be missing here only because this place has no knowledge (see F8 (a)).

### F17. The crossed-out eye on "From the book, for the GM"

Screen: GM's Scene at a place ("1. <place>"), below "Someone fell in" and "Move on". A section header "From the book, for the GM" with a crossed-out eye icon and a fold chevron, then the book's text for the place.

Picture: one screenshot, not committed: it shows a private pack's place text (hard rule 2).

> This crossed out eye symbol is confusing because i can't reveal it. Better to remove the icon

Reads as: the crossed-out eye suggests the GM can reveal this text, but he cannot. Remove the icon.

### F18. Keep the boxed item inside the book's text

Screen: GM's Scene, the same "From the book, for the GM" section as F17, opened. The place's text with bold lead-ins, then a bordered box for a magic item (its name in capitals and its description), then "p. 14".

Picture: one screenshot, not committed: it shows a private pack's place text, a character and an item (hard rule 2).

> I like this box, i may have earlier said to remove it, but i think it should stay

Reads as: keep the bordered box for an item inside the book's text. This may reverse something he said before this collection; the driver should check for an earlier ruling.
Question (held for the end): "this box" is the bordered item box, not the whole "From the book" section?

### F19. A character at a place needs their stat line at hand

Screen: GM's Scene, the "From the book, for the GM" text from F17 and F18. The paragraph "Woman." describes a named character at this place, a sailor.

Picture: one screenshot, not committed: it shows a private pack's character text (hard rule 2).

> [NPC] is a sailor and should have a stat line that Gm can quickly reference. there is a sailor stat line on pg 13 of the source material. In general if an npc is at a location i should be able to quickly access their information. need to verify this when i get to location 5 with [NPC 2]

([NPC] and [NPC 2] are named characters in the pack.)

Reads as: when a named character is at a place, the GM can open their stat line and notes in one tap. Here the character is a sailor, and the source has a sailor stat line on p. 13. Same need as F4 (d). He will check again at place 5, which has another named character.

### F20. Found treasure rows: reveal does not work, no way to take, a machine ID shown

Screen: GM's Scene at a place, the treasure rows found there. Two rows, each with a closed-eye icon on the right: a stack of weapons, and a single magic item with the line "Value stays yours (Item: <pack item ID>)."

Picture: one screenshot, not committed: it shows a private pack's item text and ID (hard rule 2).

> neither of these rows will reveal to party, and both will need some kind of option for the party to take them in party stash or otherwise. [pack item ID] is a designation that is machine readable, but i need a human readable designation here. do we have a plan for distributing found treasure prior to dec 5?

Reads as: four parts. (a) Bug: tapping the closed eye does not reveal either row to the party. (b) A found item needs a way for the party to take it, into the party stash or to a character. (c) The row shows the pack's machine ID for the item; show a name a person can read. (d) A question for the driver: is there a plan for sharing out found treasure before 5 December?

### F21. Stat lines and item rules at hand: the second place

Screen: GM's Scene at place 2. "From the book, for the GM" (folded, with the crossed-out eye), "Knowledge", "Rules", "Checks here" (the encounter check with a toggle), then the place's text as rows, each with an open-eye icon. One row names two sailors (with "(p. 13)"). Lower, two found rows: a stack of 12 of a pack item ("Value stays yours (Item: <pack item ID>).") and a creature group ("The stat line never shows (<pack creature ID> ×6).").

Pictures: two screenshots, not committed: they show a private pack's place text, characters, items and IDs (hard rule 2).

> same story, need a sailor stat line. and an [creature] stat line (there is already an eel stat line in "for the gm" we could. put a "sailor" stat line here too.) need a way to distribute the [item] and need their mechanic easily at hand. (it's already in "for the gm" but this is a general principle.)

([creature] and [item] are a pack creature and a pack item.)

Reads as: the same needs as F19 and F20, as a general principle. (a) The sailors here need their stat line at hand. (b) The creature group needs its stat line at hand; the row says "The stat line never shows", though the book text already has it. A sailor stat line could sit here the same way. (c) A found item needs a way to share it out (F20 (b)) and its rule at hand, not only inside the book's text.

### F22. "Where to?" rows have no map numbers

Screen: GM's Scene at place 2, "Where to?". Four rows, each with "Row" (1 turn) and "Swim" (3 turns): "Arrival", "<place 1's name>", and two rows named like the travel choice, each "Not yet explored." No row shows a map number.

Picture: one screenshot, not committed: it shows private pack place names (hard rule 2).

> Another reminder these should all be numbered even if unknown

Reads as: the same ask as F13 (b), on the GM's side too: every "Where to?" row shows its map number, also for an unexplored place.

### F23. Test magic items and what they reveal

Screen: GM's Scene, a found row with an open-eye icon: a plain description of an item, then "Value stays yours (Item: <pack item ID>)." The pack ID shows a magic item behind the plain description.

Picture: one screenshot, not committed: it shows a private pack's item text and ID (hard rule 2).

> need to test magic items and revealed information

Reads as: a note for testing, not a fault seen. Test a magic item found under a plain description: what the party sees when it is revealed, and what the GM can reveal later about its magic.

### F24. The "Edit piece" form needs a redesign

Screen: GM's Scene, the "Edit piece" form for one row of a place (here the item row from F23). Kind chips: "Description", "Exit", "Someone here", "Clue", "Treasure" (picked), "Hazard", "Other". Then "What players will see" (a text box holding the row's text), a rule, "Remove this piece", "Cancel" and "Save".

Picture: one screenshot, not committed: it shows a private pack's item text (hard rule 2).

> we need a redesign on this. it's not clear to me how often i'd use it, and the formatting is not impeccable or project standard

Reads as: redesign the "Edit piece" form to the project's standards (with an `impeccable` critique). He is not sure how often a GM would use it, so its place on the Scene is also in question.

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
