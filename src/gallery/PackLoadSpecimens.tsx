// The full sheet's Pack load in the component gallery (sr-9, sheet plan order 5; docs/06 "Pack load"): the Pack tab's
// load bar (LoadSummary, its bands LoadBands) and the Pack's groups one line each, tiny things as their own group.
// Invented rules and names only (hard rule 2); no database.
import type { ReactElement, ReactNode } from 'react';
import '../app/CharacterSheet.css';
import { BurdenSheet } from '../app/LoadSummary.tsx';
import { PackLoad, type PackLoadState } from '../app/PackLoad.tsx';
import { carriedLoad, combineEncumbrance, toLoadLine, wornArmour, type EncumbranceRules } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';

const BANDED = combineEncumbrance([
  {
    mode: 'slot',
    slot: {
      bands: {
        equipped: [
          { maxSlots: 4, speed: 30 },
          { maxSlots: 8, speed: 15 },
        ],
        stowed: [
          { maxSlots: 6, speed: 30 },
          { maxSlots: 10, speed: 20 },
          { maxSlots: 14, speed: 15 },
        ],
      },
      combine: 'slowest',
      overMax: 'Rooted to the spot',
    },
  },
]);

const COIN = combineEncumbrance([
  {
    mode: 'coin',
    coin: {
      maxLoadCoin: 1200,
      tiers: [
        { label: 'Light', max: 400, movement: '45 ft' },
        { label: 'Laden', max: 800, movement: '30 ft' },
        { label: 'Weighed down', max: 1200, movement: '15 ft' },
      ],
      overMax: "Can't move",
    },
  },
]);

const ARMOUR = {
  mode: 'armour',
  armour: { maxLoadCoin: 900, movement: [{ armour: 'none', withoutTreasure: '90 ft', withTreasure: '60 ft' }], armourTypes: {} },
  treasureWeights: { gem: 1 },
  coin: null,
  slot: null,
  containers: 'hold-only',
  separateCategories: [],
} as unknown as EncumbranceRules;

/** Armour's movement table with three rows, for the Burden pop-up (frame M2h, its third case). */
const ARMOUR_TABLE = {
  ...ARMOUR,
  armour: {
    maxLoadCoin: 900,
    movement: [
      { armour: 'none', withoutTreasure: '120 paces', withTreasure: '90 paces' },
      { armour: 'light', withoutTreasure: '90 paces', withTreasure: '60 paces' },
      { armour: 'heavy', withoutTreasure: '60 paces', withTreasure: '30 paces' },
    ],
    armourTypes: { mail: 'heavy' },
  },
} as EncumbranceRules;

const TINY = new Set(['trinket']);
const none = () => {};

let next = 0;
const line = (name: string, more: Partial<InventoryLine> = {}): InventoryLine =>
  ({
    id: `gallery-line-${++next}`,
    actorId: 'gallery-wren',
    name,
    category: 'gear',
    slots: 1,
    stack: 1,
    qty: 1,
    containerLineId: null,
    equipped: false,
    approval: 'approved',
    details: {},
    weightCoin: null,
    perUnits: 1,
    ...more,
  }) as InventoryLine;

const stateOf = (lines: InventoryLine[], rules: EncumbranceRules, mode: 'slot' | 'coin' | 'armour', treasureSwitch: boolean | null = null): PackLoadState => {
  const loadLines = lines.map(toLoadLine);
  return { load: carriedLoad(loadLines, rules, mode, { armour: wornArmour(loadLines, rules), carryingTreasure: treasureSwitch }), lines, mode, treasureSwitch };
};

/** The load alone, for the Burden pop-up. */
const loadOf = (lines: InventoryLine[], rules: EncumbranceRules, mode: 'slot' | 'coin' | 'armour') => (stateOf(lines, rules, mode) as Exclude<PackLoadState, 'error' | null>).load;

/** Many things: 4 on the body, 12 slots in the bags (the slower band), and five tiny things, one with a long name. */
function manyThings(): InventoryLine[] {
  const pack = line('Backpack', { details: { container: { capacitySlots: 9 } } });
  return [
    line('Reed spear', { equipped: true }),
    line('Waxed coat', { equipped: true, slots: 2 }),
    line('Storm lantern', { equipped: true }),
    pack,
    ...['Rope of plaited reed', 'Eel trap', 'Iron pot', 'Blanket', 'Dry rations', 'Oil flask', 'Spare boots'].map((n) => line(n, { containerLineId: pack.id })),
    line('Tinderbox', { containerLineId: pack.id, slots: 2 }),
    line('Bog-iron shovel', { slots: 2 }),
    line('Reed whistle', { slots: 0, category: 'trinket' }),
    line('Eel hooks', { slots: 0, qty: 12, stack: 20, details: { unencumbering: true } }),
    line('Lucky pebble from the drowned causeway at the edge of the long fen', { slots: 0, category: 'trinket' }),
    line('Button', { slots: 0, category: 'trinket' }),
    line('Chalk', { slots: 0, category: 'trinket', containerLineId: pack.id }),
  ];
}

export function PackLoadSpecimens({ Specimen }: { Specimen: (props: { name: string; children: ReactNode }) => ReactElement }) {
  return (
    <>
      <Specimen name="Two bands: a bar each with its count and speed, the slower one named 'sets your speed'; the Pack's groups one line each; tiny things last, opened">
        <PackLoad state={stateOf(manyThings(), BANDED, 'slot')} rules={BANDED} from={[]} tinyCategories={TINY} initialOpen="tiny" />
      </Specimen>
      <Specimen name="Empty pack: both bars at 0, no band named, Nothing carried">
        <PackLoad state={stateOf([], BANDED, 'slot')} rules={BANDED} from={[]} tinyCategories={TINY} />
      </Specimen>
      <Specimen name="Coin mode: one bar with its tier marks and the coins line">
        <PackLoad state={stateOf([line('Iron pot', { weightCoin: 300 }), line('Bog-iron coat', { weightCoin: 250, equipped: true })], COIN, 'coin')} rules={COIN} from={[]} tinyCategories={TINY} />
      </Specimen>
      <Specimen name="Armour mode: the treasure line and why it reads so (the GM's call), no switch on the sheet">
        <PackLoad state={stateOf([line('Moon opal', { category: 'gem', qty: 40 }), line('Reed spear', { equipped: true })], ARMOUR, 'armour', false)} rules={ARMOUR} from={[]} tinyCategories={TINY} />
      </Specimen>
      {/* The burden's levels as a pop-up (tfb-4, row C7; frame M2h of december/26, approved 2026-11-19). */}
      <Specimen name="Burden pop-up, by coins' weight: the levels as a book table, the character's own row in bold">
        <BurdenSheet preview load={loadOf([line('Iron pot', { weightCoin: 383 })], COIN, 'coin')} rules={COIN} from={['Fen sample']} onClose={none} />
      </Specimen>
      <Specimen name="Burden pop-up, two bands: a table each, the band that sets the speed named">
        <BurdenSheet preview load={loadOf(manyThings(), BANDED, 'slot')} rules={BANDED} from={['Fen sample']} onClose={none} />
      </Specimen>
      <Specimen name="Burden pop-up, armour's movement table: the armour worn in bold, the line on treasure">
        <BurdenSheet preview load={loadOf([line('Bog-iron mail', { equipped: true, details: { armourType: 'mail' } })], ARMOUR_TABLE, 'armour')} rules={ARMOUR_TABLE} from={['Fen sample']} onClose={none} />
      </Specimen>
      <Specimen name="Burden pop-up, over the limit at 999,999: the last row in bold">
        <BurdenSheet preview load={loadOf([line('Bundle of reeds', { weightCoin: 1, qty: 999_999, stack: 999_999 })], COIN, 'coin')} rules={COIN} from={['Fen sample']} onClose={none} />
      </Specimen>
      <Specimen name="Loading, and a pack that couldn't be read">
        <PackLoad state={null} rules={BANDED} from={[]} tinyCategories={TINY} />
        <PackLoad state="error" rules={BANDED} from={[]} tinyCategories={TINY} />
      </Specimen>
    </>
  );
}
