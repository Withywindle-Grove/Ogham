// M5 step 8 (part 3): party groups and a marching order per group (supabase/migrations/20261030230000_m5_party_groups.sql,
// 20261030231000_m5_party_group_ids.sql; ruled 2026-10-30, DG14 and DG8). TEST project only; invented characters.
//   Every campaign starts with one group, the party (group 1), with every character in it; members read the groups.
//   A player puts their own character in a new group (their hireling follows); logged Simple, everyone sees the line;
//   Undo puts it back. They can't move another player's character; the GM can move anyone.
//   With one group left, everyone is the party again. Join up: a player (groups are together) or the GM.
//   Each group has its own marching order holding only its characters; the saved orders are the campaign's. A saved
//   order can be deleted, and Undo puts it back. No lock since B11 (2026-11-18,
//   20261118150000_p2p_b11_marching_no_lock.sql): a lock stored on the party's row stops no player in any group.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { chooseGroup, joinUp } from '../../src/modules/expedition/groupPlay.ts';
import {
  applyMarchingPreset,
  deleteMarchingPreset,
  lockMarchingOrder,
  saveMarchingPreset,
  setMarchingOrder,
  toMarchingOrder,
  type MarchingOrder,
  type MarchingTarget,
} from '../../src/modules/expedition/marchingPlay.ts';
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

/** A fresh campaign with the world's GM and both players: Reed and Wick (player A's, and A's hireling Bree), Moss (B's). */
async function freshTable() {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Split Causeway', created_by: world.gm.id }).select().single());
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
  const pc = (name: string, owner: Person, kind = 'pc') => ({ campaign_id: campaign.id, kind, name, owner_type: 'user', owner_user_id: owner.id, approval: 'approved', status: 'active', level: 1 });
  const [reed, moss, wick, bree] = must(
    await world.admin
      .from('actors')
      .insert([pc('Reed the Ferrywarden', world.playerA), pc('Moss of the Bog Lights', world.playerB), pc('Wick', world.playerA), pc('Bree the Lantern Bearer', world.playerA, 'hireling')])
      .select('id'),
  ) as { id: string }[];
  const ref = (id: string, owner: Person) => ({ id, campaignId: campaign.id as string, ownerUserId: owner.id });
  return {
    campaignId: campaign.id as string,
    reed: ref(reed!.id, world.playerA),
    moss: ref(moss!.id, world.playerB),
    wick: ref(wick!.id, world.playerA),
    bree: ref(bree!.id, world.playerA),
  };
}

const groupOf = async (actorId: string) => Number(must(await world.admin.from('party_group_members').select('group_number').eq('actor_id', actorId).single()).group_number);
const orderOf = async (campaignId: string, group = 1): Promise<MarchingOrder> =>
  toMarchingOrder(must(await world.admin.from('marching_orders').select('*').eq('campaign_id', campaignId).eq('group_number', group).single()));
const undo = (person: Person, campaignId: string, eventId: string) => as(person, undoChange, { campaignId, eventId, authorUserId: person.id });
const target = (campaignId: string, group: number): MarchingTarget => ({ campaignId, group, playersReorder: true });
const eventsOf = async (requestId: string) => must(await world.admin.from('events').select('id, type, level, audience, target_table, target_id').eq('request_id', requestId).order('seq'));

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('one group to start with', () => {
  it('every character and hireling is in the party (group 1), with its own id as the row id; members read it, an outsider nothing', async () => {
    const t = await freshTable();
    const rows = must(await world.playerB.db.from('party_group_members').select('id, actor_id, group_number').eq('campaign_id', t.campaignId)) as { id: string; actor_id: string; group_number: number }[];
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.group_number === 1 && r.id === r.actor_id)).toBe(true);
    expect(must(await world.playerB.db.from('party_groups').select('number').eq('campaign_id', t.campaignId))).toEqual([{ number: 1 }]);
    expect(must(await world.outsider.db.from('party_group_members').select('id').eq('campaign_id', t.campaignId))).toEqual([]);
    // Nobody changes a row straight in the table: only through Split the party.
    const straight = await world.playerA.db.from('party_group_members').update({ group_number: 1 }).eq('actor_id', t.reed.id).select('id');
    expect(straight.error?.message).toMatch(/Split the party/);
  });
});

describe('Split the party', () => {
  it('a player puts their own character in a new group; their hireling follows; logged Simple for everyone; Undo puts it back', async () => {
    const t = await freshTable();
    const requestId = crypto.randomUUID();
    expect(await ok(as(world.playerA, chooseGroup, { character: t.reed, group: null }, requestId))).toBe(2);
    expect([await groupOf(t.reed.id), await groupOf(t.bree.id), await groupOf(t.wick.id), await groupOf(t.moss.id)]).toEqual([2, 2, 1, 1]);
    const events = await eventsOf(requestId);
    expect(events.map((e) => [e.type, e.level, e.audience])).toEqual([
      ['party.chooseGroup', 'simple', 'all'],
      ['party.chooseGroup', 'simple', 'all'],
    ]);
    // The character leads the line (its row's id is the character's).
    expect(events[0]!.target_id).toBe(t.reed.id);
    // Group 2 has its own marching order, made with it.
    expect((await orderOf(t.campaignId, 2)).rows).toEqual([]);
    expect(await undo(world.playerA, t.campaignId, events[0]!.id as string)).toMatchObject({ ok: true });
    expect([await groupOf(t.reed.id), await groupOf(t.bree.id)]).toEqual([1, 1]);
  });

  it("a player can't move another player's character; the GM can move anyone; a repeat changes nothing", async () => {
    const t = await freshTable();
    expect(await as(world.playerB, chooseGroup, { character: t.reed, group: null })).toMatchObject({ ok: false, reason: 'not-allowed' });
    // Straight to the database, skipping the app's check: refused too.
    expect((await world.playerB.db.rpc('choose_party_group', { actor: t.reed.id, to_group: null })).error?.code).toBe('42501');
    const requestId = crypto.randomUUID();
    await ok(as(world.gm, chooseGroup, { character: t.moss, group: null }, requestId));
    await ok(as(world.gm, chooseGroup, { character: t.moss, group: null }, requestId));
    expect(await groupOf(t.moss.id)).toBe(2);
    expect(must(await world.admin.from('party_groups').select('number').eq('campaign_id', t.campaignId).order('number'))).toEqual([{ number: 1 }, { number: 2 }]);
  });

  it('with one group left everyone is the party again; Join up merges groups (a player may while they are together)', async () => {
    const t = await freshTable();
    await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    // Reed (and Bree) join Moss in group 2, then Wick too: one group left, so it's the party, group 1, again.
    await ok(as(world.playerA, chooseGroup, { character: t.reed, group: 2 }));
    const last = await ok(as(world.playerA, chooseGroup, { character: t.wick, group: 2 }));
    expect(last).toBe(1);
    expect([await groupOf(t.reed.id), await groupOf(t.wick.id), await groupOf(t.moss.id), await groupOf(t.bree.id)]).toEqual([1, 1, 1, 1]);
    // Split again (the empty group 2 is used again), then Join up by a player.
    expect(await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }))).toBe(2);
    const requestId = crypto.randomUUID();
    await ok(as(world.playerA, joinUp, { campaignId: t.campaignId, together: true, from: 2, into: 1 }, requestId));
    expect(await groupOf(t.moss.id)).toBe(1);
    expect([...new Set((await eventsOf(requestId)).map((e) => e.type))]).toEqual(['party.joinUp']);
    expect((await world.outsider.db.rpc('join_party_groups', { campaign: t.campaignId, from_group: 2, into_group: 1 })).error?.code).toBe('42501');
  });
});

describe('a marching order per group', () => {
  it("a group's order holds only its own characters; the party's isn't touched by it", async () => {
    const t = await freshTable();
    await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    await ok(as(world.playerA, chooseGroup, { character: t.wick, group: 2 }));
    const two = await orderOf(t.campaignId, 2);
    await ok(as(world.playerB, setMarchingOrder, { target: target(t.campaignId, 2), order: two, rows: [[t.moss.id], [t.wick.id]] }));
    expect((await orderOf(t.campaignId, 2)).rows).toEqual([[t.moss.id], [t.wick.id]]);
    expect((await orderOf(t.campaignId, 1)).rows).toEqual([]);
    // Reed is in the party, not group 2: refused as an old copy (someone moved since).
    const wrong = await as(world.playerB, setMarchingOrder, { target: target(t.campaignId, 2), order: await orderOf(t.campaignId, 2), rows: [[t.reed.id], [t.moss.id]] });
    expect(wrong).toMatchObject({ ok: false, reason: 'stale' });
  });

  // Purpose: the saved orders are the campaign's, whichever group saved them; and a lock stored on the party's row
  // (group 1's) before the lock went (B11, 2026-11-18) stops no player in any group, in the app or in the database.
  it("the saved orders are the campaign's: saved in one group, used in another; a stored lock stops no player in any group", async () => {
    const t = await freshTable();
    const party = await orderOf(t.campaignId, 1);
    await ok(as(world.playerA, setMarchingOrder, { target: target(t.campaignId, 1), order: party, rows: [[t.moss.id], [t.wick.id], [t.reed.id], [t.bree.id]] }));
    await ok(as(world.playerA, saveMarchingPreset, { target: target(t.campaignId, 1), order: await orderOf(t.campaignId, 1), name: 'Causeway' }));
    await ok(as(world.playerB, chooseGroup, { character: t.moss, group: null }));
    await ok(as(world.playerA, chooseGroup, { character: t.wick, group: 2 }));
    // Used in group 2: only its own characters, in the saved order (Bree, player A's hireling, went with Wick).
    await ok(as(world.playerB, applyMarchingPreset, { target: target(t.campaignId, 2), order: await orderOf(t.campaignId, 2), name: 'Causeway' }));
    expect((await orderOf(t.campaignId, 2)).rows).toEqual([[t.moss.id], [t.wick.id], [t.bree.id]]);
    await ok(as(world.gm, lockMarchingOrder, { target: target(t.campaignId, 1), order: await orderOf(t.campaignId, 1), locked: true }));
    expect((await orderOf(t.campaignId, 1)).locked).toBe(true);
    // Group 2's players still move their own order, through the app…
    await ok(as(world.playerB, setMarchingOrder, { target: target(t.campaignId, 2), order: await orderOf(t.campaignId, 2), rows: [[t.wick.id], [t.moss.id], [t.bree.id]] }));
    expect((await orderOf(t.campaignId, 2)).rows).toEqual([[t.wick.id], [t.moss.id], [t.bree.id]]);
    // …and straight to the database, skipping the app's check.
    expect((await world.playerB.db.rpc('set_marching_order', { campaign: t.campaignId, new_rows: [[t.moss.id], [t.wick.id], [t.bree.id]], party_group: 2 })).error).toBeNull();
    expect((await orderOf(t.campaignId, 2)).rows).toEqual([[t.moss.id], [t.wick.id], [t.bree.id]]);
    await ok(as(world.gm, setMarchingOrder, { target: target(t.campaignId, 2), order: await orderOf(t.campaignId, 2), rows: [[t.wick.id], [t.moss.id], [t.bree.id]] }));
    // The lock is still stored on the party's row; nothing was changed or deleted.
    expect((await orderOf(t.campaignId, 1)).locked).toBe(true);
  });

  it('a saved order can be deleted (logged in the detailed log), and Undo puts it back', async () => {
    const t = await freshTable();
    await ok(as(world.playerA, setMarchingOrder, { target: target(t.campaignId, 1), order: await orderOf(t.campaignId, 1), rows: [[t.reed.id], [t.moss.id]] }));
    await ok(as(world.playerA, saveMarchingPreset, { target: target(t.campaignId, 1), order: await orderOf(t.campaignId, 1), name: 'Ford' }));
    const requestId = crypto.randomUUID();
    await ok(as(world.playerB, deleteMarchingPreset, { target: target(t.campaignId, 1), order: await orderOf(t.campaignId, 1), name: 'ford' }, requestId));
    expect((await orderOf(t.campaignId, 1)).presets).toEqual([]);
    const [event] = await eventsOf(requestId);
    expect(event).toMatchObject({ type: 'marching.deletePreset', level: 'verbose' });
    expect(await undo(world.playerB, t.campaignId, event!.id as string)).toMatchObject({ ok: true });
    expect((await orderOf(t.campaignId, 1)).presets.map((p) => p.name)).toEqual(['Ford']);
  });
});
