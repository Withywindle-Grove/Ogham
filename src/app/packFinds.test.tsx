// @vitest-environment jsdom
// New on the Pack tab (K20b of docs/plans/dec-6-the-whole-pack-tab.md; page 45's FD1, FD3, FD8, FD8b, FD9, FD9b, FD11,
// FD11b, approved 2026-11-26; PK2, PK3, approved 2026-11-14). Invented names and coins only (hard rule 2). Purposes:
//   1. A find the GM sends shows the card on her Pack, the "New" tag on its row, and the row first in its group; the
//      rows that are new stand first, newest first, then the rest in the list's own order.
//   2. "Got it" clears the card and every tag, writes the mark once (a second tap meanwhile writes nothing), and raises
//      no toast.
//   3. Opening a new thing's sheet clears nothing (p45-9).
//   4. Offline, a tap on "Got it" writes nothing and shows the box under the card.
//   5. A tap the server refuses keeps the card as it was, under the error toast "Couldn’t mark these as seen."
//   6. A new thing she puts in a container keeps its tag there (p45-11).
//   7. A stack a find joined carries the tag, and loses it at Got it (p45-22).
//   8. The GM's Undo before Got it: the row goes, the card stays with the quiet line, and "Got it" clears it (p45-25).
//   9. Coin the GM gives puts the tag on the coin line.
//  10. Hidden means hidden: another player's Pack, and the GM's own view of her Pack, draw no card and no tag.
// K21b, coin on the card (FD4, FD4b, FD5b, FD5c; PK3, PK5):
//  11. Coin alone heads the card "New in your coin": the amount on its line, and no "In your coin." beside it.
//  12. Two coins in one send are one line, in the setting's order, as the coin line writes them.
//  13. A hoard's coin and things: the coin first, with "In your coin.", then the things; a coin the book prints oddly
//      reaches the card in the setting's words, and neither the book's printed words nor the pack's note reach it.
//  14. Hidden means hidden: the coin the GM sends or gives Wren reaches no other player. Tess's device, reading what is
//      new for her own Moss, is sent no line with Wren's amounts (the read asks for Moss's own purse lines only, and
//      the read rule would leave out another character's besides), and her Pack draws no card.
// The local review of #158 (comment 7229639840):
//  15. Finding 1: the Pack keeps the card's live region, empty and without room, before the first find, and the card
//      arrives inside that same region (so a screen reader reads its arrival out).
//  16. Finding 2: the read of what is new asks for purse lines of the character's own purse only, never the campaign's.
//  17. Finding 2: on a character the reader may not mark (the GM's own), nothing past the character is read: no mark,
//      no log lines.
//  18. Finding 3: the Pack starts its read of what is new beside its own reads, not after the inventory has come.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { addItem, moveItem } from '../modules/inventory/inventory.ts';
import { giveFind, sendOf, undoFind } from '../modules/expedition/findSend.ts';
import type { HoardRow } from '../modules/expedition/hoard.ts';
import { loadFindsRead } from '../modules/characters/findsSeen.ts';
import { addCoin } from '../modules/inventory/purse.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { createAppRegistry } from './commandRegistry.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

const registry = createAppRegistry();
let world: FakeWorld;
let campaign = '';
let gm = '';
let sam = '';
let tess = '';
let wren = '';
let moss = '';
type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  localStorage.removeItem('grimoire.packOpen');
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

const asGm = () => ({ id: gm, roles: { [campaign]: 'gm' as const } });
const wrenCarrier = () => ({ campaignId: campaign, actorId: wren, locationId: null, ownerUserId: sam, archived: false });

function line(id: string, name: string, more: Record<string, unknown> = {}) {
  world.tables.inventory_lines.push({
    id, campaign_id: campaign, actor_id: wren, location_id: null, library_entry_id: null, name, category: 'gear', weight_coin: 10, slots: null, stack: 1, qty: 1,
    container_line_id: null, equipped: false, how_got: 'found', cost: '', notes: '', item_data: {}, source_pack_id: null, source_entry_id: null, charges_left: null,
    charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null, pinned: false, at_hand_hidden: false, approval: 'approved', per_units: 1, version: 1,
    created_at: '2026-10-23T10:00:00Z', ...more,
  });
}

/** Wren (Sam's) and Moss (Tess's), coin in herons and bits, a rope, a sack, six pearls, and a place for the GM's sends. */
async function findsWorld() {
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
    id: 'entry-fen-rules', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules',
    data: {
      id: 'fen-rules', name: 'Fen rules',
      encumbrance: { mode: 'coin', coin: { maxLoadCoin: 1200, tiers: [{ label: 'Light', max: 400, movement: '125' }, { label: 'Laden', max: 1200, movement: '60' }], overMax: 'Stuck in the mud' } },
      currency: [{ key: 'heron', label: 'herons', valueInBase: 10 }, { key: 'bit', label: 'bits', valueInBase: 1 }],
    },
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, priority: 1 });
  world.tables.places.push({ id: 'place-stair', campaign_id: campaign, name: 'The Reed Stair', players_name: 'A stair', undone: false, version: 1 });
  line('line-rope', 'Coil of reed rope', { weight_coin: 50 });
  line('line-sack', 'Sack', { weight_coin: 5, item_data: { container: { capacityCoin: 200 } } });
  world.tables.library_entries.push({ id: 'entry-pearl', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'river-pearls', name: 'River pearls', data: { id: 'river-pearls', name: 'River pearls', category: 'gem', weightCoin: 1, stack: 50 } });
  line('line-pearls', 'River pearls', { category: 'gem', qty: 6, stack: 50, weight_coin: 1, library_entry_id: 'entry-pearl', source_pack_id: 'pack-fen', source_entry_id: 'river-pearls' });
  world.signInAs(gm);
  await world.db.from('purses' as never).select('*');
  world.signInAs(sam);
}

/** The GM sends things to Wren (K16b), each its own send; answers each send's first line, for its Undo. */
async function send(...names: string[]): Promise<string[]> {
  world.signInAs(gm);
  const ids: string[] = [];
  for (const name of names) {
    const done = await runCommand(registry, world.db, asGm(), giveFind, { campaignId: campaign, to: wren, placeId: 'place-stair', things: [{ name, qty: 1 }], coins: {}, rows: [] });
    if (!done.ok) throw new Error(done.message);
    ids.push(done.value.eventId);
  }
  world.signInAs(sam);
  return ids;
}

async function openPack(): Promise<User> {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
  expect(await screen.findByRole('heading', { name: 'Wren’s pack' })).toBeTruthy();
  return user;
}

const card = () => document.querySelector('.find-card');
const tags = () => [...document.querySelectorAll('.pack__new')];
const rowNames = (group: string) =>
  [...(screen.getByRole('region', { name: group }).querySelectorAll('.pack__name'))].map((n) => n.textContent?.replace(/\u00a0New/, '').replace(/ ×\d+$/, ''));
const marks = () => world.tables.events.filter((e) => e.target_table === 'finds_seen');

describe('New on the Pack tab (K20b)', () => {
  it('shows the card, the tag on each new row, and the new rows first in their group, newest first', async () => {
    await findsWorld();
    await send('Bronze ring', 'Moon opal');
    await openPack();
    await waitFor(() => expect(card()).toBeTruthy());
    expect(within(card() as HTMLElement).getByText('Moon opal')).toBeTruthy();
    expect(tags().map((t) => t.closest('.pack__name')?.textContent)).toEqual(['Moon opal New', 'Bronze ring New']);
    expect(rowNames('Carried')).toEqual(['Moon opal', 'Bronze ring', 'Coil of reed rope', 'River pearls', 'Sack']);
  });

  it('"Got it" clears the card and every tag, writes the mark once, and raises no toast', async () => {
    await findsWorld();
    await send('Bronze ring');
    await openPack();
    const got = await screen.findByRole('button', { name: /^Got it/ });
    // Two taps before the first is answered: one mark.
    fireEvent.click(got);
    fireEvent.click(got);
    await waitFor(() => expect(card()).toBeNull());
    expect(tags()).toEqual([]);
    expect(marks()).toHaveLength(1);
    expect(document.querySelector('.toast')).toBeNull();
    expect(rowNames('Carried')).toEqual(['Bronze ring', 'Coil of reed rope', 'River pearls', 'Sack']);
  });

  it('opening a new thing’s sheet clears nothing', async () => {
    await findsWorld();
    await send('Bronze ring');
    const user = await openPack();
    await waitFor(() => expect(tags()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: /^Bronze ring/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(card()).toBeTruthy();
    expect(tags()).toHaveLength(1);
    expect(marks()).toHaveLength(0);
  });

  it('offline, Got it writes nothing and the box explains under the card', async () => {
    await findsWorld();
    await send('Bronze ring');
    const user = await openPack();
    await screen.findByRole('button', { name: /^Got it/ });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
    await user.click(screen.getByRole('button', { name: /^Got it/ }));
    expect(await screen.findByText(/You’re offline\. Got it waits until you’re back\./)).toBeTruthy();
    expect(marks()).toHaveLength(0);
    expect(card()).toBeTruthy();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(screen.queryByText(/You’re offline\. Got it waits/)).toBeNull());
  });

  it('a refused tap keeps the card under the error toast', async () => {
    await findsWorld();
    await send('Bronze ring');
    const rpc = world.db.rpc.bind(world.db);
    vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: never) =>
      name === 'mark_finds_seen' ? Promise.resolve({ data: null, error: { message: 'network down', code: '' } }) : rpc(name as never, args)) as never);
    const user = await openPack();
    await user.click(await screen.findByRole('button', { name: /^Got it/ }));
    expect(await screen.findByText('Couldn’t mark these as seen.')).toBeTruthy();
    expect(card()).toBeTruthy();
    expect(tags()).toHaveLength(1);
  });

  it('a new thing put in a container keeps its tag there', async () => {
    await findsWorld();
    await send('Bronze ring');
    const ring = world.tables.inventory_lines.find((l) => l.name === 'Bronze ring')!;
    await runCommand(registry, world.db, { id: sam, roles: { [campaign]: 'player' } }, moveItem, {
      line: { id: String(ring.id), carrier: wrenCarrier(), version: Number(ring.version) },
      to: wrenCarrier(),
      containerLineId: 'line-sack',
      qty: 1,
      of: 1,
    });
    await openPack();
    await waitFor(() => expect(tags()).toHaveLength(1));
    expect(rowNames('In the Sack')).toEqual(['Bronze ring']);
  });

  it('a stack a find joined carries the tag, and loses it at Got it', async () => {
    await findsWorld();
    world.signInAs(gm);
    const joined = await runCommand(registry, world.db, asGm(), addItem, {
      carrier: wrenCarrier(),
      item: { libraryEntryId: 'entry-pearl', name: 'River pearls', category: 'gem', weightCoin: 1, slots: null, stack: 50 },
      qty: 2,
      howGot: 'given',
    });
    expect(joined.ok).toBe(true);
    world.signInAs(sam);
    const user = await openPack();
    await waitFor(() => expect(tags()).toHaveLength(1));
    expect(tags()[0]!.closest('.pack__name')?.textContent).toBe('River pearls New ×8');
    expect(within(card() as HTMLElement).getByText(', now 8')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Got it/ }));
    await waitFor(() => expect(tags()).toEqual([]));
  });

  it('the GM’s Undo before Got it: the row goes, the card stays with the quiet line, and Got it clears it', async () => {
    await findsWorld();
    const [ring] = await send('Bronze ring');
    const user = await openPack();
    await waitFor(() => expect(tags()).toHaveLength(1));
    world.signInAs(gm);
    const undone = await runCommand(registry, world.db, asGm(), undoFind, { campaignId: campaign, eventId: ring! });
    expect(undone.ok).toBe(true);
    world.signInAs(sam);
    expect(await screen.findByText('Your GM took back the Bronze ring.')).toBeTruthy();
    expect(tags()).toEqual([]);
    expect(rowNames('Carried')).toEqual(['Coil of reed rope', 'River pearls', 'Sack']);
    await user.click(screen.getByRole('button', { name: /^Got it/ }));
    await waitFor(() => expect(card()).toBeNull());
  });

  it('coin the GM gives puts the tag on the coin line', async () => {
    await findsWorld();
    world.signInAs(gm);
    const given = await runCommand(registry, world.db, asGm(), addCoin, { to: wrenCarrier(), coins: { heron: 40 } });
    expect(given.ok).toBe(true);
    world.signInAs(sam);
    await openPack();
    const coin = await screen.findByRole('button', { name: /^Coin: / });
    await waitFor(() => expect(coin.querySelector('.pack__new')).toBeTruthy());
    expect(coin.getAttribute('aria-label')).toBe('Coin: 40 herons, new');
  });

  it('another player’s Pack and the GM draw no card and no tag', async () => {
    await findsWorld();
    await send('Bronze ring');
    // The GM, on Wren's Pack from the Players page.
    world.signInAs(gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Wren’s pack' }));
    expect(await screen.findByRole('region', { name: 'Wren’s pack' })).toBeTruthy();
    await screen.findByRole('button', { name: /^Bronze ring/ });
    expect(card()).toBeNull();
    expect(tags()).toEqual([]);
    cleanup();
    // Tess, on her own Moss's Pack.
    world.signInAs(tess);
    const tessUser = userEvent.setup();
    render(<Root db={world.db} />);
    await tessUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await tessUser.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    expect(await screen.findByRole('heading', { name: 'Moss’ pack' })).toBeTruthy();
    expect(card()).toBeNull();
    expect(tags()).toEqual([]);
    void moss;
  });
});

describe('Coin on the card (K21b)', () => {
  const cardText = () => card()?.textContent ?? '';

  it('coin alone heads the card "New in your coin"', async () => {
    await findsWorld();
    world.signInAs(gm);
    expect((await runCommand(registry, world.db, asGm(), addCoin, { to: wrenCarrier(), coins: { heron: 240 } })).ok).toBe(true);
    world.signInAs(sam);
    await openPack();
    expect(await screen.findByRole('heading', { name: 'New in your coin' })).toBeTruthy();
    const line = card()!.querySelector('.find-card__line')!;
    expect(line.querySelector('.find-card__name')?.textContent).toBe('240 herons');
    expect(line.querySelector('.find-card__quiet')?.textContent).toBe('From your GM, just now.');
    expect(cardText()).not.toContain('In your coin.');
  });

  it('two coins in one send are one line, in the setting’s order', async () => {
    await findsWorld();
    world.signInAs(gm);
    const sent = await runCommand(registry, world.db, asGm(), giveFind, { campaignId: campaign, to: wren, placeId: 'place-stair', things: [], coins: { bit: 4, heron: 40 }, rows: [] });
    expect(sent.ok).toBe(true);
    world.signInAs(sam);
    await openPack();
    expect(await screen.findByRole('heading', { name: 'New in your coin' })).toBeTruthy();
    expect([...card()!.querySelectorAll('.find-card__name')].map((n) => n.textContent)).toEqual(['40 herons, 4 bits']);
  });

  it('a hoard’s oddly printed coin comes first, in the setting’s words, with no printed words and no note', async () => {
    await findsWorld();
    // The sea chest's rows as the GM's hoard sheet reads them (FD5 B): the coin row keeps the book's words and the note.
    const rows: HoardRow[] = [
      { kind: 'coin', entry: 0, text: '200 hn.', amounts: [{ key: 'heron', amount: 200, words: '200 herons' }], coins: { heron: 200 }, readAs: { printed: '200 hn.', note: 'Printed “hn.” in the book: read as 200 herons.' }, notCoins: [] },
      { kind: 'thing', entry: 1, text: 'Brass spyglass', itemId: null, worth: null, qty: 1, magic: null, noticed: null },
    ];
    const what = sendOf(rows, new Map());
    world.signInAs(gm);
    const sent = await runCommand(registry, world.db, asGm(), giveFind, { campaignId: campaign, to: wren, placeId: 'place-stair', ...what });
    expect(sent.ok).toBe(true);
    world.signInAs(sam);
    await openPack();
    expect(await screen.findByRole('heading', { name: 'New in your pack' })).toBeTruthy();
    expect(card()!.querySelector('.find-card__once')?.textContent).toBe('From your GM, just now.');
    const lines = [...card()!.querySelectorAll('.find-card__line')].map((l) => [l.querySelector('.find-card__name')?.textContent, l.querySelector('.find-card__quiet')?.textContent ?? null]);
    expect(lines).toEqual([['200 herons', 'In your coin.'], ['Brass spyglass', null]]);
    expect(cardText()).not.toContain('hn.');
    expect(cardText()).not.toContain('Printed');
  });

  it('the coin the GM sends or gives Wren reaches no other player', async () => {
    await findsWorld();
    world.signInAs(gm);
    expect((await runCommand(registry, world.db, asGm(), giveFind, { campaignId: campaign, to: wren, placeId: 'place-stair', things: [], coins: { heron: 4321 }, rows: [] })).ok).toBe(true);
    expect((await runCommand(registry, world.db, asGm(), addCoin, { to: wrenCarrier(), coins: { bit: 777 } })).ok).toBe(true);
    // Wren's own player is sent both amounts.
    world.signInAs(sam);
    const hers = JSON.stringify((await loadFindsRead(world.db, campaign, wren))!.events);
    expect(hers).toContain('4321');
    expect(hers).toContain('777');
    // Tess, reading what is new for her own Moss, is sent neither.
    world.signInAs(tess);
    const read = await loadFindsRead(world.db, campaign, moss);
    expect(read).not.toBeNull();
    const sent = JSON.stringify(read!.events);
    expect(sent).not.toContain('4321');
    expect(sent).not.toContain('777');
    expect(read!.purseId).not.toBe(world.tables.purses.find((p) => p.actor_id === wren)?.id);
  });
});

describe('The local review of #158', () => {
  /** Every events query the device asks, as the filters it put on it. */
  function eventQueries() {
    const asked: string[][] = [];
    const from = world.db.from.bind(world.db);
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as Record<string, (...a: unknown[]) => unknown>;
      if (table !== 'events') return query;
      const filters: string[] = [];
      asked.push(filters);
      for (const name of ['eq', 'in', 'gt']) {
        const own = query[name]!.bind(query);
        query[name] = (column: unknown, value: unknown) => {
          filters.push(`${name} ${String(column)} ${Array.isArray(value) ? value.join(',') : String(value)}`);
          return own(column, value);
        };
      }
      return query;
    }) as never);
    return asked;
  }

  it('keeps the empty live region before the first find, and the card arrives inside it', async () => {
    await findsWorld();
    await openPack();
    const region = await waitFor(() => {
      const found = document.querySelector('.pack__summary > .find-card-live');
      expect(found).toBeTruthy();
      return found!;
    });
    expect(region.getAttribute('role')).toBe('status');
    expect(region.childElementCount).toBe(0);
    expect(card()).toBeNull();
    // A find arrives while the Pack is open: the GM's Undo of nothing, so a reload, as a later find's would be.
    const [ring] = await send('Bronze ring');
    world.signInAs(gm);
    expect((await runCommand(registry, world.db, asGm(), undoFind, { campaignId: campaign, eventId: ring! })).ok).toBe(true);
    world.signInAs(sam);
    await waitFor(() => expect(card()).toBeTruthy());
    expect(card()!.closest('.find-card-live')).toBe(region);
  });

  it('asks for the purse lines of the character’s own purse only', async () => {
    await findsWorld();
    world.signInAs(gm);
    expect((await runCommand(registry, world.db, asGm(), addCoin, { to: wrenCarrier(), coins: { bit: 777 } })).ok).toBe(true);
    world.signInAs(tess);
    const asked = eventQueries();
    const read = await loadFindsRead(world.db, campaign, moss);
    expect(read).not.toBeNull();
    const mossPurse = String(world.tables.purses.find((p) => p.actor_id === moss)?.id);
    const purseQueries = asked.filter((q) => q.some((f) => f.includes('purses')));
    expect(purseQueries.length).toBeGreaterThan(0);
    for (const q of purseQueries) {
      expect(q).toContain('eq target_table purses');
      expect(q).toContain(`eq target_id ${mossPurse}`);
    }
    expect(asked.every((q) => q.some((f) => f.startsWith('eq campaign_id')))).toBe(true);
  });

  it('reads nothing past the character when the reader may not mark it', async () => {
    await findsWorld();
    const gmOwn = world.addCharacter(campaign, 'Lantern Warden', { ownerId: gm });
    world.signInAs(gm);
    const tables: string[] = [];
    const from = world.db.from.bind(world.db);
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      tables.push(table);
      return from(table as never);
    }) as never);
    const read = await loadFindsRead(world.db, campaign, gmOwn, () => false);
    expect(read).toBeNull();
    expect(tables).toEqual(['actors']);
  });

  it('starts the read of what is new beside the Pack’s own reads', async () => {
    await findsWorld();
    await send('Bronze ring');
    // Hold the Pack's inventory read until the read of what is new has asked for the mark.
    let release = () => {};
    const held = new Promise<void>((done) => (release = done));
    const asked: string[] = [];
    const from = world.db.from.bind(world.db);
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      asked.push(table);
      const query = from(table as never) as unknown as PromiseLike<unknown> & { then: PromiseLike<unknown>['then'] };
      if (table !== 'inventory_lines') return query;
      const then = query.then.bind(query);
      query.then = ((done: never, fail: never) => held.then(() => then(done, fail))) as never;
      return query;
    }) as never);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    await waitFor(() => expect(asked).toContain('finds_seen'));
    release();
    expect(await screen.findByRole('heading', { name: 'New in your pack' })).toBeTruthy();
  });
});
