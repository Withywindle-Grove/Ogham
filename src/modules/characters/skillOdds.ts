// A skill's value in the pack's own style, and its odds both ways (CS-5a; sr-2). Its own file so the Player screen's
// skills (play.ts) and a skill's breakdown (explain.ts) write a number the same way without importing each other.
import type { Filled } from '../library/fills.ts';
import { rollDie, type RollSides } from '../library/rolls.ts';

type Value = Filled[string];

const orList = (faces: number[]) => (faces.length === 1 ? String(faces[0]) : `${faces.slice(0, -1).join(', ')} or ${faces[faces.length - 1]}`);

/**
 * A skill value in the pack's style, and its odds both ways (CS-5a; sr-2): a skill rolled `equal-or-over` as its
 * target ("5+", 07), any other d6 skill as "2-in-6", a percentage die ("%", "d%", "d% (…)") as "87%", a value the
 * pack writes in words ("1-2") as it is.
 */
export function skillOdds(value: Value, die: unknown, rollMode?: unknown): { shown: string; odds: string | null } {
  const dieText = typeof die === 'string' ? die.trim() : '';
  if (rollMode === 'equal-or-over' && typeof value === 'number') {
    const chance = dieText === 'd6' && value >= 1 && value <= 6 ? `, ${7 - value} in 6` : '';
    return { shown: `${value}+`, odds: `Succeeds on ${value} or more${chance}` };
  }
  const inSix = typeof value === 'string' ? /^(\d+)\s*-?in-?\s*6$/i.exec(value) : null;
  const d6 = dieText === 'd6' && typeof value === 'number' ? value : inSix ? Number(inSix[1]) : null;
  if (d6 !== null && d6 >= 1 && d6 <= 6) {
    const faces = Array.from({ length: d6 }, (_, i) => 7 - d6 + i);
    return { shown: `${d6}-in-6`, odds: `Succeeds on ${orList(faces)}, ${d6} in 6` };
  }
  const percent = /^d?%/i.test(dieText) && typeof value === 'number' ? value : typeof value === 'string' && /^\d+%$/.test(value) ? Number(value.slice(0, -1)) : null;
  if (percent !== null) return { shown: `${percent}%`, odds: `Succeeds on ${percent} or less on d100, ${percent} in 100` };
  const plus = typeof value === 'string' ? /^(\d+)\+$/.exec(value) : null;
  if (plus) return { shown: value as string, odds: `Succeeds on ${plus[1]} or more` };
  return { shown: value === null || value === undefined ? '—' : String(value), odds: null };
}

/** A skill's figure when it is rolled the target or higher on one die (tfs-3): its words and the die for the glyph. */
export interface TargetFigure {
  /** What is heard and measured: "5+ on d6". */
  words: string;
  /** What comes before the glyph: "5+ on". */
  target: string;
  /** What comes after it: "d6". */
  die: string;
  /** The die's sides, for the glyph. */
  sides: RollSides;
  /** Where the glyph sits in `words`: just after "5+ on " (the List row's `valueMarkAt`). */
  markAt: number;
}

/**
 * The figure of a skill rolled the target or higher on one die (tfs-3, 2026-11-19; plan test-feedback-2026-11-19 row
 * C14): "5+ on", the die's glyph, "d6". `shown` is the skill's value in the pack's style (skillOdds: "5+" for a target)
 * and `sides` the die its chance is read on (Skill.chance). Null for a skill rolled another way ("2-in-6", "35%", a
 * value in words), or on a die the glyph can't draw: that skill keeps the pack's style.
 */
export function targetFigure(shown: string, sides: number | undefined): TargetFigure | null {
  const target = /^(\d+)\+$/.exec(shown.trim());
  const die = sides === undefined ? null : rollDie(`d${sides}`);
  if (!target || die === null) return null;
  const before = `${target[1]}+ on `;
  return { words: `${before}d${die}`, target: before.trimEnd(), die: `d${die}`, sides: die, markAt: before.length };
}
