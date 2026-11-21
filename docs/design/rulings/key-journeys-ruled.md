---
status: absorbed
milestone: m4b
absorbed-into: docs/06-screens-and-design.md (Key journeys)
supersedes: —
---

# Key journeys: RULED (2026-10-25)

Replaces 06's "Key flows (tap budget)" table; its single actions fold into these journeys. Each journey has three limits: **taps**, **screen changes**, and **stays in context** (every-turn tasks never leave the Explore screen). Claude Code scripts each journey as an automated click-through test that counts taps and screen changes and fails the build if a change goes over budget. Storyboards were approved as the baseline.

| # | Journey | Who | Taps | Screen changes | Path (ruled design) |
|---|---|---|---|---|---|
| 1 | Start a session | GM | 3 | 1 | Campaign → Start session → "Time since last session?" choice |
| 2 | Turn, nothing due | GM | 1 | 0 | Next turn |
| 3 | Turn, a check due | GM | 3 | 0 | Next turn → outcome on the reminder card (→ optional modifier) |
| 4 | Take damage | Player | 2 | 0 | HP → quick chip (applies at once, Undo toast); typed amounts: HP → digits → "Take N damage" |
| 5 | Light a torch | Player | 1–2 | 0 | Light (→ pick if more than one light) |
| 6 | Give an item (single / stack) | Player | 4 / 5 | 1 | Item → Give → (how many) → person → "Give N to …" |
| 7 | Do an activity | GM | 4 | 0 | Act… → activity → who → outcome |
| 8 | Write a log note | Anyone | 3 + typing | 0 | Log → note box → Add |
| 9 | Show a picture | GM | 2 | 0 | Send → Send |
| 10 | End the expedition with a full rest | GM | 3 | 0 | ⋯ → End expedition → confirm (keeps its confirm: high-cost) |

**Combined GM turn:** journeys 2, 3 and 7 back to back, joint budget **6 taps**.

◈ Fight rounds (M6) and level-up (M7) get journeys when those milestones are designed.
