// @vitest-environment jsdom
// M5 step 12, Requests (ruled 2026-10-31, Q3 and Q6; docs/05 "Requests"), clicked through like a person would against
// the stand-in database. Invented rules only.
//   No Something else… and no Describe (removed at the M5 gate, A5): players' Scene has neither. A line a player
//   sent before the removal still shows with Cancel, and the GM answers it from Waiting for you with Yes or No and a
//   note, never a cost in turns; the player reads the answer until "Got it".
//   Leave the dungeon: only when the pack has the rule; asks one escape roll per character; the player enters the
//   roll with the pack's modifiers and depth; the GM sends the outcome, and a failure opens the pack's table.
//   Resumed: after End session and Start session mid-dungeon the strip says where and when it resumed.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { typePlace } from '../testing/pickPlace.ts';
import { openWaiting } from '../testing/openWaiting.ts';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeEventTag } from '../core/eventTags.ts';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { openDepart, startExpedition as departStart } from '../testing/depart.ts';

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
  const jo = world.addPerson('jo@lantern.example', 'Jo');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: jo });
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, jo, 'player', ash);
  const clock = () => world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!;
  const requests = () => world.tables.requests;
  return { gm, sam, jo, campaign, wren, ash, clock, requests };
}

/** An invented creeping turn mode, and (when asked) the pack's dungeon-exit rule with a doom table. */
/** `exit`: the pack's dungeon-exit rule (true: the escape roll below), or none, or a rule of the test's own. */
function withSetting(campaign: string, gm: string, exit: boolean | Record<string, unknown> = true) {
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
    world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
  entry('rulesSet', 'fen-rules', 'Fen rules', {
    exploration: {
      modes: [{ id: 'creep', name: 'Creeping', step: { value: 1, unit: 'turn' }, procedure: [], checks: [] }],
    },
    ...(typeof exit === 'object'
      ? { dungeonExit: exit }
      : exit
      ? {
          dungeonExit: {
            roll: { save: 'nerve' },
            modifiers: [{ id: 'map', name: 'Has a map', value: 2 }],
            depth: { per: 1, value: -1 },
            onFail: { table: 'lost-below' },
            safePaths: 'Follow the chalk marks back.',
          },
        }
      : {}),
  });
  entry('table', 'lost-below', 'Lost below table', { die: 'd6', rows: [{ min: 1, max: 6, result: 'Bog lurkers find you' }] });
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
}

async function open(who: string, gm: boolean, section: 'Scene' | 'Players' = 'Scene') {
  world.signInAs(who);
  forgetCampaignSetting();
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
  await user.click(within(await screen.findByRole('navigation', { name: gm ? 'Campaign sections' : 'Main' })).getByRole('button', { name: new RegExp(`^${section}`) }));
  return user;
}

/** Switches device: the same table, another person. */
async function switchTo(who: string, gm: boolean, section: 'Scene' | 'Players' = 'Scene') {
  cleanup();
  return open(who, gm, section);
}

async function startExpedition(gm: string, campaign: string) {
  world.signInAs(gm);
  // The GM's Next turn, the turn count and "Leave the dungeon" show only while a session runs (st-1, st-2).
  await world.db.rpc('start_session', { campaign });
  await world.db.rpc('start_expedition', { campaign, mode_id: 'creep' });
}

const toastUndo = async (text: string) => within((await screen.findByText(text)).closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' });
const strip = () => within(screen.getByRole('region', { name: 'Time' }));
const menuItem = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('button', { name: 'Time options' }));
  await user.click(within(document.querySelector('.more-menu__panel') as HTMLElement).getByRole('button', { name }));
};

/** A line Wren's player sent to the GM before Describe… was removed (A5): the record stays as it was. */
async function sentEarlier(t: ReturnType<typeof table>, text: string) {
  world.signInAs(t.sam);
  const tag = encodeEventTag({ type: 'request.send', level: 'simple', requestId: crypto.randomUUID() });
  await world.db.rpc('send_request', { campaign: t.campaign, actor: t.wren, kind: 'describe', body: text, cost_text: '', prompt: {} }).setHeader('x-grimoire-command', tag);
}

describe('no Something else… and no Describe (A5)', () => {
  // Purpose: the players' Scene has no Something else… and no Describe, during an expedition and between them.
  it("the players' Scene has no Something else… and no Describe what you want to do", async () => {
    const t = table();
    withSetting(t.campaign, t.gm);
    await open(t.sam, false);
    // The players' top is the GM's band (S15): before the first session its heading says so (T3a).
    await screen.findByRole('heading', { name: 'No session yet' });
    expect(screen.queryByRole('button', { name: 'Something else…' })).toBeNull();
    cleanup();
    await startExpedition(t.gm, t.campaign);
    await open(t.sam, false);
    await screen.findByRole('heading', { name: 'Creeping, turn 1' });
    expect(screen.queryByRole('button', { name: 'Something else…' })).toBeNull();
    expect(screen.queryByText('Describe what you want to do')).toBeNull();
  });

  // Purpose: a line sent before the removal still shows to its player with Cancel, and Cancel withdraws it.
  it('a line sent earlier still shows on Scene with Cancel, and Cancel withdraws it', async () => {
    const t = table();
    await sentEarlier(t, 'Pry the loose stone');
    const user = await open(t.sam, false);
    const sent = within(await screen.findByRole('article', { name: 'Sent to the GM' }));
    expect(sent.getByText('“Pry the loose stone”')).toBeTruthy();
    await user.click(sent.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Sent to the GM' })).toBeNull());
    expect(t.requests()[0]!.status).toBe('withdrawn');
  });

  // Purpose: during an expedition the GM answers such a line Yes with no cost in turns: the clock doesn't move.
  it('the GM answers Yes with no cost in turns, so the clock stays put; Undo puts the request back', async () => {
    const t = table();
    withSetting(t.campaign, t.gm);
    await startExpedition(t.gm, t.campaign);
    await sentEarlier(t, 'Pry the loose stone');
    const user = await open(t.gm, true, 'Players');
    const waiting = within(await screen.findByRole('region', { name: 'Waiting for you' }));
    expect(waiting.getByText('Wren asks')).toBeTruthy();
    expect(waiting.queryByText('Cost in turns')).toBeNull();
    const before = Number(t.clock().seconds);
    await user.click(waiting.getByRole('button', { name: 'Yes' }));
    await user.click(await toastUndo('Yes to Wren'));
    expect(t.clock().seconds).toBe(before);
    await waitFor(() => expect(t.requests()[0]!.status).toBe('waiting'));
  });

  // Purpose: No is a quiet answer; the player reads "The GM says / No" with the note until Got it.
  it('No answers quietly: the player reads it with the note, and Got it hides it', async () => {
    const t = table();
    await sentEarlier(t, 'Climb the chimney');
    const gmUser = await open(t.gm, true, 'Players');
    const waiting = within(await screen.findByRole('region', { name: 'Waiting for you' }));
    await gmUser.type(waiting.getByLabelText('A note for them'), 'It is sealed');
    await gmUser.click(waiting.getByRole('button', { name: 'No' }));
    await screen.findByText('No to Wren');
    const user = await switchTo(t.sam, false);
    const answer = within(await screen.findByRole('article', { name: "The GM's answer" }));
    expect(answer.getByText('The GM says')).toBeTruthy();
    expect(answer.getByText('No')).toBeTruthy();
    expect(answer.getByText('It is sealed')).toBeTruthy();
    await user.click(answer.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: "The GM's answer" })).toBeNull());
  });
});

describe('Leave the dungeon', () => {
  // Purpose: without the pack's rule the GM's strip has no Leave button at all (not a disabled one).
  it('without a dungeon-exit rule there is no Leave the dungeon button', async () => {
    const t = table();
    withSetting(t.campaign, t.gm, false);
    await startExpedition(t.gm, t.campaign);
    await open(t.gm, true);
    await screen.findByRole('heading', { name: 'Creeping, turn 1' });
    expect(screen.queryByRole('button', { name: 'Leave the dungeon' })).toBeNull();
  });

  // Purpose: with the rule the button opens the dialog, and Ask for escape rolls makes one request per character.
  it('with the rule on, Ask for escape rolls creates one request for each player character', async () => {
    const t = table();
    withSetting(t.campaign, t.gm);
    await startExpedition(t.gm, t.campaign);
    const user = await open(t.gm, true);
    await screen.findByRole('heading', { name: 'Creeping, turn 1' });
    await user.click(await screen.findByRole('button', { name: 'Leave the dungeon' }));
    const dialog = within(await screen.findByRole('dialog', { name: /Leave the dungeon$/ }));
    // Purpose (S2/S3, st-8, page 16 T6b): the pack's safe-paths note is shown beside its button before any tap.
    expect(dialog.getByText('Follow the chalk marks back.')).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Ask for escape rolls' }));
    expect(await screen.findByText(/Asked for 2 escape rolls/)).toBeTruthy();
    expect(t.requests().map((r) => [r.kind, r.requester_id]).sort()).toEqual([['escapeRoll', t.jo], ['escapeRoll', t.sam]].sort());
    // Hidden means hidden: the players' rows carry the roll, switches and depth, never the pack's doom table or safe paths.
    for (const r of t.requests()) {
      expect(Object.keys(r.prompt as Record<string, unknown>).sort()).toEqual(['depth', 'levelsDown', 'modifiers', 'roll']);
      expect(JSON.stringify(r.prompt)).not.toContain('lost-below');
    }
  });

  /** Asks for the rolls, Sam enters 14 with the map, and the GM sends Wren's Lost below. */
  async function escapeLostBelow() {
    const t = table();
    withSetting(t.campaign, t.gm);
    await startExpedition(t.gm, t.campaign);
    const gmUser = await open(t.gm, true);
    await gmUser.click(await screen.findByRole('button', { name: 'Leave the dungeon' }));
    // The stepper starts at the first level (sq-1): one tap for the second.
    await gmUser.click(await screen.findByRole('button', { name: 'More levels below the first' }));
    await gmUser.click(await screen.findByRole('button', { name: 'Ask for escape rolls' }));
    await screen.findByText(/Asked for 2 escape rolls/);

    const user = await switchTo(t.sam, false);
    const roll = within(await screen.findByRole('article', { name: 'Leave the dungeon: your escape roll' }));
    expect(roll.getByText('1 level below the first: −1')).toBeTruthy();
    await user.click(roll.getByRole('switch', { name: 'Has a map (+2)' }));
    await user.type(roll.getByLabelText('What did you roll?'), '14');
    await user.click(roll.getByRole('button', { name: 'Enter roll' }));
    expect(await screen.findByText(/Sent to the GM, rolled 14/)).toBeTruthy();

    const gm2 = await switchTo(t.gm, true, 'Players');
    const waiting = within(await screen.findByRole('region', { name: 'Waiting for you' }));
    // S8a: one item is drawn whole, the others are rows: Wren's is opened first.
    await openWaiting(gm2, 'Wren, escape roll');
    expect(waiting.getByText('Rolled 14 +2 (Has a map) −1 (1 level below the first) = 15')).toBeTruthy();
    const mine = waiting.getByText('Wren, escape roll').closest('li') as HTMLElement;
    await gm2.click(within(mine).getByRole('button', { name: 'Lost below' }));
    await gm2.click(within(mine).getByRole('button', { name: 'Send' }));
    await screen.findByText('Sent Wren: lost below');
    return t;
  }

  // Purpose: the player enters a roll with the map and depth, the GM sees the sum and sends Lost below, and the
  // player sees "Lost below".
  it('the player enters the roll with modifiers and depth; the GM sees the total and sends Lost below; the player sees it', async () => {
    const t = await escapeLostBelow();
    await switchTo(t.sam, false);
    const answer = within(await screen.findByRole('article', { name: "The GM's answer" }));
    expect(answer.getByText('Lost below')).toBeTruthy();
  });

  // Purpose: sending Lost below opens the pack's "Lost below: <table>" dialog for the GM. The dialog is held by the
  // Waiting list, since the card leaves it as soon as the answer is saved (a bug the first run of this test caught).
  it('Send on Lost below opens the pack table dialog for the GM (the list holds the dialog, since the card leaves on Send)', async () => {
    await escapeLostBelow();
    expect(await screen.findByRole('dialog', { name: 'Lost below: Lost below table' })).toBeTruthy();
  });

  // C5, C6, C7 (M5 gate, ruled 2026-11-01).
  // Purpose: while a request waits, the GM's console shows "N waiting · Players ›", which opens Waiting for you; a
  // hireling's line says it leaves with its employer; the GM enters a roll for a player without a device.
  it('Waiting for you lists the two requests (no "2 waiting, Players ›" line any more); the card names the hireling who shares the result; Enter for Ash enters the roll as the GM', async () => {
    const t = table();
    withSetting(t.campaign, t.gm);
    const tobb = world.addCharacter(t.campaign, 'Tobb', { ownerId: t.sam });
    world.tables.actors.find((a) => a.id === tobb)!.kind = 'hireling';
    await startExpedition(t.gm, t.campaign);
    const user = await open(t.gm, true);
    expect(strip().queryByRole('button', { name: /waiting, Players ›/ })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Leave the dungeon' }));
    await user.click(await screen.findByRole('button', { name: 'More levels below the first' }));
    await user.click(await screen.findByRole('button', { name: 'Ask for escape rolls' }));
    await screen.findByText(/Asked for 2 escape rolls/);
    // A hireling is never asked (C6): one roll each for Wren and Ash.
    expect(t.requests()).toHaveLength(2);
    // Purpose (st-1, superseding the "N waiting, Players ›" line): the band has no such line; Waiting for you is
    // already on Scene and shows both requests.
    expect(strip().queryByRole('button', { name: /waiting, Players ›/ })).toBeNull();
    const waiting = within(await screen.findByRole('region', { name: 'Waiting for you' }));
    // S8a: both are listed, one drawn whole and the other a row ("1 of 2"); each is opened to be read.
    expect(waiting.getByText('1 of 2')).toBeTruthy();
    await openWaiting(user, 'Wren, escape roll');
    const wrens = waiting.getByText('Wren, escape roll').closest('li') as HTMLElement;
    expect(within(wrens).getByText('Tobb leaves with Wren and shares this result.')).toBeTruthy();
    await openWaiting(user, 'Ash, escape roll');
    const ashs = waiting.getByText('Ash, escape roll').closest('li') as HTMLElement;
    expect(within(ashs).queryByText(/shares this result/)).toBeNull();
    await user.click(within(ashs).getByRole('button', { name: 'Enter for Ash' }));
    const form = within(within(ashs).getByRole('article', { name: "Leave the dungeon: Ash’s escape roll" }));
    await user.type(form.getByLabelText('What did Ash roll?'), '12');
    await user.click(form.getByRole('button', { name: 'Enter roll' }));
    expect(await screen.findByText("Entered Ash’s roll")).toBeTruthy();
    const entered = t.requests().find((r) => r.requester_id === t.jo)!;
    expect(entered.entry).toEqual({ roll: 12, on: [] });
    expect(world.tables.events.filter((e) => e.type === 'request.enter').map((e) => e.actor_user_id)).toEqual([t.gm]);
    expect(await within(ashs).findByText('Rolled 12 −1 (1 level below the first) = 11')).toBeTruthy();
  });

  // Purpose: End expedition with the rule on offers the Leave dialog first; End without rolls ends it anyway.
  it('End expedition with the rule on opens the Leave dialog; End without rolls ends it', async () => {
    const t = table();
    withSetting(t.campaign, t.gm);
    await startExpedition(t.gm, t.campaign);
    const user = await open(t.gm, true);
    await screen.findByRole('heading', { name: 'Creeping, turn 1' });
    await menuItem(user, 'End expedition');
    const dialog = within(await screen.findByRole('dialog', { name: /Leave the dungeon$/ }));
    await user.click(dialog.getByRole('button', { name: 'End without rolls' }));
    expect(await screen.findByText('Expedition ended')).toBeTruthy();
    expect(world.tables.expeditions[0]!.ended_at).not.toBeNull();
  });

  // Purpose: the stepper counts the levels below the first (of-5, T3) and starts at 0, the first level (sq-1); its
  // line says so, and 1 means the second level, where the modifier starts.
  it('the depth stepper reads "levels below the first" and starts at 0', async () => {
    const t = table();
    withSetting(t.campaign, t.gm);
    await startExpedition(t.gm, t.campaign);
    const user = await open(t.gm, true);
    await user.click(await screen.findByRole('button', { name: 'Leave the dungeon' }));
    const dialog = within(await screen.findByRole('dialog', { name: /Leave the dungeon$/ }));
    expect(dialog.getByRole('group', { name: 'levels below the first' })).toBeTruthy();
    expect(dialog.getByText('0 levels below the first: no change')).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'More levels below the first' }));
    expect(dialog.getByText('1 level below the first: −1')).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'More levels below the first' }));
    expect(dialog.getByText('2 levels below the first: −2')).toBeTruthy();
  });

  // Purpose: a rule with no escape roll still offers Use safe paths (of-5, G-104): no roll asked, the pack's note shown.
  it('a dungeon-exit rule without a roll offers Use safe paths only', async () => {
    const t = table();
    withSetting(t.campaign, t.gm, { safePaths: 'Follow the chalk marks back.' });
    await startExpedition(t.gm, t.campaign);
    const user = await open(t.gm, true);
    await user.click(await screen.findByRole('button', { name: 'Leave the dungeon' }));
    const dialog = within(await screen.findByRole('dialog', { name: /Leave the dungeon$/ }));
    expect(dialog.getByText('Your rules have no escape roll: the party leaves by safe paths.')).toBeTruthy();
    expect(dialog.queryByRole('button', { name: 'Ask for escape rolls' })).toBeNull();
    expect(dialog.queryByRole('group', { name: 'levels below the first' })).toBeNull();
    // S2/S3 (st-8): the pack's note is shown before the tap, and the tap closes the sheet.
    expect(dialog.getByText('Follow the chalk marks back.')).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Use safe paths' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Leave the dungeon$/ })).toBeNull());
    expect(t.requests()).toEqual([]);
  });

  // Purpose: Use safe paths is logged (sq-2): one "expedition.safePaths" line when tapped, with a toast and Undo. Superseded
  // by st-8 (page 16, T6b): there is no "Hide safe paths" toggle any more; the tap logs once and closes the sheet.
  it('Use safe paths writes one log line with Undo', async () => {
    const t = table();
    withSetting(t.campaign, t.gm, { safePaths: 'Follow the chalk marks back.' });
    await startExpedition(t.gm, t.campaign);
    const user = await open(t.gm, true);
    await user.click(await screen.findByRole('button', { name: 'Leave the dungeon' }));
    const dialog = within(await screen.findByRole('dialog', { name: /Leave the dungeon$/ }));
    const lines = () => world.tables.events.filter((e) => e.type === 'expedition.safePaths');
    expect(dialog.queryByRole('button', { name: 'Hide safe paths' })).toBeNull();
    await user.click(dialog.getByRole('button', { name: 'Use safe paths' }));
    const toast = (await screen.findByText('Left by safe paths')).closest('.toast-host') as HTMLElement;
    expect(lines()).toHaveLength(1);
    expect(world.tables.expeditions[0]!.safe_paths).toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Leave the dungeon$/ })).toBeNull());
    // Once per expedition (sq-2): the door opened again and Use safe paths tapped again writes no second line.
    await user.click(await screen.findByRole('button', { name: 'Leave the dungeon' }));
    const again = within(await screen.findByRole('dialog', { name: /Leave the dungeon$/ }));
    await user.click(again.getByRole('button', { name: 'Use safe paths' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Leave the dungeon$/ })).toBeNull());
    expect(lines()).toHaveLength(1);
    // The toast's Undo (the strip has its own Undo too), taken from the toast the first use showed.
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.expeditions[0]!.safe_paths).toBe(false));
  });

  // Purpose: with no escape roll to ask for, End expedition ends at once (no Leave dialog in the way).
  it('End expedition with a no-roll rule ends at once', async () => {
    const t = table();
    withSetting(t.campaign, t.gm, { safePaths: 'Follow the chalk marks back.' });
    await startExpedition(t.gm, t.campaign);
    const user = await open(t.gm, true);
    await screen.findByRole('heading', { name: 'Creeping, turn 1' });
    await menuItem(user, 'End expedition');
    expect(await screen.findByText('Expedition ended')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Leave the dungeon' })).toBeNull();
  });
});

describe('Resumed mid-dungeon', () => {
  // Purpose: after End session and Start session mid-dungeon the strip says where and when the play resumed.
  it('a new session during an expedition reads "Resumed: <place>, turn N"', async () => {
    const t = table();
    withSetting(t.campaign, t.gm, false);
    const user = await open(t.gm, true);
    await user.click(await screen.findByRole('button', { name: 'Start session' }));
    await typePlace(user, 'The Drowned Stair', /^Where\?:/, await openDepart(user));
    await departStart(user);
    // The heading names the place and the count (st-1).
    await screen.findByRole('heading', { name: 'The Drowned Stair, turn 1' });
    await user.click(screen.getByRole('button', { name: 'Next turn' }));
    await screen.findByRole('heading', { name: 'The Drowned Stair, turn 2' });
    await menuItem(user, 'End session');
    // Said a moment ago (the stand-in's clock can't tell two taps in the same millisecond apart).
    for (const s of world.tables.sessions) s.started_at = new Date(Date.now() - 60_000).toISOString();
    for (const s of world.tables.sessions) if (s.ended_at) s.ended_at = new Date(Date.now() - 30_000).toISOString();
    // Purpose (st-2, superseding B7's fold): mid-dungeon the paused band shows Resume session in Next turn's place,
    // with no Next turn until it's tapped; the heading names the place without the count.
    const resume = await strip().findByRole('button', { name: 'Resume session' });
    expect(strip().queryByRole('button', { name: 'Next turn' })).toBeNull();
    expect(screen.queryByRole('heading', { name: /turn \d/ })).toBeNull();
    expect(screen.getAllByRole('heading', { name: 'The Drowned Stair' }).length).toBeGreaterThan(0);
    await user.click(resume);
    expect(await strip().findByText('Resumed: The Drowned Stair, turn 2.')).toBeTruthy();
    // Said once: the first advance of the session takes it away.
    await user.click(strip().getByRole('button', { name: 'Next turn' }));
    await waitFor(() => expect(strip().queryByText(/^Resumed:/)).toBeNull());
  });
});
