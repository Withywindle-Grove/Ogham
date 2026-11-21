// One-off items from creation come in approved (bq3-6, ruled 2026-11-04; docs/plans/m5b-0c-one-offs.md;
// supabase/migrations/20261104140000_m5b_0c_creation_one_offs.sql). TEST project only; invented content.
//   A player's one-off on a character of their own that isn't approved yet (a draft, waiting or sent back) comes in
//   approved: the character's own approval covers it. An approved character's one-off waits as before; another
//   player can't add to a character they don't own; the GM's one-offs are approved as before. A one-off moved off such
//   a character waits again where it lands.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { createCharacter, reviewCharacter, sendCharacter } from '../../src/modules/characters/commands.ts';
import { addItem, moveItem, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
const carrierOf = (actorId: string, ownerUserId: string): CarrierRef => ({ campaignId: world.campaignId, actorId, locationId: null, ownerUserId, archived: false });
const oneOff = (by: Person, carrier: CarrierRef, name: string) =>
  as(by, addItem, { carrier, item: { libraryEntryId: null, name, category: 'gear', weightCoin: 5, slots: null, stack: 1 }, qty: 1, howGot: 'found' });
const approvalOf = async (lineId: string) => must(await world.admin.from('inventory_lines').select('approval').eq('id', lineId))[0]!.approval;
const draftOf = async (by: Person, name: string) => {
  const made = await as(by, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name, level: 1, draft: true });
  if (!made.ok) throw new Error(made.message);
  return made.value;
};

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe("a player's one-off during creation (the campaign's one-off approval on, the default)", () => {
  it("on their own draft comes in approved; the draft's owner sees it in the pack", async () => {
    const draft = await draftOf(world.playerA, 'Moss');
    const made = await oneOff(world.playerA, carrierOf(draft.id, world.playerA.id), 'A pebble that is always warm');
    expect(made.ok && made.value.approval).toBe('approved');
    expect(must(await world.playerA.db.from('inventory_lines').select('id, approval').eq('actor_id', draft.id))).toMatchObject([{ approval: 'approved' }]);
  });

  it('on their own character that was sent (waiting) or sent back comes in approved too', async () => {
    const draft = await draftOf(world.playerA, 'Fen');
    const sent = await as(world.playerA, sendCharacter, { character: draft });
    if (!sent.ok) throw new Error(sent.message);
    const waiting = await oneOff(world.playerA, carrierOf(draft.id, world.playerA.id), 'A reed whistle');
    expect(waiting.ok && waiting.value.approval).toBe('approved');
    const back = await as(world.gm, reviewCharacter, { character: sent.value, decision: 'rejected' as const, note: 'Pick a kit' });
    if (!back.ok) throw new Error(back.message);
    const sentBack = await oneOff(world.playerA, carrierOf(draft.id, world.playerA.id), 'A knotted cord');
    expect(sentBack.ok && sentBack.value.approval).toBe('approved');
  });

  it('on their own approved character still waits for the GM', async () => {
    const made = await oneOff(world.playerA, carrierOf(world.wrenId, world.playerA.id), 'Mossy idol');
    expect(made.ok && made.value.approval).toBe('pending');
  });

  it("can't be put on another player's draft or approved character", async () => {
    const draft = await draftOf(world.playerA, 'Rush');
    expect((await oneOff(world.playerB, carrierOf(draft.id, world.playerA.id), 'A bent nail')).ok).toBe(false);
    expect((await oneOff(world.playerB, carrierOf(world.wrenId, world.playerA.id), 'A bent nail')).ok).toBe(false);
    expect(must(await world.admin.from('inventory_lines').select('id').eq('name', 'A bent nail'))).toHaveLength(0);
  });

  // Purpose (review of 2026-11-04): past the app's can(), a direct insert of a one-off onto another player's draft is
  // refused by the database.
  it("can't be put on another player's draft by a direct insert either", async () => {
    const draft = await draftOf(world.playerA, 'Teasel');
    const direct = await world.playerB.db
      .from('inventory_lines')
      .insert({ campaign_id: world.campaignId, actor_id: draft.id, location_id: null, library_entry_id: null, name: 'A rusty key', category: 'gear', weight_coin: 5, slots: null, stack: 1, item_data: {}, qty: 1, how_got: 'found', cost: '', notes: '' })
      .select('id');
    expect(direct.error).not.toBeNull();
    expect(must(await world.admin.from('inventory_lines').select('id').eq('name', 'A rusty key'))).toHaveLength(0);
  });

  it("the GM's one-off on a player's waiting character is approved, as before", async () => {
    const draft = await draftOf(world.playerA, 'Sedge');
    const sent = await as(world.playerA, sendCharacter, { character: draft });
    if (!sent.ok) throw new Error(sent.message);
    const made = await oneOff(world.gm, carrierOf(draft.id, world.playerA.id), 'A lantern hook');
    expect(made.ok && made.value.approval).toBe('approved');
  });

  it("moved off the draft to the player's approved character, it waits for the GM again", async () => {
    const draft = await draftOf(world.playerA, 'Tam');
    const from = carrierOf(draft.id, world.playerA.id);
    const made = await oneOff(world.playerA, from, 'A lucky eel tooth');
    if (!made.ok) throw new Error(made.message);
    const moved = await as(world.playerA, moveItem, { line: { id: made.value.id, carrier: from }, to: carrierOf(world.wrenId, world.playerA.id), qty: 1, of: 1 });
    expect(moved.ok).toBe(true);
    expect(await approvalOf(made.value.id)).toBe('pending');
  });
});

describe("a one-off moved between two of a player's own unapproved characters (fresh-session review of 2026-11-04)", () => {
  // Purpose: moved from one draft of the player's own to another, the one-off stays approved: the other draft's own
  // approval covers it just the same (today it landed pending, as if it had reached an approved character).
  it('lands approved on the other draft', async () => {
    const first = await draftOf(world.playerA, 'Bramble');
    const second = await draftOf(world.playerA, 'Thistle');
    const from = carrierOf(first.id, world.playerA.id);
    const made = await oneOff(world.playerA, from, 'A smooth river stone');
    if (!made.ok) throw new Error(made.message);
    expect(made.value.approval).toBe('approved');
    const moved = await as(world.playerA, moveItem, { line: { id: made.value.id, carrier: from }, to: carrierOf(second.id, world.playerA.id), qty: 1, of: 1 });
    expect(moved.ok).toBe(true);
    expect(await approvalOf(made.value.id)).toBe('approved');
  });
});
