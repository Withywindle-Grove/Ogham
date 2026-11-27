// @vitest-environment jsdom
// The whole Scene's S2 and S3 (plan docs/plans/dec-9-the-whole-scene.md; page 16, T6b and T5, approved 2026-11-14,
// st-4, st-8; pictures of record 0fbaa95f), clicked through like a person would against the stand-in database.
// Invented rules only.
//   S2: three icon buttons in the band (Make camp, Encounter check, Leave the dungeon), icon only and named by their
//   words, never the accent; shown by mode and by rule while a session runs on an expedition; none in town, downtime
//   or a paused session. The tent opens a sheet only where the setting has two ways to camp. Leave the dungeon's
//   three cases: AT a way out it leaves at once with Undo; NOT, a sheet with the two ways; CAN'T TELL, the same sheet
//   with a first row that leaves at once.
//   S3: the menu holds Travelling in darkness (a toggle), Advance by…, Reminders, End expedition, End session, each
//   with its icon; in downtime also +1 week, To day… and End downtime. Reminders opens today's reminders (interim).
//   S18 for these rows: no "+ Reminder" and no Leave the dungeon button in a controls row under the band.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import type { WayOut } from '../modules/expedition/dungeonWayOut.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

// Where the party stands, as the GM's read would say (its own cases are tested in dungeonWayOut.test.ts).
let wayOutNow: WayOut | null | 'throws' = { kind: 'cantTell', why: 'handMade' };
vi.mock('../modules/expedition/dungeonWayOut.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../modules/expedition/dungeonWayOut.ts')>();
  return {
    ...real,
    loadWayOut: async () => {
      if (wayOutNow === 'throws') throw new Error('Failed to fetch');
      return wayOutNow;
    },
  };
});

// The Scene's two reads behind Make camp (B18's review): where the party is, and what waits. Each answers as the
// stand-in database does ('real'), never answers ('pending': still reading), or fails ('fails'). `landed` counts the
// real answers, so a test can tap once, after both have come.
type ReadNow = 'real' | 'pending' | 'fails';
const placeRead = { now: 'real' as ReadNow, landed: 0 };
const waitingRead = { now: 'real' as ReadNow, landed: 0 };
vi.mock('../modules/expedition/placeRules.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../modules/expedition/placeRules.ts')>();
  return {
    ...real,
    readPlaceRulesNow: (...args: Parameters<typeof real.readPlaceRulesNow>) => {
      if (placeRead.now === 'pending') return new Promise<never>(() => undefined);
      if (placeRead.now === 'fails') return Promise.resolve('unread' as const);
      return real.readPlaceRulesNow(...args).then((read) => {
        placeRead.landed += 1;
        return read;
      });
    },
  };
});
vi.mock('../modules/expedition/encounterPlay.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../modules/expedition/encounterPlay.ts')>();
  return {
    ...real,
    loadWaitingEncounters: (...args: Parameters<typeof real.loadWaitingEncounters>) => {
      if (waitingRead.now === 'pending') return new Promise<never>(() => undefined);
      if (waitingRead.now === 'fails') return Promise.resolve(null);
      return real.loadWaitingEncounters(...args).then((found) => {
        waitingRead.landed += 1;
        return found;
      });
    },
  };
});

/** Both reads behind Make camp have landed, and the Scene has taken them in: one tap is then a fair tap. */
async function campReadsLanded() {
  await waitFor(() => expect(placeRead.landed > 0 && waitingRead.landed > 0).toBe(true));
  await act(async () => {
    await Promise.resolve();
  });
}

let world: FakeWorld;

beforeEach(() => {
  placeRead.now = 'real';
  placeRead.landed = 0;
  waitingRead.now = 'real';
  waitingRead.landed = 0;
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
  wayOutNow = { kind: 'cantTell', why: 'handMade' };
});

afterEach(() => {
  cleanup();
});

/** Invented rules: a creeping turn mode (the dungeon) and a road mode by the day, each with a camp; the leaving rule; Quick camp when asked. */
function table({ quick = false, exit = true }: { quick?: boolean; exit?: boolean } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, sam, 'player', world.addCharacter(campaign, 'Wren', { ownerId: sam }));
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const camp = { procedure: [{ id: 'setup', name: 'Pitch camp', icon: 'camp', kind: 'note', note: 'Find dry ground.' }], ...(quick ? { quick: { option: 'quick-camp' } } : {}) };
  world.tables.library_entries.push({
    id: 'entry-fen-rules',
    pack_id: 'pack-fen',
    kind: 'rulesSet',
    pack_entry_id: 'fen-rules',
    name: 'Fen rules',
    data: {
      id: 'fen-rules',
      name: 'Fen rules',
      exploration: {
        modes: [
          { id: 'creep', name: 'Creeping', step: { value: 1, unit: 'turn' }, procedure: [], checks: [], camp },
          { id: 'road', name: 'Fen road', step: { value: 1, unit: 'day' }, procedure: [], checks: [], camp },
        ],
      },
      ...(exit ? { dungeonExit: { roll: { save: 'nerve' }, safePaths: 'Follow the chalk marks back.' } } : {}),
    },
  });
  // Quick camp is an optional rule (an option the campaign turns on).
  if (quick) world.tables.library_entries.push({ id: 'entry-option-quick-camp', pack_id: 'pack-fen', kind: 'option', pack_entry_id: 'quick-camp', name: 'Quick camp', data: { id: 'quick-camp', name: 'Quick camp' } });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: quick ? { 'quick-camp': 'on' } : {}, overrides: {}, priority: 1 });
  return { gm, sam, campaign };
}

async function underWay(gm: string, campaign: string, mode = 'creep') {
  world.signInAs(gm);
  await world.db.rpc('start_session', { campaign });
  await world.db.rpc('start_expedition', { campaign, mode_id: mode });
}

/** An encounter waiting for the GM on the expedition under way: a check's hit, queued and not yet started or dismissed. */
function encounterWaits(gm: string, campaign: string) {
  const expedition = String(world.tables.expeditions.find((x) => x.campaign_id === campaign)!.id);
  world.tables.check_results.push({
    id: 'check-lurkers', campaign_id: campaign, expedition_id: expedition, check_key: 'mode:fen-prowl', name: 'Prowlers', source: 'mode', outcome: 'hit', at_seconds: 0, modifiers: [], note: null,
    table_id: null, roll: '2', row_text: 'Bog lurkers (1d4)', secret: true, revealed: false, revealed_by_hand: false, created_by: gm, undone: false, version: 1, created_at: '2026-11-18T10:00:00Z',
  });
  world.tables.waiting_encounters.push({ id: 'waiting-lurkers', campaign_id: campaign, expedition_id: expedition, check_result_id: 'check-lurkers', watch: null, state: 'waiting', started_at: null, dismissed_at: null, created_by: gm, undone: false, version: 1, created_at: '2026-11-18T10:00:00Z' });
}

/**
 * The party at a Location of an invented adventure pack: the Jetty (no mark) or the Wreck, which the pack marks
 * `noCamp: true` ("no camp here", p2p-31).
 */
function partyAt(gm: string, campaign: string, entryId: 'the-jetty' | 'the-wreck') {
  world.tables.packs.push({ id: 'pack-reed', owner_user_id: gm, campaign_id: null, name: 'The Reed Marches', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-11-18T00:00:00Z', extra_meta: {} });
  world.tables.campaign_packs.push({ id: 'link-reed', campaign_id: campaign, pack_id: 'pack-reed', pack_name: 'The Reed Marches', option_choices: {}, overrides: {}, priority: 2 });
  const places: Record<string, Record<string, unknown>> = {
    'drowned-harbour': { name: 'The Drowned Harbour', type: 'site' },
    'the-jetty': { name: 'The Jetty', type: 'area', parentId: 'drowned-harbour', key: '1' },
    'the-wreck': { name: 'The Wreck', type: 'area', parentId: 'drowned-harbour', key: '2', noCamp: true },
  };
  for (const [id, data] of Object.entries(places)) world.tables.library_entries.push({ id: `entry-reed-${id}`, pack_id: 'pack-reed', kind: 'location', pack_entry_id: id, name: String(data.name), data: { id, ...data } });
  const expedition = String(world.tables.expeditions.find((x) => x.campaign_id === campaign)!.id);
  world.tables.places.push({
    id: 'place-here', campaign_id: campaign, name: String(places[entryId]!.name), description: '', version: 1, undone: false, created_by: gm, pack_id: 'pack-reed', pack_entry_id: entryId, pack_type: 'area', pack_parent_id: 'drowned-harbour', pack_key: null,
    players_name: '', region_id: null, terrain_id: null, safety: null, town: {}, created_at: '2026-11-18T00:00:00Z', updated_at: '2026-11-18T00:00:00Z',
  });
  world.tables.group_places.push({ id: 'visit-here', campaign_id: campaign, expedition_id: expedition, group_number: 1, place_id: 'place-here', shown: true, created_at: '2026-11-18T00:00:00Z', undone: false, moved_on: false });
}

async function openGm(gm: string) {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  return user;
}

// The band's sheets carry the band's heading over their title (T6b), which a screen reader hears first.
const SHEET_LEAVE = /Leave the dungeon$/;
const SHEET_CAMP = /: Make camp$/;
const band = () => within(screen.getByRole('region', { name: 'Time' }));
const tools = () => screen.queryByRole('group', { name: 'Quick actions' });
const toolNames = () => {
  const group = tools();
  return group ? within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label')) : [];
};
const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  return document.querySelector('.more-menu__panel') as HTMLElement;
};
const menuWords = (panel: HTMLElement) => [...panel.querySelectorAll('button')].map((b) => (b.querySelector('.more-menu__words > span:first-child')?.textContent ?? b.textContent ?? '').trim());

describe("the band's icon buttons (S2)", () => {
  // Purpose: in a dungeon whose setting has a camp rule and the leaving rule, the band shows all three, icon only,
  // each named by its words, none the accent.
  it('shows Make camp, Encounter check and Leave the dungeon in a turn mode, icon only and never the accent', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    await openGm(t.gm);
    await waitFor(() => expect(toolNames()).toEqual(['Make camp', 'Encounter check', 'Leave the dungeon']));
    for (const b of within(tools()!).getAllByRole('button')) {
      expect(b.className).toContain('button-secondary');
      expect(b.className).not.toContain('button-primary');
      expect(b.textContent).toBe('');
      expect(b.querySelector('svg')).toBeTruthy();
      expect(b.hasAttribute('disabled')).toBe(false);
    }
  });

  // Purpose: on another expedition (by the day) the door is absent: two buttons, the tent and the check.
  it('shows two on an expedition by the day', async () => {
    const t = table();
    await underWay(t.gm, t.campaign, 'road');
    await openGm(t.gm);
    await waitFor(() => expect(toolNames()).toEqual(['Make camp', 'Encounter check']));
  });

  // Purpose (B10; p2p-22): in point to point there is no Leave button: leaving is Move on's End expedition at a way out,
  // though the setting has the leaving rule; End expedition stays in the menu.
  it('has no door in point to point, and End expedition stays in the menu', async () => {
    const t = table();
    await underWay(t.gm, t.campaign, 'app:point-to-point');
    const user = await openGm(t.gm);
    await waitFor(() => expect(toolNames()).toContain('Encounter check'));
    expect(toolNames()).not.toContain('Leave the dungeon');
    expect(menuWords(await openMenu(user))).toContain('End expedition');
  });

  // Purpose: a setting with no leaving rule has no door.
  it('has no door where the setting has no leaving rule', async () => {
    const t = table({ exit: false });
    await underWay(t.gm, t.campaign);
    await openGm(t.gm);
    await waitFor(() => expect(toolNames()).toEqual(['Make camp', 'Encounter check']));
  });

  // Purpose: none show in downtime, nor while the session is paused.
  it('shows none in downtime or while paused', async () => {
    const t = table();
    world.signInAs(t.gm);
    await world.db.rpc('start_session', { campaign: t.campaign });
    await openGm(t.gm);
    await band().findByRole('button', { name: 'Next day' });
    expect(tools()).toBeNull();
    cleanup();
    await world.db.rpc('start_expedition', { campaign: t.campaign, mode_id: 'creep' });
    const session = world.tables.sessions.find((s) => s.campaign_id === t.campaign)!;
    await world.db.rpc('end_session', { campaign: t.campaign, session: String(session.id) });
    await openGm(t.gm);
    await band().findByRole('button', { name: 'Resume session' });
    expect(tools()).toBeNull();
  });

  // Purpose: with one way to camp the tent makes camp at once, with its toast and Undo, and no sheet.
  it('makes camp at once where the setting has one way', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    const user = await openGm(t.gm);
    const tent = await screen.findByRole('button', { name: 'Make camp' });
    await campReadsLanded();
    await user.click(tent);
    expect(await screen.findByText('Camp made')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: SHEET_CAMP })).toBeNull();
    expect(world.tables.camps.filter((c) => !c.undone)).toHaveLength(1);
  });

  // Purpose: where the setting has Quick camp the tent opens a sheet with Make camp and Quick camp; Quick camp makes a quick camp.
  it('opens a sheet with Make camp and Quick camp where the setting has two ways', async () => {
    const t = table({ quick: true });
    await underWay(t.gm, t.campaign);
    const user = await openGm(t.gm);
    const tent = await screen.findByRole('button', { name: 'Make camp' });
    await campReadsLanded();
    await user.click(tent);
    const sheet = within(await screen.findByRole('dialog', { name: SHEET_CAMP }));
    expect(sheet.getByRole('button', { name: 'Make camp' }).className).toContain('button-primary');
    await user.click(sheet.getByRole('button', { name: 'Quick camp' }));
    expect(await screen.findByText('Quick camp made')).toBeTruthy();
    expect(world.tables.camps.filter((c) => !c.undone).map((c) => c.quick)).toEqual([true]);
  });

  // Purpose (B18, p2p-23): while an encounter waits, the tent explains in a pop-up and makes no camp; once the
  // pop-up is closed nothing has changed. The button is never disabled.
  it('while an encounter waits, the tent explains in a pop-up and makes no camp', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    encounterWaits(t.gm, t.campaign);
    const user = await openGm(t.gm);
    const tent = await screen.findByRole('button', { name: 'Make camp' });
    expect(tent.hasAttribute('disabled')).toBe(false);
    await campReadsLanded();
    await waitFor(() => expect(screen.getAllByText(/Bog lurkers/).length).toBeGreaterThan(0));
    await user.click(tent);
    const why = within(await screen.findByRole('dialog', { name: 'Make camp' }));
    expect(why.getByText('An encounter is waiting. Start it or dismiss it under Waiting for you, then make camp.')).toBeTruthy();
    expect(screen.queryByText('Camp made')).toBeNull();
    expect(world.tables.camps).toHaveLength(0);
    await user.click(why.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Make camp' })).toBeNull();
    expect(world.tables.camps).toHaveLength(0);
  });

  // Purpose (B18): where the setting has two ways to camp, a waiting encounter stops the tent before its sheet: the
  // GM is never offered Quick camp as a way round.
  it('a waiting encounter stops the tent before the two-ways sheet', async () => {
    const t = table({ quick: true });
    await underWay(t.gm, t.campaign);
    encounterWaits(t.gm, t.campaign);
    const user = await openGm(t.gm);
    const tent = await screen.findByRole('button', { name: 'Make camp' });
    await campReadsLanded();
    await user.click(tent);
    expect(await screen.findByText(/An encounter is waiting\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quick camp' })).toBeNull();
    expect(world.tables.camps).toHaveLength(0);
  });

  // Purpose (B18, p2p-23, p2p-31): at a Location the pack marks "no camp here" the tent explains in its own words,
  // naming the place, and makes no camp.
  it('at a Location marked "no camp here", the tent explains in its own words and makes no camp', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    partyAt(t.gm, t.campaign, 'the-wreck');
    const user = await openGm(t.gm);
    const tent = await screen.findByRole('button', { name: 'Make camp' });
    // One tap, once the place has been read.
    await campReadsLanded();
    await user.click(tent);
    expect(within(await screen.findByRole('dialog', { name: 'Make camp' })).getByText('The adventure pack says there is no camp at The Wreck. Move on, then make camp.')).toBeTruthy();
    expect(screen.queryByText('Camp made')).toBeNull();
    expect(world.tables.camps).toHaveLength(0);
  });

  // Purpose (B18's review): until the Scene has read where the party is, it cannot know the place allows a camp. A
  // tap in that time says it is still reading, and makes no camp, even at a place that would allow one.
  it('while the place is still being read, the tent says so and makes no camp', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    partyAt(t.gm, t.campaign, 'the-wreck');
    placeRead.now = 'pending';
    const user = await openGm(t.gm);
    await user.click(await screen.findByRole('button', { name: 'Make camp' }));
    expect(within(await screen.findByRole('dialog', { name: 'Make camp' })).getByText('Still reading what is waiting here. Try again in a moment.')).toBeTruthy();
    expect(screen.queryByText('Camp made')).toBeNull();
    expect(world.tables.camps).toHaveLength(0);
  });

  // Purpose (B18's review): the same while what waits is still being read: an encounter may be waiting unseen.
  it('while what waits is still being read, the tent says so and makes no camp', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    encounterWaits(t.gm, t.campaign);
    waitingRead.now = 'pending';
    const user = await openGm(t.gm);
    await user.click(await screen.findByRole('button', { name: 'Make camp' }));
    expect(within(await screen.findByRole('dialog', { name: 'Make camp' })).getByText('Still reading what is waiting here. Try again in a moment.')).toBeTruthy();
    expect(world.tables.camps).toHaveLength(0);
  });

  // Purpose (B18's review): a read that failed is not "nothing here". The tent says it couldn't read and makes no
  // camp, at a marked Location and at any other; the tap asks for the read again, so once the connection is back the
  // next tap is answered rightly (here: the marked Location's own words).
  it('when the place could not be read, the tent says so, makes no camp, and reads again', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    partyAt(t.gm, t.campaign, 'the-wreck');
    placeRead.now = 'fails';
    const user = await openGm(t.gm);
    const tent = await screen.findByRole('button', { name: 'Make camp' });
    await user.click(tent);
    const why = within(await screen.findByRole('dialog', { name: 'Make camp' }));
    expect(why.getByText("Couldn't read what is waiting here. Check your connection and try again.")).toBeTruthy();
    expect(world.tables.camps).toHaveLength(0);
    // The connection is back: the tap above asked again, and that read lands.
    placeRead.now = 'real';
    await user.click(why.getByRole('button', { name: 'Close' }));
    await user.click(tent);
    await user.click(within(await screen.findByRole('dialog', { name: 'Make camp' })).getByRole('button', { name: 'Close' }));
    await campReadsLanded();
    await user.click(tent);
    expect(within(await screen.findByRole('dialog', { name: 'Make camp' })).getByText('The adventure pack says there is no camp at The Wreck. Move on, then make camp.')).toBeTruthy();
    expect(world.tables.camps).toHaveLength(0);
  });

  // Purpose (B18's review): when what waits could not be read, the tent says so and makes no camp: a failed read
  // never counts as "no encounter waits".
  it('when what waits could not be read, the tent says so and makes no camp', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    encounterWaits(t.gm, t.campaign);
    waitingRead.now = 'fails';
    const user = await openGm(t.gm);
    await user.click(await screen.findByRole('button', { name: 'Make camp' }));
    expect(within(await screen.findByRole('dialog', { name: 'Make camp' })).getByText("Couldn't read what is waiting here. Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByText('Camp made')).toBeNull();
    expect(world.tables.camps).toHaveLength(0);
  });

  // Purpose (B18): at a Location of the same pack with no mark, and nothing waiting, camp is made as today.
  it('at a Location with no mark and nothing waiting, camp is made as today', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    partyAt(t.gm, t.campaign, 'the-jetty');
    const user = await openGm(t.gm);
    const tent = await screen.findByRole('button', { name: 'Make camp' });
    await campReadsLanded();
    await user.click(tent);
    expect(await screen.findByText('Camp made')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Make camp' })).toBeNull();
    expect(world.tables.camps.filter((c) => !c.undone)).toHaveLength(1);
  });

  // Purpose: Encounter check runs today's command: with no wandering check it says why in a pop-up (never a button that does nothing).
  it('Encounter check says why when the mode has no wandering check', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    const user = await openGm(t.gm);
    await user.click(await screen.findByRole('button', { name: 'Encounter check' }));
    expect(await screen.findByText(/This mode has no wandering check/)).toBeTruthy();
  });
});

describe('Leave the dungeon, three cases (st-4, st-9)', () => {
  // Purpose: where the app knows the party is at a way out, one tap leaves, with the toast and Undo; no sheet.
  it('leaves at once at a way out, and Undo brings the expedition back', async () => {
    wayOutNow = { kind: 'at', leadsTo: ['moor-road'] };
    const t = table();
    await underWay(t.gm, t.campaign);
    const user = await openGm(t.gm);
    await user.click(await screen.findByRole('button', { name: SHEET_LEAVE }));
    const toast = (await screen.findByText('The party left the dungeon.')).closest('.toast') as HTMLElement;
    expect(screen.queryByRole('dialog', { name: SHEET_LEAVE })).toBeNull();
    expect(world.tables.expeditions[0]!.ended_at).not.toBeNull();
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.expeditions[0]!.ended_at).toBeNull());
  });

  // Purpose (S19 follow-up): after leaving, Start downtime on the end card takes down "The party left …" with its Undo,
  // so that Undo can't un-end the expedition during downtime.
  it('Start downtime after leaving takes down the leave toast and its Undo', async () => {
    wayOutNow = { kind: 'at', leadsTo: ['moor-road'] };
    const t = table();
    await underWay(t.gm, t.campaign);
    const user = await openGm(t.gm);
    await user.click(await screen.findByRole('button', { name: SHEET_LEAVE }));
    await screen.findByText('The party left the dungeon.');
    const card = within(await screen.findByRole('region', { name: 'Expedition ended' }));
    await user.click(within(card.getByRole('group', { name: 'In a safe place?' })).getByRole('button', { name: 'Yes' }));
    await user.click(await card.findByRole('button', { name: 'Start downtime' }));
    expect(await screen.findByText('Downtime began')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('The party left the dungeon.')).toBeNull());
    expect(document.querySelector('.toast')).toBeNull();
    expect(world.tables.expeditions[0]!.ended_at).not.toBeNull();
  });

  // Purpose: where it knows the party isn't at one, the sheet has the two ways as stacked buttons, each with its line, and no first row.
  it('opens the two ways where the party is not at a way out', async () => {
    wayOutNow = { kind: 'not' };
    const t = table();
    await underWay(t.gm, t.campaign);
    const user = await openGm(t.gm);
    await user.click(await screen.findByRole('button', { name: SHEET_LEAVE }));
    const sheet = within(await screen.findByRole('dialog', { name: SHEET_LEAVE }));
    expect(sheet.queryByRole('button', { name: /The party is at a way out/ })).toBeNull();
    for (const name of ['Ask for escape rolls', 'Use safe paths']) {
      const b = sheet.getByRole('button', { name });
      expect(b.className).toContain('stacked-button');
      expect(b.querySelector('svg')).toBeTruthy();
    }
    expect(sheet.getByText('Follow the chalk marks back.')).toBeTruthy();
    expect(sheet.getByText(/Save: nerve, one roll each/)).toBeTruthy();
  });

  // Purpose: where it can't tell, the same sheet has a first row that leaves at once.
  // Purpose (#841's review): a read that fails says "can't tell" (the sheet with its first row), and the door still
  // answers the next tap: a thrown read never leaves it deaf.
  it('opens the sheet when the read fails, and the door still answers afterwards', async () => {
    wayOutNow = 'throws';
    const t = table();
    await underWay(t.gm, t.campaign);
    const user = await openGm(t.gm);
    for (let tap = 0; tap < 2; tap += 1) {
      await user.click(await screen.findByRole('button', { name: 'Leave the dungeon' }));
      const sheet = within(await screen.findByRole('dialog', { name: SHEET_LEAVE }));
      expect(sheet.getByRole('button', { name: /The party is at a way out/ })).toBeTruthy();
      await user.click(sheet.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: SHEET_LEAVE })).toBeNull());
    }
  });

  it('offers a first row that leaves at once where the app can’t tell', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    const user = await openGm(t.gm);
    await user.click(await screen.findByRole('button', { name: SHEET_LEAVE }));
    const sheet = within(await screen.findByRole('dialog', { name: SHEET_LEAVE }));
    expect(sheet.getByRole('button', { name: 'Use safe paths' })).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: /The party is at a way out/ }));
    expect(await screen.findByText('The party left the dungeon.')).toBeTruthy();
    expect(world.tables.expeditions[0]!.ended_at).not.toBeNull();
  });

  // Purpose: Use safe paths is logged once, with Undo, and closes the sheet (its pack's line is shown before the tap).
  it('Use safe paths logs once, with Undo, and closes the sheet', async () => {
    wayOutNow = { kind: 'not' };
    const t = table();
    await underWay(t.gm, t.campaign);
    const user = await openGm(t.gm);
    await user.click(await screen.findByRole('button', { name: SHEET_LEAVE }));
    const sheet = within(await screen.findByRole('dialog', { name: SHEET_LEAVE }));
    await user.click(sheet.getByRole('button', { name: 'Use safe paths' }));
    expect(await screen.findByText('Left by safe paths')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: SHEET_LEAVE })).toBeNull());
    expect(world.tables.events.filter((e) => e.type === 'expedition.safePaths')).toHaveLength(1);
  });
});

describe("the band's menu (S3)", () => {
  // Purpose: on an expedition by the day the menu holds Encounter tables first (sf-3, ⚑ 4), then Travelling in darkness as a toggle, then Advance by…,
  // Reminders, End expedition and End session, each with its icon; Make camp, Quick camp and Encounter check are not in it.
  it('lists what the band does not hold, each with its icon', async () => {
    const t = table({ quick: true });
    await underWay(t.gm, t.campaign, 'road');
    const user = await openGm(t.gm);
    await screen.findByRole('group', { name: 'Quick actions' });
    const panel = await openMenu(user);
    expect(within(panel).getByRole('switch', { name: /Travelling in darkness/ }).getAttribute('aria-checked')).toBe('false');
    // "Encounter tables" first during an expedition (sf-3, ⚑ 4; page 44, EN7 A).
    expect(menuWords(panel)).toEqual(['Encounter tables', 'Travelling in darkness', 'Advance by…', 'Reminders', 'End expedition', 'End session']);
    for (const b of panel.querySelectorAll('button')) expect(b.querySelector('svg')).toBeTruthy();
  });

  // Purpose: the toggle turns Travelling in darkness on, with its toast.
  it('turns Travelling in darkness on from its toggle', async () => {
    const t = table();
    await underWay(t.gm, t.campaign, 'road');
    const user = await openGm(t.gm);
    await screen.findByRole('group', { name: 'Quick actions' });
    const panel = await openMenu(user);
    await user.click(within(panel).getByRole('switch', { name: /Travelling in darkness/ }));
    expect(await screen.findByText('Travelling in darkness: players without a light see the dark')).toBeTruthy();
  });

  // Purpose: in downtime the menu has Advance by…, +1 week, To day…, Reminders, End downtime and End session.
  it('in downtime lists +1 week, To day… and End downtime', async () => {
    const t = table();
    world.signInAs(t.gm);
    await world.db.rpc('start_session', { campaign: t.campaign });
    const user = await openGm(t.gm);
    await band().findByRole('button', { name: 'Next day' });
    const panel = await openMenu(user);
    expect(menuWords(panel)).toEqual(['Advance by…', '+1 week', 'To day…', 'Reminders', 'End downtime', 'End session']);
  });

  // Purpose: Reminders opens the Reminders sheet (+ Reminder; S10); nothing of the reminders or the
  // dungeon's leaving sits in a row under the band any more.
  it('opens the Reminders sheet from Reminders, and no controls row holds + Reminder or Leave the dungeon', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    const user = await openGm(t.gm);
    await screen.findByRole('group', { name: 'Quick actions' });
    expect(band().queryByRole('button', { name: '+ Reminder' })).toBeNull();
    expect(document.querySelector('.time-strip__controls')).toBeNull();
    const panel = await openMenu(user);
    await user.click(within(panel).getByRole('button', { name: 'Reminders' }));
    const sheet = within(await screen.findByRole('dialog', { name: /Reminders$/ }));
    expect(sheet.getByRole('button', { name: '+ Reminder' })).toBeTruthy();
  });

  // Purpose (S10, st-3, T6; sa-1): the Reminders sheet says "No reminders yet." when there are none, and its one
  // button, the stacked + Reminder with the bell, is not an accent.
  it('the Reminders sheet: no reminders yet, and + Reminder stacked and plain', async () => {
    const t = table();
    await underWay(t.gm, t.campaign);
    const user = await openGm(t.gm);
    const panel = await openMenu(user);
    await user.click(within(panel).getByRole('button', { name: 'Reminders' }));
    const sheet = await screen.findByRole('dialog', { name: /Reminders$/ });
    expect(within(sheet).getByText('No reminders yet.')).toBeTruthy();
    const add = within(sheet).getByRole('button', { name: '+ Reminder' });
    expect(add.classList.contains('stacked-button')).toBe(true);
    expect(sheet.querySelectorAll('.button-primary')).toHaveLength(0);
  });
});
