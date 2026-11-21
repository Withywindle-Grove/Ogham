# Manual checks: dec-7-5b-0-move-on-wiring

Piece 5b-0 (the Move on wiring) puts nothing on a screen: the redesigned place page (5b) mounts it. So there is nothing to open or tap in the app yet, and no gallery picture changes.

What you can check today, in a terminal in the project folder:

1. Run `npx vitest run src/app/moveOnWiring.test.tsx src/modules/expedition/moveOnWays.test.ts`. It runs the Move on sheet beside the time strip against the stand-in database. You should see **20 tests passed**: a move by rowing (1 turn) moves the party and the clock and puts the encounter check on the card, and one Undo puts it all back; a move to a place not made yet makes it first and crosses an obstacle with 2 turns more; No moves nothing; a split party is refused with "Join the party up first…"; and the ways, their shown lines and their times are read as ruled.
2. Run `npx vitest run src/app/restFlow.test.tsx src/app/encounterCheckHour.test.tsx`. You should see every test pass: the time strip's own advance and Encounter check behave as before.

When 5b is built, its manual checks walk this on the live page (Move on, a way, Move; Undo puts the place, the clock and the light back).

## Gallery pictures
None change: no part was added or changed.
