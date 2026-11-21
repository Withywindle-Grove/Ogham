// "Use safe paths" is logged (ruled 2026-11-04, sq-2; supabase/migrations/20261105100000_m5b_safe_paths_logged.sql).
// TEST project only; invented content.
//   The GM's Use safe paths marks the expedition under way: one Simple line, and Undo takes the mark back.
//   A second use changes nothing and writes no line. A player can't use it, not even straight at the table; an ended
//   expedition refuses it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { endExpedition, leaveBySafePaths, startExpedition, toExpedition } from '../../src/modules/expedition/play.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}

async function freshCampaign() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Chalk Stair', created_by: world.gm.id }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
      ])
      .select(),
  );
  return campaign.id as string;
}
async function underWay(campaignId: string) {
  const started = await as(world.gm, startExpedition, { campaignId, mode: 'dungeon' });
  if (!started.ok) throw new Error(started.message);
  return started.value;
}
const linesOf = async (campaignId: string) =>
  must(await world.admin.from('events').select('id, level, before, after, target_table').eq('campaign_id', campaignId).eq('type', 'expedition.safePaths').order('seq'));
const markOf = async (id: string) => must(await world.admin.from('expeditions').select('safe_paths').eq('id', id).single()).safe_paths;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('Use safe paths (sq-2)', () => {
  it("the GM's use is one Simple line on the expedition; a second use writes none; Undo takes the mark back", async () => {
    const campaignId = await freshCampaign();
    const expedition = await underWay(campaignId);
    expect(await markOf(expedition.id)).toBe(false);
    const used = await as(world.gm, leaveBySafePaths, { campaignId, expedition });
    expect(used.ok && used.value.safePaths).toBe(true);
    const lines = await linesOf(campaignId);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 'simple', target_table: 'expeditions', before: { safe_paths: false }, after: { safe_paths: true } });
    expect((await as(world.gm, leaveBySafePaths, { campaignId, expedition })).ok).toBe(true);
    expect(await linesOf(campaignId)).toHaveLength(1);
    const undone = await as(world.gm, undoChange, { campaignId, eventId: lines[0]!.id as string, authorUserId: world.gm.id });
    expect(undone.ok).toBe(true);
    expect(await markOf(expedition.id)).toBe(false);
  });

  it("a player can't use it, through the app or straight at the table", async () => {
    const campaignId = await freshCampaign();
    const expedition = await underWay(campaignId);
    expect((await as(world.playerA, leaveBySafePaths, { campaignId, expedition })).ok).toBe(false);
    const direct = await world.playerA.db.rpc('use_safe_paths', { expedition: expedition.id });
    expect(direct.error?.code).toBe('42501');
    await world.playerA.db.from('expeditions').update({ safe_paths: true }).eq('id', expedition.id);
    expect(await markOf(expedition.id)).toBe(false);
    expect(await linesOf(campaignId)).toEqual([]);
  });

  it('an ended expedition refuses it', async () => {
    const campaignId = await freshCampaign();
    const expedition = await underWay(campaignId);
    const ended = await as(world.gm, endExpedition, { campaignId, expedition });
    expect(ended.ok).toBe(true);
    const latest = toExpedition(must(await world.admin.from('expeditions').select().eq('id', expedition.id).single()));
    const refused = await as(world.gm, leaveBySafePaths, { campaignId, expedition: latest });
    expect(refused.ok).toBe(false);
    expect(refused.ok ? '' : refused.message).toBe('That expedition has ended.');
    expect(await markOf(expedition.id)).toBe(false);
  });
});
