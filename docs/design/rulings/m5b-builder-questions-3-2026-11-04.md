---
status: absorbed
milestone: m5b
absorbed-into: docs/09-decisions-log.md (2026-11-04); the plans' Departures (m5b-6-settlements, m5b-fewer-links, m5b-0c-creation-survey, m5b-review-area-3, options-gates)
supersedes: —
---

# Open questions from the builders, 2026-11-04 (design ruling)

The build session's 19 questions (2026-11-04; its file in that session's scratchpad). The technical ones went back to Francis, who accepted the builder's recommendations (2026-11-04); the design ones are ruled one at a time with Francis and added below as they're ruled. Ids `bq3-<n>` follow the builder's numbering.

## Technical, the builder's recommendation accepted by Francis
- **bq3-3** An empty watch between two others isn't stored (A: no migration).
- **bq3-6** The trinket and PR 4's `{ name }` lines wait for the GM like a player's one-off; their own handling comes with PR 4 (B).
- **bq3-7** Confirmed: the details on the character's fields under `_details` through a `details` change on character.edit (the owner can change them after approval); the trinket on the creation record beside the kit, removed on a change of kindred.
- **bq3-10** Slot bands are built with the area-2 plan, not now.
- **bq3-11** Fields' `forRaces`: later, with `forClasses`.
- **bq3-12** "Adds a field" on the set-up step's rows: later.
- **bq3-14** "Off · the option" in the GM reference: later, with X3.
- **bq3-15** A list level with fewer spells than the count: later, in options-gates build order 4.
- **bq3-16** Patches' library entry kind: now, as PR 3b, once bq3-17 is ruled.

## Design (ruled one at a time with Francis, 2026-11-04)
- **bq3-1 (A) Which places can be Safe or Hostile:** every place has **Neither · Safe · Hostile**, a new place starting Neither; Safe or Hostile makes it a settlement place (the arrival card, the town screen), a safe room in a dungeon included. Step 6c goes ahead.
- **bq3-2 (A) The town procedure between expeditions:** only the clock moves; the town's checks (and the switches, sw-1 … sw-4) come due only while an expedition runs. Parts of the day: thirds from 06:00 (morning 06–14, afternoon 14–22, night 22–06). Gate-run check 48 tests the switches during an expedition.
- **bq3-4 (C) Split evenly with no night's length:** it asks "How many watches tonight?" (a number), then splits.
- **bq3-5 (A) Glamours counted twice:** a pack fix (no `known` count where the roll gives the glamour); whether rolls count toward `known` is decided in M7.
- **bq3-8 (a, with a nudge) "Chosen" magic armour before its base is picked:** equipping works when some base fits; the GM gets "Pick the base for <armour> (worn by <name>)" in Waiting for you; picking fills `baseId` (eq-1); if that base doesn't fit, the armour comes off with a line saying why.
- **bq3-9 (B) What counts as treasure:** a category the rules set's `encumbrance.treasureWeights` names, or an item with `treasure: true`; not placement in adventure treasure lists.
- **bq3-13 (A) The audit's rows without a build order:** A1 (`requires`) now and A3 (encumbrance follows a later rule change) and A8 (presets) in options-gates (M5b); A4 (the attack field follows the AC style) with the sheet's Combat tiles (sr-1); A5 (the proficiency penalty) in M6.
- **bq3-17 (A) What a patch does (of-14, filling in of-13):** (1) `change` names a dotted path (`"armour.ac"`); (2) `delta` on dice adjusts the modifier ("1d8" −1 → "1d8−1"), on a field the entry lacks nothing changes and `pack:check` warns; `times` multiplies (price ×10); (3) two patches on one field: deltas and multipliers add, set values follow the pack on top (eq-4); (4) a patch applies after the entry's own `byOption`; (5) it reaches every attached pack's entries, its own included, and the winning copy; (6) a removed entry a character carries stays by name, marked "Off · <choice>", not equipped or used, nothing deleted (hard rule 4); (7) every figure a patch changes names it in its breakdown ("Damage −1 · bone, <pack>").
- **bq3-18 (A) A background's spell roll** opens under the background's pick, on its own step (amends rc-2's "added to the Magic step").
- **bq3-19 (B) A background's dice money:** later, when a pack uses it; `pack:check` notes dice money; the entry's pop-up says to roll it and the GM adds it.
