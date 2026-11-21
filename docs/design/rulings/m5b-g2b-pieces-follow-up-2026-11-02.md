---
status: absorbed
milestone: m5b
absorbed-into: docs/03-roles-permissions.md (permission matrix: a place's pieces), docs/04-data-model.md (Place: pieces edited, removed, a return visit; place.show / place.hide retired), docs/05-features.md (The room's GM layer), docs/06-screens-and-design.md (Room GM layer; mockup m5-gate/b1b-edit-piece), docs/08-roadmap.md (M5b: g2b), docs/09-decisions-log.md (2026-11-02)
supersedes: parts of docs/plans/m5b-g2-place-pieces.md Departures 2 (a return visit no longer starts with nothing shown) and 7 (the two whole-place commands no longer stay registered)
---

# Place pieces, the follow-up to g2 (design ruling, 2026-11-02)

Francis ruled three things while merging g2 (#240, 2026-11-02): pieces are editable after they're added; coming back to a place brings back the pieces shown last time; the old whole-place Show players / Hide commands are retired. This file writes them down and rules what they need around them. From `docs/plans/m5b-g2-place-pieces.md` (Departures 2, 3, 7), the mockup `design/mockups/m5-gate/b1-show-pieces.html`, 03–06, and the merged `placePlay.ts` and `20261102100000_m5b_g2_place_pieces.sql`. Ids `gp-1` … `gp-7`.

## A. Editing a piece
- **gp-1 Where and how.** Tapping a piece's **text** (anywhere on the row but the eye) opens the **Add piece sheet in edit mode**: title "Edit piece", the kind chips and the text filled in, **Save** in place of Add. One undoable command, `place.editPiece` (Verbose, the GM's line; Undo restores the previous kind and text). The eye keeps its own job. Mockup: `design/mockups/m5-gate/b1b-edit-piece.html` (the same sheet; the title, Save and a quiet Remove line are the only differences).
- **gp-2 A shown piece that changes updates quietly** on the players' Scene, in its place in the order shown — no marker, no toast: the GM is narrating and a correction should read as if it had always said so. (The log keeps the old words.)
- **gp-3 Removing a piece is retiring, not deleting.** The edit sheet's quiet **Remove this piece** line sets the piece's `undone` flag (the column g2 made): it leaves the card and every visit's shown list, players stop seeing it at once, the log line keeps its words, and Undo brings it back with its shows. Nothing is deleted; CLAUDE.md's closed list is untouched. Command `place.removePiece` (Verbose).
- **gp-4 Who:** the GM only (03), as every place command.

## B. Coming back (gp-5)
- **gp-5** A place is the campaign's (one place per name, 04), so a return visit is **the same place id, by any group, in any expedition**. A new visit to a place that was visited before starts with **what was shown at the end of the place's most recent visit** (by whichever group was there last: the party as a whole knows the room): those pieces are shown again, in their old order; pieces **hidden by the end** of that visit stay hidden; pieces **added or edited between visits** are hidden until the GM shows them (one tap, as always); removed pieces don't come back. One log line, "Back at <place> · N pieces shown again", Verbose, with Undo (hides them all; the GM can then show piece by piece). The per-visit model stands (g2 Departure 2); only the visit's start changes. Where now? to a place never visited starts with nothing shown, as today.

## C. Retiring the whole-place commands (gp-6)
- **gp-6** `place.show` and `place.hide` are **retired**: taken out of `PLACE_COMMANDS` and the undo registry (nothing has called them since g2), and their two rows **deleted from `public.logged_commands`** in a new migration (Francis OK'd it in plain words on 2026-11-02: those rows are the app's own command list, not anyone's data; the precedent is `20261102202000_m5b_0c_no_ask_allow.sql`). The **log keeps their earlier events** and the words that render them (`events.ts` keeps both names in its word tables), so old lines still read "Shown to players: <place>" as before. Supersedes g2 Departure 7.

## D. Not changed
The eye button, + Piece, Hide all and the header count; `scene_pieces` as the players' only read; Verbose levels; the GM-only facts' columns (no field to type them until M8b).

## ⚑ for Francis
None new. Two calls he may overturn: gp-2 (quiet update rather than a "changed" mark) and gp-5's "any group" (rather than the same group only).

## 09 lines
See `docs/09-decisions-log.md`, 2026-11-02 (four lines tagged [places]).
