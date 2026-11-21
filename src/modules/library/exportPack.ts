// Export as a pack file (07; a homebrew's ⋯ since 2026-10-24, every pack's ⋯ in the Rules library since lr-3,
// 2026-11-02): a `tabletop-pack` file with the pack's details and its entries, part by part. Pure; the caller
// downloads it. No campaign state goes in it.
import type { Db } from '../../core/supabase.ts';
import { loadPackEntries } from './library.ts';
import { PACK_PARTS, type PackEntry, type PackKind } from './packFile.ts';

export interface ExportMeta {
  name: string;
  version: string;
  kind: PackKind;
  source?: string;
  notes?: string;
  /** What else the file said about itself (its id, description, requires, author…), written back as it was. */
  extra?: Record<string, unknown>;
}

/** "Marsh Homebrew" → "marsh-homebrew": a pack id from its name, for a pack that has none. */
export function idFromName(name: string, fallback = 'pack'): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;
}

/** An entry's data without what the importer added to it (a hook's `giver` and `order`). */
function withoutImported(kind: string, data: Record<string, unknown>): Record<string, unknown> {
  if (kind !== 'adventureHook') return data;
  const rest = { ...data };
  delete rest.giver;
  delete rest.order;
  return rest;
}

/** The file to download and its name: "<id>.pack.json". */
export function packFile(meta: ExportMeta, entries: readonly Pick<PackEntry, 'kind' | 'packEntryId' | 'name' | 'data'>[]): { fileName: string; file: Record<string, unknown> } {
  const parts: Record<string, Record<string, unknown>[]> = {};
  for (const [part, kind] of Object.entries(PACK_PARTS)) {
    // A GM reference panel and a map are named by their `title` and a route by its places (07), so none gets a `name` added.
    // A hook's `giver` and `order` are the importer's, never the file's: they aren't written back.
    const ofKind = entries
      .filter((e) => e.kind === kind)
      .map((e) => (kind === 'gmReferencePanel' || kind === 'route' || kind === 'map' ? { ...e.data, id: e.packEntryId } : { ...withoutImported(kind, e.data), id: e.packEntryId, name: e.name }));
    if (ofKind.length > 0) parts[part] = ofKind;
  }
  const extra = meta.extra ?? {};
  const id = typeof extra.id === 'string' && extra.id.trim() ? extra.id.trim() : idFromName(meta.name, meta.kind === 'homebrew' ? 'homebrew' : 'pack');
  const fileMeta: Record<string, unknown> = { ...extra, name: meta.name, id, kind: meta.kind, version: meta.version || '1' };
  if (meta.source) fileMeta.source = meta.source;
  if (meta.notes) fileMeta.notes = meta.notes;
  return { fileName: `${id}.pack.json`, file: { format: 'tabletop-pack', formatVersion: 2, meta: fileMeta, ...parts } };
}

/** One of your library's packs as a file, hidden fields included (it's your own). Null if it couldn't be read. */
export async function loadPackFile(db: Db, packId: string): Promise<ReturnType<typeof packFile> | null> {
  const [pack, entries] = await Promise.all([
    db.from('packs').select('name, version, kind, source, notes, extra_meta').eq('id', packId).maybeSingle(),
    loadPackEntries(db, packId),
  ]);
  if (pack.error || !pack.data || !entries) return null;
  const { name, version, kind, source, notes, extra_meta } = pack.data;
  return packFile({ name, version, kind: kind as PackKind, source, notes, extra: (extra_meta ?? {}) as Record<string, unknown> }, entries);
}
