// The call to adventure reaching a player (P7; p7-1 to p7-13): the "Got it" mark run through the app's registry on the
// stand-in database, which acts like supabase/migrations/20261124120000_p7_calls_seen.sql
// (supabase/tests/p7-calls-seen.test.ts proves the real one); the card's heading; and what the slot shows. Invented
// names only.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { describeEntry, groupEntries, loadLog, loadLogNames } from '../../core/events.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { callHeading, callsInSlot, loadPlayerCalls, markCallSeen, type CallSend, type CallSendRef } from './callCards.ts';

const registry = createAppRegistry();
let world: FakeWorld;
let campaign: string;
let gm: CurrentUser;
let sam: CurrentUser;
let tess: CurrentUser;
let wrenId: string;
let toParty: CallSendRef;
let toWren: CallSendRef;

function addSend(id: string, actorId: string | null, playerUserId: string | null, extra: Record<string, unknown> = {}): CallSendRef {
  world.tables.hook_sends.push({
    id,
    campaign_id: campaign,
    pack_id: 'pack-weirs',
    hook_key: id,
    actor_id: actorId,
    player_user_id: playerUserId,
    name: 'Bounty on the Bog lurker',
    body: 'Nailed to the quay post: a bounty on the Bog lurker.',
    pays: '',
    clock_seconds: 0,
    undone: false,
    kind: 'hook',
    version: 1,
    created_at: '2026-11-24T19:00:00Z',
    updated_at: '2026-11-24T19:00:00Z',
    ...extra,
  });
  return { id, campaignId: campaign, actorId, playerUserId };
}
async function gotIt(user: CurrentUser, send: CallSendRef) {
  world.signInAs(user.id);
  return runCommand(registry, world.db, user, markCallSeen, { send });
}

beforeEach(() => {
  world = createFakeDb();
  const gmId = world.addPerson('priya@weirs.example', 'Priya');
  const samId = world.addPerson('sam@weirs.example', 'Sam');
  const tessId = world.addPerson('tess@weirs.example', 'Tess');
  campaign = world.addCampaign('The Eel Weirs', gmId);
  wrenId = world.addCharacter(campaign, 'Wren', { ownerId: samId });
  const mossId = world.addCharacter(campaign, 'Moss', { ownerId: tessId });
  world.addMember(campaign, samId, 'player', wrenId);
  world.addMember(campaign, tessId, 'player', mossId);
  gm = { id: gmId, roles: { [campaign]: 'gm' } };
  sam = { id: samId, roles: { [campaign]: 'player' } };
  tess = { id: tessId, roles: { [campaign]: 'player' } };
  toParty = addSend('send-party', null, null);
  toWren = addSend('send-wren', wrenId, samId, { created_at: '2026-11-24T19:05:00Z', pays: 'Ten silver a head' });
});

describe('Got it on a call, on the stand-in database (p7-1 to p7-3)', () => {
  // Purpose: a player's "Got it" on a call to the party marks it for them alone; another player's card stands (p7-2).
  it('marks a call to the party for that player alone', async () => {
    expect((await gotIt(sam, toParty)).ok).toBe(true);
    world.signInAs(sam.id);
    expect((await loadPlayerCalls(world.db, campaign, sam.id))!.seen.has(toParty.id)).toBe(true);
    world.signInAs(tess.id);
    const tessCalls = (await loadPlayerCalls(world.db, campaign, tess.id))!;
    expect(tessCalls.seen.size).toBe(0);
    // Tess never receives Sam's mark, even asking for it by name.
    expect((await world.db.from('calls_seen').select('send_id').eq('player_user_id', sam.id)).data).toEqual([]);
    expect(callsInSlot(tessCalls.sends, tessCalls.seen).card?.id).toBe(toParty.id);
  });

  // Purpose: the mark is a player's own: the GM is refused, and so is a player on a call sent to another's character.
  it('refuses the GM, and a player on a call to someone else’s character', async () => {
    expect((await gotIt(gm, toParty)).ok).toBe(false);
    expect((await gotIt(tess, toWren)).ok).toBe(false);
    // Past the app's own check too.
    world.signInAs(tess.id);
    expect((await world.db.rpc('mark_call_seen' as never, { send: toWren.id } as never)).error).not.toBeNull();
    expect(world.tables.calls_seen).toEqual([]);
  });

  // Purpose: an undone send can't be marked (the player no longer reads it).
  it('refuses an undone send', async () => {
    world.tables.hook_sends.find((s) => s.id === toParty.id)!.undone = true;
    world.signInAs(sam.id);
    expect((await world.db.rpc('mark_call_seen' as never, { send: toParty.id } as never)).error).not.toBeNull();
  });

  // Purpose: the mark is never changed: a repeat keeps one row and gives back the first time.
  it('keeps the first mark on a repeat', async () => {
    const first = await gotIt(sam, toWren);
    const again = await gotIt(sam, toWren);
    expect(first.ok && again.ok && first.value === again.value).toBe(true);
    expect(world.tables.calls_seen).toHaveLength(1);
  });

  // Purpose: its log line is verbose and its player's alone, even for a call to the party; the GM reads it, Tess doesn't.
  it('logs a verbose line its player and the GM read, never another player', async () => {
    await gotIt(sam, toParty);
    const lines = world.tables.events.filter((e) => e.target_table === 'calls_seen');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ type: 'hook.seen', level: 'verbose', audience: 'owner', owner_user_id: sam.id });
    world.signInAs(tess.id);
    expect((await world.db.from('events').select('id').eq('target_table', 'calls_seen')).data).toEqual([]);
    world.signInAs(gm.id);
    expect((await world.db.from('events').select('id').eq('target_table', 'calls_seen')).data).toHaveLength(1);
  });

  // Purpose: the line reads in plain words: "You marked a call as seen." to the player, with their name to the GM.
  it('reads its line in plain words', async () => {
    await gotIt(sam, toParty);
    for (const [who, words] of [[sam, 'You marked a call as seen.'], [gm, 'Sam marked a call as seen.']] as const) {
      world.signInAs(who.id);
      const log = await loadLog(world.db, campaign, { verbose: true });
      const names = await loadLogNames(world.db, campaign, who.id);
      expect(groupEntries(log!.events).map((e) => describeEntry(e, names))).toContain(words);
    }
  });

  // Purpose: a player reads their own character's name on a call sent to it, and the send's kind and pays.
  it('loads a player’s calls with their character’s name', async () => {
    world.signInAs(sam.id);
    const calls = (await loadPlayerCalls(world.db, campaign, sam.id))!;
    const wren = calls.sends.find((s) => s.id === toWren.id)!;
    expect(wren).toMatchObject({ kind: 'hook', actorName: 'Wren', pays: 'Ten silver a head' });
    expect(callHeading(wren)).toBe('A call to adventure, for Wren');
  });
});

const send = (id: string, createdAt: string, extra: Partial<CallSend> = {}): CallSend => ({
  id,
  campaignId: 'c',
  kind: 'hook',
  actorId: null,
  actorName: null,
  playerUserId: null,
  body: 'They say the bell under the breakwater still rings.',
  pays: '',
  createdAt,
  ...extra,
});

describe('the card’s heading (p7-4)', () => {
  // Purpose: the heading comes from the send's kind and whom it went to.
  it('says a call or a rumour, for the party or for the character', () => {
    expect(callHeading(send('a', 't'))).toBe('A call to adventure, for the party');
    expect(callHeading(send('a', 't', { kind: 'rumour' }))).toBe('A rumour, for the party');
    expect(callHeading(send('a', 't', { kind: 'rumour', actorId: 'w', actorName: 'Fenna of the Long Causeway below the Old Lantern' }))).toBe(
      'A rumour, for Fenna of the Long Causeway below the Old Lantern',
    );
  });
});

describe('what the slot shows (p7-9, p7-11 to p7-13)', () => {
  const three = [send('c', '2026-11-24T19:20:00Z'), send('a', '2026-11-24T19:00:00Z'), send('b', '2026-11-24T19:10:00Z')];

  // Purpose: one card at a time, the oldest unseen first, "1 of 3" with three unseen.
  it('shows the oldest unseen card with "1 of 3"', () => {
    expect(callsInSlot(three, new Map())).toEqual({ card: three[1], count: '1 of 3', folded: [] });
  });

  // Purpose: after one "Got it" the count is of calls not yet seen ("1 of 2") and the seen one folds under the card.
  it('counts what is left after a Got it, and folds the seen one', () => {
    const shown = callsInSlot(three, new Map([['a', '2026-11-24T20:00:00Z']]));
    expect(shown.card?.id).toBe('b');
    expect(shown.count).toBe('1 of 2');
    expect(shown.folded.map((s) => s.id)).toEqual(['a']);
  });

  // Purpose: one unseen call has no count; folded rows are newest fold first; none at all shows nothing.
  it('drops the count for one, orders folds newest first, and shows nothing for none', () => {
    const shown = callsInSlot(three, new Map([['a', '2026-11-24T20:00:00Z'], ['c', '2026-11-24T21:00:00Z']]));
    expect(shown.card?.id).toBe('b');
    expect(shown.count).toBeNull();
    expect(shown.folded.map((s) => s.id)).toEqual(['c', 'a']);
    expect(callsInSlot([], new Map())).toEqual({ card: null, count: null, folded: [] });
  });
});
