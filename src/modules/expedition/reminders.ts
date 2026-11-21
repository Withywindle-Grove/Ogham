// What sets reminders going on the campaign clock besides the mode's own procedure (docs/05 "Expeditions, time and
// light"; 07 "Rule hooks" and "Charges"; ruled 2026-10-24 and 2026-10-29, D31): the GM's own reminders (made any
// time, even mid-session; a reminder, or a check with Hit / Miss, maybe an Encounter check; public or the GM's only),
// the setting's remind hooks (turnAdvanced, every N), and items that recharge on a timer ("<item> recharges today",
// one tap to confirm, never silent). Each becomes a Schedule the procedure counts per clock jump. Pure.
import { testHolds, type Value } from '../library/expression.ts';
import { toSeconds, unitName, type Amount, type TimeUnits } from './clock.ts';
import type { Chance } from './modes.ts';
import { amountOf, chanceOf } from './modes.ts';
import type { Schedule } from './schedule.ts';

/** A reminder the GM made (one row of `reminders`). */
export interface ReminderSpec {
  id: string;
  label: string;
  kind: 'reminder' | 'check';
  encounterCheck: boolean;
  every: Amount;
  /** When it was set going, on the campaign clock (seconds). */
  anchor: number;
  active: boolean;
  /** Players see it in their reference list; otherwise it never reaches their devices. */
  isPublic: boolean;
  /** A check's chance ("1 in 6"), when the GM gave one; null: the GM judges at the table. */
  chance: Chance | null;
  /** The table a hit rolls, when the GM named one. */
  tableId: string | null;
  note: string | null;
}

/** What the card needs to know about a schedule beyond when it falls due. */
export interface ScheduleInfo {
  source: 'gm' | 'hook' | 'recharge';
  chance: Chance | null;
  tableId: string | null;
  note: string | null;
  /** recharge: the item line and how much comes back (a number or dice). */
  lineId?: string;
  amount?: string;
}

/** The GM's reminders that run: active ones whose every can be read, on the campaign clock. */
export function reminderSchedules(reminders: readonly ReminderSpec[], units: TimeUnits): (Schedule & { info: ScheduleInfo })[] {
  return reminders.flatMap((r) => {
    const interval = toSeconds({ value: r.every.value, unit: unitName(r.every.unit, units) }, units);
    if (!r.active || !interval || interval <= 0) return [];
    return [
      {
        id: `gm:${r.id}`,
        name: r.label,
        kind: r.kind,
        encounterCheck: r.kind === 'check' && r.encounterCheck,
        anchor: r.anchor,
        interval,
        group: 'gm' as const,
        public: r.isPublic,
        info: { source: 'gm' as const, chance: r.chance, tableId: r.tableId, note: r.note },
      },
    ];
  });
}

/** "{expedition.mode}" and the like, from the event's names; an unknown placeholder shows as blank (07). */
export function fillMessage(message: string, names: Record<string, Value>): string {
  return message
    .replace(/\{([A-Za-z0-9_.]+)\}/g, (_, path: string) => {
      let at: Value | undefined = names;
      for (const part of path.split('.')) at = at && typeof at === 'object' && !Array.isArray(at) ? (at as Record<string, Value>)[part] : undefined;
      return typeof at === 'string' || typeof at === 'number' ? String(at) : '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export interface HookRun {
  schedules: (Schedule & { info: ScheduleInfo })[];
  /** Hooks whose test couldn't be worked out: skipped, never guessed (07); the GM sees their ids. */
  skipped: string[];
}

/**
 * The setting's remind hooks on the clock (07, remind hooks switch on in M5): `when: "turnAdvanced"` with `every`
 * repeats from the expedition's start (from the clock's 0 outside one); one with no `every` comes due once per
 * clock jump, as a step of the mode would. A test that doesn't hold leaves the hook out. `lightBurning` hooks wait
 * for lights (M5 step 7).
 */
export function hookSchedules(
  hooks: readonly Record<string, unknown>[],
  ctx: { units: TimeUnits; stepSeconds: number | null; startedAt: number | null; mode: string | null; flags?: Record<string, Value> },
): HookRun {
  const names: Record<string, Value> = {
    campaign: { flags: ctx.flags ?? {} },
    expedition: ctx.mode ? { mode: ctx.mode } : null,
  };
  const skipped: string[] = [];
  const schedules = hooks.flatMap((hook, i) => {
    if (hook.kind !== 'remind' || hook.when !== 'turnAdvanced' || typeof hook.message !== 'string') return [];
    const id = typeof hook.id === 'string' && hook.id ? hook.id : `remind-${i + 1}`;
    if (typeof hook.test === 'string' && hook.test.trim()) {
      const holds = testHolds(hook.test, { names });
      if (holds === null) {
        skipped.push(id);
        return [];
      }
      if (!holds) return [];
    }
    const every = amountOf(hook.every);
    const interval = every ? toSeconds({ value: every.value, unit: unitName(every.unit, ctx.units) }, ctx.units) : ctx.stepSeconds;
    if (!interval || interval <= 0) return [];
    return [
      {
        id: `hook:${id}`,
        name: fillMessage(hook.message, names) || id,
        kind: 'reminder' as const,
        anchor: ctx.startedAt ?? 0,
        interval,
        group: 'gm' as const,
        info: { source: 'hook' as const, chance: null, tableId: null, note: null },
      },
    ];
  });
  return { schedules, skipped };
}

/** An item that recharges on a timer: its line and its own `recharge` { amount, every }. */
export interface Recharging {
  lineId: string;
  name: string;
  recharge: unknown;
}

/** "every": { value, unit } or a plain unit ("day"). */
function everyOf(value: unknown): Amount | null {
  if (typeof value === 'string' && value.trim()) return { value: 1, unit: value.trim() };
  return amountOf(value);
}

/**
 * Timed recharge (07 "Charges", M5): each item with `recharge { amount, every }` comes due on the clock from its
 * start ("<item> recharges today" for a day), for the GM to confirm with one tap. Items without a readable `every`
 * or `amount` are left out.
 */
export function rechargeSchedules(items: readonly Recharging[], units: TimeUnits): (Schedule & { info: ScheduleInfo })[] {
  return items.flatMap((item) => {
    const recharge = item.recharge && typeof item.recharge === 'object' ? (item.recharge as Record<string, unknown>) : null;
    const every = recharge ? everyOf(recharge.every) : null;
    const amount = recharge && (typeof recharge.amount === 'number' || typeof recharge.amount === 'string') ? String(recharge.amount).trim() : '';
    const interval = every ? toSeconds({ value: every.value, unit: unitName(every.unit, units) }, units) : null;
    if (!every || !amount || !interval || interval <= 0) return [];
    const when = every.value === 1 ? (unitName(every.unit, units) === 'day' ? 'today' : `this ${unitName(every.unit, units)}`) : `after ${every.value} ${unitName(every.unit, units)}s`;
    return [
      {
        id: `recharge:${item.lineId}`,
        name: `${item.name} recharges ${when}`,
        kind: 'reminder' as const,
        anchor: 0,
        interval,
        group: 'gm' as const,
        info: { source: 'recharge' as const, chance: null, tableId: null, note: null, lineId: item.lineId, amount },
      },
    ];
  });
}

/** A chance the GM types for a check reminder ("1 in 6", "1-2 in 6", "1, 2 on d6"); null when it can't be read. */
export function chanceTyped(typed: string): Chance | null {
  const plain = typed.trim().toLowerCase();
  const inForm = /^(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:in|on|of)\s*(?:a\s*)?d?(\d+)$/.exec(plain);
  if (inForm) {
    const from = Number(inForm[2] ? inForm[1] : 1);
    const to = Number(inForm[2] ?? inForm[1]);
    const sides = Number(inForm[3]);
    if (sides < 2 || to > sides || from < 1 || from > to) return null;
    return { die: `d${sides}`, on: Array.from({ length: to - from + 1 }, (_, i) => from + i) };
  }
  return null;
}

/** A chance as the GM types it back ("1-2 in 6"); empty for none. */
export function chanceTypedBack(chance: Chance | null): string {
  if (!chance || chance.on.length === 0 || !chance.die) return '';
  const on = [...chance.on].sort((a, b) => a - b);
  const sides = chance.die.replace(/^d/i, '');
  const run = on.every((f, i) => i === 0 || f === on[i - 1]! + 1);
  if (!run) return '';
  if (on[0] === 1) return `${on[on.length - 1]} in ${sides}`;
  return `${on[0]}-${on[on.length - 1]} in ${sides}`;
}

/** A stored chance ({ die, on }), read leniently. */
export const storedChance = (value: unknown): Chance | null => chanceOf(value);
