// Undo a move of part of a stack (re-test ruling 5, 2026-10-26; CLAUDE.md hard rule 4;
// supabase/migrations/20261026120000_m4b_undo_split.sql). TEST project only; invented content.
//   Giving part of a stack splits it; Undo merges the given part back into the stack, logged against the event
//   that made it. A second undo is refused. Ruling 10 (2026-10-26; …_m4b_undo_whole_give.sql): a whole item given to
//   another player's character comes back too. Ruling 5b (2026-10-26; …_m4b_undo_whats_left.sql): if the receiver
//   used some, what's left comes back and the undo says how much was used; passed on, all used, or more of it than
//   was given: refused. The ruling on 5b (…_m4b_undo_whats_left_rules.sql): moved within the receiver's own pack
//   still comes back; renamed, identified, charges spent or given on: refused, the reason naming it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { addItem, equipItem, moveItem, removeItem, setItemQty, type CarrierRef, type ItemCopy } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
const wren = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false });
const ash = (): CarrierRef => ({ campaignId: world.campaignId, actorId: world.ashId, locationId: null, ownerUserId: world.playerB.id, archived: false });
let made = 0;

async function stackOf(qty: number) {
  made += 1;
  const item: ItemCopy = { libraryEntryId: null, name: `Reed darts ${made}`, category: 'gear', weightCoin: 1, slots: 1, stack: 20 };
  const added = await as(world.gm, addItem, { carrier: wren(), item, qty, howGot: 'found' });
  if (!added.ok) throw new Error(added.message);
  return { id: added.value.id, name: item.name, carrier: wren() };
}
const linesNamed = async (name: string) =>
  must(await world.admin.from('inventory_lines').select('id, actor_id, qty').eq('campaign_id', world.campaignId).eq('name', name).order('qty', { ascending: false }));
const lastMove = async (person: Person) =>
  must(await person.db.from('events').select('id').eq('type', 'inventory.move').eq('actor_user_id', person.id).order('seq', { ascending: false }).limit(1))[0]!
    .id as string;
const undo = (person: Person, eventId: string, author = person) => as(person, undoChange, { campaignId: world.campaignId, eventId, authorUserId: author.id });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('undoing part of a stack given inside the party', () => {
  it('merges the given part back into the stack, logged as reversing the move; a second undo is refused', async () => {
    const stack = await stackOf(6);
    const given = await as(world.playerA, moveItem, { line: stack, to: ash(), qty: 2, of: 6 });
    if (!given.ok) throw new Error(given.message);
    expect(await linesNamed(stack.name)).toEqual([
      { id: stack.id, actor_id: world.wrenId, qty: 4 },
      { id: given.value.id, actor_id: world.ashId, qty: 2 },
    ]);
    const moved = await lastMove(world.playerA);
    expect(await undo(world.playerA, moved)).toMatchObject({ ok: true });
    expect(await linesNamed(stack.name)).toEqual([{ id: stack.id, actor_id: world.wrenId, qty: 6 }]);
    // The part's removal is kept in the log, linked to the event that made it.
    const removal = must(await world.admin.from('events').select('reverts_event_id').eq('target_id', given.value.id).is('after', null));
    expect(removal).toHaveLength(1);
    expect(removal[0]!.reverts_event_id).not.toBeNull();
    expect(await undo(world.playerA, moved)).toMatchObject({ ok: false });
    expect(await linesNamed(stack.name)).toEqual([{ id: stack.id, actor_id: world.wrenId, qty: 6 }]);
  });

  it('into the Party stash too, and the GM can undo it', async () => {
    const stack = await stackOf(5);
    const stash = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'))[0]!.id as string;
    const to: CarrierRef = { campaignId: world.campaignId, actorId: null, locationId: stash, ownerUserId: null, archived: false };
    expect(await as(world.playerA, moveItem, { line: stack, to, qty: 3, of: 5 })).toMatchObject({ ok: true });
    expect(await undo(world.gm, await lastMove(world.playerA), world.playerA)).toMatchObject({ ok: true });
    expect(await linesNamed(stack.name)).toEqual([{ id: stack.id, actor_id: world.wrenId, qty: 5 }]);
  });

  // Ruling 10 (2026-10-26): a whole item given to another player's character came back refused, because putting it
  // back needs the right to change that character's items, which the giver no longer has.
  it("a player undoes a whole item given to another player's character: it comes back", async () => {
    const stack = await stackOf(3);
    expect(await as(world.playerA, moveItem, { line: stack, to: ash(), qty: 3, of: 3 })).toMatchObject({ ok: true, value: { actorId: world.ashId } });
    expect(await undo(world.playerA, await lastMove(world.playerA))).toMatchObject({ ok: true });
    expect(await linesNamed(stack.name)).toEqual([{ id: stack.id, actor_id: world.wrenId, qty: 3 }]);
  });

  it('a whole item given to the Party stash comes back too', async () => {
    const stack = await stackOf(2);
    const stash = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'))[0]!.id as string;
    const to: CarrierRef = { campaignId: world.campaignId, actorId: null, locationId: stash, ownerUserId: null, archived: false };
    expect(await as(world.playerA, moveItem, { line: stack, to, qty: 2, of: 2 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, await lastMove(world.playerA))).toMatchObject({ ok: true });
    expect(await linesNamed(stack.name)).toEqual([{ id: stack.id, actor_id: world.wrenId, qty: 2 }]);
  });

  it("the GM can undo a player's whole give; another player can't; once the receiver changed it, it stays", async () => {
    const first = await stackOf(1);
    expect(await as(world.playerA, moveItem, { line: first, to: ash(), qty: 1, of: 1 })).toMatchObject({ ok: true });
    const moved = await lastMove(world.playerA);
    // Ash's player can't undo Wren's player's give (the command refuses, and so does the database).
    expect(await undo(world.playerB, moved, world.playerA)).toMatchObject({ ok: false });
    const direct = await world.playerB.db.rpc('undo_request', { event_id: moved });
    expect(direct.error).not.toBeNull();
    expect(await linesNamed(first.name)).toEqual([{ id: first.id, actor_id: world.ashId, qty: 1 }]);
    expect(await undo(world.gm, moved, world.playerA)).toMatchObject({ ok: true });
    expect(await linesNamed(first.name)).toEqual([{ id: first.id, actor_id: world.wrenId, qty: 1 }]);

    const second = await stackOf(4);
    expect(await as(world.playerA, moveItem, { line: second, to: ash(), qty: 4, of: 4 })).toMatchObject({ ok: true });
    const again = await lastMove(world.playerA);
    // 5b: Ash's player used one; what's left comes back, and the undo says so.
    expect(await as(world.playerB, setItemQty, { line: { id: second.id, carrier: ash() }, qty: 3 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, again)).toMatchObject({ ok: true, value: { left: 3, of: 4, name: second.name, by: 'Ash the Reed Cutter' } });
    expect(await linesNamed(second.name)).toEqual([{ id: second.id, actor_id: world.wrenId, qty: 3 }]);

    // Once the receiver has handed it on, the giver's undo is refused and nothing moves.
    const third = await stackOf(1);
    expect(await as(world.playerA, moveItem, { line: third, to: ash(), qty: 1, of: 1 })).toMatchObject({ ok: true });
    const handed = await lastMove(world.playerA);
    const stash = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'))[0]!.id as string;
    const toStash: CarrierRef = { campaignId: world.campaignId, actorId: null, locationId: stash, ownerUserId: null, archived: false };
    expect(await as(world.playerB, moveItem, { line: { id: third.id, carrier: ash() }, to: toStash, qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, handed)).toMatchObject({ ok: false });
    expect(must(await world.admin.from('inventory_lines').select('actor_id, location_id').eq('id', third.id))).toEqual([{ actor_id: null, location_id: stash }]);
  });

  it('5b: after the receiver used some of a given part, what is left merges back and the undo says how much', async () => {
    const stack = await stackOf(6);
    const given = await as(world.playerA, moveItem, { line: stack, to: ash(), qty: 2, of: 6 });
    if (!given.ok) throw new Error(given.message);
    const moved = await lastMove(world.playerA);
    expect(await as(world.playerB, setItemQty, { line: { id: given.value.id, carrier: ash() }, qty: 1 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, moved)).toMatchObject({ ok: true, value: { left: 1, of: 2, by: 'Ash the Reed Cutter' } });
    expect(await linesNamed(stack.name)).toEqual([{ id: stack.id, actor_id: world.wrenId, qty: 5 }]);
  });

  it('5b: all of it used, more of it than was given, or some passed on: refused with the reason, and nothing moves', async () => {
    // All used: nothing can come back.
    const first = await stackOf(6);
    const allGone = await as(world.playerA, moveItem, { line: first, to: ash(), qty: 2, of: 6 });
    if (!allGone.ok) throw new Error(allGone.message);
    const movedAll = await lastMove(world.playerA);
    expect(await as(world.playerB, removeItem, { line: { id: allGone.value.id, carrier: ash() }, qty: 2, of: 2 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, movedAll)).toMatchObject({ ok: false, message: 'None of it is left, so nothing can come back.' });
    expect(await linesNamed(first.name)).toEqual([{ id: first.id, actor_id: world.wrenId, qty: 4 }]);

    // More of it than was given (the GM added some): refused.
    const second = await stackOf(6);
    const grown = await as(world.playerA, moveItem, { line: second, to: ash(), qty: 2, of: 6 });
    if (!grown.ok) throw new Error(grown.message);
    const movedGrown = await lastMove(world.playerA);
    expect(await as(world.gm, setItemQty, { line: { id: grown.value.id, carrier: ash() }, qty: 5 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, movedGrown)).toMatchObject({ ok: false });
    expect(await linesNamed(second.name)).toEqual([
      { id: grown.value.id, actor_id: world.ashId, qty: 5 },
      { id: second.id, actor_id: world.wrenId, qty: 4 },
    ]);

    // Some passed on (Ash's player gave one of the two to the Party stash): refused.
    const third = await stackOf(6);
    const passed = await as(world.playerA, moveItem, { line: third, to: ash(), qty: 2, of: 6 });
    if (!passed.ok) throw new Error(passed.message);
    const movedPassed = await lastMove(world.playerA);
    const stash = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'))[0]!.id as string;
    const toStash: CarrierRef = { campaignId: world.campaignId, actorId: null, locationId: stash, ownerUserId: null, archived: false };
    expect(await as(world.playerB, moveItem, { line: { id: passed.value.id, carrier: ash() }, to: toStash, qty: 1, of: 2 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, movedPassed)).toMatchObject({ ok: false, message: 'Ash the Reed Cutter gave some to Party stash.' });
    expect((await linesNamed(third.name)).map((l) => l.qty)).toEqual([4, 1, 1]);
  });

  // The ruling on 5b (2026-10-26): moved within the receiver's own pack still comes back; any other change refuses,
  // and the reason names it.
  async function givenWhole(qty: number) {
    const stack = await stackOf(qty);
    expect(await as(world.playerA, moveItem, { line: stack, to: ash(), qty, of: qty })).toMatchObject({ ok: true });
    return { stack, moved: await lastMove(world.playerA), onAsh: { id: stack.id, carrier: ash() } };
  }

  it("moved within the receiver's own pack (worn or held): it still comes back, loose", async () => {
    const { stack, moved, onAsh } = await givenWhole(2);
    expect(await as(world.playerB, equipItem, { line: onAsh, equipped: true })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, moved)).toMatchObject({ ok: true });
    expect(must(await world.admin.from('inventory_lines').select('actor_id, equipped, qty').eq('id', stack.id))).toEqual([{ actor_id: world.wrenId, equipped: false, qty: 2 }]);
  });

  it('renamed since: refused, saying so', async () => {
    const { moved, stack } = await givenWhole(2);
    must(await world.gm.db.from('inventory_lines').update({ name: `${stack.name} (bent)` }).eq('id', stack.id).select('id'));
    expect(await undo(world.playerA, moved)).toMatchObject({ ok: false, message: "Ash the Reed Cutter renamed it since, so it can't go back." });
  });

  it('identified or revealed since: refused, saying so', async () => {
    const { moved, stack } = await givenWhole(2);
    must(await world.gm.db.from('inventory_lines').update({ item_data: { revealed: 'Glows near water' } }).eq('id', stack.id).select('id'));
    expect(await undo(world.playerA, moved)).toMatchObject({ ok: false, message: "It's been identified since, so it can't go back." });
  });

  it('charges spent since: refused, saying so', async () => {
    const { moved, stack } = await givenWhole(1);
    must(await world.gm.db.from('inventory_lines').update({ charges_used: 1 }).eq('id', stack.id).select('id'));
    expect(await undo(world.playerA, moved)).toMatchObject({ ok: false, message: "Ash the Reed Cutter used its charges since, so it can't go back." });
  });

  it('given on to someone else: refused, naming who has it now', async () => {
    const { moved, onAsh, stack } = await givenWhole(2);
    const stash = must(await world.admin.from('locations').select('id').eq('campaign_id', world.campaignId).eq('kind', 'stash'))[0]!.id as string;
    const toStash: CarrierRef = { campaignId: world.campaignId, actorId: null, locationId: stash, ownerUserId: null, archived: false };
    expect(await as(world.playerB, moveItem, { line: onAsh, to: toStash, qty: 2, of: 2 })).toMatchObject({ ok: true });
    expect(await undo(world.playerA, moved)).toMatchObject({ ok: false, message: 'Ash the Reed Cutter gave them to Party stash.' });
    expect(must(await world.admin.from('inventory_lines').select('location_id').eq('id', stack.id))).toEqual([{ location_id: stash }]);
  });
});
