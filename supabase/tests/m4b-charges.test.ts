// Hidden charges found out in play (M4b step 1c; ruled 2026-10-24; docs/05, 07 "Charges";
// supabase/migrations/20261025090000_m4b_charges.sql). TEST project only; invented content.
//   The last charge looks normal; used again with none left, the database shows the holder it's spent.
//   The GM's Reveal shows the count from then on, like visible charges.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { revealCharges, setCharges, useCharge } from '../../src/modules/inventory/charges.ts';
import { addItem, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
const row = async (id: string) => must(await world.admin.from('inventory_lines').select('charges_used, charges_hidden, charges_left, spent_shown').eq('id', id))[0]!;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('hidden charges found out in play', () => {
  it('the last use looks normal; the next one shows the holder it seems spent; the GM can then reveal the count', async () => {
    const added = await as(world.gm, addItem, {
      carrier: wren(),
      item: { libraryEntryId: null, name: 'Murky wand', category: 'wand', weightCoin: 1, slots: null, stack: 1, details: { charges: { initial: '1d4' } } },
      qty: 1,
      howGot: 'found',
      chargesHidden: true,
    });
    if (!added.ok) throw new Error(added.message);
    const line = { id: added.value.id, carrier: wren() };
    expect((await as(world.gm, setCharges, { line, value: 1, hidden: true })).ok).toBe(true);

    expect((await as(world.playerA, useCharge, { line, hidden: true })).ok).toBe(true);
    expect(await row(line.id)).toMatchObject({ charges_used: 1, spent_shown: false });
    expect((await as(world.playerA, useCharge, { line, hidden: true })).ok).toBe(true);
    expect(await row(line.id)).toMatchObject({ charges_used: 2, spent_shown: true });
    // The player still can't set it themselves.
    await world.playerA.db.from('inventory_lines').update({ spent_shown: false }).eq('id', line.id);
    expect((await row(line.id)).spent_shown).toBe(true);

    expect((await as(world.playerA, revealCharges, { line, left: 5 })).ok).toBe(false);
    expect((await as(world.gm, revealCharges, { line, left: 0 })).ok).toBe(true);
    expect(await row(line.id)).toMatchObject({ charges_hidden: false, charges_left: 0, spent_shown: false });
    expect(must(await world.playerA.db.from('inventory_lines').select('charges_left').eq('id', line.id))).toEqual([{ charges_left: 0 }]);
  });
});
