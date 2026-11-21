// The campaign's name and sigil: the GM renames the campaign and sets or removes its sigil. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { clearSigil, setSigil, updateCampaign } from '../../src/core/campaignCommands.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { fileLinks, forgetFileLinks } from '../../src/core/files.ts';
import { loadMyCampaigns } from '../../src/core/myCampaigns.ts';
import type { Db } from '../../src/core/supabase.ts';
import { BUCKET, buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const picture = () => new Blob(['an invented sigil'], { type: 'image/jpeg' });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

const sigilOf = async (campaignId = world.campaignId) =>
  must(await world.admin.from('campaigns').select('sigil_asset_id').eq('id', campaignId).single()).sigil_asset_id;
const fileExists = async (campaignId: string, assetId: string) =>
  ((await world.admin.storage.from(BUCKET).list(campaignId, { search: assetId })).data ?? []).some((f) => f.name === assetId);
const assetExists = async (assetId: string) =>
  (must(await world.admin.from('assets').select('id').eq('id', assetId)) ?? []).length === 1;

describe('the campaign sigil', () => {
  it("the GM sets a sigil; every member can see it, outsiders can't", async () => {
    const result = await as(world.gm, setSigil, { campaignId: world.campaignId, image: picture() });
    if (!result.ok) throw new Error(result.message);
    expect(await sigilOf()).toBe(result.value);
    expect(await fileExists(world.campaignId, result.value)).toBe(true);

    const path = `${world.campaignId}/${result.value}`;
    for (const person of [world.gm, world.playerA, world.playerB]) {
      forgetFileLinks();
      expect((await fileLinks(asDb(person), [path])).has(path)).toBe(true);
    }
    forgetFileLinks();
    expect((await fileLinks(asDb(world.outsider), [path])).has(path)).toBe(false);
  });

  it('the campaign picker hands back the sigil for every member', async () => {
    const sigil = await sigilOf();
    expect(sigil).not.toBeNull();
    for (const person of [world.gm, world.playerA]) {
      const campaigns = (await loadMyCampaigns(asDb(person), person.id)) ?? [];
      expect(campaigns.find((c) => c.id === world.campaignId)?.sigilAssetId).toBe(sigil);
    }
  });

  it('changing the sigil links the new picture and removes the old one', async () => {
    const first = await as(world.gm, setSigil, { campaignId: world.campaignId, image: picture() });
    const second = await as(world.gm, setSigil, { campaignId: world.campaignId, image: picture() });
    if (!first.ok || !second.ok) throw new Error('A sigil upload failed.');
    expect(await sigilOf()).toBe(second.value);
    expect(await assetExists(first.value)).toBe(false);
    expect(await fileExists(world.campaignId, first.value)).toBe(false);
  });

  it('removing the sigil unlinks it and deletes the picture', async () => {
    const set = await as(world.gm, setSigil, { campaignId: world.campaignId, image: picture() });
    if (!set.ok) throw new Error(set.message);
    expect(await as(world.gm, clearSigil, { campaignId: world.campaignId })).toMatchObject({ ok: true });
    expect(await sigilOf()).toBeNull();
    expect(await assetExists(set.value)).toBe(false);
    expect(await fileExists(world.campaignId, set.value)).toBe(false);
  });

  it("a player can't set or remove the sigil, even skipping the app's own check", async () => {
    const set = await as(world.gm, setSigil, { campaignId: world.campaignId, image: picture() });
    if (!set.ok) throw new Error(set.message);
    const player = (await loadCurrentUser(asDb(world.playerA)))!;
    expect(await setSigil.run(asDb(world.playerA), player, { campaignId: world.campaignId, image: picture() })).toMatchObject({
      ok: false,
      reason: 'not-allowed',
    });
    expect(await clearSigil.run(asDb(world.playerA), player, { campaignId: world.campaignId })).toMatchObject({
      ok: false,
      reason: 'not-allowed',
    });
    expect(await sigilOf()).toBe(set.value);
    expect(await fileExists(world.campaignId, set.value)).toBe(true);
  });

  it('not even the GM can use a picture from another campaign, or a portrait, as the sigil', async () => {
    const elsewhere = must(
      await world.gm.db
        .from('assets')
        .insert({ campaign_id: world.otherCampaignId, kind: 'sigil', name: 'Elsewhere', visibility: 'all' })
        .select()
        .single(),
    );
    const portrait = must(
      await world.gm.db
        .from('assets')
        .insert({ campaign_id: world.campaignId, kind: 'portrait', name: 'A face', visibility: 'all' })
        .select()
        .single(),
    );
    for (const asset of [elsewhere, portrait]) {
      const linked = await world.gm.db.from('campaigns').update({ sigil_asset_id: asset.id }).eq('id', world.campaignId).select('id');
      expect(linked.error?.code).toBe('42501');
    }
  });
});

describe('renaming the campaign', () => {
  it('the GM renames the campaign, and members see the new name', async () => {
    expect(await as(world.gm, updateCampaign, { campaignId: world.campaignId, name: '  The Reedmouth Delve ' })).toMatchObject({ ok: true });
    const campaigns = (await loadMyCampaigns(asDb(world.playerA), world.playerA.id)) ?? [];
    expect(campaigns.find((c) => c.id === world.campaignId)?.name).toBe('The Reedmouth Delve');
  });

  it('a blank name is refused with a plain message, and the name stays', async () => {
    const before = must(await world.admin.from('campaigns').select('name').eq('id', world.campaignId).single()).name;
    expect(await as(world.gm, updateCampaign, { campaignId: world.campaignId, name: '   ' })).toMatchObject({
      ok: false,
      message: 'Give the campaign a name.',
    });
    expect(must(await world.admin.from('campaigns').select('name').eq('id', world.campaignId).single()).name).toBe(before);
  });
});
