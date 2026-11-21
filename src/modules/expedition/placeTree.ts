// The attached packs' places as the picker and the place card read them (M8b slice 0, pull request 2; docs/plans/
// m8b-0-places-from-packs.md "The mockup", ⚑ 1 and ⚑ 10; docs/07 §2 `locations`). Pure: the tree by `parentId`, the
// words for a place (its name with its type; the parent when name and type both match; a hex's map number), search by
// name or map number, and "Near here" (the current place's own places and its neighbours). The pack's full entries
// stay in the library: the picker holds only these few fields per place, so 900 places fit on a phone.

/** One place of a pack, as the picker lists it (a few fields of the library entry, never its GM side). */
export interface PackPlace {
  packId: string;
  packName: string;
  /** The pack's kind (setting, homebrew, adventure); the picker's group is headed by the pack's name alone (2c). */
  packKind: string;
  entryId: string;
  name: string;
  type: string;
  parentId: string | null;
  /** The map label; a hex's map number (07 `key`). */
  key: string | null;
  /** The hex grid coordinate when the place is a hex. */
  hex: string | null;
  /** The pack marks it a settlement (07, G-157). */
  settlement: boolean;
  /** The terrain id the location names (pre-fills Move…), or null. */
  terrain: string | null;
}

/** The words for a type (07: region, site, area, floor, room, building); a hex is "Hex" (the mockup). */
export function typeWord(place: Pick<PackPlace, 'type' | 'hex'>): string {
  if (place.hex) return 'Hex';
  // p2p-1 (2026-11-18): on screen the pack's `site` is an Area and its `area` a Location; a Region stays a Region. The
  // pack's `type` values don't change.
  const words: Record<string, string> = { region: 'Region', site: 'Area', area: 'Location', floor: 'Floor', room: 'Room', building: 'Building' };
  return words[place.type] ?? 'Place';
}

/**
 * A keyed place's name for the screen (p2p-3, 2026-11-18): the key, the app's full stop, then the name ("1. The Jetty");
 * a name that already starts with its key, with or without the stop ("1 The Jetty", "1. The Jetty"), is not doubled; a
 * name that is only its key, and a name with no key, stay as they are. The name's capitals are the pack's. One helper
 * for the place page (`numberedName`) and Move on's rows (`DestinationRow`).
 */
export function keyedName(key: string | null | undefined, name: string): string {
  if (!key || name === key) return name;
  const rest = name.startsWith(`${key}. `) ? name.slice(key.length + 2) : name.startsWith(`${key} `) ? name.slice(key.length + 1) : name;
  return `${key}. ${rest}`;
}

/** A Location (p2p-1): the pack's `area` that isn't a hex. A hex reads "Hex" and waits for the wilderness sitting. */
export function isLocation(place: Pick<PackPlace, 'type' | 'hex'>): boolean {
  return place.type === 'area' && !place.hex;
}

/**
 * The places that are never a row to pick (p2p-2; the plan's ⚑ 6, ruled 2026-11-18): an Area (the pack's `site`) or a
 * Region with a Location under it, however deep. There the party stands only at a Location, so Move on always works.
 * Everything else stays as it was until the dungeon and wilderness sittings: a place with no Locations of its own (a
 * wilderness Region and its hexes, a dungeon's floors and rooms, an Area that holds none) is still a place to pick.
 */
export function holdersOfLocations(places: readonly PackPlace[]): ReadonlySet<PackPlace> {
  const idOf = (packId: string, entryId: string) => `${packId}\n${entryId}`;
  const byId = new Map(places.map((p) => [idOf(p.packId, p.entryId), p]));
  const holders = new Set<PackPlace>();
  // Each place is walked up from once: a chain already climbed (or a loop in a pack) ends the climb.
  const climbed = new Set<PackPlace>();
  for (const place of places) {
    if (!isLocation(place)) continue;
    let at = place.parentId ? byId.get(idOf(place.packId, place.parentId)) : undefined;
    while (at && !climbed.has(at)) {
      climbed.add(at);
      if (at.type === 'site' || at.type === 'region') holders.add(at);
      at = at.parentId ? byId.get(idOf(at.packId, at.parentId)) : undefined;
    }
  }
  return holders;
}

/** The places the party may be placed at: every place but those `holdersOfLocations` names. The list itself when none. */
export function pickablePlaces(places: readonly PackPlace[], holders: ReadonlySet<PackPlace> = holdersOfLocations(places)): readonly PackPlace[] {
  return holders.size === 0 ? places : places.filter((p) => !holders.has(p));
}

/** The place by pack and entry id (an index built once per list). */
export function placeOf(places: readonly PackPlace[], packId: string, entryId: string): PackPlace | undefined {
  return places.find((p) => p.packId === packId && p.entryId === entryId);
}

/** The children of a place (its own places), in the pack's order; hexes by map number (the mockup: what the map prints). */
export function childrenOf(places: readonly PackPlace[], parent: PackPlace | null, packId?: string): PackPlace[] {
  const found = places.filter((p) => (parent ? p.packId === parent.packId && p.parentId === parent.entryId : p.parentId === null && (!packId || p.packId === packId)));
  return sortHexes(found);
}

/** The roots of a pack: its places with no parent, or whose parent isn't in the pack (a drop-in place). */
export function rootsOf(places: readonly PackPlace[], packId: string): PackPlace[] {
  const ids = new Set(places.filter((p) => p.packId === packId).map((p) => p.entryId));
  return sortHexes(places.filter((p) => p.packId === packId && (p.parentId === null || !ids.has(p.parentId))));
}

function sortHexes(list: PackPlace[]): PackPlace[] {
  const hexes = list.filter((p) => p.hex).sort((a, b) => String(a.key ?? a.hex).localeCompare(String(b.key ?? b.hex), undefined, { numeric: true }));
  const rest = list.filter((p) => !p.hex);
  return [...rest, ...hexes];
}

/** The parent of a place, or null. */
export function parentOf(places: readonly PackPlace[], place: PackPlace): PackPlace | null {
  return place.parentId ? (placeOf(places, place.packId, place.parentId) ?? null) : null;
}

/** How many places sit under this one (its children only). */
export function countUnder(places: readonly PackPlace[], place: PackPlace): number {
  return places.filter((p) => p.packId === place.packId && p.parentId === place.entryId).length;
}

/**
 * A place's words (⚑ 10): "Oath Isle (Hex) · 0412"; when another place of the pack has the same name and type, its
 * parent follows ("Fish Market (Building), in Blackeswell"); the map number only when name, type and parent match.
 */
export function wordsFor(places: readonly PackPlace[], place: PackPlace): string {
  const kind = typeWord(place);
  const same = places.filter((p) => p.packId === place.packId && p !== place && p.name.toLowerCase() === place.name.toLowerCase() && typeWord(p) === kind);
  let words = `${place.name} (${kind})`;
  if (place.hex && place.key) words += `, ${place.key}`;
  if (same.length === 0) return words;
  const parent = parentOf(places, place);
  const sameParent = same.filter((p) => p.parentId === place.parentId);
  if (parent && sameParent.length < same.length) words = `${place.name} (${kind}), in ${parent.name}`;
  if (sameParent.length > 0 && !place.hex && place.key) words += `, ${place.key}`;
  return words;
}

/** The search: by name or map number, case-insensitive; names that start with the words first; at most `limit`. */
export function searchPlaces(places: readonly PackPlace[], query: string, limit = 50): PackPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: PackPlace[] = [];
  const within: PackPlace[] = [];
  for (const p of places) {
    const name = p.name.toLowerCase();
    const key = (p.key ?? '').toLowerCase();
    if (name.startsWith(q) || key === q) starts.push(p);
    else if (name.includes(q) || (key && key.includes(q))) within.push(p);
    if (starts.length >= limit) break;
  }
  return [...starts, ...within].slice(0, limit);
}

/** Near here: the current place's own places, then its neighbours (the other places under the same parent). */
export function nearHere(places: readonly PackPlace[], current: PackPlace | null): PackPlace[] {
  if (!current) return [];
  const own = childrenOf(places, current);
  const parent = parentOf(places, current);
  const siblings = parent ? childrenOf(places, parent).filter((p) => p !== current) : [];
  return [...own, ...siblings];
}

/** The chain of parents from the place up to the root (nearest first). */
export function ancestorsOf(places: readonly PackPlace[], place: PackPlace): PackPlace[] {
  const out: PackPlace[] = [];
  let at = parentOf(places, place);
  const seen = new Set<string>();
  while (at && !seen.has(at.entryId)) {
    out.push(at);
    seen.add(at.entryId);
    at = parentOf(places, at);
  }
  return out;
}

/** The packs that list places, each with its count, in the packs' order. */
export function packsWithPlaces(places: readonly PackPlace[]): { packId: string; name: string; kind: string; count: number }[] {
  const out = new Map<string, { packId: string; name: string; kind: string; count: number }>();
  for (const p of places) {
    const got = out.get(p.packId) ?? { packId: p.packId, name: p.packName, kind: p.packKind, count: 0 };
    got.count += 1;
    out.set(p.packId, got);
  }
  return [...out.values()];
}
