// @vitest-environment jsdom
// The count on the Pack's icon (K19b of docs/specs/scene-pack.md, piece D; page 45's FD7, approved 2026-11-26; p45-10,
// #158 ⚑ 4), on the Player screen against the stand-in database. Invented names and coins only (hard rule 2). Purposes:
//   1. A find the GM sends shows on the Pack's tab as its count, read "Pack, 1 new", from the Player tab; one that
//      arrives while the screen is open raises it in place.
//   2. It counts things, not units: a stack is one and a send's coin is one.
//   3. "Got it" on the Pack takes the count away, there and back on the Player tab.
//   4. On a phone the tab bar carries the same count.
//   5. Hidden means hidden: the GM's view of Wren as the player, and another player (Tess, on her own Moss), show no count.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { giveFind } from '../modules/expedition/findSend.ts';
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

/** A window this many pixels wide: matchMedia answers min-width and max-width queries for it. */
function windowOf(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (!min || width >= Number(min[1])) && (!max || width <= Number(max[1])) && Boolean(min || max);
    return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
  }) as typeof window.matchMedia;
}

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.packOpen');
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const asGm = () => ({ id: gm, roles: { [campaign]: 'gm' as const } });

/** Wren (Sam's) and Moss (Tess's), coin in herons, and a place for the GM's sends. */
async function findsWorld() {
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  tess = world.addPerson('tess@lantern.example', 'Tess');
  campaign = world.addCampaign('The Ash Barrows', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const moss = world.addCharacter(campaign, 'Moss', { ownerId: tess });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, tess, 'player', moss);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-fen-rules',
    pack_id: 'pack-fen',
    kind: 'rulesSet',
    pack_entry_id: 'fen-rules',
    name: 'Fen rules',
    data: { id: 'fen-rules', name: 'Fen rules', currency: [{ key: 'heron', label: 'herons', valueInBase: 10 }] },
  });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, priority: 1 });
  world.tables.places.push({ id: 'place-stair', campaign_id: campaign, name: 'The Reed Stair', players_name: 'A stair', undone: false, version: 1 });
  world.signInAs(gm);
  await world.db.from('purses' as never).select('*');
  world.signInAs(sam);
}

/** One send from the GM to Wren (K16b), then signed back in as `back`. */
async function send(things: { name: string; qty: number }[], coins: Record<string, number> = {}, back = sam) {
  world.signInAs(gm);
  const done = await runCommand(registry, world.db, asGm(), giveFind, { campaignId: campaign, to: wren, placeId: 'place-stair', things, coins, rows: [] });
  if (!done.ok) throw new Error(done.message);
  world.signInAs(back);
}

async function openAs(who: string) {
  world.signInAs(who);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  return user;
}

const nav = () => screen.findByRole('navigation', { name: 'Main' });
const packTab = async () => within(await nav()).getByRole('button', { name: /^Pack/ });
/** The Pack's tab's name for screen readers: "Pack, 1 new" with a count, none (its words alone) without. */
const packName = async () => (await packTab()).getAttribute('aria-label');
const packMark = async () => (await packTab()).querySelector('.section-nav__badge');

describe("The count on the Pack's icon (K19b)", () => {
  it('shows on the Pack’s tab from the Player tab, and rises when a find arrives while the screen is open', async () => {
    await findsWorld();
    await send([{ name: 'Bronze ring', qty: 1 }]);
    await openAs(sam);
    expect(within(await nav()).getByRole('button', { name: 'Player' }).getAttribute('aria-current')).toBe('page');
    await waitFor(async () => expect(await packName()).toBe('Pack, 1 new'));
    expect((await packMark())?.textContent).toBe('1');
    await send([{ name: 'Silver key', qty: 1 }]);
    await waitFor(async () => expect(await packName()).toBe('Pack, 2 new'));
  });

  it('counts a stack as one and a send’s coin as one', async () => {
    await findsWorld();
    await send([{ name: 'Moon opals', qty: 3 }], { heron: 40 });
    await openAs(sam);
    await waitFor(async () => expect(await packName()).toBe('Pack, 2 new'));
  });

  it('"Got it" on the Pack takes the count away, there and on the Player tab', async () => {
    await findsWorld();
    await send([{ name: 'Bronze ring', qty: 1 }]);
    const user = await openAs(sam);
    await waitFor(async () => expect(await packName()).toBe('Pack, 1 new'));
    await user.click(await packTab());
    await user.click(await screen.findByRole('button', { name: /^Got it/ }));
    await waitFor(async () => expect(await packMark()).toBeNull());
    expect(await packName()).toBeNull();
    await user.click(within(await nav()).getByRole('button', { name: 'Player' }));
    expect(await packMark()).toBeNull();
  });

  it('shows on a phone’s tab bar too', async () => {
    windowOf(375);
    await findsWorld();
    await send([{ name: 'Bronze ring', qty: 1 }]);
    await openAs(sam);
    // The phone's bar: Log is one of its tabs.
    expect(within(await nav()).getByRole('button', { name: 'Log' })).toBeTruthy();
    await waitFor(async () => expect(await packName()).toBe('Pack, 1 new'));
  });

  it('the GM’s view as the player and another player show no count', async () => {
    await findsWorld();
    await send([{ name: 'Bronze ring', qty: 1 }], {}, gm);
    // The GM, on Wren's Player tab from the Players row's View sheet.
    const user = await openAs(gm);
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    await user.click(await screen.findByRole('button', { name: 'View Wren’s sheet' }));
    await screen.findByRole('note');
    await screen.findByRole('heading', { name: /Wren/ });
    // Long enough for a read of what is new to have come back, had there been one.
    await new Promise((r) => setTimeout(r, 50));
    expect(await packMark()).toBeNull();
    expect(await packName()).toBeNull();
    cleanup();
    // Tess, on her own Moss.
    await openAs(tess);
    await screen.findByRole('heading', { name: /Moss/ });
    await new Promise((r) => setTimeout(r, 50));
    expect(await packMark()).toBeNull();
  });
});
