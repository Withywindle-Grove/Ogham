// @vitest-environment jsdom
// The Pack in the GM's view as the player (page 32, M3g, M3g2; pg32-3, pg32-4; approved 2026-11-21; row C15e of
// plans/test-feedback-2026-11-19.md), on the stand-in database. Invented names and figures.
//   Purpose:
//   1. In the view a cursed item's sheet shows the player's words and no "Hidden from players" group, then the GM's
//      line "Only you see this: …" and "Reveal…" above Give to…; an item with nothing hidden shows neither.
//   2. A blade whose only hidden thing is its figure (a magic bonus of −1) carries it in the GM's line, "the true figure
//      is …", with no "Reveal…" (nothing on the GM's sheet to reveal); the player's own figure in the view leaves out the
//      −1: the sheet's words, the GM's line aside, are Sam's own sheet's.
//   3. A cursed blade (its curse a hidden field) reads as M3g2 does: "Only you see this: the true figure is d20 −1,
//      cursed.", with "Reveal…".
//   4. The Pack's list in the view shows nothing the player does not see: a hidden charge count reads as the player's
//      "Charges: ?"; its sheet's GM line gives the count.
//   5. "Reveal…" opens the GM's own item sheet, as built (⚑ 40), where Reveal of a hidden field works and is logged.
//   6. Outside the view (Players › Inventory › Whose pack) the GM's item sheet is unchanged: the "Hidden from players"
//      group, no GM line, no "Reveal…".
//   7. What the GM adds in the view is logged as his, and no charges prompt follows it there (it does outside).
//   8. In armour mode the view's Pack has no treasure switch; the GM's own pack keeps it.
//   9. The GM's line's words, and a weapon's hidden figures (the pure parts).
//  10. (Audit fix 6) The GM's line names only what is really hidden from the player: a −1 the player's own copy of the
//      sword already shows ("Magic bonus -1") is no secret, so a sword whose only secret it was has no GM line, and a
//      cursed one whose −1 Sam's copy shows names the curse alone.
//  11. (Audit fix 7) The GM's line sits under the item's figures, after its details, as M3g2 draws it.
//  12. (Audit fix 5) "Reveal…" opens the GM's own sheet under its own title, "Your sheet: Moon ring", so the one in front
//      is plain; its ✕ closes that one alone, and the player's sheet stays open under it.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { hiddenFigures } from './CarrierItems.tsx';
import { gmLineWords } from './ItemSheet.tsx';
import { HIDDEN_FROM_PLAYER, type AttackRoll } from '../modules/characters/play.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let gm: string;
let sam: string;
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
  sam = world.addPerson('sam@lantern.example', 'Sam');
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
    expect(sheet.getByText('Only you see this: Cold at the full moon.')).toBeTruthy();
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

  it.fails("a −1 that Sam's own copy shows is no secret: no GM line, no Reveal…; the sheet is exactly Sam's own", async () => {
    line('Old bronze sword', { category: 'weapon', item_data: { category: 'weapon', weapon: { damage: '1d8', magicBonus: -1 } } });
    const user = await openWrensPack();
    await user.click(await screen.findByRole('button', { name: /^Old bronze sword/ }));
    const region = screen.getByRole('region', { name: 'Old bronze sword' });
    const sheet = within(region);
    expect(sheet.getByText(/Magic bonus/)).toBeTruthy();
    expect(sheet.queryByText(/Only you see this/)).toBeNull();
    expect(sheet.queryByRole('button', { name: 'Reveal…' })).toBeNull();
    // The player's words: everything on the sheet but the GM's line. No GM figure joins them (no "the true figure", no
    // hidden part); what they show of the item's own copy is Sam's (the scope check on #34: the copy's raw bonus).
    const playersWords = (el: HTMLElement) => {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.querySelector('.gm-line')?.remove();
      return copy.textContent ?? '';
    };
    const inView = playersWords(region);
    expect(inView).not.toMatch(/true figure|hidden from the player|Only you see this/);
    // Sam's own sheet for the same sword reads exactly the same.
    cleanup();
    world.signInAs(sam);
    const samUser = userEvent.setup();
    render(<Root db={world.db} />);
    await samUser.click(await screen.findByRole('button', { name: /The Reed Marches/ }));
    await samUser.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    await samUser.click(await screen.findByRole('button', { name: /^Old bronze sword/ }));
    expect(playersWords(screen.getByRole('region', { name: 'Old bronze sword' }))).toBe(inView);
  });

  it.fails('a cursed blade whose −1 Sam\'s copy shows names the curse alone: "Only you see this: cursed.", with Reveal…', async () => {
    world.tables.library_entries.push({
      id: 'entry-bronze-sword',
      pack_id: 'pack-fen',
      kind: 'item',
      pack_entry_id: 'bronze-sword',
      name: 'Old bronze sword',
      data: { id: 'bronze-sword', name: 'Old bronze sword', category: 'weapon', weapon: { damage: '1d8', magicBonus: -1 }, cursed: true, gmOnly: ['cursed'] },
    });
    line('Old bronze sword', {
      category: 'weapon',
      library_entry_id: 'entry-bronze-sword',
      source_pack_id: 'pack-fen',
      source_entry_id: 'bronze-sword',
      item_data: { id: 'bronze-sword', name: 'Old bronze sword', category: 'weapon', weapon: { damage: '1d8', magicBonus: -1 } },
    });
    const user = await openWrensPack();
    await user.click(await screen.findByRole('button', { name: /^Old bronze sword/ }));
    const sheet = within(screen.getByRole('region', { name: 'Old bronze sword' }));
    // Some of it shown (the −1, in Sam's copy), some hidden (the curse): the line names only the hidden part.
    expect(sheet.getByText(/Magic bonus/)).toBeTruthy();
    expect(sheet.getByText('Only you see this: cursed.')).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Reveal…' })).toBeTruthy();
  });

  it.fails("puts the GM's line under the item's figures, after its details (M3g2)", async () => {
    const user = await openWrensPack();
    await user.click(await screen.findByRole('button', { name: /^Moon ring/ }));
    const region = screen.getByRole('region', { name: 'Moon ring' });
    const gmLine = region.querySelector('.gm-line') as HTMLElement;
    const details = region.querySelector('dl') as HTMLElement;
    expect(gmLine).toBeTruthy();
    expect(details).toBeTruthy();
    expect(details.compareDocumentPosition(gmLine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    expect(sheet.getByText('Only you see this: 3 charges left.')).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Reveal…' })).toBeTruthy();
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

  it.fails("Reveal… opens the GM's own sheet as \"Your sheet: Moon ring\"; its ✕ closes it alone", async () => {
    const user = await openWrensPack();
    await user.click(await screen.findByRole('button', { name: /^Moon ring/ }));
    await user.click(screen.getByRole('button', { name: 'Reveal…' }));
    const own = await screen.findByRole('dialog', { name: 'Your sheet: Moon ring' });
    expect(within(own).getByRole('group', { name: 'Hidden from players' })).toBeTruthy();
    await user.click(within(own).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Your sheet: Moon ring' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Moon ring' })).toBeTruthy();
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

  it('what the GM adds in the view is logged as his, and no charges prompt follows it there', async () => {
    world.tables.library_entries.push({ id: 'entry-reed-wand', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'reed-wand', name: 'Reed wand', data: { id: 'reed-wand', name: 'Reed wand', category: 'wand', weightCoin: 1 } });
    const user = await openWrensPack();
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    await user.type(await screen.findByLabelText('Search items'), 'reed');
    await user.click(screen.getByRole('button', { name: /^Reed wand/ }));
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(world.tables.inventory_lines.filter((l) => l.name === 'Reed wand')).toHaveLength(1));
    expect(world.tables.events.filter((e) => e.type === 'inventory.add').map((e) => e.actor_user_id)).toEqual([gm]);
    await screen.findByRole('button', { name: /^Reed wand/ });
    expect(screen.queryByRole('dialog', { name: 'Charges of Reed wand' })).toBeNull();
  });

  it("in armour mode the view's Pack has no treasure switch; the GM's own pack keeps it", async () => {
    Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode: 'armour' } } });
    const rules = world.tables.library_entries.find((e) => e.id === 'entry-fen-rules')!;
    rules.data = { ...(rules.data as object), encumbrance: { mode: 'armour', armour: { maxLoadCoin: 500, movement: [{ armour: 'none', withoutTreasure: '100 ft', withTreasure: '70 ft' }] } } };
    const user = await openWrensPack();
    await screen.findByText(/carrying treasure/i);
    expect(screen.queryByRole('button', { name: /^Switch (on|off)$/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: '‹ Players' }));
    await user.click(await screen.findByRole('button', { name: 'Inventory' }));
    await user.click(within(await screen.findByRole('group', { name: 'Whose pack' })).getByRole('button', { name: 'Wren' }));
    expect(await screen.findByRole('button', { name: /^Switch (on|off)$/ })).toBeTruthy();
  });
});

describe("the GM's line's words (pure)", () => {
  it("follows M3g2's form: the true figure first, then the hidden values, then the count; null when nothing is hidden", () => {
    expect(gmLineWords([], null, [])).toBeNull();
    expect(gmLineWords([{ label: 'Cursed', value: 'Yes' }], null, ['the true figure is d20 −1'])).toBe('Only you see this: the true figure is d20 −1, cursed.');
    // M3g's form: the values, a yes-or-no field by its name, a "no" left out.
    expect(gmLineWords([{ label: 'True name', value: 'Ring of the Drowned Bell' }, { label: 'Fields', lines: [{ label: 'Saves', value: '+1 to saves.' }] }, { label: 'Cursed', value: 'Yes' }, { label: 'Magic', value: 'No' }], null, [])).toBe(
      'Only you see this: Ring of the Drowned Bell, +1 to saves, cursed.',
    );
    expect(gmLineWords([], { total: 5, spent: false, used: 2 }, [])).toBe('Only you see this: 3 charges left.');
    expect(gmLineWords([], { total: 2, spent: false, used: 1 }, [])).toBe('Only you see this: 1 charge left.');
    expect(gmLineWords([], { total: null, spent: false, used: 0 }, [])).toBe('Only you see this: charges not set.');
    expect(gmLineWords([], { total: 2, spent: true, used: 2 }, [])).toBe('Only you see this: spent.');
  });

  it("a weapon's hidden figure is its true to-hit roll, then each hidden note; without rolls, what the hidden parts add", () => {
    const magic = {
      parts: [
        { label: `Fenblade, magic${HIDDEN_FROM_PLAYER}`, value: -1 },
        { label: 'Reed arrows, magic', value: 1 },
      ],
      hitNotes: [`+2 vs bog lurkers${HIDDEN_FROM_PLAYER}`, '+1 vs reeds'],
      damageNotes: [],
    };
    const hit = { roll: 'hit', dice: '1d20', line: 'To hit', adds: -1, which: null, againstTarget: false, lineNote: null } as unknown as AttackRoll;
    expect(hiddenFigures(magic, () => [hit])).toEqual(['the true figure is d20 −1', '+2 vs bog lurkers']);
    expect(hiddenFigures(magic, () => [])).toEqual(['the true figure adds −1', '+2 vs bog lurkers']);
    // Nothing of the figure hidden: only the hidden notes, and the rolls are never worked out.
    expect(hiddenFigures({ parts: [{ label: 'Reed arrows, magic', value: 1 }], hitNotes: [], damageNotes: [] }, () => { throw new Error('not asked'); })).toEqual([]);
  });
});
