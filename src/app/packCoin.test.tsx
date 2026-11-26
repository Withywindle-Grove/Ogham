// @vitest-environment jsdom
// The coin line and the coin's sheets on the Pack tab (K9, K10; December step 6, piece c; pu-1 to pu-6, pu-8; mockup
// pack/07 PC1 to PC5, approved 2026-11-13). Invented coins and names only (hard rule 2). Purposes:
//   1. The coin line sits under the load and above the lists: the amounts in the setting's own coin names, in its
//      order, a coin at none left out, and no line under it.
//   2. With nothing in the purse the line reads "No coin" and still opens the sheet.
//   3. The coin's sheet is "Wren's coin": every coin the setting names (a 0 shown as 0), then Spend… and Give to…,
//      with no sentence under them.
//   4. Spend names the amount on its one accent; spent, the sheet shuts, the line shows the new amount, and the toast
//      says it in the log line's words, with Undo putting the coin back.
//   5. More than she has is refused under that coin's row with the warning sign, nothing spent, the button still a
//      button; nothing typed is refused with "Say how many: a whole number, 1 or more."
//   6. Give to lists the stash, then the people by name only (no one's coin); the accent names the receiver and the
//      amount ("Give Moss 5 herons"; "Put in 10 herons" to the stash); the toast says it, and Undo takes it back.
//   7. Hidden means hidden: another player's Pack shows only their own coin, and a player's Pack never asks the
//      database for a purse that isn't its own player's (and the database sends a player no other living purse).
//  10. The GM, on a character's Pack (K15, PC7 and PC8), sees that character's coin line in the same place; its sheet
//      offers "Give coin…" and "Take coin…" in place of Spend… and Give to….
//  11. The GM gives coin ("Give Wren 40 herons"), and takes it ("Take 10 herons"), each with one accent, a toast in
//      the log line's words, a log line, and Undo putting the purse back; more than she has is refused under the row.
//   8. Coin weighs nothing: the load's figure is the same with a purse full of coin.
//   9. The sheets draw no "›", " · " or "▲", and no button in them is disabled.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { watchMarks } from '../testing/markScan.ts';
import { ICON_SET } from '../ui/iconSet.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let campaign = '';
let gm = '';
let sam = '';
let tess = '';
let wren = '';
let moss = '';
type User = ReturnType<typeof userEvent.setup>;
let marks: ReturnType<typeof watchMarks> | null = null;

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  localStorage.removeItem('grimoire.packOpen');
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  marks = watchMarks('section.pack, [role="dialog"], .toast');
});

afterEach(() => {
  marks?.stop();
  cleanup();
  vi.restoreAllMocks();
});

/** Wren (Sam's) and Moss (Tess's) in a campaign whose invented rules name three coins; each purse holds `coins`. */
async function coinWorld(coins: { wren?: Record<string, number>; moss?: Record<string, number>; stash?: Record<string, number> } = {}) {
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  tess = world.addPerson('tess@lantern.example', 'Tess');
  campaign = world.addCampaign('The Ash Barrows', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  moss = world.addCharacter(campaign, 'Moss', { ownerId: tess });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, tess, 'player', moss);
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
      encumbrance: { mode: 'coin', coin: { maxLoadCoin: 1200, tiers: [{ label: 'Light', max: 400, movement: '125' }, { label: 'Laden', max: 1200, movement: '60' }], overMax: 'Stuck in the mud' } },
      currency: [
        { key: 'crown', label: 'crowns', valueInBase: 100 },
        { key: 'heron', label: 'herons', valueInBase: 10 },
        { key: 'bit', label: 'bits', valueInBase: 1 },
      ],
    },
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, priority: 1 });
  world.tables.inventory_lines.push({
    id: 'line-coil',
    campaign_id: campaign,
    actor_id: wren,
    location_id: null,
    library_entry_id: null,
    name: 'Coil of reed rope',
    category: 'gear',
    weight_coin: 50,
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
    created_at: '2026-10-23T10:00:00Z',
  });
  // The purse rows are made on the first read; then each holds what the test gives it.
  world.signInAs(gm);
  await world.db.from('purses' as never).select('*');
  world.tables.purses.find((p) => p.actor_id === wren)!.coins = coins.wren ?? {};
  world.tables.purses.find((p) => p.actor_id === moss)!.coins = coins.moss ?? {};
  world.tables.purses.find((p) => p.location_id !== null)!.coins = coins.stash ?? {};
  world.signInAs(sam);
}

async function openPack(name = 'Wren'): Promise<User> {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
  // A name ending in "s" takes the mark alone ("Moss’ pack"; Home One audit of #50 round 3, finding 1).
  expect(await screen.findByRole('heading', { name: /s$/.test(name) ? `${name}’ pack` : `${name}’s pack` })).toBeTruthy();
  return user;
}

const coinRow = () => screen.findByRole('button', { name: /^Coin: / });
const purseOf = (actorId: string) => world.tables.purses.find((p) => p.actor_id === actorId)!.coins as Record<string, number>;
const sheet = () => screen.getByRole('dialog');

describe('the coin line (K9)', () => {
  it('sits under the load and above the lists, in the setting’s coin names and order, a coin at none left out, no line under it', async () => {
    await coinWorld({ wren: { bit: 4, crown: 12 } });
    await openPack();
    const line = await coinRow();
    expect(line.textContent).toBe('12 crowns, 4 bits');
    expect(line.getAttribute('aria-label')).toBe('Coin: 12 crowns, 4 bits');
    const pack = screen.getByRole('region', { name: 'Wren’s pack' });
    const load = pack.querySelector('.pack__load')!;
    const firstGroup = pack.querySelector('.pack__list')!;
    expect(load.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Nothing under it: the next thing after the line is not a sentence about coin.
    expect(line.parentElement!.textContent).toBe('12 crowns, 4 bits');
    // In the book's type, as creation is.
    expect(line.closest('.book-type')).toBeTruthy();
  });

  it('reads "No coin" with nothing in the purse, and still opens the sheet', async () => {
    await coinWorld();
    const user = await openPack();
    const line = await coinRow();
    expect(line.textContent).toBe('No coin');
    await user.click(line);
    expect(within(sheet()).getByRole('heading', { name: 'Wren’s coin' })).toBeTruthy();
  });
});

describe('the coin’s sheet (K10)', () => {
  it('is "Wren’s coin": every coin the setting names, a 0 shown as 0, then Spend… and Give to… with no sentence under them', async () => {
    await coinWorld({ wren: { crown: 12, bit: 4 } });
    const user = await openPack();
    await user.click(await coinRow());
    const lines = [...sheet().querySelectorAll('.book-line')].map((l) => l.textContent);
    expect(lines).toEqual(['Crowns 12', 'Herons 0', 'Bits 4']);
    const rows = [...sheet().querySelectorAll('.list-row')].map((r) => r.textContent);
    expect(rows).toEqual(['Spend…', 'Give to…']);
    expect(sheet().querySelector('.list-row__sub')).toBeNull();
    // No accent: the sheet only leads on.
    expect(sheet().querySelector('.button-primary')).toBeNull();
  });

  it('Spend names the amount; spent, the sheet shuts, the line shows the new amount, the toast says the log line, and Undo puts it back', async () => {
    await coinWorld({ wren: { crown: 12, heron: 30, bit: 4 } });
    const user = await openPack();
    await user.click(await coinRow());
    await user.click(within(sheet()).getByRole('button', { name: 'Spend…' }));
    expect(within(sheet()).getByRole('heading', { name: 'Spend' })).toBeTruthy();
    expect(within(sheet()).getByRole('button', { name: '‹ Wren’s coin' })).toBeTruthy();
    expect(within(sheet()).getByText('Wren has 30.')).toBeTruthy();
    await user.type(within(sheet()).getByRole('textbox', { name: 'Herons' }), '2');
    await user.type(within(sheet()).getByRole('textbox', { name: 'What for' }), 'a room at the Eel and Lantern');
    // Stacked: the set's coin icon over the words (ic-1; the lead, 2026-11-14).
    const spend = within(sheet()).getByRole('button', { name: 'Spend 2 herons' });
    expect(spend.classList.contains('stacked-button')).toBe(true);
    expect(spend.querySelector('svg')).toBeTruthy();
    await user.click(spend);
    expect(await screen.findByText('Wren spent 2 herons: a room at the Eel and Lantern')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(async () => expect((await coinRow()).textContent).toBe('12 crowns, 28 herons, 4 bits'));
    expect(purseOf(wren)).toEqual({ crown: 12, heron: 28, bit: 4 });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(purseOf(wren)).toEqual({ crown: 12, heron: 30, bit: 4 }));
    await waitFor(async () => expect((await coinRow()).textContent).toBe('12 crowns, 30 herons, 4 bits'));
  });

  it('Spend with nothing said for what: the toast is "Wren spent 2 herons"; two coins at once are named in the setting’s order', async () => {
    await coinWorld({ wren: { crown: 12, heron: 30 } });
    const user = await openPack();
    await user.click(await coinRow());
    await user.click(within(sheet()).getByRole('button', { name: 'Spend…' }));
    await user.type(within(sheet()).getByRole('textbox', { name: 'Herons' }), '2');
    await user.type(within(sheet()).getByRole('textbox', { name: 'Crowns' }), '1');
    await user.click(within(sheet()).getByRole('button', { name: 'Spend 1 crowns, 2 herons' }));
    expect(await screen.findByText('Wren spent 1 crowns, 2 herons')).toBeTruthy();
  });

  it('refuses more than she has under that coin’s row, with the warning sign, the button still a button, nothing spent', async () => {
    await coinWorld({ wren: { heron: 30 } });
    const user = await openPack();
    await user.click(await coinRow());
    await user.click(within(sheet()).getByRole('button', { name: 'Spend…' }));
    await user.type(within(sheet()).getByRole('textbox', { name: 'Herons' }), '45');
    const button = within(sheet()).getByRole('button', { name: 'Spend 45 herons' });
    await user.click(button);
    const refusal = within(sheet()).getByRole('alert');
    expect(refusal.textContent).toBe('Wren has 30 herons.');
    expect(refusal.querySelector('.warning-sign')).toBeTruthy();
    // Under the herons row: the row holding the box comes just before it.
    expect(refusal.previousElementSibling!.querySelector('input')!.getAttribute('aria-label') ?? refusal.previousElementSibling!.textContent).toMatch(/Herons/);
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(purseOf(wren)).toEqual({ heron: 30 });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('refuses nothing typed: "Say how many: a whole number, 1 or more."', async () => {
    await coinWorld({ wren: { heron: 30 } });
    const user = await openPack();
    await user.click(await coinRow());
    await user.click(within(sheet()).getByRole('button', { name: 'Spend…' }));
    await user.click(within(sheet()).getByRole('button', { name: 'Spend' }));
    expect(within(sheet()).getByRole('alert').textContent).toBe('Say how many: a whole number, 1 or more.');
    await user.type(within(sheet()).getByRole('textbox', { name: 'Herons' }), '2.5');
    await user.click(within(sheet()).getByRole('button', { name: 'Spend' }));
    expect(within(sheet()).getByRole('alert').textContent).toBe('Say how many: a whole number, 1 or more.');
    expect(purseOf(wren)).toEqual({ heron: 30 });
  });

  it('Give to lists the stash then the people by name only; "Give Moss 5 herons"; the toast says it; Undo takes it back', async () => {
    await coinWorld({ wren: { heron: 30 }, moss: { crown: 7 } });
    const user = await openPack();
    await user.click(await coinRow());
    await user.click(within(sheet()).getByRole('button', { name: 'Give to…' }));
    expect(within(sheet()).getByRole('heading', { name: 'Give to' })).toBeTruthy();
    const choices = within(sheet()).getAllByRole('radio').map((r) => r.textContent);
    expect(choices).toEqual(['Party stash', 'Moss']);
    // Nothing of Moss's coin is shown.
    expect(sheet().textContent).not.toMatch(/7|crowns?\s*7/);
    await user.type(within(sheet()).getByRole('textbox', { name: 'Herons' }), '5');
    await user.click(within(sheet()).getByRole('radio', { name: 'Moss' }));
    await user.click(within(sheet()).getByRole('button', { name: 'Give Moss 5 herons' }));
    expect(await screen.findByText('Wren gave Moss 5 herons')).toBeTruthy();
    expect(purseOf(wren)).toEqual({ heron: 25 });
    expect(purseOf(moss)).toEqual({ crown: 7, heron: 5 });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(purseOf(moss)).toEqual({ crown: 7 }));
    expect(purseOf(wren)).toEqual({ heron: 30 });
  });

  it('to the stash the accent is "Put in 10 herons" and the toast "Wren put 10 herons in the stash"', async () => {
    await coinWorld({ wren: { heron: 30 } });
    const user = await openPack();
    await user.click(await coinRow());
    await user.click(within(sheet()).getByRole('button', { name: 'Give to…' }));
    await user.type(within(sheet()).getByRole('textbox', { name: 'Herons' }), '10');
    await user.click(within(sheet()).getByRole('radio', { name: 'Party stash' }));
    await user.click(within(sheet()).getByRole('button', { name: 'Put in 10 herons' }));
    expect(await screen.findByText('Wren put 10 herons in the stash')).toBeTruthy();
    expect(world.tables.purses.find((p) => p.location_id !== null)!.coins).toEqual({ heron: 10 });
  });

  it('the way back returns to the coin’s sheet, and the sheets draw no forbidden mark and no disabled button', async () => {
    await coinWorld({ wren: { heron: 30 } });
    const user = await openPack();
    await user.click(await coinRow());
    await user.click(within(sheet()).getByRole('button', { name: 'Give to…' }));
    expect(sheet().querySelector('button[disabled]')).toBeNull();
    await user.click(within(sheet()).getByRole('button', { name: '‹ Wren’s coin' }));
    expect(within(sheet()).getByRole('heading', { name: 'Wren’s coin' })).toBeTruthy();
    await user.click(within(sheet()).getByRole('button', { name: 'Spend…' }));
    expect(sheet().querySelector('button[disabled]')).toBeNull();
    // "‹" is the back link's own mark (fl-1); the standard forbids "›", " · " and "▲".
    expect([...marks!.found]).toEqual([]);
  });
});

/** The GM opens Wren's pack from the Players page (the "Pack" button on her row). */
async function openAsGm(): Promise<User> {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  await user.click(await screen.findByRole('button', { name: "Open Wren's pack" }));
  expect(await screen.findByRole('region', { name: 'Wren’s pack' })).toBeTruthy();
  return user;
}

/** The newest log line's type, and how many purse lines there are. */
const purseEvents = () => world.tables.events.filter((e) => String(e.type).startsWith('purse.'));

describe('the GM’s coin on a character’s Pack (K15)', () => {
  it('shows the character’s coin line in the same place, and the sheet offers Give coin… and Take coin…', async () => {
    await coinWorld({ wren: { crown: 12, heron: 30 } });
    const user = await openAsGm();
    const line = await coinRow();
    expect(line.textContent).toBe('12 crowns, 30 herons');
    const pack = screen.getByRole('region', { name: 'Wren’s pack' });
    expect(pack.querySelector('.pack__load')!.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(line);
    expect(within(sheet()).getByRole('heading', { name: 'Wren’s coin' })).toBeTruthy();
    expect([...sheet().querySelectorAll('.book-line')].map((l) => l.textContent)).toEqual(['Crowns 12', 'Herons 30', 'Bits 0']);
    expect([...sheet().querySelectorAll('.list-row')].map((r) => r.textContent)).toEqual(['Give coin…', 'Take coin…']);
    expect(sheet().querySelector('.button-primary')).toBeNull();
  });

  it('gives: "Give Wren 40 herons", one accent, the toast in the log line’s words, a log line, and Undo takes it back', async () => {
    await coinWorld({ wren: { heron: 30 } });
    const user = await openAsGm();
    await user.click(await coinRow());
    await user.click(within(sheet()).getByRole('button', { name: 'Give coin…' }));
    expect(within(sheet()).getByRole('heading', { name: 'Give coin' })).toBeTruthy();
    expect(within(sheet()).getByRole('button', { name: '‹ Wren’s coin' })).toBeTruthy();
    expect(within(sheet()).getByText('Wren has 30.')).toBeTruthy();
    // No list of receivers: the GM gives to the character whose pack this is.
    expect(within(sheet()).queryAllByRole('radio')).toEqual([]);
    await user.type(within(sheet()).getByRole('textbox', { name: 'Herons' }), '40');
    const give = within(sheet()).getByRole('button', { name: 'Give Wren 40 herons' });
    expect(sheet().querySelectorAll('.button-primary')).toHaveLength(1);
    expect(give.classList.contains('stacked-button')).toBe(true);
    // Coins into a hand, Delapouite's receive-money (Francis, 2026-11-18); the player's Give to… keeps the open hand.
    expect(give.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['receive-money'].d);
    await user.click(give);
    expect(await screen.findByText('Your GM gave Wren 40 herons')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(purseOf(wren)).toEqual({ heron: 70 });
    await waitFor(async () => expect((await coinRow()).textContent).toBe('70 herons'));
    expect(purseEvents().map((e) => e.type)).toEqual(['purse.add']);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(purseOf(wren)).toEqual({ heron: 30 }));
    await waitFor(async () => expect((await coinRow()).textContent).toBe('30 herons'));
  });

  it('takes: "Take 10 herons", the toast "Your GM took 10 herons from Wren", a log line, and Undo puts it back', async () => {
    await coinWorld({ wren: { heron: 30 } });
    const user = await openAsGm();
    await user.click(await coinRow());
    await user.click(within(sheet()).getByRole('button', { name: 'Take coin…' }));
    expect(within(sheet()).getByRole('heading', { name: 'Take coin' })).toBeTruthy();
    await user.type(within(sheet()).getByRole('textbox', { name: 'Herons' }), '10');
    expect(sheet().querySelectorAll('.button-primary')).toHaveLength(1);
    // A grabbing hand, Lorc's grab (Francis, 2026-11-18), not Spend's coins.
    const take = within(sheet()).getByRole('button', { name: 'Take 10 herons' });
    expect(take.querySelector('path')!.getAttribute('d')).toBe(ICON_SET.grab.d);
    await user.click(take);
    expect(await screen.findByText('Your GM took 10 herons from Wren')).toBeTruthy();
    expect(purseOf(wren)).toEqual({ heron: 20 });
    // Out of play: no other purse gains it.
    expect(world.tables.purses.filter((p) => p.actor_id !== wren).every((p) => Object.keys(p.coins as object).length === 0)).toBe(true);
    expect(purseEvents().map((e) => e.type)).toEqual(['purse.remove']);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(purseOf(wren)).toEqual({ heron: 30 }));
  });

  it('refuses taking more than she has under the row, "Wren has 30 herons.", the button still a button, nothing taken', async () => {
    await coinWorld({ wren: { heron: 30 } });
    const user = await openAsGm();
    await user.click(await coinRow());
    await user.click(within(sheet()).getByRole('button', { name: 'Take coin…' }));
    await user.type(within(sheet()).getByRole('textbox', { name: 'Herons' }), '45');
    const button = within(sheet()).getByRole('button', { name: 'Take 45 herons' });
    await user.click(button);
    expect(within(sheet()).getByRole('alert').textContent).toBe('Wren has 30 herons.');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(purseOf(wren)).toEqual({ heron: 30 });
    expect(sheet().querySelector('button[disabled]')).toBeNull();
    expect([...marks!.found]).toEqual([]);
  });

  it('the player still gets Spend… and Give to… on their own coin (the GM’s acts are the GM’s alone)', async () => {
    await coinWorld({ wren: { heron: 30 } });
    const user = await openPack();
    await user.click(await coinRow());
    expect([...sheet().querySelectorAll('.list-row')].map((r) => r.textContent)).toEqual(['Spend…', 'Give to…']);
  });
});

describe('hidden means hidden, and coin weighs nothing', () => {
  it('another player’s Pack shows only their own coin, and the Pack asks for no purse but its own player’s', async () => {
    await coinWorld({ wren: { heron: 30 }, moss: { crown: 7 } });
    world.signInAs(tess);
    const asked: unknown[] = [];
    const from = world.db.from.bind(world.db);
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never);
      if (table !== 'purses') return query;
      const eq = query.select.bind(query);
      return Object.assign(query, {
        select: (...args: unknown[]) => {
          const chain = (eq as (...a: unknown[]) => { eq: (c: string, v: unknown) => unknown })(...args);
          const realEq = chain.eq.bind(chain);
          chain.eq = (column: string, value: unknown) => {
            if (column === 'actor_id') asked.push(value);
            return realEq(column, value);
          };
          return chain;
        },
      });
    }) as never);
    await openPack('Moss');
    expect((await coinRow()).textContent).toBe('7 crowns');
    expect(document.body.textContent).not.toMatch(/30 herons/);
    expect(asked.every((id) => id === moss)).toBe(true);
    expect(asked).toContain(moss);
  });

  it('the database sends a player no other living character’s purse, whatever the Pack asks', async () => {
    await coinWorld({ wren: { heron: 30 }, moss: { crown: 7 } });
    world.signInAs(tess);
    const { data } = await world.db.from('purses').select('actor_id, coins');
    const actors = (data ?? []).map((p) => p.actor_id);
    expect(actors).toContain(moss);
    expect(actors).not.toContain(wren);
  });

  it('a purse full of coin adds nothing to the load', async () => {
    await coinWorld({ wren: { crown: 999, heron: 999, bit: 999 } });
    await openPack();
    await coinRow();
    // Only the rope's 50 counts.
    expect(screen.getByRole('region', { name: 'Wren’s pack' }).querySelector('.pack__load > .auth__meta')!.textContent).toMatch(/^50 of 1,200 coins/);
  });
});
