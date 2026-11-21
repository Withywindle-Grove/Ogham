// M5 step 9: statuses and rest (supabase/migrations/20261031120000_m5_statuses.sql; docs/04 "Status"; docs/05 "Status
// symbols", "Rest"; docs/03 "Add or remove a status", "Rest this turn"; ruled 2026-10-29 D27 and the technical ruling
// on secret timers, 2026-10-30 DG5, WA3). TEST project only; invented statuses and conditions.
//   The GM adds statuses (C1, 2026-11-01: never the player); the GM or the character's owner removes and steps them; everyone in the campaign sees an approved character's
//   statuses; a secret timer lives in a table only the GM reads, so a player's device never gets it. A condition that
//   stacks adds 1; one with levels steps up and down. Timers end with the clock's move, in its request (logged
//   status.timerEnd, Simple), and Undo puts them back; Set time… backwards gives them their time back up to their
//   whole length. Rest this turn is the character's choice; the GM's Next turn applies it (logged rest.taken) and ends
//   the rest condition Push on marked; only the GM pushes on.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { toCharacterRef } from '../../src/modules/characters/commands.ts';
import { advanceTime, setTime, toClock, type Clock } from '../../src/modules/expedition/play.ts';
import { addStatus, chooseRest, pushOn, removeStatus, stepStatus, toCharacterStatus, type CharacterStatus, type Condition, type NewStatus } from '../../src/modules/expedition/statusPlay.ts';
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

/** Every timer value in some log rows: a key that names a timer with a value, or a number equal to a timer length
 *  used in these tests (up to 4 turns). Ids and timestamps are left alone. */
function timerValuesIn(rows: unknown): unknown[] {
  const found: unknown[] = [];
  const timerKey = /^(ends_at|total_seconds|timer_seconds|unit|endsAt|totalSeconds)$/;
  const lengths = new Set([TURN, 2 * TURN, 3 * TURN, 4 * TURN]);
  const walk = (v: unknown, key?: string) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
    else if (key && timerKey.test(key) && v != null) found.push({ [key]: v });
    else if (typeof v === 'number' && lengths.has(v)) found.push(v);
  };
  walk(rows);
  return found;
}

/** A fresh campaign with the world's GM and both players, and an approved character each. */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Fen Lantern Road', created_by: world.gm.id }).select().single());
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
  const pc = (name: string, owner: Person) => ({ campaign_id: campaign.id, kind: 'pc', name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [reed, moss] = must(await world.admin.from('actors').insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB)]).select());
  const ref = (row: unknown) => toCharacterRef(row as Parameters<typeof toCharacterRef>[0]);
  return { campaignId: campaign.id as string, reed: ref(reed), moss: ref(moss) };
}

type Who = { id: string; campaignId: string; ownerUserId: string | null };
const target = (campaignId: string, characters: Who[], secret = false) => ({ campaignId, characters, secret });
const typed = (name: string, timer: { seconds: number; unit: string } | null = null, secret = false): NewStatus => ({ name, condition: null, timer, secret });
const condition = (c: Partial<Condition> & { id: string; name: string }): NewStatus => ({
  name: c.name,
  condition: { icon: null, stacks: false, levels: null, defaultRounds: null, note: null, ...c },
  timer: null,
  secret: false,
});

const clockOf = async (campaignId: string): Promise<Clock> => toClock(must(await world.admin.from('campaign_clocks').select('*').eq('campaign_id', campaignId).single()));
const statusOf = async (id: string): Promise<CharacterStatus> => toCharacterStatus(must(await world.admin.from('character_statuses').select('*').eq('id', id).single()));
const eventsOf = async (requestId: string) => must(await world.admin.from('events').select('id, type, level, target_table, before, after').eq('request_id', requestId).order('seq'));
const turns = async (campaignId: string, n: number, requestId?: string) => ok(as(world.gm, advanceTime, { campaignId, clock: await clockOf(campaignId), seconds: n * TURN }, requestId));
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('+ Status and Remove (03: the GM and the owner)', () => {
  it("the GM adds a typed status to a player's character: everyone sees it, an outsider doesn't; logged Simple; Undo marks it undone", async () => {
    const { campaignId, reed } = await freshTable();
    const requestId = crypto.randomUUID();
    const [made] = await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: typed('Muddy boots') }, requestId));
    expect(made).toMatchObject({ actorId: reed.id, name: 'Muddy boots', source: 'typed', stacks: 1, endsAt: null, secret: false });
    expect(must(await world.playerB.db.from('character_statuses').select('name').eq('id', made!.id))).toEqual([{ name: 'Muddy boots' }]);
    expect(must(await world.outsider.db.from('character_statuses').select('id').eq('id', made!.id))).toEqual([]);
    const events = await eventsOf(requestId);
    expect(events.map((e) => [e.type, e.level, e.target_table])).toEqual([['status.add', 'simple', 'character_statuses']]);
    expect(await undo(world.gm, campaignId, events[0]!.id as string)).toMatchObject({ ok: true });
    expect((await statusOf(made!.id)).endedAt).toBeNull();
    expect(must(await world.admin.from('character_statuses').select('undone').eq('id', made!.id).single()).undone).toBe(true);
  });

  it("a player can't put a status on their own character (C1): refused by the app, the function and the table", async () => {
    const { campaignId, reed } = await freshTable();
    const refused = await as(world.playerA, addStatus, { target: target(campaignId, [reed]), status: typed('Muddy boots') });
    expect(refused).toMatchObject({ ok: false, reason: 'not-allowed' });
    const through = await world.playerA.db.rpc('add_status', { campaign: campaignId, actors: [reed.id], status_name: 'Muddy boots' });
    expect([through.error?.code, through.error?.message]).toEqual(['42501', 'Only the GM gives a status.']);
    const direct = await world.playerA.db.from('character_statuses').insert({ campaign_id: campaignId, actor_id: reed.id, name: 'Muddy boots' }).select();
    expect(direct.error?.code).toBe('42501');
    // Nor by putting one on again that the GM gave (which would stack it or step it up).
    const dazed = condition({ id: 'dazed', name: 'Dazed', stacks: true });
    const [given] = await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: dazed }));
    const again = await world.playerA.db.rpc('add_status', { campaign: campaignId, actors: [reed.id], status_name: 'Dazed', condition_id: 'dazed', stacking: true });
    expect(again.error?.code).toBe('42501');
    expect((await statusOf(given!.id)).stacks).toBe(1);
  });

  it("a player can't put a status on someone else's character, straight to the table or through the function", async () => {
    const { campaignId, reed } = await freshTable();
    const refused = await as(world.playerB, addStatus, { target: target(campaignId, [{ ...reed, ownerUserId: world.playerB.id }]), status: typed('Soaked') });
    expect(refused).toMatchObject({ ok: false, reason: 'not-allowed' });
    const direct = await world.playerB.db.from('character_statuses').insert({ campaign_id: campaignId, actor_id: reed.id, name: 'Soaked' }).select();
    expect(direct.error?.code).toBe('42501');
    expect(must(await world.admin.from('character_statuses').select('id').eq('actor_id', reed.id))).toEqual([]);
  });

  it("Remove ends it now (the owner or the GM); another player can't; Undo puts it back", async () => {
    const { campaignId, reed } = await freshTable();
    await turns(campaignId, 2);
    const [made] = await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: typed('Shaken') }));
    const notTheirs = await world.playerB.db.rpc('remove_status', { status: made!.id });
    expect(notTheirs.error?.code).toBe('42501');
    const requestId = crypto.randomUUID();
    const removed = await ok(as(world.playerA, removeStatus, { character: reed, status: made! }, requestId));
    expect(removed).toMatchObject({ endedAt: 2 * TURN });
    const again = await as(world.playerA, removeStatus, { character: reed, status: removed });
    expect(again.ok ? 'removed' : again.message).toBe('That status has already ended.');
    expect(await undo(world.playerA, campaignId, (await eventsOf(requestId))[0]!.id as string)).toMatchObject({ ok: true });
    expect((await statusOf(made!.id)).endedAt).toBeNull();
  });
});

describe('stacks and ordered levels (07 conditions; WA3)', () => {
  it('a condition that stacks adds 1 each time it is put on again', async () => {
    const { campaignId, reed } = await freshTable();
    const weary = condition({ id: 'weary', name: 'Weary', stacks: true });
    await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: weary }));
    const [twice] = await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: weary }));
    expect(twice).toMatchObject({ conditionId: 'weary', stacks: 2, source: 'condition' });
  });

  it('levels step up (also when put on again) and down; down from the first ends it; the last refuses going up', async () => {
    const { campaignId, reed } = await freshTable();
    const dazed = condition({ id: 'dazed', name: 'Dazed', levels: [{ id: 'dazed', name: 'Dazed' }, { id: 'reeling', name: 'Reeling' }, { id: 'out-cold', name: 'Out cold' }] });
    const [first] = await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: dazed }));
    expect(first).toMatchObject({ level: 0 });
    const [second] = await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: dazed }));
    expect(second).toMatchObject({ id: first!.id, level: 1 });
    const third = await ok(as(world.playerA, stepStatus, { character: reed, status: second!, step: 1 }));
    expect(third.level).toBe(2);
    const past = await as(world.playerA, stepStatus, { character: reed, status: third, step: 1 });
    expect(past.ok ? 'stepped' : past.message).toBe("It's at its last level already: Out cold.");
    const down = await ok(as(world.playerA, stepStatus, { character: reed, status: await statusOf(first!.id), step: -1 }));
    const down2 = await ok(as(world.playerA, stepStatus, { character: reed, status: down, step: -1 }));
    expect(down2).toMatchObject({ level: 0, endedAt: null });
    const gone = await ok(as(world.playerA, stepStatus, { character: reed, status: down2, step: -1 }));
    expect(gone.endedAt).toBe(0);
  });
});

describe('timers on the one clock (D27)', () => {
  // The leak check finds a timer in a log row, and an id or timestamp that holds the same digits is not a leak.
  it("the secret-timer check finds a timer's value, not the same digits inside an id or a timestamp", () => {
    const harmless = [{ target_table: 'character_statuses', after: { id: '0a1800bc-0000-4000-8000-000000001800', at: '2026-11-02T18:00:00.180012Z', secret: true } }];
    expect(timerValuesIn(harmless)).toEqual([]);
    expect(timerValuesIn([{ after: { ends_at: 3 * TURN } }])).toEqual([{ ends_at: 3 * TURN }]);
    expect(timerValuesIn([{ after: { note: 'x', seconds: 3 * TURN } }])).toEqual([3 * TURN]);
  });

  it('a timer ends with the Next turn that passes it, logged status.timerEnd (Simple) in its request; undoing the turn puts it back', async () => {
    const { campaignId, reed } = await freshTable();
    const [made] = await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: typed('Glowing', { seconds: 2 * TURN, unit: 'turn' }) }));
    expect(made).toMatchObject({ startedAt: 0, endsAt: 2 * TURN, totalSeconds: 2 * TURN, unit: 'turn' });
    await turns(campaignId, 1);
    expect((await statusOf(made!.id)).endedAt).toBeNull();
    const requestId = crypto.randomUUID();
    await turns(campaignId, 1, requestId);
    expect(await statusOf(made!.id)).toMatchObject({ endedAt: 2 * TURN });
    const events = await eventsOf(requestId);
    expect(events.map((e) => [e.type, e.target_table, e.level])).toEqual([
      ['time.advance', 'campaign_clocks', 'verbose'],
      ['status.timerEnd', 'character_statuses', 'simple'],
    ]);
    expect(must(await world.playerB.db.from('events').select('type').eq('request_id', requestId).eq('target_table', 'character_statuses'))).toEqual([{ type: 'status.timerEnd' }]);
    expect(await undo(world.gm, campaignId, events[0]!.id as string)).toMatchObject({ ok: true });
    expect((await statusOf(made!.id)).endedAt).toBeNull();
  });

  it("a secret timer (the GM's) never reaches a player: the status says only that it's secret; it still ends on time", async () => {
    const { campaignId, reed } = await freshTable();
    const requestId = crypto.randomUUID();
    const [made] = await ok(as(world.gm, addStatus, { target: target(campaignId, [reed], true), status: typed('Fen-sight', { seconds: 3 * TURN, unit: 'turn' }, true) }, requestId));
    expect(made).toMatchObject({ secret: true, endsAt: null, totalSeconds: null, unit: null });
    expect(must(await world.playerA.db.from('status_secrets').select('*').eq('id', made!.id))).toEqual([]);
    expect(must(await world.gm.db.from('status_secrets').select('ends_at, total_seconds, unit').eq('id', made!.id))).toEqual([{ ends_at: 3 * TURN, total_seconds: 3 * TURN, unit: 'turn' }]);
    // The log lines a player reads hold no timer either.
    const seen = must(await world.playerA.db.from('events').select('target_table, after').eq('request_id', requestId));
    expect(seen.map((e) => e.target_table)).toEqual(['character_statuses']);
    // Look at the values themselves, not the row as text: ids and timestamps can hold "1800" by chance (a flaky
    // failure on 2026-11-02, PR #283).
    expect(timerValuesIn(seen)).toEqual([]);
    await turns(campaignId, 2);
    expect((await statusOf(made!.id)).endedAt).toBeNull();
    await turns(campaignId, 1);
    expect((await statusOf(made!.id)).endedAt).toBe(3 * TURN);
  });

  it("a player can't keep a timer secret", async () => {
    const { campaignId, reed } = await freshTable();
    const refused = await as(world.playerA, addStatus, { target: target(campaignId, [reed], true), status: typed('Fen-sight', { seconds: TURN, unit: 'turn' }, true) });
    expect(refused).toMatchObject({ ok: false, reason: 'not-allowed' });
    const through = await world.playerA.db.rpc('add_status', { campaign: campaignId, actors: [reed.id], status_name: 'Fen-sight', timer_seconds: TURN, secret: true });
    expect(through.error?.code).toBe('42501');
  });

  it('Set time… backwards gives a timer its time back, up to its whole length; an ended status stays ended', async () => {
    const { campaignId, reed } = await freshTable();
    await turns(campaignId, 2);
    const [long] = await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: typed('Warded', { seconds: 4 * TURN, unit: 'turn' }) }));
    const [short] = await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: typed('Blinking', { seconds: TURN, unit: 'turn' }) }));
    await turns(campaignId, 1);
    expect((await statusOf(short!.id)).endedAt).toBe(3 * TURN);
    await ok(as(world.gm, setTime, { campaignId, clock: await clockOf(campaignId), to: 0 }));
    expect(await statusOf(long!.id)).toMatchObject({ endsAt: 4 * TURN, endedAt: null });
    expect((await statusOf(short!.id)).endedAt).toBe(3 * TURN);
  });
});

describe('Rest this turn and Push on (DG5)', () => {
  it('resting counts only during an expedition', async () => {
    const { campaignId, reed } = await freshTable();
    const refused = await as(world.playerA, chooseRest, { target: { campaignId, characters: [reed] }, resting: true });
    expect(refused.ok ? 'chosen' : refused.message).toBe('Resting counts during an expedition. Start one first.');
  });

  // The GM's Next turn applying the choices became the shared rest flow at the M5 gate (B5):
  // supabase/tests/m5b-g6-rest-flow.test.ts.

  it("only the GM pushes on (the rest condition): a player is refused through the app and the function", async () => {
    const { campaignId, reed } = await freshTable();
    const refused = await as(world.playerA, pushOn, { target: target(campaignId, [reed]), status: condition({ id: 'weary', name: 'Weary' }) });
    expect(refused).toMatchObject({ ok: false, reason: 'not-allowed' });
    const through = await world.playerA.db.rpc('add_status', { campaign: campaignId, actors: [reed.id], status_name: 'Weary', source: 'rest' });
    expect(through.error?.code).toBe('42501');
  });

  it('a repeated request changes nothing (the same id and part)', async () => {
    const { campaignId, reed } = await freshTable();
    const requestId = crypto.randomUUID();
    const weary = condition({ id: 'weary', name: 'Weary', stacks: true });
    await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: weary }, requestId));
    const [again] = await ok(as(world.gm, addStatus, { target: target(campaignId, [reed]), status: weary }, requestId));
    expect(again!.stacks).toBe(1);
  });
});
