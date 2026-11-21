---
status: absorbed
milestone: m5b
absorbed-into: docs/03-roles-permissions.md (permission matrix: a table marked `gmOnly: false`), docs/05-features.md (Guided creation, First spells), docs/06-screens-and-design.md (Guided creation header, Spell picker), docs/07-content-packs.md (GM-only sections; tables' rows `spells`; `firstSpells.rollTable`; Who reads it), docs/09-decisions-log.md (2026-11-02), docs/plans/m5b-0c-creation-rebuild.md (Follow-up to slice 4)
supersedes: —
---

# First spells rolled on a table a player can't see (design ruling, 2026-11-02)

From slice 4's scope checks 1–3 in `docs/plans/m5b-0c-creation-rebuild.md` (PR #262). Francis asked the design agent to rule A, B, C or better; ruled by the agent at his request, 2026-11-02 — he may overturn any line. Ids `fs-1` … `fs-3`.

**The problem.** `firstSpells.rollTable` names a pack table; tables are the GM's (07, 03), so a player making a character never sees the rows and the Roll dN group can't appear for them. Setting B has two such classes (a d6 of whole spell books; a glamour table plus a rune table).

**Options weighed.** A — the database lets players read any table a class's `firstSpells.rollTable` names (the rule has to walk every class of every attached pack). B — the pack copies the roll onto the class (`firstSpells.roll`): no migration, but the same rows live twice (the GM's table list and `uses` already show them) and two shapes mean two readers. C — the player skips it and the GM fills the book later: needs a GM's spell-book editor that doesn't exist yet and leaves a caster spell-less at approval.

## Rulings
- **fs-1 A′: the pack says which tables players may read.** A table may carry **`"gmOnly": false`** (default true, as today). The database lets every campaign member read such a table; every other table stays the GM's. `pack:check` warns when a `firstSpells.rollTable` names a table without it. One small read-rule migration (Fable); the pack session sets the flag on setting B's two starting tables (and nothing else). Why over A: the rule reads one flag, not every class. Over B: one copy of the rows, one reader. Over C: creation finishes at the table, as every other step does.
- **fs-2 A roll row's spells are `rows[].spells: [spell ids]`**, the only field; the step reads nothing else (the `spellId` and name fallbacks go). A whole-book row lists every spell of the book; all go into the spell book on one tap. `pack:check` warns on a `rollTable` row with no `spells`.
- **fs-3 `rollTable` is one table id or a list of ids, one roll per table**, groups in the list's order ("Roll d12 · Starting glamour", "Roll d6 · Starting lesser rune"). Slice 4's "one roll, one tapped row" stands per table; the mockup's "Roll d12 · twice" is withdrawn (◈ a `rolls` count per table: neither setting needs one).

## Not changed
The dice stay at the table (cr-9); a duplicate says "already yours · roll again" (slice 4 item 3); the GM's own session sees every table as before.

## Pack tasks (pack session)
Setting B: `"gmOnly": false` on the two starting-spell tables; the enchanter's `firstSpells.rollTable` as a two-id list (its `note` says so today); every row of both tables already carries `spells`. The converter writes the flag on any table a class's `firstSpells` names.

## 09 lines
See `docs/09-decisions-log.md`, 2026-11-02 (three lines tagged [packs], [characters]).
