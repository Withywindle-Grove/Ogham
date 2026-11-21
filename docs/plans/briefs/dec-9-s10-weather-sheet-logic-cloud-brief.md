# Cloud brief: S10, the weather sheet's logic (logic only)

**Blocked means stop and report; never reach the end another way.** If a guard, a hook or a permission check blocks you, stop and write what happened in the pull request. Do not try another tool, branch or command to get the same result.
Test files are changed only with the Edit tool. If the hook refuses, stop and report.
If you're unsure of anything, stop and write the question in the pull request. Don't guess.

Drafted by the Builder, read and corrected by the lead (2026-11-14).

## Objective
Build the **logic** behind the Weather sheet on the Scene: how the GM's roll is entered by tapping a row of the weather table, how a player's roll is entered as a number, and that a player is never sent the weather table. This is the weather part of row S10 of the whole-Scene plan, logic half only. The sheet's drawing and wiring are a later row.

## STEP 1, before anything else: how does a weather table reach a client today?
Find out exactly how a weather table gets to a device today:
- the library entries and their read rule (the newest definitions across `supabase/migrations`);
- any view or function that returns weather rows;
- what the GM's device and a player's device each receive when weather is rolled (`src/app/WeatherCard.tsx`, `enterWeather` and its callers, the weather roll migration `20261031090000_m5b_weather_roll.sql` and later ones).

**If keeping the table from players needs ANY change to a policy, a view or what a function returns to a player, STOP after step 1.** Write in the pull request exactly what would change, in plain words. That's a change to who may read what: it needs Francis's yes and isn't cloud work.

**Either way, write the database test** that a player gets no weather table, in `supabase/tests/`:
- if players already can't receive it, it's an ordinary test;
- if it's sent to them today, write it as a failing test (`it.fails`) or a pending one (`it.todo`), with its reason in a comment.

You can't run database tests yourself: CI's database job or the Builder runs them. Say in the pull request that it has not been run by you.

## Output
- **Branch:** `scene-s10-weather-logic`, from `dec-7-5b-gm-place-page` (the stack's base, #785).
- **One pull request** against `dec-7-5b-gm-place-page`, never against `main`.
- **Logic and tests only.** No screen, no CSS, no gallery and no layout specs. Do not edit `src/app/SceneTime.tsx`, `src/app/WeatherCard.tsx` or any `.tsx` screen file.
- **Status file:** `docs/status/<date>-scene-s10-weather-logic.md`, with step 1's answer and a Departures list.

## Read first
1. `docs/plans/dec-9-the-whole-scene.md` (from `main`): row S10.
2. `docs/design/rulings/dec-scene-whole-2026-11-14.md`: **st-3** (the weather roll is entered on the weather table itself, in the book's table style: roll, then tap the row; no number box for the GM) and **wr-1** (a player who rolls enters the number and never sees the weather table; only the GM taps the table's row).
3. Page 16 on branch `design-december-mockups` at commit `662d45fa`: `docs/design/mockups/december/16-the-scenes-top-in-every-state.html`, frame **T6** (the sheets, redrawn) and its notes.

## What the logic must do
- **The GM's roll:** a tap on a row of the weather table enters that roll. Send the row's **lowest** roll to the existing `enterWeather`, the same command as today, so nothing about writing changes. Give the sheet what it needs to draw the table in the book's table style: rows with their ranges and results, and which row the current roll falls in.
- **A player's roll:** entered as a number through today's path. The player's device never needs the table, so the logic for a player's sheet doesn't load it.
- **The effects in plain words:** gather what today's weather card says the weather does, as the sheet's plain-words text, from the same data. Read, don't invent.

## Tests (each written first as a plain sentence)
At least:
- a tap on a row sends that row's lowest roll;
- a single-number row sends that number;
- the current roll's row is marked;
- the player's sheet logic asks for no table;
- the database test from step 1.

Use invented fixtures only: no game-system names, tables or numbers from any book.

## Boundaries
- No migration, no change to who may read or write anything. Step 1 decides; stop if it says otherwise.
- `enterWeather` stays as it is. If it can't take a row's lowest roll as it stands, stop and say why.
- Don't build the sheet or move today's weather card: that's the later wiring row and S18.
