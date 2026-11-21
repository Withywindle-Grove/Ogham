// The parts of a place in town (W4b, W4c of docs/plans/dec-3-the-whole-town.md; brief
// docs/plans/briefs/dec-3-w4b-w4c-place-in-town-brief.md; Francis's tr-1 and ge-1, 2026-11-14). Data and logic only: no
// screen yet (W4's eyes draw it, from page 19's frame TW2).
// A place in town (a place one level under the town, in the town's places.town as `place:<entryId>`) has its pieces
// shown to a group on the group's visit to the TOWN, in a store of their own (public.town_piece_shows), never in
// public.piece_shows: every existing reader of piece_shows keeps reading the town's own pieces only.
// Show players / Hide on such a piece (town.showPiece, town.hidePiece) are the GM's, each one Verbose line with Undo,
// with every check of place.showPiece (the visit live and the group's current place, an expedition under way, the piece
// live) except that the piece is of a place one level under the visit's town rather than of the town itself.
// Players read what is shown through public.scene_town_pieces and public.scene_town_pictures, and nothing else.
import { defineCommand, fromError, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';

const gmOnly = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);

/** What the GM's command needs: the group's visit to the town and the piece of the place in town. */
export interface TownPartInput {
  campaignId: string;
  /** The group's visit to the town (its group_places row). */
  visitId: string;
  /** A piece of a place one level under that town. */
  pieceId: string;
}

const partShowing = (name: string, show: boolean) =>
  defineCommand({
    name,
    log: 'verbose',
    target: (input: TownPartInput) => ({ campaignId: input.campaignId }),
    allowed: gmOnly,
    run: async (db, _user, input): Promise<CommandResult<boolean>> => {
      const { error } = await db.rpc('show_town_place_piece', { visit: input.visitId, piece: input.pieceId, show_it: show });
      return error ? fromError(error) : ok(show);
    },
  });

/** Show players, one piece of a place in town (ge-1): the group's players read it while they are in the town. */
export const showTownPiece = partShowing('town.showPiece', true);
/** Hide from players, one piece of a place in town. */
export const hideTownPiece = partShowing('town.hidePiece', false);

export const TOWN_PART_COMMANDS = [showTownPiece, hideTownPiece] as const;

/** A shown piece of a place in town, as a player reads it (public.scene_town_pieces). */
export interface SceneTownPiece {
  group: number;
  /** The place's name for players. */
  placeName: string;
  /** The place's entry in the town's list (as public.scene_town sends it). */
  entryKey: string;
  pieceId: string;
  kind: string;
  body: string;
  lead: string;
}

/** A shown picture of a place in town (public.scene_town_pictures). */
export interface SceneTownPicture {
  group: number;
  entryKey: string;
  assetId: string;
}

/** What a player reads of the places in town shown to their groups; null if it couldn't be loaded. */
export async function loadSceneTownParts(db: Db, campaignId: string): Promise<{ pieces: SceneTownPiece[]; pictures: SceneTownPicture[] } | null> {
  const [pieces, pictures] = await Promise.all([db.rpc('scene_town_pieces', { campaign: campaignId }), db.rpc('scene_town_pictures', { campaign: campaignId })]);
  if (pieces.error || pictures.error) return null;
  const rows = (pieces.data ?? []) as Record<string, unknown>[];
  const pics = (pictures.data ?? []) as Record<string, unknown>[];
  return {
    pieces: rows.map((r) => ({
      group: Number(r.group_number),
      placeName: String(r.place_name ?? ''),
      entryKey: String(r.entry_key ?? ''),
      pieceId: String(r.piece_id ?? ''),
      kind: String(r.kind ?? ''),
      body: String(r.body ?? ''),
      lead: String(r.lead ?? ''),
    })),
    pictures: pics.map((r) => ({ group: Number(r.group_number), entryKey: String(r.entry_key ?? ''), assetId: String(r.asset_id ?? '') })),
  };
}
