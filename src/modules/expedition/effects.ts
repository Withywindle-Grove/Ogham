// Timed effects (docs/05 "Exploration follow-ups", X-3; ruled 2026-10-25): using something with a duration makes an
// effect on its targets. Its duration is worked out (formulas use the level; dice the GM enters); concentration and
// "until broken" have no timer and name the caster; permanent is a plain symbol. Each shows as a status symbol and
// on the hour track. Pure.
import { workOut } from '../library/formula.ts';
import { toSeconds, unitName, type TimeUnits } from './clock.ts';

export type Lasting =
  | { kind: 'timed'; seconds: number }
  | { kind: 'concentration' }
  | { kind: 'untilBroken' }
  | { kind: 'permanent' }
  /** Dice in the duration: the GM enters the roll first. */
  | { kind: 'roll'; dice: string; unit: string };

/**
 * A duration as a pack writes it: a number or formula with a unit ({value | formula, unit}), or "concentration",
 * "until broken", "permanent". Null when it can't be read (no timer is guessed).
 */
export function readDuration(duration: unknown, units: TimeUnits, level = 1): Lasting | null {
  if (duration === 'concentration') return { kind: 'concentration' };
  if (duration === 'until broken' || duration === 'untilBroken') return { kind: 'untilBroken' };
  if (duration === 'permanent') return { kind: 'permanent' };
  if (typeof duration !== 'object' || duration === null) return null;
  const d = duration as { value?: unknown; formula?: unknown; unit?: unknown };
  if (typeof d.unit !== 'string' || !units[unitName(d.unit, units)]) return null;
  const unit = unitName(d.unit, units);
  if (typeof d.value === 'number') {
    const seconds = toSeconds({ value: d.value, unit }, units);
    return seconds === null ? null : { kind: 'timed', seconds };
  }
  if (typeof d.formula === 'string') {
    const worked = workOut(d.formula, level);
    if (!worked) return null;
    if (/^\d+$/.test(worked.text)) return { kind: 'timed', seconds: Number(worked.text) * units[unit]! };
    return { kind: 'roll', dice: worked.text, unit };
  }
  return null;
}

export interface Effect {
  id: string;
  name: string;
  /** On the campaign clock; null when it has no timer (concentration, until broken, permanent). */
  endsAt: number | null;
  /** For concentration and "until broken": who keeps it going. */
  caster: string | null;
  /** The time left is the GM's (the pack's durationHidden, or Hide time left). */
  hidden: boolean;
}

/** An effect starting now from what it lasts, or null while a roll is still to be entered. */
export function startEffect(id: string, name: string, lasting: Lasting, now: number, opts: { caster?: string | null; hidden?: boolean } = {}): Effect | null {
  const base = { id, name, caster: opts.caster ?? null, hidden: opts.hidden ?? false };
  if (lasting.kind === 'timed') return { ...base, endsAt: now + lasting.seconds };
  if (lasting.kind === 'roll') return null;
  return { ...base, endsAt: null };
}

/** An effect started from a duration with dice, once the GM enters the roll (whole units). */
export function startRolledEffect(id: string, name: string, lasting: Extract<Lasting, { kind: 'roll' }>, rolled: number, now: number, units: TimeUnits, opts: { caster?: string | null; hidden?: boolean } = {}): Effect | null {
  const seconds = toSeconds({ value: rolled, unit: lasting.unit }, units);
  return seconds === null ? null : { id, name, endsAt: now + seconds, caster: opts.caster ?? null, hidden: opts.hidden ?? false };
}

/** The effects ending in a jump from `from` to `to`. */
export function endingOnJump(effects: readonly Effect[], from: number, to: number): Effect[] {
  return effects.filter((e) => e.endsAt !== null && e.endsAt > from && e.endsAt <= to);
}

/** How full an effect's symbol is (1 at the start, 0 at the end), for the draining ring; null without a timer. */
export function fill(effect: Effect, startedAt: number, now: number): number | null {
  if (effect.endsAt === null || effect.endsAt <= startedAt) return null;
  return Math.max(0, Math.min(1, (effect.endsAt - now) / (effect.endsAt - startedAt)));
}
