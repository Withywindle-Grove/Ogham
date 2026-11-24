// @vitest-environment jsdom
// The players' top (plan docs/plans/dec-9-the-whole-scene.md row S15; st-7, mc-39b, mc-50, sa-1; page 16, T9a to
// T9e, approved 2026-11-14), clicked through as a player against the stand-in database. Invented rules and places only.
// What it checks, in plain words:
//   * the players' band has no button and no menu (players don't move the clock); its facts are the GM's facts, the
//     weather as its word, never its table (not even the table's name);
//   * paused, today's words "Session paused, waiting for the GM" stand in the band, the heading has no turn count, and
//     the facts and the strip stay as they were left (no "Show details" fold);
//   * before the place is shown to them, the heading names the last place they were shown and the Encounter check is
//     that place's; a place never shown is never named, and the session line names no region;
//   * the Encounter check is the shown place's own where it stands in (when it's rolled and its chance, never its
//     table or note), the setting's when the GM switches the place's off, and without its chance when the player's
//     copy of the rules set doesn't carry it;
//   * nothing on a player's top is the accent: one accent at most on the surface they act on (sa-1);
//   * hidden means hidden on what the client receives: the reads the top uses never send the weather table, a place
//     not shown or the place's check table and note (the database's own test: supabase/tests/dec-9-s15-players-top-
//     hidden.test.ts).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { encodeEventTag } from '../core/eventTags.ts';
import { forgetFileLinks } from '../core/files.ts';
import { forgetPackPlaces, loadGroupPlaces, loadLastShownPlaces, setPlace, showPiece } from '../modules/expedition/placePlay.ts';
import { loadPlayersCheck } from '../modules/expedition/placeRules.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { createAppRegistry } from './commandRegistry.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

const registry = createAppRegistry();
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

const CHECK_NOTE = 'The pike-mother rises when the bell is rung';
const GM_CHECK_NOTE = 'Roll twice when the party carries the bell';
const STEP_WORDS = 'Every second turn the GM checks whether something wandering finds the party.';
const REST_WORDS = 'A party that does not rest is tired until it does.';
const HARBOUR = {
  id: 'drowned-harbour',
  name: 'The Drowned Harbour',
  type: 'region',
  playerView: { text: 'A silted harbour of five spots.' },
  encounterCheck: {
    name: 'Encounters on the water',
    when: 'eachMove',
    replacesScheduled: true,
    chance: { die: 'd6', on: [1, 2] },
    tableId: 'harbour-encounters',
    note: CHECK_NOTE,
  },
};
const JETTY = {
  id: 'the-jetty',
  name: '1 The jetty',
  type: 'site',
  parentId: 'drowned-harbour',
  playerView: { name: 'A jetty', text: 'Black piles and a mooring ring.' },
};
const GROTTO = {
  id: 'tidewife-grotto',
  name: 'The Tidewife’s grotto',
  type: 'site',
  parentId: 'drowned-harbour',
  playerView: { text: 'Dripping stone.' },
};

/**
 * A GM, a player with a character, invented fen rules (a creeping turn mode with a wandering check every 2 turns, and
 * seasonal weather the players roll) and an invented harbour whose own check stands in on every move. A session runs
 * and the expedition is under way. `hideExploration` marks the rules set's exploration GM-only.
 */
async function table(options: { hideExploration?: boolean; mode?: 'creep' | 'wade'; rules?: boolean; rushlights?: boolean } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  // `rushlights` (P10, PL8's Light button): four rushlights in Wren's pack, none lit.
  if (options.rushlights)
    world.tables.inventory_lines.push({ id: 'line-rush', campaign_id: campaign, actor_id: wren, location_id: null, name: 'Rushlights', category: 'light', qty: 4, stack: 10, approval: 'approved', item_data: { lightTypeId: 'rushlight' }, source_entry_id: null, version: 1 });
  world.tables.packs.push({
    id: 'pack-fen',
    owner_user_id: gm,
    campaign_id: null,
    name: 'Fen Rules',
    version: '1',
    kind: 'setting',
    format_version: 2,
    source: '',
    notes: '',
    updated_at: '2026-10-18T12:00:00Z',
  });
  world.tables.packs.push({
    id: 'pack-reed',
    owner_user_id: gm,
    campaign_id: null,
    name: 'The Reed Marches',
    version: '1',
    kind: 'adventure',
    format_version: 2,
    source: '',
    notes: '',
    updated_at: '2026-10-18T12:00:00Z',
  });
  const entry = (pack: string, kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({
      id: `entry-${id}`,
      pack_id: pack,
      kind,
      pack_entry_id: id,
      name,
      data: { id, name, ...data },
    });
  // `rules` (P10): the procedures open to players, a step that runs the wandering check with its words and page, and a
  // rest rule with its words and page.
  const exploration = {
    ...(options.rules ? { playerReadable: true } : {}),
    modes: [
      {
        id: 'creep',
        name: 'Creeping',
        step: { value: 1, unit: 'turn' },
        procedure: options.rules ? [{ id: 'wander-step', name: 'Wandering', kind: 'check', checkId: 'wander', note: STEP_WORDS, source: 'Fen Rules, p. 40' }] : [],
        ...(options.rules ? { rest: { every: { value: 6, unit: 'turn' }, length: { value: 1, unit: 'turn' }, note: REST_WORDS, source: 'Fen Rules, p. 50' } } : {}),
        checks: [
          {
            id: 'wander',
            name: 'Wandering things',
            every: { value: 2, unit: 'turn' },
            chance: { die: 'd6', on: [1] },
            onHit: { tableId: 'river-wanderers' },
            note: GM_CHECK_NOTE,
          },
        ],
      },
      // A day mode, where the weather falls due by the day (as the weather card's tests have it).
      {
        id: 'wade',
        name: 'Wading',
        step: { value: 1, unit: 'day' },
        procedure: [],
        checks: [
          {
            id: 'wade-wander',
            name: 'Wandering things',
            every: { value: 2, unit: 'day' },
            chance: { die: 'd6', on: [1] },
            onHit: { tableId: 'river-wanderers' },
          },
        ],
      },
    ],
  };
  entry('pack-fen', 'rulesSet', 'fen-rules', 'Fen rules', {
    seasons: [{ id: 'spring', name: 'Spring' }],
    weather: {
      tables: { spring: 'spring-sky' },
      tags: { wet: { name: 'Wet', note: 'Lighting a campfire is hard' } },
    },
    ...(options.hideExploration ? {} : { exploration }),
  });
  // A section the pack marks GM-only is kept apart on import, where players can't read it (07, GM-only sections).
  if (options.hideExploration)
    world.tables.library_entry_secrets.push({
      id: 'entry-fen-rules',
      pack_id: 'pack-fen',
      data: { exploration: { ...exploration, gmOnly: true } },
    });
  entry('pack-fen', 'lightType', 'rushlight', 'Rushlight', { duration: 6, unit: 'turn', consumed: true });
  entry('pack-fen', 'table', 'spring-sky', 'Spring sky', {
    die: 'd6',
    rows: [{ min: 1, max: 6, result: 'Drizzle', tags: ['wet'] }],
  });
  entry('pack-fen', 'calendar', 'reckoning', 'Reckoning of the river towns', {
    months: [{ name: 'Thawmonth', days: 28, season: 'spring' }],
    defaultStart: { month: 1, day: 1 },
  });
  for (const data of [HARBOUR, JETTY, GROTTO])
    world.tables.library_entries.push({
      id: `entry-${data.id}`,
      pack_id: 'pack-reed',
      kind: 'location',
      pack_entry_id: data.id,
      name: data.name,
      data,
    });
  world.tables.campaign_packs.push({
    id: 'link-fen',
    campaign_id: campaign,
    pack_id: 'pack-fen',
    pack_name: 'Fen Rules',
    option_choices: {},
    overrides: {},
    priority: 1,
  });
  world.tables.campaign_packs.push({
    id: 'link-reed',
    campaign_id: campaign,
    pack_id: 'pack-reed',
    pack_name: 'The Reed Marches',
    option_choices: {},
    overrides: {},
    priority: 2,
  });
  world.signInAs(gm);
  const tag = (type: string) => encodeEventTag({ type, level: 'simple', requestId: crypto.randomUUID() });
  await world.db.rpc('start_session', { campaign }).setHeader('x-grimoire-command', tag('session.start'));
  const started = await world.db.rpc('start_expedition', { campaign, mode_id: options.mode ?? 'creep' }).setHeader('x-grimoire-command', tag('expedition.start'));
  const trip = String((started.data as { id: string }).id);
  const gmUser = (): CurrentUser => ({ id: gm, roles: { [campaign]: 'gm' } }) as CurrentUser;
  /** The GM moves the party to a pack place; `shown` shows its description to them. */
  const moveTo = async (data: { id: string; name: string } & Record<string, unknown>, shown: boolean) => {
    world.signInAs(gm);
    const moved = await runCommand(registry, world.db, gmUser(), setPlace, {
      campaignId: campaign,
      group: 1,
      name: '',
      packEntry: {
        packId: 'pack-reed',
        packEntryId: data.id,
        name: data.name,
        data,
      },
    });
    if (!moved.ok) throw new Error(moved.message);
    if (!shown) return;
    const row = (await loadGroupPlaces(world.db, campaign, trip))!.get(1)!;
    const done = await runCommand(registry, world.db, gmUser(), showPiece, {
      campaignId: campaign,
      row,
      piece: row.pieces[0]!,
    });
    if (!done.ok) throw new Error(done.message);
  };
  return { gm, sam, campaign, trip, moveTo, tag };
}

async function openScene(who: string) {
  world.signInAs(who);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: /Main|Campaign sections/ })).getByRole('button', { name: 'Scene' }));
  return user;
}

const time = () => within(screen.getByRole('region', { name: 'Time' }));
const facts = async () => within(await screen.findByRole('group', { name: 'Scene facts' }));
const factNamed = async (label: string) => (await facts()).findByRole('button', { name: new RegExp(`^${label}:`) });

describe("the players' top (S15, T9a)", () => {
  // Purpose: the players' band has no button and no menu, and the facts show as the GM sees them, the weather as its
  // word: a player never gets the weather's table, not even its name.
  it('has no button or menu; its facts are the GM’s, the weather a word and never its table', async () => {
    const { sam } = await table({ mode: 'wade' });
    await openScene(sam);
    expect(await screen.findByRole('heading', { name: /^Wading, day 1/ })).toBeTruthy();
    for (const name of ['Next turn', 'Time options', 'Resume session', 'Start session', 'Make camp', 'Encounter check', 'Leave the dungeon', 'Depart']) {
      expect(time().queryByRole('button', { name })).toBeNull();
    }
    expect(time().queryByRole('group', { name: 'Quick actions' })).toBeNull();
    // The same facts: the weather, the check as the setting gives it (every 2 days, 1 in 6).
    expect((await factNamed('Weather')).getAttribute('aria-label')).toBe('Weather: To roll.');
    expect((await factNamed('Encounter check')).getAttribute('aria-label')).toBe('Encounter check: Every 2 days. 1 in 6');
    // The Weather fact opens the player's half of the Weather sheet (S10a, T6): a number box, the table never drawn.
    const user = userEvent.setup();
    await user.click(await factNamed('Weather'));
    const sheet = within(await screen.findByRole('dialog', { name: /Weather$/ }));
    expect(sheet.queryByRole('table')).toBeNull();
    await user.type(sheet.getByRole('textbox'), '3');
    await user.click(sheet.getByRole('button', { name: 'Enter' }));
    await waitFor(async () => expect((await factNamed('Weather')).getAttribute('aria-label')).toMatch(/^Weather: Drizzle\./));
    // The weather table never reached this screen: not its name, not its rows.
    expect(document.body.textContent).not.toContain('Spring sky');
    // The strip is there, and the players' hour track went (S15, S18).
    expect(time().getByRole('group', { name: 'Sequence of play' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'This hour' })).toBeNull();
  });

  // Purpose: nothing on a player's top is the accent (sa-1): the surface they act on has one accent at most.
  it('holds no accent', async () => {
    const { sam } = await table();
    await openScene(sam);
    await facts();
    expect(
      time()
        .queryAllByRole('button')
        .filter((b) => b.className.includes('button-primary')).length,
    ).toBeLessThanOrEqual(1);
    expect(screen.getByRole('region', { name: 'Time' }).querySelector('.scene-band .button-primary')).toBeNull();
  });
});

describe('paused, for a player (T9b, T9e)', () => {
  // Purpose: paused, today's words stand where the GM's button is, the heading has no turn count, and the facts and
  // the strip stay as they were left; B7's fold ("Show details") is gone.
  it('says so in the band, and keeps the page as it was left', async () => {
    const { gm, sam, campaign, tag } = await table();
    world.signInAs(gm);
    const session = world.tables.sessions.find((s) => s.campaign_id === campaign && s.ended_at === null)!;
    await world.db
      .rpc('end_session', {
        session: String(session.id),
        seen_version: Number(session.version),
      })
      .setHeader('x-grimoire-command', tag('session.end'));
    await openScene(sam);
    expect(await time().findByText('Session paused, waiting for the GM')).toBeTruthy();
    expect(time().getByRole('heading', { name: 'Creeping' })).toBeTruthy();
    expect(await factNamed('Encounter check')).toBeTruthy();
    expect(time().queryByRole('button', { name: /Show details|Hide details/ })).toBeNull();
    expect(time().queryByRole('button', { name: 'Resume session' })).toBeNull();
  });
});

describe('what has been shown to them (st-7, sf-1, mc-39b, mc-50; T9c)', () => {
  // Purpose: before the place is shown, the heading names no place (none shown yet) and the check is the setting's;
  // once the jetty is shown, the heading names it as players know it and the check is the harbour's own (on every
  // move, 2 in 6); moved on to the grotto and not shown it, the heading keeps the jetty and its check.
  it('names only the places shown, and the check follows the last one shown', async () => {
    const { sam, moveTo } = await table();
    await moveTo(JETTY, false);
    await openScene(sam);
    expect(await screen.findByRole('heading', { name: 'Creeping, turn 1' })).toBeTruthy();
    expect((await factNamed('Encounter check')).getAttribute('aria-label')).toBe('Encounter check: Every 2 turns. 1 in 6');
    cleanup();

    await moveTo(JETTY, true);
    await openScene(sam);
    expect(await screen.findByRole('heading', { name: 'A jetty, turn 1' })).toBeTruthy();
    expect((await factNamed('Encounter check')).getAttribute('aria-label')).toBe('Encounter check: On every move. 2 in 6');
    cleanup();

    await moveTo(GROTTO, false);
    await openScene(sam);
    expect(await screen.findByRole('heading', { name: 'A jetty, turn 1' })).toBeTruthy();
    expect((await factNamed('Encounter check')).getAttribute('aria-label')).toBe('Encounter check: On every move. 2 in 6');
    // Nothing unshown is named: not the grotto, not the region (the session line is the session alone), not the
    // jetty's own name, not the check's own name, table or note.
    const text = document.body.textContent ?? '';
    for (const hidden of ['Tidewife', 'Drowned Harbour', '1 The jetty', 'Encounters on the water', 'harbour-encounters', CHECK_NOTE, 'river-wanderers']) expect(text).not.toContain(hidden);
    expect(time().getByText('Session 1.')).toBeTruthy();
  });

  // Purpose: the GM's switch is respected: with the harbour's check switched off, a player reads the setting's.
  it('shows the setting’s check while the GM has the place’s switched off', async () => {
    const { gm, sam, campaign, moveTo } = await table();
    await moveTo(JETTY, true);
    world.signInAs(gm);
    world.tables.place_rule_switches.push({
      id: 'switch-off',
      campaign_id: campaign,
      pack_id: 'pack-reed',
      entry_id: 'drowned-harbour',
      rule_id: 'encounterCheck',
      which: 'inForce',
      value: false,
      undone: false,
      rule_name: '',
      place_name: '',
      created_by: gm,
      created_at: '2026-11-15T10:00:00Z',
      updated_at: '2026-11-15T10:00:00Z',
    });
    await openScene(sam);
    expect((await factNamed('Encounter check')).getAttribute('aria-label')).toBe('Encounter check: Every 2 turns. 1 in 6');
  });

  // Purpose: what the client receives for the top: the check's when and chance only, and the last shown place's
  // players' name; never the check's table or note, never a place not shown.
  it('receives only what it may: the check’s when and chance, and the shown place’s players’ name', async () => {
    const { sam, campaign, moveTo } = await table();
    await moveTo(JETTY, true);
    await moveTo(GROTTO, false);
    world.signInAs(sam);
    const raw = await world.db.rpc('encounter_check_for_players', { campaign });
    expect(JSON.stringify(raw.data)).not.toMatch(/harbour-encounters|pike-mother|Encounters on the water|tableId|note/);
    expect(await loadPlayersCheck(world.db, campaign)).toEqual([
      {
        group: 1,
        placeName: 'A jetty',
        eachMove: true,
        every: null,
        chance: { die: 'd6', on: [1, 2] },
      },
    ]);
    expect(await loadLastShownPlaces(world.db, campaign)).toEqual(new Map([[1, 'A jetty']]));
    const known = await world.db.rpc('known_places_campaign', { campaign });
    expect(JSON.stringify(known.data)).not.toMatch(/Tidewife|1 The jetty/);
  });
});

describe('a new expedition (#883’s review)', () => {
  // Purpose: what was shown on one expedition never names the next one's place or check, even when the reads fail on
  // the new expedition (the last good read is kept only for the expedition it was read on).
  it('forgets the last shown place and its check when the expedition changes', async () => {
    const { gm, sam, campaign, trip, moveTo, tag } = await table();
    await moveTo(JETTY, true);
    await openScene(sam);
    expect(await screen.findByRole('heading', { name: 'A jetty, turn 1' })).toBeTruthy();
    expect((await factNamed('Encounter check')).getAttribute('aria-label')).toBe('Encounter check: On every move. 2 in 6');
    // From now on the player's two reads fail.
    const real = world.db.rpc.bind(world.db);
    vi.spyOn(world.db, 'rpc').mockImplementation(((name: string, args: Record<string, unknown>) => {
      if (name !== 'known_places_campaign' && name !== 'encounter_check_for_players') return real(name as never, args as never);
      const failed = Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
      return Object.assign(failed, { setHeader: () => failed });
    }) as never);
    // The GM ends that expedition and starts another.
    world.signInAs(gm);
    const row = world.tables.expeditions.find((x) => x.id === trip)!;
    await real('end_expedition' as never, { expedition: trip, seen_version: Number(row.version) } as never).setHeader('x-grimoire-command', tag('expedition.end'));
    await real('start_expedition' as never, { campaign, mode_id: 'creep' } as never).setHeader('x-grimoire-command', tag('expedition.start'));
    world.signInAs(sam);
    expect(await screen.findByRole('heading', { name: 'Creeping, turn 1' }, { timeout: 3000 })).toBeTruthy();
    expect((await factNamed('Encounter check')).getAttribute('aria-label')).toBe('Encounter check: Every 2 turns. 1 in 6');
    vi.restoreAllMocks();
  });
});

describe('the setting’s check where the player may not read it (the lead, 2026-11-15)', () => {
  // Purpose: where the rules set keeps its exploration for the GM, the player's copy has no chance to show, so the
  // top shows none: no "in 6" and no die reach the player's screen. Nothing reaches round it.
  it('shows no chance', async () => {
    const { sam } = await table({ hideExploration: true });
    await openScene(sam);
    await screen.findByRole('group', { name: 'Scene facts' });
    expect(time().queryByText(/\bin 6\b/)).toBeNull();
    expect(screen.getByRole('region', { name: 'Time' }).querySelector('.scene-fact__sub .die-glyph')).toBeNull();
    expect(document.body.textContent).not.toContain('Wandering things');
  });
});

describe("a player's tap on a fact (plan dec-9-the-players-scene P10; page 18, PL8)", () => {
  const sheet = async (name: string | RegExp) => within(await screen.findByRole('dialog', { name }));

  // Purpose: the Encounter check opens a pop-up with when it is rolled and its chance as labelled lines, then "The rule"
  // in the pack's words with its page, where the setting opens its procedures to players; never the check's own note or
  // its table.
  it('opens the setting’s check with its rule, never its note or table', async () => {
    const { sam } = await table({ rules: true });
    const user = await openScene(sam);
    await user.click(await factNamed('Encounter check'));
    const pop = await sheet('Encounter check');
    expect(pop.getByText('When.')).toBeTruthy();
    expect(pop.getByText('Every 2 turns.')).toBeTruthy();
    expect(pop.getByText('Chance.')).toBeTruthy();
    expect(pop.getByRole('heading', { name: 'The rule' })).toBeTruthy();
    expect(pop.getByText(STEP_WORDS)).toBeTruthy();
    expect(pop.getByText('From your setting: Fen Rules, p. 40')).toBeTruthy();
    expect(document.body.textContent).not.toContain(GM_CHECK_NOTE);
    expect(document.body.textContent).not.toContain('river-wanderers');
  });

  // Purpose: where the setting keeps its procedures from players, the pop-up has the check's state alone: no rule.
  it('shows the state alone where the procedures are not open to players', async () => {
    const { sam } = await table();
    const user = await openScene(sam);
    await user.click(await factNamed('Encounter check'));
    const pop = await sheet('Encounter check');
    expect(pop.getByText('When.')).toBeTruthy();
    expect(pop.queryByRole('heading', { name: 'The rule' })).toBeNull();
  });

  // Purpose: at a shown place whose own check stands in, the pop-up has its when and chance and no rule: its read sends
  // nothing more, and its note never reaches the screen.
  it('shows a shown place’s own check without a rule or its note', async () => {
    const { sam, moveTo } = await table({ rules: true });
    await moveTo(JETTY, true);
    const user = await openScene(sam);
    await user.click(await factNamed('Encounter check'));
    const pop = await sheet('Encounter check');
    expect(pop.getByText('On every move.')).toBeTruthy();
    expect(pop.queryByRole('heading', { name: 'The rule' })).toBeNull();
    expect(document.body.textContent).not.toContain(CHECK_NOTE);
  });

  // Purpose: Rest opens a pop-up with when the next rest falls, then the pack's rest words and page under "The rule";
  // the app's line on answering a rest is the prompt's business, not this pop-up's.
  it('opens Rest with when the next falls and its rule', async () => {
    const { sam } = await table({ rules: true });
    const user = await openScene(sam);
    await user.click(await factNamed('Rest'));
    const pop = await sheet('Rest');
    expect(pop.getByText('Next.')).toBeTruthy();
    expect(pop.getByText(/^In \d+ turns?\.$/)).toBeTruthy();
    expect(pop.getByText(REST_WORDS)).toBeTruthy();
    expect(pop.getByText('From your setting: Fen Rules, p. 50')).toBeTruthy();
    expect(pop.queryByText(/answer Rest or Push on/)).toBeNull();
  });

  // Purpose: Light opens a pop-up with the group's light state as a labelled line ("No light." in a turn mode with
  // nothing lit), and no rule (the pack format gives a light no words).
  it('opens Light with the group’s light', async () => {
    const { sam } = await table({ rules: true });
    const user = await openScene(sam);
    await user.click(await factNamed('Light'));
    const pop = await sheet('Light');
    expect(pop.getByText('No light.')).toBeTruthy();
    expect(pop.queryByRole('heading', { name: 'The rule' })).toBeNull();
  });

  // Purpose (PL8): a player whose character has a light to light finds "Light" at the foot of the Light pop-up; a tap
  // lights it at once, as the Pack does (its toast with Undo), and the pop-up closes.
  it('lights the player’s own light from the Light pop-up', async () => {
    const { sam } = await table({ rules: true, rushlights: true });
    const user = await openScene(sam);
    await user.click(await factNamed('Light'));
    const pop = await sheet('Light');
    await user.click(pop.getByRole('button', { name: 'Light' }));
    expect(await screen.findByText('Lit Rushlight')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Light' })).toBeNull());
    expect(world.tables.events.some((e) => e.type === 'light.light')).toBe(true);
  });

  // Purpose (PL8): a player with nothing to light has no button in the Light pop-up.
  it('has no Light button with nothing to light', async () => {
    const { sam } = await table({ rules: true });
    const user = await openScene(sam);
    await user.click(await factNamed('Light'));
    const pop = await sheet('Light');
    expect(pop.queryByRole('button', { name: 'Light' })).toBeNull();
  });
});
