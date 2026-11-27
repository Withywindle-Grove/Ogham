// Move on (December step 4, piece c), through the app's command against the stand-in database
// (src/testing/fakeDb.ts mirrors supabase/migrations/20261111150000_dec_4c_move_between_places.sql; the real rules are
// checked in supabase/tests/dec-4c-move-between-places.test.ts). Invented places, lights and people.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { encodeEventTag } from '../../core/eventTags.ts';
import { describeEntry, groupEntries, loadLog, loadLogNames } from '../../core/events.ts';
import { mayUndo, undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { moveOn, type MoveOnInput } from './placeMove.ts';
import { addPiece, setPlace, showPiece } from './placePlay.ts';
import { advanceTimeBy, CLOCK_MOVES, latestClockMove, startExpedition, toClock, type Clock } from './play.ts';

type Row = Record<string, unknown>;
const TURN = 600;
const registry = createAppRegistry();

interface Table {
  world: FakeWorld;
  gm: CurrentUser;
  sam: CurrentUser;
  campaign: string;
  wren: string;
  gallery: string;
}

/**
 * A campaign with a GM (Priya) and a player (Sam, who plays Wren), an expedition under way at the Reed Stair, a
 * second place (The Moth Gallery), Wren's last rushlight lit with 2 turns left, and "Glowing" on Wren for 2 turns.
 */
async function table(): Promise<Table> {
  const world = createFakeDb();
  const gmId = world.addPerson('priya@lantern.example', 'Priya');
  const samId = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gmId);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: samId });
  world.addMember(campaign, samId, 'player', wren);
  const gm: CurrentUser = { id: gmId, roles: { [campaign]: 'gm' } };
  const sam: CurrentUser = { id: samId, roles: { [campaign]: 'player' } };
  world.signInAs(gmId);
  const started = await runCommand(registry, world.db, gm, startExpedition, { campaignId: campaign, mode: 'dungeon', place: 'The Reed Stair' });
  if (!started.ok) throw new Error(started.message);
  const gallery = 'place-gallery';
  world.tables.places.push({
    id: gallery, campaign_id: campaign, name: 'The Moth Gallery', description: '', version: 1, undone: false, created_by: gmId,
    pack_id: null, pack_entry_id: null, pack_type: null, pack_parent_id: null, pack_key: null, players_name: 'A hall of moths', region_id: null, terrain_id: null, safety: null, town: {},
    created_at: '2026-11-11T10:00:00Z', updated_at: '2026-11-11T10:00:00Z',
  });
  world.tables.inventory_lines.push({ id: 'line-rushlight', campaign_id: campaign, actor_id: wren, location_id: null, name: 'Rushlight', qty: 1, approval: 'approved', container_line_id: null, item_data: { lightTypeId: 'rushlight' }, source_entry_id: null, version: 1 });
  world.tables.character_lights.push({
    id: 'light-wren', actor_id: wren, campaign_id: campaign, line_id: 'line-rushlight', type_id: 'rushlight', name: 'Rushlight', lit_at: 0, burn_seconds: 2 * TURN,
    full_seconds: 6 * TURN, warn_seconds: TURN, left_seconds: null, consumed: true, fuel_item: null, keep_lit: false, out_at: null, version: 1,
  });
  world.tables.character_statuses.push({
    id: 'status-glowing', campaign_id: campaign, actor_id: wren, name: 'Glowing', condition_id: null, started_at: 0, ends_at: 2 * TURN, total_seconds: 2 * TURN,
    unit: 'turn', secret: false, source: null, ended_at: null, end_reason: null, undone: false, version: 1,
  });
  return { world, gm, sam, campaign, wren, gallery };
}

const clockOf = (t: Table): Clock => toClock(t.world.tables.campaign_clocks.find((c) => c.campaign_id === t.campaign)!);
const rowing = (t: Table, turns: number, extra: Partial<MoveOnInput> = {}): MoveOnInput => ({
  campaignId: t.campaign, placeId: t.gallery, turns, seconds: turns * TURN, clock: clockOf(t), way: { by: 'row', name: 'Rowing' }, ...extra,
});
const currentPlace = (t: Table) => t.world.tables.group_places.find((g) => g.campaign_id === t.campaign && g.group_number === 1 && !g.moved_on && !g.undone)?.place_id ?? null;
const placeId = (t: Table, name: string) => String(t.world.tables.places.find((p) => p.campaign_id === t.campaign && p.name === name)!.id);
const light = (t: Table) => t.world.tables.character_lights.find((l) => l.id === 'light-wren')!;
const rushlights = (t: Table) => t.world.tables.inventory_lines.filter((l) => l.id === 'line-rushlight').map((l) => l.qty);
const glowing = (t: Table) => t.world.tables.character_statuses.find((s) => s.id === 'status-glowing')!;
const eventsOf = (t: Table, type: string) => t.world.tables.events.filter((e) => e.type === type);
const requestsOf = (t: Table, type: string) => [...new Set(eventsOf(t, type).map((e) => e.request_id))];
/** The log as this person's device reads it (everything, the detailed view), one line per action, in plain words. */
async function logLines(t: Table, user: CurrentUser): Promise<string[]> {
  t.world.signInAs(user.id);
  const log = await loadLog(t.world.db, t.campaign, { verbose: true });
  const names = { ...(await loadLogNames(t.world.db, t.campaign, user.id)), eventTypes: new Map(log!.events.map((e) => [e.id, e.type])) };
  return groupEntries(log!.events).map((entry) => describeEntry(entry, names));
}
const undoMove = async (t: Table) => {
  t.world.signInAs(t.gm.id);
  const eventId = await latestClockMove(t.world.db, t.campaign, t.gm.id);
  return runCommand(registry, t.world.db, t.gm, undoChange, { campaignId: t.campaign, eventId: eventId!, authorUserId: t.gm.id });
};

/** The GM shows one piece of the place the party is at now (so that place has been shown to the party's players). */
const showSomethingHere = async (t: Table, text: string) => {
  t.world.signInAs(t.gm.id);
  const visit = t.world.tables.group_places.find((g) => g.campaign_id === t.campaign && g.group_number === 1 && !g.moved_on && !g.undone)!;
  const piece = await runCommand(registry, t.world.db, t.gm, addPiece, { campaignId: t.campaign, placeId: String(visit.place_id), kind: 'description', text });
  if (!piece.ok) throw new Error(piece.message);
  const shown = await runCommand(registry, t.world.db, t.gm, showPiece, { campaignId: t.campaign, row: { id: String(visit.id) }, piece: { id: piece.value } });
  if (!shown.ok) throw new Error(shown.message);
};

let t: Table;
beforeEach(async () => {
  t = await table();
});

describe('Move on: the place and the clock in one request', () => {
  // Purpose: one Move on puts the party at the place picked and moves the clock on by the way's turns, and says what it made.
  it('moves the party to the place and the clock on by the turns', async () => {
    const moved = await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 3));
    expect(moved).toMatchObject({ ok: true, value: { backShown: 0, clock: { seconds: 3 * TURN } } });
    expect(currentPlace(t)).toBe(t.gallery);
    expect(clockOf(t).seconds).toBe(3 * TURN);
    expect(t.world.tables.place_moves).toMatchObject([{ way_by: 'row', way_name: 'Rowing', turns: 3, seconds: 3 * TURN, group_number: 1, undone: false }]);
    expect(t.world.tables.group_places.find((g) => g.id === t.world.tables.place_moves[0]!.from_group_place_id)?.place_id).toBe(placeId(t, 'The Reed Stair'));
    expect(moved.ok && moved.value.id).toBe(t.world.tables.place_moves[0]!.group_place_id);
  });

  // Purpose: everything the move changed is in one request, so the log has one line for it and one Undo.
  it('writes every change under one request: one log line', async () => {
    await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 3));
    expect(requestsOf(t, 'place.moveOn')).toHaveLength(1);
    const request = requestsOf(t, 'place.moveOn')[0];
    const inRequest = t.world.tables.events.filter((e) => e.request_id === request).map((e) => [e.type, e.target_table, e.level]);
    expect(inRequest).toEqual([
      ['place.moveOn', 'group_places', 'simple'],
      ['place.moveOn', 'group_places', 'simple'],
      ['place.moveOn', 'place_moves', 'simple'],
      ['place.moveOn', 'campaign_clocks', 'simple'],
      ['light.burnOut', 'inventory_lines', 'simple'],
      ['light.burnOut', 'character_lights', 'simple'],
      ['status.timerEnd', 'character_statuses', 'simple'],
    ]);
    const lines = await logLines(t, t.gm);
    expect(lines.filter((line) => line.includes('moved the party'))).toEqual(["You moved the party to The Moth Gallery: Rowing, 3 turns. Ran out with the clock: Wren’s rushlight, Glowing on Wren."]);
  });

  // Purpose: the clock's side effects are Advance by…'s own: the same lights burn out, the same line leaves play and
  // the same status ends, whether the turns pass by Move on or by Where now? and then Advance by….
  it('burns lights down and ends statuses exactly as Advance by the same turns does', async () => {
    const other = await table();
    await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 3));
    await runCommand(registry, other.world.db, other.gm, setPlace, { campaignId: other.campaign, group: 1, name: 'The Moth Gallery', placeId: other.gallery });
    await runCommand(registry, other.world.db, other.gm, advanceTimeBy, { campaignId: other.campaign, clock: clockOf(other), seconds: 3 * TURN });
    const state = (x: Table) => ({
      clock: clockOf(x).seconds,
      light: { lit_at: light(x).lit_at, out_at: light(x).out_at, line_id: light(x).line_id },
      rushlights: rushlights(x),
      glowing: { ended_at: glowing(x).ended_at, end_reason: glowing(x).end_reason },
      place: currentPlace(x) === x.gallery,
    });
    expect(state(t)).toEqual(state(other));
    expect(state(t)).toEqual({ clock: 3 * TURN, light: { lit_at: null, out_at: 2 * TURN, line_id: 'line-rushlight' }, rushlights: [], glowing: { ended_at: 2 * TURN, end_reason: 'timer' }, place: true });
    // The database's own parts of the move carry the same names and levels either way.
    const own = (x: Table) => x.world.tables.events.filter((e) => ['light.burnOut', 'status.timerEnd'].includes(String(e.type))).map((e) => [e.type, e.target_table, e.level, e.before, e.after]);
    expect(own(t)).toEqual(own(other));
  });

  // Purpose: a move of fewer turns than the light has left burns nothing out and ends nothing, as a short Advance by… wouldn't.
  it('a 1-turn move leaves a light with 2 turns left burning and the status on', async () => {
    await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1));
    expect(light(t)).toMatchObject({ lit_at: 0, out_at: null });
    expect(rushlights(t)).toEqual([1]);
    expect(glowing(t).ended_at).toBeNull();
    expect(clockOf(t).seconds).toBe(TURN);
  });

  // Purpose: the move counts as a move of the clock, so the strip's Undo finds it and the start time stops moving the clock.
  it("is one of the clock's moves", () => {
    expect(CLOCK_MOVES).toContain('place.moveOn');
  });
});

describe('Move on: one Undo', () => {
  // Purpose: one Undo puts back the place, the clock, the light and the line the clock used up, and marks the move's
  // record and its visit undone (nothing is erased).
  it('puts back the place, the clock, the light and the burnt-out line', async () => {
    const before = currentPlace(t);
    await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 3));
    const events = t.world.tables.events.filter((e) => e.request_id === requestsOf(t, 'place.moveOn')[0]);
    expect(mayUndo('place.moveOn', events.map((e) => ({ before: e.before, after: e.after, targetId: e.target_id as string })))).toBe(true);
    expect(await undoMove(t)).toMatchObject({ ok: true });
    expect(currentPlace(t)).toBe(before);
    expect(before).toBe(placeId(t, 'The Reed Stair'));
    expect(clockOf(t).seconds).toBe(0);
    expect(light(t)).toMatchObject({ lit_at: 0, out_at: null, line_id: 'line-rushlight' });
    expect(rushlights(t)).toEqual([1]);
    expect(glowing(t)).toMatchObject({ ended_at: null });
    expect(t.world.tables.place_moves).toMatchObject([{ undone: true }]);
    expect(t.world.tables.group_places.filter((g) => g.place_id === t.gallery)).toMatchObject([{ undone: true }]);
  });

  // Purpose: the same move can't be undone twice.
  it('a second Undo of the same move is refused', async () => {
    await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 3));
    const eventId = (await latestClockMove(t.world.db, t.campaign, t.gm.id))!;
    expect(await runCommand(registry, t.world.db, t.gm, undoChange, { campaignId: t.campaign, eventId, authorUserId: t.gm.id })).toMatchObject({ ok: true });
    expect(await runCommand(registry, t.world.db, t.gm, undoChange, { campaignId: t.campaign, eventId, authorUserId: t.gm.id })).toMatchObject({ ok: false, message: 'That was already undone.' });
  });

  // Purpose: coming back to a place brings back what its players had been shown, in the same line; the move's Undo hides it again.
  it('a place visited before starts with its shown pieces, in the same request; Undo takes them back', async () => {
    const stair = placeId(t, 'The Reed Stair');
    const visit = t.world.tables.group_places.find((g) => g.place_id === stair)!;
    const piece = await runCommand(registry, t.world.db, t.gm, addPiece, { campaignId: t.campaign, placeId: stair, kind: 'description', text: 'Wet steps going down.' });
    if (!piece.ok) throw new Error(piece.message);
    await runCommand(registry, t.world.db, t.gm, showPiece, { campaignId: t.campaign, row: { id: String(visit.id) }, piece: { id: piece.value } });
    await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1));
    const back = await runCommand(registry, t.world.db, t.gm, moveOn, { ...rowing(t, 1), placeId: stair });
    expect(back).toMatchObject({ ok: true, value: { backShown: 1 } });
    const request = requestsOf(t, 'place.moveOn')[1];
    expect(t.world.tables.events.filter((e) => e.request_id === request && e.target_table === 'piece_shows').map((e) => e.type)).toEqual(['place.moveOn']);
    expect(eventsOf(t, 'place.backAt')).toEqual([]);
    expect(await undoMove(t)).toMatchObject({ ok: true });
    expect(currentPlace(t)).toBe(t.gallery);
    expect(t.world.tables.piece_shows.filter((s) => !s.undone)).toHaveLength(1);
    expect(clockOf(t).seconds).toBe(TURN);
  });
});

describe('Move on: who may, and what stays hidden', () => {
  // Purpose: only the GM moves the party; a player is refused by the app and, calling the function directly, by the database's stand-in.
  it("a player can't move the party", async () => {
    t.world.signInAs(t.sam.id);
    expect(await runCommand(registry, t.world.db, t.sam, moveOn, rowing(t, 3))).toMatchObject({ ok: false, reason: 'not-allowed' });
    const tag = encodeEventTag({ type: 'place.moveOn', level: 'simple', requestId: crypto.randomUUID() });
    const direct = (await t.world.db.rpc('move_between_places', { campaign: t.campaign, place: t.gallery, turns: 3, by_seconds: 3 * TURN }).setHeader('x-grimoire-command', tag)) as { error: { code?: string } | null };
    expect(direct.error?.code).toBe('42501');
    expect(clockOf(t).seconds).toBe(0);
    expect(t.world.tables.place_moves).toEqual([]);
  });

  // Purpose: a player whose group hasn't been shown the place reads that the party moved on and for how many turns:
  // no place, no way, and never "moved the clock on"; their device gets the clock's part of the line and no record.
  it("a player's line for a place not shown to them: the party moved on, with no place and no way", async () => {
    await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 3));
    const lines = await logLines(t, t.sam);
    expect(lines.filter((line) => line.startsWith('The party moved'))).toEqual(["The party moved on: 3 turns. Ran out with the clock: Wren’s rushlight, Glowing on Wren."]);
    const all = lines.join('\n');
    expect(all).not.toContain('moved the clock on');
    expect(all).not.toContain('Rowing');
    expect(all).not.toContain('Moth Gallery');
    expect(all).not.toContain('hall of moths');
    const seen = await t.world.db.from('events').select('target_table').eq('campaign_id', t.campaign).eq('type', 'place.moveOn');
    expect((seen.data ?? []).map((e) => (e as Row).target_table)).toEqual(['campaign_clocks']);
    const records = await t.world.db.from('place_moves').select('*').eq('campaign_id', t.campaign);
    expect(records.data ?? []).toEqual([]);
    // What the device is given about the move: its turns, and no name for either place.
    const given = await t.world.db.rpc('party_moves', { campaign: t.campaign });
    expect(given.data).toMatchObject([{ turns: 3, to_name: null, from_name: null }]);
    expect(JSON.stringify(given.data)).not.toContain('Rowing');
  });

  // Purpose: once the GM has shown the party a piece of the place, the same line names it, by the players' name.
  it("a player's line for a place shown to their group names it by the players' name", async () => {
    await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 3));
    await showSomethingHere(t, 'Moths cover the walls.');
    const lines = await logLines(t, t.sam);
    expect(lines.filter((line) => line.startsWith('The party moved'))).toEqual(["The party moved to A hall of moths: 3 turns. Ran out with the clock: Wren’s rushlight, Glowing on Wren."]);
    expect(lines.join('\n')).not.toContain('Moth Gallery');
    expect(lines.join('\n')).not.toContain('Rowing');
    // The GM's own line is as it was: the place's own name and the way.
    expect((await logLines(t, t.gm)).filter((line) => line.includes('moved the party'))).toEqual(["You moved the party to The Moth Gallery: Rowing, 3 turns. Ran out with the clock: Wren’s rushlight, Glowing on Wren."]);
  });
});

describe('Move on: an undone move says so', () => {
  // Purpose: the GM's undo line names the place the move went to and the place the party is back at.
  it('the GM reads which move was undone and where the party is back at', async () => {
    await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1));
    await undoMove(t);
    const lines = await logLines(t, t.gm);
    expect(lines.filter((line) => line.includes('undid'))).toEqual(['You undid the move to The Moth Gallery: the party is back at The Reed Stair.']);
  });

  // Purpose: a player reads that the party went back, with no place while the place they are back at hasn't been shown to them.
  it('a player reads "The party went back." while the place is not shown to them', async () => {
    await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1));
    await undoMove(t);
    const lines = await logLines(t, t.sam);
    expect(lines.filter((line) => line.startsWith('The party went back') || line.startsWith('The party is back'))).toEqual(['The party went back.']);
    const all = lines.join('\n');
    expect(all).not.toContain('Reed Stair');
    expect(all).not.toContain('Moth Gallery');
    expect(all).not.toContain('the clock');
  });

  // Purpose: a player reads the place the party is back at once that place has been shown to their group.
  it('a player reads where the party is back at when that place was shown to them', async () => {
    await showSomethingHere(t, 'Wet steps going down.');
    await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1));
    await undoMove(t);
    const lines = await logLines(t, t.sam);
    expect(lines.filter((line) => line.startsWith('The party went back') || line.startsWith('The party is back'))).toEqual(['The party is back at The Reed Stair.']);
    expect(lines.join('\n')).not.toContain('Moth Gallery');
  });
});

describe('Move on: refusals change nothing', () => {
  // Purpose: a move made from an old copy of the clock is refused whole: the party stays where it was.
  it('an old copy of the clock is refused, and neither the place nor the clock moves', async () => {
    const old = clockOf(t);
    await runCommand(registry, t.world.db, t.gm, advanceTimeBy, { campaignId: t.campaign, clock: old, seconds: TURN });
    const before = currentPlace(t);
    expect(await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1, { clock: old }))).toMatchObject({ ok: false, reason: 'stale' });
    expect(currentPlace(t)).toBe(before);
    expect(clockOf(t).seconds).toBe(TURN);
    expect(t.world.tables.place_moves).toEqual([]);
  });

  // Purpose: the place must be one of this campaign's, the turns a whole number from 1, and an expedition under way.
  it('a place of another campaign, no turns, or no expedition is refused in plain words', async () => {
    expect(await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1, { placeId: 'place-elsewhere' }))).toMatchObject({ ok: false, message: "That place isn't in this campaign." });
    expect(await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 0))).toMatchObject({ ok: false, message: 'A move takes a whole number of turns, 1 or more.' });
    for (const x of t.world.tables.expeditions) x.ended_at = 0;
    expect(await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1))).toMatchObject({ ok: false, message: 'Start an expedition first.' });
    expect(clockOf(t).seconds).toBe(0);
    expect(t.world.tables.place_moves).toEqual([]);
  });

  // Purpose: the line's turns and the clock's move are the same length of time: seconds that aren't the turns at the
  // campaign's turn length are refused, whatever the campaign's turn is, and a way's id and name each have their own limit.
  it("seconds that don't match the turns at the campaign's turn length are refused; a way's id and name have their own limits", async () => {
    expect(await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1, { seconds: 900 }))).toMatchObject({ ok: false, message: "That time doesn't match the turns: a turn is 10 minutes in this campaign." });
    expect(await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 3, { seconds: 1200 }))).toMatchObject({ ok: false, message: "That time doesn't match the turns: a turn is 10 minutes in this campaign." });
    expect(await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1, { way: { by: 'x'.repeat(61), name: 'Rowing' } }))).toMatchObject({ ok: false, message: "A way's id is at most 60 characters." });
    expect(await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1, { way: { by: 'row', name: 'x'.repeat(201) } }))).toMatchObject({ ok: false, message: "A way's name is at most 200 characters." });
    expect(clockOf(t).seconds).toBe(0);
    expect(t.world.tables.place_moves).toEqual([]);
    // A campaign whose turn is 15 minutes: 1 turn is 900 seconds there, and 600 is refused.
    const campaign = t.world.tables.campaigns.find((c) => c.id === t.campaign)!;
    campaign.settings = { ...((campaign.settings as Row | undefined) ?? {}), time: { roundSeconds: 6, turnMinutes: 15, dayHours: 24 } };
    expect(await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1))).toMatchObject({ ok: false, message: "That time doesn't match the turns: a turn is 15 minutes in this campaign." });
    expect(await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1, { seconds: 900 }))).toMatchObject({ ok: true, value: { clock: { seconds: 900 } } });
  });

  // Purpose: a split party can't move between linked places in this cut: the refusal says to join up, and nothing moves.
  it('a split party is refused with the words to join up first', async () => {
    const moss = t.world.addCharacter(t.campaign, 'Moss', { ownerId: t.sam.id });
    t.world.tables.party_groups.push({ id: 'group-2', campaign_id: t.campaign, number: 2 });
    t.world.tables.party_group_members.push({ id: moss, actor_id: moss, campaign_id: t.campaign, group_number: 2, version: 1 });
    const before = currentPlace(t);
    expect(await runCommand(registry, t.world.db, t.gm, moveOn, rowing(t, 1))).toMatchObject({
      ok: false,
      reason: 'failed',
      message: 'Join the party up first: for now a move between linked places takes the whole party.',
    });
    expect(currentPlace(t)).toBe(before);
    expect(clockOf(t).seconds).toBe(0);
    expect(t.world.tables.place_moves).toEqual([]);
  });

  // Purpose: the same request sent twice (a retry after a lost answer) moves the party and the clock once.
  it('a repeat of the same request changes nothing more', async () => {
    const requestId = crypto.randomUUID();
    const input = rowing(t, 2);
    const first = await runCommand(registry, t.world.db, t.gm, moveOn, input, { requestId });
    const again = await runCommand(registry, t.world.db, t.gm, moveOn, input, { requestId });
    expect(again).toEqual(first);
    expect(clockOf(t).seconds).toBe(2 * TURN);
    expect(t.world.tables.place_moves).toHaveLength(1);
  });
});
