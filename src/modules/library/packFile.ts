// Reading a setting-rules pack file (format "tabletop-pack", docs/07-content-packs.md) into entries for the
// library, without saving anything: what's in it, what couldn't be used and why. Reading is careful and never
// guesses: unknown parts and broken entries are reported, never dropped silently.

import { BRAND } from '../../brand.ts';
import { STORED_SEPARATOR } from '../../core/storedWords.ts';
import { checkHook, hookContext } from './hooks.ts';
import { classLimitNotes } from './classLimits.ts';
import { raceOptionNotes } from './raceOptions.ts';
import { hookEntries } from './adventureHooks.ts';
import { mapEntries } from './packMaps.ts';
import { ID } from './entryId.ts';
import { classReachNotes } from './raceReach.ts';
import { isRumoursTable } from './rumours.ts';

/** The kinds of entry a pack can hold, and the part of the file each comes from. */
export const PACK_PARTS = {
  fieldTemplates: 'fieldTemplate',
  items: 'item',
  classes: 'class',
  xpTables: 'xpTable',
  rulesSets: 'rulesSet',
  conditions: 'condition',
  lightTypes: 'lightType',
  statBlocks: 'statBlock',
  tables: 'table',
  calendars: 'calendar',
  // Version 2
  options: 'option',
  races: 'race',
  spells: 'spell',
  spellLists: 'spellList',
  treasureTypes: 'treasureType',
  startingKits: 'startingKit',
  hooks: 'hook',
  // M5b step 0b (ruled Now 2026-11-01): backgrounds, affiliations, signs… for the sheet's list fields.
  traitLists: 'traitList',
  // Ruled A 2026-11-03 (07 G-55, G-58), both the GM's: a pack's top-level GM reference panels, one entry each, and
  // drop-in places in a rules or overlay pack (kept until the prep space reads them).
  gmReference: 'gmReferencePanel',
  locations: 'location',
  // Overlay patches (of-13, of-14; options-gates PR 3b): one entry each, applied by the shared option reader.
  patches: 'patch',
  // Patrons (December step 1a; plans/m5b-patrons.md, pt-1 … pt-8): the gods a cleric follows, one entry each.
  patrons: 'patron',
  // An adventure's links between places (07 Adventure packs §3; December step 4 piece a, pt-f1): the GM's. A route's
  // `travel` is one amount or a list of ways of moving (src/modules/library/routes.ts reads both).
  routes: 'route',
  // An adventure's hooks (pf-7, pf-7a; dec-12 piece B): every hook its book offers, the GM's until one is sent (a send
  // is its own record, public.hook_sends). Read by adventureHooks.ts, not the loop below, so the checker and the
  // importer read them alike.
  adventureHooks: 'adventureHook',
  // An adventure's maps (07 Adventure packs §9; dec-7 piece 5m-1): the `images` of type `map`, the GM's (the picture
  // files stay with the GM). Read by packMaps.ts, not the loop below, so the checker and the importer read them alike;
  // a handout, art or a crop is left out, said once.
  images: 'map',
} as const;

export type PackPart = keyof typeof PACK_PARTS;
export type EntryKind = (typeof PACK_PARTS)[PackPart];
export type PackKind = 'setting' | 'adventure' | 'homebrew';
/** The kinds of entry players may read (like the database's access rules); the rest are the GM's. */
// Rules sets from M4 step 4 (2026-10-23): players get them without their GM-only sections (the database keeps those apart).
// From M4b, XP tables and hooks too: hooks run on the player's device (ruled 2026-10-23).
// From M5b step 0b, trait lists: players pick from them at creation and on the sheet (ruled 2026-11-01).
// From M5b step 0c (cf-5, 2026-11-02), sheet layouts: a layout holds nothing secret, and a player's device needs its
// per-race lists (`from` as a pattern) and field option gates at creation.
// From options-gates PR 3b (of-13, bq3-16), patches: a player's device applies them to the entries it reads (an
// armour's AC, a weapon's damage); a patch names fields and numbers of entries players already read.
// From December step 1a, patrons: players pick one at creation and read its entry (the follower page is player-
// readable, m5b-patrons "not walked"); its `cult` and `statBlockId` stay the GM's (the database keeps them apart,
// PATRON_GM_FIELDS below).
export const PLAYER_FACING: readonly EntryKind[] = ['class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option', 'rulesSet', 'xpTable', 'hook', 'traitList', 'fieldTemplate', 'patch', 'patron'];

/** A patron's fields that never reach a player (hard rule 5; private.hidden_keys in the database): its cult and its lord's stat block. */
export const PATRON_GM_FIELDS: readonly string[] = ['cult', 'statBlockId'];

/** A rules set's sections players never read (07; G-45): a patch that changes one is the GM's. */
const RULES_SET_GM_SECTIONS = ['monsters', 'magicItems', 'procedures', 'gmReference'];

/** What a patch's targets say about who reads it (private.patch_open_to_me in the database). */
export interface PatchTargets {
  /** Whether the reader may read this item (private.item_readable: for sale, revealed, or in a kit). */
  itemReadable: (id: string) => boolean;
  /** The hidden fields (gmOnly lists, a rules set's GM-only sections) of every entry the patch may match. */
  hiddenKeys: (match: { kind: string; category: string; ids: string[] }) => string[];
}

const isRecordValue = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The ids a patch's match names, trimmed, blanks left out (private.patch_ids; none means the whole kind). */
export function patchIds(match: unknown): string[] {
  const ids = isRecordValue(match) && Array.isArray(match.ids) ? match.ids : [];
  return ids.flatMap((id) => (id === null || id === undefined ? [] : [(typeof id === 'string' ? id : JSON.stringify(id)).trim()])).filter(Boolean);
}

/** The first key of each path a patch changes ("armour.ac" -> "armour"), trimmed (private.patch_heads). */
export function patchHeads(change: unknown): string[] {
  return isRecordValue(change) ? [...new Set(Object.keys(change).map((path) => (path.trim().split('.')[0] ?? '').trim()))] : [];
}

/**
 * Whether players read this whole entry (private.player_facing_entry and, given `targets`, private.patch_open_to_me
 * in the database; hard rule 5): a player-facing kind, and for a patch (fresh-session review of 2026-11-04;
 * look-back review of #437, 2026-11-10) one whose match names such a kind, that changes no entry's gmOnly list and no
 * GM-only section of a rules set; with its targets known, one naming only items the reader may read, and changing no
 * field an entry it may match keeps GM-only. A patch with no match kind is the GM's.
 */
export function playerFacingEntry(kind: string, data: unknown, targets?: PatchTargets): boolean {
  if (!PLAYER_FACING.includes(kind as EntryKind)) return false;
  if (kind !== 'patch') return true;
  const patch = isRecordValue(data) ? data : {};
  const match = isRecordValue(patch.match) ? patch.match : {};
  const matchKind = typeof match.kind === 'string' ? match.kind : '';
  if (!PLAYER_FACING.includes(matchKind as EntryKind)) return false;
  const heads = patchHeads(patch.change);
  if (heads.includes('gmOnly')) return false;
  if (matchKind === 'rulesSet' && heads.some((head) => RULES_SET_GM_SECTIONS.includes(head))) return false;
  if (!targets) return true;
  const ids = patchIds(match);
  if (matchKind === 'item' && ids.some((id) => !targets.itemReadable(id))) return false;
  const category = typeof match.category === 'string' ? match.category.trim() : '';
  const hidden = targets.hiddenKeys({ kind: matchKind, category, ids });
  return !heads.some((head) => hidden.includes(head));
}

const VERSION_2_PARTS: PackPart[] = ['options', 'races', 'spells', 'spellLists', 'treasureTypes', 'startingKits', 'hooks', 'traitLists'];
/** A valid entry id: lowercase letters, digits and dashes (its own file, entryId.ts, shared with adventureHooks.ts). */
export { ID } from './entryId.ts';

export interface PackEntry {
  kind: EntryKind;
  /** The entry's own id inside the pack (kept when the pack is updated). */
  packEntryId: string;
  name: string;
  data: Record<string, unknown>;
}

export interface PackMeta {
  name: string;
  version: string;
  kind: PackKind;
  /** The version the content actually follows (2 if it uses any version-2 part). */
  formatVersion: 1 | 2;
  source: string;
  notes: string;
  /** What else the file says about itself (author, licence…): kept and shown with the pack, not used. */
  extra: Record<string, unknown>;
}

/** The meta keys the app reads; the rest are kept as they are. */
const KNOWN_META = ['name', 'version', 'kind', 'source', 'notes'];

export interface ReadPack {
  meta: PackMeta;
  entries: PackEntry[];
  counts: Partial<Record<EntryKind, number>>;
  /** Things worth knowing that didn't stop anything (e.g. a mismatched version, an unknown part). */
  warnings: string[];
  /** Entries that were skipped, and why. */
  problems: string[];
}

export type ReadResult = { ok: true; pack: ReadPack } | { ok: false; message: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** A patch's name from what it does: "<byOption> · <kind>[ <category>][ <ids>]" (07, of-13). */
function patchName(raw: Record<string, unknown>): string {
  const match = isObject(raw.match) ? raw.match : {};
  const what = [text(match.kind), text(match.category), Array.isArray(match.ids) ? match.ids.map(String).join(', ') : ''].filter(Boolean).join(' ');
  // Stored as the entry's name and listed in update events: the old format, kept (the sweep's review, #561).
  return [text(raw.byOption), what].filter(Boolean).join(STORED_SEPARATOR);
}

export function readPackJson(fileText: string): ReadResult {
  let file: unknown;
  try {
    file = JSON.parse(fileText);
  } catch {
    return { ok: false, message: "That file isn't valid JSON." };
  }
  if (!isObject(file) || file.format !== 'tabletop-pack') {
    return { ok: false, message: 'That file isn\'t a setting-rules pack (its "format" should be "tabletop-pack").' };
  }
  const meta = isObject(file.meta) ? file.meta : {};
  const name = text(meta.name);
  if (!name) return { ok: false, message: 'The pack needs a name (meta.name).' };

  const warnings: string[] = [];
  const problems: string[] = [];
  const entries: PackEntry[] = [];

  for (const [key, value] of Object.entries(file)) {
    if (key === 'format' || key === 'formatVersion' || key === 'meta') continue;
    if (!(key in PACK_PARTS)) {
      warnings.push(`"${key}" isn't a part ${BRAND.appName} knows; it was left out.`);
      continue;
    }
    if (!Array.isArray(value)) {
      problems.push(`${key}: should be a list; skipped.`);
      continue;
    }
    const kind = PACK_PARTS[key as PackPart];
    // An adventure's hooks (dec-12 piece B): read as the checker reads them; what was off goes in the warnings.
    if (kind === 'adventureHook') {
      const read = hookEntries(file);
      warnings.push(...read.notes);
      entries.push(...read.entries);
      continue;
    }
    // An adventure's maps (5m-1): read as the checker reads them; what was off goes in the warnings.
    if (kind === 'map') {
      const read = mapEntries(file);
      warnings.push(...read.notes);
      entries.push(...read.entries);
      continue;
    }
    const seen = new Set<string>();
    value.forEach((raw, index) => {
      if (!isObject(raw)) return problems.push(`${key}: entry ${index + 1} isn't an entry; skipped.`);
      // A patch has no id of its own in the file (07, of-13): its place in the list names it, so an update replaces
      // the list as a whole; its name says what it does ("mire-metals=bronze · item armour").
      const id = kind === 'patch' && !text(raw.id) ? `patch-${index + 1}` : text(raw.id);
      if (!id) return problems.push(`${key}: entry ${index + 1} has no id; skipped.`);
      if (!ID.test(id)) return problems.push(`${key}: "${id}" isn't a valid id (lowercase letters, digits and dashes); skipped.`);
      if (seen.has(id)) return problems.push(`${key}: "${id}" appears twice; the second was skipped.`);
      seen.add(id);
      // A GM reference panel is named by its `title` (07 gmReference).
      const name = (kind === 'gmReferencePanel' ? text(raw.title) : '') || text(raw.name) || (kind === 'patch' ? patchName(raw) : '') || id;
      // A rumours table is the GM's (dec-12 E, hard rule 5): opened to players, its rows' truth would reach them, so it
      // is refused. The database hides a table's rows only by keeping the whole table from players.
      if (kind === 'table' && raw.gmOnly === false && isRumoursTable(raw)) {
        return problems.push(`${key}: "${name}" is a table of rumours marked "gmOnly": false, which would show players whether each rumour is true; skipped. Take "gmOnly": false off: a table of rumours is the GM's, and a rumour reaches players when the GM gives it.`);
      }
      // The database hides only the entry's own (top-level) fields; anything else in gmOnly hides nothing. One
      // exception: a table's `"gmOnly": false` opens it to players (ruled 2026-11-02, fs-1).
      if (raw.gmOnly !== undefined && !Array.isArray(raw.gmOnly) && !(kind === 'table' && raw.gmOnly === false)) {
        warnings.push(`${key}: "${name}" has gmOnly that isn't a list, so nothing is hidden. Write it like ["cursed"].`);
      } else if (Array.isArray(raw.gmOnly)) {
        for (const field of raw.gmOnly.map(String).filter((field) => !(field in raw) || field === 'gmOnly')) {
          warnings.push(`${key}: "${name}" hides "${field}", which isn't one of its own fields, so nothing is hidden. Name a field of the entry itself, like "fields".`);
        }
      }
      // An item's one-unit and plural names (ruled 2026-10-26) are words the app shows: text only.
      if (kind === 'item') {
        for (const field of ['unitName', 'pluralName'].filter((f) => raw[f] !== undefined && (typeof raw[f] !== 'string' || !String(raw[f]).trim()))) {
          warnings.push(`${key}: "${name}" has a ${field} that isn't words, so the app says "${name} ×N" instead.`);
        }
      }
      // A trait list with nothing to pick from (07 traitLists) imports, and the preview says so.
      if (kind === 'traitList' && !(Array.isArray(raw.entries) && raw.entries.some(isObject))) {
        warnings.push(`${key}: "${name}" has no entries, so there is nothing to pick from it.`);
      }
      // A patron nobody may follow is never offered (December 1a): its `followers.classes` names the classes.
      if (kind === 'patron') {
        const followers = isObject(raw.followers) ? raw.followers : {};
        if (!Array.isArray(followers.classes) || followers.classes.filter((c) => typeof c === 'string' && c.trim()).length === 0) {
          warnings.push(`${key}: "${name}" names no follower classes (followers.classes), so no character is offered it.`);
        }
        if (raw.approval !== undefined && raw.approval !== 'gm') {
          warnings.push(`${key}: "${name}" has approval ${JSON.stringify(raw.approval)}; only "gm" is known, so it is read as free to pick.`);
        }
      }
      entries.push({ kind, packEntryId: id, name, data: raw });
    });
  }

  if (entries.length === 0) return { ok: false, message: 'The pack has no entries to import.' };

  // Hooks are checked against the spec at import (docs/07): the pack still imports, and the preview says what's off.
  const context = hookContext(entries);
  for (const entry of entries.filter((e) => e.kind === 'hook')) {
    const found = checkHook(entry.data, context);
    for (const message of [...found.problems, ...found.warnings]) warnings.push(`hooks: "${entry.packEntryId}": ${message}`);
  }

  // Creation methods (ruled 2026-10-25): what each choice says about races, and the methods it offers.
  const hasRaces = entries.some((e) => e.kind === 'race');
  for (const option of entries.filter((e) => e.kind === 'option' && e.data.ruleKey === 'creation-method')) {
    const choices = (Array.isArray(option.data.choices) ? option.data.choices : []).filter(isObject);
    const ids = choices.map((c) => String(c.id ?? ''));
    for (const choice of choices) {
      const where = `options: "${option.packEntryId}", choice "${String(choice.id ?? '')}"`;
      if (choice.races !== undefined && !['none', 'required', 'optional'].includes(String(choice.races))) {
        warnings.push(`${where}: races should be none, required or optional; it will be read as optional.`);
      }
      if (choice.races === 'required' && !hasRaces) {
        warnings.push(`${where}: says a race is required, but this pack has no races. Another attached pack must supply them, or the race step is skipped.`);
      }
      if (choice.methods !== undefined) {
        const methods = Array.isArray(choice.methods) ? choice.methods.map(String) : [];
        const unknown = methods.filter((m) => !ids.includes(m) || m === choice.id);
        if (!Array.isArray(choice.methods) || methods.length === 0) warnings.push(`${where}: methods should be a list of the option's other choice ids.`);
        else if (unknown.length > 0) warnings.push(`${where}: methods names ${unknown.map((m) => `"${m}"`).join(', ')}, which ${unknown.length === 1 ? "isn't" : "aren't"} another choice of this option.`);
      }
    }
  }

  // An empty classMaxLevels table sets no class limits for the race (a conversion may lift them on purpose).
  for (const race of entries.filter((e) => e.kind === 'race' && isObject(e.data.classMaxLevels) && Object.keys(e.data.classMaxLevels).length === 0)) {
    warnings.push(`races: "${race.packEntryId}": classMaxLevels is empty, so this race has no class limits; every class is offered.`);
  }

  // A class reaching other packs' races (pg-2, ruled 2026-11-03): an unknown race id or a clash is a warning.
  warnings.push(...classReachNotes(entries));
  // Class limits in one place, hard or soft (cs-3), and races' fields switched by an option (cs-5).
  warnings.push(...classLimitNotes(entries), ...raceOptionNotes(entries));

  // Default race (ruled 2026-10-26): a rules set's defaultRace names a race id; without one, guided creation asks
  // for a race even where the method says it's optional.
  const raceIds = new Set(entries.filter((e) => e.kind === 'race').map((e) => e.packEntryId));
  for (const rules of entries.filter((e) => e.kind === 'rulesSet' && e.data.defaultRace !== undefined)) {
    const named = rules.data.defaultRace;
    const where = `rulesSets: "${rules.packEntryId}"`;
    if (typeof named !== 'string' || !named.trim()) warnings.push(`${where}: defaultRace should be a race's id, like "race-reedfolk".`);
    else if (hasRaces && !raceIds.has(named)) warnings.push(`${where}: defaultRace names "${named}", which isn't one of this pack's races. Another attached pack must supply it.`);
  }

  const usedVersion2 = VERSION_2_PARTS.filter((part) => Array.isArray(file[part]) && (file[part] as unknown[]).length > 0);
  const declared = file.formatVersion === 2 ? 2 : 1;
  if (file.formatVersion !== undefined && file.formatVersion !== 1 && file.formatVersion !== 2) {
    warnings.push(
      `The file says format version ${JSON.stringify(file.formatVersion)}, which ${BRAND.appName} doesn't know; it was read as version ${usedVersion2.length > 0 ? 2 : 1}. Check the entries before saving.`,
    );
  }
  if (declared === 1 && usedVersion2.length > 0) {
    warnings.push(
      `The file says format version 1 but uses version-2 parts (${usedVersion2.join(', ')}); it was read as version 2.`,
    );
  }

  const counts: Partial<Record<EntryKind, number>> = {};
  for (const entry of entries) counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
  const kind = meta.kind === 'adventure' || meta.kind === 'homebrew' ? meta.kind : 'setting';

  return {
    ok: true,
    pack: {
      meta: {
        name,
        version: text(meta.version),
        kind,
        formatVersion: declared === 2 || usedVersion2.length > 0 ? 2 : 1,
        source: text(meta.source),
        notes: text(meta.notes),
        extra: Object.fromEntries(Object.entries(meta).filter(([key]) => !KNOWN_META.includes(key))),
      },
      entries,
      counts,
      warnings,
      problems,
    },
  };
}

/** The same value written the same way whatever order its keys are in (the database reorders them). Lists keep their order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

type Listed = { kind: EntryKind; packEntryId: string; name: string };
const key = (entry: { kind: string; packEntryId: string }) => `${entry.kind}/${entry.packEntryId}`;
const listed = (entry: PackEntry): Listed => ({ kind: entry.kind, packEntryId: entry.packEntryId, name: entry.name });

/** What updating a pack from a newer file would add, change and remove (matched by kind and id). */
export function comparePacks(
  before: PackEntry[],
  after: PackEntry[],
): { added: Listed[]; changed: Listed[]; removed: Listed[]; unchanged: number } {
  const old = new Map(before.map((entry) => [key(entry), entry]));
  const fresh = new Map(after.map((entry) => [key(entry), entry]));
  const added: Listed[] = [];
  const changed: Listed[] = [];
  let unchanged = 0;
  for (const entry of after) {
    const was = old.get(key(entry));
    if (!was) added.push(listed(entry));
    else if (canonical(was.data) !== canonical(entry.data) || was.name !== entry.name) changed.push(listed(entry));
    else unchanged += 1;
  }
  const removed = before.filter((entry) => !fresh.has(key(entry))).map(listed);
  return { added, changed, removed, unchanged };
}
