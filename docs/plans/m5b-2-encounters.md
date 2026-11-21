# Plan: M5b step 2 — encounters from checks: Encounter waiting and the table pick

Written by the design agent, 2026-11-01. Read the specs it names; this file makes no rulings. Opus, medium.

## What this step delivers
A check's hit becomes an **Encounter waiting** card the GM starts when it suits, and the hit's table is chosen from a **list of candidates** with the rolled row tapped, linked tables following, and a go-to-number box for long tables. This is the bridge from M5's checks to M6's fights.

## Already built (verify first)
*Re-plan 2026-11-01:* **the table pick (build order 2 below) moved to `m5b-g3-encounter-tables.md`** and is built there; this step keeps the Encounter waiting queue, the card and Start only. Read g3's status report first.
M5 step 6 built checks, Check now and Hit / Miss with the modifier list. Check whether a hit already opens a table, and how (`src/modules/expedition`): this step may be mostly the queue and the pick list. Say so in the status report.

## Rests on
- 05 Exploration modes: *Which table a hit rolls* (the candidate list and its order; a lost check always rolls its own `onHit`), *Encounter waiting* (one card per hit; Start, View, Dismiss; a night hit asks Which watch?), *Once per period*.
- 06: *Wilderness day* (the card on the GM console), Components: table pop-up rows "4–5 · Mortal".
- 07: checks' `onHit` (`tableId`, `tableChoices`, `regionTables`), routes' `column`, terrain's `encounterTableId` and `encounterColumn`, `wildEncounters`, special seasons' swap.
- Rulings: `m5b-wilderness-2026-10-30.md` D11, D12, S2-3, S2-4; 06 *Combined GM turn* (2 taps on a miss, 4 on a hit).

## Build order
1. **Encounter waiting queue (engine).** A hit writes a waiting encounter on the expedition (group, check, when, the table rolled and the row if already picked, `watch` for night hits). Commands: `encounter.queue` (by the check's Hit), `encounter.start` (hands to M6 later; in M5b it marks started and opens the row's text for the GM), `encounter.dismiss` (undoable). GM-only rows; players never receive them (hidden means hidden).
2. **The table pick.** After Hit: a pop-up listing the candidates in the ruled order (route column, fire column, the place's default, the terrain's `encounterTableId` for `wanderChance` checks, the region's, the special season's swap, the check's `onHit`, Other…), the likely one marked "suggested"; tapping a table shows its rows with number ranges; the GM taps the rolled row; a row pointing at another table opens it next; d100-size tables get a **go to number** box. The combined GM turn budget: 4 taps on a hit.
3. **The card.** On the GM console: "Encounter waiting · <check name> · <row text>" with **Start**, **View** (details, no state change) and **Dismiss** (Undo toast). Several cards stack newest first; an empty queue shows nothing. A night hit (from camp, step 4) first asks **Which watch?**; until step 4 the question is skipped.
4. **Start** in M5b opens the row's full text and the stat block references for the GM (read-only); M6 takes over Start into a fight.

## Tests (purpose first)
- A hit queues exactly one card; Dismiss removes it and Undo brings it back.
- The candidate list order follows 05 and marks the suggestion; a lost check offers only its own table.
- A row that points to another table opens it; go to number lands on the row holding that number.
- Players never receive waiting encounters (database test).
- The GM's taps on a hit stay at 4 (layout test on the combined turn).

## Scope checks (write one and stop)
- No fight, initiative or monster HP (M6).
- No automatic table choice: the app suggests, the GM picks.
- No shop-stock generation from tables (ST13, parking lot).

## ⚑ for Francis (ask at the start)
1. Start in M5b shows the row's text only; the fight arrives with M6. OK?
   **Answered by Francis, 2026-11-03: yes.** Start in M5b shows the row's text (and the stat block references, read-only) only; the fight arrives with M6. (09, 2026-11-03.)

## Estimate
15–25 builder turns.

## Departures
(The builder keeps this current in the same pull request.)

1. **Only an encounter check's hit queues a card** (technical reading of D11, whose notes say "encounter hits queue"). A wandering check, a place's own check or a GM check marked Encounter check queues one; a lost check's hit (05: never an encounter check), a check with no table and no encounter symbol, or a GM check without Encounter check, doesn't. The card line now carries `lost` (`src/modules/expedition/card.ts`); `hitQueuesEncounter` decides.
2. **The hit queues its card by itself** (no tap), as its own command `encounter.queue` (Verbose, GM-only; the hit stays the Simple line). The card reads its hit (`check_results`) for the name, the time and the row, so a row tapped after the card was queued shows on it, and **undoing the hit hides its card** (the card's row is kept). Undoing the queue itself marks it undone.
3. **Start and Dismiss both have Undo** (toast). The plan names Undo for Dismiss only; Start in M5b changes nothing but the card's state, so Undo over confirm applies.
4. **Cards belong to the expedition**: only the current expedition's cards show; after End expedition they no longer show (kept in the table).
5. **No group column.** A split party's hit already names its group in the check's name ("Wandering check · Group 2"), which the card shows.
6. **`watch` column added now, empty** until camp (m5b-4) asks Which watch?; the question is skipped, as planned.
7. **Build order 2 (the table pick) is g3's** (re-plan); this step reuses it unchanged. The plan's tests for the candidate order, nested tables and Go to number are g3's (`tableList.test.ts`, `encounterTables.test.tsx`).
8. **The combined GM turn journey is switched on** (`tests/layout/journeys.spec.ts`: 2 taps on a miss, 4 on a hit): with `?tables=1` the layout harness's wandering check names a table. Two new layout scenes, `gm-encounter-waiting` and `gm-encounter-started`. Not in the component gallery (no baseline change).
9. **When it fell** reads as the strip counts turns ("Turn 3", `elapsedSteps`). The existing "next at turn N" words use `stepAt`, which counts one lower; left as it is (not this step's), noted for review. **Fixed in #306 (the g6 follow-up, branch `m5b-g6c-rulings`, ruled by Francis 2026-11-03):** every "turn N" now counts as the strip does; `stepAt` is gone.

All nine: **confirmed by Francis (2026-11-03).**

