// A "not sent yet" draft (re-test ruling 6, 2026-10-26; supabase/migrations/20261026130000_m4b_draft.sql). TEST
// project only; invented.
//   The GM doesn't see another's draft (the character, its gear, their log entries) and nor does another player; its
//   owner does, and can't skip to approved. Sending it makes it wait for the GM, who then sees it and its history;
//   with approval off it joins at once.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { createCharacter, sendCharacter } from '../../src/modules/characters/commands.ts';
import { addItem, removeItem, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
import { draftRollLabel, recordRoll } from '../../src/core/rolls.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
const sees = async (person: Person, id: string) => (must(await person.db.from('actors').select('id').eq('id', id))).length === 1;
const eventsAbout = async (person: Person, id: string) => must(await person.db.from('events').select('id').eq('target_id', id)).length;
const draftOf = async (name: string) => {
  const made = await as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name, level: 1, draft: true });
  if (!made.ok) throw new Error(made.message);
  return made.value;
};

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('a draft not sent yet', () => {
  it('only its owner sees it, its gear and its log entries', async () => {
    const draft = await draftOf('Moss');
    expect(draft.approval).toBe('draft');
    expect(await sees(world.playerA, draft.id)).toBe(true);
    expect(await sees(world.gm, draft.id)).toBe(false);
    expect(await sees(world.playerB, draft.id)).toBe(false);
    expect(await eventsAbout(world.playerA, draft.id)).toBeGreaterThan(0);
    expect(await eventsAbout(world.gm, draft.id)).toBe(0);

    const carrier: CarrierRef = { campaignId: world.campaignId, actorId: draft.id, locationId: null, ownerUserId: world.playerA.id, archived: false };
    const bought = await as(world.playerA, addItem, { carrier, item: { libraryEntryId: null, name: 'Reed lamp', category: 'gear', weightCoin: 5, slots: null, stack: 1 }, qty: 1, howGot: 'bought' as const, cost: '2 sp' });
    expect(bought).toMatchObject({ ok: true });
    expect(must(await world.playerA.db.from('inventory_lines').select('id').eq('actor_id', draft.id))).toHaveLength(1);
    expect(must(await world.gm.db.from('inventory_lines').select('id').eq('actor_id', draft.id))).toHaveLength(0);
    expect(must(await world.gm.db.from('events').select('id').eq('target_table', 'inventory_lines').eq('after->>actor_id', draft.id))).toHaveLength(0);

    // Before approval, the shopping can take a purchase back out (with its refund; ruled 2026-10-26).
    if (!bought.ok) throw new Error(bought.message);
    expect(await as(world.playerA, removeItem, { line: { id: bought.value.id, carrier }, qty: 1, of: 1 })).toMatchObject({ ok: true });
    expect(must(await world.playerA.db.from('inventory_lines').select('id').eq('actor_id', draft.id))).toHaveLength(0);
  });

  it("the draft's rolls stay visible to the GM, labelled with the draft (ruled 2026-10-26)", async () => {
    const draft = await draftOf('Reed');
    const rolled = await as(world.playerA, recordRoll, { campaignId: world.campaignId, expression: '1d8', result: 6, purpose: 'hp' as const, gmOnly: false, label: draftRollLabel('Reed') });
    if (!rolled.ok) throw new Error(rolled.message);
    expect(await sees(world.gm, draft.id)).toBe(false);
    expect(must(await world.gm.db.from('rolls').select('label, result').eq('id', rolled.value).single())).toEqual({ label: 'draft · Reed', result: 6 });
  });

  it("its owner can't approve it or turn a waiting character back into a draft", async () => {
    const draft = await draftOf('Sedge');
    const skip = await world.playerA.db.from('actors').update({ approval: 'approved' }).eq('id', draft.id).select('id');
    expect(skip.error).not.toBeNull();
    expect(await as(world.playerA, sendCharacter, { character: draft })).toMatchObject({ ok: true });
    const back = await world.playerA.db.from('actors').update({ approval: 'draft' }).eq('id', draft.id).select('id');
    expect(back.error).not.toBeNull();
  });

  it('sending it makes it wait for the GM, who then sees it and its history', async () => {
    const draft = await draftOf('Rush');
    expect(await as(world.playerB, sendCharacter, { character: draft })).toMatchObject({ ok: false });
    const sent = await as(world.playerA, sendCharacter, { character: draft });
    expect(sent).toMatchObject({ ok: true, value: { approval: 'pending' } });
    expect(await sees(world.gm, draft.id)).toBe(true);
    expect(await eventsAbout(world.gm, draft.id)).toBeGreaterThan(1);
    const logged = must(await world.gm.db.from('events').select('type').eq('target_id', draft.id).eq('type', 'character.send'));
    expect(logged).toHaveLength(1);
  });

  it('with approval off, sending it joins the party at once', async () => {
    const before = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId).single()).settings;
    const settings = { ...((before ?? {}) as Record<string, unknown>), characterApproval: false, startLevel: 'one' };
    must(await world.admin.from('campaigns').update({ settings }).eq('id', world.campaignId).select('id'));
    try {
      const draft = await draftOf('Fen');
      expect(draft.approval).toBe('draft');
      expect(await as(world.playerA, sendCharacter, { character: draft })).toMatchObject({ ok: true, value: { approval: 'approved' } });
    } finally {
      must(await world.admin.from('campaigns').update({ settings: before }).eq('id', world.campaignId).select('id'));
    }
  });
});
