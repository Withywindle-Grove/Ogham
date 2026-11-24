// A place whose pack carries its map's picture has the map with no tap (B14, p2p-27: "the app ties each map to its
// places"; Francis, 2026-11-24: no "+ Map" where the pack brought the picture). Invented pack, places and map only.
// In plain words:
//   * opening such a place gives the campaign its copy of the map, hidden, tied to the place, both steps in the log;
//   * opening it again, or two opens at once, or another place the same map names, makes no second copy;
//   * a map the GM tied to the place by hand is never replaced;
//   * a pack with no picture for the map is left for "+ Map", as before;
//   * a picture that can't be fetched says so and adds nothing;
//   * (Francis, 2026-11-24, "A") a place with no map of its own shows its parent place's map: an area under the
//     harbour gets the harbour's map with no tap, the same one copy, so one eye shows it at both; a map of the area's
//     own, the pack's or the GM's, wins over the one it would inherit.
import { beforeEach, describe, expect, it } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import type { PackMap } from '../modules/library/packMaps.ts';
import { runCommand } from '../core/commands.ts';
import { loadMapShown, loadPlaceMap, shareMap } from '../modules/expedition/placeMap.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { PACK_PICTURE_UNREAD_WORDS, tiePackMap } from './packMapTie.ts';

const registry = createAppRegistry();
const chart: PackMap = { id: 'harbour-chart', file: 'maps/harbour-chart.png', title: 'The harbour chart', alt: 'A silted harbour, its bar and five spots', locationIds: ['harbour', 'jetty'], source: '' };
const harbour = { id: 'p-harbour', name: 'The Drowned Harbour', version: 1, pack: { packId: 'pack-marsh', entryId: 'harbour', type: 'region', parentId: '', key: '' } };
const jetty = { id: 'p-jetty', name: '1 The jetty', version: 1, pack: { packId: 'pack-marsh', entryId: 'jetty', type: 'site', parentId: 'harbour', key: '1' } };
const PACKED = 'pack-marsh/harbour-chart';
// An area under the harbour that no map names (its parent's map is the one it shows), and its trail up the place tree.
const pier = { id: 'p-pier', name: '2 The old pier', version: 1, pack: { packId: 'pack-marsh', entryId: 'old-pier', type: 'area', parentId: 'harbour', key: '2' } };
const upTrail = (entryId: string) => (entryId === 'old-pier' ? ['old-pier', 'harbour'] : [entryId]);

describe("a pack's map tied to its places with no tap", () => {
  let world: FakeWorld;
  let gm: CurrentUser;
  let campaign: string;

  beforeEach(() => {
    world = createFakeDb();
    const gmId = world.addPerson('priya@lantern.example', 'Priya');
    campaign = world.addCampaign('The Reed Marches', gmId);
    world.tables.packs.push({ id: 'pack-marsh', owner_user_id: gmId, campaign_id: null, name: 'The Marsh', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '' });
    world.tables.campaign_packs.push({ id: 'cp-marsh', campaign_id: campaign, pack_id: 'pack-marsh', option_choices: {}, priority: 1 });
    world.tables.library_entries.push({ id: 'entry-chart', pack_id: 'pack-marsh', kind: 'map', pack_entry_id: chart.id, name: chart.title, data: { ...chart } });
    const place = (p: typeof harbour) => ({ id: p.id, campaign_id: campaign, name: p.name, description: '', pack_id: p.pack.packId, pack_entry_id: p.pack.entryId, map_asset_id: null, version: 1, undone: false });
    world.tables.places.push(place(harbour), place(jetty), place(pier));
    world.files.set(`pack-files/${PACKED}`, new Blob(['the chart, bundled'], { type: 'image/png' }));
    world.signInAs(gmId);
    gm = { id: gmId, roles: { [campaign]: 'gm' } };
  });

  const maps = () => world.tables.assets.filter((a) => a.kind === 'map');
  const tie = (place: typeof harbour) => tiePackMap(registry, world.db, gm, campaign, place, chart.title, PACKED);

  // Purpose: the tie makes the same copy "+ Map" makes (the campaign's map, hidden, tied to the place) from the pack's own
  // picture, and logs both steps under their commands' names.
  it("gives the campaign the pack's map, hidden and tied, in the log", async () => {
    const done = await tie(harbour);
    expect(done.ok).toBe(true);
    expect(maps()).toHaveLength(1);
    const asset = maps()[0]!;
    expect(asset).toMatchObject({ visibility: 'gm', name: chart.title });
    expect(world.tables.places.find((p) => p.id === harbour.id)?.map_asset_id).toBe(asset.id);
    expect(await world.files.get(`${campaign}/${String(asset.id)}`)?.text()).toBe('the chart, bundled');
    const types = world.tables.events.map((e) => e.type);
    expect(types).toContain('place.addMap');
    expect(types).toContain('place.setMap');
  });

  // Purpose: once tied, the place reads as having its map, so a second open has nothing to tie and adds no copy.
  it('a second open finds the map there and adds nothing', async () => {
    await tie(harbour);
    const state = await loadPlaceMap(world.db, campaign, harbour);
    expect(state).toMatchObject({ kind: 'added', assetId: maps()[0]!.id });
    expect(maps()).toHaveLength(1);
  });

  // Purpose: two opens at once (the page drawn twice) share one tie, so the campaign gets one copy.
  it('two opens at once make one copy', async () => {
    const [a, b] = await Promise.all([tie(harbour), tie(harbour)]);
    expect(a).toEqual(b);
    expect(maps()).toHaveLength(1);
  });

  // Purpose: another place the same map names shows the copy already made and asks for no second one.
  it('another place the same map names shows the same copy', async () => {
    await tie(harbour);
    expect(await loadPlaceMap(world.db, campaign, jetty)).toMatchObject({ kind: 'added', assetId: maps()[0]!.id });
  });

  // Purpose: a map the GM tied to the place by hand stands: the place reads as having it, with nothing to tie.
  it("a map the GM tied by hand is never replaced", async () => {
    world.tables.assets.push({ id: 'asset-own', campaign_id: campaign, kind: 'map', name: 'My own sketch', visibility: 'gm' });
    world.tables.places.find((p) => p.id === harbour.id)!.map_asset_id = 'asset-own';
    expect(await loadPlaceMap(world.db, campaign, harbour)).toMatchObject({ kind: 'added', assetId: 'asset-own' });
  });

  // Purpose: where the pack brought no picture for the map, the place asks for it by hand as before (no `packed`).
  it('a map whose picture the pack lacks is left for + Map', async () => {
    world.files.delete(`pack-files/${PACKED}`);
    expect(await loadPlaceMap(world.db, campaign, harbour)).toEqual({ kind: 'wanted', map: chart });
  });

  // Purpose: a picture that can't be fetched says so in plain words and adds nothing.
  it("says so when the pack's picture can't be fetched, and adds nothing", async () => {
    world.files.delete(`pack-files/${PACKED}`);
    const done = await tie(harbour);
    expect(done).toMatchObject({ ok: false, message: PACK_PICTURE_UNREAD_WORDS });
    expect(maps()).toHaveLength(0);
  });

  // Purpose (Francis, 2026-11-24, "A"): an area no map names gets its parent place's map with no tap: the tie gives the
  // campaign the harbour's map at the area, and the harbour shows that same copy (one copy, not one per area).
  it("an area with no map of its own gets its parent's map, the same one copy", async () => {
    const state = await loadPlaceMap(world.db, campaign, pier, upTrail);
    expect(state).toEqual({ kind: 'wanted', map: chart, from: 'harbour', packed: PACKED });
    await tie(pier);
    expect(maps()).toHaveLength(1);
    expect(await loadPlaceMap(world.db, campaign, pier, upTrail)).toMatchObject({ kind: 'added', assetId: maps()[0]!.id, from: 'harbour' });
    expect(await loadPlaceMap(world.db, campaign, harbour, upTrail)).toMatchObject({ kind: 'added', assetId: maps()[0]!.id });
  });

  // Purpose (one eye per map, not one per area): the eye opened at the area shows the map at the harbour too.
  it('the eye opened at an area shows the map at its parent too', async () => {
    await tie(pier);
    const assetId = String(maps()[0]!.id);
    const shared = await runCommand(registry, world.db, gm, shareMap, { campaignId: campaign, assetId, shown: true });
    expect(shared.ok).toBe(true);
    const atHarbour = await loadPlaceMap(world.db, campaign, harbour, upTrail);
    expect(atHarbour).toMatchObject({ kind: 'added', assetId });
    expect(await loadMapShown(world.db, assetId)).toBe(true);
  });

  // Purpose: a map the GM tied to the area itself wins over the parent's: the area shows its own, and nothing is tied.
  it("an area's own map wins over its parent's", async () => {
    world.tables.assets.push({ id: 'asset-pier', campaign_id: campaign, kind: 'map', name: 'The pier, sketched', visibility: 'gm' });
    world.tables.places.find((p) => p.id === pier.id)!.map_asset_id = 'asset-pier';
    expect(await loadPlaceMap(world.db, campaign, pier, upTrail)).toMatchObject({ kind: 'added', assetId: 'asset-pier' });
    expect(maps()).toHaveLength(1);
  });
});
