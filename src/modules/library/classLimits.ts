// Class limits, in one place (07 "Creation rules as data: the survey's fields"; design/rulings/
// m5b-0c-creation-survey-2026-11-03.md cs-3, design/rulings/m5b-0c-creation-recheck-2026-11-03.md rc-5).
//   A race's class limits: `classMaxLevels` (with every class's `raceMaxLevels` already merged in by withClassReach,
//   raceReach.ts, and the race's `byOption` already applied by withRaceOptions, raceOptions.ts) and `npcOnlyClasses`.
//   An entry is a level, `null` (no limit) or `{ maxLevel?, soft: true }`. A class the table doesn't name, or one the
//   race names NPC-only, is closed: a **hard** limit. A soft entry is open with the GM's special approval (ca-3).
//   A class's `alignments`: a list of alignment names (hard), or `{ ids, soft: true }` (soft: special approval).
// Every reader (the class offer, the fit line, the entry's headings, the level cap, the level explainer) reads these
// two functions, so nothing reads `classMaxLevels` on its own. Pure.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isLevel = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1;

/** What a race allows of one class. */
export interface ClassLimit {
  /** False when a hard limit closes the class to the race. */
  open: boolean;
  /** Open only with the GM's special approval (a soft entry). */
  soft: boolean;
  /** The highest level the race reaches in the class; null when the race sets none. */
  maxLevel: number | null;
  /** Why it's closed: the race's class table leaves it out, or names it NPC-only; null when open. */
  closedBy: 'unlisted' | 'npc-only' | null;
}

const OPEN: ClassLimit = { open: true, soft: false, maxLevel: null, closedBy: null };

/** Whether a race's `classMaxLevels` lists classes (only those are open). An empty or missing table sets no limits. */
export function listsClasses(race: Record<string, unknown> | null | undefined): race is Record<string, unknown> & { classMaxLevels: Record<string, unknown> } {
  return !!race && isRecord(race.classMaxLevels) && Object.keys(race.classMaxLevels).length > 0;
}

/** One `classMaxLevels` entry read: a level, null, or `{ maxLevel?, soft? }`; null when it isn't one of these. */
export function readLimitEntry(value: unknown): { maxLevel: number | null; soft: boolean } | null {
  if (value === null) return { maxLevel: null, soft: false };
  if (isLevel(value)) return { maxLevel: value, soft: false };
  if (isRecord(value) && (value.maxLevel === undefined || value.maxLevel === null || isLevel(value.maxLevel)) && (value.soft === undefined || typeof value.soft === 'boolean')) {
    return { maxLevel: isLevel(value.maxLevel) ? value.maxLevel : null, soft: value.soft === true };
  }
  return null;
}

/**
 * What this race (its data, as the setting reads it) allows of this class: closed when it names the class NPC-only or
 * its class table leaves it out; open, soft or not, with the level cap its entry gives. No race: open, no cap.
 * An entry in a shape the app doesn't know counts as open with no cap (pack:check names it).
 */
export function raceClassLimit(race: Record<string, unknown> | null | undefined, classId: string): ClassLimit {
  if (!race) return OPEN;
  if (Array.isArray(race.npcOnlyClasses) && race.npcOnlyClasses.includes(classId)) return { open: false, soft: false, maxLevel: null, closedBy: 'npc-only' };
  if (!listsClasses(race)) return OPEN;
  if (!(classId in race.classMaxLevels)) return { open: false, soft: false, maxLevel: null, closedBy: 'unlisted' };
  const entry = readLimitEntry(race.classMaxLevels[classId]);
  return entry ? { open: true, soft: entry.soft, maxLevel: entry.maxLevel, closedBy: null } : OPEN;
}

/** A class's alignment limit: the names it may take, and whether the others need the GM's special approval (soft). */
export interface AlignmentLimit {
  names: string[];
  soft: boolean;
}

const names = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim()) : []);

/** The class's `alignments` (a list: hard; `{ ids, soft: true }`: soft); null when it sets none. */
export function classAlignmentLimit(klass: Record<string, unknown> | null | undefined): AlignmentLimit | null {
  if (!klass) return null;
  const raw = klass.alignments;
  if (Array.isArray(raw)) return names(raw).length > 0 ? { names: names(raw), soft: false } : null;
  if (isRecord(raw) && names(raw.ids).length > 0) return { names: names(raw.ids), soft: raw.soft === true };
  return null;
}

/** How an alignment sits with the class's limit: allowed, needs special approval (soft), or not open (hard). */
export function alignmentFit(limit: AlignmentLimit | null, alignment: string): 'ok' | 'soft' | 'closed' {
  if (!limit || !alignment.trim()) return 'ok';
  if (limit.names.some((n) => n.toLowerCase() === alignment.trim().toLowerCase())) return 'ok';
  return limit.soft ? 'soft' : 'closed';
}

interface Entry {
  kind: string;
  packEntryId: string;
  data: Record<string, unknown>;
}

/**
 * The checker's notes on class limits (warnings): a `classMaxLevels` entry in a shape the app doesn't read, a class's
 * `alignments` in another shape, and the three old places cs-3 folds into the race's class limits
 * (`classes[].kindreds`, `races[].forbiddenClasses`, a rules set's `creationRestrictions`), which the app doesn't read.
 */
export function classLimitNotes(entries: readonly Entry[]): string[] {
  const notes: string[] = [];
  for (const race of entries.filter((e) => e.kind === 'race')) {
    const where = `races: "${race.packEntryId}"`;
    if (race.data.classMaxLevels !== undefined && !isRecord(race.data.classMaxLevels)) {
      notes.push(`${where}: classMaxLevels should be a table of class ids and levels, like { "lantern-warden": 8 }; it is read as no class limits.`);
    } else if (isRecord(race.data.classMaxLevels)) {
      for (const [classId, value] of Object.entries(race.data.classMaxLevels)) {
        if (!readLimitEntry(value)) notes.push(`${where}: classMaxLevels gives "${classId}" ${JSON.stringify(value)}; it should be a level, null (no limit) or { "maxLevel": 8, "soft": true }. The class is open with no level cap.`);
      }
    }
    if (race.data.forbiddenClasses !== undefined) {
      notes.push(`${where}: forbiddenClasses isn't read; leave those classes out of classMaxLevels instead (one place for class limits, cs-3).`);
    }
  }
  for (const klass of entries.filter((e) => e.kind === 'class')) {
    const where = `classes: "${klass.packEntryId}"`;
    if (klass.data.kindreds !== undefined) {
      notes.push(`${where}: kindreds isn't read; name the class in each race's classMaxLevels instead (or in this class's raceMaxLevels), with { "soft": true } where the GM's leave is needed (cs-3).`);
    }
    if (klass.data.alignments !== undefined && !classAlignmentLimit(klass.data)) {
      notes.push(`${where}: alignments should be a list of alignment names, like ["Lantern", "Reed"], or { "ids": [...], "soft": true }; it is left out.`);
    }
  }
  for (const rules of entries.filter((e) => e.kind === 'rulesSet' && e.data.creationRestrictions !== undefined)) {
    notes.push(`rulesSets: "${rules.packEntryId}": creationRestrictions isn't read; put class limits in the races' classMaxLevels and alignment limits in the classes' alignments (cs-3).`);
  }
  return notes;
}
