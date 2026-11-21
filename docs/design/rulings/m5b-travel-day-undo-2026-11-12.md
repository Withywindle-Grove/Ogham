---
status: pending
milestone: m5b (one of the four fixes that hold the tag: gt-1, gt-2)
absorbed-into: pending, with the pull request from branch `m5b-travel-day-with-clock` (05 travel: the day's start and its Undo); docs/09-decisions-log.md (2026-11-12)
supersedes: the Undo of Next day put in by #617 (2026-11-10), for the one case named in ud-1; gt-2 and db-3 stand
---

# The travel day starts with the clock, and its Undo is whole (2026-11-12)

Ruled by Francis in the Builder's session ("Yes to both"), on the Builder's two flags for the fix of F86 and F87 (`docs/design/notes/gate-m5b-rewalk-2026-11-10.md`); the lead's advice was the same.

**The cause, confirmed in a scratch run.** Next day moved the clock, but a group's travel record for the new day was started only by the GM's travel card when that card was on screen. With the GM's screen elsewhere, a player's forced march was counted against yesterday's record, the camp was made for the new day, and no Rest card was raised (F86). An Undo then took back a day the record had never reached (F87). The read of the live database that db-3 allowed was not needed and was not made.

| Id | Ruling |
|---|---|
| ud-1 | Next day starts every group's travel day in the same request as the clock, paying a carried shortfall first. One Undo takes both back. If the party has moved on the new day, Undo of that Next day is **refused whole** ("That's changed since. Undo the later change first."), where #617 put the clock back and left the travel standing. One action, one Undo, never half undone. |
| ud-2 | The refusal names what stands in the way where that is cheap ("Undo the move to <place> first"); if it is not cheap it stays a follow-up with F89. |
| ud-3 | Technical, Francis's say under bq-6 and tg-1: the two new failing tests are reworded, in their own commit that was never pushed, to tap the real Next day with the GM's screen elsewhere; #617's own test, changed by ud-1, is changed on a non-fix branch cut from the fix branch. |

**Costs and caveats.** A held migration (`20261112100000`): it must be on the main database **before** the app that calls it is deployed. The card's own start of the day stays as a fallback. The half Undo of #617 is gone for good in that one case: a GM who tapped Next day too early and has already moved the party undoes the move first.

Docs to update: 05 (travel: the day's start; Undo of Next day), `docs/testing.md` (the gate list's line on the day's Undo, when the fix is live), 09.

09 line:
- 2026-11-12 — [expedition] Next day starts each group's travel day with the clock and one Undo takes both back; after a move on the new day that Undo is refused whole, naming what stands in the way where cheap (ud-1, ud-2; changes #617's Undo for that case) — No Rest card after a forced march and a clock out of step with the travel day (sitting 2, F86 and F87): the travel day was only started by the GM's travel card when it was on screen — `design/rulings/m5b-travel-day-undo-2026-11-12.md`
