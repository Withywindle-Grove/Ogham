// @vitest-environment jsdom
// st-11 (the lead's ruling on #807, 2026-11-14): after Start expedition the band's button holds (ignores a tap) until
// the reload lands; it is never disabled. A town read begun BEFORE Start (here a coming-back reload, as the log's settle
// reload would be) that lands as Start's command finishes is not that reload: the hold must outlast it. The reads are
// held and let go by the test, so the race runs the same way every time (fix-bandhold; PR #1071's repro). Invented rules only.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

// The scene's reads: while `gate.holding`, each read is made at once (so it says what the database says when it begins)
// but answers only when the test lets it go.
const gate = vi.hoisted(() => ({ holding: false, waiting: [] as (() => void)[] }));
const letGo = () => gate.waiting.splice(0).forEach((go) => go());
vi.mock('../modules/expedition/play.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../modules/expedition/play.ts')>();
  return {
    ...real,
    loadScene: (...args: Parameters<typeof real.loadScene>) => {
      const read = real.loadScene(...args);
      if (!gate.holding) return read;
      return new Promise<Awaited<typeof read>>((answer) => gate.waiting.push(() => void read.then(answer)));
    },
  };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
  gate.holding = false;
  gate.waiting.length = 0;
});

afterEach(() => {
  gate.holding = false;
  letGo();
  cleanup();
});

/** A GM in town (Adventure, no expedition) with one invented mode that goes by the day. */
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

describe("the band's hold outlasts an older town read (st-11)", () => {
  // Purpose: a town read begun before Start expedition that lands as Start's command finishes does not release the
  // band's hold: a tap on the town's old "Advance time" in that moment steps no clock, and the button is never disabled.
  it('ignores a tap on the old button when a read begun before Start lands as Start finishes', async () => {
    const { gm } = inTown();
    world.signInAs(gm);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Start session' }));
    await screen.findByText('Session 1.');
    const townHeading = band().getByRole('heading', { level: 2 }).textContent;

    // From here every read waits: a town read begins (the screen coming back reloads what's on it), and any town read
    // after it (the log's settle reload) waits too.
    gate.holding = true;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(gate.waiting.length).toBeGreaterThan(0));

    await user.click(band().getByRole('button', { name: 'Depart' }));
    await typePlace(user, 'Bog Ford', /^Where\?:/, within(screen.getByRole('dialog', { name: /Depart$/ })));
    // The town reads begun before Start land the moment Start's command writes its event; the reload after Start waits.
    const events = world.tables.events;
    const push = events.push.bind(events);
    events.push = (...added) => {
      const n = push(...added);
      if (added.some((e) => e.type === 'expedition.start')) letGo();
      return n;
    };
    const before = events.length;
    fireEvent.click(within(screen.getByRole('dialog', { name: /Depart$/ })).getByRole('button', { name: 'Start' }));
    // Start's command is done (its event written, which let every waiting read go), and its reload has begun since
    // (and waits): the town's top still shows.
    await waitFor(() => expect(events.slice(before).map((e) => String(e.type))).toContain('expedition.start'));
    await waitFor(() => expect(gate.waiting.length).toBeGreaterThan(0));
    expect(band().getByRole('heading', { level: 2 }).textContent).toBe(townHeading);

    // A hurried tap on the old button: there and tappable, and ignored.
    const next = band().getByRole('button', { name: 'Advance time' });
    expect(next.hasAttribute('disabled')).toBe(false);
    fireEvent.click(next);
    await new Promise((settle) => setTimeout(settle, 20));

    // The reload lands.
    gate.holding = false;
    act(() => letGo());
    await waitFor(() => expect(band().getByRole('heading', { level: 2 }).textContent).not.toBe(townHeading));
    expect(events.slice(before).filter((e) => String(e.type).startsWith('time.'))).toEqual([]);
  });
});
