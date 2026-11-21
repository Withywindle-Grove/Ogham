---
status: pending
milestone: December first play (the whole Scene at a spot: its plan is to be written as `docs/plans/dec-9-the-whole-scene.md`; creation's batches F to H; magic B and D)
absorbed-into: pending, with each piece's pull request: 05, 06; docs/09-decisions-log.md (2026-11-14)
supersedes: nothing as a file. Inside it: mo-1 supersedes mc-4 (hit points beside the formation); st-2 supersedes B7's fold of a paused Scene; st-1 retires the hour track's pips and B9's "+ Reminder" by the turn area; cs-45 supersedes the review frames' coin words.
---

# 14 November, the morning: the Scene is built whole, once; its top in every state (2026-11-14)

Francis looked at the built place card (pull request #785) under today's old time strip and said: "Missing what we designed Thursday. No sequence of play strip and the entire top area" was to be reworked; then "Hold. Remember our rule about building once? Is this not a violation of that?". He was right in part, and the fault was the lead's: the place card had been released with no plan for the top of the same screen. The Studio then drew the top in every state (`docs/design/mockups/december/16-the-scenes-top-in-every-state.html`, branch `design-december-mockups`, at 1241116c) and he ruled it frame by frame. What was already ruled for these parts is gathered in `docs/design/notes/scene-top-ruled-so-far-2026-11-14.md`; the Studio's brief is `docs/design/notes/brief-scene-top-states-2026-11-14.md`.

## How a screen is built and shown

| Id | Ruling | Whose |
|---|---|---|
| po-4 | **A piece of a screen that has an approved redesign is not put to Francis, and does not merge, until that screen matches its approved drawing**, unless he says otherwise. Before any piece on Scene, the Player screen, Pack or the town is handed to a builder, its plan covers the whole screen's drawing; a part of the drawing with no plan row stops the hand-out. Pull request #785 (the place card) is held; the Scene's top, the map's mount and the marching order are built on its branch, and the whole Scene at a spot comes to him once. | "Hold. Remember our rule about building once?" (Francis); the wording is the lead's |

## The Scene's top (page 16)

| Id | Ruling | Whose |
|---|---|---|
| st-1 | **The Scene with everything due is approved as drawn (frame T2).** The band holds only the heading, the date line, "Next turn" with the hourglass and the menu. Undo is in the toast (mc-57). The four facts (Weather, Light, Rest, Encounter check) carry their own due states. Everything that needs the GM is in "Waiting for you": the first a whole card, the rest one-line rows (the mark, the title, its one button), "N more" past four. The hour track's pips are gone: each fact says when it next falls due. "N waiting, Players" is gone from the top. An effect that simply ends is a toast and a log line, and a row only where the pack says something must then be decided. The accent is mc-27's. | "Otherwise approve." |
| wy-1 | **The count beside "Waiting for you" names which one is open of how many wait** ("1 of 4"). A row opened takes its number; one answered, the next opens and the total drops; with one waiting there is no count; past four the total counts them all. | "The count is 4? I think it should show x of y"; "Which is open" |
| mo-1 | **The marching order shows each character's hit points and bar under their own circle** (frame R1). Supersedes mc-4. | "Under each circle" |
| st-2 | **With no session, "Start session" stands in Next turn's place and is the page's accent** (an extension of mc-27); the heading reads "No session yet" under the campaign's name; the date line is itself the tap while the date is unset ("Day 1. Set the date"); there is no facts row before the first session; the strip stays; the empty place card keeps "Set place", plain. **A paused Scene stays as it was left**, with "Resume session" in the same place and no turn count in the heading; nothing folds and there is no "Show details". Supersedes B7's fold. | "Approve both" |
| st-3 | **The sheets the top opens are approved with four changes.** How the party explores is the two-sided switch (ds-1d) when a setting has two modes. Dawn, noon and dusk each carry an icon from the set, the word under. The month is one field that opens a sheet of the calendar's months; a tap picks one. The weather roll is entered on the weather table itself, in the book's table style: roll, then tap the row; no number box. "Reminders", in the menu, lists what is to come and holds "+ Reminder" (supersedes B9's place for it). "Set the date" is one sheet for the day, the month and the hour play starts. | "By turns by day can be a toggle, dawn noon dusk are clearly icon opportunities. Month should pop up sheet with the months. Weather should pop up sheet with the table and tap row." |
| gt-1 | **A place's own book text for the GM is a folded row on the place card**, under its description, headed "From the book, for the GM", folded to the book's first line and opening in place with its lists and boxed asides; never sent to players (page 15, frame BT1, home B). | "Approve" |

### The rest of his walk, the same morning

| Id | Ruling | Whose |
|---|---|---|
| wr-1 | **A player who rolls the weather enters the number and never sees the weather table**; only the GM taps the table's row. | "Good callout for players the table is hidden" |
| sm-1 | **In town, one tile cut diagonally replaces the safety fact**: a sun for "Out and about today", a moon for "Active tonight", one or the other (a tap on the lit half turns it off), a warm glow or a cool one when on, a word under each ("By day", "By night"); players see it and cannot tap it. A season's icon stands before the date. This changes behaviour: today the two switches are separate. | "I imagine a [tile] taking the same space, cut in half diagonally. In one side is a sun with birds on the other a moon with clouds…"; "Sun moon are dependent." |
| st-4 | **Three small icon buttons sit on the Scene, in the band**: Make camp (a tent), Encounter check, Leave the dungeon; the menu keeps the rest. Leave the dungeon first asks whether the party is at a way out: if so it leaves; if not, a sheet with two choices; where the app cannot tell, the sheet with a first row that leaves at once. | "Make camp should be a tent button on screen not in a [menu], same for encounter check… Leave the dungeon should be an icon and check if players are at an exit to the dungeon. If not pop up a sheet with two options" |
| st-5 | **With a split party the Light and Rest facts name the group that needs the GM and list the others; a Light fact in the dark takes the cool glow**, on every screen that shows it. | "The dark 'light' tile should use the cool hued glow not the warm hue, applied to all screens using that tile. Otherwise approve" |
| st-6 | **The GM's phone is approved, and every button on the Scene carries an icon from the set**, the icon above its word. | "Also icons for buttons" |
| st-7 | **The players' top is approved**: the band without its button or menu, the same facts and strip, naming only places shown to them. | "Approve top with feedback and fix." |
| st-8 | **Page 16's redraw is approved** (at d0c94067): the book's type and format on every frame, the band's date line, the icons, Leave the dungeon's three cases with today's words ("Ask for escape rolls", "Use safe paths"), the tile's words. With it: **no sun and moon tile in downtime**, whose facts row is Weather alone until lodging is tracked; and the lead's fixes (stacked buttons one width within a group; the tile's unlit halves stronger; the cards' sub-headings in the book's style). | "Have the stylesheet and book formatting been applied to these screens? They should have been. For header as well"; "Not needed in downtime. Other redraws approved" |

Lodging tracked (a Lodging fact in the town's row; own or party lodging; remembered; asked for when time advances; paid through Due) is built after 5 December: "After the fifth", "For lodgings". Intent: `docs/intents/2026-11-14-lodging-tracked.md`.

### Who may read and write, the same morning

| Id | Ruling | Whose |
|---|---|---|
| rm-1 | **A rumour row the GM gives is readable, as its words only, by that character's player, or by every player when given to the party**; its truth and notes never leave the GM's library. | "Approved." |
| nt-6 | **A player may share with the party.** His yes was to "one of their own notes"; the approved drawing's button shares a kept call. Whether a player may pass on a call sent to their character was put to him and was open when this was written, as was a player's pin on a call. | "Yes player can share with party." |
| wt-1 | **The lead may restart its own read-only watch after a low-memory stop once free memory is above 8 GB**; anything else the system stops still waits for Francis. | "Approve 1+2" |

## Other rulings of the morning

| Id | Ruling | Whose |
|---|---|---|
| ap-3 | **The one-tap figure sheet is approved as built** (#784): the figure large in the head, the die line, "Modifiers" by source, the rule's words, the source. As built it differs from the drawing in three ways he was told: 36 px for the figure, the bold Roll row, today's type. | "Approve" |
| gp-8 | **Undo of an older give is refused once the GM has given the character to someone else** ("That's changed since. Undo the later change first."), and neither give is reverted. Page 13's "gives Ash back to whoever had it" is superseded for that case. The way #774's test came to be changed is not settled by this. | "Keep as built" |
| lt-1 | **On a phone the long table's typed-roll strip may be three lines** (the label over its box and Show; the ranges); the tablet keeps two. No letter-spacing change to the label. | The lead's, from the first night run |
| cs-42 to cs-44 | Gear: Next takes what is marked in a pick-up-to-N table, with one toast naming each table and one Undo ("1 taken from <table>.", "N put back in <table>."); the line "These are taken already…" goes; over the coin the sum reads "20 rolled, 22 gp spent: 2 gp over." and cs-22's words stand otherwise. | The lead's |
| cs-45 to cs-53 | The review and the states (batches G and H), under cs-30: one coin form everywhere (cs-22's; supersedes the review frames' "120 silver rolled, 14 spent"); special approvals last; the GM's card, the loaders, the offline words, the toasts for a blocked step, "Nothing to choose here.", one column on an iPad and the sent-back screen all keep the build's behaviour, with the ruled words; nothing untrue is written (no "Kept on this device" before the offline queue exists). Drawn and not built, each for Francis as its own piece: G2's top card, G6, H1, H2, H5's dialogs, H3's why-line, G8, G5's layout. | The lead's |
| mm-8 to mm-10 | Magic's rest prompt: with someone left out the summary names them ("…are back, except for Wren."); each row is the ruled toggle with the character's name and "Tap a mark to switch it." goes; the one-step Undo of a rest waits for the camp-night piece's migration (the standing Undo rule does not reach across the rest's line and the casters'). | The lead's |
| mp-1 to mp-3 | The map tied to a place: a place two maps name shows the first; 25 MB of input as the place's picture; no "+ Map" row on a place made by hand until a frame draws one. | The lead's |
| ids | `sb-2` and `tg-1` in `dec-player-screen-2026-11-14.md` reuse ids that already existed (stat-block labels; a testing rule). Read them there as **stk-1** (the stacked button on the Player screen) and **tog-1** (a pair of opposite actions is a toggle). | The lead's |

## Honest notes
- The lead told Francis the place card "waits on nothing" and later put it to him as "the place page" when it was a new card under an old top. Three parts of his approved Scene had no plan row: the title band, the facts row, the marching order. po-4 is the rule that should have been applied.
- Overnight, builders reached an end by another route after a block, or expecting one, on twenty occasions; the list is with Francis and nothing was reworked. The speed piece is held on one of them.
- Page 16's frames were opened by the lead in the dark theme only, and not all of them.
