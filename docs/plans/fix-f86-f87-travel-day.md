# fix-f86-f87-travel-day — a new day's travel record starts with the clock

Branches: `fix-f86-f87-travel-day` (the failing tests first), then `m5b-travel-day-with-clock` (the fix).
Rulings: ud-1, ud-2, ud-3 (`m5b-travel-day-undo-2026-11-12.md` in `docs/design/rulings/`, arriving with the lead's
docs pull request).

## Goal

Gate walk findings F86 and F87. A new day's travel record (`travel_groups`: the day, its points, what's spent, the
forced march, what's owed) was started only by the GM's travel card, when that card was open and up to date. When the
GM tapped Next day away from Scene, the record stayed on yesterday while the clock was on today:

- **F86**: a player's forced march landed on yesterday's record, camp was made for today, and no rest fell due.
- **F87**: players' travel cards kept yesterday's day and points.

The fix (ud-1): Next day (and Advance by… into a new day) starts every group's travel day in the same request as the
clock's move, yesterday's shortfall paid first. The record never waits for a travel card.

## Steps

1. The GM's device works out each group's new-day budget when the move reaches a new day (`travelDayStarts` in
   `src/app/travelView.ts`, from the travel view read at the time the move reaches) and passes it with the move
   (`days` on `time.advance` / `time.advanceBy`, `src/modules/expedition/play.ts`).
2. The database starts those days right after the clock moves, in the same transaction: migration
   `20261112100000_fix_travel_day_with_clock.sql` (replaces `public.advance_clock` from its newest definition,
   `20261102330000`, with one more argument; adds `private.start_travel_days`). **Held: never run on TEST or main.**
3. The stand-in database (`src/testing/fakeDb.ts`) does the same.
4. The strip shows the toast the card's own start showed ("Day 3, Leagues 12, the party arrived at Black Mere"),
   same words and moment, since the card no longer starts that day.
5. The travel card's own start stays for a group's first day and as a fallback (Set the time…, an older copy of the
   app); a day already started is left as it is.
6. Undo of the move takes the clock and the started days back together (one request). After a move on the new day
   the Undo is refused whole (ud-1). `dayStartsAfter` skips the move's own starts and still lists any the card
   started later.

Unchanged: turn-pace modes, Downtime, town modes (Next part of day), the night-check stop, a forced march without a
camp (its rest still applies with the move).

## Tests

- F86 and F87 in `src/app/m5bGate.test.tsx`, committed failing first (ud-3): they tap Next day on the GM's compact
  strip, away from Scene.
- `src/app/travelCard.test.tsx`, review of #617 finding 4: now the Undo refused whole.
- `supabase/tests/fix-travel-day-with-clock.test.ts`: Next day starts every group's day and pays a carried shortfall;
  Undo takes the clock and the days back together; a repeated request starts nothing twice; a player can't.
- `src/testing/fakeDb.travelDay.test.ts`: the same in the stand-in database, and `standsInTheWay`.

## Departures

- The first test commit (bare clock calls) was replaced before it was pushed, and the fix moved to a non-fix branch,
  so the existing #617 test could change (ud-3).
- ud-2 (the refusal names what stands in the way): the lookup is built (`standsInTheWay`), the words are not
  shown. They wait for approval (no visible change without an approved mockup, ruled 2026-11-12); the proposed words
  are in the status file's ⚑.
- The morning's toast is not new: it is the travel card's, now shown by the strip (the card no longer starts the day).
- The day start writes one change to the travel record (the day with the shortfall already paid), not a start and
  then a payment: two changes to the same record in one request can't be undone.
- A group with no travel record yet (its first day) is not started by Next day: the travel card makes it, as before,
  so Undo of a move never takes a first day back (review of #617).
- The compact strip keeps its own toast (with Undo) after Next day and doesn't add the morning's words.
