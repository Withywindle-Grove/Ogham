// @vitest-environment jsdom
// Hit points in place and the avatar's tap on the Player screen (Francis's rulings after his Player test, 2026-11-08;
// mockup players/04 alternative C). Purposes:
//   Three taps of − within two seconds are one setHp command, one log line and one Undo toast that counts them
//   ("Took 3 damage, 6 of 9"), and Undo puts the hit points back; Undo before the burst is sent sends nothing.
//   + at the most changes nothing and says so, with no Undo.
//   − stops at 0 and the toast says so; it says "Down" only when the setting's rules set marks 0 as Down.
//   On another player's character the squares still draw, and a tap opens the blocked Sheet saying who may change it.
//   Tapping the figure opens the small Sheet to type a value.
//   Tapping the avatar opens the portrait sheet with the picker (choose a picture, then save it); for someone who
//   may not change the portrait, the blocked Sheet instead.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import type { CurrentUser } from '../core/commands.ts';
import type { MyCharacter } from '../core/myCharacters.ts';
import { whoMayChange } from './whoMayChange.ts';

// The pretend browser can't draw pictures, so shrinking a photo hands back a small stand-in file.
vi.mock('./image.ts', async (original) => {
  const real = await original<typeof import('./image.ts')>();
  return { ...real, shrinkImage: async () => new Blob(['a shrunk picture'], { type: 'image/jpeg' }) };
});

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  window.history.replaceState(null, '', '/');
});

afterEach(cleanup);

/**
 * Sam plays Wren (hit points `current` of `max`) in The Ash Barrows. `downAt`: the setting's rules set marks a
 * character Down at that HP. Tam plays Bram.
 */
function table({ current = 9, max = 9, downAt }: { current?: number; max?: number; downAt?: number } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const tam = world.addPerson('tam@lantern.example', 'Tam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, approval: 'approved' });
  const bram = world.addCharacter(campaign, 'Bram', { ownerId: tam, approval: 'approved' });
  for (const id of [wren, bram]) Object.assign(world.tables.actors.find((a) => a.id === id)!, { level: 1, hp_current: current, hp_max: max });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, tam, 'player', bram);
  if (downAt !== undefined) {
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
    world.tables.library_entries.push({ id: 'entry-rules', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data: { id: 'fen-rules', name: 'Fen rules', death: { at: downAt, belowZero: false, note: 'Down at nothing left.' } } });
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  }
  world.signInAs(sam);
  return { campaign, wren, bram };
}

async function openPlayer() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await screen.findByRole('region', { name: 'Vitals' });
  return user;
}

const hpOf = (id: string) => world.tables.actors.find((a) => a.id === id)?.hp_current;
const hpChanges = () => world.tables.events.filter((e) => e.type === 'character.setHp');
const damage = (user: User) => user.click(screen.getByRole('button', { name: 'Take 1 damage' }));
const heal = (user: User) => user.click(screen.getByRole('button', { name: 'Heal 1' }));

describe('hit points in place', () => {
  it('folds three taps of − into one command, one log line and one Undo, and Undo puts them back', async () => {
    const { wren } = table();
    const user = await openPlayer();
    await damage(user);
    await damage(user);
    await damage(user);
    // The figure moves at once; the toast counts the burst; nothing is sent yet.
    expect(screen.getByRole('button', { name: 'Hit points 6 of 9. Type a value' })).toBeTruthy();
    expect(screen.getByText('Took 3 damage, 6 of 9')).toBeTruthy();
    expect(hpChanges()).toHaveLength(0);
    // Two seconds after the last tap: one command, so one log line.
    await vi.waitFor(() => expect(hpOf(wren)).toBe(6), { timeout: 4000 });
    expect(hpChanges()).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(hpOf(wren)).toBe(9));
    expect(await screen.findByRole('button', { name: 'Hit points 9 of 9. Type a value' })).toBeTruthy();
  });

  it('Undo before the burst is sent drops it: nothing is sent', async () => {
    const { wren } = table();
    const user = await openPlayer();
    await damage(user);
    await damage(user);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Hit points 9 of 9. Type a value' })).toBeTruthy();
    await new Promise((done) => setTimeout(done, 2300));
    expect(hpChanges()).toHaveLength(0);
    expect(hpOf(wren)).toBe(9);
  });

  it('+ at the most changes nothing and says so, with no Undo', async () => {
    const { wren } = table({ current: 9, max: 9 });
    const user = await openPlayer();
    await heal(user);
    expect(await screen.findByText('Wren is at the most already, 9 of 9')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hit points 9 of 9. Type a value' })).toBeTruthy();
    expect(hpChanges()).toHaveLength(0);
    expect(hpOf(wren)).toBe(9);
  });

  it('− stops at 0 and says so; with no Down in the rules it never says Down', async () => {
    const { wren } = table({ current: 2, max: 9 });
    const user = await openPlayer();
    await damage(user);
    await damage(user);
    await damage(user);
    expect(screen.getByText('Took 2 damage, 0 of 9, the lowest it goes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hit points 0 of 9. Type a value' })).toBeTruthy();
    await vi.waitFor(() => expect(hpOf(wren)).toBe(0), { timeout: 4000 });
    await damage(user);
    expect(await screen.findByText('Wren is at the lowest already, 0 of 9')).toBeTruthy();
  });

  it('− to 0 says Down when the setting’s rules set marks 0 as Down', async () => {
    table({ current: 2, max: 9, downAt: 0 });
    const user = await openPlayer();
    await damage(user);
    await damage(user);
    await damage(user);
    expect(screen.getByText('Took 2 damage, 0 of 9: Down')).toBeTruthy();
  });

  // The Player screen shows only the viewer's own characters today, so "not yours" is checked through its words
  // (whoMayChange, below) and the screen's path through a campaign where nothing may change (retired).
  it('where the viewer may not change them, the squares still draw and a tap opens the blocked Sheet', async () => {
    const { campaign, wren } = table({ current: 5, max: 9 });
    world.tables.campaigns.find((c) => c.id === campaign)!.retired_at = '2026-10-22T09:00:00Z';
    const user = await openPlayer();
    await damage(user);
    expect(within(await screen.findByRole('dialog', { name: 'Take damage' })).getByText(/retired/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hit points 5 of 9. Type a value' })).toBeTruthy();
    expect(hpOf(wren)).toBe(5);
  });

  it("names who may change another player's character", () => {
    const sam: CurrentUser = { id: 'sam', roles: { ash: 'player' } } as CurrentUser;
    const bram = { id: 'bram', campaignId: 'ash', ownerType: 'user', ownerUserId: 'tam', approval: 'approved', archived: false, name: 'Bram' } as MyCharacter;
    expect(whoMayChange(sam, bram, "Bram's hit points")).toBe("Only Bram's player and the GM can change Bram's hit points.");
    expect(whoMayChange(sam, bram, "Bram's portrait")).toBe("Only Bram's player and the GM can change Bram's portrait.");
  });

  it('tapping the figure opens the small Sheet to type a value', async () => {
    const { wren } = table({ current: 7, max: 9 });
    const user = await openPlayer();
    await user.click(screen.getByRole('button', { name: 'Hit points 7 of 9. Type a value' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Hit points' }));
    const box = sheet.getByLabelText('Current HP (max 9)');
    await user.clear(box);
    await user.type(box, '4');
    await user.click(sheet.getByRole('button', { name: 'Set' }));
    await vi.waitFor(() => expect(hpOf(wren)).toBe(4));
  });

  // Purpose: a tap straight after a save starts from the saved figure, and an open hit-points sheet stays open across
  // the reload (fix-hp-remount-race: the box was drawn again from the old character when the log reloaded).
  it('a tap straight after a save starts from the saved figure, and an open hit-points sheet stays open across the reload', async () => {
    const { wren } = table({ current: 9, max: 9 });
    const user = await openPlayer();
    await damage(user);
    // Tapping the figure sends the burst (8 of 9) and opens the typing Sheet.
    await user.click(screen.getByRole('button', { name: 'Hit points 8 of 9. Type a value' }));
    await screen.findByRole('dialog', { name: 'Hit points' });
    expect(hpOf(wren)).toBe(8);
    // Watch the figure while the log reloads the screen: it never goes back to the old 9.
    const seen = new Set<string>();
    const look = () => document.querySelectorAll('.hp-box__figure').forEach((b) => seen.add(b.getAttribute('aria-label') ?? ''));
    const watcher = new MutationObserver(look);
    watcher.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    await new Promise((done) => setTimeout(done, 1500));
    watcher.disconnect();
    expect([...seen].filter((label) => label.includes('9 of 9'))).toEqual([]);
    expect(screen.getByRole('dialog', { name: 'Hit points' })).toBeTruthy();
    await user.click(within(screen.getByRole('dialog', { name: 'Hit points' })).getByRole('button', { name: 'Cancel' }));
    // The next tap starts from 8, so it writes 7.
    await damage(user);
    expect(screen.getByText('Took 1 damage, 7 of 9')).toBeTruthy();
    await vi.waitFor(() => expect(hpOf(wren)).toBe(7), { timeout: 4000 });
  });
});

describe('the avatar', () => {
  it('opens the portrait sheet with the picker; a chosen picture is saved', async () => {
    const { wren } = table();
    const user = await openPlayer();
    await user.click(screen.getByRole('button', { name: 'Add a portrait for Wren' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Portrait' }));
    await user.upload(sheet.getByLabelText('Add a portrait (optional)'), new File(['a picture'], 'wren.png', { type: 'image/png' }));
    await user.click(await sheet.findByRole('button', { name: 'Save portrait' }));
    expect(await screen.findByText("Wren's portrait was saved.")).toBeTruthy();
    expect(world.tables.actors.find((a) => a.id === wren)?.portrait_asset_id).toBeTruthy();
  });

  it('where the viewer may not change the portrait, the tap opens the blocked Sheet, not the picker', async () => {
    const { campaign } = table();
    world.tables.campaigns.find((c) => c.id === campaign)!.retired_at = '2026-10-22T09:00:00Z';
    const user = await openPlayer();
    await user.click(screen.getByRole('button', { name: 'Add a portrait for Wren' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Portrait' }));
    expect(sheet.getByText(/retired/)).toBeTruthy();
    expect(sheet.queryByLabelText('Add a portrait (optional)')).toBeNull();
  });
});
