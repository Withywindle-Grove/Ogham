// The party stash's own screen in words (K11; pk-4; mockup pack/08, frames PK1, PK4, PK9b, approved 2026-11-14): the
// Pack's "Party stash" row, the three facts, who put each thing in and when, and the stash's recent lines. Words only,
// read from the stash's history (`stashHistory.ts`, K14), so the screen and its tests say the same.
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { countWords, stackable } from '../modules/inventory/packView.ts';
import { whenWords, type StashMove } from '../modules/inventory/stashHistory.ts';

const capital = (text: string) => (text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text);

/** "1 thing", "7 things": the stash's count on the Pack's row and in its first fact. */
export const thingCount = (n: number) => `${n} ${n === 1 ? 'thing' : 'things'}`;

/** A thing and how many, as the facts read it: "Silver ewer", "Torches ×2" (the pack's own plural where it has one). */
export function thingWords(line: Pick<InventoryLine, 'name' | 'details'>, qty: number): string {
  return capital(countWords(line, Math.max(1, qty)));
}

/** A fact's who and when: "Tam, today."; "Day 2." when the log can't say whose hands it was in. */
function whoWhen(who: string | null, move: StashMove): string {
  const when = whenWords(move.when);
  return who ? `${who}, ${when}.` : `${capital(when)}.`;
}

/** The last thing in, or out: "Silver ewer. Tam, today." (frame PK4). */
export function factWords(thing: string, who: string | null, move: StashMove): string {
  return `${thing}. ${whoWhen(who, move)}`;
}

/**
 * Under a stash row's name, who put it in and when: "Tam put it in, today."; "Ash put them in, day 2." for a stack of
 * more than one; "Your GM put it in, today." Without a name to give, "Put in today." (not drawn: the PR's ⚑).
 */
export function putInWords(line: InventoryLine, who: string | null, move: StashMove): string {
  const them = stackable(line) && line.qty > 1 ? 'them' : 'it';
  const when = whenWords(move.when);
  return who ? `${who} put ${them} in, ${when}.` : `Put in ${when}.`;
}

/**
 * One of the stash's recent lines (frame PK4, PK9b): "Tam put in Silver ewer.", "Ash took Torches ×2." A thing that
 * left play from the stash (dropped, used up) has no line here: the log says how it went. "Someone" where the log
 * can't say who (as the log's own lines).
 */
export function recentWords(move: StashMove, who: string | null, thing: string): string | null {
  if (move.leftPlay) return null;
  return `${who ?? 'Someone'} ${move.direction === 'in' ? 'put in' : 'took'} ${thing}.`;
}

/** When a recent line happened, under it: "Today", "Day 2", "6 Nov". */
export const recentWhen = (move: StashMove) => capital(whenWords(move.when));
