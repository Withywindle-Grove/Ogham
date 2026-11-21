// Daylight hints (docs/05 "Seasons, weather and the calendar"; 07 daylight, G-07). Invented calendar and times.
import { describe, expect, it } from 'vitest';
import { dateAfter, monthsOf } from './clock.ts';
import { daylightAt, daylightOf, daylightOn, minutesOf } from './daylight.ts';

const months = monthsOf({
  months: [
    { name: 'Reedmonth', days: 30, season: 'spring', extraDays: [{ id: 'lanternsday', name: 'Lanternsday' }] },
    { name: 'Highsun', days: 30, season: 'summer' },
  ],
});

describe('reading daylight', () => {
  it('reads "HH:MM" as minutes after midnight and refuses anything else', () => {
    expect(minutesOf('06:30')).toBe(390);
    expect(minutesOf('25:00')).toBeNull();
    expect(minutesOf(630)).toBeNull();
  });

  it('by month wins, then by season, then one plain pair; a row with sunset before sunrise is skipped', () => {
    const rules = daylightOf([
      {
        daylight: {
          sunrise: '07:00',
          sunset: '19:00',
          byMonth: [{ month: 'Highsun', sunrise: '05:00', sunset: '21:00' }, { month: 'Reedmonth', sunrise: '20:00', sunset: '06:00' }],
          bySeason: [{ season: 'spring', sunrise: '06:00', sunset: '18:00' }],
        },
      },
    ]);
    expect(daylightOn(rules, { date: dateAfter(months, { month: 1, day: 1 }, 0) })).toEqual({ sunrise: 300, sunset: 1260 });
    expect(daylightOn(rules, { date: dateAfter(months, { month: 0, day: 1 }, 0) })).toEqual({ sunrise: 360, sunset: 1080 });
    expect(daylightOn(rules, { season: 'winter' })).toEqual({ sunrise: 420, sunset: 1140 });
  });

  it("an extra day takes its month's daylight; without a calendar the GM's season picks the row; keyed rows work too", () => {
    const rules = daylightOf([{ daylight: { byMonth: { reedmonth: { sunrise: '06:15', sunset: '18:45' } }, bySeason: { summer: { sunrise: '05:00', sunset: '21:00' } } } }]);
    expect(daylightOn(rules, { date: dateAfter(months, { month: 0, day: 30 }, 1) })).toEqual({ sunrise: 375, sunset: 1125 });
    expect(daylightOn(rules, { season: 'summer' })).toEqual({ sunrise: 300, sunset: 1260 });
  });

  it('no daylight section, or one that cannot be read, gives no hints and never fails', () => {
    expect(daylightOf([{}, { daylight: 'long days' }, { daylight: { byMonth: [null, 3] } }])).toBeNull();
    expect(daylightOn(null, { season: 'spring' })).toBeNull();
    expect(daylightAt(null, 600, 10)).toBeNull();
  });
});

describe('daylight hints', () => {
  const day = { sunrise: 360, sunset: 1080 };

  it('says the sun is up between sunrise and sunset; a hint only in the step that passed it', () => {
    expect(daylightAt(day, 720, 10)).toEqual({ sunUp: true, hint: null });
    expect(daylightAt(day, 1085, 10)).toEqual({ sunUp: false, hint: 'sunset' });
    expect(daylightAt(day, 1080, 10)).toEqual({ sunUp: false, hint: 'sunset' });
    expect(daylightAt(day, 1095, 10)).toEqual({ sunUp: false, hint: null });
    expect(daylightAt(day, 365, 10)).toEqual({ sunUp: true, hint: 'sunrise' });
  });

  it('a step of a whole day never hints (every day has a sunset)', () => {
    expect(daylightAt(day, 1085, 24 * 60)).toEqual({ sunUp: false, hint: null });
  });
});
