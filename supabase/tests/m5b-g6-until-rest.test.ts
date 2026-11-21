// M5b step g6, build order 4: "Until rest" on + Status (supabase/migrations/20261102350000_m5b_g6_until_rest.sql;
// ruled 2026-11-01, M5 gate B6; docs/05 "Statuses at the M5 gate"). TEST project only; invented characters and
// statuses. Purposes:
//   - A status given until rest ends when a rest is applied to its character (Next turn, resting), and not for a
//     character who pushed on; undoing the time move puts it back on.
//   - A status given without it (Until removed) stays on through the rest.
//   - A player can't switch until_rest on their own status directly.
//   - Push on still marks the rest condition through add_status (its 12-argument call keeps working).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { toCharacterRef } from '../../src/modules/characters/commands.ts';
import { advanceTime, startExpedition, toClock, type Clock } from '../../src/modules/expedition/play.ts';
import { answerRest, restArg } from '../../src/modules/expedition/restFlow.ts';
import { addStatus } from '../../src/modules/expedition/statusPlay.ts';
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

async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reedwater Crossing', created_by: world.gm.id }).select().single());
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
  const rows = must(await world.admin.from('actors').insert([pc('Tamsin of the Long Reeds', world.playerA), pc('Brock', world.playerB)]).select());
  const ref = (row: unknown) => toCharacterRef(row as Parameters<typeof toCharacterRef>[0]);
  await ok(as(world.gm, startExpedition, { campaignId: campaign.id as string, mode: 'dungeon' }));
  return { campaignId: campaign.id as string, tamsin: ref(rows.find((r) => r.name === 'Tamsin of the Long Reeds')), brock: ref(rows.find((r) => r.name === 'Brock')) };
}

const clockOf = async (campaignId: string): Promise<Clock> => toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
const turns = async (campaignId: string, n: number, rest: unknown = null, requestId?: string) =>
  ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: n * TURN, rest: rest as never }, requestId));
type Who = { id: string; campaignId: string; ownerUserId: string | null };
const give = (campaignId: string, who: Who[], name: string, untilRest: boolean) =>
  ok(as(world.gm, addStatus, { target: { campaignId, characters: who, secret: false }, status: { name, condition: null, timer: null, secret: false, untilRest } }));
const statusesOf = async (actorId: string) =>
  must(await world.admin.from('character_statuses').select('name, until_rest, ended_at, end_reason, undone, source').eq('actor_id', actorId).order('created_at')) as {
    name: string;
    until_rest: boolean;
    ended_at: number | null;
    end_reason: string | null;
    undone: boolean;
    source: string;
  }[];

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('Until rest (B6)', () => {
  it('ends when a rest is applied to its character, not for one who pushed on; Until removed stays; undoing the move puts it back', async () => {
    const t = await freshTable();
    await give(t.campaignId, [t.tamsin, t.brock], 'Soaked', true);
    await give(t.campaignId, [t.tamsin], 'Muddy boots', false);
    expect((await statusesOf(t.tamsin.id)).map((s) => [s.name, s.until_rest])).toEqual([
      ['Soaked', true],
      ['Muddy boots', false],
    ]);
    await turns(t.campaignId, 6);
    await ok(as(world.playerA, answerRest, { target: { campaignId: t.campaignId, characters: [t.tamsin] }, answer: 'rest' }));
    const requestId = crypto.randomUUID();
    await turns(t.campaignId, 1, restArg({ actors: [t.tamsin.id, t.brock.id], condition: WEARY }), requestId);

    const tamsin = await statusesOf(t.tamsin.id);
    expect(tamsin.find((s) => s.name === 'Soaked')).toMatchObject({ ended_at: 6 * TURN, end_reason: 'rested' });
    expect(tamsin.find((s) => s.name === 'Muddy boots')).toMatchObject({ ended_at: null });
    const brock = await statusesOf(t.brock.id);
    expect(brock.find((s) => s.name === 'Soaked')).toMatchObject({ ended_at: null });
    // Push on still marks the rest condition (add_status called with its first 12 arguments).
    expect(brock.find((s) => s.name === 'Weary')).toMatchObject({ source: 'rest', until_rest: false, ended_at: null });

    const clockMove = must(await world.admin.from('events').select('id').eq('request_id', requestId).eq('target_table', 'campaign_clocks')).at(0)!;
    expect(await as(world.gm, undoChange, { campaignId: t.campaignId, eventId: clockMove.id as string, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect((await statusesOf(t.tamsin.id)).find((s) => s.name === 'Soaked')).toMatchObject({ ended_at: null, end_reason: null });
  });

  it("a player can't switch until_rest on their own status", async () => {
    const t = await freshTable();
    await give(t.campaignId, [t.tamsin], 'Soaked', false);
    const flipped = await world.playerA.db.from('character_statuses').update({ until_rest: true }).eq('actor_id', t.tamsin.id).select();
    expect(flipped.error).not.toBeNull();
    expect((await statusesOf(t.tamsin.id))[0]!.until_rest).toBe(false);
  });
});
