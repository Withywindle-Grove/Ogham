// @vitest-environment jsdom
// Encounter waiting on the GM console (M5b step 2; docs/05 "Encounter waiting", ruled 2026-10-30, D11 and S2-4; Start
// shows the row's text only in M5b, ruled 2026-11-03), clicked through against the stand-in database. Invented rules.
//   A hit of the wandering check queues exactly one card, with no extra tap; it reads the row once the GM taps it.
//   Dismiss removes the card and Undo brings it back.
//   View shows the details and changes nothing; Start opens the row's full text and the stat block it names
//   (read-only), and the card leaves the queue; Undo puts it back.
//   A miss queues nothing; undoing the hit takes its card away.
//   A player never receives a waiting encounter.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { EncounterWaitingSource, StatBlockInFull, watchChipWords } from './EncounterWaiting.tsx';
import type { EncounterCard } from '../modules/expedition/encounterPlay.ts';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { typePlace } from '../testing/pickPlace.ts';
import { openWaiting } from '../testing/openWaiting.ts';
import { ICON_SET } from '../ui/iconSet.ts';
import { layOutStatBlock } from '../modules/library/statBlockLayout.ts';
import { openDepart, startExpedition } from '../testing/depart.ts';

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
  return { gm, sam, campaign };
}

/** Invented setting rules: a creeping mode whose wandering check (every turn) rolls one table naming a stat block. */
function withSetting(campaign: string, gm: string) {
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    exploration: {
      modes: [
        {
          id: 'creep',
          name: 'Creeping',
          step: { value: 1, unit: 'turn' },
          procedure: [{ id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' }],
          checks: [{ id: 'wander', name: 'Wandering things', every: { value: 1, unit: 'turn' }, chance: { die: 'd6', on: [1] }, onHit: { tableId: 'shallows' } }],
        },
      ],
    },
  });
  entry('table', 'shallows', 'Shallow things', {
    die: 'd6',
    rows: [
      { min: 1, max: 3, result: 'Bog lurkers', count: '1d4', statBlockId: 'bog-lurker', note: 'They wait under the reeds.' },
      { min: 4, max: 6, result: 'Reed wraith' },
    ],
  });
  entry('statBlock', 'bog-lurker', 'Bog lurker', { description: 'A slow grey thing that smells of peat.', hitDice: '3', fields: { Armour: '7', Attacks: 'Bite (1d6)' }, source: 'p. 12' });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
}

/**
 * Next turn and the turn count show only while a session runs (st-1, st-2): the GM starts one, unless one runs already
 * (Depart shows only while a session runs, p2p-4, so opening the Depart sheet first started it).
 */
async function startSession(user: ReturnType<typeof userEvent.setup>) {
  const start = screen.queryByRole('button', { name: 'Start session' });
  if (start) await user.click(start);
  await screen.findByText('Session 1.');
}

async function openScene(who: string, gm: boolean, heading: string | RegExp = /^(No session yet|Downtime)$/) {
  world.signInAs(who);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: gm ? 'Campaign sections' : 'Main' })).getByRole('button', { name: 'Scene' }));
  await screen.findByRole('heading', { name: heading });
  return user;
}

const toastUndo = async (text: string | RegExp) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });
const waitingCards = () => screen.queryAllByRole('region', { name: /^Encounter waiting, / });

/** Starts the expedition, moves one turn and taps Hit on the wandering check; then taps the first row of the table. */
async function hitAndRoll(user: ReturnType<typeof userEvent.setup>, afterStart?: () => void) {
  await startSession(user);
  await startExpedition(user);
  // B7: the heading names where the expedition started (the test's own place, or the helper's).
  await screen.findByRole('heading', { name: /, turn 1$/ });
  afterStart?.();
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  const due = within(await screen.findByRole('region', { name: 'Due' }));
  await user.click(due.getByRole('button', { name: 'Hit, Wandering things' }));
  // The hit queues its card by itself; Which table? opens on top (the GM's 4 taps on a hit stay 4).
  await waitFor(() => expect(world.tables.waiting_encounters).toHaveLength(1));
  const which = within(await screen.findByRole('dialog', { name: 'Wandering things, Hit' }));
  await user.click(which.getByRole('button', { name: /^Shallow things/ }));
  await user.click(within(await screen.findByRole('dialog', { name: 'Shallow things' })).getByRole('button', { name: /Bog lurkers/ }));
  await waitFor(() => expect(world.tables.check_results[0]).toMatchObject({ row_text: 'Shallow things: Bog lurkers, 1d4' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Shallow things' })).getByRole('button', { name: 'Back' }));
  await user.click(within(await screen.findByRole('dialog', { name: 'Wandering things, Hit' })).getByRole('button', { name: 'Close' }));
  await user.click(within(await screen.findByRole('region', { name: 'Wandering things: hit' })).getByRole('button', { name: 'Done' }));
}

describe('Encounter waiting (M5b step 2)', () => {
  it('a hit queues exactly one card that reads the rolled row; Dismiss removes it and Undo brings it back', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await hitAndRoll(user);
    const card = within(await screen.findByRole('region', { name: 'Encounter waiting, Wandering things, Shallow things: Bog lurkers, 1d4' }));
    expect(waitingCards()).toHaveLength(1);
    // When it fell, as the strip counts turns (S8b, T2: the check and when, then what was rolled as its link).
    expect(card.getByRole('button', { name: 'Shallow things: Bog lurkers, 1d4' }).closest('p')!.textContent).toBe('Wandering things, Turn 2. Shallow things: Bog lurkers, 1d4');
    expect(world.tables.waiting_encounters).toHaveLength(1);
    // Fewer links (fl-2): one accent on the console. On the GM's place page (5b, page 12 W1) Move on and Next turn go
    // plain while a card waits, so the first card's Start is that accent; Dismiss is a secondary stacked button (T2),
    // and the View button is gone (S8b: what was rolled is the link).
    expect(document.querySelectorAll('.button-primary')).toHaveLength(1);
    expect(card.getByRole('button', { name: 'Start' }).className).toBe('button-primary stacked-button');
    expect(card.getByRole('button', { name: 'Dismiss' }).className).toBe('button-secondary stacked-button');
    expect(card.queryByRole('button', { name: 'View' })).toBeNull();

    await user.click(card.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(waitingCards()).toHaveLength(0));
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'dismissed' });
    await user.click(await toastUndo('Dismissed: Wandering things'));
    await waitFor(() => expect(waitingCards()).toHaveLength(1));
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'waiting', undone: false });
  });

  // Purpose (S8b; T2 and 06-03, the lead's ruling): the card has no View button; what was rolled is a link that opens
  // its creature's stat block in the encounter's pop-up without starting anything, the row's own words and note one
  // "Back to the encounter" away; Start, Dismiss are stacked buttons with their icons.
  it('opens the creature from the card’s link without starting anything, and has no View button', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await hitAndRoll(user);
    const card = within(await screen.findByRole('region', { name: /^Encounter waiting, Wandering things/ }));
    expect(card.getByRole('heading', { name: 'An encounter waits' })).toBeTruthy();
    expect(card.queryByRole('button', { name: 'View' })).toBeNull();
    for (const [name, icon] of [['Start', 'crossed-swords'], ['Dismiss', 'cancel']] as const) {
      expect(card.getByRole('button', { name }).querySelector('path')!.getAttribute('d')).toBe(ICON_SET[icon].d);
    }
    await user.click(card.getByRole('button', { name: 'Shallow things: Bog lurkers, 1d4' }));
    const view = within(await screen.findByRole('dialog', { name: 'Encounter waiting: Wandering things' }));
    expect(view.getByRole('article', { name: 'Bog lurker' })).toBeTruthy();
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'waiting' });
    await user.click(view.getByRole('button', { name: '‹ Back to the encounter' }));
    expect(view.getByText('They wait under the reeds.')).toBeTruthy();
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'waiting' });
  });

  // Purpose (st-2, page 16, superseding the #785 review's "Next turn keeps the accent"): without the GM's place page
  // (a town keeps today's card until 5t) a waiting card's first action holds the one accent, and Next turn is never it.
  it('in a town, with no place page, the waiting card\'s Start holds the accent and Next turn is never the accent', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await typePlace(user, 'Quay Gate', /^Where\?:/, await openDepart(user));
    // Marked Safe straight after the start (a town before the ruling), so the next reload shows the town's card.
    await hitAndRoll(user, () => {
      for (const p of world.tables.places) p.safety = 'safe';
    });
    const card = within(await screen.findByRole('region', { name: /^Encounter waiting, Wandering things/ }));
    await screen.findByRole('button', { name: 'Change place' });
    expect(document.querySelector('.place-page')).toBeNull();
    expect(screen.getByRole('button', { name: 'Next turn' }).className).not.toContain('button-primary');
    expect(card.getByRole('button', { name: 'Start' }).className).toBe('button-primary stacked-button');
    expect(document.querySelectorAll('.button-primary')).toHaveLength(1);
  });

  it('View shows the details and changes nothing; Start opens the row and its stat block, read-only, and Undo puts the card back', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await hitAndRoll(user);
    const card = within(await screen.findByRole('region', { name: /^Encounter waiting, Wandering things/ }));

    // S8b (06-03): what was rolled is the link in place of View; a row naming one creature opens its stat block first,
    // and Back to the encounter shows the rest.
    await user.click(card.getByRole('button', { name: 'Shallow things: Bog lurkers, 1d4' }));
    const view = within(await screen.findByRole('dialog', { name: 'Encounter waiting: Wandering things' }));
    await user.click(view.getByRole('button', { name: '‹ Back to the encounter' }));
    expect(view.getByText('Shallow things: Bog lurkers, 1d4')).toBeTruthy();
    expect(view.getByText('They wait under the reeds.')).toBeTruthy();
    await user.click(view.getByRole('button', { name: 'Close' }));
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'waiting' });

    await user.click(card.getByRole('button', { name: 'Start' }));
    const started = within(await screen.findByRole('dialog', { name: 'Started: Wandering things' }));
    expect(started.getByText('Shallow things: Bog lurkers, 1d4')).toBeTruthy();
    expect(started.getByText('How many: 1d4')).toBeTruthy();
    expect(started.getByText('Bog lurker')).toBeTruthy();
    expect(started.getByText('A slow grey thing that smells of peat.')).toBeTruthy();
    // Read-only: nothing to tap but Close (the fight arrives with M6).
    expect(started.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(expect.arrayContaining(['Close']));
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'started' });
    await user.click(started.getByRole('button', { name: 'Close' }));
    expect(waitingCards()).toHaveLength(0);
    await user.click(await toastUndo('Started: Wandering things'));
    await waitFor(() => expect(waitingCards()).toHaveLength(1));
  });

  // Purpose (December 5c): View on a creature in the card's details opens its stat block in full, laid out as the Rules
  // browser lays it out, with its source line; Back returns to the encounter; nothing changes.
  it('opens a creature’s stat block in full from the card’s details, and Back returns', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await hitAndRoll(user);
    const card = within(await screen.findByRole('region', { name: /^Encounter waiting, Wandering things/ }));
    // S8b (06-03): the link on what was rolled opens its one creature's stat block in the same pop-up, nothing started.
    await user.click(card.getByRole('button', { name: 'Shallow things: Bog lurkers, 1d4' }));
    const view = within(await screen.findByRole('dialog', { name: 'Encounter waiting: Wandering things' }));
    const block = within(view.getByRole('article', { name: 'Bog lurker' }));
    // The block's name takes the focus on opening; Back returns it to the View that opened it (#642 review).
    await waitFor(() => expect(document.activeElement).toBe(block.getByRole('heading', { name: 'Bog lurker' })));
    expect(block.getByText('A slow grey thing that smells of peat.')).toBeTruthy();
    expect(block.getByText('3')).toBeTruthy();
    expect(block.getByText('From your setting: Fen Rules, p. 12')).toBeTruthy();
    // The figures as compact pairs (December 5c): each label in the label style, its value at once after it.
    expect([...block.getByRole('heading').parentElement!.querySelectorAll('.stat-block__label')].map((l) => l.textContent)).toEqual(['Armour', 'Attacks']);
    await user.click(block.getByRole('button', { name: '‹ Back to the encounter' }));
    expect(view.getByText('Shallow things: Bog lurkers, 1d4')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(view.getByRole('button', { name: 'View Bog lurker' })));
    // A creature's View in the details (the way to each stat block when a row lists two or more): it opens the block,
    // its name takes the focus, and Back gives the focus back to that View (#642 review).
    await user.click(view.getByRole('button', { name: 'View Bog lurker' }));
    const again = within(view.getByRole('article', { name: 'Bog lurker' }));
    await waitFor(() => expect(document.activeElement).toBe(again.getByRole('heading', { name: 'Bog lurker' })));
    expect(again.getByText('A slow grey thing that smells of peat.')).toBeTruthy();
    await user.click(again.getByRole('button', { name: '‹ Back to the encounter' }));
    expect(view.getByText('Shallow things: Bog lurkers, 1d4')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(view.getByRole('button', { name: 'View Bog lurker' })));
    expect(world.tables.waiting_encounters[0]).toMatchObject({ state: 'waiting' });
  });

  // Purpose (#642 review): a stat block with no notes, no lines and no source still shows its name, how many and Back,
  // with no empty list.
  it('a bare stat block shows its name, how many and Back, and nothing empty', () => {
    render(<StatBlockInFull block={{ name: 'Reed wisp', description: null, count: '2', full: { shown: layOutStatBlock({ name: 'Reed wisp' }, null), source: null } }} onBack={() => undefined} />);
    const block = within(screen.getByRole('article', { name: 'Reed wisp' }));
    expect(block.getByRole('heading', { name: 'Reed wisp' })).toBeTruthy();
    expect(block.getByText('How many: 2')).toBeTruthy();
    expect(block.getByRole('button', { name: '‹ Back to the encounter' })).toBeTruthy();
    expect(block.queryByRole('list')).toBeNull();
    expect(document.querySelector('.stat-block__descriptor, .stat-block__rule, .stat-block__ability, .stat-block__line')).toBeNull();
  });

  // Purpose (December 5c, frame 1): the block reads in the pack's order: description, the descriptor line, the figures
  // in the pack's groups with a rule between, then each ability with its name as a lead-in; a die it names carries its
  // glyph, and a die the app has no glyph for (d3) none.
  it('lays the block out by its pack: descriptor, groups with a rule between, abilities, dice glyphs', () => {
    const shown = layOutStatBlock(
      {
        name: 'Reed hag',
        description: 'Old, patient, and hungry.',
        hp: '5d8',
        hpAverage: 22,
        fields: { Size: 'Medium fey', Wits: 'cunning', Armour: '5', Attacks: '2 claws (1d4) or a hex (1d3)', Met: '1' },
        abilities: [{ name: 'Reed walk', note: 'Steps from one reed bed to another, once a day.' }],
      },
      { descriptor: ['Size', 'Wits'], groups: [[['Armour', 'hp'], ['Attacks']], [['Met']]], hide: [] },
    );
    render(<StatBlockInFull block={{ name: 'Reed hag', description: null, count: null, full: { shown, source: 'From your setting: Fen Rules, p. 31' } }} onBack={() => undefined} />);
    const block = screen.getByRole('article', { name: 'Reed hag' });
    expect(within(block).getByText('Medium fey, cunning')).toBeTruthy();
    expect([...block.querySelectorAll('.stat-block__line')].map((l) => l.textContent)).toEqual(['Armour 5 Hit points 5d8 (22)', 'Attacks 2 claws (1d4) or a hex (1d3)', 'Met 1']);
    expect(block.querySelectorAll('.stat-block__rule')).toHaveLength(1);
    expect([...block.querySelectorAll('.stat-block__ability')].map((p) => p.textContent)).toEqual(['Reed walk: Steps from one reed bed to another, once a day.']);
    expect([...block.querySelectorAll('[data-die]')].map((d) => d.getAttribute('data-die'))).toEqual(['8', '4']);
    expect(within(block).getByText('From your setting: Fen Rules, p. 31')).toBeTruthy();
  });

  // Purpose (December 5c, frame 3): in the card's details, each creature's stat line sits under its name and
  // description, with View under it.
  it('shows each creature’s stat line under its name in the details, View under it', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await hitAndRoll(user);
    // S8b: the card's link opens the creature first; Back to the encounter shows the details' list.
    await user.click(within(await screen.findByRole('region', { name: /^Encounter waiting, Wandering things/ })).getByRole('button', { name: 'Shallow things: Bog lurkers, 1d4' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Encounter waiting: Wandering things' })).getByRole('button', { name: '‹ Back to the encounter' }));
    const item = within(within(await screen.findByRole('dialog', { name: 'Encounter waiting: Wandering things' })).getByRole('list', { name: 'Stat blocks' })).getByRole('listitem');
    expect(item.textContent).toBe('Bog lurkerA slow grey thing that smells of peat.Armour 7 Attacks Bite (1d6)View');
  });

  it('a miss queues nothing; undoing the hit takes its card away', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await startSession(user);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await user.click(within(await screen.findByRole('region', { name: 'Due' })).getByRole('button', { name: 'Miss, Wandering things' }));
    await screen.findByText(/Wandering things: a miss/);
    expect(world.tables.waiting_encounters).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 3' });
    await user.click(within(await screen.findByRole('region', { name: 'Due' })).getByRole('button', { name: 'Hit, Wandering things' }));
    await waitFor(() => expect(world.tables.waiting_encounters).toHaveLength(1));
    await user.click(within(await screen.findByRole('dialog', { name: 'Wandering things, Hit' })).getByRole('button', { name: 'Close' }));
    // S8b: the hit itself is open first in "Waiting for you"; the encounter it queued is opened from its row.
    await openWaiting(user, 'An encounter: Wandering things');
    await waitFor(() => expect(waitingCards()).toHaveLength(1));
    await user.click(await toastUndo(/^Wandering things: a hit/));
    await waitFor(() => expect(waitingCards()).toHaveLength(0));
  });

  it('a player never receives a waiting encounter', async () => {
    const { gm, sam, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await hitAndRoll(user);
    await screen.findByRole('region', { name: /^Encounter waiting, / });
    cleanup();
    world.signInAs(sam);
    expect((await world.db.from('waiting_encounters').select('*').eq('campaign_id', campaign)).data).toEqual([]);
    await openScene(sam, false, /^Creeping/);
    expect(waitingCards()).toHaveLength(0);
    expect(screen.queryByText('Encounter waiting')).toBeNull();
    // Stat blocks are the GM's (December 5c): a player's screen never shows a stat line or a stat block.
    expect(document.querySelector('.stat-line, .stat-block')).toBeNull();
    expect(screen.queryByText(/Bite \(1d6\)/)).toBeNull();
    expect((await world.db.from('library_entries').select('*').eq('kind', 'statBlock')).data ?? []).toEqual([]);
  });
});

// The card on its own (fl-2): Start the accent only when the console has none; Which watch? as chips.
describe('the Encounter waiting card (fl-2)', () => {
  const hit = (id: string): EncounterCard['hit'] => ({
    id, campaignId: 'c', expeditionId: 'e', checkKey: `mode:${id}`, name: 'Night prowlers', source: 'mode', outcome: 'hit', atSeconds: 0, modifiers: [], note: null, tableId: null, roll: null, rowText: 'Bog lurkers', revealed: false, secret: true, version: 1,
  });
  const card = (id: string, watch: string | null = null): EncounterCard => ({
    encounter: { id, campaignId: 'c', expeditionId: 'e', checkResultId: id, watch, state: 'waiting', createdAt: '2026-11-03T20:00:00Z', version: 1 },
    hit: hit(id),
  });
  const cards = (list: EncounterCard[], extra: Partial<Parameters<typeof EncounterWaitingSource>[0]> = {}) =>
    render(<EncounterWaitingSource cards={list} tables={new Map()} statBlock={() => null} when={() => null} onStart={async () => false} onDismiss={() => undefined} {...extra} />);

  // Purpose: with no other accent on the console, Start is the accent, and only on the first card (one per screen).
  it("makes the first card's Start the accent only when asked, never two", () => {
    cards([card('a'), card('b')], { accent: true });
    const starts = screen.getAllByRole('button', { name: 'Start' });
    // S8b (T2): stacked buttons, the accent the primary one.
    expect(starts.map((b) => b.className)).toEqual(['button-primary stacked-button', 'button-secondary stacked-button']);
    cleanup();
    cards([card('a')]);
    expect(screen.getByRole('button', { name: 'Start' }).className).toBe('button-secondary stacked-button');
  });

  // Purpose (the lead, #859): what was rolled is the link; with no row picked yet there is nothing to open, so the card
  // says "No row picked yet." in plain words, no link.
  it('says "No row picked yet." as plain words, not a link', () => {
    const unrolled: EncounterCard = { ...card('a'), hit: { ...hit('a'), rowText: null } };
    cards([unrolled]);
    expect(screen.queryByRole('button', { name: /No row picked yet/ })).toBeNull();
    expect(screen.getByText(/No row picked yet\./).tagName).toBe('P');
    expect(document.querySelector('.waiting-encounter__link')).toBeNull();
    cleanup();
    cards([card('b')]);
    expect(screen.getByRole('button', { name: 'Bog lurkers' }).className).toContain('waiting-encounter__link');
  });

  // Purpose: Which watch? offers each watch as a chip ("1st · Reed, Moss") and answers with the watch's full words.
  it('asks Which watch? with chips that read "1st: Reed, Moss"', async () => {
    const onWatch = vi.fn();
    cards([card('a')], { watchChoices: () => ['1st watch: Reed, Moss', '2nd watch: Fern'], onWatch });
    // S8b (T2): "Who is awake…", a stacked button, opens the watches' chips.
    await userEvent.click(screen.getByRole('button', { name: 'Who is awake…' }));
    const which = within(screen.getByRole('group', { name: 'Which watch?' }));
    expect(which.getAllByRole('button').map((b) => [b.textContent, b.className])).toEqual([
      ['1st: Reed, Moss', 'chip'],
      ['2nd: Fern', 'chip'],
    ]);
    await userEvent.click(which.getByRole('button', { name: '2nd: Fern' }));
    expect(onWatch).toHaveBeenCalledWith(expect.objectContaining({ encounter: expect.objectContaining({ id: 'a' }) }), '2nd watch: Fern');
    expect(watchChipWords('12th watch')).toBe('12th');
  });

  // Purpose (bug: the details read "2nd watch · Moss watch"): View says who was awake in the card's own words.
  it("View's details say who was awake without a doubled \"watch\"", async () => {
    cards([card('a', '2nd watch · Moss')]);
    // S8b: what was rolled is the link that opens the details (no stat blocks here, so the details at once).
    await userEvent.click(screen.getByRole('button', { name: 'Bog lurkers' }));
    expect(within(screen.getByRole('dialog')).getByText('Awake: 2nd watch: Moss')).toBeTruthy();
  });
});
