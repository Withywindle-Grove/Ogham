// Encounter checks and the hour (nc-1 and nc-3, ruled 2026-11-11; plan docs/plans/m5b-nc-1.md). Invented rules.
// Purposes:
//   1. Night runs from the setting's sunset to its sunrise; with no daylight, 22:00 to 06:00 by the clock; the night
//      stop always counts as night; in a mode that moves a day at a time, it's day until the night stop (nc-3a).
//   2. Encounter check at night puts in play the night's checks and those with no time limit, not the day's; by day the
//      day's and those with none, not the night's; when night isn't known, every check, as before.
//   3. In the scheduled procedure, the camp's night step raises a night-only check (the night stop is night), and a
//      day's advance still raises a day-only check and not the night-only one.
import { describe, expect, it } from 'vitest';
import { timeUnits } from './clock.ts';
import { isNight } from './daylight.ts';
import { modeById, readExploration } from './modes.ts';
import { checkNow, nextStep, type Expedition } from './procedure.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 });
const DAY = 24 * 3600;

/** A day mode with a day-only stalk, a night-only prowl and an untimed bog-wisp check; its camp's night step runs prowl. */
const rules = readExploration([
  {
    id: 'fen-hours',
    exploration: {
      modes: [
        {
          id: 'wade',
          name: 'Wading',
          step: { value: 1, unit: 'day' },
          procedure: [
            { id: 'stalk', name: 'Stalkers', icon: 'monster', kind: 'check', checkId: 'stalk' },
            { id: 'wisp', name: 'Bog wisps', icon: 'monster', kind: 'check', checkId: 'wisp' },
            { id: 'camp', name: 'Camp', icon: 'camp', kind: 'camp' },
          ],
          checks: [
            { id: 'stalk', name: 'Stalkers', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1] }, onlyAt: 'day', onHit: { tableId: 'fen-day' } },
            { id: 'prowl', name: 'Prowlers', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1] }, onlyAt: 'night', onHit: { tableId: 'fen-night' } },
            { id: 'wisp', name: 'Bog wisps', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1] }, onHit: { tableId: 'fen-wisps' } },
          ],
          camp: {
            procedure: [
              { id: 'pitch', name: 'Pitch camp', icon: 'camp', kind: 'note' },
              { id: 'night', name: 'Prowlers', icon: 'monster', kind: 'check', checkId: 'prowl' },
            ],
          },
        },
      ],
    },
  },
]);
const wade = modeById(rules.modes, 'wade')!;
const under = (night?: boolean): Expedition => ({ rules, mode: wade, units, startedAt: 0, now: 0, situation: night === undefined ? {} : { night } });
const ids = (found: ReturnType<typeof checkNow>) => found.prompts.flatMap((p) => (p.kind === 'check' ? [p.checkId] : []));

describe('what counts as night (nc-3)', () => {
  it("runs from the setting's sunset to its sunrise", () => {
    const sun = { sunrise: 7 * 60, sunset: 19 * 60 };
    expect([isNight(sun, 6 * 60 + 59), isNight(sun, 7 * 60), isNight(sun, 18 * 60 + 59), isNight(sun, 19 * 60)]).toEqual([true, false, false, true]);
  });

  it('with no daylight in the setting, runs from 22:00 to 06:00 by the clock', () => {
    expect([isNight(null, 21 * 60 + 59), isNight(null, 22 * 60), isNight(null, 5 * 60 + 59), isNight(null, 6 * 60)]).toEqual([false, true, true, false]);
  });

  it('in a mode that moves a day at a time, the hour does not decide: day until the night stop (nc-3a)', () => {
    expect(isNight(null, 0, false, true)).toBe(false);
    expect(isNight({ sunrise: 7 * 60, sunset: 19 * 60 }, 0, false, true)).toBe(false);
    expect(isNight(null, 0, true, true)).toBe(true);
  });

  it('the night stop always counts as night, whatever the clock says', () => {
    expect(isNight({ sunrise: 6 * 60, sunset: 20 * 60 }, 12 * 60, true)).toBe(true);
    expect(isNight(null, 12 * 60, true)).toBe(true);
  });
});

describe('Encounter check respects the hour (nc-1)', () => {
  it("at night: the night's checks and those with no time limit, not the day's", () => {
    const found = ids(checkNow(under(true)));
    expect(found).toContain('prowl');
    expect(found).toContain('wisp');
    expect(found).not.toContain('stalk');
  });

  it("by day: the day's checks and those with no time limit, not the night's", () => {
    const found = ids(checkNow(under(false)));
    expect(found).toContain('stalk');
    expect(found).toContain('wisp');
    expect(found).not.toContain('prowl');
  });

  it('when night is not known, every check, as before', () => {
    expect(ids(checkNow(under())).sort()).toEqual(['prowl', 'stalk', 'wisp']);
  });
});

describe('the scheduled procedure and the night stop (nc-3)', () => {
  it("a day's advance raises the day-only check and not the night-only one; the camp's night step raises the night-only one", () => {
    const step = nextStep({ ...under(), now: DAY })!;
    const raised = step.prompts.flatMap((p) => (p.kind === 'check' ? [p.checkId] : []));
    expect(raised).toContain('stalk');
    expect(raised).not.toContain('prowl');
    const camp = step.prompts.find((p) => p.kind === 'camp');
    expect(camp?.kind === 'camp' && camp.checks.map((c) => c.checkId)).toEqual(['prowl']);
  });
});
