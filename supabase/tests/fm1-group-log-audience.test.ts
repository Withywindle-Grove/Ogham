// fm-1: a travel group's log lines (supabase/migrations/20261111100000_fm1_group_log_audience.sql; docs/plans/m5b-fm-1.md;
// ruled by Francis 2026-11-10, option A and ⚑ 1 "yes"). TEST project only; invented places and characters.
//   Hidden means hidden, first: a group's travel lines (the start of the day, the GM's move, the day's budget, the
//   forced march) are read by that group's players and the GM. A player of another group, a member with no character
//   and an outsider read none of them: not the line, not its stored row (the place the group is entering), by any way
//   of asking. "Everyone who was there": the line keeps the players in the group when it was written, so a player who
//   joins later reads only what is written from then on, one who leaves keeps the lines of their time, and a later
//   split that is given the same group number never reads the earlier group's lines. Any other command's change to the
//   travel row (an activity's cost) stays the GM's line. A note on a group's line is read by that line's readers.
//   Then the Undo: the player who forced the march undoes it (the points, the forced count, the arrival it paid for);
//   another player of the group can't; nor the marcher once they have left the group; and once the points are spent or
//   the day has moved on the database refuses with "That's changed since", for the player and the GM alike.
//   And the place a group is entering (⚑ 2, the database way; the #528 look-back): a member of the group can't read
//   the GM's own name for a place not yet shown to them, typed or from a pack, in the row, the log or a function's
//   answer; the GM still can; once shown, the group reads the place's players' name. A place undone before the
//   group arrives is no place.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { latestChange, undoChange } from '../../src/core/undo.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { loadGroupPlaces } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { forceMarch, loadTravelGroups, setTravelBudget, startTravelDay, travelMove, type TravelGroup } from '../../src/modules/expedition/travelPlay.ts';
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

const CHANGED_SINCE = "That's changed since. Undo the later change first.";
type Trail = Awaited<ReturnType<typeof freshTrail>>;

/**
 * A fresh campaign with an expedition under way: Reed (player A's) and Moss (player B's) in the party, and the
 * newcomer a member with no character (in no group). The outsider isn't in the campaign.
 */
async function freshTrail() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Fen Crossing', created_by: world.gm.id }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaign.id, user_id: world.playerB.id, base_role: 'player' },
        { campaign_id: campaign.id, user_id: world.newcomer.id, base_role: 'player' },
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

const start = (t: Trail, group = 1, day = 0, total = 8) => as(world.gm, startTravelDay, { campaignId: t.campaignId, group, day, total, pace: 'foot' as const, gmPerDay: null });
const move = (t: Trail, row: TravelGroup, cost: number, placeName: string | null, terrainId = 'bog') =>
  as(world.gm, travelMove, { campaignId: t.campaignId, row, cost, terrainId, routeId: null, placeName, placeId: null });
const budget = (t: Trail, row: TravelGroup, total: number) => as(world.gm, setTravelBudget, { campaignId: t.campaignId, row, total, pace: 'foot' as const, gmPerDay: total });
const march = (person: Person, t: Trail, row: TravelGroup, added: number) => as(person, forceMarch, { target: { campaignId: t.campaignId, group: row.group, mine: true }, row, added });
const rowOf = async (t: Trail, group = 1) => (await loadTravelGroups(asDb(world.gm), t.campaignId, t.expeditionId))!.get(group)!;
const placeOf = async (t: Trail, group = 1) => (await loadGroupPlaces(asDb(world.gm), t.campaignId, t.expeditionId))?.get(group)?.place?.name ?? null;
/** The commands of the lines a person reads on a travel row, oldest first (undos left out). */
const linesOf = async (person: Person, t: Trail, rowId: string) =>
  (must(await person.db.from('events').select('type, seq').eq('campaign_id', t.campaignId).eq('target_table', 'travel_groups').eq('target_id', rowId).is('reverts_event_id', null).order('seq')) as { type: string }[]).map(
    (e) => e.type,
  );
/** The newest line of a command on a travel row, as the database keeps it (the row's own line, not its GM's part's). */
const lineOf = async (t: Trail, rowId: string, type: string) =>
  must(
    await world.admin
      .from('events')
      .select('id, audience, group_number, group_user_ids, request_id')
      .eq('campaign_id', t.campaignId)
      .eq('target_table', 'travel_groups')
      .eq('target_id', rowId)
      .eq('type', type)
      .order('seq', { ascending: false })
      .limit(1),
  )[0] as {
    id: string;
    audience: string;
    group_number: number | null;
    group_user_ids: string[] | null;
    request_id: string | null;
  };
const undo = (person: Person, t: Trail, eventId: string) => as(person, undoChange, { campaignId: t.campaignId, eventId, authorUserId: person.id });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe("hidden means hidden: a group's travel lines (fm-1)", () => {
  // Purpose: in a split party, a group's travel lines reach that group's players and the GM, and nobody else: not a
  // player of another group, not a member with no character, not an outsider; and the stored row (the place the group
  // is entering) reaches none of them however they ask.
  it("a group's players and the GM read its travel lines; another group's player, a member in no group and an outsider read none, nor the stored row", async () => {
    const t = await freshTrail();
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    let reeds = await ok(start(t, 1, 0, 5));
    const mosses = await ok(start(t, mossGroup, 0, 6));
    // 7 with 5 left: the group is entering the Sunken Causeway, 2 owed (the place's name is the GM's: in no row or
    // line a player reads).
    reeds = await ok(move(t, reeds, 7, 'The Sunken Causeway'));
    reeds = await ok(budget(t, reeds, 6));

    const theirs = ['travel.dayStart', 'travel.move', 'travel.setBudget'];
    expect(await linesOf(world.playerA, t, reeds.id)).toEqual(theirs);
    expect(await linesOf(world.gm, t, reeds.id)).toEqual(theirs);
    expect(await linesOf(world.playerA, t, mosses.id)).toEqual([]);
    expect(await linesOf(world.playerB, t, mosses.id)).toEqual(['travel.dayStart']);
    expect(await linesOf(world.gm, t, mosses.id)).toEqual(['travel.dayStart']);
    for (const other of [world.playerB, world.newcomer, world.outsider]) expect(await linesOf(other, t, reeds.id)).toEqual([]);
    for (const other of [world.newcomer, world.outsider]) expect(await linesOf(other, t, mosses.id)).toEqual([]);

    // Each line keeps its group and the players in it when it was written.
    for (const type of theirs) expect(await lineOf(t, reeds.id, type)).toMatchObject({ audience: 'group', group_number: 1, group_user_ids: [world.playerA.id] });
    expect(await lineOf(t, mosses.id, 'travel.dayStart')).toMatchObject({ audience: 'group', group_number: mossGroup, group_user_ids: [world.playerB.id] });

    // The stored row never reaches anyone outside the group: asked for by its id, by its request, or all at once.
    const moved = await lineOf(t, reeds.id, 'travel.move');
    for (const other of [world.playerB, world.newcomer, world.outsider]) {
      expect(must(await other.db.from('events').select('id, before, after').eq('id', moved.id))).toEqual([]);
      expect(must(await other.db.from('events').select('id, before, after').eq('request_id', moved.request_id!))).toEqual([]);
      const everything = must(await other.db.from('events').select('target_id, before, after').eq('campaign_id', t.campaignId));
      expect(JSON.stringify(everything)).not.toContain('The Sunken Causeway');
      expect(everything.some((e) => e.target_id === reeds.id)).toBe(false);
    }
    // Reed's own player does read it, with the row as stored: the points owed, and no name for a place not shown.
    const own = must(await world.playerA.db.from('events').select('after').eq('id', moved.id)) as { after: Record<string, unknown> }[];
    expect(own[0]?.after).toMatchObject({ pending_owed: 2 });
    expect(JSON.stringify(own)).not.toContain('The Sunken Causeway');
  });

  // Purpose: "everyone who was there". A line is read by the players in the group when it was written, whatever the
  // groups are now: a player who joins later doesn't read the earlier lines; one who leaves keeps the lines of their
  // time and reads none after; a later split given the same group number doesn't read the earlier group's lines.
  it('a line is read by those in the group when it was written: not by a later joiner, nor by a later group with the same number', async () => {
    const t = await freshTrail();
    // Together: the day starts for the party, Reed and Moss both there.
    let party = await ok(start(t, 1, 0, 8));
    const together = (await lineOf(t, party.id, 'travel.dayStart')).group_user_ids!;
    expect([...together].sort()).toEqual([world.playerA.id, world.playerB.id].sort());
    // Moss splits off; the GM moves the party (Reed alone) and starts Moss's own day.
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    party = await ok(move(t, party, 3, null, 'moor'));
    const second = await ok(start(t, mossGroup, 0, 6));
    // Moss left: keeps the morning's line, reads nothing written after.
    expect(await linesOf(world.playerB, t, party.id)).toEqual(['travel.dayStart']);
    expect(await linesOf(world.playerA, t, party.id)).toEqual(['travel.dayStart', 'travel.move']);
    expect(await linesOf(world.playerA, t, second.id)).toEqual([]);
    // Moss comes back to the party; the GM sets its budget: Moss reads that, and still not the move made while away.
    // The GM brings Moss back: the party has moved on, so it's in another place, and only the GM moves someone into
    // a group that's elsewhere (choose_party_group, M5 B1; CI run 43024984091 had Moss's player try it).
    await ok(as(world.gm, chooseGroup, { character: t.moss, group: 1 }));
    party = await ok(budget(t, party, 9));
    expect(await linesOf(world.playerB, t, party.id)).toEqual(['travel.dayStart', 'travel.setBudget']);
    // Reed splits off and is given the number Moss's group had (an empty group is used again): the same travel row.
    expect(await ok(as(world.playerA, chooseGroup, { character: t.reed, group: null }))).toBe(mossGroup);
    const reused = await ok(budget(t, await rowOf(t, mossGroup), 7));
    expect(reused.id).toBe(second.id);
    // Reed reads what is written now, not the earlier group's morning; Moss keeps that morning and reads nothing new.
    expect(await linesOf(world.playerA, t, second.id)).toEqual(['travel.setBudget']);
    expect(await linesOf(world.playerB, t, second.id)).toEqual(['travel.dayStart']);
    expect(await lineOf(t, second.id, 'travel.setBudget')).toMatchObject({ audience: 'group', group_number: mossGroup, group_user_ids: [world.playerA.id] });
  });

  // Purpose: only the travel commands' own lines are the group's. Another command's change to the same row (an
  // activity's cost; a write with no command) stays the GM's line, as every travel line was before, so a secret
  // activity's cost can't show in another player's log.
  it("another command's change to the travel row stays the GM's line", async () => {
    const t = await freshTrail();
    const row = await ok(start(t, 1, 0, 8));
    // Reed's player does an activity (a point spent on the row); then a write with no command at all.
    must(
      await world.playerA.db.rpc('apply_activity', {
        campaign: t.campaignId, group_no: 1, activity_id: 'gather-reeds', activity_name: 'Gather reeds', actors: [t.reed.id], finder: t.reed.id, rolls: [], outcome: 'done', spend: 1,
      }),
    );
    must(await world.admin.from('travel_groups').update({ spent: 2 }).eq('id', row.id).select('id'));
    const lines = must(await world.admin.from('events').select('type, audience, group_number, group_user_ids').eq('campaign_id', t.campaignId).eq('target_table', 'travel_groups').eq('target_id', row.id).order('seq')) as {
      type: string;
      audience: string;
      group_number: number | null;
      group_user_ids: string[] | null;
    }[];
    const others = lines.filter((l) => l.type !== 'travel.dayStart');
    expect(others.length).toBe(2);
    for (const line of others) expect(line).toMatchObject({ audience: 'gm', group_number: null, group_user_ids: null });
    // Moss's player, in the same group, reads the morning's line and neither of those.
    expect(await linesOf(world.playerB, t, row.id)).toEqual(['travel.dayStart']);
  });

  // Purpose: a note added to a group's line is read by that line's readers and the GM, like any note on a log line;
  // a player who can't read the line can't add a note to it; and notes elsewhere still work as before.
  it("a note on a group's line is read by that line's readers; someone who can't read the line can't note it", async () => {
    const t = await freshTrail();
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    const reeds = await ok(start(t, 1, 0, 8));
    await ok(start(t, mossGroup, 0, 6));
    const line = await lineOf(t, reeds.id, 'travel.dayStart');
    const note = must(await world.playerA.db.from('notes').insert({ campaign_id: t.campaignId, text: 'We leave by the heron stones', annotates_event_id: line.id }).select('id').single());
    expect(must(await world.admin.from('notes').select('audience, group_user_ids').eq('id', note.id).single())).toEqual({ audience: 'group', group_user_ids: [world.playerA.id] });
    expect(must(await world.gm.db.from('notes').select('id').eq('id', note.id))).toHaveLength(1);
    for (const other of [world.playerB, world.newcomer, world.outsider]) expect(must(await other.db.from('notes').select('id').eq('id', note.id))).toEqual([]);
    // The note's own log line goes to the same readers.
    const logged = must(await world.admin.from('events').select('audience, group_user_ids').eq('target_table', 'notes').eq('target_id', note.id).single());
    expect(logged).toEqual({ audience: 'group', group_user_ids: [world.playerA.id] });
    expect(must(await world.playerB.db.from('events').select('id').eq('target_table', 'notes').eq('target_id', note.id))).toEqual([]);
    // Moss's player can't add a note to a line they can't read.
    const refused = await world.playerB.db.from('notes').insert({ campaign_id: t.campaignId, text: 'What are they up to?', annotates_event_id: line.id }).select('id');
    expect(refused.error).not.toBeNull();
    // A plain note is still everyone's.
    const plain = must(await world.playerB.db.from('notes').insert({ campaign_id: t.campaignId, text: 'Bring more rope' }).select('id, audience').single());
    expect(plain.audience).toBe('all');
    expect(must(await world.playerA.db.from('notes').select('id').eq('id', plain.id))).toHaveLength(1);
  });
});

describe("a forced march's Undo by the player who marched (fm-1)", () => {
  // Purpose: the player who forced the march reads their own line and undoes it: the points, the forced count and the
  // arrival it paid for all go back, though a player can't write those rows themselves. Another player of the same
  // group reads the line but can't undo it.
  it('the marcher undoes it, arrival and all; another player of the group cannot', async () => {
    const t = await freshTrail();
    let row = await ok(start(t, 1, 0, 4));
    row = await ok(move(t, row, 6, 'The Sunken Causeway'));
    expect(row.pending?.owed).toBe(2);
    row = await ok(march(world.playerA, t, row, 3));
    expect([row.total, row.spent, row.forced, row.pending]).toEqual([7, 6, 1, null]);
    expect(await placeOf(t)).toBe('The Sunken Causeway');
    // The toast's Undo finds the player's own line (the newest travel.forceMarch they made and can read).
    const mine = await latestChange(asDb(world.playerA), t.campaignId, 'travel.forceMarch', world.playerA.id);
    expect(mine).not.toBeNull();
    // Moss's player is in the group: reads the line, can't undo it (asked of the database itself).
    expect(await linesOf(world.playerB, t, row.id)).toContain('travel.forceMarch');
    const refused = await world.playerB.db.rpc('undo_request_said', { event_id: mine! });
    expect(refused.error?.code).toBe('42501');
    expect((await rowOf(t)).forced).toBe(1);
    // The marcher's Undo.
    await ok(undo(world.playerA, t, mine!));
    const back = await rowOf(t);
    expect([back.total, back.spent, back.forced, back.pending?.owed, back.pending?.placeName]).toEqual([4, 4, 0, 2, 'The Sunken Causeway']);
    expect(await placeOf(t)).toBe('The Reed Jetty');
    // The undo's own line is the group's too, linked to the march.
    const undone = must(await world.playerA.db.from('events').select('type, reverts_event_id').eq('campaign_id', t.campaignId).eq('target_table', 'travel_groups').eq('target_id', row.id).not('reverts_event_id', 'is', null)) as { type: string }[];
    expect(undone.length).toBeGreaterThan(0);
    expect([...new Set(undone.map((e) => e.type))]).toEqual(['event.undo']);
    // Once undone, it can't be undone again.
    expect((await undo(world.playerA, t, mine!)).ok).toBe(false);
  });

  // Purpose: once the GM has spent the march's points (nothing was owed at the march, so its line holds only the total
  // and the forced count), the Undo is refused with "That's changed since", for the player and the GM alike; with the
  // later move undone first, the march can be undone.
  it("once the points are spent the Undo is refused with its reason, until the later move is undone", async () => {
    const t = await freshTrail();
    let row = await ok(start(t, 1, 0, 4));
    row = await ok(march(world.playerA, t, row, 2));
    row = await ok(move(t, row, 5, null, 'moor'));
    expect([row.total, row.spent, row.forced]).toEqual([6, 5, 1]);
    const marched = (await lineOf(t, row.id, 'travel.forceMarch')).id;
    const asPlayer = await undo(world.playerA, t, marched);
    expect(asPlayer).toMatchObject({ ok: false, message: CHANGED_SINCE });
    const asGm = await as(world.gm, undoChange, { campaignId: t.campaignId, eventId: marched, authorUserId: world.playerA.id });
    expect(asGm).toMatchObject({ ok: false, message: CHANGED_SINCE });
    expect([(await rowOf(t)).total, (await rowOf(t)).forced]).toEqual([6, 1]);
    // The move undone first, the march can go.
    await ok(as(world.gm, undoChange, { campaignId: t.campaignId, eventId: (await lineOf(t, row.id, 'travel.move')).id, authorUserId: world.gm.id }));
    await ok(undo(world.playerA, t, marched));
    const back = await rowOf(t);
    expect([back.total, back.spent, back.forced]).toEqual([4, 0, 0]);
  });

  // Purpose: once the day has moved on, the march can't be undone (the day's forced count started again).
  it('once the day has moved on the Undo is refused with its reason', async () => {
    const t = await freshTrail();
    let row = await ok(start(t, 1, 0, 4));
    row = await ok(march(world.playerA, t, row, 2));
    const marched = (await lineOf(t, row.id, 'travel.forceMarch')).id;
    await ok(start(t, 1, 1, 4));
    expect(await undo(world.playerA, t, marched)).toMatchObject({ ok: false, message: CHANGED_SINCE });
    expect((await rowOf(t)).day).toBe(1);
  });

  // Purpose: a player who has left the group since can no longer undo the march they made in it.
  it('a marcher who has left the group can no longer undo it', async () => {
    const t = await freshTrail();
    let row = await ok(start(t, 1, 0, 4));
    row = await ok(march(world.playerA, t, row, 2));
    const marched = (await lineOf(t, row.id, 'travel.forceMarch')).id;
    await ok(as(world.playerA, chooseGroup, { character: t.reed, group: null }));
    expect(await undo(world.playerA, t, marched)).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect([(await rowOf(t)).total, (await rowOf(t)).forced]).toEqual([6, 1]);
    // They still read the line they made while there.
    expect(await linesOf(world.playerA, t, row.id)).toContain('travel.forceMarch');
  });
});

describe("the place a group is entering is the GM's until it has been shown (fm-1 ⚑ 2; the #528 look-back)", () => {
  /** Everything a person can read of the campaign's travel: the rows, the GM's part of them, and the log. */
  const reads = async (person: Person, t: Trail) =>
    JSON.stringify(await Promise.all(['travel_groups', 'travel_group_secrets', 'events'].map(async (table) => (await person.db.from(table).select('*').eq('campaign_id', t.campaignId)).data)));

  // Purpose: a typed name. Until now the group's players read the GM's own name for the place in their travel row from
  // the Move… until they arrived. Now a member of the group reads no name and no place for a place not shown to them:
  // not in the row, not in the GM's part of it, not in the log, not in what a forced march gives back; the GM still
  // reads it, and the group still arrives there.
  it("a group member can't read the GM's name for a typed place not yet shown; the GM still can", async () => {
    const t = await freshTrail();
    let row = await ok(start(t, 1, 0, 4));
    row = await ok(move(t, row, 6, 'The Sunken Causeway'));
    // The GM: the Move…'s own answer, the row as the app loads it, and the GM's part of the row.
    expect(row.pending).toMatchObject({ placeName: 'The Sunken Causeway', owed: 2 });
    expect((await rowOf(t)).pending).toMatchObject({ placeName: 'The Sunken Causeway', owed: 2 });
    expect(must(await world.gm.db.from('travel_group_secrets').select('pending_place_name').eq('id', row.id).single())).toEqual({ pending_place_name: 'The Sunken Causeway' });
    // A member of the group: the row has the points owed and nothing of the place.
    const raw = must(await world.playerA.db.from('travel_groups').select('*').eq('id', row.id).single());
    expect([raw.pending_owed, raw.pending_place_name, raw.pending_place_id]).toEqual([2, null, null]);
    expect(must(await world.playerA.db.from('travel_group_secrets').select('*').eq('campaign_id', t.campaignId))).toEqual([]);
    expect(await reads(world.playerA, t)).not.toContain('The Sunken Causeway');
    const mine = (await loadTravelGroups(asDb(world.playerA), t.campaignId, t.expeditionId))!.get(1)!;
    expect(mine.pending).toMatchObject({ placeName: '', placeId: null, owed: 2 });
    // Nor can they write the GM's part, nor learn the name from their own forced march's answer (1 point: 1 still owed).
    expect(must(await world.playerA.db.from('travel_group_secrets').update({ pending_place_name: 'Mine now' }).eq('id', row.id).select('id'))).toEqual([]);
    const marched = await world.playerA.db.rpc('force_march', { campaign: t.campaignId, group_no: 1, added: 1 });
    expect(marched.error).toBeNull();
    expect(JSON.stringify(marched.data)).not.toContain('The Sunken Causeway');
    expect((await ok(march(world.playerA, t, (await loadTravelGroups(asDb(world.playerA), t.campaignId, t.expeditionId))!.get(1)!, 0))).pending).toMatchObject({ placeName: '', owed: 1 });
    expect(await reads(world.playerA, t)).not.toContain('The Sunken Causeway');
    // The GM still reads it, and the next morning the group arrives there.
    expect((await rowOf(t)).pending).toMatchObject({ placeName: 'The Sunken Causeway', owed: 1 });
    await ok(start(t, 1, 1, 6));
    expect(await placeOf(t)).toBe('The Sunken Causeway');
    expect(must(await world.gm.db.from('travel_group_secrets').select('pending_place_name, pending_place_id').eq('id', row.id).single())).toEqual({ pending_place_name: null, pending_place_id: null });
  });

  // Purpose: a place from a pack, picked by its id (the copy #528 added). A member of the group reads neither the GM's
  // name for it nor its players' name while it hasn't been shown to them; once a piece of it has been shown to the
  // group, a later Move… toward it gives them its players' name, and still never the GM's.
  it("a group member can't read the GM's name for a pack's place: nothing until it's shown, then the players' name", async () => {
    const t = await freshTrail();
    const mill = must(
      await world.admin
        .from('places')
        .insert({ campaign_id: t.campaignId, name: 'Cellar of the Bog Lurker', players_name: 'The old mill', pack_id: crypto.randomUUID(), pack_entry_id: 'old-mill', pack_type: 'site' })
        .select('id')
        .single(),
    ) as { id: string };
    const toMill = (row: TravelGroup, cost: number) => as(world.gm, travelMove, { campaignId: t.campaignId, row, cost, terrainId: 'bog', routeId: null, placeName: null, placeId: mill.id });
    let row = await ok(start(t, 1, 0, 4));
    row = await ok(toMill(row, 6));
    // The GM: the place by its own name and its id.
    expect(row.pending).toMatchObject({ placeName: 'Cellar of the Bog Lurker', placeId: mill.id, owed: 2 });
    expect((await rowOf(t)).pending).toMatchObject({ placeName: 'Cellar of the Bog Lurker', placeId: mill.id });
    // A member of the group, before anything of the place is shown: no name of either kind, no place.
    const before = must(await world.playerA.db.from('travel_groups').select('pending_owed, pending_place_name, pending_place_id').eq('id', row.id).single());
    expect(before).toEqual({ pending_owed: 2, pending_place_name: null, pending_place_id: null });
    const unseen = await reads(world.playerA, t);
    expect(unseen).not.toContain('Cellar of the Bog Lurker');
    expect(unseen).not.toContain('The old mill');
    expect(unseen).not.toContain(mill.id);
    // The group arrives; the GM shows a piece of the place; the group moves on, then turns back with points owed.
    row = await ok(start(t, 1, 1, 6));
    const visit = must(await world.admin.from('group_places').select('id').eq('campaign_id', t.campaignId).eq('place_id', mill.id).eq('undone', false).eq('moved_on', false).single()) as { id: string };
    const piece = must(await world.gm.db.rpc('add_place_piece', { place: mill.id, kind: 'description', body: 'A wheel that turns with no water' })) as { id: string };
    must(await world.gm.db.rpc('show_place_piece', { visit: visit.id, piece: piece.id, show_it: true }));
    row = await ok(move(t, row, 1, null, 'moor'));
    row = await ok(toMill(row, 9));
    expect(row.pending).toMatchObject({ placeName: 'Cellar of the Bog Lurker', placeId: mill.id, owed: 6 });
    // Shown to them: the players' name, and still never the GM's (in the row, the GM's part or the log).
    const after = must(await world.playerA.db.from('travel_groups').select('pending_owed, pending_place_name, pending_place_id').eq('id', row.id).single());
    expect(after).toEqual({ pending_owed: 6, pending_place_name: 'The old mill', pending_place_id: null });
    expect((await loadTravelGroups(asDb(world.playerA), t.campaignId, t.expeditionId))!.get(1)!.pending).toMatchObject({ placeName: 'The old mill', placeId: null, owed: 6 });
    expect(await reads(world.playerA, t)).not.toContain('Cellar of the Bog Lurker');
  });

  // Purpose: the GM's Undo of a Move… puts the GM's part of the row back with the rest (the earlier place owed again).
  it("Undo of a Move… puts back the GM's part of the row too", async () => {
    const t = await freshTrail();
    let row = await ok(start(t, 1, 0, 4));
    row = await ok(move(t, row, 6, 'The Sunken Causeway'));
    row = await ok(move(t, row, 3, 'The Drowned Mill'));
    expect(row.pending).toMatchObject({ placeName: 'The Drowned Mill', owed: 3 });
    const moved = must(await world.admin.from('events').select('id').eq('campaign_id', t.campaignId).eq('target_table', 'travel_groups').eq('type', 'travel.move').order('seq', { ascending: false }).limit(1))[0]!.id as string;
    await ok(as(world.gm, undoChange, { campaignId: t.campaignId, eventId: moved, authorUserId: world.gm.id }));
    expect((await rowOf(t)).pending).toMatchObject({ placeName: 'The Sunken Causeway', owed: 2 });
  });

  // Purpose: a travel line written before this change holds the GM's own name for the place in the travel row's
  // values. Undoing it now would put that name back where the group's players read it, so such an Undo is refused
  // whole and the row stays as it is.
  it("an older line's Undo can't put the GM's name back where the group's players read it", async () => {
    const t = await freshTrail();
    const row = await ok(start(t, 1, 0, 4));
    // An arrival as it was logged before: the name in the travel row's own line, and no line for the GM's part.
    const old = must(
      await world.admin
        .from('events')
        .insert({
          campaign_id: t.campaignId, type: 'travel.dayStart', level: 'simple', actor_user_id: world.gm.id, audience: 'gm', target_table: 'travel_groups', target_id: row.id,
          before: { pending_place_name: 'The Drowned Mill', pending_terrain_id: 'fen', pending_owed: 2 },
          after: { pending_place_name: null, pending_terrain_id: null, pending_owed: null },
          request_id: crypto.randomUUID(),
        })
        .select('id')
        .single(),
    ) as { id: string };
    const undone = await as(world.gm, undoChange, { campaignId: t.campaignId, eventId: old.id, authorUserId: world.gm.id });
    expect(undone).toMatchObject({ ok: false, message: "That can't be undone." });
    expect(must(await world.playerA.db.from('travel_groups').select('pending_owed, pending_place_name').eq('id', row.id).single())).toEqual({ pending_owed: null, pending_place_name: null });
  });

  // Purpose (the #528 look-back's nit): a place picked by its id and undone before the group gets there is no place:
  // the group arrives somewhere unnamed, never at the undone place.
  it('a place undone before the group arrives is no place: the group arrives somewhere unnamed', async () => {
    const t = await freshTrail();
    const stones = must(await world.admin.from('places').insert({ campaign_id: t.campaignId, name: 'The Heron Stones' }).select('id').single()) as { id: string };
    let row = await ok(start(t, 1, 0, 4));
    row = await ok(as(world.gm, travelMove, { campaignId: t.campaignId, row, cost: 6, terrainId: 'bog', routeId: null, placeName: null, placeId: stones.id }));
    expect(row.pending).toMatchObject({ placeId: stones.id, owed: 2 });
    must(await world.admin.from('places').update({ undone: true }).eq('id', stones.id).select('id'));
    row = await ok(start(t, 1, 1, 6));
    expect(row.pending).toBeNull();
    const here = must(await world.admin.from('group_places').select('place_id').eq('campaign_id', t.campaignId).eq('group_number', 1).eq('undone', false).eq('moved_on', false).single());
    expect(here.place_id).toBeNull();
    expect(await placeOf(t)).toBeNull();
  });
});
