// The stand-in database's travel lines (fm-1; supabase/migrations/20261111100000_fm1_group_log_audience.sql), called
// the way the app's commands call them. The journey tests click through the app on this stand-in, so it must hide
// what the database hides: a group's travel lines are read by the players who were in that group when the line was
// written, and the GM; the one who forced a march can undo it. The database's own proof is
// supabase/tests/fm1-group-log-audience.test.ts. Invented names only.
import { beforeEach, describe, expect, it } from 'vitest';
import { describeEntry, groupEntries, loadLog, loadLogNames } from '../core/events.ts';
import { encodeEventTag } from '../core/eventTags.ts';
import type { Db } from '../core/supabase.ts';
import { createFakeDb, type FakeWorld } from './fakeDb.ts';

let world: FakeWorld;
let gm: string;
let sam: string;
let jo: string;
let nell: string;
let campaign: string;
let reed: string;
let moss: string;

type Row = Record<string, unknown>;
type Result = { data: Row | Row[] | null; error: { message: string; code?: string } | null };

/** One command's request, as the person signed in: a tag with its own request id. */
const send = async (name: string, args: Row, type: string) => {
  const tag = encodeEventTag({ type, level: 'simple', requestId: crypto.randomUUID() });
  return (await world.db.rpc(name as never, args as never).setHeader('x-grimoire-command', tag)) as unknown as Result;
};
const as = async (who: string, name: string, args: Row, type: string) => {
  world.signInAs(who);
  const result = await send(name, args, type);
  return result;
};
const done = async (call: Promise<Result>) => {
  const result = await call;
  if (result.error) throw new Error(result.error.message);
  return result.data as Row;
};
/** The travel lines a person reads for a group's row, oldest first, by command. */
const linesOf = async (who: string, rowId: unknown) => {
  world.signInAs(who);
  const { data } = (await world.db.from('events').select('*').eq('campaign_id', campaign).eq('target_table', 'travel_groups').eq('target_id', String(rowId))) as unknown as { data: Row[] | null };
  return (data ?? []).sort((a, b) => Number(a.seq) - Number(b.seq)).map((e) => String(e.type));
};
const rowOf = (group: number) => world.tables.travel_groups.find((t) => t.group_number === group && !t.undone)!;
const startDay = (group: number, total: number) => done(as(gm, 'start_travel_day', { campaign, group_no: group, day: 0, total, pace: 'foot', gm_per_day: null }, 'travel.dayStart'));
const move = (group: number, cost: number, place: string | null) =>
  done(as(gm, 'travel_move', { campaign, group_no: group, cost, terrain_id: 'bog', route_id: null, place_name: place, place_id: null, seen_version: null }, 'travel.move'));
const setBudget = (group: number, total: number) => done(as(gm, 'set_travel_budget', { campaign, group_no: group, total, pace: 'foot', gm_per_day: total, seen_version: null }, 'travel.setBudget'));
const march = (who: string, group: number, added: number) => as(who, 'force_march', { campaign, group_no: group, added, seen_version: null }, 'travel.forceMarch');
const goTo = (who: string, actor: string, group: number | null) => done(as(who, 'choose_party_group', { actor, to_group: group ?? undefined }, 'party.chooseGroup'));
const undo = (who: string, event: Row) => as(who, 'undo_request_said', { event_id: event.id }, 'event.undo');
const marchLine = () => world.tables.events.filter((e) => e.type === 'travel.forceMarch' && e.target_table === 'travel_groups').sort((a, b) => Number(b.seq) - Number(a.seq))[0]!;

beforeEach(async () => {
  world = createFakeDb();
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  jo = world.addPerson('jo@lantern.example', 'Jo');
  nell = world.addPerson('nell@lantern.example', 'Nell');
  campaign = world.addCampaign('The Fen Crossing', gm);
  reed = world.addCharacter(campaign, 'Reed', { ownerId: sam });
  moss = world.addCharacter(campaign, 'Moss', { ownerId: jo });
  world.addMember(campaign, sam, 'player', reed);
  world.addMember(campaign, jo, 'player', moss);
  // Nell is in the campaign with no character: in no group.
  world.addMember(campaign, nell, 'player');
  await done(as(gm, 'start_expedition', { campaign, mode_id: 'trek' }, 'expedition.start'));
});

describe("a group's travel lines (fm-1)", () => {
  // Purpose: hidden means hidden in a split party. A group's players read their group's lines; a player of another
  // group and a member with no character read none of them, payload included; the GM reads all.
  it("are read by the group's players and the GM, and by nobody else", async () => {
    const mossGroup = Number((await goTo(jo, moss, null)).group_number);
    await startDay(1, 5);
    await startDay(mossGroup, 6);
    await move(1, 7, 'The Sunken Causeway');
    await setBudget(1, 6);
    const reeds = rowOf(1).id;
    const mosses = rowOf(mossGroup).id;
    expect(await linesOf(sam, reeds)).toEqual(['travel.dayStart', 'travel.move', 'travel.setBudget']);
    expect(await linesOf(sam, mosses)).toEqual([]);
    expect(await linesOf(jo, mosses)).toEqual(['travel.dayStart']);
    expect(await linesOf(jo, reeds)).toEqual([]);
    expect(await linesOf(nell, reeds)).toEqual([]);
    expect(await linesOf(nell, mosses)).toEqual([]);
    expect(await linesOf(gm, reeds)).toEqual(['travel.dayStart', 'travel.move', 'travel.setBudget']);
    expect(await linesOf(gm, mosses)).toEqual(['travel.dayStart']);
    // The stored row never reaches Jo: nothing Jo reads names the place Reed's group is entering.
    world.signInAs(jo);
    const all = ((await world.db.from('events').select('*').eq('campaign_id', campaign)) as unknown as { data: Row[] }).data;
    expect(JSON.stringify(all)).not.toContain('The Sunken Causeway');
    // Nor Sam, who is in the group: the place hasn't been shown to it, so the row Sam reads has no name and no place,
    // the GM's part of the row isn't Sam's to read, and Sam's lines hold neither.
    world.signInAs(sam);
    const sams = await Promise.all([
      world.db.from('travel_groups').select('*').eq('campaign_id', campaign),
      world.db.from('travel_group_secrets').select('*').eq('campaign_id', campaign),
      world.db.from('events').select('*').eq('campaign_id', campaign),
    ]);
    expect(JSON.stringify(sams.map((read) => read.data))).not.toContain('The Sunken Causeway');
    expect((sams[0].data as Row[]).map((row) => [row.pending_owed, row.pending_place_name, row.pending_place_id])).toEqual([[2, null, null]]);
    expect(sams[1].data).toEqual([]);
    // The GM still reads it: in the GM's part of the row.
    world.signInAs(gm);
    const gms = ((await world.db.from('travel_group_secrets').select('*').eq('id', String(reeds))) as unknown as { data: Row[] }).data;
    expect(gms.map((row) => row.pending_place_name)).toEqual(['The Sunken Causeway']);
    // Each line keeps its group and who was in it then.
    const kept = world.tables.events.filter((e) => e.target_table === 'travel_groups').map((e) => [e.audience, e.group_number, e.group_user_ids]);
    expect(kept).toEqual([['group', 1, [sam]], ['group', mossGroup, [jo]], ['group', 1, [sam]], ['group', 1, [sam]]]);
  });

  // Purpose: "everyone who was there". A line is read by the players in the group when it was written: one who joins
  // later doesn't read the earlier lines, one who leaves keeps the lines of their time, and a later split that is
  // given the same group number doesn't read the earlier group's lines.
  it('are read by those who were in the group when the line was written, whatever the groups are now', async () => {
    await startDay(1, 8);
    const party = rowOf(1).id;
    const mossGroup = Number((await goTo(jo, moss, null)).group_number);
    await move(1, 3, null);
    await startDay(mossGroup, 6);
    const second = rowOf(mossGroup).id;
    // Jo left the party: keeps the morning's line, reads nothing written after.
    expect(await linesOf(jo, party)).toEqual(['travel.dayStart']);
    expect(await linesOf(sam, party)).toEqual(['travel.dayStart', 'travel.move']);
    // Jo comes back; the GM sets the party's budget: Jo reads that, and still not the move made while away.
    await goTo(jo, moss, 1);
    await setBudget(1, 9);
    expect(await linesOf(jo, party)).toEqual(['travel.dayStart', 'travel.setBudget']);
    // Sam splits off and is given the same number Jo's group had: its earlier lines are not Sam's to read.
    expect(Number((await goTo(sam, reed, null)).group_number)).toBe(mossGroup);
    await setBudget(mossGroup, 7);
    expect(await linesOf(sam, second)).toEqual(['travel.setBudget']);
    expect(await linesOf(jo, second)).toEqual(['travel.dayStart']);
  });

  // Purpose: only the travel commands' own lines are the group's. An activity's cost on the same row stays the GM's
  // line, as before (a secret activity's cost must not show in another player's log).
  it("leave another command's change to the travel row with the GM", async () => {
    await startDay(1, 8);
    await done(as(sam, 'apply_activity', { campaign, group_no: 1, activity_id: 'gather-reeds', activity_name: 'Gather reeds', actors: [reed], finder: reed, rolls: [], outcome: 'done', spend: 1 }, 'activity.apply'));
    const cost = world.tables.events.find((e) => e.target_table === 'travel_groups' && e.type === 'activity.apply')!;
    expect(cost).toMatchObject({ audience: 'gm', group_number: null, group_user_ids: null });
    expect(await linesOf(jo, rowOf(1).id)).toEqual(['travel.dayStart']);
  });

  // Purpose: a note added to a group's line is read by that line's readers and the GM, like any note on a log line.
  it("carry their readers to a note added to them", async () => {
    const mossGroup = Number((await goTo(jo, moss, null)).group_number);
    await startDay(1, 8);
    await startDay(mossGroup, 6);
    const line = world.tables.events.find((e) => e.target_table === 'travel_groups' && e.group_number === 1)!;
    world.signInAs(sam);
    await world.db.from('notes').insert({ campaign_id: campaign, text: 'We leave by the heron stones', annotates_event_id: String(line.id) } as never);
    expect(world.tables.notes[0]).toMatchObject({ audience: 'group', group_user_ids: [sam] });
    const notesFor = async (who: string) => {
      world.signInAs(who);
      return ((await world.db.from('notes').select('*').eq('campaign_id', campaign)) as unknown as { data: Row[] }).data.map((n) => n.text);
    };
    expect(await notesFor(sam)).toEqual(['We leave by the heron stones']);
    expect(await notesFor(jo)).toEqual([]);
    expect(await notesFor(gm)).toEqual(['We leave by the heron stones']);
  });
});

describe("a travel line's words for the place being entered (fm-1)", () => {
  /** The newest Move… line as that person's log words it (their own names, loaded as the Log loads them). */
  const moveLineFor = async (who: string) => {
    world.signInAs(who);
    const db = world.db as unknown as Db;
    const [log, names] = await Promise.all([loadLog(db, campaign, { verbose: true }), loadLogNames(db, campaign, who)]);
    return describeEntry(groupEntries(log!.events).find((entry) => entry.main.type === 'travel.move')!, names);
  };

  // Purpose: a place's name waits for the GM's Show players. A player's line says "the next place" for a place not yet
  // shown to their group; once it has been shown, a later Move… toward it names it by the name players know it by,
  // never the GM's own; the earlier line stays as it was written; the GM's line always has the GM's name.
  it('names the place to a player only once it has been shown to their group, by the name players know; the GM always', async () => {
    await startDay(1, 4);
    await move(1, 6, 'The Sunken Causeway');
    expect(await moveLineFor(sam)).toBe('Priya moved the party on: 2 more tomorrow to enter the next place.');
    expect(await moveLineFor(gm)).toBe('You moved the party on: entering The Sunken Causeway, 2 more tomorrow.');
    // The next day pays what's owed: the group arrives. The GM gives the place its players' name and shows a piece.
    await done(as(gm, 'start_travel_day', { campaign, group_no: 1, day: 1, total: 6, pace: 'foot', gm_per_day: null }, 'travel.dayStart'));
    const place = world.tables.places.find((p) => p.name === 'The Sunken Causeway')!;
    place.players_name = 'The old causeway';
    const visit = world.tables.group_places.find((g) => g.place_id === place.id && !g.undone && !g.moved_on)!;
    const piece = await done(as(gm, 'add_place_piece', { place: place.id, kind: 'description', body: 'A drowned road of black stones' }, 'place.addPiece'));
    await done(as(gm, 'show_place_piece', { visit: visit.id, piece: piece.id, show_it: true }, 'place.showPiece'));
    // The party moves on, then turns back toward it with points owed.
    await move(1, 1, 'The Heron Stones');
    await move(1, 9, 'The Sunken Causeway');
    expect(rowOf(1)).toMatchObject({ pending_owed: 6, pending_place_name: 'The old causeway', pending_place_id: null });
    expect(await moveLineFor(sam)).toBe('Priya moved the party on: entering The old causeway, 6 more tomorrow.');
    expect(await moveLineFor(gm)).toBe('You moved the party on: entering The Sunken Causeway, 6 more tomorrow.');
    // Nothing Sam reads has the GM's own name for it, and the first line is as it was written.
    world.signInAs(sam);
    const lines = ((await world.db.from('events').select('*').eq('campaign_id', campaign).eq('target_table', 'travel_groups')) as unknown as { data: Row[] }).data;
    expect(JSON.stringify(lines)).not.toContain('The Sunken Causeway');
    const db = world.db as unknown as Db;
    const [log, names] = await Promise.all([loadLog(db, campaign, { verbose: true }), loadLogNames(db, campaign, sam)]);
    const moves = groupEntries(log!.events).filter((entry) => entry.main.type === 'travel.move');
    expect(describeEntry(moves[moves.length - 1]!, names)).toBe('Priya moved the party on: 2 more tomorrow to enter the next place.');
  });

  // Purpose (the #528 look-back): a place picked by its id and undone before the group arrives is no place: the group
  // arrives somewhere unnamed, not at the undone place.
  it('arrives somewhere unnamed when the place picked was undone before the group got there', async () => {
    await startDay(1, 4);
    await move(1, 1, 'The Heron Stones');
    const stones = world.tables.places.find((p) => p.name === 'The Heron Stones')!;
    await move(1, 1, 'The Moth Gallery');
    await done(as(gm, 'travel_move', { campaign, group_no: 1, cost: 6, terrain_id: 'bog', route_id: null, place_name: null, place_id: stones.id, seen_version: null }, 'travel.move'));
    expect(world.tables.travel_group_secrets.find((s) => s.id === rowOf(1).id)).toMatchObject({ pending_place_name: 'The Heron Stones', pending_place_id: stones.id });
    stones.undone = true;
    await done(as(gm, 'start_travel_day', { campaign, group_no: 1, day: 1, total: 6, pace: 'foot', gm_per_day: null }, 'travel.dayStart'));
    const here = world.tables.group_places.find((g) => g.group_number === 1 && !g.undone && !g.moved_on)!;
    expect(here.place_id).toBeNull();
  });
});

describe("a forced march's Undo (fm-1)", () => {
  // Purpose: the player who forced the march takes it back (the points, the forced count and the arrival it paid for);
  // another player of the same group reads the line but can't undo it.
  it('is for the player who marched, not for another player of the group', async () => {
    await startDay(1, 4);
    await move(1, 6, 'The Sunken Causeway');
    expect((await march(sam, 1, 3)).error).toBeNull();
    expect(rowOf(1)).toMatchObject({ total: 7, spent: 6, forced: 1, pending_owed: null });
    expect(await linesOf(jo, rowOf(1).id)).toContain('travel.forceMarch');
    const refused = await undo(jo, marchLine());
    expect(refused.error?.code).toBe('42501');
    expect((await undo(sam, marchLine())).error).toBeNull();
    expect(rowOf(1)).toMatchObject({ total: 4, spent: 4, forced: 0, pending_owed: 2, pending_place_name: null });
    expect(world.tables.travel_group_secrets.find((s) => s.id === rowOf(1).id)).toMatchObject({ pending_place_name: 'The Sunken Causeway' });
    // The undo's own line is the group's too.
    expect(await linesOf(sam, rowOf(1).id)).toContain('event.undo');
  });

  // Purpose: once the GM has spent the march's points, its Undo is refused with the reason, for the player and the GM
  // alike; with the later move undone first, it goes through.
  it('is refused with its reason once the points are spent, until the later move is undone', async () => {
    await startDay(1, 4);
    expect((await march(sam, 1, 2)).error).toBeNull();
    await move(1, 5, null);
    expect(rowOf(1)).toMatchObject({ total: 6, spent: 5, forced: 1 });
    expect((await undo(sam, marchLine())).error?.message).toBe("That's changed since. Undo the later change first.");
    expect((await undo(gm, marchLine())).error?.message).toBe("That's changed since. Undo the later change first.");
    expect(rowOf(1)).toMatchObject({ total: 6, forced: 1 });
    const moved = world.tables.events.find((e) => e.type === 'travel.move' && e.target_table === 'travel_groups')!;
    expect((await undo(gm, moved)).error).toBeNull();
    expect((await undo(sam, marchLine())).error).toBeNull();
    expect(rowOf(1)).toMatchObject({ total: 4, spent: 0, forced: 0 });
  });

  // Purpose: a player who has left the group since can no longer undo the march they made in it.
  it('is refused to a player who has left the group', async () => {
    await startDay(1, 4);
    expect((await march(sam, 1, 2)).error).toBeNull();
    await goTo(sam, reed, null);
    expect((await undo(sam, marchLine())).error?.code).toBe('42501');
    expect(rowOf(1)).toMatchObject({ total: 6, forced: 1 });
  });
});
