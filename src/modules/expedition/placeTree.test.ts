// The packs' places as the picker reads them (M8b slice 0, pull request 2; ⚑ 10 names). Invented places only.
// What it checks: the words for a place (type in words, "Hex" with its map number, the parent when name and type
// both match, the map number only when the parent matches too); the tree (roots, children with hexes by map number,
// parents, ancestors); search by name or map number with starts-with first and a cap; Near here (own places, then
// neighbours); the packs' counts; and which places are never a row to pick (p2p-2: an Area or a Region that holds
// Locations), with every other place left as it was.
import { describe, expect, it } from 'vitest';
import { ancestorsOf, childrenOf, countUnder, holdersOfLocations, isLocation, keyedName, nearHere, packsWithPlaces, pickablePlaces, rootsOf, searchPlaces, typeWord, wordsFor, type PackPlace } from './placeTree.ts';

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
  fen('hex-0413', 'Saltreach and the Eel Weirs', 'area', 'region', { key: '0413', hex: '0413' }),
  fen('hex-0412', 'Heron Isle', 'area', 'region', { key: '0412', hex: '0412' }),
  fen('heron-site', 'Heron Isle', 'site', 'hex-0412'),
  fen('chapel', 'The Sunken Chapel', 'site', 'hex-0412'),
  fen('reed-road', 'Along the Reed Road', 'site', 'hex-0412'),
  fen('saltreach', 'Saltreach', 'site', 'hex-0413', { settlement: true }),
  fen('fish-salt', 'Fish Market', 'building', 'saltreach'),
  fen('ford', "Marlow's Ford", 'site', 'hex-0413'),
  fen('fish-ford', 'Fish Market', 'building', 'ford'),
  fen('fish-ford-2', 'Fish Market', 'building', 'ford', { key: '7' }),
  { ...fen('stair', "The Fishers' Stair", 'room', null), packId: 'pack-abbey', packName: 'The Drowned Abbey', packKind: 'adventure' },
];

describe('the words for a place (⚑ 10)', () => {
  it('is the name with its type; a hex says Hex and its map number', () => {
    expect(wordsFor(PLACES, PLACES[0]!)).toBe('The Long Fen (Region)');
    expect(wordsFor(PLACES, PLACES[2]!)).toBe('Heron Isle (Hex), 0412');
    expect(typeWord({ type: 'building', hex: null })).toBe('Building');
    expect(typeWord({ type: 'odd', hex: null })).toBe('Place');
  });

  // Purpose (p2p-3, 2026-11-18; #1000's review): one rule for a keyed name, shared by the place page and Move on: the
  // key, a full stop, the name; never doubled; a key with letters works the same; a name that is only its key, and a
  // name with no key, stay as they are.
  it('keys a name as "1. The Jetty", once', () => {
    expect(keyedName('1', 'The Jetty')).toBe('1. The Jetty');
    expect(keyedName('1', '1 The Jetty')).toBe('1. The Jetty');
    expect(keyedName('1', '1. The Jetty')).toBe('1. The Jetty');
    expect(keyedName('A2', 'The Vault')).toBe('A2. The Vault');
    expect(keyedName('A2', 'A2 The Vault')).toBe('A2. The Vault');
    expect(keyedName('3', '3')).toBe('3');
    expect(keyedName('1', '10 The Mud')).toBe('1. 10 The Mud');
    expect(keyedName(null, 'The Anchorage')).toBe('The Anchorage');
    expect(keyedName('', 'The Anchorage')).toBe('The Anchorage');
  });

  // Purpose (p2p-1, 2026-11-18): on screen the pack's `site` reads "Area" and its `area` reads "Location", a Region stays
  // a Region, and the words a place picker shows carry the new word.
  it('reads a site as an Area and an area as a Location', () => {
    expect(typeWord({ type: 'site', hex: null })).toBe('Area');
    expect(typeWord({ type: 'area', hex: null })).toBe('Location');
    expect(typeWord({ type: 'region', hex: null })).toBe('Region');
    expect(wordsFor(PLACES, { ...PLACES[0]!, type: 'site', name: 'The Drowned Harbour' })).toBe('The Drowned Harbour (Area)');
  });

  it('two places of one name but different types are told apart by the type alone', () => {
    expect(wordsFor(PLACES, PLACES[3]!)).toBe('Heron Isle (Area)');
  });

  it('the parent follows when name and type both match; the map number only when the parent matches too', () => {
    expect(wordsFor(PLACES, PLACES[7]!)).toBe('Fish Market (Building), in Saltreach');
    expect(wordsFor(PLACES, PLACES[9]!)).toBe("Fish Market (Building), in Marlow's Ford");
    expect(wordsFor(PLACES, PLACES[10]!)).toBe("Fish Market (Building), in Marlow's Ford, 7");
  });
});

describe('the tree', () => {
  it('roots are the places with no parent in their pack; children keep the pack order, hexes by map number last', () => {
    expect(rootsOf(PLACES, 'pack-fen').map((p) => p.entryId)).toEqual(['region']);
    expect(rootsOf(PLACES, 'pack-abbey').map((p) => p.entryId)).toEqual(['stair']);
    expect(childrenOf(PLACES, PLACES[0]!).map((p) => p.key)).toEqual(['0412', '0413']);
    expect(childrenOf(PLACES, PLACES[2]!).map((p) => p.entryId)).toEqual(['heron-site', 'chapel', 'reed-road']);
    expect(countUnder(PLACES, PLACES[2]!)).toBe(3);
  });

  it('ancestors go up to the root, nearest first', () => {
    expect(ancestorsOf(PLACES, PLACES[7]!).map((p) => p.entryId)).toEqual(['saltreach', 'hex-0413', 'region']);
    expect(ancestorsOf(PLACES, PLACES[0]!)).toEqual([]);
  });

  it('Near here is the current place\'s own places, then its neighbours; nothing before the first place', () => {
    expect(nearHere(PLACES, PLACES[2]!).map((p) => p.entryId)).toEqual(['heron-site', 'chapel', 'reed-road', 'hex-0413']);
    expect(nearHere(PLACES, PLACES[3]!).map((p) => p.entryId)).toEqual(['chapel', 'reed-road']);
    expect(nearHere(PLACES, null)).toEqual([]);
  });

  it('the packs with places, each with its count', () => {
    expect(packsWithPlaces(PLACES)).toEqual([
      { packId: 'pack-fen', name: 'Fen Marches', kind: 'homebrew', count: 11 },
      { packId: 'pack-abbey', name: 'The Drowned Abbey', kind: 'adventure', count: 1 },
    ]);
  });
});

describe('search', () => {
  it('finds by name or map number, case-insensitive, names that start with the words first, capped', () => {
    expect(searchPlaces(PLACES, 'fish').map((p) => p.entryId)).toEqual(['fish-salt', 'fish-ford', 'fish-ford-2', 'stair']);
    expect(searchPlaces(PLACES, '0412').map((p) => p.entryId)).toEqual(['hex-0412']);
    expect(searchPlaces(PLACES, 'ISLE').map((p) => p.entryId)).toEqual(['hex-0412', 'heron-site']);
    expect(searchPlaces(PLACES, 'fish', 2)).toHaveLength(2);
    expect(searchPlaces(PLACES, '  ')).toEqual([]);
    expect(searchPlaces(PLACES, 'xyzzy')).toEqual([]);
  });

  it('900 places search in well under a second', () => {
    const many: PackPlace[] = Array.from({ length: 900 }, (_, i) => fen(`hex-${i}`, `Place ${i} of the fen`, 'area', 'region', { key: String(1000 + i), hex: String(1000 + i) }));
    const started = performance.now();
    for (let i = 0; i < 50; i += 1) searchPlaces(many, 'of the fen');
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

// Placing the party offers Locations only (p2p-2; plan scene-point-to-point B5; its ⚑ 6 ruled 2026-11-18). An invented
// adventure: an island (Region) holding a harbour (Area) of Locations, a village (an Area with no Location under it)
// and a cellar (an Area of a floor and a room, no Location).
const reed = (entryId: string, name: string, type: string, parentId: string | null, extra: Partial<PackPlace> = {}): PackPlace => ({ ...fen(entryId, name, type, parentId, extra), packId: 'pack-reed', packName: 'The Reed Marches', packKind: 'adventure' });
const HARBOUR: PackPlace[] = [
  reed('island', 'Saltwick Island', 'region', null),
  reed('harbour', 'The Drowned Harbour', 'site', 'island'),
  reed('anchorage', 'The Anchorage', 'area', 'harbour'),
  reed('jetty', 'The Jetty', 'area', 'harbour', { key: '1' }),
  reed('wreck', 'The Wreck', 'area', 'harbour', { key: '2' }),
  reed('hold', 'The Hold', 'room', 'wreck'),
  reed('village', 'Saltwick Village', 'site', 'island', { settlement: true }),
  reed('cellars', 'The Lantern Cellars', 'site', 'island'),
  reed('cellar-floor', 'The Upper Cellar', 'floor', 'cellars'),
  reed('cellar-room', 'The Wine Vault', 'room', 'cellar-floor'),
];
const idsOf = (list: Iterable<PackPlace>) => [...list].map((p) => p.entryId);

describe('placing the party offers Locations only (p2p-2)', () => {
  // Purpose: a Location is the pack's `area`; a hex, though the pack types it `area` too, is a Hex and not a Location.
  it('a Location is the pack’s area that is not a hex', () => {
    expect(isLocation({ type: 'area', hex: null })).toBe(true);
    expect(isLocation({ type: 'area', hex: '0412' })).toBe(false);
    expect(isLocation({ type: 'site', hex: null })).toBe(false);
    expect(isLocation({ type: 'region', hex: null })).toBe(false);
  });

  // Purpose: an Area that holds Locations, and the Region above it, are never places to pick; nothing else is held back.
  it('names the Area that holds Locations and the Region above it, and nothing else', () => {
    expect(idsOf(holdersOfLocations(HARBOUR)).sort()).toEqual(['harbour', 'island']);
  });

  // Purpose: what is left to pick is every Location, and every place the ruling leaves as it was: a room inside a
  // Location, an Area with no Location under it, and a dungeon's Area with its floor and room.
  it('leaves the Locations to pick, and every place with no Locations of its own as it was', () => {
    expect(idsOf(pickablePlaces(HARBOUR))).toEqual(['anchorage', 'jetty', 'wreck', 'hold', 'village', 'cellars', 'cellar-floor', 'cellar-room']);
  });

  // Purpose: the search, read over what can be picked, never finds the Area or the Region, by name or by map number,
  // and still finds a Location by either.
  it('the search over what can be picked finds a Location and never its Area or Region', () => {
    const pickable = pickablePlaces(HARBOUR);
    expect(searchPlaces(pickable, 'drowned harbour')).toEqual([]);
    expect(searchPlaces(pickable, 'saltwick').map((p) => p.entryId)).toEqual(['village']);
    expect(searchPlaces(pickable, 'the jetty').map((p) => p.entryId)).toEqual(['jetty']);
    expect(searchPlaces(pickable, '2').map((p) => p.entryId)).toEqual(['wreck']);
  });

  // Purpose: a pack that gives no Locations (a wilderness Region of hexes with Areas in them, a place of rooms) is
  // untouched: every Region and Area in it is still a place to pick, and the list comes back as it was given.
  it('a pack with no Locations keeps every Region and Area to pick, as before', () => {
    expect(holdersOfLocations(PLACES).size).toBe(0);
    expect(pickablePlaces(PLACES)).toBe(PLACES);
  });

  // Purpose: the rule is each pack's own: a pack of Locations beside a pack without changes nothing in the other, even
  // where two packs use the same id for a place.
  it('is each pack’s own, even where two packs share an id', () => {
    const twin = { ...fen('harbour', 'Harbour Hex Country', 'region', null) };
    const both = [...PLACES, twin, ...HARBOUR];
    expect(idsOf(holdersOfLocations(both)).sort()).toEqual(['harbour', 'island']);
    expect([...holdersOfLocations(both)].every((p) => p.packId === 'pack-reed')).toBe(true);
    expect(pickablePlaces(both)).toContain(twin);
  });

  // Purpose: a pack whose places name each other as parents in a circle never hangs the app.
  it('a loop of parents in a pack ends', () => {
    const loop = [reed('a', 'Ring Quay', 'site', 'b'), reed('b', 'Ring Isle', 'region', 'a'), reed('c', 'The Ring Stair', 'area', 'a')];
    expect(idsOf(holdersOfLocations(loop)).sort()).toEqual(['a', 'b']);
  });

  // Purpose: 900 places, the size of a large region pack, are sorted into pick and not-pick fast enough to do on each
  // opening of the picker on a phone.
  it('900 places are sorted in well under a second', () => {
    const many: PackPlace[] = Array.from({ length: 900 }, (_, i) => reed(`loc-${i}`, `Location ${i}`, i % 10 === 0 ? 'site' : 'area', i % 10 === 0 ? 'island' : `loc-${i - (i % 10)}`));
    const started = performance.now();
    for (let i = 0; i < 50; i += 1) holdersOfLocations([HARBOUR[0]!, ...many]);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(holdersOfLocations([HARBOUR[0]!, ...many]).size).toBe(91);
  });
});
