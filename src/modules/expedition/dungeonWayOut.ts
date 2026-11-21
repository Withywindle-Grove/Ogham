// Leave the dungeon's three cases (st-4, ruled 2026-11-14; page 16, frame T6b; docs/plans/dec-9-the-whole-scene.md
// row S11): whether the party is AT a way out (a tap leaves, with Undo), NOT at one (a sheet with the two choices), or
// the app CAN'T TELL (the same sheet with a first row that leaves at once). Data and logic only: the sheet is drawn
// elsewhere. The GM's alone: it reads the pack's locations and links, which a player's device never reads.
//
// "The dungeon" is the site the place sits in: the nearest place in its chain the pack types `site` (docs/07 §2:
// region → site → floor or area → room), so levels may nest as deep as they like below it; where the pack names no
// site, the outermost place in the chain that isn't a region. A way out is an exit (`playerView.exits[].to`, D6) or a
// link (a route, as Move on reads it, `waysFrom`) whose far end lies outside that place, i.e. whose own chain doesn't
// pass through it. Exits of plain text name no place, so the app can't place them.
//
// A link counts as a way out only when it is shown to players (the lead, 2026-11-14): when the players' Scene would
// send it, by public.campaign_ways_on's test (20261111190000_dec_hd2_ways_on_read.sql): its `hidden` is plainly false
// or absent, and something of the place the group is at has been shown to it (mc-28b). A link that isn't shown still
// counts as known (it can make the answer NOT, never AT) and is never named in `leadsTo`, so nothing here names or
// implies a hidden way. There is no "found" record yet (the reveal comes after 5 December, mc-28c). An exit is the
// pack's players' text and never names a hidden route (docs/07 §2, D6), so an exit's `to` counts as it is.

import type { Db } from '../../core/supabase.ts';
import { withHiddenFields } from '../library/library.ts';
import { readBarrier, readRoute } from '../library/routes.ts';
import { waysFrom, type WayFromHere } from './moveOnWays.ts';
import { loadPlaceChain, wayOutHere, type ChainEntry } from './placeRules.ts';

/** Whether the party is at a way out of the dungeon, as far as the pack says. */
export type WayOut =
  /** At a way out: the pack's ids of the places outside it leads to, in the pack's order. */
  | { kind: 'at'; leadsTo: string[] }
  /** Every exit and link from here is known, and none leads outside. */
  | { kind: 'not' }
  /** The app can't tell: no place, a place made by hand, no exits data, or an exit it can't place. */
  | { kind: 'cantTell'; why: 'noPlace' | 'handMade' | 'noExits' | 'unknownExit' };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const typeOf = (entry: ChainEntry): string => text(entry.data.type).toLowerCase();

/** The pack's id of the dungeon a place is in (see the head of this file); null for an empty chain. */
export function dungeonOf(chain: readonly ChainEntry[]): string | null {
  const site = chain.find((e) => typeOf(e) === 'site');
  if (site) return site.entryId;
  const below = chain.filter((e) => typeOf(e) !== 'region');
  return (below.at(-1) ?? chain[0])?.entryId ?? null;
}

/** A place's exits (`playerView.exits`): the far ends they name, and how many name none (plain text, or an empty `to`). */
export function exitsOf(data: Record<string, unknown>): { to: string[]; unlinked: number } {
  const view = isRecord(data.playerView) ? data.playerView : {};
  const list = Array.isArray(view.exits) ? view.exits : [];
  const to: string[] = [];
  let unlinked = 0;
  for (const exit of list) {
    const target = isRecord(exit) ? text(exit.to) : '';
    if (target) to.push(target);
    else unlinked += 1;
  }
  return { to, unlinked };
}

/**
 * The three cases (st-4). `here` is the place's chain from the pack (null for a place made by hand); `ways` the links
 * leaving it; `chainsOf` each far end's chain (missing or empty: a place the pack doesn't have); `shownRoutes` the ids
 * of the links the players' Scene would send. AT when one exit or shown link leads outside the dungeon, even beside
 * one the app can't place (`leadsTo` names only those); NOT when every one is placed and none of those leads out;
 * else CAN'T TELL.
 */
export function wayOutOf(
  here: readonly ChainEntry[] | null,
  ways: readonly WayFromHere[],
  chainsOf: ReadonlyMap<string, readonly ChainEntry[]>,
  shownRoutes: ReadonlySet<string>,
): WayOut {
  if (here === null) return { kind: 'cantTell', why: 'handMade' };
  // The pack marks the Location a way out (p2p-31, `wayOut: true`; plan scene-point-to-point B10): the party is AT one,
  // as Move on's "End expedition" row says there, whatever its links say. It names no place it leads to.
  if (wayOutHere(here)) return { kind: 'at', leadsTo: [] };
  const exits = here[0] ? exitsOf(here[0].data) : { to: [], unlinked: 0 };
  const targets = [...new Set([...exits.to, ...ways.map((w) => w.farEnd)])];
  if (targets.length === 0 && exits.unlinked === 0) return { kind: 'cantTell', why: 'noExits' };
  const dungeon = dungeonOf(here);
  const placed = targets.filter((id) => (chainsOf.get(id)?.length ?? 0) > 0);
  // Only what players may know of leads out: an exit, or a shown link.
  const showable = new Set([...exits.to, ...ways.filter((w) => shownRoutes.has(w.route.id)).map((w) => w.farEnd)]);
  const leadsTo = placed.filter((id) => showable.has(id) && !chainsOf.get(id)!.some((e) => e.entryId === dungeon));
  if (leadsTo.length > 0) return { kind: 'at', leadsTo };
  if (exits.unlinked > 0 || placed.length < targets.length) return { kind: 'cantTell', why: 'unknownExit' };
  return { kind: 'not' };
}

/**
 * The GM's read for the expedition under way: where the party's first group is (as Move on reads it), that place's
 * chain and exits from the pack, the links leaving it, and each far end's chain. Null when something can't be read.
 */
export async function loadWayOut(db: Db, campaignId: string, expeditionId: string): Promise<WayOut | null> {
  const visits = await db.from('group_places').select('group_number, place_id, created_at').eq('campaign_id', campaignId).eq('expedition_id', expeditionId).eq('undone', false).eq('moved_on', false).order('group_number').order('created_at', { ascending: false });
  if (visits.error) return null;
  const first = (visits.data ?? [])[0];
  if (!first?.place_id) return { kind: 'cantTell', why: 'noPlace' };
  const place = await db.from('places').select('pack_id, pack_entry_id').eq('id', String(first.place_id)).maybeSingle();
  if (place.error) return null;
  if (!place.data) return { kind: 'cantTell', why: 'noPlace' };
  if (!place.data.pack_id || !place.data.pack_entry_id) return { kind: 'cantTell', why: 'handMade' };
  const packId = String(place.data.pack_id);
  const hereEntry = String(place.data.pack_entry_id);

  const [here, routeRows] = await Promise.all([loadPlaceChain(db, packId, hereEntry), db.from('library_entries').select('id, pack_entry_id, data').eq('pack_id', packId).eq('kind', 'route')]);
  if (!here || routeRows.error) return null;
  const whole = await withHiddenFields(
    db,
    [packId],
    (routeRows.data ?? []).map((r) => ({ id: String(r.id), entryId: String(r.pack_entry_id), data: (r.data ?? {}) as Record<string, unknown> })),
  );
  if (!whole) return null;
  const routes = whole.flatMap((r) => {
    const route = readRoute(r.entryId, r.data);
    return route ? [{ route, barrier: readBarrier(r.data.barrier, 'gm') }] : [];
  });
  const ways = waysFrom(routes, hereEntry);
  const farIds = [...new Set([...(here[0] ? exitsOf(here[0].data).to : []), ...ways.map((w) => w.farEnd)])];
  const [hereShown, ...farChains] = await Promise.all([shownToGroup(db, campaignId, String(first.place_id), Number(first.group_number)), ...farIds.map((id) => loadPlaceChain(db, packId, id))]);
  if (hereShown === null || farChains.some((c) => c === null)) return null;
  // campaign_ways_on's test: something of here shown to the group, and the link's `hidden` plainly false or absent.
  const plainlyShown = new Set(whole.filter((r) => r.data.hidden === undefined || r.data.hidden === false).map((r) => r.entryId));
  const shownRoutes = hereShown ? new Set(ways.map((w) => w.route.id).filter((id) => plainlyShown.has(id))) : new Set<string>();
  return wayOutOf(here, ways, new Map(farIds.map((id, i) => [id, farChains[i] as ChainEntry[]])), shownRoutes);
}

/**
 * Whether something of a place has been shown to a group on any visit, as campaign_ways_on asks it of the place the
 * group is at (mc-28b, mc-28c): a visit not undone, in an expedition not undone, with a piece shown and not undone, of
 * a piece still there. Null when it can't be read.
 */
async function shownToGroup(db: Db, campaignId: string, placeId: string, group: number): Promise<boolean | null> {
  const visits = await db.from('group_places').select('id, expedition_id').eq('campaign_id', campaignId).eq('place_id', placeId).eq('group_number', group).eq('undone', false);
  if (visits.error) return null;
  const rows = visits.data ?? [];
  if (rows.length === 0) return false;
  const [live, shows] = await Promise.all([
    db.from('expeditions').select('id').in('id', [...new Set(rows.map((v) => String(v.expedition_id)))]).eq('undone', false),
    db.from('piece_shows').select('group_place_id, piece_id').in('group_place_id', rows.map((v) => String(v.id))).eq('shown', true).eq('undone', false),
  ]);
  if (live.error || shows.error) return null;
  const pieceIds = [...new Set((shows.data ?? []).map((s) => String(s.piece_id)))];
  if (pieceIds.length === 0) return false;
  const pieces = await db.from('place_pieces').select('id').in('id', pieceIds).eq('undone', false);
  if (pieces.error) return null;
  const livePieces = new Set((pieces.data ?? []).map((p) => String(p.id)));
  const liveExpeditions = new Set((live.data ?? []).map((x) => String(x.id)));
  const expeditionOf = new Map(rows.map((v) => [String(v.id), String(v.expedition_id)]));
  return (shows.data ?? []).some((s) => livePieces.has(String(s.piece_id)) && liveExpeditions.has(expeditionOf.get(String(s.group_place_id)) ?? ''));
}
