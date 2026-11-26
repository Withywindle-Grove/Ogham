// A race's optional abilities (07 Races: `optionalAbilities`, "used when an option is on"; the creation surveys'
// follow-up, 2026-11-03). `optionalAbilities: { whenOption: "<option id>=<choice id>", abilityModifiers?, abilities? }`:
// when the campaign's choice for that option is the one named, the race's score changes add these and its abilities
// gain these. Read once, when the setting is read (beside the classes' race reach, raceReach.ts), so creation's score
// changes, the entry pop-up and the sheet all read the race as it is in play. The option is named the way entries'
// `option` is (`entryOptionOn`). Pure.
//   A race's `byOption` (cs-5, 2026-11-03; the shape kits and rules sets use): `{ "<option id>=<choice id>": { ... } }`,
// the fields that choice changes. Read on the same path, first: `npcOnlyClasses` and `classMaxLevels` are replaced
// (so `{}` lifts the race's class limits), `abilities` are added (by name, as optionalAbilities adds them); any other
// field (`abilityModifiers` included) is merged as any entry's byOption is, a null one removed (bq2-1, 2026-11-03: any
// of the race's fields; the shared reader, optionGate.ts, of-3). Then `optionalAbilities`.
import { mergeOver, specParts } from './optionGate.ts';
import { entryOptionOn, type Choices } from './options.ts';

interface Entry {
  kind: string;
  data: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Abilities added by name: the race's own first, then any it doesn't have. */
const addAbilities = (own: unknown, more: unknown[]): unknown[] => {
  const list = Array.isArray(own) ? own : [];
  const names = new Set(list.filter(isRecord).map((a) => a.name));
  return [...list, ...more.filter((a) => isRecord(a) && !names.has(a.name))];
};

/** The race's data with each `byOption` entry whose choice the campaign made applied, in the file's order. */
function withByOption(data: Record<string, unknown>, choices: Readonly<Choices>): Record<string, unknown> {
  if (!isRecord(data.byOption)) return data;
  let next = data;
  for (const [key, change] of Object.entries(data.byOption)) {
    if (!isRecord(change) || !key.trim() || !entryOptionOn({ option: key }, choices)) continue;
    // Any other field (abilityModifiers, …) as any entry's byOption: merged over the race's own, a null one removed
    // (the shared reader, of-3; bq2-1).
    const { npcOnlyClasses, classMaxLevels, abilities, ...rest } = change;
    next = { ...(mergeOver(next, rest) as Record<string, unknown>) };
    if (Array.isArray(npcOnlyClasses)) next.npcOnlyClasses = npcOnlyClasses;
    if (isRecord(classMaxLevels)) next.classMaxLevels = classMaxLevels;
    if (Array.isArray(abilities)) next.abilities = addAbilities(next.abilities, abilities);
  }
  return next;
}

/** The race's data with its `byOption` and optional abilities applied for these choices; the same object when nothing applies. */
export function raceInPlay(raw: Record<string, unknown>, choices: Readonly<Choices>): Record<string, unknown> {
  const data = withByOption(raw, choices);
  const optional = data.optionalAbilities;
  if (!isRecord(optional) || typeof optional.whenOption !== 'string' || !optional.whenOption.trim()) return data;
  if (!entryOptionOn({ option: optional.whenOption }, choices)) return data;
  const next: Record<string, unknown> = { ...data };
  if (isRecord(optional.abilityModifiers)) {
    const changes: Record<string, unknown> = { ...(isRecord(data.abilityModifiers) ? data.abilityModifiers : {}) };
    for (const [ability, change] of Object.entries(optional.abilityModifiers)) {
      if (typeof change !== 'number' || !Number.isInteger(change)) continue;
      const was = changes[ability];
      changes[ability] = (typeof was === 'number' ? was : 0) + change;
    }
    next.abilityModifiers = changes;
  }
  if (Array.isArray(optional.abilities)) next.abilities = addAbilities(data.abilities, optional.abilities);
  return next;
}

/**
 * The checker's notes on races' `byOption` (warnings): not a table of choices, a key not written "<option>=<choice>",
 * a choice the option doesn't have, an override that isn't a table (any field may change, bq2-1). An option none of these entries has is
 * noted only with `library` (every pack being checked): an overlay's races name its base's options.
 */
export function raceOptionNotes(entries: readonly (Entry & { packEntryId: string })[], library = false): string[] {
  const options = new Map(entries.filter((e) => e.kind === 'option').map((e) => [e.packEntryId, e]));
  const notes: string[] = [];
  for (const race of entries.filter((e) => e.kind === 'race' && e.data.byOption !== undefined)) {
    const where = `races: "${race.packEntryId}": byOption`;
    if (!isRecord(race.data.byOption)) {
      notes.push(`${where} should be a table of "<option>=<choice>" keys, each with the fields that choice changes.`);
      continue;
    }
    for (const [key, change] of Object.entries(race.data.byOption)) {
      // A key may list several choices, comma-separated (of-12): each is checked.
      const parts = specParts(key);
      if (parts.length === 0 || parts.some((p) => !p.choice) || /=\s*,|,\s*,|,\s*$/.test(key)) notes.push(`${where} "${key}" should be written "<option>=<choice>".`);
      else {
        for (const { option: optionId, choice: choiceId } of parts) {
          const option = options.get(optionId);
          if (!option) {
            if (library) notes.push(`${where} "${key}" names an option that isn't in any of these packs.`);
          } else if (Array.isArray(option.data.choices) && !option.data.choices.some((c) => isRecord(c) && c.id === choiceId)) notes.push(`${where} "${key}": "${choiceId}" isn't one of that option's choices.`);
        }
      }
      if (!isRecord(change)) notes.push(`${where} "${key}" should be a table of the fields that change.`);
    }
  }
  return notes;
}

/** The entries with each race's byOption and optional abilities applied for the campaign's choices; other entries as they were. */
export function withRaceOptions<T extends Entry>(entries: readonly T[], choices: Readonly<Choices>): T[] {
  return entries.map((entry) => {
    if (entry.kind !== 'race') return entry;
    const data = raceInPlay(entry.data, choices);
    return data === entry.data ? entry : { ...entry, data };
  });
}
