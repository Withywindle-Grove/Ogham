// @vitest-environment jsdom
// M5b step 6e: buying, selling, lodging, town activities and the overnight card (docs/plans/m5b-6-settlements.md
// "Step 6e"; ST5–ST9; dt-11, st-3), on the stand-in database. Invented names and rules only.
//   An Ask for… the GM answers Hit then In stock reaches the player with the pack's price, and Buy it brings the item
//   into the pack as bought. A Sell… offer the player declines changes nothing. A lodging pick logs its cost. A town
//   activity reaches the GM with its rule. The overnight card arrives once per morning with last night's lodging.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { typePlace } from '../testing/pickPlace.ts';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { openDepart, startExpedition } from '../testing/depart.ts';
import { PlayerViewContext } from './playerView.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  localStorage.removeItem('grimoire.overnightSeen');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

const settlement = {
  services: [
    { id: 'buy-gear', name: 'The Tinker’s Stall', kind: 'buy', note: 'Rope, lamps and the like.' },
    { id: 'sell-pelts', name: 'The Pelt Buyer', kind: 'sell', rate: 40 },
  ],
  availability: { bySize: [{ size: 'Hamlet', chance: 10 }, { size: 'Market town', chance: 60 }], note: 'For the rarer goods.' },
  salePrice: { default: 50, byService: { 'sell-pelts': 40 } },
};
const downtime = { lodgings: [{ name: 'The Lantern Rest', rate: { sp: 2 }, per: 'night' }] };
const marketMode = {
  id: 'quay',
  name: 'Market town',
  step: { value: 1, unit: 'partOfDay' },
  procedure: [],
  checks: [],
  activities: [{ id: 'hear-gossip', name: 'Hear the gossip', icon: 'listen', cost: { steps: 1 }, who: 'several', result: 'A rumour, at the GM’s choice' }],
};
const currency = [
  { key: 'gp', label: 'Gold', valueInBase: 10 },
  { key: 'sp', label: 'Silver', valueInBase: 1 },
];

/** A GM, one player's character (Wren, with an otter pelt), invented rules with a market town mode and a lantern for sale. */
function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 4, hp_max: 6 });
  world.tables.packs.push({ id: 'pack-quay', owner_user_id: gm, campaign_id: null, name: 'Quay Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push(
    {
      id: 'entry-quay-rules',
      pack_id: 'pack-quay',
      kind: 'rulesSet',
      pack_entry_id: 'quay-rules',
      name: 'Quay rules',
      data: { id: 'quay-rules', name: 'Quay rules', settlement, downtime, currency, exploration: { modes: [marketMode] } },
    },
    { id: 'entry-lantern', pack_id: 'pack-quay', kind: 'item', pack_entry_id: 'hooded-lantern', name: 'Hooded lantern', data: { id: 'hooded-lantern', name: 'Hooded lantern', category: 'gear', value: { gp: 4 }, weightCoin: 30, availability: 'towns only' } },
    { id: 'entry-pelt', pack_id: 'pack-quay', kind: 'item', pack_entry_id: 'otter-pelt', name: 'Otter pelt', data: { id: 'otter-pelt', name: 'Otter pelt', category: 'treasure', value: { gp: 5 }, weightCoin: 10 } },
  );
  world.tables.campaign_packs.push({ id: 'link-quay', campaign_id: campaign, pack_id: 'pack-quay', pack_name: 'Quay Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = 6 * 3600;
  // TC13 piece A: Ask for… goes through the at-once answer (town.askFor). The lantern has no availability to decide by,
  // so its default would answer it at once; the GM has put it back on "?" today (the stock table's Reset), so an ask
  // for it waits for the GM, as these journeys need.
  world.tables.shop_stock.push({ id: 'stock-lantern-day1', campaign_id: campaign, service_id: 'buy-gear', item_id: 'hooded-lantern', day: 1, answer: 'undecided', undone: false, created_by: gm, created_at: '2026-10-18T12:00:00Z', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.inventory_lines.push({ id: 'line-pelt', campaign_id: campaign, actor_id: wren, location_id: null, name: 'Otter pelt', category: 'treasure', qty: 1, stack: 1, approval: 'approved', item_data: {}, source_entry_id: 'otter-pelt', version: 1 });
  return { gm, sam, campaign, wren };
}

type User = ReturnType<typeof userEvent.setup>;

async function openAs(person: string, section?: 'Players') {
  world.signInAs(person);
  forgetCampaignSetting();
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  if (section) await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  return user;
}

/** The GM sets out to Quay Gate, marks it Safe and shows players the stall, the pelt buyer and the inn. */
async function townReady(gm: string) {
  const user = await openAs(gm);
  // The GM's band reads "No session yet" before the first session (st-2).
  await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
  await typePlace(user, 'Quay Gate', /^Where\?:/, await openDepart(user));
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'Quay Gate' });
  // A description piece: players read the town only once the place itself is shown (review finding 2, ruled B);
  // the first Show players shows the town with it.
  const place = world.tables.places.find((p) => p.name === 'Quay Gate')!;
  world.tables.place_pieces.push({ id: `piece-${place.id}`, campaign_id: place.campaign_id, place_id: place.id, kind: 'description', body: 'Mud streets and a lantern-lit quay.', position: 0, gm_value: '', gm_trigger: '', gm_stat_line: '', undone: false });
  // Marked Safe in the stand-in (the place card's row went, m8b-0 delivery 5; the town still reads it).
  await world.db.from('places').update({ safety: 'safe', version: Number(place.version) }).eq('id', String(place.id));
  await screen.findByRole('heading', { name: 'Places in town' });
  for (const name of ['The Tinker’s Stall', 'The Pelt Buyer', 'The Lantern Rest']) {
    await user.click(screen.getByRole('button', { name: `Show players ${name}` }));
    await screen.findByText(name === 'The Tinker’s Stall' ? `Shown: Quay Gate and ${name}` : `Shown to players: ${name}`);
  }
  cleanup();
}

async function playerTown(person: string) {
  cleanup();
  const user = await openAs(person);
  await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
  await screen.findByRole('region', { name: 'In Quay Gate: Wren' });
  return user;
}

const actions = () => within(screen.getByRole('region', { name: 'In Quay Gate: Wren' }));
const waiting = async () => within(await screen.findByRole('region', { name: 'Waiting for you' }));
const events = (type: string) => world.tables.events.filter((e) => e.type === type);

async function pick(user: User, dialog: string, row: string) {
  await user.click(within(screen.getByRole('dialog', { name: dialog })).getByRole('radio', { name: new RegExp(row) }));
}

describe('town requests (M5b step 6e)', () => {
  // Purpose: an Ask for… with Hit then In stock reaches the player with the pack price, and Buy it puts it in the pack as bought.
  it('buys a lantern: the GM rolls Hit, says In stock: and the player buys it', async () => {
    const { gm, sam, wren } = table();
    await townReady(gm);
    let player = await playerTown(sam);
    await player.click(actions().getByRole('button', { name: 'Ask for…' }));
    await player.type(within(screen.getByRole('dialog', { name: 'Ask for…' })).getByRole('textbox', { name: 'Find an item' }), 'lantern');
    await pick(player, 'Ask for…', 'Hooded lantern');
    await player.click(within(screen.getByRole('dialog', { name: 'Ask for…' })).getByRole('button', { name: 'Send to the GM' }));
    await screen.findByText('Sent to the GM');

    cleanup();
    const user = await openAs(gm, 'Players');
    const list = await waiting();
    expect(list.getByText('Wren asks for Hooded lantern, The Tinker’s Stall')).toBeTruthy();
    expect(list.getByText("The pack's price: 4 gp")).toBeTruthy();
    expect(list.getByText("Where it's sold: towns only")).toBeTruthy();
    expect(list.getByText("Chance it's here: Hamlet 10%, Market town 60%")).toBeTruthy();
    // Hit / Miss first; then the answers.
    expect(list.queryByRole('button', { name: 'In stock' })).toBeNull();
    await user.click(list.getByRole('button', { name: 'Hit' }));
    await user.click(list.getByRole('button', { name: 'In stock' }));
    await screen.findByText('Wren: Hooded lantern, 4 gp');

    player = await playerTown(sam);
    const answer = await screen.findByRole('article', { name: "The GM's answer" });
    expect(within(answer).getByText('In stock: 4 gp')).toBeTruthy();
    await player.click(within(answer).getByRole('button', { name: 'Buy it' }));
    await screen.findByText("Bought for 4 gp: it's in your pack");
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.actor_id === wren && l.name === 'Hooded lantern')).toMatchObject({ how_got: 'bought', cost: '4 gp' }));
    // One reply, one log line: the answer and the new line share the request.
    expect(new Set(events('request.reply').map((e) => e.request_id)).size).toBe(1);
  });

  /** Wren's player asks for a lantern, the GM says In stock, the player taps Buy it: its toast is showing. */
  async function boughtLantern() {
    const { gm, sam, wren } = table();
    await townReady(gm);
    let player = await playerTown(sam);
    await player.click(actions().getByRole('button', { name: 'Ask for…' }));
    await player.type(within(screen.getByRole('dialog', { name: 'Ask for…' })).getByRole('textbox', { name: 'Find an item' }), 'lantern');
    await pick(player, 'Ask for…', 'Hooded lantern');
    await player.click(within(screen.getByRole('dialog', { name: 'Ask for…' })).getByRole('button', { name: 'Send to the GM' }));
    await screen.findByText('Sent to the GM');
    cleanup();
    const user = await openAs(gm, 'Players');
    const list = await waiting();
    await user.click(list.getByRole('button', { name: 'Hit' }));
    await user.click(list.getByRole('button', { name: 'In stock' }));
    await screen.findByText('Wren: Hooded lantern, 4 gp');
    player = await playerTown(sam);
    const answer = await screen.findByRole('article', { name: "The GM's answer" });
    await player.click(within(answer).getByRole('button', { name: 'Buy it' }));
    await screen.findByText("Bought for 4 gp: it's in your pack");
    const lantern = () => world.tables.inventory_lines.find((l) => l.actor_id === wren && l.name === 'Hooded lantern');
    await waitFor(() => expect(lantern()).toBeTruthy());
    return { player, lantern };
  }

  // Purpose: the buyer's Undo on the Buy it toast takes the untouched bought item out of the pack, and the log keeps a full copy of it (bu-1).
  it("the buyer's Undo takes the untouched bought lantern back out, the log keeps a copy", async () => {
    const { player, lantern } = await boughtLantern();
    await player.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(lantern()).toBeUndefined());
    const kept = world.tables.events.find((e) => e.target_table === 'inventory_lines' && e.type === 'request.undoBuy' && e.after === null);
    expect(kept?.before).toMatchObject({ name: 'Hooded lantern', how_got: 'bought', cost: '4 gp' });
    expect(kept?.reverts_event_id).toBeTruthy();
  });

  // Purpose: once the bought item has been touched (here its version moved on), Undo is refused in plain words and the item stays (bu-2).
  it('Undo of a purchase is refused once the item was touched, and the lantern stays', async () => {
    const { player, lantern } = await boughtLantern();
    lantern()!.version = Number(lantern()!.version) + 1;
    await player.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText(/That's changed since: the Hooded lantern was used or moved/);
    expect(lantern()).toBeTruthy();
  });

  // Purpose: uses that leave the version alone (a light lit from the line, something put in it) also count as touched; the lantern stays.
  it('Undo of a purchase is refused when a light burns from the lantern or something is inside it', async () => {
    const { player, lantern } = await boughtLantern();
    const line = lantern()!;
    world.tables.character_lights.push({ id: 'light-1', actor_id: line.actor_id, campaign_id: line.campaign_id, line_id: line.id, name: 'Lantern' });
    await player.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText(/That's changed since: the Hooded lantern was used or moved/);
    expect(lantern()).toBeTruthy();
  });

  // Purpose: a logged change to the line's hidden charges leaves its version at 1 but still counts as touched (bu-2b).
  it("Undo of a purchase is refused when the GM's hidden charges were set on the line (version still 1)", async () => {
    const { player, lantern } = await boughtLantern();
    world.tables.events.push({ id: 'event-secret', seq: 9_999_999, campaign_id: lantern()!.campaign_id, target_table: 'inventory_line_secrets', target_id: lantern()!.id, before: null, after: { charges_total: 3 } });
    await player.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText(/That's changed since: the Hooded lantern was used or moved/);
    expect(lantern()).toBeTruthy();
  });

  it('Undo of a purchase is refused when something was put inside the bought item', async () => {
    const { player, lantern } = await boughtLantern();
    const line = lantern()!;
    world.tables.inventory_lines.push({ ...line, id: 'line-inside', name: 'Flint', container_line_id: line.id, version: 1 });
    await player.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText(/That's changed since: the Hooded lantern was used or moved/);
    expect(lantern()).toBeTruthy();
  });

  // Purpose: a purchase with no request id on its reply (an untagged one) has nothing the Undo can safely match: refused, plain words.
  it('Undo is refused in plain words when the reply carries no request id', async () => {
    const { player, lantern } = await boughtLantern();
    for (const e of world.tables.events) if (e.target_table === 'requests') e.request_id = null;
    await player.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText("There's no purchase to undo.");
    expect(lantern()).toBeTruthy();
  });

  // Purpose: a Sell… offer the player declines changes nothing; the GM's offer starts from the pack's sale rule.
  it('sells a pelt: the GM offers the suggested price, the player declines, the pelt stays', async () => {
    const { gm, sam, wren } = table();
    await townReady(gm);
    let player = await playerTown(sam);
    await player.click(actions().getByRole('button', { name: 'Sell…' }));
    await pick(player, 'Sell…', 'Otter pelt');
    await pick(player, 'Sell…', 'The Pelt Buyer');
    await player.click(within(screen.getByRole('dialog', { name: 'Sell…' })).getByRole('button', { name: 'Send to the GM' }));
    await screen.findByText('Sent to the GM');

    cleanup();
    const user = await openAs(gm, 'Players');
    const list = await waiting();
    expect(list.getByText('Wren wants to sell Otter pelt to The Pelt Buyer')).toBeTruthy();
    expect(list.getByText("The pack's rule suggests 2 gp (40% of the price).")).toBeTruthy();
    expect((list.getByRole('textbox', { name: 'Your offer, in words' }) as HTMLInputElement).value).toBe('2 gp');
    await user.click(list.getByRole('button', { name: 'Offer' }));
    await screen.findByText('Offered Wren 2 gp');

    player = await playerTown(sam);
    const answer = await screen.findByRole('article', { name: "The GM's answer" });
    expect(within(answer).getByText('Offers 2 gp')).toBeTruthy();
    await player.click(within(answer).getByRole('button', { name: 'Decline' }));
    await screen.findByText('Declined the offer');
    expect(world.tables.inventory_lines.filter((l) => l.actor_id === wren).map((l) => l.name)).toEqual(['Otter pelt']);
  });

  // Purpose: a lodging pick logs its cost, at once (no GM); the overnight card arrives once per morning with it.
  it('stays at the inn; next morning the overnight card says so, once', async () => {
    const { gm, sam, campaign } = table();
    await townReady(gm);
    // Night falls (22:30).
    world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = 22 * 3600 + 1800;
    const player = await playerTown(sam);
    await player.click(actions().getByRole('button', { name: 'Where you stay' }));
    await pick(player, 'Where you stay', 'The Lantern Rest');
    await player.click(within(screen.getByRole('dialog', { name: 'Where you stay' })).getByRole('button', { name: 'Stay here' }));
    await screen.findByText('Staying at The Lantern Rest, 2 sp a night');
    expect(events('town.stay')).toHaveLength(1);
    expect(events('town.stay')[0]!.after).toMatchObject({ cost_text: '2 sp a night', status: 'answered' });
    expect(world.tables.requests.filter((r) => r.status === 'waiting')).toEqual([]);
    expect(screen.queryByRole('article', { name: 'Overnight' })).toBeNull();

    // The GM moves on to the morning.
    world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = 30 * 3600;
    const next = await playerTown(sam);
    const card = await screen.findByRole('article', { name: 'Overnight' });
    expect(within(card).getByText('Morning in Quay Gate')).toBeTruthy();
    expect(within(card).getByText('Last night: The Lantern Rest, 2 sp a night')).toBeTruthy();
    await next.click(within(card).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Overnight' })).toBeNull());
    await playerTown(sam);
    expect(screen.queryByRole('article', { name: 'Overnight' })).toBeNull();
  });

  // Purpose: a town activity reaches the GM with its rule and cost; the GM's answer comes back with their words.
  it('sends a town activity to the GM, who narrates', async () => {
    const { gm, sam } = table();
    await townReady(gm);
    let player = await playerTown(sam);
    await player.click(actions().getByRole('button', { name: 'Things to do' }));
    await pick(player, 'Things to do', 'Hear the gossip');
    expect(within(screen.getByRole('dialog', { name: 'Things to do' })).getByText('A rumour, at the GM’s choice')).toBeTruthy();
    await player.click(within(screen.getByRole('dialog', { name: 'Things to do' })).getByRole('button', { name: 'Send to the GM' }));
    await screen.findByText('Sent to the GM');

    cleanup();
    const user = await openAs(gm, 'Players');
    const list = await waiting();
    expect(list.getByText('Wren: Hear the gossip, a part of the day')).toBeTruthy();
    await user.type(list.getByRole('textbox', { name: 'A note for them' }), 'The miller owes the abbey money.');
    await user.click(list.getByRole('button', { name: 'Yes' }));
    await screen.findByText('Yes to Wren');

    player = await playerTown(sam);
    const answer = await screen.findByRole('article', { name: "The GM's answer" });
    expect(within(answer).getByText('The miller owes the abbey money.')).toBeTruthy();
    void player;
  });
});

// Ask for… through the at-once answer (TC13 piece A; docs/specs/town-ask-buy.md, "Piece A: Ask for…"; tn-7, tn-8,
// sb5-6), on the stand-in database. Purposes, in plain words:
//   * an ask for a thing the day's stock has in is answered at once: the player's answer card shows "In stock" with its
//     price on the same screen, no toast and no Undo, the GM gets no card, and the log has the player's one line;
//   * an ask for a thing the day's stock has out is answered at once, "Not here", likewise with no toast;
//   * the day sent is the campaign day as the clock counts it, not day 1;
//   * an ask that waits keeps "Sent to the GM" and its Undo, and the Undo withdraws that ask only, never an earlier
//     request of the player's;
//   * Something not listed… goes the same way and waits for the GM;
//   * a failed Ask for… sends nothing: no request, no log line, an error toast, the dialog still open.
describe('Ask for… answered at once (TC13 piece A)', () => {
  /** The GM's answer for the lantern at the stall on a day (replacing the "?" the fixture puts on day 1). */
  function lanternStock(campaign: string, answer: 'in' | 'out' | 'undecided', day = 1) {
    world.tables.shop_stock = world.tables.shop_stock.filter((r) => r.id !== 'stock-lantern-day1');
    world.tables.shop_stock.push({ id: `stock-lantern-day${day}`, campaign_id: campaign, service_id: 'buy-gear', item_id: 'hooded-lantern', day, answer, undone: false, created_by: null, created_at: '2026-10-18T12:00:00Z', updated_at: '2026-10-18T12:00:00Z' });
  }

  async function askForLantern(player: User) {
    await player.click(actions().getByRole('button', { name: 'Ask for…' }));
    await player.type(within(screen.getByRole('dialog', { name: 'Ask for…' })).getByRole('textbox', { name: 'Find an item' }), 'lantern');
    await pick(player, 'Ask for…', 'Hooded lantern');
    await player.click(within(screen.getByRole('dialog', { name: 'Ask for…' })).getByRole('button', { name: 'Send to the GM' }));
  }

  /** The GM opens Players: nothing of Wren's waits there. */
  async function gmHasNoCard(gm: string) {
    cleanup();
    await openAs(gm, 'Players');
    await screen.findByRole('navigation', { name: 'Campaign sections' });
    await screen.findAllByText(/Wren/);
    expect(screen.queryByText(/Wren asks for/)).toBeNull();
    expect(world.tables.requests.filter((r) => r.status === 'waiting')).toEqual([]);
  }

  // Purpose: a thing the day's stock has in is answered at once; the answer card is the news (no toast, no Undo), the GM gets no card, and the log has the player's line.
  it('a lantern in stock today: the answer shows at once, with no toast and no GM card', async () => {
    const { gm, sam, campaign } = table();
    lanternStock(campaign, 'in');
    await townReady(gm);
    const player = await playerTown(sam);
    await askForLantern(player);
    // The same screen, no reopening: the priced answer arrives where the player is.
    const answer = await screen.findByRole('article', { name: "The GM's answer" });
    expect(within(answer).getByText('In stock: 4 gp')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Ask for…' })).toBeNull();
    expect(screen.queryByText('Sent to the GM')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(events('request.send')).toHaveLength(0);
    expect(events('town.askFor')).toHaveLength(1);
    expect(events('town.askFor')[0]!.after).toMatchObject({ status: 'answered', answer: { kind: 'buy', result: 'inStock', price: '4 gp' } });
    await gmHasNoCard(gm);
  });

  // Purpose: a thing the day's stock has out is answered at once, Not here, with no toast and no GM card.
  it('a lantern out of stock today: Not here at once', async () => {
    const { gm, sam, campaign } = table();
    lanternStock(campaign, 'out');
    await townReady(gm);
    const player = await playerTown(sam);
    await askForLantern(player);
    const answer = await screen.findByRole('article', { name: "The GM's answer" });
    expect(within(answer).getByText('Not here')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(events('town.askFor')[0]!.after).toMatchObject({ status: 'answered', answer: { result: 'notHere' } });
    await gmHasNoCard(gm);
  });

  // Purpose: the day sent is the campaign day as the clock counts it (readClock's day), so a stock set for day 3 answers an ask made on day 3.
  it('sends the campaign day: stock set for day 3 answers an ask on day 3', async () => {
    const { gm, sam, campaign } = table();
    await townReady(gm);
    lanternStock(campaign, 'in', 3);
    world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = 2 * 24 * 3600 + 6 * 3600;
    const player = await playerTown(sam);
    await askForLantern(player);
    const answer = await screen.findByRole('article', { name: "The GM's answer" });
    expect(within(answer).getByText('In stock: 4 gp')).toBeTruthy();
  });

  // Purpose: an ask that waits keeps today's toast and Undo; the Undo withdraws that ask, and an earlier request of the player's stays.
  it('an ask that waits: "Sent to the GM" with Undo, which withdraws that ask only', async () => {
    const { gm, sam } = table();
    await townReady(gm);
    const player = await playerTown(sam);
    // An earlier request: a pelt offered to the buyer.
    await player.click(actions().getByRole('button', { name: 'Sell…' }));
    await pick(player, 'Sell…', 'Otter pelt');
    await pick(player, 'Sell…', 'The Pelt Buyer');
    await player.click(within(screen.getByRole('dialog', { name: 'Sell…' })).getByRole('button', { name: 'Send to the GM' }));
    await waitFor(() => expect(world.tables.requests.filter((r) => r.kind === 'sell')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sell…' })).toBeNull());
    await askForLantern(player);
    await waitFor(() => expect(events('town.askFor')).toHaveLength(1));
    expect(events('town.askFor')[0]!.after).toMatchObject({ status: 'waiting', kind: 'buy' });
    const toast = await waitFor(() => {
      const found = screen.getAllByText('Sent to the GM').map((n) => n.closest('.toast')).filter((t): t is Element => t !== null);
      expect(found).toHaveLength(1);
      return found[0] as HTMLElement;
    });
    await player.click(within(toast).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.requests.find((r) => r.kind === 'buy')!.status).toBe('withdrawn'));
    expect(world.tables.requests.find((r) => r.kind === 'sell')!.status).toBe('waiting');
  });

  // Purpose: Something not listed… goes through the same command and waits for the GM, who sees it in Waiting for you.
  it('Something not listed… goes through town.askFor and waits for the GM', async () => {
    const { gm, sam } = table();
    await townReady(gm);
    const player = await playerTown(sam);
    await player.click(actions().getByRole('button', { name: 'Ask for…' }));
    await pick(player, 'Ask for…', 'Something not listed…');
    await player.type(within(screen.getByRole('dialog', { name: 'Ask for…' })).getByRole('textbox', { name: "What you're after" }), 'A brass bell');
    await player.click(within(screen.getByRole('dialog', { name: 'Ask for…' })).getByRole('button', { name: 'Send to the GM' }));
    await waitFor(() => expect(events('town.askFor')).toHaveLength(1));
    expect(events('town.askFor')[0]!.after).toMatchObject({ status: 'waiting', prompt: { itemId: null, item: 'A brass bell' } });
    expect(events('request.send')).toHaveLength(0);
    cleanup();
    await openAs(gm, 'Players');
    expect((await waiting()).getByText('Wren asks for A brass bell, The Tinker’s Stall')).toBeTruthy();
  });

  // Purpose: a failed Ask for… sends nothing: no request, no log line, an error toast, and the dialog stays open to try again.
  it('a failed Ask for… sends nothing and keeps the dialog', async () => {
    const { gm, sam } = table();
    await townReady(gm);
    const player = await playerTown(sam);
    const before = { events: world.tables.events.length, requests: world.tables.requests.length };
    const real = world.db.rpc.bind(world.db);
    const spy = vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: Record<string, unknown>) =>
      name === 'ask_for_thing' ? Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) : real(name as never, args as never)) as never);
    await askForLantern(player);
    const error = await waitFor(() => {
      const found = document.querySelector('.toast');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(within(error).queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Ask for…' })).toBeTruthy();
    expect({ events: world.tables.events.length, requests: world.tables.requests.length }).toEqual(before);
    spy.mockRestore();
  });
});

// The GM's view as the player (page 32, M3f2, M3i; C15d of plans/test-feedback-2026-11-19.md). Purposes, in plain words:
//   In the view, the town's player-only buttons (Ask for…, Sell…, Stay here) open their "Only Sam can …" pop-up and
//   write nothing; so do Cancel on Sam's waiting request and Accept and Decline on the GM's offer.
// The whole app is wrapped in the view's context with Sam signed in, so his own Scene's real buttons stand for the
// view's: the view's Scene shows them once C15f makes it the player's.
describe("the player-only buttons in the GM's view (C15d)", () => {
  async function inView(person: string) {
    cleanup();
    world.signInAs(person);
    forgetCampaignSetting();
    const user = userEvent.setup();
    render(
      <PlayerViewContext.Provider value={{ player: 'Sam', character: 'Wren', goToWaiting: () => undefined }}>
        <Root db={world.db} />
      </PlayerViewContext.Provider>,
    );
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
    return user;
  }
  /** The pop-up by its title; "Got it" puts it away. */
  async function readAndClose(user: User, title: string) {
    const pop = await screen.findByRole('dialog', { name: title });
    await user.click(within(pop).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: title })).toBeNull());
  }

  it('Ask for…, Sell… and Stay here open their pop-ups and write nothing', async () => {
    const { gm, sam } = table();
    await townReady(gm);
    const user = await inView(sam);
    await screen.findByRole('region', { name: 'In Quay Gate: Wren' });
    const before = { events: world.tables.events.length, requests: world.tables.requests.length };
    await user.click(actions().getByRole('button', { name: 'Ask for…' }));
    await readAndClose(user, 'Only Sam can send this request');
    await user.click(actions().getByRole('button', { name: 'Sell…' }));
    await readAndClose(user, 'Only Sam can send this request');
    expect(screen.queryByRole('dialog', { name: 'Sell…' })).toBeNull();
    await user.click(actions().getByRole('button', { name: 'Where you stay' }));
    await pick(user, 'Where you stay', 'The Lantern Rest');
    await user.click(within(screen.getByRole('dialog', { name: 'Where you stay' })).getByRole('button', { name: 'Stay here' }));
    await readAndClose(user, 'Only Sam can choose where Wren stays');
    expect({ events: world.tables.events.length, requests: world.tables.requests.length }).toEqual(before);
  });

  it("Cancel on Sam's request, and Accept and Decline on the GM's offer, open their pop-ups and write nothing", async () => {
    const { campaign, sam, wren } = table();
    const row = (id: string, extra: Record<string, unknown>) => ({
      id, campaign_id: campaign, expedition_id: null, group_number: null, requester_id: sam, actor_id: wren, kind: 'sell', direction: 'playerAsks',
      text: 'Otter pelt', cost_text: '', prompt: { lineId: 'line-pelt', qty: 1 }, entry: null, answer_kind: 'offer', answered_at: null, reply: null,
      created_at: '2026-11-21T10:00:00Z', version: 1, undone: false, ...extra,
    });
    world.tables.requests.push(
      row('req-waiting', { status: 'waiting', answer: null }) as never,
      row('req-offer', { status: 'answered', answer: { kind: 'offer', price: '2 gp', note: '' }, answered_at: '2026-11-21T10:05:00Z' }) as never,
    );
    const user = await inView(sam);
    const before = { events: world.tables.events.length, requests: JSON.stringify(world.tables.requests) };
    await user.click(within(await screen.findByRole('article', { name: 'Sent to the GM' })).getByRole('button', { name: 'Cancel' }));
    const cancel = await screen.findByRole('dialog', { name: 'Only Sam can take back this request' });
    expect([...cancel.querySelectorAll('.dialog__got-it button')].map((b) => b.textContent)).toEqual(['Go to Waiting for you', 'Got it']);
    await readAndClose(user, 'Only Sam can take back this request');
    for (const answer of ['Accept', 'Decline']) {
      await user.click(within(await screen.findByRole('article', { name: "The GM's answer" })).getByRole('button', { name: answer }));
      await readAndClose(user, 'Only Sam can answer your offer');
    }
    expect({ events: world.tables.events.length, requests: JSON.stringify(world.tables.requests) }).toEqual(before);
  });
});
