---
status: absorbed
milestone: m6
absorbed-into: docs/04-data-model.md (Combat: Encounter sides), docs/05-features.md (Combat tracker: Sides), docs/09-decisions-log.md (2026-11-05), docs/plans/m6-fights.md (slices 2, 4, 5, 10, 13; question 10 struck)
supersedes: —
---

# Named sides in a fight (design ruling, 2026-11-05)

The M6 plan's question 10, from the engine slice's Departure 4 (two sides only). Ruled by Francis: named sides. Id `ns-1`.

**Why.** Fights with a third party are part of play: neutral, hostile and friendly groups together (villagers fleeing, a herd stampeding through, guardians defending a space), or two hostile groups that also fight each other. Perhaps one encounter in ten; the other nine must not pay for it.

- **ns-1 (synthesis, with Francis's correction on neutral sides).**
  1. **Every fight starts with two sides**, the party's and the foes', and looks and plays exactly as designed. A further side exists only when the GM makes one: Add foes gains a **Side** choice (Foes · a new side). A new side takes its group's own name ("Reed bandits"); nothing is typed.
  2. **A side carries two things, set apart from each other:**
     - its **stance toward the party**: friendly · neutral · hostile. The GM changes it in one tap, logged, with Undo (the neutral villagers turn on the party).
     - **how it takes turns**: its own turn · with the party · sits out. Defaults: friendly acts with the party; hostile and neutral take their own turn. **A neutral side takes part like any other** (it flees, stampedes, defends its ground); "sits out" is the GM's one-tap choice for bystanders, and back.
  3. **Who a side fights is not modelled.** The GM picks targets and enters damage, as now.
  4. **Initiative, side mode:** with more than two sides taking their own turn, the GM taps the sides in the order they act; the last is implied. Ties and re-rolling follow the pack as for two sides. **Turns:** the party ends its own; the GM ends each other side's ("End Reed bandits' turn"); the round advances by itself when every side that takes turns is done. Individual initiative is unchanged: each actor has its own place.
  5. **Unchanged:** damage, statuses, notes, the death panel, morale (per group, from the pack's triggers), surprise (already one switch per side), Delay, We run, several fights.
  6. **What players see:** the Foes column gains a heading per side, by name. A side's stance stays the GM's unless shown (a "friendly" side can be a surprise); friendly sides acting with the party are listed with the party once shown as friendly.
  7. **Ending a fight:** outcomes are listed per side; XP waiting counts hostile sides by default and the GM adjusts.

**Cost.** The engine slice (2a, held) keeps sides as a list instead of two fixed ones: sized by the builder before 2b builds the tables. A short mockup pass for the GM's fight screen, Add foes and the players' Scene with three sides, before slices 4, 5 and 10.

**Not checked:** how either setting's books order three sides in side initiative; the pack session confirms before slice 3.

Docs to update: 04, 05, 09, `plans/m6-fights.md`.

09: 2026-11-05 — [fight] A fight may have named sides beyond the party's and the foes': each with a stance toward the party (friendly, neutral, hostile; the GM's to change) and its own way of taking turns (its own turn, with the party, or sitting out); neutral sides take part like any other; two-sided fights are unchanged (ns-1) — Three-way encounters are part of play, perhaps one in ten; cheaper in the engine now than after its tables exist — `design/rulings/m6-named-sides-2026-11-05.md`
