// M5 step 5: the clock, sessions and expeditions (supabase/migrations/20261029170000_m5_clock.sql). TEST project
// only; invented content.
//   Every campaign has one clock, made with it at 0; everyone in the campaign reads it; only the GM moves it.
//   The same request sent twice moves the clock once; a move made from an old copy is refused and changes nothing.
//   Start expedition keeps where the clock was and who went (the approved, active characters, a snapshot that
//   never changes); one at a time; the campaign goes into Adventure, and back into Downtime at the end.
//   Undo: a clock move puts the time back; starting a session or an expedition marks the record undone (it stays);
//   ending one reopens it; a full rest puts the ability uses back (a row kept per character).
//   Full rest gives back only the named uses of characters who went, once per expedition.
//   Everyone sees the clock's log lines; the step 4 comparison function is out of reach.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, STALE, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { UNDOABLE_MAKINGS, undoChange } from '../../src/core/undo.ts';
import {
  advanceTime,
  endExpedition,
  endSession,
  fullRest,
  loadScene,
  setTime,
  startExpedition,
  startSession,
  toClock,
  type Clock,
  type Expedition,
} from '../../src/modules/expedition/play.ts';
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

/** A fresh campaign with the world's GM and both players, and two approved characters of its own. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Sunken Lantern Road', created_by: world.gm.id }).select().single());
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
  const pc = (name: string, owner: Person, extra: Record<string, unknown> = {}) => ({
    campaign_id: campaign.id,
    kind: 'pc',
    name,
    owner_type: 'user',
    owner_user_id: owner.id,
    approval: 'approved',
    // Every row names every column: one insert of several rows fills a missing one with null.
    status: 'active',
    level: 1,
    hp_current: null,
    hp_max: null,
    ...extra,
  });
  const [reed, moss, waiting, gone] = must(
    await world.admin
      .from('actors')
      .insert([
        pc('Reed the Ferrywarden', world.playerA, { level: 2, hp_current: 3, hp_max: 9 }),
        pc('Moss of the Bog Lights', world.playerB),
        pc('Not yet approved', world.playerA, { approval: 'pending' }),
        pc('Gone home', world.playerB, { status: 'archived' }),
      ])
      .select('id'),
  );
  return { campaignId: campaign.id as string, reedId: reed!.id as string, mossId: moss!.id as string, waitingId: waiting!.id as string, goneId: gone!.id as string };
}

const clockOf = async (campaignId: string): Promise<Clock> => toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
const eventsOf = async (requestId: string) => must(await world.admin.from('events').select('id, type, target_table, before, after, audience').eq('request_id', requestId).order('seq'));
const latestEvent = async (campaignId: string, type: string) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', type).order('seq', { ascending: false }).limit(1))[0]!.id as string;
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('the clock', () => {
  it('every campaign has one, made with it at 0 (and the ones already there got one too)', async () => {
    const { campaignId } = await freshTable();
    expect((await clockOf(campaignId)).seconds).toBe(0);
    expect((await clockOf(world.campaignId)).seconds).toBe(0);
  });

  it('everyone in the campaign reads it; an outsider reads nothing', async () => {
    const { campaignId } = await freshTable();
    const scene = await loadScene(asDb(world.playerA), campaignId);
    expect(scene?.clock?.seconds).toBe(0);
    expect(scene?.session).toBeNull();
    expect(scene?.expedition).toBeNull();
    expect(must(await world.outsider.db.from('campaign_clocks').select('id').eq('campaign_id', campaignId))).toEqual([]);
  });

  it("only the GM moves it: a player's change, made straight to the table or through the function, is refused", async () => {
    const { campaignId } = await freshTable();
    await world.playerA.db.from('campaign_clocks').update({ seconds: 9999 }).eq('campaign_id', campaignId);
    const refused = await world.playerA.db.rpc('advance_clock', { campaign: campaignId, by_seconds: 600 });
    expect(refused.error?.code).toBe('42501');
    expect((await clockOf(campaignId)).seconds).toBe(0);
  });

  it('the same request sent twice moves it once and logs once; one made from an old copy is refused', async () => {
    const { campaignId } = await freshTable();
    const clock = await clockOf(campaignId);
    const requestId = crypto.randomUUID();
    await ok(as(world.gm, advanceTime, { campaignId, clock, seconds: 600 }, requestId));
    const again = await as(world.gm, advanceTime, { campaignId, clock, seconds: 600 }, requestId);
    expect(again.ok).toBe(true);
    expect((await clockOf(campaignId)).seconds).toBe(600);
    expect((await eventsOf(requestId)).map((e) => e.type)).toEqual(['time.advance']);
    // From the copy before that move: refused, nothing changes.
    const stale = await as(world.gm, advanceTime, { campaignId, clock, seconds: 600 });
    expect(stale.ok ? 'applied' : stale.message).toBe(STALE);
    expect((await clockOf(campaignId)).seconds).toBe(600);
  });

  it('Set time… is a correction (its own log line) and can go back; undo puts the time back', async () => {
    const { campaignId } = await freshTable();
    await ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: 1800 }));
    await ok(as(world.gm, setTime, { campaignId, clock: await clockOf(campaignId), to: 600 }));
    expect((await clockOf(campaignId)).seconds).toBe(600);
    expect(await undo(world.gm, campaignId, await latestEvent(campaignId, 'time.set'))).toMatchObject({ ok: true });
    expect((await clockOf(campaignId)).seconds).toBe(1800);
    // The advance before it undoes too, once nothing later stands in the way.
    expect(await undo(world.gm, campaignId, await latestEvent(campaignId, 'time.advance'))).toMatchObject({ ok: true });
    expect((await clockOf(campaignId)).seconds).toBe(0);
  });

  it("players see the clock's log lines", async () => {
    const { campaignId } = await freshTable();
    await ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: 600 }));
    const seen = must(await world.playerB.db.from('events').select('type, audience').eq('campaign_id', campaignId).eq('type', 'time.advance'));
    expect(seen).toEqual([{ type: 'time.advance', audience: 'all' }]);
  });

  it('nothing moves in a retired campaign', async () => {
    const { campaignId } = await freshTable();
    must(await world.admin.from('campaigns').update({ retired_at: new Date().toISOString() }).eq('id', campaignId).select());
    const refused = await world.gm.db.rpc('advance_clock', { campaign: campaignId, by_seconds: 600 });
    expect(refused.error?.message).toMatch(/retired/);
  });
});

describe('sessions', () => {
  it('Start session numbers it and runs one at a time; it never moves the clock; End session ends it', async () => {
    const { campaignId } = await freshTable();
    const first = await ok(as(world.gm, startSession, { campaignId }));
    expect(first.number).toBe(1);
    const twice = await as(world.gm, startSession, { campaignId });
    expect(twice.ok ? 'started' : twice.message).toBe('A session is already running.');
    await ok(as(world.gm, endSession, { campaignId, session: first }));
    expect((await ok(as(world.gm, startSession, { campaignId }))).number).toBe(2);
    expect((await clockOf(campaignId)).seconds).toBe(0);
  });

  it('undoing a start marks the session undone (it stays), and the next one takes its number', async () => {
    const { campaignId } = await freshTable();
    const started = await ok(as(world.gm, startSession, { campaignId }));
    expect(await undo(world.gm, campaignId, await latestEvent(campaignId, 'session.start'))).toMatchObject({ ok: true });
    const kept = must(await world.admin.from('sessions').select('undone').eq('id', started.id).single());
    expect(kept.undone).toBe(true);
    const again = await undo(world.gm, campaignId, await latestEvent(campaignId, 'session.start'));
    expect(again.ok ? 'undone twice' : again.message).toBe('That was already undone.');
    expect((await ok(as(world.gm, startSession, { campaignId }))).number).toBe(1);
  });

  it('the app and the database list the same actions whose record undo marks undone', async () => {
    const rows = must(await world.playerA.db.from('undoable_makings').select('name'));
    expect(rows.map((r) => r.name as string).sort()).toEqual([...UNDOABLE_MAKINGS].sort());
  });

  it('a repeat of Start session gives back the session it started', async () => {
    const { campaignId } = await freshTable();
    const requestId = crypto.randomUUID();
    const first = await ok(as(world.gm, startSession, { campaignId }, requestId));
    const repeat = await ok(as(world.gm, startSession, { campaignId }, requestId));
    expect(repeat.id).toBe(first.id);
    expect(must(await world.admin.from('sessions').select('id').eq('campaign_id', campaignId))).toHaveLength(1);
  });
});

describe('expeditions', () => {
  it('Start expedition keeps where the clock was and who went (approved and active only); the campaign goes into Adventure', async () => {
    const { campaignId, reedId, mossId } = await freshTable();
    await ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: 3000 }));
    const session = await ok(as(world.gm, startSession, { campaignId }));
    const started = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    expect(started.startedAt).toBe(3000);
    expect([...started.whoWent].sort()).toEqual([reedId, mossId].sort());
    expect(must(await world.admin.from('expeditions').select('session_id').eq('id', started.id).single()).session_id).toBe(session.id);
    expect(must(await world.admin.from('campaigns').select('mode').eq('id', campaignId).single()).mode).toBe('adventure');
    const second = await as(world.gm, startExpedition, { campaignId, mode: 'wilderness' });
    expect(second.ok ? 'started' : second.message).toBe('An expedition is already under way. End it first.');
  });

  it('who went is a snapshot: a character approved later, or the GM, never changes it', async () => {
    const { campaignId, waitingId } = await freshTable();
    const started = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    must(await world.admin.from('actors').update({ approval: 'approved' }).eq('id', waitingId).select());
    const changed = await world.gm.db.from('expeditions').update({ who_went: [waitingId] }).eq('id', started.id).select();
    expect(changed.error?.message).toBe("That can't be changed.");
    const row = must(await world.admin.from('expeditions').select('who_went').eq('id', started.id).single());
    expect(row.who_went).toEqual(started.whoWent);
    expect(row.who_went).not.toContain(waitingId);
  });

  it("a player can't start one, straight to the table or through the function", async () => {
    const { campaignId } = await freshTable();
    const direct = await world.playerA.db.from('expeditions').insert({ campaign_id: campaignId, mode: 'dungeon' }).select();
    expect(direct.error?.code).toBe('42501');
    const through = await world.playerA.db.rpc('start_expedition', { campaign: campaignId, mode_id: 'dungeon' });
    expect(through.error?.code).toBe('42501');
  });

  it('End expedition keeps how long it took and leaves the campaign in Adventure (dt-2, M5b step 6a); undo opens it again', async () => {
    const { campaignId } = await freshTable();
    const started = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    await ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: 1800 }));
    const ended = await ok(as(world.gm, endExpedition, { campaignId, expedition: started }));
    expect(ended.endedAt).toBe(1800);
    expect(ended.summary).toEqual({ seconds: 1800, fullRest: false });
    expect(must(await world.admin.from('campaigns').select('mode').eq('id', campaignId).single()).mode).toBe('adventure');
    // Ending it again from the same (old) copy: refused.
    const again = await as(world.gm, endExpedition, { campaignId, expedition: started });
    expect(again.ok).toBe(false);

    expect(await undo(world.gm, campaignId, await latestEvent(campaignId, 'expedition.end'))).toMatchObject({ ok: true });
    const open = await loadScene(asDb(world.gm), campaignId);
    expect(open?.expedition?.id).toBe(started.id);
    expect(open?.expedition?.endedAt).toBeNull();
    expect(must(await world.admin.from('campaigns').select('mode').eq('id', campaignId).single()).mode).toBe('adventure');
  });

  it('undoing a start marks the expedition undone (it stays) and puts the campaign back as it was', async () => {
    const { campaignId } = await freshTable();
    const started = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    expect(await undo(world.gm, campaignId, await latestEvent(campaignId, 'expedition.start'))).toMatchObject({ ok: true });
    expect(must(await world.admin.from('expeditions').select('undone').eq('id', started.id).single()).undone).toBe(true);
    expect(must(await world.admin.from('campaigns').select('mode').eq('id', campaignId).single()).mode).toBe('downtime');
    expect((await loadScene(asDb(world.gm), campaignId))?.expedition).toBeNull();
    // An undone expedition can't be ended or changed any more.
    const ended = await as(world.gm, endExpedition, { campaignId, expedition: started });
    expect(ended.ok ? 'ended' : ended.message).toBe('That expedition was undone.');
  });

  it("a start can't be undone once the expedition has ended (undo the end first)", async () => {
    const { campaignId } = await freshTable();
    const started = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    await ok(as(world.gm, endExpedition, { campaignId, expedition: started }));
    const refused = await undo(world.gm, campaignId, await latestEvent(campaignId, 'expedition.start'));
    expect(refused.ok ? 'undone' : refused.message).toBe("That's changed since. Undo the later change first.");
  });
});

describe('the full rest', () => {
  async function ended() {
    const table = await freshTable();
    must(
      await world.admin
        .from('character_play')
        .insert([
          { actor_id: table.reedId, campaign_id: table.campaignId, uses_spent: { 'Lantern ward': 2, 'Fen fury': 1 } },
          { actor_id: table.waitingId, campaign_id: table.campaignId, uses_spent: { 'Lantern ward': 1 } },
        ])
        .select(),
    );
    const started = await ok(as(world.gm, startExpedition, { campaignId: table.campaignId, mode: 'dungeon' }));
    const done: Expedition = await ok(as(world.gm, endExpedition, { campaignId: table.campaignId, expedition: started }));
    return { ...table, expedition: done };
  }
  const spent = async (actorId: string) => must(await world.admin.from('character_play').select('uses_spent').eq('actor_id', actorId).single()).uses_spent;

  it('gives back only the named uses, only for those who went, once', async () => {
    const { campaignId, reedId, waitingId, expedition } = await ended();
    const rested = await ok(as(world.gm, fullRest, { campaignId, expedition, refills: { [reedId]: ['Lantern ward'], [waitingId]: ['Lantern ward'] } }));
    expect(rested.summary?.fullRest).toBe(true);
    expect(await spent(reedId)).toEqual({ 'Fen fury': 1 });
    expect(await spent(waitingId)).toEqual({ 'Lantern ward': 1 });
    const twice = await as(world.gm, fullRest, { campaignId, expedition, refills: {} });
    expect(twice.ok ? 'rested twice' : twice.message).toBe('The party has had its full rest.');
  });

  it('undoes from the log: the uses are spent again; and the end then needs the rest undone first', async () => {
    const { campaignId, reedId, expedition } = await ended();
    await ok(as(world.gm, fullRest, { campaignId, expedition, refills: { [reedId]: ['Lantern ward'] } }));
    const endFirst = await undo(world.gm, campaignId, await latestEvent(campaignId, 'expedition.end'));
    expect(endFirst.ok ? 'undone' : endFirst.message).toBe("That's changed since. Undo the later change first.");
    expect(await undo(world.gm, campaignId, await latestEvent(campaignId, 'expedition.fullRest'))).toMatchObject({ ok: true });
    expect(await spent(reedId)).toEqual({ 'Lantern ward': 2, 'Fen fury': 1 });
  });

  it("a player can't give the party a full rest", async () => {
    const { expedition } = await ended();
    const refused = await world.playerA.db.rpc('full_rest', { expedition: expedition.id, refills: {} });
    expect(refused.error?.code).toBe('42501');
  });
});

describe('the M5 step 4 comparison function', () => {
  it('is out of the public schema: nobody reaches it through the API, not even the service key', async () => {
    expect((await world.admin.rpc('log_audience_check', { table_name: 'notes', old_row: null, new_row: {} })).error).not.toBeNull();
  });
});
