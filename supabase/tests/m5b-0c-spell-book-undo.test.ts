// fix-spellbook-undo-after-approval: the spell book's guard (private.guard_spell_book) let any Undo through
// (grimoire.reverting), so the owner could lower an approved character's spell book by undoing a change from before
// the approval. TEST project only (CI: a local Supabase); invented content.
//   Purpose:
//   1. Once the GM approves a character, the owner's Undo of a spell book change made while it waited is refused
//      (only the GM changes the spell book once the character is approved), and the book stays as approved.
//   2. The owner's Undo of a spell book change made after approval, while First spells is still on the To finish
//      list, goes through (the owner may still change the book then).
//   3. Once First spells is finished, the owner's Undo of a change made after approval is refused too: the owner may
//      no longer change the book, by Undo or otherwise.
//   4. The GM's Undo of the owner's change from before the approval goes through (the GM always may).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { createCharacter } from '../../src/modules/characters/commands.ts';
import { setSpellBook } from '../../src/modules/characters/spellBook.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let original: unknown;
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
const settle = async (settings: Record<string, unknown>) =>
  must(await world.admin.from('campaigns').update({ settings: { ...(original as object), ...settings } }).eq('id', world.campaignId).select('id'));

/** A new character of player A's, waiting for approval, with a spell book set by its owner while it waits. */
async function waitingWithBook(name: string) {
  const made = await ok(as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name, level: 1 }));
  const ref = (approval: 'pending' | 'approved', toFinish?: string[]) => ({ ...made, approval, ...(toFinish ? { toFinish } : {}) });
  const bookOf = async () => must(await world.admin.from('actors').select('spell_book').eq('id', made.id).single()).spell_book;
  const newestSet = async () =>
    must(
      await world.admin.from('events').select('id, actor_user_id').eq('campaign_id', world.campaignId).eq('type', 'creation.spellBook.set').eq('target_id', made.id).order('seq', { ascending: false }).limit(1),
    )[0]!;
  const approve = async () => must(await world.admin.from('actors').update({ approval: 'approved' }).eq('id', made.id).select('id'));
  const setCreation = async (creation: Record<string, unknown>) => must(await world.admin.from('actors').update({ creation }).eq('id', made.id).select('id'));
  const archive = async () => world.admin.from('actors').update({ status: 'archived' }).eq('id', made.id);
  expect(await as(world.playerA, setSpellBook, { character: ref('pending'), spellIds: ['glimmer', 'reed-whisper'] })).toMatchObject({ ok: true });
  expect(await bookOf()).toEqual(['glimmer', 'reed-whisper']);
  return { made, ref, bookOf, newestSet, approve, setCreation, archive };
}

beforeAll(async () => {
  world = await buildWorld();
  original = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId).single()).settings;
  await settle({ characterApproval: true, startLevel: 'one' });
}, 300_000);
afterAll(async () => {
  await settle({});
  await tearDownWorld(world);
});

describe('the Undo of a spell book change after approval', () => {
  it("1. the owner's Undo of a change made while the character waited is refused once it is approved", async () => {
    const c = await waitingWithBook('Wren of the Reeds');
    const waiting = await c.newestSet();
    expect(waiting.actor_user_id).toBe(world.playerA.id);
    await c.approve();
    expect(await as(world.playerA, undoChange, { campaignId: world.campaignId, eventId: waiting.id, authorUserId: waiting.actor_user_id })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await c.bookOf()).toEqual(['glimmer', 'reed-whisper']);
    await c.archive();
  });

  it("2. the owner's Undo of a change made after approval, with First spells still to finish, goes through", async () => {
    const c = await waitingWithBook('Tamsin Fenlight');
    await c.approve();
    await c.setCreation({ toFinish: ['spells'] });
    expect(await as(world.playerA, setSpellBook, { character: c.ref('approved', ['spells']), spellIds: ['glimmer', 'reed-whisper', 'mire-grip'] })).toMatchObject({ ok: true });
    const line = await c.newestSet();
    expect(line.actor_user_id).toBe(world.playerA.id);
    expect(await as(world.playerA, undoChange, { campaignId: world.campaignId, eventId: line.id, authorUserId: line.actor_user_id })).toMatchObject({ ok: true });
    expect(await c.bookOf()).toEqual(['glimmer', 'reed-whisper']);
    await c.archive();
  });

  it("3. once First spells is finished, the owner's Undo of a change made after approval is refused", async () => {
    const c = await waitingWithBook('Odo Lanternwick');
    await c.approve();
    await c.setCreation({ toFinish: ['spells'] });
    expect(await as(world.playerA, setSpellBook, { character: c.ref('approved', ['spells']), spellIds: ['glimmer', 'reed-whisper', 'mire-grip'] })).toMatchObject({ ok: true });
    const line = await c.newestSet();
    await c.setCreation({});
    expect(await as(world.playerA, undoChange, { campaignId: world.campaignId, eventId: line.id, authorUserId: line.actor_user_id })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await c.bookOf()).toEqual(['glimmer', 'reed-whisper', 'mire-grip']);
    await c.archive();
  });

  it("4. the GM's Undo of the owner's change from before the approval goes through", async () => {
    const c = await waitingWithBook('Bree Damplight');
    const waiting = await c.newestSet();
    await c.approve();
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: waiting.id, authorUserId: waiting.actor_user_id })).toMatchObject({ ok: true });
    expect(await c.bookOf()).toEqual([]);
    await c.archive();
  });
});
