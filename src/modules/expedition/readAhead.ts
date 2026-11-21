// Reading ahead (plan scene-point-to-point B2; rulings p2p-8, p2p-9; page 23, LA2 to LA4, approved 2026-11-18): the GM
// opens a Location the party is not at, from the trail's Locations panel, to read its page. Nothing is written: the
// page is read from the campaign's place for that pack entry when the party has been there before (its pieces and
// notes as the GM left them), else composed from the pack's entry exactly as a move there would make it
// (`composePackPlace`). No piece is shown while reading ahead: a show belongs to a visit (`piece_shows`), and this
// place has none. The eyes' real behaviour while reading ahead is for a design sitting (the driver's ruling "A",
// 2026-11-19): until then a tap on one explains, on the page.
import type { Db } from '../../core/supabase.ts';
import { composePackPlace, type PackPlaceEntry } from './placeFromPack.ts';
import { NOTE_HEADINGS, PIECE_KINDS, PLACE_COLUMNS, toPlace, type Piece, type PieceKind, type Place, type PlaceNotes } from './placePlay.ts';

/** A place read ahead: the place as the page draws it, and its pieces in the GM's order, none shown. */
export interface ReadAhead {
  place: Place;
  pieces: Piece[];
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const asKind = (value: unknown): PieceKind => (PIECE_KINDS.includes(value as PieceKind) ? (value as PieceKind) : 'other');

/**
 * The page a pack's location would make, read only: the composed pieces, each unshown, with ids of their own that no
 * command can find (`ahead:<n>`), and the composed notes. Null when the location can't be composed (its notes too long).
 */
export function readAheadFromPack(campaignId: string, entry: PackPlaceEntry): ReadAhead | null {
  const composed = composePackPlace(entry);
  if (!composed.ok) return null;
  const { details, notes, pieces } = composed.parts;
  const place: Place = {
    id: `ahead:${entry.packId}/${entry.packEntryId}`,
    campaignId,
    name: entry.name,
    description: '',
    notes,
    version: 1,
    notesVersion: 1,
    pack: { packId: entry.packId, entryId: entry.packEntryId, type: details.pack_type, parentId: details.pack_parent_id, key: details.pack_key },
    playersName: details.players_name,
    terrainId: details.terrain_id,
    settlement: details.settlement,
  };
  return {
    place,
    pieces: pieces.map((p, at) => ({
      id: `ahead:${at}`,
      kind: p.kind,
      text: p.body,
      ...(p.lead ? { lead: p.lead } : {}),
      shown: false,
      shownAt: null,
      gm: { value: p.gm_value, trigger: p.gm_trigger, statLine: p.gm_stat_line },
      version: 1,
    })),
  };
}

/**
 * The page of a pack's location the party is not at: the campaign's own place for it when there is one, with its notes
 * and its pieces (the picture left out), none shown; else the page composed from the pack. Null when it couldn't be
 * read. It is the place a move there would reuse: a campaign has at most one live place for a pack entry (the index
 * `places_one_per_pack_entry`, where not undone), and `public.make_place_from_pack` returns that one. The newest-first
 * order and the limit only keep the read to one row.
 */
export async function loadReadAhead(db: Db, campaignId: string, entry: PackPlaceEntry): Promise<ReadAhead | null> {
  const found = await db
    .from('places')
    .select(PLACE_COLUMNS)
    .eq('campaign_id', campaignId)
    .eq('pack_id', entry.packId)
    .eq('pack_entry_id', entry.packEntryId)
    .eq('undone', false)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (found.error) return null;
  const row = (found.data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return readAheadFromPack(campaignId, entry);
  const id = String(row.id);
  const [notes, pieces] = await Promise.all([
    db.from('place_notes').select('id, traps, puzzles, encounters, treasure, doors, version').eq('id', id).maybeSingle(),
    db.from('place_pieces').select('id, place_id, kind, body, lead, position, gm_value, gm_trigger, gm_stat_line, version, created_at').eq('place_id', id).eq('undone', false).order('position').order('created_at'),
  ]);
  if (notes.error || pieces.error) return null;
  const place = toPlace(row, (notes.data as Record<string, unknown> | null) ?? (Object.fromEntries(NOTE_HEADINGS.map((h) => [h, ''])) as PlaceNotes));
  return {
    place,
    pieces: (pieces.data ?? [])
      .filter((p) => p.kind !== 'picture')
      .map((p) => ({
        id: String(p.id),
        kind: asKind(p.kind),
        text: text(p.body),
        ...(typeof p.lead === 'string' && p.lead ? { lead: p.lead } : {}),
        shown: false,
        shownAt: null,
        gm: { value: text(p.gm_value), trigger: text(p.gm_trigger), statLine: text(p.gm_stat_line) },
        version: typeof p.version === 'number' ? p.version : 1,
      })),
  };
}
