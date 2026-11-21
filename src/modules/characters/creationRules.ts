// Creation rules as data (M5b step 0c, slice 1; docs/07 "Creation rules as data", ruled 2026-11-01, cr-19 … cr-24):
// the shapes guided creation enforces, read from the setting's rules sets. The app enforces only what a pack states
// as data; prose stays reference text and gives no step. Pure: the steps and the tests read these the same way.
//   scores: the dice and range the Scores step starts from (required for the step; the checker warns).
//   abilityAdjustment: the trade rule as data (a string gives no Adjust scores step; creation.ts adjustmentText keeps it).
//   languages: the common tongue(s), whether alignment tongues exist, the setting's list, and which score gives extras.
//   extraLanguages: a whole number from the ability modifier table ("Native + 1" in words is the old way: null).
//   alignmentVisibility: who sees a character's alignment ("owner": its owner and the GM; "all", the default).
//   abilities' kind: advantage (default) or disadvantage, for the entry pop-up's headings.
//   fill: the only derived mark; creation never asks for a field that has one (cr-23).
import { inRange } from '../library/fills.ts';
import { traitNoteWords } from '../library/ruleText.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const whole = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null);
const ids = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim()) : []);

/** The top rules set that says, as the packs stack (the last wins; like creationGuide.ts). */
function top(rulesSets: readonly Record<string, unknown>[], key: string): unknown {
  for (const rules of [...rulesSets].reverse()) if (rules[key] !== undefined) return rules[key];
  return undefined;
}

// Scores ------------------------------------------------------------------------------------------------------------

export interface StartOverRule {
  /** Start over when every score is at most this. */
  everyAtMost: number | null;
  /** Start over when at least `count` scores are at most `value`. */
  countAtMost: { count: number; value: number } | null;
  /** The option that turns the rule on, if any. */
  option: string | null;
  note: string;
}

export interface ScoresRule {
  dice: string;
  /** What the tiles start at: the dice's average, rounded down. */
  average: number;
  min: number;
  max: number;
  startOver: StartOverRule | null;
}

// Dice like "3d6", "d8", "2d6+1"; then an optional "× 10" (also "x 10", "* 10"); then an optional coin word ("gp").
const DICE = /^\s*(\d*)\s*d\s*(\d+)\s*(?:([+−-])\s*(\d+))?\s*(?:[×x*]\s*(\d+))?\s*(?:[a-z]+)?\s*$/i;

/**
 * The average of dice like "3d6", "d8" or "2d6+1", rounded down to a whole number (ruled 2026-11-02); null when it isn't
 * dice. A money roll's "× 10" multiplies the rounded average and a coin word after it is read past (cw-11, starting
 * coin: "3d6 x 10 gp" gives 100, "the usual 100" in Design's words; "3d6 gp" gives 10).
 */
export function diceAverage(dice: string): number | null {
  const m = DICE.exec(dice);
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  const sides = Number(m[2]);
  if (count < 1 || sides < 1) return null;
  const bonus = m[4] ? Number(m[4]) * (m[3] === '+' ? 1 : -1) : 0;
  const times = m[5] ? Number(m[5]) : 1;
  if (times < 1) return null;
  return Math.floor((count * (sides + 1)) / 2 + bonus) * times;
}

/**
 * The least and the most dice like "3d6 × 10" can give ("3d6 x 10 gp" → 30 to 180), null when it isn't dice: a coin
 * typed outside them is warned about, never clamped (final drafts D, Francis 2026-11-06).
 */
export function diceRange(dice: string): { min: number; max: number } | null {
  const m = DICE.exec(dice);
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  const sides = Number(m[2]);
  const times = m[5] ? Number(m[5]) : 1;
  if (count < 1 || sides < 1 || times < 1) return null;
  const bonus = m[4] ? Number(m[4]) * (m[3] === '+' ? 1 : -1) : 0;
  return { min: Math.max(0, (count + bonus) * times), max: Math.max(0, (count * sides + bonus) * times) };
}

/** The dice of a money roll without its coin word ("3d6 × 10 gp" → "3d6 × 10"), for the words that name them. */
export const diceWithoutCoin = (dice: string): string => dice.trim().replace(/\s+[a-z]+$/i, '');

/**
 * What a coin outside the dice's range says (picture creation/final 23-H4): "190 is above what 3d6 × 10 can roll", "20
 * is below what 3d6 × 10 can roll"; null inside the range, or when the roll isn't dice.
 */
export function outsideDice(dice: string, value: number | null): string | null {
  const range = diceRange(dice);
  if (!range || value === null) return null;
  if (value > range.max) return `${value} is above what ${diceWithoutCoin(dice)} can roll`;
  if (value < range.min) return `${value} is below what ${diceWithoutCoin(dice)} can roll`;
  return null;
}

/** The "× N" of a money roll ("3d6 x 10 gp" → 10), 1 without one or when it isn't dice: the coin stepper's step (cw-11). */
export function diceTimes(dice: string): number {
  const m = DICE.exec(dice);
  const times = m?.[5] ? Number(m[5]) : 1;
  return times >= 1 ? times : 1;
}

/** The setting's score rule (07 `scores`), from the top rules set that has one; null when none says (the checker warns). */
export function scoresRule(rulesSets: readonly Record<string, unknown>[]): ScoresRule | null {
  const raw = top(rulesSets, 'scores');
  if (!isRecord(raw)) return null;
  const dice = text(raw.dice);
  const average = diceAverage(dice);
  const min = whole(raw.min);
  const max = whole(raw.max);
  if (average === null || min === null || max === null || min > max) return null;
  let startOver: StartOverRule | null = null;
  if (isRecord(raw.startOver)) {
    const count = isRecord(raw.startOver.countAtMost) ? raw.startOver.countAtMost : null;
    const countAtMost = count && whole(count.count) !== null && whole(count.value) !== null ? { count: whole(count.count)!, value: whole(count.value)! } : null;
    const everyAtMost = whole(raw.startOver.everyAtMost);
    if (countAtMost || everyAtMost !== null) startOver = { everyAtMost, countAtMost, option: text(raw.startOver.option) || null, note: text(raw.startOver.note) };
  }
  return { dice, average, min, max, startOver };
}

/**
 * Whether a set of scores triggers the setting's start-over rule (cr-9: offered in a callout, never forced). False
 * without a rule, or when its option is off.
 */
export function startOverTriggered(rule: ScoresRule | null, scores: Record<string, number>, optionOn: (optionId: string) => boolean = () => true): boolean {
  const over = rule?.startOver;
  if (!over) return false;
  if (over.option && !optionOn(over.option)) return false;
  const values = Object.values(scores);
  if (values.length === 0) return false;
  if (over.everyAtMost !== null && values.every((v) => v <= over.everyAtMost!)) return true;
  if (over.countAtMost && values.filter((v) => v <= over.countAtMost!.value).length >= over.countAtMost.count) return true;
  return false;
}

// Ability adjustment ------------------------------------------------------------------------------------------------

export interface AdjustmentRule {
  lowerBy: number;
  raiseBy: number;
  /** The abilities that may be lowered, or "nonPrime" (any but the class's primes). */
  lowerable: string[] | 'nonPrime';
  /** What may be raised: the class's prime requisites. */
  raise: 'prime';
  /** No score goes below this. */
  floor: number;
  /** No score goes above this, when the rule says. */
  cap: number | null;
  classExceptions: { classId: string; cannotLower: string[] }[];
  note: string;
  source: string;
}

/**
 * The setting's trade rule as data (07 `abilityAdjustment`), from the top rules set that has one. A string (reference
 * text) or an object without the numbers gives null: no Adjust scores step (cr-11).
 */
export function adjustmentRule(rulesSets: readonly Record<string, unknown>[]): AdjustmentRule | null {
  const raw = top(rulesSets, 'abilityAdjustment');
  if (!isRecord(raw)) return null;
  const lowerBy = whole(raw.lowerBy);
  const raiseBy = whole(raw.raiseBy);
  const floor = whole(raw.floor);
  const lowerable = raw.lowerable === 'nonPrime' ? 'nonPrime' : ids(raw.lowerable);
  if (lowerBy === null || raiseBy === null || floor === null || lowerBy < 1 || raiseBy < 1 || (lowerable !== 'nonPrime' && lowerable.length === 0)) return null;
  const classExceptions = (Array.isArray(raw.classExceptions) ? raw.classExceptions : [])
    .filter(isRecord)
    .flatMap((e) => (text(e.classId) ? [{ classId: text(e.classId), cannotLower: ids(e.cannotLower) }] : []));
  return { lowerBy, raiseBy, lowerable, raise: 'prime', floor, cap: whole(raw.cap), classExceptions, note: text(raw.note), source: text(raw.source) };
}

// Languages ---------------------------------------------------------------------------------------------------------

export interface Language {
  id: string;
  name: string;
  blurb: string;
  note: string;
  source: string;
  /** Its range on the die extra languages are rolled on (cs-6, G-90: `roll { die, min, max }`); left out when it isn't rolled. */
  roll?: { die: string; min: number; max: number };
  /** Who may learn it (cs-6, G-90 `learnableBy`): creature types; soft = with the GM's leave (special approval). Left out: anyone. */
  learnableBy?: { types: string[]; soft: boolean };
}

/** A language's `roll`: a die and a whole range; null when it isn't one. */
function languageRoll(value: unknown): Language['roll'] | null {
  if (!isRecord(value) || !text(value.die)) return null;
  const min = whole(value.min);
  const max = whole(value.max) ?? min;
  return min === null || max === null || max < min ? null : { die: text(value.die), min, max };
}

/**
 * A language's `learnableBy`: a list of types (hard), or `{ types, soft }` (`types: []` and soft = anyone, with the
 * GM's leave). A hard limit naming no type limits nothing (it would hide the language from everyone; pack:check says so).
 */
function learnable(value: unknown): Language['learnableBy'] | null {
  const by = Array.isArray(value) ? { types: ids(value), soft: false } : isRecord(value) ? { types: ids(value.types), soft: value.soft === true } : null;
  return by && (by.soft || by.types.length > 0) ? by : null;
}

export interface LanguagesRule {
  /** The common tongue(s) everyone has, as ids of the list. */
  common: string[];
  /** Whether alignment tongues exist (the option that turns them off works through this). */
  alignment: boolean;
  list: Language[];
  /** The ability whose modifier table gives the extra languages ("INT"). */
  extraFrom: string | null;
}

/** The setting's languages (07 `languages`), from the top rules set that has one; null when none says. */
export function languagesRule(rulesSets: readonly Record<string, unknown>[]): LanguagesRule | null {
  // An overlay's `languages.list` merges into its base's (cs-6, G-93): each rules set's list in stack order, a later
  // one's language of the same id replacing the earlier; `common`, `alignment` and `extraFrom` from the top one that
  // says. An overlay that only adds languages keeps its base's common tongue and extras.
  const all = rulesSets.map((r) => r.languages).filter(isRecord);
  if (all.length === 0) return null;
  const said = (key: string) => [...all].reverse().find((raw) => raw[key] !== undefined)?.[key];
  const list: Language[] = [];
  for (const raw of all) {
    for (const l of (Array.isArray(raw.list) ? raw.list : []).filter(isRecord)) {
      if (!text(l.id)) continue;
      const roll = languageRoll(l.roll);
      const by = learnable(l.learnableBy);
      const language: Language = { id: text(l.id), name: text(l.name) || text(l.id), blurb: text(l.blurb), note: text(l.note), source: text(l.source), ...(roll ? { roll } : {}), ...(by ? { learnableBy: by } : {}) };
      const at = list.findIndex((had) => had.id === language.id);
      if (at >= 0) list[at] = language;
      else list.push(language);
    }
  }
  return { common: ids(said('common')), alignment: said('alignment') !== false, list, extraFrom: text(said('extraFrom')) || null };
}

/**
 * A language a race or class names, matched to the setting's list: by id, else by name (the checker warns on a bare
 * name). Null when the list doesn't have it (a language of the entry's own; shown by its name).
 */
export function findLanguage(rule: LanguagesRule | null, named: string): { language: Language; byName: boolean } | null {
  const wanted = named.trim();
  if (!rule || !wanted) return null;
  const byId = rule.list.find((l) => l.id === wanted);
  if (byId) return { language: byId, byName: false };
  const byName = rule.list.find((l) => l.name.toLowerCase() === wanted.toLowerCase());
  return byName ? { language: byName, byName: true } : null;
}

/**
 * How a language a race or class names reads ("zc-reed" → "Reedspeak"): its name from the setting's merged list
 * (languagesRule, every rules set's list); one the list doesn't have reads as written.
 */
export function languageNamer(rulesSets: readonly Record<string, unknown>[]): (named: string) => string {
  const rule = languagesRule(rulesSets);
  return (named) => findLanguage(rule, named)?.language.name ?? named.trim();
}

/**
 * How many extra languages the scores give (cr-15, Pick N more): the `extraLanguages` column of the row the score
 * falls in, on the ability the languages rule names (else "INT"), from the top rules set with a table for it. A
 * whole number, or null when the pack doesn't say as a number ("Native + 1" in words is the old way).
 */
export function extraLanguages(rulesSets: readonly Record<string, unknown>[], scores: Record<string, number>, rule: LanguagesRule | null = languagesRule(rulesSets)): number | null {
  const ability = rule?.extraFrom ?? 'INT';
  const score = scores[ability];
  if (score === undefined) return null;
  for (const rules of [...rulesSets].reverse()) {
    const rows = isRecord(rules.abilityModifiers) ? rules.abilityModifiers[ability] : undefined;
    if (!Array.isArray(rows)) continue;
    const row = rows.find((r) => isRecord(r) && inRange(r.range, score));
    if (!isRecord(row)) continue;
    const n = whole(row.extraLanguages);
    return n === null ? null : Math.max(0, n);
  }
  return null;
}

// Alignment visibility ----------------------------------------------------------------------------------------------

export type AlignmentVisibility = 'owner' | 'all';

/** Who sees a character's alignment (07 `alignmentVisibility`): "owner" (its owner and the GM) or "all" (the default). */
export function alignmentVisibility(rulesSets: readonly Record<string, unknown>[]): AlignmentVisibility {
  return top(rulesSets, 'alignmentVisibility') === 'owner' ? 'owner' : 'all';
}

// Abilities' kind ---------------------------------------------------------------------------------------------------

export type AbilityKind = 'advantage' | 'disadvantage';

/** An ability's heading in the entry pop-up (cr-24): disadvantage when it says so, else advantage. */
export function abilityKind(ability: unknown): AbilityKind {
  return isRecord(ability) && ability.kind === 'disadvantage' ? 'disadvantage' : 'advantage';
}

/** A class's or race's abilities split by kind, each with its name and note. */
export function abilitiesByKind(entry: Record<string, unknown>): Record<AbilityKind, { name: string; note: string; blurb: string }[]> {
  const out: Record<AbilityKind, { name: string; note: string; blurb: string }[]> = { advantage: [], disadvantage: [] };
  for (const ability of Array.isArray(entry.abilities) ? entry.abilities : []) {
    if (!isRecord(ability) || !text(ability.name)) continue;
    // A note in pf-18's blocks reads as its words here (tfb-5): a bullet is one line.
    out[abilityKind(ability)].push({ name: text(ability.name), note: traitNoteWords(ability.note), blurb: text(ability.blurb) || text(ability.summary) });
  }
  return out;
}

// Derived fields ----------------------------------------------------------------------------------------------------

/** The sheet fields the rules work out: those with a `fill` (cr-23). Creation never asks for them; the app keeps no list of its own. */
export function derivedFields<T extends { fill?: string | null }>(fields: readonly T[]): T[] {
  return fields.filter((f) => typeof f.fill === 'string' && f.fill.trim() !== '');
}

/**
 * The fields creation asks on "Who they are": visible, not derived, not owned by another step (cr-12), and not one
 * the sheet layout leaves to play (`atCreation: false`, ct3-3 ruled B 2026-11-03: an affiliation).
 */
export function askedFields<T extends { key: string; fill?: string | null; hidden?: boolean; atCreation?: unknown }>(fields: readonly T[], ownedByOtherSteps: ReadonlySet<string>): T[] {
  return fields.filter((f) => !f.hidden && !(typeof f.fill === 'string' && f.fill.trim() !== '') && !ownedByOtherSteps.has(f.key) && f.atCreation !== false);
}
