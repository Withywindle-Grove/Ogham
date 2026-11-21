// Profiles and the one-time "What should we call you?" step, checked against the TEST project.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { renameProfile } from '../../src/core/campaignCommands.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { loadMyProfile } from '../../src/core/profile.ts';
import type { Db } from '../../src/core/supabase.ts';
import { buildWorld, must, tearDownWorld, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe('choosing your name', () => {
  it("a new person's profile starts with the name from their email, not yet chosen", async () => {
    const profile = await loadMyProfile(world.newcomer.db as unknown as Db, world.newcomer.id);
    expect(profile?.displayName).toBe(world.newcomer.email.split('@')[0]);
    expect(profile?.named).toBe(false);
  });

  it('saving a name marks it as chosen, even when keeping the suggested one', async () => {
    const db = world.latecomer.db as unknown as Db;
    const before = await loadMyProfile(db, world.latecomer.id);
    const result = await runCommand(registry, db, await loadCurrentUser(db), renameProfile, {
      userId: world.latecomer.id,
      displayName: before?.displayName ?? '',
    });
    expect(result.ok).toBe(true);
    expect((await loadMyProfile(db, world.latecomer.id))?.named).toBe(true);
  });

  it("a person can't mark their name as un-chosen again", async () => {
    const db = world.latecomer.db as unknown as Db;
    await world.latecomer.db.from('profiles').update({ named_at: null }).eq('id', world.latecomer.id);
    expect((await loadMyProfile(db, world.latecomer.id))?.named).toBe(true);
  });

  it('a name must not be blank', async () => {
    const db = world.playerA.db as unknown as Db;
    const result = await runCommand(registry, db, await loadCurrentUser(db), renameProfile, {
      userId: world.playerA.id,
      displayName: '   ',
    });
    expect(result.ok).toBe(false);
    const row = must(await world.admin.from('profiles').select('display_name').eq('id', world.playerA.id).single());
    expect(row.display_name.trim()).not.toBe('');
  });
});
