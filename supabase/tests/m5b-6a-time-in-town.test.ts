// M5b step 6a: time in town, End expedition, Start and End downtime (ruled 2026-11-02, dt-2; ST1, ST10, ST11;
// supabase/migrations/20261104120000_m5b_6a_time_in_town.sql). TEST project only; invented content.
//   End expedition leaves the campaign in Adventure with no expedition; Undo restores the expedition exactly.
//   Start downtime gives every approved, active character in play a full rest once (who went and who stayed; a name
//   from elsewhere is passed over), then Downtime, in one request; Undo reverses both. Refused while an expedition is under way, and
//   a second Start downtime is refused. A player can't start or end downtime.
//   End downtime returns to Adventure, one Simple line, Undo back to Downtime.
//   Next part of day is a Simple line.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { endDowntime, endExpedition, nextPartOfDay, startDowntime, startExpedition, toClock } from '../../src/modules/expedition/play.ts';
import { setActiveNight } from '../../src/modules/expedition/townPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}

const campaignRow = async () => must(await world.admin.from('campaigns').select('mode, out_day, active_night').eq('id', world.campaignId).single());
const eventsOf = async (type: string) =>
  must(await world.admin.from('events').select('id, level, request_id, target_table, before, after').eq('campaign_id', world.campaignId).eq('type', type).order('seq'));
const undo = async (eventId: string) => as(world.gm, undoChange, { campaignId: world.campaignId, eventId, authorUserId: world.gm.id });
const spentOf = async (actor: string) => (must(await world.admin.from('character_play').select('uses_spent').eq('actor_id', actor).maybeSingle()) as { uses_spent: unknown } | null)?.uses_spent;
const setSpent = async (actor: string, uses: Record<string, number>) =>
  must(await world.admin.from('character_play').upsert({ actor_id: actor, campaign_id: world.campaignId, uses_spent: uses }).select('actor_id'));

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('time in town (M5b step 6a)', () => {
  it('End expedition leaves the campaign in Adventure with no expedition; Undo restores the expedition exactly', async () => {
    const started = await as(world.gm, startExpedition, { campaignId: world.campaignId, mode: 'quay' });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const before = must(await world.admin.from('expeditions').select('*').eq('id', started.value.id).single());
    expect((await campaignRow()).mode).toBe('adventure');
    const ended = await as(world.gm, endExpedition, { campaignId: world.campaignId, expedition: started.value });
    expect(ended.ok).toBe(true);
    expect((await campaignRow()).mode).toBe('adventure');
    const line = await eventsOf('expedition.end');
    // Only the expedition changed: no line on the campaign any more.
    expect(line.map((e) => e.target_table)).toEqual(['expeditions']);

    expect(await undo(line[0]!.id as string)).toMatchObject({ ok: true });
    const after = must(await world.admin.from('expeditions').select('*').eq('id', started.value.id).single());
    expect(after).toMatchObject({ ended_at: before.ended_at, summary: before.summary, undone: false, who_went: before.who_went });
    expect((await campaignRow()).mode).toBe('adventure');
    // End it for the next cases (the campaign stays in town).
    const fresh = must(await world.admin.from('expeditions').select('*').eq('id', started.value.id).single());
    expect((await as(world.gm, endExpedition, { campaignId: world.campaignId, expedition: { ...started.value, version: fresh.version as number } })).ok).toBe(true);
  });

  it('Next part of day is one Simple line', async () => {
    const clock = toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', world.campaignId).single()));
    expect((await as(world.gm, nextPartOfDay, { campaignId: world.campaignId, clock, seconds: 8 * 3600 })).ok).toBe(true);
    const lines = await eventsOf('time.partOfDay');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 'simple', target_table: 'campaign_clocks' });
  });

  it("a player can't start downtime, nor end it", async () => {
    expect((await as(world.playerA, startDowntime, { campaignId: world.campaignId, refills: {} })).ok).toBe(false);
    // Past the app's check, the database refuses too.
    const direct = await world.playerA.db.rpc('start_downtime', { campaign: world.campaignId, refills: {} });
    expect(direct.error).not.toBeNull();
    expect((await campaignRow()).mode).toBe('adventure');
  });

  // Purpose (review of 2026-11-04): past the app's check, the database refuses a player's End downtime too.
  it("a player can't end downtime directly either", async () => {
    const direct = await world.playerA.db.rpc('end_downtime', { campaign: world.campaignId });
    expect(direct.error).not.toBeNull();
    expect(await eventsOf('downtime.end')).toHaveLength(0);
  });

  it('Start downtime gives every character in play a full rest once, then Downtime, in one request; Undo reverses both', async () => {
    await setSpent(world.wrenId, { 'Lantern ward': 2, 'Fen fury': 1 });
    await setSpent(world.ashId, { 'Lantern ward': 1 });
    await as(world.gm, setActiveNight, { campaignId: world.campaignId, on: true });
    // A name that isn't a character of this campaign is passed over.
    const refills = { [world.wrenId]: ['Lantern ward'], [world.ashId]: ['Lantern ward'], '00000000-0000-0000-0000-000000000000': ['Lantern ward'] };
    expect(await as(world.gm, startDowntime, { campaignId: world.campaignId, refills })).toMatchObject({ ok: true });
    expect(await campaignRow()).toMatchObject({ mode: 'downtime', active_night: false });
    expect(await spentOf(world.wrenId)).toEqual({ 'Fen fury': 1 });
    expect(await spentOf(world.ashId)).toEqual({});
    const lines = await eventsOf('downtime.start');
    expect(new Set(lines.map((e) => e.request_id)).size).toBe(1);
    expect(lines.filter((e) => e.target_table === 'character_play')).toHaveLength(2);
    expect(lines.every((e) => e.level === 'simple')).toBe(true);
    // Once: a second Start downtime is refused, and changes nothing.
    expect((await as(world.gm, startDowntime, { campaignId: world.campaignId, refills })).ok).toBe(false);
    expect(await eventsOf('downtime.start')).toHaveLength(lines.length);

    expect(await undo(lines[0]!.id as string)).toMatchObject({ ok: true });
    expect(await campaignRow()).toMatchObject({ mode: 'adventure', active_night: true });
    expect(await spentOf(world.wrenId)).toEqual({ 'Lantern ward': 2, 'Fen fury': 1 });
    expect(await spentOf(world.ashId)).toEqual({ 'Lantern ward': 1 });
  });

  it('Start downtime is refused while an expedition is under way', async () => {
    const started = await as(world.gm, startExpedition, { campaignId: world.campaignId, mode: 'quay' });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const refused = await as(world.gm, startDowntime, { campaignId: world.campaignId, refills: {} });
    expect(refused).toMatchObject({ ok: false, message: 'End the expedition first.' });
    expect((await campaignRow()).mode).toBe('adventure');
    expect((await as(world.gm, endExpedition, { campaignId: world.campaignId, expedition: started.value })).ok).toBe(true);
  });

  it('End downtime returns to Adventure, one Simple line; Undo goes back to Downtime', async () => {
    expect((await as(world.gm, startDowntime, { campaignId: world.campaignId, refills: {} })).ok).toBe(true);
    expect((await as(world.playerB, endDowntime, { campaignId: world.campaignId })).ok).toBe(false);
    expect(await as(world.gm, endDowntime, { campaignId: world.campaignId })).toMatchObject({ ok: true, value: 'adventure' });
    expect((await campaignRow()).mode).toBe('adventure');
    expect(must(await world.admin.from('expeditions').select('id').eq('campaign_id', world.campaignId).is('ended_at', null).eq('undone', false))).toHaveLength(0);
    const lines = await eventsOf('downtime.end');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 'simple', target_table: 'campaigns' });
    // Not in Downtime now: a second End downtime is refused.
    expect((await as(world.gm, endDowntime, { campaignId: world.campaignId })).ok).toBe(false);

    expect(await undo(lines[0]!.id as string)).toMatchObject({ ok: true });
    expect((await campaignRow()).mode).toBe('downtime');
  });
});
