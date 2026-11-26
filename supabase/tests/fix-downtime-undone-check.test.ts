// fix-downtime-undone-check: going into Downtime reveals the campaign's secret check results
// (private.reveal_check_results, newest in 20261029180000_m5_reminders.sql), undone ones included; but a result's
// rules (private.check_result_rules, newest in 20261029200000_m5_check_reveal.sql) refuse any change to an undone
// result, so one secret result the GM had undone made the next "Start downtime" fail with "That result was undone."
// TEST project only (CI: a local Supabase); invented content.
//   Purpose:
//   1. A campaign with a secret check result the GM undid goes into Downtime without an error, and that undone
//      result stays unrevealed.
//   2. A live secret result in the same campaign is revealed at Downtime as before, and players read it (and only it).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { endExpedition, startDowntime, startExpedition } from '../../src/modules/expedition/play.ts';
import { loadCheckResults, recordCheck } from '../../src/modules/expedition/reminderPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}
const record = { checkKey: 'gm:listen', source: 'gm' as const, outcome: 'miss' as const, modifiers: [] };
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const revealedOf = async (id: string) => must(await world.admin.from('check_results').select('revealed, undone').eq('id', id).single());

/** A fresh campaign with an expedition under way: one secret result the GM undid, one live secret result; the
 * expedition ended, then the GM taps Start downtime. */
async function downtimeWithAnUndoneResult() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Sunken Reed Ford', created_by: world.gm.id }).select().single());
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaign.id, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaign.id, user_id: world.playerA.id, base_role: 'player' },
      ])
      .select(),
  );
  const campaignId = campaign.id as string;
  const expedition = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
  const undone = await ok(as(world.gm, recordCheck, { campaignId, record: { ...record, name: 'Listen at the wrong door' } }));
  await ok(as(world.gm, undoChange, { campaignId, eventId: await latestEvent(campaignId, 'check.record'), authorUserId: world.gm.id }));
  const live = await ok(as(world.gm, recordCheck, { campaignId, record: { ...record, name: 'Listen for reed wraiths' } }));
  await ok(as(world.gm, endExpedition, { campaignId, expedition }));
  const started = await as(world.gm, startDowntime, { campaignId, refills: {} });
  return { campaignId, undone, live, started };
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('going into Downtime with an undone secret check result', () => {
  it.fails('goes into Downtime without an error, and the undone result stays unrevealed', async () => {
    const { campaignId, undone, started } = await downtimeWithAnUndoneResult();
    expect(started).toMatchObject({ ok: true });
    expect(must(await world.admin.from('campaigns').select('mode').eq('id', campaignId).single())).toEqual({ mode: 'downtime' });
    expect(await revealedOf(undone.id)).toEqual({ revealed: false, undone: true });
  });

  it.fails('a live secret result in the same campaign is revealed as before, and players read it', async () => {
    const { campaignId, live } = await downtimeWithAnUndoneResult();
    expect(await revealedOf(live.id)).toEqual({ revealed: true, undone: false });
    expect((await loadCheckResults(asDb(world.playerA), campaignId))!.map((r) => r.name)).toEqual(['Listen for reed wraiths']);
  });
});
