---
status: absorbed
milestone: m5b
absorbed-into: docs/07-content-packs.md (Encumbrance: carry bonuses), docs/09-decisions-log.md (2026-11-05), docs/plans/m5b-area-2-app.md (Departures, PR 3), docs/plans/m5b-review-area-3.md (build order 15)
supersedes: —
---

# A carry bonus with two slot bands (design ruling, 2026-11-05)

One builder question from area-2 PR 3 (#433, slot bands), a follow-up to eq-6 and ga-1. Ruled with Francis (A, B, synthesis). Id `cb-1`.

**The gap.** eq-6: an item's `carryBonus` "raises its wearer's limit". With `encumbrance.slot.bands` (ga-1) there are two limits, equipped and stowed, and eq-6 doesn't say which. No pack has both today: the one-limit setting has the bonus items (invented example: **Ogre grips**), the two-band setting has no carry bonus and its books raise capacity by nothing (the pack session's text search, 2026-11-05).

| | The extra room goes to | Why not / why |
|---|---|---|
| A | The stowed band (as built in #433) | Reads as "I can haul more in my pack", like a container that adds capacity |
| B | The equipped band | "I can wear and wield more": no book case for it |
| C | Both | Doubles the bonus |
| D | The item names its band | Exact, but a new field nobody needs yet |

- **cb-1 (A, with a checker note).** With slot bands, a `carryBonus` adds its room to the **stowed** band; the load breakdown names it as before. `pack:check` **notes** any item with `carryBonus` when the stack's rules set has slot bands ("a carry bonus goes to the stowed band"), so the question returns to Francis when a real item exists. No band field on the item until one is needed.

**Build:** the behaviour is in #433 (merged). The checker note is after the M5b gate (`plans/m5b-review-area-3.md`, build order 15; under 1 turn).

Docs to update: 07 (Encumbrance), 09, `plans/m5b-area-2-app.md` (Departures, PR 3), `plans/m5b-review-area-3.md` (build order 15).

09: 2026-11-05 — [items] With two slot bands, an item's `carryBonus` adds its room to the stowed band; `pack:check` notes such an item in a banded stack; no band field on the item yet (cb-1; follows eq-6, ga-1) — No setting has both today; stowed reads like a container adding capacity, and the note brings the question back when a real item exists — `design/rulings/m5b-carry-bonus-band-2026-11-05.md`
