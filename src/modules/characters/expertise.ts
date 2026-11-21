// Expertise points (G-208, ex-1, ex-2, ex-8; design/rulings/g208-expertise-points-2026-11-20.md; docs/07 "Point-buy
// skills", 04 PC extras `expertise`). A class's `skills.points: { atStart, perLevel, base, best, name? }`, in force
// when the campaign's option puts it on the class (the class's `byOption`, or a `patches[]` entry on another pack's
// class; both already merged into the class the setting reads, campaignSetting.ts). Every class skill starts at
// `base`; each point moves one skill one step toward `best` and never past it: up for an x-in-6 skill, down for an
// equal-or-over one (the skill's own `rollMode`, else the class's). The character has `atStart + perLevel × (level − 1)`
// points; what it spent is saved on `actors.expertise`, `{ "<skill code>": <points ≥ 1> }` (a skill with no points
// has no key). Spent like weapon skills (m5b-0 §2): before approval freely; after it the owner only adds (the database
// holds that), and the GM moves points. Pure; imports nothing, so the fills (library/fills.ts) can read it.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/** The step's title and the sheet's line when the pack gives no `name` (ex-1, the ruling's Technical: Name). */
export const POINTS_NAME = 'Skill points';

/** A class's `skills.points`, read: every figure a whole number, the counts never below nought. */
export interface PointsRule {
  atStart: number;
  perLevel: number;
  base: number;
  best: number;
  /** The pack's word ("Expertise"), else "Skill points". */
  name: string;
}

/** Which way a point moves a skill: up for x-in-6 (more faces), down for equal-or-over (a lower target). */
export type Direction = 'up' | 'down';

/** The points spent, by class skill code; a skill with no points has no key. */
export type Expertise = Record<string, number>;

/**
 * The class's `skills.points` when it is in force and well formed; null otherwise (no points: the class's `byLevel`
 * figures are read as before). A malformed one is not guessed at: `pack:check` names it (scripts/pack-expertise.mjs).
 */
export function pointsRule(klass: Record<string, unknown> | null | undefined): PointsRule | null {
  const skills = klass && isRecord(klass.skills) ? klass.skills : null;
  const points = skills && isRecord(skills.points) ? skills.points : null;
  if (!points) return null;
  const { atStart, perLevel, base, best } = points;
  if (!whole(atStart) || !whole(perLevel) || !whole(base) || !whole(best) || atStart < 0 || perLevel < 0) return null;
  return { atStart, perLevel, base, best, name: text(points.name) || POINTS_NAME };
}

/**
 * The class's own skills that points are spent on, in the class's order: the codes it names (`skills.names`, which a
 * patch may change), else the codes of its `byLevel` rows.
 */
export function classSkillCodes(klass: Record<string, unknown> | null | undefined): string[] {
  const skills = klass && isRecord(klass.skills) ? klass.skills : {};
  if (isRecord(skills.names)) {
    const named = Object.keys(skills.names).filter((code) => code.trim() !== '');
    if (named.length > 0) return named;
  }
  const rows = Array.isArray(skills.byLevel) ? skills.byLevel.filter(isRecord) : [];
  return [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== 'level')))];
}

/**
 * Which way a point moves the skill: the rules set's skill of that id says by its `rollMode` (the highest set first),
 * else the class's `skills.rollMode`; `equal-or-over` is down, anything else up.
 */
export function skillDirection(klass: Record<string, unknown> | null | undefined, code: string, rulesSets: readonly Record<string, unknown>[] = []): Direction {
  for (const rules of [...rulesSets].reverse()) {
    const own = (Array.isArray(rules.skills) ? rules.skills : []).find((s) => isRecord(s) && s.id === code);
    if (isRecord(own) && own.rollMode !== undefined) return own.rollMode === 'equal-or-over' ? 'down' : 'up';
  }
  const skills = klass && isRecord(klass.skills) ? klass.skills : {};
  return skills.rollMode === 'equal-or-over' ? 'down' : 'up';
}

/** The points a character of this level has in all: `atStart + perLevel × (level − 1)` (a level below 1 counts as 1). */
export function pointsAllowed(rule: PointsRule, level: number): number {
  const at = whole(level) && level > 1 ? level : 1;
  return rule.atStart + rule.perLevel * (at - 1);
}

/** The saved points, read: only skill codes with a whole number of at least 1 (anything else is passed over). */
export function readExpertise(value: unknown): Expertise {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([code, points]) => code.trim() !== '' && whole(points) && points >= 1)) as Expertise;
}

/** The points spent on the skills (on `codes` only, when given: points left on a skill the class no longer has don't count). */
export function pointsSpent(expertise: Expertise, codes?: readonly string[]): number {
  return Object.entries(expertise)
    .filter(([code]) => !codes || codes.includes(code))
    .reduce((sum, [, points]) => sum + points, 0);
}

/** The points still to spend at this level; never below nought. */
export function pointsUnspent(rule: PointsRule, level: number, expertise: Expertise, codes?: readonly string[]): number {
  return Math.max(0, pointsAllowed(rule, level) - pointsSpent(expertise, codes));
}

/** How many points a skill can take before it is at its best: none when `best` isn't past `base` that way. */
export function pointsToBest(rule: PointsRule, direction: Direction): number {
  return Math.max(0, direction === 'up' ? rule.best - rule.base : rule.base - rule.best);
}

/** A skill's figure with this many points on it: `base` moved one step a point toward `best`, never past it. */
export function skillFigure(rule: PointsRule, direction: Direction, points: number): number {
  const steps = Math.min(Math.max(0, whole(points) ? points : 0), pointsToBest(rule, direction));
  return direction === 'up' ? rule.base + steps : rule.base - steps;
}

/** Whether another point on the skill would take it past its best ("Work locks is at its best: 4-in-6."). */
export function atItsBest(rule: PointsRule, direction: Direction, points: number): boolean {
  return points >= pointsToBest(rule, direction);
}

/**
 * Whether the owner may take a point back off a skill (ex-2, ex-5): always before approval; after it only a point added
 * since the saved points (`saved`, as on the character before this visit), never one spent before ("Spent before: ask
 * your GM to move it."). The GM may always (Move points). The database holds the same rule (guard_expertise).
 */
export function mayTakeBack(who: { gm: boolean; approved: boolean }, saved: Expertise, now: Expertise, code: string): boolean {
  const on = now[code] ?? 0;
  if (on <= 0) return false;
  if (who.gm || !who.approved) return true;
  return on > (saved[code] ?? 0);
}

/** The points on a skill that were spent before this visit (saved on the character): the ones the owner can't move once approved. */
export function spentBefore(saved: Expertise, code: string): number {
  return saved[code] ?? 0;
}

/**
 * Each class skill's figure as the fills write it (`skills.<code>`), when the class's points are in force; null when
 * they aren't (the class's `byLevel` figures are read as before). A character with no points spent reads `base` on
 * every skill (ex-8: a character the option reaches later starts there and spends its points from To finish).
 */
export function expertiseFigures(
  klass: Record<string, unknown> | null | undefined,
  expertise: Expertise | undefined,
  rulesSets: readonly Record<string, unknown>[] = [],
): Record<string, number> | null {
  const rule = pointsRule(klass);
  if (!rule) return null;
  const spent = expertise ?? {};
  return Object.fromEntries(classSkillCodes(klass).map((code) => [`skills.${code}`, skillFigure(rule, skillDirection(klass, code, rulesSets), spent[code] ?? 0)]));
}
