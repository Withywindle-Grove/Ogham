// Lights burning down (docs/05 "Expeditions, time and light"; 07 lightTypes; ruled M5-8, M5-9): a light type's
// duration (a number, or a formula worked out from the caster's level when lit) in its unit, a warning at its
// `warnAt` (by default one step before it runs out), and burnout. "Permanent" lights never run out. Pure: what to do
// at burnout (Light another?, Keep lit, using the item up) is the caller's, from what this says.
import { workOut } from '../library/formula.ts';
import { unitName, type TimeUnits } from './clock.ts';

export interface LightType {
  id: string;
  name: string;
  /** Seconds it burns for; null when permanent. */
  seconds: number | null;
  /** Seconds before running out when it warns; null for no warning. */
  warnSeconds: number | null;
  /** The item is used up when it burns out (`consumed`), or it holds a fuel item that is (`fuel`). */
  consumed: boolean;
  fuel: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A light type from the setting rules, worked out for a caster's level. `duration` is a number or `{formula}` in
 * `unit` (a formula with dice, or one that can't be read, gives null: the GM enters it); "permanent" never runs out.
 * `warnAt` is a number in the same unit, or `{value, unit}`; missing, it warns one step before running out.
 */
export function readLightType(data: Record<string, unknown>, units: TimeUnits, level = 1, stepSeconds?: number): LightType | null {
  const unit = typeof data.unit === 'string' ? (units[unitName(data.unit, units)] ?? null) : null;
  const id = typeof data.id === 'string' ? data.id : '';
  const base = { id, name: typeof data.name === 'string' ? data.name : id, consumed: data.consumed === true, fuel: typeof data.fuel === 'string' ? data.fuel : typeof data.fuelItemId === 'string' ? data.fuelItemId : null };
  if (data.duration === 'permanent') return { ...base, seconds: null, warnSeconds: null };
  if (unit === null) return null;
  let amount: number | null = null;
  if (typeof data.duration === 'number' && Number.isInteger(data.duration) && data.duration > 0) amount = data.duration;
  else if (isRecord(data.duration) && typeof data.duration.formula === 'string') {
    const worked = workOut(data.duration.formula, level);
    amount = worked && /^\d+$/.test(worked.text) ? Number(worked.text) : null;
  }
  if (amount === null) return null;
  const warn = data.warnAt;
  const warnSeconds =
    warn === null
      ? null
      : typeof warn === 'number' && Number.isInteger(warn) && warn >= 0
        ? warn * unit
        : isRecord(warn) && typeof warn.value === 'number' && Number.isInteger(warn.value) && typeof warn.unit === 'string' && units[unitName(warn.unit, units)]
          ? warn.value * units[unitName(warn.unit, units)]!
          : (stepSeconds ?? unit);
  return { ...base, seconds: amount * unit, warnSeconds };
}

export interface Lit {
  id: string;
  /** When it was lit, or last relit, on the campaign clock; and how long it burns from then (null: permanent). */
  litAt: number;
  seconds: number | null;
  warnSeconds: number | null;
}

export interface LightNow {
  /** Seconds left; null when permanent. */
  left: number | null;
  warn: boolean;
  out: boolean;
}

/** A lit light at a moment: time left, warning, out. */
export function lightNow(light: Lit, now: number): LightNow {
  if (light.seconds === null) return { left: null, warn: false, out: false };
  const left = Math.max(0, light.litAt + light.seconds - now);
  return { left, out: left === 0, warn: left > 0 && light.warnSeconds !== null && left <= light.warnSeconds };
}

/** Time left in whole units, rounded up ("2 turns left" while any of the second is left). */
export function leftIn(seconds: number, unitSeconds: number): number {
  return Math.ceil(seconds / unitSeconds);
}

export interface LightOnJump {
  id: string;
  /** It began warning during the jump. */
  warned: boolean;
  /** It ran out during the jump, and when. */
  outAt: number | null;
}

/** What happens to each lit light when the clock jumps from `from` to `to`: a warning starting, burning out. */
export function burnOnJump(lights: readonly Lit[], from: number, to: number): LightOnJump[] {
  return lights.flatMap((light) => {
    if (light.seconds === null || to <= from) return [];
    const end = light.litAt + light.seconds;
    const before = lightNow(light, from);
    if (before.out) return [];
    const after = lightNow(light, to);
    const outAt = end > from && end <= to ? end : null;
    const warned = !before.warn && (after.warn || (outAt !== null && light.warnSeconds !== null && light.warnSeconds > 0));
    return warned || outAt !== null ? [{ id: light.id, warned, outAt }] : [];
  });
}

/** The first lit light to run out from now (the hour track's one light symbol), or null. */
export function firstToRunOut(lights: readonly Lit[], now: number): { id: string; at: number } | null {
  let first: { id: string; at: number } | null = null;
  for (const light of lights) {
    if (light.seconds === null) continue;
    const at = light.litAt + light.seconds;
    if (at > now && (!first || at < first.at)) first = { id: light.id, at };
  }
  return first;
}
