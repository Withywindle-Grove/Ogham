---
status: absorbed
milestone: m5b
absorbed-into: CLAUDE.md (hard rule 4, the closed list), docs/09-decisions-log.md (standing rulings, deletion exceptions; 2026-11-03)
supersedes: —
---

# Undoing a yield: a fifth deletion exception (design ruling, 2026-11-03)

From PR #312 (M5b step 3, part 1, the players' activity buttons), its ⚑ A. `activity.apply` puts an activity's yield (for example rations found while foraging) into the finder's pack; `activity.undo` (ruled D3) takes it out. Removing the item line is a deletion, and hard rule 4's list of deletions is closed, so it needed a design ruling.

- **yu-1 (A).** Undoing an action that created an item removes that item **while nobody has touched it**; the log keeps a copy. Once any of it has been used, moved or split, Undo is refused with a toast that says why (as #312 builds it). This is the **fifth** named exception to "nothing erased", in the same spirit as items leaving play (exception 3) and the partial give's merge (exception 4): an untouched yield never really entered play.
- **Considered and not chosen:** marking the item `undone` and hiding it (the pattern gp-3 used for place pieces) keeps the closed list shorter, but every item reader would have to skip ghost rows; and no Undo for yields at all, which breaks "Undo works the same everywhere".
