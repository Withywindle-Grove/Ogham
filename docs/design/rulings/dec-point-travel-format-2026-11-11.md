---
status: absorbed
milestone: December first play, step 4 (`docs/plans/dec-4-point-travel.md`); the full step is M8b's
absorbed-into: docs/07-content-packs.md (routes: pt-f1, pt-f3, hidden and one-way routes), docs/05-features.md (moving between linked places, pt-f2), docs/03-roles-permissions.md and docs/06-screens-and-design.md (the ways on players see, mc-28, which overtook part of pt-f3); docs/09-decisions-log.md (2026-11-11)
supersedes: nothing
---

# Point-to-point travel in turns: the pack format and the move (2026-11-11)

Ruled by the lead as design, on the Builder's three format questions, so that the first cut could start while Francis ruled on the screens. His to overturn; told to him the same day.

| Id | Ruling |
|---|---|
| pt-f1 | A route's `travel` is one amount, as today, or a list of ways of moving, each `{ by, name, value, unit }`: `by` a short id, `name` its words, both on the link. No list of ways on the mode. |
| pt-f2 | A move between linked places runs the procedure for each turn passed, as Advance by N does (scheduled checks, reminders, lights). The encounter check put on the card after the move is in addition. |
| pt-f3 | In the first cut a hidden link is the GM's throughout, marked as hidden; a one-way link is listed only from its `from`. Players see no ways on. |

**Why:** the first night of the December campaign is an adventure whose spots are linked and moved between by turns, by more than one way of moving at different speeds, with a roll on every move.

**Costs and caveats:** pt-f1 widens 07's `routes`; old packs stay valid (one amount). pt-f2 means a mode that also schedules a check every N turns will raise both that and the move's check: right for an adventure that says "always roll", to revisit if a pack wants the move's check to replace the schedule.

Docs to update: 07 (routes: `travel` as a list; the `route` kind), 05 (moving between linked places in turns), 09.

09 line:
- 2026-11-11 — [adventure] A route's `travel` may list ways of moving, each with its own time (`by`, `name`, `value`, `unit`); a move between linked places sets the place and advances the clock in one step with one Undo, running each turn's procedure as Advance by N does, then puts the encounter check on the card; hidden links stay the GM's (pt-f1 … pt-f3, the first cut of point-to-point travel) — The December campaign's first night is an adventure of linked spots moved between in turns — `design/rulings/dec-point-travel-format-2026-11-11.md`
