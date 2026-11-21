// The campaign clock (docs/05 "Expeditions, time and light"; 04 "Campaign clock"; 07 "Exploration", time lengths;
// ruled 2026-10-25 and 2026-10-29, D18): one seconds counter per campaign, read in rounds (fights only), turns,
// hours, days and the rules set's extra lengths (`time.extra`), at most one of which shows on the clock. The hour
// is worked out from the turn length, unless the rules set gives `time.turnsPerHour`, which wins (G-07). An
// expedition keeps where the clock was when it started, and shows its elapsed turns ("Delve · turn 37"). A basic
// calendar turns the days into a date whose month gives the season. Whole numbers only; pure.
import type { TimeLengths } from '../../core/campaignSettings.ts';

/** Seconds per named unit: minute, round, turn, hour, day, week, and any extras the setting names. */
export type TimeUnits = Readonly<Record<string, number>>;

export interface TimeExtra {
  id: string;
  name: string;
  seconds: number;
  showOnClock: boolean;
}

export interface Amount {
  value: number;
  unit: string;
}

/** The campaign's time lengths, plus what the rules set may add: turns per hour (wins over turnMinutes) and the week. */
export interface ClockTime extends TimeLengths {
  turnsPerHour?: number | null;
  daysPerWeek?: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null);

/** The rules set's extra time lengths (`time.extra: [{id, name, minutes | hours | days, showOnClock?}]`), top first. */
export function timeExtraOf(rulesSets: readonly Record<string, unknown>[]): TimeExtra[] {
  for (const rules of [...rulesSets].reverse()) {
    const time = rules.time;
    if (!isRecord(time) || !Array.isArray(time.extra)) continue;
    return time.extra.flatMap((e) => {
      if (!isRecord(e) || typeof e.id !== 'string' || !e.id) return [];
      const seconds = whole(e.minutes) ? (e.minutes as number) * 60 : whole(e.hours) ? (e.hours as number) * 3600 : whole(e.days) ? (e.days as number) * 86400 : null;
      return seconds ? [{ id: e.id, name: typeof e.name === 'string' ? e.name : e.id, seconds, showOnClock: e.showOnClock === true }] : [];
    });
  }
  return [];
}

/** The rules set's `time.turnsPerHour` (a whole number above 0), top pack first; null when none gives one. */
export function turnsPerHourOf(rulesSets: readonly Record<string, unknown>[]): number | null {
  for (const rules of [...rulesSets].reverse()) {
    const time = rules.time;
    if (isRecord(time) && whole(time.turnsPerHour)) return time.turnsPerHour as number;
  }
  return null;
}

/** A calendar's `daysPerWeek`, when it gives a whole number. */
export function daysPerWeekOf(calendar: unknown): number | null {
  return isRecord(calendar) ? whole(calendar.daysPerWeek) : null;
}

/**
 * Seconds in each unit. The hour is 60 minutes, unless the rules set gives turnsPerHour, which wins: then an hour
 * is that many turns. A day is dayHours of those hours; a week is the calendar's days per week (7 without one).
 */
export function timeUnits(lengths: ClockTime, extra: readonly TimeExtra[] = []): TimeUnits {
  const turn = lengths.turnMinutes * 60;
  const hour = whole(lengths.turnsPerHour) ? (lengths.turnsPerHour as number) * turn : 3600;
  const day = lengths.dayHours * hour;
  const units: Record<string, number> = {
    minute: 60,
    round: lengths.roundSeconds,
    turn,
    hour,
    day,
    week: day * (whole(lengths.daysPerWeek) ?? 7),
    // A part of the day (M5b step 6a, ST1; 07 a town mode's `step: { unit: "partOfDay" }`): a third of the day.
    partOfDay: day / 3,
  };
  for (const e of extra) if (!(e.id in units)) units[e.id] = e.seconds;
  return units;
}

// Parts of the day (M5b step 6a; 05 Settlements, ST1: time in town moves morning, afternoon, night) ------------

/** The three parts of the day, in order. */
export const PARTS_OF_DAY = ['morning', 'afternoon', 'night'] as const;
export type PartOfDay = (typeof PARTS_OF_DAY)[number];

/** The unit a town mode's step names (07, st-2). */
export const PART_OF_DAY_UNIT = 'partOfDay';

/** Whether a step's unit is a part of the day ("partOfDay", in any case, or "partsOfDay"). */
export const isPartOfDay = (unit: string): boolean => /^parts?ofday$/i.test(unit.trim());

/**
 * Where the morning starts in the day, in seconds: a quarter of the way in (06:00 on a 24-hour day). Each part is a
 * third of the day, so on a 24-hour day the morning is 06:00–14:00, the afternoon 14:00–22:00 and the night
 * 22:00–06:00; a move by one part always lands in the next part, wherever in its part the clock was.
 */
export const morningStarts = (units: TimeUnits): number => units.day! / 4;

/** The part of the day the clock is in. */
export function partOfDay(seconds: number, units: TimeUnits): PartOfDay {
  const day = units.day!;
  const inDay = (((seconds - morningStarts(units)) % day) + day) % day;
  return PARTS_OF_DAY[Math.min(2, Math.floor(inDay / (day / 3)))]!;
}

/** A unit's name as packs and people write it: "turns" and "Turn" are "turn". Unknown names are kept as given. */
export function unitName(unit: string, units: TimeUnits): string {
  if (units[unit] !== undefined) return unit;
  if (isPartOfDay(unit) && units[PART_OF_DAY_UNIT] !== undefined) return PART_OF_DAY_UNIT;
  const lower = unit.trim().toLowerCase();
  if (units[lower] !== undefined) return lower;
  const single = lower.endsWith('s') ? lower.slice(0, -1) : lower;
  return units[single] !== undefined ? single : unit;
}

/** An amount in seconds ("3 turns" → 1800), or null when the unit isn't known or the amount isn't whole. */
export function toSeconds(amount: Amount, units: TimeUnits): number | null {
  const per = units[unitName(amount.unit, units)];
  return per !== undefined && Number.isInteger(amount.value) && amount.value >= 0 ? amount.value * per : null;
}

/**
 * Seconds shown in a unit (D27: kept in seconds, shown in the status's or light's own unit), rounded up so that
 * anything left still reads as at least 1 ("2 turns left" while any of the second turn is left).
 */
export function inUnit(seconds: number, unit: string, units: TimeUnits): Amount | null {
  const name = unitName(unit, units);
  const per = units[name];
  if (per === undefined || per <= 0) return null;
  return { value: Math.max(0, Math.ceil(seconds / per)), unit: name };
}

/** The one extra length shown on the clock: marked showOnClock, and only if it divides a day evenly. */
export function clockExtra(extra: readonly TimeExtra[], units: TimeUnits): TimeExtra | null {
  const day = units.day!;
  return extra.find((e) => e.showOnClock && e.seconds < day && day % e.seconds === 0) ?? null;
}

export interface ClockReading {
  /** Day 1 is the clock's first day. */
  day: number;
  hour: number;
  minute: number;
  /** The turn within the hour, from 1; and how many turns an hour holds (the hour track's pips). */
  turnInHour: number;
  turnsPerHour: number;
  /** The shown extra length's number within the day ("third watch"), from 1, when there is one. */
  extra: { name: string; number: number } | null;
}

/** How many turns an hour holds: the hour over the turn, at least 1. */
export function turnsInHour(units: TimeUnits): number {
  return Math.max(1, Math.floor(units.hour! / units.turn!));
}

/** The clock read at a moment (seconds since it started). */
export function readClock(seconds: number, units: TimeUnits, extra: TimeExtra | null = null): ClockReading {
  const day = units.day!;
  const hour = units.hour!;
  const turn = units.turn!;
  const inDay = ((seconds % day) + day) % day;
  const turnsPerHour = turnsInHour(units);
  return {
    day: Math.floor(seconds / day) + 1,
    hour: Math.floor(inDay / hour),
    minute: Math.floor((inDay % hour) / 60),
    turnInHour: Math.min(turnsPerHour, Math.floor((inDay % hour) / turn) + 1),
    turnsPerHour,
    extra: extra ? { name: extra.name, number: Math.floor(inDay / extra.seconds) + 1 } : null,
  };
}

/** How many of a step have passed since an expedition began, counted from 1: the turn it's on ("turn 37"). */
export function elapsedSteps(now: number, startedAt: number, stepSeconds: number): number {
  return Math.floor(Math.max(0, now - startedAt) / stepSeconds) + 1;
}

/** The round a fight is on, from 1 (rounds belong to fights only; ruled 2026-10-29). */
export function fightRound(now: number, fightStartedAt: number, units: TimeUnits): number {
  return elapsedSteps(now, fightStartedAt, units.round!);
}

/** What the clock shows: the round in a fight; otherwise the expedition's step count in its mode's unit, and the day. */
export interface ClockShown {
  /** In a fight only. */
  round: number | null;
  /** The expedition's own count in its mode's step unit ("turn 37", "day 3"); null outside an expedition. */
  step: { unit: string; number: number } | null;
  reading: ClockReading;
}

export function clockShown(
  now: number,
  units: TimeUnits,
  opts: { expedition?: { startedAt: number; step: Amount } | null; fightStartedAt?: number | null; extra?: TimeExtra | null } = {},
): ClockShown {
  const stepSeconds = opts.expedition ? toSeconds(opts.expedition.step, units) : null;
  return {
    round: opts.fightStartedAt === null || opts.fightStartedAt === undefined ? null : fightRound(now, opts.fightStartedAt, units),
    step:
      opts.expedition && stepSeconds
        ? { unit: unitName(opts.expedition.step.unit, units), number: elapsedSteps(now, opts.expedition.startedAt, stepSeconds) }
        : null,
    reading: readClock(now, units, opts.extra ?? null),
  };
}

/** Moves the clock: whole steps only. Null when the amount can't be read. */
export function advanceBy(now: number, amount: Amount, units: TimeUnits): number | null {
  const by = toSeconds(amount, units);
  return by === null ? null : now + by;
}

export interface CalendarMonth {
  name: string;
  days: number;
  season: string | null;
  /** Named days counted after the month's last day, in its season (ruled 2026-10-25); outside the week unless inWeek. */
  extraDays: { id: string; name: string; inWeek: boolean }[];
}

/** The basic calendar's months (07 `calendars`: months with days, a season and extra days); empty without one. */
export function monthsOf(calendar: unknown): CalendarMonth[] {
  if (!isRecord(calendar) || !Array.isArray(calendar.months)) return [];
  return calendar.months.flatMap((m) => {
    if (!isRecord(m) || typeof m.name !== 'string' || !whole(m.days)) return [];
    const extraDays = (Array.isArray(m.extraDays) ? m.extraDays : []).flatMap((e) =>
      isRecord(e) && typeof e.id === 'string' && typeof e.name === 'string' ? [{ id: e.id, name: e.name, inWeek: e.inWeek === true }] : [],
    );
    return [{ name: m.name, days: m.days as number, season: typeof m.season === 'string' ? m.season : null, extraDays }];
  });
}

export interface CalendarDate {
  /** The day of the month; null on an extra day. */
  day: number | null;
  month: string;
  /** The month's place in the year, from 0 (an extra day belongs to the month it follows). */
  monthIndex: number;
  /** On a named extra day after the month: its id and name. */
  extraDay: { id: string; name: string } | null;
  /** Years after the start date's year: 0 in the first. */
  yearsOn: number;
  season: string | null;
  /** Days that moved the weekday on since the start date (extra days outside the week don't). */
  weekdaysOn: number;
}

const lengthOf = (m: CalendarMonth) => m.days + m.extraDays.length;

/**
 * The date some days after a start date ({month index, day}, from the GM), and its season (the month's). A month's
 * extra days come after its last day, in its season and the day count. Null without a calendar; the GM then sets
 * the season by hand (ruled 2026-10-25).
 */
export function dateAfter(months: readonly CalendarMonth[], start: { month: number; day: number }, daysOn: number): CalendarDate | null {
  if (months.length === 0 || start.month < 0 || start.month >= months.length || daysOn < 0) return null;
  const year = months.reduce((sum, m) => sum + lengthOf(m), 0);
  // A start may be one of the month's extra days (a day past its last: "Which season?" can land on one).
  const startOffset = months.slice(0, start.month).reduce((sum, m) => sum + lengthOf(m), 0) + Math.min(Math.max(start.day, 1), lengthOf(months[start.month]!)) - 1;
  let offset = startOffset + daysOn;
  const yearsOn = Math.floor(offset / year);
  offset -= yearsOn * year;
  let index = 0;
  while (offset >= lengthOf(months[index]!)) {
    offset -= lengthOf(months[index]!);
    index += 1;
  }
  const month = months[index]!;
  const extra = offset >= month.days ? month.extraDays[offset - month.days]! : null;
  // Days in the week in one whole year, then position by position within a year: whole years count at once.
  const inWeekPerYear = months.reduce((sum, m) => sum + m.days + m.extraDays.filter((e) => e.inWeek).length, 0);
  const inWeekBefore = (target: number) => {
    const years = Math.floor(target / year);
    let count = years * inWeekPerYear;
    let left = target - years * year;
    for (const m of months) {
      if (left <= 0) break;
      const take = Math.min(left, lengthOf(m));
      count += Math.min(take, m.days) + m.extraDays.slice(0, Math.max(0, take - m.days)).filter((e) => e.inWeek).length;
      left -= take;
    }
    return count;
  };
  // A day moves the weekday on when it's reached: count the days after the start, up to and including this one.
  const weekdaysOn = inWeekBefore(startOffset + daysOn + 1) - inWeekBefore(startOffset + 1);
  return { day: extra ? null : offset + 1, month: month.name, monthIndex: index, extraDay: extra ? { id: extra.id, name: extra.name } : null, yearsOn, season: month.season, weekdaysOn };
}

/** The date on the clock: the calendar's start date plus the clock's whole days since the start. */
export function dateOnClock(months: readonly CalendarMonth[], start: { month: number; day: number }, now: number, startedAt: number, units: TimeUnits): CalendarDate | null {
  return dateAfter(months, start, Math.floor(Math.max(0, now - startedAt) / units.day!));
}

/** A date in words: "14 Reedmonth (spring)", or "Lanternsday, after Reedmonth (spring)"; the same for players. */
export function showDate(date: CalendarDate): string {
  const season = date.season ? ` (${date.season})` : '';
  return date.extraDay ? `${date.extraDay.name}, after ${date.month}${season}` : `${date.day} ${date.month}${season}`;
}

/**
 * A calendar start date as people and packs write it (07 `calendar.defaultStart`, 04 `calendarStart`): the month
 * counted from 1 and the day from 1. Null when it isn't one.
 */
export interface CalendarStart {
  month: number;
  day: number;
}

/** Reads a calendar start ({ month, day }, both whole numbers from 1); null when it isn't one. */
export function calendarStartOf(value: unknown): CalendarStart | null {
  if (!isRecord(value)) return null;
  const month = whole(value.month);
  const day = whole(value.day);
  return month && day ? { month, day } : null;
}

/**
 * The start in the calendar's own terms (the month's place from 0, as dateAfter reads it); null when it doesn't fit.
 * A day past the month's last is one of its extra days, in order ("Which season?" can start on one).
 */
export function startIndex(months: readonly CalendarMonth[], start: CalendarStart | null): { month: number; day: number } | null {
  if (!start || start.month > months.length) return null;
  const month = months[start.month - 1]!;
  return start.day <= lengthOf(month) ? { month: start.month - 1, day: start.day } : null;
}

/** The seasons the calendar's months carry, in the order the year meets them. */
export function seasonsOf(months: readonly CalendarMonth[]): string[] {
  return [...new Set(months.flatMap((m) => (m.season ? [m.season] : [])))];
}

/**
 * A season's first day: the first day of the month where it begins (the month before is another season, so a
 * winter that runs over the year's end begins in the year's last months); null when no month has it.
 */
export function seasonStart(months: readonly CalendarMonth[], season: string): CalendarStart | null {
  const begins = months.findIndex((m, i) => m.season === season && months[(i - 1 + months.length) % months.length]!.season !== season);
  const at = begins >= 0 ? begins : months.findIndex((m) => m.season === season);
  return at < 0 ? null : { month: at + 1, day: 1 };
}

/**
 * "Which season?" (ruled 2026-10-30): the calendar start that makes today, `daysOn` whole days after the start, the
 * first day of that season, worked back from the clock. Null when no month has the season.
 */
export function startForToday(months: readonly CalendarMonth[], season: string, daysOn: number): CalendarStart | null {
  const first = seasonStart(months, season);
  if (!first) return null;
  const year = months.reduce((sum, m) => sum + lengthOf(m), 0);
  const target = months.slice(0, first.month - 1).reduce((sum, m) => sum + lengthOf(m), 0);
  let offset = (((target - Math.max(0, Math.floor(daysOn))) % year) + year) % year;
  let index = 0;
  while (offset >= lengthOf(months[index]!)) {
    offset -= lengthOf(months[index]!);
    index += 1;
  }
  return { month: index + 1, day: offset + 1 };
}
