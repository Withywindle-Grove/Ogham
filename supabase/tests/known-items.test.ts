// Discovery first (ruled 2026-10-25; docs/04 KnownItem, 05 "What players' devices get", 07 "Who sees what";
// supabase/migrations/20261028100000_m4b_known_items.sql). TEST project only; invented content.
//   A player's device gets a setting-rules item only if it's for sale (as the winning version says) or the party
//   knows it: someone in the party has held it, or the GM handed it out. Knowledge stays after the item leaves the
//   party, and is per campaign. The GM sees everything.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack, startHomebrew } from '../../src/modules/library/campaignPacks.ts';
import { importPack, updatePack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { addItem, removeItem, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}

const ITEMS = [
  { id: 'reed-rope', name: 'Reed rope', category: 'gear', weightCoin: 10 },
  { id: 'glow-wand', name: 'Glow wand', category: 'magic-wand', weightCoin: 1 },
  { id: 'bog-charm', name: 'Bog charm', category: 'gear', weightCoin: 1, forSale: false },
  { id: 'ember-ring', name: 'Ember ring', category: 'magic-ring', weightCoin: 1, forSale: true },
  { id: 'heron-cloak', name: 'Heron cloak', category: 'magic-cloak', weightCoin: 20 },
];
function readPack(version: string, items = ITEMS) {
  const read = readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Fen Goods', version }, items }));
  if (!read.ok) throw new Error(read.message);
  return read.pack;
}

let packId = '';
const entryOf = async (id: string) => must(await world.admin.from('library_entries').select('id').eq('pack_id', packId).eq('pack_entry_id', id).single()).id as string;
const itemsSeenBy = async (person: Person) =>
  must(await person.db.from('library_entries').select('pack_entry_id').eq('pack_id', packId).eq('kind', 'item'))
    .map((row) => row.pack_entry_id as string)
    .sort();
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });

beforeAll(async () => {
  world = await buildWorld();
  const made = await as(world.gm, importPack, { pack: readPack('1') });
  if (!made.ok) throw new Error(made.message);
  packId = made.value;
  const attached = await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
  if (!attached.ok) throw new Error(attached.message);
}, 300_000);
afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe('items players know', () => {
  it("a player gets only what's for sale; the GM gets everything", async () => {
    expect(await itemsSeenBy(world.playerA)).toEqual(['ember-ring', 'reed-rope']);
    expect(await itemsSeenBy(world.gm)).toEqual(['bog-charm', 'ember-ring', 'glow-wand', 'heron-cloak', 'reed-rope']);
    expect(must(await world.playerA.db.from('known_items').select('item_id').eq('campaign_id', world.campaignId))).toEqual([]);
  });

  it('once the GM hands an item to a party member, the party knows it, and still does after it leaves', async () => {
    const given = await as(world.gm, addItem, {
      carrier: wren(),
      item: { libraryEntryId: await entryOf('glow-wand'), name: 'Glow wand', category: 'magic-wand', weightCoin: 1, slots: null, stack: 1 },
      qty: 1,
      howGot: 'given' as const,
    });
    if (!given.ok) throw new Error(given.message);
    // Player B, whose character didn't get it, knows it too: it's the party's knowledge.
    expect(await itemsSeenBy(world.playerB)).toEqual(['ember-ring', 'glow-wand', 'reed-rope']);
    expect(await as(world.gm, removeItem, { line: { id: given.value.id, carrier: wren() }, qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(await itemsSeenBy(world.playerA)).toEqual(['ember-ring', 'glow-wand', 'reed-rope']);
    // Knowledge is per campaign: a player in another campaign using the same rules doesn't learn it.
    must(await world.admin.from('members').insert({ campaign_id: world.otherCampaignId, user_id: world.outsider.id, base_role: 'player' }).select('user_id'));
    await as(world.gm, attachPack, { campaignId: world.otherCampaignId, packId });
    expect(await itemsSeenBy(world.outsider)).toEqual(['ember-ring', 'reed-rope']);
  });

  it("an item on a character that isn't in the party yet (waiting) isn't known until it's approved", async () => {
    const waiting = must(
      await world.admin
        .from('actors')
        .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Moss', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'pending' })
        .select('id')
        .single(),
    ).id as string;
    const carrier: CarrierRef = { campaignId: world.campaignId, actorId: waiting, locationId: null, ownerUserId: world.playerA.id, archived: false };
    const added = await as(world.gm, addItem, {
      carrier,
      item: { libraryEntryId: await entryOf('heron-cloak'), name: 'Heron cloak', category: 'magic-cloak', weightCoin: 20, slots: null, stack: 1 },
      qty: 1,
      howGot: 'given' as const,
    });
    if (!added.ok) throw new Error(added.message);
    expect(await itemsSeenBy(world.playerB)).not.toContain('heron-cloak');
    must(await world.gm.db.from('actors').update({ approval: 'approved' }).eq('id', waiting).select('id'));
    expect(await itemsSeenBy(world.playerB)).toContain('heron-cloak');
  });

  it('the winning version decides what is for sale: a homebrew copy marked not for sale hides the item', async () => {
    const home = await as(world.gm, startHomebrew, { campaignId: world.campaignId, campaignName: 'The Reedmouth Delve' });
    if (!home.ok) throw new Error(home.message);
    must(await world.gm.db.from('library_entries').insert({ pack_id: home.value, kind: 'item', pack_entry_id: 'reed-rope', name: 'Reed rope', data: { category: 'gear', forSale: false } }).select('id'));
    expect(await itemsSeenBy(world.playerA)).not.toContain('reed-rope');
    expect(must(await world.playerA.db.from('library_entries').select('id').eq('pack_id', home.value))).toEqual([]);
    // The homebrew item's line in the log is the GM's too.
    const logged = must(await world.playerA.db.from('events').select('id').eq('target_table', 'library_entries').eq('after->>pack_entry_id', 'reed-rope'));
    expect(logged).toEqual([]);
  });

  it("a pack update names items that aren't for sale only in the GM's line", async () => {
    const renamed = ITEMS.map((item) => ({ ...item, name: `${item.name} (new)` }));
    expect(await as(world.gm, updatePack, { packId, ownerUserId: world.gm.id, pack: readPack('2', renamed) })).toMatchObject({ ok: true });
    const lines = must(await world.gm.db.from('events').select('after, audience').eq('campaign_id', world.campaignId).eq('type', 'library.update'));
    const changed = (audience: string) => ((lines.find((line) => line.audience === audience)?.after as { changed?: string[] })?.changed ?? []).sort();
    expect(changed('all')).toEqual(['Ember ring (new)', 'Reed rope (new)']);
    expect(changed('gm')).toEqual(['Bog charm (new)', 'Glow wand (new)', 'Heron cloak (new)']);
  });
});
