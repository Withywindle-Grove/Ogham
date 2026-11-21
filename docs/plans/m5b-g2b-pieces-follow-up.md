# Plan: M5b step g2b — pieces follow-up (edit, remove, coming back, retire the whole-place commands)

Written by the design agent, 2026-11-02, from `design/rulings/m5b-g2b-pieces-follow-up-2026-11-02.md` (gp-1 … gp-6) and the mockup `design/mockups/m5-gate/b1b-edit-piece.html`. Read the specs it names; this file makes no rulings. Opus, small; one migration (test first). Independent of every other M5b step.

## What this step delivers
Tap a piece's text to edit it (the Add piece sheet filled in, Save, Undo); Remove this piece (retire, Undo); a shown piece's edit reaching players quietly; a return visit starting with the last visit's shown pieces (one log line, Undo); `place.show` / `place.hide` retired with their `logged_commands` rows deleted and their old log lines still readable.

## Already built (verify, don't rebuild)
g2 (#240): `place_pieces` with `undone` and `version`-less rows (check: add `version` if optimistic writes need it), `piece_shows` per visit, `scene_pieces`, `PlaceCard` / `PieceRow` / `AddPiece`, the eye, Hide all, the Verbose lines, the undo registry entries for `place.addPiece` and `place.showPiece`. The migration precedent for deleting a command's row: `20261102202000_m5b_0c_no_ask_allow.sql`.

## Rests on
05 The room's GM layer (pieces after they're added; coming back) · 06 Room GM layer · 04 Place (g2b) · 03 the pieces row · the ruling gp-1 … gp-6.

## Build order
1. **Migration (test first).** `edit_place_piece(piece, kind, body)` (the GM; same checks as add; keeps position); `remove_place_piece(piece)` sets `undone` (its `piece_shows` follow by reading `not undone` on the piece — check `scene_pieces` filters on it); the return-visit seeding in `set_group_place` (or its trigger): when the place has an earlier `group_places` row, copy that row's shown `piece_shows` (not undone, `shown`) into the new visit, skipping undone pieces, and return the count; delete the two `logged_commands` rows `place.show`, `place.hide`; add `place.editPiece`, `place.removePiece`, `place.backAt` (verbose, undoable). Drops no data (say so in the header).
2. **Commands.** `place.editPiece` (kind, text; Undo restores the previous), `place.removePiece` (Undo clears `undone`), the return-visit line `place.backAt` written by `place.set` when the count is > 0 (one line; Undo hides those shows); `showPlace` / `hidePlace` and their exports go from `PLACE_COMMANDS` and `undo.ts`; `events.ts` keeps both names' words. Permission cases; `m3-health` matches.
3. **The card.** `PieceRow`: the text is a button ("Edit piece: <text>") opening `AddPiece` in edit mode (title, chips and text filled, Save, the quiet Remove this piece, the "Shown to Group N now" line); Undo toasts; the players' `PlaceLine` re-reads on change (Realtime as today). 06 Code column.
4. **Tests and checklist** (below); testing.md items for g2b.

## Tests (purpose first)
- Editing a shown piece changes what the player's `scene_pieces` returns, with no other row touched (database test as a player).
- A removed piece disappears from the player's query and from the card; Undo brings both back with the same shows.
- Coming back to a place shows exactly the pieces shown at the end of the last visit, in order; a piece hidden before leaving stays hidden; a piece added between visits is hidden.
- Coming back by a different group (after a split) shows the same seeded set (gp-5: any group).
- Where now? to a never-visited place starts with nothing shown (unchanged).
- `logged_commands` has no `place.show` / `place.hide` rows and the app registers neither; an old `place.show` event still renders its words in the log.
- The text button and the eye don't overlap; both 44 px (layout test); Save with empty text answers in a line.

## Scope checks (write one and stop)
- No reordering of pieces (not ruled; ⚑ if wanted).
- No field for the GM-only facts (M8b).
- No "changed" marker on the players' side (gp-2 rules quiet).
- No deletion of piece rows (gp-3: `undone` only).

## ⚑ for Francis (ask at the start)
None. Two of the ruling's calls he may overturn before the build: gp-2 (quiet update) and gp-5 (any group).

## Estimate
8–12 builder turns (Opus); the migration and the command changes first (one PR), the card second if the builder prefers two.

## Departures
(The builder keeps this current in the same pull request.)

1. **Two migrations, not one.** `20261102320000_m5b_g2b_pieces_follow_up.sql` (the step) and `20261102321000_m5b_g2b_back_at_latest.sql` (a fix forward after the first test run on the test project: "the most recent visit" is the one that ended last; a visit still under way hasn't ended, so a group that comes back while another group is in the room gets what the room shows now, not its own old visit's shows). Both applied to the test project; neither on main.
2. **The seeding is its own request, not inside `set_group_place`.** Undo groups a line's changes by request id, so shows seeded inside the move's request would be undone with the move (and undoing the "back at" line would undo the move). `setPlace`'s run calls `backAtPlace.run` under its own tag after the move; `set_group_place` is unchanged.
3. **Expedition start at a known place doesn't seed.** The plan's build order names Where now? (`place.set`) only; `start_expedition` places the groups itself. Scope check (technical): should Start expedition's Where? to a place visited before also bring back its shown pieces (gp-5 says "any expedition")? Recommended yes, as a small follow-up (the app runs `place.backAt` for each group after the start); not built here. **Ruled yes by Francis (2026-11-02); built in #299 (branch `m5b-g2b-start-seed`)**; see "Follow-up: Start expedition" below.
4. **`version` added to `place_pieces`** (the plan's "check"): Edit piece sends the version it opened with and a save from an old copy is refused in the usual words (04 says "versioned").
5. **Save is a secondary button, not the mockup's accent:** the GM's Scene already has its one accent (Next turn), as + Piece's Add before it. Remove this piece is the quiet style, not danger text: it's reversible with Undo.
6. **The log's wording:** an edit reads "changed a piece to “<new words>”" (the old words stay in the line's record), a kind-only change "changed the kind of “<words>”", a removal "removed a piece: “<words>”", a return "is back at <place> with the party · N pieces shown again" (the ruling's "Back at <place> · N pieces shown again" in the log's by-whom voice).
7. **The toast after Where now? counts the pieces** ("The party is at <place> · 2 pieces shown again"); its Undo undoes the move, as before. The "back at" line's own Undo (hide them all again) is in the log.
8. **No layout baseline changed:** one new layout scene (`gm-place-edit-piece`) was added; the gallery has no place card.

### Follow-up: Start expedition
Ruled yes by Francis (2026-11-02, item 3 above; gp-5 "any expedition"). Branch `m5b-g2b-start-seed`, Opus; no migration.
1. **In the command, not the screen.** `expedition.start`'s run, after the start succeeds with a Where?, reads the new expedition's group visits and runs `place.backAt` for each one, each as its own request (its own Verbose line and Undo), as Where now?'s run does. A place never visited writes nothing and no line. The answer carries `backShown` (the count). No new command, no migration (`back_at_place` already finds the place's last visit across expeditions).
2. **The toast is unchanged here.** The start's toast lives in `SceneTime.tsx`, which the parallel g6 step is rebuilding; this PR doesn't touch it, so it still reads "Started an expedition: <mode> · <place>" without "· N pieces shown again". One line to add once g6 merges (`started.backShown`, the same words as Where now?'s). **Done after g6 merged** (branch `m5b-g2b-start-toast`): both toasts share `shownAgainWords` in `play.ts`. The card shows the pieces at once; the log has the line.
3. **A failed bring-back after a successful start** says "The expedition started, but the pieces shown last time couldn't be brought back: …" (as Where now?'s), and the expedition stands.
