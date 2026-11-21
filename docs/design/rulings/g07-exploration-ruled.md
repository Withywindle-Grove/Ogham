---
status: absorbed
milestone: m5
absorbed-into: docs/07-content-packs.md (Exploration), docs/05-features.md (Exploration follow-ups), docs/11-modelling-gaps.md (G-07), scripts/pack-format.mjs (the checker), 2026-10-29
supersedes: 07's activities `onlyIn` as terrain ids; the open icon list; `encounterSwaps`; `camp.procedure` as a mode id
---

# G-07: exploration fields, RULED (2026-10-29)

Francis approved, from the design chat. The list of off-spec fields from both packs came from Claude Code (D17). The design agent migrates both packs; the checker learns the shapes with invented fixtures.

## General
- Free text is `note` everywhere (modes, checks, movement, rest, camp, steps, terrain, activities, exploration itself). `notes` is read as an alias. `source` is allowed on any object or sub-object.
- `onlyWithOption: "<option id>[:<choice id>]"` is the one way to say "only when this optional rule is on" (weather effects, a scroll-copy rule, and so on).
- Icons are a closed list: time, light, listen, door, search, rest, camp, travel, weather, encounter, star, note. Unknown values show the plain dot and the checker warns.
- time.turnsPerHour <int> is accepted. When given, it wins over a value derived from turnMinutes.

## Modes
- modes[].other: boolean, default true (show "Other…").
- modes[].rest: null means no rest in this mode. rest.note is allowed.
- camp.sameAs: "<mode id>" reuses another mode's camp (replaces camp.procedure as a string). Camp steps may have checkAbility: "<ABILITY>" and onBadRest: [{ condition }], mirroring onGoodRest.
- Procedure steps: tableId may be left out on a roll step (the GM types the result, with the note as the prompt). tableBySeason: { <season id>: <table id> } replaces the "byseason" sentinel. note is allowed on any step.
- terrainClasses sit inside the mode. Each class may have a name. Terrain may use a class OR give its numbers inline (both are valid). terrain[].note is allowed. terrainClasses mounts values add "none".

## Movement
- movement.unit (default "ft").
- movement.costPer: { value, unit } is the distance a terrain cost covers (replaces terrainCostPer and movement.hexSize; the hex size itself stays on hexGrid, see G-05).
- movement.mounted and movement.vehicle: <int> speeds in the mode's unit.

## Checks
- onHit: { tableId? | tableChoices?: [ids] (the GM picks, e.g. by depth), columns?: [labels] (the GM picks, e.g. road or wild), regionTables?: true, note? }. onHit with no table means a note-only result.
- terrain[].encounterColumn: "<label>" picks the column automatically by terrain (it beats columns when both are set).
- checks[].tableId (the encounterCheck shape) stays valid. onHit.tableId is preferred inside modes.

## Activities
- cost: { steps: <int> } in turn modes, or { budget: <int> | "all" } / { time }. Also { fromTerrain: "<field>" } (e.g. searchCost) replaces the "terrain.searchCost" string.
- requires: { skill?: <skill id>, item?: <item id> } (classSkill becomes skill; requiresItem text becomes requires.item, an id, with the text kept as note if no id exists).
- chance: { skill } | { abilityCheck: "<ABILITY>" } (uses the rules set's abilityCheck).
- maxActors <int>; bestOf: true (several roll, the best counts).
- modifiers: [{ when: "fullDay" | "<condition>", add: <int>, note? }] (replaces ifFullDay).
- result: <text or dice>.
- tableId (replaces onSuccessTableId) plus tableByTerrain: { <terrain id>: <table id> }; bySeason: { <season id>: <dice or text> } (replaces seasonResult); bySpecialSeason: { <id>: <text> } (replaces specialSeasons).
- onlyIn means modes (05 and X-2). The terrain restriction becomes onlyOnTerrain: [<terrain ids>]. Fix 07.

## Rules-set level
- weather may sit at the rules-set level as the default for day-by-day modes; a mode can override it. weather.rollEvery: { value, unit } (default once a day); weather.onlyWithOption.
- specialSeasons[].encounterSwap: { chance: { die, on: [ints] }, tableId } (singular, replaces encounterSwaps). start, weatherFrom and effects are accepted; start stays R3 data.
- daylight.byMonth: [{ month, sunrise: "HH:MM", sunset: "HH:MM" }] accepted (by season works the same way).
- wildEncounters: { typeTableId, commonTables, regionalTables, aquaticTableId, activityTableId, lairChance, lairMultiplier, surprise, distance } accepted. regionalTables is keyed by region name until G-05 rules regions, then by region id.
- lost, unencumberedMovement and defaultSpeed are free-form reference sections; the mode's check and formulas are what the engine uses.
- Add these to 07's free-form reference list (no engine; gmOnly honoured): hunger, hazards, dungeon, settlement, vehicles, fairyRoads, leyLines, shrines, surprise, encounter, encounters, exploration.notes.
- hexGrid and the pack-root regions kind: unchanged and flagged, for the G-05 design session (before M8b's design).

## 11 register
G-07 becomes "ruled". The row's out-of-date "In proposedExtensions" text is fixed.

## 09 line
- 2026-10-29 — [packs] Exploration fields (G-07): note everywhere, source on any object, onlyWithOption, a closed icon list, turnsPerHour, camp.sameAs, tableBySeason, movement.costPer, onHit tableChoices/columns/regionTables, terrain encounterColumn, activity cost.steps/fromTerrain, requires.skill/item, chance.abilityCheck, bestOf, maxActors, bySeason/tableByTerrain, onlyIn = modes plus onlyOnTerrain; rules-set weather default, encounterSwap, daylight.byMonth, wildEncounters; reference-only sections listed; hexGrid and regions wait for G-05 — one shape per idea across packs, so the M5 engine reads real packs
