// A pack's maps (dec-7 piece 5m-1; 07 Adventure packs §9): what the importer keeps and what the checker says.
// Invented packs only.
import { describe, expect, it } from 'vitest';
import { packFile } from './exportPack.ts';
import { PLAYER_FACING, playerFacingEntry, readPackJson } from './packFile.ts';
import { mapEntries, mapsForPlace, readPackMaps, readStoredMap } from './packMaps.ts';

const PLACES = [
  { id: 'bh-harbour', name: 'Brackwater harbour', type: 'site' },
  { id: 'bh-quay', name: 'The salt quay', type: 'area', parentId: 'bh-harbour' },
];
const MAP = {
  id: 'bh-map-harbour', file: 'maps/bh-harbour.webp', type: 'map', title: 'Brackwater harbour', alt: 'A harbour plan with nine moorings',
  visibility: 'revealable', playerVersionId: null, locationIds: ['bh-harbour', 'bh-quay'], keys: [{ key: '1', x: 0.25, y: 0.5 }], source: 'p. 12',
};
const pack = (images: unknown, locations: unknown = PLACES) => ({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Brackwater', version: '0.1', kind: 'adventure' }, locations, images });

describe('reading a pack’s maps', () => {
  // Purpose: a well-formed map is read whole: file, title, alt, its places and its page.
  it('reads a map’s file, title, alt, places and source', () => {
    expect(readPackMaps(pack([MAP]))).toEqual({
      maps: [{ id: 'bh-map-harbour', file: 'maps/bh-harbour.webp', title: 'Brackwater harbour', alt: 'A harbour plan with nine moorings', locationIds: ['bh-harbour', 'bh-quay'], source: 'p. 12' }],
      notes: [],
    });
  });

  // Purpose: alt is required (07 §9), so a map without one is skipped and the checker says why.
  it('skips a map with no alt, and says alt is required', () => {
    const read = readPackMaps(pack([{ ...MAP, alt: '  ' }]));
    expect(read.maps).toEqual([]);
    expect(read.notes).toEqual([`images: "bh-map-harbour" has no alt (words for someone who can't see the picture); alt is required, so it was skipped.`]);
  });

  // Purpose: a type the format doesn't know, or none, is skipped and said, naming the four it knows.
  it('skips an unknown or missing type, naming the types it knows', () => {
    const read = readPackMaps(pack([{ ...MAP, type: 'chart' }, { ...MAP, id: 'bh-map-two', type: undefined }]));
    expect(read.maps).toEqual([]);
    expect(read.notes).toEqual([
      `images: "bh-map-harbour": type "chart" isn't one the app knows (map, handout, art or crop); skipped.`,
      `images: "bh-map-two" has no type (map, handout, art or crop); skipped.`,
    ]);
  });

  // Purpose: a place a map names must be one of the pack's places; the map is still kept, and the line says which.
  it('says when a named place isn’t one of the pack’s places, and keeps the map', () => {
    const read = readPackMaps(pack([{ ...MAP, locationIds: ['bh-quay', 'bh-lighthouse'] }]));
    expect(read.maps.map((m) => m.locationIds)).toEqual([['bh-quay', 'bh-lighthouse']]);
    expect(read.notes).toEqual([`images: "bh-map-harbour" names place "bh-lighthouse", which isn't one of this pack's places.`]);
  });

  // Purpose: a map tied to no place is kept, but the checker says no place will offer it.
  it('says when a map names no place', () => {
    expect(readPackMaps(pack([{ ...MAP, locationIds: [] }])).notes).toEqual([`images: "bh-map-harbour" names no place (locationIds), so no place offers it.`]);
    expect(readPackMaps(pack([{ ...MAP, locationIds: 'bh-quay' }])).notes).toEqual([`images: "bh-map-harbour": locationIds should be a list of the pack's place ids; it belongs to no place.`]);
  });

  // Purpose: a map without a file can't be asked for, so it's skipped; one without a title shows its id.
  it('skips a map with no file, and names one with no title by its id', () => {
    expect(readPackMaps(pack([{ ...MAP, file: '' }]))).toEqual({ maps: [], notes: [`images: "bh-map-harbour" has no file (the picture's file name); skipped.`] });
    const untitled = readPackMaps(pack([{ ...MAP, title: undefined }]));
    expect(untitled.maps[0]?.title).toBe('bh-map-harbour');
    expect(untitled.notes).toEqual([`images: "bh-map-harbour" has no title; the GM sees its id.`]);
  });

  // Purpose: handouts, art and crops are valid in the format but not read yet: left out, said once with counts.
  it('leaves handouts, art and crops out in one line', () => {
    const read = readPackMaps(pack([MAP, { ...MAP, id: 'bh-art-1', type: 'art' }, { ...MAP, id: 'bh-art-2', type: 'art' }, { ...MAP, id: 'bh-crop-1', type: 'crop' }]));
    expect(read.maps.map((m) => m.id)).toEqual(['bh-map-harbour']);
    expect(read.notes).toEqual(['images: 2 art, 1 crop left out; the app reads maps only so far.']);
  });

  // Purpose: odd entries never throw: a non-list, a non-entry, a bad id and a repeat are each skipped and said.
  it('reads odd input without throwing', () => {
    expect(readPackMaps(pack('maps'))).toEqual({ maps: [], notes: ['images: should be a list of pictures, each { id, file, type, title, alt, locationIds }; none was read.'] });
    const read = readPackMaps(pack([7, { ...MAP, id: '' }, { ...MAP, id: 'Bad Id' }, MAP, MAP]));
    expect(read.maps).toHaveLength(1);
    expect(read.notes).toEqual([
      `images: entry 1 isn't a picture; skipped.`,
      'images: entry 2 has no id; skipped.',
      `images: "Bad Id" isn't a valid id (lowercase letters, digits and dashes); skipped.`,
      'images: entry 5 repeats "bh-map-harbour"; skipped (the first is kept).',
    ]);
    expect(readPackMaps(null)).toEqual({ maps: [], notes: [] });
  });

  // Purpose: the maps that belong to a place are found by its id in the pack.
  it('finds the maps for a place', () => {
    const { maps } = readPackMaps(pack([MAP, { ...MAP, id: 'bh-map-quay', locationIds: ['bh-quay'] }]));
    expect(mapsForPlace(maps, 'bh-quay').map((m) => m.id)).toEqual(['bh-map-harbour', 'bh-map-quay']);
    expect(mapsForPlace(maps, 'bh-harbour').map((m) => m.id)).toEqual(['bh-map-harbour']);
  });
});

describe('importing a pack’s maps', () => {
  // Purpose: the importer keeps each map as an entry of kind `map`, named by its title, with what the pack said of it.
  it('keeps each map as a `map` entry, with the pack’s other fields as written', () => {
    const read = readPackJson(JSON.stringify(pack([MAP, { ...MAP, id: 'bh-art-1', type: 'art' }])));
    if (!read.ok) throw new Error(read.message);
    const maps = read.pack.entries.filter((e) => e.kind === 'map');
    const asWritten: Record<string, unknown> = { ...MAP };
    delete asWritten.id;
    expect(maps).toEqual([{ kind: 'map', packEntryId: 'bh-map-harbour', name: 'Brackwater harbour', data: asWritten }]);
    expect(read.pack.counts.map).toBe(1);
    expect(read.pack.warnings).toEqual(['images: 1 art left out; the app reads maps only so far.']);
    expect(read.pack.warnings.join(' ')).not.toContain(`"images" isn't a part`);
    expect(readStoredMap(maps[0]!)).toMatchObject({ file: 'maps/bh-harbour.webp', alt: MAP.alt, locationIds: ['bh-harbour', 'bh-quay'] });
  });

  // Purpose: hidden means hidden: a map entry is the GM's alone, never a player-facing kind.
  it('is never player-facing', () => {
    expect(PLAYER_FACING).not.toContain('map');
    expect(playerFacingEntry('map', mapEntries(pack([MAP])).entries[0]!.data)).toBe(false);
  });

  // Purpose: exporting the pack writes its maps back under `images`, as they were read, with no name added.
  it('exports maps back as `images`', () => {
    const { entries } = mapEntries(pack([MAP]));
    const { file } = packFile({ name: 'Brackwater', version: '0.1', kind: 'adventure' }, entries);
    expect(file.images).toEqual([MAP]);
  });

  // Purpose: a stored entry with odd data reads back without throwing, its name standing in for a missing title.
  it('reads a stored map with odd data', () => {
    expect(readStoredMap({ packEntryId: 'bh-map-x', name: 'Harbour', data: null })).toEqual({ id: 'bh-map-x', file: '', title: 'Harbour', alt: '', locationIds: [], source: '' });
  });
});
