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

  it.fails("a seen mark's time can't be changed, even with the secret key", async () => {
    const was = must(await world.admin.from('calls_seen').select('seen_at').eq('send_id', toAsh))[0]!.seen_at;
    expect((await world.admin.from('calls_seen').update({ seen_at: '2000-01-01T00:00:00Z' }).eq('send_id', toAsh)).error).not.toBeNull();
    expect(must(await world.admin.from('calls_seen').select('seen_at').eq('send_id', toAsh))[0]!.seen_at).toBe(was);
  });

  it.fails('deleting a player who was sent a call, and marked it seen, succeeds', async () => {
    const deleted = await world.admin.auth.admin.deleteUser(world.playerA.id);
    expect(deleted.error).toBeNull();
    expect(must(await world.admin.from('profiles').select('id').eq('id', world.playerA.id))).toEqual([]);
  });

  it.fails('the send stays, with no player; the GM still reads it, and its log line stays', async () => {
    expect(await sendRow(toWren)).toMatchObject({ player_user_id: null, name: 'The ferryman owes a toll', body: 'A note under the ferry bell.', actor_id: world.wrenId, undone: false });
    expect(must(await world.gm.db.from('hook_sends').select('id').eq('id', toWren))).toHaveLength(1);
    expect(must(await world.playerB.db.from('hook_sends').select('id').eq('id', toWren))).toEqual([]);
    const lines = must(await world.admin.from('events').select('type').eq('target_table', 'hook_sends').eq('target_id', toWren));
    expect(lines.map((line) => line.type)).toContain('hook.send');
  });

  it.fails('the seen marks stay, with no player, read by the GM alone', async () => {
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
