// Daylight hints (docs/05 "Seasons, weather and the calendar"; 07 "Seasons and weather", daylight; G-07): a rules
// set's sunrise and sunset, given once, by season, or by month (`daylight.byMonth: [{ month, sunrise: "HH:MM",
// sunset: "HH:MM" }]`; by season works the same way). Hints are optional ("Sunset around now"); the Day / Night
// switch stays the GM's, so nothing here changes it. Pure.
import type { CalendarDate } from './clock.ts';

export interface Daylight {
  /** Minutes after midnight. */
  sunrise: number;
  sunset: number;
}

interface DaylightRules {
  plain: Daylight | null;
  byMonth: Map<string, Daylight>;
  bySeason: Map<string, Daylight>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** "HH:MM" in minutes after midnight, or null when it isn't a time of day. */
export function minutesOf(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

const pairOf = (row: Record<string, unknown>): Daylight | null => {
  const sunrise = minutesOf(row.sunrise);
  const sunset = minutesOf(row.sunset);
  return sunrise !== null && sunset !== null && sunrise < sunset ? { sunrise, sunset } : null;
};

/** Rows given as a list ([{ month | season, sunrise, sunset }]) or keyed ({ <name>: { sunrise, sunset } }). */
function rowsOf(value: unknown, key: 'month' | 'season'): Map<string, Daylight> {
  const map = new Map<string, Daylight>();
  if (Array.isArray(value)) {
    for (const row of value) {
      if (!isRecord(row)) continue;
      const name = row[key];
      const pair = pairOf(row);
      if ((typeof name === 'string' || typeof name === 'number') && pair) map.set(String(name).toLowerCase(), pair);
    }
  } else if (isRecord(value)) {
    for (const [name, row] of Object.entries(value)) {
      const pair = isRecord(row) ? pairOf(row) : null;
      if (pair) map.set(name.toLowerCase(), pair);
    }
  }
  return map;
}

/** A rules set's daylight section, top pack first; null when none gives one. Rows that can't be read are skipped. */
export function daylightOf(rulesSets: readonly Record<string, unknown>[]): DaylightRules | null {
  for (const rules of [...rulesSets].reverse()) {
    const d = rules.daylight;
    if (!isRecord(d)) continue;
    const found: DaylightRules = { plain: pairOf(d), byMonth: rowsOf(d.byMonth, 'month'), bySeason: rowsOf(d.bySeason, 'season') };
    if (found.plain || found.byMonth.size || found.bySeason.size) return found;
  }
  return null;
}

/**
 * Sunrise and sunset on a date: by month (its name, or its place in the year from 1), then by season, then the
 * plain pair. Without a calendar, the season the GM set picks the row.
 */
export function daylightOn(rules: DaylightRules | null, when: { date?: CalendarDate | null; season?: string | null }): Daylight | null {
  if (!rules) return null;
  const date = when.date ?? null;
  if (date) {
    const byName = rules.byMonth.get(date.month.toLowerCase()) ?? rules.byMonth.get(String(date.monthIndex + 1));
    if (byName) return byName;
  }
  const season = date?.season ?? when.season ?? null;
  const bySeason = season ? rules.bySeason.get(season.toLowerCase()) : undefined;
  return bySeason ?? rules.plain;
}

export interface DaylightNow {
  /** The sun is up (a hint only: the GM's Day / Night switch decides). */
  sunUp: boolean;
  /** Sunrise or sunset fell in the step that just passed: "Sunrise around now", "Sunset around now". */
  hint: 'sunrise' | 'sunset' | null;
}

/** Daylight at a minute of the day, with a hint when sunrise or sunset fell in the last `stepMinutes`. */
export function daylightAt(daylight: Daylight | null, minuteOfDay: number, stepMinutes: number): DaylightNow | null {
  if (!daylight) return null;
  const sunUp = minuteOfDay >= daylight.sunrise && minuteOfDay < daylight.sunset;
  const passed = (mark: number) => stepMinutes > 0 && stepMinutes < 24 * 60 && ((minuteOfDay - mark + 24 * 60) % (24 * 60)) < stepMinutes;
  return { sunUp, hint: passed(daylight.sunset) ? 'sunset' : passed(daylight.sunrise) ? 'sunrise' : null };
}

/** The clock's night when the setting gives no daylight (nc-3): 22:00 to 06:00. */
export const CLOCK_NIGHT = { from: 22 * 60, to: 6 * 60 } as const;

/**
 * Whether it is night, for encounter checks (nc-3, ruled 2026-11-11): from the setting's sunset to its sunrise where
 * it gives daylight for the day, else 22:00 to 06:00 by the clock. The night stop (the camp's night) always counts as
 * night. In a mode that moves a day or more at a time, it is day until the night stop (nc-3a). No Day / Night switch.
 */
export function isNight(daylight: Daylight | null, minuteOfDay: number, nightStop = false, byTheDay = false): boolean {
  if (nightStop) return true;
  // nc-3a (the lead's reading, 2026-11-11): in a mode whose step is a day or longer the clock's hour doesn't decide
  // (each Next day lands on the same hour); it is day until the night stop.
  if (byTheDay) return false;
  if (daylight) return minuteOfDay < daylight.sunrise || minuteOfDay >= daylight.sunset;
  return minuteOfDay >= CLOCK_NIGHT.from || minuteOfDay < CLOCK_NIGHT.to;
}
