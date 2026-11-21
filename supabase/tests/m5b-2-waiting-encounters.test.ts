// M5b step 2: Encounter waiting (supabase/migrations/20261103100000_m5b_2_waiting_encounters.sql; docs/05 "Encounter
// waiting", ruled 2026-10-30, D11 and S2-4). TEST project only; invented checks.
//   A hit queues exactly one card (a second queue of the same hit gives back the first); a miss can't be queued.
//   Players never receive waiting encounters: no rows, no log lines, and they can't queue, start or dismiss one.
//   Dismiss removes the card and Undo brings it back; Start marks it started (Undo puts it back); a card already
//   started can't be dismissed. Undoing the hit hides its card; undoing the queue marks it undone (nothing removed).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { dismissEncounter, loadWaitingEncounters, queueEncounter, startEncounter } from '../../src/modules/expedition/encounterPlay.ts';
import { recordCheck, type CheckResult } from '../../src/modules/expedition/reminderPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let expeditionId: string;
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
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });
const hitOf = (name: string, outcome: 'hit' | 'miss' = 'hit') =>
  ok(as(world.gm, recordCheck, { campaignId: world.campaignId, record: { checkKey: `check:mode:${name}`, name, source: 'mode', outcome, modifiers: [] } })) as Promise<CheckResult>;
const waitingNames = async (person: Person) => (await loadWaitingEncounters(asDb(person), world.campaignId, expeditionId))?.map((c) => c.hit.name) ?? null;

beforeAll(async () => {
  world = await buildWorld();
  must(await world.admin.from('expeditions').update({ ended_at: 0, summary: { seconds: 0 } }).eq('campaign_id', world.campaignId).is('ended_at', null).eq('undone', false).select());
  expeditionId = must(await world.admin.from('expeditions').insert({ campaign_id: world.campaignId, mode: 'dungeon' }).select().single()).id as string;
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('Encounter waiting (D11, S2-4)', () => {
  it('a hit queues exactly one card, newest first; a miss is refused in words', async () => {
    const first = await hitOf('Wandering bog lurkers');
    const card = await ok(as(world.gm, queueEncounter, { campaignId: world.campaignId, result: first }));
    const again = await ok(as(world.gm, queueEncounter, { campaignId: world.campaignId, result: first }));
    expect(again.id).toBe(card.id);
    expect(card).toMatchObject({ state: 'waiting', expeditionId, watch: null });
    const second = await hitOf('Lantern wardens on the road');
    await ok(as(world.gm, queueEncounter, { campaignId: world.campaignId, result: second }));
    expect(await waitingNames(world.gm)).toEqual(['Lantern wardens on the road', 'Wandering bog lurkers']);
    const miss = await hitOf('Quiet marsh', 'miss');
    const refused = await as(world.gm, queueEncounter, { campaignId: world.campaignId, result: miss });
    expect(refused.ok ? 'queued' : refused.message).toBe('Only a hit that stands can wait as an encounter.');
    const lines = must(await world.admin.from('events').select('level, audience').eq('campaign_id', world.campaignId).eq('type', 'encounter.queue'));
    expect(lines.every((l) => l.level === 'verbose' && l.audience === 'gm')).toBe(true);
  });

  it("players never receive waiting encounters, nor their log lines, and can't queue, start or dismiss one", async () => {
    expect(await waitingNames(world.playerA)).toEqual([]);
    expect(must(await world.playerA.db.from('waiting_encounters').select('id').eq('campaign_id', world.campaignId))).toEqual([]);
    expect(must(await world.playerB.db.from('waiting_encounters').select('id').eq('campaign_id', world.campaignId))).toEqual([]);
    expect(must(await world.playerA.db.from('events').select('id').eq('campaign_id', world.campaignId).like('type', 'encounter.%'))).toEqual([]);
    const card = must(await world.admin.from('waiting_encounters').select('id, check_result_id').eq('campaign_id', world.campaignId).limit(1))[0]!;
    expect((await world.playerA.db.rpc('queue_encounter', { result: card.check_result_id as string })).error?.code).toBe('42501');
    expect((await world.playerA.db.rpc('dismiss_encounter', { encounter: card.id as string })).error?.code).toBe('42501');
    expect((await world.playerB.db.rpc('start_encounter', { encounter: card.id as string })).error?.code).toBe('42501');
    const direct = await world.playerA.db.from('waiting_encounters').insert({ campaign_id: world.campaignId, check_result_id: card.check_result_id as string }).select();
    expect(direct.error).toBeTruthy();
  });

  it('Dismiss removes the card and Undo brings it back; Start marks it started and its Undo puts it back', async () => {
    const hit = await hitOf('Moth swarm');
    const card = await ok(as(world.gm, queueEncounter, { campaignId: world.campaignId, result: hit }));
    const dismissed = await ok(as(world.gm, dismissEncounter, { campaignId: world.campaignId, encounter: card }));
    expect(dismissed.state).toBe('dismissed');
    expect(await waitingNames(world.gm)).not.toContain('Moth swarm');
    await ok(undo(world.gm, world.campaignId, await latestEvent(world.campaignId, 'encounter.dismiss')));
    expect(await waitingNames(world.gm)).toContain('Moth swarm');
    const back = must(await world.admin.from('waiting_encounters').select('version').eq('id', card.id).single());
    const started = await ok(as(world.gm, startEncounter, { campaignId: world.campaignId, encounter: { ...card, version: back.version as number } }));
    expect(started.state).toBe('started');
    expect(await waitingNames(world.gm)).not.toContain('Moth swarm');
    const late = await as(world.gm, dismissEncounter, { campaignId: world.campaignId, encounter: started });
    expect(late.ok ? 'dismissed' : late.message).toBe('That encounter was already started.');
    await ok(undo(world.gm, world.campaignId, await latestEvent(world.campaignId, 'encounter.start')));
    expect(await waitingNames(world.gm)).toContain('Moth swarm');
  });

  it('undoing the hit hides its card; undoing the queue marks it undone, and nothing is removed', async () => {
    const hit = await hitOf('Reed-cat prowl');
    const card = await ok(as(world.gm, queueEncounter, { campaignId: world.campaignId, result: hit }));
    await ok(undo(world.gm, world.campaignId, await latestEvent(world.campaignId, 'encounter.queue')));
    expect(await waitingNames(world.gm)).not.toContain('Reed-cat prowl');
    expect(must(await world.admin.from('waiting_encounters').select('undone').eq('id', card.id).single()).undone).toBe(true);
    // Queued again, then the hit itself undone: the card goes with it.
    await ok(as(world.gm, queueEncounter, { campaignId: world.campaignId, result: hit }));
    expect(await waitingNames(world.gm)).toContain('Reed-cat prowl');
    await ok(undo(world.gm, world.campaignId, await latestEvent(world.campaignId, 'check.record')));
    expect(await waitingNames(world.gm)).not.toContain('Reed-cat prowl');
    expect(must(await world.admin.from('waiting_encounters').select('id').eq('check_result_id', hit.id))).toHaveLength(2);
  });
});
