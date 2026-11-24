# Plan: the full sheet revised, sheet edits approved, the GM rail's glow

Written by the design agent, 2026-11-08, evening. Rulings: 09 lines of 2026-11-08 (evening: the sheet reordered, details look A, sheet edits, GM rail A2). Mockups: `docs/design/mockups/players/05-full-sheet-revised.html` (approved: the sheet, look A, Edit and the waiting state, the language and notes sheets), `docs/design/mockups/gm/01-rail-attention.html` (A2 approved). Francis tests these before the gate rewalk (~Wednesday). Two pull requests; the first carries a migration (his push).

## PR 1 · the full sheet (m5b-sheet-revised)

### A · Order and contents (player view, tablet two columns, phone stacked)
1. **Left column:** avatar (tap → portrait sheet, #566) · name · "<Title>, <Class> <level>, <Kindred>" (the title moves here from Advancement) · the HP box (#566's − +, the pip bar under) · AC and Attack tiles · "Tap a figure for where it comes from". Nothing else.
2. **Right column, in order:** Edit (plain) · Level row with the experience bar · **Saves** (the pack's save tiles) with one line under: the rules set's one-sentence roll rule ("Roll d20, equal or over the number."), the first sentence of the pack's text · **Scores** tiles with the plain modifier (+2), the breakdown sheet on tap listing everything the score changes · **Movement**: two cards side by side, the speeds and the load tier with the bordered load bar and "640 of 1,600 coins" · **Languages** as boxes (44 px), tap → the pack's text, where it came from, source; one line under: literacy in words from the pack's literacy rule, no sheet · **Skills**, **Abilities**, **Traits**: each one column of rows (name left 16 px, figure right Garamond 22, dotted rule), the row the tap to the full rule (the existing SkillSheet / ability text); Abilities holds the class abilities, the **experience bonus** ("+10 %", tap → the prime table) and the secondary skill where the pack has one · **Details and backstory**: look A (labels in a muted column, values in Garamond, backstory as a paragraph with a drop capital), with the pack's own detail fields · **Notes** button with "n notes, last one <when>" → the Notes sheet.
3. **Removed from the sheet:** hit dice and derived-save tiles ("Wisdom vs magic"), the pack's fold rows (Worn and in hand, In the Backpack, Carried), the Identity row (alignment moves to Traits; literacy to the Languages line; secondary skill to Abilities), the Advancement block (title to the name, experience bonus to Abilities), the "Change details" button, the Literacy sheet.
4. Tiles and rows reuse the inventory parts (Score tile, Fold row where any, kv row); the row is the **Skill row** variant already in the Player screen's Skills, without the chevron.

### B · Edit with approval
5. **Edit** is one screen on the standard: Scores (tiles, tap → stepper sheet), Max HP (stepper), Level (GM-only; shown as a line "Level 1, your GM changes it"), then Details last (rows, tap → text sheet; the backstory a long text). Cancel and **Send to the GM** (the one accent) in the foot; the foot counts "n changes, m need approval".
6. **Details save at once** (a logged command, Undo). **A score or Max HP** change is a request: a new logged command `sheet.requestChange` with the field, old and new value; the sheet shows the old figure, the tile marked "17 waiting", and a line at the top: "Waiting for your GM: Muscle 16 → 17. Sent today." with **Take back** (withdraws, logged). The GM's Players tab lists it under Waiting for approval with the same Approve / Refuse as a new character's exceptions (`sheet.approveChange` applies it, logged; Refuse records a reason, the player's line says why). Approved or refused: a toast for the player.
7. **Migration:** the request rows (a table or the existing approvals table if it fits; the Builder decides and says) and the two `logged_commands` rows; nothing dropped. Test project first; Francis pushes main before merge.

### C · Notes sheet (minimum)
8. The Notes button opens a sheet listing the character's notes newest first (when, by whom), the GM's notes-to-the-player included, GM-only notes never; a field and **Add** (the sheet's accent). This is the existing notes data; the notes design session decides the rest (tags, the Log, sharing), not this PR.

## PR 2 · the GM rail's glow (m5b-gm-attention)
9. A rail or tab-bar icon whose tab has something to act on draws its glyph in the glow token with a slow breathe (2.4 s ease-in-out, drop-shadow 2 → 8 px); `prefers-reduced-motion` makes it a still glow. The accessible name says what waits ("Players: 1 to approve").
10. **What lights it:** Players: a character waiting for approval, a sheet change waiting (B), a join request, a rules question; Scene: a player's prompt to answer (a yield to accept, a vote to call); Rules: a homebrew suggestion from a player's Other…. Each tab lists what lit it at the top. The glow goes out when that list is empty, never on a visit.
11. The selected tab keeps the glow while its list is not empty.

## Technical fixes (either PR)
12. GM Players tab, iPad: the left column's bottom stays partly cut off after scrolling to the end (padding under the last card).
13. #566's ⚑: limit words as the Builder proposed ("0 of 8, the lowest it goes"; "at the most already, 8 of 8"); 06's tap-budget row for Take damage → one tap per point; the HP pip bar caps at 20 segments and becomes a bar beyond.

## Rests on
#566 (HP in place, avatar, ring symbol); #565 (skill text); the Score tile and Breakdown sheet (D); the GM's approval card for a new character (its Approve / Refuse); the notes data as it is.

## Tests (purpose first)
- The sheet's sections come in the ruled order on tablet and phone; the removed blocks are absent.
- The title shows by the name and nowhere else; the experience bonus is an Abilities row.
- Every skill, ability and trait row opens its full text; a language box opens the pack's text.
- A details edit saves at once with Undo; a score edit creates a request, the tile says "waiting", Take back withdraws it; the GM's approve applies it and the refuse records a reason; both toast the player.
- The glow appears when something waits and goes out when the list empties, not on opening; reduced motion gives a still glow; the accessible name counts.
- The Players column's last card is fully visible after scrolling (iPad landscape).

## Scope checks (write one and stop)
No new notes behaviour beyond the list and Add. No change to what a GM can edit. If the approvals table cannot hold a sheet change without bending its meaning, say so and propose the table. If a pack has no literacy rule, the line is not drawn (no app wording).

## ⚑
1. The experience bonus row with two primes: "+10 % (Charm 11, the lower prime)" as the figure, or just "+10 %" with the detail on tap? (Proposed: just the figure; the tap shows the table.)
2. Level on Edit: a line only ("your GM changes it"), as proposed.

## Estimate (for the Builder to confirm)
PR 1: A 1 day; B 1 day (with the migration); C half a day. PR 2: half a day. Technical fixes: half a day. About 3.5 days, one builder; Francis's push for B before merge.

## Departures
(The Builder keeps this current in the same pull request.)

PR 1 (m5b-sheet-revised), built 2026-11-08 with the two ⚑ as proposed (the experience bonus shows just "+10 %", the tap shows the table; Level on Edit is a line only):
1. **Migration: its own table, `public.sheet_changes`**, not `public.requests`. A request is the table's-time question (Scene, Town), its `kind` list is a check constraint that would have to be dropped and made again, and its Scene and Town lists would have to learn to skip a new kind; a sheet change carries a field and two figures, and approving it writes the character in the same change. The read rule: the GM and the character's player only; the log lines are the player's own. Nothing dropped.
2. **Four logged commands, not two**: `sheet.requestChange`, `sheet.takeBackChange` (Take back is its own), `sheet.approveChange` and `sheet.refuseChange` (so the log says "refused", with the reason, rather than an approval). Undo of a request marks it undone; Undo of an approval puts the figure and the request back in one change.
3. **One waiting change per figure**: asking again for a figure that already waits takes the waiting one back in the same change.
4. **Who waits**: only a player's change to their own approved character, and only for the rules set's own figures: the pack's scores, Max HP and the level (Design on #567, ⚑ 1). The GM's edits, and a player's before approval, apply at once (the foot's accent reads Save, or Done with nothing staged). Set max on the HP box (a character with no most recorded) waits for the GM like any Max HP change once the character is approved (Design, ⚑ 3); creation's own HP is approved with the character.
5. **Details on Edit** are the name, the kindred's details, every field of the GM's that isn't one of the pack's scores (a number field included: Design, ⚑ 1) and the backstory; each opens a one-field Sheet and saves at once, sending only that field (`character.edit`'s `field`), so a figure the GM approved meanwhile is never written back; Undo saves the old words back (a second `character.edit`, not the log's undo). The GM's ruling reason sits at the top of Edit.
6. **A worked-out figure no section shows** (other than hit dice and the derived saves) is an Abilities row with its breakdown on tap (Design, ⚑ 2).
17. **Enforced in the database** (review round on #567; `20261108210000_m5b_sheet_changes_guard.sql`, fix forward): `private.guard_rules_figures`, before an update of `hp_max` or `fields` on an actor, refuses a player's change to Max HP (from none too) or to one of the pack's scores (`private.score_keys`: the top rules set's `abilities`, as written and as field keys) once the character is approved; the GM, an undo, the database itself and an unapproved character pass. `request_sheet_change` asks only for a score whose field is in use, Max HP or the level; `answer_sheet_change` refuses Approve when the figure moved since the ask ("That's changed since") and writes the level. The app's `can()` mirrors it: `character.edit` refuses Max HP, the level or a score key (when the screen says which keys they are) from a player on an approved character; a full field set is the database's to check. *Note, 2026-11-21: "an undo" no longer passes once the character is approved; only the GM's does (ruled 2026-11-21, see `09`).*
18. **Send to the GM, part sent**: if a later change fails, the error line names what was sent and what wasn't, and Cancel waits while it sends; the steppers do nothing while busy.
7. **Kept, placed where the plan doesn't say**: Magic between Traits and Details; the class form switch under Level (it was in Combat); the GM's hidden fields as a second ledger under Details; a layout group named Abilities (scores the setting doesn't name) as a ledger under the Score tiles.
8. **Beside the Player screen** the play column is the left column, so its identity line gains the title there (only there); the sheet beside it is the right column.
9. **Sheet row figure**: 24 px Garamond (`--text-24`; the mockup's 22 isn't a token), a word figure 20.
10. **Movement's speeds card**: the first speed large, the others in one muted line; its tap opens the speed's breakdown with the rest listed. The load card is the Pack's Load bar part (`LoadSummary`).
11. **Literacy line**: "Literacy: <level>, <the first sentence of the pack's note for it>"; no line without a level or without the pack's `literacyNote`, and the literacy field then stays a detail.
12. **Notes sheet**: the campaign's notes about the character (`notes.about_actor_id`), newest first; the words once kept in the sheet's own Notes box show last as "On the sheet, kept from before" so they aren't lost from view. Notes written here keep the notes data's rule (every member reads them in the Log); the notes session decides the rest.
13. **A refusal** stays on the player's sheet until they tap OK (kept on that device).
14. **The HP box** is one part for both screens: the Player screen's burst, typing Sheet and Set max moved into `HpInPlace` (`src/app/HpInPlace.tsx`), which the sheet's left column draws too.
16. **A layout's Combat or Advancement group**: with no block of their own, what's left in them (a typed weapon proficiencies field) reads as a detail; a group named Abilities in a campaign with no scores does too.
15. **Technical items** 12 (GM Players tab: room under the last card at ≥1024 px) and 13 (the HP bar's cap at 20 segments; 06's tap-budget row 4) are in this PR; #566's limit words were already built as proposed.


PR 2 (m5b-gm-attention), built 2026-11-09:
1. **Players lights for everything already listed at its top**, not only the four named sources: the waiting characters and sheet changes (Waiting for approval), and Waiting for you (players' one-offs, worn armour's base to pick, players' requests). The name says each kind: "Players: 1 to approve, 2 to answer, 1 base to pick".
2. **Not wired, because the app has no such thing yet:** a join request (an invite link joins at once; nothing waits), a rules question (players have no way to ask one), a yield to accept (an activity's yield applies at once with Undo), a vote to call (votes aren't built). Scene and Rules therefore never light yet; `gmTabs` / `gmPhoneTabs` take the waiting by kind, so a source is one field when it arrives.
3. **Rules: a homebrew suggestion from Other… not wired.** Today it is Add to homebrew inside a waiting character's review card on Players (it already lights Players with that character). Listing it on Rules would need a list there and a way to put a suggestion aside without adding it (else the glow never goes out): new behaviour, ⚑ 2.
4. **Requests stay on Players.** A player's request (buy, sell, a secret activity, Things to do, an escape roll) is the nearest thing to "a player's prompt to answer", but Waiting for you lists them on Players (06); moving them to Scene is a screen change, ⚑ 1.
5. **Waiting for approval moved above the invites not used yet**, so what lit Players leads the tab (step 10; the mockup draws it right under the heading). Waiting for you stays first.
6. **Glow tokens**: the lit-light glow colour already existed (`--light-glow`); the halo sizes and the 2.4 s are new tokens (`--glow-rest`, `--glow-peak`, `--glow-still`, `--glow-breathe`). The still glow is the mockup's A (6 px with 2 px).
7. **The accessible name** of a lit tab is "Players: <what waits>" in place of "Players, 3 waiting for you"; the tablet's "3 waiting" and the phone's badge stay as they were.
