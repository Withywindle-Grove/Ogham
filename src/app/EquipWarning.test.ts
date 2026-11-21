// The Pack's equip check for magic armour (area 3 re-check, item 3; docs/plans/m5b-review-area-3.md): the line's
// chosen base, or before one is chosen the bases it offers, come from the setting's items. Invented setting.
import { describe, expect, it } from 'vitest';
import type { Value } from '../modules/library/expression.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { asItem, equipCheckWith, type EquipContext } from './EquipWarning.tsx';

const items: Record<string, Value> = {
  'quilted-coat': { id: 'quilted-coat', name: 'Quilted coat', slot: 'armour', armourType: 'quilted' },
  'iron-scale': { id: 'iron-scale', name: 'Iron scale', slot: 'armour', armourType: 'iron-scale' },
};
const context = (types: string[]): EquipContext => ({
  hooks: [],
  character: { name: 'Moss', class: { name: 'Bog mage', armourAllowed: { types, shields: false } } },
  item: (id) => items[id] ?? null,
});
const mistMail = (baseArmourId: string | null) =>
  ({
    id: 'line-1',
    name: 'Mist mail',
    sourceEntryId: 'mist-mail',
    baseArmourId,
    equipped: false,
    details: { slot: 'armour', armourType: 'chosen', armour: { magicBonus: 1, baseArmour: { choose: ['quilted-coat', 'iron-scale'] } } },
  }) as unknown as InventoryLine;

describe('equip checks on magic armour with a base to choose', () => {
  // Purpose: a class allowed no armour is blocked from chosen-type magic armour, whether its base is chosen or not.
  it('blocks a class allowed no armour, base chosen or not', () => {
    expect(equipCheckWith(context([]), mistMail('quilted-coat'), []).blocked).toEqual(["Bog mage can't use Mist mail."]);
    expect(equipCheckWith(context([]), mistMail(null), []).blocked).toEqual(["Bog mage can't use Mist mail."]);
  });

  // Purpose: with a base chosen, the class's armour types are checked against that base.
  it('checks the chosen base against the class', () => {
    expect(equipCheckWith(context(['quilted']), mistMail('quilted-coat'), []).blocked).toEqual([]);
    expect(equipCheckWith(context(['quilted']), mistMail('iron-scale'), []).blocked).toEqual(["Bog mage can't use Mist mail."]);
  });

  // Purpose: without the setting's items (no context lookup), the line is read as before: "chosen" passes.
  it('asItem without a lookup leaves the line as it is', () => {
    expect(asItem(mistMail('iron-scale'))).not.toHaveProperty('chosenBase');
  });
});
