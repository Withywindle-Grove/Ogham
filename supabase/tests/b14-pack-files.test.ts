// A pack's pictures, kept with the pack (plan scene-point-to-point B14; p2p-27; Francis's storage ruling, 2026-11-22;
// supabase/migrations/20261122160000_b14_pack_files.sql; docs/03, hidden means hidden). TEST project only; invented
// people, places and maps.
//   The pack's owner keeps a map's picture with the pack (the private bucket `pack-files`, <pack id>/<map id>), reads
//   it and replaces it.
//   A player of a campaign that uses the pack reads nothing of it (not the file, not its name in a list, not a link)
//   and writes nothing, before the GM adds the map to a place and after the map's eye is opened: the eye shares the
//   campaign's own copy, never the pack's file.
//   A GM whose campaign doesn't use the pack is refused; once their campaign uses it they read it, and still can't
//   write it.
//   A path outside <pack id>/<map id>, or under someone else's pack, is refused.
//   The map ties to its places with no tap (Francis, 2026-11-24): the GM opening an area with no map of its own gives
//   the campaign its parent place's map, hidden, both steps logged; a player reads nothing of it (row, file, the
//   players' map) until the GM opens its eye, and a second open adds no copy.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import { assetPath, fileLinks, forgetFileLinks, PACK_FILES_BUCKET, packPicturePath } from '../../src/core/files.ts';
import type { Db } from '../../src/core/supabase.ts';
import { tiePackMap } from '../../src/app/packMapTie.ts';
import { addPlaceMap, loadPackPicture, loadPlaceMap, setPlaceMap, shareMap } from '../../src/modules/expedition/placeMap.ts';
import { loadGroupPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { addPackPicture } from '../../src/modules/library/packPictures.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
const registry = createAppRegistry();
const asDb = (person: Person) => person.db as unknown as Db;
const userOf = async (person: Person) => (await loadCurrentUser(asDb(person))) as CurrentUser;
async function as<I, T, O>(person: Person, command: Parameters<typeof runCommand<I, T, O>>[3], input: I) {
  return runCommand(registry, asDb(person), await userOf(person), command, input);
}
async function ok<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const done = await result;
  if (!done.ok) throw new Error(done.message);
  return done.value;
}

const MAP = 'map-harbour';
const chart = (words = 'a harbour chart') => new Blob([words], { type: 'image/png' });
const bucket = (person: Person) => person.db.storage.from(PACK_FILES_BUCKET);

/** A pack in this person's library that names one map; its id. */
async function freshPack(owner: Person): Promise<string> {
  const made = await owner.db.rpc('import_pack', {
    meta: { name: 'Saltwick Island', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' },
    entries: [{ kind: 'map', pack_entry_id: MAP, name: 'The Drowned Harbour', data: { file: 'images/map-harbour.png', title: 'The Drowned Harbour', alt: 'A harbour, half under water.', locationIds: [], source: '' } }],
    replace_pack_id: null,
  });
  if (made.error) throw made.error;
  return made.data as string;
}

/** A fresh campaign of this GM's, with these players, that uses these packs. */
async function freshCampaign(gm: Person, players: Person[], packIds: string[]): Promise<string> {
  const campaign = must(await world.admin.from('campaigns').insert({ name: 'The Reed Marches', created_by: gm.id }).select().single());
  const campaignId = campaign.id as string;
  must(await world.admin.from('members').insert([{ campaign_id: campaignId, user_id: gm.id, base_role: 'gm' }, ...players.map((p) => ({ campaign_id: campaignId, user_id: p.id, base_role: 'player' }))]).select());
  for (const [index, packId] of packIds.entries()) must(await world.admin.from('campaign_packs').insert({ campaign_id: campaignId, pack_id: packId, option_choices: {}, priority: index + 1 }).select());
  return campaignId;
}

/** What this person reads of the pack's picture: its file, its name in the pack's list, a link to it. */
async function reads(person: Person, packId: string) {
  const path = packPicturePath(packId, MAP);
  const listed = await bucket(person).list(packId, { search: MAP });
  const link = await bucket(person).createSignedUrl(path, 60);
  return { file: (await loadPackPicture(asDb(person), path)) !== null, listed: (listed.data ?? []).map((file) => file.name), link: !!link.data?.signedUrl };
}
const NOTHING = { file: false, listed: [], link: false };
const ALL = { file: true, listed: [MAP], link: true };

/** Whether this person can put a file at this path, new or over the one there. */
async function writes(person: Person, path: string) {
  const fresh = await bucket(person).upload(path, chart('not the chart'), { contentType: 'image/png' });
  const over = await bucket(person).upload(path, chart('not the chart'), { upsert: true, contentType: 'image/png' });
  const changed = await bucket(person).update(path, chart('not the chart'), { contentType: 'image/png' });
  return !fresh.error || !over.error || !changed.error;
}

beforeAll(async () => {
  world = await buildWorld();
}, 300_000);

afterAll(async () => {
  await tearDownWorld(world);
}, 60_000);

describe("a pack's pictures, kept with the pack", () => {
  // Purpose: the pack's owner keeps a picture with the pack, reads it back, and a second save replaces the first.
  it("the pack's owner keeps a map's picture, reads it and replaces it", async () => {
    const packId = await freshPack(world.gm);
    await ok(as(world.gm, addPackPicture, { packId, ownerUserId: world.gm.id, mapId: MAP, image: chart() }));
    expect(await reads(world.gm, packId)).toEqual(ALL);
    await ok(as(world.gm, addPackPicture, { packId, ownerUserId: world.gm.id, mapId: MAP, image: chart('the chart, redrawn') }));
    expect(await (await loadPackPicture(asDb(world.gm), packPicturePath(packId, MAP)))?.text()).toBe('the chart, redrawn');
  }, 120_000);

  // Purpose (hard rule 5): a player never reads a pack's file, not before the GM adds the map to a place and not after
  // the map's eye is opened: the eye shares the campaign's own copy, and the pack's file stays out of reach.
  it('a player reads and writes nothing of it, even after the eye is opened', async () => {
    const packId = await freshPack(world.gm);
    await ok(as(world.gm, addPackPicture, { packId, ownerUserId: world.gm.id, mapId: MAP, image: chart() }));
    const campaignId = await freshCampaign(world.gm, [world.playerA], [packId]);
    must(await world.admin.from('actors').insert({ campaign_id: campaignId, kind: 'pc', name: 'Reed the Ferrywarden', owner_type: 'user', owner_user_id: world.playerA.id, approval: 'approved', status: 'active', level: 1 }).select('id'));
    expect(await reads(world.playerA, packId)).toEqual(NOTHING);
    expect(await writes(world.playerA, packPicturePath(packId, MAP))).toBe(false);
    expect(await writes(world.playerA, packPicturePath(packId, 'map-of-mine'))).toBe(false);
    // The GM adds the pack's picture to a place as the campaign's own copy, and opens its eye.
    const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon', place: 'The Drowned Harbour' }));
    const placeNow = async () => (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!.place!;
    const image = (await loadPackPicture(asDb(world.gm), packPicturePath(packId, MAP)))!;
    const assetId = await ok(as(world.gm, addPlaceMap, { campaignId, place: await placeNow(), title: 'The Drowned Harbour', image }));
    await ok(as(world.gm, setPlaceMap, { campaignId, place: await placeNow(), assetId }));
    await ok(as(world.gm, shareMap, { campaignId, assetId, shown: true }));
    // The player now reads the campaign's copy, and still nothing of the pack's file.
    forgetFileLinks();
    expect((await fileLinks(asDb(world.playerA), [assetPath(campaignId, assetId)])).size).toBe(1);
    expect(await reads(world.playerA, packId)).toEqual(NOTHING);
    expect(await writes(world.playerA, packPicturePath(packId, MAP))).toBe(false);
    // The file is as the owner left it.
    expect(await (await loadPackPicture(asDb(world.gm), packPicturePath(packId, MAP)))?.text()).toBe('a harbour chart');
  }, 180_000);

  // Purpose: a GM reads a pack's file only through a campaign of theirs that uses the pack, and never writes it.
  it("a GM whose campaign doesn't use the pack is refused; once it does they read it, and still can't write it", async () => {
    const packId = await freshPack(world.gm);
    await ok(as(world.gm, addPackPicture, { packId, ownerUserId: world.gm.id, mapId: MAP, image: chart() }));
    const campaignId = await freshCampaign(world.outsider, [], []);
    expect(await reads(world.outsider, packId)).toEqual(NOTHING);
    expect(await writes(world.outsider, packPicturePath(packId, MAP))).toBe(false);
    // The app's own command refuses too: the pack isn't theirs.
    expect((await as(world.outsider, addPackPicture, { packId, ownerUserId: world.gm.id, mapId: MAP, image: chart() })).ok).toBe(false);
    must(await world.admin.from('campaign_packs').insert({ campaign_id: campaignId, pack_id: packId, option_choices: {}, priority: 1 }).select());
    expect(await reads(world.outsider, packId)).toEqual(ALL);
    expect(await writes(world.outsider, packPicturePath(packId, MAP))).toBe(false);
    expect(await (await loadPackPicture(asDb(world.gm), packPicturePath(packId, MAP)))?.text()).toBe('a harbour chart');
  }, 120_000);

  // Purpose: the bucket takes only <pack id>/<map id> under a pack of the uploader's own.
  it("a path outside <pack id>/<map id>, or under someone else's pack, is refused", async () => {
    const mine = await freshPack(world.gm);
    const theirs = await freshPack(world.outsider);
    expect(await writes(world.gm, `${mine}/deeper/${MAP}`)).toBe(false);
    expect(await writes(world.gm, mine)).toBe(false);
    expect(await writes(world.gm, packPicturePath(theirs, MAP))).toBe(false);
    expect(await writes(world.gm, packPicturePath(mine, MAP))).toBe(true);
  }, 120_000);
});

/** An invented adventure: a harbour with two numbered areas under it, and one map, which names the harbour only. */
const harbourPack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Saltwick Island', version: '0.1', kind: 'adventure' },
      locations: [
        { id: 'drowned-harbour', name: 'The Drowned Harbour', type: 'site', playerView: { text: 'A silted harbour of black water.' } },
        { id: 'the-jetty', name: 'The Jetty', type: 'area', key: '1', parentId: 'drowned-harbour', playerView: { text: 'Black piles and a slick deck.' } },
        { id: 'the-wreck', name: 'The Wreck', type: 'area', key: '2', parentId: 'drowned-harbour', playerView: { text: 'A cog on her side on the bar.' } },
      ],
      images: [{ id: MAP, file: 'images/map-harbour.png', type: 'map', title: 'The Drowned Harbour', alt: 'A harbour, half under water.', visibility: 'gm', locationIds: ['drowned-harbour'], source: '' }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

describe("a pack's map tied to its places with no tap (Francis, 2026-11-24)", () => {
  // Purpose (hard rule 5, p2p-27 and the ruling "A"): the GM opening an area no map names gives the campaign its parent's
  // map with no tap, hidden and logged; a player reads nothing of it until its eye is opened; a second open adds nothing.
  it("the area's inherited map is tied hidden, and reaches a player only through its eye", async () => {
    const campaignId = world.campaignId;
    const packId = await ok(as(world.gm, importPack, { pack: harbourPack() }));
    await ok(as(world.gm, addPackPicture, { packId, ownerUserId: world.gm.id, mapId: MAP, image: chart() }));
    await ok(as(world.gm, attachPack, { campaignId, packId }));
    const trip = await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }));
    const entry = ((await loadCampaignEntries(asDb(world.gm), campaignId)) ?? []).find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === 'the-jetty')!;
    await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: { packId, packEntryId: 'the-jetty', name: entry.name, data: entry.data as Record<string, unknown> } }));
    const visit = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));
    const place = (await loadGroupPlaces(asDb(world.gm), campaignId, trip.id))!.get(1)!.place!;
    const upTrail = (id: string) => (id === 'the-jetty' ? ['the-jetty', 'drowned-harbour'] : [id]);

    // The GM opens the jetty: its map is the harbour's, and the pack brought the picture, so it is tied with no tap.
    const wanted = await loadPlaceMap(asDb(world.gm), campaignId, place, upTrail);
    expect(wanted).toMatchObject({ kind: 'wanted', from: 'drowned-harbour', packed: packPicturePath(packId, MAP) });
    if (wanted?.kind !== 'wanted' || !wanted.packed) throw new Error('not offered');
    const requestTypes = async () => (must(await world.admin.from('events').select('type').eq('campaign_id', campaignId)) as { type: string }[]).map((e) => e.type);
    const assetId = await ok(tiePackMap(registry, asDb(world.gm), await userOf(world.gm), campaignId, place, wanted.map.title, wanted.packed));
    expect(await requestTypes()).toEqual(expect.arrayContaining(['place.addMap', 'place.setMap']));

    // Hidden: the player reads no row, no file and no players' map of it.
    expect(must(await world.playerA.db.from('assets').select('id').eq('id', assetId))).toEqual([]);
    forgetFileLinks();
    expect((await fileLinks(asDb(world.playerA), [assetPath(campaignId, assetId)])).size).toBe(0);
    expect(must(await world.playerA.db.rpc('map_for_players', { campaign: campaignId }))).toEqual([]);

    // A second open finds the map there: nothing more to tie, and still one copy.
    expect(await loadPlaceMap(asDb(world.gm), campaignId, place, upTrail)).toMatchObject({ kind: 'added', assetId });
    expect(must(await world.admin.from('assets').select('id').eq('campaign_id', campaignId).eq('kind', 'map'))).toHaveLength(1);

    // The eye opened: now (and only now) the player's group reads it.
    await ok(as(world.gm, shareMap, { campaignId, assetId, shown: true }));
    expect(must(await world.playerA.db.rpc('map_for_players', { campaign: campaignId }))).toEqual([{ group_number: 1, asset_id: assetId, title: 'The Drowned Harbour' }]);
  }, 180_000);
});
