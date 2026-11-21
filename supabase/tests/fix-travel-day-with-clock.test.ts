// Fix F86/F87 (supabase/migrations/20261112100000_fix_travel_day_with_clock.sql; docs/plans/fix-f86-f87-travel-day.md):
// a move of the clock into a new day starts each group's travel day in the same request. TEST project only; invented
// places and characters.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { loadGroupPlaces } from '../../src/modules/expedition/placePlay.ts';
import { advanceTime, startExpedition, toClock, type Clock, type TravelDayStart } from '../../src/modules/expedition/play.ts';
import { loadTravelGroups, startTravelDay, travelMove, type TravelGroup } from '../../src/modules/expedition/travelPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const DAY = 24 * 3600;
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I, requestId?: string) {
  return runCommand(registry, asDb(person), await userOf(person), command, input, requestId ? { requestId } : undefined);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

/** A fresh campaign: Reed (player A's) and Moss (player B's), an expedition under way, and group 1's first day (8 points). */
async function freshTrail() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Fen Crossing', created_by: world.gm.id }).select().single());
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
  await ok(as(world.gm, startTravelDay, { campaignId, group: 1, day: 0, total: 8, pace: 'foot' as const, gmPerDay: null }));
  const ref = (id: string, owner: Person) => ({ id, campaignId, ownerUserId: owner.id });
  return { campaignId, expeditionId: trip.id, reed: ref(reed!.id, world.playerA), moss: ref(moss!.id, world.playerB) };
}

type Trail = Awaited<ReturnType<typeof freshTrail>>;
const clockOf = async (campaignId: string): Promise<Clock> => toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
const rowOf = async (t: Trail, group = 1) => (await loadTravelGroups(asDb(world.gm), t.campaignId, t.expeditionId))?.get(group);
const placeOf = async (t: Trail, group = 1) => (await loadGroupPlaces(asDb(world.gm), t.campaignId, t.expeditionId))?.get(group)?.place?.name ?? null;
const move = (t: Trail, row: TravelGroup, cost: number, placeName: string | null) => as(world.gm, travelMove, { campaignId: t.campaignId, row, cost, terrainId: 'bog', routeId: null, placeName, placeId: null });
const start = (group: number, day: number, total: number): TravelDayStart => ({ group, day, total, pace: 'foot', gmPerDay: null });
const nextDay = async (t: Trail, days: TravelDayStart[], person: Person = world.gm, requestId?: string) =>
  as(person, advanceTime, { campaignId: t.campaignId, clock: await clockOf(t.campaignId), seconds: DAY, days }, requestId);
const eventsOf = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id, request_id, target_table, reverts_event_id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false })) as {
    id: string;
    request_id: string | null;
    target_table: string;
    reverts_event_id: string | null;
  }[];

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('a move into a new day starts the travel day with it (fix F86/F87)', () => {
  // Purpose: Next day with the group's new budget moves the row on in the same request (no travel card needed), pays
  // yesterday's shortfall first so the group arrives, and logs the start as travel.dayStart beside the move.
  it("Next day starts the group's day and pays a carried shortfall", async () => {
    const t = await freshTrail();
    await ok(move(t, (await rowOf(t))!, 11, 'Black Mere'));
    expect(await rowOf(t)).toMatchObject({ day: 0, total: 8, spent: 8, pending: { owed: 3, placeName: 'Black Mere' } });

    await ok(nextDay(t, [start(1, 1, 8)]));
    expect((await clockOf(t.campaignId)).seconds).toBe(DAY);
    expect(await rowOf(t)).toMatchObject({ day: 1, total: 8, spent: 3, forced: 0, pending: null });
    expect(await placeOf(t)).toBe('Black Mere');
    const moves = await eventsOf(t.campaignId, 'time.advance');
    const starts = (await eventsOf(t.campaignId, 'travel.dayStart')).filter((e) => e.target_table === 'travel_groups' && e.request_id === moves[0]!.request_id);
    expect(starts.length).toBeGreaterThan(0);
  });

  // Purpose: split parties each have their own row, and one move starts every group's day with its own budget; a
  // group with no row yet (its first day) is left for the travel card to make.
  it("starts every group's day, each with its own budget, and leaves a group with no row alone", async () => {
    const t = await freshTrail();
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    await ok(as(world.gm, startTravelDay, { campaignId: t.campaignId, group: mossGroup, day: 0, total: 6, pace: 'foot' as const, gmPerDay: null }));
    await ok(nextDay(t, [start(1, 1, 9), start(mossGroup, 1, 5)]));
    expect(await rowOf(t, 1)).toMatchObject({ day: 1, total: 9, spent: 0 });
    expect(await rowOf(t, mossGroup)).toMatchObject({ day: 1, total: 5, spent: 0 });

    const fresh = await freshTrail();
    await ok(nextDay(fresh, [start(1, 1, 8), start(2, 1, 8)]));
    expect(await rowOf(fresh, 1)).toMatchObject({ day: 1 });
    expect(await rowOf(fresh, 2)).toBeUndefined();
  });

  // Purpose: one Undo of the move takes the clock and the started day back together: yesterday's row as it was, the
  // shortfall owed again and the group back where it was.
  it('Undo of the move takes the clock and the started day back together', async () => {
    const t = await freshTrail();
    await ok(move(t, (await rowOf(t))!, 11, 'Black Mere'));
    await ok(nextDay(t, [start(1, 1, 8)]));
    const moveId = (await eventsOf(t.campaignId, 'time.advance'))[0]!.id;

    await ok(as(world.gm, undoChange, { campaignId: t.campaignId, eventId: moveId, authorUserId: world.gm.id }));
    expect((await clockOf(t.campaignId)).seconds).toBe(0);
    expect(await rowOf(t)).toMatchObject({ day: 0, total: 8, spent: 8, pending: { owed: 3, placeName: 'Black Mere' } });
    expect(await placeOf(t)).toBe('The Reed Jetty');
  });

  // Purpose: the same request sent twice (a retry on a bad connection) moves the clock once and starts the day once;
  // and a day already started (the travel card got there first) is left as it is.
  it('a repeated request starts nothing twice, and a day already started is left as it is', async () => {
    const t = await freshTrail();
    const clock = await clockOf(t.campaignId);
    const requestId = crypto.randomUUID();
    await ok(as(world.gm, advanceTime, { campaignId: t.campaignId, clock, seconds: DAY, days: [start(1, 1, 8)] }, requestId));
    await ok(move(t, (await rowOf(t))!, 2, null));
    await as(world.gm, advanceTime, { campaignId: t.campaignId, clock, seconds: DAY, days: [start(1, 1, 8)] }, requestId);
    expect((await clockOf(t.campaignId)).seconds).toBe(DAY);
    expect(await rowOf(t)).toMatchObject({ day: 1, total: 8, spent: 2 });
    const started = (await eventsOf(t.campaignId, 'travel.dayStart')).filter((e) => e.target_table === 'travel_groups' && e.request_id === requestId);
    expect(started).toHaveLength(1);

    // The card's own start for the same day changes nothing.
    await ok(as(world.gm, startTravelDay, { campaignId: t.campaignId, group: 1, day: 1, total: 8, pace: 'foot' as const, gmPerDay: null }));
    expect(await rowOf(t)).toMatchObject({ day: 1, spent: 2 });
  });

  // Purpose: only the GM moves the clock, so a player can't start a day through it; and a malformed day refuses the
  // whole move (the clock stays).
  it("a player can't start a day this way, and a malformed day refuses the whole move", async () => {
    const t = await freshTrail();
    expect((await nextDay(t, [start(1, 1, 99)], world.playerA)).ok).toBe(false);
    expect(await rowOf(t)).toMatchObject({ day: 0, total: 8 });
    const bad = await nextDay(t, [{ ...start(1, 1, 8), total: -1 }]);
    expect(bad.ok).toBe(false);
    expect((await clockOf(t.campaignId)).seconds).toBe(0);
    expect(await rowOf(t)).toMatchObject({ day: 0, total: 8 });
  });
});

describe("Next day's arrival reads the place from the GM's part of the travel row (fix: fm-1 met F86/F87)", () => {
  // Purpose: a group overspends its day entering a place the GM named and that hasn't been shown to its players. On
  // Next day the group arrives at the GM's place (not somewhere unnamed), the GM's part of the row is cleared, and a
  // player of the group reads the GM's name nowhere, before or after; one Undo of the move puts the GM's part back.
  it("a group entering a place not shown to it arrives next morning at the GM's place; the GM's part is cleared; its player reads no GM name", async () => {
    const t = await freshTrail();
    const row = await ok(move(t, (await rowOf(t))!, 11, 'The Sunken Causeway'));
    const secretOf = async () => must(await world.gm.db.from('travel_group_secrets').select('pending_place_name, pending_place_id').eq('id', row.id).single());
    const playersPart = async () => must(await world.playerA.db.from('travel_groups').select('pending_owed, pending_place_name, pending_place_id').eq('id', row.id).single());
    const playerReads = async () =>
      JSON.stringify(await Promise.all(['travel_groups', 'travel_group_secrets', 'events'].map(async (table) => (await world.playerA.db.from(table).select('*').eq('campaign_id', t.campaignId)).data)));
    expect(await secretOf()).toEqual({ pending_place_name: 'The Sunken Causeway', pending_place_id: null });
    expect(await playersPart()).toEqual({ pending_owed: 3, pending_place_name: null, pending_place_id: null });

    await ok(nextDay(t, [start(1, 1, 8)]));
    expect(await rowOf(t)).toMatchObject({ day: 1, total: 8, spent: 3, pending: null });
    expect(await placeOf(t)).toBe('The Sunken Causeway');
    expect(await secretOf()).toEqual({ pending_place_name: null, pending_place_id: null });
    expect(await playersPart()).toEqual({ pending_owed: null, pending_place_name: null, pending_place_id: null });
    expect(await playerReads()).not.toContain('The Sunken Causeway');

    const moveId = (await eventsOf(t.campaignId, 'time.advance'))[0]!.id;
    await ok(as(world.gm, undoChange, { campaignId: t.campaignId, eventId: moveId, authorUserId: world.gm.id }));
    expect(await rowOf(t)).toMatchObject({ day: 0, total: 8, spent: 8, pending: { owed: 3, placeName: 'The Sunken Causeway' } });
    expect(await secretOf()).toEqual({ pending_place_name: 'The Sunken Causeway', pending_place_id: null });
    expect(await playersPart()).toEqual({ pending_owed: 3, pending_place_name: null, pending_place_id: null });
    expect(await placeOf(t)).toBe('The Reed Jetty');
    expect(await playerReads()).not.toContain('The Sunken Causeway');
  });

  // Purpose: a place picked by its id (a pack's place) and already shown to the group, so the players' part of the row
  // holds its players' name. On Next day the group arrives at that very place, by its id: no second place is made from
  // the players' name, the GM's part is cleared, the player never reads the GM's name, and the move can be undone.
  it("a group entering a place already shown to it arrives next morning at that very place, not at one made from its players' name", async () => {
    const t = await freshTrail();
    const mill = must(
      await world.admin
        .from('places')
        .insert({ campaign_id: t.campaignId, name: 'Cellar of the Bog Lurker', players_name: 'The old mill', pack_id: crypto.randomUUID(), pack_entry_id: 'old-mill', pack_type: 'site' })
        .select('id')
        .single(),
    ) as { id: string };
    const toMill = (from: TravelGroup, cost: number) => as(world.gm, travelMove, { campaignId: t.campaignId, row: from, cost, terrainId: 'bog', routeId: null, placeName: null, placeId: mill.id });
    const hereOf = async () => must(await world.admin.from('group_places').select('id, place_id').eq('campaign_id', t.campaignId).eq('group_number', 1).eq('undone', false).eq('moved_on', false).single()) as { id: string; place_id: string | null };
    const playerReads = async () =>
      JSON.stringify(await Promise.all(['travel_groups', 'travel_group_secrets', 'events'].map(async (table) => (await world.playerA.db.from(table).select('*').eq('campaign_id', t.campaignId)).data)));
    // The group reaches the mill at once (2 of 8), the GM shows a piece of it, the group moves on (1), then turns
    // back with more than the day has left (9 against 5: 4 owed).
    let row = await ok(toMill((await rowOf(t))!, 2));
    const piece = must(await world.gm.db.rpc('add_place_piece', { place: mill.id, kind: 'description', body: 'A wheel that turns with no water' })) as { id: string };
    must(await world.gm.db.rpc('show_place_piece', { visit: (await hereOf()).id, piece: piece.id, show_it: true }));
    row = await ok(move(t, row, 1, null));
    row = await ok(toMill(row, 9));
    const secretOf = async () => must(await world.gm.db.from('travel_group_secrets').select('pending_place_name, pending_place_id').eq('id', row.id).single());
    const playersPart = async () => must(await world.playerA.db.from('travel_groups').select('pending_owed, pending_place_name, pending_place_id').eq('id', row.id).single());
    expect(await secretOf()).toEqual({ pending_place_name: 'Cellar of the Bog Lurker', pending_place_id: mill.id });
    expect(await playersPart()).toEqual({ pending_owed: 4, pending_place_name: 'The old mill', pending_place_id: null });
    expect((await hereOf()).place_id).toBeNull();

    await ok(nextDay(t, [start(1, 1, 8)]));
    expect(await rowOf(t)).toMatchObject({ day: 1, total: 8, spent: 4, pending: null });
    expect((await hereOf()).place_id).toBe(mill.id);
    expect(must(await world.admin.from('places').select('id').eq('campaign_id', t.campaignId).eq('name', 'The old mill'))).toEqual([]);
    expect(await secretOf()).toEqual({ pending_place_name: null, pending_place_id: null });
    expect(await playerReads()).not.toContain('Cellar of the Bog Lurker');

    const moveId = (await eventsOf(t.campaignId, 'time.advance'))[0]!.id;
    await ok(as(world.gm, undoChange, { campaignId: t.campaignId, eventId: moveId, authorUserId: world.gm.id }));
    expect(await rowOf(t)).toMatchObject({ day: 0, pending: { owed: 4, placeName: 'Cellar of the Bog Lurker', placeId: mill.id } });
    expect(await secretOf()).toEqual({ pending_place_name: 'Cellar of the Bog Lurker', pending_place_id: mill.id });
    expect(await playersPart()).toEqual({ pending_owed: 4, pending_place_name: 'The old mill', pending_place_id: null });
    expect((await hereOf()).place_id).toBeNull();
    expect(await playerReads()).not.toContain('Cellar of the Bog Lurker');
  });
});
