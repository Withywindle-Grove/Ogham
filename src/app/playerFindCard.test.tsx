// @vitest-environment jsdom
// The find card on every tab but the Scene and the Pack (K18c of docs/specs/scene-pack.md, piece E; page 45's FD1b,
// FD1c B, FD10 and FD10b, approved 2026-11-26; page 51's 51-1 A and 51-2 A, approved 2026-11-28; p45-2, p45-13, p45-19,
// l4-4, l4-5), on the Player screen against the stand-in database. Invented names only (hard rule 2). Purposes:
//   1. A find the GM sends shows the card on the Player tab; on a tablet it is first in the right column, before the
//      notices box; on a phone it stands above the head.
//   2. The card shows on the Magic tab, and in the phone's Log; neither the Pack (its own card) nor the Scene (its own,
//      in the prompt slot) draws a second one.
//   3. "Got it" on the Player tab clears the card and the count on the Pack's icon.
//   4. A find that arrives while a pop-up is open leaves the pop-up and what is typed in it untouched, and raises no toast.
//   5. "and N more" opens the Pack, from the Player tab and from the Scene.
//   6. Hidden means hidden: the GM's view of the character as the player draws no card.
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

/** Wren (Sam's), and a place for the GM's sends; `caster` makes her a level 1 Lantern Warden, with a Magic tab. */
async function findsWorld({ caster = false }: { caster?: boolean } = {}) {
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  campaign = world.addCampaign('The Ash Barrows', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  if (caster) {
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('rulesSet', 'fen-rules', 'Fen rules', { abilities: [{ key: 'STR', short: 'Strength', name: 'Strength' }], saveCategories: [{ key: 'R', name: 'Save vs river' }] });
    entry('class', 'lantern-warden', 'Lantern Warden', {
      spellcasting: { listId: 'warden-list', type: 'divine', castingType: 'divine' },
      progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 }, spellSlots: [2] }],
    });
    entry('spell', 'marsh-light', 'Marsh light', { range: '30 ft' });
    entry('spellList', 'warden-list', 'Warden spells', { levels: [{ level: 1, spells: ['marsh-light'] }] });
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
    world.tables.character_play.push({ actor_id: wren, campaign_id: campaign, prepared: [{ spell: 'marsh-light', level: 1 }], spells_cast: {}, uses_spent: {}, ac_override: null, form_id: null, version: 1 });
  }
  world.tables.places.push({ id: 'place-stair', campaign_id: campaign, name: 'The Reed Stair', players_name: 'A stair', undone: false, version: 1 });
  world.signInAs(gm);
  await world.db.from('purses' as never).select('*');
  world.signInAs(sam);
}

/** One send from the GM to Wren (K16b), then signed back in as `back`. */
async function send(things: { name: string; qty: number }[], back = sam) {
  world.signInAs(gm);
  const done = await runCommand(registry, world.db, asGm(), giveFind, { campaignId: campaign, to: wren, placeId: 'place-stair', things, coins: {}, rows: [] });
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
const tab = async (name: RegExp) => within(await nav()).getByRole('button', { name });
const card = () => screen.findByRole('heading', { name: 'New in your pack' });
const cards = () => document.querySelectorAll('.find-card:not(.find-card--box)');

const packName = async () => (await tab(/^Pack/)).getAttribute('aria-label');
const five = ['Bronze ring', 'Silver key', 'Eel spear', 'Lamp oil', 'Reed basket'].map((name) => ({ name, qty: 1 }));
/** Whether `a` comes before `b` in the page. */
const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('The find card on every other tab (K18c)', () => {
  it('shows on the Player tab when the GM sends a find', async () => {
    await findsWorld();
    await send([{ name: 'Bronze ring', qty: 1 }]);
    await openAs(sam);
    expect((await tab(/^Player/)).getAttribute('aria-current')).toBe('page');
    expect(await card()).toBeTruthy();
    expect(screen.getByText('Bronze ring')).toBeTruthy();
    expect(cards()).toHaveLength(1);
  });

  it('on a tablet stands first in the right column, before the notices box', async () => {
    windowOf(1180);
    await findsWorld();
    await send([{ name: 'Bronze ring', qty: 1 }]);
    await openAs(sam);
    const head = await card();
    const right = document.querySelector('.player__right')!;
    expect(right.contains(head)).toBe(true);
    await waitFor(() => expect(right.querySelector('.player__notices')).toBeTruthy());
    expect(before(head, right.querySelector('.player__notices')!)).toBe(true);
  });

  it('on a phone stands above the head', async () => {
    windowOf(375);
    await findsWorld();
    await send([{ name: 'Bronze ring', qty: 1 }]);
    await openAs(sam);
    const head = await card();
    expect(before(head, document.querySelector('.player-head')!)).toBe(true);
  });

  it('shows on the Magic tab, and in the phone’s Log, but the Pack and the Scene draw no second card', async () => {
    windowOf(375);
    await findsWorld({ caster: true });
    await send([{ name: 'Bronze ring', qty: 1 }]);
    const user = await openAs(sam);
    await card();
    await user.click(await tab(/^Magic/));
    expect(await card()).toBeTruthy();
    expect(cards()).toHaveLength(1);
    await user.click(await tab(/^Log/));
    const log = await screen.findByRole('dialog', { name: 'Log' });
    expect(await within(log).findByRole('heading', { name: 'New in your pack' })).toBeTruthy();
    expect(cards()).toHaveLength(1);
    await user.click(within(log).getByRole('button', { name: 'Close' }));
    await user.click(await tab(/^Pack/));
    await screen.findByRole('heading', { name: 'New in your pack' });
    expect(cards()).toHaveLength(1);
  });

  it('"Got it" on the Player tab clears the card and the count', async () => {
    await findsWorld();
    await send([{ name: 'Bronze ring', qty: 1 }]);
    const user = await openAs(sam);
    await card();
    await waitFor(async () => expect(await packName()).toBe('Pack, 1 new'));
    await user.click(screen.getByRole('button', { name: 'Got it: New in your pack' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'New in your pack' })).toBeNull());
    await waitFor(async () => expect(await packName()).toBeNull());
    expect(world.tables.events.filter((e) => e.target_table === 'finds_seen')).toHaveLength(1);
    // The empty live region stays on the page, ready for the next find.
    expect(document.querySelector('.find-card-live[role="status"]')).toBeTruthy();
  });

  it('a find that arrives while a pop-up is open leaves the pop-up and its typing untouched, with no toast', async () => {
    await findsWorld();
    const user = await openAs(sam);
    await user.click(await screen.findByRole('button', { name: 'Hit points not set yet. Type them' }));
    const pop = await screen.findByRole('dialog');
    const field = within(pop).getAllByRole('spinbutton')[0]!;
    await user.type(field, '18');
    await send([{ name: 'Bronze ring', qty: 1 }]);
    expect(await card()).toBeTruthy();
    expect(screen.getByRole('dialog')).toBe(pop);
    expect((field as HTMLInputElement).value).toBe('18');
    expect(document.activeElement).toBe(field);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('"and N more" opens the Pack at its new rows, from the Player tab', async () => {
    const seen = vi.fn();
    Element.prototype.scrollIntoView = seen;
    await findsWorld();
    await send(five);
    const user = await openAs(sam);
    await card().catch(() => undefined);
    await user.click(await screen.findByRole('button', { name: 'and 2 more: show them in your pack' }));
    await waitFor(async () => expect((await tab(/^Pack/)).getAttribute('aria-current')).toBe('page'));
    await waitFor(() => expect(seen).toHaveBeenCalled());
    expect((seen.mock.contexts.at(-1) as Element).querySelector('.pack__new')).toBeTruthy();
  });

  it('"and N more" opens the Pack from the Scene too', async () => {
    await findsWorld();
    await send(five);
    const user = await openAs(sam);
    await user.click(await tab(/^Scene/));
    await user.click(await screen.findByRole('button', { name: 'and 2 more: show them in your pack' }));
    await waitFor(async () => expect((await tab(/^Pack/)).getAttribute('aria-current')).toBe('page'));
  });

  it('the GM’s view of the character as the player draws no card', async () => {
    await findsWorld();
    await send([{ name: 'Bronze ring', qty: 1 }], gm);
    const user = await openAs(gm);
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
    await user.click(await screen.findByRole('button', { name: 'View Wren’s sheet' }));
    await screen.findByRole('heading', { name: /Wren/ });
    // Long enough for a read of what is new to have come back, had there been one.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('heading', { name: 'New in your pack' })).toBeNull();
    expect(document.querySelector('.find-card-live')).toBeNull();
  });
});
