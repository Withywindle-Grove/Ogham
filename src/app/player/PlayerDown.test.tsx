// @vitest-environment jsdom
// "Down" as a Status ring in the Player tab's head (#165; pss-7, psb-1, psb-2; ⚑ 1 of #165 ruled B, 2026-11-28: no tap
// until M6 builds the death panel). Purposes, in plain words:
//   At the rules' `death.at` the head shows a "Down" ring, first among the rings; it is a status, not a button.
//   Taking damage down to `death.at` brings the ring at once; healing above it takes the ring away.
//   With no `death.at` in the rules, 0 hit points shows no Down ring.
//   With many statuses, Down counts among the rings in view and the "+N": three in view on a phone, four on a tablet.
//   The "Down" toast stays as built.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../../core/files.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { Root } from '../App.tsx';
import { forgetCampaignSetting } from '../campaignSetting.ts';

vi.mock('../services.ts', async () => {
  const { createAppRegistry } = await import('../commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;

/** A window this many pixels wide (jsdom has no layout): matchMedia answers min-width and max-width queries. */
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
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  windowOf(375);
});

afterEach(() => {
  cleanup();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

/** Sam plays Wren (`current` of 9 hit points) in The Ash Barrows; `downAt`: the rules set's `death.at` (none: no rule). */
function table({ current, downAt, statuses = [] }: { current: number; downAt?: number; statuses?: string[] }) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
  Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: current, hp_max: 9 });
  world.addMember(campaign, sam, 'player', wren);
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  const rules = downAt === undefined ? { id: 'fen-rules', name: 'Fen rules' } : { id: 'fen-rules', name: 'Fen rules', death: { at: downAt, belowZero: false, note: 'Down at nothing left.' } };
  world.tables.library_entries.push({ id: 'entry-rules', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data: rules });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  return { gm, sam, campaign, wren, statuses };
}

async function withStatuses(t: ReturnType<typeof table>) {
  world.signInAs(t.gm);
  for (const name of t.statuses) await world.db.rpc('add_status', { campaign: t.campaign, actors: [t.wren], status_name: name });
  world.signInAs(t.sam);
}

async function openPlayer(t: ReturnType<typeof table>): Promise<User> {
  await withStatuses(t);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await screen.findByRole('region', { name: 'Vitals' });
  return user;
}

const head = () => document.querySelector<HTMLElement>('.player-head')!;
const downRing = () => within(head()).queryByRole('img', { name: 'Down' });
const ringsInView = () => head().querySelectorAll('.status-ring-row > .status-ring').length;
const damage = (user: User) => user.click(screen.getByRole('button', { name: 'Take 1 damage' }));
const heal = (user: User) => user.click(screen.getByRole('button', { name: 'Heal 1' }));

describe('Down in the head', () => {
  it('at death.at the head shows a Down ring, first, a status and not a button', async () => {
    await openPlayer(table({ current: 0, downAt: 0, statuses: ['Soaked'] }));
    const ring = await within(head()).findByRole('img', { name: 'Down' });
    const row = within(head()).getByRole('group', { name: 'Statuses' });
    expect(row.querySelector('.status-ring')).toBe(ring);
    expect(ring.tagName).not.toBe('BUTTON');
    expect(ring.closest('button')).toBeNull();
    // One or two rings read their name beside the ring: "Down" in words, the skull's ring in the harm tone.
    expect(ring.textContent).toBe('Down');
    expect(ring.querySelector('.status-ring__mark')?.getAttribute('data-tone')).toBe('harm');
    expect(ring.querySelector('.status-ring__track--endless')).not.toBeNull();
    expect(ring.querySelector('.status-ring__arc')).toBeNull();
    // The other status is still its own button, after Down.
    expect(within(row).getByRole('button', { name: /^Soaked/ })).toBeTruthy();
  });

  it('Down alone, with no other status, still shows', async () => {
    await openPlayer(table({ current: -2, downAt: 0 }));
    expect(await within(head()).findByRole('img', { name: 'Down' })).toBeTruthy();
    expect(ringsInView()).toBe(1);
  });

  it('damage down to death.at brings the ring at once; healing above it takes it away; the toast still says Down', async () => {
    const user = await openPlayer(table({ current: 2, downAt: 0 }));
    expect(downRing()).toBeNull();
    await damage(user);
    expect(downRing()).toBeNull();
    await damage(user);
    expect(screen.getByText('Took 2 damage, 0 of 9: Down')).toBeTruthy();
    expect(downRing()).not.toBeNull();
    // After the burst is sent and the character read again, it stays.
    await vi.waitFor(() => expect(world.tables.actors.find((a) => a.name === 'Wren')?.hp_current).toBe(0), { timeout: 4000 });
    expect(downRing()).not.toBeNull();
    await heal(user);
    expect(downRing()).toBeNull();
  });

  it('with no death.at in the rules, 0 hit points shows no Down ring', async () => {
    await openPlayer(table({ current: 0, statuses: ['Soaked'] }));
    await within(head()).findByRole('button', { name: /^Soaked/ });
    expect(downRing()).toBeNull();
  });

  it('on a phone with six statuses, Down and two more in view, then "+4"', async () => {
    await openPlayer(table({ current: 0, downAt: 0, statuses: ['Muddy boots', 'Reed-cut', 'Mist-dazed', 'Soaked', 'Watchful', 'Heartened'] }));
    expect(await within(head()).findByRole('img', { name: 'Down' })).toBeTruthy();
    expect(ringsInView()).toBe(3);
    expect(head().querySelector('.status-ring')?.getAttribute('aria-label')).toBe('Down');
    expect(within(head()).getByRole('button', { name: '4 more: see every status' }).textContent).toBe('+4');
  });

  it('on a tablet with six statuses, Down and three more in view, then "+3"', async () => {
    windowOf(1366);
    await openPlayer(table({ current: 0, downAt: 0, statuses: ['Muddy boots', 'Reed-cut', 'Mist-dazed', 'Soaked', 'Watchful', 'Heartened'] }));
    expect(await within(head()).findByRole('img', { name: 'Down' })).toBeTruthy();
    expect(ringsInView()).toBe(4);
    expect(within(head()).getByRole('button', { name: '3 more: see every status' })).toBeTruthy();
  });

  it('three statuses and Down on a tablet: all four in view, no "+N"', async () => {
    windowOf(1366);
    await openPlayer(table({ current: 0, downAt: 0, statuses: ['Muddy boots', 'Reed-cut', 'Soaked'] }));
    expect(await within(head()).findByRole('img', { name: 'Down' })).toBeTruthy();
    expect(ringsInView()).toBe(4);
    expect(within(head()).queryByRole('button', { name: /more: see every status/ })).toBeNull();
  });
});
