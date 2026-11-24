// A pack's shops (`shops`; dec-3, town row W9; the lead's ruling sh-1): the importer keeps each as a GM-only library
// entry of kind `shop`, the shop as the pack wrote it. Data only: no screen shows them yet. Invented shops only.
import { describe, expect, it } from 'vitest';
import { packFile } from './exportPack.ts';
import { PACK_PARTS, PLAYER_FACING, playerFacingEntry, readPackJson } from './packFile.ts';
import { shopStockLines, stockItemId } from './packShops.ts';

const STALL = {
  id: 'bh-shop-lantern-warden',
  name: 'Lantern Warden’s stall',
  locationId: 'bh-quay',
  services: [{ name: 'A lamp trimmed', price: { cp: 3 }, note: 'while you wait' }],
  stock: [
    { itemRef: 'brackwater:bog-lurker-hide', price: { gp: 12 }, availability: { chance: '2-in-6' } },
    { itemRef: 'brackwater:lamp-oil', price: { cp: 5 } },
  ],
  gm: { note: 'Hobb keeps the best hide under the counter.' },
  source: 'p. 9',
};
const pack = (shops: unknown[]) => ({
  format: 'tabletop-pack',
  formatVersion: 3,
  meta: { name: 'Brackwater shops', version: '0.1', kind: 'adventure' },
  locations: [{ id: 'bh-quay', name: 'The quay', type: 'area' }],
  shops,
});

describe('importing a pack’s shops', () => {
  // Purpose: the importer keeps each shop as an entry of kind `shop`, named by its name, with every field the pack wrote
  // (its place, services, and each stock line's item, price and availability) kept as data, unchanged, and no warning
  // that `shops` is unknown.
  it('keeps each shop as a `shop` entry, its services and stock as written', () => {
    const read = readPackJson(JSON.stringify(pack([STALL])));
    if (!read.ok) throw new Error(read.message);
    const shops = read.pack.entries.filter((e) => e.kind === 'shop');
    expect(shops).toEqual([{ kind: 'shop', packEntryId: STALL.id, name: STALL.name, data: STALL }]);
    expect(read.pack.counts.shop).toBe(1);
    expect(read.pack.warnings.join(' ')).not.toContain(`"shops" isn't a part`);
    expect(PACK_PARTS.shops).toBe('shop');
  });

  // Purpose: a shop with no id is skipped and said, like any other entry; one with no name is named by its id.
  it('skips a shop with no id and names a nameless one by its id', () => {
    const read = readPackJson(JSON.stringify(pack([{ name: 'Nowhere stall' }, { id: 'bh-shop-mute' }])));
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.problems).toEqual(['shops: entry 1 has no id; skipped.']);
    expect(read.pack.entries.filter((e) => e.kind === 'shop').map((e) => e.name)).toEqual(['bh-shop-mute']);
  });

  // Purpose: hidden means hidden: a shop is the GM's alone, never a player-facing kind, whatever the entry says.
  it('is never player-facing', () => {
    expect(PLAYER_FACING).not.toContain('shop');
    expect(playerFacingEntry('shop', { ...STALL, gmOnly: false })).toBe(false);
  });

  // Purpose: a stock line's item is read as the bare item id (the pack prefix dropped, sh-2), its price and availability
  // as written; a line with no item is left out.
  it('reads each stock line as the bare item id, its price and availability as written', () => {
    expect(stockItemId('brackwater:bog-lurker-hide')).toBe('bog-lurker-hide');
    expect(stockItemId('lamp-oil')).toBe('lamp-oil');
    expect(shopStockLines({ stock: [...STALL.stock, { price: { cp: 1 } }, 'reeds', { itemRef: 'brackwater:' }] })).toEqual([
      { itemId: 'bog-lurker-hide', price: { gp: 12 }, availability: { chance: '2-in-6' } },
      { itemId: 'lamp-oil', price: { cp: 5 }, availability: undefined },
    ]);
    expect(shopStockLines({})).toEqual([]);
  });

  // Purpose: the import keeps each line's `itemRef` as the pack wrote it (the prefix is dropped only when read).
  it('keeps the pack’s itemRef unchanged in the entry', () => {
    const read = readPackJson(JSON.stringify(pack([STALL])));
    if (!read.ok) throw new Error(read.message);
    expect((read.pack.entries.find((e) => e.kind === 'shop')!.data.stock as { itemRef: string }[])[0]!.itemRef).toBe('brackwater:bog-lurker-hide');
  });

  // Purpose: exporting the pack writes its shops back under `shops`, as they were read.
  it('exports shops back as `shops`', () => {
    const read = readPackJson(JSON.stringify(pack([STALL])));
    if (!read.ok) throw new Error(read.message);
    const { file } = packFile({ name: 'Brackwater shops', version: '0.1', kind: 'adventure' }, read.pack.entries);
    expect(file.shops).toEqual([STALL]);
  });
});
