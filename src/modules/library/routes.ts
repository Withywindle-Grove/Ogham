// An adventure's routes (07 Adventure packs §3): the links between its places, the GM's (library kind `route`).
// December step 4, piece a (docs/plans/dec-4-point-travel.md; ruled pt-f1, 2026-11-11): a route's `travel` is one
// amount, as before, or a list of ways of moving, each with its own time. Pure: reads an entry's data, never guesses.

import { REMIND_UNITS } from './hooks.ts';

/** One way of moving along a route: `by` a short id, `name` its words (both on the link), and its time. */
export interface RouteWay {
  /** The way's short id ("row", "swim"); empty for a route that gives one amount. */
  by: string;
  /** Its words ("Rowing"); empty for a route that gives one amount. */
  name: string;
  /** A whole number of `unit`s, 0 or more. */
  value: number;
  /** One of ROUTE_UNITS ("turn", "hour", "day"…). */
  unit: string;
  /**
   * The icon the pack names for this way (pf-25), as written, trimmed: a name meant to be in the app's set. Absent
   * when the pack names none (the way's `by` is then read; `wayIconOf`, ui/iconSet.ts). The GM's read only: what a
   * player's device is sent (`campaign_ways_on`) has by, name, value and unit, and no icon.
   */
  icon?: string;
}

/** A route as the app reads it. */
export interface Route {
  id: string;
  from: string;
  to: string;
  /** The GM's throughout (pt-f3). */
  hidden: boolean;
  /** Listed only from `from` (pt-f3). */
  oneWay: boolean;
  /** The ways of moving along it, in the pack's order; empty when the route gives no time. */
  ways: RouteWay[];
}

/** The time units a route's `travel` may use: the clock's units, as reminders use them (07 Adventure packs §3). */
export const ROUTE_UNITS: readonly string[] = REMIND_UNITS;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const words = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** One amount `{ value, unit }`, or null when it isn't one (a whole number of one of ROUTE_UNITS). */
function amount(raw: unknown): { value: number; unit: string } | null {
  if (!isRecord(raw)) return null;
  const unit = words(raw.unit);
  return Number.isInteger(raw.value) && (raw.value as number) >= 0 && ROUTE_UNITS.includes(unit) ? { value: raw.value as number, unit } : null;
}

/**
 * A route's ways of moving: one amount gives one way with no id or name; a list gives each way that has a `by` and a
 * whole-number time (a way named twice keeps its first). Anything else gives none (pack:check says why). A way in a
 * list keeps the `icon` it names (pf-25); an `icon` that isn't words is left out, never guessed.
 */
export function routeWays(travel: unknown): RouteWay[] {
  if (Array.isArray(travel)) {
    const seen = new Set<string>();
    return travel.flatMap((raw) => {
      const time = amount(raw);
      const by = isRecord(raw) ? words(raw.by) : '';
      if (!time || !by || seen.has(by)) return [];
      seen.add(by);
      const icon = words((raw as Record<string, unknown>).icon);
      return [{ by, name: words((raw as Record<string, unknown>).name) || by, ...time, ...(icon ? { icon } : {}) }];
    });
  }
  const time = amount(travel);
  return time ? [{ by: '', name: '', ...time }] : [];
}

/** A route entry's data as the app reads it; null without an id, a `from` or a `to`. */
export function readRoute(id: string, data: Record<string, unknown>): Route | null {
  const from = words(data.from);
  const to = words(data.to);
  if (!id || !from || !to) return null;
  return { id, from, to, hidden: data.hidden === true, oneWay: data.oneWay === true, ways: routeWays(data.travel) };
}

/**
 * A link's obstacle (pf-12: `barrier: { name?, extraTurns, needsApproval, through?, note }`, `name` added by pf-12f;
 * "Obstacle" on screen, mc-41):
 * the extra turns crossing it takes, whether the GM decides if the party gets through, the place a crossing passes
 * (whose own chances then apply) and the book's note. The GM's alone (mc-28a, dp-5): its note, its need for the GM's
 * approval, its extra time and the place it passes are never a player's.
 */
export interface Barrier {
  /** Its own name (pf-12f), as the pack writes it; null when it gives none (`obstacleNameOf` then falls back). */
  name: string | null;
  /** Whole turns more for the crossing, 0 or more. */
  extraTurns: number;
  /** The GM decides whether the party gets through ("Do they get through?"). */
  needsApproval: boolean;
  /** The id of the place a crossing passes; null when the pack names none. */
  through: string | null;
  /** The book's note, the GM's to read; empty when the pack gives none. */
  note: string;
}

/**
 * A route's `barrier` as `viewer` may have it. The GM gets it whole (null when there is none, when it isn't an object,
 * or when its extra time isn't a whole number from 0; a missing extra time is 0). A player gets nothing of it,
 * whatever the pack says, its name included: the name is the one thing a player may ever learn of an obstacle, and
 * only after the GM's No (dp-5), as a record of play (piece 4b), never from the pack's barrier. Routes are the GM's kind besides (pt-f3), so a player's device never holds one.
 */
export function readBarrier(raw: unknown, viewer: 'gm' | 'player'): Barrier | null {
  if (viewer !== 'gm' || !isRecord(raw)) return null;
  const extra = raw.extraTurns ?? 0;
  if (!Number.isInteger(extra) || (extra as number) < 0) return null;
  const through = words(raw.through);
  const name = words(raw.name);
  return { name: name || null, extraTurns: extra as number, needsApproval: raw.needsApproval === true, through: through || null, note: words(raw.note) };
}
