// The in-app editor's saving (docs/07-content-packs.md, In-app editor, Homebrew): the GM makes and changes
// entries in the campaign's own homebrew pack, which starts on the first save. An entry with the same kind and
// id as one in other setting rules is a homebrew version of it, and wins (homebrew sits on top); deleting it
// brings the other back. Every change is logged in the campaign by the database.
import { defineCommand, failed, fromWrite, isGm, ok, type CommandResult } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import { startHomebrew } from './campaignPacks.ts';
import { checkEntry } from './editor.ts';
import type { EntryKind } from './packFile.ts';

/** The GM saves an entry (new or changed) into the campaign's homebrew. Returns its id. */
export const saveHomebrewEntry = defineCommand({
  name: 'homebrew.save',
  target: (input: { campaignId: string; campaignName: string; kind: EntryKind; data: Record<string, unknown> }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, user, input): Promise<CommandResult<string>> => {
    const problems = checkEntry(input.kind, input.data);
    if (problems.length > 0) return failed(problems.join(' '));
    const home = await startHomebrew.run(db, user, { campaignId: input.campaignId, campaignName: input.campaignName });
    if (!home.ok) return home;
    const id = String(input.data.id);
    // Treasure types, hooks and sheet layouts may have no name of their own: the letter or id stands in.
    const named = typeof input.data.name === 'string' && input.data.name.trim() !== '' ? input.data.name.trim() : null;
    const name = named ?? String(input.data.letter ?? id);
    const data = (named ? { ...input.data, name: named } : input.data) as Json;
    const existing = await db.from('library_entries').select('id').eq('pack_id', home.value).eq('kind', input.kind).eq('pack_entry_id', id).maybeSingle();
    if (existing.error) return failed("Couldn't read the campaign's homebrew. Try again.");
    const saved = existing.data
      ? fromWrite(await db.from('library_entries').update({ name, data }).eq('id', existing.data.id).select('id'))
      : fromWrite(await db.from('library_entries').insert({ pack_id: home.value, kind: input.kind, pack_entry_id: id, name, data }).select('id'));
    return saved.ok ? ok(id) : saved;
  },
});

/** The GM deletes an entry from the campaign's homebrew (another pack's version of it, if any, applies again). */
export const deleteHomebrewEntry = defineCommand({
  name: 'homebrew.delete',
  target: (input: { campaignId: string; kind: EntryKind; packEntryId: string }) => ({ campaignId: input.campaignId }),
  allowed: (user, target) => isGm(user, target.campaignId),
  run: async (db, _user, input): Promise<CommandResult<{ id: string }>> => {
    const home = await db.from('packs').select('id').eq('campaign_id', input.campaignId).maybeSingle();
    if (home.error) return failed("Couldn't read the campaign's homebrew. Try again.");
    if (!home.data) return failed('That isn’t in the campaign’s homebrew.');
    return fromWrite(
      await db.from('library_entries').delete().eq('pack_id', home.data.id).eq('kind', input.kind).eq('pack_entry_id', input.packEntryId).select('id'),
    );
  },
});

/** The row id of an item in the campaign's homebrew (after saving it), or null. */
export async function findHomebrewItem(db: Db, campaignId: string, packEntryId: string): Promise<string | null> {
  const home = await db.from('packs').select('id').eq('campaign_id', campaignId).maybeSingle();
  if (!home.data) return null;
  const entry = await db.from('library_entries').select('id').eq('pack_id', home.data.id).eq('kind', 'item').eq('pack_entry_id', packEntryId).maybeSingle();
  return entry.data?.id ?? null;
}
