// M5b step 1: travel per group (supabase/migrations/20261103110000_m5b_1_travel.sql; ruled 2026-10-30, S1–S7, D4,
// D7–D10, S2-5, S4-6; 2026-10-31 per-group wilderness state, Getting lost defaults Secret). TEST project only;
// invented places and characters.
//   The budget is per group: a player reads their own group's row, never another group's, and can't write any (the
//   group's travel lines follow the same split since fm-1: supabase/tests/fm1-group-log-audience.test.ts). A
//   Move… that costs more than what's left leaves the group entering the place; the next day's points pay it first and
//   the group arrives (its place moves on); a new Move… while points are owed replaces it (the log keeps what was
//   dropped). Force march is a player's: it adds the pack's points, pays what's owed first, calls no rest at once (its
//   rest falls due in camp's Sleep step: 20261103180000, SC-4-3 A), and never touches another group's shortfall. Lost is the GM's while Getting lost is Secret: a
//   player reads nothing and can't enter the roll; Open, they read their group's Lost and enter the roll, but Found the
//   way stays the GM's. Undo on a Move… puts back the budget and the place.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { loadGroupPlaces } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { enterLostRoll, forceMarch, loadLost, loadTravelGroups, resolveLost, setLost, setTravelBudget, spendTravelDay, startTravelDay, travelMove, type TravelGroup } from '../../src/modules/expedition/travelPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/** A fresh campaign: Reed (player A's) and Moss (player B's), "Getting lost" as given, and an expedition under way. */
async function freshTrail(gettingLost: 'secret' | 'open' = 'secret') {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Fen Crossing', created_by: world.gm.id, settings: { gettingLost } }).select().single());
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
  const [reed, moss] = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select('id')) as { id: string }[];
  const campaignId = campaign.id as string;
  const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'wilderness', place: 'The Reed Jetty' }));
  const ref = (id: string, owner: Person) => ({ id, campaignId, ownerUserId: owner.id });
  return { campaignId, expeditionId: trip.id, reed: ref(reed!.id, world.playerA), moss: ref(moss!.id, world.playerB) };
}

const start = (campaignId: string, group = 1, day = 0, total = 8) => as(world.gm, startTravelDay, { campaignId, group, day, total, pace: 'foot' as const, gmPerDay: null });
const move = (campaignId: string, row: TravelGroup, cost: number, placeName: string | null, terrainId = 'bog') =>
  as(world.gm, travelMove, { campaignId, row, cost, terrainId, routeId: null, placeName, placeId: null });
const rowOf = async (person: Person, t: { campaignId: string; expeditionId: string }, group = 1) => (await loadTravelGroups(asDb(person), t.campaignId, t.expeditionId))?.get(group);
const placeOf = async (t: { campaignId: string; expeditionId: string }, group = 1) => (await loadGroupPlaces(asDb(world.gm), t.campaignId, t.expeditionId))?.get(group)?.place?.name ?? null;
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('the travel budget per group (S3, S4, 2026-10-31)', () => {
  it("a player reads their own group's budget, never another group's, and can't write any", async () => {
    const t = await freshTrail();
    // Moss splits off: group 2.
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    await ok(start(t.campaignId, 1, 0, 8));
    await ok(start(t.campaignId, mossGroup, 0, 6));
    expect((await rowOf(world.playerA, t, 1))?.total).toBe(8);
    expect(await rowOf(world.playerA, t, mossGroup)).toBeUndefined();
    expect((await rowOf(world.playerB, t, mossGroup))?.total).toBe(6);
    expect(await rowOf(world.playerB, t, 1)).toBeUndefined();
    expect((await rowOf(world.gm, t, 1))?.total).toBe(8);
    expect((await rowOf(world.gm, t, mossGroup))?.total).toBe(6);
    // A player can't start a day, move, set the budget or spend the day, nor touch the row.
    const mine = (await rowOf(world.playerA, t, 1))!;
    expect((await as(world.playerA, startTravelDay, { campaignId: t.campaignId, group: 1, day: 1, total: 9, pace: 'foot', gmPerDay: null })).ok).toBe(false);
    expect((await as(world.playerA, travelMove, { campaignId: t.campaignId, row: mine, cost: 2, terrainId: 'bog', routeId: null, placeName: null, placeId: null })).ok).toBe(false);
    expect((await as(world.playerA, setTravelBudget, { campaignId: t.campaignId, row: mine, total: 99, pace: 'foot', gmPerDay: 99 })).ok).toBe(false);
    expect((await as(world.playerA, spendTravelDay, { campaignId: t.campaignId, row: mine })).ok).toBe(false);
    expect(must(await world.playerA.db.from('travel_groups').update({ total: 99 }).eq('id', mine.id).select('id'))).toEqual([]);
    expect((await rowOf(world.gm, t, 1))?.total).toBe(8);
    // Travel lines are their group's (fm-1, 20261111100000; the whole proof is fm1-group-log-audience.test.ts): Reed's
    // player reads the party's morning and nothing of Moss's group.
    const lines = must(await world.playerA.db.from('events').select('target_id').eq('campaign_id', t.campaignId).eq('target_table', 'travel_groups')) as { target_id: string }[];
    expect([...new Set(lines.map((line) => line.target_id))]).toEqual([mine.id]);
  });

  it('a Move… that costs more than what’s left leaves the group entering; the next day pays it first; a new Move… drops it', async () => {
    const t = await freshTrail();
    let row = await ok(start(t.campaignId, 1, 0, 5));
    row = await ok(move(t.campaignId, row, 3, null, 'moor'));
    expect([row.spent, row.pending, row.terrainId]).toEqual([3, null, 'moor']);
    expect(await placeOf(t)).toBeNull();
    // 4 more than the 2 left: entering the Sunken Causeway, 2 owed; the group is still where it was (D10).
    row = await ok(move(t.campaignId, row, 4, 'The Sunken Causeway', 'bog'));
    expect([row.spent, row.pending?.placeName, row.pending?.owed, row.terrainId]).toEqual([5, 'The Sunken Causeway', 2, 'moor']);
    expect(await placeOf(t)).toBeNull();
    // A player of the group sees the shortfall too (their screen's "Entering … · 2 more tomorrow"), without the GM's
    // name for a place not yet shown to them (fm-1, 20261111100000: the name is in the GM's part of the row).
    expect((await rowOf(world.playerA, t))?.pending).toMatchObject({ owed: 2, placeName: '' });
    // The next day pays it first: 2 of 6 spent, arrived, the place set; the day started twice changes nothing.
    row = await ok(start(t.campaignId, 1, 1, 6));
    expect([row.day, row.total, row.spent, row.pending, row.terrainId]).toEqual([1, 6, 2, null, 'bog']);
    expect(await placeOf(t)).toBe('The Sunken Causeway');
    const again = await ok(start(t.campaignId, 1, 1, 6));
    expect([again.spent, again.version]).toEqual([2, row.version]);
    // A move owing points, replaced by another: the first is dropped (the log keeps it in the before of the line of
    // the GM's part of the row, travel_group_secrets).
    row = await ok(move(t.campaignId, row, 9, 'The Drowned Mill', 'fen'));
    expect([row.spent, row.pending?.placeName, row.pending?.owed]).toEqual([6, 'The Drowned Mill', 5]);
    row = await ok(move(t.campaignId, row, 2, 'The Heron Stones', 'fen'));
    expect([row.spent, row.pending?.placeName, row.pending?.owed]).toEqual([6, 'The Heron Stones', 2]);
    const line = must(await world.admin.from('events').select('before').eq('campaign_id', t.campaignId).eq('target_table', 'travel_group_secrets').eq('type', 'travel.move').order('seq', { ascending: false }).limit(1))[0]!;
    expect((line.before as Record<string, unknown>).pending_place_name).toBe('The Drowned Mill');
    expect(await placeOf(t)).toBe('The Sunken Causeway');
    // Spend the day looking uses nothing more here (all spent); the GM's number stays whole.
    row = await ok(as(world.gm, spendTravelDay, { campaignId: t.campaignId, row }));
    expect(row.spent).toBe(6);
  });

  it('Undo on a Move… puts back the budget and the place', async () => {
    const t = await freshTrail();
    let row = await ok(start(t.campaignId, 1, 0, 8));
    row = await ok(move(t.campaignId, row, 3, 'The Moth Gallery', 'wood'));
    expect([row.spent, await placeOf(t)]).toEqual([3, 'The Moth Gallery']);
    await ok(undo(world.gm, t.campaignId, await latestEvent(t.campaignId, 'travel.move')));
    const back = (await rowOf(world.gm, t))!;
    expect([back.spent, back.terrainId, await placeOf(t)]).toEqual([0, null, 'The Reed Jetty']);
  });

  // Purpose: Force march is a player's; it adds the points and pays what's owed first, calls no rest at once (rest falls
  // due in camp's Sleep step, ruled 2026-11-03 SC-4-3 A), leaves another group's shortfall alone, and the GM can undo it.
  it("Force march is a player's: it adds the points, pays what's owed first, calls no rest yet, and leaves another group's shortfall alone", async () => {
    const t = await freshTrail();
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    let reeds = await ok(start(t.campaignId, 1, 0, 4));
    let mosses = await ok(start(t.campaignId, mossGroup, 0, 4));
    reeds = await ok(move(t.campaignId, reeds, 6, 'The Sunken Causeway'));
    mosses = await ok(move(t.campaignId, mosses, 7, 'The Drowned Mill'));
    expect([reeds.pending?.owed, mosses.pending?.owed]).toEqual([2, 3]);
    // Player B can't force march Reed's group; player A can (their own), and 3 points pay the 2 owed: arrived.
    expect((await as(world.playerB, forceMarch, { target: { campaignId: t.campaignId, group: 1, mine: true }, row: reeds, added: 3 })).ok).toBe(false);
    reeds = await ok(as(world.playerA, forceMarch, { target: { campaignId: t.campaignId, group: 1, mine: true }, row: reeds, added: 3 }));
    expect([reeds.total, reeds.spent, reeds.forced, reeds.pending]).toEqual([7, 6, 1, null]);
    expect(await placeOf(t, 1)).toBe('The Sunken Causeway');
    // Moss's group still owes its 3.
    expect((await rowOf(world.gm, t, mossGroup))?.pending?.owed).toBe(3);
    // No rest is called at the march (the prompt waits for camp's Sleep step): neither group's rest row is touched.
    const reedRest = must(await world.admin.from('character_rests').select('called_at').eq('actor_id', t.reed.id).maybeSingle());
    const mossRest = must(await world.admin.from('character_rests').select('called_at').eq('actor_id', t.moss.id).maybeSingle());
    expect(reedRest?.called_at ?? null).toBeNull();
    expect(mossRest?.called_at ?? null).toBeNull();
    // The GM can undo it: the points, the forced count and the arrival go back (the camp's rest due goes with the count).
    await ok(undo(world.gm, t.campaignId, await latestEvent(t.campaignId, 'travel.forceMarch')));
    const back = (await rowOf(world.gm, t, 1))!;
    expect([back.total, back.spent, back.forced, back.pending?.owed]).toEqual([4, 4, 0, 2]);
    expect(await placeOf(t, 1)).toBe('The Reed Jetty');
  });
});

describe('Lost and "Getting lost" (D7, S4-6)', () => {
  it("while Secret a player reads nothing and can't enter the roll; Found the way is the GM's", async () => {
    const t = await freshTrail('secret');
    const lost = await ok(as(world.gm, setLost, { campaignId: t.campaignId, group: 1, day: 0 }));
    expect((await loadLost(asDb(world.gm), t.campaignId, t.expeditionId))?.get(1)?.id).toBe(lost.id);
    expect(await loadLost(asDb(world.playerA), t.campaignId, t.expeditionId)).toEqual(new Map());
    expect(must(await world.playerA.db.from('group_lost').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
    expect(must(await world.playerA.db.from('events').select('id').eq('campaign_id', t.campaignId).eq('target_table', 'group_lost'))).toEqual([]);
    // The app's own rule says no; the database says no even if a device lies about the setting.
    expect((await as(world.playerA, enterLostRoll, { target: { campaignId: t.campaignId, group: 1, mine: true, gettingLost: 'secret' }, lost, roll: '3' })).ok).toBe(false);
    expect((await as(world.playerA, enterLostRoll, { target: { campaignId: t.campaignId, group: 1, mine: true, gettingLost: 'open' }, lost, roll: '3' })).ok).toBe(false);
    expect((await as(world.playerA, setLost, { campaignId: t.campaignId, group: 1, day: 0 })).ok).toBe(false);
    // A second mark changes nothing; Still lost counts the morning; Found the way ends it.
    expect((await ok(as(world.gm, setLost, { campaignId: t.campaignId, group: 1, day: 1 }))).id).toBe(lost.id);
    const still = await ok(as(world.gm, resolveLost, { campaignId: t.campaignId, lost, outcome: 'still', day: 1 }));
    expect([still.attempts, still.foundDay]).toEqual([1, null]);
    const found = await ok(as(world.gm, resolveLost, { campaignId: t.campaignId, lost: still, outcome: 'found', day: 2 }));
    expect(found.foundDay).toBe(2);
    expect(await loadLost(asDb(world.gm), t.campaignId, t.expeditionId)).toEqual(new Map());
    // Undo of Found the way: lost again.
    await ok(undo(world.gm, t.campaignId, await latestEvent(t.campaignId, 'travel.lost.resolve')));
    expect((await loadLost(asDb(world.gm), t.campaignId, t.expeditionId))?.get(1)?.attempts).toBe(1);
  });

  it("while Open a player reads their own group's Lost and enters the roll; another group's player reads nothing; Found the way stays the GM's", async () => {
    const t = await freshTrail('open');
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    const lost = await ok(as(world.gm, setLost, { campaignId: t.campaignId, group: 1, day: 0, note: 'The mist came down.' }));
    expect((await loadLost(asDb(world.playerA), t.campaignId, t.expeditionId))?.get(1)?.note).toBe('The mist came down.');
    expect(await loadLost(asDb(world.playerB), t.campaignId, t.expeditionId)).toEqual(new Map());
    const rolled = await ok(as(world.playerA, enterLostRoll, { target: { campaignId: t.campaignId, group: 1, mine: true, gettingLost: 'open' }, lost, roll: '5' }));
    expect([rolled.roll, rolled.rollBy]).toEqual(['5', world.playerA.id]);
    expect((await as(world.playerB, enterLostRoll, { target: { campaignId: t.campaignId, group: 1, mine: true, gettingLost: 'open' }, lost: rolled, roll: '2' })).ok).toBe(false);
    expect((await as(world.playerA, resolveLost, { campaignId: t.campaignId, lost: rolled, outcome: 'found', day: 1 })).ok).toBe(false);
    expect(must(await world.playerA.db.from('group_lost').update({ found_day: 1 }).eq('id', lost.id).select('id'))).toEqual([]);
    // Switched back to Secret: the row leaves the player's device.
    const campaign = must(await world.admin.from('campaigns').select('settings').eq('id', t.campaignId).single());
    must(await world.admin.from('campaigns').update({ settings: { ...(campaign.settings as Record<string, unknown>), gettingLost: 'secret' } }).eq('id', t.campaignId).select('id'));
    expect(await loadLost(asDb(world.playerA), t.campaignId, t.expeditionId)).toEqual(new Map());
    expect(mossGroup).toBeGreaterThan(1);
  });
});
