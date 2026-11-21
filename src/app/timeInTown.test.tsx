// @vitest-environment jsdom
// M5b step 6a, time in town (docs/plans/m5b-6-settlements.md "Step 6a"; ruled 2026-11-02, dt-2; ST1, ST10, ST11),
// clicked through like a person would, against the stand-in database. Invented rules only.
//   A town mode's step is a part of the day: its main advance is Next part of day, the strip shows the part, and it
//   moves morning → afternoon → night → the next morning, each a Simple log line.
//   End expedition leaves the campaign in Adventure, in town, with no expedition: the strip offers the town's Next
//   part of day and Start expedition again; Undo on its summary brings the expedition back.
//   Start downtime (⋯) gives every character in play a full rest once (who went and who stayed) and switches to
//   Downtime; Undo reverses both. End downtime (⋯) returns to Adventure.
//   A town switch left on turns off at the next morning part, not at midnight.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { departModes, startExpedition } from '../testing/depart.ts';

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

const MORNING = 6 * 3600;

/** A GM, two players' characters (Wren and Ash), invented rules: a market town by parts of the day, and a warden's ward that comes back on a rest. */
function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const kit = world.addPerson('kit@lantern.example', 'Kit');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: kit });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, kit, 'player', ash);
  for (const id of [wren, ash]) Object.assign(world.tables.actors.find((a) => a.id === id)!, { level: 1, hp_current: 4, hp_max: 6, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
  world.tables.packs.push({ id: 'pack-quay', owner_user_id: gm, campaign_id: null, name: 'Quay Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-quay', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'quay-rules', 'Quay rules', {
    healing: 'A quiet night heals a little.',
    exploration: {
      modes: [
        { id: 'quay', name: 'Market town', step: { value: 1, unit: 'partOfDay' }, procedure: [], checks: [] },
        { id: 'cellars', name: 'Under the quay', step: { value: 1, unit: 'turn' }, procedure: [], checks: [] },
      ],
    },
  });
  entry('class', 'lantern-warden', 'Lantern Warden', { abilities: [{ name: 'Lantern ward', uses: { count: 2, per: 'rest' } }] });
  world.tables.campaign_packs.push({ id: 'link-quay', campaign_id: campaign, pack_id: 'pack-quay', pack_name: 'Quay Rules', option_choices: {}, overrides: {}, priority: 1 });
  for (const id of [wren, ash]) world.tables.character_play.push({ actor_id: id, campaign_id: campaign, prepared: [], uses_spent: { 'Lantern ward': 2 } });
  const clock = () => world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!;
  clock().seconds = MORNING;
  const row = () => world.tables.campaigns.find((c) => c.id === campaign)!;
  return { gm, campaign, wren, ash, clock, row };
}

async function openGm(gm: string) {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  // The GM's band reads "No session yet" before the first session (st-2).
  await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
  // "Next part of day", "Next day" and the heading's step need a running session (st-1, st-2): the GM starts one.
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Session 1.');
  return user;
}

const strip = () => within(screen.getByRole('region', { name: 'Time' }));
const menuItem = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(within(document.querySelector('.more-menu__panel') as HTMLElement).getByRole('button', { name }));
};
const spent = (actor: string) => world.tables.character_play.find((p) => p.actor_id === actor)!.uses_spent;
const tripsUnderWay = () => world.tables.expeditions.filter((x) => x.ended_at === null && !x.undone);

describe('time in town (M5b step 6a)', () => {
  // Purpose: Next part of day moves morning → afternoon → night → the next morning, and the log says so (Simple).
  it('Next part of day moves morning → afternoon → night → the next morning, each a Simple log line', async () => {
    const { gm, clock } = table();
    const user = await openGm(gm);
    await user.click((await departModes(user)).getByRole('button', { name: 'Market town' }));
    await startExpedition(user);
    expect(await screen.findByRole('heading', { name: 'The Mustering Field, morning' })).toBeTruthy();
    expect(world.tables.expeditions.at(-1)!.mode).toBe('quay');
    for (const part of ['afternoon', 'night', 'morning']) {
      await user.click(screen.getByRole('button', { name: 'Next part of day' }));
      expect(await screen.findByRole('heading', { name: `The Mustering Field, ${part}` })).toBeTruthy();
    }
    // A day on: the next morning.
    expect(clock().seconds).toBe(MORNING + 24 * 3600);
    expect(strip().getByText(/^Day 2/)).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'time.partOfDay').map((e) => e.level)).toEqual(['simple', 'simple', 'simple']);
  });

  // Purpose: End expedition leaves the campaign in Adventure with no expedition; Undo restores the expedition.
  it('End expedition leaves the party in town, in Adventure, with Next part of day and Start expedition; Undo brings the expedition back', async () => {
    const { gm, row } = table();
    const user = await openGm(gm);
    await user.click((await departModes(user)).getByRole('button', { name: 'Market town' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, morning' });

    await user.click(screen.getByRole('button', { name: 'Time options' }));
    const end = screen.getByRole('button', { name: 'End expedition' });
    expect(end.textContent).toContain("You'll be asked whether the party is somewhere safe");
    await user.click(end);
    expect(await screen.findByText('Expedition ended')).toBeTruthy();
    expect(row().mode).toBe('adventure');
    expect(tripsUnderWay()).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Market town, morning' })).toBeTruthy();

    // Undo on the summary: the expedition is under way again, and the campaign never left Adventure.
    await user.click(within(screen.getByRole('region', { name: 'Expedition ended' })).getByRole('button', { name: 'Undo ending the expedition' }));
    await waitFor(() => expect(tripsUnderWay()).toHaveLength(1));
    expect(row().mode).toBe('adventure');

    // End it again and close the summary: in town, the town's step and Start expedition.
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'End expedition' }));
    await user.click(within(await screen.findByRole('region', { name: 'Expedition ended' })).getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Depart' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+1 day' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Advance time' }));
    expect(await screen.findByRole('heading', { name: 'Market town, afternoon' })).toBeTruthy();
    expect(tripsUnderWay()).toHaveLength(0);
  });

  // Purpose: Start downtime applies a full rest to every character once, and Undo reverses both.
  it('Start downtime gives every character a full rest once and switches to Downtime; Undo reverses both', async () => {
    const { gm, wren, ash, row } = table();
    const user = await openGm(gm);
    await user.click((await departModes(user)).getByRole('button', { name: 'Market town' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, morning' });
    // Start downtime isn't offered while an expedition is under way.
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    expect(screen.queryByRole('button', { name: /Start downtime/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'End expedition' }));
    await screen.findByText('Expedition ended');

    await menuItem(user, 'Start downtime');
    expect(await screen.findByText('Downtime began')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Downtime' })).toBeTruthy();
    expect(row().mode).toBe('downtime');
    expect(spent(wren)).toEqual({});
    expect(spent(ash)).toEqual({});
    expect(screen.getByText('Rest and day abilities are back.')).toBeTruthy();
    expect(screen.getByText('A quiet night heals a little.')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Heal Ash' })).toBeTruthy();
    // One request: one Simple line, both characters' uses in it, once.
    const lines = world.tables.events.filter((e) => e.type === 'downtime.start');
    expect(new Set(lines.map((e) => e.request_id)).size).toBe(1);
    expect(lines.filter((e) => e.target_table === 'character_play')).toHaveLength(2);
    expect(lines.every((e) => e.level === 'simple')).toBe(true);
    // Downtime's own moves now.
    // (Next day, the band's one button in Downtime now, st-1; "+1 day" is gone.)
    expect(screen.getByRole('button', { name: 'Next day' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+1 day' })).toBeNull();

    await user.click(within(screen.getByText('Downtime began').closest('.time-strip__end') as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(row().mode).toBe('adventure'));
    expect(spent(wren)).toEqual({ 'Lantern ward': 2 });
    expect(spent(ash)).toEqual({ 'Lantern ward': 2 });
    expect(await screen.findByRole('heading', { name: 'Market town, morning' })).toBeTruthy();
  });

  // Purpose: End downtime returns to Adventure.
  it('End downtime (⋯) returns to Adventure, with no expedition, Undo on its toast', async () => {
    const { gm, row } = table();
    const user = await openGm(gm);
    // A new campaign starts in Downtime; Start downtime isn't offered there, End downtime is.
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    expect(screen.queryByRole('button', { name: /Start downtime/ })).toBeNull();
    const end = screen.getByRole('button', { name: /End downtime/ });
    expect(end.textContent).toContain('Back to adventure time; the party stays where it is');
    await user.click(end);
    expect(await screen.findByText('Downtime ended, back to adventure time')).toBeTruthy();
    expect(row().mode).toBe('adventure');
    expect(tripsUnderWay()).toHaveLength(0);
    expect(await screen.findByRole('heading', { name: 'Market town, morning' })).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'downtime.end').map((e) => e.level)).toEqual(['simple']);
  });

  // Purpose: in a town mode the switches reset at the morning part (sw-3), not when the day changes at midnight.
  it('a town switch left on turns off at the next morning part, not at midnight', async () => {
    const { gm, row, clock } = table();
    const user = await openGm(gm);
    await user.click((await departModes(user)).getByRole('button', { name: 'Market town' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, morning' });
    await user.click(screen.getByRole('button', { name: 'Next part of day' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, afternoon' });
    Object.assign(row(), { active_night: true });
    // Afternoon → night crosses no morning; night → morning crosses midnight and then the morning.
    await user.click(screen.getByRole('button', { name: 'Next part of day' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, night' });
    expect(row().active_night).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Next part of day' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, morning' });
    await waitFor(() => expect(row().active_night).toBe(false));
    expect(clock().seconds).toBe(MORNING + 24 * 3600);
    expect(world.tables.events.filter((e) => e.type === 'town.reset')).toHaveLength(1);
  });
});
