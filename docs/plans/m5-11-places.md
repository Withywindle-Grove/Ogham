# Plan: M5 step 11 — places and the room

Written by the design agent, 2026-10-31. Read the specs it names; this file doesn't make rulings.

## What this step delivers
The GM runs a dungeon from a place: each group has a current place; the GM sees the place's card and the room's GM layer; players see the place only after **Show players**; **Something else…** gives players the pack's common actions as reference; **Send** carries text and check results to players.

## Rests on
- 05 Expeditions: *Split the party* (place per group, Join up), *Places for players* (DG9), *The room's GM layer* (DG11), *Something else…* (S4-2; the Describe… entry arrives in step 12 with Requests), *What players see* (the ground around them).
- 05 GM to players: *Send in M5* (D26; Keep in Handouts / Burn after reading; recipients).
- 06 Scene: *Dungeon play*, *Dungeon on Scene*; Components: *Group switcher* (Join up as a quiet button, 2026-10-31), *Something else… pop-up*, *Time strip*; the words and voice guide.
- 03: Send, the current location, Show players (GM rows), players' reading rows.
- 04 ExplorationState (where the party is; per group from this step for the place).
- Rulings: `design/rulings/m5-dungeon-2026-10-30.md` (DG9, DG10, DG11, DG14), `m5-prompts-2026-10-31.md` (Q3, A, B1).
- 07 Exploration: the mode's `procedure` and checks (for "the checks it triggers"); `exploration.playerActions` (added 2026-10-31) for the Something else… list.

## Build order
1. **Place per group.** Move the start place (step 10's GM-only table) to one current place per group; the group in focus picks which place the GM sees. Where? chips stay. Join up allowed only when both groups' places match (replaces the step 8 "anyone, anywhere" stopgap). Test: two groups, two places, Join up refused with a plain reason; same place, merges.
2. **Place card and Show players / Hide.** GM-only card: name, description, notes. Show players publishes name and description to that group's players on Scene (the "where they are" line); Hide takes them back. Both logged (Simple) and undoable. Database: players read a place only while it's shown and only for their own group (ruled 2026-10-31).
3. **Room GM layer.** Opens on entering a place: description (with Show players), the checks the place triggers (from the mode's checks for now; adventure rooms in M8b), free-text notes under headings traps · puzzles · encounters · treasure · doors (R1 text; structured in R2, DG13). **GM screen** button: the pack's rules reference (the existing rules browser, opened on the exploration section).
4. **Something else… pop-up** (players' Scene, every mode): searchable grouped list from `exploration.playerActions`; each row opens its text with its page reference. No Describe… button yet (step 12 adds it; nothing disabled, simply absent).
5. **Send.** Text or a check result (editable), recipients Everyone or chosen characters, Keep in Handouts (default for rumours and clues; otherwise off) or Burn after reading. Recipients get a "From the GM" list on Scene and a log line; burnt messages vanish on close and never enter the players' log; the GM's log keeps the text. Database: only recipients read a message.
6. **Component inventory Code column** for Place card, Group switcher, Something else… pop-up, Send sheet; `permissionCases.ts` rows; `logged_commands` rows for place.show, place.hide, place.set, message.send.

## Tests (purpose first)
- A player never receives a place that isn't shown, or another group's place (database test).
- Hide after Show removes the name from the players' Scene; Undo restores it.
- A burnt message is absent from the players' log and present in the GM's.
- Join up refused across places, allowed in the same place; hirelings follow.
- Journey test: GM starts an expedition at a place, shows it, players see it on a 375 px screen.

## Scope checks (write one and stop if any of these tempts you)
- No activities or Act… in turn modes (parking lot, DG12).
- No room features with states, no structured traps or doors (R2 / M8b).
- No pictures in Send (M8b Handouts); no map panel content beyond the layout slot.
- No location browser or adventure rooms (M8b); Where? stays chips plus a typed name.

## Ruled
1. A shown place is visible to **its group's players only** (Francis, 2026-10-31; 09).

## Estimate
25–35 builder turns on Opus. One migration (places per group, messages). It does not qualify for Fable unless the RLS for messages fails twice.
