---
status: absorbed
milestone: m5b (built after the gate)
absorbed-into: docs/07-content-packs.md (items: `armour.type`; Encumbrance: the load's armour type), docs/09-decisions-log.md (2026-11-05), docs/plans/m5b-review-area-3.md (build order 14)
supersedes: —
---

# Magic armour that carries lighter than it wears (design ruling, 2026-11-05)

One question from the pack session (G-145, pack review area 3), ruled with Francis (A, B, synthesis). Id `al-1`.

**The case.** In fae-woodland, magic armour counts one category lighter for load and movement, while who may wear it follows its ordinary category. Invented example: **Gleamwoven mail**, medium to wear, light to carry. A Lantern Warden allowed only light armour still can't wear it; a warden allowed medium armour carries it as light. Four items in the pack. The pack already writes both: `armourType` (the ordinary category) and `armour.type` (the lighter one). The app read `armourType` for both, so the wear check was right and the load counted the heavier category. 07 didn't name `armour.type`.

| | Option | Why not / why |
|---|---|---|
| A | The load reads `armour.type` when present, else `armourType`; the wear check keeps `armourType` | No pack change; plain armour unchanged. But the field was undocumented and its name is a near-twin: a typo would change a load silently |
| B | A new explicit key (`armour.loadAs`) | Clearer, but a new format word and a pack change for a field that already exists with this meaning |
| C | Text only | The load stays wrong for the four items |

- **al-1 (synthesis).** A's behaviour, made safe:
  1. **07 names `armour.type`:** the category an armour **carries as** (load and movement); it defaults to `armourType`. Who may wear it always follows `armourType`. No new format word.
  2. **`pack:check` lists** every item whose `armour.type` differs from its `armourType` (a list, not a warning), so a typo shows.
  3. **Chosen-base armour** (`armourType: "chosen"`) carries as the picked base, unless the item names its own `armour.type`.
  4. **The load breakdown says why** in words: "Gleamwoven mail · carries as light · magic" (the pack's own category words).
  5. **Built after the M5b gate** (`plans/m5b-review-area-3.md`, build order 14; about 1 builder turn, no migration): four magic items, and the gate's magic-armour checks test the wear rule, not the load.

**Correction (designer, same day):** 07 did list `type` in the `armour` block ("light, medium or heavy", ruled 2026-10-29) without saying what reads it; "07 didn't name `armour.type`" above and option A's "undocumented" overstate it. The ruling is unchanged: 07 now says what the field means, in both places.

**Not checked by the designer:** the app code. "Nothing reads `armour.type`" and "a one-line change" are the pack session's findings; the builder confirms both in the plan's Departures.

**Pack session:** nothing to change in the packs. Mark G-145's row in 11 "ruled → al-1, after the gate" in #397.

Docs to update: 07 (items, Encumbrance), 09, `plans/m5b-review-area-3.md` (build order 14).

09: 2026-11-05 — [items] An armour's `armour.type` is the category it carries as (load and movement), defaulting to `armourType`, which alone decides who may wear it; `pack:check` lists items where the two differ; the load breakdown says "carries as light · magic"; built after the M5b gate (al-1, G-145) — The field already exists in the packs with this meaning; naming it in 07 and listing differences makes a near-twin name safe without a new format word — `design/rulings/m5b-armour-load-type-2026-11-05.md`
