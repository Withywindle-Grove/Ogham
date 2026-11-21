# Plan: December step 5, encounters from an adventure's tables

Written by the lead, 2026-11-11. Part of `docs/plans/december-first-play.md`. From Francis's rulings (the encounter check opens by itself as a pop-up, mc-26; Encounter check respects the hour, nc-1, nc-3) and the Builder's sizing. Mockup: `docs/design/mockups/scene/08-activities-checks-weather.html`, frames 7 to 9.

## What changes
On the first night every move in the harbour rolls on the adventure's table, and a row names creatures, people or things that live in the adventure pack or in the setting. Today a row's same-pack ids resolve and the waiting card shows a name and a description. Missing: a row pointing into another attached pack; a row with several creatures; a full view of a creature's stat block; any sign that a row's link didn't resolve.

## Pieces
| | Piece | Size | Migration | Model |
|---|---|---|---|---|
| 5a | **Cross-pack rows**: a table row's `statBlockRef` and `tableRef` resolve across the campaign's attached packs; a row that leads to another table opens it next; an unresolved link shows the row's own words with "not in your packs" and never fails | 1 turn | No | Opus |
| 5b | **A row with several creatures**: each is listed on the waiting card with its count | half a turn | No | Opus |
| 5c | **The stat block, in full**: View on the waiting card opens the creature in the right panel, laid out as the Rules browser lays out a creature, with its source line. GM only; monster hit points and the block are never sent to players | 1 turn | No | Opus |
| 5d | **The check as a pop-up** (mc-26): when the day's procedure or a move reaches an encounter check, it opens in the panel without a tap: the roll in words with its die, what counts toward it, Hit and Miss; a hit goes to Which table?, the likely table first, then the table with rows to tap; Close leaves it reachable from its step. Reuses the Roll sequence and the tables parts | 2 to 3 turns, with pictures | No | Opus |

## Added the same day: piece 5e, send a table's row (tb-1)
Ruled by Francis for rumours (`docs/design/rulings/pack-rework-rulings-2026-11-11.md`, tb-1): in a table opened from the Tables list or a place's own tables, the GM taps the row that was rolled; the sheet that the hand-out uses (pk-1) asks **a character** (then which) or **the party**; the row's players' words are recorded in that character's notes or the party's, with the table's name and the day; the row's GM-only parts (a rumour's truth, a GM note) are never sent or stored where a player reads. One log line, with Undo. Not sized: the Builder first says what Notes is today for a character and for the party, and stops if the party has none. A test as a player proves the truth is not readable. Opus unless the notes need a read rule.

## Also owed for the first night, not a build: a preparedness script
Francis: "before the session: I'll need a preparedness script since we don't have GM preparation functionality built." The lead writes it once the December pieces are live to try (about 1 December): the packs to import and in what order, the campaign and its options, the tables to pin, the first place, the ship's calls as reminders, what is by hand that night and where to find it.

## Order
5a, 5b and 5c can start at once (none is on the redesigned Scene's new parts). 5d waits for the step-sequence panel, which step 4's Move on sheet also needs: build the panel once, with whichever of the two comes first, and name it in 06's inventory.

## Boundaries
- Fights stay by hand: nothing here tracks initiative, rounds or a creature's hit points.
- What is secret stays secret: a secret check's result, the table and the stat block are the GM's.
- No change to how a check is scheduled, beyond nc-1 and nc-3 (#630).

## ⚑
1. The words on the pop-up and the waiting card, for the lead before pictures.
2. If the Rules browser has no creature layout to reuse, stop and ask: the stat block's layout is then a design piece for the Studio.

## Done when
On the live app, with an invented adventure pack and setting: a move raises the check as a pop-up; a hit opens the adventure's table; a row naming a creature of the setting and one of the adventure puts both on the waiting card with counts; View opens each stat block; a row with a broken link says so. Manual checks in `docs/testing/<branch>.md`.

## Estimate
4 to 6 turns, no migration.

## Departures
(The builder keeps this current in each pull request.)

**Piece 5a, `dec-5a-cross-pack-rows` (2026-11-11):**
1. Links are resolved once where the tables are read (the scene and GM reference), so every reader keeps plain ids; a pack's `meta.id` is read from its kept meta (`extra_meta.id`) onto the campaign's packs.
2. A row's same-pack `tableId` now opens that table next too (it was kept but not followed); `tableRef` names one in another attached pack. A row's `next` by terrain still comes first.
3. A plain `statBlockId` the packs don't have is also shown as "Not in your packs" (the plan names cross-pack links; the same sign for a same-pack one costs nothing).
4. Tables and stat blocks are still found by their own id once resolved: two attached packs with the same table or stat block id share one entry, as before (the stacking winner).
5. `pack:check` is unchanged: it doesn't check rows' links (not in this piece).
6. The words "Not in your packs: <link>" are the lead's (plan ⚑ 1), kept in one place (`missingWords`, `src/modules/expedition/rowLinks.ts`).
7. A pack without `meta.id` is linked by the slug of its `shortName`, else its name (07 §1; review of #639).
8. Picture review (Francis, 2026-11-12, "b"; ruling sb-4, `docs/design/rulings/dec-stat-block-and-type-2026-11-12.md`; mockup `docs/design/mockups/december/06-stat-block.html`, approved 2026-11-12, on branch `design-december-mockups` @ ddc6565c until it reaches main): the line reads "Not in your packs: <name> (<pack id>)", e.g. "Not in your packs: Bellringer (mire-zine)"; several with commas, each with its pack. Row links carry no label in the pack format, so the name is always the entry's id made readable (hyphens to spaces, a capital first letter); a plain id naming no pack has no brackets. A table's link reads the same as a creature's. The waiting card's details use the same words (one function).

**Piece 5b, `dec-5b-several-creatures` (2026-11-11; stacked on 5a):**
1. pf-2, ruled 2026-11-11: a row's `statBlockIds` entries may each be a plain id (the row's `count` applying to the group) or `{ statBlockId | statBlockRef, count }`. A plain id has no count of its own: the group's count shows once, as How many (review of #640). When every entry has its own count, the row's `count` is not shown, nor recorded in the row's words, unless the row also names its own stat block (the count is then that one's). **The mixed case, ruled by the lead (pf-2, 2026-11-11):** in a row with some counted and some plain entries, each plain one takes the row's count as its own ("Bog lurker, 1d3"); `pack:check` warns on a mixed row with two or more plain entries ("give each creature its own count"). `pack:check` accepts both, and notes a count that isn't dice or a whole number of 1 or more, an entry with no count where the row has none either, a broken entry, and one naming both statBlockId and statBlockRef.
2. The creatures are listed in the waiting card's details (View and Start), in the existing "Stat blocks" list, each "<name>, <count>" (or the name alone) with its description; the card's face is unchanged, as ruling sb-3 has it ("Companions approved as drawn", 2026-11-12; `docs/design/rulings/dec-stat-block-and-type-2026-11-12.md`) with the mockup `docs/design/mockups/december/06-stat-block.html`, approved 2026-11-12, on branch `design-december-mockups` @ ddc6565c until it reaches main; no gallery picture changes.
3. Stacked on 5a's branch (`dec-5a-cross-pack-rows`), as the Builder asked, because each creature's `statBlockRef` is resolved by 5a's code. 5a merged to main as #639 (2026-11-14); this branch now takes it from main.

**Piece 5c, `dec-5c-stat-block-in-full` (2026-11-11; stacked on 5b; 5a merged as #639, 5b as #640):**
1. The stat block opens inside the waiting card's details (View or Start), replacing them until "‹ Back to the encounter", not in a separate right panel: the details are a pop-up (`Dialog`), and a second pop-up on top of it isn't a part the inventory has. Each creature in the Stat blocks list gets a small **View** (named "View <creature>" for screen readers).
2. The layout is the Rules browser's own parts (`describeEntry`, `Lines`, `sourceLine`), as for a creature there (plan ⚑ 2: the layout exists, so no stop): its name, how many, its notes, its lines (the GM's, hidden fields included) and its source line.
3. GM only, as the details are: stat blocks are a GM-only kind, so they never reach a player's device (the read rule), and only the GM's console opens the card.
- Review round (#642): the stat block takes the focus on opening and Back returns it to its View; the small View keeps its own width. When 5d builds the step-sequence panel, the stat block may move there or stay in the pop-up: the lead's call.

**Piece 5c, the stat block layout (2026-11-12; on #642's branch; mockup `design/mockups/december/06-stat-block.html`, ruled 2026-11-12):**
1. Replaces 5c's point 2: the block is now its own part, drawn once (`StatBlock`, `src/app/StatBlock.tsx`), used by View and by the Rules browser for a stat block, laid out by the pack's `meta.statBlockLayout` (pf-13). The layout lives in the pack's `meta` (kept in `extra_meta`, as `meta.sourceTitles` is), so no migration; written into 07.
2. A figure the layout neither places nor hides is drawn after the layout's groups, as a last group, so a label the pack forgot never disappears (the ruling says what a layout places and hides, not what happens to the rest).
3. What a block holds beyond its figures, description, abilities and source (its sizes, `variants`; its `parts`; its `group`) still shows, as the Rules browser's lines after the abilities. The app's own bookkeeping (`tags`, `profile`, `nudges`, `triggers`, `actionMenu`, `tables`, `turnAs`, `pinnedFrom`, `convertedFrom`, `sameAs`, `imageId`, `gmOnly`) is no longer shown in the block.
4. Saves the pack gives only as a structure (`saves: { D: 10 }`) show as one "Saves" figure ("D10 W11"); when `fields` has a Saves label, the structure isn't repeated.
5. The die glyph helper is local (`WordsWithDice` in `StatBlock.tsx`). The shared words-with-glyph part has since landed on main with piece 1 (`DiceWords`, `src/ui/dice.tsx`); the swap is not made in the refresh of 2026-11-14 (a refresh changes no behaviour) and waits for the lead's word. It also marks "2 in 6" (as the mockup draws it); dice are lower-case "d" only, so a saves line's "D12" gets no glyph.
6. A listed creature the packs don't have now keeps its place in the creature list, "Not in your packs: <name> (<pack>), <count>" (5a's ruled words, the count after), instead of being left out (frame 3); the row's own line names only the links the list doesn't (a missing next table, the row's own stat block).
7. Back is the foot's secondary button ("‹ Back to the encounter"), no longer the quiet link at the top. The Rules browser keeps its own "‹ Back to the list" on a phone (the browser's navigation, not the part's).
8. The gallery has no Rules browser specimen (frame 2): the browser's search field needs styles the gallery doesn't load. The layout screen `gm-rules-browser` shows it.
9. The descriptor line is at 16 in Alegreya Sans SC Bold in the muted colour (the mockup drew 14 to 15): small capitals at 14 read very small.
10. `pack:check` didn't check `meta.statBlockLayout` when this was built; it does since #681 (pf-13, pf-13a; `scripts/pack-stat-block-layout.mjs`, merged 2026-11-14).
11. The manual checks and status stay in this branch's files (`docs/testing/dec-5c-stat-block-in-full.md`, `docs/status/2026-11-11-dec-5c-stat-block-in-full.md`; the branch is `dec-5c-stat-block-in-full`).
12. Picture review (Francis, 2026-11-12, "Approve your changes"): the descriptor stays at 16 px; the source line is the shared small muted SourceLine, as on every other sheet (it was body size in ink); "‹ Back to the encounter" sits at the right of a sheet foot with a rule above it (a new shared `.sheet-foot` in parts.css, the entry panel's foot look), not a full-width choice button. That was the app's, not only the gallery's: it sat in `.dialog__actions`, whose buttons are full width.
