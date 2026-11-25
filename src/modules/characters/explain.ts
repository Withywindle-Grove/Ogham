// Tap HP, AC, attack or Level on the sheet for how each is worked out (ruled 2026-10-26, extending CS-8), and an
// ability's modifiers in plain words. Pure: built from what the setting fills in, the class, the race and the XP
// table. Rules-agnostic: every name and number comes from the pack.
import { raceClassLimit } from '../library/classLimits.ts';
import { CantRun, evaluate, ExpressionError, parseExpression } from '../library/expression.ts';
import { showFilled, wasRoundedDown, type Filled } from '../library/fills.ts';
import { rollDie, type RollSides } from '../library/rolls.ts';
import { hpModifierOf } from './guidance.ts';
import { skillOdds } from './skillOdds.ts';
import { columnKinds, modifierCells, signedNumber, type ColumnKind } from './modifierColumns.ts';

type Value = Filled[string];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** "openDoors" → "Open doors"; "hp" → "Hit points"; "ac" → "Armour class" (long names where people read, N23). */
export function plainName(key: string): string {
  if (/^hp$/i.test(key)) return 'Hit points';
  if (/^ac$/i.test(key)) return 'Armour class';
  const words = key.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A number with its sign ("+1", "−2", "+0"); anything else as it is. */
export function signed(value: Value): string {
  if (typeof value === 'number') return value < 0 ? `−${-value}` : `+${value}`;
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.map(signed).join(', ');
  if (isRecord(value)) return Object.entries(value).map(([k, v]) => `${plainName(k).toLowerCase()} ${signed(v as Value)}`).join(', ');
  return String(value);
}

/**
 * An ability's row, one plain line each: "Melee: +1", "Open doors: 2-in-6", a value column unsigned ("Loyalty: 7");
 * a zero modifier left out (gate walk 2026-11-05, bug 3: the same reader as the Scores step's tiles).
 */
export function abilityLines(row: Value, kinds: Readonly<Record<string, ColumnKind>> = {}): string[] {
  if (!isRecord(row)) return row === null || row === undefined ? [] : [signed(row)];
  const cells = new Map(modifierCells(row, kinds).map((cell) => [cell.column, cell]));
  return Object.entries(row).flatMap(([key, value]) => {
    // A number or text goes through the shared reader (a zero modifier has no cell); any other shape as before.
    if (typeof value === 'number' || typeof value === 'string') {
      const cell = cells.get(key);
      if (!cell) return [];
      return [`${plainName(key)}: ${cell.kind === 'modifier' ? signedNumber(cell.value as number) : String(cell.value)}`];
    }
    return [`${plainName(key)}: ${signed(value as Value)}`];
  });
}

/** Every ability row's entries whose key matches, as "Melee +1 from Strength". */
function fromAbilities(filled: Filled, match: RegExp, labelOf: (ability: string) => string, nameOf: (key: string) => string = plainName): string[] {
  const lines: string[] = [];
  for (const [name, row] of Object.entries(filled)) {
    if (!name.startsWith('abilityModifiers.') || !isRecord(row)) continue;
    const ability = name.slice('abilityModifiers.'.length);
    for (const [key, value] of Object.entries(row)) {
      if (!match.test(key) || typeof value !== 'number' || value === 0) continue;
      lines.push(`${nameOf(key)} ${signed(value)} from ${labelOf(ability)}`);
    }
  }
  return lines;
}

export const AC_KEY = /^(ac|armou?r ?class)$/i;

export interface Explaining {
  level: number;
  filled: Filled;
  /** The class's and race's pack data, when the character has them. */
  klass: Record<string, unknown> | null;
  klassName: string | null;
  race: Record<string, unknown> | null;
  raceName: string | null;
  /** The class's XP table's pack data, when there is one. */
  xpTable: Record<string, unknown> | null;
  /** An ability key's long name in the setting ("Strength"), else the key. */
  abilityLabel?: (key: string) => string;
}

/**
 * What the scores change in AC, for the AC tile's quiet line, in whole words: the score's long name in the setting,
 * then its figure ("Nimbleness +1"), never "AC" or "from" (A2, plan dec-14-player-audit-fixes row 7a, page 39,
 * approved 2026-11-24; it departs from N23's short names for this tile). A score that adds nothing leaves no line.
 * `longName` is the setting's long name for an ability.
 */
export function acCaption(filled: Filled, longName: (ability: string) => string, direction: 'ascending' | 'descending' = 'ascending'): string {
  // In the setting's direction (ruled 2026-10-29, B9): where lower AC is better, a bonus takes it down.
  const toward = direction === 'ascending' ? filled : flipAc(filled);
  const parts: string[] = [];
  for (const [name, row] of Object.entries(toward)) {
    if (!name.startsWith('abilityModifiers.') || !isRecord(row)) continue;
    const ability = name.slice('abilityModifiers.'.length);
    for (const [key, value] of Object.entries(row)) {
      if (!AC_KEY.test(key) || typeof value !== 'number' || value === 0) continue;
      parts.push(`${longName(ability)} ${signed(value)}`);
    }
  }
  return parts.join(', ');
}

/** The scores' AC modifiers turned round, for a setting where lower AC is better. */
function flipAc(filled: Filled): Filled {
  return Object.fromEntries(
    Object.entries(filled).map(([name, row]) =>
      name.startsWith('abilityModifiers.') && isRecord(row)
        ? [name, Object.fromEntries(Object.entries(row).map(([key, value]) => [key, AC_KEY.test(key) && typeof value === 'number' ? -value : value]))]
        : [name, row],
    ),
  ) as Filled;
}

/**
 * Hit points: the class's hit dice at this level and the score's modifier, in the creation prompt's words. With no hit
 * dice it says nothing about them, and no line on the GM (tfw-2, 2026-11-19; voice rule 16).
 */
export function explainHp(input: Explaining, hp: { current: number | null; max: number | null }): string[] {
  const label = input.abilityLabel ?? ((k: string) => k);
  const lines: string[] = [];
  if (hp.max !== null) lines.push(hp.current !== null && hp.current !== hp.max ? `${hp.current} now, of ${hp.max} at most.` : `${hp.max} at most.`);
  const hitDice = typeof input.filled.hitDice === 'string' ? input.filled.hitDice : text(input.klass?.hitDie);
  const mod = hpModifierOf(input.filled);
  if (hitDice) lines.push(`Hit dice: ${hitDice}${input.klassName ? ` for a ${input.klassName} at level ${input.level}` : ` at level ${input.level}`}.`);
  if (mod && mod.value !== 0) lines.push(`${signed(mod.value)} from ${label(mod.ability)}.`);
  lines.push('Damage and healing change the current number; the most rises when you go up a level.');
  return lines;
}

/** Attack: the class's figure at this level, then what the scores add. */
export function explainAttack(input: Explaining, attackLabel: string): string[] {
  const label = input.abilityLabel ?? ((k: string) => k);
  const lines: string[] = [];
  const attack = input.filled.attack;
  if (attack !== undefined && attack !== null) {
    const shown = typeof attack === 'number' && !/thac0/i.test(attackLabel) ? signed(attack) : String(attack);
    lines.push(`${attackLabel} ${shown}${input.klassName ? ` for a ${input.klassName} at level ${input.level}` : ` at level ${input.level}`}.`);
  }
  lines.push(...fromAbilities(input.filled, /^(melee|missile|ranged|attack|hit|toHit)/i, label));
  if (lines.length === 0) lines.push('Your GM sets it.');
  return lines;
}

/** What `explainFigure` reads beyond `Explaining`: the rules sets, the scores, the refs, and what the race says beside a figure. */
export interface FigureContext {
  rulesSets: readonly Record<string, unknown>[];
  scores: Record<string, number>;
  classRef: string | null;
  raceRef: string | null;
  /** What the race says beside a figure, by fill name (fills.ts raceNotes): "+3 to the roll vs poison". */
  notes?: Readonly<Record<string, string>>;
  /** What the class says beside a figure (its `saveBonus`, cs-7; bonuses.ts saveBonusNotes). */
  classNotes?: Readonly<Record<string, string>>;
  /** The figure's name in the setting's words ("Hark", "Save vs mire"). */
  label: (name: string) => string;
}

const merged = (rulesSets: readonly Record<string, unknown>[]) => Object.assign({}, ...rulesSets) as Record<string, unknown>;
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const shownValue = (value: Value | undefined) => showFilled(value ?? null);

/**
 * Whether a movement formula at this speed leaves a fraction the sheet rounds down (07 "Formulas", 05: shown as
 * "(rounded down)"), worked out as the Movement breakdown does (movement.ts). A pack's own `ceil()`/`floor()` is
 * already whole, so it isn't.
 */
function roundsDown(formula: string, speed: number): boolean {
  try {
    const value = evaluate(parseExpression(formula), { names: { speed } });
    return typeof value === 'number' && Number.isFinite(value) && wasRoundedDown(value);
  } catch (error) {
    if (error instanceof ExpressionError || error instanceof CantRun) return false;
    throw error;
  }
}

/** A value inside a filled row by a dotted name: "abilityModifiers.LORE.magic" is the LORE row's `magic`. */
function inRow(filled: Filled, name: string): Value | undefined {
  const parts = name.split('.');
  for (let cut = parts.length - 1; cut > 0; cut--) {
    let at: unknown = filled[parts.slice(0, cut).join('.')];
    if (at === undefined) continue;
    for (const part of parts.slice(cut)) at = isRecord(at) ? at[part] : undefined;
    return at as Value | undefined;
  }
  return undefined;
}

/** "for a Lantern Warden at level 1" (or "at level 1" without a class). */
const forClass = (input: Explaining) => (input.klassName ? `for a ${input.klassName} at level ${input.level}` : `at level ${input.level}`);

/**
 * A skill rolled the target or higher on one die (tfs-1, 2026-11-19; plan test-feedback-2026-11-19 row C12): the
 * target and the die's sides, for its pop-up's top line, "Succeeds on a 5+," the die's glyph, "roll 1d6".
 */
export interface SkillRoll {
  target: number;
  sides: RollSides;
}

/**
 * Whether a skill's value is rolled the target or higher on one die, and on which (tfs-1), read as `skillOdds` reads
 * it: a skill rolled `equal-or-over` its number on a die the glyph draws; a d6 skill "N in 6" (skillOdds counts its
 * top N faces, so it succeeds on 7 − N or higher: "2-in-6" is "Succeeds on a 5+"); a value written "5+" on a named
 * die. Null for any other kind: a percentage, a value in words, a die the glyph can't draw, a target the die can't
 * reach. Those keep today's top line (⚑ 13 of the plan: the words for a low roll or a percentage are not ruled).
 */
export function skillRoll(value: Value | undefined, die: unknown, rollMode?: unknown): SkillRoll | null {
  const sides = rollDie(die);
  const on = (target: number, of: RollSides | null): SkillRoll | null => (of !== null && Number.isInteger(target) && target >= 1 && target <= of ? { target, sides: of } : null);
  if (rollMode === 'equal-or-over' && typeof value === 'number') return on(value, sides);
  // A d6 skill is decided by skillOdds' own test (the die written "d6", trimmed), so the row's "2-in-6" and the
  // pop-up's "Succeeds on a 5+" never disagree.
  const dieText = typeof die === 'string' ? die.trim() : '';
  const inSix = typeof value === 'string' ? /^(\d+)\s*-?in-?\s*6$/i.exec(value) : null;
  const d6 = dieText === 'd6' && typeof value === 'number' ? value : inSix ? Number(inSix[1]) : null;
  if (d6 !== null) return d6 >= 1 && d6 <= 6 ? on(7 - d6, 6) : null;
  const plus = typeof value === 'string' ? /^(\d+)\+$/.exec(value.trim()) : null;
  return plus ? on(Number(plus[1]), sides) : null;
}

/** A skill's die and roll as the sheet reads them (play.ts skillsOf): everyone's skill its own, else the class's. */
function skillScale(id: string, klass: Record<string, unknown> | null, rulesSets: readonly Record<string, unknown>[]): { die: unknown; rollMode: unknown } {
  const rules = merged(rulesSets);
  const found = (Array.isArray(rules.skills) ? rules.skills : []).find((s) => isRecord(s) && s.id === id);
  const def = isRecord(found) ? found : {};
  const classScale = isRecord(klass?.skills) ? klass.skills : {};
  return { die: def.die ?? classScale.die, rollMode: def.rollMode ?? classScale.rollMode };
}

/** A character's skill, rolled the target or higher on one die, for its pop-up (tfs-1); null for any other kind. */
export function skillRollOf(id: string, input: Explaining, rulesSets: readonly Record<string, unknown>[]): SkillRoll | null {
  const { die, rollMode } = skillScale(id, input.klass, rulesSets);
  return skillRoll(input.filled[`skills.${id}`], die, rollMode);
}

/**
 * A skill's top line in words (tfs-1): "Succeeds on a 5+, roll 1d6" for a skill rolled the target or higher on one
 * die; any other kind keeps today's words, its odds both ways ("Succeeds on 35 or less on d100, 35 in 100"), or the
 * value as the setting gives it. No "+N": nothing in a pack adds a number to a skill's roll yet, and a better target
 * from a class or a kindred is already inside the "5+" (tfs-1).
 */
export function skillTop(skill: { shown: string; odds: string | null }, roll: SkillRoll | null): string {
  return roll ? `Succeeds on a ${roll.target}+, roll 1d${roll.sides}` : (skill.odds ?? `${skill.shown}, as your setting gives it.`);
}

/**
 * How a worked-out figure on the full sheet is worked out (ct3-9, ruled 2026-11-03: every worked-out figure is
 * tappable and opens its own breakdown), one plain line each, by its fill name: a save, the attack figure, hit dice,
 * a title or spell slots from the class at this level; a save modifier's ability and race parts; a movement figure
 * from the speed; an ability's row from its score. A skill says only what succeeds and what to roll, its top line
 * (tfs-1, 2026-11-19: nothing on where its number comes from, from the rules set, the class or the kindred). Never
 * empty: what the rules give without saying how reads "Your setting's rules give this". What the race says beside the
 * figure comes last ("Stone kin: +3 to the roll vs poison."), except on a skill.
 */
export function explainFigure(name: string, input: Explaining, ctx: FigureContext): string[] {
  // A dotted name reaches into a row ("abilityModifiers.LORE.magic").
  const value = input.filled[name] ?? inRow(input.filled, name);
  const label = input.abilityLabel ?? ((k: string) => k);
  const [head, key = ''] = name.split(/\.(.*)/s) as [string, string?];
  const rules = merged(ctx.rulesSets);
  const lines: string[] = [];
  const shown = shownValue(value);
  if (head === 'saves' || head === 'attack' || head === 'thac0' || head === 'hitDice' || head === 'title' || head === 'spellSlots') {
    lines.push(`${ctx.label(name)} ${shown} ${forClass(input)}.`);
  } else if (head === 'skills' && key) {
    // What succeeds and what to roll, and nothing else (tfs-1): not the rules set's, the class's or the kindred's
    // number, not which one counts, not the kindred's words beside it (they show under the skill's name on its row).
    const { die, rollMode } = skillScale(key, input.klass, ctx.rulesSets);
    const { shown: inStyle, odds } = skillOdds(value ?? null, die, rollMode);
    return [skillTop({ shown: inStyle, odds }, skillRoll(value, die, rollMode))];
  } else if (head === 'saveModifiers' && key) {
    const mod = (Array.isArray(rules.saveModifiers) ? rules.saveModifiers : []).find((s) => isRecord(s) && s.id === key);
    const spec = isRecord(mod) && isRecord(mod.value) ? mod.value : {};
    // The shapes in the order the reader takes them (ruleFills, fills.ts): fill, then raceField (pf-21), then from, so a
    // value carrying two is explained as it was filled.
    if (typeof spec.fill === 'string') lines.push(`${ctx.label(name)} ${shown}: the same as ${ctx.label(spec.fill)}.`);
    else if (typeof spec.raceField === 'string') {
      // The kindred's field alone (pf-21): a whole number other than nought, as the reader takes it.
      const own = num(input.race?.[spec.raceField]);
      if (own !== null && Number.isInteger(own) && own !== 0) lines.push(`${signed(own)} from ${input.raceName ?? 'your race'}.`, `${ctx.label(name)} ${shown} in all.`);
    } else if (typeof spec.from === 'string') {
      const row = input.filled[`abilityModifiers.${spec.from}`];
      const field = typeof spec.plusRaceField === 'string' ? spec.plusRaceField : '';
      const numbers = isRecord(row) ? Object.values(row).filter((v): v is number => typeof v === 'number') : [];
      const base = isRecord(row) && field && typeof row[field] === 'number' ? (row[field] as number) : numbers.length === 1 ? numbers[0]! : null;
      const score = ctx.scores[spec.from];
      if (base !== null) lines.push(`${signed(base)} from ${label(spec.from)}${score !== undefined ? ` ${score}` : ''}.`);
      const extra = field ? num(input.race?.[field]) : null;
      if (field && extra !== null && extra !== 0) lines.push(`${signed(extra)} from ${input.raceName ?? 'your race'}.`);
      if (lines.length > 0) lines.push(`${ctx.label(name)} ${shown} in all.`);
    }
    if (isRecord(mod) && typeof mod.notes === 'string' && mod.notes.trim()) lines.push(mod.notes.trim());
  } else if (head === 'movement') {
    const speed = num(input.filled['movement.speed']);
    const raceSpeed = num(input.race?.speed);
    const speedLine = speed === null ? '' : raceSpeed !== null ? `Speed ${speed}: ${input.raceName ?? 'your race'}'s own.` : `Speed ${speed}: the base speed for everyone in your setting.`;
    const movement = isRecord(rules.movement) ? rules.movement : {};
    const formula = key ? movement[key] : undefined;
    const words = typeof formula === 'string' ? formula : isRecord(formula) && typeof formula.formula === 'string' ? formula.formula : '';
    if (speedLine) lines.push(speedLine);
    if (key && key !== 'speed' && words && /\bspeed\b/.test(words) && speed !== null) {
      const unit = isRecord(formula) && typeof formula.unit === 'string' ? ` ${formula.unit}` : '';
      lines.push(`${ctx.label(name)}: ${words.replace(/\*/g, '×')} = ${shown}${unit}${roundsDown(words, speed) ? ' (rounded down)' : ''}.`);
    }
    if (!speedLine && !key && value !== undefined) lines.push(`${shown}: your setting's rules give this.`);
  } else if (head === 'abilityModifiers' && key) {
    const [ability = key] = key.split('.');
    const score = ctx.scores[ability];
    lines.push(`From ${label(ability)}${score !== undefined ? ` ${score}` : ''}: ${key.includes('.') ? shown : abilityLines(value ?? null, columnKinds(ctx.rulesSets)).join(', ') || shown}.`);
  }
  if (lines.length === 0) lines.push(`${ctx.label(name)} ${shown}: your setting's rules give this${input.klassName ? ` for a ${input.klassName} at level ${input.level}` : ''}.`);
  const note = ctx.notes?.[name];
  if (note) lines.push(`${input.raceName ?? 'Your race'}: ${note}.`);
  const classNote = ctx.classNotes?.[name];
  if (classNote) lines.push(`${input.klassName ?? 'Your class'}: ${classNote}.`);
  return lines;
}

/**
 * A skill's pop-up in words (sr-2, bq-2; tfs-1, 2026-11-19): its top line (`skillTop`), then whether the GM rolls it.
 * Nothing on where its number comes from. The same lines on the full sheet and the Player screen; the pack's own text
 * and the source follow them (SkillSheet).
 */
export function skillLines(skill: { shown: string; odds: string | null; gmRolls: boolean }, roll: SkillRoll | null): string[] {
  return [skillTop(skill, roll), ...(skill.gmRolls ? ['Your GM rolls this one secretly and tells you what happens.'] : [])];
}

/** Level: the XP for the next one, and the highest this class (and race) can reach. */
export function explainLevel(input: Explaining): string[] {
  const lines = [`Level ${input.level}${input.klassName ? ` ${input.klassName}` : ''}.`];
  const rows = (Array.isArray(input.xpTable?.levels) ? input.xpTable.levels : []).filter(isRecord);
  const next = rows.find((r) => r.level === input.level + 1);
  if (next && typeof next.xp === 'number') lines.push(`Level ${input.level + 1} at ${next.xp.toLocaleString('en')} XP.`);
  const classMax = typeof input.klass?.maxLevel === 'number' ? input.klass.maxLevel : null;
  const raceMax = typeof input.klass?.id === 'string' ? raceClassLimit(input.race, input.klass.id).maxLevel : null;
  if (raceMax !== null && (classMax === null || raceMax < classMax)) lines.push(`A ${input.raceName ?? 'character of this race'} goes no higher than level ${raceMax} as a ${input.klassName ?? 'member of this class'}.`);
  else if (classMax !== null) lines.push(`The highest level is ${classMax}.`);
  if (input.level >= (raceMax ?? classMax ?? Infinity)) lines.push('This is the highest level.');
  return lines;
}
