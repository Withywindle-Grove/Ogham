// The Pack's small word helpers, moved out of PackScreen.tsx (M5 step 3): what a row says about charges, and the
// tier words at the top of the Pack.
import { describe, expect, it } from 'vitest';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { chargeFact, chargeWords, tierWords } from './packHelpers.ts';

const line = (over: Partial<InventoryLine>) => ({ details: {}, chargesHidden: false, chargesLeft: null, chargesUsed: 0, spentShown: false, ...over }) as InventoryLine;

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

describe('a count in its unit (G-233, page 49)', () => {
  const unit = (charges: Record<string, unknown>, over: Partial<InventoryLine> = {}) => line({ details: { charges }, ...over });
  const rum = (over: Partial<InventoryLine>) => unit({ initial: 3, unit: 'portion' }, over);

  // Purpose: the row names the unit, with the full count when the pack gives it as a whole number ("2 of 3 portions").
  it('says "2 of 3 portions", "Portions not set" and "0 left, spent"', () => {
    expect(chargeWords(rum({ chargesLeft: 2 }), null)).toBe('2 of 3 portions');
    expect(chargeWords(rum({ chargesLeft: 1 }), null)).toBe('1 of 3 portions');
    expect(chargeWords(rum({}), null)).toBe('Portions not set');
    expect(chargeWords(rum({ chargesLeft: 0 }), null)).toBe('0 left, spent');
    expect(chargeWords(unit({ initial: 999, unit: 'dose' }, { chargesLeft: 999 }), null)).toBe('999 of 999 doses');
  });

  // Purpose: a full count of 1 reads "1 dose left", never "1 of 1 dose" (finding 3).
  it('says "1 dose left" for a full count of 1', () => {
    expect(chargeWords(unit({ initial: 1, unit: 'dose' }, { chargesLeft: 1 }), null)).toBe('1 dose left');
  });

  // Purpose: rolled charges (dice) or a count past the full one (a recharge) read "N <units> left".
  it('says "N portions left" when the full count is dice or has been passed', () => {
    expect(chargeWords(unit({ initial: '2d4', unit: 'portion' }, { chargesLeft: 5 }), null)).toBe('5 portions left');
    expect(chargeWords(unit({ initial: '2d4', unit: 'portion' }, { chargesLeft: 1 }), null)).toBe('1 portion left');
    expect(chargeWords(rum({ chargesLeft: 4 }), null)).toBe('4 portions left');
  });

  // Purpose: with no unit, "charges", as today; a wand with a whole-number full count reads "3 of 5 charges" (page 49).
  it('keeps "charges" with no unit', () => {
    expect(chargeWords(unit({ initial: 5 }, { chargesLeft: 3 }), null)).toBe('3 of 5 charges');
    expect(chargeWords(unit({ initial: '2d4' }, { chargesLeft: 3 }), null)).toBe('3 charges left');
  });

  // Purpose: a hidden count names its unit to the holder ("Portions: ?") and to the GM ("Portions not set (hidden)").
  it('names the unit of a hidden count', () => {
    expect(chargeWords(rum({ chargesHidden: true }), null)).toBe('Portions: ?');
    expect(chargeWords(rum({ chargesHidden: true }), { total: null, spent: false })).toBe('Portions not set (hidden)');
    expect(chargeWords(rum({ chargesHidden: true, chargesUsed: 1 }), { total: 3, spent: false })).toBe('2 left (hidden)');
  });

  // Purpose: the labelled fact takes the plural as its label and the count without the unit as its value (frame 49-2).
  it('gives the labelled fact "Portions: 2 of 3 left", "?", "Not set"', () => {
    expect(chargeFact(rum({ chargesLeft: 2 }), null)).toEqual({ label: 'Portions', value: '2 of 3 left' });
    expect(chargeFact(rum({ chargesHidden: true }), null)).toEqual({ label: 'Portions', value: '?' });
    expect(chargeFact(rum({}), null)).toEqual({ label: 'Portions', value: 'Not set' });
    expect(chargeFact(rum({ chargesHidden: true }), { total: null, spent: false })).toEqual({ label: 'Portions', value: 'Not set (hidden)' });
    expect(chargeFact(rum({ chargesLeft: 0 }), null)).toEqual({ label: 'Portions', value: '0 left, spent' });
    expect(chargeFact(unit({ initial: 1, unit: 'dose' }, { chargesLeft: 1 }), null)).toEqual({ label: 'Doses', value: '1 left' });
    expect(chargeFact(unit({ initial: '2d4' }, { chargesLeft: 5 }), null)).toEqual({ label: 'Charges', value: '5 left' });
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

  // Where the speed tile says the speed (pss-12), armour mode's top line drops "Move N" and names the burden by
  // whether treasure is carried; over the limit it still says so.
  it('drops the move in armour mode where the speed is said once', () => {
    const armour = { mode: 'armour' as const, load: 0, capacity: 1600, carriesTreasure: false, movement: '25', over: false, overMax: '' };
    expect(tierWords(armour, { speedOnce: true })).toBe('Not carrying treasure');
    expect(tierWords({ ...armour, carriesTreasure: true, load: 120 }, { speedOnce: true })).toBe('Carrying treasure');
    expect(tierWords({ ...armour, movement: null }, { speedOnce: true })).toBe('Not carrying treasure');
    expect(tierWords({ ...armour, carriesTreasure: true, load: 1700, over: true }, { speedOnce: true })).toBe('Over the limit');
  });

  // Coin and slot modes give their tier label whether or not the speed is said once.
  it('keeps the tier label in coin and slot modes where the speed is said once', () => {
    expect(tierWords({ mode: 'coin', load: 3, capacity: 10, tier: { label: 'Laden', max: 5, effect: '' }, over: false, overMax: '' }, { speedOnce: true })).toBe('Laden');
    expect(tierWords({ mode: 'slot', load: 12, capacity: 10, tier: null, over: true, overMax: 'Stuck fast' }, { speedOnce: true })).toBe('Stuck fast');
  });
});
