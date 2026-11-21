// A class reaching other packs' races (07, "A class reaching other packs' races"; G-06's race side, ruled
// 2026-11-03, design/rulings/m5b-packs-g80-g06-2026-11-03.md pg-2). A class may carry
// `raceMaxLevels: { "<raceId>": <level> | null }` (null = no limit). The one reader of a race's class limits: every
// attached class's `raceMaxLevels` merges into that race's `classMaxLevels` when the setting is read, so creation's
// class offer (and level-up's cap in M7) read the merged table. Pure; the pack checker uses the same rules for its notes.
// It runs after the race's `byOption` (raceOptions.ts), so a choice that lifts a race's limits ({}) stays lifted.
import { listsClasses as racesListClasses } from './classLimits.ts';

interface Entry {
  kind: string;
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A level a class's `raceMaxLevels` may give: null (no limit) or a whole number from 1. */
const isCap = (value: unknown): value is number | null => value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 1);

/** A race whose `classMaxLevels` lists classes: only those are open to it (classLimits.ts, the one reader). */
const listsClasses = (race: Entry): race is Entry & { data: { classMaxLevels: Record<string, unknown> } } => racesListClasses(race.data);

/**
 * The entries with each race's `classMaxLevels` widened by the classes that name it in their `raceMaxLevels`.
 * The race wins when it already names the class; a race no class names, and a race with no class limits (an empty
 * or missing table: every class is open already), is returned as it was. Other entries are returned as they were.
 */
export function withClassReach<T extends Entry>(entries: readonly T[]): T[] {
  const reach = new Map<string, Record<string, number | null>>();
  for (const klass of entries) {
    if (klass.kind !== 'class' || !isRecord(klass.data.raceMaxLevels)) continue;
    for (const [raceId, cap] of Object.entries(klass.data.raceMaxLevels)) {
      if (!isCap(cap)) continue;
      reach.set(raceId, { ...reach.get(raceId), [klass.packEntryId]: cap });
    }
  }
  if (reach.size === 0) return [...entries];
  return entries.map((entry) => {
    const adds = entry.kind === 'race' ? reach.get(entry.packEntryId) : undefined;
    if (!adds || !listsClasses(entry)) return entry;
    return { ...entry, data: { ...entry.data, classMaxLevels: { ...adds, ...entry.data.classMaxLevels } } };
  });
}

/**
 * The checker's notes on `raceMaxLevels` (warnings, never errors): a race id none of these entries has (another
 * attached pack may bring it; `library` says these are every pack being checked), a clash with a race that already
 * names the class (the race wins), and a level that isn't null or a whole number from 1.
 */
export function classReachNotes(entries: readonly Entry[], library = false): string[] {
  const races = new Map(entries.filter((e) => e.kind === 'race').map((e) => [e.packEntryId, e]));
  const notes: string[] = [];
  for (const klass of entries) {
    if (klass.kind !== 'class' || klass.data.raceMaxLevels === undefined) continue;
    const where = `classes: "${klass.packEntryId}"`;
    if (!isRecord(klass.data.raceMaxLevels)) {
      notes.push(`${where}: raceMaxLevels should be a table of race ids and levels, like { "race-reedfolk": 8 }.`);
      continue;
    }
    for (const [raceId, cap] of Object.entries(klass.data.raceMaxLevels)) {
      if (!isCap(cap)) {
        notes.push(`${where}: raceMaxLevels gives "${raceId}" ${JSON.stringify(cap)}; it should be a whole number from 1, or null for no limit. It is left out.`);
        continue;
      }
      const race = races.get(raceId);
      if (!race) {
        notes.push(
          library
            ? `${where}: raceMaxLevels names "${raceId}", which isn't a race in any of these packs.`
            : `${where}: raceMaxLevels names "${raceId}", which isn't one of this pack's races. Another attached pack must supply it (check them together: npm run pack:check -- <base> <this>).`,
        );
      } else if (listsClasses(race) && klass.packEntryId in race.data.classMaxLevels) {
        notes.push(`${where}: raceMaxLevels gives "${raceId}" ${JSON.stringify(cap)}, but that race already names this class (${JSON.stringify(race.data.classMaxLevels[klass.packEntryId])}); the race's own limit counts.`);
      } else if (!listsClasses(race)) {
        notes.push(`${where}: raceMaxLevels names "${raceId}", which has no class limits (every class is open to it), so this limit isn't used.`);
      }
    }
  }
  return notes;
}
