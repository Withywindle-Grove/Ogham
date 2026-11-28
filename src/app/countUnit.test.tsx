// @vitest-environment jsdom
// A count names its unit (G-233, piece C of docs/specs/dec5-gaps.md; page 49, approved 2026-11-28 with findings 2 and
// 3), on the Player screen and the item's sheet, through the real app on the stand-in database. Invented names only
// (hard rule 2). Purposes:
//   At hand's row says "2 of 3 portions"; its button still shows "Use" and is read aloud "Use a portion of Rum bottle".
//   Use's toast says "Used a portion of Rum bottle." (loop 2's toast, its Undo unchanged).
//   With none left, Use says "Rum bottle has no portions left."
//   A hidden count reads "Portions: ?"; a vowel unit takes "an" ("Use an ounce of Lamp oil can").
//   The item's sheet labels the count "Portions" ("2 of 3 left") and its row reads "Use a portion".
//   A line whose copy names no unit (handed out before the pack named one, dg-8) keeps "charges".
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

/** Wren of the Ash Barrows, holding a pinned counted thing (`name`, `charges`; `extra` adjusts its line). */
function countedWorld(name: string, charges: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('wren@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
  world.addMember(campaign, sam, 'player', wren);
  world.tables.inventory_lines.push({
    id: 'line-counted', campaign_id: campaign, actor_id: wren, location_id: null, library_entry_id: null, name,
    category: 'gear', weight_coin: 10, slots: null, stack: 1, qty: 1, container_line_id: null, equipped: false, how_got: 'found', cost: '', notes: '',
    item_data: { charges }, source_pack_id: null, source_entry_id: null, charges_left: 2, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null,
    pinned: true, at_hand_hidden: false, approval: 'approved', per_units: 1, version: 1, created_at: '2026-11-18T10:00:00Z', ...extra,
  });
  world.signInAs(sam);
  return { line: () => world.tables.inventory_lines.find((l) => l.id === 'line-counted')! };
}

async function openPlayer() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await screen.findByRole('region', { name: 'At hand' });
  return user;
}

const atHand = () => within(screen.getByRole('region', { name: 'At hand' }));
const RUM = { initial: 3, unit: 'portion' };

describe('a count names its unit (G-233, page 49)', () => {
  it('At hand: "2 of 3 portions", the button "Use" read aloud "Use a portion of Rum bottle", and its toast', async () => {
    const { line } = countedWorld('Rum bottle', RUM);
    const user = await openPlayer();
    expect(await atHand().findByText('2 of 3 portions')).toBeTruthy();
    const use = atHand().getByRole('button', { name: 'Use a portion of Rum bottle' });
    expect(use.textContent).toMatch(/^Use/);
    expect(use.textContent).not.toMatch(/a portion/);
    await user.click(use);
    await waitFor(() => expect(line().charges_left).toBe(1));
    expect(await screen.findByText('Used a portion of Rum bottle.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(line().charges_left).toBe(2));
  });

  it('with none left: "Rum bottle has no portions left."', async () => {
    countedWorld('Rum bottle', RUM, { charges_left: 0 });
    const user = await openPlayer();
    await user.click(await atHand().findByRole('button', { name: 'Use a portion of Rum bottle' }));
    expect(await screen.findByText('Rum bottle has no portions left.')).toBeTruthy();
  });

  it('a hidden count reads "Portions: ?"', async () => {
    countedWorld('Rum bottle', RUM, { charges_left: null, charges_hidden: true });
    await openPlayer();
    expect(await atHand().findByText('Portions: ?')).toBeTruthy();
  });

  it('a unit starting with a vowel takes "an"; a full count of 1 reads "1 dose left"', async () => {
    countedWorld('Lamp oil can', { initial: 4, unit: 'ounce' });
    await openPlayer();
    expect(await atHand().findByRole('button', { name: 'Use an ounce of Lamp oil can' })).toBeTruthy();
    expect(atHand().getByText('2 of 4 ounces')).toBeTruthy();
    cleanup();
    world = createFakeDb();
    forgetCampaignSetting();
    countedWorld('Salve tin', { initial: 1, unit: 'dose' }, { charges_left: 1 });
    await openPlayer();
    expect(await atHand().findByText('1 dose left')).toBeTruthy();
  });

  it('the item’s sheet: "Portions: 2 of 3 left" and "Use a portion"', async () => {
    const { line } = countedWorld('Rum bottle', RUM);
    const user = await openPlayer();
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    await screen.findByRole('heading', { name: 'Wren’s pack' });
    const rows = await screen.findAllByRole('button', { name: /^Rum bottle/ });
    await user.click(rows[rows.length - 1]!);
    const sheet = await screen.findByRole('dialog', { name: 'Rum bottle' });
    expect(within(sheet).getByRole('group', { name: 'Portions' }).textContent).toBe('Portions: 2 of 3 left');
    await user.click(within(sheet).getByRole('button', { name: 'Use a portion' }));
    await waitFor(() => expect(line().charges_left).toBe(1));
    expect(await screen.findByText('Used a portion of Rum bottle.')).toBeTruthy();
  });

  it('a line whose copy names no unit keeps "charges" (dg-8)', async () => {
    countedWorld('Rum bottle', { initial: '2d4' });
    await openPlayer();
    expect(await atHand().findByText('2 charges left')).toBeTruthy();
    expect(atHand().getByRole('button', { name: 'Use a charge of Rum bottle' })).toBeTruthy();
  });
});
