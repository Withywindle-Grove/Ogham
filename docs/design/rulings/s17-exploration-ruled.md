---
status: absorbed
milestone: m5
absorbed-into: partly: docs/07-content-packs.md (Exploration), docs/05-features.md (Exploration modes; Exploration follow-ups); S17-1 expedition.mode absorbed into docs/05-features.md (Exploration modes) and docs/04-data-model.md (Expedition), 2026-10-29; whole by the rulings catch-up 8 (2026-11-18): docs/04-data-model.md (`hideProcedureNotes`), docs/06-screens-and-design.md (strip, camp, activities, statuses, map panel), docs/08-roadmap.md (M5, M5b, M8b, R2, R3 rows), docs/09-decisions-log.md (2026-10-25, the S17 lines and the M5 split); parts later amended (the strip, status rings, activities), which the specs carry
supersedes: —
---

# S17 — Exploration modes: RULED

Status: RULED 2026-10-25 (12 rulings plus the map panel, status symbols and basic calendar, in the design Project). Built in **M5** (the engine and dungeon play) and **M5b** (wilderness play), with hexes in **M8b**. All examples are invented.

## 1. Modes come from the setting rules (S17-1)

- A rules set's **`exploration.modes`** lists modes. Each has `id`, `name`, `step` (`{value, unit}`), `procedure`, `checks`, `movement`, `rest`, and (for day-by-day modes) `terrain`, `camp`, `activities`, `weather`.
- **The app ships no modes of its own.** With none attached it uses two plain fallbacks: "Dungeon" (turn by turn) and "Wilderness" (day by day), with the clock, lights and reminders but no checks.
- **`expedition.mode`** replaces `expedition.setting`. Old hooks keep working: `"dungeon"` means the first turn-by-turn mode, and `"wilderness"` the first day-by-day mode.
- **When two attached packs both define modes,** they form an optional-rules group (`ruleKey: "exploration"`). The GM picks one pack's modes, all or nothing; a conversion pack can bridge them.
- **Switching mode** is one tap on the time strip, and logged.
- **A pack may add further modes** (a settlement visit, a river journey) in the same shape.

```json
"exploration": { "modes": [
  { "id": "delve", "name": "Delving", "step": { "value": 1, "unit": "turn" }, "procedure": [], "checks": [], "movement": {}, "rest": {} },
  { "id": "trek", "name": "Trekking", "step": { "value": 1, "unit": "day" }, "procedure": [], "checks": [], "movement": {}, "rest": {},
    "terrain": [], "camp": {}, "activities": [], "weather": {} } ],
  "playerReadable": true }
```

## 2. The procedure (S17-2)

```json
"procedure": [
  { "id": "weather", "name": "Weather", "icon": "weather", "kind": "roll", "tableId": "trek-weather" },
  { "id": "course", "name": "Decide the course", "icon": "course", "kind": "note" },
  { "id": "lost", "name": "Getting lost?", "icon": "lost", "kind": "check", "checkId": "trek-lost" },
  { "id": "wander", "name": "Wandering monsters", "icon": "monster", "kind": "check", "checkId": "trek-wander" },
  { "id": "describe", "name": "Describe the day", "icon": "describe", "kind": "note" },
  { "id": "camp", "name": "Make camp", "icon": "camp", "kind": "camp" } ]
```

- **Step kinds:** `note`, `roll` (a table; the GM enters the die result), `check` (from `checks`), `camp`, `auto` (done by the app, such as lights burning down or the clock moving).
- **Next turn or Next day is one tap.** Only steps needing input then appear, as prompts in order. `auto` steps run silently and show in the log. Any prompt can be skipped (logged).
- **`note` steps** show as one quiet line under the time strip. A campaign switch, "Hide procedure notes", hides them.
- **The full procedure is one tap away** from a checklist button in the top row: each step with its symbol, what was rolled, and its modifiers.
- **The live strip:** **one row only, never wrapping.** Each step is a symbol; only the current step glows and shows its name; finished steps fade; extra steps scroll. It shows for day-by-day modes, and in turn-by-turn modes only on turns when something falls due.
- **`icon`** comes from the app's fixed list of symbols (weather, course, lost, monster, describe, camp, rest, light, search, forage, hunt, and so on). A step without one shows a plain dot.
- **Dice stay at the table.** Prompts show the chance, already including modifiers ("Roll 1d6 · lost on 1–3"), and the GM taps the outcome.

### 2.1 Modifiers on prompts

Every prompt lists its modifiers with their source:
1. **From the rules:** terrain, weather tags and roads (the fixed list in section 3).
2. **From the party,** through hooks:
   - new event `checkDue` (names: `check`, `party`, `location`, `weather`, `mode`, and `actor` for activities);
   - new hook kind `modify`, with targets `chance` (add or remove faces), `afterHit` (a follow-up chance, such as "if lost, a tracker finds the way again on 1–3") and `note` (a line on the prompt);
   - new function `partyWith(path, value)` (the members matching, for example by class).
3. **By hand:** "+ Modifier" on any prompt (GM only, with a note, logged).

## 3. Checks (S17-3)

```json
{ "id": "trek-lost", "name": "Getting lost", "every": { "value": 1, "unit": "day" }, "when": "start",
  "chance": { "die": "d6", "on": [1] }, "byTerrain": true, "onlyAt": null, "onHit": { "tableId": "trek-lost-result" },
  "modifiers": [ { "weatherTag": "poor-visibility", "add": 1 },
                 { "routeType": "road", "never": true },
                 { "routeType": "track", "chance": { "die": "d6", "on": [1] } } ] }
```

- **The S16 encounter-check shape, plus:**
  - `byTerrain` (the chance comes from the current terrain);
  - `when` (`start`, `middle` (when half the budget is spent) or `end`, for day-long steps; if missing, procedure order);
  - `onHit` (the next table).
- **The modifier list is fixed:** `weatherTag` (`add`), `routeType` (`never` or an override `chance`) and `trackId` (the S16 `byTrack` shape). Situational changes (light, noise, hiding) use "+ Modifier".
- **A location's own check replaces the mode's** while the party is there, and a mode's wandering check counts as an "Encounter check" for the GM's own reminders (S16 follow-up ruling 4).
- **Checks falling due together** prompt in procedure order, each merged with its count.

## 4. Movement (S17-4)

- **Turn-by-turn (`perStep`):** `formula` and `familiarFormula` in feet. Information only: "Explore 90 ft per turn · familiar 300 ft". Known routes use M8b's Travel (turns = route length ÷ familiar movement; checks due along the way show once with a count).
- **Day-by-day (`budget`):**

```json
"movement": { "kind": "budget", "name": "Travel points", "unit": "points", "perDay": "floor(speed / 5)",
  "forced": { "factor": 1.5, "note": "Rest a full day after, or be exhausted" },
  "roads": { "per": { "value": 6, "unit": "mile" }, "cost": 2 }, "tracks": { "per": { "value": 6, "unit": "mile" }, "cost": 2 },
  "mounted": 40, "vehicle": 30 }
```

- **The budget uses the pack's own name and unit** (points or miles). Terrain costs are in the same unit. `perDay` is rounded down.
- **Party speed** is the slowest member's, from their load's tier `movement`. `mounted` and `vehicle` override it when the party rides or has a cart. Otherwise **the GM sets party speed by hand**.
- **Shortfall carries over** ("1 more to enter tomorrow"). Movement is never blocked.
- **Forced march** is one tap: it adds the factor and sets a "Rest tomorrow" reminder.

## 5. Terrain (S17-5)

```json
"terrain": [
  { "id": "open", "name": "Open ground", "class": "easy", "cost": 2, "searchCost": 2, "lostChance": [1], "wanderChance": [1], "mounts": "ride", "vehicles": true },
  { "id": "thick", "name": "Thick wood", "class": "hard", "encounterTableId": "trek-wood-encounters" } ],
"terrainClasses": [
  { "id": "easy", "cost": 2, "searchCost": 2, "lostChance": [1], "wanderChance": [1], "mounts": "ride", "vehicles": true },
  { "id": "hard", "cost": 3, "searchCost": 3, "lostChance": [1, 2], "wanderChance": [1, 2], "mounts": "lead", "vehicles": false } ]
```

- **A terrain inherits its `class`'s numbers** unless it overrides them. `encounterTableId` is the table rolled when a wandering check hits there.
- **Locations carry `terrain`.** Adventure packs may add terrain types (prefixed with their pack code).
- **Mounts and vehicles in the wrong terrain** get a warning, never a block.
- **The converter** turns percentage-style rules into costs and chances, and lists the conversions in its report.

## 6. Hexes, point crawls and hidden features (S17-6)

- **`hexGrid` on a region** (in setting rules or adventure packs): `size`, `orientation` (`flat` / `pointy`), `coords` (`offset-odd-columns`, `offset-even-columns`, `offset-odd-rows`, `offset-even-rows`), and `keyFormat` (for example `CCRR`). Hex locations carry `hex` keys.
- **Neighbours are listed with directions that suit the orientation:** "North-east · 0608 · Thick wood · 3".
- **Blank hexes can be entered.** They use the region's `defaultTerrain`, or the GM's pick, and can be named and noted on the fly (saved to campaign homebrew).
- **Point crawls** use S16 `routes`. **Roads and tracks** are routes with `type: "road" | "track"` and a `distance`; travelling them spends the road cost. Features may be marked `seenFromRoad: true`.
- **`hiddenUntilSearched: true`** works on secrets, clues and sub-locations. Searching costs the terrain's `searchCost`; the GM's prompt lists what's found; found stays found.
- **Campaign state:** current hex or place, visited, searched, found, and any carried-over cost.
- **Maps** come from adventure packs' images (S16 §9) and the GM's uploads. A map image may carry **`gridOverlay`** (`{ origin: {x, y}, hexWidth }` in image pixels), reserved for tapping hexes in R2.
- **R1:** a neighbour list plus the map panel (section 12). Tapping hexes on a map is R2.

## 7. Camp (S17-7)

```json
"camp": { "procedure": [
  { "id": "setup", "name": "Set up, firewood, water", "icon": "camp", "kind": "note" },
  { "id": "fire", "name": "Fire, cooking, company", "icon": "camp", "kind": "note" },
  { "id": "watches", "name": "Set watches", "icon": "watch", "kind": "watches", "watchLength": { "value": 2, "unit": "hour" } },
  { "id": "night", "name": "Night encounters", "icon": "monster", "kind": "check", "checkId": "trek-night" },
  { "id": "sleep", "name": "Sleep", "icon": "rest", "kind": "roll", "tableId": "trek-sleep", "onGoodRest": [ { "heal": 1 } ] } ],
  "quick": { "option": "quick-camp" } }
```

- **By default only watches, the night check and sleep prompt.** Other steps are `note` lines unless a pack marks them `roll`.
- **Watches:** characters are put in order (drag, handles on the right). When the night check hits, the prompt says whose watch it fell in. Players see their own watch.
- **On a good rest** the app **offers** the pack's effects ("Heal 1 HP to: ✓ ✓"), with one confirm, never automatically.
- **Quick camping** is an optional rule: one tap.
- **"Make camp"** is available in any mode (time strip ⋯), and a dungeon mode may define its own camp.

## 8. Activities (S17-8)

```json
"activities": [
  { "id": "forage", "name": "Forage", "icon": "forage", "cost": { "budget": 0 }, "chance": { "die": "d6", "on": [1, 2] },
    "tableId": "trek-forage", "who": "one", "onlyIn": ["open", "thick"], "seasons": ["spring", "summer", "autumn"] },
  { "id": "hunt", "name": "Hunt", "icon": "hunt", "cost": { "budget": "all" }, "chance": { "die": "d6", "on": [1, 2] }, "tableId": "trek-hunt", "who": "one" } ]
```

- **A compact row of activities** shows under the panel, **only when usable here and now.**
- **The prompt asks who's acting.** `modify` hooks apply that character's abilities, listed with their source.
- **On success,** the table's result offers to add any item it names to the actor's pack or the Party stash, with one confirm.
- **Costs** come off the budget, or move the clock. Logged and undoable.
- **"Other…"** is always last in the row for the GM, and appears on players' Scene as "Propose an activity…". The player describes it in a line; the GM approves or declines, then sets the cost, an optional chance and the effect (a note, an item, or a status). Logged; the outcome shows on Scene.

## 9. Seasons, weather, time lengths, calendar (S17-9, calendar ruling)

- **`seasons: [{id, name}]`** in the rules set.
- **Basic calendar (M5):** a calendar (07 `calendars`, from setting rules or homebrew) gains `season` on each month. The GM sets the adventure's start date; the clock's day count becomes a date ("14 Mossmonth, spring"); **the season follows the date.** Without a calendar, the GM picks the season (logged, shown on Scene).
- **Weather:** `weather.tables` keyed by season id, or `any`. It's rolled once a day as a procedure step. Rows carry `tags` (`poor-visibility`, `impassable`, `wet`). Players see the result with the season, never the table or tags.
- **Special seasons:** each has `id`, `name`, an optional weather table, encounter-table swaps, and a start rule (kept for R3). In R1 the GM switches them on and off by hand.
- **Daylight:** optional sunrise and sunset by season or month. The time strip may hint "Sunset around now". **The Day / Night switch stays the GM's.**
- **`time.extra`:** `[{id, name, minutes | hours | days, showOnClock?}]`, usable in reminders' `every`. At most one shows on the clock, and only if it divides evenly into a day. No extra buttons.
- **R3:** holidays and special days with reminders, moon phases, special seasons starting by themselves, and the calendar view.

## 10. Rest and exhaustion (S17-10)

- **`rest`** per mode: `{ "every": {...}, "length": {...}, "condition": "<condition id>" }`. It's a reminder with **Rested** (clears it) or **Push on**.
- **Push on** offers to mark the pack's condition on the party (names ticked, untickable). If the condition `stacks`, each time adds 1 ("×2").
- **In M5** the mark shows as a status symbol (below) on the character's card and the Player screen. In M6 it gains timers.
- **Numbers never change automatically.** Resting clears the mark for those who rested. Logged and undoable.

### 10.1 Statuses as symbols (all statuses, from M5's chip to M6)

- **Each status is a symbol.** `conditions` gain an `icon` from the app's fixed list; without one, the first letter in a circle.
- **Timers fill or drain the symbol,** like a cooldown. **Stacks** show a small number.
- **Tap a symbol** for its name, source, rules text, time left, how it ends or is cured, and stacks, with Remove for whoever may.
- **Hidden timers:** players see the symbol without the fill; the GM sees the countdown.
- **Accessibility:** shape and symbol first, never colour alone. Screen readers announce "Exhausted, 2 stacks".
- **Shown on** the character card, the Player screen (beside HP) and the combat list (M6).

## 11. What players see (S17-11)

- **The time:** mode and step, day or night, date and season, and today's weather once rolled.
- **The party:** travel budget left, their own watch, status symbols, and "Propose an activity…".
- **Where they are:** the place's player name and terrain, plus adjacent hexes' terrain. Hex numbers appear only with the campaign setting **"Show hex numbers to players"** (default off).
- **Procedures:** **any procedure present in the player-facing rules is visible to players** (`exploration.playerReadable: true`), as the same one-tap reference list. There's no live strip on players' screens.
- **Modifiers** on prompts that involve them (their activity, or getting lost when Open), from public sources only: terrain, weather, roads, and their own or the party's abilities.
- **Getting lost** is a campaign setting: **Secret** (default; the GM's screen tracks the true position) or **Open**.
- **Revealed maps** come through Handouts and Scene.
- **Never shown:** modifiers from GM-only sources (adventure location checks, countdown-linked chances, the GM's hand modifiers), anything in Secret mode, the costs and features of unexplored hexes, hidden features, encounter tables, and GM notes.

## 12. Screens: the map panel

- **iPad landscape:** the Explore screen in every mode has a **map or picture panel** for the current location (or its region or site). Tapping it opens full screen with pinch-to-zoom.
- **Phone and iPad portrait:** a "Map" chip on the time strip, one tap away, only when a picture exists.
- **When there's nothing to show, the panel's space is reclaimed** by the other panels. This is a general design principle: an optional panel with no content collapses.
- **M5 builds the panel in the layout;** M8b fills it from adventure images. Players see only revealed copies.

## 13. Where it's built (S17-12)

| What | Milestone |
|---|---|
| Clock (seconds counter), `time.extra`, basic calendar; modes, procedures, prompts, one-row strip, player reference list; checks with modifiers, `modify` hooks, "+ Modifier"; dungeon movement information; lights, marching order, minimal current location, Send; rest reminders, condition and status symbols; the map panel in the layout | **M5** (gate: a mock dungeon delve for 10 turns) |
| Travel budget, forced march, carry-over; terrain and mount warnings; weather and seasons; camp with watches and sleep offers; activities and "Other…"; getting lost Secret or Open; hex numbers setting | **M5b**, before M6 (gate: a mock 3-day trek with weather, a lost check, a forage and a camp) |
| Hex grids and neighbours, hidden features, roads and tracks as routes, Travel, adventure maps in the panel | M8b |
| Tapping hexes on a map (`gridOverlay`) | R2 |
| Holidays, moons, special seasons starting by themselves, calendar view | R3 |
