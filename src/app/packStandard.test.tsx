// @vitest-environment jsdom
// The Pack on creation's standard (plan m5b-players-screens-standard C; mockup players/01). Invented rules and names
// only (hard rule 2). Purposes:
//   The Pack draws no " · ", "›" or "▲": the list, its fold rows, the waiting card, the foot, and an item's sheet.
//   The load line with its bar comes first, before any group.
//   A row opens the item's sheet (a chevron says so); the sheet holds the actions as rows, Drop last and set apart.
//   An At hand row's button acts; a tap on its body opens the item's sheet.
//   The star in the sheet's head toggles pinned (aria-pressed); a pinned item's line starts with the filled star and
//   a screen reader hears "pinned"; the toast's Undo unpins.
//   Drop removes the item at once with an Undo toast; no confirm appears, and Undo brings it back.
//   Add item is the only accent button on the Pack, in the foot with the count.
//   The items waiting for the GM are a card with the warning sign that opens their list as a sheet.
//   The Pack's At hand group holds the pinned items, first, each listed only there (Design on #552, scope check 1 (a)).
//   At hand holds only items with an action (Francis, 2026-11-07, on #552); every row carries it: Use a charge, Light or
//   Put out, use one up (Fire, Drink, Eat, Use: Drop's own command for one, logged, Undo in the toast, the last one
//   leaving play with the log keeping a copy), and Attack for a weapon in hand, which opens the Attack sheet (ah-1).
//   A container pinned to At hand still has its things under "In the <container>", not under Carried.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { watchMarks } from '../testing/markScan.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let campaign = '';
let wren = '';
type User = ReturnType<typeof userEvent.setup>;

// The shared mark check (A's `watchMarks`, src/testing/markScan.ts): the Pack, its sheets and its toasts.
let marks: ReturnType<typeof watchMarks> | null = null;

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  localStorage.removeItem('grimoire.packOpen');
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  marks = watchMarks('section.pack, [role="dialog"], .toast');
});

afterEach(() => {
  marks?.stop();
  cleanup();
  vi.restoreAllMocks();
});

/** Wren in coin mode with the Fen rules' tiers and wand charges, and the given lines (a stash line has no actor). */
function fenWorld(lines: { name: string; stash?: boolean; extra?: Record<string, unknown> }[]) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('wren@lantern.example', 'Sam');
  campaign = world.addCampaign('The Ash Barrows', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode: 'coin' } } });
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
      encumbrance: { mode: 'coin', coin: { maxLoadCoin: 1000, tiers: [{ label: 'Light', max: 400, movement: '40 ft', effect: 'Easy going' }, { label: 'Laden', max: 1000, movement: '20 ft' }], overMax: 'Stuck in the mud' } },
      magicItems: { charges: { wand: '2d6', hidden: false, rechargeable: false } },
    },
  });
  world.tables.library_entries.push({ id: 'entry-rushlight', pack_id: 'pack-fen', kind: 'lightType', pack_entry_id: 'rushlight', name: 'Rushlight', data: { id: 'rushlight', name: 'Rushlight', duration: 6, unit: 'turn', radius: '30 ft', consumed: true } });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, priority: 1 });
  for (const [i, l] of lines.entries()) {
    world.tables.inventory_lines.push({
      id: `line-${l.name.toLowerCase().replace(/\W+/g, '-')}`,
      campaign_id: campaign,
      actor_id: l.stash ? null : wren,
      location_id: l.stash ? `location-stash-${campaign}` : null,
      library_entry_id: null,
      name: l.name,
      category: 'gear',
      weight_coin: 10,
      slots: null,
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

async function openPack(): Promise<User> {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
  expect(await screen.findByRole('heading', { name: 'Wren’s pack' })).toBeTruthy();
  return user;
}

const pack = () => screen.getByRole('region', { name: 'Wren’s pack' });
const line = (name: string) => world.tables.inventory_lines.find((l) => l.name === name);

describe('the Pack on the standard (plan m5b-players-screens-standard C)', () => {
  it('draws no middle dot, angle quote or plain ▲: the list, the folds, the waiting card, an item’s sheet and its toasts', async () => {
    fenWorld([
      { name: 'Lantern', extra: { equipped: true, item_data: { slot: 'hand' } } },
      { name: 'Torch', extra: { qty: 6, stack: 6 } },
      { name: 'Glow wand', extra: { category: 'wand', charges_left: 0 } },
      { name: 'Coil of rope' },
      { name: 'Silver ewer', stash: true },
      { name: 'Strange key', extra: { approval: 'pending' } },
    ]);
    const user = await openPack();
    await user.click(screen.getByRole('button', { name: /^Lantern/ }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: /^Glow wand/ }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: /waiting for the GM/ }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByText('Party stash', { selector: '.creation-fold__label' }));
    await screen.findByRole('button', { name: /^Silver ewer/ });
    await user.click(screen.getByRole('button', { name: /^Coil of rope/ }));
    await user.click(screen.getByRole('button', { name: 'Drop' }));
    await screen.findByText('Dropped Coil of rope');
    expect([...marks!.found]).toEqual([]);
  });

  it('the bar carries the title on the Pack tab; the Pack keeps its heading for screen readers only', async () => {
    fenWorld([{ name: 'Coil of rope' }]);
    await openPack();
    expect(document.querySelector('.top-row__title')!.textContent).toBe('Wren’s pack');
    expect(screen.getByRole('heading', { name: 'Wren’s pack' }).className).toBe('visually-hidden');
  });

  it('puts the load line and its bar first, before any group', async () => {
    fenWorld([{ name: 'Coil of rope' }]);
    await openPack();
    const load = pack().querySelector('.pack__load')!;
    const firstGroup = pack().querySelector('.pack__group')!;
    expect(load).toBeTruthy();
    expect(load.querySelector('.pack__bar')).toBeTruthy();
    expect(load.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(load as HTMLElement).getByRole('button', { name: /^Light, speed 40/ })).toBeTruthy();
  });

  it('a row ends in a chevron and opens the item’s sheet: the actions as rows, Drop last and set apart', async () => {
    fenWorld([{ name: 'Coil of rope' }, { name: 'Satchel', extra: { item_data: { container: { capacityCoin: 100 } } } }]);
    const user = await openPack();
    const row = screen.getByRole('button', { name: /^Coil of rope/ });
    expect(row.getAttribute('aria-haspopup')).toBe('dialog');
    expect(row.querySelector('.pack__chevron')).toBeTruthy();
    await user.click(row);
    const sheet = await screen.findByRole('dialog', { name: 'Coil of rope' });
    const rows = [...sheet.querySelectorAll('.list-row__body')].map((b) => b.getAttribute('aria-label'));
    expect(rows).toEqual(['Give to…', 'Put in…', 'Drop']);
    // The rows that ask more carry a chevron; Drop is set apart, last.
    expect(within(sheet).getByRole('button', { name: 'Give to…' }).querySelector('.list-row__chevron')).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Drop' }).closest('.list-row')!.className).toContain('list-row--apart');
    // The old "Pin to At hand" row is gone: the star in the head pins.
    expect(within(sheet).queryByRole('button', { name: /Pin to At hand/ })).toBeNull();
  });

  it('an At hand row’s button acts; a tap on its body opens the item’s sheet', async () => {
    fenWorld([{ name: 'Glow wand', extra: { category: 'wand', equipped: true, charges_left: 2, item_data: { slot: 'hand' } } }]);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const atHand = within(await screen.findByRole('region', { name: 'At hand' }));
    await user.click(atHand.getByRole('button', { name: 'Use a charge of Glow wand' }));
    await waitFor(() => expect(line('Glow wand')).toMatchObject({ charges_left: 1 }));
    expect(screen.queryByRole('dialog', { name: 'Glow wand' })).toBeNull();
    await user.click(atHand.getByRole('button', { name: /^Glow wand/ }));
    expect(await screen.findByRole('dialog', { name: 'Glow wand' })).toBeTruthy();
  });

  it('the star toggles pinned; the line then starts with the filled star, heard as "pinned"; the toast’s Undo unpins', async () => {
    fenWorld([{ name: 'Coil of rope' }]);
    const user = await openPack();
    await user.click(screen.getByRole('button', { name: /^Coil of rope/ }));
    const star = within(await screen.findByRole('dialog', { name: 'Coil of rope' })).getByRole('button', { name: 'Pin to top' });
    expect(star.getAttribute('aria-pressed')).toBe('false');
    await user.click(star);
    await waitFor(() => expect(line('Coil of rope')).toMatchObject({ pinned: true }));
    expect(await screen.findByText('Coil of rope pinned to the top')).toBeTruthy();
    const row = await screen.findByRole('button', { name: /^Coil of rope pinned/ });
    // The star leads the line under the name, before anything else in it.
    expect(row.querySelector('.pack__sub')!.firstElementChild!.className).toBe('pinned-mark');
    await user.click(row);
    const unpin = within(await screen.findByRole('dialog', { name: 'Coil of rope' })).getByRole('button', { name: 'Unpin' });
    expect(unpin.getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line('Coil of rope')).toMatchObject({ pinned: false }));
    expect(await screen.findByRole('button', { name: /^Coil of rope/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Coil of rope pinned/ })).toBeNull();
  });

  it('Drop removes the item at once, no confirm, and the toast’s Undo brings it back', async () => {
    fenWorld([{ name: 'Coil of rope' }]);
    const user = await openPack();
    await user.click(screen.getByRole('button', { name: /^Coil of rope/ }));
    await user.click(screen.getByRole('button', { name: 'Drop' }));
    await waitFor(() => expect(line('Coil of rope')).toBeUndefined());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByText('Dropped Coil of rope')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line('Coil of rope')).toMatchObject({ actor_id: wren }));
  });

  it('Add item is the only accent button on the Pack, in the foot with the count', async () => {
    fenWorld([{ name: 'Coil of rope' }, { name: 'Torch', extra: { qty: 6, stack: 6 } }]);
    await openPack();
    const accents = [...pack().querySelectorAll('.button-primary')];
    expect(accents.map((b) => b.textContent)).toEqual(['Add item']);
    const foot = pack().querySelector('.pack__foot') as HTMLElement;
    expect(foot.textContent).toBe('7 itemsAdd item');
  });

  it('the items waiting for the GM are a card with the warning sign that opens their list as a sheet', async () => {
    fenWorld([{ name: 'Coil of rope' }, { name: 'Strange key', extra: { approval: 'pending' } }]);
    const user = await openPack();
    const card = screen.getByRole('button', { name: /1 item waiting for the GM/ });
    expect(card.querySelector('.warning-sign')).toBeTruthy();
    expect(card.textContent).toContain('Strange key');
    await user.click(card);
    const sheet = within(await screen.findByRole('dialog', { name: 'Waiting for the GM' }));
    expect(sheet.getByRole('button', { name: /^Strange key/ })).toBeTruthy();
  });

  it('the At hand group holds only pinned items with an action, first, each listed only there; the rest stay in their groups', async () => {
    fenWorld([
      { name: 'Coil of rope', extra: { pinned: true } },
      { name: 'Lantern', extra: { equipped: true, pinned: true, item_data: { slot: 'hand' } } },
      { name: 'Reed spear', extra: { equipped: true, pinned: true, category: 'weapon', item_data: { slot: 'hand' } } },
      { name: 'Moss draught', extra: { pinned: true, category: 'potion' } },
      { name: 'Eel trap' },
    ]);
    await openPack();
    const atHand = screen.getByRole('region', { name: 'At hand' });
    expect(within(atHand).getAllByRole('button', { name: /^(Coil of rope|Lantern|Reed spear|Moss draught)/ }).map((b) => b.textContent?.split(' pinned')[0])).toEqual(['Moss draught', 'Reed spear']);
    // First, before every other group; each once on the whole screen, its line keeping where it is.
    expect(pack().querySelector('.pack__group')).toBe(atHand);
    expect(screen.getAllByRole('button', { name: /^Reed spear/ })).toHaveLength(1);
    expect(within(atHand).getByRole('button', { name: /^Reed spear/ }).textContent).toContain('In hand');
    // Nothing to do: the worn lantern stays in Worn and in hand, the pinned rope in Carried, its star still on its line.
    expect(within(screen.getByRole('region', { name: 'Worn and in hand' })).getByRole('button', { name: /^Lantern/ })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Carried' })).getByRole('button', { name: /^Coil of rope pinned/ })).toBeTruthy();
  });

  it('every At hand row carries its action: Light then Put out, Drink, and Attack opening the Attack sheet (ah-1)', async () => {
    fenWorld([
      { name: 'Rushlights', extra: { pinned: true, qty: 3, stack: 10, category: 'light', item_data: { lightTypeId: 'rushlight' } } },
      { name: 'Moss draught', extra: { pinned: true, category: 'potion' } },
      { name: 'Reed spear', extra: { equipped: true, pinned: true, category: 'weapon', item_data: { slot: 'hand' } } },
    ]);
    const user = await openPack();
    const atHand = within(screen.getByRole('region', { name: 'At hand' }));
    await user.click(await atHand.findByRole('button', { name: 'Light Rushlights' }));
    await waitFor(() => expect(world.tables.character_lights.find((l) => l.actor_id === wren)?.lit_at).not.toBeNull());
    await user.click(await atHand.findByRole('button', { name: 'Put out Rushlights' }));
    await waitFor(() => expect(world.tables.character_lights.find((l) => l.actor_id === wren)).toMatchObject({ lit_at: null }));
    expect(atHand.getByRole('button', { name: 'Drink Moss draught' })).toBeTruthy();
    // No row in At hand ends in a chevron: each has its button.
    expect(screen.getByRole('region', { name: 'At hand' }).querySelector('.pack__chevron')).toBeNull();
    await user.click(atHand.getByRole('button', { name: 'Attack with Reed spear' }));
    // A sheet, not a roll, until the fight rules (M6); it ends with its rows, with no line saying so (tfw-3, 2026-11-19).
    const sheet = within(await screen.findByRole('dialog', { name: 'Reed spear' }));
    expect(sheet.queryByText(/fight rules/)).toBeNull();
  });

  it('use one up: Fire counts a stack down by one, logged, and the toast\u2019s Undo puts it back', async () => {
    fenWorld([{ name: 'Reed arrows', extra: { pinned: true, category: 'ammunition', qty: 18, stack: 20 } }]);
    const user = await openPack();
    await user.click(within(screen.getByRole('region', { name: 'At hand' })).getByRole('button', { name: 'Fire Reed arrows' }));
    await waitFor(() => expect(line('Reed arrows')).toMatchObject({ qty: 17 }));
    // Its own command, item.use (Design on #552), never a drop.
    expect(world.tables.events.some((e) => e.type === 'item.use')).toBe(true);
    expect(world.tables.events.some((e) => e.type === 'inventory.remove')).toBe(false);
    expect(await screen.findByText('Fired Reed arrows, 17 left')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line('Reed arrows')).toMatchObject({ qty: 18 }));
  });

  it('use one up: drinking the last draught takes it out of play, the log keeps a copy, and Undo brings it back', async () => {
    fenWorld([{ name: 'Moss draught', extra: { pinned: true, category: 'potion' } }]);
    const user = await openPack();
    await user.click(within(screen.getByRole('region', { name: 'At hand' })).getByRole('button', { name: 'Drink Moss draught' }));
    await waitFor(() => expect(line('Moss draught')).toBeUndefined());
    // Hard rule 4: the line is deleted and the log keeps a copy.
    const gone = world.tables.events.find((e) => e.type === 'item.use' && e.after === null);
    expect(gone?.before).toMatchObject({ name: 'Moss draught' });
    expect(await screen.findByText('Drank the last Moss draught')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line('Moss draught')).toMatchObject({ actor_id: wren }));
  });

  it('a container pinned to At hand keeps its things under "In the <container>", not under Carried', async () => {
    fenWorld([
      // A container with an action: a sling bag (a weapon) holding its stones.
      { name: 'Sling bag', extra: { pinned: true, category: 'weapon', item_data: { container: { capacityCoin: 200 } } } },
      { name: 'Chalk', extra: { container_line_id: 'line-sling-bag' } },
      { name: 'Eel hooks', extra: { container_line_id: 'line-sling-bag' } },
      { name: 'Coil of rope' },
    ]);
    await openPack();
    expect(within(screen.getByRole('region', { name: 'At hand' })).getByRole('button', { name: /^Sling bag/ })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Sling bag/ })).toHaveLength(1);
    const inside = within(screen.getByRole('region', { name: 'In the Sling bag' }));
    expect(inside.getAllByRole('button', { name: /^(Chalk|Eel hooks)/ }).map((b) => b.textContent?.split(' ')[0])).toEqual(['Chalk', 'Eel']);
    const carried = within(screen.getByRole('region', { name: 'Carried' }));
    expect(carried.getAllByRole('button', { name: /^(Chalk|Eel hooks|Coil of rope|Sling bag)/ }).map((b) => b.textContent?.split(' ')[0])).toEqual(['Coil']);
  });
});
