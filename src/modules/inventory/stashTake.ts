// Take from the party stash (K28, pk-3; docs/plans/dec-6-the-whole-pack-tab.md): the toast says what was taken and
// what it did to the taker's load, "Took 2 torches. Load: Heavy.", with Undo through the existing undo path (Take is
// today's inventory.move; its Undo is the toast's undoLatest('inventory.move'), as for any move). Words only: the
// screen that shows the toast is a later row.
import type { CarriedLoad } from './encumbrance.ts';
import type { InventoryLine } from './inventory.ts';
import { countWords } from './packView.ts';

/**
 * The taker's load in a word, after the take: the tier's label, or the setting's words past the most (`overMax`).
 * Null where the setting counts no tiers (mode "none") or loads by armour (no tier to name; the status file's question).
 */
export function loadTierWords(load: CarriedLoad): string | null {
  if (load.mode !== 'coin' && load.mode !== 'slot') return null;
  if (load.over) return load.overMax.trim() || null;
  return load.tier?.label.trim() || null;
}

/** Take's toast: "Took <thing>. Load: <tier>." (pk-3); without a tier to name, "Took <thing>." */
export function takeToastText(line: Pick<InventoryLine, 'name' | 'details'>, qty: number, load: CarriedLoad): string {
  const tier = loadTierWords(load);
  return `Took ${countWords(line, qty)}.${tier ? ` Load: ${tier}.` : ''}`;
}
