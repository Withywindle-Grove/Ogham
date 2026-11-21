// G-208 batch A, row E2: expertise points (supabase/migrations/20261120100000_g208_expertise.sql). TEST project only;
// invented content (the skills SB and WL).
//   Purpose: before approval the owner raises and lowers a character's expertise points freely; after approval the
//   owner may raise them or give a skill its first point, but not lower or remove any (the database refuses), while
//   the GM may; another player can't change them; a malformed value (not a whole number of at least 1, not an object,
//   a long skill code, an array in place of a number) is refused by the database itself, not only by the app; the
//   owner's Undo of points they just added after approval goes through (ex-5).
//   Purpose (review of #1087, finding 2): once the character is approved, the owner's Undo of points spent while it
//   waited for approval is refused, since it would lower them after approval, which is the GM's (ex-2).
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

describe('expertise points on a character', () => {
  it('the owner sets them freely before approval, then only adds; the GM moves them; the shape is held', async () => {
    await settle({ characterApproval: true, startLevel: 'one' });
    const made = await as(world.playerA, createCharacter, { campaignId: world.campaignId, kind: 'pc' as const, name: 'Sedge', level: 1 });
    if (!made.ok) throw new Error(made.message);
    const character = made.value;
    const pointsOf = async () => must(await world.admin.from('actors').select('expertise').eq('id', character.id).single()).expertise;
    const set = (person: Person, expertise: Record<string, number>) => as(person, editCharacter, { character, changes: { expertise } });
    // Straight to the table, past the app's own check: the database alone must refuse.
    const direct = async (person: Person, expertise: unknown) => (await person.db.from('actors').update({ expertise } as never).eq('id', character.id).select('id')).error;

    // Waiting for approval: the owner raises, lowers and removes.
    expect(await pointsOf()).toEqual({});
    expect(await set(world.playerA, { SB: 2, WL: 1 })).toMatchObject({ ok: true });
    expect(await set(world.playerA, {})).toMatchObject({ ok: true });
    expect(await set(world.playerA, { SB: 1 })).toMatchObject({ ok: true });
    expect(await pointsOf()).toEqual({ SB: 1 });

    // Malformed: refused by the app, and by the database when the app is passed by.
    expect(await set(world.playerA, { SB: 0 })).toMatchObject({ ok: false });
    // An array passes a lax jsonpath check (review of #1087, finding 1): {SB:[5]} and {SB:[]} must be refused too.
    for (const bad of [{ SB: 0 }, { SB: 1.5 }, { SB: '2' }, { SB: -1 }, { SB: 100 }, { SB: null }, { SB: [5] }, { SB: [] }, [1], 'SB', { ['x'.repeat(41)]: 1 }]) {
      expect(await direct(world.playerA, bad)).not.toBeNull();
    }
    expect(await direct(world.gm, { SB: 'lots' })).not.toBeNull();
    expect(await pointsOf()).toEqual({ SB: 1 });

    // Approved: the owner may raise a skill and give another its first point, never lower or remove one.
    must(await world.admin.from('actors').update({ approval: 'approved' }).eq('id', character.id).select('id'));
    const newestEdit = async () =>
      must(
        await world.admin.from('events').select('id, actor_user_id').eq('campaign_id', world.campaignId).eq('type', 'character.edit').eq('target_id', character.id).order('seq', { ascending: false }).limit(1),
      )[0]!;
    // The owner's Undo of the point spent while waiting (SB 1, from none) would lower it after approval: refused.
    const waiting = await newestEdit();
    expect(waiting.actor_user_id).toBe(world.playerA.id);
    expect(await as(world.playerA, undoChange, { campaignId: world.campaignId, eventId: waiting.id, authorUserId: waiting.actor_user_id })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await pointsOf()).toEqual({ SB: 1 });
    // An array can't stand in for a skill's points to move them (review of #1087, finding 1).
    expect(await direct(world.playerA, { SB: [], WL: 3 })).not.toBeNull();
    expect(await set(world.playerA, { SB: 2 })).toMatchObject({ ok: true });
    expect(await set(world.playerA, { SB: 2, WL: 1 })).toMatchObject({ ok: true });
    expect(await set(world.playerA, { SB: 1, WL: 1 })).toMatchObject({ ok: false });
    expect(await set(world.playerA, { SB: 2 })).toMatchObject({ ok: false });
    expect(await set(world.playerA, { SB: 1, WL: 3 })).toMatchObject({ ok: false });
    expect(await direct(world.playerA, {})).not.toBeNull();
    expect(await pointsOf()).toEqual({ SB: 2, WL: 1 });

    // The owner's Undo of the point just added goes through (ex-5), and the point can be added again.
    const line = await newestEdit();
    expect(line.actor_user_id).toBe(world.playerA.id);
    expect(await as(world.playerA, undoChange, { campaignId: world.campaignId, eventId: line.id, authorUserId: line.actor_user_id })).toMatchObject({ ok: true });
    expect(await pointsOf()).toEqual({ SB: 2 });
    expect(await set(world.playerA, { SB: 2, WL: 1 })).toMatchObject({ ok: true });

    // Another player: not theirs.
    expect(await set(world.playerB, { SB: 3, WL: 1 })).toMatchObject({ ok: false });
    expect(await pointsOf()).toEqual({ SB: 2, WL: 1 });

    // The GM moves points: lowers one, removes one.
    expect(await set(world.gm, { WL: 2 })).toMatchObject({ ok: true });
    expect(await pointsOf()).toEqual({ WL: 2 });

    await world.admin.from('actors').update({ status: 'archived' }).eq('id', character.id);
    await world.admin.from('members').update({ active_actor_id: world.wrenId }).eq('campaign_id', world.campaignId).eq('user_id', world.playerA.id);
  });
});
