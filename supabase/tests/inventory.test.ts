// Inventory and rolls (M4 step 2; docs/04-data-model.md, docs/05-features.md). TEST project only; invented content.
// Permission cases (who may add, take, move, equip, give) are in src/testing/permissionCases.ts; this file
// covers the rest: what players see, what survives setting rules changing, the Party stash, rolls and undo.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { addItem, equipItem, loadInventory, moveItem, type CarrierRef, type ItemCopy } from '../../src/modules/inventory/inventory.ts';
import { recordRoll } from '../../src/core/rolls.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack, deletePack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
const lantern: ItemCopy = { libraryEntryId: null, name: 'Hooded lantern', category: 'light', weightCoin: 30, slots: 1, stack: 1 };

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

async function stash(): Promise<CarrierRef> {
  const [row] = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'));
  return { campaignId: world.campaignId, actorId: null, locationId: row!.id as string, ownerUserId: null, archived: false };
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });

describe('the Party stash', () => {
  it('every campaign has exactly one, new campaigns too, and nobody can add or remove one', async () => {
    expect(must(await world.playerA.db.from('locations').select('kind').eq('campaign_id', world.campaignId))).toEqual([{ kind: 'stash' }]);
    const fresh = must(await world.gm.db.rpc('create_campaign', { campaign_name: 'The Silt Road' }));
    expect(must(await world.gm.db.from('locations').select('kind').eq('campaign_id', fresh))).toEqual([{ kind: 'stash' }]);
    await world.gm.db.from('locations').insert({ campaign_id: world.campaignId, kind: 'stash', name: 'Second stash' });
    await world.gm.db.from('locations').delete().eq('campaign_id', world.campaignId);
    expect(must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId))).toHaveLength(1);
    expect(must(await world.outsider.db.from('locations').select('id').eq('campaign_id', world.campaignId))).toEqual([]);
  });
});

describe('what players see', () => {
  it("everyone in the campaign sees approved characters' items and the stash; outsiders see nothing", async () => {
    await as(world.playerA, addItem, { carrier: wren(), item: lantern, qty: 1, howGot: 'bought', cost: '10 gp' });
    await as(world.playerB, addItem, { carrier: await stash(), item: { ...lantern, name: 'Rope' }, qty: 1, howGot: 'found' });
    const seen = (await loadInventory(asDb(world.playerB), world.campaignId))!;
    expect(seen.lines.map((line) => line.name)).toEqual(expect.arrayContaining(['Hooded lantern', 'Rope']));
    expect(seen.lines.find((line) => line.name === 'Hooded lantern')).toMatchObject({ howGot: 'bought', cost: '10 gp', actorId: world.wrenId });
    expect(must(await world.outsider.db.from('inventory_lines').select('id').eq('campaign_id', world.campaignId))).toEqual([]);
  });

  it("a waiting character's items, and their log lines, are seen only by its player and the GM", async () => {
    const waiting = must(
      await world.playerA.db.from('actors').insert({ campaign_id: world.campaignId, kind: 'pc', owner_type: 'user', owner_user_id: world.playerA.id, name: 'Moss', approval: 'pending' }).select('id').single(),
    );
    const carrier: CarrierRef = { campaignId: world.campaignId, actorId: waiting.id as string, locationId: null, ownerUserId: world.playerA.id, archived: false };
    const added = await as(world.playerA, addItem, { carrier, item: { ...lantern, name: 'Secret map' }, qty: 1, howGot: 'found' });
    expect(added).toMatchObject({ ok: true });
    const id = added.ok ? added.value.id : '';
    const lines = async (person: Person) => must(await person.db.from('inventory_lines').select('id').eq('id', id));
    const events = async (person: Person) => must(await person.db.from('events').select('id').eq('target_id', id));
    expect(await lines(world.playerB)).toEqual([]);
    expect(await events(world.playerB)).toEqual([]);
    expect(await lines(world.playerA)).toHaveLength(1);
    expect(await events(world.playerA)).toHaveLength(1);
    expect(await lines(world.gm)).toHaveLength(1);
    expect(await events(world.gm)).toHaveLength(1);
  });
});

describe('items outlive the setting rules they came from', () => {
  it('deleting the pack (even one a campaign uses) leaves the line, with its own copy of the name and weight', async () => {
    const read = readPackJson(JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Fen Gear' }, items: [{ id: 'eel-trap', name: 'Eel trap', weightCoin: 40 }] }));
    if (!read.ok) throw new Error(read.message);
    const made = await as(world.gm, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId: made.value });
    const [entry] = must(await world.gm.db.from('library_entries').select('id').eq('pack_id', made.value));
    const added = await as(world.playerA, addItem, {
      carrier: wren(),
      item: { libraryEntryId: entry!.id as string, name: 'Eel trap', category: 'gear', weightCoin: 40, slots: null, stack: 1 },
      qty: 1,
      howGot: 'found',
    });
    if (!added.ok) throw new Error(added.message);
    expect(await as(world.gm, deletePack, { packId: made.value, ownerUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(must(await world.playerA.db.from('inventory_lines').select('name, weight_coin, library_entry_id').eq('id', added.value.id))).toEqual([
      { name: 'Eel trap', weight_coin: 40, library_entry_id: entry!.id },
    ]);
  });
});

describe('the rules the database keeps', () => {
  it("a line can't sit in a container on another carrier, or point at another campaign's carrier", async () => {
    const bag = await as(world.playerA, addItem, { carrier: wren(), item: { ...lantern, name: 'Sack' }, qty: 1, howGot: 'found' });
    if (!bag.ok) throw new Error(bag.message);
    const elsewhere = await as(world.playerB, addItem, { carrier: await stash(), item: lantern, qty: 1, howGot: 'found', containerLineId: bag.value.id });
    expect(elsewhere.ok).toBe(false);
    const fresh = must(await world.gm.db.rpc('create_campaign', { campaign_name: 'The Other Bank' }));
    const wrong = await world.gm.db.from('inventory_lines').insert({ campaign_id: fresh, actor_id: world.wrenId, name: 'Stray', how_got: 'found' }).select();
    expect(wrong.error).not.toBeNull();
  });

  it('equipping is logged and can be undone', async () => {
    const added = await as(world.playerA, addItem, { carrier: wren(), item: { ...lantern, name: 'Buckler' }, qty: 1, howGot: 'found' });
    if (!added.ok) throw new Error(added.message);
    const line = { id: added.value.id, carrier: wren() };
    expect(await as(world.playerA, equipItem, { line, equipped: true })).toMatchObject({ ok: true });
    const [event] = must(await world.playerA.db.from('events').select('id, type').eq('target_id', line.id).eq('type', 'inventory.equip'));
    expect(await as(world.playerA, undoChange, { campaignId: world.campaignId, eventId: event!.id as string, authorUserId: world.playerA.id })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('inventory_lines').select('equipped').eq('id', line.id))).toEqual([{ equipped: false }]);
  });

  it("giving part of a stack leaves the rest, and the other character gets a line of their own", async () => {
    const added = await as(world.playerA, addItem, { carrier: wren(), item: { ...lantern, name: 'Torch', stack: 10 }, qty: 6, howGot: 'bought', cost: '6 cp' });
    if (!added.ok) throw new Error(added.message);
    const ash: CarrierRef = { campaignId: world.campaignId, actorId: world.ashId, locationId: null, ownerUserId: world.playerB.id, archived: false };
    const given = await as(world.playerA, moveItem, { line: { id: added.value.id, carrier: wren() }, to: ash, qty: 2, of: 6 });
    expect(given).toMatchObject({ ok: true, value: { actorId: world.ashId, qty: 2, name: 'Torch' } });
    expect(must(await world.admin.from('inventory_lines').select('qty').eq('id', added.value.id))).toEqual([{ qty: 4 }]);
  });

  it('a retired campaign keeps its items as they are', async () => {
    const fresh = must(await world.gm.db.rpc('create_campaign', { campaign_name: 'The Dry Weir' })) as string;
    const [place] = must(await world.gm.db.from('locations').select('id').eq('campaign_id', fresh));
    const carrier: CarrierRef = { campaignId: fresh, actorId: null, locationId: place!.id as string, ownerUserId: null, archived: false };
    const added = await as(world.gm, addItem, { carrier, item: lantern, qty: 1, howGot: 'found' });
    if (!added.ok) throw new Error(added.message);
    must(await world.gm.db.from('campaigns').update({ retired_at: new Date().toISOString() }).eq('id', fresh).select());
    const changed = await world.gm.db.from('inventory_lines').update({ qty: 9 }).eq('id', added.value.id).select();
    expect(changed.error?.message).toContain('retired');
  });
});

describe('rolls', () => {
  it('are kept with their dice, result, who and how; GM-only ones stay the GM’s; none can be changed', async () => {
    const open = await as(world.playerA, recordRoll, { campaignId: world.campaignId, expression: '2d10', result: 13, purpose: 'charges', gmOnly: false });
    const secret = await as(world.gm, recordRoll, { campaignId: world.campaignId, expression: '3d10', result: 21, purpose: 'charges', gmOnly: true });
    if (!open.ok || !secret.ok) throw new Error('a roll was refused');
    expect(must(await world.playerB.db.from('rolls').select('expression, result, method, entered_by').eq('id', open.value))).toEqual([
      { expression: '2d10', result: 13, method: 'manual', entered_by: world.playerA.id },
    ]);
    expect(must(await world.playerB.db.from('rolls').select('id').eq('id', secret.value))).toEqual([]);
    expect(must(await world.gm.db.from('rolls').select('result').eq('id', secret.value))).toEqual([{ result: 21 }]);
    await world.playerA.db.from('rolls').update({ result: 20 }).eq('id', open.value);
    await world.gm.db.from('rolls').delete().eq('id', open.value);
    expect(must(await world.admin.from('rolls').select('result').eq('id', open.value))).toEqual([{ result: 13 }]);
    const impossible = await as(world.playerA, recordRoll, { campaignId: world.campaignId, expression: '1d6', result: 9, purpose: 'hp', gmOnly: false });
    expect(impossible).toMatchObject({ ok: false, message: '1d6 gives 1 to 6.' });
  });
});
