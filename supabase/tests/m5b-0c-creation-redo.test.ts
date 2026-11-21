// M5b step 0c, follow-up C: creation.redo (supabase/migrations/20261102310000_m5b_0c_creation_redo.sql; ruled
// 2026-11-02, cf-7). TEST project only; invented content.
//   Purpose:
//   1. The owner of a draft changes its class through creation.redo: the row's class, record, book and skills change
//      and the kit's lines leave the pack in one request; the Given gear stays.
//   2. Undo of that one change (the log's) puts the row and the deleted lines back, as a drop's undo does.
//   3. Another player can't redo someone else's draft; the GM can redo a character that's waiting.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { createCharacter, type CharacterRef } from '../../src/modules/characters/commands.ts';
import { redoCreation, type RedoChoice } from '../../src/modules/characters/redo.ts';
import { addItem, type CarrierRef, type ItemCopy } from '../../src/modules/inventory/inventory.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

const warden: RedoChoice = { classRef: 'lantern-warden', raceRef: null, method: null, rolled: { GRT: 9 }, scores: { GRT: 9 } };
const witch: RedoChoice = { ...warden, classRef: 'reed-witch' };
const basket: ItemCopy = { libraryEntryId: null, name: 'Reed basket', category: 'container', weightCoin: 5, slots: 1, stack: 1 };
const rope: ItemCopy = { libraryEntryId: null, name: 'Reed rope', category: 'gear', weightCoin: 10, slots: 1, stack: 1 };

/** A draft of Player A's, a Lantern Warden with a kit line (bought) and a Given line, a book and a weapon skill. */
async function draft(approval: 'draft' | 'pending' = 'draft'): Promise<{ ref: CharacterRef; kit: string; given: string }> {
  const made = await ok(as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name: 'Tam', level: 1, classRef: 'lantern-warden', creation: { method: null, rolled: { GRT: 9 } }, draft: true }));
  const carrier: CarrierRef = { campaignId: world.campaignId, actorId: made.id, locationId: null, ownerUserId: world.playerA.id, archived: false };
  const kit = (await ok(as(world.playerA, addItem, { carrier, item: basket, qty: 1, howGot: 'bought', cost: '22 gp' }))).id;
  const given = (await ok(as(world.playerA, addItem, { carrier, item: rope, qty: 1, howGot: 'found' }))).id;
  must(
    await world.admin
      .from('actors')
      .update({
        spell_book: ['glimmer'],
        weapon_skills: [{ itemId: 'reed-spear' }],
        creation: { method: null, rolled: { GRT: 9 }, scores: { GRT: 9 }, startingMoney: 100, spentBase: 22, bought: [{ label: "Warden's kit", price: 22, kitId: 'warden-kit', lines: [{ id: kit, qty: 1 }] }], givenGear: [{ id: given, qty: 1 }] },
        ...(approval === 'pending' ? { approval: 'pending' } : {}),
      })
      .eq('id', made.id)
      .select('id'),
  );
  return { ref: { ...made, approval }, kit, given };
}
const lines = async (actorId: string) => must(await world.admin.from('inventory_lines').select('id').eq('actor_id', actorId)).map((l) => l.id as string).sort();
const row = async (actorId: string) => must(await world.admin.from('actors').select('classes, spell_book, weapon_skills, creation').eq('id', actorId).single());

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('creation.redo', () => {
  it('a class change by the owner rewrites the draft and takes the kit out, keeps the Given gear, and Undo puts it all back', async () => {
    const { ref, kit, given } = await draft();
    const before = await row(ref.id);
    const done = await as(world.playerA, redoCreation, { character: ref, choice: witch });
    expect(done).toMatchObject({ ok: true, value: { changed: true } });
    expect(await lines(ref.id)).toEqual([given]);
    const changed = await row(ref.id);
    expect(changed.classes).toEqual([{ classRef: 'reed-witch', level: 1, xp: 0 }]);
    expect(changed.spell_book).toEqual([]);
    expect(changed.weapon_skills).toEqual([]);
    expect(changed.creation).toMatchObject({ spentBase: 0, bought: [], startingMoney: 100, givenGear: [{ id: given, qty: 1 }] });

    // One log line for the whole change, as the owner sees it; its Undo brings the row and the line back.
    const event = must(await world.playerA.db.from('events').select('id').eq('type', 'creation.redo').eq('target_id', ref.id).order('seq', { ascending: false }).limit(1))[0]!;
    expect(await as(world.playerA, undoChange, { campaignId: world.campaignId, eventId: event.id as string, authorUserId: world.playerA.id })).toMatchObject({ ok: true });
    expect(await lines(ref.id)).toEqual([given, kit].sort());
    expect(await row(ref.id)).toEqual(before);
  });

  it("another player can't redo someone else's draft; the GM redoes a waiting character; a scores-only change keeps the gear", async () => {
    const { ref, kit, given } = await draft('pending');
    expect(await as(world.playerB, redoCreation, { character: ref, choice: warden })).toMatchObject({ ok: false, reason: 'not-allowed' });
    // Before approval the owner may still (04): a waiting character counts.
    expect(await as(world.playerA, redoCreation, { character: ref, choice: warden })).toMatchObject({ ok: true, value: { changed: false } });
    const done = await as(world.gm, redoCreation, { character: ref, choice: { ...warden, scores: { GRT: 8 } } });
    expect(done).toMatchObject({ ok: true, value: { changed: false } });
    expect(await lines(ref.id)).toEqual([given, kit].sort());
    const changed = await row(ref.id);
    expect(changed.spell_book).toEqual(['glimmer']);
    expect(changed.creation).toMatchObject({ scores: { GRT: 8 }, spentBase: 22 });
  });
});
