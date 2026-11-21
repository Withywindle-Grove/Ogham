// @vitest-environment jsdom
// M5 step 10, starting and the clock (ruled 2026-10-30, DG1–DG3, DG7, S2-7, S4-6), clicked through like a person
// would, against the stand-in database. Invented rules only.
//   Where? (DG1): a typed place goes with Start expedition; the GM's strip says where it started, the log line too,
//   and players never get it. Between expeditions it's a recent place to pick, which picks the mode it started in.
//   Encounter check (DG3; Check now until B12; the band's icon button since S2, the hour track gone since S7): the wandering check goes on the card with Hit /
//   Miss, logged as checking now; the schedule carries on. With no wandering check at all, a pop-up says why.
//   The Compact time strip (DG2): on Players during an expedition, the mode and step and Next turn, which moves the
//   clock (a toast with Undo); what came due waits on the same card, one tap away on Scene. None between expeditions.
//   Travelling in darkness (S2-7) is a switch in ⋯ in day modes, kept with the campaign, with Undo; "Sunset around
//   now" comes from the pack's daylight.
//   Darkness (DG7; the dim removed at the M5 gate, R3 audit 8): a player whose group has no light sees "No light"
//   with "Light a rushlight (N left)", and the page never darkens or greys (dark sight or not); a light ends it.
//   It shows in the Player tab's notices box and on the Scene, and no longer on the Pack and Magic tabs (d5-20).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { pickListedPlace, typePlace } from '../testing/pickPlace.ts';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeEventTag } from '../core/eventTags.ts';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { setPlace } from '../modules/expedition/placePlay.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { departModes, openDepart, startExpedition } from '../testing/depart.ts';

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

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  const clock = () => world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!;
  return { gm, sam, campaign, wren, clock };
}

/**
 * Invented setting rules: a creeping turn mode whose wandering check falls every 2 turns, a roaming day mode, a
 * sunset 15 minutes into the day, rushlights, and marsh folk who see in the dark.
 */
function withSetting(campaign: string, gm: string) {
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    daylight: { sunrise: '00:05', sunset: '00:15' },
    exploration: {
      modes: [
        {
          id: 'creep',
          name: 'Creeping',
          step: { value: 1, unit: 'turn' },
          procedure: [{ id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' }],
          checks: [{ id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] } }],
        },
        { id: 'roam', name: 'Roaming', step: { value: 1, unit: 'day' }, procedure: [], checks: [] },
      ],
    },
  });
  entry('lightType', 'rushlight', 'Rushlight', { duration: 6, unit: 'turn', consumed: true });
  entry('race', 'marsh-folk', 'Marsh folk', { vision: 'sees in the dark 30 ft' });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
}

async function openGm(gm: string) {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  // The GM's band reads "No session yet" before the first session (st-2).
  await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
  // Next turn and the turn count need a running session (st-1, st-2): the GM starts one first.
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Session 1.');
  return user;
}

const strip = () => within(screen.getByRole('region', { name: 'Time' }));
const card = () => screen.queryByRole('region', { name: 'Due' });
const tag = (type: string) => encodeEventTag({ type, level: 'simple', requestId: crypto.randomUUID() });
// S2/S3 (page 16, T6b): Encounter check is an icon button in the band's Quick actions, not an item in ⋯.
const quickAction = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(within(screen.getByRole('group', { name: 'Quick actions' })).getByRole('button', { name }));
};
const menuItem = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(within(document.querySelector('.more-menu__panel') as HTMLElement).getByRole('button', { name }));
};

describe('Where? (DG1)', () => {
  it('a typed place goes with the start; the GM sees where it started, players never get it, and it comes back as a recent place', async () => {
    const { gm, sam, campaign } = table();
    const user = await openGm(gm);
    await typePlace(user, '  The Drowned Stair ', /^Where\?:/, await openDepart(user));
    await startExpedition(user);
    expect(await screen.findByText('Started an expedition: Dungeon, The Drowned Stair')).toBeTruthy();
    // Purpose (st-1): the band's heading names where it started; the separate "Started at …" line is gone.
    expect(await screen.findByRole('heading', { name: 'The Drowned Stair, turn 1' })).toBeTruthy();
    expect(screen.queryByText('Started at The Drowned Stair')).toBeNull();
    expect(world.tables.expedition_places).toMatchObject([{ campaign_id: campaign, name: 'The Drowned Stair', mode: 'dungeon', undone: false }]);
    // The place's log line is the GM's alone (hidden means hidden).
    const placeEvent = world.tables.events.find((e) => e.target_table === 'expedition_places');
    expect(placeEvent?.audience).toBe('gm');

    await menuItem(user, 'End expedition');
    expect(await screen.findByText('Expedition ended')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    // Through the picker (pull request 2): the place is under Recently visited, and Where? names it (B7: no Clear,
    // as Where? is required and DP1 draws none).
    await pickListedPlace(user, 'The Drowned Stair', /^Where\?:/, await openDepart(user));
    expect(screen.getByRole('button', { name: /^Where\?:/ }).textContent).toBe('The Drowned Stair');
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();

    // A player reads none of it.
    cleanup();
    world.signInAs(sam);
    expect((await world.db.from('expedition_places').select('*').eq('campaign_id', campaign)).data).toEqual([]);
  });

  it('a recent place picks the mode it started in', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openGm(gm);
    const modes = async () => departModes(user);
    await user.click((await modes()).getByRole('button', { name: 'Roaming' }));
    await typePlace(user, 'Reed Hollow', /^Where\?:/, await openDepart(user));
    await startExpedition(user);
    expect(await screen.findByRole('heading', { name: 'Reed Hollow, day 1' })).toBeTruthy();
    expect(world.tables.expeditions.at(-1)!.mode).toBe('roam');
    await menuItem(user, 'End expedition');
    await user.click(await screen.findByRole('button', { name: 'Done' }));
    await user.click((await modes()).getByRole('button', { name: 'Creeping' }));
    await pickListedPlace(user, 'Reed Hollow', /^Where\?:/, await openDepart(user));
    expect((await modes()).getByRole('button', { name: 'Roaming' }).getAttribute('aria-pressed')).toBe('true');
  });

  // Purpose: the start's toast says how many pieces came back at a place visited before (g2b gp-5), and says
  // nothing about pieces at a new place.
  it('starting at a place visited before counts the pieces shown again in the toast', async () => {
    const { gm, campaign } = table();
    world.tables.expeditions.push({ id: 'old-trip', campaign_id: campaign, session_id: null, mode: 'dungeon', started_at: 0, ended_at: 3600, who_went: [], summary: null, started_by: gm, undone: false, version: 2 });
    world.tables.places.push({ id: 'moth', campaign_id: campaign, name: 'The Moth Gallery', description: '', version: 1, undone: false });
    world.tables.place_notes.push({ id: 'moth', campaign_id: campaign, traps: '', puzzles: '', encounters: '', treasure: '', doors: '', version: 1 });
    world.tables.group_places.push({ id: 'old-visit', campaign_id: campaign, expedition_id: 'old-trip', group_number: 1, place_id: 'moth', shown: false, moved_on: false, undone: false, created_at: '2026-11-01T12:00:00Z' });
    world.tables.place_pieces.push({ id: 'drain', campaign_id: campaign, place_id: 'moth', kind: 'exit', body: 'A drain gurgles underfoot', position: 0, gm_value: '', gm_trigger: '', gm_stat_line: '', undone: false });
    world.tables.piece_shows.push({ id: 'show-drain', campaign_id: campaign, group_place_id: 'old-visit', piece_id: 'drain', group_number: 1, shown: true, shown_at: '2026-11-01T12:01:00Z', undone: false });
    const user = await openGm(gm);
    await typePlace(user, 'The Moth Gallery', /^Where\?:/, await openDepart(user));
    await startExpedition(user);
    expect(await screen.findByText('Started an expedition: Dungeon, The Moth Gallery, 1 piece shown again')).toBeTruthy();
  });
});

describe('Encounter check (DG3; Check now until B12)', () => {
  it('from ⋯, the wandering check goes on the card; Miss is logged as checking now; the schedule carries on', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openGm(gm);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await quickAction(user, 'Encounter check');
    const due = within(await screen.findByRole('region', { name: 'Due' }));
    await user.click(due.getByRole('button', { name: 'Miss, Wandering things, now' }));
    expect(await screen.findByText('Wandering things, now: a miss')).toBeTruthy();
    expect(world.tables.check_results).toMatchObject([{ check_key: 'now:check:mode:wander', outcome: 'miss' }]);
    expect(world.tables.events.find((e) => e.target_table === 'check_results')?.type).toBe('check.now');
    // The regular check still falls due at the end of turn 2.
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 2' });
    expect(card()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 3' });
    expect(within(card()!).getByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
  });

  // Purpose (S7, S18; page 16 draws no pips): the GM's Scene has no hour track, so no check marker on it; the GM's
  // Encounter check is the band's icon button (S2), and it puts the check on the card.
  it("the GM's Encounter check is the band's button, with no hour track and no marker on one", async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openGm(gm);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    expect(screen.queryByRole('list', { name: 'This hour' })).toBeNull();
    await quickAction(user, 'Encounter check');
    expect(within(await screen.findByRole('region', { name: 'Due' })).getByRole('button', { name: 'Hit, Wandering things, now' })).toBeTruthy();
  });

  // M5 gate fix (gate item 4): each tap added the check again (×2, ×3), with no toast, so Undo did nothing.
  it('tapping Encounter check twice leaves one wandering check on the card, not ×2', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openGm(gm);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await quickAction(user, 'Encounter check');
    expect(await screen.findByText('Wandering check on the card')).toBeTruthy();
    // The second tap from the band too (S7: the hour track's marker went).
    await quickAction(user, 'Encounter check');
    expect(await screen.findByText('The wandering check is already on the card')).toBeTruthy();
    const due = within(card()!);
    expect(due.getAllByRole('button', { name: 'Hit, Wandering things, now' })).toHaveLength(1);
    expect(due.queryByText(/×\s*2/)).toBeNull();
  });

  it("Encounter check's toast Undo takes the check off the card", async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openGm(gm);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await quickAction(user, 'Encounter check');
    await user.click(within((await screen.findByText('Wandering check on the card')).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hit, Wandering things, now' })).toBeNull());
    // Nothing was logged: Encounter check's line is logged only when Hit or Miss is tapped.
    expect(world.tables.check_results).toEqual([]);
  });

  it('with no wandering check at all, a pop-up says why (never a button that does nothing)', async () => {
    const { gm } = table();
    const user = await openGm(gm);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await quickAction(user, 'Encounter check');
    const dialog = within(await screen.findByRole('dialog', { name: 'Encounter check' }));
    expect(dialog.getByText(/This mode has no wandering check/)).toBeTruthy();
    expect(card()).toBeNull();
  });
});

describe('the Compact time strip (DG2)', () => {
  it('on Players during an expedition: the mode and step and Next turn, a toast with Undo, and the card one tap away on Scene', async () => {
    const { gm, campaign, clock } = table();
    withSetting(campaign, gm);
    const user = await openGm(gm);
    const sections = () => within(screen.getByRole('navigation', { name: 'Campaign sections' }));
    // None between expeditions.
    await user.click(sections().getByRole('button', { name: 'Players' }));
    expect(screen.queryByRole('region', { name: 'Time' })).toBeNull();
    await user.click(sections().getByRole('button', { name: 'Scene' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });

    await user.click(sections().getByRole('button', { name: 'Players' }));
    const compact = within(await screen.findByRole('region', { name: 'Time' }));
    expect(compact.getByText('Creeping, turn 1')).toBeTruthy();
    await user.click(compact.getByRole('button', { name: 'Next turn' }));
    expect(await screen.findByText('Next turn, nothing due')).toBeTruthy();
    expect(clock().seconds).toBe(600);
    await user.click(await within(await screen.findByRole('region', { name: 'Time' })).findByRole('button', { name: 'Next turn' }));
    expect(await screen.findByText('Next turn, 1 thing on the card')).toBeTruthy();
    expect(clock().seconds).toBe(1200);
    await user.click(await compact.findByRole('button', { name: '1 on the card, Scene ›' }));
    // Scene: the whole strip, with the same card.
    expect(await screen.findByRole('heading', { name: 'The Mustering Field, turn 3' })).toBeTruthy();
    expect(within(card()!).getByRole('button', { name: 'Hit, Wandering things' })).toBeTruthy();
    expect(screen.getAllByRole('region', { name: 'Time' })).toHaveLength(1);
  });
});

describe("the Compact time strip at a place whose own check stands in (dec-7 piece 3; review of a5e54923)", () => {
  // Purpose: the compact strip reads the place's own check too, so a Next turn there raises no mode encounter check
  // while the place's check (rolled on each move) stands in for it.
  it('raises no mode encounter check from the compact strip while a place check on each move stands in', async () => {
    const { gm, campaign, clock } = table();
    withSetting(campaign, gm);
    const harbour = { id: 'drowned-harbour', name: 'The Drowned Harbour', type: 'region', encounterCheck: { when: 'eachMove', replacesScheduled: true, chance: { die: 'd6', on: [1] }, tableId: 'harbour-things' } };
    const jetty = { id: 'the-jetty', name: '1 The jetty', type: 'site', parentId: 'drowned-harbour', playerView: { text: 'Black piles and a mooring ring.' } };
    for (const data of [harbour, jetty]) world.tables.library_entries.push({ id: `entry-${data.id}`, pack_id: 'pack-fen', kind: 'location', pack_entry_id: data.id, name: data.name, data });
    const user = await openGm(gm);
    const sections = () => within(screen.getByRole('navigation', { name: 'Campaign sections' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    const moved = await runCommand(createAppRegistry(), world.db, { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser, setPlace, { campaignId: campaign, group: 1, name: '', packEntry: { packId: 'pack-fen', packEntryId: 'the-jetty', name: '1 The jetty', data: jetty } });
    expect(moved.ok).toBe(true);

    await user.click(sections().getByRole('button', { name: 'Players' }));
    const compact = within(await screen.findByRole('region', { name: 'Time' }));
    await user.click(compact.getByRole('button', { name: 'Next turn' }));
    expect(await screen.findByText('Next turn, nothing due')).toBeTruthy();
    await user.click(await within(await screen.findByRole('region', { name: 'Time' })).findByRole('button', { name: 'Next turn' }));
    // Turn 2 is when the mode's wandering check would fall due: with the harbour's check standing in, nothing is.
    await waitFor(() => expect(clock().seconds).toBe(1200));
    expect(screen.queryByText('Next turn, 1 thing on the card')).toBeNull();
    expect(await screen.findAllByText('Next turn, nothing due')).not.toHaveLength(0);
  });
});

describe('Travelling in darkness and the daylight hint (S2-7)', () => {
  it('a switch in ⋯ in day modes, kept with the campaign, with Undo', async () => {
    const { gm, campaign } = table();
    const user = await openGm(gm);
    await user.click((await departModes(user)).getByRole('button', { name: 'Wilderness' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, day 1' });
    expect(world.tables.expeditions.at(-1)!.mode).toBe('wilderness');
    // S2/S3: the ⋯ item is a switch now (role "switch", aria-checked), not "Travelling in darkness: Off".
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    const sw = within(document.querySelector('.more-menu__panel') as HTMLElement).getByRole('switch', { name: /Travelling in darkness/ });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    await user.click(sw);
    expect(await screen.findByText('Travelling in darkness: players without a light see the dark')).toBeTruthy();
    const settings = () => world.tables.campaigns.find((c) => c.id === campaign)!.settings as Record<string, unknown> | null;
    expect(settings()?.travellingInDarkness).toBe(true);
    // Purpose (st-1): the GM's band no longer carries the "Travelling in darkness" note; the switch and the setting stand.
    expect(strip().queryByText('Travelling in darkness')).toBeNull();
    await user.click(within((await screen.findByText('Travelling in darkness: players without a light see the dark')).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(settings()?.travellingInDarkness).not.toBe(true));
  });

  // Purpose (st-1, superseding the GM's "Sunset around now" note): turn modes have no such switch, and the GM's band
  // carries no "Sunset around now" note any more, even where the pack's daylight says the sun is setting.
  it('turn modes have no such switch; the GM\'s band no longer says "Sunset around now"', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openGm(gm);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    expect(screen.queryByRole('switch', { name: /Travelling in darkness/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Travelling in darkness/ })).toBeNull();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 3' });
    expect(strip().queryByText('Sunset around now')).toBeNull();
  });
});

describe('darkness on the player\'s screen (DG7)', () => {
  /** An expedition under way in the creeping mode, and Wren with four rushlights. */
  async function delving(t: ReturnType<typeof table>, race: string | null = null) {
    withSetting(t.campaign, t.gm);
    Object.assign(world.tables.actors.find((a) => a.id === t.wren)!, { race_ref: race });
    world.tables.inventory_lines.push({ id: 'line-rush', campaign_id: t.campaign, actor_id: t.wren, location_id: null, name: 'Rushlights', category: 'light', qty: 4, stack: 10, approval: 'approved', item_data: { lightTypeId: 'rushlight' }, source_entry_id: null, version: 1 });
    world.signInAs(t.gm);
    await world.db.rpc('start_expedition', { campaign: t.campaign, mode_id: 'creep' }).setHeader('x-grimoire-command', tag('expedition.start'));
    world.signInAs(t.sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    return user;
  }

  // With no light, the page doesn't darken; the "No light" reminder shows, and lighting one ends it.
  it('no light in the group: "No light" with its one-tap light, and the page never darkens; lighting one ends it', async () => {
    const t = table();
    const user = await delving(t);
    // On the Player tab "No light" is a notice in the notices box (row C1, tfn-2): open the box first.
    await user.click(await screen.findByRole('button', { name: /^\d+ notices?, open them$/ }));
    const reminder = within(await screen.findByRole('dialog', { name: 'Notices' }));
    expect(reminder.getByText('No light')).toBeTruthy();
    // No dim and no layer over the screen (R3 audit 8).
    expect(document.documentElement.dataset.darkness).toBeUndefined();
    expect(document.querySelector('.darkness')).toBeNull();
    await user.click(reminder.getByRole('button', { name: 'Light a rushlight (4 left)' }));
    expect(await screen.findByText('Lit Rushlight')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('No light')).toBeNull());
  });

  // SC-g6-2 (ruled B, 2026-11-03): on the players' table view, each tile of a group with no light reads "◑ No light"
  // (symbol and words); once a light is lit in the group, the tiles show the light instead.
  it('a group with no light shows "◑ No light" on each marching-order tile; a lit group does not', async () => {
    const t = table();
    const user = await delving(t);
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
    // The circles (S12) in place of the tiles: each circle reads "◑ No light" in a dark group.
    const tiles = () => within(screen.getByRole('list', { name: 'Marching order, front to back' })).getAllByRole('button');
    await waitFor(() => expect(tiles().length).toBeGreaterThan(0));
    await waitFor(() => expect(tiles().every((b) => /◑\s*No light/.test(b.textContent ?? ''))).toBe(true));
    expect(tiles().every((b) => /, no light/.test(b.getAttribute('aria-label') ?? ''))).toBe(true);
    // Light one (Wren's rushlight, from the prompt slot's No light card): the group is lit, and no tile says No light.
    await user.click(within(await screen.findByRole('status', { name: 'No light' })).getByRole('button', { name: 'Light a rushlight (4 left)' }));
    await waitFor(() => expect(tiles().some((b) => /No light/.test(b.textContent ?? ''))).toBe(false));
    expect(tiles().some((b) => /rushlight/i.test(b.textContent ?? ''))).toBe(true);
  });

  // d5-20 (ruled 2026-11-20): "No light" no longer shows on the Pack tab; it stays in the Player tab's notices box.
  it('"No light" no longer shows on the Pack tab, and still shows in the Player tab\'s notices box', async () => {
    const user = await delving(table());
    await user.click(await screen.findByRole('button', { name: /^\d+ notices?, open them$/ }));
    expect(within(await screen.findByRole('dialog', { name: 'Notices' })).getByText('No light')).toBeTruthy();
    await user.keyboard('{Escape}');
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    await screen.findByText('Rushlights');
    expect(screen.queryByRole('status', { name: 'No light' })).toBeNull();
    expect(screen.queryByText('No light')).toBeNull();
  });

  // d5-20 (ruled 2026-11-20): "No light" no longer shows on the Magic tab either.
  it('"No light" no longer shows on the Magic tab', async () => {
    const t = table();
    // A spell ready today gives Wren a Magic tab (hasSpells).
    world.tables.character_play.push({ actor_id: t.wren, campaign_id: t.campaign, prepared: [{ spell: 'glimmer', level: 1 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
    const user = await delving(t);
    // The dark is read: the Player tab's box has the notice.
    await screen.findByRole('button', { name: /^[1-9]\d* notices?, open them$/ });
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Magic' }));
    await screen.findByRole('heading', { name: 'Spells' });
    expect(screen.queryByRole('status', { name: 'No light' })).toBeNull();
    expect(screen.queryByText('No light')).toBeNull();
  });

  // A character with dark sight gets the same reminder, and no grey layer either.
  it('a character with dark sight sees the reminder and no grey', async () => {
    const user = await delving(table(), 'marsh-folk');
    await user.click(await screen.findByRole('button', { name: /^\d+ notices?, open them$/ }));
    expect(within(await screen.findByRole('dialog', { name: 'Notices' })).getByText('No light')).toBeTruthy();
    expect(document.querySelector('.darkness')).toBeNull();
    expect(document.documentElement.dataset.darkness).toBeUndefined();
  });
});
