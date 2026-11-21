// New characters follow the campaign's settings (M4b, character creation step 2; ruled 2026-10-24 and 2026-10-25;
// docs/04, 05 "Joining"; supabase/migrations/20261025170000_m4b_new_characters.sql). TEST project only; invented.
//   "New characters need approval" (Yes by default): off, a player's character joins at once and becomes their
//   active one. "New characters start at": level 1, up to the party's lowest, or the GM's choice (any level; with
//   approval off, one above the party's lowest still waits for the GM). The database checks the level on creation
//   and while the character waits.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { createCharacter, editCharacter } from '../../src/modules/characters/commands.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
let original: unknown;
const settle = async (settings: Record<string, unknown>) =>
  must(await world.admin.from('campaigns').update({ settings: { ...(original as object), ...settings } }).eq('id', world.campaignId).select('id'));
const make = (person: Person, name: string, level: number) => as(person, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name, level });

beforeAll(async () => {
  world = await buildWorld();
  original = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId).single()).settings;
  // The party: Wren at level 3, Ash at level 5 (approved, active).
  await world.admin.from('actors').update({ level: 3 }).eq('id', world.wrenId);
  await world.admin.from('actors').update({ level: 5 }).eq('id', world.ashId);
}, 300_000);
beforeEach(async () => {
  await settle({});
});
afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('new characters', () => {
  it('by default a new character waits for the GM, at any level (GM’s choice), and a player can’t approve their own', async () => {
    const made = await make(world.playerA, 'Moss', 7);
    expect(made).toMatchObject({ ok: true, value: { approval: 'pending' } });
    const sneaky = await world.playerA.db
      .from('actors')
      .insert({ campaign_id: world.campaignId, kind: 'pc', name: 'Sneaky', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved' })
      .select('approval');
    expect(sneaky.data ?? [{ approval: 'pending' }]).toEqual([{ approval: 'pending' }]);
  });

  it('with approval off, a new character joins at once and becomes the active one of a player who has none', async () => {
    await settle({ characterApproval: false, startLevel: 'one' });
    // Player B has no active character for this test.
    await world.admin.from('members').update({ active_actor_id: null }).eq('campaign_id', world.campaignId).eq('user_id', world.playerB.id);
    const made = await make(world.playerB, 'Reed', 1);
    if (!made.ok) throw new Error(made.message);
    expect(made.value.approval).toBe('approved');
    const [member] = must(await world.admin.from('members').select('active_actor_id').eq('campaign_id', world.campaignId).eq('user_id', world.playerB.id));
    expect(member!.active_actor_id).toBe(made.value.id);
    await world.admin.from('members').update({ active_actor_id: world.ashId }).eq('campaign_id', world.campaignId).eq('user_id', world.playerB.id);
    // Out of the party again, so the party's lowest stays 3 for the next tests.
    await world.admin.from('actors').update({ status: 'archived' }).eq('id', made.value.id);
  });

  it('"Level 1" refuses a higher level; "Party\'s lowest" allows up to the lowest approved, active character (3)', async () => {
    await settle({ startLevel: 'one' });
    expect(await make(world.playerA, 'Fen', 2)).toMatchObject({ ok: false });
    expect(await make(world.playerA, 'Fen', 1)).toMatchObject({ ok: true });
    await settle({ startLevel: 'lowest' });
    expect(await make(world.playerA, 'Sedge', 4)).toMatchObject({ ok: false });
    const made = await make(world.playerA, 'Sedge', 3);
    if (!made.ok) throw new Error(made.message);
    // While it waits, the player can't raise it past the limit either.
    expect(await as(world.playerA, editCharacter, { character: made.value, changes: { level: 4 } })).toMatchObject({ ok: false });
    expect(await as(world.playerA, editCharacter, { character: made.value, changes: { level: 2 } })).toMatchObject({ ok: true });
  });

  it("under Player proposes (and the old GM's choice) with approval off, a level above the party's lowest still waits for the GM", async () => {
    for (const startLevel of ['propose', 'gm']) {
      await settle({ characterApproval: false, startLevel });
      expect(await make(world.playerA, `Rush ${startLevel}`, 3)).toMatchObject({ ok: true, value: { approval: 'approved' } });
      expect(await make(world.playerA, `Bulrush ${startLevel}`, 6)).toMatchObject({ ok: true, value: { approval: 'pending' } });
    }
  });

  // B21 (ruled 2026-10-25): the GM sets one level for every new character.
  it('"Fixed level" refuses a level above the one set (a class that stops earlier may start lower); with approval off it joins at once', async () => {
    await settle({ characterApproval: false, startLevel: 'fixed', startLevelFixed: 4 });
    expect(await make(world.playerA, 'Teasel', 5)).toMatchObject({ ok: false });
    expect(await make(world.playerA, 'Teasel', 4)).toMatchObject({ ok: true, value: { approval: 'approved' } });
    await settle({ startLevel: 'fixed' });
    expect(await make(world.playerA, 'Sorrel', 2)).toMatchObject({ ok: false });
  });

  it('guided creation keeps the class, race and how it was made; the player can change it only while it waits', async () => {
    const made = await as(world.playerA, createCharacter, {
      campaignId: world.campaignId,
      kind: 'pc' as const,
      name: 'Bittern',
      level: 2,
      classRef: 'lantern-warden',
      raceRef: 'marsh-folk',
      creation: { method: 'split', rolled: { STR: 12, DEX: 9 } },
    });
    if (!made.ok) throw new Error(made.message);
    expect(must(await world.admin.from('actors').select('classes, race_ref, creation').eq('id', made.value.id).single())).toEqual({
      classes: [{ classRef: 'lantern-warden', level: 2, xp: 0 }],
      race_ref: 'marsh-folk',
      creation: { method: 'split', rolled: { STR: 12, DEX: 9 } },
    });
    const change = () => world.playerA.db.from('actors').update({ creation: { method: 'split', rolled: { STR: 18 } } }).eq('id', made.value.id).select('id');
    const rolled = async () => (must(await world.admin.from('actors').select('creation').eq('id', made.value.id).single()).creation as { rolled: Record<string, number> }).rolled;
    expect((await change()).error).toBeNull();
    expect(await rolled()).toEqual({ STR: 18 });
    await world.admin.from('actors').update({ approval: 'approved', creation: { method: 'split', rolled: { STR: 12 } } }).eq('id', made.value.id);
    await change();
    expect(await rolled()).toEqual({ STR: 12 });
    await world.admin.from('actors').update({ status: 'archived' }).eq('id', made.value.id);
  });

  it('a character that joined at once can record its starting-gear spend once, and nothing else about how it was made', async () => {
    await settle({ characterApproval: false, startLevel: 'one' });
    const made = await as(world.playerA, createCharacter, {
      campaignId: world.campaignId,
      kind: 'pc' as const,
      name: 'Teal',
      level: 1,
      classRef: 'lantern-warden',
      creation: { method: 'split', rolled: { STR: 12 } },
    });
    if (!made.ok) throw new Error(made.message);
    expect(made.value.approval).toBe('approved');
    const creationOf = async () => must(await world.admin.from('actors').select('creation').eq('id', made.value.id).single()).creation;
    const spend = { method: 'split', rolled: { STR: 12 }, spentBase: 120, moneyCoin: { key: 'gp', valueInBase: 10 } };
    expect(await as(world.playerA, editCharacter, { character: made.value, changes: { creation: spend } })).toMatchObject({ ok: true });
    expect(await creationOf()).toEqual(spend);
    // Once recorded, it's the GM's; and the rolls can't change with it.
    await as(world.playerA, editCharacter, { character: made.value, changes: { creation: { ...spend, spentBase: 0 } } });
    expect(await creationOf()).toEqual(spend);
    await world.admin.from('actors').update({ status: 'archived' }).eq('id', made.value.id);
    await world.admin.from('members').update({ active_actor_id: world.wrenId }).eq('campaign_id', world.campaignId).eq('user_id', world.playerA.id);
  });

  it('the GM makes characters at any level, whatever the settings', async () => {
    await settle({ startLevel: 'one' });
    expect(await make(world.gm, 'The ferryman', 9)).toMatchObject({ ok: true, value: { approval: 'approved' } });
  });
});
