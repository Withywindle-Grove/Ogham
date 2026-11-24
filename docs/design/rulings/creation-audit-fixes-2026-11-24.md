---
status: absorbed
milestone: December first play (the `impeccable audit` of built character creation, 2026-11-24; findings 2, 1 and 9)
absorbed-into: docs/09-decisions-log.md (2026-11-24); docs/05-features.md (guided creation, "Audit fixes"); docs/06-screens-and-design.md (the GM's review; Components: Score tiles, Creation step shell, Review step); docs/plans/dec-15-creation-audit-fixes.md; docs/design/mockups/december/41-creation-audit-fixes.html
supersedes: none. Changes the words of the Scores refusal ("<score> must be N–M", "<score> is missing" for a number out of range) and of the review's average line ("Wit 10, Lore 10: the average, not rolled"), neither of which had a ruling id of its own
---

# Character creation's audit fixes 2, 1 and 9 (2026-11-24)

The `impeccable audit` of built character creation (2026-11-24) listed eighteen findings. Francis picked three the same day: "fix 2, 1 and 9; merge same-name purchases." A designer worker drew page 41 (`docs/design/mockups/december/41-creation-audit-fixes.html`) and wrote the plan (`docs/plans/dec-15-creation-audit-fixes.md`) with eight questions and a critique of eleven findings. The driver put them to him with a recommendation on each.

## His answer

"All recommended", on page 41 and the plan, with critique 1 and 6 picked. Page 41 is **approved 2026-11-24 with these fixes**.

Each ruling below is the driver's recommendation he took; the wording is the driver's, the yes is his.

## Rulings

| # | Question (the plan's ⚑) | Ruling | His words |
|---|---|---|---|
| caf-1 | ⚑ 1. A purchase of several at once ("Dry rations ×3", one stored entry, one price) | It **joins its name's row**, and "Put back one" takes one back: the stored creation entry is split, or its count and price lowered. No migration; older records read as before. | "All recommended" |
| caf-2 | ⚑ 2. The button's words | **"Put back one"** on a row of several, **"Put back"** on a row of one. | "All recommended" |
| caf-3 | ⚑ 3. What joins, and in what order | Rows join on the **same name and the same price**, in the order each was **first bought**. | "All recommended" |
| caf-4 | ⚑ 4. The refusal's words | The voice guide's error pattern, what happened then what to do: **"Muscle can't be above 16. Lower it to continue."** and **"Muscle can't be below 2. Raise it to continue."**, the numbers from the setting, never the app's own. | "All recommended" |
| caf-5 | ⚑ 5. A setting that gives no range | **"Muscle must be a whole number."** | "All recommended" |
| caf-6 | ⚑ 6. "3.5" and letters | **Typing stops at the point** ("3.5" gives "3"); letters don't enter. | "All recommended" |
| caf-7 | ⚑ 7. The line under the scores | **"Nimbleness: the average, not rolled"**, no figure; with none rolled, **"All six: the average, not rolled"**, the count from the setting's scores. A score not rolled carries no "(rolled N)" (the fix itself, finding 9). | "All recommended" |
| caf-8 | ⚑ 8. The GM's approval card | It gets **the same change** as finding 9, approved from pictures of the real screen after the build. | "All recommended" |
| caf-9 | Critique 1 | **A visible sign on the refused box itself**, not only the line at the foot. | picked by number (critique 1), as the driver's brief reports it |
| caf-10 | Critique 6 | **"Undo last" keeps showing which row it undoes.** | picked by number (critique 6), as the driver's brief reports it |

## What the rulings do not say

| Point | Where it stands |
|---|---|
| **The look of caf-9.** | Drawn after the approval, the designer's reading: the foot's warning sign and short words ("Can't be above 16") in the tile's own words line, the box's edge in the warning colour. Francis has not seen it. |
| **The look of caf-10.** | Drawn after the approval, the designer's reading: a quiet line beside the button, "Last bought: Dry rations". Francis has not seen it. |
| **caf-5: which numbers a setting with no range refuses.** | As built (the box's own limits). The ruling gives the words only; 0 and 999 are whole numbers, so the words may read oddly for them. |
| **caf-1 and hard rule 4.** | No new kind of deletion: a put-back already takes the thing out of the pack and its entry out of the creation record, on a character not yet approved. If splitting an entry needs a deletion the closed list does not have, the builder stops with a scope check. |
| **The other critique findings** (2 to 5, 7 to 11) and the audit's other fifteen. | Not picked. 3, 4, 8 and 9 were answered by caf-6, caf-4 and caf-7. |

## What follows

| Where | Change |
|---|---|
| Page 41 | Marked "approved 2026-11-24 with fixes"; nine new frames (`png/41-…-fix-…`); seven earlier frames `superseded` in the index. |
| `docs/plans/dec-15-creation-audit-fixes.md` | Rows 2, 1 and 9 no longer held; row 2 no longer display-only (caf-1); row 9 names the GM's card; the ⚑ under "Ruled 2026-11-24". |
| `docs/05-features.md` | Guided creation: the "Audit fixes" line. |
| `docs/06-screens-and-design.md` | The GM's review; Score tiles; the Creation step shell (Gear); the Review step. |

## Seen 2026-11-24 (added after the ruling)

| Point | Where it stands |
|---|---|
| **The looks of caf-9 and caf-10.** | Francis saw the two frames drawn after the approval (`41-1-fix-…`, `41-2-fix-…`) and approved them on 2026-11-24 "with those fixes". The rows above that say he has not seen them are history. |
| **caf-5's words for 0 and 999.** | "Must be a whole number" for 0 and 999 in a setting with no range is left to row 1's builder (`docs/plans/dec-15-creation-audit-fixes.md`): build the words as ruled and say in the pull request what was refused. |

## 09 lines
- 2026-11-24 — [ui] Creation audit fixes: page 41 approved with fixes; rows 2, 1 and 9 of `plans/dec-15-creation-audit-fixes.md` no longer held (caf-1 to caf-10) — Francis: "All recommended" — `design/rulings/creation-audit-fixes-2026-11-24.md`
- 2026-11-24 — [items] At creation, bought rows join on the same name and the same price, in the order first bought; "Put back one" on a row of several, "Put back" on a row of one; a purchase of several at once joins its row and goes back one at a time, its stored creation entry split or lowered, no migration (caf-1 to caf-3); "Undo last" keeps showing which row it undoes (caf-10)
- 2026-11-24 — [words] The Scores refusal follows the error pattern with the setting's own numbers: "Muscle can't be above 16. Lower it to continue.", "Muscle can't be below 2. Raise it to continue."; with no range, "Muscle must be a whole number."; typing stops at the point and letters don't enter; the refused box carries a visible sign of its own (caf-4 to caf-6, caf-9)
- 2026-11-24 — [words] A score not rolled carries no "(rolled N)"; the line under the scores has no figure, "Nimbleness: the average, not rolled", and with none rolled "All six: the average, not rolled"; the GM's approval card the same, approved from pictures of the real screen after the build (caf-7, caf-8)
