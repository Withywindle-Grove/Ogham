// M5 step 10: starting and the clock (supabase/migrations/20261031150000_m5_start_clock.sql). TEST project only;
// invented content.
//   Start expedition with a place keeps the place, and the mode it started in, for the GM alone: a player reads none
//   of it, directly or in the log, and can't write one. A blank place makes none; one over 200 characters is refused
//   and nothing starts. The same request sent twice makes one expedition and one place.
//   Recent places come back newest first, each once; undoing the start marks its place undone too (it stays), so it
//   leaves the recent places.
//   Check now is recorded like a check under its own log line (Simple); a player can't; undo marks it undone.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { FALLBACK_MODES, modeById, POINT_TO_POINT_ID } from '../../src/modules/expedition/modes.ts';
import { endExpedition, loadRecentPlaces, loadStartPlace, startExpedition } from '../../src/modules/expedition/play.ts';
import { recordCheckNow } from '../../src/modules/expedition/reminderPlay.ts';
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

/** A fresh campaign with the world's GM and both players. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Sunken Lantern Road', created_by: world.gm.id }).select().single());
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
  return campaign.id as string;
}

const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const placesOf = async (campaignId: string) => must(await world.admin.from('expedition_places').select('name, mode, undone').eq('campaign_id', campaignId).order('created_at'));

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('where an expedition started (DG1)', () => {
  it('is kept with the mode, for the GM alone: players read none of it, in the table or the log, and write none', async () => {
    const campaignId = await freshTable();
    const started = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: '  The Drowned Stair ' }));
    expect(await placesOf(campaignId)).toEqual([{ name: 'The Drowned Stair', mode: 'dungeon', undone: false }]);
    expect(await loadStartPlace(asDb(world.gm), started.id)).toEqual({ name: 'The Drowned Stair', mode: 'dungeon' });
    expect(await loadStartPlace(asDb(world.playerA), started.id)).toBeNull();
    expect(must(await world.playerA.db.from('expedition_places').select('id').eq('campaign_id', campaignId))).toEqual([]);
    // The start's line reaches everyone; the place's only the GM.
    const seen = must(await world.playerB.db.from('events').select('target_table').eq('campaign_id', campaignId).eq('type', 'expedition.start'));
    expect(seen.map((e) => e.target_table)).toContain('expeditions');
    expect(seen.map((e) => e.target_table)).not.toContain('expedition_places');
    const gmSees = must(await world.gm.db.from('events').select('target_table').eq('campaign_id', campaignId).eq('type', 'expedition.start'));
    expect(gmSees.map((e) => e.target_table)).toContain('expedition_places');
    const written = await world.playerA.db.from('expedition_places').insert({ campaign_id: campaignId, expedition_id: started.id, name: 'Sneaky', mode: 'dungeon' });
    expect(written.error).not.toBeNull();
  });

  // Purpose (plan scene-point-to-point, piece B8; p2p-6): an expedition started in point to point, the app's own
  // method, stores the method's id as it is and reads it back: on the expedition, on where it started and among the
  // recent places, and the app reads that id as point to point. No change to the database is needed for it.
  it('started in point to point, it stores the method’s id and reads it back', async () => {
    const campaignId = await freshTable();
    const started = await ok(as(world.gm, startExpedition, { campaignId, mode: POINT_TO_POINT_ID, place: 'The Eel Jetty' }));
    expect(started.mode).toBe(POINT_TO_POINT_ID);
    expect(must(await world.admin.from('expeditions').select('mode').eq('id', started.id).single()).mode).toBe('app:point-to-point');
    expect(await placesOf(campaignId)).toEqual([{ name: 'The Eel Jetty', mode: POINT_TO_POINT_ID, undone: false }]);
    expect(await loadStartPlace(asDb(world.gm), started.id)).toEqual({ name: 'The Eel Jetty', mode: POINT_TO_POINT_ID });
    expect(modeById(FALLBACK_MODES, started.mode)).toMatchObject({ id: POINT_TO_POINT_ID, name: 'Point to point' });
    // A player reads the method on the expedition, as for any mode, and nothing of where it started.
    expect(must(await world.playerA.db.from('expeditions').select('mode').eq('id', started.id).single()).mode).toBe(POINT_TO_POINT_ID);
    expect(await loadStartPlace(asDb(world.playerA), started.id)).toBeNull();
    await ok(as(world.gm, endExpedition, { campaignId, expedition: started }));
    expect(await loadRecentPlaces(asDb(world.gm), campaignId)).toEqual([{ name: 'The Eel Jetty', mode: POINT_TO_POINT_ID }]);
  });

  it('a blank place makes none; one over 200 characters is refused and nothing starts', async () => {
    const campaignId = await freshTable();
    const long = await as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'x'.repeat(201) });
    expect(long.ok ? 'started' : long.message).toBe("A place's name is at most 200 characters.");
    expect(must(await world.admin.from('expeditions').select('id').eq('campaign_id', campaignId))).toEqual([]);
    await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: '   ' }));
    expect(await placesOf(campaignId)).toEqual([]);
  });

  it('the same request sent twice makes one expedition and one place', async () => {
    const campaignId = await freshTable();
    const requestId = crypto.randomUUID();
    const first = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'Reed Hollow' }, requestId));
    const again = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'Reed Hollow' }, requestId));
    expect(again.id).toBe(first.id);
    expect(await placesOf(campaignId)).toHaveLength(1);
  });

  it('recent places come newest first, each once; undoing a start marks its place undone, and it leaves the list', async () => {
    const campaignId = await freshTable();
    for (const [place, mode] of [['Reed Hollow', 'wilderness'], ['The Drowned Stair', 'dungeon'], ['reed hollow', 'dungeon']] as const) {
      const started = await ok(as(world.gm, startExpedition, { campaignId, mode, place }));
      await ok(as(world.gm, endExpedition, { campaignId, expedition: started }));
    }
    expect(await loadRecentPlaces(asDb(world.gm), campaignId)).toEqual([
      { name: 'reed hollow', mode: 'dungeon' },
      { name: 'The Drowned Stair', mode: 'dungeon' },
    ]);
    expect(await loadRecentPlaces(asDb(world.playerA), campaignId)).toEqual([]);

    await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'Bog Gate' }));
    const undone = await as(world.gm, undoChange, { campaignId, eventId: await latestEvent(campaignId, 'expedition.start'), authorUserId: world.gm.id });
    expect(undone).toMatchObject({ ok: true });
    expect((await placesOf(campaignId)).find((p) => p.name === 'Bog Gate')?.undone).toBe(true);
    expect((await loadRecentPlaces(asDb(world.gm), campaignId)).map((p) => p.name)).not.toContain('Bog Gate');
  });
});

describe('Check now (DG3)', () => {
  const record = { checkKey: 'now:check:mode:wander', name: 'Wandering things · now', source: 'mode' as const, outcome: 'miss' as const, modifiers: [] };

  it('is recorded like a check under its own log line; a player is refused; undo marks it undone', async () => {
    const campaignId = await freshTable();
    await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    const result = await ok(as(world.gm, recordCheckNow, { campaignId, record }));
    expect(result.outcome).toBe('miss');
    const line = must(await world.admin.from('events').select('type, level').eq('campaign_id', campaignId).eq('target_table', 'check_results'));
    expect(line).toEqual([{ type: 'check.now', level: 'simple' }]);
    const refused = await world.playerA.db.rpc('record_check', { campaign: campaignId, check_key: 'x', name: 'x', source: 'mode', outcome: 'hit' });
    expect(refused.error?.code).toBe('42501');
    expect(await as(world.gm, undoChange, { campaignId, eventId: await latestEvent(campaignId, 'check.now'), authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('check_results').select('undone').eq('id', result.id).single()).undone).toBe(true);
  });
});
