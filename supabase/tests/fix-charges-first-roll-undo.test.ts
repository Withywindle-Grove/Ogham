// fix-charges-first-roll-undo: the charges guard (private.guard_charges, newest in 20261024230000_m4_review_fixes.sql)
// lets every Undo through (grimoire.reverting). A player rolls an item's visible charges once (the count goes from
// empty to a number); their own Undo put the count back to empty, so they could roll again: a re-roll. Ruled by
// Francis on 2026-11-21 ("A"): a player cannot undo a first roll of charges; only the GM can.
// TEST project only (CI: a local Supabase); invented content.
//   Purpose:
//   1. A player's own Undo of their first roll of visible charges is refused, saying why, and the count stays as
//      rolled, so it can't be rolled again.
//   2. The GM's Undo of that first roll still empties the count.
//   3. A player's Undo of a used visible charge still gives the charge back.
//   4. A player's Undo of a used hidden charge still takes the use back off the count.
//   5. A player's Undo of a give of an item whose charges were rolled still brings it back, the count unchanged.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { setCharges, useCharge } from '../../src/modules/inventory/charges.ts';
import { addItem, moveItem, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
const carrierOf = (actorId: string, ownerUserId: string): CarrierRef => ({ campaignId: world.campaignId, actorId, locationId: null, ownerUserId, archived: false });
const wren = () => carrierOf(world.wrenId, world.playerA.id);
const ash = () => carrierOf(world.ashId, world.playerB.id);
const row = async (id: string) =>
  must(await world.admin.from('inventory_lines').select('actor_id, charges_left, charges_used, last_roll').eq('id', id).single());
const eventFor = async (person: Person, type: string, targetId: string) =>
  must(await world.admin.from('events').select('id').eq('type', type).eq('target_id', targetId).eq('actor_user_id', person.id).order('seq', { ascending: false }).limit(1))[0]!
    .id as string;
const undo = (person: Person, eventId: string, author: Person) => as(person, undoChange, { campaignId: world.campaignId, eventId, authorUserId: author.id });

/** A wand on Wren with charges from the setting rules' dice; hidden ones come from the GM. */
async function wand(name: string, chargesHidden = false) {
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

/** A visible-charge wand whose count player A rolled: 7, from "2d10 → 7". */
async function rolled(name: string) {
  const line = await wand(name);
  expect(await as(world.playerA, setCharges, { line, value: 7, hidden: false, roll: '2d10 → 7' })).toMatchObject({ ok: true });
  expect(await row(line.id)).toMatchObject({ charges_left: 7, last_roll: '2d10 → 7' });
  return { line, roll: await eventFor(world.playerA, 'inventory.setCharges', line.id) };
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('the Undo of a first roll of charges', () => {
  it.fails("1. the player's own Undo is refused, saying why, and the count stays as rolled", async () => {
    const { line, roll } = await rolled('Reedwhistle wand');
    expect(await undo(world.playerA, roll, world.playerA)).toMatchObject({ ok: false, reason: 'not-allowed' });
    const { error } = await world.playerA.db.rpc('undo_request_said', { event_id: roll });
    expect(error?.message).toBe('Only the GM can undo a first roll of charges.');
    expect(await row(line.id)).toMatchObject({ charges_left: 7, last_roll: '2d10 → 7' });
    // So no second roll either.
    expect(await as(world.playerA, setCharges, { line, value: 20, hidden: false, roll: '2d10 → 20' })).toMatchObject({ ok: false });
    expect(await row(line.id)).toMatchObject({ charges_left: 7 });
  });

  it("2. the GM's Undo of the player's first roll still empties the count", async () => {
    const { line, roll } = await rolled('Mudlark wand');
    expect(await undo(world.gm, roll, world.playerA)).toMatchObject({ ok: true });
    expect(await row(line.id)).toMatchObject({ charges_left: null, last_roll: null });
  });
});

describe('other Undos through the same guard still work', () => {
  it("3. a player's Undo of a used visible charge gives the charge back", async () => {
    const { line } = await rolled('Fenlight wand');
    expect(await as(world.playerA, useCharge, { line, hidden: false })).toMatchObject({ ok: true });
    expect(await row(line.id)).toMatchObject({ charges_left: 6 });
    expect(await undo(world.playerA, await eventFor(world.playerA, 'inventory.useCharge', line.id), world.playerA)).toMatchObject({ ok: true });
    expect(await row(line.id)).toMatchObject({ charges_left: 7 });
  });

  it("4. a player's Undo of a used hidden charge takes the use back off the count", async () => {
    const line = await wand('Silt wand', true);
    expect(await as(world.gm, setCharges, { line, value: 3, hidden: true })).toMatchObject({ ok: true });
    expect(await as(world.playerA, useCharge, { line, hidden: true })).toMatchObject({ ok: true });
    expect(await row(line.id)).toMatchObject({ charges_used: 1 });
    expect(await undo(world.playerA, await eventFor(world.playerA, 'inventory.useCharge', line.id), world.playerA)).toMatchObject({ ok: true });
    expect(await row(line.id)).toMatchObject({ charges_used: 0 });
  });

  it("5. a player's Undo of a give of a rolled wand brings it back, the count unchanged", async () => {
    const { line } = await rolled('Heronbone wand');
    expect(await as(world.playerA, moveItem, { line, to: ash(), qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(await row(line.id)).toMatchObject({ actor_id: world.ashId, charges_left: 7 });
    expect(await undo(world.playerA, await eventFor(world.playerA, 'inventory.move', line.id), world.playerA)).toMatchObject({ ok: true });
    expect(await row(line.id)).toMatchObject({ actor_id: world.wrenId, charges_left: 7, last_roll: '2d10 → 7' });
  });
});
