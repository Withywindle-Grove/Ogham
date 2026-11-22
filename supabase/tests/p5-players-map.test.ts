// The players' map (plan dec-9-the-players-scene, P5; supabase/migrations/20261122100000_p5_players_map.sql; mc-37,
// mc-39b, dp-3; Francis's yes "1a", 2026-11-22; hard rule 5). Tested on what the DATABASE sends a player, never on what
// a screen draws. TEST project or CI's local database; invented packs, places and words only. What it checks, in plain
// words:
//   * before anything of the place is shown, a player in the group reads no map, even one the GM has shared;
//   * once shown, the map of the place (here the Area's, borrowed by the Location inside it) reaches the group only while
//     its eye is open: its copy's id and its title, never a place id, a pack entry or the map entry's words;
//   * it stays through a move to a place not shown yet (the last place shown, mc-39b), and at another Location of the
//     same Area once shown (the one copy the campaign holds); at a place with no map, nothing;
//   * a player in another group, someone outside the campaign, and a player asking about another campaign read nothing;
//   * the eye opened or closed ticks the group's signal, so screens read again.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { addPlaceMap, loadPlayersMaps, setPlaceMap, shareMap } from '../../src/modules/expedition/placeMap.ts';
import { loadGroupPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
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

  // Purpose: nobody else reads group 1's map through this read: a player in another group, someone outside the campaign,
  // and a player naming a campaign they aren't in.
  it('sends nothing to another group, an outsider or about another campaign', async () => {
    expect(await raw(world.playerB)).toEqual([]);
    expect(await raw(world.outsider)).toEqual([]);
    const elsewhere = must(await world.admin.from('campaigns').insert({ name: 'The Ash Barrows', created_by: world.gm.id }).select().single());
    expect(await raw(world.playerA, elsewhere.id as string)).toEqual([]);
    await world.admin.from('campaigns').delete().eq('id', elsewhere.id as string);
  });

  // Purpose: the eye opened or closed ticks each group's signal, so players' screens read again at once.
  it('ticks the groups’ signal when the eye changes', async () => {
    const [one, two] = [await tickOf(1), await tickOf(2)];
    await eye(false);
    expect(await tickOf(1)).toBeGreaterThan(one);
    expect(await tickOf(2)).toBeGreaterThan(two);
  });
});
