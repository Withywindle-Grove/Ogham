// M5b step g6: rest as a shared flow (supabase/migrations/20261102330000_m5b_g6_rest_flow.sql; ruled 2026-11-01,
// M5 gate B5; docs/05 "Rest"). TEST project only; invented characters and condition. Purposes:
//   - A player answers only for their own character; the GM answers (flips) anyone's; a player can't write the GM's
//     columns (rested_at, the countdown, the owed rest) directly.
//   - The Rest button calls a rest for the caller's whole group and answers Rest for the caller; refused for someone
//     else's character.
//   - Next turn with two resting, one pushing on and one unanswered stacks the condition on exactly two, restarts the
//     countdown for all four, marks the pushed-on as owing a rest, and logs it as rest.applied (Simple) in the move's
//     request; undoing the move puts everything back, the marked statuses undone.
//   - Without `rest`, a move applies nothing.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { toCharacterRef } from '../../src/modules/characters/commands.ts';
import { advanceTime, startExpedition, toClock, type Clock } from '../../src/modules/expedition/play.ts';
import { answerRest, callRest, restArg } from '../../src/modules/expedition/restFlow.ts';
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
const WEARY = { name: 'Weary', conditionId: 'weary', icon: null, stacks: true, levels: null, note: 'Slow and sore.' };

/** A fresh campaign under way: the GM, both players, two characters each. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Fen Lantern Road', created_by: world.gm.id }).select().single());
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
  const rows = must(
    await world.admin
      .from('actors')
      .insert([pc('Reed the Ferrywarden', world.playerA), pc('Wick', world.playerA), pc('Moss of the Bog Lights', world.playerB), pc('Fern', world.playerB)])
      .select(),
  );
  const ref = (row: unknown) => toCharacterRef(row as Parameters<typeof toCharacterRef>[0]);
  const byName = (name: string) => ref(rows.find((r) => r.name === name));
  await ok(as(world.gm, startExpedition, { campaignId: campaign.id as string, mode: 'dungeon' }));
  return { campaignId: campaign.id as string, reed: byName('Reed the Ferrywarden'), wick: byName('Wick'), moss: byName('Moss of the Bog Lights'), fern: byName('Fern') };
}

const clockOf = async (campaignId: string): Promise<Clock> => toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
type RestRow = { chosen_at: number | null; pushing_at: number | null; rested_at: number | null; period_from: number | null; pushed_on_at: number | null; called_at: number | null; called_by: string | null };
const restOf = async (actorId: string) => must(await world.admin.from('character_rests').select('*').eq('actor_id', actorId).single()) as RestRow;
const wearyOn = async (actorId: string) =>
  must(await world.admin.from('character_statuses').select('stacks, source, undone, ended_at').eq('actor_id', actorId).eq('condition_id', 'weary')) as { stacks: number; source: string; undone: boolean; ended_at: number | null }[];
const turns = async (campaignId: string, n: number, rest: unknown = null, requestId?: string) =>
  ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: n * TURN, rest: rest as never }, requestId));
type Who = { id: string; campaignId: string; ownerUserId: string | null };
const answer = (person: Person, campaignId: string, characters: Who[], value: 'rest' | 'push' | 'wait') => as(person, answerRest, { target: { campaignId, characters }, answer: value });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('answering (B5)', () => {
  it("a player answers only for their own character; the GM flips anyone's; a player can't write the GM's columns", async () => {
    const t = await freshTable();
    await turns(t.campaignId, 6);
    await ok(answer(world.playerA, t.campaignId, [t.reed], 'push'));
    expect(await restOf(t.reed.id)).toMatchObject({ pushing_at: 6 * TURN, chosen_at: null });
    const theirs = await world.playerA.db.rpc('answer_rest', { actors: [t.moss.id], answer: 'rest' });
    expect(theirs.error?.code).toBe('42501');
    await ok(answer(world.gm, t.campaignId, [t.reed], 'rest'));
    expect(await restOf(t.reed.id)).toMatchObject({ pushing_at: null, chosen_at: 6 * TURN });
    const direct = await world.playerA.db.from('character_rests').update({ pushed_on_at: null, period_from: 6 * TURN }).eq('actor_id', t.reed.id).select();
    expect(direct.error?.code).toBe('42501');
    const called = await world.playerA.db.from('character_rests').update({ called_at: 0 }).eq('actor_id', t.reed.id).select();
    expect(called.error?.code).toBe('42501');
  });

  it("the Rest button calls a rest for the caller's whole group and answers Rest for the caller; refused as someone else's character", async () => {
    const t = await freshTable();
    await turns(t.campaignId, 2);
    await ok(as(world.playerA, callRest, { character: t.reed }));
    for (const who of [t.reed, t.wick, t.moss, t.fern]) expect(await restOf(who.id)).toMatchObject({ called_at: 2 * TURN, called_by: t.reed.id });
    expect((await restOf(t.reed.id)).chosen_at).toBe(2 * TURN);
    expect((await restOf(t.moss.id)).chosen_at).toBeNull();
    const notMine = await as(world.playerA, callRest, { character: t.moss });
    expect(notMine).toMatchObject({ ok: false, reason: 'not-allowed' });
    const through = await world.playerA.db.rpc('call_rest', { actor: t.moss.id });
    expect(through.error?.code).toBe('42501');
  });
});

describe('Next turn applies the answers (B5)', () => {
  it('two resting, one pushing on, one unanswered: Weary stacks on exactly two, the countdown restarts, logged rest.applied; Undo puts it all back', async () => {
    const t = await freshTable();
    await turns(t.campaignId, 6);
    await ok(answer(world.playerA, t.campaignId, [t.reed, t.wick], 'rest'));
    await ok(answer(world.playerB, t.campaignId, [t.moss], 'push'));
    const requestId = crypto.randomUUID();
    const all = [t.reed, t.wick, t.moss, t.fern];
    await turns(t.campaignId, 1, restArg({ actors: all.map((c) => c.id), condition: WEARY }), requestId);
    for (const who of all) expect((await restOf(who.id)).period_from).toBe(6 * TURN);
    expect(await restOf(t.reed.id)).toMatchObject({ rested_at: 6 * TURN, chosen_at: null, pushed_on_at: null });
    expect(await restOf(t.moss.id)).toMatchObject({ rested_at: null, pushing_at: null, pushed_on_at: 6 * TURN });
    expect((await restOf(t.fern.id)).pushed_on_at).toBe(6 * TURN);
    expect(await wearyOn(t.reed.id)).toEqual([]);
    expect(await wearyOn(t.wick.id)).toEqual([]);
    expect((await wearyOn(t.moss.id)).map((s) => [s.stacks, s.source])).toEqual([[1, 'rest']]);
    expect((await wearyOn(t.fern.id)).map((s) => [s.stacks, s.source])).toEqual([[1, 'rest']]);
    const events = must(await world.admin.from('events').select('id, type, level, target_table').eq('request_id', requestId).order('seq'));
    const applied = events.filter((e) => e.type === 'rest.applied');
    expect(applied.filter((e) => e.target_table === 'character_rests')).toHaveLength(4);
    expect(applied.filter((e) => e.target_table === 'character_statuses')).toHaveLength(2);
    expect(applied.every((e) => e.level === 'simple')).toBe(true);
    // A player sees the record (their characters' statuses are theirs to see).
    expect(must(await world.playerB.db.from('events').select('id').eq('request_id', requestId).eq('type', 'rest.applied')).length).toBeGreaterThan(0);

    const clockMove = events.find((e) => e.target_table === 'campaign_clocks')!;
    expect(await as(world.gm, undoChange, { campaignId: t.campaignId, eventId: clockMove.id as string, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(await restOf(t.reed.id)).toMatchObject({ chosen_at: 6 * TURN, rested_at: null, period_from: null });
    expect(await restOf(t.moss.id)).toMatchObject({ pushing_at: 6 * TURN, pushed_on_at: null });
    expect((await wearyOn(t.moss.id)).every((s) => s.undone)).toBe(true);
  });

  it('a second push-on stacks the condition; resting later clears it and the owed rest', async () => {
    const t = await freshTable();
    await turns(t.campaignId, 6);
    await turns(t.campaignId, 1, restArg({ actors: [t.moss.id], condition: WEARY }));
    await turns(t.campaignId, 5);
    await turns(t.campaignId, 1, restArg({ actors: [t.moss.id], condition: WEARY }));
    expect((await wearyOn(t.moss.id)).map((s) => s.stacks)).toEqual([2]);
    expect((await restOf(t.moss.id)).pushed_on_at).toBe(6 * TURN);
    await turns(t.campaignId, 5);
    await ok(answer(world.playerB, t.campaignId, [t.moss], 'rest'));
    await turns(t.campaignId, 1, restArg({ actors: [t.moss.id], condition: WEARY }));
    expect(await restOf(t.moss.id)).toMatchObject({ pushed_on_at: null, rested_at: 18 * TURN });
    expect((await wearyOn(t.moss.id)).map((s) => s.ended_at)).toEqual([18 * TURN]);
  });

  it('a move without `rest` applies nothing, even with answers given', async () => {
    const t = await freshTable();
    await turns(t.campaignId, 6);
    await ok(answer(world.playerA, t.campaignId, [t.reed], 'rest'));
    await turns(t.campaignId, 1);
    expect(await restOf(t.reed.id)).toMatchObject({ chosen_at: 6 * TURN, rested_at: null, period_from: null });
  });
});
