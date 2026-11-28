// The toast after Add item (K7 of docs/plans/dec-6-the-whole-pack-tab.md; frame PK10b of
// docs/design/mockups/pack/08-the-pack-tab-whole.html, approved 2026-11-14, ap-7; rulings psw-5 and tn-1).
// Nothing is charged by itself (tn-1): after "Bought" the toast says the thing was added and that its cost is not spent
// yet, and offers "Spend 4 herons", which opens the coin's Spend sheet with that amount filled in; the player taps
// Spend there. With "No cost", or no cost written, the toast is the plain one. Pure: it only builds the toast.
// The town's Buy it (TC13 piece C, frame TW4a) uses it too, with the verb "bought": "Wren bought a coil of rope. Its
// cost, 1 heron, is not spent yet."; the Pack's own words stay "added".
import { coinLine, type Denomination } from '../modules/inventory/coinWords.ts';
import type { ToastRequest } from '../ui/ToastHost.tsx';

/**
 * "Wren added Storm lantern." with, for a cost not yet spent, " Its cost, 4 herons, is not spent yet."; to the stash,
 * "Added Storm lantern to the Party stash."; with `bought`, "Wren bought a coil of rope." (the town's Buy it).
 */
export function addedWords(who: string | null, what: string, cost: string, verb: 'added' | 'bought' = 'added'): string {
  const added = who ? `${who} ${verb} ${what}.` : `Added ${what} to the Party stash.`;
  const owed = cost.trim();
  return owed ? `${added} Its cost, ${owed}, is not spent yet.` : added;
}

/**
 * The toast after Add item. `coins` is the cost read in the setting's coins (null when it can't be read, or there is
 * no purse to spend it from): only then is "Spend <amount>" offered. `onUndo` is given only where Undo can take the add
 * back (the generic Undo; today an add that joined a stack already carried).
 */
export function purchaseToast(input: {
  who: string | null;
  what: string;
  cost: string;
  denominations: readonly Denomination[];
  coins: Record<string, number> | null;
  onSpend: (coins: Record<string, number>) => void;
  onUndo?: () => void;
  /** Put on at once and it stops casting (B25): its words lead the toast ("Bog plate stops divine casting."). */
  stopped?: string;
  /** The verb after the name: "added" on the Pack; "bought" for the town's Buy it (TC13 piece C, TW4a). */
  verb?: 'added' | 'bought';
}): ToastRequest {
  const { coins, onSpend } = input;
  const added = addedWords(input.who, input.what, input.cost, input.verb);
  return {
    text: input.stopped ? `${input.stopped}. ${added}` : added,
    ...(input.cost.trim() && coins ? { action: { label: `Spend ${coinLine(input.denominations, coins)}`, run: () => onSpend(coins) } } : {}),
    ...(input.onUndo ? { onUndo: input.onUndo } : {}),
  };
}
