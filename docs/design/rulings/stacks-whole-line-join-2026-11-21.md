---
status: absorbed
milestone: December first play (Francis's tablet feedback, fb-5; row Q2 of test-feedback-2026-11-19.md)
absorbed-into: docs/09-decisions-log.md (2026-11-21); CLAUDE.md (hard rule 4, the eighth exception); docs/05-features.md (Stackable things join into one stack, "Whole line" row); supabase/migrations/20261121120000_q2_stacks_join.sql
supersedes: none. Adds to sw-6 of stacks-and-reveal-2026-11-21.md (gives and moves join), which left open what happens to the line a whole give lands with
---

# A whole line that joins a stack (2026-11-21)

While building row Q2, the builder found that sw-6 ("gives and moves join too") needs a line removed when a whole line is given or moved onto a same-name stack: one of the two lines has to go. Hard rule 4's list of deletions is closed, so the driver put it to Francis on 2026-11-21. Words in quotes are his.

## The question

"A: the moved row is merged in and removed. The log keeps a full copy, and Undo rebuilds it: you get your 3 torches back as their own row, the other character keeps 2. B: only additions and part-stack moves join."

## Ruling

| # | Ruling | His words |
|---|---|---|
| sw-9 | **A whole line given or moved onto a same-name stack in the same place is merged in and removed:** its count is added to the stack, the log keeps a full copy of the line, and Undo makes the line again (taking its count back off the stack as sw-4 says: with fewer left, what's left of it, and the undo says so). This is the **eighth exception to hard rule 4**. Part of a stack given or moved is counted over, no line made or removed. | "A" |

## What follows

| Where | Change |
|---|---|
| Hard rule 4 (`CLAUDE.md`) | Eight documented exceptions; the eighth is this one. |
| `docs/05-features.md` | The stacks table gets a "Whole line" row. |
| Row Q2 | Builds it: `public.move_into_stack` merges and removes; `private.undo_body` makes the line again. |

## 09 line
- 2026-11-21 — [items] A whole line given or moved onto a same-name stack in the same place is merged in and removed: its count joins the stack, the log keeps its full copy, and Undo makes it again with what's left of it (sw-4); the eighth exception to hard rule 4 (sw-9) — Francis: "A" — `design/rulings/stacks-whole-line-join-2026-11-21.md`
