// @vitest-environment jsdom
// The place picker and the place card's lines from a pack (M8b slice 0, pull request 2; the mockup approved
// 2026-11-06). Invented packs and places; the stand-in database. What it checks, in plain words:
//   * the picker lists Recently visited and one folded group per pack; unfolding shows the pack's tree one level at a
//     time (hexes with their map number); search finds by name or map number and names the source; nothing found
//     offers Other…; with no packs listing places it says so and offers Other…; offline and loading say so;
//   * picking a pack's place from the card moves the party there in ONE request: one log line, and one Undo takes
//     the place, its pieces and the move back together; picking it again finds the same place;
//   * the card shows "Part of …" and "Here: N places", with no "Players see" or Rename (p2p-11); a tap on a related
//     place moves the party at once with an Undo toast.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { forgetPackPlaces, loadGroupPlaces, type Place } from '../modules/expedition/placePlay.ts';
import type { PackPlace } from '../modules/expedition/placeTree.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { PlaceCard } from './PlaceCard.tsx';
import { PlacePickerBody } from './PlacePicker.tsx';
import { PlacesSpecimens } from '../gallery/PlacesSpecimens.tsx';

let world: FakeWorld;
let gmId: string;
let campaign: string;
const gm = (): CurrentUser => ({ id: gmId, roles: { [campaign]: 'gm' } }) as CurrentUser;

const fen = (entryId: string, name: string, type: string, parentId: string | null, extra: Partial<PackPlace> = {}): PackPlace => ({
  packId: 'pack-fen',
  packName: 'Fen Marches',
  packKind: 'homebrew',
  entryId,
  name,
  type,
  parentId,
  key: null,
  hex: null,
  settlement: false,
  terrain: null,
  ...extra,
});
const PLACES: PackPlace[] = [
  fen('region', 'The Long Fen', 'region', null),
  fen('hex-0412', 'Heron Isle', 'area', 'region', { key: '0412', hex: '0412', terrain: 'marsh' }),
  fen('heron-site', 'Heron Isle', 'site', 'hex-0412'),
  fen('chapel', 'The Sunken Chapel', 'site', 'hex-0412'),
  fen('hex-0413', 'Saltreach and the Eel Weirs', 'area', 'region', { key: '0413', hex: '0413' }),
];
const typedPlace = (id: string, name: string): Place => ({ id, campaignId: campaign, name, description: '', notes: null, version: 1, notesVersion: 1, pack: null, playersName: '', regionId: '', terrainId: '' });

/** The same places as library entries in the stand-in, attached to the campaign. */
function seedPack() {
  world.tables.campaign_packs.push({ id: 'cp-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Marches', option_choices: {}, priority: 1 });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gmId, campaign_id: null, name: 'Fen Marches', kind: 'homebrew', version: '1', format_version: 2, source: '', notes: '', extra_meta: {} });
  for (const p of PLACES) {
    const data: Record<string, unknown> = { id: p.entryId, name: p.name, type: p.type, parentId: p.parentId ?? undefined, key: p.key ?? undefined, hex: p.hex ?? undefined, terrain: p.terrain ?? undefined, playerView: { text: `What players notice at ${p.name}.` }, gm: { notes: `The GM's notes on ${p.name}.` } };
    world.tables.library_entries.push({ id: `entry-${p.entryId}`, pack_id: 'pack-fen', kind: 'location', pack_entry_id: p.entryId, name: p.name, data });
  }
}

beforeEach(() => {
  world = createFakeDb();
  gmId = world.addPerson('priya@lantern.example', 'Priya');
  campaign = world.addCampaign('The Ash Barrows', gmId);
  world.signInAs(gmId);
  forgetPackPlaces();
});
afterEach(cleanup);

describe('the picker', () => {
  it('lists Recently visited and one folded group per pack; unfolding shows the tree one level at a time, hexes with their number', async () => {
    const picked: unknown[] = [];
    render(<PlacePickerBody places={PLACES} recent={[typedPlace('p1', 'The Reed Camp')]} current={null} onPick={(p) => picked.push(p)} />);
    const recent = within(screen.getByRole('region', { name: 'Recently visited' }));
    expect(recent.getByRole('button', { name: /The Reed Camp/ })).toBeTruthy();
    expect(recent.getByText('typed')).toBeTruthy();
    const packs = within(screen.getByRole('region', { name: 'From your packs' }));
    // The group is headed by the pack's own name, with the count under it; never "Region pack" (2c).
    expect(packs.getByText('Fen Marches')).toBeTruthy();
    expect(packs.getByText('5 places')).toBeTruthy();
    expect(packs.queryByText(/Region pack/)).toBeNull();
    expect(packs.queryByRole('button', { name: 'The Long Fen (Region)' })).toBeNull();
    await userEvent.click(packs.getByRole('button', { name: 'Show Fen Marches' }));
    expect(packs.getByRole('button', { name: 'The Long Fen (Region)' })).toBeTruthy();
    // Only the first level: the hexes wait for their own unfold.
    expect(packs.queryByRole('button', { name: /Heron Isle \(Hex\)/ })).toBeNull();
    await userEvent.click(packs.getByRole('button', { name: 'Show the places in The Long Fen (Region)' }));
    expect(packs.getByRole('button', { name: 'Heron Isle (Hex), 0412' })).toBeTruthy();
    expect(packs.getByRole('button', { name: 'Saltreach and the Eel Weirs (Hex), 0413' })).toBeTruthy();
    expect(packs.queryByRole('button', { name: 'Heron Isle (Area)' })).toBeNull();
    await userEvent.click(packs.getByRole('button', { name: 'Show the places in Heron Isle (Hex), 0412' }));
    await userEvent.click(packs.getByRole('button', { name: 'The Sunken Chapel (Area)' }));
    expect(picked).toEqual([{ kind: 'pack', place: PLACES[3] }]);
    // The fold button only folds: it picks nothing.
    await userEvent.click(packs.getByRole('button', { name: 'Fold the places in Heron Isle (Hex), 0412' }));
    expect(picked).toHaveLength(1);
    expect(packs.queryByRole('button', { name: 'Heron Isle (Area)' })).toBeNull();
  });

  it('search finds by name or map number, says how many and the source, and offers the words as a new place; nothing found says so', async () => {
    const picked: unknown[] = [];
    render(<PlacePickerBody places={PLACES} recent={[]} current={null} onPick={(p) => picked.push(p)} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search places by name or map number' }), 'heron');
    expect(screen.getByText('2 places')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Heron Isle \(Area\)/ })).toBeTruthy();
    expect(screen.getAllByText('Fen Marches')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Other… use “heron” as a new place' })).toBeTruthy();
    await userEvent.clear(screen.getByRole('textbox', { name: 'Search places by name or map number' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Search places by name or map number' }), '0413');
    expect(screen.getByRole('button', { name: 'Saltreach and the Eel Weirs (Hex), 0413' })).toBeTruthy();
    await userEvent.clear(screen.getByRole('textbox', { name: 'Search places by name or map number' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Search places by name or map number' }), 'xyzzy');
    expect(screen.getByText('No place called “xyzzy” in your packs.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Other… use “xyzzy” as a new place' }));
    expect((screen.getByRole('textbox', { name: "A place that isn't listed" }) as HTMLInputElement).value).toBe('xyzzy');
    await userEvent.click(screen.getByRole('button', { name: 'Set place' }));
    expect(picked).toEqual([{ kind: 'other', name: 'xyzzy' }]);
  });

  it('Near here lists the current place\'s own places and its neighbours, and marks the current place "here now"', async () => {
    const here: Place = { ...typedPlace('p-hex', 'Heron Isle'), pack: { packId: 'pack-fen', entryId: 'hex-0412', type: 'area', parentId: 'region', key: '0412' } };
    render(<PlacePickerBody places={PLACES} recent={[here]} current={here} onPick={() => undefined} />);
    const near = within(screen.getByRole('region', { name: 'Near here' }));
    expect(near.getAllByRole('button').map((b) => b.textContent)).toEqual(['Heron Isle (Area)', 'The Sunken Chapel (Area)', 'Saltreach and the Eel Weirs (Hex), 0413']);
    // The current place isn't under Recently visited (it is here), and in the tree it says so.
    expect(screen.queryByRole('region', { name: 'Recently visited' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show Fen Marches' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show the places in The Long Fen (Region)' }));
    expect(screen.getByRole('button', { name: /Heron Isle \(Hex\), 0412.*here now/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('with no packs listing places it says so and offers Other…; loading and offline say so; Move on, unnamed when allowed', async () => {
    const picked: unknown[] = [];
    render(<PlacePickerBody places={[]} recent={[]} current={null} allowUnnamed onPick={(p) => picked.push(p)} />);
    expect(screen.getByText(/None of this campaign's packs lists places/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Other… a place that isn’t listed' }));
    await userEvent.click(screen.getByRole('button', { name: 'Move on, unnamed' }));
    expect(picked).toEqual([{ kind: 'unnamed' }]);
    cleanup();
    render(<PlacePickerBody places={null} recent={[]} current={null} onPick={() => undefined} />);
    expect(screen.getByRole('status', { name: "Loading your packs' places" })).toBeTruthy();
    cleanup();
    render(<PlacePickerBody places={null} recent={[]} current={null} offline onPick={() => undefined} />);
    expect(screen.getByText(/You're offline/)).toBeTruthy();
    cleanup();
    render(<PlacePickerBody places="error" recent={[]} current={null} onPick={() => undefined} />);
    expect(screen.getByText(/couldn't be read/)).toBeTruthy();
  });
});

// Placing the party offers Locations only (p2p-2; plan scene-point-to-point B5; its ⚑ 6 ruled 2026-11-18). An invented
// adventure: an island (Region) holding a harbour (Area) of Locations and a village (an Area with no Location under it).
const reed = (entryId: string, name: string, type: string, parentId: string | null, extra: Partial<PackPlace> = {}): PackPlace => ({ ...fen(entryId, name, type, parentId, extra), packId: 'pack-reed', packName: 'The Reed Marches', packKind: 'adventure' });
const HARBOUR: PackPlace[] = [
  reed('island', 'Saltwick Island', 'region', null),
  reed('harbour', 'The Drowned Harbour', 'site', 'island'),
  reed('anchorage', 'The Anchorage', 'area', 'harbour'),
  reed('jetty', 'The Jetty', 'area', 'harbour', { key: '1' }),
  reed('wreck', 'The Wreck', 'area', 'harbour', { key: '2' }),
  reed('village', 'Saltwick Village', 'site', 'island', { settlement: true }),
];
/** A place the campaign already has from the adventure (the party stood there before). */
const visited = (id: string, from: PackPlace): Place => ({ ...typedPlace(id, from.name), pack: { packId: from.packId, entryId: from.entryId, type: from.type, parentId: from.parentId ?? '', key: from.key ?? '' } });

describe('the picker offers Locations only where a pack gives them (p2p-2)', () => {
  // Purpose: in the pack's tree a Region or an Area that holds Locations is never picked: a tap on its name opens its
  // places, a second tap folds them, and only a Location's tap places the party.
  it('a tap on a Region or an Area that holds Locations opens its places and picks nothing; a Location picks', async () => {
    const picked: unknown[] = [];
    render(<PlacePickerBody places={HARBOUR} recent={[]} current={null} onPick={(p) => picked.push(p)} />);
    const packs = within(screen.getByRole('region', { name: 'From your packs' }));
    await userEvent.click(packs.getByRole('button', { name: 'Show The Reed Marches' }));
    const island = packs.getByRole('button', { name: 'Saltwick Island (Region)' });
    expect(island.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(island);
    expect(island.getAttribute('aria-expanded')).toBe('true');
    const harbour = packs.getByRole('button', { name: 'The Drowned Harbour (Area)' });
    await userEvent.click(harbour);
    expect(picked).toEqual([]);
    // Its own square button still folds and opens the same places.
    expect(packs.getByRole('button', { name: 'Fold the places in The Drowned Harbour (Area)' })).toBeTruthy();
    await userEvent.click(packs.getByRole('button', { name: 'The Jetty (Location)' }));
    expect(picked).toEqual([{ kind: 'pack', place: HARBOUR[3] }]);
    // A second tap on the Area folds its Locations away, and still picks nothing.
    await userEvent.click(harbour);
    expect(packs.queryByRole('button', { name: 'The Jetty (Location)' })).toBeNull();
    expect(picked).toHaveLength(1);
  });

  // Purpose: an Area with no Location under it, in the same pack, is still a place to pick, as before (the rulings leave
  // places with no Locations of their own to later sittings).
  it('an Area with no Location under it is still picked, as before', async () => {
    const picked: unknown[] = [];
    render(<PlacePickerBody places={HARBOUR} recent={[]} current={null} initialOpen={['pack:pack-reed', 'pack-reed:island']} onPick={(p) => picked.push(p)} />);
    const village = screen.getByRole('button', { name: 'Saltwick Village (Area)' });
    expect(village.hasAttribute('aria-expanded')).toBe(false);
    await userEvent.click(village);
    expect(picked).toEqual([{ kind: 'pack', place: HARBOUR[5] }]);
  });

  // Purpose: the search never offers an Area or a Region that holds Locations, by its name or among other finds; it
  // still offers a Location, and the typed words as a new place.
  it('the search offers no Area or Region that holds Locations, and still offers a Location and Other…', async () => {
    const picked: unknown[] = [];
    render(<PlacePickerBody places={HARBOUR} recent={[]} current={null} onPick={(p) => picked.push(p)} />);
    const search = screen.getByRole('textbox', { name: 'Search places by name or map number' });
    await userEvent.type(search, 'drowned harbour');
    expect(screen.queryByRole('button', { name: /The Drowned Harbour \(Area\)/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Other… use “drowned harbour” as a new place' })).toBeTruthy();
    await userEvent.clear(search);
    await userEvent.type(search, 'saltwick');
    expect(screen.queryByRole('button', { name: /Saltwick Island \(Region\)/ })).toBeNull();
    expect(screen.getByText('1 place')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Saltwick Village \(Area\)/ })).toBeTruthy();
    await userEvent.clear(search);
    await userEvent.type(search, 'the w');
    await userEvent.click(screen.getByRole('button', { name: /The Wreck \(Location\)/ }));
    expect(picked).toEqual([{ kind: 'pack', place: HARBOUR[4] }]);
  });

  // Purpose: where the party stands at an Area that holds Locations (from before this rule), its row in the tree still
  // says "here now" and only opens and folds: it is marked as the current place and as a fold, never as a pressed
  // choice too. A Location the party stands at keeps its pressed mark, as before (the review of #1008, nit 3).
  it('the current place’s row is a fold and not a pressed choice when it holds Locations; a current Location stays pressed', async () => {
    const picked: unknown[] = [];
    render(<PlacePickerBody places={HARBOUR} recent={[]} current={visited('p-harbour', HARBOUR[1]!)} initialOpen={['pack:pack-reed', 'pack-reed:island']} onPick={(p) => picked.push(p)} />);
    const harbour = screen.getByRole('button', { name: /The Drowned Harbour \(Area\).*here now/ });
    expect(harbour.getAttribute('aria-current')).toBe('location');
    expect(harbour.getAttribute('aria-expanded')).toBe('false');
    expect(harbour.hasAttribute('aria-pressed')).toBe(false);
    await userEvent.click(harbour);
    expect(harbour.getAttribute('aria-expanded')).toBe('true');
    expect(harbour.hasAttribute('aria-pressed')).toBe(false);
    expect(picked).toEqual([]);
    cleanup();
    render(<PlacePickerBody places={HARBOUR} recent={[]} current={visited('p-jetty', HARBOUR[3]!)} initialOpen={['pack:pack-reed', 'pack-reed:island', 'pack-reed:harbour']} onPick={() => undefined} />);
    const packs = within(screen.getByRole('region', { name: 'From your packs' }));
    const jetty = packs.getByRole('button', { name: /The Jetty \(Location\).*here now/ });
    expect(jetty.getAttribute('aria-pressed')).toBe('true');
    expect(jetty.getAttribute('aria-current')).toBe('location');
    expect(jetty.hasAttribute('aria-expanded')).toBe(false);
  });

  // Purpose: Near here at a Location lists the other Locations of its Area; and for a party that stood at the Area
  // before this rule, it lists the Area's Locations and the village, never the Area's neighbours that hold Locations.
  it('Near here lists Locations, and no Area or Region that holds them', () => {
    const wrecks = [...HARBOUR, reed('north-bar', 'The North Bar', 'site', 'island'), reed('bar-hulk', 'The Hulk', 'area', 'north-bar')];
    render(<PlacePickerBody places={wrecks} recent={[]} current={visited('p-jetty', HARBOUR[3]!)} onPick={() => undefined} />);
    expect(within(screen.getByRole('region', { name: 'Near here' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['The Anchorage (Location)', 'The Wreck (Location)']);
    cleanup();
    render(<PlacePickerBody places={wrecks} recent={[]} current={visited('p-harbour', HARBOUR[1]!)} onPick={() => undefined} />);
    expect(within(screen.getByRole('region', { name: 'Near here' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['The Anchorage (Location)', 'The Jetty (Location)', 'The Wreck (Location)', 'Saltwick Village (Area)']);
  });

  // Purpose: Recently visited leaves out an Area the party stood at before, where its pack gives Locations; a visited
  // Location, a typed place and the village stay, and each still places the party.
  it('Recently visited leaves out an Area that holds Locations and keeps Locations, typed places and other Areas', async () => {
    const picked: unknown[] = [];
    const jetty = visited('p-jetty', HARBOUR[3]!);
    const camp = typedPlace('p-camp', 'The Reed Camp');
    render(<PlacePickerBody places={HARBOUR} recent={[visited('p-harbour', HARBOUR[1]!), jetty, camp, visited('p-village', HARBOUR[5]!)]} current={null} onPick={(p) => picked.push(p)} />);
    const recent = within(screen.getByRole('region', { name: 'Recently visited' }));
    expect(recent.getAllByRole('button').map((b) => b.textContent)).toEqual(['The Jetty (Location)', 'The Reed Camp', 'Saltwick Village (Area)']);
    await userEvent.click(recent.getByRole('button', { name: 'The Jetty (Location)' }));
    await userEvent.click(recent.getByRole('button', { name: /The Reed Camp/ }));
    expect(picked).toEqual([
      { kind: 'place', place: jetty },
      { kind: 'place', place: camp },
    ]);
  });
});

describe('everything else places the party as before (the plan’s ⚑ 6, ruled 2026-11-18)', () => {
  // Purpose: with a pack that gives no Locations (a wilderness Region of hexes), the Region and an Area in a hex are
  // still picked by a tap on their names, and no name's tap opens anything.
  it('a pack with no Locations: its Region and its Areas are still picked by a tap', async () => {
    const picked: unknown[] = [];
    render(<PlacePickerBody places={PLACES} recent={[]} current={null} initialOpen={['pack:pack-fen', 'pack-fen:region', 'pack-fen:hex-0412']} onPick={(p) => picked.push(p)} />);
    const region = screen.getByRole('button', { name: 'The Long Fen (Region)' });
    expect(region.hasAttribute('aria-expanded')).toBe(false);
    await userEvent.click(region);
    await userEvent.click(screen.getByRole('button', { name: 'The Sunken Chapel (Area)' }));
    expect(picked).toEqual([
      { kind: 'pack', place: PLACES[0] },
      { kind: 'pack', place: PLACES[3] },
    ]);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search places by name or map number' }), 'long fen');
    expect(screen.getByRole('button', { name: /The Long Fen \(Region\)/ })).toBeTruthy();
  });

  // Purpose: a campaign with no pack still takes a typed name through Other…, and gives it back as typed.
  it('a campaign with no pack: Other… takes a typed name', async () => {
    const picked: unknown[] = [];
    render(<PlacePickerBody places={[]} recent={[]} current={null} onPick={(p) => picked.push(p)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Other… a place that isn’t listed' }));
    await userEvent.type(screen.getByRole('textbox', { name: "A place that isn't listed" }), 'The Reed Camp');
    await userEvent.click(screen.getByRole('button', { name: 'Set place' }));
    expect(picked).toEqual([{ kind: 'other', name: 'The Reed Camp' }]);
  });

  // Purpose: beside a pack of Locations, a typed name is still taken as a new place, even one that is an Area's name;
  // and Move on, unnamed still works where the caller allows it.
  it('beside a pack of Locations: a typed name and Move on, unnamed still work', async () => {
    const picked: unknown[] = [];
    render(<PlacePickerBody places={HARBOUR} recent={[]} current={null} allowUnnamed onPick={(p) => picked.push(p)} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search places by name or map number' }), 'The Drowned Harbour');
    await userEvent.click(screen.getByRole('button', { name: 'Other… use “The Drowned Harbour” as a new place' }));
    await userEvent.click(screen.getByRole('button', { name: 'Set place' }));
    expect(picked).toEqual([{ kind: 'other', name: 'The Drowned Harbour' }]);
    cleanup();
    render(<PlacePickerBody places={HARBOUR} recent={[]} current={null} allowUnnamed onPick={(p) => picked.push(p)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Other… a place that isn’t listed' }));
    await userEvent.click(screen.getByRole('button', { name: 'Move on, unnamed' }));
    expect(picked).toEqual([{ kind: 'other', name: 'The Drowned Harbour' }, { kind: 'unnamed' }]);
  });

  // Purpose: a place made by hand (typed earlier, tied to no pack) is still offered under Recently visited beside a
  // pack of Locations, and a tap still places the party there.
  it('a place made by hand is still offered and picked', async () => {
    const picked: unknown[] = [];
    const camp = typedPlace('p-camp', 'The Reed Camp');
    render(<PlacePickerBody places={HARBOUR} recent={[camp]} current={null} onPick={(p) => picked.push(p)} />);
    await userEvent.click(within(screen.getByRole('region', { name: 'Recently visited' })).getByRole('button', { name: /The Reed Camp/ }));
    expect(picked).toEqual([{ kind: 'place', place: camp }]);
  });

  // Purpose: while the packs' places are still loading, nothing is hidden that the picker can't yet judge: a place
  // visited before is still offered (the rule needs the pack's list to know what holds Locations).
  it('while the packs load, Recently visited is as before', () => {
    render(<PlacePickerBody places={null} recent={[visited('p-harbour', HARBOUR[1]!)]} current={null} onPick={() => undefined} />);
    expect(within(screen.getByRole('region', { name: 'Recently visited' })).getByRole('button', { name: 'The Drowned Harbour' })).toBeTruthy();
  });
});

describe('no marker comment becomes words on the screen', () => {
  // Purpose: a "words: names" marker belongs in code, never in what a player or the GM reads (Design, #532).
  it('the gallery specimens and the picker show no "//"', () => {
    render(<PlacesSpecimens Specimen={({ name, children }) => <figure aria-label={name}>{children}</figure>} />);
    expect(document.body.textContent).not.toContain('//');
    expect(screen.getByRole('button', { name: /Fish Market \(Building\), in Saltreach/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Show 6 more hexes, by map number/ })).toBeTruthy();
  });
});

describe('the place card with a pack (one line, one Undo; delivery 6)', () => {
  const start = async () => {
    seedPack();
    const started = (await world.db.rpc('start_expedition' as never, { campaign, mode_id: 'dungeon' } as never)) as unknown as { data: { id: string } | null };
    return started.data!.id;
  };
  const card = async (expeditionId: string) => {
    const rows = await loadGroupPlaces(world.db, campaign, expeditionId);
    const row = rows?.get(1) ?? null;
    return (
      <ToastHost>
        <PlaceCard db={world.db} user={gm()} campaign={{ id: campaign, name: 'The Ash Barrows', role: 'gm', line: null }} group={1} groupLabel={null} row={row} checks={[]} recent={[]} onChanged={() => undefined} />
      </ToastHost>
    );
  };

  it('picking a pack place moves the party there in one request: one line, one Undo for the place, its pieces and the move', async () => {
    const trip = await start();
    const view = render(await card(trip));
    await userEvent.click(screen.getByRole('button', { name: 'Set place' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Show Fen Marches' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show the places in The Long Fen (Region)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Heron Isle (Hex), 0412' }));
    expect(await screen.findByText('The party is at Heron Isle (Hex), 0412')).toBeTruthy();
    const place = world.tables.places.find((p) => p.pack_entry_id === 'hex-0412');
    expect(place).toBeTruthy();
    expect(world.tables.place_pieces.filter((p) => p.place_id === place!.id)).toHaveLength(1);
    expect(world.tables.piece_shows).toHaveLength(0);
    // One request: the place, its notes, its piece and the move share the move's request id and type.
    const lines = world.tables.events.filter((e) => e.type === 'place.set');
    expect(new Set(lines.map((e) => e.request_id)).size).toBe(1);
    expect(lines.map((e) => e.target_table).sort()).toEqual(['group_places', 'place_notes', 'place_pieces', 'places']);
    expect(world.tables.events.filter((e) => e.type === 'place.fromPack')).toHaveLength(0);
    // Undo takes it all back together.
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.places.find((p) => p.id === place!.id)?.undone).toBe(true));
    expect(world.tables.place_pieces.filter((p) => p.place_id === place!.id).every((p) => p.undone)).toBe(true);
    expect(world.tables.group_places.filter((g) => g.place_id === place!.id).every((g) => g.undone)).toBe(true);
    view.unmount();
  });

  it('shows Part of and Here: N places, no Players see and no Rename (p2p-11); a tap on a related place moves the party with an Undo toast', async () => {
    const trip = await start();
    render(await card(trip));
    await userEvent.click(screen.getByRole('button', { name: 'Set place' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Show Fen Marches' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show the places in The Long Fen (Region)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Heron Isle (Hex), 0412' }));
    await screen.findByText('The party is at Heron Isle (Hex), 0412');
    cleanup();
    render(await card(trip));
    expect(await screen.findByRole('heading', { name: 'Heron Isle (Hex), 0412' })).toBeTruthy();
    expect(document.body.textContent).not.toContain('//');
    expect(screen.getByText('Fen Marches, marsh, 0 of 1 piece shown')).toBeTruthy();
    // B3 (p2p-11, "Yes, everywhere"): no "Players see" and no Rename for players on this card either.
    expect(screen.queryByText(/Players see/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename for players' })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Part of The Long Fen (Region)' })).toBeTruthy();
    expect(screen.getByText('Here: 2 places')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'The Sunken Chapel (Area)' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show the places here' }));
    await userEvent.click(screen.getByRole('button', { name: 'The Sunken Chapel (Area)' }));
    expect(await screen.findByText('The party is at The Sunken Chapel (Area)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    const chapel = world.tables.places.find((p) => p.pack_entry_id === 'chapel');
    expect(chapel).toBeTruthy();
    expect(world.tables.group_places.some((g) => g.place_id === chapel!.id && !g.moved_on && !g.undone)).toBe(true);
    // Picking the hex again from Part of finds the same place, not a second one.
    cleanup();
    render(await card(trip));
    await userEvent.click(await screen.findByRole('button', { name: 'Part of Heron Isle (Hex), 0412' }));
    await screen.findByText('The party is at Heron Isle (Hex), 0412');
    expect(world.tables.places.filter((p) => p.pack_entry_id === 'hex-0412' && !p.undone)).toHaveLength(1);
  });
});
