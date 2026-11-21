# Plan: M7 downtime (from the design ruling of 2026-11-02)

Ruling: `docs/design/rulings/m7-downtime-2026-11-02.md` (dt-1 … dt-45). Walk: `docs/design/notes/downtime-dry-run-notes.md`. Mockups: `docs/design/mockups/downtime/01–07`. Survey: `docs/design/notes/downtime-survey-2026-11-02.md`.

## What this step delivers
Downtime as ruled: the arrival card; town life (lodging, shared stays, stored places, fees, Spend…, auto-pay, unpaid dues); significant actions and upkeep as threads with terms, progress bars, rolls by band, troubles with clocks; time moved by any amount with summaries for the GM and each player; End downtime; the notes and information sheets. Big: it is split into slices, each its own pull request.

## Already built (verify, don't rebuild)
Modes and Start / End downtime (M5); End expedition with its summary and Undo; Where? and Move… (M5, M5b); Award XP and XP waiting (M7-1, when built); Reveal for unidentified items (M4b); Due and repeating spends (05 Purses, M7b); companies, titles (Treasurer, Archivist) and the Company page (06); the HP bar (the progress bar copies its build); Messages (g4) for the GM's questions; the encounter table pick (the band picker copies its row tap).

## Rests on
- **Test pack (ruled 2026-11-04):** the private homebrew pack **downtime-reference** (setting-agnostic, `meta.requires` none, in 07's downtime shapes dt-46 … dt-49, built by the pack session after review area 7 and before this step starts, with a gap report closing G-71 … G-79). The jsdom journeys and fixtures use invented names; the real pack is imported into the test campaign for the gate.
M7b purses and the Treasury (Due, Spend, stored places) for slices 2 and 6; M8b NPCs for relationship activities tied to a person (until then the activity names the person in text). Slice 0 first.

## Build order
0. **Docs** (docs-sync, no code): 03, 04, 05, 06 (with components Progress bar, Band picker, Arrival card), 08 from the ruling's "Docs to update". 07's Downtime section is written (dt-46 … dt-50); slices 3–5 read its **stage 1** fields, stage 2 follows as slice 7 (formulas, band effects, blocking and repeating troubles, the natural chip, free activities; ~8–12 turns), stage 3 with M8b.
1. ~~**The arrival card** (dt-2, dt-3, dt-9)~~ **moved to M5b step 6b** (`plans/m5b-6-settlements.md`, 2026-11-03), with End expedition and Start downtime as two taps (6a).
2. **Town life** (dt-8, dt-11 … dt-15, dt-28 … dt-30, dt-39): lodging and shared stays, stored place kinds with items, fees, Spend… with Hide, auto-pay, the unpaid-Due choices. Needs M7b.
3. **Activities** (dt-1, dt-16 … dt-23): Propose (Carry on first, pack list, Other), the GM's terms with Ask a question, Approve / Send back, Pass with a note, bonuses, the GM's note hidden or shown.
4. **Progress and rolls** (dt-19, dt-20, dt-26, dt-27, dt-32 … dt-34, dt-37, dt-38, dt-41): the Progress bar with now and next, Advance / Pause, the Band picker, results to the GM for approval, upkeep with a period, Skip as worst result, Disband.
5. **Time and trouble** (dt-24, dt-25, dt-31, dt-35, dt-36, dt-40): move by any amount with the preview, the GM's summary, the player's one-time card, troubles with clocks (downtimes or game time) and Apply / More time / Clear, deliveries.
6. **Notes and information** (dt-4 … dt-7, dt-10, dt-42 … dt-45): the two sheets, the Company page section and Scene shortcut, Send to a sheet (and From a table…), the Unidentified pack section.

## Tests (purpose first)
- A safe arrival raises the card once; a hostile one doesn't; Not now dismisses it.
- Two weeks multiply every weekly Due by two and the preview shows the same sums the move applies.
- A shared stay paid by chipping in closes when the total is reached; Split evenly rounds in whole coins (rule 8).
- Spend… with Hide never reaches another player's device (row-level security test).
- A trouble counted in downtimes ticks only at End downtime; one counted in game time ticks with the clock, through adventures too.
- Pause charges nothing and records no roll; a band tap applies its result and lands in the GM's list for approval.
- A GM note marked hidden is never sent to the player's device; a trouble is visible only to its character's player and the GM.
- A party note can be edited by its writer, the Archivist and the GM, and by no one else.
- Upkeep that can't be skipped records the worst band when skipped.

## Scope checks (write one and stop)
- Anything that needs a new kind of deletion (hard rule 4): Disband and Remove note must be reversible events, not deletions.
- Any pack field beyond 07 before the `downtime` ⚑ is ruled.
- A relationship tied to an NPC record before M8b.

## ⚑ for Francis (ask at the start)
- The `downtime` pack format (the ruling's proposal for 07).
- ~~Out and about today / Active tonight: who sets them~~ moved to `plans/m5b-6-settlements.md` ⚑ 1.

## Estimate
About 45–65 builder turns across slices 1–6 (1: 3–5 · 2: 10–14 · 3: 10–14 · 4: 8–12 · 5: 8–12 · 6: 6–8), plus slice 0 (3–5 docs-sync turns). The heaviest parts: dt-14's shared payments and the row-level security for hidden spends, notes and troubles. Uncertain: how much of M7b's Due exists when this starts.

## Departures
(The builder keeps this current in the same pull request.)
