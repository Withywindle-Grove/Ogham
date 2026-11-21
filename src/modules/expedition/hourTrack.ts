// The hour track (docs/05 "Exploration follow-ups", X-1; ruled 2026-10-25): in turn-by-turn modes, one row of
// pips, one per turn in the current hour, the current turn filled, with symbols on future pips for party-level
// events (checks, rest, effects ending, and lights as one symbol at the first light to run out). Players see only
// public events. The hour is the clock's (turnsPerHour wins over the turn length; G-07). Pure.
import { turnsInHour, type TimeUnits } from './clock.ts';

export interface TrackEvent {
  at: number;
  /** The symbol's name from the app's fixed list (check, rest, effect, light…). */
  symbol: string;
  label: string;
  /** Players may see it. */
  public: boolean;
}

export interface Pip {
  /** The turn within the hour, from 1. */
  turn: number;
  current: boolean;
  /** This turn is already past. */
  done: boolean;
  events: TrackEvent[];
  /**
   * The next hour's first turn, at the edge of the track: only on the hour's last turn, and only when something falls
   * due exactly as the hour turns over (B8 follow-up, ruled 2026-11-01). `turn` is 1.
   */
  next?: true;
}

/**
 * The hour's pips at `now`: each event on the turn it falls due in, the turn being played when its prompt shows (M5
 * gate B8, ruled 2026-11-01: "due now means now"). An event at the end of the current turn comes due with the next
 * Next turn, so it sits on the next pip; one due at `now` (just brought due) sits on the current pip. One due as the
 * hour turns over belongs to the next hour's first turn: on the hour's last turn it shows ahead, on an extra pip at the
 * edge of the track (`next`; ruled 2026-11-01, g1's ⚑ 2, option B). For this viewer. A light event shows only once, at
 * the first light to run out (pass just that one).
 */
export function hourTrack(now: number, units: TimeUnits, events: readonly TrackEvent[], viewer: 'gm' | 'player'): Pip[] {
  const turnSeconds = units.turn!;
  const perHour = turnsInHour(units);
  const hourStart = now - (now % units.hour!);
  const current = Math.min(perHour, Math.floor((now - hourStart) / turnSeconds) + 1);
  const shown = events.filter((e) => viewer === 'gm' || e.public);
  const pips: Pip[] = Array.from({ length: perHour }, (_, i) => {
    const turn = i + 1;
    const start = hourStart + i * turnSeconds;
    const end = start + turnSeconds;
    return {
      turn,
      current: turn === current,
      done: turn < current,
      events: turn < current ? [] : shown.filter((e) => e.at >= Math.max(start, now) && e.at < end),
    };
  });
  const hourEnd = hourStart + units.hour!;
  const atTurnOver = current === perHour ? shown.filter((e) => e.at === hourEnd) : [];
  if (atTurnOver.length > 0) pips.push({ turn: 1, current: false, done: false, events: atTurnOver, next: true });
  return pips;
}
