// Move on's wiring, its data and rules (piece 5b-0; dec-4 pieces b and d; pt-f2, pt-f3): the ways from here, what
// players know of each far end, each way's time in turns, the split party's refusal, and the GM's read through the
// stand-in database. Invented places, links and people only.
import { describe, expect, it } from 'vitest';
import type { Db } from '../../core/supabase.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import type { Barrier, Route } from '../library/routes.ts';
import { timeUnits } from './clock.ts';
import { FALLBACK_MODES, pointToPoint } from './modes.ts';
import { destinationsOf, loadMoveOn, moveBlocked, moveTime, shownOf, SPLIT_PARTY_WORDS, stepUnitHere, stepUnitOfWays, wayMoveOf, waysFrom, type MoveOnRead } from './moveOnWays.ts';

const route = (id: string, from: string, to: string, extra: Partial<Route> = {}): Route => ({ id, from, to, hidden: false, oneWay: false, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }], ...extra });
const plain = (r: Route) => ({ route: r, barrier: null as Barrier | null });

describe('the ways from here', () => {
  // Purpose: a link from here leads to its far end, a link to here leads back to its start, and a one-way link to here
  // is not a way on (pt-f3).
  it('lists a link from either end, a one-way link only from its start', () => {
    const ways = waysFrom([plain(route('a', 'jetty', 'islet')), plain(route('b', 'cave', 'jetty')), plain(route('c', 'sluice', 'jetty', { oneWay: true })), plain(route('d', 'islet', 'cave'))], 'jetty');
    expect(ways.map((w) => [w.route.id, w.farEnd])).toEqual([
      ['a', 'islet'],
      ['b', 'cave'],
    ]);
  });

  // Purpose: a link that gives no time has no way to tap, and a link from a place to itself goes nowhere: neither is listed.
  it('leaves out a link with no time and a link to itself', () => {
    expect(waysFrom([plain(route('a', 'jetty', 'islet', { ways: [] })), plain(route('b', 'jetty', 'jetty'))], 'jetty')).toEqual([]);
  });

  // Purpose: the GM's line under a destination says "hidden" for a hidden link whatever was shown, else whether a piece
  // of the far end has been shown to the players.
  it('marks a hidden link hidden, else shown or not yet shown', () => {
    expect(shownOf(true, true)).toBe('hidden');
    expect(shownOf(false, true)).toBe('shown');
    expect(shownOf(false, false)).toBe('unshown');
  });
});

// Point to point (plan scene-point-to-point, piece B8; p2p-6, ruled 2026-11-18): one step is one unit of the ways
// leaving the party's place.
describe('the unit of a step in point to point (p2p-6)', () => {
  const way = (by: string, value: number, unit: string) => ({ by, name: by, value, unit });

  // Purpose: where every way leaving the place is timed in the same unit, that unit is the step's, however many ways
  // and links there are and whatever their amounts.
  it('is the unit the place’s ways share', () => {
    expect(stepUnitOfWays([way('row', 1, 'turn'), way('swim', 3, 'turn')])).toBe('turn');
    expect(stepUnitOfWays([way('sail', 2, 'hour'), way('ride', 5, 'Hour ')])).toBe('hour');
    const links = waysFrom([plain(route('a', 'jetty', 'islet', { ways: [way('sail', 1, 'day')] })), plain(route('b', 'cave', 'jetty', { ways: [way('ride', 2, 'day'), way('walk', 4, 'day')] }))], 'jetty');
    expect(stepUnitHere({ ways: links })).toBe('day');
  });

  // Purpose: where the place's ways are timed in different units, or it has no way on at all, the step is the
  // campaign's turn, the unit Move on counts every way in (not ruled: the builder's stand-in until it is).
  it('is a turn where the ways disagree or there are none', () => {
    expect(stepUnitOfWays([way('row', 1, 'turn'), way('walk', 1, 'hour')])).toBe('turn');
    expect(stepUnitOfWays([way('sail', 1, 'day'), way('walk', 6, 'hour')])).toBe('turn');
    expect(stepUnitOfWays([])).toBe('turn');
    expect(stepUnitHere({ ways: [] })).toBe('turn');
  });

  // Purpose: a way whose unit is blank says nothing about the unit: the other ways decide, and where every way's unit
  // is blank the step is a turn, as with no way at all.
  it('passes over a way with a blank unit', () => {
    expect(stepUnitOfWays([way('drift', 1, ''), way('sail', 2, 'hour')])).toBe('hour');
    expect(stepUnitOfWays([way('drift', 1, '   '), way('sail', 2, 'hour'), way('ride', 1, 'hour')])).toBe('hour');
    expect(stepUnitOfWays([way('drift', 1, ''), way('float', 4, '  ')])).toBe('turn');
  });

  // Purpose: the unit doesn't depend on how long a way takes: a way that takes no time (0) and a very long one (999)
  // give their unit like any other, and still disagree with a way timed in another unit.
  it('reads the unit whatever the way’s amount, 0 and 999 included', () => {
    expect(stepUnitOfWays([way('step', 0, 'hour')])).toBe('hour');
    expect(stepUnitOfWays([way('voyage', 999, 'day')])).toBe('day');
    expect(stepUnitOfWays([way('step', 0, 'hour'), way('voyage', 999, 'hour')])).toBe('hour');
    expect(stepUnitOfWays([way('step', 0, 'hour'), way('voyage', 999, 'day')])).toBe('turn');
    const links = waysFrom([plain(route('a', 'jetty', 'islet', { ways: [way('step', 0, 'day')] })), plain(route('b', 'jetty', 'cave', { ways: [way('voyage', 999, 'day')] }))], 'jetty');
    expect(stepUnitHere({ ways: links })).toBe('day');
  });

  // Purpose: the unit read from the ways is the unit of the mode's step, so Next turn moves the clock by it.
  it('makes point to point’s step', () => {
    const links = waysFrom([plain(route('a', 'jetty', 'islet', { ways: [way('sail', 2, 'hour')] }))], 'jetty');
    expect(pointToPoint(FALLBACK_MODES, stepUnitHere({ ways: links })).step).toEqual({ value: 1, unit: 'hour' });
  });
});

describe('a way’s time in the campaign’s turns', () => {
  const units = timeUnits({ roundSeconds: 10, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 });

  // Purpose: a way counted in turns keeps its turns, and an obstacle's extra turns are added (the database takes the
  // move as whole turns and the same in seconds).
  it('adds an obstacle’s extra turns', () => {
    expect(moveTime({ value: 2, unit: 'turn' }, 2, units)).toEqual({ turns: 4, seconds: 2400 });
  });

  // Purpose: a way counted in hours becomes turns at the campaign's turn length (an hour is 6 ten-minute turns).
  it('turns an hour into turns', () => {
    expect(moveTime({ value: 1, unit: 'hour' }, 0, units)).toEqual({ turns: 6, seconds: 3600 });
  });

  // Purpose: a way that takes no time, or a time that isn't whole turns, is refused in words, never sent.
  it('refuses no time and part of a turn', () => {
    expect(moveTime({ value: 0, unit: 'turn' }, 0, units)).toEqual({ refusal: expect.stringMatching(/at least 1 turn/) });
    expect(moveTime({ value: 3, unit: 'round' }, 0, units)).toEqual({ refusal: expect.stringMatching(/whole number of turns/) });
  });
});

describe('a split party', () => {
  // Purpose: while the party is in two groups, Move on gives the ruled refusal (pt-f3 point 3) for its pop-up; one
  // group moves.
  it('is refused with the ruled words; one group goes', () => {
    expect(moveBlocked(2)).toBe(SPLIT_PARTY_WORDS);
    expect(SPLIT_PARTY_WORDS).toBe('Join the party up first: for now a move between linked places takes the whole party.');
    expect(moveBlocked(1)).toBeNull();
  });
});

/** A campaign at the Jetty of an invented adventure pack, its links, and a GM (Priya) and a player (Sam). */
async function mere({ jettyShown = true }: { jettyShown?: boolean } = {}) {
  const world = createFakeDb();
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, sam, 'player', world.addCharacter(campaign, 'Wren', { ownerId: sam }));
  world.tables.packs.push({ id: 'pack-mere', owner_user_id: gm, campaign_id: null, name: 'Mere Tower', version: '0.1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-11-14T00:00:00Z', extra_meta: {} });
  world.tables.campaign_packs.push({ id: 'link-mere', campaign_id: campaign, pack_id: 'pack-mere', pack_name: 'Mere Tower', option_choices: {}, overrides: {}, priority: 1 });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${kind}-${id}`, pack_id: 'pack-mere', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('location', 'jetty', 'The Jetty', { key: '1' });
  entry('location', 'islet', 'The Islet', { key: '2' });
  entry('location', 'cave', 'The Sea Cave', { key: '3' });
  entry('location', 'weir', 'The Weir', { key: '4', encounterCheck: { name: 'Eel check', chance: { die: 'd6', on: [1, 2] } } });
  entry('location', 'tower', 'The Tower', { key: '5' });
  entry('route', 'jetty-islet', 'jetty-islet', { from: 'jetty', to: 'islet', travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: 'swim', name: 'Swimming', value: 3, unit: 'turn' }] });
  entry('route', 'cave-jetty', 'cave-jetty', { from: 'cave', to: 'jetty', travel: { value: 2, unit: 'turn' }, barrier: { name: 'the weir’s gap', extraTurns: 2, needsApproval: true, through: 'weir', note: 'Only at slack water.' } });
  entry('route', 'jetty-tower', 'jetty-tower', { from: 'jetty', to: 'tower', hidden: true, travel: { value: 1, unit: 'turn' } });
  entry('route', 'tower-jetty-back', 'tower-jetty-back', { from: 'islet', to: 'jetty', oneWay: true, travel: { value: 1, unit: 'turn' } });
  world.signInAs(gm);
  const started = await world.db.rpc('start_expedition', { campaign, mode_id: 'creep' });
  if (started.error) throw new Error(started.error.message);
  const expedition = String(world.tables.expeditions.find((x) => x.campaign_id === campaign)!.id);
  const place = (id: string, entryId: string, name: string) =>
    world.tables.places.push({
      id, campaign_id: campaign, name, description: '', version: 1, undone: false, created_by: gm, pack_id: 'pack-mere', pack_entry_id: entryId, pack_type: null, pack_parent_id: null, pack_key: null,
      players_name: '', region_id: null, terrain_id: null, safety: null, town: {}, created_at: '2026-11-14T00:00:00Z', updated_at: '2026-11-14T00:00:00Z',
    });
  place('place-jetty', 'jetty', 'The Jetty');
  place('place-islet', 'islet', 'The Islet');
  const visit = (id: string, placeId: string, group: number, movedOn = false) =>
    world.tables.group_places.push({ id, campaign_id: campaign, expedition_id: expedition, group_number: group, place_id: placeId, shown: true, created_at: `2026-11-14T00:0${world.tables.group_places.length}:00Z`, undone: false, moved_on: movedOn });
  // The party was at the Islet, where a piece was shown, and is at the Jetty now.
  visit('visit-islet', 'place-islet', 1, true);
  world.tables.place_pieces.push({ id: 'piece-islet', place_id: 'place-islet', campaign_id: campaign, kind: 'description', body: 'Reeds and a cold firepit.', lead: '', position: 1, gm_value: '', gm_trigger: '', gm_stat_line: '', version: 1, undone: false, created_at: '2026-11-14T00:00:00Z', asset_id: null });
  world.tables.piece_shows.push({ id: 'show-islet', campaign_id: campaign, group_place_id: 'visit-islet', piece_id: 'piece-islet', shown: true, shown_at: '2026-11-14T00:00:00Z', undone: false });
  visit('visit-jetty', 'place-jetty', 1);
  // Something of the Jetty has been shown to the party here (mc-28b: without it, players get no ways at all).
  if (jettyShown) {
    world.tables.place_pieces.push({ id: 'piece-jetty', place_id: 'place-jetty', campaign_id: campaign, kind: 'description', body: 'Tarred posts and a bell.', lead: '', position: 1, gm_value: '', gm_trigger: '', gm_stat_line: '', version: 1, undone: false, created_at: '2026-11-14T00:00:00Z', asset_id: null });
    world.tables.piece_shows.push({ id: 'show-jetty', campaign_id: campaign, group_place_id: 'visit-jetty', piece_id: 'piece-jetty', shown: true, shown_at: '2026-11-14T00:00:00Z', undone: false });
  }
  return { world, gm, sam, campaign, expedition, visit };
}

describe('the GM’s read', () => {
  // Purpose: the GM reads the ways from where the party is, each far end with its name and number, whether the
  // campaign has made it and whether it was shown; a hidden link is marked and a one-way link to here is left out.
  it('reads the ways on, their far ends and what players know', async () => {
    const t = await mere();
    const read = (await loadMoveOn(t.world.db as unknown as Db, t.campaign, t.expedition)) as MoveOnRead;
    expect(read.here).toEqual({ placeId: 'place-jetty', packId: 'pack-mere', entryId: 'jetty', name: 'The Jetty' });
    expect(read.groups).toBe(1);
    const rows = destinationsOf(read);
    expect(rows.map((r) => [r.number, r.name, r.shown])).toEqual([
      ['2', 'The Islet', 'shown'],
      ['3', 'The Sea Cave', 'unshown'],
      ['5', 'The Tower', 'hidden'],
    ]);
    expect(rows[0]!.ways.map((w) => [w.word, w.time])).toEqual([
      ['Rowing', '1 turn'],
      ['Swimming', '3 turns'],
    ]);
    // A link that names no way says Move on its button; its obstacle is the row's warning.
    expect(rows[1]!.ways.map((w) => w.word)).toEqual(['Move']);
    expect(rows[1]!.obstacle).toBe('An obstacle, the weir’s gap: 2 turns more; you decide.');
    // Not made yet: the move makes it from the pack first.
    expect(read.farEnds.get('cave')!.placeId).toBeNull();
    expect(read.farEnds.get('islet')!.placeId).toBe('place-islet');
  });

  // Purpose (Q1, F1 a): the GM's "Where to?" rows are in the Locations' order: a far end with no map number first, in
  // the pack's order of its links, then by number as numbers (0 before 2, 2 before 10).
  it('orders the GM’s rows by map number, those with none first', async () => {
    const t = await mere();
    const read = (await loadMoveOn(t.world.db as unknown as Db, t.campaign, t.expedition)) as MoveOnRead;
    read.farEnds.get('islet')!.number = '10';
    read.farEnds.get('cave')!.number = null;
    read.farEnds.get('tower')!.number = '0';
    expect(destinationsOf(read).map((r) => [r.number, r.name])).toEqual([
      [null, 'The Sea Cave'],
      ['0', 'The Tower'],
      ['10', 'The Islet'],
    ]);
  });

  // Purpose (B16; pf-25): each way's button is given the way's short id, which its picture is read from, and the icon
  // the pack names where it names one; a link that names no way has no id and no icon.
  it('passes each way’s short id, and the icon its pack names, to its button', async () => {
    const t = await mere();
    const read = (await loadMoveOn(t.world.db as unknown as Db, t.campaign, t.expedition)) as MoveOnRead;
    expect(destinationsOf(read)[0]!.ways.map((w) => [w.by, 'icon' in w])).toEqual([['row', false], ['swim', false]]);
    expect(destinationsOf(read)[1]!.ways.map((w) => [w.by, 'icon' in w])).toEqual([['', false]]);
    read.ways.find((w) => w.farEnd === 'islet')!.route.ways[1]!.icon = 'water-splash';
    expect(destinationsOf(read)[0]!.ways.map((w) => [w.by, w.icon])).toEqual([['row', undefined], ['swim', 'water-splash']]);
  });

  // Purpose: a way's step says how long with the obstacle, and the check after it with the chance of the place the
  // crossing passes, which has its own check (frame 13). Its title is the way's word and where to, numbered as the map's
  // key has it ("Row to 1. The Jetty", page 24 WY1a), so there is no Where line; a link that names no way says Move.
  it('words a way’s step, the passing place’s chance in its Then line', async () => {
    const t = await mere();
    const read = (await loadMoveOn(t.world.db as unknown as Db, t.campaign, t.expedition)) as MoveOnRead;
    const key = destinationsOf(read)[1]!.ways[0]!.key;
    const move = wayMoveOf(read, 'cave', key, { name: 'Lurkers', chance: { die: 'd6', on: [1] } });
    expect(move.title).toBe('Move to 3. The Sea Cave');
    expect('where' in move).toBe(false);
    expect(wayMoveOf(read, 'islet', destinationsOf(read)[0]!.ways[0]!.key, null).title).toBe('Rowing to 2. The Islet');
    expect(move.takes).toBe('2 turns, and 2 more for the obstacle: 4 turns.');
    expect(move.then).toBe('Lurkers, with the Weir’s chance: 2 in 6.');
    expect(move.obstacle).toEqual({ name: 'the weir’s gap', extra: '2 turns more.', note: 'Only at slack water.', needsApproval: true });
  });

  // Purpose (B10; p2p-22, p2p-31): the read says whether the pack marks the place the party is at a way out, so Move
  // on's list ends with End expedition only there; only a plain true on that Location counts.
  it('reads the way-out mark on the place the party is at', async () => {
    const t = await mere();
    const db = t.world.db as unknown as Db;
    expect(((await loadMoveOn(db, t.campaign, t.expedition)) as MoveOnRead).wayOut).toBe(false);
    const jetty = t.world.tables.library_entries.find((e) => e.pack_entry_id === 'jetty')!;
    jetty.data = { ...(jetty.data as Record<string, unknown>), wayOut: 'yes' };
    expect(((await loadMoveOn(db, t.campaign, t.expedition)) as MoveOnRead).wayOut).toBe(false);
    jetty.data = { ...(jetty.data as Record<string, unknown>), wayOut: true };
    expect(((await loadMoveOn(db, t.campaign, t.expedition)) as MoveOnRead).wayOut).toBe(true);
  });

  // Purpose: while nothing of the place the party is in has been shown, players get no ways at all (mc-28b), so no
  // GM row may say the players know a far end, even one shown on an earlier visit.
  it('says no far end is shown while nothing of here has been shown', async () => {
    const t = await mere({ jettyShown: false });
    const read = (await loadMoveOn(t.world.db as unknown as Db, t.campaign, t.expedition)) as MoveOnRead;
    expect(destinationsOf(read).map((r) => r.shown)).toEqual(['unshown', 'unshown', 'hidden']);
  });

  // Purpose: a piece shown during an expedition that was later undone doesn't count, as campaign_ways_on has it.
  it('doesn’t count a far end shown only in an undone expedition', async () => {
    const t = await mere();
    t.world.tables.expeditions.push({ ...t.world.tables.expeditions.find((x) => x.id === t.expedition)!, id: 'expedition-undone', undone: true });
    const islet = t.world.tables.group_places.find((g) => g.id === 'visit-islet')!;
    islet.expedition_id = 'expedition-undone';
    const read = (await loadMoveOn(t.world.db as unknown as Db, t.campaign, t.expedition)) as MoveOnRead;
    expect(destinationsOf(read)[0]!.shown).toBe('unshown');
  });

  // Purpose: the read counts the party's groups, so Move on knows the party is split before it sends anything.
  it('counts a split party’s groups', async () => {
    const t = await mere();
    t.visit('visit-g2', 'place-islet', 2);
    const read = (await loadMoveOn(t.world.db as unknown as Db, t.campaign, t.expedition)) as MoveOnRead;
    expect(read.groups).toBe(2);
    expect(moveBlocked(read.groups)).toBe(SPLIT_PARTY_WORDS);
  });

  // Purpose: a player's device gets no ways from this read: routes are the GM's (pt-f3), so the far ends and the
  // obstacle's note never reach it.
  it('gives a player nothing of the routes', async () => {
    const t = await mere();
    t.world.signInAs(t.sam);
    const read = await loadMoveOn(t.world.db as unknown as Db, t.campaign, t.expedition);
    expect(read === null || read.ways.length === 0).toBe(true);
    expect(JSON.stringify(read ?? {})).not.toMatch(/slack water|weir’s gap|The Tower/);
  });
});
