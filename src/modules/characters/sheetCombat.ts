// The full sheet's Combat tiles (sr-1, sr-8; ruled 2026-11-04): each tile's caption ("1d8 · CON +0", "leather ·
// DEX +0", "Melee +1, Missile +1", "0 / 2,000 XP") and Attack's breakdown, in the campaign's AC style (A4, bq3-13),
// with the to-hit row under descending AC. Pure; every name and number comes from the pack. A breakdown is a list of
// rows, so later work (patches, of-14) can add its own rows ("Damage −1 · bone, <pack>").
import type { Filled } from '../library/fills.ts';
import { AC_KEY, signed } from './explain.ts';
import { hpModifierOf } from './guidance.ts';
import { acNumber, unarmouredAc, type AcDirection, type WornGear } from './play.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const merged = (rulesSets: readonly Record<string, unknown>[]) => Object.assign({}, ...rulesSets) as Record<string, unknown>;
/** A typed figure as a whole number ("+1", "1", "−1", "19"); null for words or anything else. */
const wholeNumber = (text: string): number | null => {
  const t = text.trim().replace(/^−/, '-').replace(/^\+/, '');
  return /^-?\d+$/.test(t) ? Number(t) : null;
};

/** One row of a breakdown: what it is and its number ("Melee · STR +0", "19"). */
export interface BreakdownRow {
  label: string;
  value: string;
}

/** The scores' modifier for an attack kind (`melee`, `missile`): each ability row's number for it, with the ability. */
function scoreModifiers(filled: Filled, kind: string): { ability: string; value: number }[] {
  return Object.entries(filled).flatMap(([name, row]) =>
    name.startsWith('abilityModifiers.') && isRecord(row) && typeof row[kind] === 'number' ? [{ ability: name.slice('abilityModifiers.'.length), value: row[kind] as number }] : [],
  );
}

/** Hit points' caption (sr-1): the class's hit dice at this level and the score's modifier ("1d8 · CON +0"). */
export function hpCaption(filled: Filled, klass: Record<string, unknown> | null, shortName: (ability: string) => string): string {
  const dice = typeof filled.hitDice === 'string' ? filled.hitDice : typeof klass?.hitDie === 'string' ? klass.hitDie : '';
  const mod = hpModifierOf(filled);
  return [dice, mod ? `${shortName(mod.ability)} ${signed(mod.value)}` : ''].filter(Boolean).join(', ');
}

/**
 * AC's caption (sr-1): what's worn that counts (the armour, else "unarmoured"; each shield) and each score's AC
 * modifier in the setting's direction ("leather · DEX +0"); "set by hand" when it is. Empty while what's worn loads.
 */
export function acTileCaption(worn: readonly WornGear[] | null, filled: Filled, shortName: (ability: string) => string, direction: AcDirection, setByHand = false): string {
  if (setByHand) return 'set by hand';
  if (worn === null) return '';
  const armour = worn.find((g) => g.slot === 'armour');
  const parts = [armour ? armour.name : 'unarmoured', ...worn.filter((g) => g.slot === 'shield').map((g) => g.name)];
  for (const [name, row] of Object.entries(filled)) {
    if (!name.startsWith('abilityModifiers.') || !isRecord(row)) continue;
    for (const [key, value] of Object.entries(row)) {
      if (AC_KEY.test(key) && typeof value === 'number') parts.push(`${shortName(name.slice('abilityModifiers.'.length))} ${signed(direction === 'ascending' ? value : -value)}`);
    }
  }
  return parts.join(', ');
}

/** Level's caption (sr-1): the XP and the next level's ("0 / 2,000 XP"); the XP alone at the top or without a table. */
export function levelCaption(xp: number | null, level: number, xpTable: Record<string, unknown> | null): string {
  if (xp === null) return '';
  const rows = (Array.isArray(xpTable?.levels) ? xpTable.levels : []).filter(isRecord);
  const next = num(rows.find((r) => r.level === level + 1)?.xp);
  return next === null ? `${xp.toLocaleString('en')} XP` : `${xp.toLocaleString('en')} / ${next.toLocaleString('en')} XP`;
}

/**
 * Level's caption on the players' standard (plan m5b-players-screens-standard D): the same figures as `levelCaption`
 * in words, "120 of 2,000 experience"; the experience alone at the top or without a table.
 */
export function levelExperience(xp: number | null, level: number, xpTable: Record<string, unknown> | null): string {
  if (xp === null) return '';
  const rows = (Array.isArray(xpTable?.levels) ? xpTable.levels : []).filter(isRecord);
  const next = num(rows.find((r) => r.level === level + 1)?.xp);
  return next === null ? `${xp.toLocaleString('en')} experience` : `${xp.toLocaleString('en')} of ${next.toLocaleString('en')} experience`;
}

/** The attack figure as the sheet shows it, in the campaign's AC style (sr-1, sr-8; A4). */
export interface AttackFigures {
  /** Null when the setting doesn't say which way AC runs: the figure as the class gives it, the old lines (A4). */
  direction: AcDirection | null;
  /** The tile's name: the attack field's with descending AC ("THAC0"), else "Attack" (sr-1, A4). */
  label: string;
  /** "+1" (ascending) or "19" (descending); null when the setting gives none. */
  value: string | null;
  /** "Melee +1, Missile +1": each kind's figure with the score's modifier in it: the totals (from a whole number set by hand when there is one, H1), or the scores' modifiers when the setting names no AC style (tfw-7's capitals). */
  caption: string;
  /** The breakdown, one row each: "Set by hand" when typed, the class's figure at this level, then melee and missile with their modifiers (worked from the figure set by hand, H1). */
  rows: BreakdownRow[];
  /** Descending AC: the d20 roll needed by the target's AC, from the unarmoured AC down to 0; null otherwise. */
  toHit: { ac: number; roll: number }[] | null;
  /** The breakdown's last line: "+1 to the d20 against AC", or where the descending style comes from. */
  ending: string;
}

/**
 * The attack figure, its caption and breakdown (sr-1, sr-8). `typed` is a number written on the sheet by hand, which
 * wins, and the melee and missile totals follow it (H1). Descending AC (A4): the class's target number, which a score's modifier lowers; the to-hit row reads the
 * rules set's `attack.matrix` (the row whose `thac0` is the figure, by `matrixAC`) when it has one, else the figure
 * minus the target's AC. Ascending: the bonus, which a modifier raises.
 */
export function attackFigures(input: {
  filled: Filled;
  direction: AcDirection | null;
  rulesSets: readonly Record<string, unknown>[];
  chosenStyle: string | null;
  /** The attack field's label (shortened), when the layout has one. */
  fieldLabel?: string | null;
  /** A value written on the sheet by hand, if any. */
  typed?: string | null;
  shortName: (ability: string) => string;
  klassName: string | null;
  level: number;
  /** The option that sets the AC style ("Armour class and attacks"), when an option does. */
  styleOption?: string | null;
}): AttackFigures {
  const { filled, direction } = input;
  const descending = direction === 'descending';
  const label = descending || direction === null ? input.fieldLabel || 'Attack' : input.fieldLabel && !/thac0/i.test(input.fieldLabel) ? input.fieldLabel : 'Attack';
  const base = num(filled.attack);
  const show = (n: number) => (direction === null ? String(n) : descending ? acNumber(n) : signed(n));
  const typed = input.typed?.trim() ? input.typed.trim() : null;
  const value = typed ?? (base === null ? (filled.attack === undefined || filled.attack === null ? null : String(filled.attack)) : show(base));
  const rows: BreakdownRow[] = [];
  const caption: string[] = [];
  // tfw-6: a figure typed on the sheet that is the class's own number is not listed twice; one that differs is
  // "Set by hand". Compared as whole numbers, so "+1", "1" and "−1" read as the numbers they are.
  if (typed && (base === null || wholeNumber(typed) !== base)) rows.push({ label: 'Set by hand', value: typed });
  // tfw-7: the kind's word with its capital ("Melee +2, Missile +1"), on the sheet and the Player tab alike ("Back to Missile", 2026-11-25, reversing dec-14 row 7b).
  const kindWord = (kind: string) => `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  if (base !== null && direction === null) {
    // The setting doesn't say which way AC runs: the scores' modifiers as the caption; the pop-up keeps its old lines.
    for (const kind of ['melee', 'missile']) for (const mod of scoreModifiers(filled, kind)) caption.push(`${kindWord(kind)} ${signed(mod.value)}`);
  } else if (base !== null) {
    // H1 ("Follow hand-set", 2026-11-19): a whole number typed on the sheet that differs from the class's is the figure
    // the totals are worked from, in the small line and the pop-up's Melee and Missile rows (⚑ 22: the class's row
    // stays under "Set by hand"; the last line and the to-hit table stay the class's). Words, or anything that is not
    // a whole number, leave the class's figure in force (⚑ 23).
    const typedWhole = typed === null ? null : wholeNumber(typed);
    const figure = typedWhole ?? base;
    rows.push({ label: input.klassName ? `${input.klassName} at level ${input.level}` : `Class at level ${input.level}`, value: show(base) });
    for (const kind of ['melee', 'missile']) {
      for (const mod of scoreModifiers(filled, kind)) {
        const total = descending ? figure - mod.value : figure + mod.value;
        rows.push({ label: `${kindWord(kind)}, ${input.shortName(mod.ability)} ${signed(mod.value)}`, value: show(total) });
        caption.push(`${kindWord(kind)} ${show(total)}`);
      }
    }
  }
  let toHit: AttackFigures['toHit'] = null;
  if (descending && base !== null) {
    const attack = merged(input.rulesSets).attack;
    const top = unarmouredAc(input.rulesSets, input.chosenStyle);
    const matrix = isRecord(attack) && Array.isArray(attack.matrix) ? attack.matrix.filter(isRecord) : [];
    const acs = isRecord(attack) && Array.isArray(attack.matrixAC) ? attack.matrixAC.map(num) : [];
    const row = matrix.find((r) => num(r.thac0) === base);
    const rolls = row && Array.isArray(row.rolls) ? row.rolls.map(num) : [];
    if (row && rolls.length === acs.length && acs.length > 0) {
      const pairs = acs.flatMap((ac, i) => (ac !== null && rolls[i] !== null && ac >= 0 && (top === null || ac <= top) ? [{ ac, roll: rolls[i]! }] : []));
      toHit = pairs.sort((a, b) => b.ac - a.ac);
    } else if (top !== null && top >= 0) {
      toHit = Array.from({ length: top + 1 }, (_, i) => top - i).map((ac) => ({ ac, roll: base - ac }));
    }
    if (toHit && toHit.length === 0) toHit = null;
  }
  const ending = base === null || direction === null ? '' : descending ? `From the rules: descending AC${input.styleOption ? `, the option “${input.styleOption}”` : ''}` : `${signed(base)} to the d20 against AC`;
  return { direction, label, value, caption: caption.join(', '), rows, toHit, ending };
}
