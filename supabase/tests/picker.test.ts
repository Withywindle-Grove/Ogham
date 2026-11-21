// The campaign picker: your campaigns, and looking up an invite code before joining. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { peekInvite } from '../../src/core/invites.ts';
import { loadMyCampaigns } from '../../src/core/myCampaigns.ts';
import type { Db } from '../../src/core/supabase.ts';
import { visitorClient } from './testProject.ts';
import { buildWorld, must, tearDownWorld, type World } from './world.ts';

let world: World;
let gmName: string;
// Codes are made unique per run so parallel runs (CI and a local run) don't collide.
const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
const codes = { valid: `PV${suffix}`, expired: `PE${suffix}`, revoked: `PR${suffix}`, used: `PU${suffix}` };

beforeAll(async () => {
  world = await buildWorld();
  const { admin } = world;
  // Wren is Player A's active character and belongs to the company; Player B has no active character.
  must(await admin.from('actors').update({ company_id: world.companyId }).eq('id', world.wrenId).select());
  must(
    await admin
      .from('members')
      .update({ active_actor_id: world.wrenId })
      .eq('campaign_id', world.campaignId)
      .eq('user_id', world.playerA.id)
      .select(),
  );
  gmName = must(await admin.from('profiles').select('display_name').eq('id', world.gm.id).single()).display_name;

  const later = new Date(Date.now() + 86_400_000).toISOString();
  const earlier = new Date(Date.now() - 60_000).toISOString();
  must(
    await admin
      .from('invites')
      .insert(
        [
          { code: codes.valid, status: 'pending', expires_at: later },
          { code: codes.expired, status: 'pending', expires_at: earlier },
          { code: codes.revoked, status: 'revoked', expires_at: later },
          { code: codes.used, status: 'accepted', expires_at: later },
        ].map((invite) => ({ ...invite, campaign_id: world.otherCampaignId })),
      )
      .select('code'),
  );
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

const asDb = (person: { db: unknown }) => person.db as Db;

describe('your campaigns', () => {
  it('a GM sees each campaign they run, sorted by name, with how many players it has', async () => {
    const list = await loadMyCampaigns(asDb(world.gm), world.gm.id);
    expect(list).toEqual([
      expect.objectContaining({ name: 'The Ash Barrows', role: 'gm', playerCount: 0 }),
      expect.objectContaining({ name: 'The Reedmouth Delve', role: 'gm', playerCount: 2 }),
    ]);
  });

  it('a player sees their campaign with their active character and its company', async () => {
    const list = await loadMyCampaigns(asDb(world.playerA), world.playerA.id);
    expect(list).toEqual([
      expect.objectContaining({
        name: 'The Reedmouth Delve',
        role: 'player',
        characterName: 'Wren of the Lantern Wardens',
        companyName: 'The Sluice Gate Company',
      }),
    ]);
  });

  it('a player with no active character sees the campaign without one', async () => {
    const list = await loadMyCampaigns(asDb(world.playerB), world.playerB.id);
    expect(list).toEqual([expect.objectContaining({ name: 'The Reedmouth Delve', characterName: null, companyName: null })]);
  });

  it('a player whose only character is waiting sees it marked as waiting', async () => {
    must(
      await world.admin
        .from('members')
        .insert({ campaign_id: world.campaignId, user_id: world.newcomer.id, base_role: 'player' })
        .select(),
    );
    must(
      await world.admin
        .from('actors')
        .insert({
          campaign_id: world.campaignId,
          kind: 'pc',
          name: 'Hollis',
          owner_type: 'user',
          owner_user_id: world.newcomer.id,
          approval: 'pending',
        })
        .select(),
    );
    const list = await loadMyCampaigns(asDb(world.newcomer), world.newcomer.id);
    expect(list).toEqual([
      expect.objectContaining({ characterName: null, waiting: { name: 'Hollis', approval: 'pending' } }),
    ]);
  });

  it('someone in no campaign sees an empty list', async () => {
    expect(await loadMyCampaigns(asDb(world.outsider), world.outsider.id)).toEqual([]);
  });
});

describe('looking up an invite code', () => {
  it('a signed-in person with a valid code sees the campaign and its GM', async () => {
    const preview = await peekInvite(asDb(world.outsider), codes.valid);
    expect(preview).toEqual({
      campaignId: world.otherCampaignId,
      campaignName: 'The Ash Barrows',
      gmName,
      alreadyMember: false,
    });
  });

  it('a code typed in lowercase or with spaces still works', async () => {
    const preview = await peekInvite(asDb(world.outsider), ` ${codes.valid.slice(0, 4).toLowerCase()} ${codes.valid.slice(4)} `);
    expect(preview).toMatchObject({ campaignName: 'The Ash Barrows' });
  });

  it('expired, revoked, used and unknown codes all give the same "not valid" answer', async () => {
    for (const code of [codes.expired, codes.revoked, codes.used, 'NOSUCHCODE']) {
      expect(await peekInvite(asDb(world.outsider), code), code).toBeNull();
    }
  });

  it("looking up a code doesn't join the campaign or use up the code", async () => {
    await peekInvite(asDb(world.newcomer), codes.valid);
    const member = await world.admin
      .from('members')
      .select('id')
      .eq('campaign_id', world.otherCampaignId)
      .eq('user_id', world.newcomer.id);
    expect(member.data).toEqual([]);
    const invite = must(await world.admin.from('invites').select('status').eq('code', codes.valid).single());
    expect(invite.status).toBe('pending');
  });

  it('the preview says when you are already in that campaign', async () => {
    expect(await peekInvite(asDb(world.gm), codes.valid)).toMatchObject({ alreadyMember: true });
  });

  it("someone who isn't signed in can't look up codes", async () => {
    const attempt = await visitorClient(world.project).rpc('peek_invite', { invite_code: codes.valid });
    expect(attempt.error).not.toBeNull();
  });
});
