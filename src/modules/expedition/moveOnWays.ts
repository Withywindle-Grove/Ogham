// Move on's wiring, its data and rules (piece 5b-0 of docs/plans/dec-7-5-place-page-and-map.md, ruled by the lead on
// 2026-11-14; dec-4 pieces b and d; pt-f2, pt-f3). The GM's ways on from the place the party is in, as the pack links
// them (readRoute: a one-way link counts only from its start; a hidden one is marked), what the players know of each
// far end, each way's time in the campaign's turns, and the refusal while the party is split. The GM's alone: a
// player's device never reads a route (routes.ts); players read their narrow `campaign_ways_on` (waysOn.ts).
// No screen here: MoveOnSheet (src/ui/MoveOnParts.tsx) draws what this gives, through src/app/MoveOn.tsx.

import type { Db } from '../../core/supabase.ts';
import { withHiddenFields } from '../library/library.ts';
import { readBarrier, readRoute, type Barrier, type Route, type RouteWay } from '../library/routes.ts';
import { loadWaysOn } from '../library/waysOn.ts';
import { toSeconds, type TimeUnits } from './clock.ts';
import { POINT_TO_POINT_UNIT, type Check } from './modes.ts';
import { obstacleExtraWords, obstacleNameOf, obstacleRowWords, takesWords, thenWords, throughCheckOf, wayTimeWords, type MoveCheck } from './moveOn.ts';
import { loadPlaceChain, loadRuleSwitches, placeCheckOf, wayOutHere, type ChainEntry, type RuleSwitch } from './placeRules.ts';
import { byMapNumber, keyedName } from './placeTree.ts';

/** What the players know of a far end (MoveOnParts' `ShownToPlayers`, the same three). */
export type ShownToPlayers = 'shown' | 'unshown' | 'hidden';

/** A link leaving the place the party is in, read from here: the far end is the other end of the route. */
export interface WayFromHere {
  route: Route;
  /** The pack's id of the place the link leads to. */
  farEnd: string;
  /** The link's obstacle, the GM's (readBarrier); null when it has none. */
  barrier: Barrier | null;
}

/**
 * The links leaving `here` (pt-f3): a route from here leads to its `to`; a route to here leads back to its `from`
 * unless it is one-way. A route with no way of moving that has a time gives no button, so it is left out. A route
 * from a place to itself is left out too (it goes nowhere).
 */
export function waysFrom(routes: readonly { route: Route; barrier: Barrier | null }[], here: string): WayFromHere[] {
  return routes.flatMap(({ route, barrier }) => {
    if (route.ways.length === 0 || route.from === route.to) return [];
    if (route.from === here) return [{ route, farEnd: route.to, barrier }];
    if (route.to === here && !route.oneWay) return [{ route, farEnd: route.from, barrier }];
    return [];
  });
}

/**
 * The unit of one step in point to point at a place (p2p-6: "its unit of time … from the place"): the unit its ways
 * are timed in, where they all share one. Where they are timed in different units, or the place has no way on, the
 * rulings don't say: until that is ruled it is the campaign's turn, the unit Move on already counts every way in
 * (`moveTime`, pt-f2). A way's amount plays no part, and a way whose unit is blank says nothing: the others decide.
 * Takes any ways with a unit: the GM's, or the players' own narrow read.
 */
export function stepUnitOfWays(ways: readonly Pick<RouteWay, 'unit'>[]): string {
  const units = new Set(ways.map((way) => way.unit.trim().toLowerCase()).filter(Boolean));
  const [only] = units;
  return units.size === 1 && only ? only : POINT_TO_POINT_UNIT;
}

/** The same, from the GM's read of the ways leaving the place the party is in (`loadMoveOn`). */
export function stepUnitHere(read: Pick<MoveOnRead, 'ways'>): string {
  return stepUnitOfWays(read.ways.flatMap((link) => link.route.ways));
}

/**
 * What the players know of a far end, on the GM's row (frame 11): a hidden link is "hidden" whatever was shown; else
 * "shown" once a piece of that place has been shown to a group in this campaign (the test `campaign_ways_on` and
 * `party_moves` use), "unshown" before.
 */
export function shownOf(hidden: boolean, farShown: boolean): ShownToPlayers {
  if (hidden) return 'hidden';
  return farShown ? 'shown' : 'unshown';
}

/** A way's key on its destination's row: the route's id and the way's own id, so two links to one place never clash. */
export const wayKeyOf = (routeId: string, way: Pick<RouteWay, 'by'>): string => `${routeId}|${way.by}`;

/** The move's time in the campaign's turns and seconds, or why it can't be made. */
export type MoveTime = { turns: number; seconds: number } | { refusal: string };

/**
 * How long a way takes, as the database's Move on takes it (pt-f2, #637): whole turns of this campaign, and the same
 * in seconds. The way's own time and any obstacle's extra turns. A way counted in another unit is turned into turns;
 * one that isn't a whole number of turns, or takes no time, can't be a move.
 */
export function moveTime(way: Pick<RouteWay, 'value' | 'unit'>, extraTurns: number, units: TimeUnits): MoveTime {
  const turn = units.turn;
  const own = toSeconds({ value: way.value, unit: way.unit }, units);
  if (!turn || own === null) return { refusal: `This way’s time can’t be read in turns. Check the adventure pack.` };
  const seconds = own + Math.max(0, extraTurns) * turn;
  if (seconds === 0) return { refusal: 'This way takes no time: a move takes at least 1 turn. Use Somewhere else… instead.' };
  if (seconds % turn !== 0) return { refusal: 'This way’s time isn’t a whole number of turns. Check the adventure pack.' };
  return { turns: seconds / turn, seconds };
}

/** The database's refusal while the party is split (pt-f3 point 3, ruled 2026-11-11), said before the move is sent. */
export const SPLIT_PARTY_WORDS = 'Join the party up first: for now a move between linked places takes the whole party.';

/**
 * Whether Move on can go now, for the pop-up that stays tappable (pt-f3 point 3: no disabled button, no hiding): the
 * refusal's words while the party is in more than one group, else null.
 */
export function moveBlocked(groupCount: number): string | null {
  return groupCount > 1 ? SPLIT_PARTY_WORDS : null;
}

// ---- The GM's read ----

/** A place a link leads to, as the GM's Move on lists it. */
export interface FarEnd {
  /** The pack's id for it. */
  entryId: string;
  /** Its name in the pack (the far end's own; the id when the pack has no such place). */
  name: string;
  /** Its number on the map's key, as the pack writes it; null without one. */
  number: string | null;
  /** The campaign's place for it; null until the campaign makes it (place.fromPack, before the move). */
  placeId: string | null;
  /** A piece of it has been shown to a group in this campaign. */
  shown: boolean;
  /**
   * The place it sits in (the pack's `parentId`), for the GM's heading over its rows (WT1 A): its id and its name in
   * the pack; null when it sits in none. Read from the entry as every reader reads it.
   */
  area: { entryId: string; name: string } | null;
}

/**
 * What the players of the group here read on a far end's row, from their own read (`campaign_ways_on`, sf-9): its map
 * number as sent, and whether it stands under "Elsewhere". Only for a far end they have not explored.
 */
export interface PlayersRead {
  number: string | null;
  elsewhere: boolean;
}

/** What the GM's Move on needs, read for the place the party is in. */
export interface MoveOnRead {
  here: { placeId: string; packId: string; entryId: string; name: string };
  ways: WayFromHere[];
  farEnds: Map<string, FarEnd>;
  /** How many groups the party is in now (more than one: the move is refused, `moveBlocked`). */
  groups: number;
  /** The chain of each place an obstacle's crossing passes (`barrier.through`), by its id, for its name and check. */
  throughs: Map<string, ChainEntry[]>;
  /** The GM's switches on places' rules (a place's own check in force or not). */
  switches: RuleSwitch[];
  /** The pack marks the place the party is at a way out (`wayOutHere`): Move on's list ends with "End expedition" (B10). */
  wayOut: boolean;
  /** The pack's id of the place the party's place sits in (its `parentId`): its Area's rows come first (WT1 A). */
  hereArea: string | null;
  /**
   * What the players of the party's group read of each far end not explored, by the far end's pack id, from their own
   * read (sf-9); a far end missing here (nothing of this place shown to them yet, or the read failed) is said by its
   * number alone (`playersLineOf`).
   */
  players: Map<string, PlayersRead>;
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * Which of these places something has been shown to which group, as `campaign_ways_on` tests it
 * (20261111190000_dec_hd2_ways_on_read.sql): a visit not undone, in an expedition not undone, with a piece shown and
 * not undone, of a piece still there. Keys "<place id>:<group number>"; null when it can't be read.
 */
async function shownToGroups(db: Db, campaignId: string, placeIds: readonly string[]): Promise<Set<string> | null> {
  const out = new Set<string>();
  const seen = await db.from('group_places').select('id, place_id, group_number, expedition_id').eq('campaign_id', campaignId).eq('undone', false).in('place_id', [...placeIds]);
  if (seen.error) return null;
  const visits = seen.data ?? [];
  if (visits.length === 0) return out;
  const expeditionIds = [...new Set(visits.map((v) => String(v.expedition_id)))];
  const [live, shows, pieces] = await Promise.all([
    db.from('expeditions').select('id').in('id', expeditionIds).eq('undone', false),
    db.from('piece_shows').select('group_place_id, piece_id').in('group_place_id', visits.map((v) => String(v.id))).eq('shown', true).eq('undone', false),
    db.from('place_pieces').select('id').in('place_id', [...placeIds]).eq('undone', false),
  ]);
  if (live.error || shows.error || pieces.error) return null;
  const liveExpeditions = new Set((live.data ?? []).map((x) => String(x.id)));
  const livePieces = new Set((pieces.data ?? []).map((pc) => String(pc.id)));
  const shownVisits = new Set((shows.data ?? []).filter((sh) => livePieces.has(String(sh.piece_id))).map((sh) => String(sh.group_place_id)));
  for (const v of visits) if (shownVisits.has(String(v.id)) && liveExpeditions.has(String(v.expedition_id))) out.add(`${String(v.place_id)}:${Number(v.group_number)}`);
  return out;
}

/**
 * The GM's Move on, read for the expedition under way: where the party's first group is, the links leaving it in that
 * place's pack, and each far end's name, number, campaign place and whether it was shown. Null when the party is at
 * no pack place, or when something can't be read.
 */
export async function loadMoveOn(db: Db, campaignId: string, expeditionId: string): Promise<MoveOnRead | null> {
  const visits = await db.from('group_places').select('group_number, place_id, created_at').eq('campaign_id', campaignId).eq('expedition_id', expeditionId).eq('undone', false).eq('moved_on', false).order('group_number').order('created_at', { ascending: false });
  if (visits.error) return null;
  const groups = new Set((visits.data ?? []).map((v) => Number(v.group_number)));
  const first = (visits.data ?? [])[0];
  if (!first?.place_id) return null;
  const herePlace = await db.from('places').select('id, name, pack_id, pack_entry_id').eq('id', String(first.place_id)).maybeSingle();
  if (herePlace.error || !herePlace.data?.pack_id || !herePlace.data.pack_entry_id) return null;
  const packId = String(herePlace.data.pack_id);
  const herePlaceId = String(herePlace.data.id);
  // The groups whose current place is this one (each group's newest visit not moved on).
  const groupsHere = new Set<number>();
  const seenGroups = new Set<number>();
  for (const v of visits.data ?? []) {
    const g = Number(v.group_number);
    if (seenGroups.has(g)) continue;
    seenGroups.add(g);
    if (String(v.place_id) === herePlaceId) groupsHere.add(g);
  }
  const hereEntry = String(herePlace.data.pack_entry_id);

  const [routeRows, hereRow] = await Promise.all([
    db.from('library_entries').select('id, pack_entry_id, data').eq('pack_id', packId).eq('kind', 'route'),
    db.from('library_entries').select('data').eq('pack_id', packId).eq('kind', 'location').eq('pack_entry_id', hereEntry).maybeSingle(),
  ]);
  if (routeRows.error || hereRow.error) return null;
  const hereData = (hereRow.data?.data ?? {}) as Record<string, unknown>;
  const wayOut = wayOutHere([{ data: hereData }]);
  const hereArea = text(hereData.parentId) || null;
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
  const farIds = [...new Set(ways.map((w) => w.farEnd))];

  const farEnds = new Map<string, FarEnd>();
  const players = new Map<string, PlayersRead>();
  if (farIds.length > 0) {
    const [entries, places] = await Promise.all([
      db.from('library_entries').select('pack_entry_id, name, data').eq('pack_id', packId).eq('kind', 'location').in('pack_entry_id', farIds),
      db.from('places').select('id, pack_entry_id').eq('campaign_id', campaignId).eq('pack_id', packId).eq('undone', false).in('pack_entry_id', farIds),
    ]);
    if (entries.error || places.error) return null;
    const placeOf = new Map((places.data ?? []).map((p) => [String(p.pack_entry_id), String(p.id)]));
    const placeIds = [...placeOf.values()];
    const shown = await shownToGroups(db, campaignId, [herePlaceId, ...placeIds]);
    if (!shown) return null;
    // As campaign_ways_on gives it to a group at this place: nothing at all until something of this place has been
    // shown to that group (mc-28b), and a far end's name only once something of it has been shown to the same group.
    // The GM's row says "Shown" when that is so for any group here now.
    const hereGroups = [...groupsHere].filter((g) => shown.has(`${herePlaceId}:${g}`));
    const farShown = (placeId: string) => hereGroups.some((g) => shown.has(`${placeId}:${g}`));
    // The places the far ends sit in, for the GM's headings (WT1 A): their names in the pack.
    const parentOf = new Map<string, string | null>();
    for (const id of farIds) {
      const data = ((entries.data ?? []).find((e) => String(e.pack_entry_id) === id)?.data ?? {}) as Record<string, unknown>;
      parentOf.set(id, text(data.parentId) || null);
    }
    const parentIds = [...new Set([...parentOf.values()].filter((p): p is string => p !== null))];
    const [parents, waysOn] = await Promise.all([
      parentIds.length > 0 ? db.from('library_entries').select('pack_entry_id, name').eq('pack_id', packId).eq('kind', 'location').in('pack_entry_id', parentIds) : Promise.resolve({ data: [], error: null }),
      loadWaysOn(db, campaignId),
    ]);
    if (parents.error) return null;
    const parentName = new Map((parents.data ?? []).map((p) => [String(p.pack_entry_id), text(p.name)]));
    for (const id of farIds) {
      const entry = (entries.data ?? []).find((e) => String(e.pack_entry_id) === id);
      const data = (entry?.data ?? {}) as Record<string, unknown>;
      const placeId = placeOf.get(id) ?? null;
      const parent = parentOf.get(id) ?? null;
      const area = parent ? { entryId: parent, name: parentName.get(parent) || parent } : null;
      farEnds.set(id, { entryId: id, name: text(entry?.name) || id, number: text(data.key) || null, placeId, shown: placeId !== null && farShown(placeId), area });
    }
    // What the party's group reads of each far end (sf-9), from the players' own read, which the GM may call too: the
    // first group here that has a row for it (a split party can't move on anyway: `moveBlocked`). Its rows name the
    // library's row of a route, the GM's ways its pack id.
    const routeOfRow = new Map(whole.map((r) => [r.id, r.entryId]));
    const farOfRoute = new Map(ways.map((w) => [w.route.id, w.farEnd]));
    for (const link of [...(waysOn ?? [])].sort((a, b) => a.groupNumber - b.groupNumber)) {
      if (!groupsHere.has(link.groupNumber) || link.to) continue;
      const far = farOfRoute.get(routeOfRow.get(link.routeId) ?? '');
      if (far && !players.has(far)) players.set(far, { number: link.number, elsewhere: link.elsewhere });
    }
  }
  const throughIds = [...new Set(ways.flatMap((w) => (w.barrier?.through ? [w.barrier.through] : [])))];
  const [switches, ...chains] = await Promise.all([loadRuleSwitches(db, campaignId), ...throughIds.map((id) => loadPlaceChain(db, packId, id))]);
  if (!switches || chains.some((c) => c === null)) return null;
  const throughs = new Map(throughIds.map((id, i) => [id, chains[i] as ChainEntry[]]));
  return { here: { placeId: String(herePlace.data.id), packId, entryId: hereEntry, name: text(herePlace.data.name) }, ways, farEnds, groups: Math.max(1, groups.size), throughs, switches, wayOut, hereArea, players };
}

// ---- What the sheet shows, from the read (MoveOnSheet's props, built as the gallery builds them) ----

/** A way's button on a destination's row. */
export interface WayChoiceOf {
  key: string;
  word: string;
  time: string;
  /** The way's short id on the link ("row"; empty for a link that gives one amount), read for its picture (pf-25). */
  by: string;
  /** The icon the pack names for the way (pf-25); absent when it names none. */
  icon?: string;
}

/** A destination on the GM's Move on list (MoveOnParts' `GmDestination`). */
export interface DestinationOf {
  id: string;
  number: string | null;
  name: string;
  shown: ShownToPlayers;
  /** For a far end not shown yet: what its players read on their row ("4. Unexplored"); null otherwise (`playersLineOf`). */
  players: string | null;
  /** The heading it stands under (WT1 A): the place it sits in, by its name; null when the list has one Area only. */
  area: string | null;
  obstacle: string | null;
  ways: WayChoiceOf[];
}

/** One heading's rows (WT1): its key, the heading (null where the list has one section only), its rows in order. */
export interface AreaSection<T> {
  key: string | null;
  heading: string | null;
  rows: T[];
}

/**
 * Rows grouped under their Areas (WT1, ⚑ 8: "where two Areas mix, each Area's name stands over its rows"), their order
 * within each kept: rows of no Area first, then `first` (the Area the party stands in), the others in the order their
 * first row comes, `last` ("Elsewhere") last. One section only: it has no heading (WT1 C). Rows of no Area have none.
 */
export function areaSections<T>(rows: readonly T[], keyOf: (row: T) => string | null, order: { first?: string | null; last?: string } = {}): AreaSection<T>[] {
  const groups = new Map<string | null, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const rank = (key: string | null) => (key === null ? 0 : key === order.first ? 1 : key === order.last ? 3 : 2);
  const keys = [...groups.keys()].sort((a, b) => rank(a) - rank(b));
  return keys.map((key) => ({ key, heading: keys.length > 1 ? key : null, rows: groups.get(key)! }));
}

/** The GM's line under a far end not shown (WT1 A, finding 21): what its players read, after the closed eye. */
export const PLAYERS_READ_WORDS = {
  unexplored: 'Unexplored',
  elsewhere: 'Unexplored, under “Elsewhere”',
  /** The closed eye's spoken name, before what they read, so the line is heard "Not shown yet. Players read: 4. Unexplored". */
  eye: 'Not shown yet. Players read:',
} as const;

/**
 * What the players read on a far end's row not yet shown (WT1 A): "4. Unexplored", "Unexplored" where it has no number,
 * "Unexplored, under “Elsewhere”" where it leads out of the Areas they know; from their own read where it has the row,
 * else by the far end's number alone (no ways reach them yet, or their read failed).
 */
export function playersLineOf(read: Pick<MoveOnRead, 'players' | 'farEnds'>, farEnd: string): string {
  const theirs = read.players.get(farEnd);
  if (theirs?.elsewhere) return PLAYERS_READ_WORDS.elsewhere;
  return keyedName(theirs ? theirs.number : read.farEnds.get(farEnd)?.number, PLAYERS_READ_WORDS.unexplored);
}

/**
 * A way's word on its button: the way's name as the pack writes it (4a, departure 4); a link that gives one amount and
 * names no way says Move, the sheet's own word for going.
 */
export const wayWordOf = (way: Pick<RouteWay, 'name'>): string => way.name || 'Move';

/** The name of the place a crossing passes, from the read; null without one. */
const throughNameOf = (read: MoveOnRead, through: string | null): string | null => (through ? (read.throughs.get(through)?.[0]?.name ?? null) : null);

/** The far end's name, from the read (the id when the pack has no such place). */
const farNameOf = (read: MoveOnRead, id: string): string => read.farEnds.get(id)?.name ?? id;

/**
 * The GM's destinations, one row a place, in the Locations' order (`byMapNumber`, Q1: no map number first, in the pack's
 * order of its links, then by number): every way of every link to it as a button; "Hidden from players" only when
 * every link to it is hidden; under one not shown, what its players read; the first obstacle met on its ways as the
 * row's warning. Where the far ends sit in more than one place, the rows stand under their names (WT1 A,
 * `areaSections`): the party's own Area first.
 */
export function destinationsOf(read: MoveOnRead): DestinationOf[] {
  const rows = numberedDestinationsOf(read);
  const sections = areaSections(rows, (row) => read.farEnds.get(row.id)?.area?.entryId ?? null, { first: read.hereArea });
  return sections.flatMap((section) => section.rows.map((row) => ({ ...row, area: section.heading === null ? null : (read.farEnds.get(row.id)?.area?.name ?? null) })));
}

function numberedDestinationsOf(read: MoveOnRead): DestinationOf[] {
  // shortcut: every far end is sorted as a Location (FarEnd has no kind), so a link to a numbered room would sort too; carry the kind when links reach rooms (the dungeon sitting).
  const order: string[] = [];
  for (const w of read.ways) if (!order.includes(w.farEnd)) order.push(w.farEnd);
  return byMapNumber(order, (id) => read.farEnds.get(id)?.number).map((id) => {
    const links = read.ways.filter((w) => w.farEnd === id);
    const far = read.farEnds.get(id);
    const met = links.find((l) => l.barrier)?.barrier ?? null;
    const shown = shownOf(links.every((l) => l.route.hidden), far?.shown ?? false);
    return {
      id,
      number: far?.number ?? null,
      name: farNameOf(read, id),
      shown,
      players: shown === 'unshown' ? playersLineOf(read, id) : null,
      area: null,
      obstacle: met ? obstacleRowWords(met, obstacleNameOf(met, throughNameOf(read, met.through))) : null,
      ways: links.flatMap((l) => l.route.ways.map((way) => ({ key: wayKeyOf(l.route.id, way), word: wayWordOf(way), time: wayTimeWords(way), by: way.by, ...(way.icon ? { icon: way.icon } : {}) }))),
    };
  });
}

/** The link and the way a button names; null when the read has no such way. */
export function wayOf(read: MoveOnRead, destinationId: string, key: string): { link: WayFromHere; way: RouteWay } | null {
  for (const link of read.ways) {
    if (link.farEnd !== destinationId) continue;
    const way = link.route.ways.find((w) => wayKeyOf(link.route.id, w) === key);
    if (way) return { link, way };
  }
  return null;
}

/**
 * The check of the place a crossing passes, when that place has its own (`throughCheckOf`): its words for the Then
 * line and the check itself for the move's encounter check; null otherwise.
 */
export function throughOf(read: MoveOnRead, through: string | null): { words: { placeName: string; chance: Check['chance'] }; check: Check } | null {
  const chain = through ? read.throughs.get(through) : undefined;
  if (!through || !chain) return null;
  const words = throughCheckOf(chain, read.here.packId, through, read.switches);
  const found = placeCheckOf(chain, read.switches);
  return words && found ? { words, check: found.check } : null;
}

/**
 * What one way's step says (MoveOnParts' `WayMove`), as frames 12 and 13 have it, redrawn by page 24's WY1a (B9): the
 * title is the way's word and where to, "Row to 1. The Jetty" (the title says where, so there is no Where line).
 */
export function wayMoveOf(read: MoveOnRead, destinationId: string, key: string, check: MoveCheck | null) {
  const found = wayOf(read, destinationId, key);
  const to = keyedName(read.farEnds.get(destinationId)?.number, farNameOf(read, destinationId));
  if (!found) return { title: `To ${to}`, takes: '', then: null, obstacle: null };
  const { link, way } = found;
  const barrier = link.barrier;
  const throughName = throughNameOf(read, barrier?.through ?? null);
  return {
    title: `${wayWordOf(way)} to ${to}`,
    takes: takesWords(way, barrier),
    then: thenWords(check, throughOf(read, barrier?.through ?? null)?.words ?? null),
    obstacle: barrier ? { name: obstacleNameOf(barrier, throughName), extra: obstacleExtraWords(barrier), note: barrier.note, needsApproval: barrier.needsApproval } : null,
  };
}
