// @vitest-environment jsdom
// Add item and after a purchase (K7 of docs/plans/dec-6-the-whole-pack-tab.md; frame PK10b of
// docs/design/mockups/pack/08-the-pack-tab-whole.html, approved 2026-11-14, ap-7; rulings psw-5 and tn-1). Invented
// coins, things and names only (hard rule 2). Purposes:
//   1. Add item, one thing: "How does Wren get it?" is the two-sided switch (Bought, No cost); the Cost box sits under
//      it, above "Where it goes" and the button; the cost and the list's price read in the setting's coin words.
//   2. After "Bought" the toast says the thing was added and that its cost is not spent yet, and offers "Spend 4
//      herons"; the old line "Cost noted; purses arrive later." shows nowhere; nothing is charged by itself (tn-1).
//   3. "Spend 4 herons" opens the Spend sheet with the amount filled in; the coin goes only when that sheet's accent is
//      tapped.
//   4. A cost typed in two of the setting's coins ("1 crown, 2 herons") fills both boxes of the Spend sheet.
//   5. With "No cost" the toast is the plain one: what was added, no Spend.
//   6. A cost the setting's coins can't read ("a favour owed") is said in the toast, with no Spend to fill wrongly.
//   7. The cost follows how many: three at 2 bits each cost 6 bits.
//   8. Added onto a stack already carried, Undo in the toast takes the added count back off, with Spend beside it.
//   9. The log's line for a purchase says what was paid and no longer says "Cost noted; purses arrive later.".
//  10. Spend's "What for" comes filled with the thing's name (Francis, 26 Nov, ⚑ 3 on #108), so the log line says what
//      the coin was for: "Wren spent 4 herons: Storm lantern".
//  11. Bought straight onto Equipped by a caster it stops (B25): the one toast still says casting stopped, with that
//      Undo (take it off) and Spend beside it; the purchase toast does not replace the warning (review of #108, 1).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
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

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  localStorage.removeItem('grimoire.packOpen');
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Wren (Sam's) in a campaign whose invented rules name three coins, with a storm lantern and reed torches for sale. */
async function shopWorld(coins: Record<string, number> = { crown: 12, heron: 30, bit: 4 }, torches = 0) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  campaign = world.addCampaign('The Ash Barrows', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode: 'coin' } } });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push(
    {
      id: 'entry-fen-rules',
      pack_id: 'pack-fen',
      kind: 'rulesSet',
      pack_entry_id: 'fen-rules',
      name: 'Fen rules',
      data: {
        id: 'fen-rules',
        name: 'Fen rules',
        encumbrance: { mode: 'coin', coin: { maxLoadCoin: 1200, tiers: [{ label: 'Light', max: 400, movement: '125' }, { label: 'Laden', max: 1200, movement: '60' }], overMax: 'Stuck in the mud' } },
        currency: [
          { key: 'crown', label: 'crowns', valueInBase: 100 },
          { key: 'heron', label: 'herons', valueInBase: 10 },
          { key: 'bit', label: 'bits', valueInBase: 1 },
        ],
      },
    },
    { id: 'entry-lantern', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'storm-lantern', name: 'Storm lantern', data: { id: 'storm-lantern', name: 'Storm lantern', category: 'gear', weightCoin: 30, value: { heron: 4 } } },
    { id: 'entry-torch', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'reed-torch', name: 'Reed torch', data: { id: 'reed-torch', name: 'Reed torch', category: 'gear', weightCoin: 1, stack: 10, value: { bit: 2 } } },
  );
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, priority: 1 });
  if (torches > 0) {
    world.tables.inventory_lines.push({
      id: 'line-torches',
      campaign_id: campaign,
      actor_id: wren,
      location_id: null,
      library_entry_id: 'entry-torch',
      name: 'Reed torch',
      category: 'gear',
      weight_coin: 1,
      slots: null,
      stack: 10,
      qty: torches,
      container_line_id: null,
      equipped: false,
      how_got: 'found',
      cost: '',
      notes: '',
      item_data: {},
      source_pack_id: 'pack-fen',
      source_entry_id: 'reed-torch',
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
      created_at: '2026-10-23T10:00:00Z',
    });
  }
  // The purse rows are made on the first read; then Wren's holds what the test gives it.
  world.signInAs(gm);
  await world.db.from('purses' as never).select('*');
  world.tables.purses.find((p) => p.actor_id === wren)!.coins = coins;
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

/** Opens Add item and picks the thing by its name. */
async function pick(user: User, search: string, name: RegExp) {
  await user.click(screen.getByRole('button', { name: 'Add item' }));
  await user.type(await screen.findByLabelText('Search items'), search);
  await user.click(screen.getByRole('button', { name }));
}

const purse = () => world.tables.purses.find((p) => p.actor_id === wren)!.coins as Record<string, number>;
const spends = () => world.tables.events.filter((e) => e.type === 'purse.spend');
const toast = () => document.querySelector('.toast') as HTMLElement | null;
/** The toast, once it shows. */
const shownToast = () =>
  waitFor(() => {
    const found = toast();
    if (!found) throw new Error('No toast yet.');
    return found;
  });

describe('Add item, one thing (PK10b)', () => {
  it('asks how Wren gets it with the two-sided switch, and puts the cost, in the setting’s coin words, above Where it goes and the button', async () => {
    await shopWorld();
    const user = await openPack();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.type(await screen.findByLabelText('Search items'), 'lantern');
    // The list's price is in the setting's words too.
    const row = screen.getByRole('button', { name: /Storm lantern/ });
    expect(row.textContent).toContain('4 herons');
    await user.click(row);
    const how = screen.getByRole('group', { name: 'How does Wren get it?' });
    expect(how.classList.contains('button-row--switch')).toBe(true);
    expect(within(how).getAllByRole('button').map((b) => b.textContent)).toEqual(['Bought', 'No cost']);
    const cost = screen.getByLabelText('Cost') as HTMLInputElement;
    expect(cost.value).toBe('4 herons');
    const where = screen.getByRole('radiogroup', { name: 'Where it goes' });
    const add = screen.getByRole('button', { name: 'Add to Wren’s pack' });
    expect(how.compareDocumentPosition(cost) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cost.compareDocumentPosition(where) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cost.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the cost follows how many: three torches at 2 bits each cost 6 bits', async () => {
    await shopWorld();
    const user = await openPack();
    await pick(user, 'torch', /Reed torch/);
    expect((screen.getByLabelText('Cost') as HTMLInputElement).value).toBe('2 bits');
    await user.click(screen.getByRole('button', { name: 'One more' }));
    await user.click(screen.getByRole('button', { name: 'One more' }));
    expect((screen.getByLabelText('Cost') as HTMLInputElement).value).toBe('6 bits');
  });
});

describe('after a purchase (PK10b; tn-1)', () => {
  it('the toast says the cost is not spent yet and offers "Spend 4 herons"; nothing is charged by itself; the old line is gone', async () => {
    await shopWorld();
    const user = await openPack();
    await pick(user, 'lantern', /Storm lantern/);
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(toast()?.querySelector('.toast__text')?.textContent).toBe('Wren added Storm lantern. Its cost, 4 herons, is not spent yet.'));
    expect(within(toast()!).getByRole('button', { name: 'Spend 4 herons' })).toBeTruthy();
    expect(screen.queryByText(/purses arrive later/)).toBeNull();
    expect(world.tables.inventory_lines.map((l) => [l.name, l.how_got, l.cost])).toEqual([['Storm lantern', 'bought', '4 herons']]);
    expect(purse()).toEqual({ crown: 12, heron: 30, bit: 4 });
    expect(spends()).toHaveLength(0);
  });

  it('"Spend 4 herons" opens the Spend sheet with the amount filled in; the coin goes only on its accent', async () => {
    await shopWorld();
    const user = await openPack();
    await pick(user, 'lantern', /Storm lantern/);
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await user.click(within(await shownToast()).getByRole('button', { name: 'Spend 4 herons' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('heading', { name: 'Spend' })).toBeTruthy();
    expect((within(sheet).getByRole('textbox', { name: 'Herons' }) as HTMLInputElement).value).toBe('4');
    expect((within(sheet).getByRole('textbox', { name: 'Crowns' }) as HTMLInputElement).value).toBe('');
    expect(purse()).toEqual({ crown: 12, heron: 30, bit: 4 });
    // What for is the thing's name (⚑ 3, 26 Nov), and the log line says it.
    expect((within(sheet).getByLabelText('What for') as HTMLInputElement).value).toBe('Storm lantern');
    await user.click(within(sheet).getByRole('button', { name: 'Spend 4 herons' }));
    await waitFor(() => expect(purse()).toEqual({ crown: 12, heron: 26, bit: 4 }));
    expect(spends()).toHaveLength(1);
    expect(await screen.findByText('Wren spent 4 herons: Storm lantern')).toBeTruthy();
  });

  it('a cost typed in two of the setting’s coins fills both boxes', async () => {
    await shopWorld();
    const user = await openPack();
    await pick(user, 'lantern', /Storm lantern/);
    const cost = screen.getByLabelText('Cost');
    await user.clear(cost);
    await user.type(cost, '1 crown, 2 herons');
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await user.click(within(await shownToast()).getByRole('button', { name: 'Spend 1 crowns, 2 herons' }));
    const sheet = await screen.findByRole('dialog');
    expect((within(sheet).getByRole('textbox', { name: 'Crowns' }) as HTMLInputElement).value).toBe('1');
    expect((within(sheet).getByRole('textbox', { name: 'Herons' }) as HTMLInputElement).value).toBe('2');
  });

  it('with No cost the toast is the plain one: what was added, no Spend', async () => {
    await shopWorld();
    const user = await openPack();
    await pick(user, 'lantern', /Storm lantern/);
    await user.click(screen.getByRole('button', { name: 'No cost' }));
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(toast()?.querySelector('.toast__text')?.textContent).toBe('Wren added Storm lantern.'));
    expect(within(toast()!).queryByRole('button', { name: /^Spend/ })).toBeNull();
  });

  it('a cost the setting’s coins can’t read is said in the toast, with no Spend', async () => {
    await shopWorld();
    const user = await openPack();
    await pick(user, 'lantern', /Storm lantern/);
    const cost = screen.getByLabelText('Cost');
    await user.clear(cost);
    await user.type(cost, 'a favour owed');
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(toast()?.querySelector('.toast__text')?.textContent).toBe('Wren added Storm lantern. Its cost, a favour owed, is not spent yet.'));
    expect(within(toast()!).queryByRole('button', { name: /^Spend/ })).toBeNull();
  });

  it('added onto a stack already carried: Undo takes the added count back off, with Spend beside it', async () => {
    await shopWorld(undefined, 2);
    const user = await openPack();
    await pick(user, 'torch', /Reed torch/);
    await user.click(screen.getByRole('button', { name: 'One more' }));
    await user.click(screen.getByRole('button', { name: 'One more' }));
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(toast()?.querySelector('.toast__text')?.textContent).toBe('Wren added Reed torch ×3. Its cost, 6 bits, is not spent yet.'));
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-torches')?.qty).toBe(5);
    const buttons = within(toast()!).getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Spend 6 bits', 'Undo']);
    await user.click(within(toast()!).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.id === 'line-torches')?.qty).toBe(2));
    expect(purse()).toEqual({ crown: 12, heron: 30, bit: 4 });
  });

  it('the log’s line for a purchase says what was paid, and no longer says purses arrive later', async () => {
    await shopWorld();
    const user = await openPack();
    await pick(user, 'lantern', /Storm lantern/);
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(world.tables.inventory_lines).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect(await screen.findByText('You bought Storm lantern for Wren (4 herons).')).toBeTruthy();
    expect(screen.queryByText(/purses arrive later/)).toBeNull();
  });

  it('bought straight onto Equipped by a caster it stops: the toast still says casting stopped, with its Undo and Spend', async () => {
    await shopWorld();
    world.tables.library_entries.push(
      {
        id: 'entry-ember-keeper',
        pack_id: 'pack-fen',
        kind: 'class',
        pack_entry_id: 'ember-keeper',
        name: 'Ember Keeper',
        data: { id: 'ember-keeper', name: 'Ember Keeper', armourAllowed: { types: 'any', shields: true }, spellcasting: { castingType: 'divine', blockedBy: { armour: ['heavy'], shields: true }, statusName: "Can't kindle" } },
      },
      { id: 'entry-plate', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'bog-plate', name: 'Bog plate', data: { id: 'bog-plate', name: 'Bog plate', category: 'armour', slot: 'armour', armourType: 'heavy', weightCoin: 500, value: { heron: 9 } } },
    );
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { classes: [{ classRef: 'ember-keeper', level: 1, xp: 0 }] });
    const user = await openPack();
    await pick(user, 'plate', /Bog plate/);
    await user.click(screen.getByRole('radio', { name: /^Worn/ }));
    await user.click(screen.getByRole('button', { name: 'Add and wear it' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ name: 'Bog plate', equipped: true }));
    await waitFor(() => expect(toast()?.querySelector('.toast__text')?.textContent).toBe('Bog plate stops divine casting. Wren added Bog plate. Its cost, 9 herons, is not spent yet.'));
    expect(within(toast()!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Spend 9 herons', 'Undo']);
    await user.click(within(toast()!).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ equipped: false }));
  });
});
