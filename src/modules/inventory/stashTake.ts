// Take from the party stash (K12, built on K28's words; pk-2, pk-3; mockup pack/08 frame PK4b, approved 2026-11-14,
// ap-6). Take is today's inventory.move to the taker, landing loose (pk-2); its Undo is the latest inventory.move's, as
// for any move. Words only, so the screen and its tests say the same:
//   the toast, in the log line's words with what it did to the taker's load: "Wren took Silver ewer. Load 413 of 1,200
//   coins’ weight."; over the limit the taker is told, never blocked: "Over the limit: 1,263 of 1,200." under it;
//   a stack's sheet: the accent naming the amount ("Take 2 torches") and its refusals under the row.
import type { CarriedLoad } from './encumbrance.ts';
import type { InventoryLine } from './inventory.ts';
import { countWords, shownName } from './packView.ts';

const num = (n: number) => n.toLocaleString('en');
const outOf = (n: number, most: number | null) => `${num(n)}${most !== null ? ` of ${num(most)}` : ''}`;

/** "Load 413 of 1,200 coins’ weight." (by coins), "Load 9 of 12 slots." (by slots); null where no load is counted. */
export function takeLoadWords(load: CarriedLoad): string | null {
  if (load.mode !== 'coin' && load.mode !== 'slot') return null;
  return `Load ${outOf(load.load, load.capacity)} ${load.mode === 'coin' ? 'coins’ weight' : 'slots'}.`;
}

/**
 * Take's toast (PK4b): "<Taker> took <thing>." and the taker's load after it; past the limit, the load is a warning
 * line of its own ("Over the limit: 1,263 of 1,200."), and the take stands (told, not blocked; ⚑ 18).
 */
export function takeToast(taker: string, line: Pick<InventoryLine, 'name' | 'details'>, qty: number, load: CarriedLoad): { text: string; warning: string | null } {
  const text = `${taker} took ${countWords(line, qty)}.`;
  if ((load.mode === 'coin' || load.mode === 'slot') && load.over) return { text, warning: `Over the limit: ${outOf(load.load, load.capacity)}.` };
  const said = takeLoadWords(load);
  return { text: said ? `${text} ${said}` : text, warning: null };
}

/** How many a stack's box asks for: a whole number from 1 to what the stash has, or null. */
export function readTake(typed: string, has: number): number | null {
  const text = typed.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= has ? n : null;
}

/** The stack sheet's accent, naming the amount (as coin's does, pu-5): "Take 2 torches", "Take 1 torch"; "Take" before a count. */
export function takeLabel(line: Pick<InventoryLine, 'name' | 'details'>, typed: string, has: number): string {
  const n = readTake(typed, has);
  if (n === null) return 'Take';
  if (n > 1) return `Take ${countWords(line, n)}`;
  const one = typeof line.details.unitName === 'string' && line.details.unitName.trim() ? line.details.unitName.trim() : null;
  return one ? `Take 1 ${one}` : `Take ${shownName(line.name)} ×1`;
}

/** Why the box can't be taken, said under the row (the button stays a button): too many, or not a count. */
export function takeRefusal(typed: string, has: number): string | null {
  if (readTake(typed, has) !== null) return null;
  const text = typed.trim();
  if (/^\d+$/.test(text) && Number(text) > has) return `The stash has ${num(has)}.`;
  return 'Say how many: a whole number, 1 or more.';
}

/** A row is a stack the sheet asks about when it holds more than one; a single thing is taken at once (pk-3). */
export const asksHowMany = (line: Pick<InventoryLine, 'qty'>) => line.qty > 1;
