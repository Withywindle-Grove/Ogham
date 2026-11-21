// Charges and the load's tier line (M4 step 5; ruled 2026-10-23; docs/05, 07). TEST project only; invented content.
//   Visible charges live on the line: the holder sets them once (from the roll) and spends one at a time.
//   Hidden charges: the starting total is the GM's alone; the line counts uses, so the holder can always tap
//   "Use a charge"; at zero the GM gets a quiet note, and the holder learns only when the GM reveals it.
//   Only the GM recharges (even where the pack says not rechargeable) and reveals "spent".
//   The tier line: the database's alone since M5 step 4 (m5-intents.test.ts); devices can't write it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { recharge, revealSpent, setCharges, useCharge } from '../../src/modules/inventory/charges.ts';
import { addItem, loadInventory, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });

// A hidden-charge wand comes from the GM: a player's new line takes the switch from the setting rules (this
// campaign has none), never from the device (m4-review.test.ts).
async function wand(name: string, chargesHidden: boolean) {
  const added = await as(chargesHidden ? world.gm : world.playerA, addItem, {
    carrier: wren(),
    item: { libraryEntryId: null, name, category: 'wand', weightCoin: 1, slots: null, stack: 1, details: { charges: { initial: '2d10' } } },
    qty: 1,
    howGot: 'found',
    chargesHidden,
  });
  if (!added.ok) throw new Error(added.message);
  return { id: added.value.id, carrier: wren() };
}
const row = async (id: string) => must(await world.admin.from('inventory_lines').select('charges_left, charges_used, charges_hidden, spent_shown').eq('id', id))[0]!;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('visible charges', () => {
  it('the holder sets them once from the roll, spends one at a time, and stops at zero', async () => {
    const line = await wand('Glow wand', false);
    expect(await as(world.playerA, setCharges, { line, value: 2, hidden: false })).toMatchObject({ ok: true });
    expect(await as(world.playerA, setCharges, { line, value: 20, hidden: false })).toMatchObject({ ok: false });
    expect(await as(world.playerA, useCharge, { line, hidden: false })).toMatchObject({ ok: true });
    expect(await as(world.playerA, useCharge, { line, hidden: false })).toMatchObject({ ok: true });
    expect(await row(line.id)).toMatchObject({ charges_left: 0 });
    expect(await as(world.playerA, useCharge, { line, hidden: false })).toMatchObject({ ok: false, message: 'No charges left.' });
    // Nor straight in the database: only one down at a time, never back up.
    await world.playerA.db.from('inventory_lines').update({ charges_left: 9 }).eq('id', line.id);
    expect(await row(line.id)).toMatchObject({ charges_left: 0 });
    expect(must(await world.playerB.db.from('events').select('type').eq('target_id', line.id).eq('type', 'inventory.useCharge'))).toHaveLength(2);
  });

  it('the GM recharges, even where the pack says not; players can’t', async () => {
    const line = await wand('Ash rod', false);
    await as(world.playerA, setCharges, { line, value: 1, hidden: false });
    expect(await as(world.playerA, recharge, { line, amount: 5, hidden: false })).toMatchObject({ ok: false });
    expect(await as(world.gm, recharge, { line, amount: 5, hidden: false })).toMatchObject({ ok: true });
    expect(await row(line.id)).toMatchObject({ charges_left: 6 });
  });
});

describe('hidden charges', () => {
  it('only the GM sets and sees the total; the holder can always use one, and every use is logged', async () => {
    const line = await wand('Murky wand', true);
    expect(await as(world.playerA, setCharges, { line, value: 2, hidden: true })).toMatchObject({ ok: false });
    expect(await as(world.gm, setCharges, { line, value: 2, hidden: true })).toMatchObject({ ok: true });
    expect(must(await world.playerA.db.from('inventory_line_secrets').select('charges_total').eq('id', line.id))).toEqual([]);
    expect(must(await world.gm.db.from('inventory_line_secrets').select('charges_total, spent').eq('id', line.id))).toEqual([{ charges_total: 2, spent: false }]);

    for (let i = 0; i < 3; i += 1) expect(await as(world.playerA, useCharge, { line, hidden: true })).toMatchObject({ ok: true });
    // The third use, with none left, shows the holder it seems spent (ruled 2026-10-24).
    expect(await row(line.id)).toMatchObject({ charges_used: 3, spent_shown: true });
    expect(must(await world.playerA.db.from('events').select('id').eq('target_id', line.id).eq('type', 'inventory.useCharge'))).toHaveLength(3);
  });

  it('at zero the GM gets a quiet note; the holder learns only when the GM reveals it', async () => {
    const line = await wand('Dim wand', true);
    await as(world.gm, setCharges, { line, value: 1, hidden: true });
    await as(world.playerA, useCharge, { line, hidden: true });
    const notes = async (person: Person) => must(await person.db.from('events').select('after').eq('target_table', 'inventory_line_secrets').eq('target_id', line.id));
    expect(await notes(world.gm)).toContainEqual({ after: { spent: true } });
    expect(await notes(world.playerA)).toEqual([]);
    expect((await loadInventory(asDb(world.playerA), world.campaignId))!.lines.find((l) => l.id === line.id)).toMatchObject({ spentShown: false });

    expect(await as(world.playerA, revealSpent, { line })).toMatchObject({ ok: false });
    expect(await as(world.gm, revealSpent, { line })).toMatchObject({ ok: true });
    expect((await loadInventory(asDb(world.playerA), world.campaignId))!.lines.find((l) => l.id === line.id)).toMatchObject({ spentShown: true });
  });

  it('a hidden recharge adds to the GM’s total and clears spent', async () => {
    const line = await wand('Pale wand', true);
    await as(world.gm, setCharges, { line, value: 1, hidden: true });
    await as(world.playerA, useCharge, { line, hidden: true });
    expect(await as(world.gm, recharge, { line, amount: 3, hidden: true })).toMatchObject({ ok: true });
    expect(must(await world.gm.db.from('inventory_line_secrets').select('charges_total, spent').eq('id', line.id))).toEqual([{ charges_total: 4, spent: false }]);
    expect(await row(line.id)).toMatchObject({ spent_shown: false });
  });
});

describe('the tier line', () => {
  it('no device writes a tier any more, not even for its own character: the database works it out (M5 step 4)', async () => {
    const before = must(await world.admin.from('carrier_loads').select('tier').eq('actor_id', world.wrenId));
    await world.playerA.db.from('carrier_loads').upsert({ actor_id: world.wrenId, campaign_id: world.campaignId, tier: 'Loaded' });
    await world.gm.db.from('carrier_loads').upsert({ actor_id: world.ashId, campaign_id: world.campaignId, tier: 'Bowed' });
    expect(must(await world.admin.from('carrier_loads').select('tier').eq('actor_id', world.wrenId))).toEqual(before);
    expect(must(await world.admin.from('carrier_loads').select('tier').eq('tier', 'Bowed').eq('campaign_id', world.campaignId))).toEqual([]);
    expect(must(await world.playerB.db.from('events').select('after').eq('type', 'load.tier'))).not.toContainEqual({ after: { tier: 'Loaded' } });
  });
});

describe('the roll behind a charge count (2026-10-23: every dice entry logged the same way)', () => {
  it('a recharge keeps "2d6 → 7" where the count is: on the line when visible, with the GM when hidden', async () => {
    const shown = await wand('Bright wand', false);
    await as(world.playerA, setCharges, { line: shown, value: 4, hidden: false, roll: '2d10 → 4' });
    expect(await as(world.gm, recharge, { line: shown, amount: 7, hidden: false, roll: '2d6 → 7' })).toMatchObject({ ok: true });
    expect(must(await world.playerB.db.from('inventory_lines').select('charges_left, last_roll').eq('id', shown.id))).toEqual([{ charges_left: 11, last_roll: '2d6 → 7' }]);

    const secret = await wand('Shadow wand', true);
    await as(world.gm, setCharges, { line: secret, value: 2, hidden: true, roll: '2d10 → 2' });
    await as(world.gm, recharge, { line: secret, amount: 5, hidden: true, roll: '1d6 → 5' });
    expect(must(await world.playerA.db.from('inventory_lines').select('last_roll').eq('id', secret.id))).toEqual([{ last_roll: null }]);
    expect(must(await world.gm.db.from('inventory_line_secrets').select('charges_total, last_roll').eq('id', secret.id))).toEqual([{ charges_total: 7, last_roll: '1d6 → 5' }]);
  });

  it("a player can't rewrite the roll note once the charges are set", async () => {
    const line = await wand('Plain wand', false);
    await as(world.playerA, setCharges, { line, value: 3, hidden: false, roll: '2d10 → 3' });
    await world.playerA.db.from('inventory_lines').update({ last_roll: '2d10 → 20' }).eq('id', line.id);
    expect(must(await world.admin.from('inventory_lines').select('last_roll').eq('id', line.id))).toEqual([{ last_roll: '2d10 → 3' }]);
  });
});
