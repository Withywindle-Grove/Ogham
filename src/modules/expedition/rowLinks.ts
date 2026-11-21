// A table row's links across the campaign's attached packs (December step 5a; docs/plans/dec-5-encounters.md; 07
// References: `statBlockRef` and `tableRef` take the form "<meta.id>:<id>", same-pack links use `statBlockId` and
// `tableId`). Resolved once, where the tables are read, so every reader keeps working with plain ids: a link that
// resolves becomes the entry's id; one that doesn't is listed on the row as missing, shown with the row's own words,
// and never stops anything. Pure.
import type { ReadTable, TableRow } from './tables.ts';

/** An entry's id made readable for the missing-link line: hyphens to spaces, a capital first letter ("salt-hag" → "Salt hag"). */
const readableId = (id: string): string => {
  const words = id.trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** One missing link in words: "Salt hag (fen-rules)"; a plain id, naming no pack, is the name alone. */
const missingRefWords = (ref: string): string => {
  const at = ref.indexOf(':');
  if (at < 0) return readableId(ref);
  return `${readableId(ref.slice(at + 1))} (${ref.slice(0, at).trim()})`;
};

/**
 * The words for links a row names that the campaign's packs don't have (Francis's pick "b", 2026-11-12): "Not in your
 * packs: Bellringer (mire-zine)", each entry by its readable id with its pack's id in brackets (his only handle for
 * finding the pack), several listed with commas. A creature's link and a table's read the same. (Row links carry no
 * label of their own in the pack format, so the name is always the readable id.)
 */
export const missingWords = (refs: readonly string[]): string => `Not in your packs: ${refs.map(missingRefWords).join(', ')}`;

/** What a link is resolved against: the attached packs (the id links name each by, `refId`) and the setting's entries. */
export interface LinkSources {
  packs: readonly { packId: string; refId?: string | null }[];
  /** Entries with the pack each came from (and, after stacking, the other packs that have it too). */
  entries: readonly { kind: string; packEntryId: string; packId?: string; alsoIn?: readonly string[] }[];
}

/** What resolving looks up, built once: each kind-and-id's packs (its winner and the others that have it), and each pack id's packs. */
export interface LinkIndex {
  entries: Map<string, Set<string>>;
  packs: Map<string, string[]>;
}

export function linkIndex(sources: LinkSources): LinkIndex {
  const entries = new Map<string, Set<string>>();
  for (const e of sources.entries) {
    const key = `${e.kind}/${e.packEntryId}`;
    const set = entries.get(key) ?? new Set<string>();
    for (const packId of [e.packId, ...(e.alsoIn ?? [])]) if (packId) set.add(packId);
    entries.set(key, set);
  }
  const packs = new Map<string, string[]>();
  for (const p of sources.packs) if (p.refId) packs.set(p.refId, [...(packs.get(p.refId) ?? []), p.packId]);
  return { entries, packs };
}

/**
 * The entry id a link names, or null when the campaign's packs don't have it. "<meta.id>:<id>" must be in a pack with
 * that id (several may share one: any of them; as its winner or one of the packs that also have it); a plain id may
 * be in any attached pack.
 */
export function resolveLink(ref: string, kind: 'statBlock' | 'table', index: LinkIndex): string | null {
  const at = ref.indexOf(':');
  if (at < 0) return index.entries.has(`${kind}/${ref}`) ? ref : null;
  const id = ref.slice(at + 1).trim();
  const inPacks = index.entries.get(`${kind}/${id}`);
  const named = index.packs.get(ref.slice(0, at).trim()) ?? [];
  return id && inPacks && named.some((packId) => inPacks.has(packId)) ? id : null;
}

/** A row with its links resolved: its stat block and next table as plain ids, and what couldn't be found. */
function withLinks(row: TableRow, sources: LinkIndex): TableRow {
  const missing: string[] = [];
  const statRef = row.statBlockRef ?? row.statBlockId;
  const statBlockId = statRef ? resolveLink(statRef, 'statBlock', sources) : null;
  if (statRef && !statBlockId) missing.push(statRef);
  const tableLink = row.link ? resolveLink(row.link, 'table', sources) : null;
  if (row.link && !tableLink) missing.push(row.link);
  // Several creatures on the row (pf-2, December 5b): each resolved the same way.
  const creatures = (row.creatures ?? []).map((c) => ({ ...c, statBlockId: resolveLink(c.ref, 'statBlock', sources) }));
  for (const c of creatures) if (!c.statBlockId) missing.push(c.ref);
  // A link named twice is said once.
  return { ...row, statBlockId, tableLink, missing: [...new Set(missing)], creatures };
}

/** The tables with every row's links resolved against the campaign's packs (a new map; the tables read are kept). */
export function withRowLinks(tables: ReadonlyMap<string, ReadTable>, sources: LinkSources): Map<string, ReadTable> {
  const index = linkIndex(sources);
  const out = new Map<string, ReadTable>();
  for (const [id, table] of tables) out.set(id, { ...table, rows: table.rows.map((row) => withLinks(row, index)) });
  return out;
}
