---
status: absorbed
milestone: m4b
absorbed-into: docs/06-screens-and-design.md (Character creation and review; Molecules; States, variants and accessibility: "From the gallery reviews"; Offline and sync states), 2026-10-29
supersedes: —
---

# Gallery review 2: RULED (2026-10-25)

PR #104, after the review 1 fixes and the first organisms. Screenshots: organisms (phone dark, tablet dark, phone light), molecules (phone dark), atoms (phone light). Checked against the uiux checklist.

## Ruling
- **▲ replaces "!" everywhere** (not-allowed rows, blocked destination rows, broken rules). Inside a flagged box only the title line carries ▲; inner lines start "Broken rule:" in warning colour.
- **Not-allowed rows are never greyed or tinted** (never disabled overrides B17's "greyed").

## Fixes (approved)
1. List and detail: the selected row matches the panel (select Bog Knight).
2. Selected option rows (list-and-detail, Rules for this campaign, destination list) carry a ✓ at the end edge plus the heavier border.
3. Flagged review section: title first ("Hit points"), then "▲ The GM asks for a change" on the next line.
4. Not-allowed rows: full contrast, no fill, both themes, ▲ reason line.
5. Gear surface tint removed; only flagged sections stand out.
6. Starting money over budget: "Broken rule: over by 3 gp · gold starts at 0 if the GM approves".
7. Kit card: "4 things inside" gets a disclosure chevron and a 44 px row; "▲ Over by 3 gp" sits next to the cost; card capped at about 560 px on tablet.
8. Tablet: primary actions top right (Resend next to the heading; Choose at the top of the detail panel). Gallery also shows the phone sticky bottom bar version of the review.
9. Rules for this campaign: the changed rule carries "Changed · default <value>"; on phone the count wraps under the heading text; source tag styled the same in both themes.
10. The app-name source tag reads from the app-name constant (public name changes before M10).
11. Low status symbol keeps its letter, adds a small ▲ badge opposite the stack badge, warning-colour ring.
12. Offline: the "waiting" tag is dashed; others' ages read "seen N min ago".
13. HP amount field has a visible "Amount" label.
14. Stat tile labels stored lowercase so small caps render the same.

Atoms pass.

## Claude Code's calls
1. Flag before title: **rejected** (fix 3).
2. "Changed:" and "Broken rule:" lines: approved, with ▲ per the ruling.
3. Gear tint: **rejected** (fix 5).
4. Option rows when choices carry meanings: approved.
5. Fixed level stepper comes with B21: approved.

## Baselines
Atoms committed now; molecules and organisms after the fixes.

## 09 lines
- 2026-10-25 — ▲ replaces "!" for not-allowed and broken-rule marks; not-allowed rows never greyed — one shape per meaning; greyed reads as disabled
- 2026-10-25 — Selected option rows carry a ✓ as well as the heavier border — never rely on border weight alone
- 2026-10-25 — Flagged review sections keep their title first, with the flag on the next line — titles are the scan anchors and wrapped badly on phone
