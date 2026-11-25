// A save's working (plan dec-15-save-bonus, rows 1 and 2; ruled 2026-11-25, design/rulings/dec-save-bonus-in-number-
// 2026-11-24.md; 05, "Save bonuses in the number"). The one place a save's number is worked out: the tile, the
// heading's line and the save's sheet read this and do no sums of their own (from batch B on; nothing reads it yet).
//
//  - The class's number at this level is the save's filled figure (`saves.<key>`).
//  - Always holds, counted into the figure (S1, S2): a `saveBonus` with no condition, the "otherwise" part of a list
//    ("+4 vs venom, +2 otherwise"), a `saveBonusByCon` entry that names a whole save. A row each, with the number
//    after it, in the order: the kindred's by Constitution, the kindred's, the class's.
//  - Holds at times on this save: a `saveBonus` with a condition, a `saveBonusByCon` entry for part of a save. One
//    row a condition, its sources summed (ruling 6), with the number to roll then. Beside an "otherwise" in the same
//    list, only the difference is added ("+2 more vs venom").
//  - Every save has at times: each `saveModifiers` entry, with its parts (a score's, the kindred's, or the rules
//    set's own number) and the number then; an entry that gives nothing is left out.
//  - The direction is `rolls.save` (rolls.ts rollInForce): a bonus lowers the number where a high roll succeeds and
//    raises it where a low roll succeeds. With no `rolls.save`, or a save that is not a whole number, nothing.
//  - A bonus of 0 gives no row (S4).
//  - The stops (row 2): the easy end is the die's lowest face (the highest where low rolls succeed); a row past it
//    shows the stop and is marked with the stop's number, a row landing on it exactly is not. The hard end has no stop
//    by default: the worked number as it is, for the figure and the at-times numbers alike (ruling 1). Both are
//    parameters, so the pack's flags (row 8, held) only pass other numbers. The running sum is never clamped: only
//    each number shown is.
//
// Pure; every name and number comes from the pack.
import { conSaveBonus, saveKeyOf } from '../library/fills.ts';
import { rollInForce, type RollPass } from '../library/rolls.ts';
import { isOtherwise, saveBonusesOn } from './bonuses.ts';
import { saveModifierEntries, saveModifierName, saveModifierParts, type SaveModifierInput } from './play.ts';

/** Where a part of a bonus comes from: the kindred, the class, a score, or the rules set's own number. */
export type SaveSourceKind = 'kindred' | 'class' | 'score' | 'rule';

/** One part of a bonus: how much (in the book's sign), and who gives it. */
export interface SavePart {
  bonus: number;
  /** "Bog folk", "Lantern Warden", "Lore"; null for a number the rules set gives itself. */
  from: string | null;
  kind: SaveSourceKind;
  /** The part beyond an "otherwise" in the same list ("+4 vs venom, +2 otherwise": 2 more vs venom). */
  more: boolean;
}

/** A counted row: one bonus that always holds, and the number after it. */
export interface CountedRow extends SavePart {
  number: number;
  /** The stop's number when the stop held this row back, else null. */
  held: number | null;
}

/** A bonus that holds at times on this save: its condition, its parts (one row for one condition), the number then. */
export interface AtTimesRow {
  /** The condition as the pack words it, without a leading "vs" ("venom"). */
  condition: string;
  parts: SavePart[];
  bonus: number;
  number: number;
  held: number | null;
}

/** A bonus every save has at times (`saveModifiers`): the entry, its parts, the number then. */
export interface SharedRow {
  id: string;
  name: string;
  appliesWhen: string;
  parts: SavePart[];
  bonus: number;
  number: number;
  held: number | null;
}

/** A save's working: the class's number, each counted row, the figure, and what holds at times. */
export interface SaveWorking {
  key: string;
  die: string;
  sides: number;
  pass: RollPass;
  /** The class's number at this level (the save's filled figure). */
  base: number;
  /** The class's name; null for a character with no class (its sheet leaves the class's row out, ruling 11). */
  className: string | null;
  counted: CountedRow[];
  /** The number to roll: the last counted row's, else the base. */
  figure: number;
  atTimes: AtTimesRow[];
  shared: SharedRow[];
  stops: { easy: number; hard: number | null };
}

/** Where the number stops (row 2): the easy end, and the hard end (null: no stop, the worked number). */
export interface SaveStops {
  easy?: number;
  hard?: number | null;
}

export interface SaveWorkingInput extends SaveModifierInput {
  stops?: SaveStops;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
/** A save's filled figure as a whole number: a number, or digits as text; else null ("—"). */
const wholeOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : typeof value === 'string' && /^\s*-?\d+\s*$/.test(value) ? Number(value) : null;
/** A condition without its leading "vs" ("Vs venom" → "venom"). */
const bare = (condition: string) => condition.replace(/^vs\.?\s+/i, '').trim();

/** The working of one save for one character, or null when nothing can be counted. */
export function saveWorking(saveKey: string, input: SaveWorkingInput): SaveWorking | null {
  const roll = rollInForce(input.rulesSets, 'save');
  const base = wholeOf(input.filled[`saves.${saveKey}`]);
  if (!roll || base === null) return null;
  const lowers = roll.pass === 'atOrOver';
  const easy = input.stops?.easy ?? (lowers ? 1 : roll.sides);
  const hard = input.stops?.hard ?? null;
  // The number a bonus gives, from a sum not yet stopped.
  const move = (n: number, bonus: number) => (lowers ? n - bonus : n + bonus);
  const shown = (n: number): { number: number; held: number | null } => {
    if (lowers ? n < easy : n > easy) return { number: easy, held: easy };
    if (hard !== null && (lowers ? n > hard : n < hard)) return { number: hard, held: hard };
    return { number: n, held: null };
  };

  const kindred = input.raceName ?? 'your kindred';
  const klass = input.className ?? 'your class';
  const always: SavePart[] = [];
  const atTimes: { condition: string; parts: SavePart[] }[] = [];
  const addAtTimes = (condition: string, part: SavePart) => {
    const found = atTimes.find((r) => r.condition.toLowerCase() === condition.toLowerCase());
    if (found) found.parts.push(part);
    else atTimes.push({ condition, parts: [part] });
  };

  // The kindred's bonus by its Constitution row: whole saves always, "F(marsh-rot)" at times.
  const byCon = conSaveBonus(input.race, input.scores);
  const table = isRecord(input.race?.saveBonusByCon) ? input.race.saveBonusByCon : null;
  if (byCon && table && Array.isArray(table.saves)) {
    for (const s of table.saves.filter((x): x is string => typeof x === 'string' && x.trim() !== '')) {
      const { key, against } = saveKeyOf(s);
      if (key !== saveKey) continue;
      const part: SavePart = { bonus: byCon, from: kindred, kind: 'kindred', more: false };
      if (against) addAtTimes(bare(against), part);
      else always.push(part);
    }
  }
  // The kindred's and the class's `saveBonus`, each list read on its own for its "otherwise".
  for (const [entry, from, kind] of [
    [input.race, kindred, 'kindred'],
    [input.klass, klass, 'class'],
  ] as const) {
    const bonuses = saveBonusesOn(entry, saveKey);
    const otherwise = bonuses.filter((b) => isOtherwise(b.against)).reduce((sum, b) => sum + b.bonus, 0);
    for (const b of bonuses) {
      if (b.against === null || isOtherwise(b.against)) {
        always.push({ bonus: b.bonus, from, kind, more: false });
        continue;
      }
      const bonus = b.bonus - otherwise;
      if (bonus !== 0) addAtTimes(bare(b.against), { bonus, from, kind, more: otherwise !== 0 });
    }
  }

  let sum = base;
  const counted = always.map((part): CountedRow => {
    sum = move(sum, part.bonus);
    return { ...part, ...shown(sum) };
  });
  const total = sum;
  const summed = (parts: readonly SavePart[]) => parts.reduce((n, p) => n + p.bonus, 0);

  const shared = saveModifierEntries(input.rulesSets).flatMap((m): SharedRow[] => {
    const own = typeof m.value === 'number' && Number.isInteger(m.value) ? m.value : typeof m.modifier === 'number' && Number.isInteger(m.modifier) ? m.modifier : null;
    const parts: SavePart[] =
      own !== null ? (own !== 0 ? [{ bonus: own, from: null, kind: 'rule', more: false }] : []) : saveModifierParts(m, input).map((p) => ({ ...p, more: false }));
    const bonus = summed(parts);
    if (bonus === 0) return [];
    return [{ id: text(m.id), name: saveModifierName(m), appliesWhen: text(m.appliesWhen), parts, bonus, ...shown(move(total, bonus)) }];
  });

  return {
    key: saveKey,
    die: roll.die,
    sides: roll.sides,
    pass: roll.pass,
    base,
    className: input.klass ? input.className : null,
    counted,
    figure: shown(total).number,
    atTimes: atTimes.flatMap((r) => {
      const bonus = summed(r.parts);
      return bonus === 0 ? [] : [{ condition: r.condition, parts: r.parts, bonus, ...shown(move(total, bonus)) }];
    }),
    shared,
    stops: { easy, hard },
  };
}
