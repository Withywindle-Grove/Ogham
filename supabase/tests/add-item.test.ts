// Adding items after the M4 gate run (rulings 2026-10-23). TEST project only; invented content.
//   A player's choices are Bought or No cost; anything "given" comes from the GM (with an optional note).
//   A player's one-off waits for the GM ("Waiting for the GM"), who approves or declines it; both logged.
//   A bundle (bundle, unitName) arrives as its units; its weight is for the whole bundle.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { addItem, approveItem, declineItem, giveAway, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
const oneOff = (name: string) => ({ libraryEntryId: null, name, category: 'gear', weightCoin: 5, slots: null, stack: 1 });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe('how an item was got', () => {
  it('a player buys or takes at no cost; only the GM gives, with an optional note', async () => {
    expect(await as(world.playerA, addItem, { carrier: wren(), item: oneOff('Reed flute'), qty: 1, howGot: 'given' })).toMatchObject({ ok: false });
    const given = await as(world.gm, addItem, { carrier: wren(), item: oneOff('Glow stone'), qty: 1, howGot: 'given', note: 'From the drowned shrine' });
    expect(given).toMatchObject({ ok: true, value: { howGot: 'given', notes: 'From the drowned shrine' } });
  });
});

describe("a player's one-off waits for the GM", () => {
  it('arrives waiting; the player can’t approve it; the GM approves it (logged) and it counts', async () => {
    const added = await as(world.playerA, addItem, { carrier: wren(), item: oneOff('Lucky pebble'), qty: 1, howGot: 'found' });
    if (!added.ok) throw new Error(added.message);
    expect(added.value.approval).toBe('pending');
    const line = { id: added.value.id, carrier: wren() };
    expect(await as(world.playerA, approveItem, { line })).toMatchObject({ ok: false });
    await world.playerA.db.from('inventory_lines').update({ approval: 'approved' }).eq('id', line.id);
    expect(must(await world.admin.from('inventory_lines').select('approval').eq('id', line.id))).toEqual([{ approval: 'pending' }]);
    expect(await as(world.gm, approveItem, { line })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('inventory_lines').select('approval').eq('id', line.id))).toEqual([{ approval: 'approved' }]);
    expect(must(await world.playerA.db.from('events').select('type').eq('target_id', line.id).eq('type', 'inventory.approve'))).toHaveLength(1);
  });

  it('the GM declines one: it goes, logged; the GM’s own one-offs never wait', async () => {
    const added = await as(world.playerA, addItem, { carrier: wren(), item: oneOff('Silver tooth'), qty: 1, howGot: 'bought', cost: '1 sp' });
    if (!added.ok) throw new Error(added.message);
    expect(await as(world.gm, declineItem, { line: { id: added.value.id, carrier: wren() } })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('inventory_lines').select('id').eq('id', added.value.id))).toEqual([]);
    expect(must(await world.playerA.db.from('events').select('type').eq('target_id', added.value.id).eq('type', 'inventory.decline'))).toHaveLength(1);
    const gmOwn = await as(world.gm, addItem, { carrier: wren(), item: oneOff('Moss charm'), qty: 1, howGot: 'given' });
    expect(gmOwn).toMatchObject({ ok: true, value: { approval: 'approved' } });
  });
});

describe('bundles', () => {
  it('a bundle from the setting rules arrives as its units, its weight for the whole bundle', async () => {
    const read = readPackJson(
      JSON.stringify({
        format: 'tabletop-pack',
        formatVersion: 2,
        meta: { name: 'Fen Lights' },
        items: [{ id: 'reed-torches', name: 'Reed torches (6)', category: 'light', weightCoin: 30, bundle: 6, unitName: 'Reed torch' }],
      }),
    );
    if (!read.ok) throw new Error(read.message);
    const made = await as(world.gm, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId: made.value });
    const [entry] = must(await world.gm.db.from('library_entries').select('id').eq('pack_id', made.value));
    const added = await as(world.playerA, addItem, {
      carrier: wren(),
      item: { libraryEntryId: entry!.id as string, name: 'Reed torches (6)', category: 'light', weightCoin: 30, slots: null, stack: 1 },
      qty: 12,
      howGot: 'bought',
    });
    expect(added).toMatchObject({ ok: true, value: { name: 'Reed torch', qty: 12, weightCoin: 30, perUnits: 6, approval: 'approved' } });
  });
});

describe('giving to someone or something outside the party ("Other…", M4 gate run)', () => {
  it('takes the item out of the party, logged with who or what it went to; part of a stack too', async () => {
    const added = await as(world.gm, addItem, { carrier: wren(), item: oneOff('Reed torch'), qty: 5, howGot: 'given' });
    if (!added.ok) throw new Error(added.message);
    const line = { id: added.value.id, carrier: wren() };
    expect(await as(world.playerB, giveAway, { line, qty: 1, of: 5, to: 'Old Marsh' })).toMatchObject({ ok: false });
    expect(await as(world.playerA, giveAway, { line, qty: 2, of: 5, to: 'Old Marsh' })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('inventory_lines').select('qty').eq('id', line.id))).toEqual([{ qty: 3 }]);
    expect(await as(world.playerA, giveAway, { line, qty: 3, of: 3, to: 'The river shrine' })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('inventory_lines').select('id').eq('id', line.id))).toEqual([]);
    const gone = must(await world.playerB.db.from('events').select('before').eq('type', 'inventory.giveAway').is('after', null));
    expect(gone.map((e) => (e.before as { given_to?: string }).given_to).sort()).toEqual(['Old Marsh', 'The river shrine']);
  });
});
