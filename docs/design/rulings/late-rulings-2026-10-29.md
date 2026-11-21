---
status: absorbed
milestone: m5 (with m6 table and fight words)
absorbed-into: docs/04-data-model.md, docs/05-features.md, docs/06-screens-and-design.md, docs/07-content-packs.md, docs/08-roadmap.md, docs/10-open-questions.md, docs/testing.md, docs/diagrams/fight-flow.md (2026-10-30); the code parts wait for the M5 small-fixes pull request
supersedes: M6-10's open-first current table in Explore, Encounter and Fight; the "Reference tables" button (now Tables ›); "Foes' turn done" and "Done without loot"; the closed single-string table `use`
---

# Late rulings, 2026-10-29 (Francis approved)

Three batches of answers from the design chat on 2026-10-29: the late status (10 ⚑), the night status (7 ⚑) and the pack readiness answers. Saved by Claude Code with pack names replaced by neutral ids. The specs say what is true now; the one-line history is under 2026-10-29 in `docs/09-decisions-log.md`.

## Late status

| # | Ruling | Where |
|---|---|---|
| 1 | The GM's campaign opens on Scene; Players is one tap away. Players' devices are unchanged. The layout tests are updated before step 7. | 06 Navigation |
| 2 | Log levels: Next turn and +N Verbose; Advance by…, Set time…, Downtime, sessions and expeditions Simple; Check again Verbose. | 05 Expeditions, Log |
| 3 | Calendar start lives in campaign settings ("Calendar start"). Until set, the time strip shows "Day N" plus a quiet "Set date ›"; nothing blocks. The first step that needs the season asks "Which season?" with season chips; the tap sets the start to that season's first day, editable later. A pack may give `calendar.defaultStart`. | 04, 05, 06, 07 calendars |
| 4 | Table uses: `uses: [paths]`; a single string is a one-item list; `use` stays as an alias. Base registry paths: encounters, encounters.reaction, encounters.signs, fights.tactics, fights.crit, fights.fumble, treasure, places.dressing, people.names, people.traits, world.weather, world.rumours. Groups: Encounters / Fights / Treasure / Places / People / World / Other. Packs add uses through `meta.tableUses: [{path, name, group}]`; the converter writes new uses there. An undeclared use gets a pack:check warning and is filed under Other. | 07 Table uses registry |
| 5 | `kind: "rumours"` is read as `uses: ["world.rumours"]`; the converter migrates old tables. | 07 |
| 6 | The in-app editor may edit pack lookup and matrix tables (on a copy) but not create new ones from scratch: copy an existing table and edit the copy. | 05, 07 |
| 7 | The tables ruling wins over M6-10's open-first panels: in Explore, Encounter and Fight the scene's current table shows as one row (name · Roll), its panel opening on tap. The table library is "Tables ›" and the prep space. | 05, 06, 08 |
| 8 | Components inventory rows for the quick table builder and the uses picker now, marked "design at M6/G-05". | 06 Components |
| 9 | "Foes' turn done" becomes "End foes' turn" and "Done without loot" becomes "Finish without loot": verb first, no exceptions; journeys 11 and 16 updated. | 05, 06, 08, diagrams |
| 10 | `outcomeDetail` approved as the name. | 04 |

## Night status

| # | Ruling | Where |
|---|---|---|
| 1 | "That period" is one advance: a day-long step's single wandering check marks that day's GM encounter-check reminders done. Check again stays available. | 05 |
| 2 | Set time… backwards gives status timers their time back, up to full length. Burnt-out lights and removed statuses don't return. The sheet says in one line: "Burnt-out lights and ended statuses stay gone. Use Undo to reverse a move exactly." | 05, 06 |
| 3 | `checks[].secret`, default true; the GM can reveal one result by hand (logged). | already in 03, 05, 07 |
| 4 | + Modifier offers −1 / +1 chips with an optional note in the same sheet; journey 3 stays at 3 taps. | already in 05, 06 |
| 5 | A check result recorded during Downtime shows to players at once. | already in 05 |
| 6 | Encounter table panel and Reminders list inventory rows confirmed. | already in 06 |
| 7 | The importer reads the older single `column` (two labels joined by a bar, as in 07) as `columns`, split on the bar. | 07 Checks |

## Pack readiness

| # | Ruling | Where |
|---|---|---|
| 1 | setting-1 0.6.2 and setting-2 0.3.2 become the M5-gate test packs, imported after #153 (summary removed; kindred classes' race fixed). | testing.md, 08 |
| 2 | A terrain restriction naming terrains a mode lacks moves into the activity's note until G-05 regions. | 07 Activities |
| 3 | No open rolls in either pack: `checks[].secret` default true is right. No `calendar.defaultStart` in either (no invented rules). Table uses wait for M6: design tags the encounter and reaction tables once the app reads `uses`. | — (pack work) |
