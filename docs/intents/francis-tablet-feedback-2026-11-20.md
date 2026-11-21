# Intent: Francis's tablet feedback, 20 November 2026

Author: Francis · Date: 2026-11-20 · Status: accepted

Six notes Francis gave the driver in chat on 2026-11-20, from playing the live app on his tablet. Numbered fb-1 to fb-6 as the driver numbered them. His words are quoted where the driver kept them; nothing is decided here. Where each one went is in its row.

| # | What he saw | His words | Where it went |
|---|---|---|---|
| fb-1 | The light's name reads in lower case in "Which light?" | Not kept word for word | Built in its own pull request (the fb-1 + fb-2 builder) |
| fb-2 | Two toggles on one screen are not aligned | Not kept word for word | Built in its own pull request (the fb-1 + fb-2 builder) |
| fb-3 | The Burden pop-up lists its levels twice | "Duplicate information no need for the bottom listings" | Row Q1 of [`../plans/test-feedback-2026-11-19.md`](../plans/test-feedback-2026-11-19.md), built with of-6 |
| fb-4 | Traits and abilities he wants pinned and in view | Not kept word for word | Rows P2 to P5 of the same plan (euf-2 to euf-6), page M4 |
| fb-5 | His light picker lists two torch stacks: "torch ×2" from character creation and "Torch ×3" | "as long as they fit under max stack size (if there is one) agreed" (on joining them) | Ruled 2026-11-20: [`../design/rulings/tablet-feedback-2026-11-20.md`](../design/rulings/tablet-feedback-2026-11-20.md), fb5-1 to fb5-3; row Q2 of the same plan |
| fb-6 | The left column's boxes lose their right border | "right border is cut off. i think you've crowded the left column too much. it could be because of the ugly scroll bar" | With row H3 of the same plan (the left rail's scroll bar): its builder checks the border at the same window size |

## Problem
Small faults on the tablet cost attention at the table: a doubled list, a cut border, two stacks of the same torch to choose between.

## Outcome
Each screen he named reads cleanly on his tablet; a character's torches are one stack in the light picker.

## Constraints
Hard rules 4 (nothing erased; the join's Undo puts the stacks back) and 7 (calm UI). Before 5 December.

## Out of scope
Joining stacks of things other than lights (fb5-1 rules lights only; every stackable thing is a ⚑).

## Open questions
- ⚑ In the rulings file's "Not settled".

## Links (filled in later)
Ruling: [`../design/rulings/tablet-feedback-2026-11-20.md`](../design/rulings/tablet-feedback-2026-11-20.md) · Plan: [`../plans/test-feedback-2026-11-19.md`](../plans/test-feedback-2026-11-19.md), section Q · Pull request: —
