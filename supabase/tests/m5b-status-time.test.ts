// The GM's time-left stepper (supabase/migrations/20261108120000_m5b_status_time.sql; follow-up to the status rings,
// #560; plan m5b-creation-retest-3 F). TEST project only; invented statuses.
//   The GM sets a timed status's time left from the clock's now; it is logged (status.setTime, Simple) and Undo puts
//   the time back. Past its whole length the length grows with it.
//   A player (even the character's own) and an outsider are refused, by the app and by the function; nothing changes.
//   A secret timer is set in status_secrets: the status row never gets the time, and a player never sees the change.
//   Refused: a status with no timer, under 1 second left, one that has ended.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { toCharacterRef } from '../../src/modules/characters/commands.ts';
import { advanceTime, toClock, type Clock } from '../../src/modules/expedition/play.ts';
import { addStatus, removeStatus, setStatusTime, toCharacterStatus, type CharacterStatus, type NewStatus } from '../../src/modules/expedition/statusPlay.ts';
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

/** A fresh campaign with the world's GM and both players, and an approved character for player A. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reedmouth Ferry', created_by: world.gm.id }).select().single());
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
  const reed = must(
    await world.admin
      .from('actors')
      .insert({ campaign_id: campaign.id, kind: 'pc', name: 'Reed the Ferrywarden', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 })
      .select()
      .single(),
  );
  return { campaignId: campaign.id as string, reed: toCharacterRef(reed as Parameters<typeof toCharacterRef>[0]) };
}

const typed = (name: string, timer: { seconds: number; unit: string } | null, secret = false): NewStatus => ({ name, condition: null, timer, secret });
const clockOf = async (campaignId: string): Promise<Clock> => toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
const statusOf = async (id: string): Promise<CharacterStatus> => toCharacterStatus(must(await world.admin.from('character_statuses').select('*').eq('id', id).single()));
const secretOf = async (id: string) => must(await world.admin.from('status_secrets').select('ends_at, total_seconds').eq('id', id).single());
const eventsOf = async (requestId: string) => must(await world.admin.from('events').select('id, type, level, target_table, before, after').eq('request_id', requestId).order('seq'));
const turns = async (campaignId: string, n: number) => ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: n * TURN }));
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe("the GM's time-left stepper (status.setTime)", () => {
  it('its logged-commands row: Simple, the GM\'s only', async () => {
    expect(must(await world.admin.from('logged_commands').select('name, level, gm_only').eq('name', 'status.setTime'))).toEqual([{ name: 'status.setTime', level: 'simple', gm_only: true }]);
  });

  it('the GM sets the time left from the clock\'s now; logged Simple; Undo puts the time back', async () => {
    const { campaignId, reed } = await freshTable();
    await turns(campaignId, 2);
    const [made] = await ok(as(world.gm, addStatus, { target: { campaignId, characters: [reed], secret: false }, status: typed('Muddy boots', { seconds: 6 * TURN, unit: 'turn' }) }));
    expect(made).toMatchObject({ endsAt: 8 * TURN, totalSeconds: 6 * TURN });
    const requestId = crypto.randomUUID();
    const set = await ok(as(world.gm, setStatusTime, { character: reed, status: made!, secondsLeft: 4 * TURN }, requestId));
    expect(set).toMatchObject({ endsAt: 6 * TURN, totalSeconds: 6 * TURN });
    const events = await eventsOf(requestId);
    expect(events.map((e) => [e.type, e.level, e.target_table])).toEqual([['status.setTime', 'simple', 'character_statuses']]);
    expect(events[0]).toMatchObject({ before: { ends_at: 8 * TURN }, after: { ends_at: 6 * TURN } });
    // The player sees the line (it's their character's status, not a secret).
    expect(must(await world.playerA.db.from('events').select('type').eq('id', events[0]!.id as string))).toEqual([{ type: 'status.setTime' }]);
    expect(await undo(world.gm, campaignId, events[0]!.id as string)).toMatchObject({ ok: true });
    expect(await statusOf(made!.id)).toMatchObject({ endsAt: 8 * TURN, totalSeconds: 6 * TURN });
  });

  it('past its whole length the length grows with it; Undo puts both back', async () => {
    const { campaignId, reed } = await freshTable();
    const [made] = await ok(as(world.gm, addStatus, { target: { campaignId, characters: [reed], secret: false }, status: typed('Muddy boots', { seconds: 3 * TURN, unit: 'turn' }) }));
    const requestId = crypto.randomUUID();
    expect(await ok(as(world.gm, setStatusTime, { character: reed, status: made!, secondsLeft: 7 * TURN }, requestId))).toMatchObject({ endsAt: 7 * TURN, totalSeconds: 7 * TURN });
    expect(await undo(world.gm, campaignId, (await eventsOf(requestId))[0]!.id as string)).toMatchObject({ ok: true });
    expect(await statusOf(made!.id)).toMatchObject({ endsAt: 3 * TURN, totalSeconds: 3 * TURN });
  });

  it("a player (even the character's own) and an outsider can't: refused by the app and by the function; nothing changes", async () => {
    const { campaignId, reed } = await freshTable();
    const [made] = await ok(as(world.gm, addStatus, { target: { campaignId, characters: [reed], secret: false }, status: typed('Muddy boots', { seconds: 3 * TURN, unit: 'turn' }) }));
    expect(await as(world.playerA, setStatusTime, { character: reed, status: made!, secondsLeft: 9 * TURN })).toMatchObject({ ok: false, reason: 'not-allowed' });
    for (const person of [world.playerA, world.playerB, world.outsider]) {
      const through = await person.db.rpc('set_status_time', { status: made!.id, seconds_left: 9 * TURN });
      expect(through.error?.code).toBe('42501');
    }
    expect(await statusOf(made!.id)).toMatchObject({ endsAt: 3 * TURN, totalSeconds: 3 * TURN });
    expect(must(await world.admin.from('events').select('id').eq('campaign_id', campaignId).eq('type', 'status.setTime'))).toEqual([]);
  });

  it("a secret timer is set in status_secrets: the status row never gets the time, and a player never sees the change; Undo puts it back", async () => {
    const { campaignId, reed } = await freshTable();
    const [made] = await ok(as(world.gm, addStatus, { target: { campaignId, characters: [reed], secret: true }, status: typed('Fen-sight', { seconds: 4 * TURN, unit: 'turn' }, true) }));
    const requestId = crypto.randomUUID();
    await ok(as(world.gm, setStatusTime, { character: reed, status: made!, secondsLeft: 2 * TURN }, requestId));
    expect(await secretOf(made!.id)).toEqual({ ends_at: 2 * TURN, total_seconds: 4 * TURN });
    expect(await statusOf(made!.id)).toMatchObject({ endsAt: null, totalSeconds: null, secret: true });
    const events = await eventsOf(requestId);
    expect(events.map((e) => [e.type, e.target_table])).toEqual([['status.setTime', 'status_secrets']]);
    expect(must(await world.playerA.db.from('events').select('id').eq('request_id', requestId))).toEqual([]);
    expect(await undo(world.gm, campaignId, events[0]!.id as string)).toMatchObject({ ok: true });
    expect(await secretOf(made!.id)).toEqual({ ends_at: 4 * TURN, total_seconds: 4 * TURN });
  });

  it('refused: a status with no timer, under 1 second left, one that has ended', async () => {
    const { campaignId, reed } = await freshTable();
    const [endless] = await ok(as(world.gm, addStatus, { target: { campaignId, characters: [reed], secret: false }, status: typed('Shaken', null) }));
    const none = await as(world.gm, setStatusTime, { character: reed, status: endless!, secondsLeft: TURN });
    expect(none.ok ? 'set' : none.message).toBe('That status has no timer.');
    const [timed] = await ok(as(world.gm, addStatus, { target: { campaignId, characters: [reed], secret: false }, status: typed('Muddy boots', { seconds: 3 * TURN, unit: 'turn' }) }));
    const zero = await as(world.gm, setStatusTime, { character: reed, status: timed!, secondsLeft: 0 });
    expect(zero.ok ? 'set' : zero.message).toBe('It needs some time left. To end it, use End it now.');
    const ended = await ok(as(world.gm, removeStatus, { character: reed, status: timed! }));
    const late = await as(world.gm, setStatusTime, { character: reed, status: ended, secondsLeft: TURN });
    expect(late.ok ? 'set' : late.message).toBe('That status has already ended.');
  });
});
