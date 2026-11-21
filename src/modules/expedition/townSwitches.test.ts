// The town switches and onlyWhen (M5b step 6.0; ruled 2026-11-03, sw-1 … sw-4). Invented names only.
import { describe, expect, it } from 'vitest';
import { timeUnits } from './clock.ts';
import { triggeredChecks } from './eventChecks.ts';
import { modeById, readCheck, readExploration } from './modes.ts';
import { checkNow, hourTrackNow, nextStep, type Expedition } from './procedure.ts';
import { afterFlip, endedWords, flipToastWords, onlyWhenOf, reachesMorning, runsNow, switchesLine, SWITCHES_OFF, type TownSwitches } from './townSwitches.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 });
const DAY = 86400;

// An invented market town, a day at a time: a check for the day out, one for the night, and one that always runs.
const lanternQuay = readExploration([
  {
    id: 'quay-rules',
    name: 'Lantern Quay rules',
    exploration: {
      modes: [
        {
          id: 'quay',
          name: 'In the quay',
          step: { value: 1, unit: 'day' },
          procedure: [
            { id: 'market', name: 'Market day', icon: 'encounter', kind: 'check', checkId: 'quay-day' },
            { id: 'lamps', name: 'After the lamps', icon: 'encounter', kind: 'check', checkId: 'quay-night' },
            { id: 'gulls', name: 'Gulls', icon: 'note', kind: 'check', checkId: 'quay-gulls' },
          ],
          checks: [
            { id: 'quay-day', name: 'Market trouble', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1, 2] }, onlyWhen: 'outDay' },
            { id: 'quay-night', name: 'Lamplit trouble', every: { value: 1, unit: 'day' }, when: 'end', chance: { die: 'd6', on: [1] }, onlyWhen: 'activeNight' },
            { id: 'quay-gulls', name: 'Gull thieves', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1] } },
          ],
        },
        {
          id: 'cellars',
          name: 'Under the quay',
          step: { value: 1, unit: 'turn' },
          procedure: [{ id: 'drip', name: 'Dripping', icon: 'encounter', kind: 'check', checkId: 'cellar-night' }],
          checks: [{ id: 'cellar-night', name: 'Cellar rats', every: { value: 1, unit: 'turn' }, chance: { die: 'd6', on: [1] }, onlyWhen: 'activeNight', alsoWhen: [{ enterTerrain: 'mud' }] }],
        },
      ],
    },
  },
]);
const quay = modeById(lanternQuay.modes, 'quay')!;
const cellars = modeById(lanternQuay.modes, 'cellars')!;

const day = (switches?: TownSwitches): Expedition => ({ rules: lanternQuay, mode: quay, units, startedAt: 0, now: 0, situation: { switches } });
const checksOf = (e: Expedition) => (nextStep(e)?.prompts ?? []).flatMap((p) => (p.kind === 'check' ? [p.checkId] : []));

describe('onlyWhen (sw-1 … sw-4)', () => {
  it('reads "outDay" and "activeNight"; anything else is read as no onlyWhen (pack:check warns about it)', () => {
    expect(quay.checks.map((c) => c.onlyWhen)).toEqual(['outDay', 'activeNight', null]);
    expect(onlyWhenOf('rainy')).toBeNull();
    expect(readCheck({ id: 'x', onlyWhen: 'rainy' })?.onlyWhen).toBeNull();
  });

  it('a check with onlyWhen "outDay" prompts while Out and about today is on, and stays quiet while it is off', () => {
    expect(checksOf(day({ outDay: true, activeNight: false }))).toContain('quay-day');
    expect(checksOf(day({ outDay: false, activeNight: false }))).not.toContain('quay-day');
    // Missing switches count as off.
    expect(checksOf(day())).not.toContain('quay-day');
  });

  it('a check with onlyWhen "activeNight" prompts while Active tonight is on, and stays quiet while it is off', () => {
    expect(checksOf(day({ outDay: false, activeNight: true }))).toContain('quay-night');
    expect(checksOf(day({ outDay: true, activeNight: false }))).not.toContain('quay-night');
  });

  it('a check without onlyWhen prompts either way', () => {
    expect(checksOf(day(SWITCHES_OFF))).toEqual(['quay-gulls']);
    expect(checksOf(day({ outDay: true, activeNight: true }))).toEqual(['quay-day', 'quay-night', 'quay-gulls']);
  });

  it('off, the check has no due mark on the hour track either, and the Encounter check leaves it out', () => {
    const under = (switches: TownSwitches): Expedition => ({ rules: lanternQuay, mode: cellars, units, startedAt: 0, now: 0, situation: { switches } });
    const marks = (switches: TownSwitches) => (hourTrackNow(under(switches), 'gm') ?? []).flatMap((p) => p.events.filter((e) => e.label === 'Cellar rats'));
    expect(marks(SWITCHES_OFF)).toHaveLength(0);
    expect(marks({ outDay: false, activeNight: true }).length).toBeGreaterThan(0);
    expect(checkNow(under(SWITCHES_OFF)).prompts).toHaveLength(0);
    expect(checkNow(under({ outDay: false, activeNight: true })).prompts.map((p) => (p.kind === 'check' ? p.checkId : ''))).toEqual(['cellar-night']);
  });

  it('a move that would set off a check with onlyWhen does so only while its switch is on', () => {
    const from = { routeId: null, terrainId: 'stone' };
    const to = { routeId: null, terrainId: 'mud' };
    expect(triggeredChecks(cellars, from, to, SWITCHES_OFF)).toHaveLength(0);
    expect(triggeredChecks(cellars, from, to, { outDay: false, activeNight: true }).map((t) => t.check.id)).toEqual(['cellar-night']);
  });

  // Purpose (sm-1, the sun and moon tile): with one half lit, only that half's check comes due; the other half's stays quiet.
  it('each check runs only for its lit half: the sun runs the day check, the moon the night check, never the other', () => {
    expect(checksOf(day({ outDay: true, activeNight: false }))).toEqual(['quay-day', 'quay-gulls']);
    expect(checksOf(day({ outDay: false, activeNight: true }))).toEqual(['quay-night', 'quay-gulls']);
    expect(runsNow('outDay', { outDay: true, activeNight: false })).toBe(true);
    expect(runsNow('activeNight', { outDay: true, activeNight: false })).toBe(false);
    expect(runsNow('activeNight', { outDay: false, activeNight: true })).toBe(true);
    expect(runsNow('outDay', { outDay: false, activeNight: true })).toBe(false);
  });

  // Purpose (sm-1): the screen's copy after a flip matches the database: on puts the other out; off leaves the other alone.
  it('afterFlip: turning one on with the other lit puts the other out; turning one off leaves the other alone', () => {
    expect(afterFlip({ outDay: false, activeNight: true }, 'outDay', true)).toEqual({ outDay: true, activeNight: false });
    expect(afterFlip({ outDay: true, activeNight: false }, 'activeNight', true)).toEqual({ outDay: false, activeNight: true });
    expect(afterFlip({ outDay: true, activeNight: true }, 'outDay', false)).toEqual({ outDay: false, activeNight: true });
    expect(afterFlip(null, 'activeNight', true)).toEqual({ outDay: false, activeNight: true });
  });

  // Purpose (sm-1, the lead's words): the toast names the half it put out, tapped one first; otherwise it stays as before.
  it('flipToastWords: names both when a turn-on put the other out; one name when the other was already off, or on a turn-off', () => {
    expect(flipToastWords({ outDay: false, activeNight: true }, 'outDay', true)).toBe('Out and about today: On. Active tonight: Off.');
    expect(flipToastWords({ outDay: true, activeNight: false }, 'activeNight', true)).toBe('Active tonight: On. Out and about today: Off.');
    expect(flipToastWords(SWITCHES_OFF, 'outDay', true)).toBe('Out and about today: On');
    expect(flipToastWords(null, 'activeNight', true)).toBe('Active tonight: On');
    expect(flipToastWords({ outDay: true, activeNight: true }, 'outDay', false)).toBe('Out and about today: Off');
  });

  it('runsNow: no onlyWhen always runs', () => {
    expect(runsNow(null, SWITCHES_OFF)).toBe(true);
    expect(runsNow(undefined, null)).toBe(true);
  });
});

describe('the reset and the words (sw-2 … sw-4)', () => {
  it('reaches the morning when a move crosses into the next day (no parts of the day yet), and not within a day', () => {
    expect(reachesMorning(DAY - 600, DAY, DAY)).toBe(true);
    expect(reachesMorning(6 * 3600, DAY + 6 * 3600, DAY)).toBe(true);
    expect(reachesMorning(6 * 3600, 20 * 3600, DAY)).toBe(false);
    expect(reachesMorning(DAY, DAY, DAY)).toBe(false);
    expect(reachesMorning(0, DAY, null)).toBe(false);
  });

  it('says which switches ended, and the quiet line says which are on (nothing about the checks)', () => {
    expect(endedWords({ outDay: true })).toBe('Out and about ended');
    expect(endedWords({ outDay: true, activeNight: true })).toBe('Out and about and Active tonight ended');
    expect(endedWords({})).toBeNull();
    expect(switchesLine({ outDay: true, activeNight: false })).toBe('Out and about today');
    expect(switchesLine({ outDay: true, activeNight: true })).toBe('Out and about today, Active tonight');
    expect(switchesLine(SWITCHES_OFF)).toBeNull();
  });
});
