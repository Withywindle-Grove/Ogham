// M5b step 3, part 2: secret activities as requests and What we know (supabase/migrations/20261103140000_m5b_3_secret_requests.sql;
// ruled 2026-10-30, S4-3 and S4-4; Francis's ruling of 2026-11-03 on the plan's ⚑ 1). TEST project only; invented
// places and characters.
//   Hidden means hidden: a secret activity's request, its answer and its log lines reach only the asking player and
//   the GM — not another player of the same group, not one of another group, not an outsider.
//   The cost applies when the GM accepts (Yes): the points come off the group's budget today in the same request,
//   so the GM's one Undo puts the answer and the points back; No costs nothing; "all" takes what's left; a player
//   can't answer.
//   What we know: a player reads the places shown to their group (each with its shown pieces), not another group's,
//   and a piece hidden again drops out; an earlier expedition's places come folded, apart from this expedition's
//   (ruled 2026-11-03).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { latestChange, undoChange } from '../../src/core/undo.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { addPiece, hidePiece, loadGroupPlaces, loadShownPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { endExpedition, loadScene, startExpedition } from '../../src/modules/expedition/play.ts';
import { loadTravelGroups, startTravelDay } from '../../src/modules/expedition/travelPlay.ts';
import { answerRequest, loadRequests, sendRequest, type Request } from '../../src/modules/requests/requests.ts';
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

/** A fresh campaign: Reed (A's) and Moss (B's) in group 1, an expedition under way, a day of 8 points started. */
async function freshTrail() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Mist Road', created_by: world.gm.id }).select().single());
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
  const [reed, moss] = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select('id')) as { id: string }[];
  const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'wilderness', place: 'The Mist Road' }));
  await ok(as(world.gm, startTravelDay, { campaignId, group: 1, day: 0, total: 8, pace: 'foot' as const, gmPerDay: null }));
  return { campaignId, expeditionId: trip.id, reed: reed!.id, moss: moss!.id };
}

const spentOf = async (t: { campaignId: string; expeditionId: string }, group = 1) => (await loadTravelGroups(asDb(world.gm), t.campaignId, t.expeditionId))?.get(group)?.spent;

/** Reed asks for the secret activity "Scout ahead" with the cost given. */
const scout = (t: Awaited<ReturnType<typeof freshTrail>>, spend: number | 'all') =>
  ok(
    as(world.playerA, sendRequest, {
      character: { id: t.reed, campaignId: t.campaignId, ownerUserId: world.playerA.id },
      kind: 'secretActivity' as const,
      text: 'Scout ahead',
      costText: spend === 'all' ? "All of today's leagues" : `${spend} points`,
      prompt: { activityId: 'scout-ahead', group: 1, actorIds: [t.reed], spend },
    }),
  );

const yes = { kind: 'yesNo' as const, yes: true, turns: 0, note: 'The mist thins to the north.' };
const no = { kind: 'yesNo' as const, yes: false, turns: 0, note: '' };

/** What this person reads of a request: its row, and its log lines (request.send, request.answer). */
async function readsOf(person: Person, request: Request) {
  const rows = must(await person.db.from('requests').select('id').eq('id', request.id));
  const lines = must(await person.db.from('events').select('type').eq('campaign_id', request.campaignId).eq('target_table', 'requests').eq('target_id', request.id));
  return { rows: rows.length, lines: lines.map((l) => String(l.type)).sort() };
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('secret activities as requests (S4-3)', () => {
  it("a secret activity's request, answer and log lines reach only the asking player and the GM", async () => {
    const t = await freshTrail();
    const request = await scout(t, 3);
    expect([request.kind, request.status, request.costText]).toEqual(['secretActivity', 'waiting', '3 points']);
    // Moss (player B) is in the same group as Reed: reads nothing of it. Nor does an outsider.
    expect(await readsOf(world.playerB, request)).toEqual({ rows: 0, lines: [] });
    expect(await readsOf(world.outsider, request)).toEqual({ rows: 0, lines: [] });
    // Nor once Moss is in another group.
    await ok(as(world.playerB, chooseGroup, { character: { id: t.moss, campaignId: t.campaignId, ownerUserId: world.playerB.id }, group: null }));
    expect(await readsOf(world.playerB, request)).toEqual({ rows: 0, lines: [] });
    // Reed and the GM read it.
    expect(await readsOf(world.playerA, request)).toEqual({ rows: 1, lines: ['request.send'] });
    expect(await readsOf(world.gm, request)).toEqual({ rows: 1, lines: ['request.send'] });

    // The GM accepts: the answer and the cost, in one request.
    const answered = await ok(as(world.gm, answerRequest, { request, answer: yes, activity: { spend: 3 } }));
    expect([answered.status, answered.answer]).toEqual(['answered', yes]);
    expect(await spentOf(t)).toBe(3);
    expect(await readsOf(world.playerB, request)).toEqual({ rows: 0, lines: [] });
    expect(await readsOf(world.playerA, request)).toEqual({ rows: 1, lines: ['request.answer', 'request.send'] });
    // The player reads the answer; the budget's own line is the GM's (m5b-1), the budget itself the group's.
    const mine = (await loadRequests(asDb(world.playerA), t.campaignId))?.find((r) => r.id === request.id);
    expect(mine?.answer).toEqual(yes);
    expect(must(await world.playerB.db.from('events').select('id').eq('campaign_id', t.campaignId).eq('target_table', 'travel_groups').eq('type', 'request.answer'))).toEqual([]);
    expect(must(await world.gm.db.from('events').select('id').eq('campaign_id', t.campaignId).eq('target_table', 'travel_groups').eq('type', 'request.answer')).length).toBe(1);
  });

  it("the GM's one Undo puts the answer and the points back; No costs nothing; all takes what's left; a player can't answer", async () => {
    const t = await freshTrail();
    const first = await scout(t, 3);
    await ok(as(world.gm, answerRequest, { request: first, answer: yes, activity: { spend: 3 } }));
    expect(await spentOf(t)).toBe(3);
    const eventId = await latestChange(asDb(world.gm), t.campaignId, 'request.answer', world.gm.id);
    expect(eventId).not.toBeNull();
    await ok(as(world.gm, undoChange, { campaignId: t.campaignId, eventId: eventId!, authorUserId: world.gm.id }));
    expect(await spentOf(t)).toBe(0);
    expect((await loadRequests(asDb(world.gm), t.campaignId, { waiting: true }))?.map((r) => r.id)).toContain(first.id);

    // No: nothing comes off.
    const again = (await loadRequests(asDb(world.gm), t.campaignId, { waiting: true }))!.find((r) => r.id === first.id)!;
    await ok(as(world.gm, answerRequest, { request: again, answer: no, activity: { spend: 3 } }));
    expect(await spentOf(t)).toBe(0);

    // All of today's points: what's left goes.
    const everything = await scout(t, 'all');
    await ok(as(world.gm, answerRequest, { request: everything, answer: yes, activity: { spend: 'all' } }));
    expect(await spentOf(t)).toBe(8);

    // A player can't answer, with or without a cost.
    const third = await scout(t, 2);
    expect((await as(world.playerA, answerRequest, { request: third, answer: yes, activity: { spend: 2 } })).ok).toBe(false);
    expect((await as(world.playerB, answerRequest, { request: third, answer: yes })).ok).toBe(false);
    expect(await spentOf(t)).toBe(8);
  });
});

describe('What we know (S4-4)', () => {
  it("a player reads the places shown to their group on this expedition, not another group's, and a piece hidden again drops out", async () => {
    const t = await freshTrail();
    // Moss goes to a group of their own; group 1 (Reed) is shown a piece of The Drowned Stair.
    const mossGroup = await ok(as(world.playerB, chooseGroup, { character: { id: t.moss, campaignId: t.campaignId, ownerUserId: world.playerB.id }, group: null }));
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Drowned Stair' }));
    let rows = (await loadGroupPlaces(asDb(world.gm), t.campaignId, t.expeditionId))!;
    const stair = rows.get(1)!;
    const stairPiece = await ok(as(world.gm, addPiece, { campaignId: t.campaignId, placeId: stair.placeId!, kind: 'description', text: 'Black water laps at the steps.' }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row: stair, piece: { id: stairPiece } }));
    const none = { current: [], earlier: [] };
    expect(await loadShownPlaces(asDb(world.playerA), t.campaignId)).toEqual({ current: [{ placeId: stair.placeId, name: 'The Drowned Stair', pieces: [{ id: stairPiece, kind: 'description', text: 'Black water laps at the steps.' }] }], earlier: [] });
    expect(await loadShownPlaces(asDb(world.playerB), t.campaignId)).toEqual(none);
    expect(await loadShownPlaces(asDb(world.outsider), t.campaignId)).toEqual(none);

    // Group 1 goes on to the Moth Gallery and is shown a piece there: both places are known. Moss's group knows nothing.
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Moth Gallery' }));
    rows = (await loadGroupPlaces(asDb(world.gm), t.campaignId, t.expeditionId))!;
    const gallery = rows.get(1)!;
    const galleryPiece = await ok(as(world.gm, addPiece, { campaignId: t.campaignId, placeId: gallery.placeId!, kind: 'clue', text: 'Wings everywhere, none alive.' }));
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row: gallery, piece: { id: galleryPiece } }));
    expect((await loadShownPlaces(asDb(world.playerA), t.campaignId))?.current.map((p) => [p.name, p.pieces.length])).toEqual([
      ['The Drowned Stair', 1],
      ['The Moth Gallery', 1],
    ]);
    expect(await loadShownPlaces(asDb(world.playerB), t.campaignId)).toEqual(none);
    expect(mossGroup).not.toBe(1);

    // The gallery's piece hidden again: that place drops out of what they know (a past visit's shows stay as they
    // were: the database refuses hiding on a visit the group has moved on from).
    await ok(as(world.gm, hidePiece, { campaignId: t.campaignId, row: gallery, piece: { id: galleryPiece } }));
    expect((await loadShownPlaces(asDb(world.playerA), t.campaignId))?.current.map((p) => p.name)).toEqual(['The Drowned Stair']);
    expect((await as(world.gm, hidePiece, { campaignId: t.campaignId, row: stair, piece: { id: stairPiece } })).ok).toBe(false);

    // The expedition ends and a new one starts: the stair is an earlier expedition's (folded), nothing is current
    // until something is shown; a place shown again now leaves the fold. Moss's group still knows nothing.
    const scene = await loadScene(asDb(world.gm), t.campaignId);
    await ok(as(world.gm, endExpedition, { campaignId: t.campaignId, expedition: scene!.expedition! }));
    await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'wilderness', place: 'The Mist Road' }));
    expect((await loadShownPlaces(asDb(world.playerA), t.campaignId))).toEqual({ current: [], earlier: [{ placeId: stair.placeId, name: 'The Drowned Stair', pieces: [{ id: stairPiece, kind: 'description', text: 'Black water laps at the steps.' }] }] });
    await ok(as(world.gm, setPlace, { campaignId: t.campaignId, group: 1, name: 'The Drowned Stair' }));
    const back = (await loadGroupPlaces(asDb(world.gm), t.campaignId, (await loadScene(asDb(world.gm), t.campaignId))!.expedition!.id))!.get(1)!;
    expect(back.placeId).toBe(stair.placeId);
    await ok(as(world.gm, showPiece, { campaignId: t.campaignId, row: back, piece: { id: stairPiece } }));
    const now = await loadShownPlaces(asDb(world.playerA), t.campaignId);
    expect([now?.current.map((p) => p.name), now?.earlier]).toEqual([['The Drowned Stair'], []]);
    expect(await loadShownPlaces(asDb(world.playerB), t.campaignId)).toEqual(none);
  });
});
