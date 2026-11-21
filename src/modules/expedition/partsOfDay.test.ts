// Parts of the day (M5b step 6a; 05 Settlements, ST1; 07 a town mode's `step: { value: 1, unit: "partOfDay" }`, st-2).
// Invented names only.
import { describe, expect, it } from 'vitest';
import { isPartOfDay, morningStarts, partOfDay, timeUnits, toSeconds, unitName } from './clock.ts';
import { readExploration } from './modes.ts';
import { advanceLabel, betweenLine, expeditionLine } from './play.ts';
import { nextStep, stepSeconds } from './procedure.ts';
import { reachesMorning } from './townSwitches.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 });
const HOUR = 3600;
const DAY = 24 * HOUR;
const rules = readExploration([{ id: 'r', name: 'R', exploration: { modes: [{ id: 'quay', name: 'Market town', step: { value: 1, unit: 'partOfDay' }, procedure: [], checks: [] }] } }]);
const town = rules.modes[0]!;

describe('parts of the day', () => {
  // Purpose: a part of the day is a unit of its own, a third of the day, however the pack spells it.
  it('is a third of the day, read as a unit', () => {
    expect(units.partOfDay).toBe(8 * HOUR);
    expect(toSeconds({ value: 1, unit: 'partOfDay' }, units)).toBe(8 * HOUR);
    expect(unitName('partsOfDay', units)).toBe('partOfDay');
    expect(isPartOfDay('PartOfDay')).toBe(true);
    expect(isPartOfDay('day')).toBe(false);
    // A 20-hour day still splits into whole seconds.
    expect(timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 20 }).partOfDay).toBe((20 * HOUR) / 3);
  });

  // Purpose: the morning starts a quarter into the day; each part runs a third of it, and night runs past midnight.
  it('names the part the clock is in: morning from 06:00, afternoon from 14:00, night from 22:00 to 06:00', () => {
    expect(morningStarts(units)).toBe(6 * HOUR);
    expect(partOfDay(6 * HOUR, units)).toBe('morning');
    expect(partOfDay(13 * HOUR + 59 * 60, units)).toBe('morning');
    expect(partOfDay(14 * HOUR, units)).toBe('afternoon');
    expect(partOfDay(22 * HOUR, units)).toBe('night');
    expect(partOfDay(0, units)).toBe('night');
    expect(partOfDay(DAY + 5 * HOUR, units)).toBe('night');
  });

  // Purpose: one step always lands in the next part, wherever in its part the clock was (09:30 → afternoon → night → morning).
  it('one step from anywhere in a part lands in the next part', () => {
    let at = 9 * HOUR + 30 * 60;
    const seen = [partOfDay(at, units)];
    for (let i = 0; i < 3; i += 1) seen.push(partOfDay((at += units.partOfDay!), units));
    expect(seen).toEqual(['morning', 'afternoon', 'night', 'morning']);
  });

  // Purpose: a town mode's main advance is "Next part of day", and the strip shows the part, with or without an expedition.
  it('labels the advance and the strip with the part of the day', () => {
    expect(advanceLabel(town, units)).toBe('Next part of day');
    expect(stepSeconds(town, units)).toBe(8 * HOUR);
    expect(expeditionLine(town, { startedAt: 0 }, 15 * HOUR, units)).toBe('Market town, afternoon');
    expect(betweenLine(town, 23 * HOUR, units)).toBe('Market town, night');
    expect(betweenLine({ ...town, name: 'Under the quay', step: { value: 1, unit: 'turn' } }, 23 * HOUR, units)).toBe('Under the quay');
  });

  // Purpose: during an expedition the procedure runs for a part-of-day step like any other step.
  it('runs the procedure one part of the day on', () => {
    const step = nextStep({ rules, mode: town, units, startedAt: 6 * HOUR, now: 6 * HOUR, situation: {} });
    expect(step?.to).toBe(14 * HOUR);
  });

  // Purpose: in a town mode the switches' reset falls at the morning part, not at midnight (sw-3 with 6a's parts).
  it('reaches the morning at the morning part when given its start', () => {
    const at = morningStarts(units);
    expect(reachesMorning(22 * HOUR, DAY + 6 * HOUR, DAY, at)).toBe(true);
    expect(reachesMorning(14 * HOUR, 22 * HOUR, DAY, at)).toBe(false);
    // Crossing midnight alone isn't the morning in a town mode…
    expect(reachesMorning(22 * HOUR, DAY + 2 * HOUR, DAY, at)).toBe(false);
    // …but is in a mode without parts of the day.
    expect(reachesMorning(22 * HOUR, DAY + 2 * HOUR, DAY)).toBe(true);
  });
});
