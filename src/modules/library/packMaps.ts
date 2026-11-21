// A pack's maps (07 Adventure packs §9, ruling 9; plans/dec-7-5-place-page-and-map.md piece 5m-1): the `images` of
// type `map`, `images: [{ id, file, type, title, alt, visibility, playerVersionId, locationIds, keys?, source }]` at the
// top of an adventure pack. The picture files never come with the pack: they stay with the GM, who picks one for a
// place from their device (piece 5m-2); the entry says which file and which places.
//
// Pure, shared by the app's importer (packFile.ts) and the pack checker (it prints the importer's warnings). Kept as
// library entries of kind `map`, which is not player-facing: the database's read rule on library entries keeps every
// map entry from players (hard rule 5). A map reaches players only as the campaign's own copy, once the GM shares it.
//
// The checker's rules (5m-1): a type it knows; `alt` required; each named place is one of the pack's places. Only maps
// are read so far: a handout, art or a crop is valid in the format and left out, said once.
import { ID } from './entryId.ts';
import type { PackEntry } from './packFile.ts';

/** The types an image may have (07 §9). */
export const IMAGE_TYPES = ['map', 'handout', 'art', 'crop'] as const;

/** One map as the app reads it. */
export interface PackMap {
  id: string;
  /** The file's name as the pack gives it ("maps/abbey-lower.webp"): what the GM is asked for. */
  file: string;
  /** Its title; the id when the pack gives none. */
  title: string;
  /** Words for someone who can't see the picture. */
  alt: string;
  /** The places it belongs to (location ids in the pack), in the pack's order. */
  locationIds: string[];
  /** Where it is in the book ("p. 29"); empty without one. */
  source: string;
}

export interface PackMapsRead {
  maps: PackMap[];
  /** What was off, one line each, in the checker's words ("images: …"). */
  notes: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const words = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** The ids of the pack's own places. */
function placeIds(file: Record<string, unknown>): Set<string> {
  const locations = Array.isArray(file.locations) ? file.locations.filter(isObject) : [];
  return new Set(locations.map((l) => words(l.id)).filter(Boolean));
}

/** A pack file's maps, in the file's order. Never throws on odd input. */
export function readPackMaps(file: unknown): PackMapsRead {
  const maps: PackMap[] = [];
  const notes: string[] = [];
  if (!isObject(file) || file.images === undefined) return { maps, notes };
  if (!Array.isArray(file.images)) return { maps, notes: ['images: should be a list of pictures, each { id, file, type, title, alt, locationIds }; none was read.'] };
  const places = placeIds(file);
  const seen = new Set<string>();
  const notMaps: Record<string, number> = {};
  file.images.forEach((raw: unknown, index: number) => {
    if (!isObject(raw)) return notes.push(`images: entry ${index + 1} isn't a picture; skipped.`);
    const id = words(raw.id);
    if (!id) return notes.push(`images: entry ${index + 1} has no id; skipped.`);
    if (!ID.test(id)) return notes.push(`images: "${id}" isn't a valid id (lowercase letters, digits and dashes); skipped.`);
    if (seen.has(id)) return notes.push(`images: entry ${index + 1} repeats "${id}"; skipped (the first is kept).`);
    seen.add(id);
    const where = `images: "${id}"`;
    const type = words(raw.type);
    if (!(IMAGE_TYPES as readonly string[]).includes(type)) {
      return notes.push(type ? `${where}: type "${type}" isn't one the app knows (map, handout, art or crop); skipped.` : `${where} has no type (map, handout, art or crop); skipped.`);
    }
    const alt = words(raw.alt);
    if (!alt) notes.push(`${where} has no alt (words for someone who can't see the picture); alt is required, so it was skipped.`);
    if (type !== 'map') {
      notMaps[type] = (notMaps[type] ?? 0) + 1;
      return;
    }
    const fileName = words(raw.file);
    if (!fileName) notes.push(`${where} has no file (the picture's file name); skipped.`);
    if (!alt || !fileName) return;
    const title = words(raw.title);
    if (!title) notes.push(`${where} has no title; the GM sees its id.`);
    let locationIds: string[] = [];
    if (raw.locationIds !== undefined && !Array.isArray(raw.locationIds)) notes.push(`${where}: locationIds should be a list of the pack's place ids; it belongs to no place.`);
    else {
      locationIds = [...new Set((Array.isArray(raw.locationIds) ? raw.locationIds : []).map(words).filter(Boolean))];
      if (locationIds.length === 0) notes.push(`${where} names no place (locationIds), so no place offers it.`);
      for (const place of locationIds.filter((p) => !places.has(p))) notes.push(`${where} names place "${place}", which isn't one of this pack's places.`);
    }
    maps.push({ id, file: fileName, title: title || id, alt, locationIds, source: words(raw.source) });
  });
  const left = Object.entries(notMaps);
  if (left.length > 0) {
    // "2 handouts, 3 art, 1 crop": art has no plural.
    const what = left.map(([type, n]) => `${n} ${type === 'art' ? 'art' : n === 1 ? type : `${type}s`}`).join(', ');
    notes.push(`images: ${what} left out; the app reads maps only so far.`);
  }
  return { maps, notes };
}

/**
 * The importer's entries for a pack's maps: one `map` entry each, named by its title, its data the picture as read
 * (file, title, alt, locationIds, source) plus what else the pack said of it (visibility, playerVersionId, keys…), kept
 * as written for the pieces that read it later. The reader's notes are the import's warnings.
 */
export function mapEntries(file: unknown): { entries: PackEntry[]; notes: string[] } {
  const { maps, notes } = readPackMaps(file);
  const raws = isObject(file) && Array.isArray(file.images) ? file.images.filter(isObject) : [];
  const entries: PackEntry[] = maps.map((map) => {
    const raw = raws.find((r) => words(r.id) === map.id) ?? {};
    const rest: Record<string, unknown> = { ...raw };
    delete rest.id;
    return { kind: 'map', packEntryId: map.id, name: map.title, data: { ...rest, file: map.file, title: map.title, alt: map.alt, locationIds: map.locationIds, source: map.source } };
  });
  return { entries, notes };
}

/** A stored map entry read back on the GM's device. Never throws on odd data. */
export function readStoredMap(entry: { packEntryId: string; name: string; data: unknown }): PackMap {
  const data = isObject(entry.data) ? entry.data : {};
  return {
    id: entry.packEntryId,
    file: words(data.file),
    title: words(data.title) || words(entry.name) || entry.packEntryId,
    alt: words(data.alt),
    locationIds: Array.isArray(data.locationIds) ? data.locationIds.map(words).filter(Boolean) : [],
    source: words(data.source),
  };
}

/** The maps that belong to a place (by its id in the pack), in the pack's order. */
export function mapsForPlace(maps: readonly PackMap[], locationId: string): PackMap[] {
  return maps.filter((map) => map.locationIds.includes(locationId));
}
