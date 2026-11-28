---
status: approved at sitting B, 2026-11-28; tickets #200-#209 (parent #198); rulings sb4-1 to sb4-5 (docs/design/rulings/scene-pack-b-2026-11-28.md); pieces K to P approved at a short sitting B the same day: tickets #212-#217, rulings sb4-6 to sb4-10 (same file); piece Q added at loop 3's sitting C the same day (dgc-5, dgc-6, dgc-8, dgc-14): tickets #228 and #229, rulings sb4-11 to sb4-14 (same file)
loop: 4
rulings: docs/design/rulings/loop4-scene-pack-2026-11-28.md (l4-1 to l4-6; 09, 2026-11-28); the rows' own rulings stand as written: sf-6b, sf-10, sf-11, sf-13, sf-14, sf-18, sf-21, sf-24, sf-27, sf-5 and its three ⚑ (docs/design/rulings/scene-feedback-2026-11-25.md); p45-1 to p45-29 (docs/design/rulings/page-45-find-flow-2026-11-26.md); #158 ⚑ 4 (09, 2026-11-28); ap-6 (2026-11-14); dg-10, dg-12, dg-16, dg-19 (docs/design/rulings/dec5-gaps-2026-11-28.md); dgc-5, dgc-6, dgc-8, dgc-14 (docs/design/rulings/dec5-gaps-c-2026-11-28.md), piece Q
intents: docs/intents/scene-feedback-2026-11-25.md (the Scene rows); the Pack rows come from the pack rework's rulings (pk-5, 2026-11-11) and have no intent file
plans left: docs/plans/dec-scene-feedback.md (sf-6b, sf-13, sf-10, sf-11, sf-18, sf-14); docs/plans/dec-6-the-whole-pack-tab.md (K19b, K18c, K18e, K18d); both keep the rows for the record only
mockups: december/44-scene-feedback-of-25-november.html, frames 44-5 (DT1), 44-6 (DT2), 44-7 (TR1's pieces), approved 2026-11-26 and approved as redrawn to ⚑ 9 the same day; 44-12 (PS1), 44-13 (PS2 A, C, D), 44-14 (PS3 A, B), 44-15 (KN1), 44-16 (ET1), 44-1 (EN1), approved 2026-11-26. december/45-the-pack-tab-find-flow.html, frames 45-2 (FD1b), 45-3 (FD1c B, C), 45-4 (FD2), 45-5 (FD2b), 45-15 (FD7), 45-20 (FD10), 45-21 (FD10b), approved 2026-11-26 (p45-1, p45-29). december/50-what-a-person-carries.html, approved 2026-11-28 (dg-19), the newer frame for a person's piece. december/51-the-find-card-on-the-player-tab.html, 51-1 A and 51-2 A, approved 2026-11-28 (l4-6). Page 08's PK2b (pack/08-the-pack-tab-whole.html), approved 2026-11-14 (ap-6). Pictures under each page's png/ folder
order (l4-1): the needed rows first, sf-6b, sf-13, K18c, K19b, K18e, and K18d (built); then sf-10, sf-11, sf-18, sf-14. If time runs short, cut sf-14 first, then sf-18. Pieces K onward (the build's own tools, added 28 Nov) come after the needed rows (sb4-6)
---

# Spec: the Scene's and the Pack's remaining rows

Loop 4 of the build loop. Francis moved ten rows out of two plans into the loop (28 Nov: "No, we use the loop, include the optional scene rows"; "Loop is not optional."). Six are the Scene's, from his feedback of 25 November (page 44). Four are the Pack's find flow (page 45). He held sitting A the same day and ruled every ⚑ (l4-1 to l4-6), and approved page 51.

Every row is visible and has an approved frame. None changes what is stored or who may read it: no migration, no new command, no new permission case. One row, K18d, is already built on its branch; it joins the loop as it stands. Pieces K to P, added after sitting B, are the build's own tools and show nothing (Implementation Decisions, Pieces K onward).

## Problem Statement

**The GM's place card hides what the book says.** A piece that names a creature or a thing ("Three ferrymen mend a sail") does not show that creature's stat line or that thing's rule. The GM opens "From the book, for the GM" and hunts. The same stat line can stand there three times, and a machine id can show where a name should.

**A place's Knowledge leaves out its Area's.** At a Location the GM sees only what the book wrote for that one place. What the book wrote for the whole Area sits at the Area. Each section's eye is on the row that folds, so a slip beside the fold shares a section, and nothing says how far a share reaches.

**The players' Scene is long and fixed.** "What everyone knows" and "Rules" sit in a card at the right, apart from the place they belong to. The players' top cannot fold away, as the GM's can, so on a phone the place starts low.

**The folds have four marks.** The GM's band folds by "−" and "+", which read as "add". The band's three marks have no words, even on a wide screen with room for them.

**The encounter tables' pages are not the book's.** A page opened from "Encounter tables" draws its rows in an older style. A tapped row is not marked, and its toast can quote a number nobody entered.

**A find goes unseen away from the Pack.** The card that says "New in your pack" shows only on the Pack tab. On the Player tab or the Log, a player does not know something arrived. The Pack's icon carries no count. A thing the GM sends to the party stash tells nobody.

## Solution

| # | Row | What people see | Approved frame | Rulings |
|---|---|---|---|---|
| 1 | sf-6b | On the GM's place card each stat line or item line stands once: on the piece that names it, in full, under the piece's GM-only label; else in "From the book, for the GM". The label under a shown piece reads "Only you see these details."; under a hidden piece, "Only you see this." | 44-5, 44-6, 44-7 (2026-11-26, as redrawn); 50 for a person's piece (2026-11-28) | sf-6b, ⚑ 9, sf-24, l4-2, dg-10, dg-19 |
| 2 | sf-13 | A Location's Knowledge shows its own sections under its name, then its Area's under the Area's name. A folded section has no eye; an unfolded section's heading carries its eye. The line says how far a share reaches | 44-15 (2026-11-26) | sf-13, sf-21 |
| 3 | sf-10 | On the players' Scene, "What everyone knows" and "Rules" stand under the place's name, in the main column; at 375 px side by side | 44-12, 44-14 A (2026-11-26) | sf-10 |
| 4 | sf-11 | The players' top folds as the GM's does: the facts and the strip go, the band stays, a due fact keeps one small line | 44-12, 44-13 A, 44-14 A, B (2026-11-26) | sf-11, dg-3 |
| 5 | sf-18 | One fold mark, a chevron, on every Scene top. From 1180 px the band's marks carry their words | 44-13 A, C, D, 44-1 (2026-11-26) | sf-18 |
| 6 | sf-14 | Every page opened from "Encounter tables" draws the book's tapped table. A tapped row is washed and ticked, and its toast names the row's range | 44-16 (2026-11-26) | sf-14, sf-5 and its ⚑ 3, N2 |
| 7 | K19b | The count on the Pack's icon, on the rail and the tab bar, from every tab, for the character's own player only | 45-15 (2026-11-26) | p45-10, #158 ⚑ 4 |
| 8 | K18c | The find card on every tab but the Scene and the Pack: first in the right column on a tablet (before the notices box on the Player tab); above the tab's content on a phone (above the head on the Player tab) | 45-2, 45-3 B, 45-20, 45-21 (2026-11-26); PK2b (2026-11-14); 51-1 A, 51-2 A (2026-11-28) | p45-2, p45-13, p45-19, l4-3, l4-4, l4-5 |
| 9 | K18e | A thing the GM sends to the party stash is told to every player by a toast that goes by itself: no Undo, no card, no count, no tag | 45-4, 45-5 (2026-11-26) | p45-1, ap-6 |
| 10 | K18d | Built: the find card in the Scene's prompt slot, after the rest and light prompts, before a call card, at every width | 45-3 C (2026-11-26) | p45-3, p45-23 |

## User Stories

**Details at hand on a place's card (sf-6b)**

1. As a GM, I want a piece that names a creature to carry that creature's stat line under it, so that I read the figures where the piece stands.
2. As a GM, I want a piece that names a thing to carry that thing's rule under it, so that I know what it does before I send it.
3. As a GM, I want each stat line or item line printed once on the card, so that three ferrymen don't fill the card with three copies.
4. As a GM, I want the second name that uses the same line to get the short row ("Same stat line as the Ferryman."), so that I see it is the same block without reading it twice.
5. As a GM, I want a named character with a stat block of their own to keep their own full line, so that their figures are never a pointer to someone else's.
6. As a GM, I want every line no piece names to stay in "From the book, for the GM", under "Stat lines" and "Items", so that no row is lost.
7. As a GM, I want the heading to read "Stat line" over one row and "Stat lines" over two or more, so that it reads right.
8. As a GM, I want the fold to say "The other stat lines and the items are on their own rows." where pieces carry lines, so that I know where they went.
9. As a GM, I want a fold whose every line is on a piece to end with its quiet line alone, so that it shows no empty group.
10. As a GM, I want "From the book, for the GM" to stay whole and to have no eye, so that nothing of it can be sent.
11. As a GM, I want "Only you see these details." under a shown piece's GM-only row, so that I know the players see the piece's words but not the row under it (l4-2).
12. As a GM, I want "Only you see this." under a hidden piece, so that I know none of it has reached the players.
13. As a GM, I want a tap on any detail row, long or short, to open its one pop-up, so that the whole block is one tap away.
14. As a GM, I want a name, never a machine id, on every row, so that the card speaks the table's words.
15. As a GM whose pack lacks a creature or thing a piece names, I want "Not in your packs: <name>", so that I know why the line is missing.
16. As a GM, I want a person's piece to keep page 50's "Carries: …" line in its place beside the detail row, so that the two rows agree (dg-10).
17. As a GM on a phone, I want a stat line to wrap only between a label and the next, so that a figure never parts from its word.
18. As a GM, I want the card never to say "piece" to me, so that the app's word stays out of the table's (sf-24).
19. As a player, I want never to receive a detail row or the fold, so that the book's figures stay the GM's (hard rule 5).

**Knowledge (sf-13)**

20. As a GM at a Location, I want its own knowledge under its own name, then its Area's under the Area's name and one quiet line, so that I read both without moving.
21. As a GM at a Location with nothing of its own, I want one line saying "Nothing written for this place alone.", then the Area's knowledge, so that I know it isn't missing.
22. As a GM at a place with neither, I want one line that says so, so that the sheet is never blank.
23. As a GM, I want a folded section to be one row with the chevron and no eye, so that a slip beside the fold shares nothing.
24. As a GM, I want an unfolded section's own heading to carry its eye, so that I share the section I am reading and no other.
25. As a GM, I want the line before a share to say how far it reaches ("Not shared. A share reaches the party at every place in The Drowned Harbour."), so that I know before I tap.
26. As a GM, I want the line after a share to read "Shared with the party: all of The Drowned Harbour, turn 9.", so that I know what the party knows.
27. As a GM, I want a place's own section to read the Area's line too, since it reaches the whole Area (sf-21), so that the words are true.
28. As a GM, I want a share at once with Undo, as today, so that a wrong tap is one tap back.
29. As a GM, I want the foot to count the sections shared, so that I see the total at a glance.
30. As a player at any place of the Area, I want a section shared at another of its places, so that what my party learned stays known.
31. As a player, I want no section the GM didn't share, and none of the GM's bold facts, so that hidden stays hidden.

**The players' Scene (sf-10, sf-11)**

32. As a player, I want "What everyone knows" and "Rules" under the place's name, so that they sit with the place they belong to.
33. As a player on a phone, I want the two side by side, as two stacked buttons of one width, so that they take one row, not two.
34. As a player, I want "What everyone knows" to keep to one line in its half, so that it reads as a button.
35. As a player at a place with nothing shared and no rule, I want no empty row, so that the screen stays calm.
36. As a player, I want the right-hand card to list only "Places you know", so that the place's own things aren't in two places.
37. As a player, I want to fold the top away as the GM can, so that the place and "Where to?" start higher on my screen.
38. As a player with the top folded, I want the band to stay and a due fact to keep one small line with its sign, so that I miss nothing due.
39. As a player, I want "None here" (page 48's tile) to fold away with the other facts, since it is a fact and not a due one (dg-3), so that the fold stays short.
40. As a player, I want my device to remember the fold, so that it opens as I left it.
41. As a player, I want my fold to be my device's own, so that folding it never changes another person's screen.
42. As a player on a phone, I want a third tile to take the row's whole width, so that it never reads as a slip.
43. As a player, I want the encounter tile to carry the crossed swords and read as the GM's does, so that we read the same fact.

**One fold mark and the band's words (sf-18)**

44. As a GM or a player, I want one fold mark, a chevron, down while folded and up while open, so that a fold never reads as "add".
45. As a GM, I want the band's chevron after a thin rule, apart from the actions, with "…" still last, so that the fold isn't taken for an action.
46. As a GM on a wide screen (1180 px and wider), I want "Camp", "Encounter" and "Leave" under their marks, as stacked buttons, so that I don't have to learn the icons.
47. As a GM at 1024 px or on a phone, I want the marks alone, as today, so that the place's name and its turn keep to one line.
48. As a GM using a screen reader, I want each mark named by its word at every width, and the fold named "Fold the top away" or "Show the top" with whether it is open, so that the band is usable without sight.

**The encounter tables' pages (sf-14)**

49. As a GM, I want every page opened from "Encounter tables" to draw the book's tapped table, so that it looks like the roll's pop-up I already know.
50. As a GM, I want the die over its column and banded rows 44 px high, so that I find and tap a row at the table.
51. As a GM, I want a tap on a row to be the answer, so that I don't type a roll.
52. As a GM, I want the tapped row washed and ticked, so that I see which row I picked.
53. As a GM, I want the toast to name the row's range and its words ("15–16: Two bog lurkers…"), with Undo, so that I see what I picked and can take it back.
54. As a GM, I want the toast never to quote a number nobody entered, so that it never invents a roll.
55. As a GM, I want a d100 table's "Go to number" as the pop-up has it, so that a long table is one jump.
56. As a GM, I want the row's other tables as chips over it, and a table's column chips where the pack prints columns, so that nothing the page does today is lost.
57. As a GM on a tablet, I want the table capped at 640 px, so that a row's range and words stay close.
58. As a GM on a phone, I want a long row to wrap, never cut, so that I read the whole result.

**The count on the Pack's icon (K19b)**

59. As a player, I want a count on the Pack's icon, on the tablet's rail and the phone's tab bar, so that I know something arrived from any tab.
60. As a player, I want no mark at all when nothing is new, never a "0", so that the bar stays quiet.
61. As a player, I want "99+" past 99, while the card and the Pack say the true number, so that the mark keeps its size.
62. As a player, I want the count to count things, not units (a stack is one, a send's coin is one), so that it matches the card's lines.
63. As a player using a screen reader, I want the tab read as "Pack, 12 new", so that I hear what the mark says.
64. As a player, I want the same count on the Pack tab and off it, so that it never changes as I move.
65. As a player, I want "Got it" on any tab to clear the count, so that one tap ends the news.
66. As a player, I want a find taken back by the GM before "Got it" to leave the count, so that the count never counts what I don't have.
67. As a GM viewing a player's screen, I want no count, no card and no tag, so that the player's news stays theirs (#158 ⚑ 4).
68. As another player, I want no count for a find to someone else, so that my bar counts only my own news.

**The find card on every other tab (K18c)**

69. As a player on a tablet, I want the card at the head of the right column on every tab, so that it is always in one place and the left column never moves (p45-2).
70. As a player on the Player tab on a tablet, I want the card first in the right column, then the notices box, then Scores, so that news comes first (l4-5).
71. As a player on a phone, I want the card above the tab's own content, so that I see it at once.
72. As a player on the Player tab on a phone, I want the card above the head, even with a long name, so that the rule is the same on every tab (l4-4).
73. As a player, I want the card to arrive behind an open pop-up or sheet, with no toast, so that what I am typing is untouched (p45-13).
74. As a player, I want the scroll position to hold when the card arrives, grows or shrinks, so that what I am reading stays under my eye (p45-19).
75. As a player, I want "Got it" on any tab to clear the card, the count and the Pack's tags at once, so that one tap is enough.
76. As a player, I want "and N more" on any tab, the Scene's included, to open the Pack at the new rows, so that I see the rest in one tap.
77. As a player, I want "just now" under an hour, a card that never names my character, lines that are not taps, and a second find onto one stack as one line, as built (l4-3), so that the card stays as approved.
78. As a player offline, I want the card's offline box after a tap on "Got it", so that I know it waits.
79. As a player whose "Got it" fails, I want the card kept under "Couldn't mark these as seen.", so that nothing is lost.
80. As a player, I want a find sent while my screen is open to show without a reload, so that the card is live.

**The party stash's quieter toast (K18e)**

81. As a player, I want a toast "Your GM put Lamp oil ×8 in the party stash." when the GM sends a thing to the stash, so that the whole party knows.
82. As a player, I want that toast on whatever tab I am on, so that I don't have to look.
83. As a player, I want it to go by itself, with no Undo, so that I am not offered to undo the GM's act.
84. As a player, I want no card, no count and no "New" tag for the stash, so that only my own finds are news to me.
85. As a player with a find card showing, I want the toast and the card both, not touching, with the count still the card's, so that neither hides the other.
86. As a player on a phone, I want a long name and ×999 to wrap in the toast and never be cut, so that I read it whole.
87. As a player, I want the toast to name the things as they appear, as the log's line does, so that it never tells me what an unidentified thing really is.

**The find card in the Scene's prompt slot (K18d, built)**

88. As a player on the Scene, I want the card in the prompt slot, after the rest and light prompts and before a call card, at every width, so that the Scene keeps its place (p45-3, p45-23).
89. As a player with a find card and a call both due, I want the find card first and the call after "Got it", so that one card shows at a time.

**Everyone**

90. As anyone, I want every new tap at least 44 px with 8 px between, so that it works at the table.
91. As anyone, I want each screen right at 375 px and at a tablet's width, in light and dark, with Larger text, long names, 0 and 999, so that every device works.
92. As Francis, I want each built screen shown beside its approved picture in the pull request, so that I approve it by sight.

## Implementation Decisions

**Pieces, for the tickets.** One row is one ticket, except sf-6b, which is two (the rule, then the card), as its plan sized it. Rows that share a module go one after the other, never side by side.

| Piece | Ticket | Row | What | Shares a module with |
|---|---|---|---|---|
| A | #200 | sf-6b | The rule: a pure function that decides, for one place, where each stat line and item line stands | loop 3's dg-10 (see Further Notes) |
| B | #205 | sf-6b | The card: the piece rows and the fold drawn from A, with l4-2's two labels | A; dg-10 |
| C | #206 | sf-13 | Knowledge: the Area's sections, the eye per unfolded section, the share lines | the place card's folds (B) |
| D | #202 | K19b | The count on the Pack's icon | E (the Player screen) |
| E | #207 | K18c | The card on every other tab; the Scene's "and N more" wired | D (the Player screen) |
| F | #208 | K18e | The stash's toast | E (where the Player screen hears of a send) |
| G | #201 | K18d | Built on `dec6-fd-scene-slot` (5824b38); the driver merges it into the integration branch as it stands | E (its "and N more") |
| H | #203 | sf-18 | The chevron and the band's words | I (the band's stylesheet) |
| I | #209 | sf-10, sf-11 | The players' Scene: the pair under the place, the players' fold | H |
| J | #204 | sf-14 | The tables' pages in the tapped table | sf-5's pop-up (built) |
| Q | #228, #229 | dgc-5, dgc-6, dgc-8, dgc-14; sb4-11 to sb4-14 | Loop 3's follow-up on a person's things: "Sent before" opens the thing's sheet with Take it back; the pack's capitals; "You" on the GM's log; her name in the words | B (#205): `personHolds.ts`; F (#208), if it touches the find's log line |

**No migration, no command, no permission case.** No row writes a new kind of row or opens a new read. sf-13's share is the built `placeKnowledge.eye`, and a player's read of an Area's section is the built `knowledge_for_players`, which already reads the places a place sits in (sf-21). The find card, the count and the stash's toast read what a player can already read: the character's seen mark and lines, and the party's log lines.

**How a send reaches a screen that is already open (read for this spec, 28 Nov).** The plan's caveat said this was never read. What the code does today: every campaign screen sits inside the campaign log's provider. It listens on Supabase Realtime for new event rows of the campaign (the database's read rules decide who hears which), and for a few row tables players follow directly. After a burst settles (400 ms) it raises the log's version by one. Every screen that reads with that version reloads in place. It also reloads when the device comes back (visible, focused, online). The Pack's card (K20b) and the Scene's (K18d) already arrive this way, and their tests prove it through the stand-in database. So K18c, K19b and K18e need no database change.

**Piece A: where a line stands (sf-6b, ⚑ 9 "Home Two's fix")**
- One pure function takes a place's pieces, the names each piece's words point to (the place reader's own links), and the pack's stat lines and items for that place. It returns, for each piece, the detail rows it carries, full or short, and the rows left for the fold.
- The rule: a line a piece names stands on that piece, in full. A line no piece names stands in the fold, in full. The same line a second time anywhere on the card is the short row: the name, and one quiet line where it is another name for the same block ("Same stat line as the Ferryman."). A named character with a block of their own keeps their own full line. Nothing twice; no row dropped: the rows in equal the rows out.
- Rows are keyed by the identical line, not by the name, so two names with one block give one full row and one short.
- Each row is a detail row (`BookDetail`), built by the place reader's names (`creatureWords` and its kin). A machine id never reaches the screen; a name the packs lack reads "Not in your packs: <name>".

**Piece B: the card (sf-6b, sf-24, l4-2)**
- The place page's piece row (`PieceRow`) draws, under the piece's GM-only label, the piece's detail rows from A, each a `BookDetailRow` (sf-6a's part, unchanged). A tap on any row opens its one pop-up.
- The label is one of two words, by the piece's eye: shown, "Only you see these details."; hidden, "Only you see this." (l4-2). Where the label is drawn as the GM's line, it uses the existing part (`GmLine`) or a named variant of it in 06, not a copy.
- The fold (`BookTextFold`) ends with only the rows A leaves for it, under "Stat line" or "Stat lines" (by count) and "Items". Where pieces carry lines, its quiet line reads "The other stat lines and the items are on their own rows.". A fold with nothing left shows its quiet line alone. The fold keeps no eye (F17) and stays whole (F18).
- A person's piece keeps dg-10's "Carries" line (page 50) under the same label; on a phone above the stat line, on a tablet after it (dg-19's finding 5).
- Sitting B (sb4-4): a shown person piece's "Carries" line goes under "Only you see these details." (l4-2 over page 50).
- Nothing here is sent: the rows move only where the GM reads a line. A piece's eye still shows only the piece's own words.

**Piece C: Knowledge (sf-13, sf-21)**
- The place's facts for a Location (`placeFacts`) gain its Area's sections, kept apart from its own.
- The Knowledge sheet draws the place's own sections under the place's name as a heading, then the Area's under the Area's name and one quiet line. A Location with nothing of its own: "Nothing written for this place alone.", then the Area's. Neither: KN1 C's one line.
- A folded section (`SectionFold`) is one row with the chevron and no eye. Unfolded, its heading carries its eye.
- The share line (`sharedWithLine`) says "the party", not "the players". Before a share: "Not shared. A share reaches the party at every place in <Area>."; after: "Shared with the party: all of <Area>, turn N.". A place's own section reads the Area's line (sf-21, a word change; KN1 B's "at 2. The Wreck only" is not built).
- One section, one eye, one share: sharing writes one share for that section, wherever the GM stood. No eye shares more than its own section. The share is at once with Undo, as built. The foot counts sections shared.

**Piece D: the count (K19b, p45-10, #158 ⚑ 4)**
- The Player screen reads what is new for its character once (the built read under the Pack's card, `readPackFinds` and `findsCount`) and gives the count to the section nav's badge on the Pack's tab, in both the tablet's tabs and the phone's.
- The badge is the nav's own (`SectionNav`: none at 0, "99+" past 99). Its spoken name reads "Pack, 12 new" (FD7). The mark's place on the icon is FD7's; the nav's stylesheet changes only if the built mark differs.
- The read is the character's own player's only. In the GM's view as the player, and for another player, there is no read and no badge.

**Piece E: the card on every other tab (K18c, p45-2, p45-13, p45-19, l4-3 to l4-5)**
- The Player screen draws K18b's `FindCard` from the same read as D, on every tab but the Scene and the Pack (both have their own: K18d, K20b).
- On a tablet: first in the right column. On the Player tab that is before the notices box (the `player__notices` slot) and Scores (l4-5, 51-2 A).
- On a phone: above the tab's own content. On the Player tab that is above the head, even with a long name (l4-4, 51-1 A).
- "Got it" is the built mark (`markFindsSeen`, through the Pack's read), then the log's reload, so the count, the Pack's tags and the Scene's card follow. Offline, FD9's box; a refusal, the card under "Couldn't mark these as seen.".
- The card arrives inside a status region kept on the page, behind any open pop-up or sheet, with no toast. The page keeps the reader's scroll position (the Pack's `anchorIn` hold, or the same idea).
- "and N more" opens the Pack at its new rows, from every tab. This piece also wires the Scene's: the Player screen passes the Scene its open-the-Pack hook (`onOpenPack`, K18d's), so "and N more" there works too (K18d's one departure).
- One read for the Player screen: the Scene's own read (K18d's `useSceneFinds`) may move onto it if that is simple; K18d's tests stay green either way. The builder decides.

**Piece F: the stash's toast (K18e, FD2, FD2b)**
- A player's screen hears of a GM's send to the party stash by the same path (the log's version). It then reads the new log entries it may read, finds each `find.give` whose find goes to the stash (`to` null), and raises one toast per send it has not yet told on this screen.
- The words come from one pure function: "Your GM put <things> in the party stash.", the things listed as the log's line lists them (each as it appears, a stack with ×N, coin as the log says it), with no place. It never names what an unidentified thing really is.
- The toast is the shared toast in the ruled dress (tr-1, tr-11, tr-12): it goes by itself, with no Undo. It raises no card, no count and no tag.
- The GM's own screen raises none (the GM's send has its own toast, with Undo, as built). Only a GM's send counts: a player's "Put in" raises none.
- A long name and ×999 wrap and are never cut.
- Sitting B (sb4-1 to sb4-3): no toast for a send made while the app was closed or offline; the toast replaces any toast showing, as tr-7 rules (the player's Undo stays in the Log); the GM's Undo of a send goes to the Log only, with no toast.

**Piece G: the Scene's slot (K18d, built)**
- As its `pr-text.md` says: K18b's card in the calls' one place in the prompt slot (`CallsInPromptSlot` gains a `find`), one live region, focus to the waiting call's "Got it", no calls group around a find card alone, "Got it" writing the mark once with no toast. The card is for the player's own active character among the Scene's marchers. The GM's view and another player's Scene draw none.
- One known departure for another ticket: "and N more" does nothing until the Player screen passes `onOpenPack`. Piece E wires it.

**Piece H: the fold mark and the band's words (sf-18)**
- The band's fold button draws the chevron (down while folded, up while open) in place of "−" and "+". On the GM's band it stands after a thin rule; "…" stays last. Its name stays "Fold the top away" or "Show the top", with its expanded state.
- From 1180 px wide each of the band's three marks has its word under it ("Camp", "Encounter", "Leave"), as the shared stacked button. Narrower, the marks stand alone, as built, named by their words.
- The 1180 px line is one named value in the stylesheet, not a number repeated (◈ widescreen stays open in `10`).

**Piece I: the players' Scene (sf-10, sf-11)**
- sf-10: the players' place card (`PlayersPlaceCard`) draws "What everyone knows" and "Rules" under the place's name, in the main column, as stacked buttons. At 375 px they stand side by side at one width. Each shows when it has something, as today; with neither, the row is left out. They leave the right-hand card, which keeps "Places you know".
- sf-11: the players' top gets the band's fold (H's chevron). Folded: the facts and the strip go, the band stays, a due fact keeps one small line with its sign (the band's `dueWords`). "None here" folds away (dg-3). The fold is remembered on the device (as `sceneTopOpen` does for the GM) and sends nothing.
- At 375 px a third tile takes the row's whole width.
- Sitting B (sb4-5): with only one of the pair to show, it stands alone at half the row's width, at the leading edge.

**Piece J: the tables' pages (sf-14, sf-5)**
- The page's rows (`EncounterTables`' `TableRows`) are drawn by the shared tapped table (`BookTapTable`), as sf-5's pop-up (`TableRollPopUp`) draws them: the roll row, the table's name on its bar, the die over its column, banded rows 44 px high.
- A tap on a row is the answer, logged, with Undo. The tapped row is washed and ticked. The toast is sf-5's form: the range, a colon and the row's words ("15–16: Two bog lurkers…"), never "Rolled:" and never a number nobody entered.
- "Go to number" as sf-5's ⚑ 2 built it (more than 20 numbers, or more than 20 rows). The row's other tables stay chips over it; column chips stay only where the table has columns. The page keeps its back link and "Rolled by hand". Capped at 640 px.
- Every row shape 07 allows still shows its words (a lookup's key, cells, items). If the tapped table needs a variant for this, it is named in 06's Components, not copied.

**Pieces K onward: the build's own tools (added 28 Nov)**

Francis added these to loop 4 on 28 Nov ("Yes", to "add #210 and the retro items to loop 4, built after its needed rows"): the fonts helper (#210, the retro's item 4) and the five retro items of loop 2 not yet briefed (1, 2B, 3, 5, 6; 2A merged in #195). None is visible to a player or GM: tests, scripts, skills, briefs and docs only. Each says "none: data and logic only". They change no stored data, so each is Claude's to build (technical ownership), within the ⚑ below. Source: the loop 2 retro (28 Nov), and #210's own text.

| Piece | Ticket | Retro | What | Files' kinds | Who edits | Shares a file with |
|---|---|---|---|---|---|---|
| K | #217 | 4 (#210) | The layout harness's font wait without the new stalls | tests (`tests/fails.ts`, layout specs' imports) | a builder; Home One runs WebKit | the layout specs sf-10, sf-11, sf-18, sf-14 touch; waits for every row (sb4-6) |
| L | #212 | 1 | A spec names every existing part it relies on, with where it lives in the code | the driver's agent file, `.claude/agents/driver.md` (sb4-8) | a docs-only worker, as P | P (`.claude/agents/driver.md`) |
| M | #213 | 2B | Time a second check slot | `/tmp/ogham-check-times.log`, `.claude/README.md` | the driver, then a 09 line | none |
| N | #214 | 3 | A builder waits for its commit's end line before it reports | `.claude/briefs/builder-brief.md` | a docs-only worker | none |
| O | #215 | 5 | A script that commits gallery pictures from a run, and a CI check on the gallery line | `scripts/` (a script and its test), `.github/workflows/check.yml`, `docs/testing.md` | a builder | none |
| P | #216 | 6 | The driver's merge step lists the build's rulings for docs-sync | `.claude/agents/driver.md` | a docs-only worker | L (sb4-8) |

**Piece K: the fonts helper (#210)**
- #210 (Home One's draft, branch `tests-fonts-ready-helper`) waits, on every layout and gallery page, until React has drawn into `#root`, then loads the page's fonts. Its run showed 4 stalls of 30 s waiting for `#root > *` after the change, against 1 before; each passed when run again alone. Its point 4 names the next step: a longer wait for the first draw, or a reload when the page stays empty.
- The piece: find the stall's cause, reproduce it before proposing one (`superpowers:systematic-debugging`), fix it, and show the numbers. Test-only (rule A, a non-`fix-` branch): nothing under `src/` changes.
- It starts from #210's branch brought up to `main`; the driver merges it into the integration branch like any ticket, and #210 closes for the spec's pull request.
- Done: the whole layout suite with `--workers=2`, before and after, in WebKit (Home One) and Chrome, in #210's table form; failures and stalls no more than before in each browser (WebKit 6 failed, Chrome 1, with 1 stall); the time against before (sb4-7).
- Sitting B (sb4-6, sb4-7): K runs after the needed rows and waits for every row of loop 4; a cost up to about +5% (WebKit) and +11% (Chrome) on the whole layout suite is accepted, said in the pull request.

**Piece L: the spec names what it relies on (retro 1)**
- In loop 2, four builders stopped before code because the spec assumed a part that did not exist (a death panel, a toast and Undo, a stored total).
- The piece: a completion step for the spec. Every existing part, command, field or words the spec relies on is named with its file in the code; anything not found becomes a ⚑ for sitting B, before tickets. A `scout` (Haiku) does the lookup.
- Sitting B (sb4-8): the step lives in the driver's loop (`.claude/agents/driver.md`, The loop): a scout looks up each named part before sitting B; the `to-spec` copy is untouched.
- Done: the step written in `.claude/agents/driver.md` (The loop). `docs:check` passes.

**Piece M: time a second check slot (retro 2B)**
- `.claude/README.md` (Workers, The check slot) already allows `OGHAM_CHECK_SLOTS=2` as a trial: "time it, and keep it only if it gains time". Seats says one heavy job at a time in a cloud session.
- Sitting B (sb4-9): the trial runs on Home One (the PC) only, under the PC's memory rule.
- The piece: run the loop's later commits on Home One with two slots, and compare each commit's wait and run time (`/tmp/ogham-check-times.log`) with the one-slot commits of loop 4's needed rows.
- Done: a table of both, a 09 line that keeps or drops the second slot with its numbers, and `.claude/README.md` brought in line. No code.

**Piece N: a builder waits for its commit's end line (retro 3)**
- In loop 2 a builder ended its turn with its slot commit still queued in the background; one run was left orphaned, and one docs commit died at the background limit.
- The piece: the builder brief's commit step says to queue the commit in the background with the longest timeout, then wait with Monitor until `/tmp/ogham-check-times.log` shows that run's `end … rc=` line; the report waits for that line and quotes it.
- Done: `.claude/briefs/builder-brief.md` changed (its commit and output lines); `docs:check` passes.

**Piece O: gallery pictures from a run, and one gallery line (retro 5)**
- In loop 2 a worker committed `main`'s old pictures in place of the run's; and the spec's assembled text carried 10 gallery lines. `scripts/ci-redraws.mjs` (`announcedPictures`) reads every line that carries the words; `docs/testing.md` (Announced redraws) asks for one.
- The piece, a script: from a run id, fetch its gallery-baselines artifacts, commit the named pictures over `tests/layout/gallery-baselines/`, refuse a picture identical to `main`'s, and print each picture's size.
- The piece, a check: CI fails when a pull request's text has more than one "Gallery pictures expected to change" line.
- Sitting B (sb4-10): CI fails such a pull request.
- Done: both with their tests; `docs/testing.md` (The component gallery, Announced redraws) names the script and the check; `npm run check` passes.

**Piece P: the build's rulings for docs-sync at the merge (retro 6)**
- In loop 2, 05 still described two rows as before the rulings made during the build (lc-3 leaves that to the design agent after the merge).
- The piece: the driver's merge step for a spec's pull request lists every 09 line dated inside the loop, for the design agent's docs-sync, within the hour of the merge.
- Done: `.claude/agents/driver.md` (Review and merge) gains the line; `docs:check` passes.

**Piece Q: loop 3's follow-up on a person's things (dgc-5, dgc-6, dgc-8, dgc-14; added at loop 3's sitting C, 28 Nov)**
- Mockup: `december/50-what-a-person-carries.html`, approved 2026-11-28 (dg-19): frame 50-3 (her sheet at another place, "Sent before") and frame 50-1 (a thing's one-thing sheet once sent, with Take it back).
- Files: `src/app/PersonSheet.tsx`, `src/modules/expedition/personHolds.ts`, and the GM's log's find wording (the find's line in `src/core/events.ts`); for #229 also the coin lines (`purse.add`'s and the stash coin's lines in `src/core/events.ts`) and the GM's give toast (`gmGaveWords`, `src/app/PurseSheet.tsx`), sb4-14. It follows #205 (piece B): both touch `personHolds.ts` (#205 changes `GM_ONLY_LABEL`) and the person piece's Carries line. It runs beside the other rows, except F (#208) if F's words touch the find's log line.
- dgc-5 (dg-12, frame 50-3, story 68 of `specs/dec5-gaps.md`): each "Sent before" line on her sheet opens that thing's one-thing sheet (TR1's, as a sent row opens it), with where it went and Take it back. Take it back is the built `find.undo` of the send that sent it, wherever she is now, with the built toast and Undo; she carries the thing again at every place. The line is a tap target of at least 44 px, with 8 px between.
- dgc-6: the Carries line keeps each thing's name as the pack writes it: "Carries: Warden's lantern, Iron key." (today `carriesWords` lower-cases the first letter). A sent thing's sentence keeps its built form ("Warden's lantern sent to Wren.").
- dgc-8: on the GM's own log every find line says "You", as the held send's does (dg-16): "You gave Wren …", "You put … in the party stash". A player's lines stay "Your GM gave …" and "Your GM put …". Only the subject changes; the rest of each line stays as built (the article sweep stays owed, `10`).
- dgc-14: her sheet's words name her, not "she": "Couldn't read what Mother Sedge carries. Check your connection and try again."; "One thing Mother Sedge carries isn't in your packs.".
- No migration, no command, no permission case: the send and its Undo are built (piece E of loop 3, `give_find`, `undo_find`).
- Ruled at piece Q's sitting B (28 Nov, each "A"; `design/rulings/scene-pack-b-2026-11-28.md`):
  - sb4-11 (#228): the plural of the missing line names her too: "3 things Mother Sedge carries aren’t in your packs."
  - sb4-12 (#228): the take-back toast keeps the pack's capitals: "Taken back from Wren: Warden’s lantern."
  - sb4-13 (#228): the one-thing sheet a "Sent before" line opens says where it was sent: "Sent to Wren at 4. The Customs Shed, turn 3." A thing sent here keeps "Sent to Wren, turn 3."
  - sb4-14 (#229): dgc-8 widens to the GM's coin lines that are not finds. On the GM's own screen `purse.add`'s lines ("You gave Wren 40 herons", "You put 20 herons in the stash"), the stash coin's line ("You gave Moss 10 herons from the stash.") and the GM's give toast (`gmGaveWords`, "You gave Wren 40 herons") say "You"; a player's keep "Your GM …". Only the subject changes.
- Done: the built screen beside frames 50-1 and 50-3 in `pr-text.md`; 05 (What a person carries) and 06 (Hoard sheet, the person's dress, its Code column) say it as built.

**Docs in the same pull requests.**
- 05 and 06 already carry sitting A's lines (this spec's commit): the find card's places on the Player tab (l4-4, l4-5), the notices box under the card, and the place card's two labels (l4-2).
- 06's Code column for each part touched: Find card (E, F, D), Detail row and Room GM layer (B), Knowledge (C), the band (H), the players' page (I), the encounter tables (J).
- 04 and 07: nothing.
- A builder lists a departure in its `pr-text.md`. The design agent updates this spec after the merge (lc-3).

## Testing Decisions

The three seams Francis approved (28 Nov, "Yes"). There is no database seam: no row changes what is stored or who may read it.

| Seam | What it tests | Prior art |
|---|---|---|
| 1. Pure functions | Which piece shows a detail line, and that it shows once (sf-6b); the order of the Area's sections under the place's own (sf-13); the find count on the Pack icon: the character's own player only, none for the GM (K19b, #158 ⚑ 4); the stash toast's words (K18e); the tapped table's washed and ticked row and the range in its toast (sf-14) | `pieceNames.test.ts`, `placeFacts.test.ts`, `bookDetail.test.tsx`; `placeKnowledge.test.ts`; `findsSeen.test.ts` (`findsCount`), `findCard.test.ts`; `stashWords.test.ts`, `events.test.ts` (the find's log line); `tableRollPopUp.test.tsx`, `encounterTables.test.tsx`, `bookTapTable.test.tsx` |
| 2. One part drawn in a test (Testing Library) | The place card's pieces with "Only you see these details." under a shown piece and "Only you see this." under a hidden one (l4-2); the Knowledge eye; the players' folds (sf-10, sf-11, sf-18); the find card on every tab but the Scene (K18c); a find that arrives while the screen is open, through the stand-in database | `placeCard.test.tsx`, `gmPlacePage.test.tsx`, `editPiece.test.tsx`; `knowledgeSheet.test.tsx`; `playersTop.test.tsx`, `playersPlaceCard.test.tsx`, `sceneBand.test.tsx`, `sceneTopOpen.test.tsx`; `packFinds.test.tsx` (its live arrival: "keeps the empty live region before the first find, and the card arrives inside it"), `sceneFinds.test.tsx` (K18d), `phoneNavigation.test.tsx`, `FindCard.test.tsx` |
| 3. The real screen in a browser (layout checks) | 375 px and tablet width, light and dark, Larger text, long names, 0 and 999; page 51's order (the card above the head on a phone, l4-4; first in the right column, then the notices box, on a tablet, l4-5); the band's words from 1180 px (sf-18) | `detailRow.spec.ts`, `placeRules.spec.ts`; `knowledge.spec.ts`; `playersTop.spec.ts`, `playersPlaceCard.spec.ts`, `scenePhone.spec.ts`, `sceneBand.spec.ts`; `findCard.spec.ts`, `findCardPart.spec.ts`, `sceneFindCard.spec.ts` (K18d), `toastWrap.spec.ts`; `longTables.spec.ts` |

- A good test checks what a person sees or what a function returns, never how a part is built inside.
- Each test's purpose is written first, as a plain sentence.
- Seam 1 for sf-6b holds: a creature a piece names is on that piece and not in the fold; one no piece names is in the fold; a character who uses another's block gets the short row and the block stands once; a character with a block of their own gets their own line; two pieces naming one thing give one full row and one short; a place with every line on a piece has no group in the fold; the rows in equal the rows out; no machine id is in any row.
- Seam 1 for K19b holds 0 (no mark), 1, 12, 99 and 100 ("99+"); a stack is one; coin is one; the GM's view and another player read none.
- Seam 1 for K18e holds a long name, ×999, two things in one send, coin, and an unidentified thing named as it appears.
- Seam 2 for K18c holds: the card on the Player tab, and on Magic and the phone's Log; "Got it" there clears the card and the count; a find while a pop-up is open leaves the pop-up and what is typed in it untouched, with no toast; "and N more" opens the Pack, from the Scene too.
- Seam 2 for K18e holds: a GM's send to the stash, while the screen is open, raises one toast on any tab and no card, no count, no tag; the GM's screen raises none; a reload raises no second toast for the same send.
- Seam 3 holds at 1180 px and 375 px that the left column does not move when the card arrives (p45-19), and that the place's name with its turn stays on one line beside the band's words.
- New layout fixtures go in the layout harness as flags: a place card with shown and hidden pieces that name creatures and things, a shared block, a character with their own block, a name not in the packs; a Location with Area knowledge, with none of its own, with neither; the players' top folded and open, with three tiles at 375 px; the Player tab with `finds=1` and a long name, on a phone and a tablet with the notices box; a stash send with a long name ×999; a d20 and a d100 encounter table page.
- Gallery pictures expected to change: the Knowledge pictures (`*-knowledge.png`), the players' place card (`*-players-place-card.png`), the phone nav if its section draws the Pack's count; the stacked button's and the tapped tables' only if the part itself changes. Each pull request says which.
- The examples are invented ("Bog lurker", "the Ferryman", "Old Harl", "The Drowned Harbour", "Lamp oil", "Bronze ring"): no game IP (hard rule 2).

**Pieces K onward (added 28 Nov).** None has a screen; the three seams above are for the rows a person sees.
- K: the purpose stays #210's, "no layout test can measure a page before its web fonts have loaded". Its proof is the whole layout suite before and after, in both browsers (Piece K's done line); each new stall is run again alone and reported. Prior art: #184's `mapParts.spec.ts` font waits.
- O: pure functions in Node tests, each purpose first: the script picks only the named pictures from a run's artifacts, refuses one identical to `main`'s, and names each size; the check counts the gallery lines in a pull request's text (0, 1, 2 and 10, any case, a line inside a quote). Prior art: `scripts/ci-redraws.test.mjs` (`announcedPictures`), `scripts/ci-jobs.test.mjs`.
- L, N, P: docs only; `npm run docs:check`. Each is proved at its first use: L at the next spec's sitting B (no builder stops on a part that does not exist), N at the next builder's report (it quotes its `end … rc=` line), P at loop 4's own merge (the list is there).
- M: no test; the log's times are the result.

**Piece Q (added at loop 3's sitting C).** Each purpose written first.
- Seam 1: `personHolds.test.ts`: the Carries line keeps the pack's capitals ("Warden's lantern, Iron key."), and a name the pack writes in lower case stays so; her name in the missing line and the failed-read line, with a long name; `events.test.ts` and `heldSend.test.ts`: the GM reads "You gave Wren …" and "You put … in the party stash" for a find, a coin find and a stash send, a player reads "Your GM …", and the held line is unchanged; `events.test.ts` and `purse.test.ts`: the GM reads "You gave Wren 40 herons", "You put 20 herons in the stash" and "You gave Moss 10 herons from the stash.", a player reads "Your GM …" (sb4-14); the plural missing line with her name (sb4-11); the take-back toast with the pack's capitals (sb4-12).
- Seam 2: `personSheet.test.tsx`: a "Sent before" line opens that thing's sheet; it reads "Sent to Wren at 4. The Customs Shed, turn 3." (sb4-13); Take it back there returns it to her, her line and her sheet follow, and the toast has Undo; `packCoin.test.tsx`: the GM's give toast reads "You gave Wren 40 herons" (sb4-14); a refused Take it back shows the error toast with its reason.
- Seam 3: `tests/layout/personCarries.spec.ts` with the built `carries=before` fixture: the line a 44 px target, 375 px and tablet, light and dark, Larger text, a long name with ×999; the sheet it opens.

## Out of Scope

- sf-27's undrawn states: a row naming three or more creatures, "Take it back" refused in the why-blocked pop-up, a wrong "Nothing stirs", "+ Piece" titled "Add a piece". Drawn after 5 December.
- The "piece" words sweep (sf-24): every other place the app shows "piece" waits for its scope check after 5 December.
- The Region's knowledge at a Location (sf-13 adds the Area's only).
- A procedure step's own roll and the weather's pick as "Roll…" (sf-5 ⚑ 1): a later row, drawn first.
- What follows a row picked by hand on a tables' page (ET1, "built later").
- Widescreen layouts beyond the one 1180 px line (◈ `10`).
- A shared cache of what is new across the Pack, the Scene and the Player screen beyond the Player screen's one read.
- Toasts for anything put in the stash by a player, or for coin moved between purses.
- The Pack tab's own card, tags and order (K20b, built).

## Further Notes

**Ruled at sitting B (2026-11-28, `docs/design/rulings/scene-pack-b-2026-11-28.md`, sb4-1 to sb4-5).** The spec was approved ("Yes") and the ten tickets, #200 to #209 ("Loop 4 tickets approved").

| ⚑ | Row | Ruling | Francis |
|---|---|---|---|
| B1 (sb4-1) | K18e | A: no toast for a stash send made while the player's app was closed or offline; the stash's row and the Log say it (Piece F) | "A" |
| B2 (sb4-2) | K18e | A (re-asked): the stash toast replaces the one showing, as tr-7 rules; the Undo stays in the Log (Piece F) | "A" |
| B3 (sb4-3) | K18e | A: the GM's Undo of a stash send goes to the Log only, no toast (Piece F) | "A" |
| B4 (sb4-4) | sf-6b | A: a shown person piece's "Carries" line goes under "Only you see these details." (l4-2 over page 50) (Piece B) | "A" |
| B5 (sb4-5) | sf-10 | A: only one of the pair shows at half the row's width, at the leading edge (Piece I) | "A" |

**Ruled at the short sitting B: pieces K onward (2026-11-28, `docs/design/rulings/scene-pack-b-2026-11-28.md`, sb4-6 to sb4-10).** Pieces K to P were approved ("Yes") and their six tickets, #212 to #217 ("Yes").

| ⚑ | Piece | Ruling | Francis |
|---|---|---|---|
| K1 (sb4-6) | all | A: after the needed rows, beside the later rows where no file is shared; #217 (K) waits for every row | "A" |
| K2 (sb4-7) | K | A: accept a cost up to about +5% (WebKit) and +11% (Chrome) on the whole layout suite, said in the pull request | "A" |
| L1 (sb4-8) | L | B: in the driver's loop (`.claude/agents/driver.md`, The loop): a scout looks up each named part before sitting B; the `to-spec` copy untouched | "B" |
| M1 (sb4-9) | M | A: the second-slot trial runs on Home One (the PC) only, under its memory rule | "A" |
| O1 (sb4-10) | O | A: CI fails a pull request with more than one gallery line | "A" |

**Loop 3 shares the place card (sf-6b with dg-10).** dg-10's "Carries" line on a person's piece is built in loop 3 (tickets #187 to #192, in flight on `dec5-gaps`), in the same piece row. Piece B starts from a base that has dg-10 merged, or waits for it. Piece A, the pure rule, does not wait. dg-10 draws its line under "Only you see this."; piece B owns the label's two words (l4-2) for every piece, person pieces included (sb4-4).

**The open-screen path (K18e, K18c).** The plan's caveat (how a send reaches a screen that is already open was never read) is answered above: the log's version, from Realtime, with no database change. K18e adds one read of the new log entries per reload. If a builder finds a player's device does not hear a GM's send to the stash (no event row the player may read), that is a stop and a report to the driver, not a migration.

**Loop 2 shares the Player screen.** K18c and K19b work in the Player screen and beside its notices slot, which loop 2 (the Player sitting, merged) built. D and E go one after the other in that screen, and F after E.

**sf-14 reuses sf-5's part.** The tapped table that sf-5 built for the roll pop-up draws the pages too. A variant, if needed, is named in 06's Components.

**sf-13's database test.** The plan named a database test for the Area's share. The seams Francis approved have none, since the read is as built (sf-21). The built database tests of `knowledge_for_players` stand. If the drawn test in seam 2 shows the Area's share is not read at the Area's other places, that is a scope check, not a silent migration.

**The players' fold memory (sf-11).** The GM's fold is remembered once per device. The players' fold keeps its own memory, so a device used both as GM and as a player keeps each top as it was left. A technical choice, logged by the builder; no one else sees it.

**K18d joins as built.** Its branch has no pull request; the driver merges it into the integration branch. Its pictures (`k18d-*.png`) and its manual checks are in its `pr-text.md`, which the spec's pull request text gathers.

**To check, not to ask** (from the rulings file, as they stand).
- K18d (in flight): p45-23 read as "with a find card and a call both due, the find card shows and the call waits for Got it" (`10`). The pull request shows it; Francis sees it at sitting C.
- The word "piece" sweep (sf-24, `10`) stays after 5 Dec; sf-6b's card says "piece" to no one, as ruled.
- sf-27's undrawn states (three or more creatures in one row; "Take it back" refused; a wrong "Nothing stirs"; "Add a piece") stay unbuilt, drawn after 5 Dec.

**Pictures owed.** Each visible piece shows its built screen beside its approved picture in its `pr-text.md`: page 44 (B, C, H, I, J), page 45 (D, E, F), page 51 (E), page 50 (B's person piece; Q's frames 50-1 and 50-3).
