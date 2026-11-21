# Plan: M5b step g2 — the place card as pieces (B1, B16)

Written by the design agent, 2026-11-01 (M5 gate B1 ruling). Read the specs it names; this file makes no rulings. Opus, medium.

## What this step delivers
The place card becomes a list of **pieces**, each with its own **44 × 44 eye button** that shows it to the group in focus; **+ Piece**, **Hide all**, Undo; the header "N of M pieces shown"; the players' Scene lists the shown pieces in order. Secrets stay hidden by construction.

## Already built (verify first)
The place card (M5 step 11: `PlaceCard`, `placePlay.ts`), Show players / Hide for the whole description, Where now?, the GM's notes, the players' `PlaceLine`.

## Rests on
- 05: *The room's GM layer* (Show players, piece by piece), *Places for players*.
- 06: *Room GM layer* row; `design/mockups/m5-gate/b1-show-pieces.html`.
- 07 §2: *Pieces for Show players* (`appearance` on `contents[]` and `hazards[]`; read in M8b — in M5b every piece is typed by hand).
- 03: hidden means hidden (only shown pieces reach a player's device).

## Build order
1. **Pieces record.** A place's pieces: kind (description, exit, person, clue, treasure, hazard, other), text, order, and per group a shown flag; the GM-only facts (value, trigger, stat line) never leave the GM's row. Migration with RLS: players read shown pieces of their own group's place only.
2. **The card.** Rows with the eye button (label constant; open eye + pressed look = shown, struck-through = hidden; accessible labels), "+ Piece" (one line, kind picker), "Hide all", Undo toast per change, header count. Notes expandable (B16 lands in g1; reuse).
3. **Players' Scene.** The place's name with the first shown piece; shown pieces in the order shown; nothing else about the place. Realtime update.
4. **Log.** Show / hide as Verbose lines; "Hide all" one line.

## Tests (purpose first)
- A hidden piece is never in a player's query result (database test as a player).
- Showing to Group 1 shows nothing to Group 2.
- Undo after Show hides the piece; Undo after Hide all restores exactly what was shown.
- The eye button is 44 × 44 and announces "Show players" / "Hide from players" (layout test).
- A place with 0 pieces shows "+ Piece" alone; 50 pieces scroll.

## Scope checks (write one and stop)
- No pack-fed pieces (M8b).
- No images (Handouts, M8b).
- No "Players see this" label (⚑ C4 answered by B1).

## ⚑ for Francis (ask at the start)
None.

## Estimate
15–20 builder turns. Independent of g3–g5 (parallel allowed; claim it on the board).

## Departures
(The builder keeps this current in the same pull request.)

1. **How players read pieces (technical).** Players read their shown pieces through one database function, `public.scene_pieces` (the place's name, each shown piece's kind and text, in the order shown), not through a players' rule on the pieces table. `place_pieces`, `piece_shows` and now `places` are the GM's alone, so a GM-only fact (value, trigger, stat line), the old description column or an unshown piece can't reach a player's device even by a direct query. The pieces table keeps the GM-only facts as columns of the piece's own row.
2. **Shown is per visit.** The shown flag belongs to the group's visit (its `group_places` row): Where now? starts a new visit with nothing shown, and coming back to the same room is a new visit too. A split carries the shown pieces along (as M5 step 11 carried the shown place).
3. **What players already saw.** The migration copies each place's non-empty description into a description piece, and marks it shown on visits shown now, so players keep seeing it. A place shown with an empty description stops showing its bare name: the name now comes with the first piece (05). `places.description` is kept, not dropped; the card no longer edits it ("What players notice" is gone; a description is a piece).
4. **The eye's accessible label** switches between "Show players" and "Hide from players" (05, the room's GM layer; the plan's "label constant" read as the visible button: icon only, never a word). No `aria-pressed`, so the label isn't read twice; the pressed look is a class.
5. **Log levels.** + Piece, Show, Hide and Hide all are Verbose, the GM's lines alone; Hide all is one line (one request).
6. **GM-only facts** have columns but no field to type them in M5b (the plan types pieces by hand as one line; M8b reads them from adventures). When present the card shows them on the kind line ("Treasure · value stays yours (40 gp)", as in the mockup).
7. **The whole-place Show players / Hide** is gone from the card. Its commands (`place.show`, `place.hide`) stay registered so their earlier log lines and the logged-commands list still match; nothing calls them.
8. **The players' Scene name.** The mockup's player side shows a different name from the GM's; built: the place's one name.
