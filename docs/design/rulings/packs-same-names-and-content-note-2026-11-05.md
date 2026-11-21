---
status: absorbed
milestone: m5b (both built after the gate)
absorbed-into: docs/07-content-packs.md (packs together: same names; `meta.contentNote`), docs/09-decisions-log.md (2026-11-05), docs/plans/after-m5b-gate.md, docs/06-screens-and-design.md (Name's source)
supersedes: —
---

# Two rulings for packs that add to a setting (design ruling, 2026-11-05)

Raised by the pack session while preparing the next add-on to classic-advanced; both are Francis's own directions, written down with him. Ids `sn-1`, `cn-1`. Invented examples only.

- **sn-1 The same name in two packs.** Francis: "if they are truly identical, list only one; if they are separate, denote the source." Two packs in a campaign may each add an entry with the same name (invented: both add a kindred called **Marsh folk**, one swimming faster than the other).
  1. **Separate entries:** wherever both can appear (creation's pick rows, the rules browser, the sheet), each shows its pack's short name beside its own: "Marsh folk · <pack>". Only when a name is shared: ordinary rows are unchanged.
  2. **Truly identical entries are listed once:** the later pack does not add a second; it points at the first pack's entry by id.
  3. **Identical means** the same numbers and the same rules text. Anything less is separate.
  4. **`pack:check` lists every same-named pair** of the same kind across the packs it is given, so the choice is always made on purpose.
  5. **The same rule for every kind** a player or GM picks by name: classes, kindreds, spells, items, stat blocks. (A shared *id* is a different case and keeps eq-4: the pack on top wins.)
- **cn-1 A warning before a pack is loaded.** Francis: a pack's dark material stays as printed; the GM is reminded before loading it; nothing more. A pack may carry **`meta.contentNote`**, one or two lines in the pack author's words (invented: "This pack includes graphic cruelty and cults: agree limits with your players before play."). **It is shown at the top of the import preview, under its own heading, before the GM loads the pack.** No acknowledgement step, no second notice when a campaign adds the pack, no tags, nothing shown to players. A warning about a single entry stays in that entry's own text.

**Build:** both are small and come after the M5b gate (`plans/after-m5b-gate.md`).

Docs to update: 07, 09, `plans/after-m5b-gate.md`.

09: 2026-11-05 — [packs] Two entries with the same name from different packs each show their pack's short name, only where a name is shared; truly identical entries (same numbers and rules text) are listed once, the later pack pointing at the first; `pack:check` lists same-named pairs (sn-1) — Francis: "if they are truly identical, list only one; if they are separate, denote the source" — `design/rulings/packs-same-names-and-content-note-2026-11-05.md`
09: 2026-11-05 — [packs] A pack may carry `meta.contentNote`, shown at the top of the import preview before the GM loads it; nothing more (cn-1) — Dark material stays as printed; one reminder before loading is enough — `design/rulings/packs-same-names-and-content-note-2026-11-05.md`
