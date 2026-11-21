// Use one up from At hand (Design on #552, 2026-11-07; supabase/migrations/20261107200000_m5b_players_c_item_use.sql).
// TEST project only; invented content. Purposes:
//   item.use counts a stack down by one, logged as item.use (Simple), and Undo puts the one back.
//   The last one leaves play: the line is deleted, the log keeps its copy, and Undo puts it back (hard rule 4).
//   A player can't use up someone else's item.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { addItem, useItem, type CarrierRef, type ItemCopy } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
const arrows: ItemCopy = { libraryEntryId: null, name: 'Reed arrows', category: 'ammunition', weightCoin: 1, slots: 1, stack: 20 };
const draught: ItemCopy = { libraryEntryId: null, name: 'Moss draught', category: 'potion', weightCoin: 5, slots: 1, stack: 1 };

async function add(item: ItemCopy, qty: number) {
  const added = await as(world.gm, addItem, { carrier: wren(), item, qty, howGot: 'found' });
  if (!added.ok) throw new Error(added.message);
  return { id: added.value.id, carrier: wren() };
}
const line = async (id: string) => must(await world.admin.from('inventory_lines').select('id, qty, name').eq('id', id));
const eventOf = async (targetId: string) =>
  must(await world.playerA.db.from('events').select('id, type, level, before, after').eq('type', 'item.use').eq('target_id', targetId).order('seq', { ascending: false }).limit(1))[0]!;
const undo = (eventId: string) => as(world.playerA, undoChange, { campaignId: world.campaignId, eventId, authorUserId: world.playerA.id });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('item.use (use one up)', () => {
  it('counts a stack down by one, logged as item.use, and Undo puts it back', async () => {
    const quiver = await add(arrows, 18);
    expect(await as(world.playerA, useItem, { line: quiver, of: 18, verb: 'Fire' })).toMatchObject({ ok: true, value: 17 });
    expect(await line(quiver.id)).toEqual([{ id: quiver.id, qty: 17, name: 'Reed arrows' }]);
    const used = await eventOf(quiver.id);
    expect(used).toMatchObject({ type: 'item.use', level: 'simple' });
    expect(await undo(used.id as string)).toMatchObject({ ok: true });
    expect(await line(quiver.id)).toEqual([{ id: quiver.id, qty: 18, name: 'Reed arrows' }]);
  });

  it('the last one leaves play, the log keeps a copy, and Undo brings it back', async () => {
    const one = await add(draught, 1);
    expect(await as(world.playerA, useItem, { line: one, of: 1, verb: 'Drink' })).toMatchObject({ ok: true, value: 0 });
    expect(await line(one.id)).toEqual([]);
    const used = await eventOf(one.id);
    expect(used.after).toBeNull();
    expect(used.before).toMatchObject({ name: 'Moss draught', qty: 1 });
    expect(await undo(used.id as string)).toMatchObject({ ok: true });
    expect(await line(one.id)).toEqual([{ id: one.id, qty: 1, name: 'Moss draught' }]);
  });

  it("a player can't use up someone else's item", async () => {
    const quiver = await add(arrows, 5);
    expect(await as(world.playerB, useItem, { line: quiver, of: 5, verb: 'Fire' })).toMatchObject({ ok: false });
    expect(await line(quiver.id)).toEqual([{ id: quiver.id, qty: 5, name: 'Reed arrows' }]);
  });
});
