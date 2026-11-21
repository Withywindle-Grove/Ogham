---
status: absorbed
milestone: m4b
absorbed-into: docs/06-screens-and-design.md (States, variants and accessibility: "From the gallery reviews"; Design tokens, Dark mode; Offline and sync states), 2026-10-29. Item 9 (show the End expedition dialog) is superseded: End expedition has no confirm since 2026-10-29 (D22)
supersedes: —
---

# Component gallery review 1 (PR #104), 2026-10-25: RULED

Reviewed from Francis's screenshots (light and dark, phone and tablet) against the uiux checklist and the UI conventions. Approved fix list:
1. Secondary button labels at Garamond 20 (labels step), so three alignment buttons fit one row at 375 px.
2. Fill means "on" only; action chips ("All 6", "−1") are outlined.
3. "Offline · N waiting" is the ▲ warning pill; Catching up, GM offline and Read-only stay ⓘ info.
4. Skeleton bars one neutral step lighter than their container (invisible in dark before).
5. Every status symbol has its ring track (hidden timer = unfilled track; stacks = ring plus badge).
6. HP button "Take damage" / "Heal" until an amount is entered; with none, a tap explains "Enter an amount".
7. Stat tiles in a row are equal height, labels top-aligned.
8. Read-only pill: "Read-only · other device running" (full sentence on tap).
9. Show the End expedition dialog open to review the dark popup surface.
10. "Saving…" with the ellipsis character.

Claude Code's design calls: (1) ink fill for "on" approved except action chips; (2) ink toast in both themes approved; (3) info on all offline pills changed per item 3; (4) not-allowed rows on tint with warning "!" approved; (5) dark popup surface #28231D approved pending item 9.

Kept: Atkinson's slashed zero (deliberate legibility feature).
Next: organisms (review screen, kit card, Rules for this campaign, pinned note, detail panel).
