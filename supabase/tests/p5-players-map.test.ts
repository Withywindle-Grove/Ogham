// The players' map (plan dec-9-the-players-scene, P5; supabase/migrations/20261122140000_p5_players_map.sql; mc-37,
// mc-39b, dp-3; Francis's yes "1a", 2026-11-22; hard rule 5). Tested on what the DATABASE sends a player, never on what
// a screen draws. TEST project or CI's local database; invented packs, places and words only. What it checks, in plain
// words:
//   * before anything of the place is shown, a player in the group reads no map, even one the GM has shared;
//   * once shown, the map of the place (here the Area's, borrowed by the Location inside it) reaches the group only while
//     its eye is open: its copy's id and its title, never a place id, a pack entry or the map entry's words;
//   * it stays through a move to a place not shown yet (the last place shown, mc-39b), and at another Location of the
//     same Area once shown (the one copy the campaign holds); at a place with no map, nothing;
//   * another group's shown, shared map reaches that group only, never player A; a campaign player A isn't in, with a
//     place shown and its map shared, sends A nothing (its own player reads it); someone outside reads nothing;
//   * the eye opened or closed ticks the group's signal, so screens read again.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { addPlaceMap, loadPlayersMaps, setPlaceMap, shareMap } from '../../src/modules/expedition/placeMap.ts';
import { addPiece, loadGroupPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { buildWorld, must, tearDownWorld, type Person, type World } from './world.ts';

let world: World;
let campaignId = '';
let packId = '';
let tripId = '';
let assetId = '';
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

const CHART = 'The Drowned Harbour, a chart';
const CHART_ALT = 'A silted harbour with three moorings';

/** An invented adventure: a harbour Area with two numbered Locations and a map of the harbour; a second Area, no map. */
const harbourPack = () => {
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'The Reed Marches', version: '0.1', kind: 'adventure' },
      locations: [
        { id: 'drowned-harbour', name: 'The Drowned Harbour', type: 'site', playerView: { text: 'A silted harbour of black water.' } },
        { id: 'the-jetty', name: 'The Jetty', type: 'area', key: '1', parentId: 'drowned-harbour', playerView: { text: 'Black piles and a slick deck.' } },
        { id: 'the-wreck', name: 'The Wreck', type: 'area', key: '2', parentId: 'drowned-harbour', playerView: { text: 'A cog on her side on the bar.' } },
        { id: 'salt-flats', name: 'The Salt Flats', type: 'site', playerView: { text: 'White crust to the horizon.' } },
      ],
      images: [{ id: 'harbour-chart', file: 'maps/harbour-chart.webp', type: 'map', title: CHART, alt: CHART_ALT, visibility: 'gm', locationIds: ['drowned-harbour'], source: 'p. 12' }],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};

const entryOf = async (id: string) => {
  const found = ((await loadCampaignEntries(asDb(world.gm), campaignId)) ?? []).find((e) => e.kind === 'location' && e.packId === packId && e.packEntryId === id);
  if (!found) throw new Error(`no ${id}`);
  return { packId, packEntryId: id, name: found.name, data: found.data as Record<string, unknown> };
};
const visitNow = async () => (await loadGroupPlaces(asDb(world.gm), campaignId, tripId))!.get(1)!;
/** Group 1 moves to a place of the pack; `shown`: the GM shows its first piece. */
const goTo = async (id: string, shown: boolean) => {
  await ok(as(world.gm, setPlace, { campaignId, group: 1, name: '', packEntry: await entryOf(id) }));
  const visit = await visitNow();
  if (shown && !visit.pieces[0]!.shown) await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));
};
/** The GM shows the first piece of where group 1 stands now. */
const showHere = async () => {
  const visit = await visitNow();
  if (!visit.pieces[0]!.shown) await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));
};
const eye = (shown: boolean) => ok(as(world.gm, shareMap, { campaignId, assetId, shown }));
const raw = async (person: Person, campaign = campaignId) => {
  const read = await person.db.rpc('map_for_players', { campaign });
  return read.data ?? [];
};
const tickOf = async (group: number) => Number((await world.admin.from('group_place_signals').select('tick').eq('campaign_id', campaignId).eq('group_number', group).maybeSingle()).data?.tick ?? 0);

beforeAll(async () => {
  world = await buildWorld();
  campaignId = world.campaignId;
  packId = await ok(as(world.gm, importPack, { pack: harbourPack() }));
  await ok(as(world.gm, attachPack, { campaignId, packId }));
  tripId = (await ok(as(world.gm, startExpedition, { campaignId, mode: 'dungeon' }))).id;
  // Player B's character goes to a group of its own.
  await ok(as(world.playerB, chooseGroup, { character: { id: world.ashId, campaignId, ownerUserId: world.playerB.id }, group: null }));
  // The party at the jetty, nothing shown yet; the GM adds the harbour's map there (one copy for the campaign).
  await goTo('the-jetty', false);
  const place = (await visitNow()).place!;
  assetId = await ok(as(world.gm, addPlaceMap, { campaignId, place, title: CHART, image: new Blob(['a chart'], { type: 'image/png' }) }));
  await ok(as(world.gm, setPlaceMap, { campaignId, place: (await visitNow()).place!, assetId }));
}, 300_000);

afterAll(async () => {
  await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
  await tearDownWorld(world);
}, 60_000);

describe("the players' map, as the database sends it (P5)", () => {
  // Purpose: before anything of the jetty is shown, a player in the group reads no map, even one the GM has shared.
  it('sends nothing before the place is shown', async () => {
    await eye(true);
    expect(must(await world.playerA.db.rpc('map_for_players', { campaign: campaignId }))).toEqual([]);
    await eye(false);
  });

  // Purpose: once the jetty is shown, the harbour's map (which the jetty borrows from the Area it sits in) reaches the
  // group only while its eye is open: the copy's id and its title, and nothing else of the pack or the place.
  it('sends the shown place’s map only while its eye is open, and only its id and title', async () => {
    await showHere();
    expect(await raw(world.playerA)).toEqual([]);
    await eye(true);
    expect(await raw(world.playerA)).toEqual([{ group_number: 1, asset_id: assetId, title: CHART }]);
    expect(await loadPlayersMaps(asDb(world.playerA), campaignId)).toEqual(new Map([[1, { assetId, title: CHART }]]));
    const everything = JSON.stringify(await raw(world.playerA));
    for (const never of ['drowned-harbour', 'the-jetty', 'harbour-chart', CHART_ALT, 'p. 12', 'maps/']) expect(everything, never).not.toContain(never);
    await eye(false);
    expect(await raw(world.playerA)).toEqual([]);
  });

  // Purpose (mc-39b): the map stays through a move to a place not shown yet; at the wreck, once shown, it is the same
  // copy (one per campaign); at the salt flats, a place with no map, nothing.
  it('stays through a move to a place not shown, is the one copy at the next Location, and none where there is no map', async () => {
    await eye(true);
    await goTo('the-wreck', false);
    expect(await raw(world.playerA)).toEqual([{ group_number: 1, asset_id: assetId, title: CHART }]);
    await goTo('the-wreck', true);
    expect(await raw(world.playerA)).toEqual([{ group_number: 1, asset_id: assetId, title: CHART }]);
    await goTo('salt-flats', true);
    expect(await raw(world.playerA)).toEqual([]);
    await goTo('the-jetty', true);
    expect(await raw(world.playerA)).toEqual([{ group_number: 1, asset_id: assetId, title: CHART }]);
  });

  // Purpose: another group's map, shown to that group with its eye open, reaches that group's player and never player A,
  // whose own group reads only its own; group 1's map never reaches player B either.
  it("sends another group's shown map to that group only", async () => {
    await ok(as(world.gm, setPlace, { campaignId, group: 2, name: 'The Heron Weir' }));
    const weir = (await loadGroupPlaces(asDb(world.gm), campaignId, tripId))!.get(2)!.place!;
    await ok(as(world.gm, addPiece, { campaignId, placeId: weir.id, kind: 'description', text: 'A weir of woven willow.' }));
    const visit = (await loadGroupPlaces(asDb(world.gm), campaignId, tripId))!.get(2)!;
    await ok(as(world.gm, showPiece, { campaignId, row: visit, piece: visit.pieces[0]! }));
    const weirMap = await ok(as(world.gm, addPlaceMap, { campaignId, place: visit.place!, title: 'The Heron Weir, a sketch', image: new Blob(['a sketch'], { type: 'image/png' }) }));
    await ok(as(world.gm, setPlaceMap, { campaignId, place: (await loadGroupPlaces(asDb(world.gm), campaignId, tripId))!.get(2)!.place!, assetId: weirMap }));
    await ok(as(world.gm, shareMap, { campaignId, assetId: weirMap, shown: true }));
    // Player B's group reads its own map (the read works for them), and nothing of group 1's.
    expect(await raw(world.playerB)).toEqual([{ group_number: 2, asset_id: weirMap, title: 'The Heron Weir, a sketch' }]);
    // Player A's group reads its own (the harbour chart, eye open since the last test), never the weir's.
    expect(await raw(world.playerA)).toEqual([{ group_number: 1, asset_id: assetId, title: CHART }]);
    expect(JSON.stringify(await raw(world.playerA))).not.toContain('Heron');
    expect(await raw(world.outsider)).toEqual([]);
  });

  // Purpose: a campaign player A isn't in, with a place shown and its map's eye open, sends player A nothing when A names
  // it; its own player reads the map (so the read would send it to someone allowed).
  it('sends nothing about a campaign the player is not in', async () => {
    const other = must(await world.admin.from('campaigns').insert({ name: 'The Ash Barrows', created_by: world.gm.id }).select().single());
    const otherId = other.id as string;
    must(
      await world.admin
        .from('members')
        .insert([
          { campaign_id: otherId, user_id: world.gm.id, base_role: 'gm' },
          { campaign_id: otherId, user_id: world.playerB.id, base_role: 'player' },
        ])
        .select(),
    );
    must(await world.admin.from('actors').insert({ campaign_id: otherId, kind: 'pc', name: 'Moss of the Bog Lights', owner_type: 'user', owner_user_id: world.playerB.id, approval: 'approved', status: 'active', level: 1 }).select('id'));
    const trip = await ok(as(world.gm, startExpedition, { campaignId: otherId, mode: 'dungeon', place: 'The Salt Steps' }));
    const steps = (await loadGroupPlaces(asDb(world.gm), otherId, trip.id))!.get(1)!.place!;
    await ok(as(world.gm, addPiece, { campaignId: otherId, placeId: steps.id, kind: 'description', text: 'Steps cut in salt.' }));
    const visit = (await loadGroupPlaces(asDb(world.gm), otherId, trip.id))!.get(1)!;
    await ok(as(world.gm, showPiece, { campaignId: otherId, row: visit, piece: visit.pieces[0]! }));
    const stepsMap = await ok(as(world.gm, addPlaceMap, { campaignId: otherId, place: visit.place!, title: 'The Salt Steps, a sketch', image: new Blob(['a sketch'], { type: 'image/png' }) }));
    await ok(as(world.gm, setPlaceMap, { campaignId: otherId, place: (await loadGroupPlaces(asDb(world.gm), otherId, trip.id))!.get(1)!.place!, assetId: stepsMap }));
    await ok(as(world.gm, shareMap, { campaignId: otherId, assetId: stepsMap, shown: true }));
    expect(await raw(world.playerB, otherId)).toEqual([{ group_number: 1, asset_id: stepsMap, title: 'The Salt Steps, a sketch' }]);
    expect(await raw(world.playerA, otherId)).toEqual([]);
    expect(await raw(world.outsider, otherId)).toEqual([]);
    await world.admin.from('campaigns').delete().eq('id', otherId);
  });

  // Purpose: the eye opened or closed ticks each group's signal, so players' screens read again at once.
  it('ticks the groups’ signal when the eye changes', async () => {
    const [one, two] = [await tickOf(1), await tickOf(2)];
    await eye(false);
    expect(await tickOf(1)).toBeGreaterThan(one);
    expect(await tickOf(2)).toBeGreaterThan(two);
  });
});
