// @vitest-environment jsdom
// Encounter tables, full screen (M5b step g3; docs/05 "Encounter tables, full screen", M5 gate B2, ruled 2026-11-01),
// clicked through like a GM would, against the stand-in database. Invented tables only.
//   The list a hit opens is pins, then the hit's candidates with the likely one first, then the rest, then All N.
//   Tapping a row logs the check's result (Simple) and Undo removes it.
//   A nested row opens its table and the header reads "Abbey › Mortal"; its tap is the result.
//   Column chips appear only for a table with columns and start on the route's column.
//   Each row carries its one-line description: its note, or the stat block's description.
//   Long tables get Go to number, which finds the row (and records nothing).
//   Pins are made in the Table library ›, belong to the session (or the next one), and vanish at End session,
//   reappearing nowhere.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { startExpedition } from '../testing/depart.ts';

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

/** A GM, a player and invented setting rules: a creeping mode whose wandering check offers two tables. */
function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
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
          checks: [{ id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] }, onHit: { tableChoices: ['abbey', 'wild-day'], columns: ['Road', 'Wild'] } }],
        },
      ],
    },
  });
  entry('table', 'abbey', 'Abbey', {
    die: 'd6',
    description: 'The abbey above ground: acolytes, reed cutters and the things in the marsh around it.',
    nextTablePattern: 'abbey-{result}',
    rows: [
      { min: 1, max: 1, result: 'Drowned acolytes', count: '1d4', statBlockId: 'drowned-acolyte' },
      { min: 2, max: 3, result: 'Reed cutters', count: '2d4', note: 'Villagers with billhooks and a mule; wary, not hostile.' },
      { min: 4, max: 5, result: 'Mortal', note: 'People of the marsh: pilgrims, smugglers, a patrol.' },
      { min: 6, max: 6, result: 'Bog lurker', count: '1' },
    ],
  });
  entry('table', 'abbey-Mortal', 'Mortal', { die: 'd4', rows: [{ min: 1, max: 2, result: 'Pilgrims', count: '1d6' }, { min: 3, max: 4, result: 'Smugglers', count: '1d4' }] });
  entry('table', 'wild-day', 'Wilderness, by day', {
    die: 'd12',
    columns: ['Wild', 'Road', 'River'],
    rows: [{ min: 1, max: 2, results: ['Animal', 'Patrol', 'Otters'] }, { min: 3, max: 12, results: ['No one', 'No one', 'No one'] }],
  });
  entry('table', 'roll-call', 'Roll call of the drowned', { die: 'd30', rows: Array.from({ length: 30 }, (_, i) => ({ min: i + 1, max: i + 1, result: `Drowned soul ${i + 1}` })) });
  entry('statBlock', 'drowned-acolyte', 'Drowned acolyte', { description: 'Bloated dead in robes; slow, silent, afraid of fire.' });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  return { gm, sam, campaign };
}

async function openScene(who: string, gm = true) {
  world.signInAs(who);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: gm ? 'Campaign sections' : 'Main' })).getByRole('button', { name: 'Scene' }));
  // The GM's band reads "No session yet" before the first session (st-2); players keep the strip's "Downtime".
  await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
  return user;
}

/** "Encounter tables", the band's ⋯ menu's first item during an expedition (sf-3, ⚑ 4; page 44, EN7 A). */
async function openTables(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Time options' }));
  await user.click(await screen.findByRole('button', { name: 'Encounter tables' }));
  return within(await screen.findByRole('dialog', { name: 'Encounter tables' }));
}

const toastUndo = async (text: string) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });

/** Starts an expedition and takes the turns up to the wandering check, then taps Hit. */
async function hitOnTurn3(user: ReturnType<typeof userEvent.setup>) {
  // Next turn and the turn count need a running session (st-1, st-2): start one unless the test has.
  const start = screen.queryByRole('button', { name: 'Start session' });
  if (start) {
    await user.click(start);
    await screen.findByText('Session 1.');
  }
  await startExpedition(user);
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  await screen.findByRole('heading', { name: 'The Mustering Field, turn 2' });
  await user.click(screen.getByRole('button', { name: 'Next turn' }));
  const due = within(await screen.findByRole('region', { name: 'Due' }));
  await user.click(due.getByRole('button', { name: 'Hit, Wandering things' }));
  return within(await screen.findByRole('dialog', { name: 'Wandering things, Hit' }));
}

const names = (scope: { getAllByRole: (role: 'button') => HTMLElement[] }) =>
  scope
    .getAllByRole('button')
    .filter((b) => b.classList.contains('table-item__open') || b.classList.contains('table-list__all'))
    .map((b) => b.textContent);

describe('Encounter tables, full screen (B2)', () => {
  it('a hit opens one flat list: the candidates with the likely one first, then All N tables', async () => {
    const { gm } = table();
    const user = await openScene(gm);
    const which = await hitOnTurn3(user);
    expect(names(which)).toEqual([
      'Abbey, likely, this check, d6The abbey above ground: acolytes, reed cutters and the things in the marsh around it.›',
      'Wilderness, by day, this check, d12›',
      'All 4 tables ›',
    ]);
    // No Enter roll anywhere.
    expect(screen.queryByRole('button', { name: /Enter roll/ })).toBeNull();
    await user.click(which.getByRole('button', { name: 'All 4 tables ›' }));
    expect(names(which).slice(2)).toEqual(['Mortal, d4›', 'Roll call of the drowned, d30›']);
  });

  it("tapping the rolled row logs the check's result (Simple), and Undo removes it", async () => {
    const { gm } = table();
    const user = await openScene(gm);
    const which = await hitOnTurn3(user);
    await user.click(which.getByRole('button', { name: /^Abbey/ }));
    const abbey = within(await screen.findByRole('dialog', { name: 'Abbey' }));
    expect(abbey.getByText('Roll d6')).toBeTruthy();
    await user.click(abbey.getByRole('button', { name: /Reed cutters/ }));
    await waitFor(() => expect(world.tables.check_results[0]).toMatchObject({ table_id: 'abbey', roll: '2–3', row_text: 'Abbey: Reed cutters, 2d4' }));
    const setRoll = world.tables.events.filter((e) => e.type === 'check.setRoll');
    expect(setRoll.map((e) => e.level)).toEqual(['simple']);
    const row = abbey.getByRole('button', { name: /Reed cutters/ });
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(row.textContent).toContain('rolled');
    await user.click(await toastUndo('Rolled: 2–3, Reed cutters, 2d4'));
    await waitFor(() => expect(world.tables.check_results[0]).toMatchObject({ table_id: null, roll: null, row_text: null }));
    await waitFor(() => expect(abbey.getByRole('button', { name: /Reed cutters/ }).getAttribute('aria-current')).toBeNull());
    // The result itself stays (a hit), only the row came off; another tap records again.
    await user.click(abbey.getByRole('button', { name: /Bog lurker/ }));
    await waitFor(() => expect(world.tables.check_results[0]).toMatchObject({ roll: '6', row_text: 'Abbey: Bog lurker, 1' }));
  });

  it('every row carries a one-line description: its note, or the stat block it names', async () => {
    const { gm } = table();
    const user = await openScene(gm);
    const which = await hitOnTurn3(user);
    await user.click(which.getByRole('button', { name: /^Abbey/ }));
    const abbey = within(await screen.findByRole('dialog', { name: 'Abbey' }));
    expect(abbey.getByRole('button', { name: /Drowned acolytes/ }).textContent).toBe('1Drowned acolytes, 1d4Bloated dead in robes; slow, silent, afraid of fire.');
    expect(abbey.getByRole('button', { name: /Mortal/ }).textContent).toBe('4–5Mortal, opens Mortal ›People of the marsh: pilgrims, smugglers, a patrol.');
    expect(abbey.getByRole('button', { name: /Bog lurker/ }).textContent).toBe('6Bog lurker, 1');
  });

  it('a nested row opens its table, the header reads "Abbey › Mortal", and its tap is the result', async () => {
    const { gm } = table();
    const user = await openScene(gm);
    const which = await hitOnTurn3(user);
    await user.click(which.getByRole('button', { name: /^Abbey/ }));
    const abbey = within(await screen.findByRole('dialog', { name: 'Abbey' }));
    await user.click(abbey.getByRole('button', { name: /Mortal/ }));
    const mortal = within(await screen.findByRole('dialog', { name: 'Abbey › Mortal' }));
    expect(mortal.getByRole('heading', { name: 'Abbey › Mortal' })).toBeTruthy();
    await user.click(mortal.getByRole('button', { name: /Pilgrims/ }));
    await waitFor(() => expect(world.tables.check_results[0]).toMatchObject({ table_id: 'abbey-Mortal', roll: '1–2', row_text: 'Abbey › Mortal: Pilgrims, 1d6' }));
    // Back goes up one level, to the Abbey with its row still lit.
    await user.click(mortal.getByRole('button', { name: 'Back' }));
    const again = within(await screen.findByRole('dialog', { name: 'Abbey' }));
    expect(again.getByRole('button', { name: /Mortal/ }).getAttribute('aria-current')).toBe('true');
  });

  it("column chips appear only for a table with columns, and start on the route's column", async () => {
    const { gm } = table();
    const user = await openScene(gm);
    const which = await hitOnTurn3(user);
    await user.click(which.getByRole('button', { name: /^Abbey/ }));
    const abbey = within(await screen.findByRole('dialog', { name: 'Abbey' }));
    expect(abbey.queryByRole('group', { name: 'Column' })).toBeNull();
    await user.click(abbey.getByRole('button', { name: 'Back' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Wandering things, Hit' })).getByRole('button', { name: /^Wilderness, by day/ }));
    const wild = within(await screen.findByRole('dialog', { name: 'Wilderness, by day' }));
    const chips = within(wild.getByRole('group', { name: 'Column' }));
    expect(chips.getAllByRole('button').map((c) => [c.textContent, c.getAttribute('aria-pressed')])).toEqual([
      ['Wild', 'false'],
      ['Road', 'true'],
      ['River', 'false'],
    ]);
    expect(wild.getByRole('button', { name: /Patrol/ })).toBeTruthy();
    await user.click(chips.getByRole('button', { name: 'River' }));
    await user.click(wild.getByRole('button', { name: /Otters/ }));
    await waitFor(() => expect(world.tables.check_results[0]).toMatchObject({ table_id: 'wild-day', row_text: 'Wilderness, by day: Otters' }));
  });

  it('a long table gets Go to number, which finds the row without recording it', async () => {
    const { gm } = table();
    const user = await openScene(gm);
    await startExpedition(user);
    const which = await openTables(user);
    await user.click(which.getByRole('button', { name: /^All 4 tables/ }));
    await user.click(which.getByRole('button', { name: /^Roll call/ }));
    const long = within(await screen.findByRole('dialog', { name: 'Roll call of the drowned' }));
    await user.type(long.getByLabelText('Go to number'), '31');
    await user.click(long.getByRole('button', { name: 'Go' }));
    expect(long.getByRole('alert').textContent).toBe('No row of Roll call of the drowned has 31. Check the roll.');
    await user.clear(long.getByLabelText('Go to number'));
    await user.type(long.getByLabelText('Go to number'), '17');
    await user.click(long.getByRole('button', { name: 'Go' }));
    expect(document.activeElement?.textContent).toBe('17Drowned soul 17');
    expect(world.tables.table_reads).toEqual([]);
    // A short table has none.
    await user.click(long.getByRole('button', { name: 'Back' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Encounter tables' })).getByRole('button', { name: /^Abbey/ }));
    expect(within(await screen.findByRole('dialog', { name: 'Abbey' })).queryByLabelText('Go to number')).toBeNull();
  });

  it('pins are made in the Table library ›, lead the list for the session, and vanish at End session, reappearing nowhere', async () => {
    const { gm, campaign } = table();
    const user = await openScene(gm);
    // Prep, before the session: the pin belongs to the next one.
    await user.click(await screen.findByRole('button', { name: 'Table library ›' }));
    const library = within(await screen.findByRole('dialog', { name: 'Table library' }));
    await user.click(library.getByRole('button', { name: 'Pin Roll call of the drowned' }));
    expect(await screen.findByText('Pinned Roll call of the drowned for the next session')).toBeTruthy();
    await waitFor(() => expect(library.getByRole('button', { name: 'Unpin Roll call of the drowned' }).getAttribute('aria-pressed')).toBe('true'));
    expect(world.tables.events.filter((e) => e.type === 'tables.pin').map((e) => [e.level, e.audience])).toEqual([['verbose', 'gm']]);
    await user.click(library.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await screen.findByText('Started session 1');
    const which = await hitOnTurn3(user);
    expect(names(which)[0]).toBe('Roll call of the drowned, pinned, d30›');
    await user.click(which.getByRole('button', { name: 'Close' }));
    // Opened from the ⋯ menu (sf-3, ⚑ 4) the pinned table leads the list too.
    const pinnedList = await openTables(user);
    expect(names(pinnedList)[0]).toBe('Roll call of the drowned, pinned, d30›');
    await user.click(pinnedList.getByRole('button', { name: 'Close' }));

    // End session: the pin ends with it (nothing is removed; it just no longer counts).
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'End session' }));
    await screen.findByText('Ended session 1');
    await waitFor(async () => expect((await world.db.rpc('table_pins_now', { campaign })).data).toEqual([]));
    expect(world.tables.table_pins).toHaveLength(1);
    // The next session starts with none.
    await user.click(screen.getByRole('button', { name: 'Resume session' }));
    await screen.findByText('Started session 2');
    // During an expedition the one way to the tables is the ⋯ menu's "Encounter tables" (sf-3, ⚑ 4); the library sits
    // at the foot of its screen. The new session's list has no pin.
    expect(screen.queryByRole('button', { name: 'Table library ›' })).toBeNull();
    const fresh = await openTables(user);
    expect(names(fresh).some((n) => n.includes('pinned'))).toBe(false);
    await user.click(fresh.getByRole('button', { name: 'Table library ›' }));
    expect(within(await screen.findByRole('dialog', { name: 'Table library' })).getByRole('button', { name: 'Pin Roll call of the drowned' })).toBeTruthy();
  });

  it('Unpin takes a pin away, and its Undo pins it again', async () => {
    const { gm, campaign } = table();
    const user = await openScene(gm);
    await user.click(await screen.findByRole('button', { name: 'Table library ›' }));
    const library = within(await screen.findByRole('dialog', { name: 'Table library' }));
    await user.click(library.getByRole('button', { name: 'Pin Abbey' }));
    await user.click(await library.findByRole('button', { name: 'Unpin Abbey' }));
    expect(await screen.findByText('Unpinned Abbey')).toBeTruthy();
    await waitFor(async () => expect((await world.db.rpc('table_pins_now', { campaign })).data).toEqual([]));
    await user.click(await toastUndo('Unpinned Abbey'));
    await waitFor(async () => expect(((await world.db.rpc('table_pins_now', { campaign })).data as { table_id: string }[]).map((p) => p.table_id)).toEqual(['abbey']));
  });

  it('a player never sees the encounter tables, the library or a pin', async () => {
    const { sam } = table();
    await openScene(sam, false);
    expect(screen.queryByRole('button', { name: 'Table library ›' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Encounter tables/ })).toBeNull();
  });
});
