// @vitest-environment jsdom
// Gate walk 2026-11-06 (Start expedition): the GM tapped Start expedition and only the time strip changed; the rest of
// Scene (the place card, the day's travel) showed only after leaving the tab and coming back. The strip's own changes
// reloaded the strip alone and left the rest of Scene to the live connection's echo, which a tablet can miss. Against
// the stand-in database with the invented Mirewalk rules, with the live connection silent:
//   After Start expedition in a day-by-day mode, the travel card's Move… shows on the same screen at once.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { mireRules } from '../modules/expedition/fixtures.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { startExpedition } from '../testing/depart.ts';

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
  vi.restoreAllMocks();
});

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const ash = world.addCharacter(campaign, 'Ash');
  world.tables.campaigns[0]!.settings = { encumbrance: { mode: 'coin' } };
  world.tables.packs.push({ id: 'pack-mire', owner_user_id: gm, campaign_id: null, name: 'Mirewalk Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const data = { ...mireRules, encumbrance: { mode: 'coin', coin: { tiers: [{ label: 'Light', max: 450, effect: 'Nothing slows you', movement: '115 ft' }] } } };
  world.tables.library_entries.push({ id: 'entry-mire', pack_id: 'pack-mire', kind: 'rulesSet', pack_entry_id: 'mire-rules', name: 'Mirewalk rules', data });
  world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaign, pack_id: 'pack-mire', pack_name: 'Mirewalk Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.carrier_loads.push({ actor_id: ash, campaign_id: campaign, tier: 'Light', load: 0, version: 1 });
  return { gm };
}

/** A live connection that connects but never delivers anything (a tablet that missed the echo). */
function silenceLive() {
  const silent = {
    on: () => silent,
    subscribe: (onStatus?: (status: string) => void) => {
      queueMicrotask(() => onStatus?.('SUBSCRIBED'));
      return silent;
    },
    watcher: null,
  };
  vi.spyOn(world.db, 'channel').mockImplementation((() => silent) as never);
}

describe('Start expedition reloads the whole Scene on this device (gate walk 2026-11-06)', () => {
  it('after Start expedition, the travel card shows at once, without the live echo', async () => {
    const { gm } = table();
    silenceLive();
    world.signInAs(gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: 'Scene' }));
    // The GM's band reads "No session yet" before the first session (st-2).
    await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
    await startExpedition(user);
    expect(await screen.findByRole('button', { name: 'Move…' }, { timeout: 3000 })).toBeTruthy();
  });
});
