// M5b step 0b part A, weapon skills (supabase/migrations/20261101160000_m5b_weapon_skills.sql). TEST project only;
// invented content.
//   Purpose: before approval the owner sets weapon skills freely; after approval the owner can add a pick but not
//   remove, swap or specialise one, while the GM can; the list stays well formed (objects naming a weapon, once);
//   another player can't touch them.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { createCharacter, editCharacter } from '../../src/modules/characters/commands.ts';
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

beforeAll(async () => {
  world = await buildWorld();
  original = must(await world.admin.from('campaigns').select('settings').eq('id', world.campaignId).single()).settings;
}, 300_000);
afterAll(async () => {
  await settle({});
  await tearDownWorld(world);
});

describe('weapon skills on a character', () => {
  it('the owner sets them freely before approval, then only adds; the GM changes anything; the list stays well formed', async () => {
    await settle({ characterApproval: true, startLevel: 'one' });
    const made = await as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name: 'Rush', level: 1 });
    if (!made.ok) throw new Error(made.message);
    const character = made.value;
    const skillsOf = async () => must(await world.admin.from('actors').select('weapon_skills').eq('id', character.id).single()).weapon_skills;
    const set = (person: Person, weaponSkills: { itemId: string; specialised?: true }[]) => as(person, editCharacter, { character, changes: { weaponSkills } });

    // Waiting for approval: the owner picks, unpicks and specialises.
    expect(await skillsOf()).toEqual([]);
    expect(await set(world.playerA, [{ itemId: 'reed-spear' }, { itemId: 'eel-knife', specialised: true }])).toMatchObject({ ok: true });
    expect(await set(world.playerA, [{ itemId: 'reed-spear' }])).toMatchObject({ ok: true });
    expect(await skillsOf()).toEqual([{ itemId: 'reed-spear' }]);

    // Well formed: each weapon once, objects with a short id, specialised only as true.
    expect(await set(world.playerA, [{ itemId: 'reed-spear' }, { itemId: 'reed-spear' }])).toMatchObject({ ok: false });
    expect(await set(world.playerA, [{ itemId: '' }])).toMatchObject({ ok: false });
    expect(await set(world.playerA, [{ itemId: 'x'.repeat(81) }])).toMatchObject({ ok: false });
    expect(await as(world.playerA, editCharacter, { character, changes: { weaponSkills: [{ itemId: 'reed-spear', specialised: false }] as never } })).toMatchObject({ ok: false });
    expect(await as(world.playerA, editCharacter, { character, changes: { weaponSkills: ['reed-spear'] as never } })).toMatchObject({ ok: false });
    expect(await skillsOf()).toEqual([{ itemId: 'reed-spear' }]);

    // Approved: the owner may only add unspecialised picks.
    must(await world.admin.from('actors').update({ approval: 'approved' }).eq('id', character.id).select('id'));
    expect(await set(world.playerA, [{ itemId: 'reed-spear' }, { itemId: 'eel-knife' }])).toMatchObject({ ok: true });
    expect(await set(world.playerA, [{ itemId: 'eel-knife' }])).toMatchObject({ ok: false });
    expect(await set(world.playerA, [{ itemId: 'reed-spear', specialised: true }, { itemId: 'eel-knife' }])).toMatchObject({ ok: false });
    expect(await set(world.playerA, [{ itemId: 'reed-spear' }, { itemId: 'eel-knife' }, { itemId: 'bog-sling', specialised: true }])).toMatchObject({ ok: false });
    expect(await set(world.playerA, [{ itemId: 'reed-spear' }, { itemId: 'bog-sling' }])).toMatchObject({ ok: false });
    expect(await skillsOf()).toEqual([{ itemId: 'reed-spear' }, { itemId: 'eel-knife' }]);

    // Another player: not theirs.
    expect(await set(world.playerB, [{ itemId: 'reed-spear' }, { itemId: 'eel-knife' }, { itemId: 'bog-sling' }])).toMatchObject({ ok: false });

    // The GM removes, swaps and specialises.
    expect(await set(world.gm, [{ itemId: 'bog-sling', specialised: true }])).toMatchObject({ ok: true });
    expect(await skillsOf()).toEqual([{ itemId: 'bog-sling', specialised: true }]);

    await world.admin.from('actors').update({ status: 'archived' }).eq('id', character.id);
    await world.admin.from('members').update({ active_actor_id: world.wrenId }).eq('campaign_id', world.campaignId).eq('user_id', world.playerA.id);
  });
});
