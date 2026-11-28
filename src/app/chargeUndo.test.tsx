// @vitest-environment jsdom
// Use a charge's toast with Undo (Player sitting piece 9, finding 9 of frame 47-3, ruled "A" by Francis, 28 Nov 2026:
// everywhere Use a charge appears). Invented names only (hard rule 2). Purposes:
//   A charged thing's Use on the Player tab's At hand says "Used a charge of <item>." with Undo, and Undo gives the
//   charge back.
//   The item's sheet's "Use a charge" (the Pack tab) says the same, with Undo.
//   With charges hidden from the holder, the toast never names a count, and neither Undo nor anything after it shows one.
//   With none left, Use stays a button and says why, with no Undo (nothing happened).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetCampaignSetting();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Wren of the Ash Barrows, holding a pinned Heron wand with charges (`extra` adjusts its line). */
function wandWorld(extra: Record<string, unknown> = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
  world.addMember(campaign, sam, 'player', wren);
  world.tables.inventory_lines.push({
    id: 'line-heron-wand', campaign_id: campaign, actor_id: wren, location_id: null, library_entry_id: null, name: 'Heron wand',
    category: 'wand', weight_coin: 10, slots: null, stack: 1, qty: 1, container_line_id: null, equipped: false, how_got: 'found', cost: '', notes: '',
    item_data: { charges: { initial: '2d4' } }, source_pack_id: null, source_entry_id: null, charges_left: 5, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null,
    pinned: true, at_hand_hidden: false, approval: 'approved', per_units: 1, version: 1, created_at: '2026-11-18T10:00:00Z', ...extra,
  });
  world.signInAs(sam);
  return { campaign, line: () => world.tables.inventory_lines.find((l) => l.id === 'line-heron-wand')! };
}

async function openPlayer() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await screen.findByRole('region', { name: 'At hand' });
  return user;
}

const atHand = () => within(screen.getByRole('region', { name: 'At hand' }));

describe('Use a charge: a toast with Undo (finding 9, ruled "A")', () => {
  it('on At hand: "Used a charge of Heron wand." with Undo, which gives the charge back', async () => {
    const { line } = wandWorld();
    const user = await openPlayer();
    await user.click(await atHand().findByRole('button', { name: 'Use a charge of Heron wand' }));
    await waitFor(() => expect(line().charges_left).toBe(4));
    expect(await screen.findByText('Used a charge of Heron wand.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line().charges_left).toBe(5));
  });

  it('on the item’s sheet: the same toast, with Undo', async () => {
    const { line } = wandWorld();
    const user = await openPlayer();
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    await screen.findByRole('heading', { name: 'Wren’s pack' });
    // The wand's row in the pack (not At hand's): its sheet holds "Use a charge".
    const rows = await screen.findAllByRole('button', { name: /^Heron wand/ });
    await user.click(rows[rows.length - 1]!);
    const sheet = await screen.findByRole('dialog', { name: 'Heron wand' });
    await user.click(within(sheet).getByRole('button', { name: 'Use a charge' }));
    await waitFor(() => expect(line().charges_left).toBe(4));
    expect(await screen.findByText('Used a charge of Heron wand.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line().charges_left).toBe(5));
  });

  it('with hidden charges: no count in the toast, and none after Undo', async () => {
    const { line } = wandWorld({ charges_left: null, charges_hidden: true });
    world.tables.inventory_line_secrets.push({ id: 'line-heron-wand', campaign_id: line().campaign_id, charges_total: 3, spent: false } as never);
    const user = await openPlayer();
    const before = screen.getByRole('main').textContent ?? '';
    await user.click(await atHand().findByRole('button', { name: 'Use a charge of Heron wand' }));
    await waitFor(() => expect(line().charges_used).toBe(1));
    const toast = await screen.findByText('Used a charge of Heron wand.');
    expect(toast.textContent).not.toMatch(/\d/);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line().charges_used).toBe(0));
    // Nothing new on the screen names a count, and the holder still reads "?" for the wand's charges.
    await waitFor(() => expect(screen.queryByText('Used a charge of Heron wand.')).toBeNull());
    expect(screen.getByRole('main').textContent).toBe(before);
    expect(document.body.textContent).not.toMatch(/\b[0-3] (of 3|left)\b/);
  });

  it('with none left: Use stays a button and says why, with no Undo', async () => {
    wandWorld({ charges_left: 0 });
    const user = await openPlayer();
    await user.click(await atHand().findByRole('button', { name: 'Use a charge of Heron wand' }));
    expect(await screen.findByText('Heron wand has no charges left.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
