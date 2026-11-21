// @vitest-environment jsdom
// M5b step 6c, the town screen (docs/plans/m5b-6-settlements.md "Step 6c"; ST3, ST12; bq3-1), on the stand-in
// database. Invented names and rules only.
//   A place marked Safe becomes a town: the GM's place card gains Places in town (shops, lodgings, others, each with
//   Show players and Open · Closed), Things to do and Encounters with the town switches. Show players reveals that one
//   place to the players, with Undo; Closed reaches them; a hidden one never shows. After End expedition the town
//   screen stands on its own where the party stayed. A setting with no settlement mode (a turn-by-turn mode only)
//   still gets the town screen at a settlement place.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { typePlace } from '../testing/pickPlace.ts';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { openDepart, startExpedition } from '../testing/depart.ts';

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
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

const settlement = {
  services: [
    { id: 'buy-gear', name: 'The Tinker’s Stall', kind: 'buy', note: 'Rope, lamps and the like.' },
    { id: 'sell-pelts', name: 'The Pelt Buyer', kind: 'sell', rate: 40 },
    { id: 'gossip', name: 'Hear the gossip', kind: 'other', note: 'An evening at the well.' },
  ],
};
const downtime = { lodgings: [{ name: 'The Lantern Rest', rate: { sp: 2 }, per: 'night' }] };
const marketMode = {
  id: 'quay',
  name: 'Market town',
  step: { value: 1, unit: 'partOfDay' },
  procedure: [],
  checks: [{ id: 'town-day', name: 'Street trouble', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1] }, onlyWhen: 'outDay' }],
};
const cellarMode = { id: 'cellars', name: 'Cellars', pace: 'turn', step: { value: 10, unit: 'minute' }, procedure: [], checks: [] };

/** A GM, one player's character (Wren), invented rules: with a market town mode, or (no settlement mode) cellars only. */
function table(withTownMode = true) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 4, hp_max: 6 });
  world.tables.packs.push({ id: 'pack-quay', owner_user_id: gm, campaign_id: null, name: 'Quay Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-quay-rules',
    pack_id: 'pack-quay',
    kind: 'rulesSet',
    pack_entry_id: 'quay-rules',
    name: 'Quay rules',
    data: { id: 'quay-rules', name: 'Quay rules', settlement, downtime, exploration: { modes: [withTownMode ? marketMode : cellarMode] } },
  });
  world.tables.campaign_packs.push({ id: 'link-quay', campaign_id: campaign, pack_id: 'pack-quay', pack_name: 'Quay Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = 6 * 3600;
  return { gm, sam, campaign };
}

type User = ReturnType<typeof userEvent.setup>;

async function openAs(person: string) {
  world.signInAs(person);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  return user;
}

async function setOut(user: User, where: string) {
  // The GM's band reads "No session yet" before the first session (st-2).
  await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
  await typePlace(user, where, /^Where\?:/, await openDepart(user));
  await startExpedition(user);
  await screen.findByRole('heading', { name: where });
}

/** Marks the group's place Safe in the stand-in (the place card's row went, m8b-0 delivery 5; the town still reads it). */
async function markSafe() {
  const row = world.tables.places.find((p) => p.name === 'Quay Gate' && !p.undone)!;
  await world.db.from('places').update({ safety: 'safe', version: Number(row.version) }).eq('id', String(row.id));
  await screen.findByRole('heading', { name: 'Places in town' });
}

const town = () => screen.getByRole('region', { name: /^The town: / });
const events = (type: string) => world.tables.events.filter((e) => e.type === type);
const placeRow = () => world.tables.places.find((p) => p.name === 'Quay Gate')!;

/** Gives Quay Gate a description piece (hidden): a town's name reaches players once a piece of it is shown. */
function addDescription() {
  const place = placeRow();
  world.tables.place_pieces.push({ id: `piece-${place.id}`, campaign_id: place.campaign_id, place_id: place.id, kind: 'description', body: 'Mud streets and a lantern-lit quay.', position: 0, gm_value: '', gm_trigger: '', gm_stat_line: '', undone: false });
}
/** Opens the Safety and encounters fact's sheet (mc-15: the checks and the switches live there now). */
async function openSafety(user: { click: (el: Element) => Promise<void> }) {
  await user.click(within(town()).getByRole('button', { name: /^Safety and encounters/ }));
  return within(await screen.findByRole('dialog', { name: 'Safety and encounters' }));
}

/** Sets a place in town Closed from its own pop-up (mc-15: Open or Closed is set inside the place), then closes it. */
async function closePlace(user: { click: (el: Element) => Promise<void>; keyboard: (keys: string) => Promise<void> }, name: string) {
  await user.click(within(town()).getByRole('button', { name: `Open ${name}` }));
  const sheet = within(await screen.findByRole('dialog', { name }));
  await user.click(sheet.getByRole('group', { name: `${name}: open or closed` }).querySelector('button:last-child') as HTMLElement);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog', { name })).toBeNull());
}
const descriptionShows = () => world.tables.piece_shows.filter((s) => s.piece_id === `piece-${placeRow().id}` && s.shown === true && !s.undone);

async function playerScene(person: string) {
  cleanup();
  const player = await openAs(person);
  await player.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
  await screen.findByRole('region', { name: 'Time' });
  return player;
}

describe('the town screen (M5b step 6c)', () => {
  // Purpose: an ordinary place has no town screen; marking it Safe makes it a town with the setting's places and things to do.
  it('shows the town at a settlement place only', async () => {
    const { gm } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    expect(screen.queryByRole('heading', { name: 'Places in town' })).toBeNull();
    await markSafe();
    const here = town();
    expect(within(here).getByRole('heading', { name: 'Shops' })).toBeTruthy();
    expect(within(here).getByRole('heading', { name: 'Lodgings' })).toBeTruthy();
    expect(within(here).getByText('Lodging, 2 sp a night')).toBeTruthy();
    expect(within(here).getByText('Shop, buys at 40% of the price')).toBeTruthy();
    expect(within(here).getByText('0 of 3 shown to players')).toBeTruthy();
    // Things to do: the setting's `other` services, each rule one tap away.
    expect(within(here).getByRole('heading', { name: 'Things to do' })).toBeTruthy();
    expect(within(here).getByText('An evening at the well.')).toBeTruthy();
    // Encounters (the GM's): one fact, Safety and encounters (mc-15, variant B), saying Safe and the switch's state;
    // its sheet has the mode's checks and the switch they read (sw-2), as on the strip's ⋯.
    expect(within(here).getByRole('button', { name: 'Safety and encounters: Safe. Out and about today: Off' })).toBeTruthy();
    expect(within(here).queryByText('Street trouble, Roll 1d6, on 1, only while Out and about today')).toBeNull();
    const sheet = await openSafety(user);
    expect(sheet.getByText('Street trouble, Roll 1d6, on 1, only while Out and about today')).toBeTruthy();
    expect(sheet.getByRole('group', { name: 'Out and about today' })).toBeTruthy();
    // No People section and no line promising one (mc-18).
    expect(within(here).queryByText(/People and rumours/)).toBeNull();
  });

  // Purpose (2c, mc-15): a place's row keeps its eye only; its name opens it, where Open or Closed is set, and a closed
  // place says "Closed today." on its row.
  it("keeps a place's row to its eye; Open or Closed is set inside the place, and a closed row says so", async () => {
    const { gm } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    await markSafe();
    expect(within(town()).queryByRole('group', { name: 'The Pelt Buyer: open or closed' })).toBeNull();
    expect(within(town()).queryByText('Closed today.')).toBeNull();
    await closePlace(user, 'The Pelt Buyer');
    await waitFor(() => expect(events('town.openPlace')).toHaveLength(1));
    expect(await within(town()).findByText('Closed today.')).toBeTruthy();
  });

  // Purpose (step 6d, sw-2): the town screen's switch is the strip's own: On there is one Simple `town.outDay` line,
  // the campaign keeps it, the strip shows its marker, and Undo on the toast turns it off again.
  it("flips Out and about today from the town screen, as the strip's ⋯ does", async () => {
    const { gm, campaign } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    await markSafe();
    const row = () => world.tables.campaigns.find((c) => c.id === campaign)!;
    const switchRow = within((await openSafety(user)).getByRole('group', { name: 'Out and about today' }));
    await user.click(switchRow.getByRole('button', { name: 'On' }));
    const undo = within((await screen.findByText('Out and about today: On')).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });
    expect(row().out_day).toBe(true);
    expect(events('town.outDay').map((e) => e.level)).toEqual(['simple']);
    expect(await within(screen.getByRole('region', { name: 'Time' })).findByText('Out and about today')).toBeTruthy();
    await user.click(undo);
    await waitFor(() => expect(row().out_day).toBe(false));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Time' })).queryByText('Out and about today')).toBeNull());
  });

  // Purpose (sm-1, the lead's words): lighting one half from the town screen while the other is lit says both in the toast, the tapped one first.
  it('the town screen\'s toast names the half a turn-on put out', async () => {
    const { gm, campaign } = table();
    const row = () => world.tables.campaigns.find((c) => c.id === campaign)!;
    // Active tonight lit before the screen opens.
    row().active_night = true;
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    await markSafe();
    const switchRow = within((await openSafety(user)).getByRole('group', { name: 'Out and about today' }));
    await user.click(switchRow.getByRole('button', { name: 'On' }));
    expect(await screen.findByText('Out and about today: On. Active tonight: Off.')).toBeTruthy();
    expect(row()).toMatchObject({ out_day: true, active_night: false });
  });

  // Purpose: Show players reveals one place only (with Undo); Closed reaches players; a hidden place never shows to them.
  it('shows players one place at a time; hidden places never reach them', async () => {
    const { gm, sam } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    addDescription();
    await markSafe();
    // The first place shown shows the town with it (its description): one line of two changes.
    await user.click(within(town()).getByRole('button', { name: 'Show players The Tinker’s Stall' }));
    await screen.findByText('Shown: Quay Gate and The Tinker’s Stall');
    expect(events('town.showPlace').map((e) => e.level)).toEqual(['verbose', 'verbose']);
    expect(descriptionShows()).toHaveLength(1);
    await closePlace(user, 'The Pelt Buyer');
    await waitFor(() => expect(events('town.openPlace')).toHaveLength(1));
    await user.click(within(town()).getByRole('button', { name: 'Show players The Pelt Buyer' }));
    await screen.findByText('Shown to players: The Pelt Buyer');
    // Undo on the toast hides the buyer again.
    await user.click(within((await screen.findByText('Shown to players: The Pelt Buyer')).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect((placeRow().town as Record<string, { shown: boolean }>)['service:sell-pelts']?.shown).toBe(false));
    await user.click(within(town()).getByRole('button', { name: 'Show players The Pelt Buyer' }));
    await screen.findByText('Shown to players: The Pelt Buyer');

    await playerScene(sam);
    const line = await screen.findByRole('region', { name: 'In Quay Gate' });
    expect(within(line).getByText('The Tinker’s Stall')).toBeTruthy();
    expect(within(line).getByText('Shop, sells, Open')).toBeTruthy();
    expect(within(line).getByText('Shop, buys at 40% of the price, Closed')).toBeTruthy();
    expect(within(line).queryByText('The Lantern Rest')).toBeNull();
    // No GM controls, nothing about the encounters.
    expect(screen.queryByRole('heading', { name: 'Encounters' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Show players/ })).toBeNull();
  });

  // Purpose: after End expedition the party stays in town, and the town screen stands on its own there.
  it('stays after End expedition, on its own', async () => {
    const { gm, sam } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    addDescription();
    await markSafe();
    await user.click(within(town()).getByRole('button', { name: 'Show players The Lantern Rest' }));
    await screen.findByText('Shown: Quay Gate and The Lantern Rest');
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(within(document.querySelector('.more-menu__panel') as HTMLElement).getByRole('button', { name: 'End expedition' }));
    await screen.findByText('Expedition ended');
    // The place card goes with the expedition; the town screen stands alone, its name on top.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Where now?' })).toBeNull());
    const alone = await screen.findByRole('region', { name: 'The town: Quay Gate' });
    expect(within(alone).getByRole('heading', { name: 'Quay Gate' })).toBeTruthy();
    expect(within(alone).getByText('Safe')).toBeTruthy();
    expect((await openSafety(user)).getByText('They come due only during an expedition.')).toBeTruthy();
    await user.keyboard('{Escape}');
    // Players still see what's shown, the town's name on top.
    await playerScene(sam);
    const line = await screen.findByRole('region', { name: 'In Quay Gate' });
    expect(within(line).getByRole('heading', { name: 'Quay Gate' })).toBeTruthy();
    expect(within(line).getByText('The Lantern Rest')).toBeTruthy();
  });

  // Purpose (review finding 2, ruled B): players read a town only once the place itself is shown. The first Show
  // players in a town they don't see yet shows the town (its description piece) in the same tap, as one log line with
  // one Undo that hides both; with no description to show, the tap explains and changes nothing; an entry marked shown
  // in a town that isn't never reaches a player's device.
  it('the first place shown shows the town with it, one line and one Undo; without a description it explains', async () => {
    const { gm, sam, campaign } = table();
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    await markSafe();
    // No description yet: nothing to show the town with.
    await user.click(within(town()).getByRole('button', { name: 'Show players The Tinker’s Stall' }));
    await screen.findByText('Players see Quay Gate once a piece of it is shown: add a Description to the place first.');
    expect(events('town.showPlace')).toHaveLength(0);
    expect(placeRow().town ?? {}).toEqual({});

    addDescription();
    // Any change re-reads the place (the card now knows the piece): Closed on the buyer.
    await closePlace(user, 'The Pelt Buyer');
    await waitFor(() => expect(events('town.openPlace')).toHaveLength(1));
    await user.click(within(town()).getByRole('button', { name: 'Show players The Tinker’s Stall' }));
    const toast = (await screen.findByText('Shown: Quay Gate and The Tinker’s Stall')).closest('.toast') as HTMLElement;
    const shows = events('town.showPlace');
    expect(new Set(shows.map((e) => e.request_id)).size).toBe(1);
    expect(shows.map((e) => e.target_table).sort()).toEqual(['piece_shows', 'places']);
    expect(descriptionShows()).toHaveLength(1);
    // One Undo hides both.
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(descriptionShows()).toHaveLength(0));
    expect((placeRow().town as Record<string, { shown: boolean }>)['service:buy-gear']?.shown ?? false).toBe(false);
    expect(await within(town()).findByText('0 of 3 shown to players')).toBeTruthy();

    // An entry marked shown in a town that isn't shown: a player's device gets nothing of it.
    Object.assign(placeRow(), { town: { 'service:buy-gear': { name: 'The Tinker’s Stall', kind: 'shop', shown: true, open: true } } });
    await playerScene(sam);
    expect(screen.queryByRole('region', { name: 'In Quay Gate' })).toBeNull();
    world.signInAs(sam);
    const direct = await world.db.rpc('scene_town', { campaign });
    expect(direct.data).toEqual([]);
  });

  // Purpose: a setting with no settlement mode (classic-advanced, ST12) still shows the town screen at a settlement place.
  it('works with no settlement mode', async () => {
    const { gm } = table(false);
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    await markSafe();
    expect(within(town()).getByRole('heading', { name: 'Shops' })).toBeTruthy();
    expect(within(town()).queryByRole('heading', { name: 'Encounters' })).toBeNull();
  });
});

describe("the town follows its entries' options and a rules overlay (fix-town-options-and-stack)", () => {
  const onOff = (id: string, name: string) => ({ id, name, default: 'off', choices: [{ id: 'off', name: 'Off' }, { id: 'on', name: 'On' }] });

  /** The Quay rules with a valuer and a lifestyle behind two options, at these choices. */
  function optionTable(choices: Record<string, string>) {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    world.addMember(campaign, sam, 'player', wren);
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 4, hp_max: 6 });
    const services = [
      { id: 'buy-gear', name: 'The Tinker’s Stall', kind: 'buy' },
      { id: 'sell-pelts', name: 'The Pelt Buyer', kind: 'sell', rate: 40 },
      { id: 'valuer', name: 'The Glass-eyed Valuer', kind: 'identify', option: 'valuing' },
      { id: 'gossip', name: 'Hear the gossip', kind: 'other', note: 'An evening at the well.' },
    ];
    const living = { lodgings: [{ name: 'The Lantern Rest', rate: { sp: 2 }, per: 'night' }], lifestyles: [{ name: 'Threadbare', rate: { sp: 1 }, option: 'living-costs=on' }] };
    world.tables.packs.push({ id: 'pack-quay', owner_user_id: gm, campaign_id: null, name: 'Quay Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({ id: 'entry-quay-rules', pack_id: 'pack-quay', kind: 'rulesSet', pack_entry_id: 'quay-rules', name: 'Quay rules', data: { id: 'quay-rules', name: 'Quay rules', settlement: { services }, downtime: living } });
    for (const option of [onOff('living-costs', 'Living costs'), onOff('valuing', 'Valuing finds')]) {
      world.tables.library_entries.push({ id: `entry-${option.id}`, pack_id: 'pack-quay', kind: 'option', pack_entry_id: option.id, name: option.name, data: option });
    }
    world.tables.campaign_packs.push({ id: 'link-quay', campaign_id: campaign, pack_id: 'pack-quay', pack_name: 'Quay Rules', option_choices: choices, overrides: {}, priority: 1 });
    world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = 6 * 3600;
    return { gm, sam, campaign };
  }

  /** Choose again, as the GM would in Rules, and read the setting afresh. */
  function choose(choices: Record<string, string>) {
    cleanup();
    forgetCampaignSetting();
    world.tables.campaign_packs.find((l) => l.id === 'link-quay')!.option_choices = choices;
  }

  // Purpose: with the options off the GM's town has no "Living:" line and no valuer; with them on, both.
  it('shows a lifestyle and a service only while their option is on', async () => {
    const { gm } = optionTable({ 'living-costs': 'off', valuing: 'off' });
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    await markSafe();
    expect(within(town()).queryByText(/^Living:/)).toBeNull();
    expect(within(town()).queryByText('The Glass-eyed Valuer')).toBeNull();
    expect(within(town()).getByText('The Tinker’s Stall')).toBeTruthy();
    expect(within(town()).getByText('0 of 3 shown to players')).toBeTruthy();

    choose({ 'living-costs': 'on', valuing: 'on' });
    await openAs(gm);
    await screen.findByRole('heading', { name: 'Places in town' });
    expect(within(town()).getByText('Living: Threadbare, 1 sp a day')).toBeTruthy();
    expect(within(town()).getByText('The Glass-eyed Valuer')).toBeTruthy();
    expect(within(town()).getByText('0 of 4 shown to players')).toBeTruthy();
  });

  // Purpose: a place the GM showed while its option was on leaves the player's town line once the option is off.
  it("drops a shown place from the player's line when its option goes off", async () => {
    const { gm, sam } = optionTable({ valuing: 'on' });
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    addDescription();
    await markSafe();
    // The first place shown shows the town with it (review finding 2, ruled B).
    await user.click(within(town()).getByRole('button', { name: 'Show players The Glass-eyed Valuer' }));
    await screen.findByText('Shown: Quay Gate and The Glass-eyed Valuer');
    await user.click(within(town()).getByRole('button', { name: 'Show players The Tinker’s Stall' }));
    await screen.findByText('Shown to players: The Tinker’s Stall');

    choose({ valuing: 'off' });
    await playerScene(sam);
    const line = await screen.findByRole('region', { name: 'In Quay Gate' });
    expect(within(line).getByText('The Tinker’s Stall')).toBeTruthy();
    expect(within(line).queryByText('The Glass-eyed Valuer')).toBeNull();
  });

  // Purpose: base plus a rules overlay (its fragment `extends` the base's rules set, ov-1) shows the base's services
  // and the overlay's new one, and a same-id entry shows the overlay's copy.
  it("keeps the base's services, adds the overlay's, and takes the overlay's copy of the same id", async () => {
    const { gm, campaign } = optionTable({ valuing: 'on' });
    world.tables.packs.push({ id: 'pack-harbour', owner_user_id: gm, campaign_id: null, name: 'Harbour Notes', version: '1', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const fragment = {
      id: 'harbour-rules',
      name: 'Harbour rules',
      extends: 'quay-rules',
      settlement: { services: [{ id: 'buy-gear', name: 'The Harbour Chandler', kind: 'buy' }, { id: 'ferry-loan', name: 'The Ferryman’s Purse', kind: 'loan' }] },
    };
    world.tables.library_entries.push({ id: 'entry-harbour-rules', pack_id: 'pack-harbour', kind: 'rulesSet', pack_entry_id: 'harbour-rules', name: 'Harbour rules', data: fragment });
    world.tables.campaign_packs.push({ id: 'link-harbour', campaign_id: campaign, pack_id: 'pack-harbour', pack_name: 'Harbour Notes', option_choices: {}, overrides: {}, priority: 2 });
    const user = await openAs(gm);
    await setOut(user, 'Quay Gate');
    await markSafe();
    const here = town();
    expect(within(here).getByText('The Harbour Chandler')).toBeTruthy();
    expect(within(here).queryByText('The Tinker’s Stall')).toBeNull();
    expect(within(here).getByText('The Pelt Buyer')).toBeTruthy();
    expect(within(here).getByText('The Glass-eyed Valuer')).toBeTruthy();
    expect(within(here).getByText('The Ferryman’s Purse')).toBeTruthy();
    expect(within(here).getByText('The Lantern Rest')).toBeTruthy();
    expect(within(here).getByText('An evening at the well.')).toBeTruthy();
  });
});
