// The expedition engine against the private setting packs, when this machine has them (they're never committed,
// hard rule 2; on GitHub this file is skipped). This file holds no game content: it only checks that every real
// shape reads without failing and gives sensible whole numbers. Each pack's newest build candidate is used, else
// its own pack file.
import { describe, expect, it } from 'vitest';
import { readPackJson, type PackEntry } from '../library/packFile.ts';
import { DEFAULT_TIME } from '../../core/campaignSettings.ts';
import { dateAfter, daysPerWeekOf, monthsOf, readClock, timeExtraOf, timeUnits, turnsPerHourOf, type ClockTime } from './clock.ts';
import { daylightAt, daylightOf, daylightOn } from './daylight.ts';
import { readLightType } from './light.ts';
import { showTimer, timerFromCondition } from './statusTimer.ts';
import { campOf, readExploration } from './modes.ts';
import { nextStep, nextSteps, weatherFor, type Expedition } from './procedure.ts';
import { readDungeonExit } from './dungeonExit.ts';
import { baseArmourChoices, workOutAc } from '../characters/play.ts';
import { newestPerPack } from '../../testing/realPacks.ts';

const candidates = import.meta.glob<string>('../../../packs/*/build/*candidate-*.pack.json', { query: '?raw', import: 'default', eager: true });

/** Setting packs (with rules sets) to check, named setting pack 1, 2… in the stable order of their meta.id, never by folder or file. */
const settingPacks: { label: string; entries: PackEntry[] }[] = newestPerPack(candidates)
  .map(({ raw }) => readPackJson(raw))
  .flatMap((read) => (read.ok && read.pack.entries.some((e) => e.kind === 'rulesSet') ? [read.pack.entries] : []))
  .map((entries, i) => ({ label: `setting pack ${i + 1}`, entries }));

const rulesOf = (entries: PackEntry[]) => entries.filter((e) => e.kind === 'rulesSet').map((e) => e.data);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The campaign's time lengths as a rules set presets them, with its turns per hour and calendar week. */
function clockTimeOf(entries: PackEntry[]): ClockTime {
  const rules = rulesOf(entries);
  const time = rules.map((r) => r.time).find(isRecord) ?? {};
  const pick = (key: keyof typeof DEFAULT_TIME) => (typeof time[key] === 'number' && Number.isInteger(time[key]) && (time[key] as number) > 0 ? (time[key] as number) : DEFAULT_TIME[key]);
  const calendar = entries.find((e) => e.kind === 'calendar')?.data;
  return { roundSeconds: pick('roundSeconds'), turnMinutes: pick('turnMinutes'), dayHours: pick('dayHours'), turnsPerHour: turnsPerHourOf(rules), daysPerWeek: daysPerWeekOf(calendar) };
}

describe.skipIf(settingPacks.length === 0)('the clock with the private setting packs', () => {
  for (const { label, entries } of settingPacks) {
    const rules = rulesOf(entries);
    const units = timeUnits(clockTimeOf(entries), timeExtraOf(rules));

    it(`${label}: the time lengths make whole-second units, and the hour track has as many pips as turns per hour`, () => {
      for (const unit of ['round', 'turn', 'hour', 'day', 'week']) expect(Number.isInteger(units[unit]) && units[unit]! > 0).toBe(true);
      const perHour = turnsPerHourOf(rules);
      if (perHour) expect(readClock(0, units).turnsPerHour).toBe(perHour);
    });

    it(`${label}: every light type reads (or is plainly permanent), with whole seconds`, () => {
      const lights = entries.filter((e) => e.kind === 'lightType');
      for (const light of lights) {
        const read = readLightType(light.data, units, 1, units.turn);
        expect(read, light.packEntryId).not.toBeNull();
        if (read?.seconds !== null && read) expect(Number.isInteger(read.seconds)).toBe(true);
      }
    });

    it(`${label}: a calendar, when there is one, walks a whole year day by day with the season following the month, and daylight for each day`, () => {
      const calendar = entries.find((e) => e.kind === 'calendar');
      if (!calendar) return;
      const months = monthsOf(calendar.data);
      expect(months.length).toBeGreaterThan(0);
      const yearDays = months.reduce((sum, m) => sum + m.days + m.extraDays.length, 0);
      const daylight = daylightOf(rules);
      for (let d = 0; d <= yearDays; d++) {
        const date = dateAfter(months, { month: 0, day: 1 }, d)!;
        expect(date.season).toBe(months[date.monthIndex]!.season);
        if (daylight && daylight.byMonth.size > 0) expect(daylightOn(daylight, { date }), `${date.month}`).not.toBeNull();
      }
      expect(dateAfter(months, { month: 0, day: 1 }, yearDays)).toMatchObject({ day: 1, monthIndex: 0, yearsOn: 1 });
      const day = daylight ? daylightOn(daylight, { date: dateAfter(months, { month: 0, day: 1 }, 0) }) : null;
      if (day) expect(daylightAt(day, day.sunset + 5, 10)?.hint).toBe('sunset');
    });

    it(`${label}: every condition with a default length starts a timer in rounds, kept in seconds`, () => {
      for (const condition of entries.filter((e) => e.kind === 'condition')) {
        const timer = timerFromCondition(condition.data, units);
        if (timer) expect(showTimer(timer, units, 'gm').left?.unit).toBe('round');
      }
    });
  }
});

describe.skipIf(settingPacks.length === 0)('the procedure with the private setting packs', () => {
  for (const { label, entries } of settingPacks) {
    const rules = rulesOf(entries);
    const units = timeUnits(clockTimeOf(entries), timeExtraOf(rules));
    const exploration = readExploration(rules);
    const raw = rules.map((r) => r.exploration).find((e) => isRecord(e) && Array.isArray(e.modes)) as { modes: Record<string, unknown>[] } | undefined;

    it(`${label}: every mode, step, check, activity and terrain is read (nothing dropped), with symbols from the closed list`, () => {
      if (!raw) return expect(exploration.fallback).toBe(true);
      expect(exploration.modes).toHaveLength(raw.modes.length);
      exploration.modes.forEach((mode, i) => {
        const r = raw.modes[i]!;
        const count = (key: string) => (Array.isArray(r[key]) ? (r[key] as unknown[]).length : 0);
        expect(mode.procedure, mode.id).toHaveLength(count('procedure'));
        expect(mode.checks, mode.id).toHaveLength(count('checks'));
        expect(mode.activities, mode.id).toHaveLength(count('activities'));
        expect(mode.terrain, mode.id).toHaveLength(count('terrain'));
        expect([...mode.procedure, ...(campOf(mode, exploration.modes)?.procedure ?? [])].filter((s) => s.icon === 'dot').map((s) => s.id), mode.id).toEqual([]);
        for (const step of mode.procedure) if (step.kind === 'check') expect(mode.checks.some((c) => c.id === step.checkId), `${mode.id}/${step.id}`).toBe(true);
        if (r.camp) expect(campOf(mode, exploration.modes)!.procedure.length, mode.id).toBeGreaterThan(0);
      });
    });

    it(`${label}: ten main advances in every mode run without failing, with whole-second times`, () => {
      for (const mode of exploration.modes) {
        const expedition: Expedition = { rules: exploration, mode, units, startedAt: 0, now: 0, situation: { season: exploration.seasons[0]?.id ?? null } };
        const ten = nextSteps(expedition, 10)!;
        expect(ten.steps, mode.id).toBe(10);
        expect(Number.isInteger(ten.to)).toBe(true);
        expect(nextStep(expedition)!.prompts.every((p) => p.count >= 1)).toBe(true);
      }
    });

    it(`${label}: on every terrain, each by-terrain check gets its chance from the terrain, and a hit names its table or note`, () => {
      for (const mode of exploration.modes) {
        for (const terrain of mode.terrain) {
          const day = nextStep({ rules: exploration, mode, units, startedAt: 0, now: 0, situation: { terrainId: terrain.id } })!;
          const checks = [...day.prompts.flatMap((p) => (p.kind === 'check' ? [p] : [])), ...day.prompts.flatMap((p) => (p.kind === 'camp' ? p.checks : []))];
          for (const check of checks) {
            if (mode.checks.find((c) => c.id === check.checkId)?.byTerrain) expect(check.chance, `${mode.id}/${terrain.id}/${check.checkId}`).not.toBeNull();
            expect(check.hit.tables.length > 0 || check.hit.regionTables || check.hit.note !== null || check.hit.noteOnly, check.checkId).toBe(true);
          }
        }
      }
    });

    it(`${label}: with the weather rule on, each season gives day-by-day modes a weather table`, () => {
      if (!exploration.weather) return;
      const choices = exploration.weather.onlyWithOption ? { [exploration.weather.onlyWithOption.split(':')[0]!]: exploration.weather.onlyWithOption.split(':')[1] ?? 'on' } : {};
      for (const mode of exploration.modes.filter((m) => m.pace === 'day')) {
        for (const season of exploration.seasons) {
          const situation = { season: season.id, choices };
          expect(weatherFor({ rules: exploration, mode, situation }), mode.id).not.toBeNull();
          const weather = nextStep({ rules: exploration, mode, units, startedAt: 0, now: 0, situation })!.prompts.find((p) => p.kind === 'weather');
          expect(weather && weather.kind === 'weather' && weather.tableId, `${mode.id}/${season.id}`).toBeTruthy();
        }
      }
    });

    it(`${label}: every byTerrain check names its terrainChance, so no advance falls back to guessing from a symbol`, () => {
      for (const mode of exploration.modes) {
        for (const check of mode.checks.filter((c) => c.byTerrain)) expect(check.terrainChance, `${mode.id}/${check.id}`).not.toBeNull();
        for (const terrain of mode.terrain.length ? mode.terrain : [null]) {
          const day = nextStep({ rules: exploration, mode, units, startedAt: 0, now: 0, situation: { terrainId: terrain?.id ?? null } })!;
          expect(day.warnings, `${mode.id}/${terrain?.id ?? '-'}`).toEqual([]);
        }
      }
    });

    it(`${label}: terrain chances come with a die and read as words ("1–2 on d6")`, () => {
      for (const mode of exploration.modes) {
        for (const terrain of mode.terrain) {
          const day = nextStep({ rules: exploration, mode, units, startedAt: 0, now: 0, situation: { terrainId: terrain.id } })!;
          const checks = [...day.prompts.flatMap((p) => (p.kind === 'check' ? [p] : [])), ...day.prompts.flatMap((p) => (p.kind === 'camp' ? p.checks : []))];
          for (const check of checks.filter((c) => c.terrainChance && c.chance)) expect(check.chanceText, `${mode.id}/${terrain.id}/${check.checkId}`).toMatch(/ on d\d+$/);
        }
      }
    });

    it(`${label}: no check is prompted twice in one advance (later references are "Check again")`, () => {
      for (const mode of exploration.modes) {
        const day = nextStep({ rules: exploration, mode, units, startedAt: 0, now: 0, situation: { terrainId: mode.terrain[0]?.id ?? null } })!;
        const asked = [...day.prompts.flatMap((p) => (p.kind === 'check' ? [p] : [])), ...day.prompts.flatMap((p) => (p.kind === 'camp' ? p.checks : []))].filter((c) => !c.again);
        const ids = asked.map((c) => c.checkId);
        expect(new Set(ids).size, mode.id).toBe(ids.length);
      }
    });

    it(`${label}: a dungeon-exit rule, when there is one, reads with its roll`, () => {
      const exit = readDungeonExit(rules);
      if (rules.some((r) => isRecord(r.dungeonExit))) expect(exit).not.toBeNull();
    });
  }
});

describe.skipIf(settingPacks.length === 0)('magic armour with the private setting packs', () => {
  for (const { label, entries } of settingPacks) {
    const rules = rulesOf(entries);
    const items = entries.filter((e) => e.kind === 'item');

    it(`${label}: magic armour with a base to choose asks for it, then gives a whole-number AC for every choice`, () => {
      for (const item of items) {
        const choices = baseArmourChoices(item.data.armour);
        if (!choices) continue;
        const worn = { name: item.name, slot: item.data.slot, armour: item.data.armour };
        const none = workOutAc({ rulesSets: rules, chosenStyle: null, worn: [worn], filled: {}, abilityName: (k) => k, seesHidden: true });
        expect(none.chooseBase, item.packEntryId).toBeDefined();
        for (const id of choices) {
          const base = items.find((e) => e.packEntryId === id);
          expect(base, `${item.packEntryId} → ${id}`).toBeDefined();
          const ac = workOutAc({ rulesSets: rules, chosenStyle: null, worn: [{ ...worn, chosenBase: { id, name: base!.name, armour: base!.data.armour } }], filled: {}, abilityName: (k) => k, seesHidden: true });
          expect(Number.isInteger(ac.value), `${item.packEntryId} → ${id}`).toBe(true);
        }
      }
    });
  }
});
