// @vitest-environment jsdom
// The full sheet's Pack load (sr-9, sheet plan order 5): the Pack tab's load bar (one component, LoadSummary, with
// its bands' bars LoadBands), the Pack's groups one line each, and the tiny things as their own group. Coin mode and
// armour mode keep their one bar. Invented rules and names only (hard rule 2).
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { carriedLoad, combineEncumbrance, toLoadLine, wornArmour, type EncumbranceRules } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { isTiny, loadGroups } from '../modules/inventory/packView.ts';
import type { CampaignEntry, CampaignPack } from '../modules/library/campaignPacks.ts';
import { settingFrom } from './campaignSetting.ts';
import { PackLoad, type PackLoadState } from './PackLoad.tsx';

afterEach(cleanup);

const banded = combineEncumbrance([
  {
    mode: 'slot',
    slot: {
      bands: {
        equipped: [
          { maxSlots: 2, speed: 50 },
          { maxSlots: 4, speed: 25 },
        ],
        stowed: [
          { maxSlots: 5, speed: 50 },
          { maxSlots: 7, speed: 35 },
          { maxSlots: 9, speed: 15 },
        ],
      },
      combine: 'slowest',
      overMax: 'Rooted to the spot',
    },
  },
]);

const coinRules = combineEncumbrance([
  { mode: 'coin', coin: { maxLoadCoin: 1300, tiers: [{ label: 'Light', max: 400, movement: '45 ft' }, { label: 'Laden', max: 800 }, { label: 'Burdened', max: 1300 }], overMax: 'Cannot move' } },
]);

const armourRules = {
  mode: 'armour',
  armour: { maxLoadCoin: 500, movement: [{ armour: 'none', withoutTreasure: '100 ft', withTreasure: '70 ft' }], armourTypes: {} },
  treasureWeights: { gem: 1 },
  coin: null,
  slot: null,
  containers: 'hold-only',
  separateCategories: [],
} as unknown as EncumbranceRules;

let next = 0;
const line = (name: string, more: Partial<InventoryLine> = {}): InventoryLine =>
  ({
    id: `line-${++next}`,
    actorId: 'actor-wren',
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

const NONE: ReadonlySet<string> = new Set();
const stateOf = (lines: InventoryLine[], rules: EncumbranceRules, mode: 'slot' | 'coin' | 'armour', treasureSwitch: boolean | null = null): PackLoadState => {
  const loadLines = lines.map(toLoadLine);
  return { load: carriedLoad(loadLines, rules, mode, { armour: wornArmour(loadLines, rules), carryingTreasure: treasureSwitch }), lines, mode, treasureSwitch };
};

/** Wren: a spear in hand, a satchel with five things, a loose eel trap, and three tiny things (one by its category). */
function wrensPack() {
  const satchel = line('Satchel', { details: { container: { capacitySlots: 6 } } });
  return [
    line('Spear', { equipped: true }),
    satchel,
    ...['Rope', 'Net', 'Lamp', 'Oil flask', 'Blanket'].map((n) => line(n, { containerLineId: satchel.id })),
    line('Eel trap'),
    line('Reed whistle', { slots: 0, details: { unencumbering: true } }),
    line('Dried moss', { slots: 0, category: 'herb', containerLineId: satchel.id }),
    line('Fishhook', { slots: 0, qty: 12, stack: 20, details: { unencumbering: true } }),
  ];
}

describe("the full sheet's Pack load (sr-9)", () => {
  // Purpose: the sheet shows the Pack tab's own bars, one per band with its count and speed, the slower one named.
  it('shows a bar per band, each with its count and speed, and names the slower one "sets your speed"', () => {
    const { container } = render(<PackLoad state={stateOf(wrensPack(), banded, 'slot')} rules={banded} from={[]} tinyCategories={new Set(['herb'])} />);
    expect(screen.getByRole('heading', { name: 'Pack load' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speed 35' })).toBeTruthy();
    const bands = container.querySelector('.pack__bands')!;
    expect(within(bands as HTMLElement).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Equipped 1 of 4 slots, speed 50',
      'Stowed 7 of 9 slots, speed 35, sets your speed',
    ]);
  });

  // Purpose: tiny things leave the group they're in and come last as their own group, saying they're not counted.
  it('groups the tiny things (marked on the item or by category) last, as "Tiny things", and says they’re not counted', async () => {
    const { container } = render(<PackLoad state={stateOf(wrensPack(), banded, 'slot')} rules={banded} from={[]} tinyCategories={new Set(['herb'])} />);
    const labels = [...container.querySelectorAll('.pack-load__groups .creation-fold__label')];
    expect(labels.map((b) => b.textContent)).toEqual(['Worn and in hand: Spear', 'In the Satchel: 5 items', 'Carried: Eel trap, Satchel', 'Tiny things: 3, not counted']);
    const tiny = container.querySelectorAll('.pack-load__groups details')[3] as HTMLDetailsElement;
    expect(tiny.open).toBe(false);
    await userEvent.click(within(tiny).getByText('Tiny things: 3, not counted'));
    expect(tiny.open).toBe(true);
    expect(screen.getByText('Dried moss')).toBeTruthy();
    expect(screen.getByText('Fishhook ×12')).toBeTruthy();
    expect(screen.getByText('Reed whistle')).toBeTruthy();
  });

  // Purpose: the sheet's lines read as Design wrote them (Design on #552), built from what's carried: a colon after the
  // group, commas between things, the count past three, and the tiny things "not counted".
  it('reads "Worn and in hand: Reed spear, Storm lantern, Waxed coat", "In the Backpack: 8 items" and "Tiny things: 5, not counted"', () => {
    const backpack = line('Backpack', { details: { container: { capacitySlots: 10 } } });
    const lines = [
      ...['Reed spear', 'Storm lantern', 'Waxed coat'].map((n) => line(n, { equipped: true })),
      backpack,
      ...['Rope', 'Net', 'Lamp', 'Oil flask', 'Blanket', 'Pot', 'Spade', 'Tent'].map((n) => line(n, { containerLineId: backpack.id })),
      ...['Pin', 'Bead', 'Button', 'Hook', 'Thread'].map((n) => line(n, { slots: 0, details: { unencumbering: true } })),
    ];
    const { container } = render(<PackLoad state={stateOf(lines, banded, 'slot')} rules={banded} from={[]} tinyCategories={NONE} />);
    const labels = [...container.querySelectorAll('.pack-load__groups .creation-fold__label')].map((b) => b.textContent);
    expect(labels).toContain('Worn and in hand: Reed spear, Storm lantern, Waxed coat');
    expect(labels).toContain('In the Backpack: 8 items');
    expect(labels).toContain('Tiny things: 5, not counted');
  });

  // Purpose: the sheet has one fold pattern, the inventory's fold row with its + / − square (FoldedGroup), never a
  // "▸" or "▾" disclosure; and nothing on it draws a middle dot or three typed dots.
  it('uses the fold row with + and −, no ▸ or ▾, no "·" and no "..."', async () => {
    const { container } = render(<PackLoad state={stateOf(wrensPack(), banded, 'slot')} rules={banded} from={[]} tinyCategories={new Set(['herb'])} />);
    const folds = container.querySelectorAll('.pack-load__groups details.creation-fold');
    expect(folds.length).toBe(4);
    for (const fold of folds) expect(fold.querySelector('.creation-fold__square')).not.toBeNull();
    for (const fold of folds) await userEvent.click(fold.querySelector('summary')!);
    const text = container.textContent ?? '';
    for (const mark of ['▸', '▾', '·', '...']) expect(text).not.toContain(mark);
  });

  // Purpose: an empty pack still shows the bars (at 0, no band named) and says nothing is carried.
  it('shows the bars at 0 and "Nothing carried." for an empty pack', () => {
    render(<PackLoad state={stateOf([], banded, 'slot')} rules={banded} from={[]} tinyCategories={NONE} />);
    expect(screen.queryByText(/sets your speed/)).toBeNull();
    expect(screen.getByText('Nothing carried.')).toBeTruthy();
  });

  // Purpose: coin mode keeps its one bar and coins line; no band bars.
  it('keeps coin mode to one bar with its coins line', () => {
    const { container } = render(<PackLoad state={stateOf([line('Iron pot', { weightCoin: 50 })], coinRules, 'coin')} rules={coinRules} from={[]} tinyCategories={NONE} />);
    expect(screen.getByRole('button', { name: 'Light, speed 45' })).toBeTruthy();
    expect(screen.getByText('50 of 1,300 coins')).toBeTruthy();
    expect(container.querySelector('.pack__bar')).not.toBeNull();
    expect(container.querySelector('.pack__bands')).toBeNull();
  });

  // Purpose: armour mode reads as the Pack tab does (treasure and why), with no switch on the sheet.
  it("reads armour mode's treasure line and the GM's call, without a switch", () => {
    const gem = line('Moon opal', { category: 'gem', qty: 4 });
    render(<PackLoad state={stateOf([gem], armourRules, 'armour', false)} rules={armourRules} from={[]} tinyCategories={NONE} />);
    expect(screen.getByText('Not carrying treasure')).toBeTruthy();
    expect(screen.getByText('Treasure 4 of 500 coins’ weight. The rules suggest Carrying treasure')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Switch/ })).toBeNull();
  });

  // Purpose: while loading the section holds skeleton rows; if the pack can't be read it says so; with no load (mode none) it's gone.
  it('holds skeleton rows while loading, explains an error, and is absent with no encumbrance', () => {
    const { rerender } = render(<PackLoad state={null} rules={banded} from={[]} tinyCategories={NONE} />);
    expect(screen.getByRole('status', { name: 'Loading the pack' })).toBeTruthy();
    rerender(<PackLoad state="error" rules={banded} from={[]} tinyCategories={NONE} />);
    expect(screen.getByText("Couldn't load the pack. Check your connection and try again.")).toBeTruthy();
    rerender(<PackLoad state={{ load: { mode: 'none' }, lines: [], mode: 'none', treasureSwitch: null }} rules={banded} from={[]} tinyCategories={NONE} />);
    expect(screen.queryByRole('heading', { name: 'Pack load' })).toBeNull();
  });
});

describe('tiny things (05, 07 `unencumbering`)', () => {
  // Purpose: an item is tiny by its own mark or its category's; nothing else is.
  it('reads the mark on the item or its category', () => {
    expect(isTiny(line('Pin', { details: { unencumbering: true } }), NONE)).toBe(true);
    expect(isTiny(line('Moss', { category: 'herb' }), new Set(['herb']))).toBe(true);
    expect(isTiny(line('Rope'), new Set(['herb']))).toBe(false);
  });

  // Purpose: a tiny container keeps its own group (its things still need a place), and things kept apart never show.
  it('keeps a tiny container as its own group and leaves out animals and vehicles', () => {
    const pouch = line('Pouch', { details: { container: { capacitySlots: 1 }, unencumbering: true } });
    const groups = loadGroups([pouch, line('Coil', { containerLineId: pouch.id }), line('Mule', { details: { animal: {} } })], 'slot', banded, NONE);
    expect(groups.map((g) => [g.title, g.lines.map((l) => l.name)])).toEqual([
      ['In the Pouch', ['Coil']],
      ['Carried', ['Pouch']],
    ]);
  });

  // Purpose: tiny things that do weigh something in this mode aren't said to be "not counted".
  it("doesn't say \"not counted\" when a tiny thing has a weight in coin mode", () => {
    const { container } = render(<PackLoad state={stateOf([line('Bell', { weightCoin: 5, details: { unencumbering: true } })], coinRules, 'coin')} rules={coinRules} from={[]} tinyCategories={NONE} />);
    expect(container.querySelector('.pack-load__groups .creation-fold__label')!.textContent).toBe('Tiny things: 1');
  });
});

describe("the campaign's tiny categories", () => {
  const link = (packId: string, priority: number): CampaignPack => ({
    id: `link-${packId}`,
    campaignId: 'c-1',
    packId,
    name: packId,
    shortName: packId,
    version: '0.1',
    kind: priority === 1 ? 'setting' : 'homebrew',
    optionChoices: {},
    priority,
    overrides: {},
    campaignHomebrew: false,
  });
  const rulesSet = (packId: string, itemCategories: unknown[]) =>
    ({ kind: 'rulesSet', packId, packEntryId: `${packId}-rules`, name: 'Rules', data: { id: `${packId}-rules`, itemCategories } }) as unknown as CampaignEntry;

  // Purpose: a category marked unencumbering is tiny, and a higher pack listing it again without the mark wins.
  it('reads the marked categories, the higher pack winning', () => {
    const base = rulesSet('fen-base', [
      { id: 'herb', name: 'Herbs', unencumbering: true },
      { id: 'charm', name: 'Charms', unencumbering: true },
      { id: 'gear', name: 'Gear' },
    ]);
    const overlay = rulesSet('reed-zine', [{ id: 'charm', name: 'Charms' }]);
    expect([...(settingFrom([link('fen-base', 1)], [base], {}).tinyCategories ?? [])].sort()).toEqual(['charm', 'herb']);
    expect([...(settingFrom([link('fen-base', 1), link('reed-zine', 2)], [base, overlay], {}).tinyCategories ?? [])]).toEqual(['herb']);
  });
});
