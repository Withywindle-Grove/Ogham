// Deleting a player's account keeps the calls sent to their character and their seen marks (Francis, 2026-11-24;
// supabase/migrations/20261124140000_account_deletion_keeps_calls.sql). TEST project only; invented content. Written in
// a cloud session, where database tests can't run: CI's database job runs them.
//   Purpose:
//   1. A player can't empty their own link to a send, nor change their seen mark, by hand.
//   2. Any other change to a send is still refused, even with the secret key, and so is emptying a player's link while
//      their account stands.
//   2a. A seen mark's time can't be changed, even with the secret key (a mark is never changed).
//   3. Deleting a player who was sent a call, and who marked it seen, succeeds.
//   4. The send stays, with no player: the GM still reads it, and its log line stays.
//   5. The seen marks stay, with no player, read by the GM alone; another player reads only their own.
//   6. A send whose player was emptied still refuses every other change.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { sendHook } from '../../src/modules/library/callsToAdventure.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
let toWren = '';
let toAsh = '';
let toParty = '';

async function freshSend(actor: string | null): Promise<string> {
  const hookId = `ew-ferry-toll-${crypto.randomUUID().slice(0, 8)}`;
  const made = await world.gm.db.rpc('import_pack', {
    meta: { name: 'The ferry weirs', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' },
    entries: [{ kind: 'adventureHook', pack_entry_id: hookId, name: 'The ferryman owes a toll', data: { text: 'A note under the ferry bell.', pays: 'A favour', giver: null, order: 0 } }],
    replace_pack_id: null,
  });
  if (made.error) throw made.error;
  const packId = made.data as string;
  const links = must(await world.admin.from('campaign_packs').select('priority').eq('campaign_id', world.campaignId));
  const priority = Math.max(0, ...links.map((link) => link.priority as number)) + 1;
  must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: packId, option_choices: {}, priority }).select());
  const sent = await runCommand(registry, asDb(world.gm), await userOf(world.gm), sendHook, { campaignId: world.campaignId, packId, hookId, actorId: actor, body: 'A note under the ferry bell.', pays: 'A favour' });
  if (!sent.ok) throw new Error(`The send failed: ${JSON.stringify(sent)}`);
  return sent.value.id;
}

const sendRow = async (id: string) => must(await world.admin.from('hook_sends').select('player_user_id, name, body, actor_id, undone').eq('id', id))[0]!;

beforeAll(async () => {
  world = await buildWorld();
  toWren = await freshSend(world.wrenId);
  toAsh = await freshSend(world.ashId);
  toParty = await freshSend(null);
  for (const [person, send] of [[world.playerA, toWren], [world.playerA, toParty], [world.playerB, toParty], [world.playerB, toAsh]] as const) {
    const marked = await person.db.rpc('mark_call_seen', { send });
    if (marked.error) throw marked.error;
  }
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('deleting a player account keeps their calls and seen marks', () => {
  it("a player can't empty their own link to a send, nor change their mark, by hand", async () => {
    await world.playerB.db.from('hook_sends').update({ player_user_id: null }).eq('id', toAsh);
    expect((await sendRow(toAsh)).player_user_id).toBe(world.playerB.id);
    const mark = await world.playerB.db.from('calls_seen').update({ player_user_id: null }).eq('send_id', toAsh).select('id');
    expect(mark.error).not.toBeNull();
    const marks = must(await world.admin.from('calls_seen').select('player_user_id').eq('send_id', toAsh));
    expect(marks.map((m) => m.player_user_id)).toEqual([world.playerB.id]);
  });

  it('any other change is still refused, even with the secret key, and so is emptying a standing account', async () => {
    expect((await world.admin.from('hook_sends').update({ name: 'A different toll' }).eq('id', toAsh)).error).not.toBeNull();
    expect((await world.admin.from('hook_sends').update({ player_user_id: null }).eq('id', toAsh)).error).not.toBeNull();
    expect((await world.admin.from('calls_seen').update({ player_user_id: null }).eq('send_id', toAsh)).error).not.toBeNull();
    expect(await sendRow(toAsh)).toMatchObject({ player_user_id: world.playerB.id, name: 'The ferryman owes a toll' });
  });

  it("a seen mark's time can't be changed, even with the secret key", async () => {
    const was = must(await world.admin.from('calls_seen').select('seen_at').eq('send_id', toAsh))[0]!.seen_at;
    expect((await world.admin.from('calls_seen').update({ seen_at: '2000-01-01T00:00:00Z' }).eq('send_id', toAsh)).error).not.toBeNull();
    expect(must(await world.admin.from('calls_seen').select('seen_at').eq('send_id', toAsh))[0]!.seen_at).toBe(was);
  });

  it('deleting a player who was sent a call, and marked it seen, succeeds', async () => {
    const deleted = await world.admin.auth.admin.deleteUser(world.playerA.id);
    expect(deleted.error).toBeNull();
    expect(must(await world.admin.from('profiles').select('id').eq('id', world.playerA.id))).toEqual([]);
  });

  it('the send stays, with no player; the GM still reads it, and its log line stays', async () => {
    expect(await sendRow(toWren)).toMatchObject({ player_user_id: null, name: 'The ferryman owes a toll', body: 'A note under the ferry bell.', actor_id: world.wrenId, undone: false });
    expect(must(await world.gm.db.from('hook_sends').select('id').eq('id', toWren))).toHaveLength(1);
    expect(must(await world.playerB.db.from('hook_sends').select('id').eq('id', toWren))).toEqual([]);
    const lines = must(await world.admin.from('events').select('type').eq('target_table', 'hook_sends').eq('target_id', toWren));
    expect(lines.map((line) => line.type)).toContain('hook.send');
  });

  it('the seen marks stay, with no player, read by the GM alone', async () => {
    const kept = must(await world.admin.from('calls_seen').select('send_id').eq('campaign_id', world.campaignId).is('player_user_id', null));
    expect(kept.map((m) => m.send_id).sort()).toEqual([toParty, toWren].sort());
    const gmReads = must(await world.gm.db.from('calls_seen').select('send_id').eq('campaign_id', world.campaignId).is('player_user_id', null));
    expect(gmReads).toHaveLength(2);
    const bReads = must(await world.playerB.db.from('calls_seen').select('player_user_id').eq('campaign_id', world.campaignId));
    expect(bReads.map((m) => m.player_user_id)).toEqual([world.playerB.id, world.playerB.id]);
  });

  it('a send whose player was emptied still refuses every other change', async () => {
    expect((await world.admin.from('hook_sends').update({ name: 'A different toll' }).eq('id', toWren)).error).not.toBeNull();
    expect((await sendRow(toWren)).name).toBe('The ferryman owes a toll');
  });
});

// Widened (Francis, 2026-11-24, "yes" to the pull request's ⚑ 3): deleting a GM's account, and deleting any account
// whose sends or marks are in a retired campaign, works too and erases nothing: the row stays, only its link to the
// deleted account is emptied. Runs after the block above (Player A is already deleted).
describe("deleting a GM's account, or one with calls in a retired campaign, keeps every call and mark", () => {
  let retired = '';
  let retiredSend = '';
  // A send of a fresh hook by `gm` in `campaignId`, to a character or the party (null).
  const sendFrom = async (gm: Person, campaignId: string, actor: string | null): Promise<string> => {
    const hookId = `ew-weir-toll-${crypto.randomUUID().slice(0, 8)}`;
    const made = await gm.db.rpc('import_pack', {
      meta: { name: 'The silted weirs', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' },
      entries: [{ kind: 'adventureHook', pack_entry_id: hookId, name: 'The ferryman owes a toll', data: { text: 'A note under the ferry bell.', pays: 'A favour', giver: null, order: 0 } }],
      replace_pack_id: null,
    });
    if (made.error) throw made.error;
    const packId = made.data as string;
    const links = must(await world.admin.from('campaign_packs').select('priority').eq('campaign_id', campaignId));
    const priority = Math.max(0, ...links.map((link) => link.priority as number)) + 1;
    must(await world.admin.from('campaign_packs').insert({ campaign_id: campaignId, pack_id: packId, option_choices: {}, priority }).select());
    const sent = await runCommand(registry, asDb(gm), await userOf(gm), sendHook, { campaignId, packId, hookId, actorId: actor, body: 'A note under the ferry bell.', pays: 'A favour' });
    if (!sent.ok) throw new Error(`The send failed: ${JSON.stringify(sent)}`);
    return sent.value.id;
  };

  // Purpose (review nit 2: the first test's send half is stopped by the read rules before any guard): the GM, who may
  // update a send for an Undo, still can't empty a standing player's link to it by hand; the guard refuses it.
  it("the GM can't empty a standing player's link to a send by hand", async () => {
    expect((await world.gm.db.from('hook_sends').update({ player_user_id: null }).eq('id', toAsh).select('id')).error).not.toBeNull();
    expect((await world.gm.db.from('hook_sends').update({ created_by: null }).eq('id', toAsh).select('id')).error).not.toBeNull();
    expect(await sendRow(toAsh)).toMatchObject({ player_user_id: world.playerB.id, name: 'The ferryman owes a toll' });
  });

  // Purpose: the log line the database wrote when it emptied the deleted player's link names no one, and an Undo of
  // it is refused and changes nothing (the account can't come back).
  it("the database's line for the emptied link names no one, and its Undo is refused and changes nothing", async () => {
    const lines = must(await world.admin.from('events').select('id, type, actor_user_id, after').eq('target_table', 'hook_sends').eq('target_id', toWren).is('actor_user_id', null));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ type: 'hook_sends.update', after: { player_user_id: null } });
    expect((await world.gm.db.rpc('undo_request', { event_id: lines[0]!.id })).error).not.toBeNull();
    expect(await sendRow(toWren)).toMatchObject({ player_user_id: null, undone: false });
  });

  // Purpose: once a player's account is deleted, the GM can still undo the call sent to their character (the
  // database emptying the link is not a later change that blocks it).
  it("after a player's deletion, the GM's Undo of the call sent to their character still works", async () => {
    const line = must(await world.admin.from('events').select('id').eq('target_table', 'hook_sends').eq('target_id', toWren).eq('type', 'hook.send'))[0]!;
    const undone = await world.gm.db.rpc('undo_request', { event_id: line.id });
    expect(undone.error).toBeNull();
    expect(await sendRow(toWren)).toMatchObject({ undone: true, player_user_id: null, name: 'The ferryman owes a toll' });
  });

  // Purpose: deleting the GM who sent the calls succeeds, and every send stays as it was, with no sender.
  it('deleting the GM who sent the calls succeeds, and every send stays with no sender', async () => {
    const pick = (rows: Record<string, unknown>[]) => rows.map((row) => ({ id: row.id, name: row.name, body: row.body, player_user_id: row.player_user_id, undone: row.undone }));
    const before = must(await world.admin.from('hook_sends').select('id, name, body, player_user_id, undone').eq('campaign_id', world.campaignId).order('id'));
    expect(before).toHaveLength(3);
    const deleted = await world.admin.auth.admin.deleteUser(world.gm.id);
    expect(deleted.error).toBeNull();
    const after = must(await world.admin.from('hook_sends').select('id, name, body, player_user_id, undone, created_by').eq('campaign_id', world.campaignId).order('id'));
    expect(pick(after)).toEqual(pick(before));
    expect(after.map((row) => row.created_by)).toEqual([null, null, null]);
  });

  // Purpose: a send whose sender was emptied still refuses every other change, even with the secret key, and its
  // sender can't be filled in again.
  it("a send whose sender was emptied still refuses every other change, and can't be given a sender", async () => {
    expect((await world.admin.from('hook_sends').update({ name: 'A different toll' }).eq('id', toAsh)).error).not.toBeNull();
    expect((await world.admin.from('hook_sends').update({ created_by: world.playerB.id }).eq('id', toAsh)).error).not.toBeNull();
    expect((await world.admin.from('hook_sends').update({ player_user_id: null }).eq('id', toAsh)).error).not.toBeNull();
    expect(await sendRow(toAsh)).toMatchObject({ player_user_id: world.playerB.id, name: 'The ferryman owes a toll' });
    expect(must(await world.admin.from('hook_sends').select('created_by').eq('id', toAsh))[0]!.created_by).toBeNull();
  });

  // Purpose: deleting a player whose seen mark is in a retired campaign succeeds, and the mark stays, with no player.
  it('deleting a player whose seen mark is in a retired campaign succeeds, and the mark stays with no player', async () => {
    retired = must(await world.admin.from('campaigns').insert({ name: 'The Silted Weir' }).select('id').single()).id as string;
    must(await world.admin.from('members').insert([
      { campaign_id: retired, user_id: world.outsider.id, base_role: 'gm' },
      { campaign_id: retired, user_id: world.latecomer.id, base_role: 'player' },
    ]).select());
    retiredSend = await sendFrom(world.outsider, retired, null);
    const marked = await world.latecomer.db.rpc('mark_call_seen', { send: retiredSend });
    if (marked.error) throw marked.error;
    must(await world.admin.from('campaigns').update({ retired_at: new Date().toISOString() }).eq('id', retired).select('id'));
    const deleted = await world.admin.auth.admin.deleteUser(world.latecomer.id);
    expect(deleted.error).toBeNull();
    expect(must(await world.admin.from('calls_seen').select('player_user_id').eq('send_id', retiredSend))).toEqual([{ player_user_id: null }]);
  });

  // Purpose: deleting the GM whose call is in a retired campaign succeeds, and the send stays, with no sender.
  it('deleting the GM whose call is in a retired campaign succeeds, and the send stays with no sender', async () => {
    const deleted = await world.admin.auth.admin.deleteUser(world.outsider.id);
    expect(deleted.error).toBeNull();
    expect(must(await world.admin.from('hook_sends').select('created_by, name, undone').eq('id', retiredSend))).toEqual([{ created_by: null, name: 'The ferryman owes a toll', undone: false }]);
  });

  // Purpose: in a retired campaign, every other change to the send and the mark is still refused, even with the secret
  // key (then the test's retired campaign is cleaned away).
  it('in a retired campaign every other change to the send and the mark is still refused', async () => {
    expect((await world.admin.from('hook_sends').update({ name: 'A different toll' }).eq('id', retiredSend)).error).not.toBeNull();
    expect((await world.admin.from('hook_sends').update({ created_by: world.playerB.id }).eq('id', retiredSend)).error).not.toBeNull();
    expect((await world.admin.from('calls_seen').update({ seen_at: '2000-01-01T00:00:00Z' }).eq('send_id', retiredSend)).error).not.toBeNull();
    expect(must(await world.admin.from('hook_sends').select('created_by, name').eq('id', retiredSend))).toEqual([{ created_by: null, name: 'The ferryman owes a toll' }]);
    await world.admin.from('campaigns').delete().eq('id', retired);
  });
});
