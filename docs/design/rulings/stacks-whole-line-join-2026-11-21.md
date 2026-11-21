---
status: absorbed
milestone: December first play (Francis's tablet feedback, fb-5; row Q2 of test-feedback-2026-11-19.md)
absorbed-into: docs/09-decisions-log.md (2026-11-21); CLAUDE.md (hard rule 4, the eighth exception); docs/05-features.md (Stackable things join into one stack: the "Whole line", "What joins" and "Kept apart" rows); supabase/migrations/20261121120000_q2_stacks_join.sql
supersedes: none. Adds to sw-6 of stacks-and-reveal-2026-11-21.md (gives and moves join), which left open what happens to the line a whole give lands with; sw-10 narrows that file's sw-1 (every stackable thing) to things carried in numbers
---

# A whole line that joins a stack, what joins, what stays apart (2026-11-21)

While building row Q2, the builder found that sw-6 ("gives and moves join too") needs a line removed when a whole line is given or moved onto a same-name stack: one of the two lines has to go. Hard rule 4's list of deletions is closed, so the driver put it to Francis on 2026-11-21. Words in quotes are his.

## The question

"A: the moved row is merged in and removed. The log keeps a full copy, and Undo rebuilds it: you get your 3 torches back as their own row, the other character keeps 2. B: only additions and part-stack moves join."

## Ruling

| # | Ruling | His words |
|---|---|---|
| sw-9 | **A whole line given or moved onto a same-name stack in the same place is merged in and removed:** its count is added to the stack, the log keeps a full copy of the line, and Undo makes the line again (taking its count back off the stack as sw-4 says: with fewer left, what's left of it, and the undo says so). This is the **eighth exception to hard rule 4**. Part of a stack given or moved is counted over, no line made or removed. | "A" |

## Two more, from the pull request's flags (2026-11-21)

The local review of the build (#24) raised two flags; the driver put them to Francis the same day.

| # | Question put | Ruling | His words |
|---|---|---|---|
| sw-10 | "Two plain swords become one row 'Sword ×2'. Yes: everything with the same name joins, swords included. No: only things that are normally carried in bundles (arrows, rations, torches, coins) join; swords, shields and other single things stay one row each." | **Only things carried in numbers join:** an item several of which share a slot (07's `stack` above 1: arrows, coins) or sold as a bundle (07's `bundle` above 1: torches, rations). A thing with a stack of 1 and no bundle never joins, whatever its count; swords, shields and other single things stay one row each. Narrows sw-1. | "No" |
| sw-11 | Keep these apart for now, each to join later once its own Undo is reworked: one-offs not yet accepted, town purchases, characters not yet approved, things with charges, and lines the game makes itself (finds, foraging, camp). | **Kept apart for now**, as built in Q2: a one-off; a town purchase (its buyer's Undo, bu-1, removes the line it made); anything on a character not yet approved (creation counts each pick's lines); anything with charges; a line the database makes itself (a find sent, an activity's yield, camp). Each may join later, once its own Undo is reworked. | "Yes" |

## What follows

| Where | Change |
|---|---|
| Hard rule 4 (`CLAUDE.md`) | Eight documented exceptions; the eighth is this one. |
| `docs/05-features.md` | The stacks table gets a "Whole line" row. |
| Row Q2 | Builds it: `public.move_into_stack` merges and removes; `private.undo_body` makes the line again; only things carried in numbers join (sw-10); the five stay apart (sw-11). |
| `docs/05-features.md` | The stacks table's "What joins" and "Kept apart" rows (sw-10, sw-11). |

## 09 lines
- 2026-11-21 — [items] A whole line given or moved onto a same-name stack in the same place is merged in and removed: its count joins the stack, the log keeps its full copy, and Undo makes it again with what's left of it (sw-4); the eighth exception to hard rule 4 (sw-9) — Francis: "A" — `design/rulings/stacks-whole-line-join-2026-11-21.md`
- 2026-11-21 — [items] Only things carried in numbers join a same-name stack: several to a slot (07's `stack` above 1, arrows, coins) or sold as a bundle (07's `bundle` above 1, torches, rations); a single thing (a stack of 1, no bundle) never joins, so two swords stay a row each; narrows sw-1 (sw-10) — Francis: "No" — `design/rulings/stacks-whole-line-join-2026-11-21.md`
- 2026-11-21 — [items] Kept apart from stacks for now, each to join later once its own Undo is reworked: a one-off, a town purchase, anything on a character not yet approved, anything with charges, and lines the database makes itself (a find sent, foraging and other activity yields, camp) (sw-11) — Francis: "Yes" — `design/rulings/stacks-whole-line-join-2026-11-21.md`
