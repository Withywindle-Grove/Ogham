// The Pack's small word helpers, moved out of PackScreen.tsx (M5 step 3): what a row says about charges, and the
// tier words at the top of the Pack.
import { describe, expect, it } from 'vitest';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { chargeWords, tierWords } from './packHelpers.ts';

const line = (over: Partial<InventoryLine>) => ({ chargesHidden: false, chargesLeft: null, chargesUsed: 0, spentShown: false, ...over }) as InventoryLine;

describe('what a row says about charges', () => {
  it('gives the count of visible charges, or that they are not set yet', () => {
    expect(chargeWords(line({}), null)).toBe('Charges not set');
    expect(chargeWords(line({ chargesLeft: 1 }), null)).toBe('1 charge left');
    expect(chargeWords(line({ chargesLeft: 999 }), null)).toBe('999 charges left');
    expect(chargeWords(line({ chargesLeft: 0 }), null)).toBe('0 left, spent');
  });

  it('shows the GM what is left of a hidden count', () => {
    expect(chargeWords(line({ chargesHidden: true }), { total: null, spent: false })).toBe('Charges not set (hidden)');
    expect(chargeWords(line({ chargesHidden: true, chargesUsed: 2 }), { total: 5, spent: false })).toBe('3 left (hidden)');
    expect(chargeWords(line({ chargesHidden: true, chargesUsed: 7 }), { total: 5, spent: false })).toBe('Spent (hidden)');
  });

  it('never hints at a hidden count to the holder', () => {
    expect(chargeWords(line({ chargesHidden: true }), null)).toBe('Charges: ?');
    expect(chargeWords(line({ chargesHidden: true, spentShown: true }), null)).toBe('Spent');
  });
});

describe('the tier words of a load', () => {
  it('says nothing without a load mode, and the over-max words when over', () => {
    expect(tierWords({ mode: 'none' })).toBe('');
    expect(tierWords({ mode: 'slot', load: 12, capacity: 10, tier: null, over: true, overMax: '' })).toBe('Over the limit');
    expect(tierWords({ mode: 'coin', load: 12, capacity: 10, tier: null, over: true, overMax: 'Stuck fast' })).toBe('Stuck fast');
  });

  it('gives the tier label, or the move for armour', () => {
    expect(tierWords({ mode: 'slot', load: 3, capacity: 10, tier: { label: 'Laden', max: 5, effect: '' }, over: false, overMax: '' })).toBe('Laden');
    expect(tierWords({ mode: 'armour', load: 0, capacity: null, carriesTreasure: false, movement: '25', over: false, overMax: '' })).toBe('Move 25');
    expect(tierWords({ mode: 'armour', load: 0, capacity: null, carriesTreasure: false, movement: null, over: false, overMax: '' })).toBe('');
  });
});
