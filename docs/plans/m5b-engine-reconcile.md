# Plan: reconciling the M5b engine draft (PR #169) with the amended plans

Written by the design agent, 2026-11-01, from a read of `origin/m5b-engine` (`travel.ts`, `eventChecks.ts`, `sleep.ts`, `eating.ts`, `wildPack.ts`, `activities.ts`, `modes.ts` and their tests) against `plans/m5b-1-travel.md` … `m5b-4-camp.md`, 04 (ExplorationState), 05 (Exploration modes), 07 (Exploration) and the 09 lines since 2026-10-30. The draft is pure TypeScript with tests, no UI, no migrations; it was written 2026-10-30 from S1–S5, D4, D8, D9, D14, D15, D19. This file makes no rulings; its ⚑ are Francis's.

**Headline.** The engine's *behaviour* still matches the plans almost everywhere (the gate re-plan changed screens, not the wilderness rules). What has drifted is **the code around it**: main has moved three weeks' worth of M5 and gate steps past the branch, so two of the draft's additions duplicate things main now does (`weather.tags`, the pack checker), one pack name is stale (`sleep.difficulties[].roll` → `result`), and the pieces the plans added after 2026-10-30 (per-group state, Lost, the Encounter waiting queue, the activity roll, camp fire) are simply not there. Recommendation: **merge after a rebase and the fixes in §2–§4**, as the engine of m5b-1 and m5b-4, rather than rewriting.

## 1. Keep (behaviour that still matches)

| Engine | Matches |
|---|---|
| `dayBudget`: base from the slowest member's known speed, or the pack's `mounted` / `vehicle` speed, or the GM's number; `ask` says why the GM is asked; the breakdown lines (base, weather, forced) | m5b-1 build order 3 (budget card, breakdown); 05 Movement, S3; 07 `movement` `perDay`, `mounted`, `vehicle` |
| Weather tags change the budget on their own line and are skipped at 0; `warn` goes to the GM on a move; nothing is blocked | m5b-1 bo 3 ("weather change only when not zero"); 07 `weather.tags` `budget`, `warn` |
| `previewMove` / `applyMove`: cost from the GM, else the route, else the terrain; "<Terrain> (unnamed)"; the destination's check chances; a shortfall is never a block, "Entering <place> · N more tomorrow"; a new Move… replaces an owed one with "Course changed · N owed for <place> dropped" | m5b-1 bo 2 and 4; 05 Movement S1, S2, S4 and the 2026-10-30 confirmation |
| `startDay` pays yesterday's shortfall first and names the arrival; `endDay` logs "N unused points lost" | m5b-1 bo 3–4; 05 S3, S4 |
| `forceMarch`: `factor` or `add`, `stack` once / add, pays what's owed first, returns the mode's rest and the pack's note; `spendTheDay` uses what's left | m5b-1 bo 5; 05 D4, D8; 07 `forced` |
| Mount or cart warnings from the terrain's `mounts` / `vehicles` | 05 Terrain ("warning, never a block") |
| `eventChecks`: the four `alsoWhen` keys, each check once per move, the prompt worked out for the destination, a plain-words reason | m5b-1 bo 8; 05 Event-triggered checks; 07 `alsoWhen` |
| `sleep`: first matching row by season, fire and bedding; shared bedding by `shares`, carrier first; reasons in words; GM override kept and marked; no matching row → the GM decides; `checkAbility`; camp-fact modifiers | m5b-4 bo 6; 05 Sleep (D19); 07 `camp.sleep` rows, `beddingItems`, `modifiers`, `checkAbility` |
| `eating`: cooked, then fresh, then preserved; who hasn't eaten; nothing-to-eat with givers; `cookPortions` as a count or a roll | m5b-4 bo 3; 05 Eating (D14), Cooking (D15); 07 items' `food` |
| `activities`: `yields` with the season's `bySeason` dice overriding | m5b-3 bo 1; 07 `yields` |
| Everything is pure and forgiving (an unreadable shape is left out, never a failure), as `modes.ts` on main | 02 foundations; the M5 engine's own style |

## 2. Change (the code does one thing, the spec another)

1. **Sleep difficulty `roll` → `result`.** `wildPack.ts` reads `difficulties[].roll: boolean` ("False: no roll (Easy)") and `sleep.ts` derives `needsRoll` from it. 07 (`camp.sleep`, confirmed 2026-10-30 that night) and the checker on main (`scripts/pack-exploration.mjs`: "`roll` is the old way") say **`result: "good" | "check" | "bad"`**: good and bad need no roll and lead to `onGoodRest` / `onBadRest`; check rolls. Fix: `wildPack.ts` (`SleepDifficulty.result`, `readSleep`), `sleep.ts` (`SleepFor.outcome: 'good' | 'check' | 'bad'` in place of `needsRoll`), `sleep.test.ts`. The ruling's own words: 09 2026-10-30 "sleep difficulties { id, name, result, add? }".
2. **Weather tags are read twice.** The draft adds `ExplorationRules.weatherTags` through `readWeatherTags` in `wildPack.ts`; main's `modes.ts` `readWeather` already reads `weather.tags` with `name`, `note` (and the old `effect`), `budget`, `warn`. Fix: delete `readWeatherTags` and the `weatherTags` field; `travel.ts` reads `rules.weather?.tags[id]`. Files: `wildPack.ts`, `modes.ts`, `travel.ts`, `travel.test.ts`.
3. **The pending place is a name, the group has a place.** `Pending` carries `placeName`, `routeId`, `terrainId`. Since M5 step 11 each group has a place record (places per group), and m5b-1 bo 4 says "the group is entering (camp and the night check use the place it's in, D10)". Fix: `Pending.placeId: string | null` beside the name so the arrival sets the group's place, and the preview carries the place's id when the GM picked an existing one. File: `travel.ts` (`Pending`, `Move`, `applyMove`), the commands of bo 1.
4. **Forced march and the shared rest flow.** `forceMarch` returns `rest: mode.rest` "so the caller sets the rest reminder". Since the gate (B5, 2026-11-01) rest is the shared flow: a forced march should make **"Rest due"** fall on the group's strip (the flow of g6), not set a reminder of its own. Fix: the command of m5b-1 bo 5 marks the group's rest due through g6's rest record; the pure function needs only a `restDue: true` flag. File: `travel.ts` (`ForcedMarch.rest` → `restDue`), the command.
5. **Activities read `onlyWithOption` only.** `activities.ts` (main and the branch) and `modes.ts` read `onlyWithOption`; 07 (G-40, 2026-11-01) makes **`option`** the name with `onlyWithOption` as an alias. This is the G-40 builder step (11), not the draft's fault; do it in the same step so the wilderness packs' `option` fields work. Files: `modes.ts` (`readActivity`, `readCheck`, `readStep`, `readTable` sites), `activities.ts`, tests.
6. **`Traveller.speed` is "the load tier's movement".** The comment says the inventory module works it out; the plan (m5b-1 bo 1) says the same but the function that gives a character's speed from `CarrierLoad.tier` and the rules set's `movement` rows doesn't exist on main (the load bar shows a tier, not a speed). Fix: a small `speedOf(tier, rules)` in the inventory module, tested; `travel.ts` unchanged. Mark it in m5b-1 bo 1.

## 3. Rename (provisional pack names in `wildPack.ts` → 07)

| In `wildPack.ts` | 07 today | Action |
|---|---|---|
| `movement.kind: "budget"`, `name`, `unit`, `perDay`, `mounted`, `vehicle` | the same (Movement, day by day) | keep |
| `movement.routes[] { id, name, cost?, column?, note? }` | the same (confirmed 2026-10-30) | keep |
| `movement.forced { factor? \| add?, stack?, note? }` | the same | keep |
| `movement.costPer { value, unit }` | in 07, **not read** by the draft | see §5 (display only) |
| `checks[].alsoWhen` four keys | the same | keep |
| `camp.sleep.difficulties[].roll` | **`result: "good" \| "check" \| "bad"`** | rename (§2.1) |
| `camp.sleep.rows[] { season \| seasons, fire, bedding, difficulty }` | `season` (one id or a list); `seasons` is the draft's own alias | keep `season`; drop the `seasons` alias or leave it harmless |
| `camp.sleep.beddingItems[] { id, shares? }`, `modifiers[] { when, add, note? }`, `checkAbility` | the same | keep |
| `camp.cooking { ingredients?, portions, bonus?, note? }` | the same, **still marked provisional** in 07 (D15) | keep; ⚑ 1 |
| `camp.fire { lightTypeId, note? }` | in 07 (D16), **not read** by the draft | §5 |
| items' `food: "fresh" \| "preserved" \| "cooked"` | the same (07 items) | keep |
| activities' `yields { item, dice }` | the same | keep |
| `weather.tags[id] { name, budget?, warn?, note? }` | the same; `effect` is read as `note`'s old name on main | delete the draft's reader (§2.2) |
| `Mode.wild` (the engine's grouping of travel, sleep, cooking) | an engine shape, not a pack field | keep; document as internal |

No ⚑ on names: every field the draft reads is named in 07 except the two it doesn't read yet.

## 4. Drop (removed or superseded since 2026-10-30)

1. **`scripts/pack-format.mjs` changes** (the draft's `alsoWhen` check): main's `scripts/pack-exploration.mjs` now checks `alsoWhen`, `routes`, `forced`, `costPer`, `mounted` / `vehicle` and `camp.sleep` in full (M5 steps after 2026-10-30). Take main's side on rebase.
2. **The `typecheck-hook` scripts** the branch still carries (`scripts/typecheck-hook.mjs`, its test): deleted on main; take main's side.
3. **Act… in turn modes.** `activities.ts` serves turn modes too ("in any mode"); that is harmless and stays valid pack data, but nothing offers them (DG12, parking lot). No code change; the plan notes it so nobody builds a turn-mode button from it.
4. **Something else… / Describe…** (A5): the draft never had them; nothing to drop. Likewise "Rest today" as a separate button (B5 replaced it): the draft's `rest` return is the only touchpoint (§2.4).

## 5. Missing (the plans need it; the engine doesn't do it)

| What | Step |
|---|---|
| **Per-group state.** `TravelDay`, `Pending`, camp and Lost belong to a group (09 2026-10-31; 04 "Per group from M5b"). The pure functions are group-agnostic, which is right; the state table, the commands and row-level security (the GM reads all; a player their group's) are m5b-1 bo 1 (Fable) | m5b-1 bo 1 |
| **Lost** as a status with the pack's recovery reminder, the morning Lost card (Found the way / Still lost), Getting lost Secret / Open readable by the database | m5b-1 bo 6 |
| **Commands as intents** (`travel.move`, `travel.setBudget`, `travel.forceMarch`, `travel.spendDay`, `travel.lost.*`), `logged_commands` rows, `permissionCases.ts`; Undo on Move… restores budget and place | m5b-1 bo 1–2 |
| **`costPer` on the budget card** ("1 point = 4 miles"): information from 07 the breakdown should show | m5b-1 bo 3 (small) |
| **Encounter waiting queue** (`encounter.queue` / `start` / `dismiss`; `watch` for night hits). `eventChecks.triggeredPrompts` produces the prompts; nothing queues a hit | m5b-2 bo 1 |
| **Activity engine beyond usability and yields:** `requires` (skill, item) per character, `chance` (`skill` / `abilityCheck` with `modify` hooks and sources), `who` one / several / party, `maxActors`, `bestOf`, `modifiers` (`fullDay`), `secret` as a Request, cost applied off the group's budget (`CostNow.budget` exists; nothing spends it) | m5b-3 bo 1, 3 |
| **Camp state and procedure:** the step list from the pack's `camp.procedure` (`sameAs`, skipped steps), per-step state, `camp.*` commands, players writing their own rows, Quick camping | m5b-4 bo 1 |
| **Campfire as a light** (`camp.fire.lightTypeId`, firewood bundles, gathered hours; lit read by the night check and by `sleep`'s `facts.fire`) — `wildPack.ts` doesn't read `camp.fire` | m5b-4 bo 2 |
| **Give food** (an inventory move, logged): `eatingStatus` names the givers, nothing moves the food | m5b-4 bo 3 |
| **Campfire talk** as a camp activity whose effect lands in `facts.flags` for `sleep.ts` | m5b-4 bo 4 |
| **Watches:** order, 1–3 per watch, the night's length from daylight, caster warning, Which watch? on a hit | m5b-4 bo 5 |
| **`onGoodRest` / `onBadRest` offers** after the sleep outcome (never automatic); the sleep check itself (ability, the `add`) as a prompt with Enter roll | m5b-4 bo 6 |
| **Next day applies camp** as one undoable event with the morning summary (`endDay`, `startDay`, fire out, arrival, Lost card, statuses, who didn't eat) | m5b-4 bo 7 |
| **Option-gated camp rules** (smoking, inebriation levels, asleep on watch) | m5b-4 bo 8 |

## 6. ⚑ for Francis — all ruled 2026-11-01 (1 confirm · 2 A · 3 A · 4 A; 09 lines of that date)

1. **`camp.cooking` is still provisional in 07** (D15; m5b-4's own ⚑ 2). The draft follows it as written. Confirm the shape `{ ingredients?, portions: <int> | "<dice>", bonus?: [effects], note? }` so 07 drops "provisional" and the private packs write it — or name what changes.
2. **Forced march and rest (§2.4):** after a forced march, does "Rest due" fall on the group **that evening** (the flow runs at camp) or **the next morning**? The 2026-10-30 ruling says "sets the pack's rest reminder by itself"; B5 moved rest to a shared due step. Recommendation for the builder's sake: that evening, merged into camp's sleep step.
3. **The shortfall and a split party:** when two groups travel, each has its own budget (ruled); may a Force march by one group's player pay the *other* group's shortfall? The engine says no (per group). Confirm "no" so the plan can say it.
4. **Weather tags `effect`:** main still reads the old `effect` as `note`'s alias. Keep the alias for the private packs' next candidates, or drop it once both packs are refreshed? (Technical if you say "keep".)

## Estimate

- **Rebase and §2–§4 fixes:** 6–10 turns, **Opus** (pure functions and tests; no screen, no migration). Order: rebase on main taking main's side for `scripts/`, then §2.2 (weather tags), §2.1 (sleep `result`), §2.3–2.4 (Pending place id, `restDue`), §2.5 (G-40 alias) and §2.6 (`speedOf`), each with its test sentence first.
- **Then merge #169** as the first commit of m5b-1 (its bo 1 on Fable follows: the per-group table, security and commands).
- §5 is not extra work: it is m5b-1 … m5b-4 as already estimated (35–45, 15–25, 30–40, 45–60 turns). The draft saves roughly 10–15 of m5b-1's and 10 of m5b-4's.

## Scope checks for the builder (write one and stop)
- No screen or command in the reconcile step: the fixes stay pure and tested; UI and migrations are m5b-1's.
- Don't widen `wildPack.ts` with fields 07 hasn't named (settlement services, hex grids wait for G-05 and the downtime session).
- `camp.cooking` is final (⚑ 1): build it as written.

## Departures
(The builder keeps this current in the same pull request.)

Builder, 2026-11-01 (PR #169):

- **Merged main instead of rebasing** (a force-push isn't allowed); same result. The merge had no conflicts. After it, the branch's `scripts/` match main exactly (main's pack checker; §4.1 done). §4.2: `scripts/typecheck-hook.mjs` and its test are **on main** (main's PostToolUse hook uses them), so there was nothing to delete; the plan's "deleted on main" was out of date.
- **§2.2 weather tags:** `readWeatherTags`, wildPack's `WeatherTag` and `ExplorationRules.weatherTags` are gone. travel.ts reads `weather.tags` from modes.ts `readWeather` through a new `weatherTagsFor(mode, rules)`: the mode's own weather, else the rules set's for day-by-day modes, as the weather card does (procedure.ts). Small deviation: `dayBudget` now takes the tags (`weatherTagsFor(...)`) in place of the rules, so a mode's own weather counts too. A tag with no `budget` now reads as `null` (main's shape), skipped as before.
- **§2.1 sleep `result`:** `SleepDifficulty.result: 'good' | 'check' | 'bad'` (an unreadable or missing result reads as `check`, so a pack can't skip the roll by mistake; the old `roll` isn't read, the checker already flags it). `SleepFor.outcome` replaces `needsRoll` (`null` still means the GM decides). Only `check` gets the ability and modifiers.
- **§2.3 place id:** `Pending.placeId`, `Move.placeId?` and `MovePreview.placeId` (null for a new place); `applyMove` carries it into what's owed.
- **§2.4 rest due:** `ForcedMarch.restDue: true` replaces `rest` (rest due that evening, merged into camp's sleep step; the command and g6's rest record are m5b-1 bo 5). Pure function only.
- **§2.5 `option`:** new `optionSpecOf(data)` in modes.ts reads `option: "<id>[=<choice>]"` with `onlyWithOption: "<id>[:<choice>]"` as its alias (`option` wins). Used by `readCheck`, `readActivity`, `readWeather` and also `dungeonExit.ts` (the fourth read site; same idea, one line). modes.ts has no step or table read sites for it (the plan named `readStep`, `readTable`; they don't read it). **Not done here:** the pack checker (`scripts/pack-exploration.mjs`) still asks for `onlyWithOption` and calls `option` on tables "the old way"; 07 says the checker stops asking. That's the checker half of G-40 (builder step 11), outside this step's files.
- **§2.6 speed:** `speedOf(load)` in `src/modules/inventory/encumbrance.ts`: the first whole number in the load's movement text (the tier's in coin and slot modes, the armour row's in armour mode); null with no tracking, no movement, no number or over the max. Deviation from `speedOf(tier, rules)`: it takes the carried load, which already holds the tier and the armour movement, so armour mode works too and no rules are needed. travel.ts unchanged (one comment now names `speedOf`); m5b-1 bo 1 names it.
- **§3 names** kept as they are; `camp.cooking`'s comments no longer say provisional.
- **⚑ 1 answered:** `camp.cooking` is final (Francis, 2026-11-01).
- **⚑ 2 answered:** rest due that evening (Francis, 2026-11-01): `restDue`.
- **⚑ 3 answered:** no, one group's forced march never pays another group's shortfall (Francis, 2026-11-01); a test pins it (forceMarch on one group's day leaves another's Pending untouched).
- **⚑ 4 answered:** keep `effect` as `note`'s old alias in weather tags (Francis, 2026-11-01); a travel test reads it through the one reader.
- Scope checks: none needed.
