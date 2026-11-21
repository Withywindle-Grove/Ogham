---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (Rules overlay packs; Patches in detail), docs/09-decisions-log.md (2026-11-04), docs/plans/m5b-6-settlements.md (Departures)
supersedes: —
---

# A rules overlay's rules-set fragment, and patches that set objects (design ruling, 2026-11-04)

Two questions from the pack session's area 6 (the zine overlay on classic-advanced through `meta.requires`). Ruled with Francis (A, B, synthesis). Ids `ov-1`, `ov-2`.

- **ov-1 (synthesis) A rules overlay may carry a rules-set fragment.** `rulesSets: [{ id, extends: "<the required setting's rules set id>", settlement?, downtime?, … }]`: any rules-set field. Merge: **lists merge by id** (the overlay's entry wins on the same id, a new id is appended); **scalars: the pack on top wins** (eq-4). An entry in such a list may carry `option` like any entry (of-3/of-12), so a service tied to an overlay option shows only while it's on. `pack:check` lists the overrides ("<id>: <overlay> replaces <setting>'s"). The app reads fragments where it reads the rules set (the settlements plan, a small follow-up after the M5b gate; until then an overlay's town data is GM-panel text). Not taken: keeping overlay town data as text (the town screen would never see the one stack we play).
- **ov-2 (technical) A patch may set an object and a flag.** An of-13 `patches[].change` may set `value` (an object) and `forSale` on items matched by id under `byOption`; `pack:check` accepts object values on `change`.
