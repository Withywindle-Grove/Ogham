// @vitest-environment jsdom
// The full sheet's read of what a character carries (bq-5, sr-1, sr-9): in armour mode the GM's Carrying treasure
// switch (eq-3) counts, as on the Pack tab and in travel; a read that fails says so. Invented names only.
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../core/supabase.ts';
import type { EncumbranceRules } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';

const reads = vi.hoisted(() => ({ lines: [] as unknown[] | null, mode: 'armour', treasure: null as boolean | null }));
vi.mock('../modules/inventory/inventory.ts', async (actual) => ({
  ...(await actual<typeof import('../modules/inventory/inventory.ts')>()),
  loadInventory: async () => (reads.lines ? { lines: reads.lines } : null),
  loadInventorySettings: async () => ({ mode: reads.mode, rechargeDefault: false }),
}));
vi.mock('../modules/inventory/treasureSwitch.ts', async (actual) => ({
  ...(await actual<typeof import('../modules/inventory/treasureSwitch.ts')>()),
  loadTreasureSwitch: async () => reads.treasure,
}));

const { useCarriedLoad } = await import('./useCarriedLoad.ts');

afterEach(cleanup);

const rules = {
  mode: 'armour',
  armour: { maxLoadCoin: 500, movement: [{ armour: 'none', withoutTreasure: '100 ft', withTreasure: '70 ft' }], armourTypes: {} },
  treasureWeights: { gem: 1 },
  coin: null,
  slot: null,
  containers: 'hold-only',
  separateCategories: [],
} as unknown as EncumbranceRules;

const gem = { id: 'line-1', actorId: 'actor-wren', name: 'Moon opal', category: 'gem', qty: 4, slots: null, stack: 1, containerLineId: null, equipped: false, approval: 'approved', details: {}, weightCoin: null, perUnits: 1 } as unknown as InventoryLine;

describe("the sheet's carried load", () => {
  // Purpose: with treasure in the pack but the GM's switch off, the sheet's load (and so its speed) reads "no treasure".
  it("follows the GM's Carrying treasure switch in armour mode", async () => {
    reads.lines = [gem];
    reads.treasure = false;
    const { result } = renderHook(() => useCarriedLoad({} as Db, 'camp-1', 'actor-wren', rules));
    await waitFor(() => expect(result.current).not.toBeNull());
    const carried = result.current;
    if (!carried || carried === 'error' || carried.load.mode !== 'armour') throw new Error('expected an armour load');
    expect(carried.load.carriesTreasure).toBe(false);
    expect(carried.load.movement).toBe('100 ft');
    expect(carried.treasureSwitch).toBe(false);
    expect(carried.lines.map((l) => l.name)).toEqual(['Moon opal']);
  });

  // Purpose: when the pack can't be read the hook says "error", so the section can say so.
  it('says "error" when the pack can\'t be read', async () => {
    reads.lines = null;
    const { result } = renderHook(() => useCarriedLoad({} as Db, 'camp-1', 'actor-wren', rules));
    await waitFor(() => expect(result.current).toBe('error'));
  });
});
