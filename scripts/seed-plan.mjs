// Plans the seeded test campaigns from a pack's own entries (docs/plans/test-seed-campaigns.md). Pure: no network,
// no pack content of its own; every name, rule and number comes from the files it is given.
// The app's creation rules are read from src/ so the plan agrees with the guided flow (Node 24 reads the .ts files).
import {
  abilityKeys,
  classesFor,
  creationMethods,
  defaultRace,
  holdsAbility,
  methodsToPick,
  raceStep,
  unmet,
  withRace,
} from '../src/modules/characters/creation.ts';
import { keyFromLabel } from '../src/modules/characters/fields.ts';
import { withClassReach } from '../src/modules/library/raceReach.ts';
import { requiredIds } from '../src/modules/library/libraryList.ts';
import { defaultChoices, entryOptionOn, readOptions } from '../src/modules/library/options.ts';
import { layoutFields } from '../src/modules/library/sheetLayout.ts';

export const SEED_PREFIX = 'Seed · ';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** "2d8" or "3d6+1" → the average, rounded down (ruled: an average rounds down). Null when it isn't dice. */
export function typicalRoll(dice) {
  const match = /^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/.exec(String(dice ?? '').trim());
  if (!match) return null;
  const [, count, sides, sign, plus] = match;
  const bonus = plus ? (sign === '-' ? -1 : 1) * Number(plus) : 0;
  return Math.floor((Number(count) * (Number(sides) + 1)) / 2) + bonus;
}

/** A hit die ("d8") → its average, rounded down, at least 1; null when the class names no die. */
export function typicalHitPoints(hitDie) {
  const match = /^(\d*)d(\d+)$/.exec(String(hitDie ?? '').trim());
  if (!match) return null;
  return Math.max(1, Math.floor(((Number(match[1] || 1)) * (Number(match[2]) + 1)) / 2));
}

/** The option ids (and the choice, where one is named) that entries elsewhere in the pack depend on. */
export function gatingOptions(entries) {
  const wanted = new Map(); // option id -> choice ids named by entries
  const note = (spec) => {
    if (typeof spec !== 'string' || !spec.trim()) return;
    const [id, choice] = spec.trim().replace('=', ':').split(':');
    if (!id) return;
    if (!wanted.has(id)) wanted.set(id, []);
    if (choice) wanted.get(id).push(choice);
  };
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!isRecord(value)) return;
    for (const [key, inner] of Object.entries(value)) {
      if (key === 'option' || key === 'onlyWithOption') note(inner);
      else if (key === 'byOption' && isRecord(inner)) Object.keys(inner).forEach(note);
      walk(inner);
    }
  };
  for (const entry of entries) if (entry.kind !== 'option') walk(entry.data);
  return wanted;
}

/** The option choices for a campaign: every default, or (options on) the gating options switched away from it. */
export function optionChoices(entries, mode) {
  const options = readOptions(entries);
  const choices = defaultChoices(options);
  if (mode !== 'options on') return choices;
  const gates = gatingOptions(entries);
  for (const option of options) {
    if (option.ruleKey === 'creation-method' || !gates.has(option.id)) continue;
    const named = gates.get(option.id).find((c) => option.choices.some((x) => x.id === c) && c !== choices[option.id]);
    const other = option.choices.find((x) => x.id !== choices[option.id]);
    const pick = named ?? other?.id;
    if (pick) choices[option.id] = pick;
  }
  return choices;
}

/** The ability scores a rules set rolls for: its typical total per score, kept inside its own minimum and maximum. */
function typicalScore(rulesSets) {
  for (const rules of [...rulesSets].reverse()) {
    if (!isRecord(rules.scores)) continue;
    const typical = typicalRoll(rules.scores.dice);
    if (typical !== null) return { typical, min: Number(rules.scores.min) || 1, max: Number(rules.scores.max) || 99 };
  }
  return { typical: 10, min: 1, max: 99 };
}

/** Base scores that meet a race's and a class's requirements after the race's changes; or why that can't be. */
function scoresFor(keys, rolls, klass, race) {
  const base = Object.fromEntries(keys.map((key) => [key, Math.min(rolls.max, Math.max(rolls.min, rolls.typical))]));
  for (const [ability, minimum] of Object.entries(isRecord(race?.data.requirements) ? race.data.requirements : {})) {
    if (typeof minimum === 'number' && ability in base) base[ability] = Math.max(base[ability], minimum);
  }
  const final = withRace(base, race);
  for (const [ability, minimum] of Object.entries(isRecord(klass.data.requirements) ? klass.data.requirements : {})) {
    if (typeof minimum === 'number' && ability in base && final[ability] < minimum) base[ability] += minimum - final[ability];
  }
  const after = withRace(base, race);
  const high = keys.find((key) => base[key] > rolls.max);
  if (high) return { reason: `${high} would need ${base[high]}, above the setting's top score of ${rolls.max}` };
  const problem = unmet(klass.data.requirements, after) ?? (race ? unmet(race.data.requirements, base) : null);
  return problem ? { reason: problem } : { rolled: base, scores: after };
}

const asEntry = (e) => ({ packEntryId: e.packEntryId, name: e.name, data: e.data });

/** What placing a character needs, from the entries in play under these option choices (shared by the plan and the edge cases). */
export function contextOf(entries, choices) {
  const inPlay = entries.filter((e) => e.kind === 'option' || entryOptionOn(e.data, choices));
  const rulesSets = inPlay.filter((e) => e.kind === 'rulesSet').map((e) => e.data);
  const classes = inPlay.filter((e) => e.kind === 'class').map(asEntry);
  const races = inPlay.filter((e) => e.kind === 'race').map(asEntry);
  const keys = abilityKeys(rulesSets);
  const rolls = typicalScore(rulesSets);
  const methodSet = creationMethods(inPlay.filter((e) => e.kind === 'option'), (id) => choices[id]);
  const methods = methodsToPick(methodSet);
  const hasDefault = !!defaultRace(rulesSets, races);
  const used = new Map(races.map((r) => [r.packEntryId, 0]));
  const attempt = (klass, method, preferred) => {
    const mode = raceStep(method, races, hasDefault);
    if (method && Array.isArray(klass.data.creationMethods) && klass.data.creationMethods.length > 0 && !klass.data.creationMethods.includes(method.id)) {
      return { reason: `${method.name} doesn't offer it` };
    }
    if (mode === 'none') {
      const made = scoresFor(keys, rolls, klass, null);
      return made.reason ? made : { race: null, ...made };
    }
    const candidates = (preferred ? [preferred] : [...races].sort((a, b) => used.get(a.packEntryId) - used.get(b.packEntryId)))
      .map((race) => {
        const made = scoresFor(keys, rolls, klass, race);
        if (made.reason) return { reason: made.reason };
        const offered = classesFor(classes, method, race, made.scores).find((o) => o.entry.packEntryId === klass.packEntryId);
        if (!offered) return { reason: `no class list of ${race.name} includes it` };
        return offered.reason ? { reason: offered.reason } : { race, ...made };
      });
    const good = candidates.find((c) => !c.reason);
    if (good) return good;
    if (mode === 'optional') {
      const made = scoresFor(keys, rolls, klass, null);
      if (!made.reason) return { race: null, ...made };
    }
    return { reason: candidates[0]?.reason ?? 'no kindred or race allows it' };
  };

  return { classes, races, methods, hasDefault, used, attempt, keys, rolls, rulesSets };
}

/** The character plan for one campaign of a pack, from the entries in play under these option choices. */
export function planCharacters(entries, choices) {
  const { classes, races, methods, hasDefault, used, attempt } = contextOf(entries, choices);
  const characters = [];
  const skipped = [];

  const add = (klass, method, found) => {
    if (found.race) used.set(found.race.packEntryId, used.get(found.race.packEntryId) + 1);
    characters.push({
      name: `${klass.name}${found.race ? ` · ${found.race.name}` : ''}`,
      classId: klass.packEntryId,
      className: klass.name,
      raceId: found.race?.packEntryId ?? null,
      raceName: found.race?.name ?? null,
      method: method?.id ?? null,
      rolled: found.rolled,
      scores: found.scores,
      hpMax: typicalHitPoints(klass.data.hitDie),
    });
  };

  for (const klass of [...classes].sort((a, b) => a.name.localeCompare(b.name))) {
    let why = 'no creation method offers it';
    let placed = false;
    for (const method of methods.length > 0 ? methods : [null]) {
      const found = attempt(klass, method, null);
      if (found.reason) {
        why = found.reason;
        continue;
      }
      add(klass, method, found);
      placed = true;
      break;
    }
    if (!placed) skipped.push({ classId: klass.packEntryId, className: klass.name, reason: why });
  }

  // Every kindred or race at least once: an extra character for each one nobody has yet.
  const uncovered = [];
  // No race step in any method (a class is its own kindred): there is nothing to cover.
  const raceSteps = (methods.length > 0 ? methods : [null]).some((method) => raceStep(method, races, hasDefault) !== 'none');
  for (const race of raceSteps ? races : []) {
    if (used.get(race.packEntryId) > 0) continue;
    let done = false;
    for (const klass of [...classes].sort((a, b) => a.name.localeCompare(b.name))) {
      for (const method of methods.length > 0 ? methods : [null]) {
        if (raceStep(method, races, hasDefault) === 'none') continue;
        const found = attempt(klass, method, race);
        if (found.reason || !found.race) continue;
        add(klass, method, found);
        done = true;
        break;
      }
      if (done) break;
    }
    if (!done) uncovered.push(race.name);
  }
  return { characters, skipped, uncovered };
}

/** The sheet-layout values for a character: its scores in the ability fields, the first choice of each required list. */
export function fieldValuesFor(entries, character) {
  const values = {};
  const unfilled = [];
  const fields = layoutFields(entries);
  for (const field of fields) {
    const raw = String(field.key ?? field.label ?? '').trim();
    const type = String(field.type ?? '').toLowerCase();
    if (!raw || raw.toLowerCase() === 'hp') continue; // hit points are the character's own, not a field
    const key = keyFromLabel(raw, []); // the key "Use this sheet layout" makes
    const score = Object.entries(character.scores ?? {}).find(([ability]) => holdsAbility(key, ability));
    if (type === 'number' && score) values[key] = score[1];
    else if (field.required === true && type === 'list' && Array.isArray(field.choices) && field.choices.length > 0) values[key] = String(field.choices[0]);
    else if (field.required === true && (type === 'text' || type === 'longtext')) values[key] = 'Seeded';
    else if (field.required === true && type === 'number') values[key] = 1;
    else if (field.required === true) unfilled.push(key);
  }
  return { values, unfilled };
}

/** A pack's own id (`meta.id`) and the ids of the packs it says it needs (`meta.requires`). */
export const packIdOf = (pack) => (typeof pack.meta.extra?.id === 'string' && pack.meta.extra.id ? pack.meta.extra.id : null);
export const needsOf = (pack) => requiredIds(pack.meta.extra?.requires);

/**
 * The packs a pack sits on, lowest first and the pack itself last (an overlay needs its base, which may need its own),
 * and the ids it needs that aren't among `all`.
 */
export function chainOf(pack, all) {
  const chain = [];
  const missing = [];
  const walk = (current, seen) => {
    for (const id of needsOf(current)) {
      const base = all.find((p) => p !== current && packIdOf(p) === id);
      if (!base) missing.push(id);
      else if (!seen.has(base) && !chain.includes(base)) {
        walk(base, new Set([...seen, base]));
        chain.push(base);
      }
    }
  };
  walk(pack, new Set([pack]));
  return { chain: [...chain, pack], missing };
}

/** The entries of a chain as the campaign stacks them: one per kind and id, the higher pack's winning, class reach applied. */
export function mergeEntries(chain) {
  const merged = new Map();
  for (const pack of chain) for (const entry of pack.entries) merged.set(`${entry.kind}:${entry.packEntryId}`, entry);
  // As the app loads them: a class's raceMaxLevels widens the races' class lists (07, pg-2).
  return withClassReach([...merged.values()]);
}

/** The creation methods that are one choice each and aren't offered by the default (an extra campaign for each). */
export function otherMethods(entries) {
  const options = entries.filter((e) => e.kind === 'option');
  const methods = creationMethods(options, () => undefined);
  if (!methods) return [];
  const offered = new Set(methodsToPick(methods).map((m) => m.id));
  const option = readOptions(entries).find((o) => o.ruleKey === 'creation-method');
  return option ? methods.all.filter((m) => m.methods.length === 0 && !offered.has(m.id)).map((m) => ({ ...m, optionId: option.id })) : [];
}

/**
 * Every campaign to build for a chain of packs (a setting, or an overlay on its base): defaults, options on (only
 * when something gates on an option), and one for each creation method the default does not offer.
 */
export function planSetting(chain) {
  const entries = mergeEntries(chain);
  const names = chain.map((p) => p.meta.name).join(' + ');
  if (!entries.some((e) => e.kind === 'class')) return { packName: names, chain, entries, campaigns: [], note: 'no classes, so nothing to seed (an adventure)' };
  // Without ability scores in its rules a pack cannot make a character by itself: it is seeded only on top of a setting.
  if (abilityKeys(entries.filter((e) => e.kind === 'rulesSet').map((e) => e.data)).length === 0) {
    return { packName: names, chain, entries, campaigns: [], note: 'no ability scores in its rules, so it can only be seeded on top of a setting' };
  }
  const plan = (label, choices) => ({ name: `${SEED_PREFIX}${names} · ${label}`, mode: label, choices, ...planCharacters(entries, choices) });
  const campaigns = [plan('defaults', optionChoices(entries, 'defaults'))];
  if (gatingOptions(entries).size > 0) campaigns.push(plan('options on', optionChoices(entries, 'options on')));
  for (const method of otherMethods(entries)) campaigns.push(plan(method.name, { ...optionChoices(entries, 'defaults'), [method.optionId]: method.id }));
  // A class one method doesn't offer is not "left out" when another campaign of this setting makes it.
  const made = new Set(campaigns.flatMap((c) => c.characters.map((ch) => ch.classId)));
  for (const c of campaigns) c.skipped = c.skipped.filter((s) => !(s.reason.endsWith("doesn't offer it") && made.has(s.classId)));
  return { packName: names, chain, entries, campaigns };
}

/** One pack on its own. */
export const planPack = (pack) => planSetting([pack]);

/**
 * The packs with places and no classes of their own that sit on this pack (a region pack: 07 `locations`,
 * `meta.requires`): attached on top of the pack's campaigns so the place picker has places (M8b slice 0; the gate
 * walks fae-woodland with its region pack).
 */
export function placeOverlaysOf(pack, all) {
  const id = packIdOf(pack);
  return all.filter((p) => p !== pack && id && !p.entries.some((e) => e.kind === 'class') && p.entries.some((e) => e.kind === 'location') && needsOf(p).includes(id));
}

/**
 * The settings to seed from a folder of packs: each pack with classes, on top of the packs it needs, with the place
 * packs that sit on it attached (`overlays`). A pack whose base is not in the folder is planned on its own, with a
 * note. Adventures (no classes) are listed as skipped.
 */
export function planFolder(packs) {
  return packs.map((pack) => {
    // A pack with no classes of its own (an adventure, a table pack) is never seeded, whatever it sits on.
    if (!pack.entries.some((e) => e.kind === 'class')) return { packName: pack.meta.name, chain: [pack], entries: pack.entries, campaigns: [], note: 'no classes of its own, so nothing to seed (an adventure or a table pack)' };
    const { chain, missing } = chainOf(pack, packs);
    const plan = planSetting(chain);
    if (missing.length > 0) plan.note = `needs ${missing.join(', ')}, which is not in the folder, so it is seeded without`;
    plan.overlays = placeOverlaysOf(pack, packs);
    return plan;
  });
}
