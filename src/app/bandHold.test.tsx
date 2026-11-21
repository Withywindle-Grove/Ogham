// @vitest-environment jsdom
// st-11 (the lead's ruling on #807, 2026-11-14): right after Start expedition the band's button changes as the scene
// reloads (the town's step becomes the expedition's), so a tap in that moment could land on the old button. The band's
// button HOLDS (ignores the tap) until the reload lands; it is never disabled. Invented rules only.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { typePlace } from '../testing/pickPlace.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

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

/** A GM in town (Adventure, no expedition) with one invented mode that goes by the day: its step is "Next day" in town and on the road alike. */
function inTown() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.tables.packs.push({ id: 'pack-road', owner_user_id: gm, campaign_id: null, name: 'Road Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-road-rules',
    pack_id: 'pack-road',
    kind: 'rulesSet',
    pack_entry_id: 'road-rules',
    name: 'Road rules',
    data: { id: 'road-rules', name: 'Road rules', exploration: { modes: [{ id: 'road', name: 'On the road', step: { value: 1, unit: 'day' }, procedure: [], checks: [] }] } },
  });
  world.tables.campaign_packs.push({ id: 'link-road', campaign_id: campaign, pack_id: 'pack-road', pack_name: 'Road Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.campaigns.find((c) => c.id === campaign)!.mode = 'adventure';
  return { gm, campaign };
}

const band = () => within(screen.getByRole('region', { name: 'Time' }));

describe("the band's button holds after Start expedition (st-11)", () => {
  // Purpose: taps on the band's "Next day" between Start expedition and the scene's reload are ignored: the town's
  // step never runs, and the button was there and tappable (not disabled) the whole time.
  it('ignores a tap on the old button while the scene reloads, and never disables it', async () => {
    const { gm } = inTown();
    world.signInAs(gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Start session' }));
    await screen.findByText('Session 1.');
    const townHeading = band().getByRole('heading', { level: 2 }).textContent;
    const before = world.tables.events.length;

    await user.click(band().getByRole('button', { name: 'Depart' }));
    // B7: Where? is picked before Start (⚑ 4).
    await typePlace(user, 'Bog Ford', /^Where\?:/, within(screen.getByRole('dialog', { name: /Depart$/ })));
    fireEvent.click(within(screen.getByRole('dialog', { name: /Depart$/ })).getByRole('button', { name: 'Start' }));
    // Tap "Next day" again and again until the reload lands (the heading changes), as a hurried GM would.
    let taps = 0;
    await waitFor(
      () => {
        const heading = band().getByRole('heading', { level: 2 }).textContent;
        if (heading === townHeading) {
          const next = band().getByRole('button', { name: 'Advance time' });
          expect(next.hasAttribute('disabled')).toBe(false);
          fireEvent.click(next);
          taps += 1;
        }
        expect(heading).not.toBe(townHeading);
      },
      { interval: 1 },
    );
    expect(taps).toBeGreaterThan(0);
    const after = world.tables.events.slice(before).map((e) => String(e.type));
    expect(after).toContain('expedition.start');
    // No step of the clock ran: neither the town's nor (since the taps stopped as the reload landed) the expedition's.
    expect(after.filter((t) => t.startsWith('time.'))).toEqual([]);
  });
});
