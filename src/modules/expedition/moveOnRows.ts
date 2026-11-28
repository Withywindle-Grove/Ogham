// What the GM's Move on sheet shows, from the read (`loadMoveOn`, moveOnWays.ts): MoveOnSheet's props, built as the
// gallery builds them (piece 5b-0 of docs/plans/dec-7-5-place-page-and-map.md; WT1, sf-9). The destinations in the
// Locations' order under their Areas (`areaSections`, which the players' rows share, playersWays.ts), what the players
// read on a row not shown, each way's button and word, and what one way's step says. No reading here and no screen.

import type { RouteWay } from '../library/routes.ts';
import type { Check } from './modes.ts';
import { obstacleExtraWords, obstacleNameOf, obstacleRowWords, takesWords, thenWords, throughCheckOf, wayTimeWords, type MoveCheck } from './moveOn.ts';
import { shownOf, wayKeyOf, type MoveOnRead, type ShownToPlayers, type WayFromHere } from './moveOnWays.ts';
import { placeCheckOf } from './placeRules.ts';
import { byMapNumber, keyedName } from './placeTree.ts';

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
  const sections = [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
  return sections.map(([key, rows]) => ({ key, heading: sections.length > 1 ? key : null, rows }));
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
 * Whether the place a move goes into has its "none" in force (G-27, dg-4: "Move on's 'Then' line into such a place has no
 * check line"): read from the far end's own chain, so a place inside a "none" place is quiet too, and the GM's switch
 * puts the check back. The place the party leaves doesn't decide it.
 */
export function intoNoneOf(read: Pick<MoveOnRead, 'farChains' | 'switches'>, destinationId: string): boolean {
  const found = placeCheckOf(read.farChains.get(destinationId) ?? [], read.switches);
  return found?.inForce === true && found.none;
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
  const through = throughOf(read, barrier?.through ?? null)?.words ?? null;
  // Into a "none" place the move asks for no check (dg-4), unless the way passes a place with its own (the move rolls that).
  const quiet = intoNoneOf(read, destinationId) && !through;
  return {
    title: `${wayWordOf(way)} to ${to}`,
    takes: takesWords(way, barrier),
    then: thenWords(quiet ? null : check, through),
    obstacle: barrier ? { name: obstacleNameOf(barrier, throughName), extra: obstacleExtraWords(barrier), note: barrier.note, needsApproval: barrier.needsApproval } : null,
  };
}
