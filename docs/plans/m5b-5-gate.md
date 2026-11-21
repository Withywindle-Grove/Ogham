# Plan: M5b step 5 — the gate: a scripted 3-day trek

Written by the design agent, 2026-11-01. Read the specs it names; this file makes no rulings. Opus, medium.

## What this step delivers
The M5b gate check as one **journey test** plus the manual checklist: "A mock 3-day trek with weather, a lost check, a forage and a camp" (08, M5b row). The test becomes the regression spine for M6 and M7, like M5's 10-turn delve (plan m5-12, build order 6).

## Rests on
- 08: the M5b row's gate line; *Scope checks*; the gate workflow in `.claude/README.md`.
- `docs/testing.md`: *Manual checklist* (add an M5b section), *Layout checks*, *The component gallery*.
- Plans m5b-1 to m5b-4 and their status reports (Departures sections).

## Build order
1. **The journey test** (Vitest on the engine, with the fixtures' invented pack): day 1 — weather rolled by a player, Move… on a road (no lost check), a forage with a yield, camp with fire, eating, watches, a quiet night; day 2 — Move… leaving the road (`alsoWhen` prompts the lost check, Hit → Lost), a shortfall into a named place, Force march by a player, camp with a night hit → Which watch? → Encounter waiting; day 3 — the Lost card (Found the way), the arrival paid first, Rest due, End expedition. Every step asserts the budget, the place, the statuses and the log lines; Undo is exercised on Move…, an activity and Next day.
2. **Layout journeys** (Playwright): the players' wilderness screen at 375 px (button group, camp steps, What we know), the GM's day on a landscape tablet (budget card, Move…, Encounter waiting), dark mode, largest text size; gallery pictures for the new components (budget card, Lost card, Encounter waiting, camp steps, What we know).
3. **Manual checklist** in `docs/testing.md`: "### M5b — wilderness (gate)", one item per ruling cluster (S1–S5, D3–D5, D11–D12, D13–D20, S4-1 to S4-5), each "open · tap · see"; two phones and a tablet on the preview.
4. **Gate run** with Francis: collect feedback without acting (gate workflow); hand over one grouped list (ruled · needs a ruling · technical). Then the fresh-session review, the security advisor, the `m5b` tag and the CHANGELOG entry (P8's draft).

## Tests (purpose first)
- The 3-day trek runs green end to end and fails if any step's budget, place or status drifts.
- No hidden state reaches a player client in the trek (the visibility matrix script on the new tables).

## Scope checks (write one and stop)
- No new features at the gate; fixes only, each with a test.
- The three option rules (m5b-4, build order 8) are checked at the gate only if they shipped.

## ⚑ for Francis (ask at the start)
1. The M5b gate runs before M6's engine work starts (gate work first), or in parallel with M6's HP-table migration (A16)? Recommendation: gate first; the migration waits a week.
   **Ruled by Francis (2026-11-03):** M6 may start during the M5b gate run; M6 work pauses when the gate's results come in (rework expected). 09 line added.

## Estimate
10–15 builder turns, plus the gate session with Francis.

## Departures
(The builder keeps this current in the same pull request.)

**Build orders 1 and 2 (2026-11-03, builder, `m5b-5-gate`).** Build order 3 is the designer's (#327, "M5b — gate run, in play order"); build order 4 is the gate session.

1. **The journey runs through the app, not the engine alone.** `src/app/m5bGate.test.tsx` clicks the trek through `<Root>` against the stand-in database at three devices (GM, Sam, Jo), like M5's delve (`m5Gate.test.tsx`), so the budget, the place, the statuses, the log lines and the three Undos are the app's own. It follows the gate run's play order (checks 17–28 and 40) on the fixture pack's Fen trek. The stand-in had no activity or camp functions; they're added (`src/testing/fakeDb.ts`, `fakeDb.camp.test.ts`), each mirroring its newest migration. Fragile: a fake can drift from its SQL; the database tests stay the real check.
2. **What the trek asserts is today's behaviour on main**, so some steps differ from the plan's words:
   - The lost check a move sets off (`alsoWhen`) goes on the card with Hit / Miss (#328, merged during this PR); the trek records its Hit there (its table opens; no encounter queues), then the GM's Mark lost, since a hit doesn't mark the group lost by itself.
   - The night hit is the GM's **Encounter check** (⋯) while the camp is up; Next day's own Prowlers hit can't ask Which watch?, because Next day applies the camp in the same move (see the scope check below).
   - Force march is followed by camp the same evening; the no-camp case (#326, merged after this branch started) is its own test in `travelCard.test.tsx`.
3. **Bug fixed (with the trek as its test):** Which watch? was never asked for an Encounter check during camp: the card read the check's key as `check:mode:<id>`, but Check now keys it `now:check:mode:<id>` and names it "<check> · now" (`SceneTime.tsx`, `watchChoicesFor`). The trek fails without the fix.
4. **Contrast fixed:** the travel card's roll and Move… fields filled with the edge colour (`--control`), which fails WCAG AA under ink in dark mode (axe, `gm-wilderness-day-dark`); now `--sheet`, as the app's other fields. A small look change in light mode too (a white field instead of a grey-brown one).
5. **Gallery pictures:** a new **Wilderness** section (`src/gallery/WildernessSpecimens.tsx`) with the parts drawn from what they're given: Encounter waiting cards (Which watch?, Awake, no row yet) and the Watches step. The budget card, the Lost card, the camp card and What we know read the database, so their pictures are layout scenes on the real screens (`player-wilderness`, `-dark`, `-larger`, `player-what-we-know`, `player-camp`, `gm-wilderness-day`, `-dark`, `gm-camp`, `gm-move`), saved for review, not compared pixel by pixel. New baselines for the Wilderness section only (Francis approves from the CI run); no existing picture changes.
6. **Hidden state:** the trek checks a player reads no Lost, no waiting encounter and no "lost" log line; `scripts/visibility-matrix.test.mjs` pins the access rules of the trek's tables, so a loosened rule fails `npm test`.

Scope check SC-5-1 (for a ruling): **Which watch? after Next day.** The camp card says the night check is "Rolled with Next day; a hit asks Which watch?", and the gate run (check 26) expects it there, but Next day applies the camp before its checks fall due, so the hit finds no open camp and asks nothing. Options: A ask Which watch? on a night-check hit whose group's camp was applied by the move that made it due (the evening's camp, read by day); B the night check falls due before Next day applies the camp (the GM answers it, then the day moves); C keep it as built and change the camp card's words to "use Encounter check (⋯) in the night". Not built.

**Ruled B by Francis (2026-11-03).** Built in `m5b-5-night-check-order` (no migration):
- **The order.** When Next day (or Advance by… into a new day) would apply the evening's camps and the camp's night check is due, it stops first: only the night check goes on the Due card (titled "The night"), the clock doesn't move, the camp stays open, and a toast says "The night check first · then Next day again". The GM taps Hit or Miss; a hit queues its Encounter waiting card, which asks **Which watch?** from the open camp's watch order. The next Next day moves the clock, applies the camps and runs the morning in one request, as before, and the night check doesn't come due again.
- **Undo.** The stop writes nothing: its toast's Undo takes the night check off the card again. The Hit or Miss has its own Undo, as any check. The move keeps its one Undo (the strip's Undo, the same as before): the clock goes back and the camp opens again; the night check's result stays recorded, so the next Next day moves straight on without asking again.
- **"Answered"** is read from the log, not just the device: a night check recorded at this time on the clock on this expedition (any GM device, or before a reload) counts. A GM who taps Next day again without answering moves on too (the device remembers it asked); the night check's line then stays on the card, and a hit answered after the move asks no Which watch? (the camp is applied).
- **Split party:** each group's night check line is asked on its own; a group already answered isn't asked again. Which watch? now also reads a split group's line (its key ends `@group<N>`), a small fix found while building.
- **The trek** (`m5bGate.test.tsx`): the day 1 night is a miss at the stop, then Next day, its Undo and Next day again moving straight on; check 26 is now Next day's own Prowlers hit asking Which watch? (1st watch · Reed, 2nd watch · Moss), then the ⋯ Encounter check while the camp is still up (departure 3's fix, kept) with its own Which watch?; the last Next day applies the camp without Prowlers again.
- The camp card's night line for the GM now says "Next day asks it first, while the camp is up; a hit asks Which watch? on its waiting card."

Gate findings seen while building (collected for the gate, not acted on):
- The log reads "changed something" for every camp step and the weather entry, "undid a change to something" for an undone move, "1 points", "started day 2 for the party: 0 points" (the day's total didn't change, so it isn't in the event), and "checked Prowlers · now now".
- In the bog, the Due card offers Going astray and Prowlers at "on 1", while the terrain's chances are 1–2 (the Move… preview says 1–2).
- During camp, Force march stays above the Camp card (06: the camp steps take the button group's place).
- The fixture's Sleep step note still says "Sleep comes with the next part of camp" (pack text, now stale).
- Which watch?'s buttons wrap with the first beside the question and the rest below (gallery picture).
