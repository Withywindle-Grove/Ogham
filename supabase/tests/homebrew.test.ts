// The in-app editor saving into a campaign's own homebrew (docs/07-content-packs.md, In-app editor): the GM
// makes and changes entries; every change is logged in the campaign (players see lines for what they can
// read), Undo puts a change back, a homebrew version of a pack's entry wins over it, and a retired campaign's
// homebrew can't change. TEST project only; invented content.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { restoreCampaign, retireCampaign } from '../../src/core/campaignCommands.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { attachPack, loadCampaignEntries, loadCampaignPacks } from '../../src/modules/library/campaignPacks.ts';
import { deleteHomebrewEntry, saveHomebrewEntry } from '../../src/modules/library/homebrew.ts';
import { copyHomebrewToLibrary, editPackEntry, importPack, loadPackEntries } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { resolveStack } from '../../src/modules/library/stack.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const campaignName = 'The Reedmouth Delve';

beforeAll(async () => {
  world = await buildWorld();
  const read = readPackJson(
    JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'River Rules', version: '1' }, items: [{ id: 'rope', name: 'Rope', weightCoin: 50 }] }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId: made.value });
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id);
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

const save = (person: Person, kind: 'item' | 'statBlock', data: Record<string, unknown>) =>
  as(person, saveHomebrewEntry, { campaignId: world.campaignId, campaignName, kind, data });
/** What the campaign uses for this entry, as the stack resolves it. */
async function winner(kind: string, id: string) {
  const [entries, packs] = await Promise.all([loadCampaignEntries(asDb(world.gm), world.campaignId), loadCampaignPacks(asDb(world.gm), world.campaignId)]);
  const found = resolveStack(entries ?? [], packs ?? []).find((e) => e.kind === kind && e.packEntryId === id);
  return { data: found?.data, fromHomebrew: (packs ?? []).find((p) => p.packId === found?.packId)?.campaignHomebrew ?? false };
}
/** The log's changes to homebrew entries this person can see (the first save also starts the homebrew). */
const seenBy = async (person: Person, type: string) =>
  must(
    await person.db.from('events').select('id, type, before, after').eq('campaign_id', world.campaignId).eq('type', type).eq('target_table', 'library_entries'),
  );

describe("the campaign's homebrew", () => {
  it('the GM makes a stat block: the homebrew starts, and the log line is the GM’s alone', async () => {
    expect(await save(world.gm, 'statBlock', { id: 'bog-lurker', name: 'Bog lurker', hp: '3d8', fields: { AC: '6' } })).toMatchObject({ ok: true, value: 'bog-lurker' });
    expect(await winner('statBlock', 'bog-lurker')).toMatchObject({ fromHomebrew: true, data: { hp: '3d8' } });
    expect(await seenBy(world.gm, 'homebrew.save')).toHaveLength(1);
    expect(await seenBy(world.playerA, 'homebrew.save')).toEqual([]);
  });

  it('a homebrew version of a pack’s item wins over it, the pack is untouched, and players see that line', async () => {
    expect(await save(world.gm, 'item', { id: 'rope', name: 'Rope', weightCoin: 40 })).toMatchObject({ ok: true });
    expect(await winner('item', 'rope')).toEqual({ fromHomebrew: true, data: expect.objectContaining({ weightCoin: 40 }) });
    const river = must(await world.admin.from('library_entries').select('data, packs!inner(name)').eq('pack_entry_id', 'rope').eq('packs.name', 'River Rules'));
    expect(river[0]?.data).toMatchObject({ weightCoin: 50 });
    expect((await seenBy(world.playerA, 'homebrew.save')).length).toBe(1);
  });

  it('a change can be undone', async () => {
    await save(world.gm, 'item', { id: 'rope', name: 'Rope', weightCoin: 30 });
    const changes = await seenBy(world.gm, 'homebrew.save');
    const last = changes.find((e) => e.before !== null && (e.after as { data?: { weightCoin?: number } }).data?.weightCoin === 30)!;
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: last.id, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect((await winner('item', 'rope')).data).toMatchObject({ weightCoin: 40 });
  });

  it('a broken entry is refused in plain words, and nothing is saved', async () => {
    const result = await save(world.gm, 'statBlock', { id: 'mire-hag', name: 'Mire hag', hpAverage: 2.5 });
    expect(result).toMatchObject({ ok: false, message: 'Average hit points must be a whole number.' });
    expect((await winner('statBlock', 'mire-hag')).data).toBeUndefined();
  });

  it('a player can’t make or delete homebrew, even going straight to the database', async () => {
    expect(await save(world.playerA, 'item', { id: 'lucky-reed', name: 'Lucky reed' })).toMatchObject({ ok: false });
    expect(await as(world.playerA, deleteHomebrewEntry, { campaignId: world.campaignId, kind: 'item', packEntryId: 'rope' })).toMatchObject({ ok: false });
    const [home] = must(await world.admin.from('packs').select('id').eq('campaign_id', world.campaignId));
    const sneaky = await world.playerA.db.from('library_entries').insert({ pack_id: home!.id, kind: 'item', pack_entry_id: 'sneaky', name: 'Sneaky', data: {} }).select('id');
    expect(sneaky.error).not.toBeNull();
    await world.playerA.db.from('library_entries').delete().eq('pack_id', home!.id);
    expect(must(await world.admin.from('library_entries').select('id').eq('pack_id', home!.id)).length).toBe(2);
  });

  it('a retired campaign’s homebrew can’t change', async () => {
    await as(world.gm, retireCampaign, { campaignId: world.campaignId });
    expect(await save(world.gm, 'item', { id: 'rope', name: 'Rope', weightCoin: 10 })).toMatchObject({
      ok: false,
      message: 'This campaign is retired, so nothing in it can change.',
    });
    await as(world.gm, restoreCampaign, { campaignId: world.campaignId });
  });

  it('deleting the homebrew version brings the pack’s back; logged', async () => {
    expect(await as(world.gm, deleteHomebrewEntry, { campaignId: world.campaignId, kind: 'item', packEntryId: 'rope' })).toMatchObject({ ok: true });
    expect(await winner('item', 'rope')).toEqual({ fromHomebrew: false, data: expect.objectContaining({ weightCoin: 50 }) });
    expect(await seenBy(world.gm, 'homebrew.delete')).toHaveLength(1);
  });
});

describe("copying the campaign's homebrew to the Rules library (ruled 2026-10-25)", () => {
  it("makes an independent pack of the GM's own, hidden fields too; a later edit to the homebrew leaves the copy alone", async () => {
    expect(await save(world.gm, 'item', { id: 'eel-charm', name: 'Eel charm', weightCoin: 1, curse: 'Smells of eels', gmOnly: ['curse'] })).toMatchObject({ ok: true });
    const [home] = must(await world.admin.from('packs').select('id, name').eq('campaign_id', world.campaignId));
    const input = { campaignId: world.campaignId, packId: home!.id as string, name: home!.name as string };
    expect(await as(world.playerA, copyHomebrewToLibrary, input)).toMatchObject({ ok: false });
    const copied = await as(world.gm, copyHomebrewToLibrary, input);
    if (!copied.ok) throw new Error(copied.message);
    expect(must(await world.admin.from('packs').select('owner_user_id, campaign_id, kind, name').eq('id', copied.value).single())).toEqual({
      owner_user_id: world.gm.id,
      campaign_id: null,
      kind: 'homebrew',
      name: `${campaignName} homebrew (copy)`,
    });
    const charm = async () => (await loadPackEntries(asDb(world.gm), copied.value))?.find((e) => e.packEntryId === 'eel-charm')?.data;
    expect(await charm()).toMatchObject({ weightCoin: 1, curse: 'Smells of eels' });
    expect(await save(world.gm, 'item', { id: 'eel-charm', name: 'Eel charm', weightCoin: 2 })).toMatchObject({ ok: true });
    expect(await charm()).toMatchObject({ weightCoin: 1 });
    await world.admin.from('packs').delete().eq('id', copied.value);
  });
});

describe('Edit pack in the Rules library (ruled 2026-10-25)', () => {
  it("edits one entry of an imported homebrew pack; its hidden fields and notes stay, and each campaign using it logs the change", async () => {
    const read = readPackJson(
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Marsh Homebrew', version: '2', kind: 'homebrew', notes: 'Our table’s marsh things.' },
        items: [
          { id: 'reed-pipe', name: 'Reed pipe', weightCoin: 2 },
          { id: 'eel-ring', name: 'Eel ring', weightCoin: 1, curse: 'Slippery fingers', gmOnly: ['curse'] },
        ],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    const made = await as(world.gm, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId: made.value });
    const input = { packId: made.value, ownerUserId: world.gm.id, kind: 'item' as const, packEntryId: 'reed-pipe', data: { name: 'Reed pipe', weightCoin: 3 } };
    expect(await as(world.playerA, editPackEntry, input)).toMatchObject({ ok: false });
    expect(await as(world.gm, editPackEntry, input)).toMatchObject({ ok: true, value: 'reed-pipe' });

    const entries = await loadPackEntries(asDb(world.gm), made.value);
    expect(entries?.find((e) => e.packEntryId === 'reed-pipe')?.data).toMatchObject({ weightCoin: 3 });
    expect(entries?.find((e) => e.packEntryId === 'eel-ring')?.data).toMatchObject({ curse: 'Slippery fingers' });
    expect(must(await world.admin.from('packs').select('notes, version, kind').eq('id', made.value).single())).toEqual({ notes: 'Our table’s marsh things.', version: '2', kind: 'homebrew' });
    const lines = must(await world.playerA.db.from('events').select('after').eq('campaign_id', world.campaignId).eq('type', 'library.update'));
    expect(lines.some((line) => JSON.stringify(line.after).includes('Reed pipe'))).toBe(true);
  });
});
