// M5b step 0, the To finish list (supabase/migrations/20261101150000_m5b_creation_to_finish.sql and its fix, 20261101151000). TEST project only;
// invented content.
//   Purpose: after approval the owner may change the To finish list on the creation record, and nothing else on it;
//   the list stays a short list of short step names; the GM may still change anything.
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

describe('the To finish list after approval', () => {
  it('lets the owner change only the To finish list, as a short list of step names; the GM changes anything', async () => {
    await settle({ characterApproval: false, startLevel: 'one' });
    const made = await as(world.playerA, createCharacter, {
      campaignId: world.campaignId,
      kind: 'pc' as const,
      name: 'Sedge',
      level: 1,
      creation: { method: 'split', rolled: { STR: 12 } },
    });
    if (!made.ok) throw new Error(made.message);
    expect(made.value.approval).toBe('approved');
    const creationOf = async () => must(await world.admin.from('actors').select('creation').eq('id', made.value.id).single()).creation as Record<string, unknown>;
    const start = await creationOf();
    const tryCreation = (person: Person, creation: Record<string, unknown>) => as(person, editCharacter, { character: made.value, changes: { creation } });

    // Decide later, then finished: the owner adds and removes the list.
    expect(await tryCreation(world.playerA, { ...start, toFinish: ['languages'] })).toMatchObject({ ok: true });
    expect(await creationOf()).toEqual({ ...start, toFinish: ['languages'] });
    expect(await tryCreation(world.playerA, start)).toMatchObject({ ok: true });
    expect(await creationOf()).toEqual(start);

    // Anything else on the record, alongside the list or not, stays the GM's.
    expect(await tryCreation(world.playerA, { ...start, rolled: { STR: 18 }, toFinish: ['languages'] })).toMatchObject({ ok: false });
    // Not a list of short names.
    expect(await tryCreation(world.playerA, { ...start, toFinish: 'languages' })).toMatchObject({ ok: false });
    expect(await tryCreation(world.playerA, { ...start, toFinish: [7] })).toMatchObject({ ok: false });
    expect(await tryCreation(world.playerA, { ...start, toFinish: ['x'.repeat(41)] })).toMatchObject({ ok: false });
    expect(await tryCreation(world.playerA, { ...start, toFinish: Array.from({ length: 13 }, (_, n) => `step-${n}`) })).toMatchObject({ ok: false });
    expect(await creationOf()).toEqual(start);

    // Someone else's character: not theirs to change.
    expect(await tryCreation(world.playerB, { ...start, toFinish: ['languages'] })).toMatchObject({ ok: false });

    // The GM may change the record as before.
    expect(await tryCreation(world.gm, { ...start, rolled: { STR: 13 }, toFinish: ['languages'] })).toMatchObject({ ok: true });
    expect(await creationOf()).toEqual({ ...start, rolled: { STR: 13 }, toFinish: ['languages'] });

    await world.admin.from('actors').update({ status: 'archived' }).eq('id', made.value.id);
    await world.admin.from('members').update({ active_actor_id: world.wrenId }).eq('campaign_id', world.campaignId).eq('user_id', world.playerA.id);
  });
});
