// m8b-0 delivery 5: In a safe place? on End expedition's summary (ruled 2026-11-06;
// supabase/migrations/20261106130000_m8b_0_safe_place_answer.sql). TEST project only; invented content.
//   Purpose: the GM's answer is kept with the expedition's end (one Verbose line, read back as it is), the other answer
//   changes it and the same answer writes nothing; it can't be given while the expedition is under way, nor by a
//   player; Undo of End puts the expedition back and forgets the answer; a new expedition starts unanswered.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { answerSafePlace, endExpedition, startExpedition } from '../../src/modules/expedition/play.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
const eventsOf = async (type: string) =>
  must(await world.admin.from('events').select('id, level, target_table, before, after').eq('campaign_id', world.campaignId).eq('type', type).order('seq'));
const answerOf = async (id: string) => must(await world.admin.from('expeditions').select('ended_at, ended_safe').eq('id', id).single());

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('In a safe place? (m8b-0 delivery 5)', () => {
  it("keeps the GM's answer with the expedition's end, and Undo of End forgets it", async () => {
    const started = await as(world.gm, startExpedition, { campaignId: world.campaignId, mode: 'quay', place: 'Quay Gate' });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    // Not while it's under way.
    const early = await as(world.gm, answerSafePlace, { campaignId: world.campaignId, expedition: started.value, safe: true });
    expect(early.ok).toBe(false);

    const ended = await as(world.gm, endExpedition, { campaignId: world.campaignId, expedition: started.value });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.value.endedSafe).toBeNull();

    // A player can't answer.
    const sneaky = await as(world.playerA, answerSafePlace, { campaignId: world.campaignId, expedition: ended.value, safe: false });
    expect(sneaky.ok).toBe(false);

    // Yes: one Verbose line, read back.
    const yes = await as(world.gm, answerSafePlace, { campaignId: world.campaignId, expedition: ended.value, safe: true });
    expect(yes).toMatchObject({ ok: true, value: { endedSafe: true } });
    let lines = await eventsOf('expedition.safePlace');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 'verbose', target_table: 'expeditions', before: { ended_safe: null }, after: { ended_safe: true } });
    // The same answer again writes nothing; the other one changes it.
    expect((await as(world.gm, answerSafePlace, { campaignId: world.campaignId, expedition: ended.value, safe: true })).ok).toBe(true);
    expect(await eventsOf('expedition.safePlace')).toHaveLength(1);
    expect(await as(world.gm, answerSafePlace, { campaignId: world.campaignId, expedition: ended.value, safe: false })).toMatchObject({ ok: true, value: { endedSafe: false } });
    lines = await eventsOf('expedition.safePlace');
    expect(lines).toHaveLength(2);
    expect((await answerOf(started.value.id)).ended_safe).toBe(false);

    // Undo of End: the expedition is under way again and the answer is gone.
    const end = (await eventsOf('expedition.end')).find((e) => e.target_table === 'expeditions')!;
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: end.id as string, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(await answerOf(started.value.id)).toEqual({ ended_at: null, ended_safe: null });

    // Ended again, it starts unanswered.
    const again = must(await world.admin.from('expeditions').select('*').eq('id', started.value.id).single());
    const reEnded = await as(world.gm, endExpedition, { campaignId: world.campaignId, expedition: { ...started.value, version: again.version as number } });
    expect(reEnded).toMatchObject({ ok: true, value: { endedSafe: null } });
  });
});
