// Character portraits: uploading, linking, who may see or change them, and cleaning up. TEST project only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { fileLinks, forgetFileLinks } from '../../src/core/files.ts';
import type { Db } from '../../src/core/supabase.ts';
import { archiveCharacter, deleteCharacter, toCharacterRef, type CharacterRef } from '../../src/modules/characters/commands.ts';
import { clearPortrait, setPortrait } from '../../src/modules/characters/portraits.ts';
import { BUCKET, buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const picture = () => new Blob(['an invented picture'], { type: 'image/jpeg' });

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await loadCurrentUser(asDb(person)), command, input);
}

async function fresh(approval: 'pending' | 'approved', owner = world.playerA): Promise<CharacterRef> {
  return toCharacterRef(
    must(
      await world.admin
        .from('actors')
        .insert({
          campaign_id: world.campaignId,
          kind: 'pc',
          name: 'Hollis',
          owner_type: 'user',
          owner_user_id: owner.id,
          approval,
        })
        .select()
        .single(),
    ),
  );
}

const portraitOf = async (id: string) =>
  must(await world.admin.from('actors').select('portrait_asset_id').eq('id', id).single()).portrait_asset_id;
const fileExists = async (campaignId: string, assetId: string) =>
  ((await world.admin.storage.from(BUCKET).list(campaignId, { search: assetId })).data ?? []).some((f) => f.name === assetId);

async function portraitAsset(person: Person, campaignId = world.campaignId) {
  return must(
    await person.db.from('assets').insert({ campaign_id: campaignId, kind: 'portrait', name: 'A face', visibility: 'all' }).select().single(),
  );
}

describe('setting a portrait', () => {
  it("the owner sets their character's portrait; members can see it, outsiders cannot", async () => {
    const character = await fresh('approved');
    const result = await as(world.playerA, setPortrait, { character, image: picture() });
    if (!result.ok) throw new Error(result.message);
    expect(await portraitOf(character.id)).toBe(result.value);
    expect(await fileExists(world.campaignId, result.value)).toBe(true);

    const path = `${world.campaignId}/${result.value}`;
    for (const person of [world.gm, world.playerB]) {
      forgetFileLinks();
      expect((await fileLinks(asDb(person), [path])).has(path)).toBe(true);
    }
    forgetFileLinks();
    expect((await fileLinks(asDb(world.outsider), [path])).has(path)).toBe(false);
  });

  it('changing the picture replaces the file in the same place', async () => {
    const character = await fresh('approved');
    const first = await as(world.playerA, setPortrait, { character, image: picture() });
    const second = await as(world.playerA, setPortrait, { character, image: picture() });
    expect(first.ok && second.ok && first.value === second.value).toBe(true);
  });

  it("another player can't set or change someone else's character's portrait", async () => {
    const character = await fresh('approved');
    expect(await as(world.playerB, setPortrait, { character, image: picture() })).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(await portraitOf(character.id)).toBeNull();
  });

  it('the GM can set a portrait on a player character', async () => {
    const character = await fresh('pending');
    expect((await as(world.gm, setPortrait, { character, image: picture() })).ok).toBe(true);
    expect(await portraitOf(character.id)).not.toBeNull();
  });
});

describe("a character's portrait must be a portrait from its own campaign", () => {
  it("a player can't link a picture someone else uploaded", async () => {
    const theirs = await portraitAsset(world.playerB);
    const character = await fresh('approved');
    const attempt = await world.playerA.db.from('actors').update({ portrait_asset_id: theirs.id }).eq('id', character.id).select();
    expect(attempt.error).not.toBeNull();
    expect(await portraitOf(character.id)).toBeNull();
  });

  it("not even the GM can link a picture from another campaign, or a handout", async () => {
    const elsewhere = await portraitAsset(world.gm, world.otherCampaignId);
    const handout = must(
      await world.gm.db
        .from('assets')
        .insert({ campaign_id: world.campaignId, kind: 'handout', name: 'A letter', visibility: 'all' })
        .select()
        .single(),
    );
    const character = await fresh('approved');
    for (const asset of [elsewhere, handout]) {
      const attempt = await world.gm.db.from('actors').update({ portrait_asset_id: asset.id }).eq('id', character.id).select();
      expect(attempt.error, asset.kind).not.toBeNull();
    }
  });
});

describe('removing pictures', () => {
  it('the owner can remove their character’s portrait; the file goes too', async () => {
    const character = await fresh('approved');
    const set = await as(world.playerA, setPortrait, { character, image: picture() });
    if (!set.ok) throw new Error(set.message);
    expect((await as(world.playerA, clearPortrait, { character })).ok).toBe(true);
    expect(await portraitOf(character.id)).toBeNull();
    expect(await fileExists(world.campaignId, set.value)).toBe(false);
  });

  it("another player can't delete someone's portrait file or row", async () => {
    const character = await fresh('approved');
    const set = await as(world.playerA, setPortrait, { character, image: picture() });
    if (!set.ok) throw new Error(set.message);
    await world.playerB.db.storage.from(BUCKET).remove([`${world.campaignId}/${set.value}`]);
    await world.playerB.db.from('assets').delete().eq('id', set.value);
    expect(await fileExists(world.campaignId, set.value)).toBe(true);
    expect((await world.admin.from('assets').select('id').eq('id', set.value)).data).toHaveLength(1);
  });

  it("deleting a never-approved character removes its portrait; archiving keeps it", async () => {
    const waiting = await fresh('pending');
    const gone = await as(world.playerA, setPortrait, { character: waiting, image: picture() });
    if (!gone.ok) throw new Error(gone.message);
    expect((await as(world.playerA, deleteCharacter, { character: waiting })).ok).toBe(true);
    expect(await fileExists(world.campaignId, gone.value)).toBe(false);
    expect((await world.admin.from('assets').select('id').eq('id', gone.value)).data).toEqual([]);

    const approved = await fresh('approved');
    const kept = await as(world.playerA, setPortrait, { character: approved, image: picture() });
    if (!kept.ok) throw new Error(kept.message);
    expect((await as(world.playerA, archiveCharacter, { character: approved })).ok).toBe(true);
    expect(await fileExists(world.campaignId, kept.value)).toBe(true);
  });
});
