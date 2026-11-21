// @vitest-environment jsdom
// The Pack in the GM's view as the player (page 32, M3g, M3g2; pg32-3, pg32-4; approved 2026-11-21; row C15e of
// plans/test-feedback-2026-11-19.md), on the stand-in database. Invented names and figures.
//   Purpose:
//   1. In the view a cursed item's sheet shows the player's words and no "Hidden from players" group, then the GM's
//      line "Only you see this: …" and "Reveal…" above Give to…; an item with nothing hidden shows neither.
//   2. A blade whose curse is a hidden figure (a magic bonus of −1) carries it in the GM's line, never in the player's
//      words.
//   3. The Pack's list in the view shows nothing the player does not see: a hidden charge count reads as the player's
//      "Charges: ?"; its sheet's GM line gives the count.
//   4. "Reveal…" opens the GM's own item sheet, as built (⚑ 40), where Reveal of a hidden field works and is logged.
//   5. Outside the view (Players › Inventory › Whose pack) the GM's item sheet is unchanged: the "Hidden from players"
//      group, no GM line, no "Reveal…".
//   6. What the GM adds in the view is logged as his.
//   7. The GM's line's words, and a weapon's hidden figures (the pure parts).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { hiddenFigures } from './CarrierItems.tsx';
import { gmLineWords } from './ItemSheet.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let gm: string;
let campaign: string;
let wren: string;

/** An inventory line on Wren, with the stand-in database's defaults. */
function line(name: string, extra: Record<string, unknown> = {}) {
  world.tables.inventory_lines.push({
    id: `line-${name.toLowerCase().replace(/\W+/g, '-')}`,
    campaign_id: campaign,
    actor_id: wren,
    location_id: null,
    library_entry_id: null,
    name,
    category: 'gear',
    weight_coin: null,
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
    created_at: `2026-10-23T10:00:0${world.tables.inventory_lines.length}Z`,
    ...extra,
  });
}

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  campaign = world.addCampaign('The Reed Marches', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode: 'coin' } } });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown> = {}) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  // Invented rules: wands' charges hidden from their holders.
  entry('rulesSet', 'fen-rules', 'Fen rules', { magicItems: { charges: { wand: '2d10', hidden: true, rechargeable: false } } });
  entry('item', 'rope', 'Coil of rope', { category: 'gear', weightCoin: 50 });
  // A ring whose curse only the GM reads (a hidden field).
  entry('item', 'moon-ring', 'Moon ring', { category: 'ring', description: 'A plain band of old bronze.', fields: { Curse: 'Cold at the full moon' }, gmOnly: ['fields'] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  line('Moon ring', { library_entry_id: 'entry-moon-ring', source_pack_id: 'pack-fen', source_entry_id: 'moon-ring', category: 'ring', item_data: { id: 'moon-ring', name: 'Moon ring', category: 'ring', description: 'A plain band of old bronze.' } });
  line('Coil of rope', { library_entry_id: 'entry-rope', source_pack_id: 'pack-fen', source_entry_id: 'rope' });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type User = ReturnType<typeof userEvent.setup>;

/** The GM opens Wren's Pack from the Players row: the view, on its Pack tab. */
async function openWrensPack(): Promise<User> {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Reed Marches/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  await user.click(await screen.findByRole('button', { name: "Open Wren's pack" }));
  await waitFor(() => expect(screen.getByRole('note').getAttribute('aria-label')).toBe('Sam’s view of Wren. What you do here is logged as yours.'));
  return user;
}

const actions = () => within(screen.getByRole('group', { name: 'Item actions' }));

describe("the Pack in the GM's view (C15e; M3g, M3g2)", () => {
  it("a cursed item's sheet is the player's, plus the GM's line and Reveal… above Give to…; a plain item shows neither", async () => {
    const user = await openWrensPack();
    await user.click(await screen.findByRole('button', { name: /^Moon ring/ }));
    const sheet = within(screen.getByRole('region', { name: 'Moon ring' }));
    expect(sheet.getByText('A plain band of old bronze.')).toBeTruthy();
    expect(sheet.getByText('Only you see this: Curse: Cold at the full moon.')).toBeTruthy();
    // No GM tool on the player's sheet: the hidden group sits behind Reveal….
    expect(sheet.queryByRole('group', { name: 'Hidden from players' })).toBeNull();
    const rows = actions()
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(rows.indexOf('Reveal…')).toBeGreaterThanOrEqual(0);
    expect(rows.indexOf('Reveal…')).toBeLessThan(rows.indexOf('Give to…'));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: /^Coil of rope/ }));
    const rope = within(screen.getByRole('region', { name: 'Coil of rope' }));
    expect(rope.queryByText(/Only you see this/)).toBeNull();
    expect(rope.queryByRole('button', { name: 'Reveal…' })).toBeNull();
  });

  it('a hidden figure (a curse of −1) is in the GM line only', async () => {
    line('Old bronze sword', { category: 'weapon', item_data: { category: 'weapon', weapon: { damage: '1d8', magicBonus: -1 } } });
    const user = await openWrensPack();
    await user.click(await screen.findByRole('button', { name: /^Old bronze sword/ }));
    const sheet = within(screen.getByRole('region', { name: 'Old bronze sword' }));
    expect(sheet.getByText('Only you see this: Old bronze sword, magic −1.')).toBeTruthy();
    expect(sheet.queryByText(/hidden from the player/)).toBeNull();
  });

  it("the list shows the player's \"Charges: ?\" for a hidden count; the sheet's GM line gives the count", async () => {
    line('Murky wand', { category: 'wand', charges_hidden: true, charges_used: 1 });
    world.tables.inventory_line_secrets.push({ id: 'line-murky-wand', campaign_id: campaign, charges_total: 4, spent: false });
    const user = await openWrensPack();
    const row = await screen.findByRole('button', { name: /^Murky wand/ });
    expect(row.textContent).toContain('Charges: ?');
    expect(row.textContent).not.toMatch(/hidden|left/);
    await user.click(row);
    const sheet = within(screen.getByRole('region', { name: 'Murky wand' }));
    expect(sheet.getByText('Only you see this: Charges: 3 left.')).toBeTruthy();
    // The GM's Recharge and Reveal the count sit on his own sheet, behind Reveal….
    expect(sheet.queryByRole('button', { name: 'Reveal the count' })).toBeNull();
    expect(sheet.queryByRole('button', { name: /^Recharge/ })).toBeNull();
  });

  it("Reveal… opens the GM's own sheet for the item, where Reveal of a hidden field works and is logged", async () => {
    const user = await openWrensPack();
    await user.click(await screen.findByRole('button', { name: /^Moon ring/ }));
    await user.click(screen.getByRole('button', { name: 'Reveal…' }));
    const hidden = within(await screen.findByRole('group', { name: 'Hidden from players' }));
    expect(hidden.getByText('Cold at the full moon')).toBeTruthy();
    await user.click(hidden.getByRole('button', { name: /^Reveal/ }));
    await waitFor(() => expect(world.tables.inventory_lines[0]!.item_data).toMatchObject({ fields: { Curse: 'Cold at the full moon' } }));
    expect(world.tables.events.filter((e) => e.type === 'inventory.reveal').map((e) => e.actor_user_id)).toEqual([gm]);
  });

  it("outside the view the GM's item sheet is as built: the hidden group, no GM line, no Reveal…", async () => {
    world.signInAs(gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Reed Marches/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    await user.click(await screen.findByRole('button', { name: 'Inventory' }));
    await user.click(within(await screen.findByRole('group', { name: 'Whose pack' })).getByRole('button', { name: 'Wren' }));
    await user.click(await screen.findByRole('button', { name: /^Moon ring/ }));
    expect(screen.getByRole('group', { name: 'Hidden from players' })).toBeTruthy();
    expect(screen.queryByText(/Only you see this/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reveal…' })).toBeNull();
  });

  it('what the GM adds in the view is logged as his', async () => {
    const user = await openWrensPack();
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    await user.type(await screen.findByLabelText('Search items'), 'rope');
    await user.click(screen.getByRole('button', { name: /^Coil of rope/ }));
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(world.tables.inventory_lines.filter((l) => l.name === 'Coil of rope')).toHaveLength(2));
    expect(world.tables.events.filter((e) => e.type === 'inventory.add').map((e) => e.actor_user_id)).toEqual([gm]);
  });
});

describe("the GM's line's words (pure)", () => {
  it('joins the hidden fields, the hidden count and the hidden figures; null when nothing is hidden', () => {
    expect(gmLineWords([], null, [])).toBeNull();
    expect(gmLineWords([{ label: 'Fields', lines: [{ label: 'Curse', value: 'Cold at the full moon.' }] }, { label: 'Cursed', value: 'Yes' }], { total: 5, spent: false, used: 2 }, ['Old bronze sword, magic −1'])).toBe(
      'Only you see this: Curse: Cold at the full moon; Cursed: Yes; Charges: 3 left; Old bronze sword, magic −1.',
    );
    expect(gmLineWords([], { total: null, spent: false, used: 0 }, [])).toBe('Only you see this: Charges: not set.');
    expect(gmLineWords([], { total: 2, spent: true, used: 2 }, [])).toBe('Only you see this: Charges: spent.');
  });

  it("a weapon's hidden figures are its parts and notes marked hidden, in the GM's words", () => {
    expect(
      hiddenFigures({
        parts: [
          { label: 'Fenblade, magic (hidden from the player)', value: -1 },
          { label: 'Reed arrows, magic', value: 1 },
        ],
        hitNotes: ['+2 vs bog lurkers (hidden from the player)', '+1 vs reeds'],
        damageNotes: [],
      }),
    ).toEqual(['Fenblade, magic −1', '+2 vs bog lurkers']);
  });
});
