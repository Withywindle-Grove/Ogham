// M5 step 12: Requests (supabase/migrations/20261101090000_m5_requests.sql and 20261101091000_m5_requests_rules.sql;
// ruled 2026-10-31 Q6 and Q3, 2026-10-30 DG17 and DG18). TEST project only; invented characters and places.
//   Another player can't read my request, in the database (nor its log lines); the GM and I can.
//   Cancel works while it waits; after an answer it's refused, and a withdrawn one can't be answered.
//   Undo on the GM's answer puts it back to waiting and puts the clock back (a costed Describe…).
//   Escape rolls: one per player character (not hirelings) or one for the party, per `who`; each player reads only
//   their own (everyone the party's); the player enters the roll, nobody else; the GM's outcome at Send is what lands,
//   and nothing reaches the player before Send; Undo of Leave the dungeon takes the rolls back.
//   Leave the dungeon needs an expedition under way.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { answerRequest, askRequests, enterRequest, loadRequests, sendRequest, withdrawRequest } from '../../src/modules/requests/requests.ts';
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

/** A fresh campaign: Reed (player A's) with A's hireling Bree, and Moss (player B's). */
async function freshTable() {
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
  const pc = (name: string, owner: Person, kind = 'pc') => ({ campaign_id: campaign.id, kind, name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [reed, moss, bree] = must(
    await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB), pc('Bree the Lantern Bearer', world.playerA, 'hireling')]).select('id'),
  ) as { id: string }[];
  const ref = (id: string, owner: Person) => ({ id, campaignId: campaign.id as string, ownerUserId: owner.id });
  return { campaignId: campaign.id as string, reed: ref(reed!.id, world.playerA), moss: ref(moss!.id, world.playerB), bree: ref(bree!.id, world.playerA) };
}

const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const seenTypes = async (person: Person, campaignId: string) =>
  must(await person.db.from('events').select('type').eq('campaign_id', campaignId)).map((e) => e.type as string);
const clockAt = async (campaignId: string) => Number(must(await world.admin.from('campaign_clocks').select('seconds').eq('campaign_id', campaignId).single()).seconds);
const prompt = { roll: { save: 'breath' }, modifiers: [{ id: 'map', name: 'Has a map', value: 2 }], depth: -1, levelsDown: 1 };

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('a player asks, the GM answers (Q6, Q3)', () => {
  it("another player can't read my request, in the database, nor its log lines; the GM and I can", async () => {
    const t = await freshTable();
    const sent = await ok(as(world.playerA, sendRequest, { character: t.reed, kind: 'describe', text: '  Pry the idol loose.  ' }));
    expect([sent.status, sent.text, sent.direction, sent.requesterId]).toEqual(['waiting', 'Pry the idol loose.', 'playerAsks', world.playerA.id]);
    expect((await loadRequests(asDb(world.playerA), t.campaignId))?.map((r) => r.id)).toEqual([sent.id]);
    expect((await loadRequests(asDb(world.gm), t.campaignId))?.map((r) => r.id)).toEqual([sent.id]);
    expect(await loadRequests(asDb(world.playerB), t.campaignId)).toEqual([]);
    expect(must(await world.playerB.db.from('requests').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
    expect(await seenTypes(world.playerA, t.campaignId)).toContain('request.send');
    expect(await seenTypes(world.gm, t.campaignId)).toContain('request.send');
    expect(await seenTypes(world.playerB, t.campaignId)).not.toContain('request.send');
    // Not for someone else's character, and not for a hireling of mine that isn't a player character.
    expect((await world.playerB.db.rpc('send_request', { campaign: t.campaignId, actor: t.reed.id, kind: 'describe', body: 'Sneaky' })).error?.code).toBe('42501');
  });

  it("Cancel works while it waits; after an answer it's refused, and a withdrawn one can't be answered", async () => {
    const t = await freshTable();
    const first = await ok(as(world.playerA, sendRequest, { character: t.reed, kind: 'describe', text: 'Listen at the door.' }));
    const gone = await ok(as(world.playerA, withdrawRequest, { request: first }));
    expect(gone.status).toBe('withdrawn');
    expect((await loadRequests(asDb(world.gm), t.campaignId, { waiting: true }))).toEqual([]);
    const late = await as(world.gm, answerRequest, { request: gone, answer: { kind: 'yesNo', yes: true, turns: 0, note: '' } });
    expect(late.ok).toBe(false);

    const second = await ok(as(world.playerA, sendRequest, { character: t.reed, kind: 'describe', text: 'Climb the idol.' }));
    const answered = await ok(as(world.gm, answerRequest, { request: second, answer: { kind: 'yesNo', yes: false, turns: 0, note: 'Too slick.' } }));
    expect([answered.status, answered.answer]).toEqual(['answered', { kind: 'yesNo', yes: false, turns: 0, note: 'Too slick.' }]);
    const refused = await as(world.playerA, withdrawRequest, { request: answered });
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.message).toBe('The GM has answered it already.');
    // The answer reaches the requester's log, not the other player's.
    expect(await seenTypes(world.playerA, t.campaignId)).toContain('request.answer');
    expect(await seenTypes(world.playerB, t.campaignId)).not.toContain('request.answer');
  });

  it("Undo on the GM's answer puts it back to waiting and puts the clock back (a costed Describe…)", async () => {
    const t = await freshTable();
    await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon' }));
    const before = await clockAt(t.campaignId);
    const sent = await ok(as(world.playerA, sendRequest, { character: t.reed, kind: 'describe', text: 'Search the alcove.' }));
    const answered = await ok(as(world.gm, answerRequest, { request: sent, answer: { kind: 'yesNo', yes: true, turns: 2, note: 'Dusty.' }, costText: '2 turns', costSeconds: 1200 }));
    expect([answered.status, answered.costText]).toEqual(['answered', '2 turns']);
    expect(await clockAt(t.campaignId)).toBe(before + 1200);
    expect((await loadRequests(asDb(world.playerA), t.campaignId))?.[0]?.answer).toEqual({ kind: 'yesNo', yes: true, turns: 2, note: 'Dusty.' });
    await ok(undo(world.gm, t.campaignId, await latestEvent(t.campaignId, 'request.answer')));
    const back = (await loadRequests(asDb(world.playerA), t.campaignId))?.[0];
    expect([back?.status, back?.answer]).toEqual(['waiting', null]);
    expect(await clockAt(t.campaignId)).toBe(before);
  });

  it("a player's Undo of their send is refused once the GM has answered (the answer never disappears quietly)", async () => {
    const t = await freshTable();
    await ok(as(world.playerA, sendRequest, { character: t.reed, kind: 'describe', text: 'Lift the grate.' }));
    const sendEvent = await latestEvent(t.campaignId, 'request.send');
    const sent = (await loadRequests(asDb(world.playerA), t.campaignId))![0]!;
    await ok(as(world.gm, answerRequest, { request: sent, answer: { kind: 'yesNo', yes: true, turns: 0, note: '' } }));
    const refused = await undo(world.playerA, t.campaignId, sendEvent);
    expect(refused.ok).toBe(false);
    expect((await loadRequests(asDb(world.playerA), t.campaignId))?.[0]?.status).toBe('answered');
  });
});

describe('escape rolls (DG17, DG18)', () => {
  it('one per player character; each reads only their own; the player enters the roll; the outcome lands only at Send', async () => {
    const t = await freshTable();
    const noTrip = await as(world.gm, askRequests, { campaignId: t.campaignId, kind: 'escapeRoll', who: 'each', prompt });
    expect(!noTrip.ok && noTrip.message).toBe('Start an expedition first.');
    await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Drowned Stair' }));
    // Fern, Moss's player's second character, stayed in town (made after the expedition started: not in who_went).
    must(await world.admin.from('actors').insert({ campaign_id: t.campaignId, kind: 'pc', name: 'Fern of the Reed Beds', owner_type: 'user', owner_user_id: world.playerB.id, approval: 'approved', status: 'active', level: 1 }).select('id'));
    const asked = await ok(as(world.gm, askRequests, { campaignId: t.campaignId, kind: 'escapeRoll', who: 'each', prompt }));
    // Reed and Moss: not Bree (a hireling), not Fern (who didn't go).
    expect(asked.map((r) => r.actorId).sort()).toEqual([t.reed.id, t.moss.id].sort());
    const reeds = asked.find((r) => r.actorId === t.reed.id)!;
    const mosses = asked.find((r) => r.actorId === t.moss.id)!;
    expect((await loadRequests(asDb(world.playerA), t.campaignId))?.map((r) => r.id)).toEqual([reeds.id]);
    expect((await loadRequests(asDb(world.playerB), t.campaignId))?.map((r) => r.id)).toEqual([mosses.id]);

    // Moss's player can't enter Reed's roll; Reed's player can.
    expect((await world.playerB.db.rpc('enter_request', { request: reeds.id, entry: { roll: 3, on: [] } })).error?.code).toBe('42501');
    const entered = await ok(as(world.playerA, enterRequest, { request: reeds, entry: { roll: 14, on: ['map'] } }));
    expect(entered.entry).toEqual({ roll: 14, on: ['map'] });
    // Before Send, the GM's preview is the GM's alone: the player's row has no answer.
    expect((await loadRequests(asDb(world.playerA), t.campaignId))?.[0]?.answer).toBeNull();
    // The GM changed the outcome before Send: that's what lands.
    await ok(as(world.gm, answerRequest, { request: entered, answer: { kind: 'escape', out: false, note: 'The stair twists back on itself.' } }));
    const landed = (await loadRequests(asDb(world.playerA), t.campaignId))?.[0];
    expect([landed?.status, landed?.answer]).toEqual(['answered', { kind: 'escape', out: false, note: 'The stair twists back on itself.' }]);
    expect((await loadRequests(asDb(world.playerB), t.campaignId))?.[0]?.answer).toBeNull();
    // A player can't take back what the GM asked.
    const refused = await as(world.playerB, withdrawRequest, { request: mosses });
    expect(refused.ok).toBe(false);
  });

  // C7 (M5 gate, ruled 2026-11-01): a player without a device: the GM may enter the roll, logged as the GM's.
  it("the GM enters a roll for a player without a device, logged as the GM's; the GM still can't change a player's own ask", async () => {
    const t = await freshTable();
    await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon', place: 'The Drowned Stair' }));
    const asked = await ok(as(world.gm, askRequests, { campaignId: t.campaignId, kind: 'escapeRoll', who: 'each', prompt }));
    const mosses = asked.find((r) => r.actorId === t.moss.id)!;
    const requestId = crypto.randomUUID();
    const entered = await ok(as(world.gm, enterRequest, { request: mosses, entry: { roll: 11, on: [] } }, requestId));
    expect(entered).toMatchObject({ status: 'waiting', entry: { roll: 11, on: [] } });
    const logged = must(await world.admin.from('events').select('type, actor_user_id').eq('request_id', requestId));
    expect(logged).toEqual([{ type: 'request.enter', actor_user_id: world.gm.id }]);
    // A player's own ask (playerAsks) stays theirs to change.
    const own = await ok(as(world.playerA, sendRequest, { character: t.reed, kind: 'describe', text: 'Listen at the door.' }));
    expect((await world.gm.db.from('requests').update({ entry: { roll: 3, on: [] } }).eq('id', own.id).select('id')).error?.code).toBe('42501');
  });

  it("one for the party when `who` is party: everyone reads it and any player enters it; Undo of the ask takes it back", async () => {
    const t = await freshTable();
    await ok(as(world.gm, startExpedition, { campaignId: t.campaignId, mode: 'dungeon' }));
    const asked = await ok(as(world.gm, askRequests, { campaignId: t.campaignId, kind: 'escapeRoll', who: 'party', prompt }));
    expect(asked).toHaveLength(1);
    expect([asked[0]!.requesterId, asked[0]!.actorId]).toEqual([null, null]);
    expect((await loadRequests(asDb(world.playerA), t.campaignId))?.map((r) => r.id)).toEqual([asked[0]!.id]);
    expect((await loadRequests(asDb(world.playerB), t.campaignId))?.map((r) => r.id)).toEqual([asked[0]!.id]);
    // Undo of Leave the dungeon takes the rolls back (while nothing has changed since).
    await ok(undo(world.gm, t.campaignId, await latestEvent(t.campaignId, 'request.ask')));
    expect(await loadRequests(asDb(world.playerA), t.campaignId)).toEqual([]);
    expect(await loadRequests(asDb(world.gm), t.campaignId)).toEqual([]);
    // Asked again: any player enters the party's roll.
    const again = await ok(as(world.gm, askRequests, { campaignId: t.campaignId, kind: 'escapeRoll', who: 'party', prompt }));
    const entered = await ok(as(world.playerB, enterRequest, { request: again[0]!, entry: { roll: 9, on: [] } }));
    expect(entered.entry).toEqual({ roll: 9, on: [] });
    expect((await loadRequests(asDb(world.playerA), t.campaignId))?.[0]?.entry).toEqual({ roll: 9, on: [] });
  });
});
