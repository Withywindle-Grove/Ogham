// @vitest-environment jsdom
// The Player tab's At hand pop-up (rows C2 and C3 of docs/plans/test-feedback-2026-11-19.md; tfh-1 to tfh-6, ruling
// dec-test-feedback-weapon-quiver-2026-11-19; page M2, frames M2l to M2o, approved 2026-11-19). Against the shared
// P1-like character (Brannoch: the reed spear in hand, the eel knife pinned, the storm lantern lit). Invented names only.
// Purposes:
//   On the Player tab a weapon's name and its Attack open the same pop-up: the Attack view's rolls, then the quick rows.
//   It shows no slot, hands, value or weight; its rows are Give to…, Put in…, Hide from At hand and Drop, each with its
//   icon, Hide from At hand only on a thing not pinned.
//   A weapon in hand shows the Pin star (it had none before, tfh-4); a tap pins it, logged, and it is filled.
//   A pinned weapon's pop-up has the filled star and no Hide from At hand: the star is how it leaves.
//   A lit lantern's pop-up says what it does now (its light left), with the star, and no pack facts.
//   On the Pack tab an item's sheet is unchanged: its details, its Attack row, Drop set apart.
//   A weapon with charges keeps its charges in its pop-up, under its rolls ("Charges 3 left"; the local review's nit 1).
//   Drop in the pop-up drops a single thing at once, with Undo in the toast (the local review's nit 2).
//   Hide from At hand in the pop-up takes the weapon in hand off At hand, and the change is logged (nit 2).
//   A weapon pinned while in hand stays At hand when it is put away (tfh-4's second half; nit 3).
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

async function brannoch(before?: () => void) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  await addP1Character(world, { gm, sam, fenPack });
  before?.();
  world.signInAs(sam);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: new RegExp(P1_CAMPAIGN) }));
  await screen.findByRole('region', { name: 'Vitals' });
  return { user };
}

/** The pop-up's quick rows, by their words, in order. */
const quickRows = (dialog: HTMLElement) => [...dialog.querySelectorAll('.at-hand-popup .list-row--icon .list-row__title')].map((t) => t.textContent);
const rollLines = (dialog: HTMLElement) => [...dialog.querySelectorAll('.roll-row')].map((r) => r.textContent);
const PACK_FACTS = /\b(Slot|Hands|Value|Weight|Takes)\b/;

describe('the Player tab’s At hand pop-up (C2: tfh-1 to tfh-5)', () => {
  it('opens the same pop-up from a weapon’s name and from its Attack', async () => {
    const { user } = await brannoch();
    const block = within(await screen.findByRole('region', { name: 'Weapon in hand' }));
    await user.click(block.getByRole('button', { name: /^Reed spear/ }));
    const fromName = await screen.findByRole('dialog', { name: 'Reed spear' });
    const named = { rolls: rollLines(fromName), rows: quickRows(fromName) };
    expect(named.rolls.length).toBeGreaterThan(0);
    await user.click(within(fromName).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Reed spear' })).toBeNull());
    await user.click(block.getByRole('button', { name: 'Attack with Reed spear' }));
    const fromAttack = await screen.findByRole('dialog', { name: 'Reed spear' });
    expect({ rolls: rollLines(fromAttack), rows: quickRows(fromAttack) }).toEqual(named);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('shows no slot, hands, value or weight, and the four quick rows with their icons', async () => {
    const { user } = await brannoch();
    const block = within(await screen.findByRole('region', { name: 'Weapon in hand' }));
    await user.click(block.getByRole('button', { name: /^Reed spear/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Reed spear' });
    expect(dialog.textContent).not.toMatch(PACK_FACTS);
    expect(quickRows(dialog)).toEqual(['Give to…', 'Put in…', 'Hide from At hand', 'Drop']);
    expect(dialog.querySelectorAll('.list-row--icon .list-row__icon svg')).toHaveLength(4);
    // No Attack row to open a second sheet: the rolls are already here.
    expect(within(dialog).queryByRole('button', { name: /^Attack/ })).toBeNull();
  });

  it('shows the star on a weapon in hand, and a tap pins it, logged', async () => {
    const { user } = await brannoch();
    const block = within(await screen.findByRole('region', { name: 'Weapon in hand' }));
    await user.click(block.getByRole('button', { name: /^Reed spear/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Reed spear' }));
    const star = dialog.getByRole('button', { name: 'Pin to top' });
    expect(star.getAttribute('aria-pressed')).toBe('false');
    await user.click(star);
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.id === 'line-p1-spear')).toMatchObject({ pinned: true }));
    expect(world.tables.events.some((e) => e.type === 'inventory.pin')).toBe(true);
    expect(await screen.findByText('Reed spear pinned to the top')).toBeTruthy();
    // Pinned while in hand, it stays At hand when put away (tfh-4). A pin closes the sheet (as on the Pack tab), so the
    // pop-up is opened again from the weapon in hand: Put in… → Carried, and its row is in At hand.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Reed spear' })).toBeNull());
    await user.click(within(screen.getByRole('region', { name: 'Weapon in hand' })).getByRole('button', { name: /^Reed spear/ }));
    const again = within(await screen.findByRole('dialog', { name: 'Reed spear' }));
    expect(again.getByRole('button', { name: 'Unpin' })).toBeTruthy();
    await user.click(again.getByRole('button', { name: /^Put in…/ }));
    const move = within(await screen.findByRole('dialog', { name: 'Move Reed spear' }));
    await user.click(move.getAllByRole('button', { name: 'Carry it' })[0]!);
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.id === 'line-p1-spear')).toMatchObject({ equipped: false, pinned: true }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Weapon in hand' })).toBeNull());
    expect(within(screen.getByRole('region', { name: 'At hand' })).getByRole('button', { name: /^Reed spear/ })).toBeTruthy();
  });

  it('shows a weapon’s charges under its rolls in its pop-up', async () => {
    const { user } = await brannoch(() => {
      const spear = world.tables.inventory_lines.find((l) => l.id === 'line-p1-spear')!;
      Object.assign(spear, { item_data: { ...(spear.item_data as Record<string, unknown>), charges: { initial: '1d4' } }, charges_left: 3 });
    });
    await user.click((await screen.findAllByRole('button', { name: /^Reed spear/ }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Reed spear' });
    expect(rollLines(dialog).length).toBeGreaterThan(0);
    expect(dialog.textContent).toContain('Charges 3 left');
    // Under the rolls: the charges' line comes after the last roll line.
    const lastRoll = [...dialog.querySelectorAll('.roll-row')].at(-1)!;
    const charges = [...dialog.querySelectorAll('.at-hand-sheet .book-line')].find((p) => p.textContent === 'Charges 3 left')!;
    expect(lastRoll.compareDocumentPosition(charges) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('drops a single thing at once from its pop-up, with Undo in the toast', async () => {
    const { user } = await brannoch();
    const atHand = within(await screen.findByRole('region', { name: 'At hand' }));
    await user.click(atHand.getByRole('button', { name: /^Eel knife/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Eel knife' }));
    await user.click(dialog.getByRole('button', { name: /^Drop/ }));
    // At once: no "how many" sheet for a single thing.
    expect(screen.queryByRole('dialog', { name: 'Drop Eel knife' })).toBeNull();
    await waitFor(() => expect(world.tables.inventory_lines.some((l) => l.id === 'line-p1-knife')).toBe(false));
    const undo = await screen.findByRole('button', { name: 'Undo' });
    await user.click(undo);
    await waitFor(() => expect(world.tables.inventory_lines.some((l) => l.name === 'Eel knife')).toBe(true));
  });

  it('takes the weapon in hand off At hand with Hide from At hand, logged', async () => {
    const { user } = await brannoch();
    const block = within(await screen.findByRole('region', { name: 'Weapon in hand' }));
    await user.click(block.getByRole('button', { name: /^Reed spear/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Reed spear' }));
    await user.click(dialog.getByRole('button', { name: /^Hide from At hand/ }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.id === 'line-p1-spear')).toMatchObject({ at_hand_hidden: true, equipped: true }));
    expect(world.tables.events.some((e) => e.type === 'inventory.atHand')).toBe(true);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Weapon in hand' })).toBeNull());
    expect(screen.queryAllByRole('button', { name: /^Reed spear/ })).toHaveLength(0);
  });

  it('gives a pinned weapon the filled star and no Hide from At hand', async () => {
    const { user } = await brannoch();
    const atHand = within(await screen.findByRole('region', { name: 'At hand' }));
    await user.click(atHand.getByRole('button', { name: /^Eel knife/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Eel knife' });
    expect(within(dialog).getByRole('button', { name: 'Unpin' }).getAttribute('aria-pressed')).toBe('true');
    // No container in his pack and the knife is not worn: Put in… shows only where there is somewhere to put it, as on
    // the item's sheet.
    expect(quickRows(dialog)).toEqual(['Give to…', 'Drop']);
    expect(rollLines(dialog).length).toBeGreaterThan(0);
    expect(dialog.textContent).not.toMatch(PACK_FACTS);
  });

  it('opens a lit lantern’s pop-up with its light left, the star, and no pack facts', async () => {
    const { user } = await brannoch();
    const atHand = within(await screen.findByRole('region', { name: 'At hand' }));
    await user.click(atHand.getByRole('button', { name: 'Storm lantern' }));
    const dialog = await screen.findByRole('dialog', { name: 'Storm lantern' });
    expect(dialog.textContent).toMatch(/Light Lit, \d+ turns? left/);
    expect(within(dialog).getByRole('button', { name: 'Pin to top' })).toBeTruthy();
    expect(dialog.textContent).not.toMatch(PACK_FACTS);
    // Not pinned, and not At hand by itself: nothing to hide it from (and nowhere to put it in).
    expect(quickRows(dialog)).toEqual(['Give to…', 'Drop']);
  });

  it('leaves the Pack tab’s item sheet as it was', async () => {
    const { user } = await brannoch();
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    await screen.findByRole('heading', { name: /’s pack$/ });
    // The pinned knife in the Pack tab's At hand, and the spear in "Worn and in hand": each opens the item's sheet with
    // its details and Drop set apart, not the short pop-up.
    const atHand = within(await screen.findByRole('region', { name: 'At hand' }));
    await user.click(atHand.getByRole('button', { name: /^Eel knife/ }));
    const knife = await screen.findByRole('dialog', { name: 'Eel knife' });
    expect(knife.querySelector('.at-hand-popup')).toBeNull();
    expect(knife.textContent).toMatch(PACK_FACTS);
    expect(knife.querySelector('.list-row--apart')!.textContent).toContain('Drop');
    await user.click(within(knife).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Eel knife' })).toBeNull());
    await user.click(within(screen.getByRole('region', { name: 'Worn and in hand' })).getByRole('button', { name: /^Reed spear/ }));
    const spear = await screen.findByRole('dialog', { name: 'Reed spear' });
    expect(spear.querySelector('.at-hand-popup')).toBeNull();
    expect(within(spear).getByRole('button', { name: 'Hide from At hand' })).toBeTruthy();
    // In hand on the Pack tab it still has no star (06, Item sheet): only the Player tab's pop-up gives it one.
    expect(within(spear).queryByRole('button', { name: /^(Pin to top|Unpin)$/ })).toBeNull();
  });

  // Purpose (K29's review, finding 1): the Pack tab's dress stops at the Pack tab. On the Player tab the full sheet of a
  // thing waiting for the GM keeps its grey panel and its 20 px rows (pq-1, as built): it is not marked as the dressed
  // thing's sheet, and no part of it sits in the Pack's dress.
  it('keeps the Player tab’s full sheet of a thing waiting for the GM out of the Pack’s dress', async () => {
    const { user } = await brannoch(() => {
      Object.assign(world.tables.inventory_lines.find((l) => l.id === 'line-p1-knife')!, { approval: 'pending' });
    });
    await user.click(within(await screen.findByRole('region', { name: 'At hand' })).getByRole('button', { name: /^Eel knife/ }));
    const knife = await screen.findByRole('dialog', { name: 'Eel knife' });
    expect(knife.querySelector('.at-hand-popup')).toBeNull();
    const panel = knife.querySelector('.pack__sheet')!;
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('pack__sheet--thing')).toBe(false);
    expect(knife.closest('.pack-dress')).toBeNull();
  });
});
