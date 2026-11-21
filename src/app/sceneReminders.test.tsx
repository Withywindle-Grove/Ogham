// @vitest-environment jsdom
// The reminder card and the GM's reminders on Scene (M5 step 6), clicked through like a person would, against the
// stand-in database. Invented rules only.
//   Gate check: a check every 2 turns prompts on turns 2, 4 and 6, with Hit and Miss, and on no other turn.
//   The GM makes a reminder in a few taps; a reminder has Done, a check has Hit / Miss; Miss says when it's next due
//   and its Undo puts the line back (the result is marked undone, never removed).
//   + Modifier counts into the chance and is kept with the result.
//   Hit opens Which table? full screen (M5 gate B2): the GM opens a table and taps the rolled row, kept with the result.
//   Gate check: players see results only at Downtime: not in the table, not in the log, until the campaign goes
//   into Downtime; then they're revealed. A GM-only reminder never reaches a player; a public one shows in their
//   reference list.
//   A setting's encounter check: Explore's one row "Encounter tables · <likely> likely" (B2) opens the same screens;
//   a row tapped there is recorded "rolled by hand". Table library › opens the table library full screen (no Enter roll).
//   The hour track shows the turns of the hour. A timed recharge comes due in Downtime with its one-tap Recharge.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeEventTag } from '../core/eventTags.ts';
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

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  return { gm, sam, campaign, wren };
}

/** Invented setting rules: a creeping mode whose wandering check rolls one of two tables, the GM's pick. */
function withSetting(campaign: string, gm: string, twice = false) {
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
          procedure: [
            { id: 'wander', name: 'Wandering things', icon: 'monster', kind: 'check', checkId: 'wander' },
            // A second step running the same check (as a camp reusing the day's check would).
            ...(twice ? [{ id: 'listen', name: 'Listen at the dark', icon: 'monster', kind: 'check', checkId: 'wander' }] : []),
          ],
          checks: [{ id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] }, onHit: { tableChoices: ['shallows', 'deeps'] } }],
        },
      ],
    },
  });
  entry('table', 'shallows', 'Shallow things', { die: 'd6', rows: [{ min: 1, max: 3, result: 'Bog lurkers', count: '1d4' }, { min: 4, max: 6, result: 'Reed wraith' }] });
  entry('table', 'deeps', 'Deep things', { die: 'd6', rows: [{ min: 1, max: 6, result: 'Lantern eels' }] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
}

/** A reminder made straight in the stand-in database, as the GM (another device). */
async function madeReminder(campaign: string, gm: string, extra: Record<string, unknown> = {}) {
  world.signInAs(gm);
  const tag = encodeEventTag({ type: 'reminder.add', level: 'simple', requestId: crypto.randomUUID() });
  await world.db
    .rpc('add_reminder', { campaign, label: 'Wandering check', kind: 'check', encounter_check: true, every_value: 2, every_unit: 'turn', is_public: false, chance: { die: 'd6', on: [1] }, ...extra })
    .setHeader('x-grimoire-command', tag);
}

async function openScene(who: string, gm: boolean) {
  world.signInAs(who);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: gm ? 'Campaign sections' : 'Main' })).getByRole('button', { name: 'Scene' }));
  // The GM's band reads "No session yet" before the first session (st-2); players keep the strip's "Downtime".
  await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
  // Next turn, the turn count and "+ Reminder" need a running session (st-1, st-2): the GM starts one first.
  if (gm) {
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await screen.findByText('Session 1.');
  }
  return user;
}

const card = () => screen.queryByRole('region', { name: 'Due' });

/**
 * Taps Next turn and waits until the strip reads the new turn. Scene runs one change at a time (a second tap while
 * one is saving does nothing), so a test that taps again before the first move has landed loses that tap.
 */
async function nextTurn(user: ReturnType<typeof userEvent.setup>, modeName: string, to: number) {
  await user.click(await screen.findByRole('button', { name: 'Next turn' }));
  await screen.findByRole('heading', { name: `${modeName}, turn ${to}` });
}
const toastUndo = async (text: string) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });

describe('the reminder card (M5 step 6)', () => {
  it('gate check: a check every 2 turns prompts on turns 2, 4 and 6, with Hit and Miss, and on no other turn', async () => {
    const { gm, campaign } = table();
    await madeReminder(campaign, gm);
    const user = await openScene(gm, true);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    const prompted: number[] = [];
    for (let turn = 1; turn <= 6; turn += 1) {
      await user.click(screen.getByRole('button', { name: 'Next turn' }));
      await screen.findByRole('heading', { name: `The Mustering Field, turn ${turn + 1}` });
      const due = card();
      if (due && within(due).queryByRole('button', { name: 'Hit, Wandering check' })) {
        prompted.push(turn);
        expect(within(due).getByRole('button', { name: 'Miss, Wandering check' })).toBeTruthy();
        await user.click(within(due).getByRole('button', { name: 'Miss, Wandering check' }));
        await waitFor(() => expect(card()).toBeNull());
      }
    }
    expect(prompted).toEqual([2, 4, 6]);
    expect(world.tables.check_results.map((r) => r.outcome)).toEqual(['miss', 'miss', 'miss']);
  });

  it('the GM makes a reminder in a few taps; it comes due with Done', async () => {
    const { gm } = table();
    const user = await openScene(gm, true);
    // S2/S3 (page 16, T6b): "+ Reminder" lives in the Reminders dialog opened from ⋯, not under the band.
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: 'Reminders' }));
    await user.click(within(screen.getByRole('dialog', { name: /Reminders$/ })).getByRole('button', { name: '+ Reminder' }));
    const dialog = within(screen.getByRole('dialog', { name: 'New reminder' }));
    await user.click(dialog.getByRole('button', { name: 'Make the reminder' }));
    expect(dialog.getByRole('alert').textContent).toBe('Give it a few words, like "Eat a ration".');
    await user.type(dialog.getByLabelText('What to remember'), 'Eat a ration');
    await user.click(dialog.getByRole('button', { name: 'days' }));
    await user.click(dialog.getByRole('button', { name: 'Make the reminder' }));
    expect(await screen.findByText('Made the reminder Eat a ration')).toBeTruthy();
    expect(world.tables.reminders[0]).toMatchObject({ label: 'Eat a ration', kind: 'reminder', every_value: 1, every_unit: 'day', is_public: false });
    // S10 (T6): one row per reminder in the Reminders sheet, saying when it next falls due; it opens the reminder's sheet.
    expect(screen.getByRole('button', { name: /^Eat a ration: Every day\. Next in \d+ days?\. GM only\.$/ })).toBeTruthy();

    // "+1 week" is an item in the ⋯ menu now (st-1).
    await user.click(screen.getByRole('button', { name: 'Time options' }));
    await user.click(screen.getByRole('button', { name: '+1 week' }));
    const due = within(await screen.findByRole('region', { name: 'Due' }));
    expect(due.getByText('Eat a ration ×7')).toBeTruthy();
    await user.click(due.getByRole('button', { name: 'Done, Eat a ration' }));
    expect(due.getByText('Eat a ration ×6')).toBeTruthy();
    await user.click(due.getByRole('button', { name: 'All done' }));
    await waitFor(() => expect(card()).toBeNull());
  });

  it('Miss says when the check is next due; its Undo puts the line back and marks the result undone', async () => {
    const { gm, campaign } = table();
    await madeReminder(campaign, gm);
    const user = await openScene(gm, true);
    await startExpedition(user);
    await user.click(await screen.findByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 2' });
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 3' });
    const due = within(await screen.findByRole('region', { name: 'Due' }));
    expect(due.getByText('Roll 1d6, on 1')).toBeTruthy();
    // Counted as the strip counts (m5b-2 Departures item 9): due on turn 3, every 2 turns, so next on the strip's turn 5.
    expect(due.getByText('next at turn 5')).toBeTruthy();
    await user.click(due.getByRole('button', { name: 'Miss, Wandering check' }));
    await user.click(await toastUndo('Wandering check: a miss, next at turn 5'));
    expect(await screen.findByRole('button', { name: 'Hit, Wandering check' })).toBeTruthy();
    expect(world.tables.check_results[0]!.undone).toBe(true);
  });

  // Bug fix (2026-11-03, m5b-2 Departures item 9): "next at turn N" counted one lower than the strip.
  it('a check that says "next at turn 5" falls due when the strip reads turn 5', async () => {
    const { gm, campaign } = table();
    await madeReminder(campaign, gm);
    const user = await openScene(gm, true);
    await startExpedition(user);
    await user.click(await screen.findByRole('button', { name: 'Next turn' }));
    await user.click(await screen.findByRole('button', { name: 'Next turn' }));
    const due = within(await screen.findByRole('region', { name: 'Due' }));
    expect(due.getByText('next at turn 5')).toBeTruthy();
    await user.click(due.getByRole('button', { name: 'Miss, Wandering check' }));
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 4' });
    expect(screen.queryByRole('button', { name: 'Hit, Wandering check' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 5' });
    expect(await screen.findByRole('button', { name: 'Hit, Wandering check' })).toBeTruthy();
  });

  it('+ Modifier counts into the chance and is kept with the result; Hit reads the row from the table typed', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByText('Next turn, nothing due');
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    const due = within(await screen.findByRole('region', { name: 'Due' }));
    expect(due.getByText('Roll 1d6, on 1')).toBeTruthy();

    await user.click(due.getByRole('button', { name: '+ Modifier, Wandering things' }));
    const mod = within(screen.getByRole('dialog', { name: 'Modifier for Wandering things' }));
    await user.type(mod.getByLabelText('Note (optional)'), 'Noisy armour');
    // One tap on a chip applies it (ruled 2026-10-29: −1 / +1 chips, the note optional).
    await user.click(mod.getByRole('button', { name: '+1 face' }));
    expect(due.getByText('Roll 1d6, on 1–2')).toBeTruthy();
    expect(due.getByText('+1, Noisy armour (by hand)')).toBeTruthy();
    // The chip on the line: one tap, no sheet.
    await user.click(due.getByRole('button', { name: '−1 face, Wandering things' }));
    expect(due.getByText('Roll 1d6, on 1')).toBeTruthy();
    expect(due.getByText('−1, by hand')).toBeTruthy();

    await user.click(due.getByRole('button', { name: 'Hit, Wandering things' }));
    // B2: Which table? opens full screen on the hit; the hit card waits behind it.
    const which = within(await screen.findByRole('dialog', { name: 'Wandering things, Hit' }));
    expect(world.tables.check_results[0]).toMatchObject({
      outcome: 'hit',
      name: 'Wandering things',
      secret: true,
      revealed: false,
      modifiers: [
        { label: 'Noisy armour', add: 1, source: 'hand' },
        { label: '', add: -1, source: 'hand' },
      ],
    });
    // Two tables (the check's choices, by depth say): the GM opens one and taps the row the dice showed.
    await user.click(which.getByRole('button', { name: /^Shallow things/ }));
    const shallows = within(await screen.findByRole('dialog', { name: 'Shallow things' }));
    expect(screen.queryByLabelText(/enter the roll/)).toBeNull();
    await user.click(shallows.getByRole('button', { name: /Bog lurkers/ }));
    await waitFor(() => expect(world.tables.check_results[0]).toMatchObject({ table_id: 'shallows', roll: '1–3', row_text: 'Shallow things: Bog lurkers, 1d4' }));
    expect(await screen.findByText('Rolled: 1–3, Bog lurkers, 1d4')).toBeTruthy();
    // Back to the list, then back to the console with the hit still open.
    await user.click(shallows.getByRole('button', { name: 'Back' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Wandering things, Hit' })).getByRole('button', { name: 'Close' }));
    const hit = within(await screen.findByRole('region', { name: 'Wandering things: hit' }));
    expect(hit.getByRole('status').textContent).toBe('Rolled: Shallow things: Bog lurkers, 1d4');
    // A secret result: the GM can show it to the players now (ruled 2026-10-29), with Undo.
    await user.click(hit.getByRole('button', { name: 'Reveal to players' }));
    expect(await screen.findByText('Showed the players Wandering things')).toBeTruthy();
    expect(world.tables.check_results[0]).toMatchObject({ revealed: true, revealed_by_hand: true });
    expect(hit.getByText('Players see this result.')).toBeTruthy();
    await user.click(hit.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('region', { name: 'Wandering things: hit' })).toBeNull();
  });

  it("Explore's row names the likely table; opened without a hit, a tapped row is recorded rolled by hand, and Undo takes it back", async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await startExpedition(user);
    // One row, replacing "current table · Roll" (B2).
    const row = await screen.findByRole('button', { name: /^Encounter tables/ });
    expect(row.textContent).toBe('Encounter tables, Shallow things likely›');
    await user.click(row);
    const which = within(await screen.findByRole('dialog', { name: 'Encounter tables' }));
    await user.click(which.getByRole('button', { name: /^Deep things/ }));
    const deeps = within(await screen.findByRole('dialog', { name: 'Deep things' }));
    await user.click(deeps.getByRole('button', { name: /Lantern eels/ }));
    await waitFor(() => expect(world.tables.table_reads).toHaveLength(1));
    expect(world.tables.table_reads[0]).toMatchObject({ table_id: 'deeps', roll: '1–6', row_text: 'Deep things: Lantern eels', undone: false });
    expect(world.tables.events.filter((e) => e.type === 'tables.readByHand').map((e) => [e.level, e.audience])).toEqual([['simple', 'gm']]);
    // Nothing is put on a check: no hit was open.
    expect(world.tables.check_results).toEqual([]);
    expect(deeps.getByRole('button', { name: /Lantern eels/ }).getAttribute('aria-current')).toBe('true');
    await user.click(await toastUndo('Rolled by hand: 1–6, Lantern eels'));
    await waitFor(() => expect(world.tables.table_reads[0]!.undone).toBe(true));
    await waitFor(() => expect(deeps.getByRole('button', { name: /Lantern eels/ }).getAttribute('aria-current')).toBeNull());
  });

  // Purpose: during an expedition the band has one way to the tables (Encounter tables ›), and the library with its
  // pins is still reachable from that screen's foot: every table by name with a pin button; one opened is for reading.
  it('Table library › opens the table library full screen: every table by name with a pin button; one opened is for reading', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm);
    const user = await openScene(gm, true);
    await startExpedition(user);
    // One way to the tables in the band (the approval's fix 3): the Encounter tables row; the library is at its foot.
    const row = await screen.findByRole('button', { name: /^Encounter tables/ });
    expect(screen.queryByRole('button', { name: 'Table library ›' })).toBeNull();
    await user.click(row);
    await user.click(within(await screen.findByRole('dialog', { name: 'Encounter tables' })).getByRole('button', { name: 'Table library ›' }));
    const library = within(await screen.findByRole('dialog', { name: 'Table library' }));
    expect(library.getByText('2 in this setting')).toBeTruthy();
    expect(library.getAllByRole('button', { name: /things/ }).map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Deep things, d6›', 'Pin Deep things', 'Shallow things, d6›', 'Pin Shallow things']);
    await user.click(library.getByRole('button', { name: /^Shallow things/ }));
    const reading = within(await screen.findByRole('dialog', { name: 'Shallow things' }));
    // For reading: the rows aren't buttons, and there's no Enter roll.
    expect(reading.queryByRole('button', { name: /Bog lurkers/ })).toBeNull();
    expect(reading.getByText('Bog lurkers')).toBeTruthy();
    expect(reading.queryByRole('button', { name: /Enter roll/ })).toBeNull();
    await user.click(reading.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('dialog', { name: 'Table library' })).toBeTruthy();
  });

  // Purpose (S7, S18; page 16, T1 and T2): the GM's Scene in a turn mode shows the strip of the procedure in force and
  // no hour track (its pips went); the procedure still opens by tapping the mode and turn.
  it("the GM's turn shows the strip and no hour track, and the heading opens the procedure", async () => {
    const { gm, campaign } = table();
    await madeReminder(campaign, gm);
    const user = await openScene(gm, true);
    await startExpedition(user);
    expect(await screen.findByRole('group', { name: 'Sequence of play' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'This hour' })).toBeNull();
    // B5, B14: the procedure opens by tapping the mode and turn (no Procedure button).
    expect(screen.queryByRole('button', { name: 'Procedure' })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'The Mustering Field, turn 1' }));
    expect(await screen.findByRole('dialog', { name: 'Dungeon: the procedure' })).toBeTruthy();
  });

  it('a timed recharge comes due in Downtime, and Recharge gives the charges back in one tap', async () => {
    const { gm, campaign, wren } = table();
    world.tables.inventory_lines.push({
      id: 'line-wand',
      campaign_id: campaign,
      actor_id: wren,
      location_id: null,
      name: 'Wand of Reeds',
      category: 'wand',
      qty: 1,
      charges_left: 1,
      charges_hidden: false,
      charges_used: 0,
      item_data: { recharge: { amount: 2, every: 'day' } },
      version: 1,
      approval: 'approved',
    });
    const user = await openScene(gm, true);
    // Downtime's band button is Next day now (st-1), which does what "+1 day" did.
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    const due = within(await screen.findByRole('region', { name: 'Due' }));
    await user.click(due.getByRole('button', { name: 'Recharge, Wand of Reeds recharges today' }));
    expect(await screen.findByText('Recharged Wand of Reeds by 2')).toBeTruthy();
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-wand')!.charges_left).toBe(3);
  });

  it('a check already run this period reads "Checked this turn, Check again" in a turn mode (ruled 2026-10-30); tapped, it has Hit / Miss and is logged Verbose', async () => {
    const { gm, campaign } = table();
    withSetting(campaign, gm, true);
    const user = await openScene(gm, true);
    await startExpedition(user);
    await screen.findByRole('heading', { name: 'The Mustering Field, turn 1' });
    await nextTurn(user, 'The Mustering Field', 2);
    await nextTurn(user, 'The Mustering Field', 3);
    // S8b: each line of the card is its own item of "Waiting for you" (both named "Wandering things"): the check is
    // open, its Hit the one Hit on the page; the second look is the row after it, its button Check again.
    // One prompt for the check, and the optional second look (05, Once per period; ruled 2026-10-29).
    expect(screen.getAllByRole('button', { name: /^Hit, / })).toHaveLength(1);
    await user.click(within(await screen.findByRole('region', { name: 'Waiting for you' })).getByRole('button', { name: 'Open: Wandering things' }));
    const due = within(await screen.findByRole('region', { name: 'Due' }));
    expect(due.getByText('Checked this turn')).toBeTruthy();
    await user.click(due.getByRole('button', { name: 'Check again, Wandering things' }));
    // Tapped, it is a check with Hit / Miss: two checks now, the open one's Miss and Hit, the other's Hit on its row.
    expect(within(await screen.findByRole('region', { name: 'Due' })).getAllByRole('button', { name: 'Miss, Wandering things' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Hit, Wandering things' })).toHaveLength(2);
    await user.click(within(screen.getByRole('region', { name: 'Due' })).getByRole('button', { name: 'Miss, Wandering things' }));
    await screen.findByText(/Wandering things: a miss/);
    const logged = world.tables.events.filter((e) => e.type === 'check.again');
    expect(logged.map((e) => e.level)).toEqual(['verbose']);
    // The first run is still on the card, as a check.
    expect(within(card()!).getAllByRole('button', { name: 'Miss, Wandering things' })).toHaveLength(1);
  });
});

describe('what players see (M5 step 6)', () => {
  it("gate check: a player sees a check's result only once the campaign goes into Downtime", async () => {
    const { gm, sam, campaign } = table();
    await madeReminder(campaign, gm);
    // The GM, on another device: an expedition, a check recorded and its log line.
    const tag = (type: string) => encodeEventTag({ type, level: 'simple', requestId: crypto.randomUUID() });
    await world.db.rpc('start_expedition', { campaign, mode_id: 'dungeon' }).setHeader('x-grimoire-command', tag('expedition.start'));
    await world.db.rpc('record_check', { campaign, check_key: 'gm:x', name: 'Wandering check', source: 'gm', outcome: 'hit' }).setHeader('x-grimoire-command', tag('check.record'));

    world.signInAs(sam);
    const asPlayer = await world.db.from('check_results').select('*').eq('campaign_id', campaign);
    expect(asPlayer.data).toEqual([]);
    const log = await world.db.from('events').select('*').eq('campaign_id', campaign).eq('type', 'check.record');
    expect(log.data).toEqual([]);

    world.signInAs(gm);
    const expedition = world.tables.expeditions[0]!;
    await world.db.rpc('end_expedition', { expedition: String(expedition.id), seen_version: Number(expedition.version) }).setHeader('x-grimoire-command', tag('expedition.end'));
    // Start downtime is its own tap (dt-2, M5b step 6a): secret results reach players when Downtime begins.
    await world.db.rpc('start_downtime', { campaign, refills: {} }).setHeader('x-grimoire-command', tag('downtime.start'));
    world.signInAs(sam);
    expect((await world.db.from('check_results').select('*').eq('campaign_id', campaign)).data).toHaveLength(1);
    expect((await world.db.from('events').select('*').eq('campaign_id', campaign).eq('type', 'check.record')).data).toHaveLength(1);

  });

  // After End expedition, the players' Scene shows no "Revealed this downtime" (B17); the log has those lines.
  it(`after End expedition, the players' Scene has no "Revealed this downtime" card`, async () => {
    const { gm, sam, campaign } = table();
    const tag = (type: string) => encodeEventTag({ type, level: 'simple', requestId: crypto.randomUUID() });
    world.signInAs(gm);
    await world.db.rpc('start_expedition', { campaign, mode_id: 'dungeon' }).setHeader('x-grimoire-command', tag('expedition.start'));
    await world.db.rpc('record_check', { campaign, check_key: 'gm:x', name: 'Wandering check', source: 'gm', outcome: 'hit' }).setHeader('x-grimoire-command', tag('check.record'));
    const expedition = world.tables.expeditions[0]!;
    await world.db.rpc('end_expedition', { expedition: String(expedition.id), seen_version: Number(expedition.version) }).setHeader('x-grimoire-command', tag('expedition.end'));
    // Start downtime is its own tap (dt-2, M5b step 6a): secret results reach players when Downtime begins.
    await world.db.rpc('start_downtime', { campaign, refills: {} }).setHeader('x-grimoire-command', tag('downtime.start'));
    await openScene(sam, false);
    expect(screen.queryByRole('region', { name: 'Revealed this downtime' })).toBeNull();
    expect(screen.queryByText('Revealed this downtime')).toBeNull();
    expect(screen.queryByText('Wandering check, hit')).toBeNull();
  });

  it('an open check (checks[].secret false) shows to players at once, and so does a result recorded in Downtime', async () => {
    const { gm, sam, campaign } = table();
    world.signInAs(gm);
    const tag = (type: string) => encodeEventTag({ type, level: 'simple', requestId: crypto.randomUUID() });
    await world.db.rpc('start_expedition', { campaign, mode_id: 'dungeon' }).setHeader('x-grimoire-command', tag('expedition.start'));
    await world.db.rpc('record_check', { campaign, check_key: 'check:mode:open', name: 'Open roll', source: 'mode', outcome: 'miss', secret: false }).setHeader('x-grimoire-command', tag('check.record'));
    await world.db.rpc('record_check', { campaign, check_key: 'check:mode:secret', name: 'Secret roll', source: 'mode', outcome: 'miss' }).setHeader('x-grimoire-command', tag('check.record'));
    world.signInAs(sam);
    const read = async () => ((await world.db.from('check_results').select('*').eq('campaign_id', campaign)).data as { name: string }[]).map((r) => r.name);
    expect(await read()).toEqual(['Open roll']);
    expect((await world.db.from('events').select('*').eq('campaign_id', campaign).eq('type', 'check.record')).data).toHaveLength(1);

    world.signInAs(gm);
    const expedition = world.tables.expeditions[0]!;
    await world.db.rpc('end_expedition', { expedition: String(expedition.id), seen_version: Number(expedition.version) }).setHeader('x-grimoire-command', tag('expedition.end'));
    // Start downtime is its own tap (dt-2, M5b step 6a): secret results reach players when Downtime begins.
    await world.db.rpc('start_downtime', { campaign, refills: {} }).setHeader('x-grimoire-command', tag('downtime.start'));
    await world.db.rpc('record_check', { campaign, check_key: 'gm:x', name: 'Downtime roll', source: 'gm', outcome: 'hit' }).setHeader('x-grimoire-command', tag('check.record'));
    world.signInAs(sam);
    expect(await read()).toEqual(['Open roll', 'Secret roll', 'Downtime roll']);
  });

  it('a GM-only reminder never reaches a player; a public one is in their reference list', async () => {
    const { gm, sam, campaign } = table();
    await madeReminder(campaign, gm);
    await madeReminder(campaign, gm, { label: 'Check the lamps', kind: 'reminder', is_public: true, every_value: 3 });
    world.signInAs(sam);
    const read = await world.db.from('reminders').select('*').eq('campaign_id', campaign);
    expect((read.data as { label: string }[]).map((r) => r.label)).toEqual(['Check the lamps']);
    await openScene(sam, false);
    const reference = within(await screen.findByRole('region', { name: 'Reference' }));
    expect(reference.getByText('Check the lamps')).toBeTruthy();
    expect(reference.getByText('Every 3 turns')).toBeTruthy();
    expect(screen.queryByText('Wandering check')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Reminder' })).toBeNull();
  });

  // Purpose (review of #855): the GM's hour track went with the strip (S7), but a player's Scene keeps "This hour" with
  // its public marks until the players' top (S15), and never a GM-only one, so the pips can't vanish silently.
  // Purpose (S18, changed by that ruling: page 16 draws no pips, so the hour track went from the players' Scene with
  // their top, S15): a player's Scene shows no hour track; what this test guarded stays guarded: a public reminder still
  // reaches the player, the GM's own never does.
  it("a player's Scene shows no hour track; the public reminder reaches the player and the GM's own never does", async () => {
    const { gm, sam, campaign } = table();
    await madeReminder(campaign, gm);
    await madeReminder(campaign, gm, { label: 'Check the lamps', kind: 'reminder', is_public: true, every_value: 3 });
    const tag = encodeEventTag({ type: 'expedition.start', level: 'simple', requestId: crypto.randomUUID() });
    await world.db.rpc('start_expedition', { campaign, mode_id: 'dungeon' }).setHeader('x-grimoire-command', tag);
    world.signInAs(sam);
    const user = userEvent.setup();
    render(<Root db={world.db} />);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
    const reference = within(await screen.findByRole('region', { name: 'Reference' }));
    expect(reference.getByText('Check the lamps')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'This hour' })).toBeNull();
    expect(screen.queryByText(/Wandering check/)).toBeNull();
  });
});
