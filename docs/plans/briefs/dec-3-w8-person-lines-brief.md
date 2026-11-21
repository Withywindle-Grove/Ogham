# Brief: W8's data, a person's revealed lines (pp-1; data and logic only)

If a guard, a hook or a permission check blocks you, stop and report to the Builder. Do not reach the same end another way: not with another tool, another branch, another session or another command. After a combined command is refused you may run its ordinary parts one at a time as plain commands, leaving out anything that deletes, restores or reaches outside your folder (gd-4); a plain part refused means stop.

**For:** a local builder, on a branch from main that already holds the `npc` kind and W4b/W4c (`docs/plans/briefs/dec-3-w4b-w4c-place-in-town-brief.md`, "the W4b brief" below; its store, its "shown now", its reset marker and its rules trigger are used here, not copied); the Builder's route (a pull request against main, the same branch merged into the town stack after review). **Row:** the data under W8 of `docs/plans/dec-3-the-whole-town.md`. **Mockup:** none: data and logic only. Stop before any screen: the box, its eyes and a person's own sheet are W8's screen, built later from page 19's frames, and np-2's sheet has no approved picture yet.

**Before any SQL:** read this whole, then tell the Builder any hole you see. That round has caught every fault so far.

**Second version, 2026-11-15.** The first had one rewritten body per person. Its second read failed: a piece's body is shared by every group, so one group would have read lines revealed to another. Below, **each line's eye is a row of the W4b store, for one visit, and the read composes the text.** The mistake was the lead's.

## Francis's words that bind (2026-11-14)
- **np-3** ("No placeholders, yes"): a player's view of a person shows only the lines the GM has revealed, with nothing to mark a hidden one.
- **tr-1** ("Yes to both"), the lead's limits: a player reads while **their group** is in that town; exactly what a shown piece sends today; no person unless written into a shown piece; a place one level under the town of the group's current visit; nothing after the group leaves.
- **np-1, np-4:** a person's short form is a heading "Name—Role", a paragraph of description, then labelled lines (Demeanour, Speech and Desires always; others optional). A group keeps its own lines.
- **ge-1:** every check of the GM's show stays.

## The lead's ruling this builds (pp-1, as corrected)
**One piece per person; one row of the store per revealed line, per visit; the text a player gets is composed when it is read.** No person id that players can read, no reliance on the order of pieces, and nothing revealed to one group reaches another.

## What to build

### 1. A person's piece, made from the pack
When a place in town is made from the pack (lazily, as the W4b brief says), each person the pack ties to that place gets **one** piece of kind `person` on that place, by a **separate function called after** `make_place_from_pack` (which is not edited). The piece's `body` is the fixed neutral words "Someone is here." and its **`lead` is null**: the piece row itself holds **nothing of the person**, not the name. How the pack ties a person to a place is whatever the `npc` entries and the location entry already carry, matched by entry id: say in the status file which field you used; if none ties them exactly, stop and ask: never by name. People of a place that is not a place in town are not touched.

A small GM-only table of this work's own ties such a piece to its `npc` entry (the piece, the pack and the entry's id): the GM's policies only, no player policy, never returned to a non-GM by any function, nothing deleted. "A pack person's piece" below means a piece with a row there.

### 2. A line's eye is a row of the store
The W4b store has a `line_key` (empty for a whole piece). This work, by a new migration, lets the store's rules trigger accept a **non-empty `line_key` only for a pack person's piece**, and only a key that names a line of that person. **The keys, from the pack as it is (the Pack Creator's read of the port pack, 2026-11-15):** `description` for the entry's `playerView.description`; and, for each line of the entry's `gm.leads` (a list of `{ lead, text }`), the `lead` word itself as the key ("Demeanour", "Speech", "Desires", and where present "Knowledge", "Beliefs", "In a fight" and the like). The lead word is also the label. If one person has two lines with the same lead word, stop and ask. **`gm.portrait` is the GM's alone: it has no key, no eye, and is never read by the compose function.** A person is tied to their place by `npc.locationId` equal to the location entry's id; a person with no `locationId` gets no piece. And it makes the trigger refuse, for a pack person's piece, a row with an **empty** `line_key`: such a piece is never shown whole. Every other rule of the trigger (the live, current, under-way visit when shown turns true; the database's own shown time; one level under the town; the same campaign) applies to these rows unchanged, as do "shown now" and the reset marker, per row.

### 3. The command: open or close a person's line (ge-1)
A new command and function, with `can(user, command, target)` and an event, logged for the GM alone; or W4c's own function taking a line key: say which, and do not copy its checks into a second place. Checks: exactly W4c's (the GM only; the group's visit exists, is live, is the group's current place and the expedition is under way; the same campaign; the place one level under the town; the piece live; a repeat changes nothing; the request tag answered once), **plus:** the piece is a pack person's piece and the key names a line that person has. It writes one row of the store for that visit, piece and key. Undo puts that row back as it was. The log line names the person and the line's label, for the GM alone. Where the store's own rule refuses an Undo (a hide undone after the expedition has ended, the W4b brief's ⚑), the Undo fails whole with the store's words: do not work round it.

### 4. What a player reads
W4b's pieces read changes in **one** place: its fifth test ("the piece is not of kind `person`") becomes: a piece of kind `person` is sent **only if it is a pack person's piece with at least one line "shown now" on that visit**; any other `person` piece (made by hand, or from the pack's own location text) is still never sent by this read. **For a pack person's piece that same condition also stands in place of W4b's third test** (the piece itself "shown now" with an empty key, which such a piece can never be). Every other test of the W4b brief (1, 2, 4, 6, the visit, the group) stands. Pieces come out in the order W4b's read already gives pieces.

For such a piece the read returns the same columns as for any piece, with:
- **`body` composed at the read**, by one private function, from the pack's `npc` entry and the lines "shown now" **on that visit**: a heading, then those lines only, in the box's order (description first, then Demeanour, Speech, Desires, then the optional lines in the pack entry's order), each as its label and its text. **The alignment** (pf-27): where the entry carries `alignment`, the Demeanour line's label is "Demeanour (Lawful)" and it goes out only with that line; where it does not, the Demeanour text prints as the pack wrote it and the app lifts nothing out of prose. The function reads from the entry **the text of exactly the keys shown now and the name, and nothing else**, wherever the entry keeps them (its readable part or its GM-only part: a line the GM chose to reveal is revealed); the optional keys are those the entry itself carries; the labels are the ones the GM's box prints, defined in this one function. **A line not shown now leaves no trace:** no label, no gap, no blank line, no count, no "…". The stored body ("Someone is here.") is never what this read sends.
- **The heading** (np-6, Francis, 2026-11-15: asked whether the heading may show the role as well as the name, "A the name only / B name and role, as your box shows it", he answered "B"): **"Name—Role" as the GM's box prints it**, the dash kept with the name; a person with no role, the name alone; sent with the first line shown. Keep the heading's make-up in that one function.
- **`lead` null.** The piece's id as for any piece. The entry's key of the place, as W4b sends it.
- The text goes through `private.plain_link_text`, so a link inside a line goes out as plain words and never an entry id.
- Never: the `npc` entry or its id; the role anywhere but the heading; any line not shown now; which keys exist; the tie table.

The GM's read of the eyes (W4b's GM-only function) returns, for a pack person's piece, the line keys shown now.

**The ordinary eye never shows a pack person's piece.** `show_place_piece`, `private.piece_show_rules` and the old readers are untouched (the W4b brief), and they do not look at a piece's kind; so, by **one new trigger of this work's own on `piece_shows`**, a row for a pack person's piece can never be shown there, at an insert or at an update that turns shown on (the trigger's function is security definer, since it reads the tie table inside whoever's request) (np-3: no placeholder, so "Someone is here." must never reach a player). Before writing it, find every function that writes `piece_shows` (`show_place_piece`, `back_at_place`, `private.follow_into_group`, any "show all"): if one writes many rows at once, the trigger must not make that whole action fail (skip the row) and the status file says so; if only the single show writes, refuse with plain words. For today's data it changes nothing: no such piece exists yet. Test: with the party in that very place, the GM's ordinary show of a pack person's piece shows nothing, and no player's read by any old reader contains "Someone is here.".

### 5. Not in this row
Any screen. A person's own sheet (np-2). The long form. People anywhere but a place in town. Any change to `player_facing` (`npc` stays off it), to the library's read rule, to `place_pieces`' rules, or to any existing function other than W4b's own (its pieces read, its GM read, its store's rules trigger, each by a new version in a new migration); the one thing added to an existing table is the new trigger on `piece_shows` in step 4. The store's `line_key` and its uniqueness by visit, piece and key are W4b's (asked of the Builder on 2026-11-15); if the store was applied without them, stop: that change needs Francis first.

## Tests (database, and the stand-in the same)
- With Demeanour and Desires shown, a player in the town reads one piece whose body is the heading "Name—Role", the Demeanour line and the Desires line, exactly (assert the whole body). The description and every other label and text of that person appear nowhere in the player's whole payload.
- Closing one of two lines: the body loses exactly that line. Closing the last: the player reads no piece of that person.
- No line ever shown: nothing of the person reaches a player by W4b's reads, `scene_pieces`, `known_places_campaign`, `campaign_library`, the tables.
- **Two groups in the same town:** a line shown to group 1 is not in group 2's body; group 2 with no line shown reads no piece of the person.
- **After a reset** (a group number emptied and filled by another player): the new player reads none of the lines shown before; one line shown anew gives a body with that line only.
- A new visit to the town starts with no line shown.
- The store refuses: an empty `line_key` for a pack person's piece; a non-empty one for any other piece; a key the person does not have; a line shown with no expedition under way or on a moved-on visit, by the command and by a GM's direct write.
- The tie table: a player, a player of another group, an outsider and another campaign read none of it and cannot write it. The piece row holds no name, no role and a null lead.
- Two people of one place: each has its own piece; a line of one changes nothing of the other.
- Undo of an open and of a close. A repeat changes nothing. Refused for a player.
- A `person` piece made by hand is never sent by W4b's reads.
- A line whose text holds a link goes out as plain words with no id.
- Every W4b and W4c test still passes.
- Permission cases both ways in `src/testing/permissionCases.ts`.

## Paperwork
NEW migrations only, timestamps from the Builder. The test database first, through the Builder's database session; the main database only on Francis's word for the push, under np-3, tr-1 and ge-1, and only if the dry run shows these migrations alone. No line in `docs/09-decisions-log.md` (dl-1). A status file with its ⚑ list, the field that ties a person to a place, every reader of the tie table, and what was not tested.

If unsure, stop and ask the Builder; don't guess.
