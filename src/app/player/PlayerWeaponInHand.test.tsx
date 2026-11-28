// @vitest-environment jsdom
// dec-13 C14 (docs/plans/dec-13-the-player-screen.md; ps-2, ps-9, md-1, frames P1 and P2 of december/14, approved
// 2026-11-14): the weapon in hand as its own block. Against the shared P1-like character (Brannoch: the reed spear in
// hand, the eel knife pinned, the storm lantern lit). Invented names only. Purposes:
//   The weapon in hand is its own block, above At hand and outside it (P1: armour class and attack, the weapon in hand,
//   then "At hand"); At hand keeps the other rows (the pinned knife) and no longer lists the spear.
//   The block reads the weapon's name, "In hand" (no figures in the line: the roll lines carry them), and its two roll
//   lines, to hit then damage, whose sums are the Attack sheet's own lines (never a second sum).
//   Its name opens the item's sheet and its Attack opens the Attack sheet, as the At hand row's did.
//   With nothing else at hand the block stands alone, with no "At hand" heading under it.
//   A light that isn't lit sits in At hand, under the weapon in hand, with no Light section (lt-4, page 35).
//   Wield on the pinned knife puts it in hand, and it becomes the block (the row's own command and Undo, unchanged).
//   A burning light whose line is also the weapon in hand shows once as the block and once as the light's rows, and the
//   light's name opens one sheet for it, never two (dec-13 C6's second half).
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
const lineOf = (lines: FakeWorld['tables']['inventory_lines'], id: string) => lines.find((l) => l.id === id)!;

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
  return { user };
}

const order = (el: Element) => [...document.querySelectorAll('*')].indexOf(el);

describe('the weapon in hand (dec-13 C14)', () => {
  // Purpose: its own block, above At hand and outside it; At hand keeps the pinned knife and no longer lists the spear.
  it('is its own block above At hand, and At hand no longer lists it', async () => {
    await brannoch();
    const block = await screen.findByRole('region', { name: 'Weapon in hand' });
    const atHand = await screen.findByRole('region', { name: 'At hand' });
    expect(within(block).getByRole('button', { name: /^Reed spear/ })).toBeTruthy();
    expect(within(atHand).queryByRole('button', { name: /^Reed spear/ })).toBeNull();
    expect(within(atHand).getByRole('button', { name: /^Eel knife/ })).toBeTruthy();
    expect(order(block)).toBeLessThan(order(atHand));
    expect(order(screen.getByRole('region', { name: 'Vitals' }))).toBeLessThan(order(block));
  });

  // Purpose: the name, "In hand" with no figures in it, and the two roll lines whose sums are the Attack sheet's own.
  it('reads its name, "In hand" and the two roll lines, the Attack sheet’s own sums', async () => {
    const { user } = await brannoch();
    const block = await screen.findByRole('region', { name: 'Weapon in hand' });
    const main = within(block).getByRole('button', { name: /^Reed spear/ });
    expect(main.textContent).toBe('Reed spear In hand');
    const rolls = within(block).getAllByRole('listitem').filter((li) => li.classList.contains('weapon-in-hand__roll'));
    const [hit, damage] = rolls.map((li) => li.textContent ?? '');
    expect(hit).toMatch(/^d20 [+−]\d+ to hit$/);
    expect(damage).toBe('d6 damage');
    // The same sum as the Attack sheet's first line ("Roll 1d20 + 20 to hit").
    await user.click(within(block).getByRole('button', { name: 'Attack with Reed spear' }));
    const sheet = await screen.findByRole('dialog', { name: 'Reed spear' });
    const lines = [...sheet.querySelectorAll('.roll-row')].map((r) => r.textContent ?? '');
    const sum = /^Roll 1d20(?: ([+−]) (\d+))? to hit/.exec(lines[0] ?? '');
    expect(sum).not.toBeNull();
    expect(hit).toBe(`d20 ${sum![1] ?? '+'}${sum![2] ?? '0'} to hit`);
    expect(lines[1]).toMatch(/^Roll 1d6 for damage/);
  });

  // Purpose: its name opens the item's sheet, as the At hand row's body did.
  it("opens the item's sheet from its name", async () => {
    const { user } = await brannoch();
    const block = await screen.findByRole('region', { name: 'Weapon in hand' });
    await user.click(within(block).getByRole('button', { name: /^Reed spear/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Reed spear' });
    expect(within(sheet).getByRole('button', { name: 'Hide from At hand' })).toBeTruthy();
  });

  // Purpose: with nothing else at hand the block stands alone, with no "At hand" heading under it.
  it('stands alone with no At hand heading when nothing else is at hand', async () => {
    await brannoch((lines) => {
      lineOf(lines, 'line-p1-knife').pinned = false;
      // No lantern, and no light burning (its own table).
      lines.splice(lines.indexOf(lineOf(lines, 'line-p1-lantern')), 1);
      world.tables.character_lights.splice(0);
    });
    const block = await screen.findByRole('region', { name: 'Weapon in hand' });
    expect(within(block).getByRole('button', { name: /^Reed spear/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'At hand' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'At hand' })).toBeNull();
  });

  // Purpose: a light not lit sits in At hand, under the weapon in hand, with no Light section (lt-4, page 35).
  it('keeps an unlit light in At hand, under the weapon in hand', async () => {
    const { user } = await brannoch();
    const atHand = await screen.findByRole('region', { name: 'At hand' });
    await user.click(await within(atHand).findByRole('button', { name: 'Put out Storm lantern' }));
    const ring = await within(screen.getByRole('region', { name: 'At hand' })).findByRole('button', { name: 'Light Storm lantern' });
    const block = screen.getByRole('region', { name: 'Weapon in hand' });
    expect(order(block)).toBeLessThan(order(ring));
    expect(screen.queryByRole('region', { name: 'Light' })).toBeNull();
  });

  // Purpose: a burning light whose line is the weapon in hand opens one sheet from the light's name, never two.
  it('opens one sheet when the lit light is also the weapon in hand', async () => {
    const { user } = await brannoch(() => {
      // The light burns on the spear's own line (in hand), not on the lantern's.
      world.tables.character_lights[0]!.line_id = 'line-p1-spear';
    });
    const block = await screen.findByRole('region', { name: 'Weapon in hand' });
    expect(within(block).getByRole('button', { name: /^Reed spear/ })).toBeTruthy();
    const atHand = await screen.findByRole('region', { name: 'At hand' });
    await user.click(within(atHand).getByRole('button', { name: 'Storm lantern' }));
    await screen.findByRole('dialog', { name: 'Reed spear' });
    expect(screen.getAllByRole('dialog', { name: 'Reed spear' })).toHaveLength(1);
  });

  // Purpose: when the lit weapon in hand is all that is at hand, At hand holds the light's rows and no empty item list
  // (no "Nothing carried yet" line under its heading).
  it('draws no empty item list in At hand when the lit weapon in hand is all there is', async () => {
    await brannoch((lines) => {
      world.tables.character_lights[0]!.line_id = 'line-p1-spear';
      lineOf(lines, 'line-p1-knife').pinned = false;
    });
    expect(await screen.findByRole('region', { name: 'Weapon in hand' })).toBeTruthy();
    const atHand = await screen.findByRole('region', { name: 'At hand' });
    expect(within(atHand).getByRole('button', { name: 'Storm lantern' })).toBeTruthy();
    expect(within(atHand).queryByText(/Nothing carried yet/)).toBeNull();
    expect(atHand.querySelector('.pack__group')).toBeNull();
  });

  // Purpose: two weapons in hand give two blocks in the "Weapon in hand" region (pib-2: every weapon in hand, no cap),
  // and neither is listed in At hand too.
  it('draws a block for each of two weapons in hand', async () => {
    await brannoch((lines) => {
      lineOf(lines, 'line-p1-knife').equipped = true;
    });
    const block = await screen.findByRole('region', { name: 'Weapon in hand' });
    await waitFor(() => expect(block.querySelectorAll('.weapon-in-hand')).toHaveLength(2));
    expect(within(block).getByRole('button', { name: /^Reed spear/ })).toBeTruthy();
    expect(within(block).getByRole('button', { name: /^Eel knife/ })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'At hand' })).queryByRole('button', { name: /^Eel knife|^Reed spear/ })).toBeNull();
  });

  // Purpose: every weapon in hand gets a block, with no cap (pib-2): three in hand are three blocks, none in At hand.
  it('draws a block for each of three weapons in hand', async () => {
    await brannoch((lines) => {
      lineOf(lines, 'line-p1-knife').equipped = true;
      lines.push({ ...lineOf(lines, 'line-p1-knife'), id: 'line-p1-club', name: 'Bone club', pinned: false, equipped: true });
    });
    const block = await screen.findByRole('region', { name: 'Weapon in hand' });
    await waitFor(() => expect(block.querySelectorAll('.weapon-in-hand')).toHaveLength(3));
    for (const name of [/^Reed spear/, /^Eel knife/, /^Bone club/]) expect(within(block).getByRole('button', { name })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'At hand' })).queryByRole('button', { name: /^Eel knife|^Reed spear|^Bone club/ })).toBeNull();
  });

  // Purpose: a weapon worn ready (horns on the worn slot, pinned) is an At hand row with Attack and its mode button, never
  // a block and never Wield (pib-1); the spear in hand keeps the one block.
  it('draws a worn-ready weapon as an At hand row with Attack and its mode button', async () => {
    await brannoch((lines) => {
      const stance = { button: 'stance', list: [{ id: 'gore', name: 'Gore' }, { id: 'butt', name: 'Butt', damage: '1d4' }] };
      lines.push({ ...lineOf(lines, 'line-p1-knife'), id: 'line-p1-horns', name: 'Bog-ox horns', pinned: true, equipped: true, source_entry_id: null, source_pack_id: null, item_data: { slot: 'worn', weapon: { damage: '1d6', modes: stance } } });
    });
    const block = await screen.findByRole('region', { name: 'Weapon in hand' });
    const atHand = await screen.findByRole('region', { name: 'At hand' });
    await waitFor(() => expect(within(atHand).getByRole('button', { name: 'Attack with Bog-ox horns' })).toBeTruthy());
    expect(within(atHand).getByRole('button', { name: /^Stance/ })).toBeTruthy();
    expect(within(atHand).queryByRole('button', { name: 'Wield Bog-ox horns' })).toBeNull();
    expect(block.querySelectorAll('.weapon-in-hand')).toHaveLength(1);
    expect(within(block).queryByRole('button', { name: /^Bog-ox horns/ })).toBeNull();
    expect(within(block).getByRole('button', { name: /^Reed spear/ })).toBeTruthy();
  });

  // Purpose: Wield on the pinned knife puts it in hand (the row's own command), and it becomes a block of its own.
  it('makes a wielded weapon the block', async () => {
    const { user } = await brannoch((lines) => {
      lineOf(lines, 'line-p1-spear').equipped = false;
    });
    expect(screen.queryByRole('region', { name: 'Weapon in hand' })).toBeNull();
    const atHand = await screen.findByRole('region', { name: 'At hand' });
    await user.click(within(atHand).getByRole('button', { name: 'Wield Eel knife' }));
    const block = await screen.findByRole('region', { name: 'Weapon in hand' });
    await waitFor(() => expect(within(block).getByRole('button', { name: /^Eel knife/ })).toBeTruthy());
    expect(within(block).getByText(/^d4/)).toBeTruthy();
  });
});
