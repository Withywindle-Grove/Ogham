// The full sheet's Movement section (sr-1, bq-5; ruled 2026-11-04): one section in the pack's words — speed,
// exploring, in a fight, overland — from the same speed travel uses (the load's, `loadSpeed` in the inventory
// module), else the character's own; every other movement figure folds under Speed, one tap away. No raw
// "Movement: <mode>" boxes. Pure; every name and number comes from the pack.
import { evaluate, parseExpression } from '../library/expression.ts';
import { ownSpeed, showFilled, wasRoundedDown, wholeDown, type Filled } from '../library/fills.ts';
import { plainName } from './explain.ts';
import { possessive } from '../../core/nameWords.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** One movement figure: its fill name ("movement.exploration"), the pack's word for it, its value and its breakdown. */
export interface MovementRow {
  key: string;
  label: string;
  value: string;
  lines: string[];
}

export interface Movement {
  /** The speed every figure is worked out from; null when none is known. */
  speed: number | null;
  /** The speed's unit in the pack's words ("ft"), from the load's movement text; empty when unknown or typed by hand. */
  unit: string;
  /** Speed first, then exploring, in a fight and overland, in the layout's order and words where it has them. */
  rows: MovementRow[];
  /** The other movement figures (running, swimming…), folded under Speed. */
  more: MovementRow[];
}

/** The modes the section shows on its own rows when the layout names none: the app's words for them. */
const MAIN: [mode: string, label: string][] = [
  ['exploration', 'Exploring'],
  ['combat', 'In a fight'],
  ['overland', 'Overland'],
];

/** A movement mode's formula and unit: "speed * 3", or `{formula, unit}`; null for words ("slowest member"). */
function formulaOf(spec: unknown): { formula: string; unit: string } | null {
  const formula = typeof spec === 'string' ? spec : isRecord(spec) ? text(spec.formula) : '';
  if (!formula || !/\bspeed\b/.test(formula)) return null;
  return { formula, unit: isRecord(spec) ? text(spec.unit) : '' };
}

/**
 * The Movement section. `load` is the speed the load gives with why (null when no load is tracked); `fields` the
 * layout's fields showing a movement figure (`fill` "movement", "movement.speed" or "movement.<mode>"), whose labels
 * are the pack's words; `typed` what's written on the sheet by hand, by field key.
 */
export function movementOf(input: {
  rulesSets: readonly Record<string, unknown>[];
  race: Record<string, unknown> | null;
  raceName: string | null;
  filled: Filled;
  load: { speed: number | null; why: string; unit?: string } | null;
  fields: readonly { key: string; label: string; fill: string | null }[];
  typed?: Readonly<Record<string, unknown>>;
  /**
   * The character's edited fields (mv-2): when given, a stored movement value counts as written by hand only when its
   * field is marked here; one with no mark is the fill's and follows the rules in force. Omitted, all of `typed` counts.
   */
  edited?: readonly string[];
}): Movement {
  const rules = Object.assign({}, ...input.rulesSets) as Record<string, unknown>;
  const modes = isRecord(rules.movement) ? rules.movement : {};
  const own = ownSpeed(input.rulesSets, input.race);
  const speed = input.load ? input.load.speed : own;
  const raceSpeed = typeof input.race?.speed === 'number';
  const why = input.load ? `from ${input.load.why}` : own === null ? '' : raceSpeed ? `${possessive(input.raceName ?? 'your race')} own` : 'the base speed for everyone in your setting';
  // Each mode the rules set works out from the speed.
  // A figure is shown whole, rounded down (hard rule 8: never more movement than the rule gives); a pack that rounds
  // in its own formula (`ceil(speed / 3)`) is already whole, so its rounding wins.
  const typedOf = (key: string) => {
    if (input.edited && !input.edited.includes(key)) return null;
    const v = input.typed?.[key];
    return v === undefined || v === null || v === '' ? null : String(v);
  };
  // A speed typed by hand and marked, as a whole number, drives every mode (the lead's follow-up to mv-2, 2026-11-14):
  // each worked out from it by the pack's own rule, with the same rounding. Words ("35 ft") leave the modes to the rules.
  const speedField = input.fields.find((f) => /^movement(\.speed)?$/.test(f.fill?.trim() ?? ''));
  const handText = speedField ? typedOf(speedField.key)?.trim() : undefined;
  const handSpeed = handText && /^\d+$/.test(handText) ? Number(handText) : null;
  const figureSpeed = handSpeed ?? speed;
  const figures = new Map<string, { value: number; formula: string; unit: string; roundedDown: boolean }>();
  if (figureSpeed !== null) {
    for (const [mode, spec] of Object.entries(modes)) {
      const f = mode === 'default' ? null : formulaOf(spec);
      if (!f) continue;
      try {
        const value = evaluate(parseExpression(f.formula), { names: { speed: figureSpeed } });
        if (typeof value === 'number' && Number.isFinite(value)) {
          figures.set(mode, { value: wholeDown(value), roundedDown: wasRoundedDown(value), ...f });
        }
      } catch {
        // Words, not a formula: not a figure.
      }
    }
  }
  const words = speed === null && input.filled.movement !== undefined ? showFilled(input.filled.movement) : null;
  const speedRow = (key: string, label: string, fieldKey?: string): MovementRow => {
    const hand = fieldKey ? typedOf(fieldKey) : null;
    const value = hand ?? (speed !== null ? String(speed) : input.load?.why && input.load.speed === null ? input.load.why : (words ?? '—'));
    const lines = [
      ...(hand ? [`${hand} is written on the sheet.`] : []),
      ...(speed !== null ? [`Speed ${speed}: ${why}.`] : input.load ? [`${input.load.why}.`] : words ? [`${words}: your setting's rules give this.`] : ['Your setting gives no speed: your GM says.']),
    ];
    return { key, label, value, lines };
  };
  const modeRow = (mode: string, label: string, fieldKey?: string): MovementRow => {
    const hand = fieldKey ? typedOf(fieldKey) : null;
    const f = figures.get(mode);
    const value = hand ?? (f ? `${f.value}${f.unit ? ` ${f.unit}` : ''}` : '—');
    const lines = [
      ...(hand ? [`${hand} is written on the sheet.`] : []),
      ...(f && figureSpeed !== null ? [handSpeed !== null ? `${handSpeed} is written on the sheet.` : `Speed ${speed}: ${why}.`, `${label}: ${f.formula.replace(/\*/g, '×')} = ${f.value}${f.unit ? ` ${f.unit}` : ''}${f.roundedDown ? ' (rounded down)' : ''}.`] : ['Your setting gives no number for this here.']),
    ];
    return { key: `movement.${mode}`, label, value, lines };
  };
  const rows: MovementRow[] = [];
  const used = new Set<string>();
  // The layout's own movement fields, in its order and words.
  for (const field of input.fields) {
    const fill = field.fill?.trim() ?? '';
    if (fill === 'movement' || fill === 'movement.speed') {
      if (used.has('speed')) continue;
      used.add('speed');
      rows.unshift(speedRow('movement.speed', field.label, field.key));
    } else if (fill.startsWith('movement.')) {
      const mode = fill.slice('movement.'.length);
      // A key the rules set has no mode for (an old layout's `movement.explore`; no alias, ruled B) leaves no blank
      // row: the rules set's own figure shows in the app's words instead.
      if (used.has(mode) || !(mode in modes)) continue;
      used.add(mode);
      rows.push(modeRow(mode, field.label, field.key));
    }
  }
  if (!used.has('speed')) rows.unshift(speedRow('movement.speed', 'Speed'));
  // The usual modes the layout doesn't name, in the app's words.
  for (const [mode, label] of MAIN) {
    if (used.has(mode) || !figures.has(mode)) continue;
    used.add(mode);
    rows.push(modeRow(mode, label));
  }
  const more = [...figures.keys()].filter((mode) => !used.has(mode)).map((mode) => modeRow(mode, plainName(mode)));
  // Speed's breakdown lists the folded figures (sr-1: "Running 120 · Swimming 20 · …", one tap away).
  if (more.length > 0) rows[0] = { ...rows[0]!, lines: [...rows[0]!.lines, ...more.map((m) => `${m.label}: ${m.value}.`)] };
  return { speed: figureSpeed, unit: handSpeed === null && typeof input.load?.speed === 'number' ? (input.load.unit ?? '') : '', rows, more };
}

/** Whether a field holds a movement figure: its fill is `movement` or `movement.<mode>` (the Movement section's own). */
export const isMovementFill = (fill: string | null | undefined) => /^movement(\.|$)/.test(fill?.trim() ?? '');

const blank = (value: unknown) => value === undefined || value === null || value === '' || value === false;

/**
 * The sheet's one-field edit of a field (mv-2): the mark its save sends (`true`: a speed typed by hand), and the one its
 * Undo sends: the mark as it was before, so a filled speed put back by Undo is filled again. Not a speed: no mark.
 */
export function speedEditMarks(fill: string | null | undefined, wasMarked: boolean): { save?: boolean; undo?: boolean } {
  return isMovementFill(fill) ? { save: true, undo: wasMarked } : {};
}

/**
 * The edited fields after a save that sends every field (creation, the draft and sent-back editor; mv-2): a speed
 * field whose value differs from what the screen gave it (`given`: the fill, else nothing) is marked as typed by
 * hand; one left as given keeps its mark as it was; an emptied one loses it. Other fields' marks stay as they are.
 */
export function speedMarks(
  fields: readonly { key: string; fill: string | null }[],
  edited: readonly string[],
  values: Readonly<Record<string, unknown>>,
  given: Readonly<Record<string, unknown>>,
): string[] {
  const out = [...edited];
  for (const field of fields) {
    if (!isMovementFill(field.fill)) continue;
    const value = values[field.key];
    const at = out.indexOf(field.key);
    if (blank(value)) {
      if (at >= 0) out.splice(at, 1);
    } else if (String(value) !== String(given[field.key] ?? '') && at < 0) out.push(field.key);
  }
  return out;
}
