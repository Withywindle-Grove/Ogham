// One-off items and the campaign setting "One-off items need approval" (M4b step 1d; ruled 2026-10-24; docs/05;
// supabase/migrations/20261025100000_m4b_one_off_approval.sql). TEST project only; invented content.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { addItem, approveItem, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
const oneOff = (name: string) =>
  as(world.playerA, addItem, { carrier: wren(), item: { libraryEntryId: null, name, category: 'gear', weightCoin: 15, slots: null, stack: 1 }, qty: 1, howGot: 'found' });
const setApproval = async (on: boolean) => {
  const [row] = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId));
  await world.admin.from('campaigns').update({ settings: { ...(row!.settings as object), oneOffApproval: on } }).eq('id', world.campaignId);
};

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('one-off items', () => {
  it('wait for the GM by default; with the setting off, they count at once', async () => {
    const waiting = await oneOff('Mossy idol');
    expect(waiting.ok && waiting.value.approval).toBe('pending');
    await setApproval(false);
    const counted = await oneOff('Bent nail');
    expect(counted.ok && counted.value.approval).toBe('approved');
    await setApproval(true);
  });

  it('the GM can edit a one-off while approving it; a player can neither approve nor edit it', async () => {
    const made = await oneOff('Odd pebble');
    if (!made.ok) throw new Error(made.message);
    const line = { id: made.value.id, carrier: wren() };
    expect((await as(world.playerA, approveItem, { line, edits: { name: 'Gem', weightCoin: 0, slots: null } })).ok).toBe(false);
    const approved = await as(world.gm, approveItem, { line, edits: { name: 'Odd pebble of the fen', weightCoin: 2, slots: null } });
    expect(approved.ok && approved.value).toMatchObject({ name: 'Odd pebble of the fen', weightCoin: 2, approval: 'approved' });
  });
});
