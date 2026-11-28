---
status: draft for sitting B (written 2026-11-28 by /to-spec; no tickets yet)
loop: 3
rulings: docs/design/rulings/dec5-gaps-2026-11-28.md (dg-1 to dg-19; 09, 2026-11-28); frame 47-3, docs/design/rulings/player-sitting-p47-2026-11-28.md (p47-3 to p47-5)
intents: docs/intents/2026-11-28-item-counts.md; docs/intents/2026-11-28-npc-held-items.md
gaps: G-27, G-233, G-228 (G-234 closed as built, dg-9) in docs/11-modelling-gaps.md
mockups: december/48-no-encounters-here.html, 49-a-count-names-its-unit.html (on frame 47-3), 50-what-a-person-carries.html; all approved by Francis 2026-11-28 (their index rows dated 2026-11-28)
order if cut: G-228 first to go, then G-27, then G-233 (the designer's lean, not ruled)
---

# Spec: three gaps for 5 December

Loop 3 of the build loop. It builds the three gaps Francis lifted to "build before 5 December" (28 Nov, "All three"): a place with no encounters (G-27), a count that names its unit (G-233), and a first slice of what a person carries (G-228). Every ⚑ of sitting A was ruled A, and the three pages are approved with the findings he picked.

All three are visible, and all three have an approved mockup. Each needs a small database change that replaces a function and rewrites no stored row (see Implementation Decisions, "Migrations"): sitting A's table said "No" or "Maybe" there, so this is ⚑ B1.

## Problem Statement

**A safe place still raises encounter checks.** A pack can give a place its own check, or say nothing and take the check of the place it sits in. It cannot say "no encounters here". So at a harbour quay the setting's wandering check still comes due, and the GM dismisses it every time.

**A count always says "charges".** A bottle with three portions says "3 charges left", "Use a charge", "Charges: ?", and the log says "used a charge of the rum bottle". The player has to turn "charges" into portions in their head, and the GM's Reveal pop-up says "Its charges".

**A person cannot carry anything.** A pack's people have no field for things. A warden's lantern can only be a loose item, or a name in the person's lead. The GM has to remember who carries what, hand it out from Add item, and keep track of what has gone. Nothing stays with the person when the party meets her again at another place.

## Solution

| # | Gap | What people see | Mockup | Rulings |
|---|---|---|---|---|
| 1 | G-27 | A pack says `"encounterCheck": { "none": true, "note"?: "…" }` on a place. There, and inside it, no wandering check comes due. The Encounter check tile says "None here", for the GM and the players. The GM's "Checks here" card says "No encounters here.", with the pack's sentence and the switch that puts the setting's check back. Move on's "Then" line into the place has no check line | Page 48, approved 2026-11-28 with findings 1, 2, 4 and 6 | dg-1 to dg-4, dg-17 |
| 2 | G-233 | An item's `charges` may name its `unit` ("portion") and `units` ("portions"). Every place the count is said uses that word: "2 of 3 portions", "Portions: 2 of 3 left", "Use a portion", "Use an ounce", "1 dose left", "Rum bottle has no portions left.", the Reveal pop-up's "Its portions" and its toast, the log, the roll prompt. With no unit, or where the holder may not know it, the words stay "charge" and "charges" | Page 49 (on frame 47-3), approved 2026-11-28 with findings 2 and 3 | dg-5 to dg-9, dg-18 |
| 3 | G-228 | A pack's person may list `holds`. On the GM's place page, the person's piece says "Carries: Warden's lantern, iron key." under "Only you see this.". Its words open the person's sheet: a row for each thing. Each thing is sent from its own sheet, to a character or the party stash, with the send that is already built. A thing sent is gone from that person everywhere, and Take it back returns it to her | Page 50, approved 2026-11-28 with findings 1, 5 and 6 | dg-10 to dg-16, dg-19 |

**If the night comes first**, these are the by-hand ways (the ruling's list). G-27: the GM dismisses the check when it comes due. G-233: the item's own words say "portions", and "Use a charge" takes one. G-228: the person's lead names the item, and the GM hands it out from Add item.

## User Stories

**A place with no encounters (G-27)**

1. As a pack writer, I want to write `"encounterCheck": { "none": true }` on a place, so that the book's "no wandering encounters here" is data, not a note.
2. As a pack writer, I want to add the book's sentence as `note`, so that the GM reads why ("The harbour watch keeps the quay quiet.").
3. As a pack writer, I want "none" on a district to cover every place inside it, so that I write it once.
4. As a pack writer, I want a place inside a "none" place to keep its own check, so that the one dangerous cellar under a quiet quay still rolls.
5. As a pack writer, I want `pack:check` to warn when `none` sits beside a `chance`, `tableId`, `tableRef`, `every` or `byTrack`, so that I don't write a check that contradicts itself.
6. As a pack writer, I want `pack:check` to warn on a `none` that isn't `true`, so that `"none": "yes"` or `false` doesn't pass quietly.
7. As a GM, I want no wandering check to come due while the party is at a "none" place or inside it, so that I don't dismiss a check the book says never happens.
8. As a GM, I want a check of a place further out to be silent there too, so that the nearest place decides, as it does today.
9. As a GM, I want my own encounter-check reminders to be silent there, as they are where any place's own check stands in, so that nothing nags me in a safe place.
10. As a GM, I want my other reminders to keep running there, so that "none" silences encounters only.
11. As a GM, I want "Encounter check" (Check now) to still roll the setting's check there, so that I can roll when the story says so.
12. As a GM, I want the "Checks here" card to say "No encounters here." with the pack's sentence and "The Quay's own rule." under it, so that I see what is in force and whose rule it is.
13. As a GM, I want the card to keep its switch, on by default, so that I can put the setting's check back with one tap.
14. As a GM, I want the switch logged and undoable, with the toast "The Quay's "No encounters here" is off. River Rules' wandering encounters apply here.", so that a wrong tap is one Undo away.
15. As a GM who switched it off, I want the card to read "Encounters as usual here." with "River Rules' wandering encounters apply here again, until you switch this back.", so that I know the setting's check is back.
16. As a GM, I want the Encounter check tile to say "None here" with the small line "Its own rule.", so that the facts row says it at a glance.
17. As a GM with a long place name on a phone, I want the tile's small line to stay "Its own rule.", so that nothing is cut at 375 px.
18. As a GM, I want Move on's "Then" line into a "none" place to have no check line, so that the sheet says nothing that won't happen.
19. As a GM, I want a pack with no sentence to show the card's words without it, so that nothing empty shows.
20. As a GM, I want a "none" place inside a place whose check says `replacesScheduled` to be silent, so that the nearer place decides (finding 6).
21. As a player, I want my Encounter check tile to say "None here" at such a place, so that I read the same fact the GM does.
22. As a player, I want the tile to read "None here" only once the place is shown to my group, as any place's check is today, so that the tile tells me nothing early.
23. As a player, I want the setting's check back on my tile when the GM switches it on again there, so that my tile stays true.
24. As a GM, I want the place's Rules sheet to show the same card under the place, so that the sheet and the card agree.

**A count names its unit (G-233)**

25. As a pack writer, I want to write `"unit": "portion"` on an item's `charges`, so that the app says what the count counts.
26. As a pack writer, I want `units` to default to the unit plus "s", so that I write the plural only for a word like "mouse" and "mice".
27. As a pack writer, I want `pack:check` to warn on a unit that ends in "s", so that I don't give a plural, or a word like "oil", as the unit.
28. As a pack writer, I want 07 to say that a unit is a countable word ("flask", not "oil"), so that I know the rule the checker can't fully test.
29. As a player, I want At hand's line to say "2 of 3 portions", so that I read the count in the item's own word.
30. As a player with an item whose full count is 1, I want "1 dose left", not "1 of 1 dose", so that it reads like speech (finding 3).
31. As a player, I want the item's sheet to say "Portions: 2 of 3 left" and "Use a portion", so that the sheet and the row agree.
32. As a player, I want the button on a stacked row to stay "Use", with its spoken name "Use a portion of Rum bottle", so that the button stays short and the screen reader says what it does.
33. As a player, I want "an" before a unit that starts with a vowel ("Use an ounce"), so that the sentence reads right (finding 2).
34. As a player with a hidden count, I want "Portions: ?", so that I know what is counted even when I don't know how many.
35. As a player with a count not yet set, I want "Portions not set", so that the words match the item.
36. As a player who taps Use with none left, I want "Rum bottle has no portions left.", so that the reason names the unit.
37. As a player with a hidden count and none left, I want today's "Nothing happens. Rum bottle seems spent.", so that hidden counts keep their rule.
38. As a player, I want the toast after Use (with its Undo, loop 2's #171) to name the unit, so that it agrees with the row.
39. As a player holding an unidentified item, I want it to say "charges", so that the word never tells me it is a potion (hard rule 5).
40. As a player holding an item whose setting keeps `charges` for the GM (`gmOnly: ["charges"]`), I want "charges" until the GM tells me, so that the word travels with the fact.
41. As a player whose GM tells me an item's charges or its true name, I want the unit word from then on, so that the word is part of what is told.
42. As a player holding an item handed out before the pack named a unit, I want it to keep saying "charges" until the GM hands it out again, so that nothing changes under me (dg-8).
43. As a GM, I want the Reveal pop-up's row to say "Its portions", so that I see what I am telling.
44. As a GM, I want the Reveal toast to say "Told Wren: the rum bottle has 2 portions left.", so that I know what the player now knows.
45. As the party, I want the log to say "Wren used a portion of the rum bottle", so that the record reads as the table speaks.
46. As a GM, I want the roll prompt to say "Portions (3)", so that the starting roll is named for what it fills.
47. As a GM, I want Recharge to stay "Recharge", so that the GM's rare action keeps its one word (dg-6).
48. As a GM, I want "Portions not set (hidden)" and "2 left (hidden)" on my side, so that my words match the item.
49. As a player or GM with an item that names no unit, I want today's "charge" words, so that nothing changes for a wand.

**What a person carries (G-228, the first slice)**

50. As a pack writer, I want to list what a person carries as `holds`, each line naming one item (`itemId`, or `itemRef` in a required pack) with `qty` and the book's `note`, so that the pack says who holds what.
51. As a pack writer, I want `pack:check` to warn on an item it can't find, a `qty` that isn't a whole number of 1 or more, and an item held by two people, so that the pack is right before the night.
52. As a pack writer, I want `pack:check` to note a person who holds things but has no piece on any place, so that I know the slice can't show them.
53. As a GM, I want a person's piece to say "Carries: Warden's lantern, iron key." under "Only you see this.", after her row (name and stat line), so that I see what she carries without opening anything.
54. As a GM on a phone, I want the Carries line above her stat line, under her name, so that it isn't pushed below the fold (finding 5).
55. As a GM, I want a person who holds nothing to show her piece as today, so that nothing empty shows.
56. As a GM, I want a tap on her piece's words or its arrow to open her sheet, so that her things are one tap away.
57. As a GM, I want her sheet to show the place over the title, her name as the title, the piece's words, "Carries", and her things a row each with the book's note under each, so that it reads like the find sheet I know.
58. As a GM, I want "Edit the piece's words" last on her sheet, so that I can still edit the piece.
59. As a GM, I want no "Send all" on her sheet, and no accent button, so that taking everything from a living person isn't one easy tap (finding 1).
60. As a GM, I want a row to open that thing's own sheet, with To a character and To the party stash, so that I send it with the send I already know.
61. As a GM, I want a thing with `qty` 999 to be one row, sent whole from its sheet, so that a big count doesn't make a long list.
62. As a GM, I want a sent thing's row to say "✓ Sent to Wren." (or "the party stash"), with Take it back on its sheet, so that I see what has gone and can undo it.
63. As a GM, I want the send's toast "Warden's lantern sent to Wren." with Undo, as the built send says, so that a wrong send is one tap away.
64. As a GM, I want her Carries line to read "Carries: iron key. Warden's lantern sent to Wren." after a send, so that the piece stays true.
65. As a GM, I want the line to read "Carries nothing now." when everything has gone, so that the piece says so.
66. As a GM who meets her again at another place, or in a later session, I want what she gave away to be gone from her there too, so that her things move with her (dg-12).
67. As a GM, I want things sent at another place listed on her sheet under "Sent before" ("Warden's lantern, to Wren, at 4. The Customs Shed."), so that I know where it went.
68. As a GM, I want Take it back to return a thing to her wherever she is, so that an undo is the same everywhere.
69. As a GM, I want my log to say "You gave Wren the iron key (Mother Sedge's).", so that I know where it came from.
70. As a GM whose pack names a thing no attached pack has, I want the quiet line "One thing she carries isn't in your packs.", with no id on screen, so that the screen shows no machine words (finding 6).
71. As a GM, I want a refused send or a refused Take it back to show the error toast with its reason, as every refused command on the page does, so that I know why.
72. As a GM offline, I want the send kept and made on reconnect, as the built send is, so that the table doesn't wait for the network.
73. As a GM, I want Move on to stay plain while her sheet is open, as with a Treasure sheet, so that one accent shows at a time.
74. As a player, I want never to learn what a person carries before the GM sends it, so that the table finds out by playing (dg-13).
75. As a player receiving a thing, I want page 45's find card, its giver "your GM", so that a gift from a person reads like any find (dg-16).
76. As a player, I want the pack's own words in a shown person piece to stay the pack's, so that "a lantern on a pole" is still what I read.
77. As a GM whose person dies or leaves, I want her things to stay with her until I send them, so that the app does nothing I didn't do (dg-14).

**Everyone**

78. As anyone, I want every new tap at least 44 px with 8 px between, so that it works at the table.
79. As anyone, I want each screen right at 375 px, in light and dark, and with Larger text, so that every device works.
80. As Francis, I want each built screen shown beside its approved picture in the pull request, so that I approve it by sight.

## Implementation Decisions

**Pieces, for the tickets.** One gap is one or two tickets. A gap's checker warnings go in the same ticket as the gap's pack reader.

| Piece | Gap | What | Migration |
|---|---|---|---|
| A | G-27 | "None" in the chain: the place check, the clock, the reminders, Move on, the GM's card and tile, the Rules sheet, the checker | No |
| B | G-27 | The players' tile: the players' check read returns "none" | Yes (a function) |
| C | G-233 | The count's words from one function, everywhere; the checker | No |
| D | G-233 | An unidentified item's face drops the unit | Yes (a function) |
| E | G-228 | A send keyed to the person: the send's row key, the log read, the GM's log line | Yes (a function) |
| F | G-228 | The person piece's Carries line, her sheet, a thing's sheet; the pack reader; the checker | No |

**Migrations (⚑ B1).** Each one replaces a database function and adds nothing else: no new table, no new column, no stored row rewritten, nothing dropped or renamed. Each runs on the test project first. Francis pushes each to the main project before 5 December. The function-lineage check (`npm run check`) covers each replaced function.
- **B.** The players' check read (`encounter_check_for_players`, both forms) returns today only a check that says `replacesScheduled`. It also returns a deciding place whose check says `none: true`, while the GM's switch leaves it in force, marked `none`. The place a player wasn't shown still reads by its shown name, as today.
- **D.** The face of an unidentified item (`item_face_data`) keeps today the item's `charges` object, so a new `unit` would reach the holder's device. It drops `unit` and `units` from `charges` (dg-7, hard rule 5). The face is what both the line's copy and a player's read of the library entry give, so one function covers both. The builder confirms that a tell of the charges, or of the true name, brings the unit back with them.
- **E.** The send (`give_find`) accepts today only a hoard's row keys ("2:thing"). It also accepts a held thing's key, naming the person's id and the item's id. That key goes on the send's GM-only line only, beside the place, as today's rows do (rp-4). The party's lines name neither the person nor the thing's source. The send's Undo (`undo_find`) is unchanged.

**dg-12, the technical pick: read from the log, no record per person.** What a person still holds is worked out from the GM's log, as "Sent to" on a Treasure piece is today (`sentRows`): never stored on the piece or the person. A send names its held thing's key. The latest send of a key wins. A send that was undone (Take it back) marks nothing. This reuses the send, its Undo and its log, and needs no new table and no new read rule. A record per person would need a table, its read rules, and a second Undo, for no gain the slice can show.

**Piece A: "none" in the chain (dg-1 to dg-4, dg-17)**
- The place check (`placeCheckOf`) treats an `encounterCheck` object with `none: true` as the nearest place's check, as any check is. It returns a place check marked `none`. That check stands in for the setting's (it counts as `replaces`), is `inForce` unless the GM's switch (rg-5) says off, and has the pack's `note` as its sentence. It has no chance, no table and no `when`. A `none` that isn't `true` is read as no check at all, as an unreadable check is today.
- A "none" check in force never comes due. The clock's scheduled check gets no location check and no setting check while it is in force. The GM's encounter-check reminders are silent there, as they are under any stand-in check. The GM's other reminders run as today.
- Check now (the band's Encounter check, DG3) rolls the setting's check there, not the place's.
- The scene's table candidates (`sceneCandidatesOf`) add nothing for a "none" check. The setting's tables stay in the list untagged, as under any stand-in.
- The move's check (`moveCheckOf`) is null into a place whose "none" is in force, so Move on's "Then" line has no check line (dg-4). Switched off, the setting's check is back, as today.
- The facts row's Encounter check tile (`checkFact`, read by the scene's band) gets a "none" form: label "Encounter check", value "None here", small line "Its own rule.". No place name reaches the tile (finding 1).
- The GM's "Checks here" card on the place page, and the place's Rules sheet, read "No encounters here." with the switch on. The second line is the pack's sentence and "<place>'s own rule." only (finding 2). Switched off: "Encounters as usual here." and "<setting>'s wandering encounters apply here again, until you switch this back." (finding 4). The switch's toasts are the built ones, with the check's name "No encounters here".
- The place card's "has rules" test counts a "none" check as a stand-in, so the Rules sheet opens there.
- The players' read (`loadPlayersCheck`) reads B's `none` mark into the players' check. A player's tile reads "None here" from it.

**Piece C: the count's words (dg-5, dg-6, dg-8, dg-18)**
- One pure module gives every count's words from the line's own copy of the item (the line's details) and what the holder knows. Every place that says a count reads it: the row's line (`chargeWords`), the item's sheet and its Use row, the action's spoken name (`ItemAction`, `atHandAction`'s caller), the At hand pop-up's facts, the Reveal pop-up's row and toast, the log's words (`inventory.useCharge`, `inventory.setCharges`, a tell of the charges), the charges dialog and the roll prompt's label, and loop 2's Use toast (#171). No screen writes "charge" itself.
- The unit is read from the line's copy only, never from the GM's library entry, for a holder. The GM's own screens read the GM's copy, so the GM always sees the unit.
- `unit` is a non-empty word, trimmed. `units` defaults to `unit` + "s". With no `unit`, or a `unit` that isn't words, the words are today's "charge" and "charges".
- Where the holder may not know the unit, the words say "charges": a line with no unit on its copy (unidentified, `gmOnly: ["charges"]`, or handed out before the pack named one, dg-8). No stored line is updated.
- "a" or "an": "an" before a unit whose first letter is a, e, i, o or u, and "a" before any other (dg-18). Test cases: "a portion", "a dose", "an ounce", "an arrow", "an ember". The rule's known misses ("an unit", "a hour") are ⚑ B2.
- A full count of 1 (`initial` 1) reads "1 dose left", not "1 of 1 dose" (finding 3). Other counts read "2 of 3 portions" on the row, as page 49 draws.
- The capital in a label ("Portions: 2 of 3 left", "Portions: ?", "Portions not set") is the plural's first letter in upper case.
- The stacked button stays "Use"; only its spoken name changes. Recharge and Recharge (fiat) stay as they are.
- Add item gets no unit field (dg-5).
- The pack reader keeps `unit` and `units` on the item's `charges`, as written. It needs no new column: the line's copy of the item already carries `charges` (the stack join keeps it).

**Piece F: the person's things (dg-10, dg-11, dg-13 to dg-16, dg-19)**
- The pack reader keeps `npcs[].holds` on the person's library entry, as written. The person's entry is already GM-only (kind `npc`; 07 §5), so `holds` never reaches a player's device.
- A pure module reads a person's `holds`: each line's item (`itemId` in the person's pack, `itemRef` in a required pack), `qty` (1 if left out; a whole number), and `note`. A line whose item no attached pack has is counted, not named: "One thing she carries isn't in your packs." (finding 6).
- The same module, given the GM's log, says for each held thing whether it is still held, or sent, to whom, at which place, and by which send (for Take it back). It reads every place's sends, not one place's.
- The person piece's GM block (Q7's names, `pieceNames`) gains the Carries line. It shows only for a piece whose person is found and holds something. The words: "Carries: Warden's lantern, iron key." Sent things follow: "Warden's lantern sent to Wren.". All sent: "Carries nothing now.". On a phone the line sits above the stat line (finding 5); on a tablet it follows the stat line.
- The person's sheet is a named variant of the find sheet (TR1, the hoard sheet), "the person's dress": over the title the place; the title her name; the piece's words; "Carries"; a row a thing with its note under it; "Sent before" for things sent at another place; "Edit the piece's words" last. No "Send all", no accent button. Move on is plain while it is open (dg-19). The variant is named in 06's Components inventory, not copied.
- A thing's own sheet is TR1's one-thing sheet: To a character, To the party stash; sent, "Sent to Wren, turn 3." and Take it back. The send is the built `find.give`, with E's held key. Take it back is the built `find.undo`.
- The person's things arrive under their plain names, as a Treasure piece's do. A magic item's truth is out of scope.
- The GM's log line for a held send: "You gave Wren the iron key (Mother Sedge's)." The person's name comes from the GM's own library read. The party's lines and the player's find card are unchanged (page 45, giver "your GM").
- Nothing changes automatically when a person dies, leaves or is hidden (dg-14).

**The pack checker (dg-1, dg-18, the `holds` lines).** It warns on `none` beside a `chance`, `tableId`, `tableRef`, `every` or `byTrack`, and on a `none` that isn't `true`. It warns on a `unit` or `units` that isn't words, and on a `unit` ending in "s". It warns on a `holds` item it can't find, on a `qty` that isn't a whole number of 1 or more, and on an item held by two people. It notes a person with `holds` whom no `playerView.people` names.

**Docs in the same pull requests.**
- 07 already has the three pack lines (this spec's commit).
- 05: encounter checks in a place ("none"); the count's words; finds from a person (piece A, C, F's tickets).
- 06: the facts row's Encounter check tile; the "Checks here" card; the Reveal pop-up; the person's sheet as a named variant of the find sheet, with its Code column; the voice guide's count words ("an" before a vowel, "1 dose left").
- 04: nothing. dg-12 keeps no record.
- A builder lists a departure in its `pr-text.md`. The design agent updates this spec after the merge (lc-3).

## Testing Decisions

The four seams Francis approved (28 Nov, "Yes"):

| Seam | What it tests | Prior art |
|---|---|---|
| 1. Pure functions | Which encounter check is in force when a place says "none"; a count's words (unit, plural, "a"/"an", a full count of 1, hidden → "charges"); what a person still holds after the GM's sends | `placeRules.test.ts`, `moveOn.test.ts`, `tableList.test.ts`; `packHelpers.test.ts` (its `chargeWords` cases), `events.test.ts`; `findSend.test.ts` (`sentRows`), `pieceNames.test.ts` |
| 2. One part drawn in a test (Testing Library) | The "None here" tile and the "Checks here" card; the rows, the item's sheet and the Reveal pop-up with the unit word; the person's "Carries" line and her sheet | `placeRules.test.tsx`, `gmPlacePage.test.tsx`, `playersTop.test.tsx`; `atHandStacked.test.tsx`, `atHandActions.test.tsx`, `k22Reveal.test.tsx`; `HoardSheet.test.tsx`, `placeCard.test.tsx` |
| 3. The real screen in a browser (layout checks) | 375 px, light and dark, Larger text, long names, the approved pictures | `placeRules.spec.ts`, `sceneBand.spec.ts`; `player-at-hand-popup.spec.ts`, `k22-reveal.spec.ts`, `light-tap.spec.ts`; `b15-hoard.spec.ts`, `gm-view-scene.spec.ts` |
| 4. The database and the pack checker | A player never reads a person's held things before they are sent; the pack checker warns on the three new pack lines | `dec-3-npc-kind.test.ts`, `dec-6-k16b-send-find.test.ts`, `dec-7-3-place-check-and-rules.test.ts`, `k22-reveal-hidden.test.ts`; `pack-ruled-fields.test.mjs`, `pack-today-shapes.test.mjs` |

- A good test checks what a person sees or what a function returns, never how a part is built inside.
- Each test's purpose is written first, as a plain sentence.
- Seam 1 must hold finding 6: a "none" place inside a place whose check says `replacesScheduled` is silent, and a place inside the "none" place with its own check decides for itself.
- Seam 1 holds the "a"/"an" cases named above, and "1 dose left".
- Seam 4, the database, holds each migration's own case: a player's tile reads "none" only for a shown place with the switch on (B); an unidentified line's face and a player's library read carry no `unit` (D); a held send's key is on the GM-only line only, and a player's log lines name neither the person nor the key (E).
- New layout fixtures go in the layout harness as flags: a "none" place for the GM and a player, with a long place name; At hand with a unit, a vowel unit, a full count of 1, a hidden count, 999; a person piece with things, with some sent, with everything sent, with a thing not in the packs, and a long thing name with ×999.
- The examples are invented ("Rum bottle", "Mother Sedge", "The Quay", "River Rules"): no game IP (hard rule 2).

## Out of Scope

- A screen for a pack's people; the person's status (alive, dead, missing); a person who roams (G-30, G-175). The full intent's own sitting decides them.
- Held things on a creature group in `contents`; coin on a person (a `holds` line names items only).
- Taking, trading, stealing or looting at death as app actions (dg-11).
- A held thing's own table roll (it-1) beyond what the send already does; a held magic item arriving under its real name.
- A unit field on Add item; a unit per category (dg-5); "Refill" for Recharge (page 49's finding 1, no action).
- Updating lines already handed out (dg-8).
- "Use my check here instead" for a "none" place beyond the switch that is already built.
- G-234: built, and closed as built (dg-9).

## Further Notes

**⚑ for sitting B** (collected, not decided):

| ⚑ | Question | Options | Lean |
|---|---|---|---|
| B1 | Three function-only migrations (B, D, E): no stored row changes, nothing dropped. Sitting A's table said "No" for G-27 and G-233 and "Maybe" for G-228. Francis pushes each to main before 5 Dec | A: yes, as written. B: cut the piece that needs one (B: players see the setting's check at a "none" place; D: the unit waits for a fix of the face; E: G-228 goes) | A |
| B2 | "a"/"an" by first letter writes "an unit" and "a hour" | A: first letter only, as ruled, and 07 tells pack writers. B: the first-letter rule plus a short built-in list ("uni…", "use…", "eu…", "one…" take "a"; "hour", "honour" take "an"). C: the pack may give the article (a new pack field) | B |
| B3 | The unit's word ending in "s": the checker can't know every uncountable word ("oil", "rice") | A: the "s" warning plus 07's sentence, as ruled (dg-18). B: also a short list of common uncountable words | A |

**Known limits.**
- The checker's "ends in s" warning misses an uncountable unit like "oil" and flags a word like "lens". 07's sentence carries the rest (dg-18).
- A person who appears in two places at once in one session: not drawn, and not tested by page 50. Keyed to the person, both pieces read the same log.

**Loop 2's Use toast (#171, ⚑ E, ruled 28 Nov: Use a charge gets a toast with Undo everywhere).** Its words are #171's. Where they name the count, they read it from piece C's one function. If C merges first, #171 uses the function. If #171 merges first, C's ticket moves its words onto the function. The toast's Undo is #171's and unchanged here.

**For the Pack Creator, after the merge** (not a builder's ticket): the island pack (valley-town-adventure) gets `encounterCheck: { "none": true, … }` on its safe places, `charges.unit` on its counted items, and `npcs[].holds` on its people who carry things. Then `npm run pack:check` on it.

**Pictures owed.** Each visible piece shows its built screen beside the approved picture in its `pr-text.md`: page 48 (A, B), page 49 (C), page 50 (F).
