// The town screen as the campaign keeps it (M5b step 6c; ruled 2026-10-30, ST3, ST12; town.ts is the pure part).
// places.town (supabase/migrations/20261104170000_m5b_6c_town_screen.sql) holds what the GM set for each place in a
// town; places is the GM's alone, so a hidden place in town never reaches a player's device (hard rule 5). Players
// read the places shown to their group through public.scene_town, and nothing else. Show players / Hide
// (town.showPlace) and Open / Closed (town.openPlace) are each one Verbose log line with Undo (the old value back).
// Where the party is for the screen: each group's current place in the newest expedition, under way or ended (after
// End expedition the party stays where it is, dt-2), so the screen works in town and in Downtime too.
import { defineCommand, fromError, fromWrite, isGm, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import type { Json } from '../../core/database.types.ts';
import type { Db } from '../../core/supabase.ts';
import { loadGroupPlaces, toPlace, type GroupPlace, type Place } from './placePlay.ts';
import { withEntry, type TownPlace } from './town.ts';

const gmOnly = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);
const PLACE_COLUMNS = 'id, campaign_id, name, description, version, safety, town';

type Change = { campaignId: string; place: Place; entry: Pick<TownPlace, 'key' | 'name' | 'group'> };

async function writeTown(db: Db, input: Change, change: { shown?: boolean; open?: boolean }): Promise<CommandResult<Place>> {
  const town = withEntry(input.place.town, input.entry, change);
  const written = fromWrite(
    await db
      .from('places')
      .update({ town: town as unknown as Json, version: input.place.version })
      .eq('id', input.place.id)
      .select(PLACE_COLUMNS),
  );
  if (!written.ok) return written;
  return ok({ ...toPlace(written.value as Record<string, unknown>, null), notes: input.place.notes, notesVersion: input.place.notesVersion });
}

/**
 * Show players / Hide on a place in town (ST3): the GM's, for every group in this town. Players read the town only
 * once the place itself is shown to their group (a piece of it shown on the visit; review finding 2, ruled B), so
 * `alsoShow` names the visit and the description piece to show in the same tap: one request, one log line, one Undo.
 */
export const showTownPlace = defineCommand({
  name: 'town.showPlace',
  log: 'verbose',
  target: (input: Change & { shown: boolean; alsoShow?: { visitId: string; pieceId: string } | null }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: async (db, _user, input) => {
    if (input.shown && input.alsoShow) {
      const { error } = await db.rpc('show_place_piece', { visit: input.alsoShow.visitId, piece: input.alsoShow.pieceId, show_it: true });
      if (error) return fromError(error);
    }
    return writeTown(db, input, { shown: input.shown });
  },
});

/** Open / Closed on a place in town (ST3): the GM's. */
export const openTownPlace = defineCommand({
  name: 'town.openPlace',
  log: 'verbose',
  target: (input: Change & { open: boolean }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => writeTown(db, input, { open: input.open }),
});

export const TOWN_PLACE_COMMANDS = [showTownPlace, openTownPlace] as const;

/**
 * The GM's view of where each group is between expeditions: the groups' current places in the newest expedition
 * (ended or not). Empty when there's none; null if it couldn't be loaded.
 */
export async function loadLastPlaces(db: Db, campaignId: string): Promise<Map<number, GroupPlace> | null> {
  const newest = await db.from('expeditions').select('id').eq('campaign_id', campaignId).eq('undone', false).order('created_at', { ascending: false }).limit(1);
  if (newest.error) return null;
  const id = newest.data?.[0]?.id;
  return id ? loadGroupPlaces(db, campaignId, String(id)) : new Map();
}

/** A player's view of a town (public.scene_town): the place's name and the places in town shown to their group. */
export interface SceneTown {
  group: number;
  name: string;
  places: { key: string; name: string; kind: string; open: boolean }[];
}

/** For each of the reader's groups at a settlement place with something shown; null if it couldn't be loaded. */
export async function loadSceneTowns(db: Db, campaignId: string): Promise<Map<number, SceneTown> | null> {
  const { data, error } = await db.rpc('scene_town', { campaign: campaignId });
  if (error) return null;
  const out = new Map<number, SceneTown>();
  for (const row of data ?? []) {
    const group = Number(row.group_number);
    const town = out.get(group) ?? { group, name: String(row.place_name ?? ''), places: [] };
    town.places.push({ key: String(row.entry_key), name: String(row.name ?? ''), kind: String(row.kind ?? ''), open: row.open !== false });
    out.set(group, town);
  }
  return out;
}
