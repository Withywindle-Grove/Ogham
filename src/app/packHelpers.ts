// Small helpers shared by the Pack's parts (PackScreen, LoadSummary, CarrierItems, ItemRow, ItemSheet, ChargesDialog).
import { capitalised, chargeUnitOf, countOf, fullCountOf, type ChargeUnit } from '../core/chargeUnit.ts';
import type { CarriedLoad } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { countWords, shownName, stackable } from '../modules/inventory/packView.ts';

/** "1 item" or "N items" (counts read as words, never after a middle dot; plan m5b-players-screens-standard A2). */
export const itemCount = (n: number) => (n === 1 ? '1 item' : `${n} items`);

/** Up to this many things, a fold row's summary names them; past it, "…" follows the third. */
const NAMED_IN_SUMMARY = 3;

/**
 * A fold row's one-line summary (plan C; mockup players/01): the count, a colon, then the first things named, a stack
 * with its count ("9 items: Dry rations ×3, Rope, Torch ×6…"), A–Z as the groups sort (ruled 2026-10-24).
 */
export function foldSummary(lines: readonly InventoryLine[]): string {
  if (lines.length === 0) return 'Nothing';
  const named = [...lines]
    .sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: 'base' }))
    .slice(0, NAMED_IN_SUMMARY)
    .map((l) => (stackable(l) && l.qty > 1 ? countWords(l, l.qty) : shownName(l.name)));
  return `${itemCount(lines.length)}: ${named.join(', ')}${lines.length > NAMED_IN_SUMMARY ? '…' : ''}`;
}

/**
 * Runs a write, then reloads the pack; `close` closes the item and goes back to the top of the Pack. A write refused
 * because it was made from an old copy (reason "stale") reloads the pack too, so the latest shows.
 */
export type Run = <T>(write: () => Promise<{ ok: true; value: T } | { ok: false; message: string; reason?: string }>, close?: boolean) => Promise<boolean>;

/**
 * The tier label, or the over-max words, of a load ("" when there's nothing to say). Armour mode says its move; where a
 * speed tile says the speed (`speedOnce`, pss-12), it says whether treasure is carried instead, so the speed is said once.
 */
export function tierWords(load: CarriedLoad, { speedOnce = false }: { speedOnce?: boolean } = {}): string {
  if (load.mode === 'none') return '';
  if (load.over) return load.overMax || 'Over the limit';
  if (load.mode === 'armour' && speedOnce) return load.carriesTreasure ? 'Carrying treasure' : 'Not carrying treasure';
  if (load.mode === 'armour') return load.movement ? `Move ${load.movement}` : '';
  return load.tier?.label ?? '';
}

/** A one-off item as a homebrew entry, so it shows in search from then on. */
export function homebrewItem(line: Pick<InventoryLine, 'name' | 'category' | 'weightCoin' | 'slots' | 'stack' | 'details'>): Record<string, unknown> {
  const slug = line.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
  return {
    ...line.details,
    id: `${slug}-${crypto.randomUUID().slice(0, 6)}`,
    name: line.name,
    category: line.category || 'gear',
    ...(line.weightCoin !== null ? { weightCoin: line.weightCoin } : {}),
    ...(line.slots !== null ? { slots: line.slots } : {}),
    ...(line.stack > 1 ? { stack: line.stack } : {}),
  };
}

type Secret = { total: number | null; spent: boolean } | null;

/**
 * What a row says about charges (G-233, page 49): the count in the item's unit ("2 of 3 portions", a full count of 1
 * "1 dose left"), "?", "spent", or that they aren't set yet ("Portions not set"). "of 3" only where the pack's full
 * count is a whole number the count hasn't passed. `unit`: the line's copy's for a holder; the GM's own screens pass
 * the GM's copy's (`gmChargeUnitOf`).
 */
export function chargeWords(line: InventoryLine, secret: Secret, unit: ChargeUnit = chargeUnitOf(line.details)): string {
  if (!line.chargesHidden) {
    const left = line.chargesLeft;
    if (left === null) return `${capitalised(unit.many)} not set`;
    if (left === 0) return '0 left, spent';
    const full = fullCountOf(line.details);
    return full !== null && full > 1 && left <= full ? `${left} of ${full} ${unit.many}` : `${countOf(left, unit)} left`;
  }
  // The GM sees what's left of a hidden count; the holder sees "?" until play shows it's spent, or the GM reveals it.
  if (secret) {
    if (secret.total === null) return `${capitalised(unit.many)} not set (hidden)`;
    const left = Math.max(0, secret.total - line.chargesUsed);
    return secret.spent || left === 0 ? 'Spent (hidden)' : `${left} left (hidden)`;
  }
  return line.spentShown ? 'Spent' : `${capitalised(unit.many)}: ?`;
}

/**
 * The count as a labelled fact (the At hand pop-up, the item's sheet; page 49 frame 49-2): the label is the unit's
 * plural with a capital ("Portions"), the value the row's words without the unit ("2 of 3 left", "?", "Not set").
 */
export function chargeFact(line: InventoryLine, secret: Secret, unit: ChargeUnit = chargeUnitOf(line.details)): { label: string; value: string } {
  const label = capitalised(unit.many);
  if (!line.chargesHidden && line.chargesLeft !== null && line.chargesLeft > 0) {
    const left = line.chargesLeft;
    const full = fullCountOf(line.details);
    return { label, value: full !== null && full > 1 && left <= full ? `${left} of ${full} left` : `${left} left` };
  }
  const words = chargeWords(line, secret, unit);
  // "Portions not set (hidden)" reads "Not set (hidden)" beside its label; "Portions: ?" reads "?".
  const notSet = `${label} not set`;
  const value = words.startsWith(notSet) ? `Not set${words.slice(notSet.length)}` : words === `${label}: ?` ? '?' : words;
  return { label, value };
}
