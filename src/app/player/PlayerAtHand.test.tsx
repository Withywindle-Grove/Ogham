// @vitest-environment jsdom
// dec-13 C9 (docs/plans/dec-13-the-player-screen.md; ps-9, frames P1 and P2 of december/14, approved 2026-11-14): the
// light in At hand. Against the shared P1-like character (Brannoch, the storm lantern lit with 4 of 6 turns left, three
// flasks of lamp oil, the spear in hand, the eel knife pinned). Invented names only. Purposes:
//   The light sits in At hand, and the Player screen has no "Light" heading and no Light section, lit or not (lt-4).
//   The light's line carries the count of refills ("Lit, 4 turns left. 3 refills left"), its ring the tap "Put out"
//   (lt-1; no lit toggle), Keep lit and Refill under it.
//   The light comes after At hand's own rows (the pinned knife; the spear in hand is its own block above At hand since
//   C14), as frame P1 draws it after the bow,
//   and a pinned trait no longer joins At hand (euf-3, row P3 of plans/test-feedback-2026-11-19; page 28): it is a block
//   in the right column's list instead.
//   While the lantern burns its item row is left out, so the light's name opens the lantern's sheet (Unpin and all).
//   A lit lantern held in hand shows once in At hand: the light's row, never a second row with Put out.
//   With nothing else at hand, the light alone makes the At hand section, lit or not.
//   Put out with its ring, the light stays in its place in At hand, not lit, its ring over "Light" (page 35, 35B); its
//   own item row is still left out and its name still opens its sheet. With another light, "No light lit" (⚑ 3).
//   A light that can't be read says so in its place in At hand, after the items, with no "Light" heading; with nothing
//   else at hand it alone makes At hand (⚑ 6, B; page 37, 37C).
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

/** The character's own light can't be read while `failing` says so (as when offline). */
function lightReadsFail(failing: () => boolean) {
  // A fresh world each test, so the read is swapped in place (the database's own types run too deep for a spy here).
  const stand = world.db as unknown as { from: (table: string) => unknown };
  const read = stand.from.bind(world.db);
  stand.from = (table: string) => {
    const query = read(table) as { select: (c: string) => { eq: (col: string, v: unknown) => unknown } };
    if (table !== 'character_lights') return query;
    const select = query.select.bind(query);
    query.select = (c: string) => {
      const q = select(c);
      const eq = q.eq.bind(q);
      q.eq = (col: string, v: unknown) =>
        col === 'actor_id' && failing() ? { maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) } : eq(col, v);
      return q;
    };
    return query;
  };
}

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
  await within(atHand).findByRole('button', { name: 'Put out Storm lantern' });
  return { user, atHand };
}

const lineOf = (lines: FakeWorld['tables']['inventory_lines'], id: string) => lines.find((l) => l.id === id)!;

describe('the light in At hand (dec-13 C9)', () => {
  // Purpose: the light sits in At hand, and there is no "Light" heading and no Light section, lit, not lit or several.
  it('sits in At hand with no Light heading, lit or not', async () => {
    const { user, atHand } = await brannoch((lines) => {
      lines.push({ ...lineOf(lines, 'line-p1-lantern'), id: 'line-p1-lamp', name: 'Hand lamp', created_at: '2026-11-15T09:00:59Z' });
    });
    const noHeading = () => {
      expect(screen.queryByRole('region', { name: 'Light' })).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Light' })).toBeNull();
    };
    expect(within(atHand).getByText('Lit, 4 turns left. 3 refills left')).toBeTruthy();
    noHeading();
    // Put out with a second light in the pack: "No light lit" and "Light…" in At hand (⚑ 3), still no heading.
    await user.click(within(atHand).getByRole('button', { name: 'Put out Storm lantern' }));
    expect(await within(atHand).findByRole('button', { name: 'Light: choose which' })).toBeTruthy();
    expect(within(atHand).getByText('No light lit')).toBeTruthy();
    noHeading();
  });

  // Purpose: the light's line carries the count of refills, with its ring the tap, Keep lit and Refill in At hand.
  it('reads the refills in its line, with its ring the tap, Keep lit and Refill', async () => {
    const { atHand } = await brannoch();
    const inHand = within(atHand);
    expect(inHand.getByText('Lit, 4 turns left. 3 refills left')).toBeTruthy();
    expect(inHand.getByRole('button', { name: 'Put out Storm lantern' }).textContent).toBe('Put out');
    expect(inHand.queryByRole('switch', { name: 'Storm lantern: lit' })).toBeNull();
    expect(inHand.getByRole('switch', { name: 'Keep lit' })).toBeTruthy();
    expect(inHand.getByRole('button', { name: 'Refill' })).toBeTruthy();
    // Refill's button carries only its word: the count is in the line.
    expect(inHand.queryByRole('button', { name: /Refill \(/ })).toBeNull();
  });

  // Purpose: the light comes after At hand's own rows, the pinned knife (the spear in hand is its own block above, C14).
  it("comes after At hand's own rows", async () => {
    const { atHand } = await brannoch();
    const order = (el: Element) => [...atHand.querySelectorAll('*')].indexOf(el);
    const ring = within(atHand).getByRole('button', { name: 'Put out Storm lantern' });
    expect(order(within(atHand).getAllByRole('button', { name: /^Eel knife/ })[0]!)).toBeLessThan(order(ring));
  });

  // Purpose: a lit lantern held in hand shows once in At hand: the light's row, never a second row with Put out.
  it('shows a lantern held in hand once, with no Put out', async () => {
    const { atHand } = await brannoch((lines) => {
      lineOf(lines, 'line-p1-lantern').equipped = true;
    });
    expect(within(atHand).getAllByText('Storm lantern')).toHaveLength(1);
    // One Put out: the light's ring, never the item row's.
    expect(within(atHand).getAllByRole('button', { name: /Put out/ }).map((b) => b.className)).toEqual(['status-ring-tap']);
  });

  // Purpose: with nothing else at hand, the light alone makes the At hand section, lit and then not lit.
  it('makes At hand by itself when nothing else is at hand, lit or not', async () => {
    const { user, atHand } = await brannoch((lines) => {
      lineOf(lines, 'line-p1-spear').equipped = false;
      lineOf(lines, 'line-p1-knife').pinned = false;
    });
    expect(within(atHand).getByRole('heading', { name: 'At hand' })).toBeTruthy();
    expect(within(atHand).queryByRole('button', { name: /^Reed spear|^Eel knife/ })).toBeNull();
    expect(within(atHand).getByText('Lit, 4 turns left. 3 refills left')).toBeTruthy();
    await user.click(within(atHand).getByRole('button', { name: 'Put out Storm lantern' }));
    const still = await screen.findByRole('region', { name: 'At hand' });
    expect(await within(still).findByText('Not lit. 4 turns left. 3 refills left')).toBeTruthy();
  });

  // Purpose: put out with its ring, the light stays in its place in At hand, not lit (35B), its own item row still left
  // out, its name still opening its sheet.
  it('stays in its place, not lit, when put out, and its name still opens its sheet', async () => {
    const { user, atHand } = await brannoch((lines) => {
      lineOf(lines, 'line-p1-lantern').pinned = true;
    });
    const placeOf = (section: HTMLElement) => {
      const block = section.querySelector('.light-block--at-hand')!;
      return [...block.parentElement!.children].indexOf(block);
    };
    const place = placeOf(atHand);
    await user.click(within(atHand).getByRole('button', { name: 'Put out Storm lantern' }));
    const section = screen.getByRole('region', { name: 'At hand' });
    const ring = await within(section).findByRole('button', { name: 'Light Storm lantern' });
    expect(ring.textContent).toBe('Light');
    expect(within(section).getByText('Not lit. 4 turns left. 3 refills left')).toBeTruthy();
    expect(placeOf(section)).toBe(place);
    // Once: no item row of its own, no Light button but the ring's.
    expect(within(section).getAllByText('Storm lantern')).toHaveLength(1);
    expect(within(section).getAllByRole('button', { name: /^Light / })).toEqual([ring]);
    await user.click(within(section).getByRole('button', { name: 'Storm lantern' }));
    expect(within(await screen.findByRole('dialog', { name: 'Storm lantern' })).getByRole('button', { name: 'Unpin' })).toBeTruthy();
  });
  // Purpose: a light that can't be read says so in its place in At hand, after the items, with no "Light" heading.
  it("says the light couldn't be read in its place in At hand, with no heading", async () => {
    lightReadsFail(() => true);
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    await addP1Character(world, { gm, sam, fenPack });
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
    const atHand = await screen.findByRole('region', { name: 'At hand' });
    const alert = await within(atHand).findByRole('alert');
    expect(alert.textContent).toBe("Couldn't load the light. Check your connection and try again.");
    expect(within(atHand).getByRole('button', { name: 'Try again' })).toBeTruthy();
    const order = (el: Element) => [...atHand.querySelectorAll('*')].indexOf(el);
    expect(order(within(atHand).getAllByRole('button', { name: /^Eel knife/ })[0]!)).toBeLessThan(order(alert));
    expect(screen.queryByRole('region', { name: 'Light' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Light' })).toBeNull();
  });

  // Purpose: with nothing else at hand, the light that can't be read alone makes At hand.
  it("makes At hand by itself with the light's error when nothing else is at hand", async () => {
    lightReadsFail(() => true);
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    await addP1Character(world, { gm, sam, fenPack, head: 'bare' });
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
    const atHand = await screen.findByRole('region', { name: 'At hand' });
    expect(within(atHand).getByRole('heading', { name: 'At hand' })).toBeTruthy();
    expect(await within(atHand).findByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  // Purpose: items, then the light; a pinned trait with uses is in the right column's list and not in At hand (euf-3).
  it('puts the light after the items, and a pinned trait in the right column’s list, not At hand', async () => {
    const { atHand } = await brannoch(() => {
      world.tables.character_play[0]!.pins = [{ kind: 'trait', key: 'Steady flame' }];
    });
    const order = (el: Element) => [...atHand.querySelectorAll('*')].indexOf(el);
    const ring = within(atHand).getByRole('button', { name: 'Put out Storm lantern' });
    expect(order(within(atHand).getAllByRole('button', { name: /^Eel knife/ })[0]!)).toBeLessThan(order(ring));
    const list = await screen.findByRole('region', { name: 'Abilities and traits' });
    const block = await waitFor(() => list.querySelector('.pinned-box--block') as HTMLElement);
    expect(within(block).getByRole('button', { name: 'Use Steady flame' })).toBeTruthy();
    expect(within(atHand).queryByRole('button', { name: 'Use Steady flame' })).toBeNull();
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
    // The light's rows still show the lantern lit: its ring is the only Put out.
    expect(within(atHand).getAllByRole('button', { name: /^(Put out|Light) / }).map((b) => b.className)).toEqual(['status-ring-tap']);
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
    expect(within(atHand).getAllByRole('button', { name: /^(Put out|Light) / }).map((b) => b.className)).toEqual(['status-ring-tap']);
    await user.click(within(atHand).getByRole('button', { name: 'Storm lantern' }));
    expect(await screen.findByRole('dialog', { name: 'Storm lantern' })).toBeTruthy();
  });
});
