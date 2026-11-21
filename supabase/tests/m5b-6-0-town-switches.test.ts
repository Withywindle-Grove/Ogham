// M5b step 6.0: the town switches (ruled 2026-11-03, sw-1 … sw-4; supabase/migrations/20261104110000_m5b_6_0_town_switches.sql).
// TEST project only; invented content.
//   The GM flips Out and about today and Active tonight: one Simple log line each, and Undo puts the switch back.
//   One or the other (sm-1, 2026-11-14): turning one on turns the other off in the same line; Undo puts both back.
//   A player reads the switches (sw-4) but can't change them, not even straight at the table (row-level security).
//   The morning's reset turns both off as its own Simple line; Start downtime (its own tap since M5b step 6a) turns them
//   off in the same change, and its Undo puts them back on; End expedition leaves them as they are.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { endExpedition, startDowntime, startExpedition } from '../../src/modules/expedition/play.ts';
import { loadTownSwitches, resetTownSwitches, setActiveNight, setOutDay } from '../../src/modules/expedition/townPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}

async function freshCampaign() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Lantern Quay', created_by: world.gm.id }).select().single());
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
const switchesOf = async (campaignId: string) => must(await world.admin.from('campaigns').select('out_day, active_night, mode').eq('id', campaignId).single());
const eventsOf = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id, level, before, after, target_table').eq('campaign_id', campaignId).eq('type', type).order('seq'));

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('the town switches (sw-1 … sw-4)', () => {
  it('a new campaign has both switches off', async () => {
    const campaignId = await freshCampaign();
    expect(await switchesOf(campaignId)).toMatchObject({ out_day: false, active_night: false });
  });

  it("the GM's flip is one Simple line that turns the other off (sm-1), the player reads the new state, and Undo puts both back", async () => {
    const campaignId = await freshCampaign();
    expect((await as(world.gm, setActiveNight, { campaignId, on: true })).ok).toBe(true);
    expect((await as(world.gm, setOutDay, { campaignId, on: true })).ok).toBe(true);
    // One or the other (sm-1): lighting Out and about today put Active tonight out, in the same line.
    expect(await loadTownSwitches(asDb(world.playerA), campaignId)).toEqual({ outDay: true, activeNight: false });
    const flips = await eventsOf(campaignId, 'town.outDay');
    expect(flips).toHaveLength(1);
    expect(flips[0]).toMatchObject({ level: 'simple', target_table: 'campaigns', before: { active_night: true }, after: { out_day: true, active_night: false } });
    // The player's log has the line too (they see the state, sw-4).
    const seen = must(await world.playerA.db.from('events').select('id').eq('campaign_id', campaignId).eq('type', 'town.outDay'));
    expect(seen).toHaveLength(1);

    const undone = await as(world.gm, undoChange, { campaignId, eventId: flips[0]!.id as string, authorUserId: world.gm.id });
    expect(undone).toMatchObject({ ok: true });
    expect(await switchesOf(campaignId)).toMatchObject({ out_day: false, active_night: true });

    // Turning a switch off touches only its own column.
    expect((await as(world.gm, setActiveNight, { campaignId, on: false })).ok).toBe(true);
    expect(await switchesOf(campaignId)).toMatchObject({ out_day: false, active_night: false });
  });

  it('a campaign with both on from before the rule reads as both; the next turn-on of either clears the other (sm-1)', async () => {
    const campaignId = await freshCampaign();
    must(await world.admin.from('campaigns').update({ out_day: true, active_night: true }).eq('id', campaignId).select('id'));
    expect(await loadTownSwitches(asDb(world.playerA), campaignId)).toEqual({ outDay: true, activeNight: true });
    expect((await as(world.gm, setActiveNight, { campaignId, on: true })).ok).toBe(true);
    expect(await switchesOf(campaignId)).toMatchObject({ out_day: false, active_night: true });
  });

  it("a player can't flip a switch, neither by the command nor straight at the table", async () => {
    const campaignId = await freshCampaign();
    const refused = await as(world.playerA, setOutDay, { campaignId, on: true });
    expect(refused.ok).toBe(false);
    // Past the app's check: the row-level security refuses (no row changes).
    const direct = await world.playerA.db.from('campaigns').update({ active_night: true }).eq('id', campaignId).select('id');
    expect(direct.data ?? []).toHaveLength(0);
    expect(await switchesOf(campaignId)).toMatchObject({ out_day: false, active_night: false });
  });

  it("the morning's reset turns both off as its own Simple line, and Undo puts them back", async () => {
    const campaignId = await freshCampaign();
    // Both on can only be old data now (sm-1: one or the other); the reset still clears and gives back both.
    must(await world.admin.from('campaigns').update({ out_day: true, active_night: true }).eq('id', campaignId).select('id'));
    const reset = await as(world.gm, resetTownSwitches, { campaignId });
    expect(reset).toMatchObject({ ok: true, value: true });
    expect(await switchesOf(campaignId)).toMatchObject({ out_day: false, active_night: false });
    const lines = await eventsOf(campaignId, 'town.reset');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 'simple', before: { out_day: true, active_night: true } });
    // With both already off, nothing changes and no line is written.
    expect(await as(world.gm, resetTownSwitches, { campaignId })).toMatchObject({ ok: true, value: false });
    expect(await eventsOf(campaignId, 'town.reset')).toHaveLength(1);

    expect(await as(world.gm, undoChange, { campaignId, eventId: lines[0]!.id as string, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(await switchesOf(campaignId)).toMatchObject({ out_day: true, active_night: true });
  });

  it('Start downtime turns them off in the same change, and its Undo puts them back on; End expedition leaves them', async () => {
    const campaignId = await freshCampaign();
    const started = await as(world.gm, startExpedition, { campaignId, mode: 'delve' });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    await as(world.gm, setOutDay, { campaignId, on: true });
    const ended = await as(world.gm, endExpedition, { campaignId, expedition: started.value });
    expect(ended.ok).toBe(true);
    // M5b step 6a (dt-2): still in Adventure, the switch still on.
    expect(await switchesOf(campaignId)).toMatchObject({ mode: 'adventure', out_day: true });
    expect(await as(world.gm, startDowntime, { campaignId, refills: {} })).toMatchObject({ ok: true });
    expect(await switchesOf(campaignId)).toMatchObject({ mode: 'downtime', out_day: false, active_night: false });
    const end = (await eventsOf(campaignId, 'downtime.start')).find((e) => e.target_table === 'campaigns');
    expect(end).toMatchObject({ before: { out_day: true }, after: { out_day: false, mode: 'downtime' } });

    expect(await as(world.gm, undoChange, { campaignId, eventId: end!.id as string, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(await switchesOf(campaignId)).toMatchObject({ out_day: true });
  });
});
