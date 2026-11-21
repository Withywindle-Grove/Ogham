// Deleting setting rules from your library (docs/07-content-packs.md, Deleting): the pack and its entries go,
// it leaves every campaign using it, and each of those campaigns' logs records the removal by name.
// TEST project only; invented content.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { attachPack } from '../../src/modules/library/campaignPacks.ts';
import { deletePack, importPack, loadPackUses } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  for (const person of [world.gm, world.playerA]) await world.admin.from('packs').delete().eq('owner_user_id', person.id);
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

async function riverRules(owner: Person = world.gm): Promise<string> {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'River Rules', version: '0.2' },
      options: [{ id: 'lantern-oil', name: 'Lanterns need oil', default: 'on', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] }],
      items: [{ id: 'rope-50ft', name: 'Rope, 50 ft' }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(owner, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  return made.value;
}

const removals = async (campaignId: string) =>
  must(await world.admin.from('events').select('id, actor_user_id, before, audience').eq('campaign_id', campaignId).eq('type', 'library.delete'));

describe('deleting setting rules', () => {
  it('a pack used by two campaigns lists both, then goes everywhere at once, logged by name in each campaign', async () => {
    const packId = await riverRules();
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
    await as(world.gm, attachPack, { campaignId: world.otherCampaignId, packId });
    expect((await loadPackUses(asDb(world.gm), packId))?.map((use) => use.campaignName).sort()).toEqual(['The Ash Barrows', 'The Reedmouth Delve']);
    const before = { first: (await removals(world.campaignId)).length, other: (await removals(world.otherCampaignId)).length };

    expect(await as(world.gm, deletePack, { packId, ownerUserId: world.gm.id })).toMatchObject({ ok: true });

    expect(must(await world.admin.from('packs').select('id').eq('id', packId))).toEqual([]);
    expect(must(await world.admin.from('library_entries').select('id').eq('pack_id', packId))).toEqual([]);
    expect(must(await world.admin.from('campaign_packs').select('id').eq('pack_id', packId))).toEqual([]);
    for (const [campaignId, count] of [[world.campaignId, before.first], [world.otherCampaignId, before.other]] as const) {
      const logged = await removals(campaignId);
      expect(logged).toHaveLength(count + 1);
      expect(logged.at(-1)).toMatchObject({ actor_user_id: world.gm.id, audience: 'all', before: { pack_id: packId, pack_name: 'River Rules' } });
    }
    // Players see it in their campaign's log.
    const seen = must(await world.playerA.db.from('events').select('id').eq('campaign_id', world.campaignId).eq('type', 'library.delete'));
    expect(seen.length).toBeGreaterThan(0);
  });

  it("a pack no campaign uses is deleted with nothing in any campaign's log", async () => {
    const packId = await riverRules();
    expect(await loadPackUses(asDb(world.gm), packId)).toEqual([]);
    const before = (await removals(world.campaignId)).length;
    expect(await as(world.gm, deletePack, { packId, ownerUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(must(await world.admin.from('packs').select('id').eq('id', packId))).toEqual([]);
    expect(await removals(world.campaignId)).toHaveLength(before);
  });

  it("nobody else can delete your setting rules, even skipping the app's own check", async () => {
    const packId = await riverRules();
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
    const player = (await loadCurrentUser(asDb(world.playerA)))!;
    expect(await deletePack.run(asDb(world.playerA), player, { packId, ownerUserId: world.gm.id })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(must(await world.admin.from('packs').select('id').eq('id', packId))).toHaveLength(1);
  });

  it("each campaign link keeps the pack's name: set from the pack when attached, never from the request, and it can't be changed", async () => {
    const packId = await riverRules();
    const link = must(await world.gm.db.from('campaign_packs').insert({ campaign_id: world.campaignId, pack_id: packId, pack_name: 'Something else' }).select('id, pack_name').single());
    expect(link.pack_name).toBe('River Rules');
    must(await world.gm.db.from('campaign_packs').update({ pack_name: 'Renamed' }).eq('id', link.id).select('id'));
    expect(must(await world.admin.from('campaign_packs').select('pack_name').eq('id', link.id).single()).pack_name).toBe('River Rules');
  });

  it('undoing the removal is refused in plain words', async () => {
    const packId = await riverRules();
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId });
    await as(world.gm, deletePack, { packId, ownerUserId: world.gm.id });
    const removal = (await removals(world.campaignId)).at(-1)!;
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: removal.id, authorUserId: world.gm.id })).toEqual({
      ok: false,
      reason: 'failed',
      message: "Making or deleting things can't be undone.",
      requestId: expect.any(String),
    });
  });
});
