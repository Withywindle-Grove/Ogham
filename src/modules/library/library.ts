// Your library of setting rules (packs), private to your account. Importing or updating saves the pack and
// all its entries in one database step (import_pack), so nothing is ever half-saved. Library changes are
// account-level, not campaign events, so they aren't logged; attaching a pack to a campaign is (step 3).
import { defineCommand, failed, fromWrite, isGm, notAllowed, ok, type CommandResult } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import { allRows } from './allRows.ts';
import { checkEntry } from './editor.ts';
import { packWords, requiredIds } from './libraryList.ts';
import type { EntryKind, PackEntry, PackKind, ReadPack } from './packFile.ts';

export interface LibraryPack {
  id: string;
  ownerUserId: string;
  name: string;
  version: string;
  kind: PackKind;
  formatVersion: number;
  source: string;
  importedAt: string;
  counts: Partial<Record<EntryKind, number>>;
  /** What else the file said about itself (author, licence…). */
  extraMeta: Record<string, unknown>;
  /** The pack's own one-line description (`meta.description`), '' without one. */
  description: string;
  /** The `meta.id`s of the packs it needs (`meta.requires`). */
  requires: string[];
  /** The pack's words for its kinds, where its creation guide names them ("kindreds"; lr-2). */
  words: Partial<Record<EntryKind, [string, string]>>;
  /** The campaigns using it (that this person can see), by name. */
  usedBy: string[];
}

/**
 * Your packs, newest first, with how many entries of each kind they hold, their words for kinds (from each rules
 * set's creation guide) and the campaigns using them. Null if they couldn't be loaded.
 */
export async function loadLibrary(db: Db, userId: string): Promise<LibraryPack[] | null> {
  // Only your own: the database also sends packs of campaigns you play in, which aren't in your library.
  const packs = await db
    .from('packs')
    .select('id, owner_user_id, name, version, kind, format_version, source, updated_at, extra_meta')
    .eq('owner_user_id', userId)
    .is('campaign_id', null);
  if (packs.error) return null;
  const ids = packs.data.map((pack) => pack.id);
  const [entries, guides, uses] = await Promise.all([
    allRows((from, to) => db.from('library_entries').select('id, pack_id, kind').in('pack_id', ids).order('id').range(from, to)),
    // Only the creation guide of each rules set, not the whole set: its step titles are the pack's words for kinds.
    allRows((from, to) => db.from('library_entries').select('id, pack_id, guide:data->creationGuide').in('pack_id', ids).eq('kind', 'rulesSet').order('id').range(from, to)),
    db.from('campaign_packs').select('pack_id, campaigns(name)').in('pack_id', ids),
  ]);
  if (!entries || !guides || uses.error) return null;
  return packs.data
    .map((pack) => {
      const counts: Partial<Record<EntryKind, number>> = {};
      for (const entry of entries) {
        if (entry.pack_id === pack.id) counts[entry.kind as EntryKind] = (counts[entry.kind as EntryKind] ?? 0) + 1;
      }
      const extraMeta = (pack.extra_meta ?? {}) as Record<string, unknown>;
      const guide = guides.find((row) => row.pack_id === pack.id)?.guide;
      return {
        id: pack.id,
        ownerUserId: pack.owner_user_id,
        name: pack.name,
        version: pack.version,
        kind: pack.kind as PackKind,
        formatVersion: pack.format_version,
        source: pack.source,
        importedAt: pack.updated_at,
        counts,
        extraMeta,
        description: typeof extraMeta.description === 'string' ? extraMeta.description.trim() : '',
        requires: requiredIds(extraMeta.requires),
        words: packWords(guide),
        usedBy: uses.data
          .filter((use) => use.pack_id === pack.id)
          .map((use) => use.campaigns?.name ?? 'A campaign')
          .sort((a, b) => a.localeCompare(b)),
      };
    })
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

/**
 * Entries' hidden fields (an item's gmOnly ones), put back for those who may see them: the pack's owner and the
 * GM of a campaign using it. Everyone else gets nothing from the database, so their entries stay as they are.
 */
export async function withHiddenFields<T extends { id: string; data: Record<string, unknown> }>(
  db: Db,
  packIds: string[],
  rows: T[],
): Promise<T[] | null> {
  if (rows.length === 0) return rows;
  // By pack, not by entry: a list of a thousand entry ids is too long for one request.
  const found = await allRows((from, to) => db.from('library_entry_secrets').select('id, data').in('pack_id', packIds).order('id').range(from, to));
  if (!found) return null;
  const hidden = new Map(found.map((row) => [row.id, (row.data ?? {}) as Record<string, unknown>]));
  return rows.map((row) => (hidden.has(row.id) ? { ...row, data: { ...row.data, ...hidden.get(row.id) } } : row));
}

/** A pack's entries (what the database lets this person see). */
export async function loadPackEntries(db: Db, packId: string): Promise<PackEntry[] | null> {
  const data = await allRows((from, to) =>
    db.from('library_entries').select('id, kind, pack_entry_id, name, data').eq('pack_id', packId).order('id').range(from, to),
  );
  if (!data) return null;
  const whole = await withHiddenFields(db, [packId], data.map((row) => ({ ...row, data: (row.data ?? {}) as Record<string, unknown> })));
  if (!whole) return null;
  return whole.map((row) => ({ kind: row.kind as EntryKind, packEntryId: row.pack_entry_id, name: row.name, data: row.data }));
}

/** What import_pack takes: the pack's details and its entries. */
const toArgs = (pack: ReadPack): { meta: Json; entries: Json } => ({
  meta: {
    name: pack.meta.name,
    version: pack.meta.version,
    kind: pack.meta.kind,
    format_version: pack.meta.formatVersion,
    source: pack.meta.source,
    notes: pack.meta.notes,
    extra: pack.meta.extra as Json,
  },
  entries: pack.entries.map((entry) => ({
    kind: entry.kind,
    pack_entry_id: entry.packEntryId,
    name: entry.name,
    data: entry.data as Json,
  })),
});

/** Anyone signed in may import into their own library. Returns the new pack's id. */
export const importPack = defineCommand({
  name: 'library.import',
  log: 'none',
  target: () => ({}),
  allowed: () => true,
  run: async (db, _user, input: { pack: ReadPack }): Promise<CommandResult<string>> => {
    const { data, error } = await db.rpc('import_pack', toArgs(input.pack));
    if (error) return error.code === '42501' ? notAllowed() : failed("Couldn't save the setting rules. Nothing was saved; try again.");
    return ok(data);
  },
});

/**
 * Copies a campaign's homebrew to the GM's Rules library as an independent homebrew pack, "<name> (copy)" (ruled
 * 2026-10-25): a new pack with its own entries (hidden fields too), so later edits to either don't touch the other.
 * The campaign's homebrew stays with its campaign. Returns the new pack's id. Offered to the GM only; the
 * database lets a player copy only what they can already read, into their own library, so it doesn't stop that.
 */
export const copyHomebrewToLibrary = defineCommand({
  name: 'library.copyHomebrew',
  log: 'none',
  target: (input: { campaignId: string; packId: string; name: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const pack = await db.from('packs').select('id').eq('id', input.packId);
    if (pack.error) return failed("Couldn't read the homebrew. Nothing was copied; try again.");
    if (pack.data.length === 0) return notAllowed();
    const entries = await loadPackEntries(db, input.packId);
    if (!entries) return failed("Couldn't read the homebrew. Nothing was copied; try again.");
    if (entries.length === 0) return failed("There's nothing in it to copy yet.");
    const copy: ReadPack = {
      meta: { name: `${input.name} (copy)`, version: '1', kind: 'homebrew', formatVersion: 2, source: '', notes: '', extra: {} },
      entries,
      counts: {},
      warnings: [],
      problems: [],
    };
    const { data, error } = await db.rpc('import_pack', toArgs(copy));
    if (error) return error.code === '42501' ? notAllowed() : failed("Couldn't copy the homebrew. Nothing was saved; try again.");
    return ok(data);
  },
});

/**
 * Edits one entry of your own pack from the Rules library ("Edit pack" on a homebrew pack, ruled 2026-10-25).
 * Saved the way an update from a file is (import_pack), so every campaign using the pack logs the change; the
 * screen says first how many campaigns use it. The entry keeps its kind and id.
 */
export const editPackEntry = defineCommand({
  name: 'library.editEntry',
  log: 'none',
  target: (input: { packId: string; ownerUserId: string; kind: EntryKind; packEntryId: string; data: Record<string, unknown> }) => ({
    ownerUserId: input.ownerUserId,
  }),
  allowed: (user, target) => target.ownerUserId === user.id,
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const data: Record<string, unknown> = { ...input.data, id: input.packEntryId };
    const problems = checkEntry(input.kind, data);
    if (problems.length > 0) return failed(problems.join(' '));
    const pack = await db.from('packs').select('name, version, kind, format_version, source, notes, extra_meta').eq('id', input.packId).maybeSingle();
    if (pack.error) return failed("Couldn't read the pack. Nothing was changed; try again.");
    if (!pack.data) return notAllowed();
    const entries = await loadPackEntries(db, input.packId);
    if (!entries) return failed("Couldn't read the pack. Nothing was changed; try again.");
    const at = entries.findIndex((e) => e.kind === input.kind && e.packEntryId === input.packEntryId);
    if (at === -1) return failed("That entry isn't in the pack any more.");
    // Treasure types, hooks and sheet layouts may have no name of their own: the letter or id stands in (as homebrew).
    const named = typeof data.name === 'string' && data.name.trim() !== '' ? data.name.trim() : null;
    entries[at] = { kind: input.kind, packEntryId: input.packEntryId, name: named ?? String(data.letter ?? input.packEntryId), data: named ? { ...data, name: named } : data };
    const meta = pack.data;
    const updated: ReadPack = {
      meta: {
        name: meta.name,
        version: meta.version,
        kind: meta.kind as PackKind,
        formatVersion: meta.format_version === 1 ? 1 : 2,
        source: meta.source,
        notes: meta.notes,
        extra: (meta.extra_meta ?? {}) as Record<string, unknown>,
      },
      entries,
      counts: {},
      warnings: [],
      problems: [],
    };
    const { error } = await db.rpc('import_pack', { ...toArgs(updated), replace_pack_id: input.packId });
    if (error) return error.code === '42501' ? notAllowed() : failed("Couldn't save the change. Nothing was changed; try again.");
    return ok(input.packEntryId);
  },
});

/** The campaigns using a pack (that this person can see), by name. Null if they couldn't be loaded. */
export async function loadPackUses(db: Db, packId: string): Promise<{ campaignId: string; campaignName: string }[] | null> {
  const { data, error } = await db.from('campaign_packs').select('campaign_id, campaigns(name)').eq('pack_id', packId);
  if (error) return null;
  return data
    .map((row) => ({ campaignId: row.campaign_id, campaignName: row.campaigns?.name ?? 'A campaign' }))
    .sort((a, b) => a.campaignName.localeCompare(b.campaignName));
}

/**
 * Deletes one of your packs and all its entries for good. It leaves every campaign using it, and the database
 * records that in each one's log (as "library.delete", with the pack's name).
 */
export const deletePack = defineCommand({
  name: 'library.delete',
  target: (input: { packId: string; ownerUserId: string }) => ({ ownerUserId: input.ownerUserId }),
  allowed: (user, target) => target.ownerUserId === user.id,
  run: async (db, _user, input) => fromWrite(await db.from('packs').delete().eq('id', input.packId).select('id')),
});

/** Replaces a pack's contents with a newer file's (entries matched by kind and id). Your own packs only. */
export const updatePack = defineCommand({
  name: 'library.update',
  log: 'none',
  target: (input: { packId: string; ownerUserId: string; pack: ReadPack }) => ({ ownerUserId: input.ownerUserId }),
  allowed: (user, target) => target.ownerUserId === user.id,
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const { data, error } = await db.rpc('import_pack', { ...toArgs(input.pack), replace_pack_id: input.packId });
    if (error) return error.code === '42501' ? notAllowed() : failed("Couldn't update the setting rules. Nothing was changed; try again.");
    return ok(data);
  },
});
