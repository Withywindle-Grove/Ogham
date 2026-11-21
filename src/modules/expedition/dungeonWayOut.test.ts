// Leave the dungeon's three cases (st-4, page 16 T6b): is the party at a way out, not at one, or can't the app tell?
// Invented fixtures only: a sunken chapel under a moor, its levels and rooms.
import { describe, expect, it } from 'vitest';
import type { Db } from '../../core/supabase.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import type { Route } from '../library/routes.ts';
import { dungeonOf, exitsOf, loadWayOut, wayOutOf } from './dungeonWayOut.ts';
import type { WayFromHere } from './moveOnWays.ts';
import type { ChainEntry } from './placeRules.ts';

/** The pack's places, by id: each with its type and the place it sits in. */
const PLACES: Record<string, { type: string; parentId?: string; data?: Record<string, unknown> }> = {
  moor: { type: 'region' },
  'moor-road': { type: 'area', parentId: 'moor' },
  chapel: { type: 'site', parentId: 'moor' },
  'chapel-yard': { type: 'area', parentId: 'chapel' },
  crypt: { type: 'floor', parentId: 'chapel' },
  'crypt-deep': { type: 'floor', parentId: 'crypt' },
  porch: { type: 'room', parentId: 'chapel-yard' },
  ossuary: { type: 'room', parentId: 'crypt' },
  vestry: { type: 'room', parentId: 'crypt' },
  well: { type: 'room', parentId: 'crypt-deep' },
};

/** The chain of a place as loadPlaceChain gives it: the place, then each place it sits in. */
function chain(id: string, data: Record<string, unknown> = {}): ChainEntry[] {
  const out: ChainEntry[] = [];
  let at: string | undefined = id;
  while (at && PLACES[at]) {
    const p: { type: string; parentId?: string } = PLACES[at]!;
    out.push({ packId: 'pack-chapel', entryId: at, name: at, data: { type: p.type, ...(p.parentId ? { parentId: p.parentId } : {}), ...(at === id ? data : {}) } });
    at = p.parentId;
  }
  return out;
}

/** Every place's chain, for the far ends. */
const chains = new Map(Object.keys(PLACES).map((id) => [id, chain(id)]));

/** A link leaving here to `to`. */
const way = (to: string): WayFromHere => ({ route: { id: `r-${to}`, from: 'here', to, hidden: false, oneWay: false, ways: [{ by: 'walk', name: '', value: 1, unit: 'turn' }] } as Route, farEnd: to, barrier: null });

const exits = (...list: unknown[]) => ({ playerView: { exits: list } });

/** The links the players' Scene would send (campaign_ways_on): here, every one given. */
const shownAll = (...ws: WayFromHere[]) => new Set(ws.map((w) => w.route.id));
const NONE_SHOWN = new Set<string>();

describe('what the dungeon is', () => {
  // Purpose: the dungeon is the site the place sits in, however many levels down the place is.
  it('is the nearest site in the chain, through nested levels', () => {
    expect(dungeonOf(chain('well'))).toBe('chapel');
    expect(dungeonOf(chain('ossuary'))).toBe('chapel');
    expect(dungeonOf(chain('chapel'))).toBe('chapel');
  });

  // Purpose: where the pack names no site, the dungeon is the outermost place that isn't a region.
  it('is the outermost place below the region when no site is named', () => {
    const untyped: ChainEntry[] = [
      { packId: 'p', entryId: 'cell', name: '', data: { parentId: 'level-2' } },
      { packId: 'p', entryId: 'level-2', name: '', data: { parentId: 'level-1' } },
      { packId: 'p', entryId: 'level-1', name: '', data: { parentId: 'fen', type: 'floor' } },
      { packId: 'p', entryId: 'fen', name: '', data: { type: 'Region' } },
    ];
    expect(dungeonOf(untyped)).toBe('level-1');
    expect(dungeonOf(untyped.slice(0, 2))).toBe('level-2');
  });
});

describe('the exits a place lists', () => {
  // Purpose: an exit with a `to` gives its far end; an exit of plain text, or with an empty `to`, is one the app can't place.
  it('splits exits into far ends and unlinked ones', () => {
    expect(exitsOf(exits({ text: 'Stair up', to: 'moor-road' }, 'Archway (east)', { text: 'Crack', to: ' ' }))).toEqual({ to: ['moor-road'], unlinked: 2 });
    expect(exitsOf({})).toEqual({ to: [], unlinked: 0 });
  });
});

describe('at a way out', () => {
  // Purpose: an exit whose far end is outside the dungeon makes the place a way out, and names where it leads.
  it('is AT when an exit leads outside the site', () => {
    const here = chain('porch', exits({ text: 'Lychgate', to: 'moor-road' }, { text: 'Door', to: 'chapel-yard' }));
    expect(wayOutOf(here, [], chains, NONE_SHOWN)).toEqual({ kind: 'at', leadsTo: ['moor-road'] });
  });

  // Purpose: a way (a route) from here, shown to the players, whose far end is outside the dungeon counts as a way out too.
  it('is AT when a shown way leads outside the site', () => {
    const ways = [way('chapel-yard'), way('moor-road')];
    expect(wayOutOf(chain('porch'), ways, chains, shownAll(...ways))).toEqual({ kind: 'at', leadsTo: ['moor-road'] });
  });

  // Purpose: levels nest, so outside means outside the whole site, not only the place's direct parent: a deep room
  // whose exit climbs to the level above is still inside.
  it('counts the whole site, not only the direct parent, in nested levels', () => {
    const deep = chain('well', exits({ text: 'Rope up', to: 'ossuary' }));
    expect(wayOutOf(deep, [], chains, NONE_SHOWN)).toEqual({ kind: 'not' });
    const shaft = chain('well', exits({ text: 'Long shaft', to: 'moor' }));
    expect(wayOutOf(shaft, [], chains, NONE_SHOWN)).toEqual({ kind: 'at', leadsTo: ['moor'] });
  });

  // Purpose: one exit out is enough, even beside an exit the app can't place.
  it('is AT when one exit leads out beside an unlinked one', () => {
    expect(wayOutOf(chain('porch', exits('Archway (east)', { text: 'Lychgate', to: 'moor-road' })), [], chains, NONE_SHOWN)).toEqual({ kind: 'at', leadsTo: ['moor-road'] });
  });
});

describe('hidden ways out (the lead, 2026-11-14: a way out counts only if it is shown to players)', () => {
  // Purpose: a way out the players' Scene would not send (hidden) doesn't make the spot a way out: the answer is NOT.
  it('is NOT when the only way out is hidden', () => {
    const ways = [way('vestry'), way('moor')];
    expect(wayOutOf(chain('ossuary'), ways, chains, shownAll(ways[0]!))).toEqual({ kind: 'not' });
  });

  // Purpose: the same way out, shown, makes it AT.
  it('is AT when the way out is shown', () => {
    const ways = [way('vestry'), way('moor')];
    expect(wayOutOf(chain('ossuary'), ways, chains, shownAll(...ways))).toEqual({ kind: 'at', leadsTo: ['moor'] });
  });

  // Purpose: a hidden way out beside a shown one gives AT, and names only the shown one, so nothing a later piece may
  // send to players names or implies the hidden way.
  it('is AT with a hidden and a shown way out, naming only the shown one', () => {
    const ways = [way('moor'), way('moor-road')];
    const answer = wayOutOf(chain('ossuary'), ways, chains, shownAll(ways[1]!));
    expect(answer).toEqual({ kind: 'at', leadsTo: ['moor-road'] });
    expect(JSON.stringify(answer)).not.toMatch(/"moor"/);
  });
});

describe('a Location the pack marks a way out (B10; p2p-22, p2p-31)', () => {
  // Purpose: where the pack marks the place itself `wayOut: true`, the party is AT a way out whatever its links say, as
  // Move on's End expedition row says there; a mark written as words, or on the site above it, changes nothing.
  it('is AT where the place carries the mark', () => {
    const ways = [way('vestry')];
    expect(wayOutOf(chain('ossuary', { wayOut: true }), ways, chains, shownAll(...ways))).toEqual({ kind: 'at', leadsTo: [] });
    expect(wayOutOf(chain('ossuary', { wayOut: true }), [], chains, NONE_SHOWN)).toEqual({ kind: 'at', leadsTo: [] });
    expect(wayOutOf(chain('ossuary', { wayOut: 'yes' }), ways, chains, shownAll(...ways))).toEqual({ kind: 'not' });
  });
});

describe('not at a way out', () => {
  // Purpose: a way whose far end is a sibling room of the same level is inside the dungeon: not a way out.
  it('is NOT when every way leads to a sibling room', () => {
    const ways = [way('vestry')];
    expect(wayOutOf(chain('ossuary'), ways, chains, shownAll(...ways))).toEqual({ kind: 'not' });
  });

  // Purpose: a place whose exits are all known and all lead to places in the site is not a way out.
  it('is NOT when every known exit stays inside', () => {
    const here = chain('ossuary', exits({ text: 'Low door', to: 'vestry' }, { text: 'Steps down', to: 'crypt-deep' }));
    const ways = [way('vestry')];
    expect(wayOutOf(here, ways, chains, shownAll(...ways))).toEqual({ kind: 'not' });
  });
});

describe('can’t tell', () => {
  // Purpose: a place made by hand has no pack data, so the app can't tell.
  it('can’t tell at a place made by hand', () => {
    expect(wayOutOf(null, [], chains, NONE_SHOWN)).toEqual({ kind: 'cantTell', why: 'handMade' });
  });

  // Purpose: a pack place with no exits and no ways gives the app nothing to go on.
  it('can’t tell at a pack place with no exits data', () => {
    expect(wayOutOf(chain('vestry'), [], chains, NONE_SHOWN)).toEqual({ kind: 'cantTell', why: 'noExits' });
    expect(wayOutOf([], [], chains, NONE_SHOWN)).toEqual({ kind: 'cantTell', why: 'noExits' });
  });

  // Purpose: an exit whose `to` names a place the pack doesn't have can't be placed, so the app can't tell.
  it('can’t tell when an exit leads to a place the pack doesn’t have', () => {
    expect(wayOutOf(chain('ossuary', exits({ text: 'Bricked arch', to: 'nowhere-known' }, { text: 'Low door', to: 'vestry' })), [], chains, NONE_SHOWN)).toEqual({ kind: 'cantTell', why: 'unknownExit' });
  });

  // Purpose: exits of plain text name no place, so with nothing else leading out the app can't tell.
  it('can’t tell when the exits are plain text only', () => {
    const ways = [way('vestry')];
    expect(wayOutOf(chain('ossuary', exits('Stairs up (north)')), ways, chains, shownAll(...ways))).toEqual({ kind: 'cantTell', why: 'unknownExit' });
  });
});

/** A campaign whose party stands at `at` (a pack place, or one made by hand), with the chapel's places and links. */
async function chapelWorld(at: string | null, hereData: Record<string, unknown> = {}, { hereShown = true, shaftHidden = true }: { hereShown?: boolean; shaftHidden?: boolean } = {}) {
  const world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, sam, 'player', world.addCharacter(campaign, 'Wren', { ownerId: sam }));
  world.tables.packs.push({ id: 'pack-chapel', owner_user_id: gm, campaign_id: null, name: 'Sunken Chapel', version: '0.1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-11-14T00:00:00Z', extra_meta: {} });
  world.tables.campaign_packs.push({ id: 'link-chapel', campaign_id: campaign, pack_id: 'pack-chapel', pack_name: 'Sunken Chapel', option_choices: {}, overrides: {}, priority: 1 });
  for (const [id, p] of Object.entries(PLACES)) {
    const data = { id, name: id, type: p.type, ...(p.parentId ? { parentId: p.parentId } : {}), ...(id === at ? hereData : {}) };
    world.tables.library_entries.push({ id: `entry-location-${id}`, pack_id: 'pack-chapel', kind: 'location', pack_entry_id: id, name: id, data });
  }
  world.tables.library_entries.push({ id: 'entry-route-porch-road', pack_id: 'pack-chapel', kind: 'route', pack_entry_id: 'porch-road', name: 'porch-road', data: { from: 'moor-road', to: 'porch', travel: { value: 1, unit: 'turn' } } });
  world.tables.library_entries.push({ id: 'entry-route-ossuary-vestry', pack_id: 'pack-chapel', kind: 'route', pack_entry_id: 'ossuary-vestry', name: 'ossuary-vestry', data: { from: 'ossuary', to: 'vestry', travel: { value: 1, unit: 'turn' } } });
  // A secret shaft from the ossuary up to the moor: hidden unless a test says otherwise.
  world.tables.library_entries.push({ id: 'entry-route-ossuary-shaft', pack_id: 'pack-chapel', kind: 'route', pack_entry_id: 'ossuary-shaft', name: 'ossuary-shaft', data: { from: 'ossuary', to: 'moor', hidden: shaftHidden, travel: { value: 2, unit: 'turn' } } });
  world.signInAs(gm);
  const started = await world.db.rpc('start_expedition', { campaign, mode_id: 'creep' });
  if (started.error) throw new Error(started.error.message);
  const expedition = String(world.tables.expeditions.find((x) => x.campaign_id === campaign)!.id);
  world.tables.places.push({
    id: 'place-here', campaign_id: campaign, name: at ?? 'A cellar we drew', description: '', version: 1, undone: false, created_by: gm, pack_id: at ? 'pack-chapel' : null, pack_entry_id: at, pack_type: null, pack_parent_id: null, pack_key: null,
    players_name: '', region_id: null, terrain_id: null, safety: null, town: {}, created_at: '2026-11-14T00:00:00Z', updated_at: '2026-11-14T00:00:00Z',
  });
  world.tables.group_places.push({ id: 'visit-here', campaign_id: campaign, expedition_id: expedition, group_number: 1, place_id: 'place-here', shown: true, created_at: '2026-11-14T00:01:00Z', undone: false, moved_on: false });
  // Something of here shown to the party (mc-28b: without it, the players' Scene sends no ways at all).
  if (hereShown) {
    world.tables.place_pieces.push({ id: 'piece-here', place_id: 'place-here', campaign_id: campaign, kind: 'description', body: 'Damp stone.', lead: '', position: 1, gm_value: '', gm_trigger: '', gm_stat_line: '', version: 1, undone: false, created_at: '2026-11-14T00:00:00Z', asset_id: null });
    world.tables.piece_shows.push({ id: 'show-here', campaign_id: campaign, group_place_id: 'visit-here', piece_id: 'piece-here', shown: true, shown_at: '2026-11-14T00:00:00Z', undone: false });
  }
  return { world, sam, campaign, expedition, db: world.db as unknown as Db };
}

describe('the GM’s read', () => {
  // Purpose: at the porch, whose route leads back to the moor road outside the chapel, the read says AT.
  it('reads AT at a pack place with a route out', async () => {
    const t = await chapelWorld('porch');
    expect(await loadWayOut(t.db, t.campaign, t.expedition)).toEqual({ kind: 'at', leadsTo: ['moor-road'] });
  });

  // Purpose: at the ossuary, whose shown route leads to the vestry beside it and whose only way out is a hidden
  // shaft, the read says NOT, and names nothing of the shaft.
  it('reads NOT at a pack place whose only way out is hidden', async () => {
    const t = await chapelWorld('ossuary');
    const read = await loadWayOut(t.db, t.campaign, t.expedition);
    expect(read).toEqual({ kind: 'not' });
    expect(JSON.stringify(read)).not.toMatch(/moor|shaft/);
  });

  // Purpose: the same shaft, not hidden, is a way out the players' Scene would send: the read says AT.
  it('reads AT when that way out is shown', async () => {
    const t = await chapelWorld('ossuary', {}, { shaftHidden: false });
    expect(await loadWayOut(t.db, t.campaign, t.expedition)).toEqual({ kind: 'at', leadsTo: ['moor'] });
  });

  // Purpose: until something of here has been shown, the players' Scene sends no ways at all (mc-28b), so a way out
  // doesn't count yet.
  it('reads NOT while nothing of here has been shown', async () => {
    const t = await chapelWorld('porch', {}, { hereShown: false });
    expect(await loadWayOut(t.db, t.campaign, t.expedition)).toEqual({ kind: 'not' });
  });

  // Purpose: an exit's `to` on the place's own entry is read through the pack, nested levels and all.
  it('reads an exit’s far end through the pack', async () => {
    const t = await chapelWorld('well', exits({ text: 'Long shaft', to: 'moor' }));
    expect(await loadWayOut(t.db, t.campaign, t.expedition)).toEqual({ kind: 'at', leadsTo: ['moor'] });
  });

  // Purpose: a place made by hand has no pack link, so the read says the app can't tell.
  it('reads CAN’T TELL at a place made by hand', async () => {
    const t = await chapelWorld(null);
    expect(await loadWayOut(t.db, t.campaign, t.expedition)).toEqual({ kind: 'cantTell', why: 'handMade' });
  });

  // Purpose: with the party at no place yet, the read says the app can't tell.
  it('reads CAN’T TELL with the party at no place', async () => {
    const t = await chapelWorld('porch');
    t.world.tables.group_places.length = 0;
    expect(await loadWayOut(t.db, t.campaign, t.expedition)).toEqual({ kind: 'cantTell', why: 'noPlace' });
  });

  // Purpose: a player's device reads nothing of the pack's places or links through this (they are the GM's), so no
  // place's id reaches it.
  it('gives a player no place of the pack', async () => {
    const t = await chapelWorld('porch');
    t.world.signInAs(t.sam);
    const read = await loadWayOut(t.db, t.campaign, t.expedition);
    expect(JSON.stringify(read ?? {})).not.toMatch(/moor|porch|chapel/);
  });
});
