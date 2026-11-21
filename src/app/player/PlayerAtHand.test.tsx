// @vitest-environment jsdom
// dec-13 C9 (docs/plans/dec-13-the-player-screen.md; ps-9, frames P1 and P2 of december/14, approved 2026-11-14): the
// light in At hand. Against the shared P1-like character (Brannoch, the storm lantern lit with 4 of 6 turns left, three
// flasks of lamp oil, the spear in hand, the eel knife pinned). Invented names only. Purposes:
//   The lit light sits in At hand, and the Player screen has no "Light" heading and no Light section while it burns.
//   The light's line carries the count of refills ("Lit, 4 turns left. 3 refills left"), with the lit toggle on its
//   row, Keep lit and Refill under it (C7's parts, kept).
//   The light comes after At hand's own rows (the pinned knife; the spear in hand is its own block above At hand since
//   C14), as frame P1 draws it after the bow,
//   and before a pinned trait (P1: bow, lantern, wand, pinned trait).
//   While the lantern burns its item row is left out, so the light's name opens the lantern's sheet (Unpin and all).
//   A lit lantern held in hand shows once in At hand: the light's row, never a second row with Put out.
//   With nothing else at hand, the lit light alone makes the At hand section.
//   Put out with its toggle, the light leaves At hand and the Light section's not-lit state shows as before (its
//   unlit, burnt-out and pick states are not drawn by the frames, so they stay as they are; C7's Departures).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../../core/files.ts';
import { createFakeDb, type FakeWorld } from '../../testing/fakeDb.ts';
import { addP1Character, P1_CAMPAIGN } from '../../testing/layoutP1Character.ts';
import { Root } from '../App.tsx';
import { forgetCampaignSetting } from '../campaignSetting.ts';

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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fenPack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;

/** Brannoch, as the layout page's ?p1=1 makes him; `change` adjusts his pack lines before the screen opens. */
async function brannoch(change: (lines: FakeWorld['tables']['inventory_lines']) => void = () => undefined) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  await addP1Character(world, { gm, sam, fenPack });
  change(world.tables.inventory_lines);
  world.signInAs(sam);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
  await screen.findByRole('region', { name: 'Vitals' });
  const atHand = await screen.findByRole('region', { name: 'At hand' });
  await within(atHand).findByRole('img', { name: /^Storm lantern, lit/ });
  return { user, atHand };
}

const lineOf = (lines: FakeWorld['tables']['inventory_lines'], id: string) => lines.find((l) => l.id === id)!;

describe('the light in At hand (dec-13 C9)', () => {
  // Purpose: the lit light sits in At hand, and there is no "Light" heading and no Light section while it burns.
  it('sits in At hand with no Light heading', async () => {
    const { atHand } = await brannoch();
    expect(within(atHand).getByRole('img', { name: 'Storm lantern, lit, 4 turns left' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Light' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Light' })).toBeNull();
  });

  // Purpose: the light's line carries the count of refills, with the lit toggle, Keep lit and Refill in At hand.
  it('reads the refills in its line, with its toggle, Keep lit and Refill', async () => {
    const { atHand } = await brannoch();
    const inHand = within(atHand);
    expect(inHand.getByText('Lit, 4 turns left. 3 refills left')).toBeTruthy();
    expect(inHand.getByRole('switch', { name: 'Storm lantern: lit' }).getAttribute('aria-checked')).toBe('true');
    expect(inHand.getByRole('switch', { name: 'Keep lit' })).toBeTruthy();
    expect(inHand.getByRole('button', { name: 'Refill' })).toBeTruthy();
    // Refill's button carries only its word: the count is in the line.
    expect(inHand.queryByRole('button', { name: /Refill \(/ })).toBeNull();
  });

  // Purpose: the light comes after At hand's own rows, the pinned knife (the spear in hand is its own block above, C14).
  it("comes after At hand's own rows", async () => {
    const { atHand } = await brannoch();
    const order = (el: Element) => [...atHand.querySelectorAll('*')].indexOf(el);
    const ring = within(atHand).getByRole('img', { name: /^Storm lantern, lit/ });
    expect(order(within(atHand).getAllByRole('button', { name: /^Eel knife/ })[0]!)).toBeLessThan(order(ring));
  });

  // Purpose: a lit lantern held in hand shows once in At hand: the light's row, never a second row with Put out.
  it('shows a lantern held in hand once, with no Put out', async () => {
    const { atHand } = await brannoch((lines) => {
      lineOf(lines, 'line-p1-lantern').equipped = true;
    });
    expect(within(atHand).getAllByText('Storm lantern')).toHaveLength(1);
    expect(within(atHand).queryByRole('button', { name: /Put out/ })).toBeNull();
    expect(within(atHand).getByRole('switch', { name: 'Storm lantern: lit' })).toBeTruthy();
  });

  // Purpose: with nothing else at hand, the lit light alone makes the At hand section.
  it('makes At hand by itself when nothing else is at hand', async () => {
    const { atHand } = await brannoch((lines) => {
      lineOf(lines, 'line-p1-spear').equipped = false;
      lineOf(lines, 'line-p1-knife').pinned = false;
    });
    expect(within(atHand).getByRole('heading', { name: 'At hand' })).toBeTruthy();
    expect(within(atHand).queryByRole('button', { name: /^Reed spear|^Eel knife/ })).toBeNull();
    expect(within(atHand).getByText('Lit, 4 turns left. 3 refills left')).toBeTruthy();
  });

  // Purpose: put out with its toggle, the light leaves At hand and the Light section's not-lit state shows as before.
  it('leaves At hand when put out, and the not-lit state shows as before', async () => {
    const { user, atHand } = await brannoch();
    await user.click(within(atHand).getByRole('switch', { name: 'Storm lantern: lit' }));
    const light = await screen.findByRole('region', { name: 'Light' });
    expect(within(light).getByRole('button', { name: 'Light' })).toBeTruthy();
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'At hand' })).queryByRole('img', { name: /^Storm lantern, lit/ })).toBeNull());
  });
  // Purpose: items, then the light, then a pinned trait, in that order (frame P1: bow, lantern, wand, pinned trait).
  it('puts the light after the items and before a pinned trait', async () => {
    const { atHand } = await brannoch(() => {
      world.tables.character_play[0]!.pins = [{ kind: 'trait', key: 'Steady flame' }];
    });
    const order = (el: Element) => [...atHand.querySelectorAll('*')].indexOf(el);
    const ring = within(atHand).getByRole('img', { name: /^Storm lantern, lit/ });
    const trait = await within(atHand).findByRole('button', { name: 'Use Steady flame' });
    expect(order(within(atHand).getAllByRole('button', { name: /^Eel knife/ })[0]!)).toBeLessThan(order(ring));
    expect(order(ring)).toBeLessThan(order(trait));
  });

  // Purpose: while the lantern burns its row is left out, so the light's name opens the lantern's item sheet, with Unpin.
  it("opens the lantern's sheet from the light's name, with Unpin when it's pinned", async () => {
    const { user, atHand } = await brannoch((lines) => {
      lineOf(lines, 'line-p1-lantern').pinned = true;
    });
    // The lantern still shows once: the light's name, no item row of its own.
    expect(within(atHand).getAllByText('Storm lantern')).toHaveLength(1);
    await user.click(within(atHand).getByRole('button', { name: 'Storm lantern' }));
    const sheet = await screen.findByRole('dialog', { name: 'Storm lantern' });
    expect(within(sheet).getByRole('button', { name: 'Unpin' })).toBeTruthy();
  });

  // Purpose (the second review of the Player stack): a burning light that is At hand itself (pinned) and has another
  // action (here charges) keeps its At hand row with that action (Use a charge), in its own place in At hand's order
  // (after the pinned Eel knife), only without a light button of its own.
  it('keeps the row of a pinned lit light that has charges, in its place, with Use a charge and no light button', async () => {
    const { atHand } = await brannoch((lines) => {
      const lantern = lineOf(lines, 'line-p1-lantern');
      lantern.pinned = true;
      lantern.item_data = { lightTypeId: 'storm-lantern', charges: { initial: 3 } };
      lantern.charges_left = 2;
    });
    const order = (el: Element) => [...atHand.querySelectorAll('*')].indexOf(el);
    const use = within(atHand).getByRole('button', { name: 'Use a charge of Storm lantern' });
    expect(order(within(atHand).getAllByRole('button', { name: /^Eel knife/ })[0]!)).toBeLessThan(order(use));
    expect(within(atHand).queryByRole('button', { name: /^(Put out|Light) / })).toBeNull();
    // The light's rows still show the lantern lit.
    expect(within(atHand).getByRole('switch', { name: 'Storm lantern: lit' })).toBeTruthy();
  });

  // Purpose (round 2 of the review): a lit lantern with charges that is not At hand (not pinned, not in hand) draws no
  // row of its own: its line is in At hand only for its sheet.
  it('draws no row for a lit, charged light that is not At hand', async () => {
    const { atHand } = await brannoch((lines) => {
      const lantern = lineOf(lines, 'line-p1-lantern');
      lantern.item_data = { lightTypeId: 'storm-lantern', charges: { initial: 3 } };
      lantern.charges_left = 2;
    });
    expect(within(atHand).queryByRole('button', { name: 'Use a charge of Storm lantern' })).toBeNull();
    expect(within(atHand).getAllByText('Storm lantern')).toHaveLength(1);
  });

  // Purpose (round 2 of the review): a lit lantern with charges that the player hid with "Hide from At hand" draws no
  // row, even in hand: the hiding holds.
  it('draws no row for a lit, charged light hidden from At hand', async () => {
    const { atHand } = await brannoch((lines) => {
      const lantern = lineOf(lines, 'line-p1-lantern');
      lantern.equipped = true;
      lantern.at_hand_hidden = true;
      lantern.item_data = { lightTypeId: 'storm-lantern', charges: { initial: 3 } };
      lantern.charges_left = 2;
    });
    expect(within(atHand).queryByRole('button', { name: 'Use a charge of Storm lantern' })).toBeNull();
    expect(within(atHand).getAllByText('Storm lantern')).toHaveLength(1);
  });

  // Purpose: a pinned stack of lights whose only action is the light toggle is still left out while one burns: the
  // light's rows stand for it, and the light's name opens the stack's sheet.
  it('leaves out a pinned stack of lights whose only action is the light, and its name opens the sheet', async () => {
    const { user, atHand } = await brannoch((lines) => {
      const lantern = lineOf(lines, 'line-p1-lantern');
      lantern.pinned = true;
      lantern.qty = 3;
      lantern.stack = 5;
    });
    expect(within(atHand).getAllByText('Storm lantern')).toHaveLength(1);
    expect(within(atHand).queryByText('×3')).toBeNull();
    expect(within(atHand).queryByRole('button', { name: /^(Put out|Light) / })).toBeNull();
    await user.click(within(atHand).getByRole('button', { name: 'Storm lantern' }));
    expect(await screen.findByRole('dialog', { name: 'Storm lantern' })).toBeTruthy();
  });
});
