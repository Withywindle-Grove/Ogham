// B15 (p2p-29; page 30, HM4): an item whose magic truth was shown carries its real name and what it does wherever it is
// held; every other item stays as it is. Invented items only.
import { describe, expect, it } from 'vitest';
import { withTruths, type InventoryLine } from './inventory.ts';

const line = (id: string, name: string, details: Record<string, unknown> = {}): InventoryLine =>
  ({ id, name, details, qty: 1 }) as unknown as InventoryLine;

describe("an item's shown truth (p2p-29)", () => {
  // Purpose: the line the truth names takes the real name and, as its description, what it does; the others are
  // untouched, and a truth with no name or no words changes nothing.
  it('names the item and describes it, and leaves the rest alone', () => {
    const lines = [line('l1', 'Hooded lantern', { light: { burns: 'oil' }, description: 'A plain lantern.' }), line('l2', 'Swords')];
    const out = withTruths(lines, [
      { lineId: 'l1', name: ' Lantern of the Drowned ', text: 'Lit, it burns no oil.' },
      { lineId: 'l2', name: '', text: 'Nothing.' },
    ]);
    expect(out[0]!.name).toBe('Lantern of the Drowned');
    expect(out[0]!.details).toEqual({ light: { burns: 'oil' }, description: 'Lit, it burns no oil.' });
    expect(out[1]).toBe(lines[1]);
    expect(lines[0]!.name).toBe('Hooded lantern');
  });

  // Purpose: with nothing shown, the Pack reads exactly as before.
  it('changes nothing without truths', () => {
    const lines = [line('l1', 'Hooded lantern')];
    expect(withTruths(lines, [])).toEqual(lines);
  });
});
