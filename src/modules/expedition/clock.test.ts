// The campaign clock (docs/05; ruled M5-2, S17-9). Invented calendar.
import { describe, expect, it } from 'vitest';
import { advanceBy, calendarStartOf, clockExtra, clockShown, dateAfter, dateOnClock, daysPerWeekOf, elapsedSteps, fightRound, inUnit, monthsOf, readClock, seasonsOf, seasonStart, showDate, startForToday, startIndex, timeExtraOf, timeUnits, toSeconds, turnsPerHourOf, unitName } from './clock.ts';

const standard = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 });

describe('units', () => {
  it('rounds, turns, hours (always 60 minutes), days and weeks in seconds; extras from the rules set', () => {
    expect(standard).toMatchObject({ minute: 60, round: 6, turn: 600, hour: 3600, day: 86400, week: 604800 });
    const extra = timeExtraOf([{ time: { extra: [{ id: 'watch', name: 'Watch', hours: 4, showOnClock: true }, { id: 'bell', name: 'Bell', minutes: 30 }, { id: 'odd' }] } }]);
    expect(extra).toEqual([
      { id: 'watch', name: 'Watch', seconds: 14400, showOnClock: true },
      { id: 'bell', name: 'Bell', seconds: 1800, showOnClock: false },
    ]);
    expect(timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 }, extra)).toMatchObject({ watch: 14400, bell: 1800 });
  });

  it('only one extra shows on the clock, and only one that divides a day evenly', () => {
    const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 });
    expect(clockExtra([{ id: 'w', name: 'Watch', seconds: 5 * 3600, showOnClock: true }], units)).toBeNull();
    expect(clockExtra([{ id: 'w', name: 'Watch', seconds: 4 * 3600, showOnClock: true }], units)?.id).toBe('w');
  });

  it('amounts in seconds; an unknown unit is null', () => {
    expect(toSeconds({ value: 3, unit: 'turn' }, standard)).toBe(1800);
    expect(toSeconds({ value: 1, unit: 'fortnight' }, standard)).toBeNull();
    expect(advanceBy(600, { value: 6, unit: 'turn' }, standard)).toBe(4200);
  });

  it('unit names as packs write them: plurals and capitals read as the unit; half amounts are refused', () => {
    expect(unitName('Turns', standard)).toBe('turn');
    expect(toSeconds({ value: 40, unit: 'minutes' }, standard)).toBe(2400);
    expect(toSeconds({ value: 1.5, unit: 'turn' }, standard)).toBeNull();
  });

  it('turns per hour from the rules set wins over the hour worked out from the turn length', () => {
    expect(turnsPerHourOf([{ time: { turnMinutes: 10 } }, { time: { turnsPerHour: 5 } }])).toBe(5);
    expect(turnsPerHourOf([{ time: { turnsPerHour: 0 } }])).toBeNull();
    // 12-minute turns with 6 turns to the hour: the hour is 6 turns (72 minutes), and a day is 24 of those hours.
    const odd = timeUnits({ roundSeconds: 6, turnMinutes: 12, dayHours: 24, turnsPerHour: 6 });
    expect(odd).toMatchObject({ turn: 720, hour: 4320, day: 24 * 4320 });
    expect(readClock(4320 + 720 * 2, odd)).toMatchObject({ hour: 1, turnInHour: 3, turnsPerHour: 6 });
  });

  it("a week is the calendar's days per week when it gives one", () => {
    expect(timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24, daysPerWeek: daysPerWeekOf({ daysPerWeek: 5 }) }).week).toBe(5 * 86400);
    expect(daysPerWeekOf({ daysPerWeek: 'many' })).toBeNull();
  });

  it('seconds shown in a unit round up, so anything left reads as at least 1', () => {
    expect(inUnit(601, 'turn', standard)).toEqual({ value: 2, unit: 'turn' });
    expect(inUnit(0, 'turns', standard)).toEqual({ value: 0, unit: 'turn' });
    expect(inUnit(10, 'aeon', standard)).toBeNull();
  });
});

describe('reading the clock', () => {
  it('day, hour, minute and the turn within the hour', () => {
    expect(readClock(0, standard)).toEqual({ day: 1, hour: 0, minute: 0, turnInHour: 1, turnsPerHour: 6, extra: null });
    expect(readClock(86400 + 3600 * 13 + 600 * 4 + 30, standard)).toMatchObject({ day: 2, hour: 13, minute: 40, turnInHour: 5 });
  });

  it("a turn that doesn't divide the hour still reads: 7-minute turns give 8 pips, the last one short", () => {
    const odd = timeUnits({ roundSeconds: 6, turnMinutes: 7, dayHours: 24 });
    expect(readClock(3600 - 1, odd)).toMatchObject({ turnsPerHour: 8, turnInHour: 8 });
  });

  it('the extra on the clock reads its number in the day', () => {
    const watch = { id: 'watch', name: 'Watch', seconds: 14400, showOnClock: true };
    expect(readClock(3600 * 9, standard, watch).extra).toEqual({ name: 'Watch', number: 3 });
  });

  it("an expedition counts its own turns from where the campaign's clock was when it began", () => {
    expect(elapsedSteps(100_000 + 600 * 36, 100_000, 600)).toBe(37);
    expect(elapsedSteps(100_000, 100_000, 600)).toBe(1);
  });

  it("rounds show only in a fight; outside one the clock shows the expedition's step in its mode's unit", () => {
    expect(fightRound(1000 + 6 * 4, 1000, standard)).toBe(5);
    const delve = clockShown(600 * 36, standard, { expedition: { startedAt: 0, step: { value: 1, unit: 'turn' } } });
    expect(delve).toMatchObject({ round: null, step: { unit: 'turn', number: 37 } });
    const trek = clockShown(86400 * 2 + 5, standard, { expedition: { startedAt: 0, step: { value: 1, unit: 'days' } }, fightStartedAt: 86400 * 2 });
    expect(trek).toMatchObject({ round: 1, step: { unit: 'day', number: 3 } });
    expect(clockShown(0, standard).step).toBeNull();
  });
});

describe('the basic calendar', () => {
  const months = monthsOf({
    months: [
      { name: 'Reedmonth', days: 30, season: 'spring', extraDays: [{ id: 'lanternsday', name: 'Lanternsday' }] },
      { name: 'Highsun', days: 31, season: 'summer' },
      { name: 'Frostfall', days: 30, season: 'winter', extraDays: [{ id: 'longnight', name: 'Longnight', inWeek: true }] },
      { bad: true },
    ],
  });

  it('reads months with their season and extra days; nothing without a calendar', () => {
    expect(months.map((m) => [m.name, m.extraDays.map((e) => [e.id, e.inWeek])])).toEqual([
      ['Reedmonth', [['lanternsday', false]]],
      ['Highsun', []],
      ['Frostfall', [['longnight', true]]],
    ]);
    expect(monthsOf(undefined)).toEqual([]);
  });

  it('the date follows the clock, and the season follows the date, across months and years', () => {
    expect(showDate(dateAfter(months, { month: 0, day: 14 }, 0)!)).toBe('14 Reedmonth (spring)');
    expect(dateAfter(months, { month: 0, day: 14 }, 18)).toMatchObject({ day: 1, month: 'Highsun', season: 'summer' });
    expect(dateAfter(months, { month: 2, day: 30 }, 2)).toMatchObject({ day: 1, month: 'Reedmonth', yearsOn: 1 });
    expect(dateAfter([], { month: 0, day: 1 }, 3)).toBeNull();
  });

  it("the date on the clock is the start date plus the clock's whole days, and the season moves with it", () => {
    expect(dateOnClock(months, { month: 0, day: 30 }, 86400 * 2 + 3600, 0, standard)).toMatchObject({ day: 1, month: 'Highsun', monthIndex: 1, season: 'summer' });
    expect(dateOnClock(months, { month: 0, day: 30 }, 86400 - 1, 0, standard)).toMatchObject({ day: 30, month: 'Reedmonth' });
  });

  it('many years on still counts the weekday by whole years (extra days outside the week left out)', () => {
    // A year here is 93 days, 92 of them in the week; ten years on from the first day.
    expect(dateAfter(months, { month: 0, day: 1 }, 930)).toMatchObject({ day: 1, month: 'Reedmonth', yearsOn: 10, weekdaysOn: 920 });
  });

  it('extra days come after the month, in its season, and read "<name>, after <month> (<season>)"; outside the week unless inWeek', () => {
    const lanterns = dateAfter(months, { month: 0, day: 30 }, 1)!;
    expect(showDate(lanterns)).toBe('Lanternsday, after Reedmonth (spring)');
    expect(lanterns).toMatchObject({ day: null, extraDay: { id: 'lanternsday', name: 'Lanternsday' }, weekdaysOn: 0 });
    // Past Lanternsday into Highsun: two days on, but only one moved the weekday.
    expect(dateAfter(months, { month: 0, day: 30 }, 2)).toMatchObject({ day: 1, month: 'Highsun', weekdaysOn: 1 });
    expect(dateAfter(months, { month: 2, day: 30 }, 1)).toMatchObject({ extraDay: { id: 'longnight', name: 'Longnight' }, weekdaysOn: 1 });
  });
});

describe('the calendar start (ruled 2026-10-29)', () => {
  const months = monthsOf({
    months: [
      { name: 'Thawmonth', days: 28, season: 'spring' },
      { name: 'Reedmonth', days: 30, season: 'spring' },
      { name: 'Highsun', days: 31, season: 'summer' },
      { name: 'Frostfall', days: 30, season: 'winter' },
    ],
  });

  it('a start is a month counted from 1 and a day; anything else is no start', () => {
    expect(calendarStartOf({ month: 2, day: 14 })).toEqual({ month: 2, day: 14 });
    expect(calendarStartOf({ month: 0, day: 14 })).toBeNull();
    expect(calendarStartOf({ month: 2 })).toBeNull();
    expect(calendarStartOf(null)).toBeNull();
  });

  it("a pack's defaultStart (months from 1, as 07 says) is read as the calendar's month from 0", () => {
    expect(startIndex(months, { month: 1, day: 1 })).toEqual({ month: 0, day: 1 });
    expect(showDate(dateAfter(months, startIndex(months, { month: 3, day: 5 })!, 0)!)).toBe('5 Highsun (summer)');
    // A month or a day the calendar doesn't have is no start.
    expect(startIndex(months, { month: 5, day: 1 })).toBeNull();
    expect(startIndex(months, { month: 1, day: 29 })).toBeNull();
    expect(startIndex([], { month: 1, day: 1 })).toBeNull();
  });

  it('"Which season?" offers the seasons in the order of the year; a season starts on the first day of its first month', () => {
    expect(seasonsOf(months)).toEqual(['spring', 'summer', 'winter']);
    expect(seasonStart(months, 'summer')).toEqual({ month: 3, day: 1 });
    expect(seasonStart(months, 'spring')).toEqual({ month: 1, day: 1 });
    expect(seasonStart(months, 'autumn')).toBeNull();
  });

  it('a season that runs over the end of the year begins in its last months, not in the first', () => {
    const wrapping = monthsOf({
      months: [
        { name: 'Deepcold', days: 30, season: 'winter' },
        { name: 'Thawmonth', days: 30, season: 'spring' },
        { name: 'Highsun', days: 30, season: 'summer' },
        { name: 'Frostfall', days: 30, season: 'winter' },
      ],
    });
    expect(seasonStart(wrapping, 'winter')).toEqual({ month: 4, day: 1 });
  });

  it('"Which season?" makes today the first day of the chosen season, worked back from the clock (ruled 2026-10-30)', () => {
    // On the clock's first day the start is the season's first day itself.
    expect(startForToday(months, 'summer', 0)).toEqual({ month: 3, day: 1 });
    // Ten days in: the start is ten days before the first of Highsun, so today reads 1 Highsun.
    const start = startForToday(months, 'summer', 10)!;
    expect(start).toEqual({ month: 2, day: 21 });
    expect(showDate(dateAfter(months, startIndex(months, start)!, 10)!)).toBe('1 Highsun (summer)');
    // Further back than a year's start wraps round to the year before.
    const early = startForToday(months, 'spring', 5)!;
    expect(showDate(dateAfter(months, startIndex(months, early)!, 5)!)).toBe('1 Thawmonth (spring)');
    expect(startForToday(months, 'autumn', 3)).toBeNull();
  });

  it('working back can start on an extra day; the date still lands on the season\'s first day', () => {
    const withExtra = monthsOf({
      months: [
        { name: 'Reedmonth', days: 30, season: 'spring', extraDays: [{ id: 'lanternsday', name: 'Lanternsday' }] },
        { name: 'Highsun', days: 30, season: 'summer' },
      ],
    });
    const start = startForToday(withExtra, 'summer', 1)!;
    expect(start).toEqual({ month: 1, day: 31 });
    expect(startIndex(withExtra, start)).toEqual({ month: 0, day: 31 });
    expect(showDate(dateAfter(withExtra, startIndex(withExtra, start)!, 0)!)).toBe('Lanternsday, after Reedmonth (spring)');
    expect(showDate(dateAfter(withExtra, startIndex(withExtra, start)!, 1)!)).toBe('1 Highsun (summer)');
  });
});
