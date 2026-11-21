// @vitest-environment jsdom
// M5b step 6.0, the town switches (ruled 2026-11-03, sw-1 … sw-4), clicked through like a person would, against the
// stand-in database. Invented rules only.
//   The GM's ⋯ has Out and about today and Active tonight while the mode has a check that reads one; a flip is one
//   Simple log line with Undo on its toast, and the strip shows a quiet marker while one is on.
//   Off, a check with onlyWhen gets no line on the card; on, it does; a check without onlyWhen comes due either way.
//   Next day reaches the morning: both switches turn off, logged, with a line on the card. (Start downtime turns them
//   off too: since M5b step 6a it is its own tap, timeInTown.test.tsx.)
//   A player's Scene shows the quiet line while a switch is on, and nothing about the checks; their ⋯ has no switch.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeEventTag } from '../core/eventTags.ts';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { notWaiting, openDue, openWaiting } from '../testing/openWaiting.ts';
import { departModes, startExpedition } from '../testing/depart.ts';

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

/** A GM, a player with Wren, and invented rules: a market town a day at a time, with a check for the day out, one for the night, and one that always runs. */
function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  world.tables.packs.push({ id: 'pack-quay', owner_user_id: gm, campaign_id: null, name: 'Quay Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-quay-rules',
    pack_id: 'pack-quay',
    kind: 'rulesSet',
    pack_entry_id: 'quay-rules',
    name: 'Quay rules',
    data: {
      id: 'quay-rules',
      name: 'Quay rules',
      exploration: {
        modes: [
          {
            id: 'quay',
            name: 'In the quay',
            step: { value: 1, unit: 'day' },
            procedure: [
              { id: 'market', name: 'Market day', icon: 'encounter', kind: 'check', checkId: 'quay-day' },
              { id: 'lamps', name: 'After the lamps', icon: 'encounter', kind: 'check', checkId: 'quay-night' },
              { id: 'gulls', name: 'Gulls', icon: 'note', kind: 'check', checkId: 'quay-gulls' },
            ],
            checks: [
              { id: 'quay-day', name: 'Market trouble', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1, 2] }, onlyWhen: 'outDay' },
              { id: 'quay-night', name: 'Lamplit trouble', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1] }, onlyWhen: 'activeNight' },
              { id: 'quay-gulls', name: 'Gull thieves', every: { value: 1, unit: 'day' }, chance: { die: 'd6', on: [1] } },
            ],
          },
          { id: 'cellars', name: 'Under the quay', step: { value: 1, unit: 'turn' }, procedure: [], checks: [] },
        ],
      },
    },
  });
  world.tables.campaign_packs.push({ id: 'link-quay', campaign_id: campaign, pack_id: 'pack-quay', pack_name: 'Quay Rules', option_choices: {}, overrides: {}, priority: 1 });
  const row = () => world.tables.campaigns.find((c) => c.id === campaign)!;
  return { gm, sam, campaign, wren, row };
}

async function openGm(gm: string) {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  // The GM's band reads "No session yet" before the first session (st-2).
  await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
  return user;
}

async function startIn(user: ReturnType<typeof userEvent.setup>, mode: string) {
  // Next turn / Next day and the heading's count need a running session (st-1, st-2): the GM starts one first.
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Session 1.');
  await user.click((await departModes(user)).getByRole('button', { name: mode }));
  await startExpedition(user);
}

const strip = () => within(screen.getByRole('region', { name: 'Time' }));
const card = () => screen.queryByRole('region', { name: 'Due' });
const tag = (type: string) => encodeEventTag({ type, level: 'simple', requestId: crypto.randomUUID() });
const menuItem = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(within(document.querySelector('.more-menu__panel') as HTMLElement).getByRole('button', { name }));
};
const toastUndo = async (text: string) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });

describe('the town switches (sw-1 … sw-4)', () => {
  it('a flip from ⋯ is kept with the campaign, logged Simple, marked on the strip, and Undo puts it back', async () => {
    const { gm, row } = table();
    const user = await openGm(gm);
    await startIn(user, 'In the quay');
    await screen.findByRole('heading', { name: /In the quay, day 1/ });
    await menuItem(user, 'Out and about today: Off');
    const undo = await toastUndo('Out and about today: On');
    expect(row().out_day).toBe(true);
    expect(strip().getByText('Out and about today')).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'town.outDay').map((e) => e.level)).toEqual(['simple']);
    await user.click(undo);
    await waitFor(() => expect(row().out_day).toBe(false));
    await waitFor(() => expect(strip().queryByText('Out and about today')).toBeNull());
  });

  // Purpose (sm-1): lighting one half dims the other on the screen at once, not only after the switches are read again.
  it('lighting one half dims the other on the strip and in ⋯ at once', async () => {
    const { gm, row } = table();
    const user = await openGm(gm);
    await startIn(user, 'In the quay');
    await screen.findByRole('heading', { name: /In the quay, day 1/ });
    await menuItem(user, 'Active tonight: Off');
    await screen.findByText('Active tonight: On');
    await menuItem(user, 'Out and about today: Off');
    // The lead's words (sm-1): the toast names the half it put out, the tapped one first.
    const undo = await toastUndo('Out and about today: On. Active tonight: Off.');
    expect(strip().getByText('Out and about today')).toBeTruthy();
    expect(strip().queryByText(/Active tonight/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    expect(within(document.querySelector('.more-menu__panel') as HTMLElement).getByRole('button', { name: 'Active tonight: Off' })).toBeTruthy();
    expect(row()).toMatchObject({ out_day: true, active_night: false });
    await user.keyboard('{Escape}');
    await user.click(undo);
    await waitFor(() => expect(row()).toMatchObject({ out_day: false, active_night: true }));
  });

  it('off, the onlyWhen checks stay off the card; on, they come due; the always check comes due either way', async () => {
    const { gm } = table();
    const user = await openGm(gm);
    await startIn(user, 'In the quay');
    // Wait for the band to settle on the new expedition (its Next day button is replaced while it loads).
    await screen.findByRole('heading', { name: /In the quay, day 1/ });
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    // S8b: each line of the card is its own item of "Waiting for you", opened to be read (past four, from "N more").
    await waitFor(() => openWaiting(user, 'Gull thieves'));
    expect(within(card()!).getByRole('button', { name: 'Hit, Gull thieves' })).toBeTruthy();
    expect(await notWaiting(user, /^Market trouble( ×\d+)?$/)).toBe(true);
    expect(await notWaiting(user, /^Lamplit trouble( ×\d+)?$/)).toBe(true);

    await menuItem(user, 'Active tonight: Off');
    await screen.findByText('Active tonight: On');
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    await waitFor(() => openWaiting(user, 'Lamplit trouble'));
    expect(within(card()!).getByRole('button', { name: 'Hit, Lamplit trouble' })).toBeTruthy();
    expect(await notWaiting(user, /^Market trouble( ×\d+)?$/)).toBe(true);
  });

  it('Next day reaches the morning: both switches turn off, logged, with a line on the card', async () => {
    const { gm, row } = table();
    const user = await openGm(gm);
    await startIn(user, 'In the quay');
    await screen.findByRole('heading', { name: /In the quay, day 1/ });
    await menuItem(user, 'Out and about today: Off');
    await screen.findByText('Out and about today: On');
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    // S8b: each line of the card is its own item of "Waiting for you", opened to be read.
    await waitFor(() => openWaiting(user, 'Market trouble'));
    expect(within(card()!).getByRole('button', { name: 'Hit, Market trouble' })).toBeTruthy();
    await waitFor(() => expect(row().out_day).toBe(false));
    expect(world.tables.events.filter((e) => e.type === 'town.reset').map((e) => e.level)).toEqual(['simple']);
    expect((await openDue(user, /Out and about ended, morning/)).getByText(/Out and about ended, morning/)).toBeTruthy();
    expect(strip().queryByText('Out and about today')).toBeNull();
  });

  it('the switches show in ⋯ only while the mode has a check that reads one, or while one is on', async () => {
    const { gm, campaign, row } = table();
    const user = await openGm(gm);
    await startIn(user, 'Under the quay');
    await screen.findByRole('heading', { name: /The Mustering Field, turn 1/ });
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    expect(screen.queryByRole('button', { name: /Out and about today/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Active tonight/ })).toBeNull();
    await user.keyboard('{Escape}');
    // Left on from before: it shows, so the GM can turn it off.
    world.signInAs(gm);
    await world.db.from('campaigns').update({ active_night: true }).eq('id', campaign).select('id');
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: /The Mustering Field, turn 2/ });
    await menuItem(user, 'Active tonight: On');
    await waitFor(() => expect(row().active_night).toBe(false));
  });

  it("a player's Scene shows the quiet line while a switch is on, and nothing about the checks", async () => {
    const { gm, sam, campaign, row } = table();
    world.signInAs(gm);
    await world.db.rpc('start_expedition', { campaign, mode_id: 'quay' }).setHeader('x-grimoire-command', tag('expedition.start'));
    Object.assign(row(), { out_day: true });
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
    expect(await strip().findByText('Out and about today')).toBeTruthy();
    expect(screen.queryByText(/Market trouble/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Out and about today:/ })).toBeNull();
  });
});
