// Travel as the campaign keeps it (M5b step 1; ruled 2026-10-30, S1–S7, D4, D7–D10, S2-5, S4-6; 2026-10-31 per-group
// wilderness state; docs/05 "Movement", "Lost"; supabase/migrations/…_m5b_1_travel.sql). The engine beside it
// (travel.ts) works the day out and writes nothing; this file holds the rows and the commands:
//   travel_groups: one row per group of the expedition under way: today's day and budget (the total the device
//     worked out from the pack, or the GM's number), what's spent, forced marches, the shortfall still owed (the place
//     the group is entering) and the ground around the group (its terrain and route). The GM reads all; a player
//     reads their own group's row only (row-level security).
//   travel_group_secrets (fm-1): the GM's part of each row: the place the group is entering as the GM names it, and
//     the place itself. Only the GM reads it. The row's own pending_place_name holds what the group's players may
//     read: the place's players' name once it has been shown to them, else nothing.
//   group_lost: a group is Lost until Found the way. The GM reads all; a player reads their group's only while the
//     campaign's Getting lost is Open (enforced by the database); then they may enter the recovery roll.
// Commands, each an intent with a request id: travel.dayStart (the morning: yesterday's shortfall paid first),
// travel.move (Move…), travel.setBudget (pace, the GM's number, a recount), travel.forceMarch (the players' button,
// applied at once; whoever marched, or the GM, can undo), travel.spendDay, travel.lost.set, travel.lost.roll,
// travel.lost.resolve. The first five write the group's own log lines (fm-1: read by the players in that group when
// the line was written, and the GM); Lost's lines stay the GM's.
import { defineCommand, fromError, isGm, isMember, ok, type CommandResult, type CurrentUser } from '../../core/commands.ts';
import { makePlaceInRequest, type PackPlaceEntry } from './placeFromPack.ts';
import type { Db } from '../../core/supabase.ts';
import type { Pace, Pending, TravelDay } from './travel.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const asPace = (value: unknown): Pace => (value === 'riding' || value === 'cart' ? value : 'foot');

/** "Getting lost" (04 gettingLost; S4-6): Secret by default. */
export type GettingLost = 'secret' | 'open';

export function gettingLostOf(settings: unknown): GettingLost {
  return isRecord(settings) && settings.gettingLost === 'open' ? 'open' : 'secret';
}

/** One group's travel row: the day as the budget card shows it, plus where the group is. */
export interface TravelGroup extends TravelDay {
  id: string;
  campaignId: string;
  expeditionId: string;
  group: number;
  /** The expedition's day this row is for (0 its first). */
  day: number;
  pace: Pace;
  /** The GM's own number for the day's base, when set by hand. */
  gmPerDay: number | null;
  /** The ground around the group: the mode's terrain and route ids (null until the first Move…). */
  terrainId: string | null;
  routeId: string | null;
  version: number;
}

/**
 * A travel row as the app uses it. `secret` is the GM's part of the row (travel_group_secrets), which only the GM's
 * device can read: with it the place being entered has the GM's own name and its id; without it (a player), the name
 * is what the database lets that group's players read, blank when the place hasn't been shown to them.
 */
export function toTravelGroup(row: Record<string, unknown>, secret?: Record<string, unknown> | null): TravelGroup {
  const owed = typeof row.pending_owed === 'number' ? row.pending_owed : null;
  const pending: Pending | null =
    owed !== null && owed > 0
      ? {
          placeName: str(secret?.pending_place_name) ?? str(row.pending_place_name) ?? '',
          placeId: str(secret?.pending_place_id) ?? str(row.pending_place_id),
          routeId: str(row.pending_route_id),
          terrainId: str(row.pending_terrain_id),
          owed,
        }
      : null;
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    expeditionId: String(row.expedition_id),
    group: num(row.group_number, 1),
    day: num(row.day),
    pace: asPace(row.pace),
    gmPerDay: typeof row.gm_per_day === 'number' ? row.gm_per_day : null,
    terrainId: str(row.terrain_id),
    routeId: str(row.route_id),
    total: num(row.total),
    spent: num(row.spent),
    forced: num(row.forced),
    pending,
    version: num(row.version, 1),
  };
}

/** Each group's travel row in the expedition (those the reader may read), by group number; null when it can't be read. */
export async function loadTravelGroups(db: Db, campaignId: string, expeditionId: string): Promise<Map<number, TravelGroup> | null> {
  const [{ data, error }, secrets] = await Promise.all([
    db.from('travel_groups').select('*').eq('campaign_id', campaignId).eq('expedition_id', expeditionId).eq('undone', false),
    // The GM's part of each row (fm-1): the GM's device gets them all, a player's none.
    db.from('travel_group_secrets').select('id, pending_place_name, pending_place_id').eq('campaign_id', campaignId),
  ]);
  if (error) return null;
  const kept = new Map((secrets.data ?? []).map((secret) => [String(secret.id), secret as Record<string, unknown>]));
  return new Map((data ?? []).map((row) => [num(row.group_number, 1), toTravelGroup(row as Record<string, unknown>, kept.get(String(row.id)))]));
}

/** A group's Lost spell: since when, how many mornings still lost, the roll entered this morning. */
export interface GroupLost {
  id: string;
  campaignId: string;
  expeditionId: string;
  group: number;
  sinceDay: number;
  foundDay: number | null;
  attempts: number;
  roll: string | null;
  rollBy: string | null;
  note: string;
  version: number;
}

export function toGroupLost(row: Record<string, unknown>): GroupLost {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    expeditionId: String(row.expedition_id),
    group: num(row.group_number, 1),
    sinceDay: num(row.since_day),
    foundDay: typeof row.found_day === 'number' ? row.found_day : null,
    attempts: num(row.attempts),
    roll: str(row.roll),
    rollBy: str(row.roll_by),
    note: typeof row.note === 'string' ? row.note : '',
    version: num(row.version, 1),
  };
}

/** The groups lost now (those the reader may read: the GM all; a player their own, while Getting lost is Open), by group. */
export async function loadLost(db: Db, campaignId: string, expeditionId: string): Promise<Map<number, GroupLost> | null> {
  const { data, error } = await db.from('group_lost').select('*').eq('campaign_id', campaignId).eq('expedition_id', expeditionId).eq('undone', false).is('found_day', null);
  if (error) return null;
  return new Map((data ?? []).map((row) => [num(row.group_number, 1), toGroupLost(row as Record<string, unknown>)]));
}

/** The load tier the database keeps for each character (carrier_loads.tier, the tier's label), by actor id; empty when it can't be read. */
export async function loadLoadTiers(db: Db, actorIds: readonly string[]): Promise<Map<string, string>> {
  if (actorIds.length === 0) return new Map();
  const { data, error } = await db.from('carrier_loads').select('actor_id, tier').in('actor_id', [...actorIds]);
  if (error) return new Map();
  return new Map((data ?? []).map((l) => [String(l.actor_id), String(l.tier)]));
}

// Commands ---------------------------------------------------------------------------------------------------------

async function rpcRow<T>(call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>, to: (row: Record<string, unknown>) => T): Promise<CommandResult<T>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? ok(to(row)) : fromError({ code: '42501', message: '' });
}

/**
 * A travel row a function gave back. While the group is entering a place, the GM's part of the row is read back with
 * it (fm-1): the GM's device gets the place's own name and id; a player's read finds nothing, and the row keeps only
 * what the database lets them read.
 */
async function travelRow(db: Db, call: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<CommandResult<TravelGroup>> {
  const { data, error } = await call;
  if (error) return fromError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRecord(row)) return fromError({ code: '42501', message: '' });
  if (typeof row.pending_owed !== 'number') return ok(toTravelGroup(row));
  const secret = await db.from('travel_group_secrets').select('pending_place_name, pending_place_id').eq('id', String(row.id)).maybeSingle();
  return ok(toTravelGroup(row, isRecord(secret.data) ? secret.data : null));
}

const gmOnly = (user: CurrentUser, target: { campaignId: string }) => isGm(user, target.campaignId);

/** Who a group's travel is for: the campaign, the group, and whether one of the user's own characters is in it. */
export interface GroupTarget {
  campaignId: string;
  group: number;
  /** One of the reader's characters (or hirelings) is in the group: the app's copy of the database's in_my_group. */
  mine: boolean;
}

/** Force march, and the recovery roll while Open: the GM, or a member whose character is in the group. */
export const mayActForGroup = (user: CurrentUser, target: GroupTarget): boolean =>
  isGm(user, target.campaignId) || (isMember(user, target.campaignId) && target.mine);

/** The morning (S3, S4): today's budget for a group; yesterday's shortfall is paid first and the group arrives when it's paid. */
export const startTravelDay = defineCommand({
  name: 'travel.dayStart',
  log: 'simple',
  target: (input: { campaignId: string; group: number; day: number; total: number; pace: Pace; gmPerDay: number | null }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) =>
    travelRow(
      db,
      db.rpc('start_travel_day', { campaign: input.campaignId, group_no: input.group, day: input.day, total: input.total, pace: input.pace, gm_per_day: input.gmPerDay ?? undefined }),
    ),
});

/** Move… (S1, S4): the cost comes off what's left; the rest is owed and the group is entering the place. */
export const travelMove = defineCommand({
  name: 'travel.move',
  log: 'simple',
  target: (input: { campaignId: string; row: TravelGroup; cost: number; terrainId: string | null; routeId: string | null; placeName: string | null; placeId: string | null; packEntry?: PackPlaceEntry | null; regionalTables?: Record<string, unknown> }) => ({
    campaignId: input.campaignId,
  }),
  allowed: gmOnly,
  run: async (db, _user, input) => {
    // A place picked from a pack (M8b slice 0, pull request 2): made (or found) in this same request, so the move is
    // one line and one Undo takes the place and the move back together.
    const made = input.packEntry ? await makePlaceInRequest(db, input.campaignId, input.packEntry, input.regionalTables) : null;
    if (made && !made.ok) return made;
    return travelRow(
      db,
      db.rpc('travel_move', {
        campaign: input.campaignId,
        group_no: input.row.group,
        cost: input.cost,
        terrain_id: input.terrainId ?? undefined,
        route_id: input.routeId ?? undefined,
        place_name: input.placeName ?? undefined,
        place_id: made ? made.value.id : (input.placeId ?? undefined),
        seen_version: input.row.version,
      }),
    );
  },
});

/** The budget card's number (S3): the pace, the GM's own number, or a recount after the weather. */
export const setTravelBudget = defineCommand({
  name: 'travel.setBudget',
  log: 'verbose',
  target: (input: { campaignId: string; row: TravelGroup; total: number; pace: Pace; gmPerDay: number | null }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) =>
    travelRow(
      db,
      db.rpc('set_travel_budget', { campaign: input.campaignId, group_no: input.row.group, total: input.total, pace: input.pace, gm_per_day: input.gmPerDay ?? undefined, seen_version: input.row.version }),
    ),
});

/** Force march (D4): the players' choice, applied at once; `added` is what the pack gives today (travel.ts forceMarch). */
export const forceMarch = defineCommand({
  name: 'travel.forceMarch',
  log: 'simple',
  target: (input: { target: GroupTarget; row: TravelGroup; added: number }) => input.target,
  allowed: mayActForGroup,
  run: (db, _user, input) =>
    travelRow(db, db.rpc('force_march', { campaign: input.target.campaignId, group_no: input.row.group, added: input.added, seen_version: input.row.version })),
});

/** Spend the day looking (D8): what's left today is used up. */
export const spendTravelDay = defineCommand({
  name: 'travel.spendDay',
  log: 'simple',
  target: (input: { campaignId: string; row: TravelGroup }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => travelRow(db, db.rpc('spend_travel_day', { campaign: input.campaignId, group_no: input.row.group, seen_version: input.row.version })),
});

/** Lost (D7): the group is lost from today (the lost check's hit, or by hand). */
export const setLost = defineCommand({
  name: 'travel.lost.set',
  log: 'simple',
  target: (input: { campaignId: string; group: number; day: number; note?: string }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('set_lost', { campaign: input.campaignId, group_no: input.group, day: input.day, note: input.note ?? '' }), toGroupLost),
});

/** The recovery roll's target: the group's, plus the campaign's Getting lost (the app's copy; the database refuses it while Secret). */
export interface LostTarget extends GroupTarget {
  gettingLost: GettingLost;
}

export const mayEnterLostRoll = (user: CurrentUser, target: LostTarget): boolean =>
  isGm(user, target.campaignId) || (target.gettingLost === 'open' && mayActForGroup(user, target));

/** The recovery roll (S4-6): the GM, or a member of the group while Getting lost is Open. */
export const enterLostRoll = defineCommand({
  name: 'travel.lost.roll',
  log: 'verbose',
  target: (input: { target: LostTarget; lost: GroupLost; roll: string }) => input.target,
  allowed: mayEnterLostRoll,
  run: (db, _user, input) => rpcRow(db.rpc('enter_lost_roll', { lost: input.lost.id, roll: input.roll, seen_version: input.lost.version }), toGroupLost),
});

/** Found the way / Still lost (S2-5): the GM's taps. */
export const resolveLost = defineCommand({
  name: 'travel.lost.resolve',
  log: 'simple',
  target: (input: { campaignId: string; lost: GroupLost; outcome: 'found' | 'still'; day: number }) => ({ campaignId: input.campaignId }),
  allowed: gmOnly,
  run: (db, _user, input) => rpcRow(db.rpc('resolve_lost', { lost: input.lost.id, outcome: input.outcome, day: input.day, seen_version: input.lost.version }), toGroupLost),
});

export const TRAVEL_COMMANDS = [startTravelDay, travelMove, setTravelBudget, forceMarch, spendTravelDay, setLost, enterLostRoll, resolveLost] as const;
