// Fill hooks (docs/07 "Rule hooks"; ruled 2026-10-25): values the setting works out for a character, from its
// scores (abilityModifiers) and its class and level (classProgression), or from a hook's own value expression.
// Each filled value has a name like a hook target: abilityModifiers.<KEY>, saves.<key>, attack, hitDice,
// spellSlots, skills.<code>, title, or a campaign field key. A sheet-layout field linked with `fill` shows one;
// the rest show in "From your setting". Creation runs the level-up fills from level 0 to the starting level, plus
// the ability fills. A hook whose test can't run is skipped, never guessed. Pure.
import { evaluate, parseExpression, testHolds, type Value } from './expression.ts';
import { bestSkill, onScale, successChance } from './skillChance.ts';
import { expertiseFigures, type Expertise } from '../characters/expertise.ts';

export type Filled = Record<string, Value>;

export interface FillCharacter {
  level: number;
  scores: Record<string, number>;
  klass: Record<string, unknown> | null;
  race: Record<string, unknown> | null;
  /**
   * Which way the campaign's AC runs (the `ac-style` option, A4; bq3-13): the class's attack figure follows it, the
   * attack bonus with ascending AC and the target number (`thac0`) with descending. Left out: the row's `attack`,
   * else its `thac0`, as before.
   */
  acDirection?: 'ascending' | 'descending';
  /**
   * The expertise points spent (G-208, ex-1; actors.expertise, characters/expertise.ts): read only while the class's
   * `skills.points` is in force. Left out, every class skill reads its `base` (ex-8).
   */
  expertise?: Expertise;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** "3", "4-5", "18", "13–15", "19+", "6 or lower", "16 or more": whether a score is in a row's range. */
export function inRange(range: unknown, score: number): boolean {
  if (typeof range === 'number') return range === score;
  if (typeof range !== 'string') return false;
  const text = range.trim().replace(/–/g, '-');
  const plus = /^(\d+)\+$/.exec(text);
  if (plus) return score >= Number(plus[1]);
  const orLower = /^(\d+)\s+or\s+(?:lower|less|below|under)$/i.exec(text);
  if (orLower) return score <= Number(orLower[1]);
  const orHigher = /^(\d+)\s+or\s+(?:higher|more|above|over)$/i.exec(text);
  if (orHigher) return score >= Number(orHigher[1]);
  const span = /^(\d+)\s*-\s*(\d+)$/.exec(text);
  if (span) return score >= Number(span[1]) && score <= Number(span[2]);
  return /^\d+$/.test(text) && Number(text) === score;
}

/**
 * The scores an ability's abilityModifiers table covers (top rules set first): its lowest and highest row ("3" to
 * "18"; a "19+" row has no top). Null when no rules set has a table for it.
 */
export function scoreRange(rulesSets: readonly Record<string, unknown>[], ability: string): { min: number; max: number | null } | null {
  for (const rules of [...rulesSets].reverse()) {
    const rows = isRecord(rules.abilityModifiers) ? rules.abilityModifiers[ability] : undefined;
    if (!Array.isArray(rows)) continue;
    let min = Infinity;
    let max: number | null = -Infinity;
    for (const row of rows) {
      const range = isRecord(row) ? row.range : undefined;
      const text = typeof range === 'number' ? String(range) : typeof range === 'string' ? range.trim().replace(/–/g, '-') : '';
      const plus = /^(\d+)\+$/.exec(text);
      const span = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(text);
      if (plus) {
        min = Math.min(min, Number(plus[1]));
        max = null;
      } else if (span) {
        min = Math.min(min, Number(span[1]));
        if (max !== null) max = Math.max(max, Number(span[2] ?? span[1]));
      }
    }
    if (min !== Infinity) return { min, max: max === -Infinity ? null : max };
  }
  return null;
}

/** Each ability's row in the rules set's abilityModifiers table, without its range. */
function abilityModifiers(rules: Record<string, unknown>, scores: Record<string, number>): Filled {
  const table = rules.abilityModifiers;
  const filled: Filled = {};
  if (!isRecord(table)) return filled;
  for (const [ability, rows] of Object.entries(table)) {
    const score = scores[ability];
    if (score === undefined || !Array.isArray(rows)) continue;
    const row = rows.find((r) => isRecord(r) && inRange(r.range, score));
    if (!isRecord(row)) continue;
    filled[`abilityModifiers.${ability}`] = Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'range')) as Value;
  }
  return filled;
}

/**
 * The class's progression at a level: its row (the highest at or below it), saves, attack, title, skills. With the
 * class's expertise points in force (G-208, ex-1) its skills are `base` moved by the points spent, and its `byLevel`
 * rows are not read.
 */
function classProgression(
  klass: Record<string, unknown> | null,
  level: number,
  direction?: 'ascending' | 'descending',
  expertise?: Expertise,
  rules: readonly Record<string, unknown>[] = [],
): Filled {
  const filled: Filled = {};
  if (!klass) return filled;
  const rows = (Array.isArray(klass.progression) ? klass.progression : []).filter(isRecord);
  const row = rows.filter((r) => typeof r.level === 'number' && r.level <= level).sort((a, b) => (b.level as number) - (a.level as number))[0];
  if (row) {
    if (row.hitDice !== undefined) filled.hitDice = row.hitDice as Value;
    // The attack figure in the campaign's AC style (A4): the bonus going up, the target number going down.
    const attack =
      direction === 'ascending'
        ? (row.attackBonus ?? (row.thac0 === undefined ? row.attack : undefined))
        : direction === 'descending'
          ? (row.thac0 ?? (row.attackBonus === undefined ? row.attack : undefined))
          : (row.attack ?? row.thac0);
    if (attack !== undefined) filled.attack = attack as Value;
    if (isRecord(row.saves)) for (const [key, value] of Object.entries(row.saves)) filled[`saves.${key}`] = value as Value;
    if (row.spellSlots !== undefined) filled.spellSlots = row.spellSlots as Value;
  }
  const titles = Array.isArray(klass.levelTitles) ? klass.levelTitles : [];
  const title = titles.map((t, i) => (isRecord(t) ? { level: Number(t.level), title: t.title } : { level: i + 1, title: t })).filter((t) => t.level <= level).sort((a, b) => b.level - a.level)[0];
  if (title && typeof title.title === 'string') filled.title = title.title;
  const pointed = expertiseFigures(klass, expertise, rules);
  if (pointed) return Object.assign(filled, pointed);
  const skills = isRecord(klass.skills) ? klass.skills : null;
  const byLevel = skills && Array.isArray(skills.byLevel) ? skills.byLevel.filter(isRecord) : [];
  const skillRow = byLevel.filter((r) => typeof r.level === 'number' && r.level <= level).sort((a, b) => (b.level as number) - (a.level as number))[0];
  if (skillRow) {
    for (const [code, value] of Object.entries(skillRow)) if (code !== 'level') filled[`skills.${code}`] = value as Value;
  }
  return filled;
}

/** Keeps only what the hook's target asks for ("saves" keeps saves.*, "attack" keeps attack). */
function only(filled: Filled, target: unknown): Filled {
  const targets = (Array.isArray(target) ? target : [target]).filter((t): t is string => typeof t === 'string');
  if (targets.length === 0) return filled;
  return Object.fromEntries(Object.entries(filled).filter(([name]) => targets.some((t) => name === t || name.startsWith(`${t}.`))));
}

/** The names a fill hook's test and value read: the character (its scores, class, race, level), levels moved. */
function scopeOf(character: FillCharacter, fromLevel: number, toLevel: number) {
  return {
    names: {
      character: { level: character.level, ...character.scores, class: (character.klass ?? null) as Value, race: (character.race ?? null) as Value },
      fromLevel,
      toLevel,
    },
  };
}

/**
 * The values the setting's fill hooks give a new character (ruled 2026-10-25): the level-up fills as from level 0
 * to its level, then the ability fills. `rules` is the rules sets, lowest in the stack first.
 */
export function fillsAtCreation(hooks: readonly Record<string, unknown>[], rules: readonly Record<string, unknown>[], character: FillCharacter): { filled: Filled; skipped: string[] } {
  const filled: Filled = {};
  const skipped: string[] = [];
  // Higher rules sets win a table both give.
  const merged = Object.assign({}, ...rules) as Record<string, unknown>;
  for (const when of ['levelUp', 'abilityScoreChanged']) {
    for (const hook of hooks.filter((h) => h.kind === 'fill' && h.when === when)) {
      if (hook.appliesTo !== undefined && hook.appliesTo !== 'pc' && hook.appliesTo !== 'any') continue;
      const scope = scopeOf(character, 0, character.level);
      if (typeof hook.test === 'string') {
        const holds = testHolds(hook.test, scope);
        if (holds === null) {
          skipped.push(String(hook.id ?? 'a fill'));
          continue;
        }
        if (!holds) continue;
      }
      if (hook.from === 'abilityModifiers') Object.assign(filled, only(abilityModifiers(merged, character.scores), hook.target));
      else if (hook.from === 'classProgression') Object.assign(filled, only(classProgression(character.klass, character.level, character.acDirection, character.expertise, rules), hook.target));
      else if (typeof hook.value === 'string' || typeof hook.value === 'number') {
        try {
          const value = typeof hook.value === 'number' ? hook.value : evaluate(parseExpression(hook.value), scope);
          for (const target of (Array.isArray(hook.target) ? hook.target : [hook.target]).filter((t): t is string => typeof t === 'string')) filled[target] = value;
        } catch {
          skipped.push(String(hook.id ?? 'a fill'));
        }
      }
    }
  }
  return { filled, skipped };
}

const whole = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** A value inside the filled values by a dotted name ("abilityModifiers.WIS.magicSaves"). */
function filledPath(filled: Filled, name: string): Value | undefined {
  if (filled[name] !== undefined) return filled[name];
  const parts = name.split('.');
  for (let cut = parts.length - 1; cut > 0; cut--) {
    let at: unknown = filled[parts.slice(0, cut).join('.')];
    if (at === undefined) continue;
    for (const part of parts.slice(cut)) at = isRecord(at) ? at[part] : undefined;
    return at as Value | undefined;
  }
  return undefined;
}

/**
 * A movement figure worked out from the speed, as a whole number rounded down (hard rule 8: never more movement than
 * the rule gives; 125 / 3 → 41). A pack that rounds in its own formula (`ceil(speed / 3)`) is already whole, so its
 * rounding wins. The small allowance keeps a figure that falls just under a whole number whole, as the expression's
 * own `floor` does: 0.29 × 100 is 28.999999999999996 in the computer's sums, and shows 29, not 28. Never below 0: a
 * formula that comes out negative shows 0. The one rounding helper: the travel budget's `perDayFor` uses it too.
 */
export const wholeDown = (value: number) => Math.max(0, Math.floor(value + 1e-9));

/** Whether `wholeDown` took a fraction off (the breakdown then says "(rounded down)"); a negative raised to 0 was not. */
export const wasRoundedDown = (value: number) => value - wholeDown(value) > 1e-9;

/**
 * The character's own speed (05 Movement): the race's `speed` when it gives a number, else the rules set's
 * unencumbered speed (`unencumberedMovement.speed`, `defaultSpeed`, `movement.default`); null when none is a number.
 * The governing set (mv-2): the speed is read only from the highest rules set with a `movement` record, or from sets
 * above it, so a lower set's number is never worked through a higher set's formulas.
 */
export function ownSpeed(rules: readonly Record<string, unknown>[], race: Record<string, unknown> | null): number | null {
  const governing = rules.reduce((at, set, i) => (isRecord(set.movement) ? i : at), -1);
  const merged = Object.assign({}, ...(governing < 0 ? rules : rules.slice(governing))) as Record<string, unknown>;
  const movement = isRecord(merged.movement) ? merged.movement : {};
  const unencumbered = isRecord(merged.unencumberedMovement) ? merged.unencumberedMovement : {};
  return whole(race?.speed) ?? whole(unencumbered.speed) ?? whole(merged.defaultSpeed) ?? whole(movement.default);
}

export interface BestFill {
  /** The value that counts, on the skill's own scale. */
  value: number;
  /** "base" (the general chance) or the code of the class skill that counted. */
  counted: string;
  /** Each class skill the fill names that the class has: its value as the class gives it, and on the skill's scale (null: not comparable). */
  classSkills: { code: string; name: string; value: Value; onScale: number | null }[];
}

/**
 * A skill's `fill: { best: ["base", { classSkill: "<code>" }] }` (ga-4, ruled 2026-11-03): the better of the
 * general chance (`base`, as the rules, race and class numbers give it) and the class's own skill at the character's
 * level (`classValue`, its `skills.byLevel` value), compared as chances (skillChance.ts) and written on the skill's
 * scale; on a tie the one listed first. Null when the skill has no `best`, or nothing in it can be compared.
 */
export function bestFill(
  skill: Record<string, unknown>,
  base: number | null,
  klass: Record<string, unknown> | null,
  classValue: (code: string) => Value | undefined,
): BestFill | null {
  const fill = isRecord(skill.fill) ? skill.fill : {};
  if (!Array.isArray(fill.best)) return null;
  const scale = { die: skill.die, rollMode: skill.rollMode };
  const own = klass && isRecord(klass.skills) ? klass.skills : {};
  const classScale = { die: own.die, rollMode: own.rollMode };
  const names = isRecord(own.names) ? own.names : {};
  const classSkills: BestFill['classSkills'] = [];
  const options: { counted: string; value: number }[] = [];
  for (const entry of fill.best) {
    if (entry === 'base') {
      if (base !== null) options.push({ counted: 'base', value: base });
      continue;
    }
    const code = isRecord(entry) && typeof entry.classSkill === 'string' ? entry.classSkill.trim() : '';
    const value = code ? classValue(code) : undefined;
    if (value === undefined || value === null) continue;
    const chance = successChance(value, classScale);
    const shown = chance ? onScale(chance, scale) : null;
    const name = names[code];
    classSkills.push({ code, name: typeof name === 'string' && name.trim() ? name.trim() : code, value, onScale: shown });
    if (shown !== null) options.push({ counted: code, value: shown });
  }
  const counted = bestSkill(options, (o) => successChance(o.value, scale));
  return counted ? { value: counted.value, counted: counted.counted, classSkills } : null;
}

/**
 * What the rules work out from the race and the rules set beyond the hooks (the third creation test, ct3-10, ct3-12a):
 *  - movement (05 Movement): `movement.speed` the character's own speed, then one figure per mode the rules set's
 *    `movement` gives as a formula of `speed` ("speed * 3"), under the rules set's own key only (ruled B 2026-11-03: no alias; a layout names the mode as the rules set does), and
 *    `movement.combat` from its `formula`; `movement` itself is the speed, or the rules' default words ("110' (35')");
 *  - skills (`skills.<id>` for each of the rules set's `skills`): the better of the skill's `default`, the class's
 *    value (already filled), the race's `skillTargets` (a plain number; a target `when` something is a situation, not
 *    the skill's number), and the skill's own `fill.races` / `fill.classes`. Better is lower when the skill rolls
 *    `equal-or-over`, else higher; with `fill.best`, the better of that and the class's own skill (bestFill, ga-4);
 *  - save modifiers (`saveModifiers.<id>`): a `fill` path, or an ability's modifier (`from`; the row's column named by
 *    `plusRaceField`, else its one number) plus the race's field (`plusRaceField`), or the race's field alone
 *    (`raceField`, pf-21: a whole number other than nought, else no line).
 *    No save's number is given here: the save's working (characters/saveWorking.ts, ruled 2026-11-25) counts them.
 * Only numbers the pack gives; a formula that can't run is left out, never guessed.
 */
export function ruleFills(
  rules: readonly Record<string, unknown>[],
  character: { klass: Record<string, unknown> | null; race: Record<string, unknown> | null; classRef?: string | null; raceRef?: string | null },
  filled: Filled,
): Filled {
  const out: Filled = {};
  const merged = Object.assign({}, ...rules) as Record<string, unknown>;
  // Movement.
  const movement = isRecord(merged.movement) ? merged.movement : null;
  const speed = ownSpeed(rules, character.race);
  if (speed !== null) {
    out['movement.speed'] = speed;
    if (filled.movement === undefined) out.movement = speed;
    const scope = { names: { speed } };
    for (const [mode, formula] of Object.entries(movement ?? {})) {
      const text = typeof formula === 'string' ? formula : isRecord(formula) && typeof formula.formula === 'string' ? formula.formula : null;
      if (!text || mode === 'default' || !/\bspeed\b/.test(text)) continue;
      try {
        const value = evaluate(parseExpression(text), scope);
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        out[`movement.${mode}`] = wholeDown(value);
      } catch {
        // Words, not a formula ("slowest member"): not a figure.
      }
    }
  } else if (movement && typeof movement.default === 'string' && movement.default.trim() && filled.movement === undefined) {
    out.movement = movement.default.trim();
  }
  // Skills.
  const raceTargets = isRecord(character.race?.skillTargets) ? character.race.skillTargets : {};
  for (const skill of (Array.isArray(merged.skills) ? merged.skills : []).filter(isRecord)) {
    const id = typeof skill.id === 'string' ? skill.id : '';
    if (!id) continue;
    const lowerIsBetter = skill.rollMode === 'equal-or-over';
    const fill = isRecord(skill.fill) ? skill.fill : {};
    const byRace = isRecord(fill.races) && character.raceRef ? whole(fill.races[character.raceRef]) : null;
    const byClass = isRecord(fill.classes) && character.classRef ? whole(fill.classes[character.classRef]) : null;
    const candidates = [whole(skill.default), whole(filled[`skills.${id}`]), whole(raceTargets[id]), byRace, byClass].filter((n): n is number => n !== null);
    const base = candidates.length === 0 ? null : lowerIsBetter ? Math.min(...candidates) : Math.max(...candidates);
    // A class's own skill standing in (ga-4): the better of the two counts.
    const best = bestFill(skill, base, character.klass, (code) => filled[`skills.${code}`]);
    const value = best ? best.value : base;
    if (value !== null) out[`skills.${id}`] = value;
  }
  // Save modifiers.
  const withOut = { ...filled, ...out };
  for (const mod of (Array.isArray(merged.saveModifiers) ? merged.saveModifiers : []).filter(isRecord)) {
    const id = typeof mod.id === 'string' ? mod.id : '';
    const value = isRecord(mod.value) ? mod.value : null;
    if (!id || !value) continue;
    if (typeof value.fill === 'string') {
      const found = whole(filledPath(withOut, value.fill));
      if (found !== null) out[`saveModifiers.${id}`] = found;
      continue;
    }
    // The kindred's field alone (pf-21): its whole number, and no line when the kindred lacks it or has nought there.
    if (typeof value.raceField === 'string') {
      const own = character.race?.[value.raceField];
      if (typeof own === 'number' && Number.isInteger(own) && own !== 0) out[`saveModifiers.${id}`] = own;
      continue;
    }
    if (typeof value.from !== 'string') continue;
    const row = withOut[`abilityModifiers.${value.from}`];
    const field = typeof value.plusRaceField === 'string' ? value.plusRaceField : '';
    const numbers = isRecord(row) ? Object.values(row).filter((v): v is number => typeof v === 'number') : [];
    const base = isRecord(row) && field && typeof row[field] === 'number' ? (row[field] as number) : numbers.length === 1 ? numbers[0]! : null;
    if (base === null) continue;
    out[`saveModifiers.${id}`] = base + (field ? (whole(character.race?.[field]) ?? 0) : 0);
  }
  return out;
}

/** A save as a race's `saveBonusByCon` names it: "D" or "D(poison)" (the bonus only against poison). */
export function saveKeyOf(text: string): { key: string; against: string | null } {
  const found = /^\s*([^()]+?)\s*(?:\(\s*([^()]*?)\s*\))?\s*$/.exec(text);
  if (!found) return { key: text.trim(), against: null };
  return { key: found[1]!, against: found[2] ? found[2] : null };
}

/** The race's `saveBonusByCon` row for a CON score: its bonus, or null (no table, no CON, no row that holds it). */
export function conSaveBonus(race: Record<string, unknown> | null, scores: Record<string, number>): number | null {
  const table = isRecord(race?.saveBonusByCon) ? race.saveBonusByCon : null;
  const con = scores.CON;
  if (!table || typeof con !== 'number' || !Array.isArray(table.byCon)) return null;
  const row = table.byCon.find((r) => isRecord(r) && inRange(r.con, con));
  return isRecord(row) ? whole(row.bonus) : null;
}

/**
 * What the race says beside a figure, by the figure's fill name (the creation surveys' follow-up, 2026-11-03; 07
 * Races). Shown beside the number today. Ruled 2026-11-25 (plan dec-15-save-bonus): a `saveBonusByCon` entry that
 * names a whole save is counted into it and one for part of a save ("D(poison)") holds at times, by the direction in
 * the rules set's `rolls.save`; characters/saveWorking.ts counts it, and the screens read that from batch B on.
 *  - `saves.<key>`: the race's `saveBonusByCon` {saves, byCon [{con, bonus}]}, the row for the CON score: "+3 to the
 *    roll", or "+3 to the roll vs poison" for a save named "D(poison)". A 0 bonus says nothing;
 *  - `skills.<id>`: a `skillTargets` entry that holds only in a situation ({value, when}): "5 when foraging". The
 *    skill's own number stays as `ruleFills` works it out.
 */
export function raceNotes(race: Record<string, unknown> | null, scores: Record<string, number>): Record<string, string> {
  const notes: Record<string, string> = {};
  const add = (name: string, text: string) => {
    notes[name] = notes[name] ? `${notes[name]}; ${text}` : text;
  };
  const bonus = conSaveBonus(race, scores);
  const table = isRecord(race?.saveBonusByCon) ? race.saveBonusByCon : null;
  if (bonus !== null && bonus !== 0 && table && Array.isArray(table.saves)) {
    const shown = bonus < 0 ? `−${-bonus}` : `+${bonus}`;
    for (const save of table.saves.filter((s): s is string => typeof s === 'string' && s.trim() !== '')) {
      const { key, against } = saveKeyOf(save);
      add(`saves.${key}`, against ? `${shown} to the roll vs ${against}` : `${shown} to the roll`);
    }
  }
  const targets = isRecord(race?.skillTargets) ? race.skillTargets : {};
  for (const [id, target] of Object.entries(targets)) {
    if (!isRecord(target)) continue;
    const value = whole(target.value);
    const when = typeof target.when === 'string' ? target.when.trim() : '';
    if (value !== null && when) add(`skills.${id}`, `${value} when ${when}`);
  }
  return notes;
}

/** The fill links of the attached sheet layouts: campaign field key → the filled value it shows. */
export function fillLinks(layoutFields: readonly { key?: unknown; fill?: unknown }[]): Map<string, string> {
  return new Map(layoutFields.flatMap((f) => (typeof f.key === 'string' && typeof f.fill === 'string' ? [[f.key, f.fill] as const] : [])));
}

/** A filled value as plain words: numbers and text as they are, a row as "melee −3, open doors 1-in-6". */
export function showFilled(value: Value): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return value < 0 ? `−${-value}` : String(value);
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(showFilled).join(', ');
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, v]) => `${key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()} ${showFilled(v as Value)}`)
      .join(', ');
  }
  return '';
}

/** A filled value's name in plain words ("saves.D" → "Save D", with the setting's save names when it has them). */
export function fillName(name: string, rules: readonly Record<string, unknown>[], klass: Record<string, unknown> | null): string {
  const [head, key] = name.split('.', 2) as [string, string | undefined];
  const merged = Object.assign({}, ...rules) as Record<string, unknown>;
  if (head === 'saves' && key) {
    const categories = merged.saveCategories;
    const found = Array.isArray(categories)
      ? categories.find((c) => isRecord(c) && (c.key === key || c.id === key))
      : isRecord(categories)
        ? categories[key]
        : undefined;
    const named = isRecord(found) ? found.name : found;
    return typeof named === 'string' ? named : `Save ${key}`;
  }
  if (head === 'skills' && key) {
    const names = klass && isRecord(klass.skills) && isRecord(klass.skills.names) ? klass.skills.names : {};
    if (typeof names[key] === 'string') return names[key] as string;
    // The rules set's own name for the skill, else its id.
    const skill = Array.isArray(merged.skills) ? merged.skills.find((s) => isRecord(s) && s.id === key) : undefined;
    return isRecord(skill) && typeof skill.name === 'string' ? skill.name : key;
  }
  if (head === 'saveModifiers' && key) {
    const mod = Array.isArray(merged.saveModifiers) ? merged.saveModifiers.find((s) => isRecord(s) && s.id === key) : undefined;
    return isRecord(mod) && typeof mod.name === 'string' ? mod.name : key;
  }
  // A movement mode in words: "Movement: running".
  if (head === 'movement') return key ? `Movement: ${key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}` : 'Movement';
  if (head === 'abilityModifiers' && key) return key;
  return { attack: 'Attack', hitDice: 'Hit dice', spellSlots: 'Spell slots', title: 'Title' }[head] ?? name;
}
