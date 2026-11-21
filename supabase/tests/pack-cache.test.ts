// The on-device pack cache (perf fix 2b, docs/plans/perf-pack-cache.md): the device stores exactly what the
// database sent this person, so what the database sends is what matters. Condition 1: a player's reads, the exact
// queries the cache stores, carry no GM-only field and no GM-only entry. Condition 2: every change that should make
// a stored copy stale bumps the right stamp. TEST project only; invented content.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, detachPack, loadCampaignEntries, loadCampaignPacks, loadSeenRev, preferEntry, setPackOptions } from '../../src/modules/library/campaignPacks.ts';
import { deleteHomebrewEntry, saveHomebrewEntry } from '../../src/modules/library/homebrew.ts';
import { editPackEntry, importPack } from '../../src/modules/library/library.ts';
import { PLAYER_FACING, readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let fenRulesId: string;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

/** A setting with every kind the cache test cares about: an item with a hidden field, and three GM-only kinds. */
async function fenRules(): Promise<string> {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Fen Rules', version: '0.3' },
      options: [{ id: 'reed-boats', name: 'Reed boats', default: 'on', changeLater: 'allow', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] }],
      classes: [{ id: 'lantern-warden', name: 'Lantern Warden' }],
      items: [
        { id: 'rope-50ft', name: 'Rope, 50 ft', category: 'gear', cost: 1 },
        { id: 'eel-charm', name: 'Eel charm', category: 'gear', cost: 5, curse: 'Smells of eels', gmOnly: ['curse'] },
      ],
      statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8' }],
      tables: [{ id: 'marsh-encounters', name: 'Marsh encounters', die: 'd6', rows: [] }],
      treasureTypes: [{ id: 'tt-k', letter: 'K', entries: [] }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  return made.value;
}

const contentRev = async (packId: string) => must(await world.admin.from('packs').select('content_rev').eq('id', packId).single()).content_rev as number;
const seenRev = async () => (await loadSeenRev(asDb(world.gm), world.campaignId)) ?? -1;
const homebrewId = async () => must(await world.admin.from('packs').select('id').eq('campaign_id', world.campaignId).single()).id as string;

beforeAll(async () => {
  world = await buildWorld();
  fenRulesId = await fenRules();
  const attached = await as(world.gm, attachPack, { campaignId: world.campaignId, packId: fenRulesId });
  if (!attached.ok) throw new Error(attached.message);
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id);
  await tearDownWorld(world);
}, 60_000);

describe('condition 1: what a player is sent (the exact reads the cache stores)', () => {
  it("a player's entries carry no GM-only field and no stat block, table or treasure entry; the GM's carry the hidden field", async () => {
    const mine = (await loadCampaignEntries(asDb(world.playerA), world.campaignId)) ?? [];
    expect(mine.length).toBeGreaterThan(0);
    for (const entry of mine) {
      expect(PLAYER_FACING.includes(entry.kind), `${entry.kind} ${entry.packEntryId}`).toBe(true);
      expect(Object.keys(entry.data)).not.toContain('gmOnly');
      expect(Object.keys(entry.data)).not.toContain('curse');
    }
    const charm = mine.find((e) => e.packEntryId === 'eel-charm');
    expect(charm).toBeDefined();
    const gms = (await loadCampaignEntries(asDb(world.gm), world.campaignId)) ?? [];
    expect(gms.find((e) => e.packEntryId === 'eel-charm')?.data).toMatchObject({ curse: 'Smells of eels', gmOnly: ['curse'] });
    expect(gms.some((e) => e.kind === 'statBlock')).toBe(true);
  });

  it("a player's read of the hidden fields' table returns no row at all", async () => {
    const secrets = await world.playerA.db.from('library_entry_secrets').select('id').in('pack_id', [fenRulesId]);
    expect(secrets.error).toBeNull();
    expect(secrets.data).toEqual([]);
  });

  it('the player and the GM read both stamps; an outsider reads neither', async () => {
    for (const person of [world.playerA, world.gm]) {
      const packs = (await loadCampaignPacks(asDb(person), world.campaignId)) ?? [];
      expect(typeof packs.find((p) => p.packId === fenRulesId)?.contentRev).toBe('number');
      expect(typeof (await loadSeenRev(asDb(person), world.campaignId))).toBe('number');
    }
    const outsiderPacks = await world.outsider.db.from('packs').select('content_rev').eq('id', fenRulesId);
    expect(outsiderPacks.data).toEqual([]);
    const outsiderSeen = await world.outsider.db.from('campaign_rules_revs').select('seen_rev').eq('campaign_id', world.campaignId);
    expect(outsiderSeen.data).toEqual([]);
  });

  it('nobody writes a stamp by hand: a GM cannot change their own pack’s content stamp or the campaign’s seen stamp', async () => {
    const before = await contentRev(fenRulesId);
    await world.gm.db.from('packs').update({ content_rev: before + 100 }).eq('id', fenRulesId);
    expect(await contentRev(fenRulesId)).toBe(before);
    const seen = await seenRev();
    const written = await world.gm.db.from('campaign_rules_revs').update({ seen_rev: seen + 100 }).eq('campaign_id', world.campaignId);
    expect(written.error === null ? await seenRev() : seen).toBe(seen);
  });
});

describe('condition 2: each change bumps the right stamp', () => {
  it('attaching bumped the seen stamp already; a player reading entries bumps nothing', async () => {
    expect(await seenRev()).toBeGreaterThan(0);
    const content = await contentRev(fenRulesId);
    const seen = await seenRev();
    await loadCampaignEntries(asDb(world.playerA), world.campaignId);
    await loadCampaignPacks(asDb(world.playerA), world.campaignId);
    expect(await contentRev(fenRulesId)).toBe(content);
    expect(await seenRev()).toBe(seen);
  });

  it('an import bumps the content stamp once, not once per row', async () => {
    const other = await fenRules();
    // The import wrote six entries and one hidden part in two statements: entries, then the split-off secrets.
    expect(await contentRev(other)).toBeLessThanOrEqual(2);
    expect(await contentRev(other)).toBeGreaterThan(0);
    await world.admin.from('packs').delete().eq('id', other);
  });

  it('editing an entry in a library pack (saved through import_pack with replace_pack_id) bumps its content stamp', async () => {
    const before = await contentRev(fenRulesId);
    const edited = await as(world.gm, editPackEntry, {
      packId: fenRulesId,
      ownerUserId: world.gm.id,
      kind: 'item',
      packEntryId: 'rope-50ft',
      data: { id: 'rope-50ft', name: 'Rope, 50 ft', category: 'gear', cost: 2 },
    });
    expect(edited).toMatchObject({ ok: true });
    expect(await contentRev(fenRulesId)).toBeGreaterThan(before);
  });

  it('a hidden field changed bumps the content stamp (the secrets table has the bump too)', async () => {
    const before = await contentRev(fenRulesId);
    const edited = await as(world.gm, editPackEntry, {
      packId: fenRulesId,
      ownerUserId: world.gm.id,
      kind: 'item',
      packEntryId: 'eel-charm',
      data: { id: 'eel-charm', name: 'Eel charm', category: 'gear', cost: 5, curse: 'Smells of old eels', gmOnly: ['curse'] },
    });
    expect(edited).toMatchObject({ ok: true });
    expect(await contentRev(fenRulesId)).toBeGreaterThan(before);
    // A change to the hidden part alone (as Undo writes it) bumps too.
    const secret = must(await world.admin.from('library_entry_secrets').select('id, data').eq('pack_id', fenRulesId).single());
    const mid = await contentRev(fenRulesId);
    must(await world.admin.from('library_entry_secrets').update({ data: { ...(secret.data as object), curse: 'Smells of eels again' } }).eq('id', secret.id).select('id'));
    expect(await contentRev(fenRulesId)).toBeGreaterThan(mid);
  });

  it("homebrew saved and deleted bumps the campaign homebrew's content stamp, not the setting's", async () => {
    const settingBefore = await contentRev(fenRulesId);
    const saved = await as(world.gm, saveHomebrewEntry, {
      campaignId: world.campaignId,
      campaignName: 'The Reedmouth Delve',
      kind: 'item',
      data: { id: 'reed-whistle', name: 'Reed whistle', category: 'gear', cost: 1 },
    });
    expect(saved).toMatchObject({ ok: true });
    const home = await homebrewId();
    const afterSave = await contentRev(home);
    expect(afterSave).toBeGreaterThan(0);
    const deleted = await as(world.gm, deleteHomebrewEntry, { campaignId: world.campaignId, kind: 'item', packEntryId: 'reed-whistle' });
    expect(deleted).toMatchObject({ ok: true });
    expect(await contentRev(home)).toBeGreaterThan(afterSave);
    expect(await contentRev(fenRulesId)).toBe(settingBefore);
  });

  it('a known item added or removed bumps the seen stamp (and no content stamp)', async () => {
    const content = await contentRev(fenRulesId);
    const before = await seenRev();
    must(await world.admin.from('known_items').insert({ campaign_id: world.campaignId, item_id: 'eel-charm' }).select('item_id'));
    const added = await seenRev();
    expect(added).toBeGreaterThan(before);
    await world.admin.from('known_items').delete().eq('campaign_id', world.campaignId).eq('item_id', 'eel-charm');
    expect(await seenRev()).toBeGreaterThan(added);
    expect(await contentRev(fenRulesId)).toBe(content);
  });

  it("a pack's options changed bumps the seen stamp", async () => {
    const link = ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.packId === fenRulesId)!;
    const before = await seenRev();
    expect(await as(world.gm, setPackOptions, { campaignId: world.campaignId, campaignPackId: link.id, optionChoices: { 'reed-boats': 'off' } })).toMatchObject({ ok: true });
    expect(await seenRev()).toBeGreaterThan(before);
  });

  it("the GM's exception for an entry bumps the seen stamp", async () => {
    const link = ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.packId === fenRulesId)!;
    const before = await seenRev();
    expect(await as(world.gm, preferEntry, { campaignId: world.campaignId, key: 'item:rope-50ft', name: 'Rope, 50 ft', campaignPackId: link.id })).toMatchObject({ ok: true });
    expect(await seenRev()).toBeGreaterThan(before);
  });

  it('detaching a pack bumps the seen stamp, and the other campaign’s stamp never moves', async () => {
    const otherBefore = await loadSeenRev(asDb(world.gm), world.otherCampaignId);
    const link = ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.packId === fenRulesId)!;
    const before = await seenRev();
    expect(await as(world.gm, detachPack, { campaignId: world.campaignId, campaignPackId: link.id })).toMatchObject({ ok: true });
    expect(await seenRev()).toBeGreaterThan(before);
    expect(await loadSeenRev(asDb(world.gm), world.otherCampaignId)).toBe(otherBefore);
  });
});

describe('a change that opens or closes things across packs bumps every stamp it reaches (look-back review of #554, 2026-11-10)', () => {
  // Purpose: whether a player may read an item in one pack depends on rows in other packs (the winning copy's "for
  // sale", a kit that lists it), so adding a homebrew item, making it not for sale, and adding or removing a homebrew
  // kit each bump the seen stamp of the campaign attaching the homebrew; a class changed bumps nothing while no patch
  // in the campaign targets classes, and does once one does (a patch is hidden when it changes a field its target
  // keeps GM-only). Before this fix only the homebrew's own content stamp moved.
  it('a homebrew item’s for-sale change or a homebrew kit’s removal bumps the campaign’s seen stamp', async () => {
    const home = await homebrewId();
    const add = async (kind: string, id: string, data: Record<string, unknown>) =>
      must(await world.admin.from('library_entries').insert({ pack_id: home, kind, pack_entry_id: id, name: id, data: { id, name: id, ...data } }).select('id').single()).id as string;
    const before = await seenRev();
    const key = await add('item', 'sluice-key', { category: 'gear', forSale: true });
    const added = await seenRev();
    expect(added).toBeGreaterThan(before);
    must(await world.admin.from('library_entries').update({ data: { id: 'sluice-key', name: 'sluice-key', category: 'gear', forSale: false } }).eq('id', key).select('id'));
    const unsold = await seenRev();
    expect(unsold).toBeGreaterThan(added);
    const kit = await add('startingKit', 'sluice-kit', { items: [{ itemId: 'sluice-key', qty: 1 }] });
    const kitted = await seenRev();
    expect(kitted).toBeGreaterThan(unsold);
    must(await world.admin.from('library_entries').delete().eq('id', kit).select('id'));
    const unkitted = await seenRev();
    expect(unkitted).toBeGreaterThan(kitted);

    const keeper = await add('class', 'sluice-keeper', { hd: 'd6' });
    expect(await seenRev()).toBe(unkitted);
    const patch = await add('patch', 'patch-1', { byOption: 'reed-boats=on', match: { kind: 'class' }, change: { hd: 'd8' } });
    const patched = await seenRev();
    must(await world.admin.from('library_entries').update({ data: { id: 'sluice-keeper', name: 'sluice-keeper', hd: 'd6', secret: 'x', gmOnly: ['secret'] } }).eq('id', keeper).select('id'));
    expect(await seenRev()).toBeGreaterThan(patched);
    await world.admin.from('library_entries').delete().in('id', [key, keeper, patch]);
  });

  // Purpose: a player's copy of a pack in campaign B can hold what campaign A opened (item_readable reads every
  // campaign the player shares the pack with), so a reveal, its removal, an option change and a detach in A each bump
  // B's seen stamp when A and B share a pack. Before this fix only A's stamp moved.
  it('a reveal, an option or a detach in one campaign bumps the seen stamp of another campaign sharing the pack', async () => {
    const otherSeen = async () => (await loadSeenRev(asDb(world.gm), world.otherCampaignId)) ?? -1;
    expect(await as(world.gm, attachPack, { campaignId: world.campaignId, packId: fenRulesId })).toMatchObject({ ok: true });
    expect(await as(world.gm, attachPack, { campaignId: world.otherCampaignId, packId: fenRulesId })).toMatchObject({ ok: true });
    const before = await otherSeen();
    must(await world.admin.from('known_items').insert({ campaign_id: world.campaignId, item_id: 'eel-charm' }).select('item_id'));
    const revealed = await otherSeen();
    expect(revealed).toBeGreaterThan(before);
    await world.admin.from('known_items').delete().eq('campaign_id', world.campaignId).eq('item_id', 'eel-charm');
    const unrevealed = await otherSeen();
    expect(unrevealed).toBeGreaterThan(revealed);
    const link = ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.packId === fenRulesId)!;
    expect(await as(world.gm, setPackOptions, { campaignId: world.campaignId, campaignPackId: link.id, optionChoices: { 'reed-boats': 'on' } })).toMatchObject({ ok: true });
    const optioned = await otherSeen();
    expect(optioned).toBeGreaterThan(unrevealed);
    expect(await as(world.gm, detachPack, { campaignId: world.campaignId, campaignPackId: link.id })).toMatchObject({ ok: true });
    expect(await otherSeen()).toBeGreaterThan(optioned);
    const otherLink = ((await loadCampaignPacks(asDb(world.gm), world.otherCampaignId)) ?? []).find((p) => p.packId === fenRulesId)!;
    await as(world.gm, detachPack, { campaignId: world.otherCampaignId, campaignPackId: otherLink.id });
  });
});
