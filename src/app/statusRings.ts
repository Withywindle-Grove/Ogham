// A status as its Status ring reads it (plan m5b-creation-retest-3 F; rulings R3-6; mockup players/02-status-rings).
// Pure: the ring only reads what the status and its timer already hold (the plan's scope check: no change to how
// statuses are set or timed). The arc is the time left over the full span; no end, a dashed track; a time this
// viewer doesn't get (a secret timer, for a player), the track with no arc; a clock unit the ring can't read (⚑ 1,
// the proposed answer used): dashed, with the words the app has. The symbol and tone come from the condition (07
// `icon`, `tone`), the stored icon standing in for a condition the setting no longer has.
import { inUnit, type TimeUnits } from '../modules/expedition/clock.ts';
import { shownName, timerOf, type CharacterStatus, type Condition, type StatusSecret } from '../modules/expedition/statusPlay.ts';
import { ringFraction } from '../modules/expedition/statusLook.ts';
import { isDown } from '../modules/characters/hp.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export interface RingView {
  /** The name on the tile: its level's for one with levels, and "×2" for stacks. */
  name: string;
  icon: string | null;
  tone: string | null;
  /** The arc's share (0 to 1), or null for no arc. */
  fraction: number | null;
  /** No end (or no unit the ring can read): the dashed track. */
  endless: boolean;
  /** The time left in words under the ring ("4 turns", "until removed", "ran out"). */
  words: string;
  /** The sheet's count ("4 of 6 turns left"), or null when there is none to give. */
  count: string | null;
}

/** What the ring shows of one status, for the GM or a player. */
export function ringView(
  status: CharacterStatus,
  book: { secrets: ReadonlyMap<string, StatusSecret>; now: number; units: TimeUnits; conditions: readonly Condition[] },
  viewer: 'gm' | 'player',
): RingView {
  const condition = status.conditionId ? book.conditions.find((c) => c.id === status.conditionId) : undefined;
  const base = {
    name: `${shownName(status)}${status.stacks > 1 ? ` ×${status.stacks}` : ''}`,
    icon: condition?.icon ?? status.icon,
    tone: condition?.tone ?? null,
  };
  const timer = timerOf(status, book.secrets, book.now);
  if (!timer) {
    const words = status.source === 'rest' || status.untilRest ? 'until rest' : status.levels ? 'until stepped down' : 'until removed';
    return { ...base, fraction: null, endless: true, words, count: null };
  }
  // A secret timer seen by a player (or one this device doesn't hold): it has an end, but not one they get.
  if (timer.remaining === null || (timer.secret && viewer === 'player')) return { ...base, fraction: null, endless: false, words: 'time hidden', count: "Time left is the GM's" };
  const hidden = timer.secret ? ', hidden from players' : '';
  const left = inUnit(timer.remaining, timer.unit, book.units);
  if (!left) {
    // ⚑ 1 (proposed answer): no unit the ring can read: dashed, and the words in minutes where the clock has them.
    const minutes = inUnit(timer.remaining, 'minute', book.units);
    return { ...base, fraction: null, endless: true, words: minutes ? plural(minutes.value, minutes.unit) : 'has an end', count: minutes ? `${plural(minutes.value, minutes.unit)} left${hidden}` : null };
  }
  if (timer.remaining === 0) return { ...base, fraction: 0, endless: false, words: 'ran out', count: `Ran out${hidden}` };
  const span = timer.total !== null ? inUnit(timer.total, timer.unit, book.units) : null;
  // No span known: a full ring (it has an end; the words say how long).
  const fraction = timer.total !== null ? ringFraction(timer.remaining, timer.total) : 1;
  const count = span ? `${left.value} of ${plural(span.value, left.unit)} left${hidden}` : `${plural(left.value, left.unit)} left${hidden}`;
  return { ...base, fraction, endless: false, words: plural(left.value, left.unit), count };
}

/** One ring in the Player screen's head: "Down", worked out from the hit points (pss-7), or one of the statuses. */
export type HeadRing = { kind: 'down' } | { kind: 'status'; status: CharacterStatus };

/**
 * The head's status list (pss-7, psb-2; #165): "Down" first while the character is at or below the rules' `death.at`
 * (`downAtOf`), then their statuses. Down is worked out each time from the hit points, never stored; with no `death.at`
 * in the rules, or no hit points set, there is no Down.
 */
export function headStatusList(statuses: readonly CharacterStatus[], hp: number | null, downAt: number | null): HeadRing[] {
  const mine = statuses.map((status): HeadRing => ({ kind: 'status', status }));
  return isDown(hp, downAt) ? [{ kind: 'down' }, ...mine] : mine;
}

/** The Down ring's look (psb-1): the skull (Francis, 2026-11-28), the harm tone, no end (the dashed track, no arc). */
export const DOWN_RING = { name: 'Down', icon: 'skull', tone: 'harm', fraction: null, endless: true } as const;
