// A player's "Where to?" (plan dec-9-the-players-scene, row P2; mc-28, mc-28a, mc-28b, mc-36, mc-36a, d5-1, d5-2,
// p2p-22, p2p-30; page 18 of the December mockups, PL1, PL2, PL4c, PL9, approved 2026-11-14; set 1's `01-08`). Pure:
// it turns the players' ways read (`loadWaysOn`, `campaign_ways_on`) into the rows the Scene draws, and holds their
// words. The read already keeps back everything a player may not have (a hidden way, an unshown far end's name, an
// obstacle, the pack's ids, any way at all before something of here is shown): nothing here adds to it.
import type { RouteWay } from '../library/routes.ts';
import type { WayOn } from '../library/waysOn.ts';
import { isPartOfDay, type TimeUnits } from './clock.ts';
import type { Mode } from './modes.ts';
import { inSentence, wayTimeWords } from './moveOn.ts';
import { wayKeyOf, wayWordOf } from './moveOnWays.ts';
import { expeditionLine, stepOfLine, type Expedition } from './play.ts';

/** One way's button on a player's row (`WayChoice` in src/ui/MoveOnParts.tsx). No icon: the read sends none (pf-25). */
export interface PlayersWay {
  key: string;
  word: string;
  time: string;
  /** Read for its picture (`wayIconOf`): a player's button carries the way's `by` mark, as the GM's does. */
  by: string;
}

/** One row of a player's Where to?: a destination and its ways. */
export interface PlayersDestination {
  /** The far end's place in this campaign; for a far end not yet explored, the route's row id (nothing names it). */
  id: string;
  /** Its players' name; for a far end not yet explored, the words the row is titled by (`unexploredTitle`). */
  name: string;
  /** False: the far end hasn't been shown to the group ("Not yet explored."). */
  explored: boolean;
  ways: PlayersWay[];
}

/** "Rowing or swimming": a list of words joined as one name, its first letter kept, the rest lower-cased. */
function orWords(words: readonly string[]): string {
  return words.map((w, i) => (i === 0 ? w : w.toLowerCase())).join(' or ');
}

/**
 * The title of a row whose far end has not been explored: nothing names that place to a player, so the row is called
 * by its way's own name (dec-7 plan, Departures 11: "the way's own name with 'Not yet explored.'"), several joined
 * ("Rowing or swimming"); a link that names no way: "Another way". (⚑: the frame's "Along the piles" is a name the pack
 * format has no field for.)
 */
export function unexploredTitle(ways: readonly Pick<RouteWay, 'name'>[]): string {
  const names = [...new Set(ways.map((w) => w.name.trim()).filter(Boolean))];
  return names.length > 0 ? orWords(names) : 'Another way';
}

const buttonOf = (routeId: string, way: RouteWay): PlayersWay => ({ key: wayKeyOf(routeId, way), word: wayWordOf(way), time: wayTimeWords(way), by: way.by });

/**
 * The rows of a group's Where to? (mc-36: one row a destination): every way leading to one shown place is a button on
 * its row, the place's rows in the order of their names (a number in a name in its own order, "2" before "10"); a far
 * end not yet explored can't be told from another, so each such link is a row of its own, after the named ones. A link
 * that gives no time has no button, and a row with none is left out: there is nothing to choose on it.
 */
export function playersDestinationsOf(ways: readonly WayOn[], group: number): PlayersDestination[] {
  const known = new Map<string, PlayersDestination>();
  const unexplored: PlayersDestination[] = [];
  for (const link of ways) {
    if (link.groupNumber !== group || link.ways.length === 0) continue;
    const buttons = link.ways.map((way) => buttonOf(link.routeId, way));
    if (link.to) {
      const row = known.get(link.to.placeId);
      if (row) row.ways.push(...buttons.filter((b) => !row.ways.some((w) => w.key === b.key)));
      else known.set(link.to.placeId, { id: link.to.placeId, name: link.to.name, explored: true, ways: buttons });
    } else {
      unexplored.push({ id: link.routeId, name: unexploredTitle(link.ways), explored: false, ways: buttons });
    }
  }
  const byName = [...known.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  return [...byName, ...unexplored];
}

/**
 * The pop-up of a tap on a way's button (PL4c; pw-1: proposing waits until after 5 December): its title, "To the wreck,
 * rowing", or the way's word alone where the far end isn't explored (nothing names it); the way's time; and who moves
 * the party.
 */
export function wayTapWords(destination: Pick<PlayersDestination, 'name' | 'explored'>, way: Pick<PlayersWay, 'word' | 'time'>): { title: string; time: string; words: string } {
  return {
    title: destination.explored ? `To ${inSentence(destination.name)}, ${way.word.toLowerCase()}` : way.word,
    time: `${way.time}.`,
    words: WHERE_TO_WORDS.gmMoves,
  };
}

/** The words of a player's Where to?, in one place (06's words and voice guide). */
export const WHERE_TO_WORDS = {
  /** PL2: before anything of the place is shown to the group (mc-28b, mc-50). */
  noneYet: 'None to choose from yet. They show here once your GM has shown you something of this place.',
  /** PL4c: what a tap on a way's button says, for first play. */
  gmMoves: 'Your GM moves the party. Say where you want to go.',
  /** d5-2, p2p-flag4: the "End expedition" row's pop-up (the driver's wording). */
  endTitle: 'End expedition',
  gmEnds: 'Your GM ends the expedition.',
  /** PL9: a refresh failed; the last good list stays, with when it was read where the step is known. */
  stale: (step: string | null) => `The ways didn’t refresh. These are as they were ${step ? `at ${step}` : 'when last read'}.`,
  /** The first read failed: there is no list to keep (no frame draws it; PL9's row with no list under it). */
  failed: 'The ways didn’t load.',
} as const;

/**
 * The mode's own count now ("turn 14"), as the Scene's heading says it (bandHeading, S1); null where the mode counts no
 * steps (a part of the day) or can't be read.
 */
export function stepNowOf(mode: Mode | null, expedition: Pick<Expedition, 'startedAt'> | null, now: number, units: TimeUnits | null): string | null {
  if (!mode || !expedition || !units || isPartOfDay(mode.step.unit)) return null;
  const line = expeditionLine(mode, expedition, now, units);
  return line.startsWith(`${mode.name}, `) ? stepOfLine(line, mode.name) : null;
}
