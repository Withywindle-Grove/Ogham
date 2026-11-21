---
status: absorbed
milestone: m5b
absorbed-into: docs/09-decisions-log.md (2026-11-03), docs/plans/m5b-0c-creation-survey.md (PR 4), docs/plans/test-seed-campaigns.md (Departures)
supersedes: —
---

# Input from the seeded test campaigns (design ruling, 2026-11-03)

The tester's `npm run seed:test` built 16 "Seed ·" campaigns (292 characters) on the test project and raised one question and two observations. Ids `si-1` … `si-3`.

- **si-1 (covered by of-2)** First spells with an option asking for picks at an empty list level (cantrips with no pack supplying level-0 spells; a class's `known` level with no spells): the group shows "No spells at this level in your packs" and **doesn't block Next** (`design/rulings/m5b-options-format-2026-11-03.md` of-2, the safety net; built in `plans/options-gates.md` PR 2). The data fixes (one cantrips switch; `known.listLevel`) are with the pack session.
- **si-2 (A) A kit item the class can't use** (often in a stack of packs): the kit is taken whole; the item goes into the pack **carried, never worn or held**, and the kit row says so at the Take ("<item> · your class can't use it · carried"). The pack session's data check fixes mismatched kits at the source; this is the safety net.
- **si-3 (A) The seed buys gear in shop campaigns** (test data, not a player rule): through the app's shop commands and within the starting money, the cheapest armour and shield the class may use, one weapon it may use, a backpack, a week of rations and a light source; then worn and held as the seed already does.
