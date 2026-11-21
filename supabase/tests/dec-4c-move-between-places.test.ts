// December step 4, piece (c): the move between linked places
// (supabase/migrations/20261111150000_dec_4c_move_between_places.sql; docs/plans/dec-4-point-travel.md, row c; ruled
// 2026-11-11, pt-f2 and pt-f3). TEST project only; invented places, lights, statuses and people.
// What it checks, in plain words:
//   * one request puts the party at the place picked and moves the clock on by the way's turns, and keeps the way
//     taken and its turns in a record of the move;
//   * every change of the move is under that one request and one command: one log line;
//   * the clock's side effects are Advance by…'s own: after the same turns, lights, the item a light used up and
//     status timers end up the same whether the GM used Move on or Where now? followed by Advance by…;
//   * one Undo puts back the place, the clock, the light, the used-up item and the status, and marks the move's
//     record and its visit undone (nothing is erased); it can't be undone twice;
//   * a place visited before starts with what was shown at the end of its last visit, in the same line, and the
//     move's Undo takes those shows back;
//   * a player and an outsider can't move the party, through the app, the function or the table;
//   * hidden means hidden: a player reads no record of the move, no place and no visit, and of the move's log line
//     only the clock's part and their own light and status; never the way taken, and the place's name only once the
//     place has been shown to their group (then by the players' name);
//   * the words (ruled by the lead, 2026-11-11): a player reads "The party moved on: N turns." or, the place shown,
//     "The party moved to <players' name>: N turns."; never "moved the clock on". An undone move says so: the GM
//     reads both places, a player "The party went back." or "The party is back at <name>.";
//   * a split party is refused with the words to join up first, and moves once joined up again;
//   * a move from an old copy of the clock is refused whole (the place doesn't move either); a repeat of the same
//     request changes nothing more; a place of another campaign, no expedition, or turns that don't fit are refused;
//   * the logged command and the Undo lists match the app's.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { describeEntry, groupEntries, loadLog, loadLogNames } from '../../src/core/events.ts';
import type { Db } from '../../src/core/supabase.ts';
import { UNDOABLE_DELETIONS, UNDOABLE_MAKINGS, undoChange } from '../../src/core/undo.ts';
import { toCharacterRef } from '../../src/modules/characters/commands.ts';
import { lightLight, toCharacterLight, type CharacterLight, type LightOption } from '../../src/modules/expedition/lightPlay.ts';
import { moveOn, type MoveOnInput } from '../../src/modules/expedition/placeMove.ts';
import { chooseGroup, joinUp } from '../../src/modules/expedition/groupPlay.ts';
import { addPiece, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { advanceTimeBy, latestClockMove, startExpedition, toClock, type Clock } from '../../src/modules/expedition/play.ts';
import { addStatus, toCharacterStatus, type CharacterStatus, type NewStatus } from '../../src/modules/expedition/statusPlay.ts';
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
const START = 'The Reed Stair';
const THERE = 'The Moth Gallery';
const WAY = 'Rowing';
/** What players call the Moth Gallery once it's shown to them. */
const THERE_FOR_PLAYERS = 'A hall of moths';

interface Table {
  campaignId: string;
  reed: ReturnType<typeof toCharacterRef>;
  moss: ReturnType<typeof toCharacterRef>;
  /** The place the expedition started at, and the place the link leads to. */
  stair: string;
  gallery: string;
  /** Reed's one rushlight (lit, 2 turns long) and his "Glowing" status (2 turns). */
  lineId: string;
  statusId: string;
}

/**
 * A fresh campaign: the GM, both players with an approved character each, an expedition under way at the Reed
 * Stair, a second place (the Moth Gallery), Reed's last rushlight lit with 2 turns to burn, and "Glowing" on Reed
 * for 2 turns. The clock is at 0.
 */
async function freshTable(): Promise<Table> {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Fen Lantern Road', created_by: world.gm.id }).select().single());
  const campaignId = campaign.id as string;
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaignId, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaignId, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaignId, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  const pc = (name: string, owner: Person) => ({ campaign_id: campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const made = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select());
  const refOf = (name: string) => toCharacterRef(made.find((row) => row.name === name) as Parameters<typeof toCharacterRef>[0]);
  const reed = refOf('Reed the Ferrywarden');
  const moss = refOf('Moss of the Bog Lights');
  await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: START }));
  const stair = must(await world.admin.from('places').select('id').eq('campaign_id', campaignId).eq('name', START).single()).id as string;
  const gallery = must(await world.admin.from('places').insert({ campaign_id: campaignId, name: THERE, players_name: THERE_FOR_PLAYERS }).select('id').single()).id as string;
  must(await world.admin.from('place_notes').insert({ id: gallery, campaign_id: campaignId }).select());
  const line = must(
    await world.admin
      .from('inventory_lines')
      .insert({ campaign_id: campaignId, actor_id: reed.id, name: 'Rushlight', category: 'light', weight_coin: 1, stack: 1, qty: 1, how_got: 'found', item_data: { lightTypeId: 'rushlight' } })
      .select('id, name, qty, version')
      .single(),
  ) as { id: string; name: string; qty: number; version: number };
  const rushlight: LightOption = { line, type: { id: 'rushlight', name: 'Rushlight', seconds: 2 * TURN, warnSeconds: TURN, consumed: true, fuel: null }, unit: { name: 'turn', seconds: TURN }, radius: null };
  await ok(as(world.playerA, lightLight, { character: reed, light: null, option: rushlight }));
  const glowing: NewStatus = { name: 'Glowing', condition: null, timer: { seconds: 2 * TURN, unit: 'turn' }, secret: false };
  const [status] = await ok(as(world.gm, addStatus, { target: { campaignId, characters: [reed], secret: false }, status: glowing }));
  return { campaignId, reed, moss, stair, gallery, lineId: line.id, statusId: status!.id };
}

const clockOf = async (campaignId: string): Promise<Clock> => toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
const lightOf = async (actorId: string): Promise<CharacterLight> => toCharacterLight(must(await world.admin.from('character_lights').select('*').eq('actor_id', actorId).single()));
const statusOf = async (id: string): Promise<CharacterStatus> => toCharacterStatus(must(await world.admin.from('character_statuses').select('*').eq('id', id).single()));
const lineOf = async (id: string) => must(await world.admin.from('inventory_lines').select('id, qty').eq('id', id)) as { id: string; qty: number }[];
const eventsOf = async (requestId: string) => must(await world.admin.from('events').select('id, type, level, target_table, target_id, before, after, audience').eq('request_id', requestId).order('seq'));
/** The party's current visit (group 1's newest row that isn't undone or moved on from), as the database has it. */
const visitOf = async (campaignId: string) =>
  must(await world.admin.from('group_places').select('id, place_id').eq('campaign_id', campaignId).eq('group_number', 1).eq('undone', false).eq('moved_on', false)) as { id: string; place_id: string | null }[];
const movesOf = async (campaignId: string) => must(await world.admin.from('place_moves').select('group_place_id, group_number, way_by, way_name, turns, seconds, undone').eq('campaign_id', campaignId).order('created_at'));
const rowing = async (t: Table, turns: number, extra: Partial<MoveOnInput> = {}): Promise<MoveOnInput> => ({
  campaignId: t.campaignId, placeId: t.gallery, turns, seconds: turns * TURN, clock: await clockOf(t.campaignId), way: { by: 'row', name: WAY }, ...extra,
});
/** The GM's Undo of the newest move of the clock, as the strip's Undo does it. */
const undoMove = async (t: Table) => {
  const eventId = await latestClockMove(asDb(world.gm), t.campaignId, world.gm.id);
  return as(world.gm, undoChange, { campaignId: t.campaignId, eventId: eventId!, authorUserId: world.gm.id });
};
/** What lights, the used-up item, the status, the clock and the place read after some turns. */
const stateOf = async (t: Table) => {
  const light = await lightOf(t.reed.id);
  const status = await statusOf(t.statusId);
  return {
    clock: (await clockOf(t.campaignId)).seconds,
    light: { litAt: light.litAt, outAt: light.outAt },
    rushlights: (await lineOf(t.lineId)).map((l) => l.qty),
    glowingEndedAt: status.endedAt,
    atTheGallery: (await visitOf(t.campaignId)).map((v) => v.place_id === t.gallery),
  };
};
/** The log as this person's device reads it (the Simple view), one line per action, in plain words. */
async function logLines(person: Person, campaignId: string): Promise<string[]> {
  const log = await loadLog(asDb(person), campaignId);
  // As the log screen does: the kinds of the events on the page, so an undo's line knows what it undid.
  const names = { ...(await loadLogNames(asDb(person), campaignId, person.id)), eventTypes: new Map(log!.events.map((e) => [e.id, e.type])) };
  return groupEntries(log!.events).map((entry) => describeEntry(entry, names));
}
/** The GM shows one piece of the place the party is at now, so that place has been shown to the party's players. */
async function showSomethingHere(t: Table, text: string) {
  const [visit] = await visitOf(t.campaignId);
  const pieceId = await ok(as(world.gm, addPiece, { campaignId: t.campaignId, placeId: visit!.place_id!, kind: 'description', text }));
  await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row: { id: visit!.id }, piece: { id: pieceId } }));
}
/** What a person's device is given about the campaign's moves (public.party_moves). */
const movesFor = async (person: Person, campaignId: string) =>
  must(await person.db.rpc('party_moves', { campaign: campaignId })) as { clock_event_id: string; turns: number; to_name: string | null; from_name: string | null }[];
const partyLines = (lines: string[]) => lines.filter((line) => line.startsWith('The party '));

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('one request moves the place and the clock', () => {
  it('the party is at the place picked, the clock is on by the turns, and the move has its record', async () => {
    const t = await freshTable();
    const moved = await ok(as(world.gm, moveOn, await rowing(t, 3)));
    expect(moved.clock.seconds).toBe(3 * TURN);
    expect(moved.backShown).toBe(0);
    expect(await visitOf(t.campaignId)).toEqual([{ id: moved.id, place_id: t.gallery }]);
    expect((await clockOf(t.campaignId)).seconds).toBe(3 * TURN);
    expect(await movesOf(t.campaignId)).toEqual([{ group_place_id: moved.id, group_number: 1, way_by: 'row', way_name: WAY, turns: 3, seconds: 3 * TURN, undone: false }]);
    // It keeps the visit left too (an undone move's line says where the party is back at).
    const from = must(await world.admin.from('place_moves').select('from_group_place_id').eq('group_place_id', moved.id).single()).from_group_place_id as string;
    expect(must(await world.admin.from('group_places').select('place_id, moved_on').eq('id', from).single())).toEqual({ place_id: t.stair, moved_on: true });
  });

  it('every change it makes is under one request and one command: one log line, Simple', async () => {
    const t = await freshTable();
    const before = must(await world.admin.from('events').select('seq').eq('campaign_id', t.campaignId).order('seq', { ascending: false }).limit(1))[0]!.seq as number;
    const requestId = crypto.randomUUID();
    await ok(as(world.gm, moveOn, await rowing(t, 3), requestId));
    const since = must(await world.admin.from('events').select('request_id').eq('campaign_id', t.campaignId).gt('seq', before));
    expect([...new Set(since.map((e) => e.request_id))]).toEqual([requestId]);
    const events = await eventsOf(requestId);
    // The move's own rows, in the order written: the visit left, the new visit, the move's record, the clock.
    expect(events.filter((e) => e.type === 'place.moveOn').map((e) => [e.target_table, e.level, e.before === null])).toEqual([
      ['group_places', 'simple', false],
      ['group_places', 'simple', true],
      ['place_moves', 'simple', true],
      ['campaign_clocks', 'simple', false],
    ]);
    // What the clock ran out, under the database's own names, as in any move of the clock.
    expect(events.filter((e) => ['light.burnOut', 'status.timerEnd'].includes(e.type as string)).map((e) => [e.type, e.target_table, e.level])).toEqual([
      ['light.burnOut', 'inventory_lines', 'simple'],
      ['light.burnOut', 'character_lights', 'simple'],
      ['status.timerEnd', 'character_statuses', 'simple'],
    ]);
    const lines = await logLines(world.gm, t.campaignId);
    expect(lines.filter((line) => line.includes('moved the party'))).toHaveLength(1);
    expect(lines.find((line) => line.includes('moved the party'))).toMatch(new RegExp(`^You moved the party to ${THERE}: ${WAY}, 3 turns\\. Ran out with the clock: `));
  });

  it('the logged command and the Undo lists match the app', async () => {
    expect(must(await world.playerA.db.from('logged_commands').select('name, level, gm_only').eq('name', 'place.moveOn'))).toEqual([{ name: 'place.moveOn', level: 'simple', gm_only: true }]);
    const makings = must(await world.playerA.db.from('undoable_makings').select('name'));
    expect(makings.map((r) => r.name as string).sort()).toEqual([...UNDOABLE_MAKINGS].sort());
    const deletions = must(await world.playerA.db.from('undoable_deletions').select('name'));
    expect(deletions.map((r) => r.name as string).sort()).toEqual([...UNDOABLE_DELETIONS].sort());
    expect(must(await world.playerA.db.from('undoable_tables').select('name').eq('name', 'place_moves'))).toEqual([{ name: 'place_moves' }]);
  });
});

describe("the clock's side effects are Advance by…'s own (pt-f2)", () => {
  it('after 3 turns, the light, the item it used up and the status timer are the same by Move on as by Where now? then Advance by…', async () => {
    const moved = await freshTable();
    const advanced = await freshTable();
    const moveRequest = crypto.randomUUID();
    const advanceRequest = crypto.randomUUID();
    await ok(as(world.gm, moveOn, await rowing(moved, 3), moveRequest));
    await ok(as(world.gm, setPlace, { campaignId: advanced.campaignId, group: 1, name: THERE, placeId: advanced.gallery }));
    await ok(as(world.gm, advanceTimeBy, { campaignId: advanced.campaignId, clock: await clockOf(advanced.campaignId), seconds: 3 * TURN }, advanceRequest));
    const after = await stateOf(moved);
    expect(after).toEqual(await stateOf(advanced));
    // The light burnt out at the end of its 2 turns and its last rushlight left play; Glowing ended at 2 turns.
    expect(after).toEqual({ clock: 3 * TURN, light: { litAt: null, outAt: 2 * TURN }, rushlights: [], glowingEndedAt: 2 * TURN, atTheGallery: [true] });
    // The database's own parts of each move: the same names, tables, levels and audiences, in the same order.
    const own = async (requestId: string) => (await eventsOf(requestId)).filter((e) => !['place.moveOn', 'time.advanceBy'].includes(e.type as string)).map((e) => [e.type, e.target_table, e.level, e.audience]);
    expect(await own(moveRequest)).toEqual(await own(advanceRequest));
    // And the clock's own row changed the same way.
    const clockChange = async (requestId: string) => (await eventsOf(requestId)).filter((e) => e.target_table === 'campaign_clocks').map((e) => [e.before, e.after, e.level, e.audience]);
    expect(await clockChange(moveRequest)).toEqual(await clockChange(advanceRequest));
  });

  it('a 1-turn move leaves a light with 2 turns to burn lit, its item in the pack and the status on', async () => {
    const t = await freshTable();
    await ok(as(world.gm, moveOn, await rowing(t, 1)));
    expect(await stateOf(t)).toEqual({ clock: TURN, light: { litAt: 0, outAt: null }, rushlights: [1], glowingEndedAt: null, atTheGallery: [true] });
  });
});

describe('one Undo', () => {
  it('puts back the place, the clock, the light, the used-up item and the status; the record and the visit are marked undone, not removed', async () => {
    const t = await freshTable();
    const start = await visitOf(t.campaignId);
    expect(start.map((v) => v.place_id)).toEqual([t.stair]);
    const moved = await ok(as(world.gm, moveOn, await rowing(t, 3)));
    expect(await lineOf(t.lineId)).toEqual([]);
    expect(await undoMove(t)).toMatchObject({ ok: true });
    expect(await visitOf(t.campaignId)).toEqual(start);
    expect((await clockOf(t.campaignId)).seconds).toBe(0);
    expect(await lightOf(t.reed.id)).toMatchObject({ litAt: 0, outAt: null, lineId: t.lineId });
    expect(await lineOf(t.lineId)).toEqual([{ id: t.lineId, qty: 1 }]);
    expect((await statusOf(t.statusId)).endedAt).toBeNull();
    expect(await movesOf(t.campaignId)).toMatchObject([{ group_place_id: moved.id, undone: true }]);
    expect(must(await world.admin.from('group_places').select('undone, moved_on').eq('id', moved.id))).toEqual([{ undone: true, moved_on: false }]);
  });

  it("the GM can't change a move's record directly: only Undo marks it", async () => {
    const t = await freshTable();
    await ok(as(world.gm, moveOn, await rowing(t, 1)));
    const changed = await world.gm.db.from('place_moves').update({ way_name: 'Flying', undone: true }).eq('campaign_id', t.campaignId).select('id');
    expect(changed.error).not.toBeNull();
    expect(await movesOf(t.campaignId)).toMatchObject([{ way_name: WAY, undone: false }]);
  });

  it("can't be undone twice; and after it the party can move on again", async () => {
    const t = await freshTable();
    await ok(as(world.gm, moveOn, await rowing(t, 1)));
    const eventId = (await latestClockMove(asDb(world.gm), t.campaignId, world.gm.id))!;
    expect(await as(world.gm, undoChange, { campaignId: t.campaignId, eventId, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(await as(world.gm, undoChange, { campaignId: t.campaignId, eventId, authorUserId: world.gm.id })).toMatchObject({ ok: false });
    await ok(as(world.gm, moveOn, await rowing(t, 1)));
    expect((await visitOf(t.campaignId)).map((v) => v.place_id)).toEqual([t.gallery]);
    expect((await clockOf(t.campaignId)).seconds).toBe(TURN);
  });

  it('a later move of the clock comes first: the move is refused Undo until that is undone', async () => {
    const t = await freshTable();
    const requestId = crypto.randomUUID();
    await ok(as(world.gm, moveOn, await rowing(t, 1), requestId));
    await ok(as(world.gm, advanceTimeBy, { campaignId: t.campaignId, clock: await clockOf(t.campaignId), seconds: TURN }));
    const moveEvent = (await eventsOf(requestId)).find((e) => e.target_table === 'campaign_clocks')!.id as string;
    const refused = await as(world.gm, undoChange, { campaignId: t.campaignId, eventId: moveEvent, authorUserId: world.gm.id });
    expect(refused).toMatchObject({ ok: false, message: "That's changed since. Undo the later change first." });
    expect((await visitOf(t.campaignId)).map((v) => v.place_id)).toEqual([t.gallery]);
    expect((await clockOf(t.campaignId)).seconds).toBe(2 * TURN);
  });

  it('a place visited before starts with what was shown at the end of its last visit, in the same line; Undo takes those shows back', async () => {
    const t = await freshTable();
    const [first] = await visitOf(t.campaignId);
    const pieceId = await ok(as(world.gm, addPiece, { campaignId: t.campaignId, placeId: t.stair, kind: 'description', text: 'Wet steps going down.' }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row: { id: first!.id }, piece: { id: pieceId } }));
    await ok(as(world.gm, moveOn, await rowing(t, 1)));
    const requestId = crypto.randomUUID();
    const back = await ok(as(world.gm, moveOn, await rowing(t, 1, { placeId: t.stair }), requestId));
    expect(back.backShown).toBe(1);
    const shows = (await eventsOf(requestId)).filter((e) => e.target_table === 'piece_shows');
    expect(shows.map((e) => [e.type, e.before === null])).toEqual([['place.moveOn', true]]);
    expect(must(await world.admin.from('events').select('id').eq('campaign_id', t.campaignId).eq('type', 'place.backAt'))).toEqual([]);
    expect(must(await world.admin.from('piece_shows').select('shown, undone').eq('group_place_id', back.id))).toEqual([{ shown: true, undone: false }]);
    expect(await undoMove(t)).toMatchObject({ ok: true });
    expect(must(await world.admin.from('piece_shows').select('undone').eq('group_place_id', back.id))).toEqual([{ undone: true }]);
    expect((await visitOf(t.campaignId)).map((v) => v.place_id)).toEqual([t.gallery]);
    expect((await clockOf(t.campaignId)).seconds).toBe(TURN);
  });
});

describe('who may', () => {
  it("a player and an outsider can't move the party: through the app, the function, or the table", async () => {
    const t = await freshTable();
    const input = await rowing(t, 3);
    expect(await as(world.playerA, moveOn, input)).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await as(world.outsider, moveOn, input)).toMatchObject({ ok: false, reason: 'not-allowed' });
    for (const person of [world.playerA, world.outsider]) {
      const direct = await person.db.rpc('move_between_places', { campaign: t.campaignId, place: t.gallery, turns: 3, by_seconds: 3 * TURN, way_by: 'row', way_name: WAY });
      expect(direct.error?.code).toBe('42501');
    }
    const [visit] = await visitOf(t.campaignId);
    const written = await world.playerA.db.from('place_moves').insert({ campaign_id: t.campaignId, expedition_id: crypto.randomUUID(), group_number: 1, group_place_id: visit!.id, turns: 1, seconds: TURN }).select();
    expect(written.error).not.toBeNull();
    // Nobody writes a move's record directly, not even the GM: only the move makes one and only Undo marks one.
    const byTheGm = await world.gm.db.from('place_moves').insert({ campaign_id: t.campaignId, expedition_id: crypto.randomUUID(), group_number: 1, group_place_id: visit!.id, turns: 1, seconds: TURN }).select();
    expect(byTheGm.error).not.toBeNull();
    expect((await clockOf(t.campaignId)).seconds).toBe(0);
    expect((await visitOf(t.campaignId)).map((v) => v.place_id)).toEqual([t.stair]);
    expect(await movesOf(t.campaignId)).toEqual([]);
  });
});

describe('hidden means hidden (pt-f3)', () => {
  it("a player reads no record of the move, no place and no visit; of its log line only the clock's part and their own light and status", async () => {
    const t = await freshTable();
    const requestId = crypto.randomUUID();
    await ok(as(world.gm, moveOn, await rowing(t, 3), requestId));
    for (const person of [world.playerA, world.playerB]) {
      expect(must(await person.db.from('place_moves').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
      expect(must(await person.db.from('places').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
      expect(must(await person.db.from('group_places').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
      const seen = must(await person.db.from('events').select('type, target_table, before, after').eq('request_id', requestId).order('seq'));
      // Of the move's own rows, the clock's alone; and what ran out with it (Reed is approved, so everyone sees it).
      expect(seen.filter((e) => e.type === 'place.moveOn').map((e) => e.target_table)).toEqual(['campaign_clocks']);
      expect(seen.filter((e) => e.type !== 'place.moveOn').map((e) => [e.type, e.target_table])).toEqual(
        expect.arrayContaining([
          ['light.burnOut', 'character_lights'],
          ['status.timerEnd', 'character_statuses'],
        ]),
      );
      expect(seen.filter((e) => ['group_places', 'place_moves', 'places', 'place_notes', 'place_pieces', 'piece_shows'].includes(e.target_table as string))).toEqual([]);
      const raw = JSON.stringify(seen);
      expect(raw).not.toContain(WAY);
      expect(raw).not.toContain(THERE);
      expect(raw).not.toContain(t.gallery);
      // What their device is given about the move: its turns, and no name for a place not shown to them.
      const given = await movesFor(person, t.campaignId);
      expect(given.map((m) => [m.turns, m.to_name, m.from_name])).toEqual([[3, null, null]]);
      expect(JSON.stringify(given)).not.toContain(WAY);
      expect(JSON.stringify(given)).not.toContain(t.gallery);
      // Their line says the party moved on: no place, no way, and never "moved the clock on".
      const lines = await logLines(person, t.campaignId);
      const all = lines.join('\n');
      expect(partyLines(lines)).toHaveLength(1);
      expect(partyLines(lines)[0]).toMatch(/^The party moved on: 3 turns\./);
      expect(all).not.toContain('moved the clock on');
      expect(all).not.toContain('moved the party');
      expect(all).not.toContain(WAY);
      expect(all).not.toContain(THERE);
      expect(all).not.toContain(THERE_FOR_PLAYERS);
    }
    // Someone outside the campaign is given nothing about its moves.
    expect(await movesFor(world.outsider, t.campaignId)).toEqual([]);
    // The outsider gets nothing of it at all.
    expect(must(await world.outsider.db.from('events').select('id').eq('request_id', requestId))).toEqual([]);
    // The GM's own copy has it all.
    expect(must(await world.gm.db.from('place_moves').select('way_name').eq('campaign_id', t.campaignId))).toEqual([{ way_name: WAY }]);
  });
});

describe('the words (ruled by the lead, 2026-11-11)', () => {
  it("once the place is shown to their group, a player's line names it by the players' name; the GM's line keeps its own name and the way", async () => {
    const t = await freshTable();
    await ok(as(world.gm, moveOn, await rowing(t, 3)));
    await showSomethingHere(t, 'Moths cover the walls.');
    for (const person of [world.playerA, world.playerB]) {
      expect((await movesFor(person, t.campaignId)).map((m) => [m.turns, m.to_name, m.from_name])).toEqual([[3, THERE_FOR_PLAYERS, null]]);
      const lines = await logLines(person, t.campaignId);
      expect(partyLines(lines)).toHaveLength(1);
      expect(partyLines(lines)[0]).toMatch(new RegExp(`^The party moved to ${THERE_FOR_PLAYERS}: 3 turns\\.`));
      expect(lines.join('\n')).not.toContain(THERE);
      expect(lines.join('\n')).not.toContain(WAY);
      expect(lines.join('\n')).not.toContain('moved the clock on');
    }
    // The GM is given the places' own names, and reads the line as before.
    expect((await movesFor(world.gm, t.campaignId)).map((m) => [m.turns, m.to_name, m.from_name])).toEqual([[3, THERE, START]]);
    expect((await logLines(world.gm, t.campaignId)).find((line) => line.includes('moved the party'))).toMatch(new RegExp(`^You moved the party to ${THERE}: ${WAY}, 3 turns\\.`));
  });

  it('an undone move says so: the GM reads both places; a player reads that the party went back, with no place', async () => {
    const t = await freshTable();
    await ok(as(world.gm, moveOn, await rowing(t, 1)));
    expect(await undoMove(t)).toMatchObject({ ok: true });
    expect((await logLines(world.gm, t.campaignId)).filter((line) => line.includes('undid the move'))).toEqual([`You undid the move to ${THERE}: the party is back at ${START}.`]);
    for (const person of [world.playerA, world.playerB]) {
      const lines = await logLines(person, t.campaignId);
      // The move itself still reads as a move (unshown), and its undo as the party going back.
      expect(partyLines(lines).sort()).toEqual(['The party moved on: 1 turn.', 'The party went back.'].sort());
      const all = lines.join('\n');
      expect(all).not.toContain(START);
      expect(all).not.toContain(THERE);
      expect(all).not.toContain(THERE_FOR_PLAYERS);
      expect(all).not.toContain('moved the clock on');
    }
  });

  it('a player reads where the party is back at when that place has been shown to their group', async () => {
    const t = await freshTable();
    await showSomethingHere(t, 'Wet steps going down.');
    await ok(as(world.gm, moveOn, await rowing(t, 1)));
    expect(await undoMove(t)).toMatchObject({ ok: true });
    const lines = await logLines(world.playerA, t.campaignId);
    expect(partyLines(lines).sort()).toEqual(['The party moved on: 1 turn.', `The party is back at ${START}.`].sort());
    expect(lines.join('\n')).not.toContain(THERE);
  });
});

describe("the move's time is its turns at the campaign's turn length", () => {
  it('in a campaign whose turn is 15 minutes, 1 turn moves the clock 900 seconds, and 600 is refused', async () => {
    const t = await freshTable();
    must(await world.admin.from('campaigns').update({ settings: { time: { roundSeconds: 6, turnMinutes: 15, dayHours: 24 } } }).eq('id', t.campaignId).select('id'));
    expect(await as(world.gm, moveOn, await rowing(t, 1))).toMatchObject({ ok: false, message: "That time doesn't match the turns: a turn is 15 minutes in this campaign." });
    const moved = await ok(as(world.gm, moveOn, await rowing(t, 1, { seconds: 900 })));
    expect(moved.clock.seconds).toBe(900);
    expect(await movesOf(t.campaignId)).toMatchObject([{ turns: 1, seconds: 900 }]);
  });
});

describe('a split party (ruled by the lead, 2026-11-11)', () => {
  it('is refused with the words to join up first, through the app and the function; joined up again, the party moves', async () => {
    const t = await freshTable();
    const group = await ok(as(world.gm, chooseGroup, { character: t.moss, group: null }));
    expect(group).not.toBe(1);
    const words = 'Join the party up first: for now a move between linked places takes the whole party.';
    expect(await as(world.gm, moveOn, await rowing(t, 1))).toMatchObject({ ok: false, reason: 'failed', message: words });
    const direct = await world.gm.db.rpc('move_between_places', { campaign: t.campaignId, place: t.gallery, turns: 1, by_seconds: TURN });
    expect(direct.error?.message).toBe(words);
    expect((await visitOf(t.campaignId)).map((v) => v.place_id)).toEqual([t.stair]);
    expect((await clockOf(t.campaignId)).seconds).toBe(0);
    expect(await movesOf(t.campaignId)).toEqual([]);
    await ok(as(world.gm, joinUp, { campaignId: t.campaignId, together: true, from: group, into: 1 }));
    await ok(as(world.gm, moveOn, await rowing(t, 1)));
    expect((await visitOf(t.campaignId)).map((v) => v.place_id)).toEqual([t.gallery]);
  });
});

describe('refusals change nothing', () => {
  it('a move from an old copy of the clock is refused whole: neither the place nor the clock moves, and no record is kept', async () => {
    const t = await freshTable();
    const old = await clockOf(t.campaignId);
    await ok(as(world.gm, advanceTimeBy, { campaignId: t.campaignId, clock: old, seconds: TURN }));
    expect(await as(world.gm, moveOn, await rowing(t, 1, { clock: old }))).toMatchObject({ ok: false, reason: 'stale' });
    expect((await visitOf(t.campaignId)).map((v) => v.place_id)).toEqual([t.stair]);
    expect((await clockOf(t.campaignId)).seconds).toBe(TURN);
    expect(await movesOf(t.campaignId)).toEqual([]);
    expect(must(await world.admin.from('events').select('id').eq('campaign_id', t.campaignId).eq('type', 'place.moveOn'))).toEqual([]);
  });

  it('a repeat of the same request moves the party and the clock once', async () => {
    const t = await freshTable();
    const requestId = crypto.randomUUID();
    const input = await rowing(t, 2);
    const first = await ok(as(world.gm, moveOn, input, requestId));
    const again = await ok(as(world.gm, moveOn, input, requestId));
    expect(again.id).toBe(first.id);
    expect(again.clock.seconds).toBe(2 * TURN);
    expect((await clockOf(t.campaignId)).seconds).toBe(2 * TURN);
    expect(await movesOf(t.campaignId)).toHaveLength(1);
    expect(must(await world.admin.from('group_places').select('id').eq('campaign_id', t.campaignId).eq('place_id', t.gallery))).toHaveLength(1);
  });

  it("a place of another campaign, turns that don't fit, or no expedition under way: refused in plain words, nothing moved", async () => {
    const t = await freshTable();
    const elsewhere = await freshTable();
    const clock = await clockOf(t.campaignId);
    const call = (args: Record<string, unknown>) => world.gm.db.rpc('move_between_places', { campaign: t.campaignId, place: t.gallery, turns: 1, by_seconds: TURN, seen_version: clock.version, ...args });
    expect((await call({ place: elsewhere.gallery })).error?.message).toBe("That place isn't in this campaign.");
    expect((await call({ turns: 0 })).error?.message).toBe('A move takes a whole number of turns, from 1 to 1000.');
    expect((await call({ turns: 1001, by_seconds: 1001 * TURN })).error?.message).toBe('A move takes a whole number of turns, from 1 to 1000.');
    expect((await call({ by_seconds: 0 })).error?.message).toBe('Move the clock on by a whole amount above 0.');
    // The line's turns and the clock's move must be the same length of time (a turn is 10 minutes here).
    const mismatch = "That time doesn't match the turns: a turn is 10 minutes in this campaign.";
    expect((await call({ turns: 3, by_seconds: 1000 })).error?.message).toBe(mismatch);
    expect((await call({ turns: 1, by_seconds: 900 })).error?.message).toBe(mismatch);
    expect((await call({ turns: 3, by_seconds: 2 * TURN })).error?.message).toBe(mismatch);
    expect((await call({ way_by: 'x'.repeat(61) })).error?.message).toBe("A way's id is at most 60 characters.");
    expect((await call({ way_name: 'x'.repeat(201) })).error?.message).toBe("A way's name is at most 200 characters.");
    must(await world.admin.from('expeditions').update({ ended_at: 0, summary: { seconds: 0 } }).eq('campaign_id', t.campaignId).is('ended_at', null).eq('undone', false).select());
    expect((await call({})).error?.message).toBe('Start an expedition first.');
    expect((await clockOf(t.campaignId)).seconds).toBe(0);
    expect(await movesOf(t.campaignId)).toEqual([]);
  });
});
