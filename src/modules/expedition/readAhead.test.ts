// Reading ahead's page (plan scene-point-to-point B2; p2p-9). Invented places only. In plain words:
//   * a Location the party was never at reads as a move there would make it: the pack's pieces in the pack's order,
//     the lead words kept, the GM's facts beside them, none shown, and ids no command can find; its notes composed;
//   * a Location the campaign already has reads from the campaign's place: the GM's own pieces, none shown;
//   * nothing is written by reading.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../../core/commands.ts';
import { createAppRegistry } from '../../app/commandRegistry.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { addPiece, setPlace } from './placePlay.ts';
import { loadReadAhead, readAheadFromPack } from './readAhead.ts';

vi.mock('../../app/services.ts', async () => {
  const { createAppRegistry } = await import('../../app/commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

const GULLS = {
  packId: 'pack-cove',
  packEntryId: 'gull-rock',
  name: 'Gull Rock',
  data: {
    id: 'gull-rock',
    key: '4',
    type: 'area',
    parentId: 'cove',
    playerView: { text: 'A white rock loud with gulls.', aspects: [{ lead: 'Nests', text: 'Dozens, some still warm.' }] },
    treasure: [{ text: 'A brass ring in a nest.', value: { herons: 3 } }],
    gm: { notes: 'The gulls rise if anyone climbs.' },
  },
};

describe('reading ahead’s page', () => {
  let world: FakeWorld;
  let campaign: string;
  let gm: CurrentUser;
  beforeEach(() => {
    world = createFakeDb();
    const gmId = world.addPerson('priya@lantern.example', 'Priya');
    campaign = world.addCampaign('The Ash Barrows', gmId);
    world.signInAs(gmId);
    gm = { id: gmId, roles: { [campaign]: 'gm' } } as CurrentUser;
    world.tables.packs.push({ id: 'pack-cove', owner_user_id: gmId, campaign_id: null, name: 'The Cove', kind: 'adventure', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
    world.tables.campaign_packs.push({ id: 'cp-cove', campaign_id: campaign, pack_id: 'pack-cove', pack_name: 'The Cove', option_choices: {}, priority: 1 });
    world.tables.library_entries.push({ id: 'entry-gull-rock', pack_id: 'pack-cove', kind: 'location', pack_entry_id: GULLS.packEntryId, name: GULLS.name, data: GULLS.data });
  });

  // Purpose: a Location never visited reads as a move there would make it, nothing shown, with ids no command finds.
  it('composes a place never visited from the pack, none shown', () => {
    const read = readAheadFromPack(campaign, GULLS)!;
    expect(read.place.id).toBe('ahead:pack-cove/gull-rock');
    expect(read.place.name).toBe('Gull Rock');
    expect(read.place.pack).toMatchObject({ packId: 'pack-cove', entryId: 'gull-rock', key: '4', type: 'area' });
    expect(read.place.notes?.traps).toContain('The gulls rise if anyone climbs.');
    expect(read.pieces.map((p) => [p.kind, p.lead ?? '', p.text])).toEqual([
      ['description', '', 'A white rock loud with gulls.'],
      ['other', 'Nests', 'Dozens, some still warm.'],
      ['treasure', '', 'A brass ring in a nest.'],
    ]);
    expect(read.pieces[2]!.gm.value).toBe('3 herons');
    expect(read.pieces.every((p) => !p.shown && p.id.startsWith('ahead:'))).toBe(true);
  });

  // Purpose: a Location the campaign has already is read from its place (the GM's own piece included), none shown, and
  // reading writes nothing.
  it('reads a place the campaign has from its own pieces, none shown, writing nothing', async () => {
    const registry = createAppRegistry();
    const trip = ((await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } }).data.id;
    expect(trip).toBeTruthy();
    const moved = await runCommand(registry, world.db, gm, setPlace, { campaignId: campaign, group: 1, name: '', packEntry: GULLS });
    if (!moved.ok) throw new Error(moved.message);
    const placeId = world.tables.places[0]!.id as string;
    await runCommand(registry, world.db, gm, addPiece, { campaignId: campaign, placeId, kind: 'clue', text: 'A feather tied with red thread.' });
    const before = { places: world.tables.places.length, pieces: world.tables.place_pieces.length, events: world.tables.events.length };
    const read = (await loadReadAhead(world.db, campaign, GULLS))!;
    expect(read.place.id).toBe(placeId);
    expect(read.pieces.map((p) => p.text)).toContain('A feather tied with red thread.');
    expect(read.pieces.every((p) => !p.shown)).toBe(true);
    expect({ places: world.tables.places.length, pieces: world.tables.place_pieces.length, events: world.tables.events.length }).toEqual(before);
  });
});
