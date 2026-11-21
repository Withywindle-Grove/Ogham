// M5 step 7: light (supabase/migrations/20261030161000_m5_light.sql; docs/05 "Expeditions, time and light", "Items
// leaving play"; ruled M5-8, M5-9, D29, and the Set time… rulings of 2026-10-29). TEST project only; invented lights.
//   Every character has one light row, unlit, read like the character; the owner or the GM lights and puts it out.
//   Lights burn with the clock, in the same request as the time move: a used-up light loses one of its stack (the line
//   goes with the last, the log keeps a copy), logged as light.burnOut in the Simple log; undoing the move brings it
//   back. Keep lit relights from the carrier's own pack as often as the jump needs. A holder stays and is refilled
//   with one fuel item. Put out keeps the time left. Set time… forwards burns out what ran out; backwards gives lights
//   their time back, up to their whole length, and burnt-out lights stay gone. A holder swapped for another light
//   keeps the fuel left in it (a torch's leftover is dropped; ruled 2026-10-30).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { toCharacterRef } from '../../src/modules/characters/commands.ts';
import { douseLight, keepLightLit, lightLight, refillLight, toCharacterLight, type CharacterLight, type LightOption } from '../../src/modules/expedition/lightPlay.ts';
import { advanceTime, setTime, toClock, type Clock } from '../../src/modules/expedition/play.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I, requestId?: string) {
  return runCommand(registry, asDb(person), await userOf(person), command, input, { requestId });
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

const TURN = 600;

/** A fresh campaign with the world's GM and both players, and an approved character each. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reed Lantern Road', created_by: world.gm.id }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaign.id, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  const pc = (name: string, owner: Person) => ({ campaign_id: campaign.id, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [reed, moss] = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select());
  return { campaignId: campaign.id as string, reed: toCharacterRef(reed as Parameters<typeof toCharacterRef>[0]), moss: toCharacterRef(moss as Parameters<typeof toCharacterRef>[0]) };
}

/** A line of invented lights (or fuel) on a character. */
async function carry(campaignId: string, actorId: string, name: string, qty: number, details: Record<string, unknown> = {}, sourceEntryId: string | null = null) {
  // An item from setting rules keeps its pack and its id there (a carried-over copy: its entry isn't needed here).
  const fromPack = sourceEntryId ? { source_pack_id: must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Fen lights' }).select('id').single()).id } : {};
  return must(
    await world.admin
      .from('inventory_lines')
      .insert({ campaign_id: campaignId, actor_id: actorId, name, category: 'light', weight_coin: 1, stack: 1, qty, how_got: 'found', item_data: details, source_entry_id: sourceEntryId, ...fromPack })
      .select('id, name, qty, version')
      .single(),
  ) as { id: string; name: string; qty: number; version: number };
}

/** Rushlights: used up when they burn out, 6 turns each, warning in the last. */
const rushlight = (line: { id: string; name: string; qty: number; version: number }): LightOption => ({
  line,
  type: { id: 'rushlight', name: 'Rushlight', seconds: 6 * TURN, warnSeconds: TURN, consumed: true, fuel: null },
  unit: { name: 'turn', seconds: TURN },
  radius: null,
});
/** A reed lamp: a holder that burns one flask of fen oil for 4 turns. */
const reedLamp = (line: { id: string; name: string; qty: number; version: number }): LightOption => ({
  line,
  type: { id: 'reed-lamp', name: 'Reed lamp', seconds: 4 * TURN, warnSeconds: TURN, consumed: false, fuel: 'fen-oil' },
  unit: { name: 'turn', seconds: TURN },
  radius: null,
});

const clockOf = async (campaignId: string): Promise<Clock> => toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
const lightOf = async (actorId: string): Promise<CharacterLight> => toCharacterLight(must(await world.admin.from('character_lights').select('*').eq('actor_id', actorId).single()));
const needsFuel = async (id: string) => (must(await world.admin.from('inventory_lines').select('needs_fuel').eq('id', id).single()) as { needs_fuel: boolean }).needs_fuel;
const lineOf = async (id: string) => must(await world.admin.from('inventory_lines').select('id, qty').eq('id', id)) as { id: string; qty: number }[];
const eventsOf = async (requestId: string) => must(await world.admin.from('events').select('id, type, level, target_table, before, after').eq('request_id', requestId).order('seq'));
const turns = async (campaignId: string, n: number, requestId?: string) => ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: n * TURN }, requestId));
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('a light row for each character', () => {
  it('every character has one, made with it and unlit; members read it, an outsider reads nothing', async () => {
    const { reed, moss } = await freshTable();
    const asB = must(await world.playerB.db.from('character_lights').select('actor_id, lit_at').eq('actor_id', reed.id));
    expect(asB).toEqual([{ actor_id: reed.id, lit_at: null }]);
    expect((await lightOf(moss.id)).litAt).toBeNull();
    expect(must(await world.outsider.db.from('character_lights').select('id').eq('actor_id', reed.id))).toEqual([]);
  });
});

describe('Light and Put out (journey 5)', () => {
  it("a player lights their own character's light at the clock's time; logged in the detailed log; Undo puts it out", async () => {
    const { campaignId, reed } = await freshTable();
    await turns(campaignId, 2);
    const line = await carry(campaignId, reed.id, 'Rushlights', 3, { lightTypeId: 'rushlight' });
    const requestId = crypto.randomUUID();
    const lit = await ok(as(world.playerA, lightLight, { character: reed, light: await lightOf(reed.id), option: rushlight(line) }, requestId));
    expect(lit).toMatchObject({ lineId: line.id, typeId: 'rushlight', name: 'Rushlight', litAt: 2 * TURN, burnSeconds: 6 * TURN, warnSeconds: TURN, consumed: true });
    expect((await eventsOf(requestId)).map((e) => [e.type, e.level])).toEqual([['light.light', 'verbose']]);
    expect(await undo(world.playerA, campaignId, (await eventsOf(requestId))[0]!.id as string)).toMatchObject({ ok: true });
    expect((await lightOf(reed.id)).litAt).toBeNull();
  });

  it("a player can't light someone else's character's light, nor a line that isn't in the pack", async () => {
    const { campaignId, reed, moss } = await freshTable();
    const line = await carry(campaignId, reed.id, 'Rushlights', 3, { lightTypeId: 'rushlight' });
    const refused = await as(world.playerB, lightLight, { character: { ...reed, ownerUserId: world.playerB.id }, light: null, option: rushlight(line) });
    expect(refused).toMatchObject({ ok: false, reason: 'not-allowed' });
    const notTheirs = await as(world.playerB, lightLight, { character: moss, light: null, option: rushlight(line) });
    expect(notTheirs.ok ? 'lit' : notTheirs.message).toMatch(/isn't in their pack/);
    // Straight to the table: nothing changes.
    await world.playerB.db.from('character_lights').update({ lit_at: 0 }).eq('actor_id', reed.id);
    expect((await lightOf(reed.id)).litAt).toBeNull();
  });

  it('Put out keeps its time left, and the same light lit again burns on from there', async () => {
    const { campaignId, reed } = await freshTable();
    const line = await carry(campaignId, reed.id, 'Rushlights', 2, { lightTypeId: 'rushlight' });
    await ok(as(world.playerA, lightLight, { character: reed, light: null, option: rushlight(line) }));
    await turns(campaignId, 2);
    const doused = await ok(as(world.playerA, douseLight, { character: reed, light: await lightOf(reed.id) }));
    expect(doused).toMatchObject({ litAt: null, leftSeconds: 4 * TURN });
    await turns(campaignId, 5);
    const again = await ok(as(world.playerA, lightLight, { character: reed, light: await lightOf(reed.id), option: rushlight(line) }));
    expect(again).toMatchObject({ litAt: 7 * TURN, burnSeconds: 4 * TURN, leftSeconds: null });
  });
});

describe('burning down with the clock', () => {
  it('Next turn past its end burns it out: one of the stack is used up, logged Simple with the time move', async () => {
    const { campaignId, reed } = await freshTable();
    const line = await carry(campaignId, reed.id, 'Rushlights', 3, { lightTypeId: 'rushlight' });
    await ok(as(world.playerA, lightLight, { character: reed, light: null, option: rushlight(line) }));
    await turns(campaignId, 5);
    expect((await lightOf(reed.id)).litAt).toBe(0);
    const requestId = crypto.randomUUID();
    await turns(campaignId, 1, requestId);
    expect(await lightOf(reed.id)).toMatchObject({ litAt: null, outAt: 6 * TURN, lineId: line.id });
    expect(await lineOf(line.id)).toEqual([{ id: line.id, qty: 2 }]);
    const events = await eventsOf(requestId);
    expect(events.map((e) => [e.type, e.target_table, e.level])).toEqual([
      ['time.advance', 'campaign_clocks', 'verbose'],
      ['light.burnOut', 'inventory_lines', 'simple'],
      ['light.burnOut', 'character_lights', 'simple'],
    ]);
    // Players see the burnout (Reed's is approved, so everyone does).
    const seen = must(await world.playerB.db.from('events').select('type').eq('request_id', requestId).eq('target_table', 'character_lights'));
    expect(seen).toEqual([{ type: 'light.burnOut' }]);
  });

  it('the last one burnt out leaves play (the log keeps a copy); undoing the turn brings it back, lit', async () => {
    const { campaignId, reed } = await freshTable();
    const line = await carry(campaignId, reed.id, 'Rushlight', 1, { lightTypeId: 'rushlight' });
    await ok(as(world.playerA, lightLight, { character: reed, light: null, option: rushlight(line) }));
    const requestId = crypto.randomUUID();
    await turns(campaignId, 7, requestId);
    expect(await lineOf(line.id)).toEqual([]);
    const gone = (await eventsOf(requestId)).find((e) => e.target_table === 'inventory_lines');
    expect(gone).toMatchObject({ type: 'light.burnOut', after: null, before: { name: 'Rushlight', qty: 1 } });
    const clockEvent = (await eventsOf(requestId)).find((e) => e.target_table === 'campaign_clocks')!;
    expect(await undo(world.gm, campaignId, clockEvent.id as string)).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toEqual([{ id: line.id, qty: 1 }]);
    expect(await lightOf(reed.id)).toMatchObject({ litAt: 0, outAt: null });
    expect((await clockOf(campaignId)).seconds).toBe(0);
  });

  it('Keep lit lights another from the carrier\'s own pack, as many times as the jump needs', async () => {
    const { campaignId, reed } = await freshTable();
    const line = await carry(campaignId, reed.id, 'Rushlights', 3, { lightTypeId: 'rushlight' });
    await ok(as(world.playerA, lightLight, { character: reed, light: null, option: rushlight(line) }));
    const kept = await ok(as(world.playerA, keepLightLit, { character: reed, light: await lightOf(reed.id), keep: true }));
    expect(kept.keepLit).toBe(true);
    await turns(campaignId, 13);
    // Two burnt out (at 6 and 12 turns); the third was lit at 12 turns and burns on.
    expect(await lineOf(line.id)).toEqual([{ id: line.id, qty: 1 }]);
    expect(await lightOf(reed.id)).toMatchObject({ litAt: 12 * TURN, burnSeconds: 6 * TURN, outAt: null, keepLit: true });
    // The last one goes too, and with none left the light is out.
    await turns(campaignId, 6);
    expect(await lineOf(line.id)).toEqual([]);
    expect(await lightOf(reed.id)).toMatchObject({ litAt: null, outAt: 18 * TURN });
  });

  it('a holder stays when it burns out; it needs a Refill (one fuel item) before it lights again', async () => {
    const { campaignId, reed } = await freshTable();
    const lamp = await carry(campaignId, reed.id, 'Reed lamp', 1, { lightTypeId: 'reed-lamp' });
    const oil = await carry(campaignId, reed.id, 'Fen oil', 1, {}, 'fen-oil');
    await ok(as(world.playerA, lightLight, { character: reed, light: null, option: reedLamp(lamp) }));
    await turns(campaignId, 4);
    expect(await lineOf(lamp.id)).toEqual([{ id: lamp.id, qty: 1 }]);
    expect(await lightOf(reed.id)).toMatchObject({ litAt: null, outAt: 4 * TURN });
    const relight = await as(world.playerA, lightLight, { character: reed, light: await lightOf(reed.id), option: reedLamp(lamp) });
    expect(relight.ok ? 'lit' : relight.message).toBe('It burnt out. Refill it first.');
    // Refill uses the last flask (it leaves play) and the lamp burns its whole length again from now.
    const requestId = crypto.randomUUID();
    const refilled = await ok(as(world.playerA, refillLight, { character: reed, light: await lightOf(reed.id) }, requestId));
    expect(refilled).toMatchObject({ litAt: 4 * TURN, burnSeconds: 4 * TURN, outAt: null });
    expect(await lineOf(oil.id)).toEqual([]);
    const none = await as(world.playerA, refillLight, { character: reed, light: await lightOf(reed.id) });
    expect(none.ok ? 'refilled' : none.message).toBe("There's no fuel left in their pack.");
    // Undo brings the flask back and the lamp back to burnt out.
    const refillEvent = (await eventsOf(requestId)).find((e) => e.target_table === 'character_lights')!;
    expect(await undo(world.playerA, campaignId, refillEvent.id as string)).toMatchObject({ ok: true });
    expect(await lineOf(oil.id)).toEqual([{ id: oil.id, qty: 1 }]);
    expect(await lightOf(reed.id)).toMatchObject({ litAt: null, outAt: 4 * TURN });
  });
});

// The fix (…_m5_light_refill_sticks.sql): the need for a refill sticks to the holder's line, not to the light row.
describe('a burnt-out holder stays empty until refilled, whichever light is lit in between', () => {
  it("switching to another light and back doesn't light the empty lamp; Refill and light uses one flask; Undo empties it again", async () => {
    const { campaignId, reed } = await freshTable();
    const lamp = await carry(campaignId, reed.id, 'Reed lamp', 1, { lightTypeId: 'reed-lamp' });
    const oil = await carry(campaignId, reed.id, 'Fen oil', 2, {}, 'fen-oil');
    const rushes = await carry(campaignId, reed.id, 'Rushlights', 2, { lightTypeId: 'rushlight' });
    await ok(as(world.playerA, lightLight, { character: reed, light: null, option: reedLamp(lamp) }));
    await turns(campaignId, 4);
    expect(await needsFuel(lamp.id)).toBe(true);
    // A rushlight in between, put out; the lamp still needs its refill.
    await ok(as(world.playerA, lightLight, { character: reed, light: await lightOf(reed.id), option: rushlight(rushes) }));
    await ok(as(world.playerA, douseLight, { character: reed, light: await lightOf(reed.id) }));
    const relight = await as(world.playerA, lightLight, { character: reed, light: await lightOf(reed.id), option: reedLamp(lamp) });
    expect(relight.ok ? 'lit' : relight.message).toBe('It burnt out. Refill it first.');
    // Refill and light: one flask, the lamp lit for its whole length, no longer empty; logged as a refill.
    const requestId = crypto.randomUUID();
    const lit = await ok(as(world.playerA, refillLight, { character: reed, light: await lightOf(reed.id), option: reedLamp(lamp) }, requestId));
    expect(lit).toMatchObject({ lineId: lamp.id, litAt: 4 * TURN, burnSeconds: 4 * TURN, fuelItem: 'fen-oil', outAt: null });
    expect(await lineOf(oil.id)).toEqual([{ id: oil.id, qty: 1 }]);
    expect(await needsFuel(lamp.id)).toBe(false);
    expect([...new Set((await eventsOf(requestId)).map((e) => e.type))]).toEqual(['light.refill']);
    // Undo: the flask is back, and the lamp is empty again.
    const refillEvent = (await eventsOf(requestId)).find((e) => e.target_table === 'character_lights')!;
    expect(await undo(world.playerA, campaignId, refillEvent.id as string)).toMatchObject({ ok: true });
    expect(await lineOf(oil.id)).toEqual([{ id: oil.id, qty: 2 }]);
    expect(await needsFuel(lamp.id)).toBe(true);
  });

  it('undoing the turn the lamp burnt out in leaves it needing no refill', async () => {
    const { campaignId, reed } = await freshTable();
    const lamp = await carry(campaignId, reed.id, 'Reed lamp', 1, { lightTypeId: 'reed-lamp' });
    await ok(as(world.playerA, lightLight, { character: reed, light: null, option: reedLamp(lamp) }));
    const requestId = crypto.randomUUID();
    await turns(campaignId, 4, requestId);
    expect(await needsFuel(lamp.id)).toBe(true);
    const clockEvent = (await eventsOf(requestId)).find((e) => e.target_table === 'campaign_clocks')!;
    expect(await undo(world.gm, campaignId, clockEvent.id as string)).toMatchObject({ ok: true });
    expect(await needsFuel(lamp.id)).toBe(false);
    expect(await lightOf(reed.id)).toMatchObject({ litAt: 0, outAt: null });
  });
});

describe('a holder keeps the fuel left in it (ruled 2026-10-30)', () => {
  it('a lamp put out and swapped for a rushlight burns on from its fuel when lit again; the rushlight loses its leftover', async () => {
    const { campaignId, reed } = await freshTable();
    const lamp = await carry(campaignId, reed.id, 'Reed lamp', 1, { lightTypeId: 'reed-lamp' });
    const oil = await carry(campaignId, reed.id, 'Fen oil', 2, {}, 'fen-oil');
    const rushes = await carry(campaignId, reed.id, 'Rushlights', 2, { lightTypeId: 'rushlight' });
    const fuelLeft = async () => (must(await world.admin.from('inventory_lines').select('fuel_left_seconds').eq('id', lamp.id).single()) as { fuel_left_seconds: number | null }).fuel_left_seconds;
    await ok(as(world.playerA, lightLight, { character: reed, light: null, option: reedLamp(lamp) }));
    await turns(campaignId, 1);
    // Swapped while lit: the lamp keeps its 3 turns on its line.
    await ok(as(world.playerA, lightLight, { character: reed, light: await lightOf(reed.id), option: rushlight(rushes) }));
    expect(await fuelLeft()).toBe(3 * TURN);
    await turns(campaignId, 2);
    // Back to the lamp: it burns on for its 3 turns (no flask used); its line holds no fuel of its own while lit.
    const relit = await ok(as(world.playerA, lightLight, { character: reed, light: await lightOf(reed.id), option: reedLamp(lamp) }));
    expect(relit).toMatchObject({ lineId: lamp.id, litAt: 3 * TURN, burnSeconds: 3 * TURN, fullSeconds: 4 * TURN });
    expect(await fuelLeft()).toBeNull();
    expect(await lineOf(oil.id)).toEqual([{ id: oil.id, qty: 2 }]);
    // The rushlight's 4 turns left are dropped: lit again, it burns its whole 6.
    const again = await ok(as(world.playerA, lightLight, { character: reed, light: await lightOf(reed.id), option: rushlight(rushes) }));
    expect(again).toMatchObject({ lineId: rushes.id, burnSeconds: 6 * TURN });
    // Put out first, then swapped: the lamp's time left moves to its line too; a refill fills it again.
    expect(await fuelLeft()).toBe(3 * TURN);
    await ok(as(world.playerA, lightLight, { character: reed, light: await lightOf(reed.id), option: reedLamp(lamp) }));
    await ok(as(world.playerA, douseLight, { character: reed, light: await lightOf(reed.id) }));
    await ok(as(world.playerA, lightLight, { character: reed, light: await lightOf(reed.id), option: rushlight(rushes) }));
    expect(await fuelLeft()).toBe(3 * TURN);
    await ok(as(world.playerA, lightLight, { character: reed, light: await lightOf(reed.id), option: reedLamp(lamp) }));
    await ok(as(world.playerA, refillLight, { character: reed, light: await lightOf(reed.id) }));
    expect(await lightOf(reed.id)).toMatchObject({ burnSeconds: 4 * TURN });
    expect(await fuelLeft()).toBeNull();
  });
});

describe('Set time… and lights (ruled 2026-10-29)', () => {
  it('forwards, what ran out burns out with the correction; backwards, lights get time back up to their length and burnt-out ones stay gone', async () => {
    const { campaignId, reed, moss } = await freshTable();
    const reeds = await carry(campaignId, reed.id, 'Rushlights', 2, { lightTypeId: 'rushlight' });
    const mosses = await carry(campaignId, moss.id, 'Rushlights', 1, { lightTypeId: 'rushlight' });
    await ok(as(world.playerA, lightLight, { character: reed, light: null, option: rushlight(reeds) }));
    await turns(campaignId, 4);
    await ok(as(world.playerB, lightLight, { character: moss, light: null, option: rushlight(mosses) }));
    const requestId = crypto.randomUUID();
    await ok(as(world.gm, setTime, { campaignId, clock: await clockOf(campaignId), to: 7 * TURN }, requestId));
    expect((await eventsOf(requestId)).map((e) => `${e.type}/${e.target_table}`)).toEqual(['time.set/campaign_clocks', 'light.burnOut/inventory_lines', 'light.burnOut/character_lights']);
    expect(await lightOf(reed.id)).toMatchObject({ litAt: null, outAt: 6 * TURN });
    // Back to turn 1: Moss's light (lit at turn 4) starts again from there with its whole length; Reed's stays out.
    await ok(as(world.gm, setTime, { campaignId, clock: await clockOf(campaignId), to: TURN }));
    expect(await lightOf(moss.id)).toMatchObject({ litAt: TURN, burnSeconds: 6 * TURN });
    expect(await lightOf(reed.id)).toMatchObject({ litAt: null, outAt: 6 * TURN });
    expect(await lineOf(reeds.id)).toEqual([{ id: reeds.id, qty: 1 }]);
  });
});
