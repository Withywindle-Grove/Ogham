// fix-one-off-undo-approval: the guard on players' item lines (private.guard_lines_from_players, newest in
// 20261104230000_fix_review_2026_11_04.sql) lets every Undo through (grimoire.reverting). A one-off on a player's own
// unapproved character comes in approved (that character's approval covers it); moved to an approved character it
// waits for the GM again. But if the GM then approved the first character, never having seen the item, the player's
// Undo of the move put it back there approved. TEST project only (CI: a local Supabase); invented content.
//   Purpose:
//   1. Once the GM approves the character it came from, the player's Undo of a one-off's move puts it back there
//      waiting for the GM (as adding a one-off to an approved character does), never approved.
//   2. The same for a one-off moved between two of the player's own drafts, the first approved since.
//   3. While the character it came from still waits, the Undo puts it back approved, as before.
//   4. The GM's Undo of that move is unchanged: it comes back approved.
//   5. In a campaign whose one-offs need no approval, it comes back approved.
//   6. A one-off the GM approved, given whole to another player's character, comes back approved on Undo.
//   7. Part of a one-off stack the GM approved, given to another player's character, merges back on Undo, approved.
//   8. A one-off dropped from a draft that the GM approved since comes back on the player's Undo waiting for the GM.
//   9. While the draft still waits, the dropped one-off comes back approved, as before.
//   10. A one-off the GM approved, dropped from an approved character, comes back approved on the player's Undo.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { createCharacter, reviewCharacter, sendCharacter } from '../../src/modules/characters/commands.ts';
import { addItem, moveItem, removeItem, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let original: unknown;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
const settle = async (settings: Record<string, unknown>) =>
  must(await world.admin.from('campaigns').update({ settings: { ...(original as object), ...settings } }).eq('id', world.campaignId).select('id'));
const carrierOf = (actorId: string, ownerUserId: string): CarrierRef => ({ campaignId: world.campaignId, actorId, locationId: null, ownerUserId, archived: false });
const wren = () => carrierOf(world.wrenId, world.playerA.id);
const ash = () => carrierOf(world.ashId, world.playerB.id);
const lineOf = async (lineId: string) => must(await world.admin.from('inventory_lines').select('actor_id, approval, qty').eq('id', lineId).single());
const draftOf = async (name: string) => {
  const made = await as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name, level: 1, draft: true });
  if (!made.ok) throw new Error(made.message);
  return made.value;
};
const approve = async (draft: Awaited<ReturnType<typeof draftOf>>) => {
  const sent = await as(world.playerA, sendCharacter, { character: draft });
  if (!sent.ok) throw new Error(sent.message);
  expect(await as(world.gm, reviewCharacter, { character: sent.value, decision: 'approved' as const })).toMatchObject({ ok: true });
};
const oneOff = async (by: Person, carrier: CarrierRef, name: string, qty = 1) => {
  const made = await as(by, addItem, { carrier, item: { libraryEntryId: null, name, category: 'gear', weightCoin: 1, slots: null, stack: 20 }, qty, howGot: 'found' });
  if (!made.ok) throw new Error(made.message);
  return { id: made.value.id, carrier };
};
const lastMove = async (by: Person) =>
  must(await world.admin.from('events').select('id').eq('campaign_id', world.campaignId).eq('type', 'inventory.move').eq('actor_user_id', by.id).order('seq', { ascending: false }).limit(1))[0]!
    .id as string;
const undo = (person: Person, eventId: string, author: Person) => as(person, undoChange, { campaignId: world.campaignId, eventId, authorUserId: author.id });

/** A one-off on a new draft of player A's (approved, the draft covering it), moved whole to Wren (waiting again). */
async function movedOffDraft(draftName: string, itemName: string) {
  const draft = await draftOf(draftName);
  const line = await oneOff(world.playerA, carrierOf(draft.id, world.playerA.id), itemName);
  expect(await lineOf(line.id)).toMatchObject({ approval: 'approved' });
  expect(await as(world.playerA, moveItem, { line, to: wren(), qty: 1, of: 1 })).toMatchObject({ ok: true });
  expect(await lineOf(line.id)).toMatchObject({ actor_id: world.wrenId, approval: 'pending' });
  return { draft, line, moved: await lastMove(world.playerA) };
}

beforeAll(async () => {
  world = await buildWorld();
  original = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId).single()).settings;
}, 300_000);
afterAll(async () => {
  await settle({});
  await tearDownWorld(world);
}, 60_000);

describe('the Undo of a one-off moved off a character that was approved since', () => {
  it.fails("1. the player's Undo puts it back waiting for the GM, not approved", async () => {
    const { draft, line, moved } = await movedOffDraft('Marram', 'A heron feather quill');
    await approve(draft);
    expect(await undo(world.playerA, moved, world.playerA)).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toMatchObject({ actor_id: draft.id, approval: 'pending' });
  });

  it.fails('2. moved between two of the player\'s drafts, the first approved since, it comes back waiting', async () => {
    const first = await draftOf('Sorrel');
    const second = await draftOf('Yarrow');
    const line = await oneOff(world.playerA, carrierOf(first.id, world.playerA.id), 'A cracked moonstone');
    expect(await as(world.playerA, moveItem, { line, to: carrierOf(second.id, world.playerA.id), qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toMatchObject({ actor_id: second.id, approval: 'approved' });
    const moved = await lastMove(world.playerA);
    await approve(first);
    expect(await undo(world.playerA, moved, world.playerA)).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toMatchObject({ actor_id: first.id, approval: 'pending' });
  });

  it('3. while the character still waits, the Undo puts it back approved, as before', async () => {
    const { draft, line, moved } = await movedOffDraft('Hawkbit', 'A tin of lamp soot');
    expect(await undo(world.playerA, moved, world.playerA)).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toMatchObject({ actor_id: draft.id, approval: 'approved' });
  });

  it("4. the GM's Undo of the move is unchanged: it comes back approved", async () => {
    const { draft, line, moved } = await movedOffDraft('Tansy', 'A frog-shaped button');
    await approve(draft);
    expect(await undo(world.gm, moved, world.playerA)).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toMatchObject({ actor_id: draft.id, approval: 'approved' });
  });

  it("5. in a campaign whose one-offs need no approval, the player's Undo puts it back approved", async () => {
    const { draft, line, moved } = await movedOffDraft('Vetch', 'A ball of waxed twine');
    await approve(draft);
    await settle({ oneOffApproval: false });
    try {
      expect(await undo(world.playerA, moved, world.playerA)).toMatchObject({ ok: true });
      expect(await lineOf(line.id)).toMatchObject({ actor_id: draft.id, approval: 'approved' });
    } finally {
      await settle({});
    }
  });
});

describe('other Undos through the same guard still work', () => {
  it('6. a one-off the GM approved, given whole to another player\'s character, comes back approved', async () => {
    const line = await oneOff(world.gm, wren(), 'A chipped bone die');
    expect(await lineOf(line.id)).toMatchObject({ approval: 'approved' });
    expect(await as(world.playerA, moveItem, { line, to: ash(), qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toMatchObject({ actor_id: world.ashId, approval: 'approved' });
    expect(await undo(world.playerA, await lastMove(world.playerA), world.playerA)).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toMatchObject({ actor_id: world.wrenId, approval: 'approved' });
  });

  it("7. part of a one-off stack the GM approved, given to another player's character, merges back approved", async () => {
    const line = await oneOff(world.gm, wren(), 'Sprigs of marsh mint', 3);
    const given = await as(world.playerA, moveItem, { line, to: ash(), qty: 1, of: 3 });
    if (!given.ok) throw new Error(given.message);
    expect(await lineOf(line.id)).toMatchObject({ actor_id: world.wrenId, approval: 'approved', qty: 2 });
    expect(await undo(world.playerA, await lastMove(world.playerA), world.playerA)).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toMatchObject({ actor_id: world.wrenId, approval: 'approved', qty: 3 });
    expect(must(await world.admin.from('inventory_lines').select('id').eq('id', given.value.id))).toHaveLength(0);
  });
});

describe('the Undo of a one-off dropped from a draft', () => {
  /** A one-off on a new draft of player A's (approved, the draft covering it), dropped by player A. */
  async function droppedFromDraft(draftName: string, itemName: string) {
    const draft = await draftOf(draftName);
    const line = await oneOff(world.playerA, carrierOf(draft.id, world.playerA.id), itemName);
    expect(await lineOf(line.id)).toMatchObject({ approval: 'approved' });
    expect(await as(world.playerA, removeItem, { line, qty: 1, of: 1 })).toMatchObject({ ok: true });
    const dropped = must(await world.admin.from('events').select('id').eq('type', 'inventory.remove').eq('target_id', line.id).order('seq', { ascending: false }).limit(1))[0]!.id as string;
    return { draft, line, dropped };
  }

  it.fails('8. once the GM approves the draft, the player\'s Undo brings it back waiting for the GM', async () => {
    const { draft, line, dropped } = await droppedFromDraft('Pennywort', 'A snail-shell whistle');
    await approve(draft);
    expect(await undo(world.playerA, dropped, world.playerA)).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toMatchObject({ actor_id: draft.id, approval: 'pending' });
  });

  it('9. while the draft still waits, the Undo brings it back approved, as before', async () => {
    const { draft, line, dropped } = await droppedFromDraft('Coltsfoot', 'A heron feather fan');
    expect(await undo(world.playerA, dropped, world.playerA)).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toMatchObject({ actor_id: draft.id, approval: 'approved' });
  });

  it('10. a one-off the GM approved, dropped from an approved character, comes back approved', async () => {
    const line = await oneOff(world.gm, wren(), 'A cork float');
    expect(await as(world.playerA, removeItem, { line, qty: 1, of: 1 })).toMatchObject({ ok: true });
    const dropped = must(await world.admin.from('events').select('id').eq('type', 'inventory.remove').eq('target_id', line.id).order('seq', { ascending: false }).limit(1))[0]!.id as string;
    expect(await undo(world.playerA, dropped, world.playerA)).toMatchObject({ ok: true });
    expect(await lineOf(line.id)).toMatchObject({ actor_id: world.wrenId, approval: 'approved' });
  });
});
