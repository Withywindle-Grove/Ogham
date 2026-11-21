// The M5 review fixes (supabase/migrations/20261101120000_m5_review_fixes.sql; docs/plans/m5-review-fixes.md): the
// fresh-session review's holes, each pinned. TEST project only; invented places, weather and characters.
//   1. A player in one place can't move their character (or hireling) into a group that's somewhere else, and never
//      sees that group's place.
//   2. A player enters only the weather that's due now (the step the database works out), never another period; a
//      player who undid their entry can't enter that step again, the GM can.
//   3. A player can't rewrite their status's end or name straight to the table; the status commands still work.
//   4. The GM can withdraw an escape-roll ask; a player can't.
//   5. A player's note on a log line they can't read is refused with the same words as a made-up entry.
//   7. A player's own split, undone, leaves no live place row for the group they left again.
//   8. A message, or a place shown to one group, never reaches a player outside that group.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { addNote } from '../../src/core/notes.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { chooseGroup, joinUp } from '../../src/modules/expedition/groupPlay.ts';
import { addPiece, loadGroupPlaces, loadScenePlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { addStatus, removeStatus, stepStatus, type NewStatus } from '../../src/modules/expedition/statusPlay.ts';
import { enterWeather, loadWeather } from '../../src/modules/expedition/weatherPlay.ts';
import { askRequests, withdrawRequest } from '../../src/modules/requests/requests.ts';
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

const DAY = 86_400;
let packId = '';

beforeAll(async () => {
  world = await buildWorld();
  // A weather pack, as in m5b-weather-roll.test.ts: one weather table, rolled once a day (the default).
  packId = must(await world.admin.from('packs').insert({ owner_user_id: world.gm.id, name: 'Marsh weather' }).select('id').single()).id as string;
  must(
    await world.admin
      .from('library_entries')
      .insert([
        { pack_id: packId, kind: 'rulesSet', pack_entry_id: 'marsh-weather', name: 'Marsh weather', data: { id: 'marsh-weather', name: 'Marsh weather', weather: { tables: { any: 'marsh-sky' } } } },
        {
          pack_id: packId,
          kind: 'table',
          pack_entry_id: 'marsh-sky',
          name: 'Marsh sky',
          data: { id: 'marsh-sky', name: 'Marsh sky', die: 'd6', rows: [{ min: 1, max: 2, result: 'Drizzle' }, { min: 3, max: 4, result: 'Mist' }, { min: 5, max: 6, result: 'Clear' }] },
        },
      ])
      .select('id'),
  );
}, 300_000);

afterAll(async () => {
  if (packId) await world.admin.from('packs').delete().eq('id', packId);
  await tearDownWorld(world);
}, 60_000);

/** A fresh campaign: Reed (player A's) with A's hireling Bree, and Moss (player B's); the weather pack when asked. */
async function freshTable(withWeather = false) {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Lantern Warrens', created_by: world.gm.id }).select().single());
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
  if (withWeather) must(await world.admin.from('campaign_packs').insert({ campaign_id: campaign.id, pack_id: packId, option_choices: {}, priority: 1 }).select());
  const pc = (name: string, owner: Person, kind = 'pc') => ({ campaign_id: campaign.id, kind, name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [reed, moss, bree] = must(
    await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB), pc('Bree the Lantern Bearer', world.playerA, 'hireling')]).select('id'),
  ) as { id: string }[];
  const ref = (id: string, owner: Person) => ({ id, campaignId: campaign.id as string, ownerUserId: owner.id });
  return { campaignId: campaign.id as string, reed: ref(reed!.id, world.playerA), moss: ref(moss!.id, world.playerB), bree: ref(bree!.id, world.playerA) };
}

const groupOf = async (actorId: string) => Number(must(await world.admin.from('party_group_members').select('group_number').eq('actor_id', actorId).single()).group_number);
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const placesSeen = async (person: Person, campaignId: string) => must(await person.db.from('places').select('name').eq('campaign_id', campaignId)).map((p) => p.name as string);
// Shows a group its place the M5b g2 way: a description piece, shown to that group (the place row itself is the GM's).
const showAPiece = async (campaignId: string, expeditionId: string, group: number) => {
  const row = (await loadGroupPlaces(asDb(world.gm), campaignId, expeditionId))!.get(group)!;
  const pieceId = await ok(as(world.gm, addPiece, { campaignId, placeId: row.place!.id, kind: 'description', text: 'Damp stone underfoot.' }));
  await ok(as(world.gm, showPiece, { campaignId, row, piece: { id: pieceId } }));
};
const scenesSeen = async (person: Person, campaignId: string) => [...((await loadScenePlaces(asDb(person), campaignId))?.values() ?? [])].map((p) => p.name);
const weatherEntry = (campaignId: string, expeditionId: string, roll: string, period = 0, startsAt = 0) => ({ campaignId, expeditionId, period, startsAt, tableId: 'marsh-sky', roll, rolledBy: 'players' as const });
const typed = (name: string): NewStatus => ({ name, condition: null, timer: null, secret: false });

describe('1. a player joins only a group in the same place', () => {
  it("a player in group 1 can't move into group 2 while it's in another place, and never sees group 2's place; once the groups meet they can", async () => {
    const t = await freshTable();
    const trip = await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Long Barrow' }));
    const mossGroup = await ok(as(world.gm, chooseGroup, { character: t.moss, group: null }));
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: mossGroup, name: 'The Bone Stair' }));
    await showAPiece(t.campaignId, trip.id, mossGroup);

    // Reed (and Bree, the hireling) can't follow Moss into the Bone Stair from the Long Barrow.
    const refused = await as(world.playerA, chooseGroup, { character: t.reed, group: mossGroup });
    expect(refused.ok).toBe(false);
    const direct = await world.playerA.db.rpc('choose_party_group', { actor: t.reed.id, to_group: mossGroup });
    expect([direct.error?.code, direct.error?.message]).toEqual(['42501', "Only the GM moves someone into a group that's in another place."]);
    expect((await world.playerA.db.rpc('choose_party_group', { actor: t.bree.id, to_group: mossGroup })).error?.code).toBe('42501');
    expect([await groupOf(t.reed.id), await groupOf(t.bree.id)]).toEqual([1, 1]);
    // Group 2's shown place never reached player A.
    expect(await placesSeen(world.playerA, t.campaignId)).toEqual([]);
    expect(await scenesSeen(world.playerA, t.campaignId)).toEqual([]);
    expect(must(await world.playerA.db.from('group_places').select('group_number').eq('campaign_id', t.campaignId).eq('group_number', mossGroup))).toEqual([]);
    // Nor can Moss come back to the party from there; the GM can move anyone anywhere.
    expect((await as(world.playerB, chooseGroup, { character: t.moss, group: 1 })).ok).toBe(false);
    // The party catches up with Moss: now Reed can join group 2 (Bree comes too), and everyone is the party again.
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Bone Stair' }));
    expect(await ok(as(world.playerA, chooseGroup, { character: t.reed, group: mossGroup }))).toBe(1);
    expect([await groupOf(t.reed.id), await groupOf(t.bree.id), await groupOf(t.moss.id)]).toEqual([1, 1, 1]);
  });
});

describe("2. only the weather that's due now", () => {
  /** A campaign with the weather pack and a day-by-day expedition under way (the clock at 0). */
  async function freshTrip() {
    const t = await freshTable(true);
    const expedition = must(await world.admin.from('expeditions').insert({ campaign_id: t.campaignId, mode: 'wilderness' }).select().single());
    return { ...t, expeditionId: expedition.id as string };
  }

  it("a player's weather entry for any period but the current one is refused, and returns no result", async () => {
    const t = await freshTrip();
    const later = await as(world.playerA, enterWeather, weatherEntry(t.campaignId, t.expeditionId, '3', 1, DAY));
    expect(later).toMatchObject({ ok: false, message: "That isn't the weather that's due. Enter today's." });
    expect(must(await world.admin.from('weather_rolls').select('id').eq('expedition_id', t.expeditionId))).toEqual([]);
    // Today's is fine, and its start is the database's, whatever the device sent.
    const today = await ok(as(world.playerA, enterWeather, weatherEntry(t.campaignId, t.expeditionId, '3', 0, 999)));
    expect([today.period, today.startsAt, today.result]).toEqual([0, 0, 'Mist']);
    // A day on, the next step is due (and the one after it isn't).
    expect((await world.gm.db.rpc('set_clock', { campaign: t.campaignId, to_seconds: DAY })).error).toBeNull();
    expect((await as(world.playerB, enterWeather, weatherEntry(t.campaignId, t.expeditionId, '1', 2, 2 * DAY))).ok).toBe(false);
    const tomorrow = await ok(as(world.playerB, enterWeather, weatherEntry(t.campaignId, t.expeditionId, '1', 1, 0)));
    expect([tomorrow.period, tomorrow.startsAt, tomorrow.result]).toEqual([1, DAY, 'Drizzle']);
    expect((await loadWeather(asDb(world.playerA), t.expeditionId, 1))?.result).toBe('Drizzle');
  });

  it("after undoing their entry, a player can't enter that period again; the GM can", async () => {
    const t = await freshTrip();
    await ok(as(world.playerA, enterWeather, weatherEntry(t.campaignId, t.expeditionId, '6')));
    await ok(undo(world.playerA, t.campaignId, await latestEvent(t.campaignId, 'weather.enter')));
    expect(await loadWeather(asDb(world.playerA), t.expeditionId, 0)).toBeNull();
    const again = await as(world.playerA, enterWeather, weatherEntry(t.campaignId, t.expeditionId, '1'));
    expect(again).toMatchObject({ ok: false, message: 'You undid the weather for this step. The GM enters it now.' });
    expect(must(await world.admin.from('weather_rolls').select('undone').eq('expedition_id', t.expeditionId))).toEqual([{ undone: true }]);
    const gm = await ok(as(world.gm, enterWeather, weatherEntry(t.campaignId, t.expeditionId, '1')));
    expect(gm.result).toBe('Drizzle');
  });
});

describe('3. a status changes only through its commands', () => {
  it("a player's direct update of their own status's end or name is refused; the commands still work", async () => {
    const t = await freshTable();
    const [made] = await ok(as(world.gm, addStatus, { target: { campaignId: t.campaignId, characters: [t.reed], secret: false }, status: typed('Muddy boots') }));
    for (const change of [{ name: 'Clean boots' }, { ended_at: 0, end_reason: 'removed' }, { undone: true }, { stacks: 5 }, { ends_at: 600, total_seconds: 600 }]) {
      const direct = await world.playerA.db.from('character_statuses').update(change).eq('id', made!.id).select('id');
      expect([change, direct.error?.message]).toEqual([change, "That can't be changed."]);
    }
    // The commands: step a status with levels up, remove the typed one.
    const levels = [{ id: 'damp', name: 'Damp' }, { id: 'soaked', name: 'Soaked' }];
    const [tiered] = await ok(
      as(world.gm, addStatus, {
        target: { campaignId: t.campaignId, characters: [t.reed], secret: false },
        status: { name: 'Wet', condition: { id: 'wet', name: 'Wet', icon: null, stacks: false, levels, defaultRounds: null, note: null }, timer: null, secret: false },
      }),
    );
    expect((await ok(as(world.playerA, stepStatus, { character: t.reed, status: tiered!, step: 1 }))).level).toBe(1);
    const removed = await ok(as(world.playerA, removeStatus, { character: t.reed, status: made! }));
    expect(removed.endedAt).not.toBeNull();
    // Undo of the remove puts it back (an undo is never a direct rewrite).
    await ok(undo(world.playerA, t.campaignId, await latestEvent(t.campaignId, 'status.remove')));
    expect(must(await world.admin.from('character_statuses').select('ended_at').eq('id', made!.id).single()).ended_at).toBeNull();
    // The GM may still write straight to the row (a correction).
    expect(must(await world.gm.db.from('character_statuses').update({ name: 'Muddier boots' }).eq('id', made!.id).select('name'))).toEqual([{ name: 'Muddier boots' }]);
  });
});

describe('4. the GM takes back what the GM asked', () => {
  it("the GM can withdraw an escape-roll ask; a player can't", async () => {
    const t = await freshTable();
    await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon' }));
    const prompt = { roll: { save: 'breath' }, modifiers: [], depth: 0, levelsDown: 1 };
    const asked = await ok(as(world.gm, askRequests, { campaignId: t.campaignId, kind: 'escapeRoll', who: 'each', prompt }));
    const reeds = asked.find((r) => r.actorId === t.reed.id)!;
    const mosses = asked.find((r) => r.actorId === t.moss.id)!;
    expect((await as(world.playerB, withdrawRequest, { request: mosses })).ok).toBe(false);
    expect((await world.playerB.db.rpc('withdraw_request', { request: mosses.id })).error?.message).toBe('Only the GM takes back what the GM asked.');
    const taken = await ok(as(world.gm, withdrawRequest, { request: reeds }));
    expect(taken.status).toBe('withdrawn');
    expect(must(await world.admin.from('requests').select('status').eq('id', reeds.id).single()).status).toBe('withdrawn');
    // The GM still can't take back a player's own request (03).
    expect(must(await world.admin.from('requests').select('status').eq('id', mosses.id).single()).status).toBe('waiting');
  });
});

describe('5. a note only on a log line the writer can read', () => {
  it("a player's note on a GM-only log line is refused with the same message as a made-up event id", async () => {
    const t = await freshTable();
    await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Drowned Stair' }));
    // Where now? is the GM's line: player A never reads it.
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Moth Gallery' }));
    const gmLine = await latestEvent(t.campaignId, 'place.set');
    expect(must(await world.playerA.db.from('events').select('id').eq('id', gmLine))).toEqual([]);
    const onHidden = await as(world.playerA, addNote, { campaignId: t.campaignId, text: 'What was that?', annotatesEventId: gmLine });
    const onNothing = await as(world.playerA, addNote, { campaignId: t.campaignId, text: 'What was that?', annotatesEventId: crypto.randomUUID() });
    const said = (result: typeof onHidden) => (result.ok ? 'saved' : [result.reason, result.message]);
    expect(said(onHidden)).not.toBe('saved');
    expect(said(onHidden)).toEqual(said(onNothing));
    expect(must(await world.admin.from('notes').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
    // The GM's note on their own line is fine.
    expect((await as(world.gm, addNote, { campaignId: t.campaignId, text: 'Moths everywhere.', annotatesEventId: gmLine })).ok).toBe(true);
  });
});

describe("7. a player's split, undone", () => {
  it('leaves no live place row for the group they left again', async () => {
    const t = await freshTable();
    const trip = await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Long Barrow' }));
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    expect((await loadGroupPlaces(asDb(world.gm), t.campaignId, trip.id))?.get(mossGroup)?.place?.name).toBe('The Long Barrow');
    await ok(undo(world.playerB, t.campaignId, await latestEvent(t.campaignId, 'party.chooseGroup')));
    expect(await groupOf(t.moss.id)).toBe(1);
    const live = must(await world.admin.from('group_places').select('group_number').eq('campaign_id', t.campaignId).eq('undone', false).eq('moved_on', false));
    expect(live.map((r) => r.group_number)).toEqual([1]);
    expect((await loadGroupPlaces(asDb(world.gm), t.campaignId, trip.id))?.has(mossGroup)).toBe(false);
  });
});

describe('8. a message or a shown place never reaches a player outside its group', () => {
  it("a message to Reed, and a place shown to group 1, never reach player B in group 2", async () => {
    const t = await freshTable();
    const trip = await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Salt Cellar' }));
    const mossGroup = await ok(as(world.gm, chooseGroup, { character: t.moss, group: null }));
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: mossGroup, name: 'The Echo Well' }));
    await showAPiece(t.campaignId, trip.id, 1);
    // The old Send (gm_messages) was replaced by Messaging (M5b g4): its rows stay, so the tables are still checked below.
    expect(await scenesSeen(world.playerA, t.campaignId)).toEqual(['The Salt Cellar']);
    expect(await scenesSeen(world.playerB, t.campaignId)).toEqual([]);
    expect(await placesSeen(world.playerB, t.campaignId)).toEqual([]);
    expect(must(await world.playerB.db.from('group_places').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
    expect(must(await world.playerB.db.from('group_place_signals').select('group_number').eq('campaign_id', t.campaignId))).toEqual([{ group_number: mossGroup }]);
    for (const table of ['gm_messages', 'message_recipients'] as const) {
      expect(must(await world.playerB.db.from(table).select('id').eq('campaign_id', t.campaignId))).toEqual([]);
    }
    // Join up still can't bridge the two places for a player (B1).
    expect((await as(world.playerB, joinUp, { campaignId: t.campaignId, together: true, from: mossGroup, into: 1 })).ok).toBe(false);
  });
});
