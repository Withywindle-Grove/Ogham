// @vitest-environment jsdom
// dec-13 C11 (docs/plans/dec-13-the-player-screen.md; the self-review's states; frames P1 and P2 of december/14,
// ps-9, whose parts the states are built from). Against the shared P1-like character (Brannoch) and its variants.
// Invented names only. Purposes:
//   While the screen's reads are out (the setting rules, the play state, the sheet, the pack), the Player tab shows one
//   "Opening…" and none of its parts, so nothing jumps under a finger as each arrives.
//   Once every read is in, the parts show and "Opening…" is gone.
//   When the setting rules can't be read, the Player tab says so once, with Try again, and none of its parts; Try
//   again reads them again and the screen opens.
//   On the device's stored copy of the rules (offline), the Player tab says "Setting rules as of <date>, offline".
//   A character with nothing at hand and one with no pack at all both open, with no At hand and no error.
//   (C11's review) Try again reads At hand's pack and the sheet again too; a thrown read is a failed one; the screen
//   waits for the pack and the sheet as for the rules; a failed play read says so; a later read never blanks it.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../../core/files.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { addP1Character, P1_CAMPAIGN, type P1Head } from '../../testing/layoutP1Character.ts';
import { Root } from '../App.tsx';
import { forgetCampaignSetting } from '../campaignSetting.ts';

// The reads the screen waits for, held, failed or thrown on demand; otherwise the real ones.
const rules = vi.hoisted(() => ({
  hold: null as Promise<void> | null,
  failing: false,
  throwing: false,
  asOf: null as string | null,
  sheetHold: null as Promise<void> | null,
  packHold: null as Promise<void> | null,
  playFails: 0,
}));
vi.mock('../../core/characterSheet.ts', async () => {
  const actual = await vi.importActual<typeof import('../../core/characterSheet.ts')>('../../core/characterSheet.ts');
  return {
    ...actual,
    loadCharacterSheet: async (...args: Parameters<typeof actual.loadCharacterSheet>) => {
      if (rules.sheetHold) await rules.sheetHold;
      return actual.loadCharacterSheet(...args);
    },
  };
});
vi.mock('../../modules/inventory/inventory.ts', async () => {
  const actual = await vi.importActual<typeof import('../../modules/inventory/inventory.ts')>('../../modules/inventory/inventory.ts');
  return {
    ...actual,
    loadInventory: async (...args: Parameters<typeof actual.loadInventory>) => {
      if (rules.packHold) await rules.packHold;
      return actual.loadInventory(...args);
    },
  };
});
vi.mock('../../modules/characters/playState.ts', async () => {
  const actual = await vi.importActual<typeof import('../../modules/characters/playState.ts')>('../../modules/characters/playState.ts');
  return {
    ...actual,
    loadCharacterPlay: async (...args: Parameters<typeof actual.loadCharacterPlay>) => {
      if (rules.playFails > 0) {
        rules.playFails -= 1;
        return null;
      }
      return actual.loadCharacterPlay(...args);
    },
  };
});
vi.mock('../campaignSetting.ts', async () => {
  const actual = await vi.importActual<typeof import('../campaignSetting.ts')>('../campaignSetting.ts');
  return {
    ...actual,
    loadCampaignSetting: async (...args: Parameters<typeof actual.loadCampaignSetting>) => {
      if (rules.hold) await rules.hold;
      // Every read fails while the connection is down, as a real outage would.
      if (rules.failing) return null;
      // The screen's own read throws (the one the review names); the older readers elsewhere aren't this test's.
      if (rules.throwing && new Error().stack?.includes('/PlayerScreen.tsx')) throw new Error('The rules came back broken.');
      const found = await actual.loadCampaignSetting(...args);
      return found && rules.asOf ? { ...found, asOf: rules.asOf } : found;
    },
  };
});

vi.mock('../services.ts', async () => {
  const { createAppRegistry } = await import('../commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  rules.hold = null;
  rules.failing = false;
  rules.throwing = false;
  rules.asOf = null;
  rules.sheetHold = null;
  rules.packHold = null;
  rules.playFails = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fenPack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;

/** Brannoch, as the layout page's ?p1= makes him; opens his campaign and returns at once (the screen may still read). */
async function brannoch(head: P1Head = 'four') {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  await addP1Character(world, { gm, sam, fenPack, head });
  world.signInAs(sam);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
  return { user };
}

describe('the Player screen’s states (dec-13 C11)', () => {
  // Purpose: one "Opening…" while the screen's reads are out, and none of its parts.
  it('shows one Opening… and no parts while it reads, then the parts', async () => {
    let release = () => undefined as void;
    rules.hold = new Promise<void>((done) => (release = done));
    await brannoch();
    await waitFor(() => expect(screen.getAllByRole('status').filter((s) => s.textContent === 'Opening…')).toHaveLength(1));
    expect(screen.queryByRole('region', { name: 'Vitals' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'At hand' })).toBeNull();
    release();
    // Purpose: once every read is in, the parts show and Opening… is gone.
    expect(await screen.findByRole('region', { name: 'Vitals' })).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'At hand' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Opening…')).toBeNull());
  });

  // What shows "Opening…": the parts kept mounted and hidden until the first open (the Notes row reading its notes,
  // on a phone too since tfr-5) are not shown.
  const shownOpening = () => screen.queryAllByText('Opening…').filter((e) => !e.closest('[hidden]'));

  // Purpose: rules that can't be read are said once, with Try again, and no parts; Try again opens the screen.
  it('says once that it couldn’t open, and Try again opens it', async () => {
    rules.failing = true;
    const { user } = await brannoch();
    const said = 'Couldn’t open this character. Check your connection and try again.';
    expect(await screen.findByText(said)).toBeTruthy();
    expect(screen.getAllByRole('alert').filter((a) => a.textContent === said)).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Vitals' })).toBeNull();
    expect(shownOpening()).toHaveLength(0);
    // The connection comes back.
    rules.failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Vitals' })).toBeTruthy();
    expect(screen.queryByText(said)).toBeNull();
    // Purpose (C11's review): At hand's pack and the sheet read again too, so the weapon in hand and the pinned knife
    // come back with the screen, not only the vitals.
    const atHand = await screen.findByRole('region', { name: 'At hand' });
    expect(within(atHand).getByRole('button', { name: /^Eel knife/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Weapon in hand' })).toBeTruthy();
  });

  // Purpose (C11's review): a rules read that throws counts as one that failed: the error with Try again, never
  // Opening… for ever.
  it('says once that it couldn’t open when the rules read throws', async () => {
    rules.throwing = true;
    const { user } = await brannoch();
    const said = 'Couldn’t open this character. Check your connection and try again.';
    expect(await screen.findByText(said)).toBeTruthy();
    expect(shownOpening()).toHaveLength(0);
    rules.throwing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'At hand' })).toBeTruthy();
  });

  // Purpose (C11's review): the screen waits for the pack's read and for the sheet's, each in turn, as it does the rules'.
  it.each(['pack', 'sheet'] as const)('waits for the %s read before it shows its parts', async (which) => {
    let release = () => undefined as void;
    const held = new Promise<void>((done) => (release = done));
    if (which === 'pack') rules.packHold = held;
    else rules.sheetHold = held;
    await brannoch();
    await waitFor(() => expect(screen.getAllByRole('status').filter((s) => s.textContent === 'Opening…')).toHaveLength(1));
    // Give the other reads time to land: still one Opening…, still no part.
    await new Promise((done) => setTimeout(done, 50));
    expect(screen.queryByRole('region', { name: 'Vitals' })).toBeNull();
    release();
    expect(await screen.findByRole('region', { name: 'Vitals' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Opening…')).toBeNull());
  });

  // Purpose (C11's review): a play state that can't be read says so once, with Try again, which opens the screen.
  it('says once that it couldn’t open when the play state can’t be read', async () => {
    // Every play read fails while the connection is down, until Try again.
    rules.playFails = 99;
    const { user } = await brannoch();
    expect(await screen.findByText('Couldn’t open this character. Check your connection and try again.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Vitals' })).toBeNull();
    rules.playFails = 0;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Vitals' })).toBeTruthy();
  });

  // Purpose (C11's review): after the first open, a read again (here, the way back from the Pack tab, which mounts the
  // sheet and At hand afresh) never blanks the screen.
  it('never blanks the screen on a later read', async () => {
    const { user } = await brannoch();
    await screen.findByRole('region', { name: 'At hand' });
    await waitFor(() => expect(screen.queryByText('Opening…')).toBeNull());
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    await user.click(nav.getByRole('button', { name: 'Pack' }));
    // The sheet's read, held, would blank a screen that waited again.
    rules.sheetHold = new Promise<void>(() => undefined);
    await user.click(nav.getByRole('button', { name: 'Player' }));
    expect(await screen.findByRole('region', { name: 'Vitals' })).toBeTruthy();
    // The parts stay shown (the sheet's own place may say it opens, as before C11); the screen's one line isn't back.
    expect(document.querySelector('.player__opened')!.hasAttribute('hidden')).toBe(false);
    expect(screen.getByRole('region', { name: 'At hand' })).toBeTruthy();
  });

  // Purpose: on the device's stored copy of the rules, the Player tab says so in one quiet line.
  it('says when the rules are the device’s stored copy, offline', async () => {
    rules.asOf = '2026-11-16T10:00:00Z';
    await brannoch();
    await screen.findByRole('region', { name: 'Vitals' });
    const words = `Setting rules as of ${new Date(rules.asOf).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, offline`;
    expect(screen.getByText(words)).toBeTruthy();
  });

  // Purpose: nothing at hand, and no pack at all: the screen opens with no At hand and no error.
  it.each(['bare', 'packless'] as const)('opens a character with %s, with no At hand and no error', async (head) => {
    await brannoch(head);
    const vitals = await screen.findByRole('region', { name: 'Vitals' });
    expect(vitals).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Opening…')).toBeNull());
    expect(screen.queryByRole('region', { name: 'At hand' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Weapon in hand' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // Hit points read their figure: 0 of 16 with nothing at hand, 999 of 999 with no pack.
    expect(within(vitals).getByRole('button', { name: head === 'bare' ? /^Hit points 0 of 16/ : /^Hit points 999 of 999/ })).toBeTruthy();
  });
});
