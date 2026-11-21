// M5b step g1b: the first day's start time (B13; g1's scope check, ruled 2026-11-01, option A;
// supabase/migrations/20261102140000_m5b_g1b_start_time.sql). TEST project only; invented content.
//   On a clock that hasn't moved, the GM's start time saves the setting and puts the clock there: one Simple log
//   entry (both changes under `time.start`), seen by the players, and one Undo puts both back.
//   Once the clock has moved (an expedition, or an advance that stands), it's refused and nothing changes.
//   A player can't set it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { DEFAULT_TIME } from '../../src/core/campaignSettings.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { timeUnits } from '../../src/modules/expedition/clock.ts';
import { advanceTime, CLOCK_HAS_MOVED, setStartTime, toClock, type Clock } from '../../src/modules/expedition/play.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const units = timeUnits(DEFAULT_TIME);
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}

async function freshCampaign() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reedmarsh Ferry', created_by: world.gm.id, settings: { companies: false } }).select().single());
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
const clockOf = async (campaignId: string): Promise<Clock> => toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
const settingsOf = async (campaignId: string) => must(await world.admin.from('campaigns').select('settings').eq('id', campaignId).single()).settings as Record<string, unknown>;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('the start time (B13)', () => {
  it('on an unmoved clock, saves the setting (keeping the others) and puts the clock there, in one Simple entry players see; Undo puts both back', async () => {
    const campaignId = await freshCampaign();
    const done = await as(world.gm, setStartTime, { campaignId, start: { hour: 7, minute: 30 }, clock: await clockOf(campaignId), units });
    expect(done.ok).toBe(true);
    expect((await clockOf(campaignId)).seconds).toBe(7 * 3600 + 30 * 60);
    expect(await settingsOf(campaignId)).toEqual({ companies: false, startTime: { hour: 7, minute: 30 } });
    const logged = must(await world.admin.from('events').select('id, target_table, level, request_id').eq('campaign_id', campaignId).eq('type', 'time.start').order('seq'));
    expect(logged.map((e) => e.target_table).sort()).toEqual(['campaign_clocks', 'campaigns']);
    expect(new Set(logged.map((e) => e.request_id)).size).toBe(1);
    expect(logged.every((e) => e.level === 'simple')).toBe(true);
    const seen = must(await world.playerA.db.from('events').select('target_table').eq('campaign_id', campaignId).eq('type', 'time.start'));
    expect(seen.map((e) => e.target_table)).toContain('campaign_clocks');

    const undone = await as(world.gm, undoChange, { campaignId, eventId: logged.at(-1)!.id as string, authorUserId: world.gm.id });
    expect(undone).toMatchObject({ ok: true });
    expect((await clockOf(campaignId)).seconds).toBe(0);
    expect(await settingsOf(campaignId)).toEqual({ companies: false });
  });

  it('once an advance stands, it is refused and nothing changes', async () => {
    const campaignId = await freshCampaign();
    const moved = await as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: 600 });
    expect(moved.ok).toBe(true);
    const refused = await as(world.gm, setStartTime, { campaignId, start: { hour: 6, minute: 0 }, clock: await clockOf(campaignId), units });
    expect(refused.ok ? 'applied' : refused.message).toBe(CLOCK_HAS_MOVED);
    expect((await clockOf(campaignId)).seconds).toBe(600);
    expect((await settingsOf(campaignId)).startTime).toBeUndefined();
  });

  it("a player can't set it", async () => {
    const campaignId = await freshCampaign();
    const refused = await as(world.playerA, setStartTime, { campaignId, start: { hour: 6, minute: 0 }, clock: await clockOf(campaignId), units });
    expect(refused.ok).toBe(false);
    expect((await clockOf(campaignId)).seconds).toBe(0);
  });
});
