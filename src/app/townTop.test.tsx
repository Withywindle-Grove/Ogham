// @vitest-environment jsdom
// S5, the town's and downtime's top (plan docs/plans/dec-9-the-whole-scene.md row S5; page 16, T4, T5 and T6's Start
// sheet; st-1, st-8, mc-69, ic-5; the lead's rulings of 2026-11-15), clicked through like a person would, against the
// stand-in database. Invented rules only.
//   In town the band names the part of the day, its step reads "Advance time" (whatever the step's length) and is
//   quiet, and "Depart" is the page's one accent; the facts are the part of the day (and Weather where it has a view);
//   there is no Light fact and no safety fact.
//   Depart opens the Depart sheet (p2p-5; page 24, DP1, B7): Where? first and required (Locations only, under their
//   Area, where a pack gives any), then "Exploration method" (the setting's ways and Point to point, filled in from
//   the place), then Start; with nothing picked, Start explains in a pop-up.
//   Downtime: "Next day" with no accent, and Depart beside it, plain; no fact but Weather (none today: the weather is
//   kept per expedition).
//   The mode's own advance words stay where they were: an expedition in a town mode still says "Next part of day".
//   Depart only while a session runs (p2p-4; page 24, DP2, approved 2026-11-18; B6): with no session the band shows
//   Start alone, paused Resume alone, running in town Advance time and Depart; the same in downtime.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { departModes, openDepart, startExpedition } from '../testing/depart.ts';
import { typePlace } from '../testing/pickPlace.ts';
import { forgetPackPlaces } from '../modules/expedition/placePlay.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  forgetPackPlaces();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

const MORNING = 6 * 3600;

/** A GM, one player's character, invented rules: a market town by parts of the day (one, or `parts`), and cellars by the turn. */
function table({ parts = 1, mode = 'adventure' }: { parts?: number; mode?: 'adventure' | 'downtime' } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  world.tables.packs.push({ id: 'pack-quay', owner_user_id: gm, campaign_id: null, name: 'Quay Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  world.tables.library_entries.push({
    id: 'entry-quay-rules',
    pack_id: 'pack-quay',
    kind: 'rulesSet',
    pack_entry_id: 'quay-rules',
    name: 'Quay rules',
    data: {
      id: 'quay-rules',
      name: 'Quay rules',
      exploration: {
        modes: [
          { id: 'quay', name: 'Market town', step: { value: parts, unit: 'partOfDay' }, procedure: [], checks: [] },
          { id: 'cellars', name: 'Under the quay', step: { value: 1, unit: 'turn' }, procedure: [], checks: [] },
        ],
      },
    },
  });
  world.tables.campaign_packs.push({ id: 'link-quay', campaign_id: campaign, pack_id: 'pack-quay', pack_name: 'Quay Rules', option_choices: {}, overrides: {}, priority: 1 });
  world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds = MORNING;
  world.tables.campaigns.find((c) => c.id === campaign)!.mode = mode;
  return { gm, sam, campaign };
}

/** The GM's Scene for the campaign, with no session started. */
async function openScene(gm: string) {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  return user;
}

async function openGm(gm: string) {
  const user = await openScene(gm);
  await user.click(await screen.findByRole('button', { name: 'Start session' }));
  await screen.findByText('Session 1.');
  return user;
}

const band = () => within(screen.getByRole('region', { name: 'Time' }));
/** The band's buttons at its right (the actions and the menu), by the names they are read aloud by. */
const bandButtons = () => [...document.querySelectorAll<HTMLElement>('.scene-band__actions button')].map((b) => b.getAttribute('aria-label') ?? b.textContent);
const facts = () => screen.queryByRole('group', { name: 'Scene facts' });
const factLabels = () => [...(facts()?.querySelectorAll('.scene-fact__label') ?? [])].map((l) => l.textContent);
/** Every accent button on the page (one accent a screen). */
const accents = () => [...document.querySelectorAll('.button-primary')].filter((b) => !b.closest('[role="dialog"]'));

describe("the town's top (S5, T4)", () => {
  // Purpose: in town the band names the part of the day, its step reads "Advance time" and is quiet, Depart is the
  // one accent, and the facts are the part of the day alone: no Light fact (mc-69), no safety fact.
  it('names the part of the day, with Advance time quiet and Depart the one accent; no Light or safety fact', async () => {
    const { gm } = table();
    await openGm(gm);
    const step = await band().findByRole('button', { name: 'Advance time' });
    expect(step.className).not.toContain('button-primary');
    const depart = band().getByRole('button', { name: 'Depart' });
    expect(depart.className).toContain('button-primary');
    expect(accents()).toEqual([depart]);
    // (The date line is still the tap that sets the hour here, st-2; once the clock has moved it names the part of
    // the day where the light would be: the next test.)
    expect(factLabels()).toEqual(['Part of the day']);
    expect(within(facts()!).getByText('Morning')).toBeTruthy();
    expect(within(facts()!).getByText('Afternoon comes next.')).toBeTruthy();
    expect(screen.queryByText(/light left|^Night\.$|Dusk/)).toBeNull();
    // No old names left: Start expedition and the mode's advance words went from the band.
    expect(screen.queryByRole('button', { name: 'Start expedition' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next part of day' })).toBeNull();
  });

  // Purpose: the town's step reads "Advance time" for a two-part step too ("Next 2 parts of the day" goes), and moves
  // two parts; the date line then names the part of the day where the light would be (T4).
  it('reads Advance time for a two-part step, and moves two parts', async () => {
    const { gm } = table({ parts: 2 });
    const user = await openGm(gm);
    await user.click(await band().findByRole('button', { name: 'Advance time' }));
    expect(screen.queryByRole('button', { name: 'Next 2 parts of the day' })).toBeNull();
    await waitFor(() => expect(band().getByText('Night.')).toBeTruthy());
    expect(within(facts()!).getByText('Morning comes next.')).toBeTruthy();
  });

  // Purpose: a tap on the part of the day opens Advance by…, and its name says so.
  it('the part of the day opens Advance by…, read aloud as such', async () => {
    const { gm } = table();
    const user = await openGm(gm);
    await user.click(await screen.findByRole('button', { name: 'Part of the day: Morning. Afternoon comes next. Advance by…' }));
    expect(await screen.findByRole('dialog', { name: /Advance by…/ })).toBeTruthy();
  });

  // Purpose (S15; #883's review): a player in town reads the part of the day but never moves the clock: their tile's
  // name has no "Advance by…", and a tap opens the part's words to read, never the clock's sheet.
  it("a player's part of the day opens its words, never Advance by…", async () => {
    const { gm, sam, campaign } = table();
    world.signInAs(gm);
    await world.db.rpc('start_session', { campaign });
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
    const part = await screen.findByRole('button', { name: 'Part of the day: Morning. Afternoon comes next.' });
    expect(screen.queryByRole('button', { name: /Advance by…/ })).toBeNull();
    await user.click(part);
    const words = within(await screen.findByRole('dialog', { name: 'Part of the day' }));
    expect(words.getByText('Morning. Afternoon comes next.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: /Advance by…/ })).toBeNull();
    expect(words.queryByRole('textbox')).toBeNull();
  });

  // Purpose: an expedition in the town mode keeps the mode's own step, "Next part of day"; a step that brings nothing
  // says so in its toast (sf-3, ⚑ 4: no "<title>, nothing due" line stands during an expedition).
  it('an expedition in the town mode keeps "Next part of day"; its toast says nothing is due', async () => {
    const { gm } = table();
    const user = await openGm(gm);
    await user.click((await departModes(user)).getByRole('button', { name: 'Market town' }));
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, morning' });
    expect(world.tables.expeditions.at(-1)!.mode).toBe('quay');
    await user.click(band().getByRole('button', { name: 'Next part of day' }));
    // During an expedition the toast says "nothing due"; no line stands on the Scene (sf-3, ⚑ 4).
    await waitFor(() => expect(Array.from(document.querySelectorAll('.toast')).some((t) => /, nothing due\./.test(t.textContent ?? ''))).toBe(true));
    expect(screen.queryByText('Next part of day, nothing due')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Advance time' })).toBeNull();
  });
});

describe("the band by the session's state (p2p-4; page 24, DP2)", () => {
  // Purpose: with no session yet, the band shows Start alone, the one accent: no Depart and no step beside it.
  it('no session yet: Start alone, the accent', async () => {
    const { gm } = table();
    await openScene(gm);
    const start = await band().findByRole('button', { name: 'Start session' });
    expect(start.className).toContain('button-primary');
    expect(bandButtons()).toEqual(['Start session', 'Time options']);
    expect(screen.queryByRole('button', { name: 'Depart' })).toBeNull();
    expect(accents()).toEqual([start]);
  });

  // Purpose: with the session paused, the band shows Resume alone, the one accent; Resume brings back Advance time and
  // Depart, with Depart the accent again.
  it('paused: Resume alone, the accent; Resume brings Depart back', async () => {
    const { gm } = table();
    const user = await openGm(gm);
    expect(bandButtons()).toEqual(['Advance time', 'Depart', 'Time options']);
    await user.click(band().getByRole('button', { name: 'Time options' }));
    await user.click(await screen.findByRole('button', { name: 'End session' }));
    const resume = await band().findByRole('button', { name: 'Resume session' });
    expect(resume.className).toContain('button-primary');
    expect(bandButtons()).toEqual(['Resume session', 'Time options']);
    expect(screen.queryByRole('button', { name: 'Depart' })).toBeNull();
    expect(accents()).toEqual([resume]);
    await user.click(resume);
    expect(await screen.findByText('Session 2.')).toBeTruthy();
    await waitFor(() => expect(bandButtons()).toEqual(['Advance time', 'Depart', 'Time options']));
    expect(band().getByRole('button', { name: 'Depart' }).className).toContain('button-primary');
  });

  // Purpose: in downtime too, Depart waits for a session: with none, Start alone; once it runs, Next day and Depart.
  it('downtime: Start alone with no session, then Next day and Depart', async () => {
    const { gm } = table({ mode: 'downtime' });
    const user = await openScene(gm);
    await band().findByRole('button', { name: 'Start session' });
    expect(bandButtons()).toEqual(['Start session', 'Time options']);
    expect(screen.queryByRole('button', { name: 'Depart' })).toBeNull();
    await user.click(band().getByRole('button', { name: 'Start session' }));
    await screen.findByText('Session 1.');
    await waitFor(() => expect(bandButtons()).toEqual(['Next day', 'Depart', 'Time options']));
  });
});

/** The labels of the open Depart sheet's fields, in the order they show. */
const fieldLabels = () => [...document.querySelectorAll('.depart-sheet__field > .label')].map((l) => l.textContent);
/** The sides of the sheet's "Exploration method" that read as chosen. */
const chosen = (how: Awaited<ReturnType<typeof departModes>>) =>
  how
    .getAllByRole('button')
    .filter((b: HTMLElement) => b.getAttribute('aria-pressed') === 'true')
    .map((b: HTMLElement) => b.textContent);

describe('the Depart sheet (S5, T6; p2p-5, page 24, DP1)', () => {
  // Purpose (B7): Depart opens the sheet titled Depart: Where? first, then "Exploration method" as one switch of three
  // sides (the setting's two ways, then Point to point), unset while nothing is picked; no hour (known in town); and
  // Start as the sheet's accent. With a place picked, Start starts the expedition in the chosen way and closes the sheet.
  it('asks where first, then the method, and starts on Start', async () => {
    const { gm } = table();
    const user = await openGm(gm);
    const sheet = await openDepart(user);
    expect(sheet.getByRole('heading', { name: 'Depart' })).toBeTruthy();
    expect(fieldLabels()).toEqual(['Where?', 'Exploration method']);
    expect(sheet.queryByRole('group', { name: 'Exploring how?' })).toBeNull();
    expect(sheet.getByRole('button', { name: 'Where?: Pick a Location' }).textContent).toBe('Pick a Location');
    const how = sheet.getByRole('group', { name: 'Exploration method' });
    expect(how.className).toContain('button-row--switch');
    expect(within(how).getAllByRole('button').map((b) => b.textContent)).toEqual(['Market town', 'Under the quay', 'Point to point']);
    expect(chosen(within(how))).toEqual([]);
    expect(sheet.queryByRole('button', { name: /^(Dawn|Noon|Dusk)$/ })).toBeNull();
    expect(sheet.queryByRole('button', { name: 'Clear' })).toBeNull();
    const start = sheet.getByRole('button', { name: 'Start' });
    expect(start.className).toContain('button-primary');
    await typePlace(user, 'Bog Ford', /^Where\?:/, sheet);
    await user.click(within(how).getByRole('button', { name: 'Under the quay' }));
    await user.click(start);
    expect(await screen.findByRole('heading', { name: 'Bog Ford, turn 1' })).toBeTruthy();
    expect(world.tables.expeditions.at(-1)!.mode).toBe('cellars');
    expect(screen.queryByRole('dialog', { name: /Depart$/ })).toBeNull();
    expect(world.tables.expeditions.filter((x) => !x.undone)).toHaveLength(1);
  });

  // Purpose (⚑ 4, DP1 with its fix): with nothing picked, Start stays a button; its tap opens "Pick a Location first",
  // which says "An expedition starts at a Location." and nothing more, and starts nothing. Got it closes it.
  it('Start with nothing picked explains in a pop-up and starts nothing', async () => {
    const { gm } = table();
    const user = await openGm(gm);
    const sheet = await openDepart(user);
    await user.click(sheet.getByRole('button', { name: 'Start' }));
    const pop = within(await screen.findByRole('dialog', { name: 'Pick a Location first' }));
    expect(pop.getAllByRole('paragraph').map((p) => p.textContent)).toEqual(['An expedition starts at a Location.']);
    expect(world.tables.expeditions).toHaveLength(0);
    await user.click(pop.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pick a Location first' })).toBeNull());
    // The sheet stays open, Where? still to pick.
    expect(screen.getByRole('dialog', { name: /Depart$/ })).toBeTruthy();
  });
});

describe("the Depart sheet's Where?: Locations only (p2p-2, p2p-5; page 24, DP1)", () => {
  /** An adventure pack with Locations under two Areas (invented): The Drowned Harbour and The Shingle Beach. */
  function withLocations(campaign: string, gm: string) {
    world.tables.packs.push({ id: 'pack-isle', owner_user_id: gm, campaign_id: null, name: 'Saltwick Isle', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-11-18T12:00:00Z' });
    world.tables.campaign_packs.push({ id: 'link-isle', campaign_id: campaign, pack_id: 'pack-isle', pack_name: 'Saltwick Isle', option_choices: {}, overrides: {}, priority: 2 });
    const places = [
      { id: 'a1-isle', name: 'Saltwick Island', type: 'region', parentId: null },
      { id: 'a2-harbour', name: 'The Drowned Harbour', type: 'site', parentId: 'a1-isle' },
      { id: 'a3-anchorage', name: 'The Anchorage', type: 'area', parentId: 'a2-harbour' },
      { id: 'a4-jetty', name: 'The Jetty', type: 'area', parentId: 'a2-harbour', key: '1' },
      { id: 'a5-wreck', name: 'The Wreck', type: 'area', parentId: 'a2-harbour', key: '2' },
      { id: 'a6-beach', name: 'The Shingle Beach', type: 'site', parentId: 'a1-isle' },
      { id: 'a7-landing', name: 'The Landing', type: 'area', parentId: 'a6-beach' },
    ];
    for (const data of places) world.tables.library_entries.push({ id: `entry-${data.id}`, pack_id: 'pack-isle', kind: 'location', pack_entry_id: data.id, name: data.name, data });
  }

  // Purpose (B7, sf-2): Where? lists the Locations, each under its Area's name, the first Area open (no place played
  // yet) and the others folded, with no Area or Region as a row; the search stands over them; a pack with no Locations
  // (a hex) unfolds in place under From your packs; Other… takes a typed name, and a typed place keeps today's start
  // for the method (⚑ 6).
  it('lists Locations under their Area, the packs with other places, then Other…', async () => {
    const { gm, campaign } = table();
    withLocations(campaign, gm);
    world.tables.packs.push({ id: 'pack-wilds', owner_user_id: gm, campaign_id: null, name: 'Fen Wilds', version: '1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-11-18T12:00:00Z' });
    world.tables.campaign_packs.push({ id: 'link-wilds', campaign_id: campaign, pack_id: 'pack-wilds', pack_name: 'Fen Wilds', option_choices: {}, overrides: {}, priority: 3 });
    world.tables.library_entries.push({ id: 'entry-w-0412', pack_id: 'pack-wilds', kind: 'location', pack_entry_id: 'w-0412', name: 'Oath Isle', data: { id: 'w-0412', name: 'Oath Isle', type: 'area', parentId: null, hex: '0412', key: '0412' } });
    const user = await openGm(gm);
    const sheet = await openDepart(user);
    await user.click(sheet.getByRole('button', { name: 'Where?: Pick a Location' }));
    const picker = within(await screen.findByRole('dialog', { name: /Where\?$/ }));
    const harbour = within(await picker.findByRole('region', { name: 'The Drowned Harbour' }));
    expect(harbour.getAllByRole('button', { pressed: false }).map((b) => b.textContent)).toEqual(['The Anchorage', '1. The Jetty', '2. The Wreck']);
    const beach = within(picker.getByRole('region', { name: 'The Shingle Beach' }));
    expect(beach.queryAllByRole('button', { pressed: false })).toEqual([]);
    await user.click(beach.getByRole('button', { name: 'Show The Shingle Beach' }));
    expect(beach.getAllByRole('button', { pressed: false }).map((b) => b.textContent)).toEqual(['The Landing']);
    expect(picker.queryByRole('button', { name: /^(Saltwick Island|The Drowned Harbour|The Shingle Beach)$/ })).toBeNull();
    expect(picker.getByRole('textbox', { name: 'Search places by name or map number' })).toBeTruthy();
    await user.click(picker.getByRole('button', { name: 'Show Fen Wilds' }));
    expect(picker.getByRole('button', { name: '0412. Oath Isle' })).toBeTruthy();
    await user.click(picker.getByRole('button', { name: /^Other… a place/ }));
    await user.type(picker.getByRole('textbox', { name: "A place that isn't listed" }), 'Bog Ford');
    await user.click(picker.getByRole('button', { name: 'Set place' }));
    expect(await sheet.findByRole('button', { name: 'Where?: Bog Ford' })).toBeTruthy();
    expect(chosen(within(sheet.getByRole('group', { name: 'Exploration method' })))).toEqual(['Market town']);
  });

  // Purpose (B7, sf-2): nothing else stands among the Locations: the list's own buttons are the Areas' folds, the open
  // Area's Locations and Other….
  it('has no row but its Locations, their folds and Other…', async () => {
    const { gm, campaign } = table();
    withLocations(campaign, gm);
    const user = await openGm(gm);
    await user.click((await openDepart(user)).getByRole('button', { name: 'Where?: Pick a Location' }));
    const picker = within(await screen.findByRole('dialog', { name: /Where\?$/ }));
    await picker.findByRole('region', { name: 'The Drowned Harbour' });
    expect(picker.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Close',
      'Fold The Drowned Harbour',
      'The Anchorage',
      '1. The Jetty',
      '2. The Wreck',
      'Show The Shingle Beach',
      'Other… a place that isn’t listed',
    ]);
  });

  // Purpose (B7): a picked Location fills in Where? (its name, its Area under it) and the method from the place (Point
  // to point); a tap changes the method; Start starts at that Location in the way chosen.
  it('a picked Location fills in Point to point, which the GM can change', async () => {
    const { gm, campaign } = table();
    withLocations(campaign, gm);
    const user = await openGm(gm);
    const sheet = await openDepart(user);
    await user.click(sheet.getByRole('button', { name: 'Where?: Pick a Location' }));
    await user.click(await screen.findByRole('button', { name: 'The Anchorage' }));
    const where = await sheet.findByRole('button', { name: 'Where?: The Anchorage, The Drowned Harbour' });
    expect(where.textContent).toBe('The AnchorageThe Drowned Harbour');
    const how = within(sheet.getByRole('group', { name: 'Exploration method' }));
    expect(chosen(how)).toEqual(['Point to point']);
    // The picker ticks the Location picked when it opens again.
    await user.click(where);
    expect((await screen.findByRole('button', { name: 'The Anchorage' })).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'The Anchorage' }));
    await user.click(how.getByRole('button', { name: 'Under the quay' }));
    expect(chosen(how)).toEqual(['Under the quay']);
    await user.click(how.getByRole('button', { name: 'Point to point' }));
    await user.click(sheet.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('heading', { name: /^The Anchorage, turn 1$/ })).toBeTruthy();
    expect(world.tables.expeditions.filter((x) => !x.undone).map((x) => x.mode)).toEqual(['app:point-to-point']);
  });

  // Purpose (the review of #1037): a way tapped before Where? shows as chosen at once; a Location picked after it fills
  // in Point to point, the latest choice winning, as a place started in before does (DG1).
  it('shows a tap before Where?, and a Location picked after fills in again', async () => {
    const { gm, campaign } = table();
    withLocations(campaign, gm);
    const user = await openGm(gm);
    const sheet = await openDepart(user);
    const how = within(sheet.getByRole('group', { name: 'Exploration method' }));
    await user.click(how.getByRole('button', { name: 'Under the quay' }));
    expect(chosen(how)).toEqual(['Under the quay']);
    await user.click(sheet.getByRole('button', { name: 'Where?: Pick a Location' }));
    await user.click(await screen.findByRole('button', { name: 'Show The Shingle Beach' }));
    await user.click(screen.getByRole('button', { name: 'The Landing' }));
    await sheet.findByRole('button', { name: 'Where?: The Landing, The Shingle Beach' });
    expect(chosen(how)).toEqual(['Point to point']);
  });

  // Purpose (p2p-6; B8's Departures 3 and 5): once under way point to point, the GM's step is one unit of the ways
  // leaving the party's Location (here an hour's row to the Jetty), not a turn.
  it('steps by the unit of the ways leaving the Location', async () => {
    const { gm, campaign } = table();
    withLocations(campaign, gm);
    world.tables.library_entries.push({ id: 'entry-route-anchorage-jetty', pack_id: 'pack-isle', kind: 'route', pack_entry_id: 'anchorage-jetty', name: 'anchorage-jetty', data: { from: 'a3-anchorage', to: 'a4-jetty', travel: [{ by: 'row', name: 'Rowing', value: 1, unit: 'hour' }] } });
    const user = await openGm(gm);
    const sheet = await openDepart(user);
    await user.click(sheet.getByRole('button', { name: 'Where?: Pick a Location' }));
    await user.click(await screen.findByRole('button', { name: 'The Anchorage' }));
    await user.click(await sheet.findByRole('button', { name: 'Start' }));
    await screen.findByRole('heading', { name: /^The Anchorage, / });
    const clock = () => Number(world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds);
    const before = clock();
    await user.click(await band().findByRole('button', { name: 'Next hour' }));
    await waitFor(() => expect(clock()).toBe(before + 3600));
  });
});

describe("the Depart sheet's pick stays in the sheet (#864's review)", () => {
  // Purpose: a way picked in the sheet and left with ✕ changes nothing in town: Advance time still steps a part of the
  // day, and the part of the day's tile stays; the sheet opens again with no way chosen until Where? is picked, then on
  // the town's own way.
  it('a pick left with ✕ leaves the town step and the tile as they were', async () => {
    const { gm } = table();
    const user = await openGm(gm);
    const sheet = await openDepart(user);
    await user.click(within(sheet.getByRole('group', { name: 'Exploration method' })).getByRole('button', { name: 'Under the quay' }));
    // A tap before Where? shows at once (the review of #1037).
    expect(chosen(within(sheet.getByRole('group', { name: 'Exploration method' })))).toEqual(['Under the quay']);
    await user.click(sheet.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Depart$/ })).toBeNull());
    expect(factLabels()).toEqual(['Part of the day']);
    await user.click(band().getByRole('button', { name: 'Advance time' }));
    await waitFor(() => expect(within(facts()!).getByText('Afternoon')).toBeTruthy());
    expect(world.tables.events.filter((e) => e.type === 'time.partOfDay')).toHaveLength(1);
    expect(chosen(await departModes(user))).toEqual([]);
    await typePlace(user, 'Bog Ford', /^Where\?:/, await openDepart(user));
    expect(chosen(await departModes(user))).toEqual(['Market town']);
  });
});

describe('the Depart sheet starts on the right way (fno-1)', () => {
  /** An ended expedition by the turn ("Under the quay") with its one group left at a settlement or at an ordinary place. */
  function endedTripLeftAt(campaign: string, gm: string, where: 'town' | 'ordinary') {
    world.tables.expeditions.push({ id: 'old-trip', campaign_id: campaign, session_id: null, mode: 'cellars', started_at: 0, ended_at: 3600, who_went: [], summary: null, started_by: gm, undone: false, version: 2 });
    world.tables.places.push({ id: 'quay', campaign_id: campaign, name: 'Lantern Quay', description: '', version: 1, undone: false, settlement: { size: 'small', population: null }, safety: null });
    world.tables.places.push({ id: 'ford', campaign_id: campaign, name: 'Bog Ford', description: '', version: 1, undone: false, settlement: null, safety: null });
    world.tables.group_places.push({ id: 'old-visit', campaign_id: campaign, expedition_id: 'old-trip', group_number: 1, place_id: where === 'town' ? 'quay' : 'ford', shown: false, moved_on: false, undone: false, created_at: '2026-11-01T12:00:00Z' });
  }
  /** The way the sheet starts on once a place that gives none of its own is picked (B7: unset before). */
  async function startsOn(user: Awaited<ReturnType<typeof openGm>>) {
    await typePlace(user, 'Reed Hollow', /^Where\?:/, await openDepart(user));
    return chosen(await departModes(user));
  }

  // Purpose: with a town way in the setting and no expedition ever started, the sheet starts on the town way.
  it('no expedition ever: the sheet opens on the town way', async () => {
    const { gm } = table();
    const user = await openGm(gm);
    expect(await startsOn(user)).toEqual(['Market town']);
  });

  // Purpose: after an expedition that ended with the group at a settlement, the sheet starts on the town way, not the last expedition's mode.
  it('after an expedition ended in a settlement: the town way, not the last mode', async () => {
    const { gm, campaign } = table();
    endedTripLeftAt(campaign, gm, 'town');
    const user = await openGm(gm);
    expect(await startsOn(user)).toEqual(['Market town']);
  });

  // Purpose: after an expedition that ended at an ordinary place, the sheet starts on the last expedition's own mode.
  it("after an expedition ended at an ordinary place: the last expedition's mode", async () => {
    const { gm, campaign } = table();
    endedTripLeftAt(campaign, gm, 'ordinary');
    const user = await openGm(gm);
    expect(await startsOn(user)).toEqual(['Under the quay']);
  });
});

describe("downtime's top (S5, T5; a placeholder, dw-1)", () => {
  // Purpose: in downtime "Next day" has no accent, Depart stands beside it plain (the lead: downtime keeps a way to
  // start an expedition), nothing is the accent, and no fact but Weather shows (none today: no weather outside an expedition).
  it('Next day and Depart, neither the accent; no fact but Weather', async () => {
    const { gm } = table({ mode: 'downtime' });
    const user = await openGm(gm);
    const next = await band().findByRole('button', { name: 'Next day' });
    expect(next.className).not.toContain('button-primary');
    const depart = band().getByRole('button', { name: 'Depart' });
    expect(depart.className).not.toContain('button-primary');
    expect(accents()).toEqual([]);
    expect(factLabels().filter((l) => l !== 'Weather')).toEqual([]);
    expect(screen.queryByText(/light left|^Night\.$|Dusk|^Morning\.$/)).toBeNull();
    // Depart opens the same sheet, and starts from downtime.
    await startExpedition(user);
    expect(await screen.findByRole('heading', { name: 'The Mustering Field, morning' })).toBeTruthy();
  });
});
