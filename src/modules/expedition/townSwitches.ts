// The town switches (M5b step 6.0; docs/05 Settlements, ST4; ruled 2026-11-03, sw-1 … sw-4): **Out and about today**
// and **Active tonight**, set by the GM from the time strip's ⋯ and kept with the campaign. A check with
// `onlyWhen: "outDay"` comes due only while Out and about today is on, `"activeNight"` only while Active tonight is on;
// a check without `onlyWhen` always (as before). Both turn off at the next morning (in a mode without parts of the
// day: when the day changes) and at Start downtime. Players see a quiet line while one is on, never the checks. Pure.

/** The two switches, as the campaign keeps them. */
export interface TownSwitches {
  outDay: boolean;
  activeNight: boolean;
}

export const SWITCHES_OFF: TownSwitches = { outDay: false, activeNight: false };

/** The values `onlyWhen` takes (07, ST4); pack:check warns on anything else (scripts/pack-exploration.mjs ONLY_WHEN). */
export const ONLY_WHEN = ['outDay', 'activeNight'] as const;
export type OnlyWhen = (typeof ONLY_WHEN)[number];

/** A check's `onlyWhen` as the engine reads it: one of the two, or null (any other value is pack:check's to warn about). */
export function onlyWhenOf(value: unknown): OnlyWhen | null {
  return value === 'outDay' || value === 'activeNight' ? value : null;
}

/** Whether a check with this `onlyWhen` runs now: no `onlyWhen`, always; otherwise only while its switch is on. */
export function runsNow(onlyWhen: OnlyWhen | null | undefined, switches: TownSwitches | null | undefined): boolean {
  if (!onlyWhen) return true;
  const on = switches ?? SWITCHES_OFF;
  return onlyWhen === 'outDay' ? on.outDay : on.activeNight;
}

/**
 * The switches as the screen shows them after a flip (sm-1, one or the other): turning one on puts the other out, as
 * the command does in the database; turning one off leaves the other as it was.
 */
export function afterFlip(switches: TownSwitches | null | undefined, which: OnlyWhen, on: boolean): TownSwitches {
  return on ? { ...SWITCHES_OFF, [which]: true } : { ...(switches ?? SWITCHES_OFF), [which]: false };
}

/**
 * The flip's toast (sm-1, the lead's words, 2026-11-15): "Out and about today: On"; when turning one on put the other
 * out, both, the tapped one first ("Out and about today: On. Active tonight: Off."), since its Undo brings both back.
 */
export function flipToastWords(before: TownSwitches | null | undefined, which: OnlyWhen, on: boolean): string {
  const name = (w: OnlyWhen) => (w === 'outDay' ? OUT_DAY : ACTIVE_NIGHT);
  const other: OnlyWhen = which === 'outDay' ? 'activeNight' : 'outDay';
  if (on && before?.[other]) return `${name(which)}: On. ${name(other)}: Off.`;
  return `${name(which)}: ${on ? 'On' : 'Off'}`;
}

/** Whether either switch is on. */
export const anyOn = (switches: TownSwitches | null | undefined): boolean => !!switches && (switches.outDay || switches.activeNight);

/** The switch names, as the ⋯ items, the strip and the players' line say them. */
export const OUT_DAY = 'Out and about today';
export const ACTIVE_NIGHT = 'Active tonight';

/** The quiet line on the strip (the GM's marker) and on the players' Scene (sw-2, sw-4): "Out and about today"; null when off. */
export function switchesLine(switches: TownSwitches | null | undefined): string | null {
  if (!switches) return null;
  const words = [switches.outDay ? OUT_DAY : '', switches.activeNight ? ACTIVE_NIGHT : ''].filter(Boolean);
  return words.length ? words.join(', ') : null;
}

/**
 * Whether a move of the clock reaches the next morning (sw-3). In a mode without parts of the day the morning is when
 * the day changes (`morningAt` 0: the move crosses a day boundary); in a mode whose step is a part of the day (step
 * 6a) it's the start of the morning part (`morningAt`, seconds into the day: clock.ts morningStarts).
 */
export function reachesMorning(from: number, to: number, daySeconds: number | null | undefined, morningAt = 0): boolean {
  if (!daySeconds || daySeconds <= 0 || to <= from) return false;
  return Math.floor((to - morningAt) / daySeconds) > Math.floor((from - morningAt) / daySeconds);
}

/** "Out and about ended", "Out and about and Active tonight ended": what was on before a reset; null when nothing was. */
export function endedWords(before: Partial<TownSwitches>): string | null {
  const names = [before.outDay ? 'Out and about' : '', before.activeNight ? ACTIVE_NIGHT : ''].filter(Boolean);
  return names.length ? `${names.join(' and ')} ended` : null;
}
