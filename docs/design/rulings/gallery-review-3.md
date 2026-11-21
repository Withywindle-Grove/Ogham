---
status: absorbed
milestone: m4b
absorbed-into: docs/06-screens-and-design.md (Molecules; States, variants and accessibility)
supersedes: —
---

# Gallery review 3: RULED (2026-10-25)

PR #104, after the review 2 fixes. Screenshots: organisms (phone and tablet, light and dark), molecules (phone dark), choosing (phone light). All 14 review 2 fixes landed; the ▲ ruling holds.

## Fixes (approved)
1. ✓ means chosen only. In list and detail the row being viewed gets the heavier border without ✓; ✓ appears after Choose. Screen readers: chosen rows announce as selected; the viewed row as current, not selected.
2. Every option row and destination row reserves a fixed ✓ slot at the end edge (empty unless chosen) so room-left values and summaries align. (Changes Claude Code's call 1.)
3. Option rows always show the summary, then the ▲ line when not allowed (Choosing and Organisms alike).
4. Not-allowed line: "▲ Not allowed:" bold in warning; the reason in regular weight (same pattern as "Broken rule:").
5. Choice cards (Guided / Freeform) move on with one tap: no selected state, equal borders.
6. "seen N min ago" never breaks across lines.
7. Every phone sticky bar uses the one bar component (surface plus top rule), including the review screen.

## Claude Code's calls
1. ✓ placement: changed by fix 2 (fixed slot).
2. Low ▲ badge top-start, opposite the stacks badge: approved.
3. Detail panel "Not allowed" as a ▲ note under the summary: approved.

## Baselines
Molecules and organisms committed after these fixes without a full review round; Claude Code sends only the changed sections (list and detail, Choosing, review phone bar) for a quick look.

## 09 lines
- 2026-10-25 — ✓ marks a chosen row only; the row being viewed in list and detail has the heavier border without ✓ — a ✓ on a not-allowed class read as picked
- 2026-10-25 — Rows reserve a fixed ✓ slot so end-edge values align — the ✓ pushed room-left text out of line
- 2026-10-25 — Choice cards move on with one tap, no selected state — fewer taps; nothing to confirm
