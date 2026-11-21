// M5b g6 follow-up, SC-g6-3 (ruled B by Francis 2026-11-03; supabase/migrations/20261103120000_m5b_g6c_next_rest_due.sql).
// TEST project only; invented characters and condition. Purposes:
//   - Next turn's `rest.nextDue` is kept on every row in the flow, so the rest.applied events carry it for the log
//     line ("next rest due turn 13"); undoing the move takes it off again.
//   - A move whose `rest` has no nextDue (or a malformed one) applies the rest as before, with no next_due.
//   - A player can't write next_due directly.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { toCharacterRef } from '../../src/modules/characters/commands.ts';
import { advanceTime, startExpedition, toClock, type Clock } from '../../src/modules/expedition/play.ts';
import { restArg } from '../../src/modules/expedition/restFlow.ts';
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
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reedmere Causeway', created_by: world.gm.id }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
      ])
      .select(),
  );
  const rows = must(
    await world.admin
      .from('actors')
      .insert([
        { campaign_id: campaign.id, kind: 'pc', name: 'Tansy Reedwalker', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 },
        { campaign_id: campaign.id, kind: 'pc', name: 'Old Bramm', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 },
      ])
      .select(),
  );
  await ok(as(world.gm, startExpedition, { campaignId: campaign.id as string, mode: 'dungeon' }));
  const ref = (row: unknown) => toCharacterRef(row as Parameters<typeof toCharacterRef>[0]);
  return { campaignId: campaign.id as string, tansy: ref(rows[0]), bramm: ref(rows[1]) };
}

const clockOf = async (campaignId: string): Promise<Clock> => toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
const restOf = async (actorId: string) => must(await world.admin.from('character_rests').select('*').eq('actor_id', actorId).single()) as { next_due: unknown; period_from: number | null };
const turns = async (campaignId: string, n: number, rest: unknown = null, requestId?: string) =>
  ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: n * TURN, rest: rest as never }, requestId));

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('the next rest due (SC-g6-3)', () => {
  it('Next turn keeps nextDue on every row in the flow, the events carry it, and Undo takes it off', async () => {
    const t = await freshTable();
    await turns(t.campaignId, 6);
    const requestId = crypto.randomUUID();
    const nextDue = { at: 12 * TURN, unit: 'turn', number: 13 };
    await turns(t.campaignId, 1, restArg({ actors: [t.tansy.id, t.bramm.id], condition: WEARY, nextDue }), requestId);
    for (const who of [t.tansy, t.bramm]) expect(await restOf(who.id)).toMatchObject({ period_from: 6 * TURN, next_due: nextDue });
    const events = must(await world.admin.from('events').select('id, type, target_table, after').eq('request_id', requestId).order('seq'));
    const applied = events.filter((e) => e.type === 'rest.applied' && e.target_table === 'character_rests');
    expect(applied.map((e) => (e.after as Record<string, unknown>).next_due)).toEqual([nextDue, nextDue]);
    const clockMove = events.find((e) => e.target_table === 'campaign_clocks')!;
    expect(await as(world.gm, undoChange, { campaignId: t.campaignId, eventId: clockMove.id as string, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect((await restOf(t.tansy.id)).next_due).toBeNull();
  });

  it('without nextDue, or with a malformed one, the rest applies as before with no next_due', async () => {
    const t = await freshTable();
    await turns(t.campaignId, 6);
    await turns(t.campaignId, 1, restArg({ actors: [t.tansy.id], condition: WEARY }));
    expect(await restOf(t.tansy.id)).toMatchObject({ period_from: 6 * TURN, next_due: null });
    await turns(t.campaignId, 5);
    await turns(t.campaignId, 1, { actors: [t.bramm.id], condition: WEARY, nextDue: { at: 'soon', unit: '', number: -1 } });
    expect(await restOf(t.bramm.id)).toMatchObject({ period_from: 12 * TURN, next_due: null });
  });

  it("a player can't write next_due directly", async () => {
    const t = await freshTable();
    const direct = await world.playerA.db.from('character_rests').update({ next_due: { at: 0, unit: 'turn', number: 1 } }).eq('actor_id', t.tansy.id).select();
    expect(direct.error?.code).toBe('42501');
  });
});
