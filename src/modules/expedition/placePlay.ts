// Places per group (M5 step 11; ruled 2026-10-30, DG9, DG11, DG14; 2026-10-31, B1, and Francis's ruling that a
// shown place is visible to its group's players only; docs/05 "Places for players", "The room's GM layer", "Split
// the party"; supabase/migrations/…_m5_places_messages.sql). During an expedition each group has a current place:
// Start expedition's Where? puts every group there, Where now? moves one group (place.set), and the GM's Show
// players / Hide (place.show, place.hide) share its name and description with that group's players. The GM's notes
// on a place (traps, puzzles, encounters, treasure, doors) never leave the GM's device. Join up is for groups in the
// same place (a player; the GM may join any). Everything is logged (Simple; place.edit Verbose) and undoable.
// Pieces (M5b step g2; ruled 2026-11-01, M5 gate B1; supabase/migrations/…_m5b_g2_place_pieces.sql): a place is a
// list of pieces (description, exits, people, clues, treasure, hazards), each shown to the group in focus on its own
// (place.showPiece / place.hidePiece, Verbose), Hide all in one line (place.hideAll), + Piece by hand
// (place.addPiece). A player's device receives only the shown pieces, with the place's name, in the order shown
// (public.scene_pieces); never an unshown piece, the GM-only facts (value, trigger, stat line) or another group's.
// After they're added (M5b step g2b; ruled 2026-11-02, gp-1 … gp-6; supabase/migrations/…_m5b_g2b_pieces_follow_up.sql):
// a piece is edited in place (place.editPiece, kind and text; Undo restores the old), removed by its undone flag
// (place.removePiece: retired, never deleted; Undo brings it back with its shows), and a return visit to a place
// starts with what was shown at the end of its last visit (place.backAt, one line with Undo, written by Where now?
// as its own request so the log line and its Undo are its own). place.show / place.hide (the whole place, M5 step
// 11) are retired: unregistered, their logged_commands rows deleted; events.ts keeps their words for old lines.
import { defineCommand, failed, fromError, fromWrite, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import { taggedDb } from '../../core/eventTags.ts';
import { fileLinks } from '../../core/files.ts';
import type { Db } from '../../core/supabase.ts';
import { addPlacePicture, setPlacePicture } from './placePicture.ts';
import { makePlaceInRequest, type PackPlaceEntry } from './placeFromPack.ts';
import type { PackPlace } from './placeTree.ts';
import { readTable, type ReadTable } from './tables.ts';
import { readTownState, type TownState } from './town.ts';
import { plainLinks } from '../library/linkMarks.ts';

/** The headings the GM's notes on a place sit under (R1 text; structured in R2, DG13), in order. */
export const NOTE_HEADINGS = ['traps', 'puzzles', 'encounters', 'treasure', 'doors'] as const;
export type NoteHeading = (typeof NOTE_HEADINGS)[number];
export type PlaceNotes = Record<NoteHeading, string>;

export const NOTE_WORDS: Record<NoteHeading, string> = { traps: 'Traps', puzzles: 'Puzzles', encounters: 'Encounters', treasure: 'Treasure', doors: 'Doors' };

/** The longest description and note the database takes. */
export const PLACE_TEXT_MAX = 4000;

/** A place the GM named: what players see once shown, and (the GM's alone) the notes. */
export interface Place {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  /** The GM's notes; null on a player's device (they never receive them). */
  notes: PlaceNotes | null;
  version: number;
  notesVersion: number;
  /** Safe or Hostile (M5b step 6b; ST2, dt-9), the GM's: arriving somewhere safe raises the arrival card; null: neither. */
  safety?: Safety;
  /** The places in town as the GM set them (M5b step 6c, ST3; places.town): shown to players, open or closed. */
  town?: TownState;
  /**
   * The pack's location this place was made from (M8b slice 0; ⚑ 10): the GM's pack and the entry's id in it (the
   * link), and the pack's type, parent and map key for telling same names apart. Null: a place typed by name.
   */
  pack?: PackLink | null;
  /** What players see as the name once a piece is shown (⚑ 3, C): '' means the place's name. */
  playersName?: string;
  /** The region whose encounter tables come first after a hit here (⚑ 7); '' if none known. */
  regionId?: string;
  /** The terrain the place is in (pre-fills Move…); '' if none. */
  terrainId?: string;
  /** The pack marks it a settlement (07 G-157; M8b slice 0, pull request 2): the town screen shows here. Null: not one. */
  settlement?: Settlement | null;
}

/** A settlement as the pack marks it: its size (one of the rules set's sizes) and, for the GM's card, its population. */
export interface Settlement {
  size: string;
  population: number | null;
}

/** Where a place came from in a pack (places.pack_id, pack_entry_id, pack_type, pack_parent_id, pack_key). */
export interface PackLink {
  packId: string;
  entryId: string;
  type: string;
  parentId: string;
  key: string;
}

/** The columns of a place the GM's screens read. */
export const PLACE_COLUMNS = 'id, campaign_id, name, description, version, safety, town, pack_id, pack_entry_id, pack_type, pack_parent_id, pack_key, players_name, region_id, terrain_id, settlement';

const asSettlement = (value: unknown): Settlement | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  return typeof v.size === 'string' && v.size ? { size: v.size, population: typeof v.population === 'number' ? v.population : null } : null;
};

/** The place is a settlement: marked so by its pack, or (older places, M5b 6b) marked Safe or Hostile by the GM. */
export const isSettlement = (place: Pick<Place, 'settlement' | 'safety'> | null | undefined): boolean => !!place && (!!place.settlement || !!place.safety);

/** A place's safety (ST2): 'safe', 'hostile', or null (an ordinary place). */
export type Safety = 'safe' | 'hostile' | null;
const asSafety = (value: unknown): Safety => (value === 'safe' || value === 'hostile' ? value : null);

/** The kinds of piece, in the order + Piece offers them. */
export const PIECE_KINDS = ['description', 'exit', 'person', 'clue', 'treasure', 'hazard', 'other'] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];

/** Each kind's word on the card (a person is "Someone here": the name never shows). */
export const PIECE_KIND_WORDS: Record<PieceKind, string> = {
  description: 'Description',
  exit: 'Exit',
  person: 'Someone here',
  clue: 'Clue',
  treasure: 'Treasure',
  hazard: 'Hazard',
  other: 'Other',
};

/** The longest piece the database takes. */
export const PIECE_TEXT_MAX = 4000;

const asKind = (value: unknown): PieceKind => (PIECE_KINDS.includes(value as PieceKind) ? (value as PieceKind) : 'other');

/** A piece of a place, as the GM sees it for one group's visit. */
export interface Piece {
  id: string;
  kind: PieceKind;
  text: string;
  /**
   * The piece's bold lead-in, players' words (pf-3: a pack aspect's lead, "Sign"); '' for a piece without one (every
   * piece typed by hand). Made with the piece and never edited.
   */
  lead?: string;
  /** Shown to this group's players now, and when (their order). */
  shown: boolean;
  shownAt: string | null;
  /** The GM's alone, never shown (a treasure's value, a hazard's trigger, a person's stat line); '' if none. */
  gm: { value: string; trigger: string; statLine: string };
  /** The piece's version (an edit from an old copy is refused). */
  version: number;
}

/** Where a group is now: its row, and the place (null: somewhere unnamed, or a place the reader may not see). */
export interface GroupPlace {
  id: string;
  campaignId: string;
  expeditionId: string;
  group: number;
  placeId: string | null;
  shown: boolean;
  place: Place | null;
  /** The place's pieces in the GM's order, each with whether this group sees it (the GM's; empty for a player). */
  pieces: Piece[];
  /**
   * The place's picture (M5b step 1 follow-up; ruled B 2026-11-03): a piece of its own kind, shown to this group with
   * its own eye like a piece; null (or left out) if the place has none.
   */
  picture?: PicturePiece | null;
}

/** A place's picture as a piece: its file (an asset of kind 'place') and whether this group sees it. */
export interface PicturePiece {
  id: string;
  assetId: string;
  shown: boolean;
  shownAt: string | null;
}

/** How many of the pieces this group's players see (the card's "N of M pieces shown"). */
export const shownCount = (pieces: readonly Piece[]): number => pieces.filter((p) => p.shown).length;

const text = (value: unknown) => (typeof value === 'string' ? value : '');
/** A piece's lead-in (2c, pf-3) only when it has one: a piece without one reads exactly as before. */
const leadOf = (value: unknown): { lead?: string } => (typeof value === 'string' && value ? { lead: value } : {});
const num = (value: unknown, fallback = 1) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

export function toPlace(row: Record<string, unknown>, notes: Record<string, unknown> | null): Place {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    name: text(row.name),
    description: text(row.description),
    notes: notes ? (Object.fromEntries(NOTE_HEADINGS.map((h) => [h, text(notes[h])])) as PlaceNotes) : null,
    version: num(row.version),
    notesVersion: num(notes?.version),
    safety: asSafety(row.safety),
    town: readTownState(row.town),
    pack: typeof row.pack_id === 'string' && typeof row.pack_entry_id === 'string' ? { packId: row.pack_id, entryId: row.pack_entry_id, type: text(row.pack_type), parentId: text(row.pack_parent_id), key: text(row.pack_key) } : null,
    playersName: text(row.players_name),
    regionId: text(row.region_id),
    terrainId: text(row.terrain_id),
    settlement: asSettlement(row.settlement),
  };
}

/** The places the GM named or picked before, newest first, each once, at most `limit` (the picker's Recently visited). */
export async function loadRecentPlaceRows(db: Db, campaignId: string, limit = 8): Promise<Place[]> {
  const { data, error } = await db.from('places').select(PLACE_COLUMNS).eq('campaign_id', campaignId).eq('undone', false).order('updated_at', { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data.map((row) => toPlace(row as Record<string, unknown>, null));
}

/**
 * The attached packs' places as the picker lists them (M8b slice 0, pull request 2): a few fields of each location
 * entry (never its GM side; the GM's device alone reads them), with the pack's name and kind. Null if it couldn't be
 * loaded. Cached per campaign while the campaign's packs don't change (`forgetPackPlaces`).
 */
export async function loadPackPlaces(db: Db, campaignId: string): Promise<PackPlace[] | null> {
  const cached = packPlacesCache.get(campaignId);
  if (cached) return cached;
  const links = await db.from('campaign_packs').select('pack_id, pack_name, packs(kind)').eq('campaign_id', campaignId).order('priority');
  if (links.error) return null;
  const packs = (links.data ?? []).map((l) => ({ id: String(l.pack_id), name: String(l.pack_name), kind: String((l.packs as { kind?: unknown } | null)?.kind ?? 'setting') }));
  if (packs.length === 0) return [];
  const out: PackPlace[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const page = await db
      .from('library_entries')
      .select('pack_id, pack_entry_id, name, type:data->type, parent:data->parentId, key:data->key, hex:data->hex, terrain:data->terrain, settlement:data->settlement')
      .in('pack_id', packs.map((p) => p.id))
      .eq('kind', 'location')
      .order('id')
      .range(from, from + PAGE - 1);
    if (page.error) return null;
    for (const row of page.data ?? []) {
      const r = row as Record<string, unknown>;
      const pack = packs.find((p) => p.id === String(r.pack_id));
      if (!pack) continue;
      out.push({
        packId: pack.id,
        packName: pack.name,
        packKind: pack.kind,
        entryId: String(r.pack_entry_id),
        name: text(r.name),
        type: text(r.type),
        parentId: text(r.parent) || null,
        key: text(r.key) || null,
        hex: text(r.hex) || null,
        settlement: !!r.settlement && typeof r.settlement === 'object',
        terrain: text(r.terrain) || null,
      });
    }
    if ((page.data ?? []).length < PAGE) break;
  }
  packPlacesCache.set(campaignId, out);
  return out;
}
const packPlacesCache = new Map<string, PackPlace[]>();
/** Forget the cached list (the campaign's packs changed, or a test). */
export const forgetPackPlaces = (campaignId?: string) => (campaignId ? packPlacesCache.delete(campaignId) : packPlacesCache.clear());

/** One location entry whole (its GM side included), for the pick: null when it isn't there. */
export async function loadPackPlaceEntry(db: Db, packId: string, entryId: string): Promise<PackPlaceEntry | null> {
  const { data, error } = await db.from('library_entries').select('pack_id, pack_entry_id, name, data').eq('pack_id', packId).eq('kind', 'location').eq('pack_entry_id', entryId).maybeSingle();
  if (error || !data) return null;
  return { packId: String(data.pack_id), packEntryId: String(data.pack_entry_id), name: text(data.name), data: (data.data ?? {}) as Record<string, unknown> };
}

/**
 * Each place's one line, by its pack id, for the GM's "Spots here" (dec-7 piece 5b, page 11 frame 8): the entry's
 * `identity` as the pack writes it, a link's marks read as their words. Only the places that have one; an empty map
 * when they can't be read (the rows then show their names alone).
 */
export async function loadPlaceLines(db: Db, packId: string, ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data, error } = await db.from('library_entries').select('pack_entry_id, identity:data->identity').eq('pack_id', packId).eq('kind', 'location').in('pack_entry_id', [...ids]);
  if (error) return out;
  for (const row of data ?? []) {
    const line = plainLinks(text((row as Record<string, unknown>).identity).trim());
    if (line) out.set(String(row.pack_entry_id), line);
  }
  return out;
}

/**
 * A pack's tables by id, read for the place panel (December piece 2c: a place's `tableIds` and the tables its text
 * links to). Only the ones the pack has; an empty map when none could be read (the panel says so).
 */
export async function loadPackTables(db: Db, packId: string, ids: readonly string[]): Promise<Map<string, ReadTable>> {
  const out = new Map<string, ReadTable>();
  if (ids.length === 0) return out;
  const { data, error } = await db.from('library_entries').select('pack_entry_id, name, data').eq('pack_id', packId).eq('kind', 'table').in('pack_entry_id', [...ids]);
  if (error) return out;
  for (const row of data ?? []) {
    const table = readTable(String(row.pack_entry_id), text(row.name), (row.data ?? {}) as Record<string, unknown>);
    if (table) out.set(String(row.pack_entry_id), table);
  }
  return out;
}

/** A stat block's name in a pack (the watch's "In a fight"); '' when it isn't there (its id is never shown). */
export async function loadStatBlockName(db: Db, packId: string, id: string): Promise<string> {
  if (!id) return '';
  const { data, error } = await db.from('library_entries').select('name').eq('pack_id', packId).eq('kind', 'statBlock').eq('pack_entry_id', id).maybeSingle();
  return error || !data ? '' : text(data.name);
}

/**
 * The region the party is in (⚑ 7): the region of the first group's current place in the expedition under way,
 * so the region's own encounter tables are offered first after a hit. Null when none is known.
 */
export async function loadRegionNow(db: Db, campaignId: string, expeditionId: string): Promise<string | null> {
  const rows = await db.from('group_places').select('group_number, place_id, created_at').eq('campaign_id', campaignId).eq('expedition_id', expeditionId).eq('undone', false).eq('moved_on', false).order('group_number').order('created_at', { ascending: false });
  if (rows.error) return null;
  const first = (rows.data ?? [])[0];
  if (!first?.place_id) return null;
  const place = await db.from('places').select('region_id').eq('id', String(first.place_id)).maybeSingle();
  return place.error ? null : text(place.data?.region_id) || null;
}

/**
 * Each group's current place in the expedition under way, by group number (only the groups the reader may read:
 * the GM every group, a player their own). Its place comes with it when the reader may see it (the GM always; a
 * player only while it's shown to them). Null if it couldn't be loaded.
 */
export async function loadGroupPlaces(db: Db, campaignId: string, expeditionId: string): Promise<Map<number, GroupPlace> | null> {
  const rows = await db
    .from('group_places')
    .select('id, campaign_id, expedition_id, group_number, place_id, shown, created_at')
    .eq('campaign_id', campaignId)
    .eq('expedition_id', expeditionId)
    .eq('undone', false)
    .eq('moved_on', false)
    .order('created_at', { ascending: false });
  if (rows.error) return null;
  const current = new Map<number, Record<string, unknown>>();
  for (const row of rows.data ?? []) if (!current.has(row.group_number)) current.set(row.group_number, row);
  const ids = [...new Set([...current.values()].map((r) => r.place_id).filter((id): id is string => typeof id === 'string'))];
  const visits = [...current.values()].map((r) => String(r.id));
  const [places, notes, pieces, shows] = ids.length
    ? await Promise.all([
        db.from('places').select(PLACE_COLUMNS).in('id', ids),
        db.from('place_notes').select('id, traps, puzzles, encounters, treasure, doors, version').in('id', ids),
        db
          .from('place_pieces')
          .select('id, place_id, kind, body, lead, position, gm_value, gm_trigger, gm_stat_line, version, created_at, asset_id')
          .in('place_id', ids)
          .eq('undone', false)
          .order('position')
          .order('created_at'),
        db.from('piece_shows').select('group_place_id, piece_id, shown, shown_at').in('group_place_id', visits).eq('undone', false),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  if (places.error || pieces.error || shows.error) return null;
  const showOf = new Map((shows.data ?? []).map((s) => [`${String(s.group_place_id)}:${String(s.piece_id)}`, s]));
  const piecesOf = (placeId: string, visit: string): Piece[] =>
    (pieces.data ?? [])
      .filter((p) => p.place_id === placeId && p.kind !== 'picture')
      .map((p) => {
        const show = showOf.get(`${visit}:${String(p.id)}`);
        return {
          id: String(p.id),
          kind: asKind(p.kind),
          text: text(p.body),
          ...leadOf(p.lead),
          shown: show?.shown === true,
          shownAt: show?.shown === true ? String(show.shown_at) : null,
          gm: { value: text(p.gm_value), trigger: text(p.gm_trigger), statLine: text(p.gm_stat_line) },
          version: num(p.version),
        };
      });
  // The place's picture piece (the newest, should there be more than one), with this visit's show.
  const pictureOf = (placeId: string, visit: string): PicturePiece | null => {
    const p = (pieces.data ?? []).filter((x) => x.place_id === placeId && x.kind === 'picture' && typeof x.asset_id === 'string').at(-1);
    if (!p) return null;
    const show = showOf.get(`${visit}:${String(p.id)}`);
    return { id: String(p.id), assetId: String(p.asset_id), shown: show?.shown === true, shownAt: show?.shown === true ? String(show.shown_at) : null };
  };
  const notesOf = new Map((notes.data ?? []).map((n) => [String(n.id), n as Record<string, unknown>]));
  const placeOf = new Map((places.data ?? []).map((p) => [String(p.id), toPlace(p as Record<string, unknown>, notesOf.get(String(p.id)) ?? null)]));
  return new Map(
    [...current.entries()].map(([group, row]) => {
      const placeId = typeof row.place_id === 'string' ? row.place_id : null;
      return [
        group,
        {
          id: String(row.id),
          campaignId: String(row.campaign_id),
          expeditionId: String(row.expedition_id),
          group,
          placeId,
          shown: row.shown === true,
          place: (placeId && placeOf.get(placeId)) || null,
          pieces: placeId ? piecesOf(placeId, String(row.id)) : [],
          picture: placeId ? pictureOf(placeId, String(row.id)) : null,
        } satisfies GroupPlace,
      ];
    }),
  );
}

/** What a group's players see of their place: its name and the shown pieces, in the order shown. */
export interface ScenePlace {
  group: number;
  name: string;
  /** The shown pieces, each with its lead-in ('' if none). */
  pieces: { id: string; kind: PieceKind; text: string; lead?: string }[];
  /** The place's picture, while the place is shown to the group (public.scene_pictures); null if none. */
  pictureAssetId: string | null;
  /**
   * The place's campaign id, found through its shown pieces in public.known_places_campaign (which already sends it
   * with them): what the players' place card's read is matched by (P4). Absent when that read failed.
   */
  placeId?: string | null;
}

/**
 * A player's view (public.scene_pieces): for each of their groups shown something, the place's name and the shown
 * pieces in the order shown; nothing else about any place. Null if it couldn't be loaded.
 */
export async function loadScenePlaces(db: Db, campaignId: string): Promise<Map<number, ScenePlace> | null> {
  const [{ data, error }, pictures, known] = await Promise.all([
    db.rpc('scene_pieces', { campaign: campaignId }),
    db.rpc('scene_pictures', { campaign: campaignId }),
    db.rpc('known_places_campaign', { campaign: campaignId }),
  ]);
  if (error) return null;
  // The pictures are extra: when they can't be read the place still shows, without its picture.
  const pictureOf = new Map((pictures.error ? [] : (pictures.data ?? [])).map((r) => [Number(r.group_number), String(r.asset_id)]));
  // So is the place's id: a shown piece belongs to one place, so its id names the place (P4's card is matched by it).
  const placeOfPiece = new Map((known.error ? [] : (known.data ?? [])).map((r) => [String(r.piece_id), String(r.place_id)]));
  const out = new Map<number, ScenePlace>();
  for (const row of data ?? []) {
    const group = Number(row.group_number);
    const place = out.get(group) ?? { group, name: text(row.place_name), pieces: [], pictureAssetId: pictureOf.get(group) ?? null, placeId: placeOfPiece.get(String(row.piece_id)) ?? null };
    out.set(group, place);
    // The picture is shown as itself (pictureAssetId), never as a line of text.
    if (row.kind === 'picture') continue;
    place.pieces.push({ id: String(row.piece_id), kind: asKind(row.kind), text: text(row.body), ...leadOf(row.lead) });
    out.set(group, place);
  }
  return out;
}

/** A place the GM has shown the reader's group on this expedition (What we know, S4-4): its name and the pieces shown. */
export interface ShownPlace {
  placeId: string;
  name: string;
  pieces: { id: string; kind: PieceKind; text: string; lead?: string }[];
}

/** What the reader knows (S4-4, ruled 2026-11-03): this expedition's places open, earlier expeditions' folded. */
export interface ShownPlaces {
  /** The expedition under way, in the order first visited. */
  current: ShownPlace[];
  /** Earlier expeditions, newest expedition first, each in the order visited (a place shown on several once). */
  earlier: ShownPlace[];
}

/**
 * The places shown to the reader's groups across the campaign (public.known_places_campaign): each place once per
 * list, with the pieces shown on any visit (each once, in the order shown). Only what the GM showed, and only while
 * it stays shown. Null if it couldn't be loaded. M8b's location browser takes this over.
 */
export async function loadShownPlaces(db: Db, campaignId: string): Promise<ShownPlaces | null> {
  const { data, error } = await db.rpc('known_places_campaign', { campaign: campaignId });
  if (error) return null;
  const lists = { current: new Map<string, ShownPlace>(), earlier: new Map<string, ShownPlace>() };
  for (const row of data ?? []) {
    const into = row.current === true ? lists.current : lists.earlier;
    const id = String(row.place_id);
    const place = into.get(id) ?? { placeId: id, name: text(row.place_name), pieces: [] };
    // A picture isn't a line of text: it shows only where the group is now (the place line), M5b step 1 follow-up.
    if (row.kind !== 'picture' && !place.pieces.some((p) => p.id === String(row.piece_id))) place.pieces.push({ id: String(row.piece_id), kind: asKind(row.kind), text: text(row.body), ...leadOf(row.lead) });
    into.set(id, place);
  }
  // A place shown this expedition isn't repeated in the fold.
  return { current: [...lists.current.values()], earlier: [...lists.earlier.values()].filter((p) => !lists.current.has(p.placeId)) };
}

/**
 * The players' top (plan dec-9-the-whole-scene S15; st-7, sf-1, mc-50; page 16, T9a and T9c): for each of the reader's
 * groups, the name of the last place shown to it on the expedition under way (its newest visit with a piece shown), as
 * players know it. The same read as What we know (public.known_places_campaign): nothing the GM hasn't shown. Null if
 * it couldn't be loaded.
 */
export async function loadLastShownPlaces(db: Db, campaignId: string): Promise<Map<number, string> | null> {
  const { data, error } = await db.rpc('known_places_campaign', { campaign: campaignId });
  if (error) return null;
  const newest = new Map<number, { at: string; name: string }>();
  for (const row of data ?? []) {
    if (row.current !== true) continue;
    const group = Number(row.group_number);
    const at = String(row.visited_at ?? '');
    const had = newest.get(group);
    if (!had || at >= had.at) newest.set(group, { at, name: text(row.place_name) });
  }
  return new Map([...newest].map(([group, { name }]) => [group, name]));
}

/** A map or handout revealed to the reader (What we know, S4-4; the assets' reading rule decides who sees one). */
export interface RevealedImage {
  id: string;
  name: string;
  kind: 'map' | 'handout';
  url: string | null;
}

/** The maps and handouts this reader may see (the assets' reading rule), with a link to each picture. */
export async function loadRevealedImages(db: Db, campaignId: string): Promise<RevealedImage[]> {
  const { data, error } = await db.from('assets').select('id, name, kind').eq('campaign_id', campaignId).in('kind', ['map', 'handout']).order('created_at', { ascending: true });
  if (error || !data) return [];
  const links = await fileLinks(
    db,
    data.map((a) => `${campaignId}/${String(a.id)}`),
  );
  return data.map((a) => ({ id: String(a.id), name: String(a.name) || (a.kind === 'map' ? 'A map' : 'A handout'), kind: a.kind === 'map' ? 'map' : 'handout', url: links.get(`${campaignId}/${String(a.id)}`) ?? null }));
}

/** The places the GM has named in the campaign, newest first, each once, at most `limit` (Where now?'s chips). */
export async function loadKnownPlaces(db: Db, campaignId: string, limit = 5): Promise<string[]> {
  const { data, error } = await db.from('places').select('name, updated_at').eq('campaign_id', campaignId).eq('undone', false).order('updated_at', { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data.map((p) => String(p.name));
}

/**
 * Which groups are in the same place, without saying where: each group with someone in it, and the lowest group
 * sharing its place (the same number: the same place). Null if it couldn't be loaded.
 */
export async function loadMeeting(db: Db, campaignId: string): Promise<Map<number, number> | null> {
  const { data, error } = await db.rpc('groups_meeting', { campaign: campaignId });
  if (error) return null;
  return new Map((data ?? []).map((r) => [Number(r.group_number), Number(r.meets)]));
}

/** Two groups are together (a player may Join them up) when they share a place. */
export const together = (meeting: ReadonlyMap<number, number>, one: number, other: number): boolean =>
  meeting.has(one) && meeting.get(one) === meeting.get(other);

/** The pairs of groups that may Join up (in the order shown: the lower group is the one joined). */
export function meetingPairs(groups: readonly number[], meeting: ReadonlyMap<number, number>): { from: number; into: number }[] {
  return groups.flatMap((into, i) => groups.slice(i + 1).filter((from) => together(meeting, from, into)).map((from) => ({ from, into })));
}

const gmOnly = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);

/** Where now?'s answer: the new visit's row id, and how many pieces came back shown (0: a first visit, or unnamed). */
export interface Moved {
  id: string;
  backShown: number;
}

/**
 * Back at a place (place.backAt; gp-5): the new visit starts with the pieces shown at the end of the place's last
 * visit, by any group in any expedition. Returns how many (0 writes nothing, so there's no line). Where now? runs it
 * as its own request after the move, so its log line and its Undo (hide them all again) are its own.
 */
export const backAtPlace = defineCommand({
  name: 'place.backAt',
  log: 'verbose',
  target: (input: { campaignId: string; row: Pick<GroupPlace, 'id'> }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<number>> => {
    const { data, error } = await db.rpc('back_at_place', { visit: input.row.id });
    return error ? fromError(error) : ok(Number(data ?? 0));
  },
});

/**
 * Where now? (place.set): the group goes to the place of that name (blank: somewhere unnamed), or, with `placeId`
 * (M8b slice 0: a place picked from a pack, which may share its name with another), to that place. A place visited
 * before starts with what was shown at the end of its last visit (place.backAt, its own line); anywhere else, nothing
 * shown.
 */
export const setPlace = defineCommand({
  name: 'place.set',
  log: 'simple',
  target: (input: { campaignId: string; group: number; name: string; placeId?: string | null; packEntry?: PackPlaceEntry | null; regionalTables?: Record<string, unknown> }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, user, input): Promise<CommandResult<Moved>> => {
    // A place picked from a pack (pull request 2): made (or found) in this same request, so the move is one line and
    // one Undo takes the place, its pieces and the move back together.
    const made = input.packEntry ? await makePlaceInRequest(db, input.campaignId, input.packEntry, input.regionalTables) : null;
    if (made && !made.ok) return made;
    const placeId = made ? made.value.id : input.placeId;
    const { data, error } = placeId
      ? await db.rpc('set_group_place_at', { campaign: input.campaignId, group_no: input.group, place: placeId })
      : await db.rpc('set_group_place', { campaign: input.campaignId, group_no: input.group, place_name: input.name.trim() });
    if (error) return fromError(error);
    const row = (Array.isArray(data) ? data[0] : data) as { id?: string; place_id?: string | null } | null;
    const id = String(row?.id ?? '');
    if (!id || !row?.place_id) return ok({ id, backShown: 0 });
    // Its own request (a new id and name): the shows it makes are one line of their own, undone on their own.
    const back = await backAtPlace.run(taggedDb(db, { type: backAtPlace.name, level: 'verbose' }), user, { campaignId: input.campaignId, row: { id } });
    // The move stands either way; a failed seeding says so rather than hiding the move.
    if (!back.ok) return failed(`${groupWord(input.group)} moved, but the pieces shown last time couldn't be brought back: ${back.message}`);
    return ok({ id, backShown: back.value });
  },
});

const groupWord = (group: number) => (group === 1 ? 'The party' : `Group ${group}`);

/** + Piece (place.addPiece): one line players may be shown, at the end of the place's pieces. */
export const addPiece = defineCommand({
  name: 'place.addPiece',
  log: 'verbose',
  target: (input: { campaignId: string; placeId: string; kind: PieceKind; text: string }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const { data, error } = await db.rpc('add_place_piece', { place: input.placeId, kind: input.kind, body: input.text.trim() });
    if (error) return fromError(error);
    const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
    return ok(String(row?.id ?? ''));
  },
});

const pieceShowing = (name: string, show: boolean) =>
  defineCommand({
    name,
    log: 'verbose',
    target: (input: { campaignId: string; row: Pick<GroupPlace, 'id'>; piece: Pick<Piece, 'id'> }) => ({ campaignId: input.campaignId }),
    allowed: gmOnly,
    run: async (db, _user, input): Promise<CommandResult<boolean>> => {
      const { error } = await db.rpc('show_place_piece', { visit: input.row.id, piece: input.piece.id, show_it: show });
      return error ? fromError(error) : ok(show);
    },
  });

/** Show players, one piece: that group's players see it, after what they already see. */
export const showPiece = pieceShowing('place.showPiece', true);
/** Hide from players, one piece. */
export const hidePiece = pieceShowing('place.hidePiece', false);

/** Edit piece (place.editPiece): the GM changes a piece's kind and text; its place in the order and its shows stay. */
export const editPiece = defineCommand({
  name: 'place.editPiece',
  log: 'verbose',
  target: (input: { campaignId: string; piece: Pick<Piece, 'id' | 'version'>; kind: PieceKind; text: string }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const { data, error } = await db.rpc('edit_place_piece', { piece: input.piece.id, kind: input.kind, body: input.text.trim(), seen: input.piece.version });
    if (error) return fromError(error);
    const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
    return ok(String(row?.id ?? ''));
  },
});

/** Remove this piece (place.removePiece): retired by its flag, never deleted; Undo brings it back with its shows. */
export const removePiece = defineCommand({
  name: 'place.removePiece',
  log: 'verbose',
  target: (input: { campaignId: string; piece: Pick<Piece, 'id'> }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<string>> => {
    const { data, error } = await db.rpc('remove_place_piece', { piece: input.piece.id });
    if (error) return fromError(error);
    const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
    return ok(String(row?.id ?? ''));
  },
});

/** Hide all (place.hideAll): every piece this group sees, in one line. Returns how many were hidden. */
export const hideAllPieces = defineCommand({
  name: 'place.hideAll',
  log: 'verbose',
  target: (input: { campaignId: string; row: Pick<GroupPlace, 'id'> }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<number>> => {
    const { data, error } = await db.rpc('hide_all_pieces', { visit: input.row.id });
    return error ? fromError(error) : ok(Number(data ?? 0));
  },
});

/**
 * The GM edits a place's description or notes (saved as typed, Verbose), or (M8b slice 0, ⚑ 3 C) the name players see
 * ("Players see: …"; '' means the place's name).
 */
export const editPlace = defineCommand({
  name: 'place.edit',
  log: 'verbose',
  target: (input: { campaignId: string; place: Place; description?: string; playersName?: string; notes?: Partial<PlaceNotes> }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input): Promise<CommandResult<Place>> => {
    let place = input.place;
    let descriptionSaved = false;
    const playersName = input.playersName?.trim().slice(0, 200);
    const nameChanged = playersName !== undefined && playersName !== (place.playersName ?? '');
    if ((input.description !== undefined && input.description !== place.description) || nameChanged) {
      const patch = { ...(input.description !== undefined ? { description: input.description } : {}), ...(nameChanged ? { players_name: playersName } : {}), version: place.version };
      const written = fromWrite(await db.from('places').update(patch).eq('id', place.id).select(PLACE_COLUMNS));
      if (!written.ok) return written;
      place = { ...toPlace(written.value as Record<string, unknown>, null), notes: place.notes, notesVersion: place.notesVersion };
      descriptionSaved = true;
    }
    const changes = Object.fromEntries(Object.entries(input.notes ?? {}).filter(([k, v]) => v !== undefined && v !== place.notes?.[k as NoteHeading]));
    if (Object.keys(changes).length > 0) {
      const written = fromWrite(await db.from('place_notes').update({ ...changes, version: place.notesVersion }).eq('id', place.id).select('id, traps, puzzles, encounters, treasure, doors, version'));
      // Two writes: when the second fails after the first went in, say so plainly rather than "the save failed".
      if (!written.ok) return descriptionSaved ? failed(`The description was saved. The notes weren't: ${written.message}`) : written;
      const notes = written.value as Record<string, unknown>;
      place = { ...place, notes: toPlace({ id: place.id }, notes).notes, notesVersion: num(notes.version) };
    }
    return ok(place);
  },
});

export const PLACE_COMMANDS = [setPlace, backAtPlace, editPlace, addPiece, editPiece, removePiece, showPiece, hidePiece, hideAllPieces, addPlacePicture, setPlacePicture] as const;
