// An adventure pack's `routes` are kept on import as a GM-only kind, `route`, and read with either shape of `travel`
// (December step 4, piece a; docs/plans/dec-4-point-travel.md; ruled pt-f1 and pt-f3, 2026-11-11). Invented packs only.
import { describe, expect, it } from 'vitest';
import { BRAND } from '../../brand.ts';
import { createFakeDb } from '../../testing/fakeDb.ts';
import { packFile } from './exportPack.ts';
import { comparePacks, PLAYER_FACING, readPackJson } from './packFile.ts';
import { readBarrier, readRoute, ROUTE_UNITS, routeWays } from './routes.ts';

const jettyIslet = {
  id: 'mt-jetty-islet', from: 'mt-jetty', to: 'mt-islet', type: 'river', hidden: false, oneWay: false,
  travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: 'swim', name: 'Swimming', value: 3, unit: 'turn' }],
};
const isletSluice = { id: 'mt-islet-sluice', from: 'mt-islet', to: 'mt-sluice', type: 'secret', hidden: true, oneWay: true, travel: { value: 2, unit: 'turn' }, notes: 'Floods at high tide.' };

const adventure = (routes: unknown[] = [jettyIslet, isletSluice]) =>
  JSON.stringify({
    format: 'tabletop-pack',
    meta: { name: 'Mire Tower', version: '0.1', kind: 'adventure' },
    locations: [{ id: 'mt-jetty', name: 'The jetty' }, { id: 'mt-islet', name: 'The reed islet' }, { id: 'mt-sluice', name: 'The sluice' }],
    routes,
  });

const read = (text: string) => {
  const result = readPackJson(text);
  if (!result.ok) throw new Error(result.message);
  return result.pack;
};

describe('importing an adventure pack’s routes', () => {
  // Purpose: routes import as entries of kind route, kept whole, without the "isn't a part" note.
  it('imports them as route entries, kept whole, with no "isn\'t a part" note', () => {
    const pack = read(adventure());
    expect(pack.warnings).not.toContain(`"routes" isn't a part ${BRAND.appName} knows; it was left out.`);
    expect(pack.entries.filter((e) => e.kind === 'route')).toEqual([
      { kind: 'route', packEntryId: 'mt-jetty-islet', name: 'mt-jetty-islet', data: jettyIslet },
      { kind: 'route', packEntryId: 'mt-islet-sluice', name: 'mt-islet-sluice', data: isletSluice },
    ]);
    expect(pack.counts.route).toBe(2);
  });

  // Purpose: both shapes of travel read: a list gives each way with its own time; one amount gives one unnamed way.
  it('reads both shapes of travel, and the hidden and one-way flags', () => {
    const [list, one] = read(adventure()).entries.filter((e) => e.kind === 'route').map((e) => readRoute(e.packEntryId, e.data));
    expect(list).toEqual({ id: 'mt-jetty-islet', from: 'mt-jetty', to: 'mt-islet', hidden: false, oneWay: false, ways: [{ by: 'row', name: 'Rowing', value: 1, unit: 'turn' }, { by: 'swim', name: 'Swimming', value: 3, unit: 'turn' }] });
    expect(one).toEqual({ id: 'mt-islet-sluice', from: 'mt-islet', to: 'mt-sluice', hidden: true, oneWay: true, ways: [{ by: '', name: '', value: 2, unit: 'turn' }] });
  });

  // Purpose: the reader never guesses: a way without an id or a whole-number time is left out, a repeated way keeps
  // its first, a way without a name shows its id, and a route without both places isn't a route.
  it('leaves out what it can’t read, and never guesses', () => {
    expect(routeWays([{ by: 'row', value: 1, unit: 'turn' }, { by: 'row', name: 'Again', value: 2, unit: 'turn' }, { name: 'Wading', value: 2, unit: 'turn' }, { by: 'swim', value: 1.5, unit: 'turn' }, { by: 'fly', value: 1 }, 'walk'])).toEqual([
      { by: 'row', name: 'row', value: 1, unit: 'turn' },
    ]);
    expect(routeWays(undefined)).toEqual([]);
    expect(routeWays({ value: -1, unit: 'turn' })).toEqual([]);
    expect(routeWays({ value: 0, unit: 'turn' })).toEqual([{ by: '', name: '', value: 0, unit: 'turn' }]);
    // Only the clock's units (the list pack:check uses; review of #634): a league or a made-up unit is no time.
    expect(ROUTE_UNITS).toEqual(['round', 'turn', 'hour', 'day', 'week']);
    expect(routeWays({ value: 2, unit: 'league' })).toEqual([]);
    expect(routeWays([{ by: 'row', value: 1, unit: 'turns' }, { by: 'swim', value: 3, unit: 'hour' }])).toEqual([{ by: 'swim', name: 'swim', value: 3, unit: 'hour' }]);
    expect(readRoute('mt-loose', { from: 'mt-jetty' })).toBeNull();
    expect(readRoute('mt-loose', { from: 'mt-jetty', to: 'mt-islet', hidden: 'yes' })).toEqual({ id: 'mt-loose', from: 'mt-jetty', to: 'mt-islet', hidden: false, oneWay: false, ways: [] });
  });
});

describe('a route’s barrier, the obstacle (pf-12; mc-28a, dp-5)', () => {
  const gap = { name: 'the weir’s gap', extraTurns: 2, needsApproval: true, through: 'mt-weir', note: 'The weir takes a boat only at slack water; otherwise a roll you make.' };

  // Purpose: the GM reads a barrier whole, its name included (pf-12f); a missing name is none, a missing extra time
  // is none, and a broken extra time leaves the barrier out.
  it('gives the GM the barrier whole, and never guesses', () => {
    expect(readBarrier(gap, 'gm')).toEqual(gap);
    expect(readBarrier({ note: ' Slippery stones. ' }, 'gm')).toEqual({ name: null, extraTurns: 0, needsApproval: false, through: null, note: 'Slippery stones.' });
    expect(readBarrier({ name: '  ', note: 'x' }, 'gm')?.name).toBeNull();
    expect(readBarrier({ extraTurns: 1.5, note: 'x' }, 'gm')).toBeNull();
    expect(readBarrier({ extraTurns: -1, note: 'x' }, 'gm')).toBeNull();
    expect(readBarrier('a wall', 'gm')).toBeNull();
    expect(readBarrier(undefined, 'gm')).toBeNull();
  });

  // Purpose: as a player, the reader gives nothing of a barrier: not its note, not its need for the GM's approval, not
  // its extra time or the place it passes, and not its name (a player learns that only after a No, dp-5, from 4b's
  // record), whatever the pack says.
  it('gives a player nothing of it', () => {
    const seen = readBarrier(gap, 'player');
    expect(seen).toBeNull();
    expect(JSON.stringify(seen ?? {})).not.toMatch(/slack water|needsApproval|extraTurns|mt-weir|weir’s gap/);
  });

  // Purpose: the stand-in database, like the real one, never sends a player a route with a barrier, so the note and the
  // approval never reach a player's device; the GM reads them.
  it('the stand-in database keeps a barrier’s note from a player', async () => {
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    world.tables.packs.push({ id: 'pack-mire', owner_user_id: gm, campaign_id: null, name: 'Mire Tower', version: '0.1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-11-11T12:00:00Z', extra_meta: {} });
    world.tables.library_entries.push({ id: 'entry-gap', pack_id: 'pack-mire', kind: 'route', pack_entry_id: 'mt-jetty-islet', name: 'mt-jetty-islet', data: { ...jettyIslet, barrier: gap } });
    world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaign, pack_id: 'pack-mire', pack_name: 'Mire Tower', option_choices: {}, overrides: {}, priority: 1 });
    const read = async () => {
      const { data, error } = await world.db.from('library_entries').select('*');
      // The read succeeded: an empty answer means nothing was sent, not that the read failed (review of #755).
      expect(error).toBeNull();
      return (data ?? []) as { kind: string }[];
    };
    world.signInAs(me);
    const mine = await read();
    expect(mine.filter((e) => e.kind === 'route')).toEqual([]);
    expect(JSON.stringify(mine)).not.toMatch(/slack water|needsApproval|extraTurns|weir’s gap/);
    world.signInAs(gm);
    expect(JSON.stringify(await read())).toMatch(/slack water/);
  });
});

describe('routes are the GM’s, and an Update and an export keep them', () => {
  // Purpose: route isn't a kind players read.
  it('is not a kind players may read', () => {
    expect(PLAYER_FACING).not.toContain('route');
  });

  // Purpose: re-importing the same file matches every route as unchanged; a changed time is a change.
  it('an Update with the same file keeps them; a changed time is listed as changed', () => {
    const before = read(adventure()).entries;
    expect(comparePacks(before, read(adventure()).entries)).toMatchObject({ added: [], changed: [], removed: [] });
    const slower = { ...jettyIslet, travel: [{ by: 'row', name: 'Rowing', value: 2, unit: 'turn' }] };
    expect(comparePacks(before, read(adventure([slower, isletSluice])).entries).changed).toEqual([{ kind: 'route', packEntryId: 'mt-jetty-islet', name: 'mt-jetty-islet' }]);
  });

  // Purpose: exporting writes the routes back as they came, with no name added.
  it('exporting the pack writes them back as `routes`, as written', () => {
    const pack = read(adventure());
    expect(packFile(pack.meta, pack.entries).file.routes).toEqual([jettyIslet, isletSluice]);
  });

  // Purpose: the stand-in database, like the real one, keeps routes from a player in the campaign; the GM reads them.
  it('the stand-in database gives routes to the GM and never to a player', async () => {
    const world = createFakeDb();
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    world.tables.packs.push({ id: 'pack-mire', owner_user_id: gm, campaign_id: null, name: 'Mire Tower', version: '0.1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-11-11T12:00:00Z', extra_meta: {} });
    for (const route of [jettyIslet, isletSluice]) world.tables.library_entries.push({ id: `entry-${route.id}`, pack_id: 'pack-mire', kind: 'route', pack_entry_id: route.id, name: route.id, data: route });
    world.tables.library_entries.push({ id: 'entry-jetty', pack_id: 'pack-mire', kind: 'class', pack_entry_id: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden' } });
    world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaign, pack_id: 'pack-mire', pack_name: 'Mire Tower', option_choices: {}, overrides: {}, priority: 1 });
    const kindsSeen = async () => ((await world.db.from('library_entries').select('kind')).data ?? []).map((e) => (e as { kind: string }).kind).sort();
    world.signInAs(me);
    expect(await kindsSeen()).toEqual(['class']);
    world.signInAs(gm);
    expect(await kindsSeen()).toEqual(['class', 'route', 'route']);
  });
});
