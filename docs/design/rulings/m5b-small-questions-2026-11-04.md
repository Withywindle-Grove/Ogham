---
status: absorbed
milestone: m5b
absorbed-into: docs/05-features.md (At hand; creation Gear), docs/06-screens-and-design.md, docs/07-content-packs.md (settlements, rest), docs/09-decisions-log.md (2026-11-04), docs/plans/options-gates.md and docs/plans/m5b-0c-creation-rebuild.md (Departures)
supersedes: —
---

# Small questions of 2026-11-04 evening (design ruling)

Four from Build's evening builds (#441 options-gates order 4; #442 creation PR J) and one from the pack session (sf-2's classic-advanced heal). Francis ruled all five as recommended, in one word. Ids `sq-1` … `sq-5`.

- **sq-1 Dungeon-exit depth stepper starts at 0.** "Levels below the first": the first level is 0 below, so 1 means the second level and the modifier reads from there.
- **sq-2 "Use safe paths" is logged now** (of-5 says so; it wrote nothing). A small follow-up PR: the event, its database function and its `logged_commands` row, one migration, test project first. Why now: a rule the spec says is logged and isn't is a log-integrity gap the gate's log checks would hit.
- **sq-3 A kit roll with `distinct: true` toggles.** A second tap on a picked row untaps it at once; no "Pick a different one" message (Undo over confirm; the row's state says it all).
- **sq-4 At hand's weapon line opens a breakdown**, like every other figure (bq-2): the attack figure's parts (base, ability, magic, specialisation), with "Open <item> ›" at its foot; the item sheet one tap further. Same component as the other breakdowns.
- **sq-5 A setting with no rest-day activity keeps its full-day heal as text** (classic-advanced) until M7's downtime gives every setting a Rest action, its natural home; a wilderness rest day gets it with the rest flow. Not under `settlement.services`: a book rule shouldn't look like a shop service.
