---
status: absorbed
milestone: m5b
absorbed-into: docs/06-screens-and-design.md (Links and buttons), docs/09-decisions-log.md (2026-11-04), docs/plans/m5b-fewer-links.md (Departures, PR 2 item 6)
supersedes: —
---

# Fewer links, the sweep's exceptions (design ruling, 2026-11-04)

Build's scope check on fewer-links PR 2 (#423, the fl-1 sweep): three underlined taps don't use the quiet button and were left as they are. Ruled with A, B, synthesis.

- **fl-5 (synthesis) Two named exceptions to fl-1, kept as they are.**
  1. **Dotted underline = tap to edit or open this heading:** the campaign name (tap to rename) and the time strip's mode · turn (opens the procedure, B5 and B14). It's the thing itself as the tap, not an action link; the dotted line is a different mark from the retired quiet link.
  2. **The toast's Undo is the toast's own control** (06, Toast): a bordered button inside the calmest element on screen adds weight for nothing, and Undo-over-confirm is already learned there.
  - Not taken: a small button in the toast (B); changing all three (C, a turn before the gate for no gain).
  - The source test that blocks underlined actions lists these two patterns as its allowed exceptions.
