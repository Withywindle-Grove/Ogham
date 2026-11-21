// The M4b post-gate review fixes (supabase/migrations/20261028090000_m4b_review_fixes.sql). TEST project only;
// invented content.
//   Sending a draft checks the start-level limit; after approval the starting-gear spend is a whole number, 0 or
//   more, and its coin can't change; companies invite only approved player characters still in play; a deleted
//   draft's log entries stay hidden from the GM; an undo refusal doesn't name someone else's draft.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { foundCompany, inviteToCompany } from '../../src/core/campaignCommands.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { createCharacter, deleteCharacter, editCharacter, sendCharacter } from '../../src/modules/characters/commands.ts';
import { addItem, moveItem, type CarrierRef } from '../../src/modules/inventory/inventory.ts';
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
const draftOf = async (person: Person, name: string, level = 1) => {
  const made = await as(person, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name, level, draft: true });
  if (!made.ok) throw new Error(made.message);
  return made.value;
};
const character = async (fields: Record<string, unknown>) =>
  must(await world.admin.from('actors').insert({ campaign_id: world.campaignId, owner_type: 'user', owner_user_id: world.playerB.id, approval: 'approved', kind: 'pc', ...fields }).select('id').single())
    .id as string;

beforeAll(async () => {
  world = await buildWorld();
  original = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId).single()).settings;
}, 300_000);
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('M4b review fixes', () => {
  it('sending a draft above the start-level limit is refused, as making one is', async () => {
    await settle({ startLevel: 'fixed', startLevelFixed: 3 });
    try {
      const draft = await draftOf(world.playerA, 'Moss', 3);
      await settle({ startLevel: 'fixed', startLevelFixed: 1 });
      expect(await as(world.playerA, sendCharacter, { character: draft })).toMatchObject({ ok: false });
      expect(must(await world.admin.from('actors').select('approval').eq('id', draft.id).single()).approval).toBe('draft');
    } finally {
      await settle({});
    }
  });

  it('after approval the starting-gear spend is a whole number, 0 or more, and a recorded coin stays as it was', async () => {
    await settle({ characterApproval: false, startLevel: 'one' });
    try {
      const coin = { key: 'gp', valueInBase: 10 };
      const made = await as(world.playerA, createCharacter, {
        campaignId: world.campaignId,
        kind: 'pc' as const,
        name: 'Teal',
        level: 1,
        creation: { method: 'split', rolled: { STR: 12 } },
      });
      if (!made.ok) throw new Error(made.message);
      expect(made.value.approval).toBe('approved');
      // The coin the starting money is counted in, recorded when it was made.
      must(await world.admin.from('actors').update({ creation: { method: 'split', rolled: { STR: 12 }, moneyCoin: coin } }).eq('id', made.value.id).select('id'));
      const creationOf = async () => must(await world.admin.from('actors').select('creation').eq('id', made.value.id).single()).creation;
      const start = await creationOf();
      const tryCreation = (creation: Record<string, unknown>) => as(world.playerA, editCharacter, { character: made.value, changes: { creation } });
      await tryCreation({ ...start, spentBase: -50 });
      await tryCreation({ ...start, spentBase: 2.5 });
      await tryCreation({ ...start, spentBase: 120, moneyCoin: { key: 'pp', valueInBase: 1 } });
      expect(await creationOf()).toEqual(start);
      expect(await tryCreation({ ...start, spentBase: 120 })).toMatchObject({ ok: true });
      expect(await creationOf()).toEqual({ ...start, spentBase: 120 });
      await world.admin.from('actors').update({ status: 'archived' }).eq('id', made.value.id);
      await world.admin.from('members').update({ active_actor_id: world.wrenId }).eq('campaign_id', world.campaignId).eq('user_id', world.playerA.id);
    } finally {
      await settle({});
    }
  });

  it('a company invites, and founds with, only approved player characters still in play', async () => {
    const archived = await character({ name: 'Old Reed', status: 'archived' });
    const waiting = await character({ name: 'Waiting Reed', approval: 'pending' });
    const hireling = await character({ name: 'Linkboy', kind: 'hireling' });
    const free = await character({ name: 'Free Reed' });
    const invite = (characterId: string) => as(world.gm, inviteToCompany, { campaignId: world.campaignId, companyId: world.companyId, characterId, member: false });
    expect(await invite(archived)).toMatchObject({ ok: false });
    expect(await invite(waiting)).toMatchObject({ ok: false });
    expect(await invite(hireling)).toMatchObject({ ok: false });
    expect(await invite(free)).toMatchObject({ ok: true });

    const founder = await character({ name: 'Founder Reed', owner_user_id: world.playerA.id });
    const other = await character({ name: 'Linkgirl', kind: 'hireling' });
    const made = await as(world.playerA, foundCompany, { campaignId: world.campaignId, character: { id: founder, ownerUserId: world.playerA.id }, name: 'The Wick Keepers', cofounderIds: [other] });
    if (!made.ok) throw new Error(made.message);
    expect(must(await world.admin.from('company_invitations').select('id').eq('company_id', made.value))).toHaveLength(0);
  });

  it("the log entries of a draft deleted before it was sent stay hidden from the GM; its owner still sees them", async () => {
    const draft = await draftOf(world.playerA, 'Rush');
    const carrier: CarrierRef = { campaignId: world.campaignId, actorId: draft.id, locationId: null, ownerUserId: world.playerA.id, archived: false };
    const bought = await as(world.playerA, addItem, { carrier, item: { libraryEntryId: null, name: 'Rush light', category: 'gear', weightCoin: 1, slots: null, stack: 1 }, qty: 1, howGot: 'bought' as const, cost: '1 sp' });
    if (!bought.ok) throw new Error(bought.message);
    expect(await as(world.playerA, deleteCharacter, { character: draft })).toMatchObject({ ok: true });
    const about = async (person: Person, id: string) => must(await person.db.from('events').select('id').eq('target_id', id)).length;
    expect(await about(world.gm, draft.id)).toBe(0);
    expect(await about(world.gm, bought.value.id)).toBe(0);
    expect(await about(world.playerA, draft.id)).toBeGreaterThan(0);
    // A character deleted after it was sent (waiting) keeps its history visible to the GM.
    const sent = await draftOf(world.playerA, 'Sedge');
    expect(await as(world.playerA, sendCharacter, { character: sent })).toMatchObject({ ok: true });
    expect(await as(world.playerA, deleteCharacter, { character: { ...sent, approval: 'pending' } })).toMatchObject({ ok: true });
    expect(await about(world.gm, sent.id)).toBeGreaterThan(0);
  });

  it("an undo refusal says \"someone\" rather than naming someone else's draft", async () => {
    const wren: CarrierRef = { campaignId: world.campaignId, actorId: world.wrenId, locationId: null, ownerUserId: world.playerA.id, archived: false };
    const ash: CarrierRef = { campaignId: world.campaignId, actorId: world.ashId, locationId: null, ownerUserId: world.playerB.id, archived: false };
    const added = await as(world.gm, addItem, { carrier: wren, item: { libraryEntryId: null, name: 'Reed whistle', category: 'gear', weightCoin: 1, slots: 1, stack: 1 }, qty: 1, howGot: 'found' as const });
    if (!added.ok) throw new Error(added.message);
    expect(await as(world.playerA, moveItem, { line: { id: added.value.id, carrier: wren }, to: ash, qty: 1, of: 1 })).toMatchObject({ ok: true });
    const moved = must(await world.playerA.db.from('events').select('id').eq('type', 'inventory.move').eq('target_id', added.value.id))[0]!.id as string;
    // Player B puts it on their draft, which nobody else sees.
    const secret = await draftOf(world.playerB, 'Hidden Heron');
    must(await world.admin.from('inventory_lines').update({ actor_id: secret.id }).eq('id', added.value.id).select('id'));
    expect(await as(world.playerA, undoChange, { campaignId: world.campaignId, eventId: moved, authorUserId: world.playerA.id })).toMatchObject({
      ok: false,
      message: 'Ash the Reed Cutter gave them to someone.',
    });
  });
});
