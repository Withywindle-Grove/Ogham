// Creating a campaign, checked against the TEST project.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { createCampaign } from '../../src/core/campaignCommands.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { visitorClient } from './testProject.ts';
import { buildWorld, must, tearDownWorld, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

async function create(db: Db, name: string) {
  return runCommand(registry, db, await loadCurrentUser(db), createCampaign, { name });
}

describe('creating a campaign', () => {
  it('anyone signed in can create a campaign and becomes its GM', async () => {
    const db = world.outsider.db as unknown as Db;
    const result = await create(db, '  The Lantern Road  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const campaign = must(await db.from('campaigns').select('*').eq('id', result.value).single());
    expect(campaign.name).toBe('The Lantern Road');
    expect(campaign.created_by).toBe(world.outsider.id);

    const members = must(await world.admin.from('members').select('*').eq('campaign_id', result.value));
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ user_id: world.outsider.id, base_role: 'gm' });

    const user = await loadCurrentUser(db);
    expect(user?.roles[result.value]).toBe('gm');
  });

  it("a campaign can't be created any other way", async () => {
    const direct = await world.playerA.db.from('campaigns').insert({ name: 'The Back Door' }).select();
    expect(direct.error).not.toBeNull();
    const made = await world.admin.from('campaigns').select('id').eq('name', 'The Back Door');
    expect(made.data).toEqual([]);
  });

  it('a campaign needs a name', async () => {
    const result = await create(world.playerA.db as unknown as Db, '   ');
    expect(result).toMatchObject({ ok: false, reason: 'failed' });
    if (!result.ok) expect(result.message).toBe('Give the campaign a name.');
  });

  it("a signed-out visitor can't create a campaign", async () => {
    const visitor = visitorClient(world.project);
    const attempt = await visitor.rpc('create_campaign', { campaign_name: 'The Nobody Game' });
    expect(attempt.error).not.toBeNull();
    const made = await world.admin.from('campaigns').select('id').eq('name', 'The Nobody Game');
    expect(made.data).toEqual([]);
  });
});
