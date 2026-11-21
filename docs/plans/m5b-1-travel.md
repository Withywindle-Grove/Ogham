# Plan: M5b step 1 — travel: Move…, the budget, Lost, the location view

Written by the design agent, 2026-11-01 (split approved by Francis the same day). Read the specs it names; this file makes no rulings. **Qualifies for Fable**: a migration with row-level security (per-group wilderness state; Lost readable by players only when Getting lost is Open). Ask Francis in one line before build order 1.

## What this step delivers
The GM moves the party through a day: **Move…** spends the pack's travel budget by route and terrain, the **budget card** shows what's left, a **shortfall** carries into tomorrow, **Force march** is the players' button, **Lost** is a status with a morning card, and the **location view** gains its minimal parts. All of it per group of a split party; one clock for all.

## Already built (verify, don't rebuild)
*Re-plan 2026-11-01:* this step now follows the gate build steps m5b-0 and m5b-g1–g6; Rest today is the shared rest flow (g6), the players' screen is the table view (g6), Something else… is gone (g1).
Weather (players' roll, the card, Weather rolled by), Hit / Miss check prompts with modifiers, special seasons and Travelling in darkness switches, Rest today, the Where? free jump, the start place per expedition (M5 step 10), places per group with Show players / Hide (M5 step 11). Check `src/modules/expedition` first and list what exists in the status report.

## Rests on
- 05 Exploration modes: *Movement* (Move…, Routes, Budget card, Shortfall, Rest due, Force march, Spend the day looking, Lost), *Terrain*, *Event-triggered checks*, *Once per period*.
- 06: *Wilderness day* (tablet and phone layouts), *Wilderness on Scene* (travel points left, Force march with ⓘ), the location view in three versions (M5b builds name, player text, terrain, picture, GM notes).
- 07 Exploration: `movement` (`kind: budget`, `perDay`, `forced`, `routes`, `mounted`, `costPer`), `terrain` and `terrainClasses`, checks' `alsoWhen`, `routeType` modifiers.
- 04: ExplorationState per group (`groupId`, 2026-10-31); Location (minimal).
- 03: Lost row (Open: players may enter the roll; Found the way / Still lost are the GM's).
- 09, 2026-10-31: Getting lost defaults Secret; per-group wilderness state.
- Rulings: `design/rulings/m5b-wilderness-2026-10-30.md` S1–S7, D4, D7–D10, S2-5, S4-6, Q1.

## Build order
1. **Engine and migration (Fable).** Per-group wilderness state: today's budget (worked out from the slowest member's load-tier movement through the inventory module's `speedOf`, built in the engine reconcile, or `mounted`, or set by hand), spent, carried shortfall (`place`, `owed`), forced-march stacks, Lost (status with the pack's recovery reminder). Row-level security: the GM reads all; a player reads their own group's budget and shortfall; Lost is readable by players only while the campaign's Getting lost is Open. Commands as intents with request ids: `travel.move`, `travel.setBudget`, `travel.forceMarch`, `travel.spendDay`, `travel.lost.set`, `travel.lost.resolve`. Rows in `logged_commands`; cases in `permissionCases.ts`.
2. **Move… (GM).** Sheet: route (the pack's `routes`), terrain (the mode's `terrain`), optional place name → shows the cost and the check chances it will trigger (lost: never on a road; `alsoWhen` matches) → Move. Toast with Undo. The party's place updates (the group's place from step 11); an unnamed place reads "<Terrain> (unnamed)". Where? stays as the free jump.
3. **Budget card.** "<pack's name> N of M" with the weather change (only when not zero); pips to 12, a bar with ticks above; On foot / Riding / Cart (riding uses `mounted`, else asks once); tap the number for the breakdown (speed source, terrain costs today, weather, forced march). "Rest due" line on the pack's rest day with the existing Rested / Push on. Day's end: "N unused points lost" to the log.
4. **Shortfall.** When a Move… costs more than what's left: "Entering <place> · N more tomorrow"; the group is "entering" (camp and the night check use the place it's in, D10); next day's points pay it first; a new Move… replaces it with the log line "Course changed · N owed for <place> dropped".
5. **Force march (players).** A button on the players' screen and on the shortfall line; applied at once (no GM accept), ⓘ shows the pack's effects; `forced.factor` or `add`, `stack` as the pack says; makes rest due for the group that evening (g6's shared flow in camp's sleep step; ruled 2026-11-01); per group, never paying another group's shortfall; GM can undo. **Engine:** merge #169 first (`plans/m5b-engine-reconcile.md`). **Spend the day looking** (GM, and as a secret-activity request later in step 3): uses up the remaining points.
6. **Lost.** Set by the lost check's hit (Hit / Miss already built) or by hand; the morning summary shows the **Lost card**: the pack's recovery chance, Found the way / Still lost (GM). Getting lost Open: players see the status symbol and the card's roll line and may enter the roll; the GM taps the outcome. Secret: GM-only, enforced by the database.
7. **Location view, minimal parts.** The place card from step 11 grows: terrain (always shown to players as "the ground around them", Q1), picture (an image from the campaign's homebrew; Drive images are M8b), GM notes; sections appear only with data; empty state "Where are we? · Set place". Tablet landscape: day controls left, location view and marching order right; phone: the location view opens as a sheet.
8. **`alsoWhen`.** The engine prompts a check whose `alsoWhen` matches a Move… (e.g. `{ "leaveRoute": "road" }`); `npm run pack:check` already knows the field (verify).

## Tests (purpose first)
- Another group's player can't read my group's budget; a player can't read Lost while Getting lost is Secret, and can when Open.
- A Move… that costs more than what's left creates a shortfall; the next day pays it first; a new Move… drops it with the log line.
- Force march applies the pack's factor (and `add`), stacks only when the pack says, and sets the rest reminder.
- The budget comes from the slowest member's load tier; Riding uses `mounted`.
- Undo on Move… restores the budget and the place.
- The lost check never prompts on a road route; `alsoWhen` prompts on the matching Move….

## Scope checks (write one and stop)
- No hex grid, neighbours or Ways on (M8b, G-05); no "Show hex numbers to players" (⚑ 1 below).
- No camp, no activities, no Encounter waiting (steps 2–4).
- No settlement view (deferred to the downtime design session).
- Movement is never blocked (a mount in the wrong terrain warns).

## ⚑ for Francis (ask at the start)
1. "Show hex numbers to players" (S4-6) has nothing to show before M8b's hex grids: move the setting to M8b? (Recommendation: yes.)
2. The picture on the location view: campaign homebrew images only in M5b (upload from the GM's device), Drive in M8b. OK?

## Estimate
35–45 builder turns; build order 1 on Fable (one migration, fix forward only).

## Departures

**Designer, 2026-11-03 (`design/rulings/m5b-builder-questions-2-2026-11-03.md` bq2-3):** readings (a)–(e) of the phone sheet confirmed as built.

**Designer, 2026-11-03 (`design/rulings/m5b-builder-questions-2026-11-03.md` bq-4):** build order 7's two missing pieces, the location view's phone sheet and the empty state "Where are we? · Set place", are built in M5b before the gate.

**Build order 7: done** (`m5b-1c-location-phone`, bq-4, 2026-11-03). Under 600 px, in a wilderness day (GM and players), the place is an **Open card** (a new shared part, `OpenCard` in `parts.tsx`, which What we know's card now uses too): its name and one summary line ("Around them: Bog · 1 of 3 pieces shown"; a player's: the first shown piece and "N more"); its tap opens the same place card (or a player's `PlaceLine`) as a sheet, the Dialog's Wide variant (the whole screen on a phone, ✕ top right). The empty card reads **"Where are we?"** with **Set place** (opening Where now?) instead of "Somewhere unnamed"; on a phone the empty Open card is "Where are we? · Set place" and its one tap is Set place. Departures: (a) no mockup for the phone sheet is in the repo (the session-1 mockups the ruling cites aren't committed), so the trigger's look is the What we know card's, and the sheet is the existing Wide pop-up; (b) on a phone with no place set, the checks list (GM) is reached only after Set place; (c) `Dialog` now gives Escape and Tab to the newest pop-up only (Where now? or the full picture opened inside the sheet used to close the sheet with it); (d) dungeon mode keeps the place on the page on a phone (06 asks for the sheet in the wilderness day and Wilderness on Scene only); (e) a "Where now?" with a blank name still says "somewhere unnamed" in its toast and log line (only the card's words were ruled).

**Francis on #364's pictures, 2026-11-04:** the Open card's › moved to the card's right edge, centred vertically, on phones (it wrapped under the text); long names wrap in the text column beside it. Fixed in the shared `OpenCard`, so What we know's card gets it too. From 600 px the › still follows the summary's last word, as approved (he asked for phones only).

- ⚑ 1 and 2 ruled 2026-11-03 (yes; OK) and written into 09.
- Build order 7 (location view), partly: `places.terrain_id` and `places.image_asset_id` exist; the players' "Around you: <terrain>" comes from the group's travel row. The picture upload and the tablet landscape two-column layout are not in this pull request (a follow-up). **Built in the follow-up PR (`m5b-1b-location-view`):** the picture (migration `20261103200000_m5b_1b_place_picture.sql`) and the two-column day. Departures there: the picture is an asset of a new kind `place` (not `map`, as 04 had it: What we know lists revealed maps, and a place's picture would have joined them); a player reads it only once the GM shows **the picture itself** (⚑ ruled B by Francis 2026-11-03, below); two commands, `place.addPicture` (upload, not undone, like a portrait) and `place.setPicture` (the place's picture piece, undone by its toast); replacing or taking off a picture keeps the old file (nothing erased); the time strip moves into `PartyGroups` as its `lead` so it can head the left column; the phone sheet ("the location view opens as a sheet") and the empty state "Where are we? · Set place" are still not built.
- Build order 8 (`alsoWhen`): the Move… preview and toast list the checks the move sets off; the prompt isn't pushed into the check panel (the GM uses Check now). **Built in the follow-up PR (`m5b-1b-location-view`):** the checks go on the time strip's card as Hit / Miss lines ("Going astray · Left the Causeway", per group after a split), logged as checking now; the move's Undo takes them off. Departure: a move made on a screen without the time strip (none today) only names them in its toast.
- ⚑ (follow-up) ruled B by Francis 2026-11-03: a place's picture reaches players only when the GM shows the picture itself, with its own eye. Fixed forward in `20261103201000_m5b_1b_picture_shown_on_its_own.sql` (20261103200000 was on the test project): the picture is a piece of the new kind `picture` (`place_pieces.asset_id`), so the pieces' own shows carry it (place.showPiece / hidePiece, Hide all, the return visit's place.backAt, one group's visit); `public.set_place_picture` retires the old picture piece and adds the new one hidden (place.setPicture joins undoable_makings); the reading rule and `scene_pictures` follow the picture's own show. `places.image_asset_id` is left unused (not dropped). What we know skips the picture (it isn't a line of text).
- Force march's rest due: opens the group's rest flow at once (a called rest) until camp's sleep step exists. **Workaround replaced in the camp follow-up PR #324 (`m5b-4-camp-followup`, SC-4-3 A, 2026-11-03):** the rest is due in camp's Sleep step.
- The Lost card's chance is the lost check's for the terrain (07 has no recovery field): a pack task if a separate chance is wanted.
- Fix-forward migration `20261103111000` (grants only).
