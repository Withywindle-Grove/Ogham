// A place's map (dec-7 piece 5m-2; docs/plans/dec-7-5-place-page-and-map.md; mockup december/11, frames 2c and 4d).
// Invented places and maps only. What it checks, in plain words:
//   * a place shows no map when its pack names none, "wanted" when the pack names one the campaign hasn't added, and
//     the campaign's copy once added, at that place and at every other place whose map it is (one copy per campaign);
//   * a place made by hand has no map until one is tied to it, and then shows it under the copy's own name;
//   * + Map's two commands: the GM uploads the copy (an asset of kind map, the GM's alone) and ties it to the place, in
//     the log; Undo unties it and the place asks for the map again; a player reads nothing of the copy;
//   * the tie takes only a map of the place's own campaign.
import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { runCommand, STALE, STALE_CODE, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { undoChange } from '../../core/undo.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import type { PackMap } from '../library/packMaps.ts';
import { addPlaceMap, loadMapShown, loadPlaceMap, resolvePlaceMap, setPlaceMap, shareEventOf, shareMap, type PlaceMapRow } from './placeMap.ts';

const chart: PackMap = { id: 'harbour-chart', file: 'maps/harbour-chart.png', title: 'The harbour chart', alt: 'A silted harbour, its bar and five spots', locationIds: ['harbour', 'jetty'], source: 'p. 12' };
const cave: PackMap = { id: 'cave-plan', file: 'maps/cave-plan.png', title: 'The sea cave', alt: 'A cave behind the breakwater', locationIds: ['sea-cave'], source: '' };
const row = (id: string, entryId: string | null, mapAssetId: string | null = null, packId: string | null = entryId ? 'pack-marsh' : null): PlaceMapRow => ({ id, packId, entryId, mapAssetId });

describe('resolvePlaceMap: which map a place shows', () => {
  // Purpose: a place whose pack names no map draws nothing where the map would be (frame 2a).
  it('no map when the pack names none for the place', () => {
    expect(resolvePlaceMap(row('p-shed', 'customs-shed'), [chart, cave], [])).toEqual({ kind: 'none' });
  });

  // Purpose: the pack names a map and the campaign has no copy: the row asks for it by title and file (frame 2c).
  it('wanted when the pack names a map and no place of the campaign holds a copy', () => {
    expect(resolvePlaceMap(row('p-harbour', 'harbour'), [chart, cave], [row('p-harbour', 'harbour'), row('p-cave', 'sea-cave', 'asset-cave')])).toEqual({ kind: 'wanted', map: chart });
  });

  // Purpose: once tied, the place shows the copy, with the pack's title and words for a screen reader.
  it('the copy tied to the place, with the pack’s title and alt', () => {
    expect(resolvePlaceMap(row('p-harbour', 'harbour', 'asset-chart'), [chart], [])).toEqual({ kind: 'added', assetId: 'asset-chart', title: 'The harbour chart', alt: 'A silted harbour, its bar and five spots' });
  });

  // Purpose: one copy per campaign: a map that belongs to two places is asked for once and shows at both.
  it('another place whose map it is shares the copy it holds', () => {
    const places = [row('p-harbour', 'harbour', 'asset-chart'), row('p-jetty', 'jetty')];
    expect(resolvePlaceMap(row('p-jetty', 'jetty'), [chart], places)).toMatchObject({ kind: 'added', assetId: 'asset-chart' });
  });

  // Purpose: a copy held by a place of another pack, or of another map, is never taken for this one.
  it('a copy of another map or another pack is not shared', () => {
    const otherPack = row('p-elsewhere', 'harbour', 'asset-other', 'pack-other');
    const otherMap = row('p-cave', 'sea-cave', 'asset-cave');
    expect(resolvePlaceMap(row('p-jetty', 'jetty'), [chart, cave], [otherPack, otherMap])).toEqual({ kind: 'wanted', map: chart });
  });

  // Purpose: a place made by hand shows nothing until a map is tied, then the copy under its own name.
  it('a place made by hand: none, then its tied copy under the copy’s name', () => {
    expect(resolvePlaceMap(row('p-bog', null), [], [])).toEqual({ kind: 'none' });
    expect(resolvePlaceMap(row('p-bog', null, 'asset-sketch'), [], [], new Map([['asset-sketch', 'Sketch of the bog']]))).toEqual({ kind: 'added', assetId: 'asset-sketch', title: 'Sketch of the bog', alt: 'Sketch of the bog, the map' });
  });

  // S13 (mc-58, frame 1b): at a spot, the Scene carries the place's map: a spot its pack's maps don't name shows the map
  // of the nearest place up its trail, and says whose it is.
  const upTrail = (entryId: string) => (entryId === 'wreck' ? ['wreck', 'harbour', 'island'] : [entryId]);
  const harbourOnly: PackMap = { ...chart, locationIds: ['harbour'] };

  // Purpose: a spot no map names shows the map of the place it is in (the wreck shows the harbour's chart, wanted).
  it('at a spot no map names: the map of the nearest place up its trail, and whose it is', () => {
    expect(resolvePlaceMap(row('p-wreck', 'wreck'), [harbourOnly], [], new Map(), upTrail)).toEqual({ kind: 'wanted', map: harbourOnly, from: 'harbour' });
  });

  // Purpose: one copy per campaign, at a spot too: added at the wreck, the harbour shows that copy and asks for nothing.
  it('a copy added at a spot is the place’s copy too', () => {
    const places = [row('p-wreck', 'wreck', 'asset-chart'), row('p-harbour', 'harbour')];
    expect(resolvePlaceMap(row('p-harbour', 'harbour'), [harbourOnly], places, new Map(), upTrail)).toEqual({ kind: 'added', assetId: 'asset-chart', title: 'The harbour chart', alt: chart.alt });
    expect(resolvePlaceMap(row('p-wreck', 'wreck', 'asset-chart'), [harbourOnly], places, new Map(), upTrail)).toEqual({ kind: 'added', assetId: 'asset-chart', title: 'The harbour chart', alt: chart.alt, from: 'harbour' });
  });

  // Purpose: a spot its own map names shows its own, not the place's.
  it('a spot with a map of its own shows its own', () => {
    const wreckPlan: PackMap = { ...cave, id: 'wreck-plan', title: 'The wreck, decks', locationIds: ['wreck'] };
    expect(resolvePlaceMap(row('p-wreck', 'wreck'), [harbourOnly, wreckPlan], [], new Map(), upTrail)).toEqual({ kind: 'wanted', map: wreckPlan });
  });
});

describe('+ Map: the copy uploaded and tied (fake database)', () => {
  let world: FakeWorld;
  let gm: CurrentUser;
  let sam: CurrentUser;
  let samId: string;
  let campaign: string;
  const registry = createAppRegistry();
  const harbour = { id: 'p-harbour', name: 'The Drowned Harbour', version: 1, pack: { packId: 'pack-marsh', entryId: 'harbour', type: 'region', parentId: '', key: '' } };
  const jetty = { id: 'p-jetty', name: '1 The jetty', version: 1, pack: { packId: 'pack-marsh', entryId: 'jetty', type: 'site', parentId: 'harbour', key: '1' } };

  beforeEach(() => {
    world = createFakeDb();
    const gmId = world.addPerson('priya@lantern.example', 'Priya');
    samId = world.addPerson('sam@lantern.example', 'Sam');
    campaign = world.addCampaign('The Reed Marches', gmId);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: samId });
    world.addMember(campaign, samId, 'player', wren);
    world.tables.campaign_packs.push({ id: 'cp-marsh', campaign_id: campaign, pack_id: 'pack-marsh', option_choices: {}, priority: 1 });
    world.tables.library_entries.push({ id: 'entry-chart', pack_id: 'pack-marsh', kind: 'map', pack_entry_id: chart.id, name: chart.title, data: { ...chart } });
    const place = (p: typeof harbour) => ({ id: p.id, campaign_id: campaign, name: p.name, description: '', pack_id: p.pack.packId, pack_entry_id: p.pack.entryId, map_asset_id: null, version: 1, undone: false });
    world.tables.places.push(place(harbour), place(jetty));
    world.signInAs(gmId);
    gm = { id: gmId, roles: { [campaign]: 'gm' } };
    sam = { id: samId, roles: { [campaign]: 'player' } };
  });

  const add = async () => {
    const added = await runCommand(registry, world.db, gm, addPlaceMap, { campaignId: campaign, place: harbour, title: chart.title, image: new Blob(['a chart'], { type: 'image/png' }) });
    if (!added.ok) throw new Error(added.message);
    const tied = await runCommand(registry, world.db, gm, setPlaceMap, { campaignId: campaign, place: harbour, assetId: added.value });
    if (!tied.ok) throw new Error(tied.message);
    return added.value;
  };

  // Purpose: before anything is added, the harbour asks for its map by the pack's title and file.
  it('the place asks for the map the pack names', async () => {
    expect(await loadPlaceMap(world.db, campaign, harbour)).toEqual({ kind: 'wanted', map: { ...chart, locationIds: ['harbour', 'jetty'] } });
  });

  // Purpose: + Map stores the copy as the campaign's map, the GM's alone, ties it to the place and logs the tie;
  // the jetty, which the same map names, shows the same copy.
  it('the GM adds the map: a map asset, hidden, tied to the place, in the log; shared by the jetty', async () => {
    const assetId = await add();
    expect(world.tables.assets.filter((a) => a.id === assetId).map((a) => [a.kind, a.visibility, a.name])).toEqual([['map', 'gm', 'The harbour chart']]);
    expect(world.tables.places.find((p) => p.id === harbour.id)?.map_asset_id).toBe(assetId);
    expect(world.tables.events.some((e) => e.type === 'place.setMap' && e.target_table === 'places' && e.audience === 'gm')).toBe(true);
    expect(await loadPlaceMap(world.db, campaign, harbour)).toEqual({ kind: 'added', assetId, title: 'The harbour chart', alt: chart.alt });
    expect(await loadPlaceMap(world.db, campaign, jetty)).toMatchObject({ kind: 'added', assetId });
  });

  // Purpose: the toast's Undo unties the map, and the place asks for it again.
  it('Undo takes the map off the place again', async () => {
    await add();
    const line = world.tables.events.filter((e) => e.type === 'place.setMap').sort((a, b) => Number(b.seq) - Number(a.seq))[0]!;
    const undone = await runCommand(registry, world.db, gm, undoChange, { campaignId: campaign, eventId: String(line.id), authorUserId: gm.id });
    expect(undone.ok).toBe(true);
    expect(world.tables.places.find((p) => p.id === harbour.id)?.map_asset_id).toBeNull();
    expect(await loadPlaceMap(world.db, campaign, harbour)).toMatchObject({ kind: 'wanted' });
  });

  // Purpose: a player can't read the place's tie or change it. (The copy's own row and file are kept from players by the
  // database's rule, which the stand-in doesn't model: supabase/tests/dec-7-5m-2-place-map.test.ts checks them.)
  it('a player reads nothing of the tie and cannot change it', async () => {
    await add();
    world.signInAs(samId);
    expect(await loadPlaceMap(world.db, campaign, harbour)).toEqual({ kind: 'none' });
    const tie = await runCommand(registry, world.db, sam, setPlaceMap, { campaignId: campaign, place: harbour, assetId: null });
    expect(tie.ok).toBe(false);
    expect(world.tables.places.find((p) => p.id === harbour.id)?.map_asset_id).not.toBeNull();
  });

  // Purpose (5m-3, the map's eye): the GM shares the map at once, logged as the GM's line; the copy's own visibility is
  // what changes (players' reading of it is the database's existing rule); Undo hides it again.
  it('the eye: the GM shares the map, in the log; Undo hides it again', async () => {
    const assetId = await add();
    expect(await loadMapShown(world.db, assetId)).toBe(false);
    const shared = await runCommand(registry, world.db, gm, shareMap, { campaignId: campaign, assetId, shown: true });
    expect(shared.ok).toBe(true);
    expect(world.tables.assets.find((a) => a.id === assetId)?.visibility).toBe('all');
    expect(await loadMapShown(world.db, assetId)).toBe(true);
    const line = world.tables.events.filter((e) => e.type === 'place.shareMap').sort((a, b) => Number(b.seq) - Number(a.seq))[0]!;
    expect(line).toMatchObject({ target_table: 'assets', target_id: assetId });
    const undone = await runCommand(registry, world.db, gm, undoChange, { campaignId: campaign, eventId: String(line.id), authorUserId: gm.id });
    expect(undone.ok).toBe(true);
    expect(world.tables.assets.find((a) => a.id === assetId)?.visibility).toBe('gm');
  });

  // Purpose: hiding it again is the same command the other way: the copy is the GM's alone again.
  it('the eye: hidden again by a second tap', async () => {
    const assetId = await add();
    await runCommand(registry, world.db, gm, shareMap, { campaignId: campaign, assetId, shown: true });
    const hidden = await runCommand(registry, world.db, gm, shareMap, { campaignId: campaign, assetId, shown: false });
    expect(hidden.ok).toBe(true);
    expect(world.tables.assets.find((a) => a.id === assetId)?.visibility).toBe('gm');
  });

  // Purpose: a player can't share the map (the command refuses before the database is asked).
  it('the eye: a player cannot share the map', async () => {
    const assetId = await add();
    world.signInAs(samId);
    const shared = await runCommand(registry, world.db, sam, shareMap, { campaignId: campaign, assetId, shown: true });
    expect(shared.ok).toBe(false);
    expect(world.tables.assets.find((a) => a.id === assetId)?.visibility).toBe('gm');
  });

  // Purpose (#851's review): a GM naming another campaign of theirs, where the GM's check passes, doesn't reach this
  // campaign's map: the write is tied to the campaign named, so it matches no row and is refused.
  it("the eye: a GM can't share a map of another campaign by naming their own", async () => {
    const assetId = await add();
    const other = world.addCampaign('The Salt Flats', gm.id);
    const gmOfBoth = { ...gm, roles: { ...gm.roles, [other]: 'gm' as const } };
    const shared = await runCommand(registry, world.db, gmOfBoth, shareMap, { campaignId: other, assetId, shown: true });
    expect(shared.ok).toBe(false);
    expect(world.tables.assets.find((a) => a.id === assetId)?.visibility).toBe('gm');
  });

  // Purpose (#851's review): the toast's Undo takes back the share it names, found by its own run's request id, not
  // the GM's newest share: after a share and a hide, the share's line is the share's, not the hide's.
  it("the eye: each run's own line, by its request id", async () => {
    const assetId = await add();
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    await runCommand(registry, world.db, gm, shareMap, { campaignId: campaign, assetId, shown: true }, { requestId: first });
    await runCommand(registry, world.db, gm, shareMap, { campaignId: campaign, assetId, shown: false }, { requestId: second });
    const lines = world.tables.events.filter((e) => e.type === 'place.shareMap');
    const of = (requestId: string) => String(lines.find((e) => e.request_id === requestId)?.id);
    expect(await shareEventOf(world.db, campaign, first)).toBe(of(first));
    expect(await shareEventOf(world.db, campaign, second)).toBe(of(second));
    expect(of(first)).not.toBe(of(second));
    expect(await shareEventOf(world.db, campaign, crypto.randomUUID())).toBeNull();
  });

  // Purpose (#851's review): a copy that can't be read has no known eye (null), never a closed one.
  it("the eye: unknown (null) when the copy can't be read", async () => {
    expect(await loadMapShown(world.db, 'no-such-asset')).toBeNull();
  });

  // Purpose: the tie takes a map only: a place's picture can't be made its map.
  it('the tie refuses an asset that is not a map', async () => {
    world.tables.assets.push({ id: 'asset-photo', campaign_id: campaign, kind: 'place', name: 'A photo', visibility: 'gm' });
    const tied = await runCommand(registry, world.db, gm, setPlaceMap, { campaignId: campaign, place: harbour, assetId: 'asset-photo' });
    expect(tied.ok).toBe(false);
    expect(world.tables.places.find((p) => p.id === harbour.id)?.map_asset_id).toBeNull();
  });

  // Purpose: a place made by hand takes a map the same way, and shows it under the copy's own name.
  it('a place made by hand takes a map the same way', async () => {
    world.tables.places.push({ id: 'p-bog', campaign_id: campaign, name: 'The bog camp', description: '', pack_id: null, pack_entry_id: null, map_asset_id: null, version: 1, undone: false });
    const bog = { id: 'p-bog', name: 'The bog camp', version: 1, pack: null };
    expect(await loadPlaceMap(world.db, campaign, bog)).toEqual({ kind: 'none' });
    const added = await runCommand(registry, world.db, gm, addPlaceMap, { campaignId: campaign, place: bog, title: '', image: new Blob(['a sketch'], { type: 'image/jpeg' }) });
    if (!added.ok) throw new Error(added.message);
    await runCommand(registry, world.db, gm, setPlaceMap, { campaignId: campaign, place: bog, assetId: added.value });
    expect(await loadPlaceMap(world.db, campaign, bog)).toEqual({ kind: 'added', assetId: added.value, title: 'The bog camp', alt: 'The bog camp, the map' });
  });
});

describe('+ Map: a place changed since it was loaded', () => {
  // Purpose: the tie is written from the caller's copy, as place.edit is: when the database says the place changed
  // since (its version), the GM is told so in the usual words, and nothing is tied.
  it("says \"That's changed since. Here's the latest.\" when the place's version is old", async () => {
    let written: Record<string, unknown> | null = null;
    // A stand-in database whose places refuse the write as the version check does (code GR409).
    const db = {
      from: () => ({
        update: (patch: Record<string, unknown>) => {
          written = patch;
          return { eq: () => ({ select: async () => ({ data: null, error: { code: STALE_CODE, message: 'stale copy' } }) }) };
        },
      }),
    } as unknown as Db;
    const gm: CurrentUser = { id: 'user-gm', roles: { 'campaign-1': 'gm' } };
    const result = await setPlaceMap.run(db, gm, { campaignId: 'campaign-1', place: { id: 'p-harbour', version: 3 }, assetId: 'asset-chart' });
    expect(result).toEqual({ ok: false, reason: 'stale', message: STALE });
    expect(written).toEqual({ map_asset_id: 'asset-chart', version: 3 });
  });
});
