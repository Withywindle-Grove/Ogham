// An adventure's hooks (docs/design/rulings/dec-pack-formats-2026-11-11.md, pf-7 and pf-7a): every hook its book
// offers, `adventureHooks: [{ id, name, text, pays, giverNpcId? }]` at the top of an adventure pack, the text in the
// book's own words. Not `hooks`: that name is the format's rule hooks (07, "Rule hooks"). GM-only until sent.
//
// Pure, shared by the app's importer (packFile.ts), the GM's calls to adventure (callsToAdventure.ts) and the pack
// checker (scripts/pack-adventure-hooks.mjs). Lenient like the importer: odd entries are left out or read as empty,
// and each is said in a note. From dec-12 piece B the importer keeps each hook as a library entry of kind
// `adventureHook`, which is not player-facing: the database's read rule on library entries keeps them from players,
// and a hook's words reach a player only through a send (public.hook_sends).
import { ID } from './entryId.ts';
import { plainLinks } from './linkMarks.ts';
import type { PackEntry } from './packFile.ts';

/** One hook as the app reads it. Missing words read as empty; no giver reads as null. */
export interface AdventureHook {
  id: string;
  name: string;
  /** The hook in the book's own words: the GM's until it is sent. */
  text: string;
  /** What it pays, as the book says it. */
  pays: string;
  /** The npc who gives it, in this pack; null when it is posted at a place rather than given by a person (pf-7a). */
  giverNpcId: string | null;
}

export interface AdventureHooksRead {
  hooks: AdventureHook[];
  /** What was off, one line each, in the checker's words ("adventureHooks: …"). */
  notes: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const words = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** A pack file's adventure hooks, in the file's order. Never throws on odd input. */
export function readAdventureHooks(file: unknown): AdventureHooksRead {
  const hooks: AdventureHook[] = [];
  const notes: string[] = [];
  if (!isObject(file) || file.adventureHooks === undefined) return { hooks, notes };
  if (!Array.isArray(file.adventureHooks)) return { hooks, notes: ['adventureHooks: should be a list of hooks, each { id, name, text, pays, giverNpcId? }; none was read.'] };
  const seen = new Set<string>();
  file.adventureHooks.forEach((raw: unknown, index: number) => {
    if (!isObject(raw)) return notes.push(`adventureHooks: entry ${index + 1} isn't a hook; skipped.`);
    const id = words(raw.id);
    if (!id) return notes.push(`adventureHooks: entry ${index + 1} has no id; skipped.`);
    if (!ID.test(id)) return notes.push(`adventureHooks: "${id}" isn't a valid id (lowercase letters, digits and dashes); skipped.`);
    if (seen.has(id)) return notes.push(`adventureHooks: entry ${index + 1} repeats "${id}"; skipped (the first is kept).`);
    seen.add(id);
    const where = `adventureHooks: "${id}"`;
    // A field that is there but isn't text is said as such, not as missing (#690's review).
    const field = (key: 'name' | 'text' | 'pays', missing: string, after: string): string => {
      const value = raw[key];
      const read = words(value);
      if (!read) notes.push(value !== undefined && value !== null && typeof value !== 'string' ? `${where}: ${key} isn't words; ${after}` : `${where} has no ${missing}; ${after}`);
      return read;
    };
    const name = field('name', 'name', 'the GM sees its id.');
    const text = field('text', "text (the hook in the book's own words)", 'it reads as empty.');
    const pays = field('pays', 'pays (what it pays, in words)', 'it reads as empty.');
    let giverNpcId: string | null = null;
    if (raw.giverNpcId !== undefined && raw.giverNpcId !== null) {
      giverNpcId = words(raw.giverNpcId) || null;
      if (!giverNpcId) notes.push(`${where}: giverNpcId should be an npc's id; it reads as no giver.`);
    }
    hooks.push({ id, name: name || id, text, pays, giverNpcId });
  });
  return { hooks, notes };
}

/** Who gives a hook, as the importer found them in the pack: the npc's name and role, and where they are. */
export interface HookGiver {
  name: string;
  /** The npc's role in the book's words ("reed-factor"); empty without one. */
  role: string;
  /** The place the npc is at, as the pack names it (its map key first, "3 The Reed Market"); empty without one. */
  place: string;
}

/** A hook as kept in the library: as read, with its giver's words (npcs are not kept as entries of their own). */
export interface StoredHook extends AdventureHook {
  giver: HookGiver | null;
  /** Its place in the pack's list (0 first); hooks stored before it was kept read as last. */
  order: number;
}

/** The pack's npc of that id, with the place it is at, as words for a hook's giver. */
function giverOf(file: Record<string, unknown>, npcId: string | null): HookGiver | null {
  if (!npcId) return null;
  const listOf = (part: string) => (Array.isArray(file[part]) ? (file[part] as unknown[]).filter(isObject) : []);
  const npc = listOf('npcs').find((n) => words(n.id) === npcId);
  if (!npc) return null;
  const name = words(npc.name);
  if (!name) return null;
  const placeId = words(npc.locationId);
  const place = placeId ? listOf('locations').find((l) => words(l.id) === placeId) : undefined;
  const placeName = place ? [words(place.key), words(place.name)].filter(Boolean).join(' ') : '';
  return { name, role: words(npc.role), place: placeName };
}

/**
 * The importer's entries for a pack's hooks (dec-12 piece B): one `adventureHook` entry each, its data the hook's
 * words, its giver's (`giver`, found from the pack's npcs and locations as it is read) and its place in the book
 * (`order`; library entries keep no order of their own), both dropped again on export,
 * and the reader's notes for the import's warnings.
 */
export function hookEntries(file: unknown): { entries: PackEntry[]; notes: string[] } {
  const { hooks, notes } = readAdventureHooks(file);
  const record = isObject(file) ? file : {};
  const entries: PackEntry[] = hooks.map((hook, order) => ({
    kind: 'adventureHook',
    packEntryId: hook.id,
    name: hook.name,
    data: { text: hook.text, pays: hook.pays, ...(hook.giverNpcId ? { giverNpcId: hook.giverNpcId } : {}), giver: giverOf(record, hook.giverNpcId), order },
  }));
  return { entries, notes };
}

/** A stored hook entry read back on the GM's device. Never throws on odd data. */
export function readStoredHook(entry: { packEntryId: string; name: string; data: unknown }): StoredHook {
  const data = isObject(entry.data) ? entry.data : {};
  const raw = isObject(data.giver) ? data.giver : null;
  const giverName = raw ? words(raw.name) : '';
  return {
    id: entry.packEntryId,
    name: words(entry.name) || entry.packEntryId,
    text: words(data.text),
    pays: words(data.pays),
    giverNpcId: words(data.giverNpcId) || null,
    giver: raw && giverName ? { name: giverName, role: words(raw.role), place: words(raw.place) } : null,
    order: typeof data.order === 'number' && Number.isInteger(data.order) && data.order >= 0 ? data.order : Number.MAX_SAFE_INTEGER,
  };
}

/** A hook's words as the GM reads and sends them: each link mark as its words (rp-11; the entry keeps the marks). */
export function plainHook(hook: StoredHook): StoredHook {
  return { ...hook, name: plainLinks(hook.name), text: plainLinks(hook.text), pays: plainLinks(hook.pays) };
}
