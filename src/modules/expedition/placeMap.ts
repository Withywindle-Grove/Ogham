// A place's map (December dec-7 piece 5m-2; docs/plans/dec-7-5-place-page-and-map.md; 07 Adventure packs §9; mc-32;
// mockup december/11, frames 2c and 4d, approved 2026-11-13, pg-1; supabase/migrations/…_dec_7_5m_2_place_map.sql).
// The pack names a map for a place (a library entry of kind `map`, 5m-1) and the file it is; the picture never comes
// with the pack. The GM picks the file once from their device: the app stores a smaller copy as the campaign's own map
// asset (kind 'map', visibility 'gm': the GM's alone until shared, 5m-3) and ties it to the place
// (places.map_asset_id). A place the GM made by hand may take a map the same way. Two commands, as a place's picture:
//   place.addMap uploads the copy: the asset row and its file. Making a file isn't undone; nothing is deleted once in.
//   place.setMap ties it to the place (null: takes it off), a logged change of the place: Undo puts the one before back.
//
// One copy per campaign (⚑ 1 of the plan, settled by frame 2c): a map that belongs to several of the pack's places is
// asked for once. The place it was added at holds the tie; every other place whose map it is finds it there.
import { defineCommand, failed, fromWrite, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import { assetPath, FILES_BUCKET, forgetFileLinks, PACK_FILES_BUCKET, packPicturePath } from '../../core/files.ts';
import type { Db } from '../../core/supabase.ts';
import { mapsForPlace, readStoredMap, type PackMap } from '../library/packMaps.ts';
import type { Place } from './placePlay.ts';

const gmOnly = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);

/** The map's copy: uploaded as the campaign's map asset, the GM's alone. Gives back the asset's id. */
export const addPlaceMap = defineCommand({
  name: 'place.addMap',
  log: 'verbose',
  target: (input: { campaignId: string; place: Pick<Place, 'id' | 'name'>; title: string; image: Blob }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const name = (input.title.trim() || input.place.name.trim() || 'A map').slice(0, 200);
    // A refusal (not the GM) says so; anything else is a plain "try again".
    const made = fromWrite(await db.from('assets').insert({ campaign_id: input.campaignId, kind: 'map', name, visibility: 'gm' }).select('id'));
    if (!made.ok) return made.reason === 'not-allowed' ? made : failed("Couldn't save the map. Try again.");
    const assetId = String(made.value.id);
    const upload = await db.storage
      .from(FILES_BUCKET)
      .upload(assetPath(input.campaignId, assetId), input.image, { upsert: true, contentType: input.image.type || 'image/jpeg' });
    if (upload.error) {
      // Nothing uploaded: the empty slot goes (it never held a picture).
      await db.from('assets').delete().eq('id', assetId);
      return failed("Couldn't upload the map. Check your connection and try again.");
    }
    return ok(assetId);
  },
});

/**
 * The place's map becomes this asset (null: the place has none tied). A logged change of the place, written from the
 * caller's copy as place.edit is: a place changed since says so ("That's changed since…"), and a player's write matches
 * no row, so the access rules refuse it. Undo puts the one before back.
 */
export const setPlaceMap = defineCommand({
  name: 'place.setMap',
  log: 'verbose',
  target: (input: { campaignId: string; place: Pick<Place, 'id' | 'version'>; assetId: string | null }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    const written = fromWrite(await db.from('places').update({ map_asset_id: input.assetId, version: input.place.version }).eq('id', input.place.id).select('id'));
    if (!written.ok) return written;
    if (input.assetId) forgetFileLinks(assetPath(input.campaignId, input.assetId));
    return ok(null);
  },
});

/**
 * The map's eye (5m-3; mc-44a; set 1's frame 3): the GM shares the campaign's copy with the players (`shown`) or takes it
 * back. It sets the copy's own visibility, `all` or `gm`, under the read rules as they stand (an asset shown to `all`
 * is read by every member of the campaign, row and file); a logged change of the asset, so Undo puts the one before
 * back. A player's write matches no row, so the access rules refuse it; so does a map of another campaign than the one
 * named (the GM's check is on the campaign named).
 */
export const shareMap = defineCommand({
  name: 'place.shareMap',
  log: 'verbose',
  target: (input: { campaignId: string; assetId: string; shown: boolean }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<null>> => {
    const written = fromWrite(await db.from('assets').update({ visibility: input.shown ? 'all' : 'gm' }).eq('id', input.assetId).eq('campaign_id', input.campaignId).eq('kind', 'map').select('id'));
    return written.ok ? ok(null) : written;
  },
});

/** Whether the campaign's copy of a map is shared with the players (its eye open); null when it can't be read. */
export async function loadMapShown(db: Db, assetId: string): Promise<boolean | null> {
  const { data, error } = await db.from('assets').select('visibility').eq('id', assetId).maybeSingle();
  if (error || !data) return null;
  return data.visibility === 'all';
}

/** The log line one run of the eye wrote, found by that run's own request id (so its Undo takes back that share and
 *  no other); null when there is none. */
export async function shareEventOf(db: Db, campaignId: string, requestId: string): Promise<string | null> {
  const { data, error } = await db.from('events').select('id').eq('campaign_id', campaignId).eq('type', shareMap.name).eq('request_id', requestId).limit(1);
  return error || !data?.[0] ? null : (data[0] as { id: string }).id;
}

/** Registered by the expedition module (index.ts), beside PLACE_COMMANDS. */
export const PLACE_MAP_COMMANDS = [addPlaceMap, setPlaceMap, shareMap] as const;

/** A place's map as the GM's page shows it. */
export type PlaceMapState =
  /** No map: the pack names none for this place (or it's a place made by hand with none tied). Nothing is drawn. */
  | { kind: 'none' }
  /** The pack names a map and this campaign has no copy yet (frame 2c): its title, its file, and "+ Map". */
  | { kind: 'wanted'; map: PackMap; from?: string; packed?: string }
  /** The campaign's copy: its asset, with the title and words for a screen reader. */
  | { kind: 'added'; assetId: string; title: string; alt: string; from?: string };
// `packed` (B14, p2p-27): the picture came with the pack (its path in `pack-files`), so "+ Map" takes it from there with
// no file to pick; absent, the GM picks the file by hand as before (a pack with no pictures, or a missing one).
// `from` (S13, mc-58, frame 1b): the pack entry of the place up the trail whose map this is, when it isn't the place's
// own (a spot no map names shows the map of the place it is in).

/** A pack place's entry id, then those of the places it is in, nearest first (S13). Alone: the place's own only. */
export type UpTrail = (entryId: string) => readonly string[];
const ownOnly: UpTrail = (entryId) => [entryId];

/** One of the campaign's places as the map's tie reads it. */
export interface PlaceMapRow {
  id: string;
  packId: string | null;
  entryId: string | null;
  mapAssetId: string | null;
}

/**
 * The map that is a pack place's own: the first of its pack's maps that names it, in the order given (the stored
 * entries keep no file order, so the read sorts them by entry id: a place two maps name shows one; accepted, mp-1).
 */
function ownMap(maps: readonly PackMap[], row: Pick<PlaceMapRow, 'entryId'>, upTrail: UpTrail = ownOnly): { map: PackMap; from: string } | null {
  if (!row.entryId) return null;
  for (const id of upTrail(row.entryId)) {
    const map = mapsForPlace(maps, id)[0];
    if (map) return { map, from: id };
  }
  return null;
}

/**
 * A place's map: the one tied to it; else, for a pack's place, the map its pack names for it (ownMap), as the copy another place of the campaign already holds, or wanted. `maps` are the place's pack's maps;
 * `places` the campaign's places (any order; the place itself among them or not); `assetNames` the tied copies' names
 * (a hand-made place's map has no pack entry to take its title from). Pure.
 */
export function resolvePlaceMap(
  place: PlaceMapRow,
  maps: readonly PackMap[],
  places: readonly PlaceMapRow[],
  assetNames: ReadonlyMap<string, string> = new Map(),
  upTrail: UpTrail = ownOnly,
): PlaceMapState {
  const found = place.packId ? ownMap(maps, place, upTrail) : null;
  const map = found?.map ?? null;
  // Whose map it is, when it is a place's up the trail rather than this one's own (S13).
  const from = found && found.from !== place.entryId ? { from: found.from } : {};
  const added = (assetId: string): PlaceMapState => {
    const title = map?.title ?? assetNames.get(assetId) ?? 'The map';
    return { kind: 'added', assetId, title, alt: map?.alt || `${title}, the map`, ...from };
  };
  if (place.mapAssetId) return added(place.mapAssetId);
  if (!map) return { kind: 'none' };
  // The copy another of the pack's places already holds: one whose map (its own, or a place's up its trail) is this one.
  const held = places.find((p) => p.id !== place.id && p.mapAssetId && p.packId === place.packId && ownMap(maps, p, upTrail)?.map.id === map.id);
  return held?.mapAssetId ? added(held.mapAssetId) : { kind: 'wanted', map, ...from };
}

/**
 * The GM's read of a place's map: the campaign's places (their pack link and tie), the place's pack's map entries and
 * the tied copies' names; null when it couldn't be read. The GM's alone (places and map entries are the GM's to read).
 */
export async function loadPlaceMap(db: Db, campaignId: string, place: Pick<Place, 'id' | 'pack'>, upTrail: UpTrail = ownOnly): Promise<PlaceMapState | null> {
  const rows = await db.from('places').select('id, pack_id, pack_entry_id, map_asset_id').eq('campaign_id', campaignId).eq('undone', false);
  if (rows.error || !rows.data) return null;
  const places: PlaceMapRow[] = rows.data.map((r) => ({
    id: String(r.id),
    packId: r.pack_id ? String(r.pack_id) : null,
    entryId: r.pack_entry_id ? String(r.pack_entry_id) : null,
    mapAssetId: r.map_asset_id ? String(r.map_asset_id) : null,
  }));
  const self = places.find((p) => p.id === place.id) ?? { id: place.id, packId: place.pack?.packId ?? null, entryId: place.pack?.entryId ?? null, mapAssetId: null };
  let maps: PackMap[] = [];
  if (self.packId) {
    const entries = await db.from('library_entries').select('pack_entry_id, name, data').eq('pack_id', self.packId).eq('kind', 'map').order('pack_entry_id');
    if (entries.error) return null;
    maps = (entries.data ?? []).map((e) => readStoredMap({ packEntryId: String(e.pack_entry_id), name: String(e.name ?? ''), data: e.data }));
  }
  const state = resolvePlaceMap(self, maps, places, new Map(), upTrail);
  // The pack's picture is offered only for a place that is a row of the campaign (the tie is written on that row).
  if (state.kind === 'wanted' && self.packId && places.some((p) => p.id === place.id)) {
    const kept = await db.storage.from(PACK_FILES_BUCKET).list(self.packId, { search: state.map.id });
    return kept.data?.some((file) => file.name === state.map.id) ? { ...state, packed: packPicturePath(self.packId, state.map.id) } : state;
  }
  if (state.kind !== 'added' || ownMap(maps, self, upTrail)) return state;
  // A hand-made place's map (or one whose pack entry is gone): its title is the copy's own name.
  const asset = await db.from('assets').select('name').eq('id', state.assetId).maybeSingle();
  const name = asset.data?.name ? String(asset.data.name) : '';
  return name ? resolvePlaceMap(self, maps, places, new Map([[state.assetId, name]]), upTrail) : state;
}

/** The picture that came with the pack for a wanted map (its `packed` path); null when it can't be fetched. */
export async function loadPackPicture(db: Db, path: string): Promise<Blob | null> {
  const { data, error } = await db.storage.from(PACK_FILES_BUCKET).download(path);
  return error ? null : data;
}

/** The map a group's players see (P5): the campaign's copy, shown to them, of the last place shown to the group. */
export interface PlayersMap {
  assetId: string;
  title: string;
}

/**
 * The maps a player reads, by group (public.map_for_players; plan dec-9-the-players-scene P5, Francis's yes "1a",
 * 2026-11-22): only a copy whose eye is open, of the last place shown to one of their groups; null when it can't be read.
 */
export async function loadPlayersMaps(db: Db, campaignId: string): Promise<Map<number, PlayersMap> | null> {
  const { data, error } = await db.rpc('map_for_players', { campaign: campaignId });
  if (error) return null;
  return new Map((data ?? []).map((r) => [Number(r.group_number), { assetId: String(r.asset_id), title: String(r.title ?? '') }]));
}
