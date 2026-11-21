// M5 step 8: marching order (supabase/migrations/20261030201000_m5_marching.sql; docs/05 "Expeditions, time and
// light"; docs/03 "Set marching order"; ruled M5-6, 2026-10-25). TEST project only; invented characters.
//   Every campaign has one marching order, made with it, empty; members read it, an outsider reads nothing.
//   A player moves it (logged Simple, everyone sees the line, Undo puts it back); the GM always may.
//   Two devices moving at once: the one with the old copy is refused ("That's changed since…"), nothing is lost.
//   No lock (B11 of docs/plans/scene-point-to-point.md; p2p-21 and flag 5, ruled 2026-11-18;
//   supabase/migrations/20261118150000_p2p_b11_marching_no_lock.sql): in a campaign locked before the lock went, a
//   player still moves it while "Players can reorder marching order" is on; the stored lock stays and does nothing,
//   and only the GM can write it. With the setting off, only the GM moves it, locked or not.
//   Rows hold 1–3 of the campaign's characters, each once; anything else is refused, straight to the table too.
//   Presets: Save as… keeps the order under a name; using one sets the order from it, leaving out who has left.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import {
  applyMarchingPreset,
  lockMarchingOrder,
  saveMarchingPreset,
  setMarchingOrder,
  toMarchingOrder,
  type MarchingOrder,
  type MarchingTarget,
} from '../../src/modules/expedition/marchingPlay.ts';
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

/** A fresh campaign with the world's GM and both players, and three approved characters. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Bog Lantern Road', created_by: world.gm.id }).select().single());
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
  const [reed, moss, wick] = must(
    await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB), pc('Wick', world.playerA)]).select('id'),
  ) as { id: string }[];
  return { campaignId: campaign.id as string, reed: reed!.id, moss: moss!.id, wick: wick!.id };
}

const orderOf = async (campaignId: string): Promise<MarchingOrder> => toMarchingOrder(must(await world.admin.from('marching_orders').select('*').eq('campaign_id', campaignId).eq('group_number', 1).single()));
// The order is no longer part of what the rule looks at (no lock since B11); kept as a parameter so each call still reads "this campaign, as this copy showed it".
const target = (campaignId: string, _order: MarchingOrder, playersReorder = true): MarchingTarget => ({ campaignId, group: 1, playersReorder });
const eventsOf = async (requestId: string) => must(await world.admin.from('events').select('id, type, level, audience, target_table').eq('request_id', requestId).order('seq'));

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('one marching order per campaign', () => {
  it('made with the campaign, empty and unlocked; members read it, an outsider reads nothing', async () => {
    const { campaignId } = await freshTable();
    const asB = must(await world.playerB.db.from('marching_orders').select('rows, presets, locked').eq('campaign_id', campaignId));
    expect(asB).toEqual([{ rows: [], presets: [], locked: false }]);
    expect(must(await world.outsider.db.from('marching_orders').select('id').eq('campaign_id', campaignId))).toEqual([]);
  });
});

describe('moving it', () => {
  it('a player moves it: logged Simple for everyone; Undo puts it back', async () => {
    const { campaignId, reed, moss, wick } = await freshTable();
    const order = await orderOf(campaignId);
    const requestId = crypto.randomUUID();
    const moved = await ok(as(world.playerA, setMarchingOrder, { target: target(campaignId, order), order, rows: [[moss, reed], [wick]] }, requestId));
    expect(moved.rows).toEqual([[moss, reed], [wick]]);
    const events = await eventsOf(requestId);
    expect(events.map((e) => [e.type, e.level, e.audience])).toEqual([['marching.set', 'simple', 'all']]);
    // Player B sees the line.
    expect(must(await world.playerB.db.from('events').select('type').eq('request_id', requestId))).toEqual([{ type: 'marching.set' }]);
    expect(await as(world.playerA, undoChange, { campaignId, eventId: events[0]!.id as string, authorUserId: world.playerA.id })).toMatchObject({ ok: true });
    expect((await orderOf(campaignId)).rows).toEqual([]);
  });

  it('two devices move it at once: the late one is told and nothing is lost; a repeat of the first changes nothing', async () => {
    const { campaignId, reed, moss, wick } = await freshTable();
    const seen = await orderOf(campaignId);
    const requestId = crypto.randomUUID();
    await ok(as(world.playerA, setMarchingOrder, { target: target(campaignId, seen), order: seen, rows: [[reed], [moss], [wick]] }, requestId));
    const late = await as(world.playerB, setMarchingOrder, { target: target(campaignId, seen), order: seen, rows: [[wick], [moss], [reed]] });
    expect(late).toMatchObject({ ok: false, reason: 'stale' });
    expect((await orderOf(campaignId)).rows).toEqual([[reed], [moss], [wick]]);
    // The same request again (an offline retry): nothing changes, one log line.
    await ok(as(world.playerA, setMarchingOrder, { target: target(campaignId, seen), order: seen, rows: [[reed], [moss], [wick]] }, requestId));
    expect(await eventsOf(requestId)).toHaveLength(1);
  });

  it('rows of 1–3 of the campaign\'s own characters, each once; anything else is refused, straight to the table too', async () => {
    const { campaignId, reed, moss, wick } = await freshTable();
    const other = await freshTable();
    const order = await orderOf(campaignId);
    const bad = [[reed, moss, wick, reed]], twice = [[reed], [reed]], stranger = [[other.reed]], empty = [[]];
    for (const rows of [bad, twice, stranger, empty]) {
      const refused = await as(world.gm, setMarchingOrder, { target: target(campaignId, order), order: null, rows });
      expect(refused.ok ? 'saved' : refused.message).toMatch(/1 to 3/);
    }
    await world.playerA.db.from('marching_orders').update({ rows: twice }).eq('campaign_id', campaignId);
    expect((await orderOf(campaignId)).rows).toEqual([]);
  });
});

describe('no lock (B11), and the campaign setting', () => {
  // Purpose: in a campaign whose marching order was locked before the lock went, a player may still rearrange it
  // while "Players can reorder marching order" is on: the app's rule and the database both say yes, the move is
  // logged for everyone, and the player's own Undo puts it back. The GM may too. The stored lock is left as it was.
  it('a campaign locked today: a player still moves it, logged, with Undo; the GM too; the stored lock stays', async () => {
    const { campaignId, reed, moss } = await freshTable();
    // "Locked today": the GM's old lock function, which is all a lock ever was.
    const lockId = crypto.randomUUID();
    const locked = await ok(as(world.gm, lockMarchingOrder, { target: target(campaignId, await orderOf(campaignId)), order: await orderOf(campaignId), locked: true }, lockId));
    expect(locked.locked).toBe(true);
    expect((await eventsOf(lockId)).map((e) => [e.type, e.level])).toEqual([['marching.lock', 'simple']]);
    // The app's rule says yes, and the database agrees.
    expect(registry.can(await userOf(world.playerA), 'marching.set', target(campaignId, locked))).toBe(true);
    const requestId = crypto.randomUUID();
    const moved = await ok(as(world.playerA, setMarchingOrder, { target: target(campaignId, locked), order: locked, rows: [[moss], [reed]] }, requestId));
    expect(moved.rows).toEqual([[moss], [reed]]);
    const events = await eventsOf(requestId);
    expect(events.map((e) => [e.type, e.level, e.audience])).toEqual([['marching.set', 'simple', 'all']]);
    // The player's own Undo puts it back.
    expect(await as(world.playerA, undoChange, { campaignId, eventId: events[0]!.id as string, authorUserId: world.playerA.id })).toMatchObject({ ok: true });
    expect((await orderOf(campaignId)).rows).toEqual([]);
    // Straight to the database, as the other player, skipping the app's rule: allowed too.
    const direct = await world.playerB.db.rpc('set_marching_order', { campaign: campaignId, new_rows: [[reed], [moss]] });
    expect(direct.error).toBeNull();
    expect((await orderOf(campaignId)).rows).toEqual([[reed], [moss]]);
    // The GM always may.
    const gm = await ok(as(world.gm, setMarchingOrder, { target: target(campaignId, locked), order: await orderOf(campaignId), rows: [[moss], [reed]] }));
    expect(gm.rows).toEqual([[moss], [reed]]);
    // Nothing was changed or deleted: the lock is still stored, and does nothing.
    expect((await orderOf(campaignId)).locked).toBe(true);
  });

  // Purpose: taking the lock's refusal out opened nothing else: a player still can't write the stored lock, through
  // the old command or straight to the table, in either direction.
  it('only the GM can write the stored lock: a player is refused through the old command and straight to the table', async () => {
    const { campaignId } = await freshTable();
    const playerLock = await as(world.playerA, lockMarchingOrder, { target: target(campaignId, await orderOf(campaignId)), order: null, locked: true });
    expect(playerLock).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect((await world.playerA.db.rpc('lock_marching_order', { campaign: campaignId, lock_it: true })).error?.code).toBe('42501');
    await world.playerA.db.from('marching_orders').update({ locked: true }).eq('campaign_id', campaignId);
    expect((await orderOf(campaignId)).locked).toBe(false);
    await ok(as(world.gm, lockMarchingOrder, { target: target(campaignId, await orderOf(campaignId)), order: await orderOf(campaignId), locked: true }));
    await world.playerA.db.from('marching_orders').update({ locked: false }).eq('campaign_id', campaignId);
    expect((await orderOf(campaignId)).locked).toBe(true);
  });

  // Purpose: the setting "Players can reorder marching order" still decides. Off, a player is refused by the
  // database in the same plain words as before, and nothing is logged; the GM still moves it.
  it('"Players can reorder marching order" off: a player is refused with the plain reason; the GM still moves it', async () => {
    const { campaignId, reed, moss } = await freshTable();
    must(await world.admin.from('campaigns').update({ settings: { playersReorderMarching: false } }).eq('id', campaignId).select('id'));
    const order = await orderOf(campaignId);
    expect(registry.can(await userOf(world.playerB), 'marching.set', target(campaignId, order, false))).toBe(false);
    const refused = await setMarchingOrder.run(asDb(world.playerB), await userOf(world.playerB), { target: target(campaignId, order, false), order, rows: [[moss], [reed]] });
    expect(refused).toMatchObject({ ok: false, reason: 'not-allowed' });
    // The database's own words, asked straight.
    const direct = await world.playerB.db.rpc('set_marching_order', { campaign: campaignId, new_rows: [[moss], [reed]] });
    expect(direct.error).toMatchObject({ code: '42501', message: 'Only the GM sets the marching order in this campaign.' });
    expect((await orderOf(campaignId)).rows).toEqual([]);
    expect(await ok(as(world.gm, setMarchingOrder, { target: target(campaignId, order, false), order, rows: [[moss], [reed]] }))).toMatchObject({ rows: [[moss], [reed]] });
  });

  // Purpose: the setting off stops players whether or not a lock is stored, and always in the setting's words, never
  // the lock's old ones; turned back on, the player moves it at once though the lock is still stored.
  it('the setting off in a campaign locked today: the setting\'s reason, not the lock\'s; on again, the player moves it', async () => {
    const { campaignId, reed, moss } = await freshTable();
    const locked = await ok(as(world.gm, lockMarchingOrder, { target: target(campaignId, await orderOf(campaignId)), order: await orderOf(campaignId), locked: true }));
    must(await world.admin.from('campaigns').update({ settings: { playersReorderMarching: false } }).eq('id', campaignId).select('id'));
    const off = await world.playerA.db.rpc('set_marching_order', { campaign: campaignId, new_rows: [[moss], [reed]] });
    expect(off.error).toMatchObject({ code: '42501', message: 'Only the GM sets the marching order in this campaign.' });
    expect(await ok(as(world.gm, setMarchingOrder, { target: target(campaignId, locked, false), order: locked, rows: [[reed], [moss]] }))).toMatchObject({ rows: [[reed], [moss]] });
    must(await world.admin.from('campaigns').update({ settings: { playersReorderMarching: true } }).eq('id', campaignId).select('id'));
    const on = await ok(as(world.playerA, setMarchingOrder, { target: target(campaignId, locked), order: await orderOf(campaignId), rows: [[moss], [reed]] }));
    expect(on.rows).toEqual([[moss], [reed]]);
    expect((await orderOf(campaignId)).locked).toBe(true);
  });
});

describe('presets (Save as…)', () => {
  it('saves the order under a name (the same name replaces it); using it sets the order, leaving out who has left', async () => {
    const { campaignId, reed, moss, wick } = await freshTable();
    let order = await ok(as(world.playerA, setMarchingOrder, { target: target(campaignId, await orderOf(campaignId)), order: await orderOf(campaignId), rows: [[wick, moss], [reed]] }));
    order = await ok(as(world.playerA, saveMarchingPreset, { target: target(campaignId, order), order, name: '  Tunnel ' }));
    order = await ok(as(world.playerA, saveMarchingPreset, { target: target(campaignId, order), order, name: 'tunnel' }));
    expect(order.presets).toEqual([{ name: 'tunnel', rows: [[wick, moss], [reed]] }]);
    order = await ok(as(world.gm, setMarchingOrder, { target: target(campaignId, order), order, rows: [[reed], [moss], [wick]] }));
    // Wick leaves the campaign (an archived character stays; a deleted one goes): here, deleted by the GM's tools.
    must(await world.admin.from('actors').delete().eq('id', wick).select('id'));
    const requestId = crypto.randomUUID();
    order = await ok(as(world.playerB, applyMarchingPreset, { target: target(campaignId, order), order, name: 'TUNNEL' }, requestId));
    expect(order).toMatchObject({ rows: [[moss], [reed]], lastPreset: 'tunnel' });
    expect((await eventsOf(requestId)).map((e) => e.type)).toEqual(['marching.usePreset']);
    const missing = await as(world.playerB, applyMarchingPreset, { target: target(campaignId, order), order, name: 'River' });
    expect(missing.ok ? 'used' : missing.message).toBe("That saved order isn't there any more.");
  });
});
