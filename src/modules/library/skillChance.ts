// Comparing skills written on different scales (ex-3, ga-4; ruled 2026-11-03): an activity whose `chance.skill` is a
// list counts the best skill the character has, and a skill's `fill: { best: ["base", { classSkill }] }` shows the
// better of the general chance and the class's own. One rule serves both: each value becomes its chance of success
// (whole faces of whole sides, never a fraction), and the highest counts; on a tie the first listed. A value whose
// chance can't be told from the pack's notation is passed over, never guessed. Pure.

/** A chance of success as whole numbers: `hits` faces of `sides` ("2 in 6" is { hits: 2, sides: 6 }). */
export interface SkillChance {
  hits: number;
  sides: number;
}

/** How a skill is rolled, as the pack says: its `die` ("d6", "%", "d% (… on d6 …)") and `rollMode`. */
export interface SkillScale {
  die?: unknown;
  rollMode?: unknown;
}

const dieText = (die: unknown) => (typeof die === 'string' ? die.trim() : '');
/** A plain die ("d6", "d20") as its sides; null for anything else. */
const plainSides = (die: unknown): number | null => {
  const m = /^d(\d+)$/i.exec(dieText(die));
  return m ? Number(m[1]) : null;
};
const isPercent = (die: unknown) => /^d?%/i.test(dieText(die));
const whole = (n: number) => Number.isInteger(n) && n >= 0;

/**
 * A skill value's chance of success, or null when the notation doesn't say: an `equal-or-over` target ("5", "5+")
 * on its die; a number on a plain die (x-in-N); "2-in-6"; a run of faces ("1-2", counted on the die, or on a d6 when
 * the die's words name one); a percentage (a number on a "%" die, or "35%").
 */
export function successChance(value: unknown, scale: SkillScale): SkillChance | null {
  const sides = plainSides(scale.die);
  const text = typeof value === 'string' ? value.trim().replace(/–/g, '-') : '';
  const plus = /^(\d+)\+$/.exec(text);
  if ((scale.rollMode === 'equal-or-over' && typeof value === 'number') || plus) {
    const target = typeof value === 'number' ? value : Number(plus![1]);
    if (sides === null || !whole(target)) return null;
    return { hits: Math.min(sides, Math.max(0, sides - target + 1)), sides };
  }
  const inN = /^(\d+)\s*-?\s*in\s*-?\s*(\d+)$/i.exec(text);
  if (inN) return Number(inN[2]) > 0 ? { hits: Math.min(Number(inN[1]), Number(inN[2])), sides: Number(inN[2]) } : null;
  const run = /^(\d+)\s*-\s*(\d+)$/.exec(text);
  if (run) {
    const runSides = sides ?? (/\bd6\b/i.test(dieText(scale.die)) ? 6 : null);
    const [lo, hi] = [Number(run[1]), Number(run[2])];
    if (runSides === null || lo < 1 || hi < lo || hi > runSides) return null;
    return { hits: hi - lo + 1, sides: runSides };
  }
  const percent = /^(\d+)%$/.exec(text);
  if (percent) return { hits: Math.min(100, Number(percent[1])), sides: 100 };
  if (typeof value === 'number' && whole(value)) {
    if (isPercent(scale.die)) return { hits: Math.min(100, value), sides: 100 };
    if (sides !== null) return { hits: Math.min(sides, value), sides };
  }
  return null;
}

/** Which chance is higher: above 0 when `a` is, below 0 when `b` is, 0 when they're the same. */
export const compareChance = (a: SkillChance, b: SkillChance) => a.hits * b.sides - b.hits * a.sides;

/**
 * Of several candidates, the one with the highest chance of success; on a tie the first. Those whose chance
 * can't be told are passed over; null when none can.
 */
export function bestSkill<T>(candidates: readonly T[], chanceOf: (candidate: T) => SkillChance | null): T | null {
  let best: { candidate: T; chance: SkillChance } | null = null;
  for (const candidate of candidates) {
    const chance = chanceOf(candidate);
    if (chance && (!best || compareChance(chance, best.chance) > 0)) best = { candidate, chance };
  }
  return best ? best.candidate : null;
}

/**
 * A chance written on a skill's own scale, for a class's skill standing in for a general one (ga-4): an
 * `equal-or-over` target, an x-in-N count, or a percentage. Null when it doesn't land on a whole face.
 */
export function onScale(chance: SkillChance, scale: SkillScale): number | null {
  const sides = isPercent(scale.die) ? 100 : plainSides(scale.die);
  if (sides === null || (chance.hits * sides) % chance.sides !== 0) return null;
  const hits = (chance.hits * sides) / chance.sides;
  return scale.rollMode === 'equal-or-over' ? sides - hits + 1 : hits;
}
