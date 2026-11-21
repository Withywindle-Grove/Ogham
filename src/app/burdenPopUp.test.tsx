// @vitest-environment jsdom
// The burden's levels as a pop-up (plan test-feedback-2026-11-19, row C7; ruling tfb-4; frame M2h of december/26,
// approved 2026-11-19). Invented rules and names only (hard rule 2). Purposes:
//   1. A tap on the burden opens a pop-up, "Burden", listing every level, the character's own row in bold; nothing
//      opens in place under the bar, so the page under it doesn't move.
//   2. Over the limit, 999,999: the first line says it, and a last row "Over the limit" is the bold one.
//   3. Slot bands: one table per band, each with its slots filled and speeds, and the band that sets the speed named.
//   4. Armour: the movement table with the armour worn in bold, and the line on treasure; the GM's switch stays on the
//      bar, not in the pop-up.
//   5. What raises the limit is named in the pop-up ("to each limit"), and the source line is at its foot.
//   5a. A load raised by a worn item or a bag that adds room, above the first level: the table shows the raised levels
//       (the same calculation as the load's tier, `raisedTiers`), so the bold row, the first line and the table agree.
//   6. Closing the pop-up (✕ or Escape) returns focus to the burden that opened it.
//   7. The same pop-up opens from the full sheet's Pack load and from the Player tab's Movement.
//   8. A host that doesn't ask for the pop-up keeps the levels in place (no app screen does since d5-19; the gallery's
//      Pack page still draws it).
//   9. The GM's character overview opens the same pop-up (d5-19, 2026-11-20), with the setting's source at its foot,
//      over the overview, which stays open; nothing opens in place, and closing it returns focus to the burden.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { carriedLoad, combineEncumbrance, toLoadLine, type CarriedLoad, type EncumbranceRules, type LoadLine } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { addP1Character, P1_CAMPAIGN } from '../testing/layoutP1Character.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting, loadCampaignSetting } from './campaignSetting.ts';
import { CharacterOverview } from './CharacterOverview.tsx';
import { burdenParts, LoadSummary } from './LoadSummary.tsx';
import { PackLoad } from './PackLoad.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const coinRules = combineEncumbrance([
  {
    mode: 'coin',
    coin: {
      maxLoadCoin: 1200,
      tiers: [
        { label: 'Light', max: 400, movement: '120 paces' },
        { label: 'Laden', max: 800, movement: '90 paces' },
        { label: 'Heavy', max: 1200, movement: '60 paces' },
      ],
      overMax: 'Rooted to the spot',
    },
  },
]);

const bandSection = {
  mode: 'slot',
  slot: {
    bands: {
      equipped: [
        { maxSlots: 2, speed: 50 },
        { maxSlots: 6, speed: 25 },
      ],
      stowed: [
        { maxSlots: 10, speed: 50 },
        { maxSlots: 13, speed: 35 },
        { maxSlots: 16, speed: 15 },
      ],
    },
    combine: 'slowest',
    overMax: 'Rooted to the spot',
  },
  labels: { equipped: 'Worn', stowed: 'Carried' },
};

const bandRules = combineEncumbrance([bandSection]);

const armourRules = {
  mode: 'armour',
  armour: {
    maxLoadCoin: 500,
    movement: [
      { armour: 'none', withoutTreasure: '120 paces', withTreasure: '90 paces' },
      { armour: 'light', withoutTreasure: '90 paces', withTreasure: '60 paces' },
      { armour: 'heavy', withoutTreasure: '60 paces', withTreasure: '30 paces' },
    ],
    armourTypes: {},
  },
  treasureWeights: { gem: 1 },
  coin: null,
  slot: null,
  containers: 'hold-only',
  separateCategories: [],
} as unknown as EncumbranceRules;

const coin = (load: number, bonuses?: { name: string; amount: number }[]): CarriedLoad => {
  const added = (bonuses ?? []).reduce((sum, b) => sum + b.amount, 0);
  const tier = coinRules.coin!.tiers.map((t) => ({ ...t, max: t.max + added })).find((t) => load <= t.max) ?? null;
  return { mode: 'coin', load, capacity: 1200 + added, tier, over: load > 1200 + added, overMax: '', ...(bonuses ? { bonuses } : {}), ...(added > 0 ? { added } : {}) };
};

let next = 0;
const slotLine = (equipped: boolean): LoadLine => ({
  id: `line-${++next}`,
  name: 'Eel trap',
  category: 'gear',
  qty: 1,
  weightCoin: null,
  slots: 1,
  stack: 1,
  containerLineId: null,
  equipped,
  container: null,
  armourType: null,
});
const slots = (worn: number, carried: number) => [...Array.from({ length: worn }, () => slotLine(true)), ...Array.from({ length: carried }, () => slotLine(false))];

const armour = (carriesTreasure: boolean, movement: string): Extract<CarriedLoad, { mode: 'armour' }> => ({
  mode: 'armour',
  load: 4,
  capacity: 500,
  carriesTreasure,
  treasureSuggested: false,
  movement,
  over: false,
  overMax: '',
});

/** The pop-up's table rows as text, cell by cell, and which row is bold. */
const tableOf = (dialog: HTMLElement, name: string) => {
  const table = within(dialog).getByRole('region', { name });
  const rows = [...table.querySelectorAll('tbody tr')];
  return { cells: rows.map((r) => [...r.querySelectorAll('td')].map((td) => td.firstChild?.textContent ?? '')), bold: rows.findIndex((r) => r.classList.contains('book-table__marked')) };
};

describe('the burden’s levels as a pop-up (tfb-4)', () => {
  // Purpose 1.
  it('opens "Burden" with every level and the character’s row in bold, and opens nothing in place', async () => {
    const user = userEvent.setup();
    const { container } = render(<LoadSummary load={coin(383)} rules={coinRules} from={['River Rules, p. 41']} levelsPopUp />);
    const before = container.innerHTML;
    const tier = screen.getByRole('button', { name: 'Light, speed 120' });
    expect(tier.getAttribute('aria-haspopup')).toBe('dialog');
    await user.click(tier);
    const dialog = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(dialog).getByText('Light: 383 of 1,200 coins’ weight.')).toBeTruthy();
    const { cells, bold } = tableOf(dialog, 'Burden by weight');
    expect(cells).toEqual([
      ['Light', '400 coins', '120 paces'],
      ['Laden', '800 coins', '90 paces'],
      ['Heavy', '1,200 coins', '60 paces'],
    ]);
    expect(bold).toBe(0);
    // The page under it doesn't move: the bar's own markup is as it was, and the pop-up is not inside it.
    expect(container.innerHTML).toBe(before);
    expect(container.contains(dialog)).toBe(false);
    expect(container.querySelector('.pack__explain')).toBeNull();
  });

  // Purpose 2.
  it('says over the limit in its first line, with a last row in bold, at 999,999', async () => {
    const user = userEvent.setup();
    render(<LoadSummary load={coin(999_999)} rules={coinRules} from={[]} levelsPopUp />);
    await user.click(screen.getByRole('button', { name: /Over the limit/ }));
    const dialog = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(dialog).getByText('Over the limit: 999,999 of 1,200 coins’ weight.')).toBeTruthy();
    const { cells, bold } = tableOf(dialog, 'Burden by weight');
    expect(cells).toHaveLength(4);
    expect(cells[3]!.slice(0, 2)).toEqual(['Over the limit', 'More']);
    expect(bold).toBe(3);
  });

  // Purpose 3.
  it('draws one table per band, its slots filled and speeds, and names the band that sets the speed', async () => {
    const user = userEvent.setup();
    render(<LoadSummary load={carriedLoad(slots(4, 11), bandRules, 'slot')} rules={bandRules} from={['Old Marsh Rules, p. 48']} levelsPopUp />);
    await user.click(screen.getByRole('button', { name: 'Speed 25' }));
    const dialog = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(dialog).getByText('Worn: 4 of 6 slots. Carried: 11 of 16 slots.')).toBeTruthy();
    const carried = tableOf(dialog, 'Burden by slots carried');
    expect(carried.cells).toEqual([
      ['Up to 10', '50'],
      ['11 to 13', '35'],
      ['14 to 16', '15'],
    ]);
    expect(carried.bold).toBe(1);
    expect(tableOf(dialog, 'Burden by slots worn').bold).toBe(1);
    expect(dialog.textContent).toContain('Sets your speed Worn: the slower of the two counts.');
  });

  // Purpose 4.
  it('draws armour’s movement table with the armour worn in bold, the line on treasure, and no switch', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(<LoadSummary load={armour(false, '60 paces')} rules={armourRules} from={[]} treasure={{ gmSwitch: null, onSwitch }} levelsPopUp />);
    await user.click(screen.getByRole('button', { name: 'Move 60 paces' }));
    const dialog = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(dialog).getByText('Heavy, not carrying treasure: 60 paces.')).toBeTruthy();
    const { cells, bold } = tableOf(dialog, 'Movement by armour');
    expect(cells[2]).toEqual(['Heavy', '60 paces', '30 paces']);
    expect(bold).toBe(2);
    expect(dialog.textContent).toContain('Treasure Not carrying treasure: nothing counts as treasure.');
    expect(within(dialog).queryByRole('button', { name: /Switch/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Switch on' })).toBeTruthy();
  });

  // Purpose 4, a speed two rows share: no row is guessed bold, and the first line still says the speed.
  it('marks no armour row when two rows give the same speed', () => {
    const { tables, lead } = burdenParts(armour(true, '60 paces'), { ...armourRules, armour: { ...armourRules.armour!, movement: [...armourRules.armour!.movement, { armour: 'mail', withoutTreasure: '90 paces', withTreasure: '60 paces' }] } });
    expect(tables[0]!.marked).toBe(-1);
    expect(lead).toEqual(['Carrying treasure: 60 paces.']);
  });

  // Purpose 1, a level's effect: it follows the table as a labelled line (a fourth column cut its words at 375 px);
  // over the most with no speed column, the pack's words for it go with them.
  it('says each level’s effect as a labelled line under the table', () => {
    const rules = combineEncumbrance([{ mode: 'coin', coin: { maxLoadCoin: 900, tiers: [{ label: 'Light', max: 400, effect: 'Normal pace' }, { label: 'Bowed', max: 900, effect: 'Crawling.' }], overMax: 'Stuck in the mud' } }]);
    const over: Extract<CarriedLoad, { mode: 'coin' | 'slot' }> = { mode: 'coin', load: 999, capacity: 900, tier: null, over: true, overMax: 'Stuck in the mud' };
    const { tables, lead } = burdenParts(over, rules);
    expect(lead).toEqual(['Stuck in the mud: 999 of 900 coins’ weight.']);
    expect(tables[0]!.head).toEqual(['Level', 'Up to']);
    expect(tables[0]!.rows.at(-1)).toEqual(['Over the limit', 'More']);
    expect(tables[0]!.effects).toEqual([
      { label: 'Light', words: 'Normal pace.' },
      { label: 'Bowed', words: 'Crawling.' },
      { label: 'Over the limit', words: 'Stuck in the mud.' },
    ]);
  });

  // Purpose 5.
  it('names what raises the limit, and its source at the foot', async () => {
    const user = userEvent.setup();
    render(<LoadSummary load={coin(383, [{ name: 'Ogre grips', amount: 200 }])} rules={coinRules} from={['River Rules, p. 41']} levelsPopUp />);
    await user.click(screen.getByRole('button', { name: 'Light, speed 120' }));
    const dialog = screen.getByRole('dialog', { name: 'Burden' });
    expect(dialog.textContent).toContain('Limit 1,400 coins. Ogre grips: +200 coins to each limit, while worn or in hand.');
    expect(within(dialog).getByText('From your setting: River Rules, p. 41')).toBeTruthy();
  });

  // Purpose 5a (the local review of #1078): a load raised by a worn item that adds to each limit, above the first
  // level, shows the raised levels, so the bold row, the first line and the table agree.
  it('shows the levels raised by a worn item, the bold row agreeing with the first line', async () => {
    const user = userEvent.setup();
    const grips: LoadLine = { ...slotLine(true), name: 'Ogre grips', slots: null, weightCoin: 0, carryBonus: 200 };
    const pot: LoadLine = { ...slotLine(false), name: 'Iron pot', slots: null, weightCoin: 700 };
    render(<LoadSummary load={carriedLoad([grips, pot], coinRules, 'coin')} rules={coinRules} from={[]} levelsPopUp />);
    await user.click(screen.getByRole('button', { name: 'Laden, speed 90' }));
    const dialog = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(dialog).getByText('Laden: 700 of 1,400 coins’ weight.')).toBeTruthy();
    const { cells, bold } = tableOf(dialog, 'Burden by weight');
    expect(cells.map((row) => row[1])).toEqual(['600 coins', '1,000 coins', '1,400 coins']);
    expect(cells[bold]![0]).toBe('Laden');
    expect(dialog.textContent).toContain('Limit 1,400 coins. Ogre grips: +200 coins to each limit, while worn or in hand.');
  });

  // Purpose 5a, a bag that adds room (containers "add"): the levels raised by the bag, the bold row agreeing.
  it('shows the levels raised by a bag that adds room, above the first level', async () => {
    const user = userEvent.setup();
    const adding = combineEncumbrance([{ mode: 'coin', containers: 'add', coin: { maxLoadCoin: 1200, tiers: coinRules.coin!.tiers.map((t) => ({ ...t })), overMax: '' } }]);
    const bag: LoadLine = { ...slotLine(false), name: 'Reed basket', slots: null, weightCoin: 20, container: { capacityCoin: 100 } };
    const pot: LoadLine = { ...slotLine(false), name: 'Iron pot', slots: null, weightCoin: 500 };
    render(<LoadSummary load={carriedLoad([bag, pot], adding, 'coin')} rules={adding} from={[]} levelsPopUp />);
    await user.click(screen.getByRole('button', { name: 'Laden, speed 90' }));
    const dialog = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(dialog).getByText('Laden: 520 of 1,300 coins’ weight.')).toBeTruthy();
    const { cells, bold } = tableOf(dialog, 'Burden by weight');
    expect(cells.map((row) => row[1])).toEqual(['500 coins', '900 coins', '1,300 coins']);
    expect(bold).toBe(1);
  });

  // Purpose 5a, slot bands: a bag that adds room raises the band it is carried in, and its rows say so.
  it('shows a band’s slots filled raised by a bag that adds room', async () => {
    const user = userEvent.setup();
    const adding = combineEncumbrance([{ ...bandSection, containers: 'add' }]);
    const bag: LoadLine = { ...slotLine(false), name: 'Reed basket', container: { capacitySlots: 3 } };
    render(<LoadSummary load={carriedLoad([...slots(1, 14), bag], adding, 'slot')} rules={adding} from={[]} levelsPopUp />);
    await user.click(screen.getByRole('button', { name: 'Speed 35' }));
    const dialog = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(dialog).getByText('Worn: 1 of 6 slots. Carried: 15 of 19 slots.')).toBeTruthy();
    const carried = tableOf(dialog, 'Burden by slots carried');
    expect(carried.cells.map((row) => row[0])).toEqual(['Up to 13', '14 to 16', '17 to 19']);
    expect(carried.bold).toBe(1);
  });

  // Purpose 6.
  it('returns focus to the burden when closed, by ✕ or by Escape', async () => {
    const user = userEvent.setup();
    render(<LoadSummary load={coin(383)} rules={coinRules} from={[]} levelsPopUp />);
    const tier = screen.getByRole('button', { name: 'Light, speed 120' });
    await user.click(tier);
    await user.click(within(screen.getByRole('dialog', { name: 'Burden' })).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(tier);
    await user.click(tier);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(tier);
  });

  // Purpose 8.
  it('keeps the levels in place for a host that does not ask for the pop-up', async () => {
    const user = userEvent.setup();
    const { container } = render(<LoadSummary load={coin(383)} rules={coinRules} from={[]} />);
    await user.click(screen.getByRole('button', { name: 'Light, speed 120' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.querySelector('.pack__explain')).not.toBeNull();
  });
});

describe('the hosts (tfb-4: the Player tab, the Pack, the full sheet; d5-19: the overview, the Gear step)', () => {
  // Purpose 7, the full sheet.
  it("opens the pop-up from the full sheet's Pack load, nothing in place", async () => {
    const user = userEvent.setup();
    const lines = [{ id: 'l1', actorId: 'a', name: 'Iron pot', category: 'gear', slots: 1, stack: 1, qty: 1, containerLineId: null, equipped: false, approval: 'approved', details: {}, weightCoin: 383, perUnits: 1 } as unknown as InventoryLine];
    const state = { load: carriedLoad(lines.map(toLoadLine), coinRules, 'coin'), lines, mode: 'coin' as const, treasureSwitch: null };
    const { container } = render(<PackLoad state={state} rules={coinRules} from={[]} tinyCategories={new Set()} />);
    await user.click(screen.getByRole('button', { name: 'Light, speed 120' }));
    expect(screen.getByRole('dialog', { name: 'Burden' })).toBeTruthy();
    expect(container.querySelector('.pack__explain')).toBeNull();
  });
});

describe('the Player tab’s Movement (tfb-4)', () => {
  let world: FakeWorld;
  beforeEach(() => {
    world = createFakeDb();
    forgetFileLinks();
    forgetCampaignSetting();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  // Purpose 7, the Player tab.
  it('opens the pop-up from the load card, nothing in place, and returns focus on closing', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    await addP1Character(world, { gm, sam, fenPack: JSON.parse(fixture) as Record<string, Record<string, unknown>[]> });
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
    const movement = await screen.findByRole('region', { name: 'Movement' });
    const before = movement.innerHTML;
    const tier = within(movement).getByRole('button', { name: 'Light' });
    await user.click(tier);
    const dialog = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(dialog).getByRole('region', { name: 'Burden by weight' })).toBeTruthy();
    expect(movement.innerHTML).toBe(before);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(tier);
  });
});

describe('the GM’s character overview (d5-19)', () => {
  let world: FakeWorld;
  beforeEach(() => {
    world = createFakeDb();
    forgetFileLinks();
    forgetCampaignSetting();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  // Purpose 9.
  it('opens the pop-up over the overview, with the source, nothing in place, and returns focus on closing', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const brannoch = await addP1Character(world, { gm, sam, fenPack: JSON.parse(fixture) as Record<string, Record<string, unknown>[]> });
    const campaign = world.tables.actors.find((a) => a.id === brannoch)!.campaign_id as string;
    world.signInAs(gm);
    const setting = await loadCampaignSetting(world.db, gm, campaign);
    const settings = world.tables.campaigns.find((c) => c.id === campaign)!.settings;
    const user = userEvent.setup();
    const { container } = render(
      <CharacterOverview
        db={world.db}
        user={{ id: gm, roles: { [campaign]: 'gm' } }}
        character={{ id: brannoch, campaignId: campaign, name: 'Brannoch', ownerUserId: sam, level: 1, hpCurrent: null, hpMax: null, archived: false }}
        setting={setting}
        settings={settings}
        showHp
        refresh={0}
        onClose={() => undefined}
      />,
    );
    const overview = screen.getByRole('dialog', { name: 'Brannoch' });
    const tier = await within(overview).findByRole('button', { name: /^Light/ });
    expect(tier.getAttribute('aria-haspopup')).toBe('dialog');
    await user.click(tier);
    const dialog = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(dialog).getByRole('region', { name: 'Burden by weight' })).toBeTruthy();
    expect(within(dialog).getByText(/^From your setting: /)).toBeTruthy();
    expect(container.querySelector('.pack__explain')).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Burden' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Brannoch' })).toBeTruthy();
    expect(document.activeElement).toBe(tier);
  });
});
