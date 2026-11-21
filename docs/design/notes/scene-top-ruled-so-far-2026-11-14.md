# The Scene's top and the marching order: what is ruled so far

Written by the lead on 2026-11-14 (nt-1: before a screen is drawn or planned, everything already ruled for it is gathered). It covers the GM's and the players' Scene above the place card (the title band, the facts, the sequence-of-play strip, Next turn) and the marching order card on the same screen. Compiled from a scout's list; the newest ruling wins.

Short names: `09` = `docs/09-decisions-log.md`; SM = `docs/design/rulings/scene-mockup-rulings-2026-11-11.md`; S1, S2, S35 = the December mockup rulings of 2026-11-12 (`dec-mockup-rulings-2026-11-12.md`, `-set2-`, `-sets3-5-`); SW = `dec-creation-sweep-built-screens-2026-11-12.md`; EV = `dec-evening-2026-11-13.md`; PS = `dec-player-screen-2026-11-14.md`.

## Where it stands (2026-11-14)

| Fact | Source |
|---|---|
| Francis approved the whole Scene at a spot on 2026-11-12: `docs/design/mockups/december/02-the-turn.html`, frame R1 (picture `02-01-scene-at-rest`): the title band, four facts, the strip, the place card, Waiting for you, the map, the marching order | S2 |
| The GM's place page (pages 11 and 12) was approved on 2026-11-13 WITHOUT the facts row: "its place stays free" | EV, pg-1; `docs/plans/dec-7-5-place-page-and-map.md`, row 5f |
| The place card is built (pull request #785) and HELD: Francis ruled that the screen comes to him whole, built once | 2026-11-14 |
| No plan row builds the title band, the facts row or the marching order as drawn. The strip and Next turn have rows (dec-9 C and D) | `docs/plans/dec-9-the-strip-and-next-turn.md` |

## The session

| Ruling | Source |
|---|---|
| One Start session button that asks only what is needed, with the expedition's start inside it (mc-24); the hour asked as dawn, noon or dusk where the setting names them (mc-25) | SM |
| A paused or ended session collapses behind one "Resume session" for the GM and "Session paused, waiting for the GM" for players (B7). "No session running and one played before" counts as paused; a new campaign shows Start session | 05; 06 |
| End session and End expedition live in ⋯, each saying what it does under its label | 05 |
| After End session inside a dungeon the next Start session resumes there, with "Resumed: <place>, turn N" until the first advance | 05; 06 |

## The heading, the count and the date

| Ruling | Source |
|---|---|
| The mode and turn in the heading is the one heading that opens something: the procedure (fl-5, B5) | 09, 2026-11-04 |
| The count restarts with each expedition; numbers are numerals; a town counts parts of the day | 05; 06 |
| Until a calendar start is set the date reads "Day N" with a quiet "Set date"; the start time defaults to 06:00 with a quiet "Set start time" until the clock first moves (B13) | 05; 06 |
| There is no Day / Night switch: night runs from sunset to sunrise (nc-1, nc-3) | 09, 2026-11-11 |
| The app's top bar hides as the Scene scrolls down and comes back (mc-7) | SM |
| The title band keeps the app's headings; the Scene's card headings take the book's sub-heading style (ds-7a, ds-7b). Pieces of the redesigned Scene are built directly in the book's type (po-3) | S35; SW; PS |

## Next turn and the accent

| Ruling | Source |
|---|---|
| One time control: "Next turn" with the hourglass; one tap advances one unit of the mode in force (a turn, a round, a day), at once, with Undo in the toast; no sheet on the button; "Advance by…" stays in ⋯ as built (mc-57) | S2 |
| No long press for +N (A6) | 09, 2026-11-01 |
| The accent is the first action of Waiting for you; else Move on; else Go to sleep (mc-27). In town the step is quiet so Start expedition stays the accent. Players' steady state has no accent: only a prompt carries it | SM; 06 |
| The encounter check opens by itself as a pop-up when the day or the move reaches it (mc-26); the GM's next sheet opens by itself, with Not now; nothing opens by itself for players (mc-30) | SM |

## The facts (Weather, Light, Rest, Encounter check)

| Ruling | Source |
|---|---|
| Weather: today's weather with each effect in plain words; each tag's name with the pack's note; whoever "Weather rolled by" names enters the roll, the first entry counts; players see it as a word and a symbol; the weather table is never shown to players; the card folds to an icon on a tap (no automatic fold) | 05; 06; `m5b-wilderness-2026-10-30.md`; R3 audit 15 |
| Light: a group with no light reads "No light" with its symbol and words, a tap gives the rule; the screen never dims; in day modes a group counts as dark only while "Travelling in darkness" is on (a ⋯ switch) | 05; 06 |
| A town's top row has no light fact (mc-69) | S35 |
| Rest: the marker counts down in words ("Rest in 2", "Rest due"), lit when due, ⓘ in the pack's words; players get a prompt, the GM a working panel; a forced march's rest is answered in camp | 05 |
| Encounter check: the mode's check, or the place's own which stands in for it (rg-4); named by the pack's `encounterCheck.name`, else "Encounter check"; its chance with the die glyph (ds-3) | 09; S1 |
| Players see the Encounter check fact as the GM does: when it is rolled, on one line, its chance with the die glyph; before a place is shown to them, the last shown place's check; never the table (mc-39b, rp-2). A fact's value never wraps | S1; `dec-place-rules-for-players-2026-11-13.md` |

## The sequence-of-play strip

| Ruling | Source |
|---|---|
| A strip of circles with icons on the GM's and the players' Scene: a reminder, not a process; it keeps no state, marks no current step and stops nothing (mc-53) | S2 |
| The steps are the procedure in force: the place's, else its mode's, else the rules set's, else the app's own (mc-54). The app's own five are Describe, Question, Act, Test, Resolve (mc-54b); a rules pack's steps keep its own names (mc-60a) | S2; SW |
| A step is a tap only where a pack carries text (mc-55); no heading; words under the icons on a tablet, icons only on a phone (mc-56); the default icons, and a step with none shows its number (mc-60); centred on its row (ds-11) | S2; S35 |
| In turn modes the hour track once replaced the strip; mc-53 puts the strip on every Scene: see "Not settled" | 05; S2 |

## Reminders, tables and the ⋯ menu

| Ruling | Source |
|---|---|
| "+ Reminder" sits by the turn area with one small icon a reminder (B9); one reminder card for what is due (4 lines, then "N more") | 05; 06 |
| The hour track: one row of pips for the hour's turns, symbols on future pips for checks, rest, effects ending and the first light to run out; players see only public events | 05; 06 |
| The Scene's "Encounter tables" row opens "Which table?"; "Tables" is the table library with its pins, per session | 05; 06 |
| ⋯ on the Scene holds: Encounter check; Advance by…; End expedition; End session; Make camp; Travelling in darkness; special seasons' switches; Out and about today and Active tonight; Start and End downtime. Each with its own icon | 05; 06 |
| "Leave the dungeon" is a quick button beside Undo when the pack's rule is on | 05; 06 |
| "N waiting, Players" is a quiet line under the turn area (C5); the GM's Players tab already reads "Players, N waiting" | 05; 06 |
| Working panels stay in the page with their space reserved and collapse when empty | 06 |

## The marching order card

| Ruling | Source |
|---|---|
| Party circles in ranks: a portrait or initials (two letters where they clash); a held circle takes the Selected wash and lifts; statuses under the name, each a symbol with its word (on a phone, in a rank of three, the word drops); NO hit points on the circle: hit points show beside the formation as pips; a lit circle's halo is still, with its own token (mc-1 to mc-6) | SM, 2026-11-11 |
| Rows of 1 to 3; hold to move; a tap opens the overview, limited to what the viewer may see; hit points by "Show each other's HP" | 05; 06 |
| At the bottom right of every Scene, under the map; no "You" tag anywhere (ds-12) | S35 |
| The caller is a banner with flourishes at its head, "Caller" and the name; a tap changes it (mc-76) | S35 |
| Saved orders; the GM's lock (a toggle, ds-1); players reorder when the campaign allows; one order per group of a split party | 05; 06 |
| A dark group's tiles read "No light" | `m5b-g6-rest-and-table-view.md` |

## Standards that bind all of it

One accent button; no disabled buttons; no explainer lines (mc-46); toggles as ds-1a to ds-1c, and a pair of opposite actions is a toggle; eyes as ds-2; die glyphs wherever a die is named (ds-3); icons medieval or fantasy from the one set (ds-5, ds-6); a sheet closes by its ✕ (ds-9); the stacked button for a row's action (mc-36a); a fact's value never wraps; working panels collapse when empty; 44 px targets, nothing under 14 px; the phone a distant third (mc-9).

## Not settled (each needs a drawing and Francis's ruling)

- What the top shows with no session, paused, between expeditions, in town, in downtime and in a fight: only the turn at a place is drawn.
- Homes for what today's top has and the drawing drops: Start and Resume session; "+ Reminder" and the reminders' icons; the hour track's pips; the "Encounter tables" row and "Tables"; "Set date" and "Set start time"; "Started at…"; "Leave the dungeon"; "N waiting, Players".
- The Light fact when there is no light, and for a split party.
- Whether the Weather fact replaces today's weather card, and where the roll is entered.
- The GM's phone top.
- "Session N" as a heading and the region's name in it: drawn, never ruled in words.
- Whether the strip and the hour track both show in turn modes.
- The marching order's hit points: mc-4 says pips beside the formation; frame R1 draws hit points under each circle.

## Stale spec lines (to fix in one docs pass)

`05` and `06` still describe: a Day / Night switch; a long press for +N; the weather card folding by itself after 8 seconds; a "You" label on the marching order; name tiles in place of circles; the arrival card; "Set time" on the main advance.

## Two ids that clash

The Player screen rulings of 2026-11-14 used `sb-2` (the stacked button) and `tg-1` (pairs are toggles). Both ids already existed for other rulings (stat-block labels; a testing rule). They are renamed in the next docs pass.
