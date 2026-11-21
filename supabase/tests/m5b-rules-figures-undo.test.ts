// fix-rules-figures-undo-after-approval: the guard on the rules set's own figures (private.guard_rules_figures,
// 20261108210000_m5b_sheet_changes_guard.sql: Max HP and the pack's scores) let every Undo through
// (grimoire.reverting), and no older guard on those columns stands behind it. So an owner who set Max HP while the
// character waited could clear it by Undo once the GM had approved the character, though a player may no longer write
// Max HP onto an approved character (that migration's header, point 2). TEST project only (CI: a local Supabase);
// invented content.
//   Purpose:
//   1. Once the GM approves a character, the owner's Undo of a Max HP set while it waited is refused (only the GM
//      changes an approved character's Max HP), and Max HP stays as approved.
//   2. The GM's Undo of that same change goes through (the GM always may).
//   3. While the character still waits, the owner's Undo of their own Max HP goes through.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { createCharacter, editCharacter } from '../../src/modules/characters/commands.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let original: unknown;
const made: string[] = [];
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), (await loadCurrentUser(asDb(person))) as CurrentUser, command, input);
}
const settle = async (settings: Record<string, unknown>) =>
  must(await world.admin.from('campaigns').update({ settings: { ...(original as object), ...settings } }).eq('id', world.campaignId).select('id'));

/** A new character of player A's, waiting for approval, whose owner set its Max HP while it waited. */
async function waitingWithMaxHp(name: string) {
  const created = await as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name, level: 1 });
  if (!created.ok) throw new Error(created.message);
  const character = created.value;
  made.push(character.id);
  expect(character.approval).toBe('pending');
  expect(await as(world.playerA, editCharacter, { character, changes: { hpMax: 9 } })).toMatchObject({ ok: true });
  const line = must(
    await world.admin
      .from('events')
      .select('id, actor_user_id')
      .eq('campaign_id', world.campaignId)
      .eq('type', 'character.edit')
      .eq('target_id', character.id)
      .order('seq', { ascending: false })
      .limit(1),
  )[0]!;
  expect(line.actor_user_id).toBe(world.playerA.id);
  const maxHp = async () => must(await world.admin.from('actors').select('hp_max').eq('id', character.id).single()).hp_max;
  const approve = async () => must(await world.admin.from('actors').update({ approval: 'approved' }).eq('id', character.id).select('id'));
  const undoBy = (person: Person) => as(person, undoChange, { campaignId: world.campaignId, eventId: line.id as string, authorUserId: line.actor_user_id as string });
  expect(await maxHp()).toBe(9);
  return { maxHp, approve, undoBy };
}

beforeAll(async () => {
  world = await buildWorld();
  original = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId).single()).settings;
  await settle({ characterApproval: true, startLevel: 'one' });
}, 300_000);
afterAll(async () => {
  for (const id of made) await world.admin.from('actors').update({ status: 'archived' }).eq('id', id);
  await world.admin.from('members').update({ active_actor_id: world.wrenId }).eq('campaign_id', world.campaignId).eq('user_id', world.playerA.id);
  await settle({});
  await tearDownWorld(world);
}, 60_000);

describe('the Undo of a Max HP change after approval', () => {
  it("1. the owner's Undo of a Max HP set while the character waited is refused once it is approved", async () => {
    const c = await waitingWithMaxHp('Wren of the Reeds');
    await c.approve();
    expect(await c.undoBy(world.playerA)).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await c.maxHp()).toBe(9);
  });

  it("2. the GM's Undo of the owner's Max HP from before the approval goes through", async () => {
    const c = await waitingWithMaxHp('Bree Damplight');
    await c.approve();
    expect(await c.undoBy(world.gm)).toMatchObject({ ok: true });
    expect(await c.maxHp()).toBeNull();
  });

  it("3. while the character still waits, the owner's Undo of their own Max HP goes through", async () => {
    const c = await waitingWithMaxHp('Odo Lanternwick');
    expect(await c.undoBy(world.playerA)).toMatchObject({ ok: true });
    expect(await c.maxHp()).toBeNull();
  });
});
