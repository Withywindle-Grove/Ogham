// Moving on between linked spots, its words and its queue (plan dec-7-linked-spots-screens.md piece 4a; mc-36, mc-36a,
// mc-41, mc-41a, mc-42, mc-42a, mc-28a to mc-28c, dp-4, dp-5; mockup december/01 frames 11, 12, 13, F1, F2, F2b). Pure:
// the parts in src/ui/MoveOnParts.tsx draw what these say. No request, no proposal storage and no move here: those are
// piece 4b's; the queue below is the state a caller keeps, tested on its own.

import type { Barrier, RouteWay } from '../library/routes.ts';
import type { Chance } from './modes.ts';
import { chainOf, checkChanceWords, placeCheckOf, rollsItsTable, type ChainEntry, type PlaceCheck, type RuleSwitch } from './placeRules.ts';

/** "1 turn", "3 turns", "0 turns": a whole amount and its unit, in words. */
export function timeWords(value: number, unit: string): string {
  const one = unit.trim().toLowerCase().replace(/s$/, '');
  return `${value} ${one}${value === 1 ? '' : 's'}`;
}

/** A way's own time, as its button says it under the action word ("1 turn"). */
export const wayTimeWords = (way: Pick<RouteWay, 'value' | 'unit'>): string => timeWords(way.value, way.unit);

/** A place's name inside a sentence: a leading "The" is lower-cased ("by way of the breakwater"), the rest as written. */
export function inSentence(name: string): string {
  return name.replace(/^The /, 'the ');
}

/** "the breakwater’s" for a name, inside a sentence. */
const possessive = (name: string) => `${inSentence(name)}’${/s$/i.test(name) ? '' : 's'}`;

/**
 * How long the move takes, on the sheet's Takes line: the way's time, then any obstacle's extra turns and the whole
 * ("2 turns, and 2 more for the obstacle: 4 turns."). A way counted in another unit keeps its own and adds the turns
 * without a sum ("2 hours, and 1 turn more for the obstacle.").
 */
export function takesWords(way: Pick<RouteWay, 'value' | 'unit'>, barrier: Pick<Barrier, 'extraTurns'> | null): string {
  const base = wayTimeWords(way);
  const extra = barrier?.extraTurns ?? 0;
  if (extra === 0) return `${base}.`;
  if (way.unit === 'turn') return `${base}, and ${extra} more for the obstacle: ${timeWords(way.value + extra, 'turn')}.`;
  return `${base}, and ${timeWords(extra, 'turn')} more for the obstacle.`;
}

/**
 * The name an obstacle is shown by (pf-12f): its own `name`, else the name of the place its crossing passes
 * (`through`), else none, and the heading is "Obstacle" alone. The GM's: a player learns it only after a No (dp-5, 4b).
 */
export function obstacleNameOf(barrier: Pick<Barrier, 'name'>, throughName?: string | null): string | null {
  return barrier.name || throughName?.trim() || null;
}

/** The name of the place `id` in the entries, for `obstacleNameOf`; null when it isn't there. */
export function placeNameOf(entries: readonly ChainEntry[], packId: string, id: string | null): string | null {
  return (id && entries.find((e) => e.packId === packId && e.entryId === id)?.name) || null;
}

/** The obstacle block's first line, before the book's note: "2 turns more." (empty when it takes no more time). */
export function obstacleExtraWords(barrier: Pick<Barrier, 'extraTurns'>): string {
  return barrier.extraTurns > 0 ? `${timeWords(barrier.extraTurns, 'turn')} more.` : '';
}

/**
 * The warning on the GM's destination row for a way with an obstacle (frame 11): "An obstacle: 2 turns more; you
 * decide." The GM's words only: a player's row says nothing of an obstacle before it is met (F1).
 */
export function obstacleRowWords(barrier: Pick<Barrier, 'extraTurns' | 'needsApproval'>, name?: string | null): string {
  const what = name ? `An obstacle, ${inSentence(name)}` : 'An obstacle';
  const parts = [barrier.extraTurns > 0 ? `${timeWords(barrier.extraTurns, 'turn')} more` : '', barrier.needsApproval ? 'you decide' : ''].filter(Boolean);
  return parts.length ? `${what}: ${parts.join('; ')}.` : `${what}.`;
}

/** A check a move asks for, as the sheet names it. */
export interface MoveCheck {
  /** Never an id (p2p-18, `checkNameOf`). */
  name: string;
  chance: Chance | null;
  /**
   * The name of the table it always rolls, for a check that is a roll on its table (p2p-19, `rollsItsTable`): the Then
   * line reads "a roll on <it>". Absent or null for a check with a chance.
   */
  roll?: string | null;
}

/**
 * The check a move asks for: the place's own when it stands in for the setting's now (piece 3's `placeCheckOf`, in
 * force), else the setting's as the caller reads it from the mode; null when there is neither. `tableName` names the
 * table a place's check always rolls (the setting's tables are the caller's). Null at a place whose "none" is in force.
 */
export function moveCheckOf(here: PlaceCheck | null, setting: MoveCheck | null, tableName?: (tableId: string) => string | null): MoveCheck | null {
  if (!here?.inForce) return setting;
  // A "none" in force never comes due, so the move asks for no check (G-27, dg-4).
  if (here.none) return null;
  const tableId = here.check.onHit.tableId;
  const roll = rollsItsTable(here.check) && tableId ? (tableName?.(tableId) ?? null) : null;
  return { name: here.name, chance: here.check.chance, ...(roll ? { roll } : {}) };
}

/**
 * The place an obstacle's crossing passes (`barrier.through`), when it has a check of its own: its name and its chance
 * ("with the breakwater’s chance", frame 13), read by piece 3's `placeCheckOf`. Null when the place isn't in the
 * entries, or the check `placeCheckOf` finds is a place's it sits in rather than its own (that one is the move's
 * check already).
 */
export function throughCheckOf(entries: readonly ChainEntry[], packId: string, throughId: string | null, switches: readonly RuleSwitch[]): { placeName: string; chance: Chance | null } | null {
  if (!throughId) return null;
  const found = placeCheckOf(chainOf(entries, packId, throughId), switches);
  return found && !found.none && found.owner.entryId === throughId ? { placeName: found.owner.name, chance: found.check.chance } : null;
}

/**
 * The sheet's Then line: the check the move asks for, with its chance ("Encounter check, 1 in 6."); where the way
 * passes a place with its own check (an obstacle's `through`, read by `placeCheckOf` on that place), that place's
 * chance ("Encounter check, with the breakwater’s chance: 2 in 6."). A check that is a roll on its table (p2p-19)
 * reads "a roll on Encounters in the harbour." (page 24, WY1a). The words name the die, for `DiceWords`. Null with no
 * check. The list has no foot line naming the check (p2p-17; page 24, WY1d).
 */
export function thenWords(check: MoveCheck | null, through?: { placeName: string; chance: Chance | null } | null): string | null {
  if (!check) return null;
  const passing = through ? checkChanceWords(through.chance) : null;
  if (through && passing) return `${check.name}, with ${possessive(through.placeName)} chance: ${passing}.`;
  const chance = checkChanceWords(check.chance);
  if (chance) return `${check.name}, ${chance}.`;
  return check.roll ? `a roll on ${check.roll}.` : `${check.name}.`;
}

// ---- The queue of proposed ways (mc-42a, dp-4) ----

/**
 * The GM's proposed ways, as the caller keeps them. A proposal's sheet opens by itself; several are counted ("1 of
 * 3") and worked first in, first out (mc-42a). Not now leaves one as a waiting row and goes on to the next. A proposal
 * that arrives while the GM has another sheet open joins the queue: the open sheet is not displaced, and the count
 * updates (dp-4). The ✕ closes the sheet and leaves every proposal waiting; the next to arrive opens the sheet again,
 * at the first in.
 */
export interface MoveQueue<P extends { id: string }> {
  /** Waiting to open by themselves, first in first. */
  queue: P[];
  /** Set aside with Not now: waiting rows, opened only from their row. */
  aside: P[];
  /** The proposal whose sheet is open (always one in `queue`); null when none is. */
  current: string | null;
  /** Another sheet is open (dp-4): nothing opens over it. */
  otherSheet: boolean;
  /** The ✕ was tapped: nothing opens by itself until another proposal arrives or a row is tapped. */
  paused: boolean;
}

export function emptyMoveQueue<P extends { id: string }>(): MoveQueue<P> {
  return { queue: [], aside: [], current: null, otherSheet: false, paused: false };
}

/** Opens the first in when nothing is open and nothing holds it back. */
function settle<P extends { id: string }>(q: MoveQueue<P>): MoveQueue<P> {
  if (q.current !== null && q.queue.some((p) => p.id === q.current)) return q;
  const next = !q.otherSheet && !q.paused ? (q.queue[0]?.id ?? null) : null;
  return { ...q, current: next };
}

const without = <P extends { id: string }>(list: P[], id: string) => list.filter((p) => p.id !== id);

/**
 * A proposal arrives. One already waiting (the same id) is updated where it stands; a new one joins the end of the
 * queue. It opens at once only when no sheet is open; it never covers an open sheet (dp-4). An arrival lifts the ✕'s
 * pause.
 */
export function proposalArrives<P extends { id: string }>(q: MoveQueue<P>, p: P): MoveQueue<P> {
  const inQueue = q.queue.some((x) => x.id === p.id);
  const inAside = q.aside.some((x) => x.id === p.id);
  const queue = inQueue ? q.queue.map((x) => (x.id === p.id ? p : x)) : inAside ? q.queue : [...q.queue, p];
  const aside = inAside ? q.aside.map((x) => (x.id === p.id ? p : x)) : q.aside;
  return settle({ ...q, queue, aside, paused: false });
}

/** Another sheet opens or closes (dp-4). When it closes, the first in opens. */
export function otherSheetOpen<P extends { id: string }>(q: MoveQueue<P>, open: boolean): MoveQueue<P> {
  return settle({ ...q, otherSheet: open });
}

/** The GM answered Yes or No: it leaves the queue (or its row) and the next opens. */
export function proposalAnswered<P extends { id: string }>(q: MoveQueue<P>, id: string): MoveQueue<P> {
  return settle({ ...q, queue: without(q.queue, id), aside: without(q.aside, id), current: q.current === id ? null : q.current });
}

/** Not now: it becomes a waiting row and the next opens (mc-42a). */
export function proposalNotNow<P extends { id: string }>(q: MoveQueue<P>, id: string): MoveQueue<P> {
  const p = q.queue.find((x) => x.id === id);
  if (!p) return q;
  return settle({ ...q, queue: without(q.queue, id), aside: [...q.aside, p], current: q.current === id ? null : q.current });
}

/** The player took it back (Cancel): it goes, wherever it waits, and the next opens if it was open. */
export function proposalWithdrawn<P extends { id: string }>(q: MoveQueue<P>, id: string): MoveQueue<P> {
  return proposalAnswered(q, id);
}

/**
 * The ✕ (ruled 2026-11-13, as built): the sheet closes and every proposal stays waiting, none answered; they are
 * the waiting card's (`moveSheetReopened`). Nothing opens by itself until the next arrives (mc-42a).
 */
export function moveSheetClosed<P extends { id: string }>(q: MoveQueue<P>): MoveQueue<P> {
  return { ...q, current: null, paused: true };
}

/** The GM taps a waiting row: its sheet opens, first in the count from now (a row set aside joins the queue's front). */
export function proposalOpened<P extends { id: string }>(q: MoveQueue<P>, id: string): MoveQueue<P> {
  const p = q.queue.find((x) => x.id === id) ?? q.aside.find((x) => x.id === id);
  if (!p) return q;
  return { ...q, queue: [p, ...without(q.queue, id)], aside: without(q.aside, id), current: id, paused: false };
}

/**
 * The GM taps the waiting card (the ✕ hides nothing: the proposals still waiting are a card in Waiting for you, with
 * their count, placed by 5b): the sheet opens again at the first still waiting. Nothing waits: unchanged.
 */
export function moveSheetReopened<P extends { id: string }>(q: MoveQueue<P>): MoveQueue<P> {
  const first = waitingProposals(q)[0];
  return first ? proposalOpened(q, first.id) : q;
}

/** The sheet open now: the proposal, its place in the queue and the queue's length; null when none is open. */
export function shownProposal<P extends { id: string }>(q: MoveQueue<P>): { proposal: P; place: number; of: number } | null {
  const at = q.current === null ? -1 : q.queue.findIndex((p) => p.id === q.current);
  return at < 0 ? null : { proposal: q.queue[at]!, place: at + 1, of: q.queue.length };
}

/** "1 of 3" beside the ✕; nothing when only one waits. */
export function queueCountWords(shown: { place: number; of: number } | null): string | null {
  return shown && shown.of > 1 ? `${shown.place} of ${shown.of}` : null;
}

/** Every proposal still waiting, in the order the GM's Waiting for you lists them: the queue, then those set aside. */
export function waitingProposals<P extends { id: string }>(q: MoveQueue<P>): P[] {
  return [...q.queue, ...q.aside];
}
