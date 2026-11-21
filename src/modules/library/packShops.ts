// A pack's shops (dec-3, town row W9; the lead's rulings sh-1, sh-2, 2026-11-15). The importer keeps each shop as the pack
// wrote it (a `shop` entry); this is the ONE place a stock line's item is read as an item id. A pack names a thing from
// another pack as `<pack>:<item id>` (its `itemRef`); the app keys things by the bare item id (the library entry's
// `pack_entry_id`, as public.shop_stock and shop_stock_in do), so the prefix is dropped here and nowhere else.
// Each line's own price and availability are passed through as written.

/** One line of a shop's stock, its item as the bare id. */
export interface ShopStockLine {
  itemId: string;
  price: unknown;
  availability: unknown;
}

/** The bare item id of a stock line's `itemRef`: everything after the first ':', or the whole ref when it has none. */
export function stockItemId(ref: string): string {
  const at = ref.indexOf(':');
  return (at < 0 ? ref : ref.slice(at + 1)).trim();
}

/** A shop entry's stock, in the pack's order; a line with no usable `itemRef` is left out. */
export function shopStockLines(data: Record<string, unknown>): ShopStockLine[] {
  const stock = Array.isArray(data.stock) ? data.stock : [];
  const lines: ShopStockLine[] = [];
  for (const line of stock) {
    if (!line || typeof line !== 'object') continue;
    const { itemRef, price, availability } = line as Record<string, unknown>;
    if (typeof itemRef !== 'string') continue;
    const itemId = stockItemId(itemRef);
    if (itemId) lines.push({ itemId, price, availability });
  }
  return lines;
}
