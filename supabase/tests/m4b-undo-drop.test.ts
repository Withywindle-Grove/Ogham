// Undo a drop (M4b; ruled 2026-10-25; docs/05 "Dropping", CLAUDE.md hard rule 4;
// supabase/migrations/20261025140000_m4b_undo_drop.sql). TEST project only; invented content.
//   Dropping deletes the line; the drop's log keeps a copy, and Undo puts it back where it was, GM-only part and
//   all, even for a player who can't read that part. It comes back only where it was, and only once.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { UNDOABLE_DELETIONS, undoChange } from '../../src/core/undo.ts';
import { setCharges } from '../../src/modules/inventory/charges.ts';
import { addItem, declineItem, emptyContainer, giveAway, removeItem, type CarrierRef, type ItemCopy } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
const sack: ItemCopy = { libraryEntryId: null, name: 'Reed sack', category: 'container', weightCoin: 5, slots: 1, stack: 1 };
const rope: ItemCopy = { libraryEntryId: null, name: 'Marsh rope', category: 'gear', weightCoin: 10, slots: 1, stack: 1 };

// Added by the GM, so they count at once (a player's one-off waits for the GM).
async function add(person: Person, item: ItemCopy, qty = 1, containerLineId?: string) {
  const added = await as(person, addItem, { carrier: wren(), item, qty, howGot: 'found', containerLineId });
  if (!added.ok) throw new Error(added.message);
  return { id: added.value.id, carrier: wren() };
}
const line = async (id: string) => must(await world.admin.from('inventory_lines').select('id, qty, container_line_id, name').eq('id', id));
// The newest log line of a kind about a line, as this person sees it.
const eventFor = async (person: Person, type: string, targetId: string) =>
  must(await person.db.from('events').select('id').eq('type', type).eq('target_id', targetId).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const undo = (person: Person, eventId: string, author: Person) =>
  as(person, undoChange, { campaignId: world.campaignId, eventId, authorUserId: author.id });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('undoing a drop', () => {
  it('a player drops a stack, undoes it, and it is back as it was, in its container; a second undo is refused', async () => {
    const bag = await add(world.gm, sack);
    const ropes = await add(world.gm, rope, 3, bag.id);
    expect(await as(world.playerA, removeItem, { line: ropes, qty: 3, of: 3 })).toMatchObject({ ok: true });
    expect(await line(ropes.id)).toEqual([]);
    const dropped = await eventFor(world.playerA, 'inventory.remove', ropes.id);
    expect(await undo(world.playerA, dropped, world.playerA)).toMatchObject({ ok: true });
    expect(await line(ropes.id)).toEqual([{ id: ropes.id, qty: 3, container_line_id: bag.id, name: 'Marsh rope' }]);
    expect(await undo(world.playerA, dropped, world.playerA)).toMatchObject({ ok: false });
  });

  // Gate test 9 (2026-10-25): the second undo failed with a duplicate key, putting the line back once per drop ever logged.
  it('drop, undo, drop again, undo again: the item comes back the second time too', async () => {
    const ropes = await add(world.gm, rope, 2);
    for (let round = 0; round < 2; round++) {
      expect(await as(world.playerA, removeItem, { line: ropes, qty: 2, of: 2 })).toMatchObject({ ok: true });
      expect(await line(ropes.id)).toEqual([]);
      expect(await undo(world.playerA, await eventFor(world.playerA, 'inventory.remove', ropes.id), world.playerA)).toMatchObject({ ok: true });
      expect(await line(ropes.id)).toEqual([{ id: ropes.id, qty: 2, container_line_id: null, name: 'Marsh rope' }]);
    }
  });

  it('Drop all from Empty… comes back as one undo', async () => {
    const bag = await add(world.gm, sack);
    const a = await add(world.gm, rope, 1, bag.id);
    const b = await add(world.gm, { ...rope, name: 'Eel trap' }, 2, bag.id);
    expect(await as(world.playerA, emptyContainer, { line: bag, to: 'drop' })).toMatchObject({ ok: true, value: 2 });
    const dropped = await eventFor(world.playerA, 'inventory.empty', a.id);
    expect(await undo(world.playerA, dropped, world.playerA)).toMatchObject({ ok: true });
    expect((await line(a.id))[0]).toMatchObject({ container_line_id: bag.id });
    expect((await line(b.id))[0]).toMatchObject({ qty: 2, container_line_id: bag.id });
  });

  it('dropping a container leaves what was inside loose; the undo puts the container back and its contents in it', async () => {
    const bag = await add(world.gm, sack);
    const inside = await add(world.gm, rope, 1, bag.id);
    expect(await as(world.playerA, removeItem, { line: bag, qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect((await line(inside.id))[0]).toMatchObject({ container_line_id: null });
    expect(await undo(world.playerA, await eventFor(world.playerA, 'inventory.remove', bag.id), world.playerA)).toMatchObject({ ok: true });
    expect((await line(inside.id))[0]).toMatchObject({ container_line_id: bag.id });
  });

  it("a player's undo brings back a hidden-charge wand's GM-only total, which the player still can't read", async () => {
    const added = await as(world.gm, addItem, {
      carrier: wren(),
      item: { libraryEntryId: null, name: 'Fen wand', category: 'wand', weightCoin: 1, slots: null, stack: 1, details: { charges: { initial: '2d10' } } },
      qty: 1,
      howGot: 'found',
      chargesHidden: true,
    });
    if (!added.ok) throw new Error(added.message);
    const wand = { id: added.value.id, carrier: wren() };
    expect(await as(world.gm, setCharges, { line: wand, value: 5, hidden: true })).toMatchObject({ ok: true });
    expect(await as(world.playerA, removeItem, { line: wand, qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('inventory_line_secrets').select('id').eq('id', wand.id))).toEqual([]);
    expect(await undo(world.playerA, await eventFor(world.playerA, 'inventory.remove', wand.id), world.playerA)).toMatchObject({ ok: true });
    expect(must(await world.admin.from('inventory_line_secrets').select('charges_total').eq('id', wand.id))).toEqual([{ charges_total: 5 }]);
    expect(must(await world.playerA.db.from('inventory_line_secrets').select('charges_total').eq('id', wand.id))).toEqual([]);
    expect(must(await world.admin.from('inventory_lines').select('charges_hidden').eq('id', wand.id))).toEqual([{ charges_hidden: true }]);
  });

  it('it comes back only where it was: not into a container that has gone', async () => {
    const bag = await add(world.gm, sack);
    const inside = await add(world.gm, rope, 1, bag.id);
    expect(await as(world.playerA, removeItem, { line: inside, qty: 1, of: 1 })).toMatchObject({ ok: true });
    const dropped = await eventFor(world.playerA, 'inventory.remove', inside.id);
    expect(await as(world.playerA, removeItem, { line: bag, qty: 1, of: 1 })).toMatchObject({ ok: true });
    const refused = await undo(world.playerA, dropped, world.playerA);
    expect(refused).toMatchObject({ ok: false });
    expect(refused.ok ? '' : refused.message).toMatch(/container/);
    expect(await line(inside.id)).toEqual([]);
  });

  it('Give to → Other… comes back with Undo, and nobody it was given to is left on it', async () => {
    const ropes = await add(world.gm, rope, 2);
    expect(await as(world.playerA, giveAway, { line: ropes, qty: 2, of: 2, to: 'The ferryman' })).toMatchObject({ ok: true });
    expect(await line(ropes.id)).toEqual([]);
    expect(await undo(world.playerA, await eventFor(world.playerA, 'inventory.giveAway', ropes.id), world.playerA)).toMatchObject({ ok: true });
    expect((await line(ropes.id))[0]).toMatchObject({ qty: 2 });
    expect(must(await world.admin.from('inventory_lines').select('given_to').eq('id', ropes.id))).toEqual([{ given_to: null }]);
  });

  it('part of a stack given away: Undo puts the stack back to its count, with no extra line', async () => {
    const ropes = await add(world.gm, { ...rope, name: 'Reed torch', stack: 10 }, 6);
    expect(await as(world.playerA, giveAway, { line: ropes, qty: 2, of: 6, to: 'The ferryman' })).toMatchObject({ ok: true });
    expect((await line(ropes.id))[0]).toMatchObject({ qty: 4 });
    expect(await undo(world.playerA, await eventFor(world.playerA, 'inventory.giveAway', ropes.id), world.playerA)).toMatchObject({ ok: true });
    expect((await line(ropes.id))[0]).toMatchObject({ qty: 6 });
    expect(must(await world.admin.from('inventory_lines').select('id').eq('actor_id', world.wrenId).eq('name', 'Reed torch'))).toHaveLength(1);
  });

  it('the app and the database list the same deletions that can be undone', async () => {
    const rows = must(await world.playerA.db.from('undoable_deletions').select('name'));
    expect(rows.map((r) => r.name as string).sort()).toEqual([...UNDOABLE_DELETIONS].sort());
  });

  it("other players can't undo it; the GM's decline of a one-off can be undone, and it waits for the GM again", async () => {
    const ropes = await add(world.gm, rope);
    expect(await as(world.playerA, removeItem, { line: ropes, qty: 1, of: 1 })).toMatchObject({ ok: true });
    const dropped = await eventFor(world.playerA, 'inventory.remove', ropes.id);
    expect(await undo(world.playerB, dropped, world.playerA)).toMatchObject({ ok: false });
    expect(await line(ropes.id)).toEqual([]);

    const oneOff = await add(world.playerA, { ...rope, name: 'Odd lure' });
    expect(await as(world.gm, declineItem, { line: oneOff })).toMatchObject({ ok: true });
    const declined = must(await world.gm.db.from('events').select('id').eq('target_id', oneOff.id).is('after', null))[0]!.id as string;
    expect(await undo(world.playerA, declined, world.gm)).toMatchObject({ ok: false });
    expect(await undo(world.gm, declined, world.gm)).toMatchObject({ ok: true });
    expect(must(await world.admin.from('inventory_lines').select('approval').eq('id', oneOff.id))).toEqual([{ approval: 'pending' }]);
  });
});
