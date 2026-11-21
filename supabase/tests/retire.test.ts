// Retiring a campaign (docs/05-features.md, Campaigns): the GM retires it and can bring it back; while retired
// everyone can still read it, nothing in it can change and nobody can join. The database refuses the changes,
// whatever the app shows. TEST project only; invented content.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { createInvite, redeemInvite, restoreCampaign, retireCampaign } from '../../src/core/campaignCommands.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { deletePack, importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const RETIRED = 'This campaign is retired, so nothing in it can change.';

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id);
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

const campaign = async () =>
  must(await world.admin.from('campaigns').select('name, retired_at').eq('id', world.campaignId).single());
const eventsOfType = async (type: string) =>
  must(await world.admin.from('events').select('id, actor_user_id').eq('campaign_id', world.campaignId).eq('type', type));

describe('retiring a campaign', () => {
  let inviteCode = '';
  let packId = '';

  beforeAll(async () => {
    // Made before retiring: an invite nobody has used yet, and setting rules the campaign uses.
    const invite = await as(world.gm, createInvite, { campaignId: world.campaignId });
    if (!invite.ok) throw new Error(invite.message);
    inviteCode = invite.value.code;
    const read = readPackJson(
      JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Fen Rules', version: '0.1' }, items: [{ id: 'reed-mat', name: 'Reed mat' }] }),
    );
    if (!read.ok) throw new Error(read.message);
    const made = await as(world.gm, importPack, { pack: read.pack });
    if (!made.ok) throw new Error(made.message);
    packId = made.value;
    const attached = await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
    if (!attached.ok) throw new Error(attached.message);
  });

  it('a player can’t retire it, even going straight to the database', async () => {
    await world.playerA.db.from('campaigns').update({ retired_at: new Date().toISOString() }).eq('id', world.campaignId);
    expect((await campaign()).retired_at).toBeNull();
  });

  it('the GM retires it; the database stamps the time, and the log says who', async () => {
    expect(await as(world.gm, retireCampaign, { campaignId: world.campaignId })).toMatchObject({ ok: true });
    const retiredAt = (await campaign()).retired_at;
    expect(retiredAt).not.toBeNull();
    expect(Math.abs(Date.parse(retiredAt!) - Date.now())).toBeLessThan(5 * 60_000);
    expect(await eventsOfType('campaign.retire')).toEqual([expect.objectContaining({ actor_user_id: world.gm.id })]);
  });

  it('everyone can still read it', async () => {
    expect(must(await world.playerA.db.from('actors').select('id').eq('campaign_id', world.campaignId)).length).toBeGreaterThan(0);
    expect(must(await world.playerA.db.from('campaigns').select('id').eq('id', world.campaignId))).toHaveLength(1);
  });

  it('nothing in it can change, for the GM or a player, with a plain message', async () => {
    const before = must(await world.admin.from('actors').select('hp_current').eq('id', world.wrenId).single());
    const attempts = [
      await world.gm.db.from('campaigns').update({ name: 'The Quiet Delve' }).eq('id', world.campaignId).select('id'),
      await world.playerA.db.from('actors').update({ hp_current: 1 }).eq('id', world.wrenId).select('id'),
      await world.gm.db.from('companies').insert({ campaign_id: world.campaignId, name: 'The Late Company' }).select('id'),
      await world.playerA.db.from('notes').insert({ campaign_id: world.campaignId, text: 'Too late' }).select('id'),
    ];
    for (const attempt of attempts) expect(attempt.error?.message).toBe(RETIRED);
    expect((await campaign()).name).toBe('The Reedmouth Delve');
    expect(must(await world.admin.from('actors').select('hp_current').eq('id', world.wrenId).single())).toEqual(before);
  });

  it('the GM can’t bring it back and change something else in one go', async () => {
    const sneaky = await world.gm.db.from('campaigns').update({ retired_at: null, name: 'The Sneaky Delve' }).eq('id', world.campaignId).select('id');
    expect(sneaky.error?.message).toBe(RETIRED);
    expect(await campaign()).toMatchObject({ name: 'The Reedmouth Delve', retired_at: expect.any(String) });
  });

  it('nobody can join with an invite made before', async () => {
    const joined = await as(world.newcomer, redeemInvite, { code: inviteCode });
    expect(joined.ok).toBe(false);
    expect(must(await world.admin.from('members').select('id').eq('campaign_id', world.campaignId).eq('user_id', world.newcomer.id))).toEqual([]);
  });

  it('the GM can still delete setting rules it uses from their library; its log records it', async () => {
    expect(await as(world.gm, deletePack, { packId, ownerUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('campaign_packs').select('id').eq('pack_id', packId))).toEqual([]);
    expect(await eventsOfType('library.delete')).toHaveLength(1);
  });

  it('a player can’t bring it back; the GM can, and then it changes again as usual', async () => {
    expect(await as(world.playerA, restoreCampaign, { campaignId: world.campaignId })).toMatchObject({ ok: false });
    await world.playerA.db.from('campaigns').update({ retired_at: null }).eq('id', world.campaignId);
    expect((await campaign()).retired_at).not.toBeNull();

    expect(await as(world.gm, restoreCampaign, { campaignId: world.campaignId })).toMatchObject({ ok: true });
    expect((await campaign()).retired_at).toBeNull();
    expect(await eventsOfType('campaign.restore')).toEqual([expect.objectContaining({ actor_user_id: world.gm.id })]);
    expect((await world.playerA.db.from('actors').update({ hp_current: 6 }).eq('id', world.wrenId).select('id')).error).toBeNull();
  });
});
