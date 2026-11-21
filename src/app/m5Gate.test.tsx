// @vitest-environment jsdom
// The M5 gate's regression spine (build order 6 of docs/plans/m5-12-leaving.md): one scripted delve through the
// stand-in database, clicked like a person at two devices (the GM's and a player's). Invented rules only.
// Purpose: prove, in one run, that the pieces of M5 work together: a session and an expedition at a place shown to
// players, a light that burns down, Next turn with a wandering check recorded, rest falling due, no Something else…
// for the player (removed at the M5 gate, A5), Leave the dungeon with an escape roll sent, and End expedition with its
// summary.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { typePlace } from '../testing/pickPlace.ts';
import { openWaiting } from '../testing/openWaiting.ts';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
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

async function open(who: string, gm: boolean, section: 'Scene' | 'Players') {
  cleanup();
  world.signInAs(who);
  forgetCampaignSetting();
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: gm ? 'Campaign sections' : 'Main' })).getByRole('button', { name: new RegExp(`^${section}`) }));
  return user;
}


it('a ten-turn delve: place, light, turns with a wandering check, rest, no Something else…, the escape and the summary', async () => {
  // The table: Priya runs it, Sam plays Wren (four rushlights), Jo plays Ash.
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const jo = world.addPerson('jo@lantern.example', 'Jo');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: jo });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, jo, 'player', ash);
  world.tables.inventory_lines.push({ id: 'line-rush', campaign_id: campaign, actor_id: wren, location_id: null, name: 'Rushlights', category: 'light', qty: 4, stack: 10, approval: 'approved', item_data: { lightTypeId: 'rushlight' }, source_entry_id: null, version: 1 });
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
          checks: [{ id: 'wander', name: 'Wandering things', every: { value: 2, unit: 'turn' }, chance: { die: 'd6', on: [1] } }],
          movement: {},
          rest: { every: { value: 3, unit: 'turn' }, length: { value: 1, unit: 'turn' }, condition: 'weary', note: 'Sit a turn in every three, or grow weary.' },
        },
      ],
    },
    dungeonExit: { roll: { save: 'nerve' }, modifiers: [{ id: 'map', name: 'Has a map', value: 2 }], depth: { per: 1, value: -1 }, onFail: { table: 'lost-below' }, safePaths: 'Follow the chalk marks back.' },
  });
  entry('lightType', 'rushlight', 'Rushlight', { duration: 6, unit: 'turn', consumed: true });
  entry('condition', 'weary', 'Weary', { stacks: true, notes: 'Slow and sore.' });
  entry('table', 'lost-below', 'Lost below table', { die: 'd6', rows: [{ min: 1, max: 6, result: 'Bog lurkers find you' }] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
  const clock = () => Number(world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds);

  // Step 1. The GM starts a session, then an expedition at The Drowned Stair.
  let user = await open(gm, true, 'Scene');
  // The GM's band reads "No session yet" before the first session (st-2).
  await screen.findByRole('heading', { name: /^(No session yet|Downtime)$/ });
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Started session 1');
  await typePlace(user, 'The Drowned Stair', /^Where\?:/, await openDepart(user));
  await startExpedition(user);
  // The band's heading names the place and the count (st-1); the separate "Started at …" line is gone.
  await screen.findByRole('heading', { name: 'The Drowned Stair, turn 1' });
  expect(screen.queryByText('Started at The Drowned Stair')).toBeNull();

  // Step 2. The GM adds a piece to the place and shows it to players (M5b g2, B1: piece by piece).
  await user.click(await screen.findByRole('button', { name: '+ Piece' }));
  await user.type(screen.getByLabelText('What players will see'), 'Black water laps at the steps');
  await user.click(screen.getByRole('button', { name: 'Add' }));
  await user.click(await screen.findByRole('button', { name: 'Show players' }));
  expect(await screen.findByText('Shown to the party: Black water laps at the steps')).toBeTruthy();

  // Step 3. Sam sees where they are, and (no light in the group) lights a rushlight.
  user = await open(sam, false, 'Scene');
  expect(await screen.findByRole('heading', { name: 'The Drowned Stair' })).toBeTruthy();
  const reminder = within(await screen.findByRole('status', { name: 'No light' }));
  await user.click(reminder.getByRole('button', { name: 'Light a rushlight (4 left)' }));
  expect(await screen.findByText('Lit Rushlight')).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole('status', { name: 'No light' })).toBeNull());

  // Step 4. The GM turns: the wandering check falls due after turn 2 and is recorded (Miss); rest falls due on turn 3.
  user = await open(gm, true, 'Scene');
  await screen.findByRole('heading', { name: 'The Drowned Stair, turn 1' });
  const nextTurn = async (to: number) => {
    await user.click(await screen.findByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: `The Drowned Stair, turn ${to}` });
  };
  await nextTurn(2);
  await nextTurn(3);
  const due = within(await screen.findByRole('region', { name: 'Due' }));
  await user.click(due.getByRole('button', { name: 'Miss, Wandering things' }));
  await waitFor(() => expect(world.tables.check_results.map((r) => r.outcome)).toEqual(['miss']));
  expect(clock()).toBe(1200);

  // Step 5. Rest falls due on the third turn: the GM's rest panel opens (B5), and the player is prompted.
  await nextTurn(4);
  // S8b (T2): the rest is an item of "Waiting for you"; its Answer… opens the rest panel as a sheet.
  // Wait: the rest's item reaches the panel a read after turn 4's heading, so on a busy machine the walk ran first.
  await within(await screen.findByRole('region', { name: 'Waiting for you' })).findAllByRole('button', { name: 'Answer…, Rest is due' }, { timeout: 5000 });
  await openWaiting(user, 'Rest is due');
  await user.click(await screen.findByRole('button', { name: 'Answer…, Rest is due' }));
  expect(await screen.findByRole('region', { name: /^Rest due, 0 of \d+ answered$/ })).toBeTruthy();
  user = await open(sam, false, 'Scene');
  expect(await screen.findByRole('region', { name: 'Rest due' })).toBeTruthy();

  // Step 6. Sam has no Something else… and no Describe (A5): actions are narrated. The GM plays two more turns.
  expect(screen.queryByRole('button', { name: 'Something else…' })).toBeNull();
  expect(screen.queryByText('Describe what you want to do')).toBeNull();
  user = await open(gm, true, 'Scene');
  await nextTurn(5);
  await nextTurn(6);
  expect(clock()).toBe(3000);

  // Step 7. Four more turns bring the delve to ten turns' worth of clock; the rushlight (6 turns) has burned down.
  user = await open(gm, true, 'Scene');
  await screen.findByRole('heading', { name: 'The Drowned Stair, turn 6' });
  await nextTurn(7);
  await nextTurn(8);
  await nextTurn(9);
  await nextTurn(10);
  expect(clock()).toBe(9 * 600);
  // The rushlight, lit at turn 1, has burned down: Sam is back in the dark.
  user = await open(sam, false, 'Scene');
  expect(await screen.findByRole('status', { name: 'No light' })).toBeTruthy();
  user = await open(gm, true, 'Scene');
  await screen.findByRole('heading', { name: 'The Drowned Stair, turn 10' });

  // Step 8. Leave the dungeon: the GM asks for the rolls; Sam enters 14 with the map; the GM sends Out safely.
  await user.click(await screen.findByRole('button', { name: 'Leave the dungeon' }));
  // The party is one level below the first (the stepper starts at 0, sq-1).
  await user.click(await screen.findByRole('button', { name: 'More levels below the first' }));
  await user.click(await screen.findByRole('button', { name: 'Ask for escape rolls' }));
  await screen.findByText(/Asked for 2 escape rolls/);
  user = await open(sam, false, 'Scene');
  const roll = within(await screen.findByRole('article', { name: 'Leave the dungeon: your escape roll' }));
  await user.click(roll.getByRole('switch', { name: 'Has a map (+2)' }));
  await user.type(roll.getByLabelText('What did you roll?'), '14');
  await user.click(roll.getByRole('button', { name: 'Enter roll' }));
  expect(await screen.findByText(/Sent to the GM, rolled 14/)).toBeTruthy();
  user = await open(gm, true, 'Players');
  const escape = within(await screen.findByRole('region', { name: 'Waiting for you' }));
  // S8a: one item is drawn whole, the others are rows: Wren's is opened first.
  await openWaiting(user, 'Wren, escape roll');
  expect(escape.getByText('Rolled 14 +2 (Has a map) −1 (1 level below the first) = 15')).toBeTruthy();
  const wrens = escape.getByText('Wren, escape roll').closest('li') as HTMLElement;
  await user.click(within(wrens).getByRole('button', { name: 'Send' }));
  await screen.findByText('Sent Wren: out safely');

  // Step 9. End expedition (the rolls were asked, so no second dialog) shows the summary.
  user = await open(gm, true, 'Scene');
  await user.click(await screen.findByRole('button', { name: 'Time options' }));
  await user.click(within(document.querySelector('.more-menu__panel') as HTMLElement).getByRole('button', { name: 'End expedition' }));
  expect(await screen.findByText('Expedition ended')).toBeTruthy();
  expect(world.tables.expeditions[0]!.ended_at).not.toBeNull();
}, 60000);
