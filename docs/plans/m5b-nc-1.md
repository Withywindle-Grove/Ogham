# Plan: nc-1 and nc-3, Encounter check respects the hour (M5b, before the tag's fixes)

Written by the Builder, 2026-11-11, on the lead's yes, from rulings nc-1, nc-2 and nc-3 in `design/rulings/m5b-morning-rulings-2026-11-11.md` (on `origin/docs-rulings-2026-11-11`, Francis "A" / "a"). Finding: F76 in `design/notes/gate-m5b-rewalk-2026-11-10.md`. TypeScript only, no migration. Built on #619's branch (the same files), so it merges after #619.

## What changes
| When | Encounter check (⋯, or the hour track) puts on the card |
|---|---|
| Night | the night's checks (`onlyAt: "night"`) and those with no time limit |
| Day | the day's checks (`onlyAt: "day"`) and those with no time limit |

**Night** (nc-3): from the setting's sunset to its sunrise where the pack gives daylight for the date (`daylight`, 07); else 22:00 to 06:00 by the clock. The night stop (a camp made, or the move held for the night check) always counts as night. No Day / Night switch.

**nc-3a** (the lead's reading of nc-3, 2026-11-11): in a mode whose step is a day or longer, the clock's hour doesn't decide (each Next day lands on the same hour, often 00:00 when no start time was set): it is day until the night stop, which is night. Turn and hour modes use sunset and sunrise, else 22:00 to 06:00.

## Steps
1. `isNight` (pure, `src/modules/expedition/daylight.ts`): the rule above.
2. `checkNow` (`procedure.ts`) filters by `onlyAt` against `situation.night` when it is given (when it isn't, every check, as before).
3. The time strip's Encounter check (`SceneTime.tsx`, `checkNowNow`) works out night and passes it.
4. The scheduled procedure is unchanged except nc-3's own words: the camp's night-step checks count as night, so a night-only check still raises at the night stop and a day-only one doesn't. Nothing else in the schedule reads night (#619's status: feeding night to the whole schedule changes which checks Next day runs).
5. Docs: 05 (Check now). The 09 lines are in the lead's docs pull request.

## Tests (purpose first)
- Night runs from sunset to sunrise; with no daylight, 22:00 to 06:00; the night stop is always night.
- Encounter check at night: the night's and untimed checks, not the day's; by day the reverse; night unknown: all, as before.
- The scheduled procedure: a day's advance raises the day-only check and not the night-only one; the camp's night step raises the night-only one.
- On the screen: at the night stop Encounter check offers the night-only check; by day the day-only one.

## Boundaries
- No migration, no change to what a check costs, logs or rolls.
- A pack whose checks carry no `onlyAt` sees no change. The walk setting's two wandering checks carry none (they split day and night by table column); tagging them is the Pack Creator's, through Design, once this is live.

## ⚑
None open. nc-2 is held (see Departures).

## Estimate
Small: about 30 lines of TypeScript, two test files; one round.

## Departures
- **nc-2 held** (lead, 2026-11-11): the Scene never knows the place the party is at (`placeTableId` and `locationCheck` are never set outside tests; a place's `atNight` is read from M8b, 07). Wiring the current place into the time strip's checks is a new feature, put to Francis as a scope check (recommendation: Later, M8b). Until then a place's night table is opened from Tables by hand.
