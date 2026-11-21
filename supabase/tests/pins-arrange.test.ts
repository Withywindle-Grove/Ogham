// At hand pins and Arrange this screen (M4 step 6; ruled 2026-10-23). TEST project only; invented content.
//   Pins: items only in M4; per character; logged; a pin goes away by itself when its item leaves the character.
//   Arrange: per character, the same on every device; the owner or the GM; in the detailed log only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { arrangeScreen, loadScreenLayout } from '../../src/modules/characters/screenLayout.ts';
import { addItem, hideFromAtHand, moveItem, pinItem, removeItem, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
const ash = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.ashId, locationId: null, ownerUserId: world.playerB.id, archived: false });

async function item(name: string) {
  const added = await as(world.playerA, addItem, { carrier: wren(), item: { libraryEntryId: null, name, category: 'weapon', weightCoin: 30, slots: null, stack: 1 }, qty: 1, howGot: 'found' });
  if (!added.ok) throw new Error(added.message);
  return { id: added.value.id, carrier: wren() };
}
const pinned = async (id: string) => must(await world.admin.from('inventory_lines').select('pinned').eq('id', id))[0]?.pinned;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('At hand pins', () => {
  it('the holder pins and unpins an item; it is logged; someone else can’t', async () => {
    const line = await item('Short sword');
    expect(await as(world.playerB, pinItem, { line, pinned: true })).toMatchObject({ ok: false });
    expect(await as(world.playerA, pinItem, { line, pinned: true })).toMatchObject({ ok: true });
    expect(await pinned(line.id)).toBe(true);
    expect(must(await world.playerB.db.from('events').select('type').eq('target_id', line.id).eq('type', 'inventory.pin'))).toHaveLength(1);
    expect(await as(world.playerA, pinItem, { line, pinned: false })).toMatchObject({ ok: true });
    expect(await pinned(line.id)).toBe(false);
  });

  it('a pin goes away by itself when the item leaves: given away, or dropped', async () => {
    const given = await item('Sling');
    await as(world.playerA, pinItem, { line: given, pinned: true });
    await as(world.playerA, moveItem, { line: given, to: ash(), qty: 1, of: 1 });
    expect(await pinned(given.id)).toBe(false);

    const dropped = await item('Dagger');
    await as(world.playerA, pinItem, { line: dropped, pinned: true });
    await as(world.playerA, removeItem, { line: dropped, qty: 1, of: 1 });
    expect(must(await world.admin.from('inventory_lines').select('id').eq('id', dropped.id))).toEqual([]);
  });
});

describe('Hiding from At hand (ruled 2026-10-23)', () => {
  it('the holder hides and shows again, in the detailed log only; someone else can’t; it goes when the item leaves', async () => {
    const line = await item('Reed spear');
    const hidden = async () => must(await world.admin.from('inventory_lines').select('at_hand_hidden').eq('id', line.id))[0]?.at_hand_hidden;
    expect(await as(world.playerB, hideFromAtHand, { line, hidden: true })).toMatchObject({ ok: false });
    expect(await hidden()).toBe(false);
    expect(await as(world.playerA, hideFromAtHand, { line, hidden: true })).toMatchObject({ ok: true, value: true });
    expect(must(await world.playerA.db.from('events').select('level').eq('target_id', line.id).eq('type', 'inventory.atHand'))).toEqual([{ level: 'verbose' }]);
    expect(await as(world.playerA, moveItem, { line, to: ash(), qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(await hidden()).toBe(false);
  });
});

describe('Arrange this screen', () => {
  const layout = [
    { section: 'at-hand', shown: true },
    { section: 'hp', shown: false },
  ];

  it('the owner arranges their character’s screen, the same on every device; others can’t', async () => {
    expect(await as(world.playerB, arrangeScreen, { character: { campaignId: world.campaignId, id: world.wrenId, ownerUserId: world.playerA.id }, sections: layout })).toMatchObject({ ok: false });
    expect(await as(world.playerA, arrangeScreen, { character: { campaignId: world.campaignId, id: world.wrenId, ownerUserId: world.playerA.id }, sections: layout })).toMatchObject({ ok: true });
    expect(await loadScreenLayout(asDb(world.playerA), world.wrenId)).toEqual(layout);
    expect(await as(world.gm, arrangeScreen, { character: { campaignId: world.campaignId, id: world.wrenId, ownerUserId: world.playerA.id }, sections: [...layout].reverse() })).toMatchObject({ ok: true });
  });

  it('is in the detailed log only', async () => {
    const events = must(await world.gm.db.from('events').select('type, level').eq('type', 'character.arrange'));
    expect(events.length).toBeGreaterThan(0);
    expect(new Set(events.map((e) => e.level))).toEqual(new Set(['verbose']));
  });
});
