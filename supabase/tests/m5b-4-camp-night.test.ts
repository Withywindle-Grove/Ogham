// M5b step 4, part 2: camp's night (supabase/migrations/20261103170000_m5b_4_camp_night.sql; ruled 2026-10-30,
// D18–D20). TEST project only; invented characters.
//   The group's players set the watches (each 1–3 of the group's own characters); the newest order stands and Undo
//   brings back the one before. A player records their own character's sleep but can't change its difficulty or
//   record another's; the GM can. Next day applies the camp in the clock's move: the camp takes no more steps, and the
//   move's Undo opens it again. Which watch? is the GM's, on a night hit's waiting card.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { latestChange, undoChange } from '../../src/core/undo.ts';
import { sleepRecords, watchesOf } from '../../src/modules/expedition/camp.ts';
import { campSleep, campTalk, loadCamps, openCamp, setCampWatches } from '../../src/modules/expedition/campPlay.ts';
import { queueEncounter, setEncounterWatch } from '../../src/modules/expedition/encounterPlay.ts';
import { advanceTime, loadScene, startExpedition } from '../../src/modules/expedition/play.ts';
import { recordCheck, type CheckResult } from '../../src/modules/expedition/reminderPlay.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
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

/** A fresh campaign: Reed and Fern (A's), Moss (B's), an expedition under way and the party's camp made. */
async function freshNight() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Fen Crossing', created_by: world.gm.id }).select().single());
  const campaignId = campaign.id as string;
  must(
    await world.admin
      .from('members')
      .insert([
        { campaign_id: campaignId, user_id: world.gm.id, base_role: 'gm' },
        { campaign_id: campaignId, user_id: world.playerA.id, base_role: 'player' },
        { campaign_id: campaignId, user_id: world.playerB.id, base_role: 'player' },
      ])
      .select(),
  );
  const pc = (name: string, owner: Person) => ({ campaign_id: campaignId, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [reed, fern, moss] = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Fern', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select('id')) as { id: string }[];
  const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'wilderness', place: 'The Reed Jetty' }));
  const camp = await ok(as(world.playerA, openCamp, { target: { campaignId, group: 1, mine: true }, day: 0 }));
  const of = (id: string, owner: Person) => ({ campaignId, id, ownerUserId: owner.id });
  return { campaignId, trip: trip.id, camp, reed: of(reed!.id, world.playerA), fern: of(fern!.id, world.playerA), moss: of(moss!.id, world.playerB) };
}
type Night = Awaited<ReturnType<typeof freshNight>>;
const entriesOf = async (t: Night) => (await loadCamps(asDb(world.gm), t.campaignId, t.trip, 0))?.get(1)?.entries ?? [];
async function undoLatest(person: Person, t: Night, type: string) {
  const user = await userOf(person);
  const eventId = await latestChange(asDb(person), t.campaignId, type, user.id);
  return runCommand(registry, asDb(person), user, undoChange, { campaignId: t.campaignId, eventId: eventId!, authorUserId: user.id });
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe("camp's night (D18–D20)", () => {
  it('the group sets its watches, 1–3 each; the newest order stands; Undo brings back the one before', async () => {
    const t = await freshNight();
    await ok(as(world.playerA, setCampWatches, { campId: t.camp.id, actor: t.reed, watches: [[t.reed.id], [t.moss.id, t.fern.id]] }));
    // Player B changes the group's order (it's the group's, not one player's).
    await ok(as(world.playerB, setCampWatches, { campId: t.camp.id, actor: t.moss, watches: [[t.moss.id], [t.reed.id]] }));
    expect(watchesOf(await entriesOf(t))).toEqual([[t.moss.id], [t.reed.id]]);
    // Four on one watch, a name twice, or nobody: refused.
    expect((await as(world.playerA, setCampWatches, { campId: t.camp.id, actor: t.reed, watches: [[t.reed.id, t.fern.id, t.moss.id, t.reed.id]] })).ok).toBe(false);
    expect((await as(world.playerA, setCampWatches, { campId: t.camp.id, actor: t.reed, watches: [[t.reed.id], [t.reed.id]] })).ok).toBe(false);
    expect((await as(world.playerA, setCampWatches, { campId: t.camp.id, actor: t.reed, watches: [[]] })).ok).toBe(false);
    expect((await undoLatest(world.playerB, t, 'camp.watches')).ok).toBe(true);
    expect(watchesOf(await entriesOf(t))).toEqual([[t.reed.id], [t.moss.id, t.fern.id]]);
  });

  it("a player records their own character's sleep, not its difficulty and not another's; the GM can", async () => {
    const t = await freshNight();
    await ok(as(world.playerA, campSleep, { campId: t.camp.id, actor: t.reed, roll: '5', outcome: 'good' }));
    expect((await world.playerA.db.rpc('camp_sleep', { camp: t.camp.id, actor: t.reed.id, difficulty: 'easy' })).error).not.toBeNull();
    expect((await world.playerB.db.rpc('camp_sleep', { camp: t.camp.id, actor: t.reed.id, outcome: 'bad' })).error).not.toBeNull();
    await ok(as(world.gm, campSleep, { campId: t.camp.id, actor: t.moss, difficulty: 'grim' }));
    await ok(as(world.gm, campSleep, { campId: t.camp.id, actor: t.moss, outcome: 'bad' }));
    const sleep = sleepRecords(await entriesOf(t));
    expect(sleep.get(t.reed.id)).toEqual({ difficulty: null, roll: '5', outcome: 'good' });
    expect(sleep.get(t.moss.id)).toEqual({ difficulty: 'grim', roll: null, outcome: 'bad' });
  });

  it("Next day applies the camp in the clock's move; the camp takes no more steps; the move's Undo opens it again", async () => {
    const t = await freshNight();
    const clock = (await loadScene(asDb(world.gm), t.campaignId))!.clock!;
    await ok(as(world.gm, advanceTime, { campaignId: t.campaignId, clock, seconds: 86400, camps: [t.camp.id] }));
    const applied = must(await world.admin.from('camps').select('applied_at').eq('id', t.camp.id).single());
    expect(applied.applied_at).toBe(clock.seconds + 86400);
    expect((await as(world.playerA, campTalk, { campId: t.camp.id, actor: t.reed, outcome: 'worked' })).ok).toBe(false);
    // A player can't apply a camp.
    expect((await world.playerA.db.rpc('apply_camps', { campaign: t.campaignId, camps: [t.camp.id] })).error).not.toBeNull();
    expect((await undoLatest(world.gm, t, 'time.advance')).ok).toBe(true);
    expect(must(await world.admin.from('camps').select('applied_at').eq('id', t.camp.id).single()).applied_at).toBeNull();
    await ok(as(world.playerA, campTalk, { campId: t.camp.id, actor: t.reed, outcome: 'worked' }));
  });

  it('Which watch? is the GM’s, on a night hit’s waiting card', async () => {
    const t = await freshNight();
    const hit = (await ok(as(world.gm, recordCheck, { campaignId: t.campaignId, record: { checkKey: 'check:mode:fen-night', name: 'Night prowlers', source: 'mode', outcome: 'hit', modifiers: [] } }))) as CheckResult;
    const card = await ok(as(world.gm, queueEncounter, { campaignId: t.campaignId, result: hit }));
    expect((await world.playerA.db.rpc('set_encounter_watch', { encounter: card.id, watch: '2nd watch · Reed' })).error).not.toBeNull();
    const set = await ok(as(world.gm, setEncounterWatch, { campaignId: t.campaignId, encounter: card, watch: '2nd watch · Reed the Ferrywarden' }));
    expect(set.watch).toBe('2nd watch · Reed the Ferrywarden');
    const undoneWatch = await undoLatest(world.gm, t, 'encounter.watch');
    expect(undoneWatch.ok ? 'ok' : undoneWatch.message).toBe('ok');
    expect(must(await world.admin.from('waiting_encounters').select('watch').eq('id', card.id).single()).watch).toBeNull();
  });
});
