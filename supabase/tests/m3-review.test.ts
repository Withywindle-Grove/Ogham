// Holes found by the M3 fresh-session review, each pinned by a test. TEST project only; invented content.
//   1. A homebrew entry could be moved to another pack or kind, unlogged (and past the retired guard).
//   2. A campaign's homebrew could be deleted on its own, taking its entries with it unlogged.
//   3. A retired campaign's files could still be replaced or deleted.
//   4. The names of GM-only entries the GM picked a version of were readable by players.
//   5. A player who runs their own campaign saw their GM's packs in their Rules library.
//   6. A campaign's homebrew could be attached to another campaign.
//   7. Anyone could label a change "library.delete" (a pack leaving a campaign), which can't be undone.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { restoreCampaign, retireCampaign, setSigil } from '../../src/core/campaignCommands.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { taggedDb } from '../../src/core/eventTags.ts';
import type { Db } from '../../src/core/supabase.ts';
import { undoChange } from '../../src/core/undo.ts';
import { editCharacter, toCharacterRef } from '../../src/modules/characters/commands.ts';
import { attachPack, loadCampaignPacks, preferEntry, startHomebrew } from '../../src/modules/library/campaignPacks.ts';
import { importPack, loadLibrary } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { BUCKET, buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
let homeId = '';
let riverId = '';

beforeAll(async () => {
  world = await buildWorld();
  riverId = await pack('River Rules');
  await as(world.gm, attachPack, { campaignId: world.campaignId, packId: riverId });
  const home = await as(world.gm, startHomebrew, { campaignId: world.campaignId, campaignName: 'The Reedmouth Delve' });
  if (!home.ok) throw new Error(home.message);
  homeId = home.value;
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id);
  await tearDownWorld(world);
}, 60_000);

async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}

async function pack(name: string): Promise<string> {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name, version: '1' },
      classes: [{ id: 'lantern-warden', name: 'Lantern Warden' }],
      statBlocks: [{ id: 'bog-lurker', name: 'Bog lurker' }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  const made = await as(world.gm, importPack, { pack: read.pack });
  if (!made.ok) throw new Error(made.message);
  return made.value;
}

async function homebrewEntry(id: string): Promise<string> {
  return must(
    await world.gm.db.from('library_entries').insert({ pack_id: homeId, kind: 'item', pack_entry_id: id, name: 'Lucky reed', data: { id, name: 'Lucky reed' } }).select('id').single(),
  ).id;
}

describe('1. a homebrew entry stays where it is', () => {
  it("the GM can't move it to another pack or make it another kind, even going straight to the database", async () => {
    const entry = await homebrewEntry('moving-reed');
    expect((await world.gm.db.from('library_entries').update({ pack_id: riverId }).eq('id', entry).select('id')).error).not.toBeNull();
    expect((await world.gm.db.from('library_entries').update({ kind: 'condition' }).eq('id', entry).select('id')).error).not.toBeNull();
    expect(must(await world.admin.from('library_entries').select('pack_id, kind').eq('id', entry).single())).toEqual({ pack_id: homeId, kind: 'item' });
  });
});

describe('2. the homebrew goes only with its campaign', () => {
  it("the GM can't delete it on its own; its entries stay", async () => {
    await homebrewEntry('staying-reed');
    await world.gm.db.from('packs').delete().eq('id', homeId);
    expect(must(await world.admin.from('packs').select('id').eq('id', homeId))).toHaveLength(1);
    expect(must(await world.admin.from('library_entries').select('id').eq('pack_id', homeId).eq('pack_entry_id', 'staying-reed'))).toHaveLength(1);
  });

  it("a retired campaign's homebrew can't be renamed", async () => {
    await as(world.gm, retireCampaign, { campaignId: world.campaignId });
    const renamed = await world.gm.db.from('packs').update({ name: 'Renamed brew' }).eq('id', homeId).select('id');
    await as(world.gm, restoreCampaign, { campaignId: world.campaignId });
    expect(renamed.error?.message).toBe('This campaign is retired, so nothing in it can change.');
  });

  it('deleting the campaign still takes its homebrew with it', async () => {
    const made = must(await world.admin.from('campaigns').insert({ name: 'The Short Delve', created_by: world.gm.id }).select('id').single());
    must(await world.admin.from('members').insert({ campaign_id: made.id, user_id: world.gm.id, base_role: 'gm' }).select('campaign_id'));
    const home = await as(world.gm, startHomebrew, { campaignId: made.id, campaignName: 'The Short Delve' });
    if (!home.ok) throw new Error(home.message);
    must(await world.admin.from('campaigns').delete().eq('id', made.id).select('id'));
    expect(must(await world.admin.from('packs').select('id').eq('id', home.value))).toHaveLength(0);
  });
});

describe("3. a retired campaign's files are frozen", () => {
  it("the GM can't replace or delete the sigil's file while it's retired", async () => {
    const sigil = await as(world.gm, setSigil, { campaignId: world.campaignId, image: new Blob(['an invented sigil'], { type: 'image/jpeg' }) });
    if (!sigil.ok) throw new Error(sigil.message);
    const path = `${world.campaignId}/${sigil.value}`;
    await as(world.gm, retireCampaign, { campaignId: world.campaignId });
    const replaced = await world.gm.db.storage.from(BUCKET).upload(path, new Blob(['another sigil'], { type: 'image/jpeg' }), { upsert: true });
    await world.gm.db.storage.from(BUCKET).remove([path]);
    const left = ((await world.admin.storage.from(BUCKET).list(world.campaignId, { search: sigil.value })).data ?? []).some((f) => f.name === sigil.value);
    await as(world.gm, restoreCampaign, { campaignId: world.campaignId });
    expect(replaced.error).not.toBeNull();
    expect(left).toBe(true);
  });
});

describe('4. hidden means hidden: the GM picking a version of a GM-only entry', () => {
  it("players see neither the pick nor its log line; the GM sees both, and Undo works", async () => {
    const fen = await pack('Fen Rules');
    await as(world.gm, attachPack, { campaignId: world.campaignId, packId: fen });
    const links = (await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? [];
    const river = links.find((p) => p.packId === riverId)!;
    const key = 'statBlock:bog-lurker';
    expect(await as(world.gm, preferEntry, { campaignId: world.campaignId, key, name: 'Bog lurker', campaignPackId: river.id })).toMatchObject({ ok: true });
    expect(await as(world.gm, preferEntry, { campaignId: world.campaignId, key: 'class:lantern-warden', name: 'Lantern Warden', campaignPackId: river.id })).toMatchObject({ ok: true });

    const gmSees = ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.id === river.id)!;
    expect(gmSees.overrides).toEqual({ [key]: 'Bog lurker', 'class:lantern-warden': 'Lantern Warden' });
    const playerSees = ((await loadCampaignPacks(asDb(world.playerA), world.campaignId)) ?? []).find((p) => p.id === river.id)!;
    expect(playerSees.overrides).toEqual({ 'class:lantern-warden': 'Lantern Warden' });
    const playerRows = must(await world.playerA.db.from('campaign_packs').select('overrides').eq('campaign_id', world.campaignId));
    const playerLog = must(await world.playerA.db.from('events').select('before, after').eq('campaign_id', world.campaignId));
    expect(JSON.stringify([playerRows, playerLog])).not.toContain('bog-lurker');
    expect(JSON.stringify([playerRows, playerLog])).not.toContain('Bog lurker');

    // Every pick now sits in the GM's part (ruled 2026-10-29, A4), so the latest is undone first.
    const picks = must(await world.gm.db.from('events').select('id').eq('campaign_id', world.campaignId).eq('type', 'rules.prefer').order('seq'));
    expect(await as(world.gm, undoChange, { campaignId: world.campaignId, eventId: picks.at(-1)!.id, authorUserId: world.gm.id })).toMatchObject({ ok: true });
    expect(((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.id === river.id)!.overrides).toEqual({ [key]: 'Bog lurker' });
  });

  it("the GM can't put a pick where players can read it, even going straight to the database: it's filed with the GM's", async () => {
    const link = ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.packId === riverId)!;
    must(await world.gm.db.from('campaign_packs').update({ overrides: { 'statBlock:bog-lurker': 'Bog lurker' } }).eq('id', link.id).select('id'));
    expect(must(await world.admin.from('campaign_packs').select('overrides').eq('id', link.id).single()).overrides).toEqual({});
    expect(must(await world.admin.from('campaign_pack_secrets').select('overrides').eq('id', link.id).single()).overrides).toEqual({ 'statBlock:bog-lurker': 'Bog lurker' });
    expect(JSON.stringify(must(await world.playerA.db.from('campaign_packs').select('overrides').eq('campaign_id', world.campaignId)))).not.toContain('Bog lurker');
  });

  it("players can't read or change the GM-only picks directly", async () => {
    expect(must(await world.playerA.db.from('campaign_pack_secrets').select('overrides'))).toEqual([]);
    const link = ((await loadCampaignPacks(asDb(world.gm), world.campaignId)) ?? []).find((p) => p.packId === riverId)!;
    const before = must(await world.admin.from('campaign_pack_secrets').select('overrides').eq('id', link.id).single()).overrides;
    await world.playerA.db.from('campaign_pack_secrets').update({ overrides: { 'statBlock:x': 'X' } }).eq('id', link.id);
    expect(must(await world.admin.from('campaign_pack_secrets').select('overrides').eq('id', link.id).single()).overrides).toEqual(before);
  });
});

describe("5. your Rules library is yours alone", () => {
  it("a player doesn't see their GM's setting rules in their own library", async () => {
    const mine = (await loadLibrary(asDb(world.playerA), world.playerA.id)) ?? [];
    expect(mine.some((p) => p.id === riverId)).toBe(false);
    const gms = (await loadLibrary(asDb(world.gm), world.gm.id)) ?? [];
    expect(gms.find((p) => p.id === riverId)?.counts).toEqual({ class: 1, statBlock: 1 });
  });
});

describe("6. a campaign's homebrew is that campaign's", () => {
  it("the GM can't attach one campaign's homebrew to another", async () => {
    expect(await as(world.gm, attachPack, { campaignId: world.otherCampaignId, packId: homeId })).toMatchObject({ ok: false });
    expect(must(await world.admin.from('campaign_packs').select('id').eq('pack_id', homeId))).toHaveLength(1);
  });
});

describe('7. the database names log entries', () => {
  it("a player can't label their edit as setting rules leaving the campaign", async () => {
    const wren = toCharacterRef(must(await world.admin.from('actors').select().eq('id', world.wrenId).single()));
    const mislabelled = taggedDb(asDb(world.playerA), { type: 'library.delete', level: 'simple' });
    await editCharacter.run(mislabelled, await userOf(world.playerA), { character: wren, changes: { notes: 'Gone for good' } });
    const [latest] = must(await world.admin.from('events').select('type').eq('target_id', world.wrenId).order('seq', { ascending: false }).limit(1));
    expect(latest?.type).toBe('actors.update');
  });
});
