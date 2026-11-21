// @vitest-environment jsdom
// The Pack tab's folded Tiny things section (SC-5-2, ruled 2026-11-05; 05 "Equipped, stowed and tiny", 06 Pack
// summary): the sheet's `loadGroups` split, its words (pl-1), folded at first and remembered on this device.
// Invented rules and names only (hard rule 2).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { combineEncumbrance } from '../modules/inventory/encumbrance.ts';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import { amountText, groupPack, packGroupsWithTiny } from '../modules/inventory/packView.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let next = 0;
const item = (name: string, more: Partial<InventoryLine> = {}): InventoryLine =>
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

const slotRules = combineEncumbrance([{ mode: 'slot', slot: { tiers: [{ label: 'Light', maxSlots: 9 }] } }]);
const TINY: ReadonlySet<string> = new Set(['trinket']);
const titles = (groups: { title: string }[]) => groups.map((g) => g.title);

describe('packGroupsWithTiny (the grouping)', () => {
  it('without a tiny thing, the groups are exactly the Pack’s groups as before', () => {
    const lines = [item('Reed spear', { equipped: true }), item('Eel trap')];
    expect(packGroupsWithTiny(lines, 'slot', slotRules, TINY)).toEqual(groupPack(lines, 'slot', slotRules));
  });

  it('tiny things leave their groups (a container’s included) for Tiny things, after Carried and before Other', () => {
    const satchel = item('Satchel', { details: { container: { capacitySlots: 4 } } });
    const lines = [
      satchel,
      item('Chalk', { slots: 0, category: 'trinket', containerLineId: satchel.id }),
      item('Blanket', { containerLineId: satchel.id }),
      item('Eel hooks', { slots: 0, details: { unencumbering: true } }),
      item('Mule', { category: 'animal', details: { animal: {} } }),
    ];
    const groups = packGroupsWithTiny(lines, 'slot', slotRules, TINY, () => 'Animals');
    expect(titles(groups)).toEqual(['In the Satchel', 'Carried', 'Tiny things', 'Animals']);
    expect(groups.find((g) => g.key === 'tiny')!.lines.map((l) => l.name)).toEqual(['Chalk', 'Eel hooks']);
    expect(groups[0]!.lines.map((l) => l.name)).toEqual(['Blanket']);
  });

  it('a tiny container stays where it is, holding its things', () => {
    const pouch = item('Pouch', { category: 'trinket', details: { container: { capacitySlots: 1 } } });
    const groups = packGroupsWithTiny([pouch, item('Coil', { containerLineId: pouch.id })], 'slot', slotRules, TINY);
    expect(titles(groups)).toEqual(['In the Pouch', 'Carried']);
  });
});

describe('a tiny row’s amount (Design, 2026-11-05)', () => {
  const coinRules = combineEncumbrance([{ mode: 'coin', coin: { maxLoadCoin: 900, tiers: [{ label: 'Light', max: 900 }], overMax: 'Stuck' } }]);
  it('a weightless tiny thing shows the dash every other weightless row shows, never "0 coins" or "0 slots"', () => {
    expect(amountText(item('Button', { weightCoin: 0 }), 'coin', coinRules, [], { tiny: true })).toBe('—');
    expect(amountText(item('Button', { slots: 0 }), 'slot', slotRules, [], { tiny: true })).toBe('—');
  });
  it('a tiny thing that weighs something keeps its amount, and an ordinary row is unchanged', () => {
    expect(amountText(item('Bell', { weightCoin: 2 }), 'coin', coinRules, [], { tiny: true })).toBe('2 coins');
    expect(amountText(item('Button', { weightCoin: 0 }), 'coin', coinRules)).toBe('0 coins');
  });
});

describe('the Pack tab’s Tiny things section', () => {
  let world: FakeWorld;
  beforeEach(() => {
    world = createFakeDb();
    forgetCampaignSetting();
    localStorage.removeItem('grimoire.packOpen');
    localStorage.removeItem('grimoire.lastPlace');
    window.history.replaceState(null, '', '/');
  });
  afterEach(cleanup);

  /** Wren in slot mode, with a rules set that marks the trinket category tiny, and the given lines. */
  function tinyWorld(lines: { name: string; extra?: Record<string, unknown> }[]) {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    world.addMember(campaign, sam, 'player', wren);
    Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode: 'slot' } } });
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({
      id: 'entry-fen-rules',
      pack_id: 'pack-fen',
      kind: 'rulesSet',
      pack_entry_id: 'fen-rules',
      name: 'Fen rules',
      data: {
        id: 'fen-rules',
        name: 'Fen rules',
        encumbrance: { mode: 'slot', slot: { tiers: [{ label: 'Light', maxSlots: 9, effect: 'Normal pace' }] } },
        itemCategories: [{ id: 'trinket', name: 'Trinkets', unencumbering: true }],
      },
    });
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, priority: 1 });
    for (const [i, l] of lines.entries()) {
      world.tables.inventory_lines.push({
        id: `line-${l.name.toLowerCase().replace(/\W+/g, '-')}`,
        campaign_id: campaign,
        actor_id: wren,
        location_id: null,
        library_entry_id: null,
        name: l.name,
        category: 'gear',
        weight_coin: null,
        slots: 1,
        stack: 1,
        qty: 1,
        container_line_id: null,
        equipped: false,
        how_got: 'found',
        cost: '',
        notes: '',
        item_data: {},
        source_pack_id: null,
        source_entry_id: null,
        charges_left: null,
        charges_hidden: false,
        charges_used: 0,
        spent_shown: false,
        last_roll: null,
        pinned: false,
        at_hand_hidden: false,
        approval: 'approved',
        per_units: 1,
        version: 1,
        created_at: `2026-10-23T10:00:0${i}Z`,
        ...l.extra,
      });
    }
    world.signInAs(sam);
  }

  async function openPack() {
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    expect(await screen.findByRole('heading', { name: 'Wren’s pack' })).toBeTruthy();
    return user;
  }

  /** The Tiny things fold row (plan m5b-players-screens-standard C: a fold row with its summary, the + at its edge). */
  const tinyFold = () => screen.getByText('Tiny things', { selector: '.creation-fold__label' }).closest('details')!;

  it('folds the tiny things away under "Tiny things", "2 items: …. They don\'t count" when they take no slot, and opens in place', async () => {
    tinyWorld([
      { name: 'Eel trap' },
      { name: 'Button', extra: { category: 'trinket', slots: 0 } },
      { name: 'Eel hooks', extra: { slots: 0, qty: 999, stack: 999, item_data: { unencumbering: true } } },
    ]);
    const user = await openPack();
    const fold = tinyFold();
    expect(fold.querySelector('.creation-fold__note')!.textContent).toBe('2 items: Button, Eel hooks ×999');
    // "They don't count" is the fold's second line, never run into the list (Design on #552).
    expect(fold.querySelector('.creation-fold__detail')!.textContent).toBe("They don't count");
    expect(fold.open).toBe(false);
    expect(screen.getByRole('button', { name: /^Eel trap/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Button/ })).toBeNull();
    await user.click(fold.querySelector('summary')!);
    await waitFor(() => expect(tinyFold().open).toBe(true));
    expect(await screen.findByRole('button', { name: /^Button/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Eel hooks/ })).toBeTruthy();
    // Weightless, the rows show no weight, never "0 slots".
    expect(screen.queryByText(/0 slots/)).toBeNull();
  });

  it('says only the count and names when a tiny thing takes a slot (pl-2: "don\'t count" only where true)', async () => {
    tinyWorld([{ name: 'Button', extra: { category: 'trinket', slots: 1 } }]);
    await openPack();
    expect(tinyFold().querySelector('.creation-fold__note')!.textContent).toBe('1 item: Button');
    expect(tinyFold().querySelector('.creation-fold__detail')).toBeNull();
  });

  it('remembers on this device how the section was left', async () => {
    tinyWorld([{ name: 'Button', extra: { category: 'trinket', slots: 0 } }]);
    const user = await openPack();
    await user.click(tinyFold().querySelector('summary')!);
    await waitFor(() => expect(tinyFold().open).toBe(true));
    cleanup();
    await openPack();
    expect(tinyFold().open).toBe(true);
    expect(screen.getByRole('button', { name: /^Button/ })).toBeTruthy();
  });

  it('a line stored with a lower-case name shows with a capital first letter, and its stored name is unchanged', async () => {
    // Purpose: the display guard (R3, the Pack test): "torch ×3" in the database reads "Torch ×3" on the Pack's row.
    tinyWorld([{ name: 'bog candle', extra: { qty: 3, stack: 6 } }]);
    await openPack();
    const row = screen.getByRole('button', { name: /^Bog candle/ });
    expect(row.querySelector('.pack__name')!.textContent).toBe('Bog candle ×3');
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-bog-candle')!.name).toBe('bog candle');
  });

  it('shows no Tiny things section when nothing is tiny', async () => {
    tinyWorld([{ name: 'Eel trap' }]);
    await openPack();
    expect(screen.queryByText('Tiny things')).toBeNull();
  });
});
