---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (the uses registry, `creation.names|details|trinket`, `join`), docs/06-screens-and-design.md (name tables at creation, "Optional, from <pack>"); docs/09-decisions-log.md (2026-11-06); ct-1, ct-2, ct-8 are pack content
supersedes: cs-1's "creation tables come only through the race" (they may now also come from any attached pack)
---

# Creation tables from any pack (design ruling, 2026-11-06)

Ruled one at a time with Francis on 2026-11-06, for the private **Table Generator** pack (alias `table-generator`: tables only, Homebrew, no `requires`, no rules set). Ids `ct-1` … `ct-8`. Closes G-201 and G-192; G-202 stays open. Plan: `docs/plans/m5b-creation-tables.md`.

- **ct-1 The pack's scope:** the book's creation tables and its GM-side tables (for prep and ad-hoc creation), setting-agnostic: usable beside any setting. None of the book's own rules, classes, items or spells. A setting pack from the same book would be a second, separate pack.
- **ct-2 Careers are flavour only.** A career is a background line; nothing is added to the pack. Its items are shown lightly, under one lead-in on every entry ("Things you might carry or know your way around: …"), never as starting gear.
- **ct-3 The tables apply to every race.** A race's own tables win, slot by slot.
- **ct-4 The names are offered at creation,** optional like the rest.
- **ct-5 A table declares its creation slot in `uses`:** `creation.names`, `creation.details`, `creation.trinket`. Creation offers any attached pack's table for a slot the chosen race doesn't fill; between packs the GM's pack order decides.
- **ct-6 Optional, and it shows:** each offered table is headed "Optional · from <pack>", and Next never checks them (they can't stop a player moving on). The app never rolls: the player rolls at the table and taps the row, as today.
- **ct-7 A name table says how its columns join** (`join`, default a space): two halves of one word join with nothing between them, at creation and in the GM's Tables (G-192). **The seam's hyphens** (ruled A): the pack keeps the book's cells ("Adder-", "-bald"); with an empty `join` the app drops one hyphen on each side of the seam ("Adderbald"). A name meant to keep its hyphen can't be written this way (use a space join, or cells without hyphens). Built on both paths in PR #529. **As built:** details are one slot (a kindred's own details list wins whole; otherwise all of the first offering pack's details tables); with no kindred chosen nothing is offered; growth stays the kindred's own.
- **ct-8 Careers come through an optional rule the pack carries:** "when this pack is loaded into a campaign it should have an optional rule for the career field" (Francis). On: the sheet gains a Career field fed by the careers list, and creation asks it as an optional pick. Off: no field, no step. **On by default** (Francis: "attaching the pack gives every character a Career field, and the GM can switch it off"). It is pack data only, no app code (the builder's read of main 677fdd6a): a top-level option and a `fieldTemplates` field `{ type: list, from: <the careers list>, option: <the option> }`, the shape the zine uses for its combat talents. Accepted as they are: the field appears once the GM accepts "Use this sheet layout" for the pack; a campaign that already has a Career field keeps its own; a campaign that had the pack before must press "Use this sheet layout" on its row.

## Still open

Details typed over (today a detail is the tapped row; a name can be typed over); clothing and archetypes at creation or only in Tables; the book's spell list as a reference table; a switch to keep a pack's tables out of creation (only if a GM asks).

## 09 lines

- 2026-11-06 — [packs] Creation offers names, details and trinket tables from any attached pack, by a slot on the table's `uses`, where the chosen race has none of its own; each is headed "Optional · from <pack>" and never blocks Next — a system-neutral tables pack can serve any setting (ct-3 … ct-6, G-201)
- 2026-11-06 — [packs] A name table says how its columns join (`join`, default a space), at creation and in the GM's Tables — a name printed as two halves reads as one word (ct-7, G-192)
- 2026-11-06 — [packs] The Table Generator pack: creation and GM tables only, setting-agnostic; careers are flavour, their items shown lightly; a career field comes through an optional rule the pack carries — Francis (ct-1, ct-2, ct-8)
