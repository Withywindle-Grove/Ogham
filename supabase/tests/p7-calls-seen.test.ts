// Got it on a call to adventure (P7, p7-1 to p7-3; supabase/migrations/20261124120000_p7_calls_seen.sql). TEST
// project only; invented content. Written in a cloud session, where database tests can't run: CI's database job runs
// them.
//   Purpose:
//   1. A player marks a call to the party as seen (public.mark_call_seen), and reads their mark.
//   2. Another player's card stands: they read no mark of the first player's, and can mark the same call themselves (p7-2).
//   3. The GM reads every mark, and can't write one: not through the function, not through the table.
//   4. A player can't mark a call to another player's character, nor an undone send; an outsider can't mark anything.
//   4b. A send whose player was removed (actor set, player_user_id null) is refused with 42501, even to its old player.
//   5. The time is the server's and is never changed: a repeat keeps one row and gives back the first time.
//   6. Its log line is its player's and the GM's, never another player's, even for a call to the party; it can't be undone.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { sendHook } from '../../src/modules/library/callsToAdventure.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
// The GM's sends and Undo go through the app's commands (tagged requests), as dec-12b-calls-to-adventure.test.ts does.
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
let toParty = '';
let toWren = '';
let undone = '';

async function freshSend(actor: string | null): Promise<string> {
  const hookId = `ew-bog-bounty-${crypto.randomUUID().slice(0, 8)}`;
  const made = await world.gm.db.rpc('import_pack', {
    meta: { name: 'The eel weirs', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' },
    entries: [{ kind: 'adventureHook', pack_entry_id: hookId, name: 'Bounty on the Bog lurker', data: { text: 'Nailed to the quay post: a bounty.', pays: 'Ten silver a head', giver: null, order: 0 } }],
    replace_pack_id: null,
  });
  if (made.error) throw made.error;
  const packId = made.data as string;
  const links = must(await world.admin.from('campaign_packs').select('priority').eq('campaign_id', world.campaignId));
  const priority = Math.max(0, ...links.map((link) => link.priority as number)) + 1;
  must(await world.admin.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: packId, option_choices: {}, priority }).select());
  const sent = await as(world.gm, sendHook, { campaignId: world.campaignId, packId, hookId, actorId: actor, body: 'Nailed to the quay post: a bounty.', pays: 'Ten silver a head' });
  if (!sent.ok) throw new Error(`The send failed: ${JSON.stringify(sent)}`);
  return sent.value.id;
}

beforeAll(async () => {
  world = await buildWorld();
  toParty = await freshSend(null);
  toWren = await freshSend(world.wrenId);
  undone = await freshSend(null);
  // Undone by the GM's Undo of its send (nothing is erased; the send is marked undone).
  const line = must(await world.admin.from('events').select('id, actor_user_id').eq('target_table', 'hook_sends').eq('target_id', undone).eq('type', 'hook.send'))[0]!;
  expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: line.id, authorUserId: line.actor_user_id })).toMatchObject({ ok: true });
  expect(must(await world.admin.from('hook_sends').select('undone').eq('id', undone))[0]!.undone).toBe(true);
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

const markAs = (person: World['gm'], send: string) => person.db.rpc('mark_call_seen', { send });
const marksReadBy = async (person: World['gm']) => must(await person.db.from('calls_seen').select('send_id, player_user_id, seen_at').eq('campaign_id', world.campaignId));
const denied = (result: { error: { code?: string } | null }) => result.error?.code === '42501';

describe('Got it on a call (P7, p7-1 to p7-3)', () => {
  it('a player marks a call to the party as seen, and reads their mark', async () => {
    const before = Date.now();
    expect((await markAs(world.playerA, toParty)).error).toBeNull();
    const mine = await marksReadBy(world.playerA);
    expect(mine.map((r) => [r.send_id, r.player_user_id])).toEqual([[toParty, world.playerA.id]]);
    expect(Date.parse(String(mine[0]!.seen_at))).toBeGreaterThan(before - 60_000);
  });

  it("another player reads none of it, and marks the same call for themselves (p7-2)", async () => {
    expect(await marksReadBy(world.playerB)).toEqual([]);
    expect((await markAs(world.playerB, toParty)).error).toBeNull();
    expect((await marksReadBy(world.playerB)).map((r) => r.player_user_id)).toEqual([world.playerB.id]);
    expect((await marksReadBy(world.playerA)).map((r) => r.player_user_id)).toEqual([world.playerA.id]);
  });

  it("the GM reads every mark and can't write one", async () => {
    expect((await marksReadBy(world.gm)).length).toBe(2);
    expect(denied(await markAs(world.gm, toParty))).toBe(true);
    const insert = await world.gm.db.from('calls_seen').insert({ campaign_id: world.campaignId, send_id: toWren, player_user_id: world.gm.id }).select('id');
    expect(insert.error).not.toBeNull();
  });

  it("a player can't mark a call to another's character or an undone send; an outsider nothing", async () => {
    expect(denied(await markAs(world.playerB, toWren))).toBe(true);
    expect(denied(await markAs(world.playerA, undone))).toBe(true);
    expect(denied(await markAs(world.outsider, toParty))).toBe(true);
    const insert = await world.playerB.db.from('calls_seen').insert({ campaign_id: world.campaignId, send_id: toWren, player_user_id: world.playerB.id }).select('id');
    expect(insert.error).not.toBeNull();
    const all = must(await world.admin.from('calls_seen').select('send_id').eq('campaign_id', world.campaignId));
    expect(all.map((r) => r.send_id).sort()).toEqual([toParty, toParty]);
  });

  it('a send whose player was removed (actor set, player_user_id null) is refused with 42501', async () => {
    const orphaned = await freshSend(world.wrenId);
    must(await world.admin.from('hook_sends').update({ player_user_id: null }).eq('id', orphaned).select('id'));
    expect(denied(await markAs(world.playerA, orphaned))).toBe(true);
    expect(denied(await markAs(world.playerB, orphaned))).toBe(true);
    const rows = must(await world.admin.from('calls_seen').select('id').eq('send_id', orphaned));
    expect(rows).toEqual([]);
  });

  it('keeps the first time: no device time, no change, a repeat gives the first back', async () => {
    expect((await markAs(world.playerA, toWren)).error).toBeNull();
    const was = must(await world.admin.from('calls_seen').select('seen_at').eq('send_id', toWren))[0]!.seen_at;
    await world.playerA.db.from('calls_seen').update({ seen_at: '2000-01-01T00:00:00Z' }).eq('send_id', toWren);
    const again = await markAs(world.playerA, toWren);
    expect(again.error).toBeNull();
    expect(Date.parse(String(again.data))).toBe(Date.parse(String(was)));
    const rows = must(await world.admin.from('calls_seen').select('seen_at').eq('send_id', toWren));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.seen_at).toBe(was);
    const withTime = await world.playerA.db.rpc('mark_call_seen' as never, { send: toWren, seen_at: '2000-01-01T00:00:00Z' } as never);
    expect(withTime.error).not.toBeNull();
  });

  it("its log lines are its player's and the GM's, never another player's; and can't be undone", async () => {
    const lines = must(await world.admin.from('events').select('id, type, level, audience, owner_user_id').eq('campaign_id', world.campaignId).eq('target_table', 'calls_seen'));
    expect(lines.length).toBe(3);
    for (const line of lines) expect(line).toMatchObject({ type: 'hook.seen', level: 'verbose', audience: 'owner' });
    const readBy = async (person: World['gm']) => must(await person.db.from('events').select('owner_user_id').eq('campaign_id', world.campaignId).eq('target_table', 'calls_seen'));
    expect((await readBy(world.gm)).length).toBe(3);
    expect((await readBy(world.playerA)).every((l) => l.owner_user_id === world.playerA.id)).toBe(true);
    expect((await readBy(world.playerA)).length).toBe(2);
    expect((await readBy(world.playerB)).map((l) => l.owner_user_id)).toEqual([world.playerB.id]);
    for (const line of lines) {
      const undo = await world.gm.db.rpc('undo_request_said', { event_id: line.id });
      expect(undo.error).not.toBeNull();
    }
  });
});
