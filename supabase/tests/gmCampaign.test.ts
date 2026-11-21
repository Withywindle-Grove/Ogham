// The GM's Campaign screen: waiting invites and the player list. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { createInvite, revokeInvite } from '../../src/core/campaignCommands.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { loadPlayers, loadWaitingInvites } from '../../src/core/gmCampaign.ts';
import type { Db } from '../../src/core/supabase.ts';
import { buildWorld, must, tearDownWorld, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: { db: unknown }) => person.db as Db;

beforeAll(async () => {
  world = await buildWorld();
  const { admin } = world;
  must(
    await admin
      .from('members')
      .update({ active_actor_id: world.wrenId })
      .eq('campaign_id', world.campaignId)
      .eq('user_id', world.playerA.id)
      .select(),
  );
  // Player A also has a character waiting for approval; Player B one that was sent back.
  must(
    await admin
      .from('actors')
      .insert([
        { campaign_id: world.campaignId, kind: 'pc', name: 'Old Tobin', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'pending' },
        { campaign_id: world.campaignId, kind: 'pc', name: 'Sly Cob', owner_type: 'user', owner_user_id: world.playerB.id, approval: 'rejected' },
      ])
      .select(),
  );
  const earlier = new Date(Date.now() - 60_000).toISOString();
  must(
    await admin
      .from('invites')
      .insert([
        { campaign_id: world.campaignId, email: 'Expired one', status: 'pending', expires_at: earlier },
        { campaign_id: world.campaignId, email: 'Used one', status: 'accepted', expires_at: new Date(Date.now() + 86_400_000).toISOString() },
      ])
      .select(),
  );
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

async function gmRuns<I, T, O>(command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  const db = asDb(world.gm);
  return runCommand(registry, db, await loadCurrentUser(db), command, input);
}

describe('waiting invites', () => {
  it('the GM sees a new invite with its note, and not expired or used ones', async () => {
    const made = await gmRuns(createInvite, { campaignId: world.campaignId, email: 'For Priya' });
    expect(made.ok).toBe(true);
    const invites = await loadWaitingInvites(asDb(world.gm), world.campaignId);
    expect(invites).toEqual([expect.objectContaining({ note: 'For Priya' })]);
    expect(invites?.[0]?.code).toMatch(/^[A-Z2-9]{8}$/);
  });

  it('a revoked invite is no longer waiting', async () => {
    const made = await gmRuns(createInvite, { campaignId: world.campaignId });
    if (!made.ok) throw new Error(made.message);
    await gmRuns(revokeInvite, { campaignId: world.campaignId, inviteId: made.value.id });
    const invites = await loadWaitingInvites(asDb(world.gm), world.campaignId);
    expect(invites?.map((invite) => invite.id)).not.toContain(made.value.id);
  });

  it("a player sees no invites, even for their own campaign", async () => {
    expect(await loadWaitingInvites(asDb(world.playerA), world.campaignId)).toEqual([]);
  });
});

describe('the player list', () => {
  it('the GM sees each player with their characters, active and waiting ones marked', async () => {
    const gmName = must(await world.admin.from('profiles').select('display_name').eq('id', world.gm.id).single()).display_name;
    const players = await loadPlayers(asDb(world.gm), world.campaignId);
    expect(players?.map((player) => player.name)).not.toContain(gmName);
    const a = players?.find((player) => player.userId === world.playerA.id);
    const b = players?.find((player) => player.userId === world.playerB.id);
    expect(a?.characters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: world.wrenId, name: 'Wren of the Lantern Wardens', approval: 'approved', active: true, level: 1 }),
        expect.objectContaining({ name: 'Old Tobin', approval: 'pending', active: false }),
      ]),
    );
    expect(b?.characters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Ash the Reed Cutter', approval: 'approved', active: false }),
        expect.objectContaining({ name: 'Sly Cob', approval: 'rejected' }),
      ]),
    );
  });
});
