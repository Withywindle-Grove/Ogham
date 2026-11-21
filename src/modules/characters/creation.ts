// Guided character creation from the setting rules (docs/05 "Character creation", 07 "Creation methods"; ruled
// 2026-10-25): which method applies, whether a race is picked, and which races and classes are offered, each
// greyed out with the reason when the scores fall short. Pure: the screens and the tests use it the same way.
// The app never rolls: scores are rolled at the table and typed in.
import { raceClassLimit } from '../library/classLimits.ts';

export interface CreationEntry {
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
}

/** A creation method: one choice of the option with ruleKey "creation-method". */
export interface CreationMethod {
  id: string;
  name: string;
  races: 'none' | 'required' | 'optional';
  /** Other methods the player picks among, for each character ("player's choice"). */
  methods: string[];
}

export interface Offered<T> {
  entry: T;
  /** Why it can't be picked ("Needs CON 9"), or null when it can. */
  reason: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The methods the campaign's creation-method option offers, and the one chosen; null when there's no such option. */
export function creationMethods(
  options: readonly { data: Record<string, unknown>; packEntryId: string }[],
  chosen: (optionId: string) => string | undefined,
): { chosen: CreationMethod; all: CreationMethod[] } | null {
  const option = options.find((o) => o.data.ruleKey === 'creation-method');
  if (!option) return null;
  const all: CreationMethod[] = (Array.isArray(option.data.choices) ? option.data.choices : []).filter(isRecord).flatMap((choice) => {
    if (typeof choice.id !== 'string' || !choice.id) return [];
    const races = choice.races === 'none' || choice.races === 'required' ? choice.races : 'optional';
    const methods = Array.isArray(choice.methods) ? choice.methods.filter((m): m is string => typeof m === 'string') : [];
    return [{ id: choice.id, name: typeof choice.name === 'string' ? choice.name : choice.id, races, methods }];
  });
  if (all.length === 0) return null;
  const wanted = chosen(option.packEntryId) ?? (typeof option.data.default === 'string' ? option.data.default : undefined);
  return { chosen: all.find((m) => m.id === wanted) ?? all[0]!, all };
}

/** The methods a player picks among for this character (just the chosen one, unless it offers several). */
export function methodsToPick(methods: { chosen: CreationMethod; all: CreationMethod[] } | null): CreationMethod[] {
  if (!methods) return [];
  const picks = methods.chosen.methods.flatMap((id) => methods.all.filter((m) => m.id === id));
  return picks.length > 0 ? picks : [methods.chosen];
}

/**
 * Whether the race step shows, and whether it can be skipped. No races in the setting: no step at all. Skipping
 * gives the setting's default race, so without one (ruled 2026-10-26: no app default) a race is required.
 */
export function raceStep(method: CreationMethod | null, races: readonly unknown[], hasDefault = false): 'none' | 'required' | 'optional' {
  if (races.length === 0) return 'none';
  const mode = method?.races ?? 'optional';
  return mode === 'optional' && !hasDefault ? 'required' : mode;
}

/** The setting's default race (a rules set's `defaultRace`, the last attached pack's winning), if it's one of the races. */
export function defaultRace<T extends { packEntryId: string }>(rulesSets: readonly Record<string, unknown>[], races: readonly T[]): T | null {
  for (const rules of [...rulesSets].reverse()) {
    if (typeof rules.defaultRace !== 'string') continue;
    return races.find((r) => r.packEntryId === rules.defaultRace) ?? null;
  }
  return null;
}

/**
 * The race a class stands for, when the class is the race (ruled 2026-10-29, B10): the class's `race`, a race id
 * from the setting rules; null when it names none (or one that isn't there), and the Race row is then left out.
 * No guessing from names. Since cs-4 (2026-11-03) a pick of such a class sets the character's race to it (kindredOf).
 */
export function classRace<T extends { packEntryId: string }>(klass: Record<string, unknown> | null | undefined, races: readonly T[]): T | null {
  const id = klass?.race;
  return typeof id === 'string' && id.trim() ? (races.find((r) => r.packEntryId === id.trim()) ?? null) : null;
}

/** The kindred a kindred-class is bound to (cs-4): its `race`, a race id; '' for an ordinary class. */
export function classKindredId(klass: Record<string, unknown> | null | undefined): string {
  return typeof klass?.race === 'string' ? klass.race.trim() : '';
}

/**
 * Whether the Class step lists a class for the kindred picked (cs-4): an ordinary class always; a kindred-class only
 * under its own kindred, or when no kindred is picked (the kindred-as-class method, whose Kindred step is skipped).
 */
export function offeredToKindred(klass: CreationEntry, race: CreationEntry | null): boolean {
  const own = classKindredId(klass.data);
  return !own || !race || race.packEntryId === own;
}

/**
 * The kindred a character of this class has (cs-4): a kindred-class sets its own kindred (when the setting has it), so
 * the languages, the name, detail and trinket tables follow it; an ordinary class keeps the one picked.
 */
export function kindredOf<T extends { packEntryId: string }>(klass: Record<string, unknown> | null | undefined, picked: T | null, races: readonly T[]): T | null {
  return classRace(klass, races) ?? picked;
}

/**
 * Whether a class replaces this kindred's traits with its own (cs-4): a kindred-class on its own kindred, unless it
 * says `replacesRaceTraits: false`. (A kindred-class is the kindred as a class: its traits, score changes, saves and
 * grants are the class's. Only an explicit `false` keeps the kindred's beside them.)
 */
export function replacesKindredTraits(klass: Record<string, unknown> | null | undefined, raceId: string | null | undefined): boolean {
  const own = classKindredId(klass);
  return !!own && own === raceId && klass?.replacesRaceTraits !== false;
}

/**
 * What a kindred keeps when its kindred-class replaces its traits (cs-4): who they are (name, words, languages, the
 * name, detail and trinket tables, size, kind, age and build), not what they can do. Everything else (abilities and
 * optional abilities, score changes, skills, saves, AC, vision, weapon limits, first spells, starting items, class
 * limits) comes from the class.
 */
export const KINDRED_KEEPS = ['id', 'name', 'blurb', 'source', 'notes', 'languages', 'tables', 'size', 'creatureType', 'age', 'height', 'weight', 'lifespan', 'shareable'] as const;

/** A race's data as a character of this class plays it (cs-4): its own, or only what it keeps when the class replaces its traits. */
export function raceDataAsPlayed(race: Record<string, unknown> | null, raceId: string | null | undefined, klass: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!race || !replacesKindredTraits(klass, raceId)) return race;
  return Object.fromEntries(KINDRED_KEEPS.flatMap((key) => (key in race ? [[key, race[key]]] : [])));
}

/** A race entry as a character of this class plays it (raceDataAsPlayed): the same entry when nothing is replaced. */
export function raceAsPlayed<T extends CreationEntry>(race: T | null, klass: { data: Record<string, unknown> } | null | undefined): T | null {
  if (!race || !replacesKindredTraits(klass?.data, race.packEntryId)) return race;
  return { ...race, data: raceDataAsPlayed(race.data, race.packEntryId, klass?.data)! };
}

/** A requirements block, { "CON": 9 }, as the first one the scores miss ("Needs CON 9"); null when all are met. */
export function unmet(requirements: unknown, scores: Record<string, number>): string | null {
  if (!isRecord(requirements)) return null;
  for (const [ability, minimum] of Object.entries(requirements)) {
    if (typeof minimum !== 'number') continue;
    const score = scores[ability];
    if (score === undefined || score < minimum) return `Needs ${ability} ${minimum}`;
  }
  return null;
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** A race's fixed changes to the scores ({ "DEX": 1, "CON": -1 }), applied after it's picked. */
export function withRace(scores: Record<string, number>, race: CreationEntry | null): Record<string, number> {
  const changes = race && isRecord(race.data.abilityModifiers) ? race.data.abilityModifiers : {};
  const next = { ...scores };
  for (const [ability, change] of Object.entries(changes)) {
    if (typeof change === 'number' && Number.isInteger(change) && ability in next) next[ability] = next[ability]! + change;
  }
  return next;
}

/**
 * The classes offered, A–Z: only those the method allows (their creationMethods; any when a class doesn't say),
 * and once a race is picked, only those its class limits leave open (classLimits.ts: a hard limit closes a class; a
 * soft one is offered, with the GM's special approval). Each says why the scores (after the race's changes) rule it
 * out, if they do.
 */
export function classesFor<T extends CreationEntry>(
  classes: readonly T[],
  method: CreationMethod | null,
  race: CreationEntry | null,
  scores: Record<string, number>,
): Offered<T>[] {
  return [...classes]
    .filter((entry) => {
      const methods = entry.data.creationMethods;
      if (method && Array.isArray(methods) && methods.length > 0 && !methods.includes(method.id)) return false;
      return raceClassLimit(race?.data, entry.packEntryId).open;
    })
    .sort(byName)
    .map((entry) => ({ entry, reason: unmet(entry.data.requirements, scores) }));
}

/**
 * The highest level a class can reach (B21, ruled 2026-10-25: a fixed starting level is capped at it): the class's
 * maxLevel, and the race's limit for it (classLimits.ts), whichever is lower; null when neither says.
 */
export function classLevelCap(klass: CreationEntry, race: CreationEntry | null): number | null {
  const caps = [klass.data.maxLevel, raceClassLimit(race?.data, klass.packEntryId).maxLevel].filter(
    (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1,
  );
  return caps.length > 0 ? Math.min(...caps) : null;
}

/** The ability keys scores are entered for: the setting's list (rules set `abilities`), in its order. */
export function abilityKeys(rulesSets: readonly Record<string, unknown>[]): string[] {
  for (const rules of [...rulesSets].reverse()) {
    if (Array.isArray(rules.abilities)) {
      const keys = rules.abilities.flatMap((a) => (typeof a === 'string' ? [a] : isRecord(a) && typeof a.key === 'string' ? [a.key] : []));
      if (keys.length > 0) return keys;
    }
  }
  return [];
}

/**
 * An ability's names, the same everywhere (tiles, creation, cards, pop-ups; ruled 2026-10-29, B6): `short` where
 * people glance (score tiles, the scores steps, the check step) and `long` where they read (pop-ups and
 * explanations). In this order:
 *   1. the GM's own label on the campaign field that holds the ability (both names: the GM is in control);
 *   2. the setting's names: an ability may be a plain key ("MUS") or `{ "key", "name", "short"?, "blurb"? }`
 *      (`name` is the long name; without `short`, the short name is the key);
 *   3. the key.
 * A field label that only repeats the key or the setting's names isn't the GM's own, so a sheet layout's "MUS"
 * field still shows the setting's long name in pop-ups. Hidden fields don't name anything.
 */
export function abilityNames(
  rulesSets: readonly Record<string, unknown>[],
  fieldDefs: readonly { key: string; label: string; hidden?: boolean }[] = [],
): (key: string) => { short: string; long: string } {
  const known = new Map<string, { short?: string; long?: string }>();
  const words = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
  for (const rules of rulesSets) {
    if (!Array.isArray(rules.abilities)) continue;
    for (const a of rules.abilities) {
      if (isRecord(a) && typeof a.key === 'string') known.set(a.key, { short: words(a.short), long: words(a.name) });
    }
  }
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return (key) => {
    const named = known.get(key);
    const short = named?.short ?? key;
    const long = named?.long ?? short;
    const label = words(fieldDefs.find((f) => !f.hidden && holdsAbility(f.key, key))?.label);
    if (label && ![key, short, long].some((name) => same(label, name))) return { short: label, long: label };
    return { short, long };
  };
}

/**
 * An ability's one-line blurb from the setting (`abilities[].blurb`, ruled 2026-10-29): the first line of the
 * ability's pop-up (and, in M7, under each ability on creation's scores step). The top rules set that has one
 * wins; '' when none does.
 */
export function abilityBlurb(rulesSets: readonly Record<string, unknown>[], key: string): string {
  for (const rules of [...rulesSets].reverse()) {
    if (!Array.isArray(rules.abilities)) continue;
    const found = rules.abilities.find((a) => isRecord(a) && a.key === key);
    if (isRecord(found) && typeof found.blurb === 'string' && found.blurb.trim()) return found.blurb.trim();
  }
  return '';
}

/**
 * What an ability does, in plain words (cw-11; `abilities[].description`, ruled by Design 2026-11-06): the first
 * paragraph of the ability's pop-up on the Scores step. The top rules set that has one wins; else its `blurb`; '' when
 * neither is there.
 */
export function abilityDescription(rulesSets: readonly Record<string, unknown>[], key: string): string {
  for (const rules of [...rulesSets].reverse()) {
    if (!Array.isArray(rules.abilities)) continue;
    const found = rules.abilities.find((a) => isRecord(a) && a.key === key);
    if (isRecord(found) && typeof found.description === 'string' && found.description.trim()) return found.description.trim();
  }
  return abilityBlurb(rulesSets, key);
}

/**
 * An ability's note from the setting (`abilityModifierNotes`, 07: "a sentence or two on what the score does, shown in
 * its popup and at creation"): the top rules set that has one wins; '' when none does.
 */
export function abilityNote(rulesSets: readonly Record<string, unknown>[], key: string): string {
  for (const rules of [...rulesSets].reverse()) {
    const notes = rules.abilityModifierNotes;
    if (isRecord(notes) && typeof notes[key] === 'string' && notes[key].trim()) return notes[key].trim();
  }
  return '';
}

/** The setting's ability-adjustment text (shown, never checked: ruled 2026-10-25), from the top rules set that has it. */
export function adjustmentText(rulesSets: readonly Record<string, unknown>[]): string {
  for (const rules of [...rulesSets].reverse()) {
    const text = rules.abilityAdjustment;
    if (typeof text === 'string' && text.trim()) return text.trim();
    if (isRecord(text) && typeof text.text === 'string') return text.text.trim();
  }
  return '';
}

/**
 * Whether a campaign field holds an ability's score: the same key, or the key "Use this sheet layout" made from it
 * (lower case, "_" for anything else: "STR" → "str"; fields.ts keyFromLabel).
 */
export function holdsAbility(fieldKey: string, ability: string): boolean {
  const made = ability.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36);
  return fieldKey === ability || fieldKey === made;
}

/** A score as typed: a whole number from 1 to 99, or null. */
export function readScore(text: string): number | null {
  if (!/^\d{1,2}$/.test(text.trim())) return null;
  const n = Number(text.trim());
  return n >= 1 ? n : null;
}

/** "Bog folk Lantern Warden"; a kindred-class named as its kindred reads once ("Elf", not "Elf Elf"; F49). */
export function kindredAndClassWords(kindred: string | null, klass: string): string {
  return kindred && kindred.trim().toLowerCase() !== klass.trim().toLowerCase() ? `${kindred} ${klass}` : klass;
}

/**
 * The review's one-line kindred and class (plan dec-1 1d on 1c): the raw names decide whether the kindred is read
 * (so "Elf (from Fen rules) Elf" never comes back), then each name read gets its source words, `fromWords(entry)`
 * (" (from Fen rules)" for a namesake, else ""): "Bog folk (from Fen rules) Lantern Warden".
 */
export function kindredAndClassNamed<E extends { name: string }>(kindred: E | null | undefined, klass: E, fromWords: (entry: E) => string): string {
  const named = (entry: E) => `${entry.name}${fromWords(entry)}`;
  return kindred && kindredAndClassWords(kindred.name, klass.name) !== klass.name ? `${named(kindred)} ${named(klass)}` : named(klass);
}
