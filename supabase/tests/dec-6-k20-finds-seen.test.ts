// "New until Got it" (K20, pk-13; supabase/migrations/20261115003000_dec_6_k20_finds_seen.sql). TEST project only;
// invented content. Written in a cloud session, where database tests can't run: CI's database job runs them.
//   Purpose:
//   1. The player sets their own approved character's mark (public.mark_finds_seen), and reads it.
//   2. The GM reads it, and can't write it: not through the function, not through the table.
//   3. Another player can't read or write it; neither can an outsider.
//   4. A player can't set it on their own unapproved character, nor on someone else's.
//   5. The time is the server's: no device can send one (the function takes none; the table has no write grant).
//   6. Its log line is its player's and the GM's, never another player's; and it can't be undone.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildWorld, must, tearDownWorld, type World } from './world.ts';

let world: World;
let sketchId = '';

beforeAll(async () => {
  world = await buildWorld();
  // Player A's own character, still waiting for the GM (a player can make one; it starts pending).
  const made = await world.playerA.db
    .from('actors')
    .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Sketch the Reed-cutter', owner_type: 'user', owner_user_id: world.playerA.id })
    .select('id, approval');
  const row = must(made)[0]!;
  expect(row.approval).toBe('pending');
  sketchId = String(row.id);
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

const markAs = (person: World['gm'], character: string) => person.db.rpc('mark_finds_seen', { character });
const marksSeenBy = async (person: World['gm']) => must(await person.db.from('finds_seen').select('actor_id, seen_at').eq('campaign_id', world.campaignId));
const denied = (result: { error: { code?: string } | null }) => result.error?.code === '42501';

describe('the seen mark (K20, pk-13)', () => {
  it("the player sets their own approved character's mark, and reads it", async () => {
    const before = Date.now();
    const set = await markAs(world.playerA, world.wrenId);
    expect(set.error).toBeNull();
    const mine = await marksSeenBy(world.playerA);
    expect(mine.map((r) => r.actor_id)).toEqual([world.wrenId]);
    // The server's time, not one sent: it is no earlier than the call (allowing for the clocks' drift).
    expect(Date.parse(String(mine[0]!.seen_at))).toBeGreaterThan(before - 60_000);
  });

  it("the GM reads it, and can't write it", async () => {
    expect((await marksSeenBy(world.gm)).map((r) => r.actor_id)).toEqual([world.wrenId]);
    expect(denied(await markAs(world.gm, world.wrenId))).toBe(true);
    const was = must(await world.admin.from('finds_seen').select('seen_at').eq('actor_id', world.wrenId))[0]!.seen_at;
    await world.gm.db.from('finds_seen').update({ seen_at: '2000-01-01T00:00:00Z' }).eq('actor_id', world.wrenId);
    expect(must(await world.admin.from('finds_seen').select('seen_at').eq('actor_id', world.wrenId))[0]!.seen_at).toBe(was);
  });

  it("another player can't read or write it, nor can an outsider", async () => {
    for (const person of [world.playerB, world.outsider]) {
      expect(await marksSeenBy(person)).toEqual([]);
      expect(denied(await markAs(person, world.wrenId))).toBe(true);
    }
    const insert = await world.playerB.db.from('finds_seen').insert({ campaign_id: world.campaignId, actor_id: world.ashId }).select('id');
    expect(insert.error).not.toBeNull();
    const all = must(await world.admin.from('finds_seen').select('actor_id').eq('campaign_id', world.campaignId));
    expect(all.map((r) => r.actor_id)).toEqual([world.wrenId]);
  });

  it("a player can't set it on their own unapproved character, nor on someone else's", async () => {
    expect(denied(await markAs(world.playerA, sketchId))).toBe(true);
    expect(denied(await markAs(world.playerA, world.ashId))).toBe(true);
    const all = must(await world.admin.from('finds_seen').select('actor_id').eq('campaign_id', world.campaignId));
    expect(all.map((r) => r.actor_id)).toEqual([world.wrenId]);
  });

  it('takes no time from the device: the function has no time to take, and the table no write', async () => {
    // A call with a time of its own finds no such function.
    const withTime = await world.playerA.db.rpc('mark_finds_seen' as never, { character: world.wrenId, seen_at: '2000-01-01T00:00:00Z' } as never);
    expect(withTime.error).not.toBeNull();
    // Nor can the player write the time on the row.
    const was = must(await world.admin.from('finds_seen').select('seen_at').eq('actor_id', world.wrenId))[0]!.seen_at;
    await world.playerA.db.from('finds_seen').update({ seen_at: '2000-01-01T00:00:00Z' }).eq('actor_id', world.wrenId);
    expect(must(await world.admin.from('finds_seen').select('seen_at').eq('actor_id', world.wrenId))[0]!.seen_at).toBe(was);
    // A repeat through the function moves the time on, and keeps one row.
    expect((await markAs(world.playerA, world.wrenId)).error).toBeNull();
    const now = must(await world.admin.from('finds_seen').select('seen_at').eq('actor_id', world.wrenId));
    expect(now).toHaveLength(1);
    expect(Date.parse(String(now[0]!.seen_at))).toBeGreaterThanOrEqual(Date.parse(String(was)));
  });

  it("its log line is its player's and the GM's, never another player's; and it can't be undone", async () => {
    const lines = must(await world.admin.from('events').select('id, type, level, audience, owner_user_id').eq('campaign_id', world.campaignId).eq('target_table', 'finds_seen'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toMatchObject({ type: 'character.seenFinds', level: 'verbose', audience: 'owner', owner_user_id: world.playerA.id });
    const readBy = async (person: World['gm']) => must(await person.db.from('events').select('id').eq('campaign_id', world.campaignId).eq('target_table', 'finds_seen')).length;
    expect(await readBy(world.playerA)).toBe(lines.length);
    expect(await readBy(world.gm)).toBe(lines.length);
    expect(await readBy(world.playerB)).toBe(0);
    // Not undoable: the first mark is a making, a later one is on a table that isn't undoable.
    for (const line of lines) {
      const undone = await world.playerA.db.rpc('undo_request_said', { event_id: line.id });
      expect(undone.error).not.toBeNull();
    }
  });
});
