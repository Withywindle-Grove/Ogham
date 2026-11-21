// Status timers (docs/04 "Status"; 05 "Status symbols"; ruled 2026-10-29, D27): the time a status has left is
// stored in seconds on the campaign clock and shown in the status's own unit (rounds, turns or days). A secret
// timer's time left is the GM's only: players see the symbol without the fill. (Where a secret timer is stored is
// the database's business: a GM-only table, never the actor's statuses.) Pure.
import { inUnit, toSeconds, unitName, type Amount, type TimeUnits } from './clock.ts';

export interface StatusTimer {
  /** Seconds left; null when it has no timer (it lasts until removed). */
  remaining: number | null;
  /** How long it lasted when it started, in seconds (for the draining ring); null without a timer. */
  total: number | null;
  /** The unit it's shown in: the status's own (round, turn, day…). */
  unit: string;
  secret: boolean;
}

/** A timer starting now from an amount ("3 turns"), kept in seconds; null when the amount can't be read. */
export function startTimer(amount: Amount, units: TimeUnits, secret = false): StatusTimer | null {
  const seconds = toSeconds(amount, units);
  return seconds === null || seconds === 0 ? null : { remaining: seconds, total: seconds, unit: unitName(amount.unit, units), secret };
}

/** A condition's default length (`defaultRounds`, a whole number of rounds), as a timer in rounds; null when it has none. */
export function timerFromCondition(condition: Record<string, unknown>, units: TimeUnits, secret = false): StatusTimer | null {
  const rounds = condition.defaultRounds;
  return typeof rounds === 'number' && Number.isInteger(rounds) && rounds > 0 ? startTimer({ value: rounds, unit: 'round' }, units, secret) : null;
}

/** The timer after some seconds pass: what's left (never below 0) and whether it ended in that time. */
export function tickTimer(timer: StatusTimer, elapsed: number): { timer: StatusTimer; ended: boolean } {
  if (timer.remaining === null || elapsed <= 0) return { timer, ended: false };
  const remaining = Math.max(0, timer.remaining - elapsed);
  return { timer: { ...timer, remaining }, ended: timer.remaining > 0 && remaining === 0 };
}

export interface TimerShown {
  /** Time left in the status's unit, rounded up; null for no timer, or for a player when it's secret. */
  left: Amount | null;
  /** How full the symbol is, in whole percent (100 at the start, 0 at the end); null when not shown. */
  fillPercent: number | null;
  /** A secret timer seen by a player: the symbol shows "active", no fill. */
  hiddenFromViewer: boolean;
}

/** What a viewer sees of a timer: the GM always the time left; a player not when it's secret. */
export function showTimer(timer: StatusTimer, units: TimeUnits, viewer: 'gm' | 'player'): TimerShown {
  const hiddenFromViewer = timer.secret && viewer === 'player';
  if (timer.remaining === null || hiddenFromViewer) return { left: null, fillPercent: null, hiddenFromViewer };
  const fillPercent = timer.total && timer.total > 0 ? Math.max(0, Math.min(100, Math.round((timer.remaining * 100) / timer.total))) : null;
  return { left: inUnit(timer.remaining, timer.unit, units), fillPercent, hiddenFromViewer };
}
