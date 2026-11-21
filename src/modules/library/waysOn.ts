// The ways on as a player's device may read them (ruled mc-28, 2026-11-11; December step 4, piece e): the routes
// leaving the place the reader's group is in, asked of the database by campaign (`campaign_ways_on`). The database
// never sends a hidden route or the pack's own ids; the far end comes with its place and name only once that place
// has been shown to the reader's group. Each way comes with how it is travelled and how long it takes (ruled mc-28a,
// 2026-11-12): by, name, value and unit, and nothing else of the route's travel. The GM's Move on sheet reads the routes
// themselves (routes.ts); this is the narrow read for everyone else. No screen here: the sheet draws it.
import type { Db } from '../../core/supabase.ts';
import { ROUTE_UNITS, type RouteWay } from './routes.ts';

/** One way on from where a group is. */
export interface WayOn {
  /** The group it leaves from (the reader's own; the GM gets every group's). */
  groupNumber: number;
  /** The route's row id: what a proposal names. Never the pack's id for it. */
  routeId: string;
  /** Where it leads, once that place has been shown to the group; null: not yet explored. */
  to: { placeId: string; name: string } | null;
  /**
   * How it is travelled and how long it takes, in the pack's order ("Rowing, 1 turn"); a route that gives one amount
   * has one way with no id or name; empty when the route gives no time.
   */
  ways: RouteWay[];
}

/** The ways of moving as sent: only whole entries of the four fields are kept. */
function readWays(raw: unknown): RouteWay[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((way: unknown) => {
    if (typeof way !== 'object' || way === null) return [];
    const { by, name, value, unit } = way as Record<string, unknown>;
    return typeof by === 'string' && typeof name === 'string' && Number.isInteger(value) && typeof unit === 'string' && ROUTE_UNITS.includes(unit)
      ? [{ by, name, value: value as number, unit }]
      : [];
  });
}

/**
 * The ways on for the reader's groups in this campaign, by group; null when they couldn't be read. A group gets none
 * until something of the place it is in has been shown to it (ruled mc-28b, 2026-11-12).
 */
export async function loadWaysOn(db: Db, campaignId: string): Promise<WayOn[] | null> {
  const { data, error } = await db.rpc('campaign_ways_on', { campaign: campaignId });
  if (error || !data) return null;
  return data.map((row) => {
    // The generated types can't say so, but both are null for a place not yet shown.
    const placeId = row.to_place_id as string | null;
    const name = row.to_name as string | null;
    return { groupNumber: row.group_number, routeId: row.route_id, to: placeId && name ? { placeId, name } : null, ways: readWays(row.ways) };
  });
}
