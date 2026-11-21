// Where a starting kit's things land (ruled 2026-10-26): worn, in hand, carried or in the backpack, by Add item's rules.
import { describe, expect, it } from 'vitest';
import { kitGroups, placeKit, type KitPiece } from './kitPlaces.ts';

const piece = (name: string, data: Record<string, unknown> = {}, qty = 1): KitPiece<string> => ({ item: name, name, qty, data });
const where = (placed: ReturnType<typeof placeKit<string>>) => placed.map((p) => [p.name, p.place, p.why ?? '']);
const anything = () => null;

describe('placing a kit', () => {
  it('puts containers first, wears one armour, holds what fits two hands, and the rest goes in the backpack', () => {
    const placed = placeKit(
      [
        piece('Quilted coat', { slot: 'armour' }),
        piece('Spare coat', { slot: 'armour' }),
        piece('Hooked staff', { slot: 'hand', hands: 2 }),
        piece('Round shield', { slot: 'shield' }),
        piece('Reed lamp', {}, 2),
        piece('Backpack', { container: {} }),
      ],
      anything,
    );
    expect(where(placed)).toEqual([
      ['Backpack', 'carried', ''],
      ['Quilted coat', 'worn', ''],
      ['Spare coat', 'container', ''],
      ['Hooked staff', 'hand', ''],
      ['Round shield', 'container', ''],
      ['Reed lamp', 'container', ''],
    ]);
  });

  it('a one-handed weapon and a shield both go in hand; a stack of weapons is stowed', () => {
    const placed = placeKit([piece('Eel spear', { slot: 'hand' }), piece('Round shield', { slot: 'shield' }), piece('Dart', { slot: 'hand' }, 5)], anything);
    expect(where(placed)).toEqual([
      ['Eel spear', 'hand', ''],
      ['Round shield', 'hand', ''],
      ['Dart', 'carried', ''],
    ]);
  });

  it("what the class can't use is stowed with the reason, and doesn't take the slot", () => {
    const check = (p: KitPiece<string>) => (p.name === 'Plate coat' ? "Lantern Warden can't use Plate coat." : null);
    const placed = placeKit([piece('Plate coat', { slot: 'armour' }), piece('Quilted coat', { slot: 'armour' })], check, { armour: false, hands: 0, container: true });
    expect(where(placed)).toEqual([
      ['Plate coat', 'container', "Lantern Warden can't use Plate coat."],
      ['Quilted coat', 'worn', ''],
    ]);
  });

  it('what the character already wears and holds counts', () => {
    const placed = placeKit([piece('Quilted coat', { slot: 'armour' }), piece('Hooked staff', { slot: 'hand', hands: 2 })], anything, { armour: true, hands: 1, container: false });
    expect(where(placed)).toEqual([
      ['Quilted coat', 'carried', ''],
      ['Hooked staff', 'carried', ''],
    ]);
  });

  it('groups by place for Show all, naming the backpack, and leaves out empty groups', () => {
    const placed = placeKit([piece('Eel spear', { slot: 'hand' }), piece('Reed lamp'), piece('Sack', { container: {} })], anything);
    expect(kitGroups(placed, 'Sack').map((g) => [g.name, g.pieces.map((p) => p.name)])).toEqual([
      ['Worn and held', ['Eel spear']],
      ['Carried', ['Sack']],
      ['In the sack', ['Reed lamp']],
    ]);
    expect(kitGroups(placeKit([piece('Reed lamp')], anything), null).map((g) => g.name)).toEqual(['Carried']);
  });
});
