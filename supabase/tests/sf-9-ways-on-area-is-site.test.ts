// "Where to?": an Area is the pack's `site`, a Location its `area` (Scene feedback sf-9, the read's fix; hard rule 5).
// Migration 20261127140000_sf_9_ways_on_area_is_site.sql; plan docs/plans/dec-scene-feedback.md, batch C1; p2p-1.
// The pack here is typed as a real pack is: Areas `site`, their places `area`, a room inside one of them `room`.
// On the read before this migration (20261126230000_sf_9_ways_on_number_elsewhere.sql, which named a container typed
// "area") the first test fails twice over: the mill's players' name is sent after a visit alone, and the fen's is not.
// CI's local database (or the TEST project); invented content. Each test's purpose is its first comment line.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRegistry } from '../../src/app/commandRegistry.ts';
import { runCommand, type CurrentUser } from '../../src/core/commands.ts';
import { loadCurrentUser } from '../../src/core/currentUser.ts';
import type { Db } from '../../src/core/supabase.ts';
import { placeFromPack } from '../../src/modules/expedition/placeFromPack.ts';
import { loadGroupPlaces, setPlace, showPiece } from '../../src/modules/expedition/placePlay.ts';
import { chooseGroup } from '../../src/modules/expedition/groupPlay.ts';
import { startExpedition } from '../../src/modules/expedition/play.ts';
import { attachPack, loadCampaignEntries } from '../../src/modules/library/campaignPacks.ts';
import { importPack } from '../../src/modules/library/library.ts';
import { readPackJson } from '../../src/modules/library/packFile.ts';
import { loadWaysOn } from '../../src/modules/library/waysOn.ts';
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

// The three Areas: each has its own name (the GM's) and a name for players.
const WEIR_GM_NAME = 'The Heron Weir';
const WEIR_PLAYERS_NAME = 'The old weir';
const FEN_GM_NAME = 'The Eel Fen';
const FEN_PLAYERS_NAME = 'The low fen';
const MARSH_GM_NAME = 'The Salt Marsh';
const MARSH_PLAYERS_NAME = 'The grey marsh';
// A Location with a room in it: the mill, and its loft.
const MILL_GM_NAME = 'The tide mill';
const MILL_PLAYERS_NAME = 'A leaning mill';
const FEN_ENTRY = { id: 'hw-fen', name: FEN_GM_NAME, type: 'site', playerView: { name: FEN_PLAYERS_NAME } };
// From 1, the sluice, in the weir: ways to the mill (2) and to its loft (2a), both in the weir; to the huts (6) and the
// stakes (7), in the fen; and to the creek (9), in the marsh, where nobody goes.
const weirPack = () => {
  const row = [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }];
  const read = readPackJson(
    JSON.stringify({
      format: 'tabletop-pack',
      formatVersion: 2,
      meta: { name: 'Heron Weir', version: '0.1', kind: 'adventure' },
      locations: [
        { id: 'hw-weir', name: WEIR_GM_NAME, type: 'site', playerView: { name: WEIR_PLAYERS_NAME } },
        FEN_ENTRY,
        { id: 'hw-marsh', name: MARSH_GM_NAME, type: 'site', playerView: { name: MARSH_PLAYERS_NAME } },
        { id: 'hw-sluice', name: 'The sluice gate', type: 'area', parentId: 'hw-weir', key: '1', playerView: { text: 'Brown water roars under the boards.' } },
        { id: 'hw-mill', name: MILL_GM_NAME, type: 'area', parentId: 'hw-weir', key: '2', playerView: { name: MILL_PLAYERS_NAME, text: 'The wheel hangs still.' } },
        { id: 'hw-loft', name: 'The mill loft', type: 'room', parentId: 'hw-mill', key: '2a' },
        { id: 'hw-huts', name: 'The eel huts', type: 'area', parentId: 'hw-fen', key: '6', playerView: { name: 'Three huts', text: 'Smoke, and nets on poles.' } },
        { id: 'hw-stakes', name: 'The eel stakes', type: 'area', parentId: 'hw-fen', key: '7', playerView: { name: 'A row of stakes' } },
        { id: 'hw-creek', name: 'The brine creek', type: 'area', parentId: 'hw-marsh', key: '9', playerView: { name: 'A narrow creek' } },
      ],
      routes: [
        { id: 'hw-route-sluice-mill', from: 'hw-sluice', to: 'hw-mill', type: 'river', hidden: false, oneWay: false, travel: row },
        { id: 'hw-route-sluice-loft', from: 'hw-sluice', to: 'hw-loft', type: 'river', hidden: false, oneWay: false, travel: row },
        { id: 'hw-route-sluice-huts', from: 'hw-sluice', to: 'hw-huts', type: 'river', hidden: false, oneWay: false, travel: row },
        { id: 'hw-route-sluice-stakes', from: 'hw-sluice', to: 'hw-stakes', type: 'river', hidden: false, oneWay: false, travel: row },
        { id: 'hw-route-sluice-creek', from: 'hw-sluice', to: 'hw-creek', type: 'river', hidden: false, oneWay: false, travel: row },
      ],
    }),
  );
  if (!read.ok) throw new Error(read.message);
  return read.pack;
};
/** What no answer may carry while nothing but the sluice has been shown: the pack's ids, every Area's own name, and both names of every Location not shown. */
const NEVER_SENT = ['hw-', 'parentId', WEIR_GM_NAME, FEN_GM_NAME, MARSH_GM_NAME, MARSH_PLAYERS_NAME, MILL_GM_NAME, 'The mill loft', 'The eel huts', 'Three huts', 'The eel stakes', 'A row of stakes', 'The brine creek', 'A narrow creek'];

type WayRow = { group_number: number; route_id: string; to_place_id: string | null; to_name: string | null; to_number: string | null; elsewhere: boolean; to_area_name: string | null; ways: unknown };

describe('the name sent on a visit alone is an Area’s, the pack’s `site`, never a Location’s (sf-9; hard rule 5)', () => {
  let campaign = '';
  let weir = '';
  let tripId = '';
  let mine = 0;
  let sluiceId = '';
  let millId = '';
  let hutsId = '';
  const route: Record<'mill' | 'loft' | 'huts' | 'stakes' | 'creek', string> = { mill: '', loft: '', huts: '', stakes: '', creek: '' };
  const ways = async (person: Person) => must(await person.db.rpc('campaign_ways_on', { campaign })) as WayRow[];
  /** The raw answer and the app's reading of it, as text, to search for words that may not be there. */
  const sentTo = async (person: Person) => JSON.stringify(await ways(person)) + JSON.stringify(await loadWaysOn(asDb(person), campaign));
  /** One route's row for player A's group, as a reader gets it, without the route's own id and its ways. */
  const rowOf = async (person: Person, routeId: string) => {
    const row = (await ways(person)).find((r) => r.route_id === routeId && r.group_number === mine);
    return row ? { place: row.to_place_id, name: row.to_name, number: row.to_number, elsewhere: row.elsewhere, area: row.to_area_name } : null;
  };
  const unexplored = (number: string, area: string | null) => ({ place: null, name: null, number, elsewhere: false, area });
  const rowIdOf = async (kind: string, entryId: string) =>
    must(await world.admin.from('library_entries').select('id').eq('pack_id', weir).eq('kind', kind).eq('pack_entry_id', entryId).single()).id as string;
  const placeOf = async (entryId: string) => {
    const entry = ((await loadCampaignEntries(asDb(world.gm), campaign)) ?? []).find((e) => e.kind === 'location' && e.packId === weir && e.packEntryId === entryId);
    if (!entry) throw new Error(`no location ${entryId}`);
    return (await ok(as(world.gm, placeFromPack, { campaignId: campaign, entry }))).id;
  };
  const groupOf = async (actorId: string) =>
    Number(must(await world.admin.from('party_group_members').select('group_number').eq('campaign_id', campaign).eq('actor_id', actorId).single()).group_number);
  const goTo = (placeId: string) => ok(as(world.gm, setPlace, { campaignId: campaign, group: mine, name: '', placeId }));
  const showFirstPiece = async () => {
    const visit = (await loadGroupPlaces(asDb(world.gm), campaign, tripId))!.get(mine)!;
    await ok(as(world.gm, showPiece, { campaignId: campaign, row: visit, piece: visit.pieces[0]! }));
  };

  beforeAll(async () => {
    world = await buildWorld();
    campaign = world.campaignId;
    weir = await ok(as(world.gm, importPack, { pack: weirPack() }));
    await ok(as(world.gm, attachPack, { campaignId: campaign, packId: weir }));
    for (const key of Object.keys(route) as (keyof typeof route)[]) route[key] = await rowIdOf('route', `hw-route-sluice-${key}`);
    sluiceId = await placeOf('hw-sluice');
    millId = await placeOf('hw-mill');
    hutsId = await placeOf('hw-huts');
    tripId = (await ok(as(world.gm, startExpedition, { campaignId: campaign, mode: 'dungeon', placeId: sluiceId }))).id;
    mine = await groupOf(world.wrenId);
    // Player B's character in a group of its own, which goes nowhere in these tests.
    if ((await groupOf(world.ashId)) === mine) {
      await ok(as(world.playerB, chooseGroup, { character: { id: world.ashId, campaignId: campaign, ownerUserId: world.playerB.id }, group: null }));
    }
    expect(await groupOf(world.ashId)).not.toBe(mine);
    // Player A's group is shown the sluice, then stands in the mill and at the huts, shown nothing of either, and
    // comes back: two visits alone, one to a Location with a room in it, one into a second Area.
    await showFirstPiece();
    await goTo(millId);
    await goTo(hutsId);
    await goTo(sluiceId);
  }, 300_000);

  afterAll(async () => {
    await world.admin.from('packs').delete().eq('owner_user_id', world.gm.id).is('campaign_id', null);
    await tearDownWorld(world);
  }, 60_000);

  it('after visits alone, a player is sent the visited Areas’ players’ names, and no Location’s name and no Area’s own', async () => {
    // Purpose: hard rule 5, on the leak reported on #122: having stood in a Location (the pack's "area") with nothing
    // of it shown, a player gets its room's number and NOT the Location's name, neither the GM's nor the players';
    // and a visited Area (the pack's "site") is named by its players' name, never its own. An Area nobody has been
    // to sends nothing at all: no number, no name, only that the way leads elsewhere.
    const rows = (await ways(world.playerA)).filter((r) => r.group_number === mine);
    expect(rows.map((r) => r.route_id).sort()).toEqual(Object.values(route).sort());
    // The loft sits in the mill, a Location the group has stood in: its number, and no name over it.
    expect(await rowOf(world.playerA, route.loft)).toEqual(unexplored('2a', null));
    // The mill itself, visited and not shown: its number, no name of its own; it stands under the weir's players' name.
    expect(await rowOf(world.playerA, route.mill)).toEqual(unexplored('2', WEIR_PLAYERS_NAME));
    // The fen is a visited Area: its players' name over both its places, the one stood at and the one not.
    expect(await rowOf(world.playerA, route.huts)).toEqual(unexplored('6', FEN_PLAYERS_NAME));
    expect(await rowOf(world.playerA, route.stakes)).toEqual(unexplored('7', FEN_PLAYERS_NAME));
    // The marsh: nobody has been there.
    expect(await rowOf(world.playerA, route.creek)).toEqual({ place: null, name: null, number: null, elsewhere: true, area: null });
    // Nothing else: every name any row carries is one of the two visited Areas' players' names.
    expect(rows.every((r) => r.to_place_id === null && r.to_name === null)).toBe(true);
    expect([...new Set(rows.map((r) => r.to_area_name).filter((n) => n !== null))].sort()).toEqual([FEN_PLAYERS_NAME, WEIR_PLAYERS_NAME].sort());
    const raw = await sentTo(world.playerA);
    for (const word of [...NEVER_SENT, MILL_PLAYERS_NAME, millId, hutsId]) expect(raw, word).not.toContain(word);
    expect(JSON.stringify(rows)).not.toContain('"to_number":"9"');
    // The app's reader says the same in its own shape.
    expect((await loadWaysOn(asDb(world.playerA), campaign))?.find((w) => w.routeId === route.loft && w.groupNumber === mine)).toEqual({ groupNumber: mine, routeId: route.loft, to: null, number: '2a', elsewhere: false, areaName: null, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }] });
  });

  it('the GM’s answer is as narrow, and a group that made no visit gets none of it', async () => {
    // Purpose: the function sends the GM the same rows, with no Location's name and no Area's own name either; and
    // what player A's group earned by its visits reaches no other group's player.
    const raw = await sentTo(world.gm);
    for (const word of [...NEVER_SENT, MILL_PLAYERS_NAME]) expect(raw, word).not.toContain(word);
    const theirs = await sentTo(world.playerB);
    for (const word of [...NEVER_SENT, MILL_PLAYERS_NAME, FEN_PLAYERS_NAME]) expect(theirs, word).not.toContain(word);
    expect((await ways(world.playerB)).every((r) => r.group_number !== mine)).toBe(true);
    expect(await ways(world.outsider)).toEqual([]);
  });

  it('an Area whose `type` the pack files among its GM-only fields is not named on a visit', async () => {
    // Purpose: when in doubt, send less: the Area's type is read from the part of the entry every reader reads. Hidden,
    // the fen is not plainly an Area: its places keep their numbers (the visit stands) and its name is not sent.
    const fen = await rowIdOf('location', 'hw-fen');
    must(await world.gm.db.from('library_entries').update({ data: { ...FEN_ENTRY, gmOnly: ['type'] } }).eq('id', fen).select('id'));
    expect(await rowOf(world.playerA, route.stakes)).toEqual(unexplored('7', null));
    expect(await sentTo(world.playerA)).not.toContain(FEN_PLAYERS_NAME);
    must(await world.gm.db.from('library_entries').update({ data: FEN_ENTRY }).eq('id', fen).select('id'));
    expect(await rowOf(world.playerA, route.stakes)).toEqual(unexplored('7', FEN_PLAYERS_NAME));
  });

  it('a Location with a room in it is named over the room’s row once the group has explored it', async () => {
    // Purpose: the other half of the rule, unchanged by the fix: a place that is no Area is named by its players'
    // name once a piece of it has been shown to the group (never by the GM's name), and to that group only.
    await goTo(millId);
    await showFirstPiece();
    await goTo(sluiceId);
    expect(await rowOf(world.playerA, route.loft)).toEqual(unexplored('2a', MILL_PLAYERS_NAME));
    expect(await rowOf(world.playerA, route.mill)).toEqual({ place: millId, name: MILL_PLAYERS_NAME, number: '2', elsewhere: false, area: WEIR_PLAYERS_NAME });
    const raw = await sentTo(world.playerA);
    for (const word of NEVER_SENT) expect(raw, word).not.toContain(word);
    expect(await sentTo(world.playerB)).not.toContain(MILL_PLAYERS_NAME);
  });
});
