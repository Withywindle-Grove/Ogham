// @vitest-environment jsdom
// Click-through smoke tests: the real screens, driven like a person would, against a stand-in database.
import { forgetCampaignSetting } from './campaignSetting.ts';
import { BRAND } from '../brand.ts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, FAKE_EMAIL_CODE, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetFileLinks } from '../core/files.ts';
import { rememberInviteFromAddress } from './pendingInvite.ts';
import { ICON_SET } from '../ui/iconSet.ts';
import { openFullSheetFromMenu } from '../testing/openFullSheet.ts';
import { addItem, moveItem } from '../modules/inventory/inventory.ts';

// The pretend browser can't draw pictures, so shrinking a photo hands back a small stand-in file.
const shrink = vi.hoisted(() => ({ fail: null as string | null }));
vi.mock('./image.ts', async (original) => {
  const real = await original<typeof import('./image.ts')>();
  return {
    ...real,
    shrinkImage: async () => {
      if (shrink.fail) throw new real.PhotoError(shrink.fail);
      return new Blob(['a shrunk picture'], { type: 'image/jpeg' });
    },
  };
});

// The screens use the stand-in database passed to Root, never a real connection.
vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  shrink.fail = null;
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  sessionStorage.clear();
  localStorage.removeItem('grimoire.lastPlace');
  localStorage.removeItem('grimoire.packOpen');
  // The menu's fold starts at its default (folded, mn-1) in every test, whatever the one before chose.
  localStorage.removeItem('grimoire.navCollapsed');
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
});

function openApp() {
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  return user;
}

async function signIn(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(await screen.findByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Email me a code' }));
  await user.type(await screen.findByLabelText('Sign-in code'), FAKE_EMAIL_CODE);
}

/** Opens the ⋯ menu: the header's on Your campaigns, or the screen's top row (a Player screen's is "Character options"). */
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.queryByRole('button', { name: 'Character options' }) ?? screen.getByRole('button', { name: 'Account and device options' }));
}

/** Taps a log line (found by how it starts) to show its actions. */
async function openLine(user: ReturnType<typeof userEvent.setup>, line: string) {
  const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${escaped}`) }));
}

/** From a Player screen, ⋯ → Your characters: the list of the player's characters. */
/**
 * The Player screen's hit points in place (ruled 2026-11-08): tap − or + `amount` times, then the figure, which sends
 * the burst at once (no two-second wait), and close the typing Sheet it opens.
 */
async function changeHp(user: ReturnType<typeof userEvent.setup>, amount: number, heal = false) {
  const square = await screen.findByRole('button', { name: heal ? 'Heal 1' : 'Take 1 damage' });
  for (let i = 0; i < amount; i++) await user.click(square);
  // Tapping the number sends the burst. Under a loaded full run the burst may already be sending on its own timer, and
  // the busy figure ignores that tap (busyGuard), so tap again until the sheet opens.
  await vi.waitFor(async () => {
    if (!screen.queryByRole('dialog', { name: 'Hit points' })) await user.click(screen.getByRole('button', { name: /^Hit points .*\. Type a value$/ }));
    expect(screen.getByRole('dialog', { name: 'Hit points' })).toBeTruthy();
  }, { timeout: 5000 });
  await user.click(within(screen.getByRole('dialog', { name: 'Hit points' })).getByRole('button', { name: 'Cancel' }));
}

/** The GM's campaign opens on Scene (ruled 2026-10-29); this taps the Players tab. */
async function gmPlayers(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
}

async function openYourCharacters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Character options' }));
  await user.click(screen.getByRole('button', { name: 'Your characters' }));
}

/** Picks a race or class on its step (M5b step 0c): tick the row's checkbox, then Next. */
/** Picks a row and goes on: a one-of-many Pick moves on by itself (ct-1); an N-of-many step waits for Next. */
async function pickOption(user: { click: (el: Element) => Promise<void> }, name: string) {
  const title = () => screen.getAllByRole('heading', { level: 1 })[0]?.textContent;
  const before = (await screen.findByRole('checkbox', { name: `Pick ${name}` })) && title();
  await user.click(screen.getByRole('checkbox', { name: `Pick ${name}` }));
  if (title() === before) await user.click(screen.getByRole('button', { name: 'Next' }));
}

/** Steps the proposed starting level to a number (B21: a stepper under "Player proposes, GM approves"). */
async function stepLevelTo(user: { click: (el: Element) => Promise<void> }, n: number) {
  const group = within(screen.getByRole('group', { name: 'starting level' }));
  for (let guard = 0; guard < 25; guard++) {
    const now = Number(group.getByRole('status').textContent);
    if (now === n) return;
    await user.click(group.getByRole('button', { name: now < n ? 'More starting level' : 'Less starting level' }));
  }
  throw new Error(`Couldn't step the level to ${n}`);
}

/** What is left, as Gear's coin line says it (cs-22: "100 rolled, 22 gp spent: 78 gp left") and as the shop's top does ("78 gp to spend"). */
const coin = () => document.querySelector('.gear-coin .average-stepper__line')?.textContent ?? '';
const shopLeft = () => document.querySelector('.gear-tally__money')?.textContent ?? '';
describe('signing in', () => {
  it('a new person signs in with the emailed code, chooses a name once, and lands on Your campaigns', async () => {
    const user = openApp();
    await user.type(await screen.findByLabelText('Email'), 'wren@lantern.example');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeTruthy();
    expect(screen.getByText('wren@lantern.example')).toBeTruthy();
    expect(world.codesSentTo).toEqual(['wren@lantern.example']);

    // The sixth digit signs in; no need to tap Sign in.
    await user.type(screen.getByLabelText('Sign-in code'), FAKE_EMAIL_CODE);
    const name = await screen.findByLabelText('Your name');
    // P25: the box asks for a table name, so a browser's autofill doesn't put the email in it.
    expect([name.getAttribute('autocomplete'), name.getAttribute('name')]).toEqual(['nickname', 'table-name']);
    await user.clear(name);
    await user.type(name, 'Wren');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Your campaigns' })).toBeTruthy();
    expect(await screen.findByText(/No campaigns yet/)).toBeTruthy();

    // Sign out from the ⋯ menu, then back in: the name isn't asked again.
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await signIn(user, 'wren@lantern.example');
    expect(await screen.findByRole('heading', { name: 'Your campaigns' })).toBeTruthy();
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('a wrong code shows a plain message and clears the box', async () => {
    const user = openApp();
    await user.type(await screen.findByLabelText('Email'), 'wren@lantern.example');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    const code = await screen.findByLabelText('Sign-in code');
    await user.type(code, '000000');

    expect((await screen.findByRole('alert')).textContent).toMatch(/didn't work/);
    expect((code as HTMLInputElement).value).toBe('');
  });

  it('"Send a new code" waits for the countdown: still tappable, it says why in a sheet and sends nothing (never disabled)', async () => {
    const user = openApp();
    await user.type(await screen.findByLabelText('Email'), 'wren@lantern.example');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));

    const resend = await screen.findByRole('button', { name: /Send a new code \(\d+s\)/ });
    expect((resend as HTMLButtonElement).disabled).toBe(false);
    const sent = world.codesSentTo.length;
    await user.click(resend);
    const sheet = await screen.findByRole('dialog', { name: 'Wait a moment' });
    // Worded without the number, which would stand still while the button's countdown runs (review, #561).
    expect(sheet.textContent).toContain('A new code can be sent when the countdown on the button ends. The last code still works until then.');
    expect(world.codesSentTo.length).toBe(sent);
  });
});

describe('your campaigns', () => {
  it('lists each campaign with its role line, opens one, and comes back', async () => {
    const me = world.addPerson('wren@lantern.example', 'Wren');
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.addCampaign('The Ash Barrows', me);
    const delve = world.addCampaign('The Reedmouth Delve', gm);
    const wren = world.addCharacter(delve, 'Wren of the Lantern Wardens', {
      ownerId: me,
      companyName: 'The Sluice Gate Company',
    });
    world.addMember(delve, me, 'player', wren);
    world.signInAs(me);

    const user = openApp();
    const rows = await screen.findAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('The Ash BarrowsGM, No players yet'),
      expect.stringContaining('The Reedmouth DelvePlayer, Wren of the Lantern Wardens, The Sluice Gate Company'),
    ]);

    await user.click(within(rows[1]!).getByRole('button'));
    // A player gets their own page, never the GM's Campaign screen.
    expect(screen.queryByRole('button', { name: 'Invite a player' })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Wren of the Lantern Wardens' })).toBeTruthy();
    // The company is the level block's since dec-13 C2 (the head is the portrait and the statuses); the campaign is the bar's link.
    expect(await screen.findByText('The Sluice Gate Company')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '‹ The Reedmouth Delve' }));
    expect(await screen.findByRole('heading', { name: 'Your campaigns' })).toBeTruthy();
  });

  it('starting a campaign needs a name, then opens it with you as GM', async () => {
    world.signInAs(world.addPerson('wren@lantern.example', 'Wren'));
    const user = openApp();

    await user.click(await screen.findByRole('button', { name: '+ Start a new campaign (as GM)' }));
    await user.click(screen.getByRole('button', { name: 'Create campaign now' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Give the campaign a name.');

    await user.type(screen.getByLabelText('Campaign name'), 'The Lantern Road');
    await user.click(screen.getByRole('button', { name: 'Create campaign now' }));
    await gmPlayers(user);
    expect(await screen.findByRole('heading', { name: 'The Lantern Road' })).toBeTruthy();
    expect(await screen.findByText('No players yet. Invite someone to get started.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '‹ Your campaigns' }));
    expect(await screen.findByText('The Lantern Road')).toBeTruthy();
  });
});

describe("the GM's Campaign screen", () => {
  it('a GM invites a player right after creating the campaign, copies the link, and can revoke it', async () => {
    world.signInAs(world.addPerson('priya@lantern.example', 'Priya'));
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: '+ Start a new campaign (as GM)' }));
    await user.type(screen.getByLabelText('Campaign name'), 'The Lantern Road');
    await user.click(screen.getByRole('button', { name: 'Create campaign now' }));
    await gmPlayers(user);

    // Leaving the Players tab closes an open invite form (M4b re-test, 2026-10-26).
    await user.click(await screen.findByRole('button', { name: 'Invite a player' }));
    await user.click(screen.getByRole('button', { name: 'Rules' }));
    await user.click(screen.getByRole('button', { name: /^Players/ }));
    expect(screen.queryByText("We don't email invites yet. Copy or share the link.")).toBeNull();

    await user.click(await screen.findByRole('button', { name: 'Invite a player' }));
    // Until emailed invites exist, the form says so (the note is only a reminder for the GM).
    expect(screen.getByText("We don't email invites yet. Copy or share the link.")).toBeTruthy();
    await user.type(screen.getByLabelText("Who's it for? (optional)"), 'For Wren');
    await user.click(screen.getByRole('button', { name: 'Make invite link' }));

    const link = await screen.findByText(/\/join\/[A-Z2-9]{8}$/);
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await navigator.clipboard.readText()).toBe(link.textContent);
    expect(screen.getByRole('status').textContent).toBe('Link copied.');

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('For Wren')).toBeTruthy();
    const code = link.textContent!.slice(-8);
    await user.click(screen.getByRole('button', { name: `Revoke ${code}` }));
    await vi.waitFor(() => expect(screen.queryByText('For Wren')).toBeNull());
  });

  // Purpose (page 32, M3a and M3b; pg32-match, 2026-11-21): a character's row reads "Wren, level 1" over its player's
  // name and when they joined, with no "(active)"; a character waiting for approval is not a row, only in Waiting for
  // approval.
  it("lists each player's characters by name and level over the player's line; a waiting one only in Waiting for approval", async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const wrenPlayer = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: wrenPlayer });
    world.addCharacter(campaign, 'Hollis', { ownerId: wrenPlayer, approval: 'pending' });
    world.addMember(campaign, wrenPlayer, 'player', wren);
    world.signInAs(gm);

    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    // One line per character, each naming its player (ruled 2026-10-26).
    const row = (await screen.findByText('Wren', { selector: '.gm__row-name' })).closest('li')!;
    expect(row.querySelector('.gm__row-main')!.textContent).toMatch(/^Wren, level 1Sam, joined /);
    expect(screen.queryByText(/\(active\)/)).toBeNull();
    expect(screen.queryByText(/Hollis \(waiting for approval\)/)).toBeNull();
    expect(await screen.findByText('New character waiting: Hollis')).toBeTruthy();
  });

  function waitingCharacter(hpMax: number | null = 5) {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, player, 'player');
    const hollis = world.addCharacter(campaign, 'Hollis', { ownerId: player, approval: 'pending' });
    const row = world.tables.actors.find((actor) => actor.id === hollis)!;
    row.level = 2;
    row.hp_max = hpMax;
    row.backstory = 'Raised by lock-keepers.';
    return { gm, player };
  }

  it("the GM approves a waiting character at the player's level, and it becomes the player's active character", async () => {
    const { gm, player } = waitingCharacter(null);
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);

    expect(await screen.findByText('New character waiting: Hollis')).toBeTruthy();
    expect(screen.getByText('Raised by lock-keepers.')).toBeTruthy();
    // A6: the review card reads like the player's review: who they are (with the level) first, then the rest.
    expect(screen.getByText('From Sam, freeform')).toBeTruthy();
    expect(screen.getByText('Level 2')).toBeTruthy();
    // HP isn't asked at approval (ruled 2026-10-24).
    expect(screen.queryByLabelText('HP max')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Hollis approved at level 2.')).toBeTruthy();
    await vi.waitFor(() => expect(screen.getByText('Hollis', { selector: '.gm__row-name' }).closest('li')!.textContent).toContain('Sam, joined'));
    const member = world.tables.members.find((m) => m.user_id === player)!;
    expect(world.tables.actors.find((a) => a.id === member.active_actor_id)).toMatchObject({ level: 2, hp_max: null });
  });

  it('a guided character’s review shows its class, race, scores with what was rolled, starting gear and "Over by" (ruled 2026-10-25)', async () => {
    const { gm } = waitingCharacter();
    const campaign = world.tables.campaigns[0]!.id as string;
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push(
      { id: 'entry-warden', pack_id: 'pack-fen', kind: 'class', pack_entry_id: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden', name: 'Lantern Warden' } },
      { id: 'entry-marsh', pack_id: 'pack-fen', kind: 'race', pack_entry_id: 'marsh-folk', name: 'Marsh folk', data: { id: 'marsh-folk', name: 'Marsh folk' } },
      { id: 'entry-rules', pack_id: 'pack-fen', kind: 'rulesSet', pack_entry_id: 'fen-rules', name: 'Fen rules', data: { id: 'fen-rules', name: 'Fen rules', currency: [{ key: 'gp', label: 'Gold', valueInBase: 10 }, { key: 'sp', label: 'Silver', valueInBase: 1 }] } },
    );
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
    const hollis = world.tables.actors.find((a) => a.name === 'Hollis')!;
    Object.assign(hollis, {
      classes: [{ classRef: 'lantern-warden', level: 2, xp: 0 }],
      race_ref: 'marsh-folk',
      creation: { method: 'split', rolled: { STR: 14, DEX: 9 }, scores: { STR: 16, DEX: 9 }, startingMoney: 10, moneyCoin: { key: 'gp', valueInBase: 10 }, spentBase: 105 },
    });
    world.tables.inventory_lines.push({ id: 'line-lamp', campaign_id: campaign, actor_id: hollis.id, location_id: null, library_entry_id: null, name: 'Reed lamp', category: 'light', weight_coin: null, slots: null, stack: 1, qty: 2, container_line_id: null, equipped: false, how_got: 'bought', cost: '', notes: '', item_data: {}, source_pack_id: null, source_entry_id: null, charges_left: null, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null, pinned: false, at_hand_hidden: false, approval: 'approved', per_units: 1, created_at: '2026-10-23T10:00:00Z' });
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    expect(await screen.findByText('From Sam, guided')).toBeTruthy();
    expect(await screen.findByText('Lantern Warden, Marsh folk')).toBeTruthy();
    // Scores once, the changed one marked with what was rolled; gear; going over the money is a broken rule.
    expect(screen.getByText('STR 16, DEX 9')).toBeTruthy();
    expect(screen.getByText(', rolled 14', { exact: false })).toBeTruthy();
    expect(await screen.findByText('Reed lamp ×2')).toBeTruthy();
    expect(screen.getByText('10 rolled, 10 gp 5 sp spent: 5 sp over.')).toBeTruthy();
    expect(screen.getByText('Over by 5 sp: it becomes 0 when play starts')).toBeTruthy();
  });

  it('"Ask for a different level" sends the character back at that level, HP to enter again', async () => {
    const { gm } = waitingCharacter();
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    await user.click(await screen.findByRole('button', { name: 'Ask for a different level' }));
    await user.selectOptions(screen.getByLabelText('Ask for level'), '1');
    await user.click(screen.getByRole('button', { name: 'Ask for level 1' }));
    await screen.findByText(/Sent back to Sam/);
    expect(world.tables.actors.find((a) => a.name === 'Hollis')).toMatchObject({ approval: 'rejected', level: 1, hp_max: null, review_note: 'Your GM asks for level 1.' });
  });

  it('the GM sends a character back with a note and a ticked section; the player sees it marked, fixes it, and sends it again', async () => {
    const { gm, player } = waitingCharacter();
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    await user.click(await screen.findByRole('button', { name: 'Send back' }));
    await user.click(within(screen.getByRole('group', { name: 'What needs work (optional)' })).getByRole('button', { name: 'Backstory' }));
    await user.type(screen.getByLabelText('Note for Sam (optional)'), 'Pick a river-town name.');
    await user.click(screen.getByRole('button', { name: 'Send back' }));
    expect(await screen.findByText(/Sent back to Sam with a note/)).toBeTruthy();
    expect(world.tables.actors.find((a) => a.owner_user_id === player)!.review_sections).toEqual(['story']);

    // The player's turn.
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await signIn(user, 'wren@lantern.example');
    expect(await screen.findByText('Player, Hollis (sent back)')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /The Ash Barrows/ }));
    // B18: the card opens full screen on the review, the GM's note pinned; a section opens its step.
    await user.click(await screen.findByRole('button', { name: 'Open Hollis' }));
    expect(within(screen.getByRole('complementary', { name: 'Note from your GM' })).getByText('Pick a river-town name.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Who they are/ }));
    const name = within(screen.getByRole('dialog')).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Hollis of Reedmouth');
    await stepLevelTo(user, 1);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    // The ticked section is marked; until it changes, Resend explains (and could resend anyway).
    expect(screen.getByRole('button', { name: /^Backstory.*Your GM asks for a change/ })).toBeTruthy();
    // cs-53 (22-G5's words on today's screen): the GM's note is headed "Your GM asks for a change", with the sign.
    expect(screen.getByRole('complementary', { name: 'Note from your GM' }).querySelector('.pinned-note__from')?.textContent).toBe(' Your GM asks for a change');
    await user.click(screen.getAllByRole('button', { name: 'Send to the GM' })[0]!);
    const asked = within(await screen.findByRole('dialog', { name: '1 thing still to do' }));
    expect(asked.getByText('Backstory: your GM asks for a change.')).toBeTruthy();
    expect(asked.getByRole('button', { name: 'Send anyway' })).toBeTruthy();
    await user.click(asked.getByRole('button', { name: 'Fix backstory' }));
    await user.type(screen.getByLabelText('Backstory (optional)'), ' Grew up on the ferry.');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(screen.getAllByRole('button', { name: 'Send to the GM' })[0]!);
    expect(await screen.findByText("Level 1, waiting for your GM's approval.")).toBeTruthy();
    expect(world.tables.actors.find((a) => a.owner_user_id === player)).toMatchObject({
      name: 'Hollis of Reedmouth',
      level: 1,
      approval: 'pending',
    });
  });

  // 22-G5: under the GM's note sent back, its author line: the GM's chosen name, "your GM", and the day ("today").
  it('sent back: the note carries its author line, "<GM name>, your GM, today"', async () => {
    const { gm } = waitingCharacter();
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    await user.click(await screen.findByRole('button', { name: 'Send back' }));
    await user.type(screen.getByLabelText('Note for Sam (optional)'), 'Pick a river-town name.');
    await user.click(screen.getByRole('button', { name: 'Send back' }));
    expect(await screen.findByText(/Sent back to Sam with a note/)).toBeTruthy();
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await signIn(user, 'wren@lantern.example');
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Hollis' }));
    const note = screen.getByRole('complementary', { name: 'Note from your GM' });
    expect(await within(note).findByText('Priya, your GM, today')).toBeTruthy();
  });

  // nm-1: a GM who never chose a name: the author line never shows the front of their email; it reads "Your GM, today".
  it('sent back by a GM with no chosen name: the author line never shows the front of an email', async () => {
    const { gm } = waitingCharacter();
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    await user.click(await screen.findByRole('button', { name: 'Send back' }));
    await user.type(screen.getByLabelText('Note for Sam (optional)'), 'Pick a river-town name.');
    await user.click(screen.getByRole('button', { name: 'Send back' }));
    expect(await screen.findByText(/Sent back to Sam with a note/)).toBeTruthy();
    Object.assign(world.tables.profiles.find((p) => p.id === gm)!, { display_name: 'priya.quill', named_at: null });
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await signIn(user, 'wren@lantern.example');
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Hollis' }));
    const note = screen.getByRole('complementary', { name: 'Note from your GM' });
    expect(await within(note).findByText('Your GM, today')).toBeTruthy();
    expect(note.textContent).not.toContain('priya.quill');
  });
});

describe('invites', () => {
  function campaignWithInvite() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addInvite(campaign, 'K7QM2XPA');
  }

  it('a typed code shows the campaign and GM; joining leads to making a character for the GM to approve', async () => {
    campaignWithInvite();
    world.signInAs(world.addPerson('wren@lantern.example', 'Sam'));
    const user = openApp();

    await user.type(await screen.findByLabelText('Have an invite code?'), 'k7qm 2xpa');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByRole('heading', { name: 'The Ash Barrows' })).toBeTruthy();
    expect(screen.getByText('GM: Priya')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByRole('heading', { name: 'Who are they?' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Give your character a name.');

    await user.type(screen.getByLabelText('Name'), 'Hollis');
    await stepLevelTo(user, 2);
    // HP isn't asked unless a sheet layout requires it (ruled 2026-10-24).
    expect(screen.queryByLabelText(/HP max|Hit points/)).toBeNull();
    await user.type(screen.getByLabelText('Backstory (optional)'), 'Raised by lock-keepers.');
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    expect(await screen.findByRole('heading', { name: 'Hollis is ready' })).toBeTruthy();
    expect(screen.getByText('Sent to the GM for approval.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Back to The Ash Barrows' }));
    expect(await screen.findByText("Level 2, waiting for your GM's approval.")).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '‹ The Ash Barrows' }));
    expect(await screen.findByText('Player, Hollis (waiting for approval)')).toBeTruthy();
  });

  it('a wrong code says the invite was not found', async () => {
    world.signInAs(world.addPerson('wren@lantern.example', 'Wren'));
    const user = openApp();

    await user.type(await screen.findByLabelText('Have an invite code?'), 'NOPE2345');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByRole('heading', { name: 'Invite not found' })).toBeTruthy();
  });

  it("an invite link opened while signed out keeps its code through sign-in", async () => {
    campaignWithInvite();
    world.addPerson('wren@lantern.example', 'Wren');
    window.history.replaceState(null, '', '/join/K7QM2XPA');
    rememberInviteFromAddress();
    expect(window.location.pathname).toBe('/');

    const user = openApp();
    expect(await screen.findByText(/Sign in to join with invite code/)).toBeTruthy();
    await signIn(user, 'wren@lantern.example');
    expect(await screen.findByRole('heading', { name: 'The Ash Barrows' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join' })).toBeTruthy();
  });

  it('a player who joined but left before making a character is offered to make one', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    world.signInAs(me);

    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    expect(await screen.findByRole('heading', { name: 'Who are they?' })).toBeTruthy();
  });

  it('Back on "How do you want to make them?" leaves the player at "No character yet", with Create your character', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByText('No one is in the ledger yet. Make your first character.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create your character' })).toBeTruthy();
  });

  it('with approval off and "Level 1", a new character starts at level 1 and joins the party at once (ruled 2026-10-25)', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { characterApproval: false, startLevel: 'one' } });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    expect(await screen.findByText('You start at level 1.')).toBeTruthy();
    expect(screen.getByText('Everyone starts at the beginning.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'starting level' })).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Add to the party' }));
    expect(await screen.findByText('They’ve joined the party.')).toBeTruthy();
    const reed = world.tables.actors.find((a) => a.name === 'Reed')!;
    expect(reed).toMatchObject({ approval: 'approved', level: 1 });
    expect(world.tables.members.find((m) => m.user_id === me)?.active_actor_id).toBe(reed.id);
  });

  // B21 (ruled 2026-10-25): the GM sets one level; the player sees it, with no picker.
  it('"Fixed level": the GM picks Fixed level and steps it to 4; a new character says "You start at level 4."', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    world.signInAs(gm);
    let user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: /^Characters/ }));
    const start = within(await screen.findByRole('radiogroup', { name: 'New characters start at' }));
    await user.click(start.getByRole('radio', { name: /^Fixed level/ }));
    // The level sits right under "Fixed level", before the next choice (re-test 2026-10-26).
    const more = await start.findByRole('button', { name: 'More fixed starting level' });
    expect(start.getByRole('radio', { name: /^Fixed level/ }).compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(more.compareDocumentPosition(start.getByRole('radio', { name: /^Player proposes/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (let i = 0; i < 3; i++) await user.click(await start.findByRole('button', { name: 'More fixed starting level' }));
    await waitFor(() => expect(world.tables.campaigns.find((c) => c.id === campaign)!.settings).toMatchObject({ startLevel: 'fixed', startLevelFixed: 4 }));
    cleanup();

    world.signInAs(me);
    user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    expect(await screen.findByText('You start at level 4.')).toBeTruthy();
    expect(screen.getByText('The level set for this campaign. Your GM approves it.')).toBeTruthy();
  });

  it("\"Party's lowest\" starts at and allows up to the lowest approved, active character's level", async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const jo = world.addPerson('ash@lantern.example', 'Jo');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    const ash = world.addCharacter(campaign, 'Ash', { ownerId: jo });
    Object.assign(world.tables.actors.find((a) => a.id === ash)!, { level: 3 });
    Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { startLevel: 'lowest' } });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    expect(await screen.findByText('You start at level 3.')).toBeTruthy();
    expect(screen.getByText('The level of the lowest active character. Your GM approves it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send to the GM' })).toBeTruthy();
  });

  it('guided creation: method, scores, race, class (greyed with the reason), adjustments, then the form, filled in (ruled 2026-10-25)', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    // The setting names its abilities (N3): STR reads "Strength" wherever it shows.
    entry('rulesSet', 'fen-rules', 'Fen rules', { abilities: [{ key: 'STR', short: 'Strength', name: 'Strength' }, 'DEX', 'CON'], abilityAdjustment: 'Lower STR by 2 to raise DEX by 1.' });
    entry('option', 'kin-and-calling', 'Kin and calling', {
      ruleKey: 'creation-method',
      default: 'either',
      choices: [
        { id: 'classic', name: 'Calling is kin', races: 'none' },
        { id: 'split', name: 'Kin and calling', races: 'required' },
        { id: 'either', name: "Player's choice", methods: ['classic', 'split'] },
      ],
    });
    entry('class', 'lantern-warden', 'Lantern Warden', { creationMethods: ['classic', 'split'] });
    entry('class', 'bog-strider', 'Bog strider', { creationMethods: ['split'], requirements: { STR: 13 } });
    entry('race', 'marsh-folk', 'Marsh folk', { abilityModifiers: { DEX: 1 }, classMaxLevels: { 'lantern-warden': 8, 'bog-strider': 6 } });
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
    world.tables.field_definitions.push({ id: 'field-str', campaign_id: campaign, applies_to: 'pc', key: 'STR', label: 'Strength', type: 'number', choices: [], field_group: 'Abilities', sort_order: 0, show_on_card: false, hidden: false, created_at: '2026-10-18T12:00:00Z' });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await pickOption(user, 'Kin and calling');
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.type(screen.getByRole('textbox', { name: 'DEX' }), '9');
    await user.type(screen.getByRole('textbox', { name: 'CON' }), '10');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // The race is required for this method: no "No race".
    expect(screen.queryByRole('button', { name: 'No race' })).toBeNull();
    await pickOption(user, 'Marsh folk');
    // Rewritten for m5b-0c (ruled 2026-11-02): an unmet class requirement stays a pickable row with the special-approval note.
    expect((await screen.findByRole('button', { name: /^Bog strider/ })).closest('.pick-row')!.textContent).toContain("Needs the GM's special approval");
    // The setting's adjustment rule is prose, so there is no adjust step: Next goes to "Who are they?".
    await pickOption(user, 'Lantern Warden');

    // Rewritten for m5b-0c slice 3: "Who they are" on the shell; the class line with Change is gone (Back reaches it).
    expect(await screen.findByRole('heading', { name: 'Who they are' })).toBeTruthy();
    // The scores were set in the steps before: kept, not shown again (ruled 2026-10-26).
    expect(screen.queryByLabelText('Strength')).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // A draft the GM doesn't see; the review comes last, with Send to the GM (ruled 2026-10-26).
    expect(await screen.findByRole('region', { name: 'Reed' })).toBeTruthy();
    expect(world.tables.actors.find((a) => a.name === 'Reed')).toMatchObject({ approval: 'draft' });
    await user.click(screen.getAllByRole('button', { name: 'Send to the GM' })[0]!);
    expect(await screen.findByText('Sent Reed to your GM.')).toBeTruthy();
    expect(world.tables.actors.find((a) => a.name === 'Reed')).toMatchObject({
      approval: 'pending',
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
      race_ref: 'marsh-folk',
      creation: { method: 'split', rolled: { STR: 12, DEX: 9, CON: 10 } },
      // Rewritten for m5b-0c: no trade by hand, so the score stays as rolled.
      fields: { STR: 12 },
    });
  });

  /** Guided creation up to the race step, in an invented setting with two races and maybe a default one. */
  async function toRaceStep(defaultRace?: string) {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, me, 'player');
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('rulesSet', 'fen-rules', 'Fen rules', { abilities: ['STR'], ...(defaultRace ? { defaultRace } : {}) });
    entry('class', 'lantern-warden', 'Lantern Warden', {});
    entry('race', 'marsh-folk', 'Marsh folk', {});
    entry('race', 'river-kin', 'River kin', {});
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'STR' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Race' });
    return user;
  }

  it('guided creation: without a default race in the setting, a race must be picked (ruled 2026-10-26)', async () => {
    await toRaceStep();
    expect(screen.queryByRole('button', { name: /^Use / })).toBeNull();
  });

  it("guided creation: the setting's default race can be taken by skipping the pick (ruled 2026-10-26)", async () => {
    const user = await toRaceStep('river-kin');
    // Rewritten for m5b-0c: the quiet button names the default race; there is no aria-describedby note any more.
    await user.click(screen.getByRole('button', { name: 'Use River kin' }));
    expect(await screen.findByRole('heading', { name: 'Class' })).toBeTruthy();
  });

  /** An invented setting with fill hooks, and a sheet layout linking a field to a save (ruled 2026-10-25). */
  function fillWorld() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const me = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('rulesSet', 'fen-rules', 'Fen rules', {
      // The setting names its abilities (N3): STR reads "Strength" wherever it shows.
      abilities: [{ key: 'STR', short: 'Strength', name: 'Strength' }],
      abilityModifiers: { STR: [{ range: '3-8', melee: -1 }, { range: '9-18', melee: 0 }] },
      saveCategories: [{ key: 'R', name: 'Save vs river' }],
    });
    entry('class', 'lantern-warden', 'Lantern Warden', {
      progression: [
        { level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 } },
        { level: 3, hitDice: '3d8', thac0: 18, saves: { R: 11 } },
      ],
    });
    entry('hook', 'fill-level', 'fill-level', { kind: 'fill', when: 'levelUp', from: 'classProgression', target: ['hitDice', 'attack', 'saves'] });
    entry('hook', 'fill-mods', 'fill-mods', { kind: 'fill', when: 'abilityScoreChanged', from: 'abilityModifiers', target: 'abilityModifiers' });
    entry('fieldTemplate', 'fen-sheet', 'fen-sheet', { appliesTo: 'pc', fields: [{ key: 'STR', label: 'Strength', type: 'number' }, { key: 'saveR', label: 'River', type: 'number', fill: 'saves.R' }] });
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, overrides: {}, priority: 1 });
    const field = (key: string, label: string, order: number, fill: string | null = null) =>
      world.tables.field_definitions.push({ id: `field-${key}`, campaign_id: campaign, applies_to: 'pc', key, label, type: 'number', choices: [], field_group: 'Abilities', sort_order: order, show_on_card: false, hidden: false, fill, created_at: '2026-10-18T12:00:00Z' });
    field('STR', 'Strength', 0);
    // Made from the sheet layout, so it carries the layout's link.
    field('saveR', 'River', 1, 'saves.R');
    return { gm, me, campaign };
  }

  // A9 (M4b gate 2026-10-25): Next did nothing for a score out of range and never said why.
  it('Next on the scores says what is wrong: a missing score, or one outside what the setting covers', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    // Rewritten for m5b-0c: the words are "<label> is missing" / "<label> must be 3–18", in the hint and as a toast.
    expect((await screen.findAllByText('Strength is missing')).length).toBeGreaterThan(0);
    await user.type(screen.getByRole('textbox', { name: 'Strength' }), '25');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect((await screen.findAllByText('Strength must be 3–18')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Scores' })).toBeTruthy();
  });

  // A5 (ruled 2026-10-25; words batch 1). Rewritten for m5b-0c slice 3 (cr-12): alignment as option rows with the
  // pack's notes; the ✓ slot or the row picks it.
  it('guided creation asks alignment as option rows with the pack\'s notes, picked from the ✓ slot or the row', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    world.tables.field_definitions.push({ id: 'field-alignment', campaign_id: campaign, applies_to: 'pc', key: 'alignment', label: 'Alignment', type: 'list', choices: ['Lawful', 'Neutral', 'Chaotic'], field_group: '', sort_order: 6, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await pickOption(user, 'Lantern Warden');
    const alignment = within(await screen.findByRole('group', { name: 'Alignment' }));
    // The row's text opens its entry (ct3-11); Pick at its foot picks.
    await user.click(alignment.getByText('Neutral', { selector: '.pick-row__name' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Neutral' })).getByRole('button', { name: 'Pick Neutral' }));
    expect(alignment.getByRole('checkbox', { name: 'Pick Neutral' }).getAttribute('aria-checked')).toBe('true');
    await user.click(alignment.getByRole('checkbox', { name: 'Pick Chaotic' }));
    expect(alignment.getByRole('checkbox', { name: 'Pick Chaotic' }).getAttribute('aria-checked')).toBe('true');
    expect(alignment.getByRole('checkbox', { name: 'Pick Neutral' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('Name missing');
  });

  // A5 (ruled 2026-10-25): what the setting decides is filled in and not asked; it follows the level chosen.
  it('guided creation fills a linked field from the class at the level chosen, without asking for it', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await pickOption(user, 'Lantern Warden');
    await screen.findByRole('heading', { name: 'Who they are' });
    expect(screen.queryByLabelText('River')).toBeNull();
    await stepLevelTo(user, 3);
    await user.type(screen.getByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click((await screen.findAllByRole('button', { name: 'Send to the GM' }))[0]!);
    await screen.findByText('Sent Reed to your GM.');
    expect(world.tables.actors.find((a) => a.name === 'Reed')).toMatchObject({ fields: { STR: 12, saveR: 11 } });
  });

  it('when a sheet layout requires HP, guided creation asks for it from the class dice; starting money is asked on the Gear step and kept; both rolls are recorded', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    const rules = world.tables.library_entries.find((e) => e.id === 'entry-fen-rules')!;
    rules.data = { ...(rules.data as object), startingMoney: '3d6 × 10 coins' };
    const warden = world.tables.library_entries.find((e) => e.id === 'entry-lantern-warden')!;
    warden.data = { ...(warden.data as object), hitDie: 'd8', languages: ['Reedspeak'] };
    world.tables.field_definitions.push({ id: 'field-languages', campaign_id: campaign, applies_to: 'pc', key: 'languages', label: 'Languages', type: 'text', choices: [], field_group: '', sort_order: 5, show_on_card: false, hidden: false, fill: null, required: false, created_at: '2026-10-18T12:00:00Z' });
    Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { hpRequired: true } });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await pickOption(user, 'Lantern Warden');

    // Rewritten for m5b-0c slice 3 (cr-12): the roll is typed and the hit points are worked out beside it; final
    // drafts C: a Roll row, and the average prefilled until the roll is entered.
    expect(await screen.findByText('Roll 1d8 for hit points and enter it.')).toBeTruthy();
    // The money moved to the Gear step (slice 5), and Languages has its own step: neither is a box here.
    expect(screen.queryByRole('textbox', { name: 'Starting coin' })).toBeNull();
    expect(screen.queryByLabelText('Languages')).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Reed');
    await user.clear(screen.getByRole('textbox', { name: 'Hit points' }));
    await user.type(screen.getByRole('textbox', { name: 'Hit points' }), '9');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect((await screen.findAllByText('1d8 gives 1–8: type what the dice showed.')).length).toBeGreaterThan(0);
    await user.clear(screen.getByRole('textbox', { name: 'Hit points' }));
    await user.type(screen.getByRole('textbox', { name: 'Hit points' }), '6');
    expect(screen.getByText('6 rolled: 6 hit points')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // Then Gear, with the money roll to type.
    expect(await screen.findByRole('heading', { name: 'Gear' })).toBeTruthy();
    // Starting coin starts at the usual (cw-11); the player rolled 110 and types it.
    expect(screen.getByText('Average')).toBeTruthy();
    await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '110');
    await waitFor(() => expect(coin()).toBe('110 rolled'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // Rewritten for m5b-0c slice 6 (cr-15): with nothing more to pick there is no languages step; the class's
    // language goes straight onto the sheet.
    await user.click((await screen.findAllByRole('button', { name: 'Send to the GM' }))[0]!);
    expect(screen.queryByRole('heading', { name: 'Languages' })).toBeNull();
    await screen.findByText('Sent Reed to your GM.');
    expect(world.tables.actors.find((a) => a.name === 'Reed')).toMatchObject({ hp_max: 6, creation: { startingMoney: 110, spentBase: 0, gearDone: true }, fields: { languages: 'Reedspeak' } });
    // A draft's rolls stay visible, labelled with the draft (ruled 2026-10-26).
    expect(world.tables.rolls.map((r) => [r.expression, r.result, r.purpose, r.label])).toEqual([
      // The label as saved on the roll: its old form, " · " kept (#561).
      ['1d8', 6, 'hp', 'draft · Reed'],
      ['3d6 × 10 coins', 110, 'money', 'draft · Reed'],
    ]);
  });

  it('Gear: take the class kit and buy an item; "Gold to spend" follows; what can\'t be afforded is answered; Next checks overspending; the spend is kept and reopens from the review', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    const rules = world.tables.library_entries.find((e) => e.id === 'entry-fen-rules')!;
    rules.data = { ...(rules.data as object), startingMoney: '2d6 gp', currency: [{ key: 'gp', label: 'Gold', valueInBase: 10 }, { key: 'sp', label: 'Silver', valueInBase: 1 }] };
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('item', 'reed-lamp', 'Reed lamp', { category: 'light', value: { gp: 2 } });
    entry('item', 'eel-spear', 'Eel spear', { category: 'weapon', value: { gp: 7, sp: 5 } });
    entry('startingKit', 'warden-kit', "Warden's kit", { classIds: ['lantern-warden'], items: [{ itemId: 'reed-lamp', qty: 2 }], costGp: 3 });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await pickOption(user, 'Lantern Warden');
    await user.type(await screen.findByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // A paid kit with the coin cleared answers instead of being taken.
    await user.clear(await screen.findByRole('textbox', { name: 'Starting coin' }));
    await user.click(screen.getByRole('checkbox', { name: "Pick Warden's kit" }));
    expect((await screen.findAllByText('Type your starting money first.')).length).toBeGreaterThan(0);
    await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '10');
    await waitFor(() => expect(coin()).toBe('10 rolled'));
    // The kit row: its contents in one line, its cost.
    const kitRow = screen.getByRole('button', { name: /^Warden's kit/ }).closest('.pick-row') as HTMLElement;
    expect(kitRow.textContent).toContain('Reed lamp ×2');
    expect(kitRow.textContent).toContain('3 gp');
    await user.click(screen.getByRole('checkbox', { name: "Pick Warden's kit" }));
    await waitFor(() => expect(coin()).toBe('10 rolled, 3 gp spent: 7 gp left'));
    expect(screen.getByRole('checkbox', { name: "Pick Warden's kit" }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('1 kit, nothing bought');
    // The shop: 7 gp 5 sp is more than what's left, so Add answers (never greyed) and nothing is bought.
    await user.click(screen.getByRole('button', { name: 'Open The shop' }));
    expect(screen.getByRole('heading', { name: 'Shop' })).toBeTruthy();
    await user.type(screen.getByLabelText('Search items'), 'eel');
    await user.click(screen.getByRole('button', { name: 'Buy Eel spear, 7 gp 5 sp' }));
    expect((await screen.findAllByText('5 sp short.')).length).toBeGreaterThan(0);
    await waitFor(() => expect(shopLeft()).toBe('7 gp to spend'));
    await user.click(screen.getByRole('button', { name: 'Done shopping' }));
    // Lowering the money below what's spent: Next explains.
    await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '2');
    await waitFor(() => expect(coin()).toBe('2 rolled, 3 gp spent: 1 gp over.'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect((await screen.findAllByText('1 gp short: put something back, or Decide later.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Gear' })).toBeTruthy();
    await user.clear(screen.getByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '10');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // The review: Gear reopens the shopping with what was taken (ruled 2026-10-26).
    expect(await screen.findByRole('region', { name: 'Reed' })).toBeTruthy();
    const reed = world.tables.actors.find((a) => a.name === 'Reed')!;
    expect(reed.creation).toMatchObject({ startingMoney: 10, spentBase: 30, moneyCoin: { key: 'gp', valueInBase: 10 }, gearDone: true });
    // The review's Change › on Gear (cr-18).
    await user.click(await screen.findByRole('button', { name: 'Change Gear' }));
    await waitFor(() => expect(coin()).toBe('10 rolled, 3 gp spent: 7 gp left'));
    expect(screen.getByRole('checkbox', { name: "Pick Warden's kit" }).getAttribute('aria-checked')).toBe('true');
    // Before approval, putting something bought back refunds its full price (ruled 2026-10-26).
    await user.click(screen.getByRole('button', { name: 'Open The shop' }));
    await user.type(screen.getByLabelText('Search items'), 'lamp');
    await user.click(screen.getByRole('button', { name: 'Buy Reed lamp, 2 gp' }));
    await waitFor(() => expect(shopLeft()).toBe('5 gp to spend'));
    await user.click(screen.getByRole('button', { name: 'Done shopping' }));
    await user.click(await screen.findByRole('button', { name: 'Put back Reed lamp, 2 gp back' }));
    await waitFor(() => expect(coin()).toBe('10 rolled, 3 gp spent: 7 gp left'));
    expect(screen.queryByRole('button', { name: /^Put back Reed lamp/ })).toBeNull();
    // Bought and put back: nothing changed since Gear opened from the review, so Next reads Back to review (creation
    // follow-up, 2026-11-07).
    await user.click(screen.getAllByRole('button', { name: 'Back to review' }).at(-1)!);
    await user.click((await screen.findAllByRole('button', { name: 'Send to the GM' }))[0]!);
    await screen.findByText('Sent Reed to your GM.');
    expect(world.tables.actors.find((a) => a.name === 'Reed')).toMatchObject({ approval: 'pending', creation: { spentBase: 30 } });
    expect(world.tables.inventory_lines.filter((l) => l.actor_id === reed.id).map((l) => [l.name, l.qty, l.how_got, l.cost])).toEqual([
      ['Reed lamp', 2, 'bought', "Warden's kit"],
    ]);
  });

  // Re-test 2026-10-26: only one kit was ever offered. A rolled kit asks what was rolled at the table (the app never
  // rolls) and adds the rows tapped (cr-14: ranges first). Class kits only (cw-9).
  it('starting kits: a rolled kit is taken once every roll is tapped', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    const rules = world.tables.library_entries.find((e) => e.id === 'entry-fen-rules')!;
    rules.data = { ...(rules.data as object), startingMoney: '2d6 gp', currency: [{ key: 'gp', label: 'Gold', valueInBase: 1 }] };
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('item', 'reed-lamp', 'Reed lamp', { category: 'light', value: { gp: 2 } });
    entry('item', 'quilted-coat', 'Quilted coat', { category: 'armour', value: { gp: 9 } });
    entry('item', 'hooked-staff', 'Hooked staff', { category: 'weapon', value: { gp: 1 } });
    entry('startingKit', 'warden-kit', "Warden's kit", { classIds: ['lantern-warden'], items: [{ itemId: 'reed-lamp', qty: 1 }], costGp: 3 });
    entry('startingKit', 'fen-kit', "Fen walker's kit", {
      classIds: ['lantern-warden'],
      items: [{ itemId: 'reed-lamp', qty: 2 }],
      classItems: 'A charm of your choosing',
      rolls: [
        { name: 'Armour', die: 'd6', times: 1, rows: [{ min: 1, max: 3, items: [] }, { min: 4, max: 6, items: [{ itemId: 'quilted-coat', qty: 1 }] }] },
        { name: 'Weapons', die: 'd4', times: 2, rows: [{ min: 1, max: 4, items: [{ itemId: 'hooked-staff', qty: 1 }] }] },
      ],
    });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await pickOption(user, 'Lantern Warden');
    await user.type(await screen.findByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.clear(await screen.findByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '10');

    // Both kits (both are the class's, cw-9); the other one is free, and its entry lists its rolls and what it names in words.
    const kits = within(screen.getByRole('group', { name: /^To choose/ }));
    expect(kits.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label')).sort()).toEqual(["Pick Fen walker's kit", "Pick Warden's kit"]);
    // Purpose: a kit with no price has no price line, never "Free" (follow-up E, nit 3); a priced one shows its price.
    expect(screen.getByRole('button', { name: /^Fen walker's kit/ }).closest('.pick-row')!.textContent).not.toContain('Free');
    expect(screen.getByRole('button', { name: /^Warden's kit/ }).closest('.pick-row')!.textContent).toMatch(/\d+ gp/);
    // Its line (cw-11): what it always holds (no blurb), then how many rolls.
    expect(screen.getByRole('button', { name: /^Fen walker's kit/ }).closest('.pick-row')!.textContent).toContain('Reed lamp ×2. 3 rolls');
    await user.click(screen.getByRole('button', { name: /^Fen walker's kit/ }));
    const sheet = within(await screen.findByRole('dialog', { name: "Fen walker's kit" }));
    // Each roll in the entry with its die (retest 2): "Armour: d6", "Weapons: d4, twice".
    expect(sheet.getByText('Armour: d6')).toBeTruthy();
    expect(sheet.getByText('Weapons: d4, twice')).toBeTruthy();
    expect(sheet.getByText('A charm of your choosing')).toBeTruthy();
    await user.keyboard('{Escape}');
    // Pick opens the Roll sequence (cw-11): a roll made twice is one step with two taps (retest 2), and the same row can
    // be tapped both times.
    await user.click(screen.getByRole('checkbox', { name: "Pick Fen walker's kit" }));
    const rolls = within(await screen.findByRole('dialog', { name: "Fen walker's kit" }));
    expect(rolls.getByText('Roll 1 of 2')).toBeTruthy();
    await user.click(rolls.getByRole('radio', { name: /^4 to 6 Quilted coat/ }));
    await user.click(rolls.getByRole('button', { name: 'Next' }));
    expect(rolls.getByText('Roll 2 of 2')).toBeTruthy();
    await user.click(rolls.getByRole('radio', { name: /^1 to 4 Hooked staff/ }));
    await user.click(rolls.getByRole('radio', { name: /^1 to 4 Hooked staff/ }));
    // Rolled twice: ✓✓ on the row, no count in words (R3-8, retest 4 T3; phone test 2026-11-09).
    expect(rolls.getByRole('radio', { name: /^1 to 4 Hooked staff/ }).textContent).toBe('1 to 4 Hooked staff✓✓');
    expect(rolls.getByRole('radio', { name: /^1 to 4 Hooked staff/ }).getAttribute('aria-checked')).toBe('true');
    const reed = world.tables.actors.find((a) => a.name === 'Reed')!;
    expect(world.tables.inventory_lines.filter((l) => l.actor_id === reed.id)).toEqual([]);
    // Done on the last step takes the kit.
    await user.click(rolls.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: "Pick Fen walker's kit" }).getAttribute('aria-checked')).toBe('true'));
    await waitFor(() =>
      expect(world.tables.inventory_lines.filter((l) => l.actor_id === reed.id).map((l) => [l.name, l.qty])).toEqual([
        ['Reed lamp', 2],
        ['Quilted coat', 1],
        ['Hooked staff', 1],
        ['Hooked staff', 1],
      ]),
    );
    await waitFor(() => expect(coin()).toMatch(/^10 rolled/));
    // Change: the kit's entry, then the armour roll's own Change; a different row puts the kit back and takes it again.
    await user.click(screen.getByRole('button', { name: "Change Fen walker's kit" }));
    const kitEntry = within(await screen.findByRole('dialog', { name: "Fen walker's kit" }));
    await user.click(kitEntry.getByRole('button', { name: 'Change Armour' }));
    const again = within(await screen.findByRole('dialog', { name: "Fen walker's kit" }));
    await user.click(again.getByRole('radio', { name: /^1 to 3 nothing/ }));
    await user.click(again.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(world.tables.inventory_lines.filter((l) => l.actor_id === reed.id).map((l) => l.name)).toEqual(['Reed lamp', 'Hooked staff', 'Hooked staff']));
  });

  // Ruled 2026-10-26: a kit's things land where Add item would put them; the kit's entry groups them by place (cr-14).
  it('starting kits: things land worn, in hand, or in the backpack; what the class can\'t use goes in the backpack, and the entry says why', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    const rules = world.tables.library_entries.find((e) => e.id === 'entry-fen-rules')!;
    rules.data = { ...(rules.data as object), startingMoney: '2d6 gp', currency: [{ key: 'gp', label: 'Gold', valueInBase: 1 }] };
    const warden = world.tables.library_entries.find((e) => e.kind === 'class' && e.pack_entry_id === 'lantern-warden')!;
    warden.data = { ...(warden.data as object), armourAllowed: { types: ['light'], shields: true } };
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('item', 'backpack', 'Backpack', { category: 'container', container: { capacity: 40 } });
    entry('item', 'plate-coat', 'Plate coat', { category: 'armour', slot: 'armour', armourType: 'plate', value: { gp: 5 } });
    entry('item', 'quilted-coat', 'Quilted coat', { category: 'armour', slot: 'armour', armourType: 'light' });
    entry('item', 'hooked-staff', 'Hooked staff', { category: 'weapon', slot: 'hand', hands: 2 });
    entry('item', 'round-shield', 'Round shield', { category: 'armour', slot: 'shield' });
    entry('item', 'reed-lamp', 'Reed lamp', { category: 'light' });
    entry('startingKit', 'delver-kit', "Delver's kit", {
      items: [
        { itemId: 'plate-coat', qty: 1 },
        { itemId: 'quilted-coat', qty: 1 },
        { itemId: 'hooked-staff', qty: 1 },
        { itemId: 'round-shield', qty: 1 },
        { itemId: 'reed-lamp', qty: 2 },
        { itemId: 'backpack', qty: 1 },
      ],
    });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await pickOption(user, 'Lantern Warden');
    await user.type(await screen.findByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.clear(await screen.findByRole('textbox', { name: 'Starting coin' }));
    await user.type(screen.getByRole('textbox', { name: 'Starting coin' }), '10');

    // The row opens the kit's entry: where each thing lands, and why (the class check needs the character read first).
    await user.click(screen.getByRole('button', { name: /^Delver's kit/ }));
    const sheet = within(await screen.findByRole('dialog', { name: "Delver's kit" }));
    expect(await sheet.findByText("Plate coat goes in the backpack: Lantern Warden can't use Plate coat.")).toBeTruthy();
    // The book format's labelled lines (dec-10 S3): the label, then its value on the same line.
    const groups = [...document.querySelectorAll('[role="dialog"] .book-label')].map((label) => [label.textContent, label.parentElement?.textContent?.slice((label.textContent ?? '').length + 1)]);
    expect(groups.filter(([label]) => ['Worn and held', 'Carried', 'In the backpack'].includes(label ?? ''))).toEqual([
      ['Worn and held', 'Quilted coat, Hooked staff'],
      ['Carried', 'Backpack'],
      ['In the backpack', 'Plate coat, Round shield, Reed lamp ×2'],
    ]);
    await user.click(sheet.getByRole('button', { name: "Pick Delver's kit" }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: "Pick Delver's kit" }).getAttribute('aria-checked')).toBe('true'));
    const reed = world.tables.actors.find((a) => a.name === 'Reed')!;
    const lines = world.tables.inventory_lines.filter((l) => l.actor_id === reed.id);
    const backpack = lines.find((l) => l.name === 'Backpack')!;
    expect(lines.map((l) => [l.name, l.qty, l.equipped, l.container_line_id === null ? null : l.container_line_id === backpack.id ? 'backpack' : '?'])).toEqual([
      ['Backpack', 1, false, null],
      ['Plate coat', 1, false, 'backpack'],
      ['Quilted coat', 1, true, null],
      ['Hooked staff', 1, true, null],
      ['Round shield', 1, false, 'backpack'],
      ['Reed lamp', 2, false, 'backpack'],
    ]);
    // Each went in through the logged command.
    expect(world.tables.events.filter((e) => e.type === 'inventory.add').length).toBe(6);
    // In the shop, an item the class may not use is listed and says so, "A <class> can't use it." (cs-21); Buy still works (cr-14).
    await user.click(screen.getByRole('button', { name: 'Open The shop' }));
    await user.type(screen.getByLabelText('Search items'), 'plate');
    const plate = screen.getByRole('button', { name: 'Buy Plate coat, 5 gp' }).closest('li')!;
    expect(plate.textContent).toContain("A Lantern Warden can't use it.");
  });

  it('starting kits: class kits only (cw-9): another class kit is not offered, even with an old "Any class can take any kit" value stored', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { anyKit: true } });
    const rules = world.tables.library_entries.find((e) => e.id === 'entry-fen-rules')!;
    rules.data = { ...(rules.data as object), startingMoney: '2d6 gp', currency: [{ key: 'gp', label: 'Gold', valueInBase: 1 }] };
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('item', 'reed-lamp', 'Reed lamp', { category: 'light', value: { gp: 2 } });
    entry('startingKit', 'warden-kit', "Warden's kit", { classIds: ['lantern-warden'], items: [{ itemId: 'reed-lamp', qty: 1 }], costGp: 3 });
    entry('startingKit', 'fen-kit', "Fen walker's kit", { classIds: ['someone-else'], items: [{ itemId: 'reed-lamp', qty: 2 }] });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await pickOption(user, 'Lantern Warden');
    await user.type(await screen.findByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('checkbox', { name: "Pick Warden's kit" })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: "Pick Fen walker's kit" })).toBeNull();
  });

  // Rewritten for m5b-0c slice 7 (cr-18): a draft reopens on the review (Save and leave resumes there); Gear is one
  // Change › away and comes back to it.
  it('a draft left in the shopping is kept: Your characters says it is not sent yet, and it reopens on the review, Gear one tap away', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    const rules = world.tables.library_entries.find((e) => e.id === 'entry-fen-rules')!;
    rules.data = { ...(rules.data as object), startingMoney: '2d6 gp', currency: [{ key: 'gp', label: 'Gold', valueInBase: 10 }] };
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'draft' });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }], creation: { method: 'split', rolled: {}, scores: {}, startingMoney: 8 } });
    world.signInAs(me);
    const user = openApp();
    expect(await screen.findByText('Player, Reed (not sent yet)')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /The Ash Barrows/ }));
    expect(await screen.findByText('Not sent yet, tap to continue')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open Reed' }));
    await user.click(await screen.findByRole('button', { name: 'Change Gear' }));
    await waitFor(() => expect(coin()).toBe('8 rolled'));
    // Nothing changed since it opened from the review: Next reads Back to review (creation follow-up, 2026-11-07).
    await user.click(screen.getAllByRole('button', { name: 'Back to review' }).at(-1)!);
    await user.click(await screen.findByRole('button', { name: 'Send to the GM' }));
    expect(await screen.findByText("Level 1, waiting for your GM's approval.")).toBeTruthy();
    expect(world.tables.actors.find((a) => a.id === reed)).toMatchObject({ approval: 'pending', creation: { spentBase: 0 } });
  });

  // M4b re-test, bug 1 (ruling 7): a tap on Gear before the setting was read said "can't be changed here"; Gear must
  // open the shopping; and Resend after shopping must send (it did nothing), landing on the campaign with a toast.
  it('a sent-back character: Gear opens the shopping straight away; after buying, Resend sends it and lands with a toast', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    const rules = world.tables.library_entries.find((e) => e.id === 'entry-fen-rules')!;
    rules.data = { ...(rules.data as object), startingMoney: '2d6 gp', currency: [{ key: 'gp', label: 'Gold', valueInBase: 10 }] };
    world.tables.library_entries.push({ id: 'entry-reed-lamp', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'reed-lamp', name: 'Reed lamp', data: { id: 'reed-lamp', name: 'Reed lamp', category: 'light', value: { gp: 2 } } });
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'rejected' });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, {
      review_note: 'A lamp, please.',
      review_sections: ['gear'],
      fields: { STR: 12 },
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
      creation: { method: null, rolled: { STR: 12 }, scores: { STR: 12 }, startingMoney: 8, spentBase: 0, gearDone: true },
    });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Reed' }));
    // The first tap, straight away: the shopping, never "can't be changed here".
    await user.click(await screen.findByRole('button', { name: /^Gear/ }));
    await waitFor(() => expect(coin()).toBe('8 rolled'));
    expect(screen.queryByText(/can't be changed here/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open The shop' }));
    await user.type(screen.getByLabelText('Search items'), 'reed');
    await user.click(screen.getByRole('button', { name: 'Buy Reed lamp, 2 gp' }));
    await waitFor(() => expect(shopLeft()).toBe('6 gp to spend'));
    await user.click(screen.getByRole('button', { name: 'Done shopping' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click((await screen.findAllByRole('button', { name: 'Send to the GM' }))[0]!);
    await waitFor(() => expect(world.tables.actors.find((a) => a.id === reed)).toMatchObject({ approval: 'pending' }));
    // Ruling 6 / A6: the player lands on the campaign, and the toast says it went.
    expect(await screen.findByText('Sent Reed to your GM again.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Reed' })).toBeNull();
  });

  // M4b re-test, bug 2 (ruling 6): sending a draft reopened from Your characters landed without the toast.
  it('a draft sent from Your characters lands on the campaign (the active character) with "Sent … to your GM."', async () => {
    const { me, campaign } = fillWorld();
    const ash = world.addCharacter(campaign, 'Ash', { ownerId: me });
    world.addMember(campaign, me, 'player', ash);
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'draft' });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { fields: { STR: 12 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }], creation: { method: null, rolled: { STR: 12 }, scores: { STR: 12 } } });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(screen.getByRole('button', { name: 'Your characters' }));
    await user.click(await screen.findByRole('button', { name: 'Open Reed' }));
    await user.click((await screen.findAllByRole('button', { name: 'Send to the GM' }))[0]!);
    expect(await screen.findByText('Sent Reed to your GM.')).toBeTruthy();
    // On the campaign: Ash's Player screen, not Your characters.
    await waitFor(() => expect(screen.queryByRole('button', { name: '+ Make another character' })).toBeNull());
    expect(screen.getAllByText('Ash').length).toBeGreaterThan(0);
  });

  // Purpose: a player who already plays Ash creates Reed, who joins at once; the toast offers "Play as Reed", Ash stays active until it's tapped, and tapping it makes Reed active as Your characters does (walk fix, ruled 2026-11-12).
  it('a second character that joins at once offers "Play as <name>" on its toast; tapping it makes that one active', async () => {
    const { me, campaign } = fillWorld();
    Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { characterApproval: false } });
    const ash = world.addCharacter(campaign, 'Ash', { ownerId: me });
    world.addMember(campaign, me, 'player', ash);
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'draft' });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { fields: { STR: 12 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }], creation: { method: null, rolled: { STR: 12 }, scores: { STR: 12 } } });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(screen.getByRole('button', { name: 'Your characters' }));
    await user.click(await screen.findByRole('button', { name: 'Open Reed' }));
    await user.click((await screen.findAllByRole('button', { name: 'Add to the party' }))[0]!);
    expect(await screen.findByText('Reed has joined the party.')).toBeTruthy();
    await waitFor(() => expect(world.tables.actors.find((a) => a.id === reed)).toMatchObject({ approval: 'approved' }));
    // Nothing changes by itself: Ash is still the one played.
    const member = () => world.tables.members.find((m) => m.user_id === me && m.campaign_id === campaign)!;
    expect(member().active_actor_id).toBe(ash);
    await user.click(await screen.findByRole('button', { name: 'Play as Reed' }));
    await waitFor(() => expect(member().active_actor_id).toBe(reed));
    expect(await screen.findByText('Reed is now your active character.')).toBeTruthy();
  });

  // Purpose: a player's first character becomes active by itself, so its toast offers no "Play as" (walk fix, ruled 2026-11-12).
  it('a first character that joins at once has no "Play as" on its toast', async () => {
    const { me, campaign } = fillWorld();
    Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { characterApproval: false } });
    world.addMember(campaign, me, 'player');
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'draft' });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { fields: { STR: 12 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }], creation: { method: null, rolled: { STR: 12 }, scores: { STR: 12 } } });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Reed' }));
    await user.click((await screen.findAllByRole('button', { name: 'Add to the party' }))[0]!);
    expect(await screen.findByText('Reed has joined the party.')).toBeTruthy();
    await waitFor(() => expect(world.tables.members.find((m) => m.user_id === me && m.campaign_id === campaign)?.active_actor_id).toBe(reed));
    expect(screen.queryByRole('button', { name: /^Play as/ })).toBeNull();
  });

  // M4b re-test, bugs 3 and 7: literacy wasn't shown (hidden as filled), languages had no line when the scores add
  // none, and an older layout's Race field stayed blank (it should hold the race chosen, and not be asked).
  // Rewritten for m5b-0c slice 3 (cr-12): literacy is a Derived field now, shown read-only, never asked.
  // Rewritten for m5b-0c slice 6 (cr-12, cr-15): the languages belong to their own step, so they're never a field here.
  it('guided "Who they are": literacy is never asked (a Derived field, shown only with a value), languages are not asked, and a Race field holds the race chosen, unasked', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    world.tables.library_entries.push({ id: 'entry-reedfolk', pack_id: 'pack-fen', kind: 'race', pack_entry_id: 'reedfolk', name: 'Reedfolk', data: { id: 'reedfolk', name: 'Reedfolk' } });
    const def = (key: string, label: string, order: number, fill: string | null) =>
      world.tables.field_definitions.push({ id: `field-${key}`, campaign_id: campaign, applies_to: 'pc', key, label, type: 'text', choices: [], field_group: 'Identity', sort_order: order, show_on_card: false, hidden: false, fill, required: false, created_at: '2026-10-18T12:00:00Z' });
    def('race', 'Race', 7, null);
    def('languages', 'Languages', 8, null);
    def('literacy', 'Literacy', 9, 'abilityModifiers.STR.literacy');
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await pickOption(user, 'Reedfolk');
    await pickOption(user, 'Lantern Warden');
    await screen.findByRole('heading', { name: 'Who they are' });
    expect(screen.queryByLabelText('Literacy')).toBeNull();
    // Only the fields with a value (ct-5): one here, and the note says more come (no "—" tile).
    expect(screen.getByText('Derived values')).toBeTruthy();
    expect(screen.getByText('1 figure the rules work out, more as you pick gear')).toBeTruthy();
    // The River save has a value; literacy has none in this setting's STR row, so it isn't a tile (never "—").
    expect(screen.getByRole('button', { name: 'River' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Literacy' })).toBeNull();
    expect(screen.queryByLabelText('Languages')).toBeNull();
    expect(screen.queryByText('Your race and class languages are filled in; your scores add none.')).toBeNull();
    expect(screen.queryByLabelText('Race')).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findAllByRole('button', { name: 'Send to the GM' });
    expect(world.tables.actors.find((a) => a.name === 'Reed')!.fields).toMatchObject({ race: 'Reedfolk' });
  });

  // M4b re-test, bug 4: on a phone the class detail sheet had no way out to look at another.
  // Rewritten for m5b-0c: the sheet has Pick at its foot and Close; there is no "Back to the list" any more.
  it('the class row opens its entry as a sheet with Pick at its foot; Close returns to the list', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('button', { name: /^Lantern Warden/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Lantern Warden' }));
    expect(sheet.getByRole('button', { name: 'Pick Lantern Warden' })).toBeTruthy();
    // The sheet is a Dialog with no Close button of its own (contract said there is one); Escape closes it.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('group', { name: 'Classes' })).toBeTruthy();
  });

  // M4b re-test, bug 5: a score could drop below the class's minimum unmarked and without a reason for the GM.
  // Rewritten for m5b-0c: nothing is lowered by hand now; an unmet requirement is shown on the row, and Next explains it.
  it('an unmet class requirement (ruled 2026-11-02): the row shows the shortfall in bold and the special-approval note, Next goes on, and the review and the record flag it for the GM', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    const warden = world.tables.library_entries.find((e) => e.id === 'entry-lantern-warden')!;
    warden.data = { ...(warden.data as object), requirements: { STR: 13 } };
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '12');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    const row = (await screen.findByRole('button', { name: /^Lantern Warden/ })).closest('.pick-row') as HTMLElement;
    expect(row.textContent).toContain('you have 12');
    expect(row.querySelector('strong, b')?.textContent).toBe('12');
    expect(row.textContent).toContain("Needs the GM's special approval");
    await user.click(screen.getByRole('checkbox', { name: 'Pick Lantern Warden' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Who they are' });
    await user.type(screen.getByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // Final drafts D: the review's last card lists every exception under the sign.
    expect(within(await screen.findByRole('region', { name: "1 thing needs the GM's special approval" })).getByText('Lantern Warden')).toBeTruthy();
    expect(world.tables.actors.find((a) => a.name === 'Reed')!.creation).toMatchObject({ specialApprovals: [{ step: 'class', entryId: 'lantern-warden', name: 'Lantern Warden', requirement: 'Lantern Warden needs Strength 13, you have 12' }] });
  });

  // M4b re-test, bugs 6 and 15: no Back from "Who are they?"; Change beside the class went to the start; freeform had
  // no way back to choose Guided.
  // Rewritten for m5b-0c: this setting's adjustment rule is prose, so there is no adjust step; Back lands on the class.
  // Rewritten for m5b-0c slice 3: Change beside the class is gone (the shell's Back reaches it; the review gets Change ›);
  // what was typed on "Who they are" is kept through Back and Next.
  it('"Who they are" has Back to the class (still picked) and keeps what was typed; freeform goes back to the choice', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.click(await screen.findByRole('button', { name: /^Freeform/ }));
    await screen.findByRole('heading', { name: 'Who are they?' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: /^Guided/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Strength' }), '13');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await pickOption(user, 'Lantern Warden');
    await screen.findByRole('heading', { name: 'Who they are' });
    await user.type(screen.getByLabelText('Name'), 'Reed');
    await user.click(screen.getByRole('button', { name: 'Back to the step before' }));
    expect((await screen.findByRole('checkbox', { name: 'Pick Lantern Warden', checked: true })).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Who they are' });
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Reed');
  });

  // M4b re-test, bug 12: opening a character from Your characters took several taps; anywhere on the card opens it.
  it('a tap anywhere on a character card opens it, not only on the name', async () => {
    const { me, campaign } = fillWorld();
    const ash = world.addCharacter(campaign, 'Ash', { ownerId: me });
    world.addCharacter(campaign, 'Reed', { ownerId: me });
    world.addMember(campaign, me, 'player', ash);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(screen.getByRole('button', { name: 'Your characters' }));
    const card = (await screen.findByRole('button', { name: 'Open Reed' })).closest('.character-card') as HTMLElement;
    await user.click(card);
    await waitFor(() => expect(world.tables.members.find((m) => m.user_id === me)?.active_actor_id).not.toBe(ash));
  });

  it('a guided character asked for a different level: the sent-back form fills the linked values for it (unless edited) and asks HP again', async () => {
    const { me, campaign } = fillWorld();
    world.addMember(campaign, me, 'player');
    Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { hpRequired: true } });
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me, approval: 'rejected' });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, {
      level: 3,
      hp_max: null,
      review_note: 'Your GM asks for level 3.',
      fields: { STR: 12, saveR: 12 },
      classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }],
      creation: { method: null, rolled: { STR: 12 }, scores: { STR: 12 } },
      edited_fields: [],
    });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Open Reed' }));
    expect(await screen.findByText('Your GM asks for level 3.')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('River: 11')).toBeTruthy());
    // Resend stays tappable; what the GM asked for is explained (words batch 1, §8), with a way to fix it.
    await user.click(screen.getAllByRole('button', { name: 'Send to the GM' })[0]!);
    const asked = within(await screen.findByRole('dialog', { name: '1 thing still to do' }));
    expect(asked.getByText('Hit points: the GM asked you to roll again.')).toBeTruthy();
    await user.click(asked.getByRole('button', { name: 'Fix hit points' }));
    await user.type(within(screen.getByRole('dialog', { name: 'Hit points' })).getByLabelText('Hit points'), '14');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(screen.getAllByRole('button', { name: 'Send to the GM' })[0]!);
    await waitFor(() => expect(world.tables.actors.find((a) => a.id === reed)).toMatchObject({ approval: 'pending', hp_max: 14, fields: { saveR: 11 } }));
  });

  // A13 / B20 (ruled 2026-10-25): no "From your setting" heading; filled values sit under their block, one tap away.
  // The Player screen redesign (ruled 2026-10-26): header, vitals with tap-to-explain, then Skills and Saves from the
  // setting, each opening its rules in one tap, then "Full character sheet ›".
  it('the Player screen: "Class level" header, attack with its quiet line, skills with their odds, saves with their names', async () => {
    const { me, campaign } = fillWorld();
    const warden = world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!;
    Object.assign(warden.data as Record<string, unknown>, {
      skills: { names: { HR: 'Hide in reeds', LW: 'Listen at water' }, die: 'd6', gmRolls: ['LW'], byLevel: [{ level: 1, HR: 1, LW: 1 }, { level: 3, HR: 2, LW: 2 }] },
    });
    (world.tables.library_entries.find((e) => e.pack_entry_id === 'fill-level')!.data as Record<string, unknown>).target = ['hitDice', 'attack', 'saves', 'skills'];
    world.tables.field_definitions.push({ id: 'field-thac0', campaign_id: campaign, applies_to: 'pc', key: 'thac0', label: 'THAC0', type: 'number', choices: [], field_group: 'Combat', sort_order: 2, show_on_card: false, hidden: false, fill: 'attack', created_at: '2026-10-18T12:00:00Z' });
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 3, hp_current: 9, hp_max: 14, fields: { STR: 5 }, classes: [{ classRef: 'lantern-warden', level: 3, xp: 0 }] });
    world.addMember(campaign, me, 'player', reed);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    // The class and level are the level block's (dec-13 C2, C3).
    expect(await screen.findByRole('button', { name: /^Lantern Warden, level 3/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hit points 9 of 14. Type a value' })).toBeTruthy();
    const attack = await screen.findByRole('button', { name: "THAC0 18: how it's worked out" });
    expect(attack.textContent).toContain('Melee −1');
    await user.click(attack);
    expect(within(await screen.findByRole('dialog', { name: 'THAC0' })).getByText('THAC0 18 for a Lantern Warden at level 3.')).toBeTruthy();
    await user.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Close' }));

    const skills = within(screen.getByRole('region', { name: 'Skills' }));
    await user.click(skills.getByRole('button', { name: 'Hide in reeds 2-in-6: where it comes from' }));
    const skill = within(await screen.findByRole('dialog', { name: 'Hide in reeds' }));
    expect(skill.getByText('Succeeds on a 5+,')).toBeTruthy();
    expect(skill.getByText(/^From your setting: /)).toBeTruthy();
    await user.click(skill.getByRole('button', { name: 'Close' }));
    await user.click(skills.getByRole('button', { name: 'Listen at water 2-in-6: where it comes from' }));
    expect(await screen.findByText('Your GM rolls this one secretly and tells you what happens.')).toBeTruthy();
    await user.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Close' }));

    await user.click(within(screen.getByRole('region', { name: 'Saves' })).getByRole('button', { name: 'Save vs river 11: where it comes from' }));
    // The save's sheet, the full sheet's (bq-2): its number, and no class-and-level line (sv-2a).
    const river = within(await screen.findByRole('dialog', { name: 'Save vs river' }));
    expect(river.getByText('11', { selector: '.dialog__figure' })).toBeTruthy();
    expect(river.queryByText(/for a Lantern Warden at level 3/)).toBeNull();
    await user.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Close' }));

    await openFullSheetFromMenu(user);
    // The Combat block is gone (plan m5b-sheet-revised A1): the sheet is open once its Level row is there.
    expect(await screen.findByRole('region', { name: 'Level' })).toBeTruthy();
  });

  // The Magic tab (dec-8 B; mp-20, mm-1, mp-6) and Traits on the Player screen. Purposes, in plain words:
  //   * a caster's spells are on their own Magic tab, and the Player screen no longer has a Spells section;
  //   * the tab's first row is Prepare, "For your next rest" (dec-8 C; Prepare's own test follows);
  //   * a spell prepared twice is one row with a dot a casting; Cast spends one at once and Undo gives it back;
  //   * a tap on the row opens the spell's rules, with Cast at their foot while a casting is left;
  //   * with no casting left the spell is crossed out, says "Cast" and offers no Cast;
  //   * a limited-use power's dots are tapped when used and tapped to give back (Traits, unchanged).
  it('the Magic tab: Prepare first, cast with Undo, dots a casting, spent says Cast; Traits use dots', async () => {
    const { me, campaign } = fillWorld();
    const warden = world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!;
    Object.assign(warden.data as Record<string, unknown>, {
      spellcasting: { listId: 'warden-list', type: 'divine', castingType: 'divine' },
      progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 }, spellSlots: [2] }],
      abilities: [{ name: 'Ember ward', uses: 2, refill: 'day', note: 'Keeps a flame alight in the rain.' }, { name: 'Lantern lore', note: 'Always on.' }],
    });
    (world.tables.library_entries.find((e) => e.pack_entry_id === 'fill-level')!.data as Record<string, unknown>).target = ['hitDice', 'attack', 'saves', 'spellSlots'];
    world.tables.library_entries.push(
      { id: 'entry-glimmer', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'glimmer', name: 'Glimmer', data: { id: 'glimmer', name: 'Glimmer', range: '30 ft', duration: { formula: '2 + level', unit: 'turn' }, notes: 'A small steady light.' } },
      { id: 'entry-mist', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'mist', name: 'Mist', data: { id: 'mist', name: 'Mist', range: 'Self' } },
      { id: 'entry-warden-list', pack_id: 'pack-fen', kind: 'spellList', pack_entry_id: 'warden-list', name: 'Warden spells', data: { id: 'warden-list', name: 'Warden spells', levels: [{ level: 1, spells: ['glimmer', 'mist'] }] } },
    );
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
    // Glimmer ready twice (chosen before the last rest; Prepare now chooses for the next one, dec-8 C).
    world.tables.character_play.push({ actor_id: reed, campaign_id: campaign, prepared: [{ spell: 'glimmer', level: 1 }, { spell: 'glimmer', level: 1 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
    world.addMember(campaign, me, 'player', reed);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));

    // No Spells section on the Player screen (mp-20).
    // The Player's own Abilities and traits first (pg28-1); the sheet's rows (a Traits row, a Magic row) follow Skills on a
    // phone too (tfr-5).
    expect(await screen.findByRole('region', { name: 'Abilities and traits' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Spells' })).toBeNull();
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Magic' }));
    // Prepare is the first row, for the next rest (frame 04; dec-8 C brings its words back).
    expect(screen.getByRole('button', { name: 'Prepare, For your next rest' })).toBeTruthy();

    // One row for Glimmer, taken twice: two dots, both left (mm-1).
    const level = within(await screen.findByRole('region', { name: 'Level 1, 2 a day' }));
    expect(await level.findByRole('button', { name: 'Glimmer, 2 of 2 left, 3 turns, 30 ft' })).toBeTruthy();
    expect(level.getAllByRole('button', { name: 'Cast Glimmer' })).toHaveLength(1);
    // Cast: at once, never asking who or where (mp-6); the toast names it, with Undo.
    await user.click(level.getByRole('button', { name: 'Cast Glimmer' }));
    expect(await screen.findByText('Glimmer cast')).toBeTruthy();
    await vi.waitFor(() => expect(world.tables.character_play[0]!.spells_cast).toEqual({ '1:glimmer': 1 }));
    expect(await level.findByRole('button', { name: 'Glimmer, 1 of 2 left, 3 turns, 30 ft' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(world.tables.character_play[0]!.spells_cast).toEqual({}));
    expect(await level.findByRole('button', { name: 'Glimmer, 2 of 2 left, 3 turns, 30 ft' })).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'character.castSpell' || e.type === 'character.uncastSpell').map((e) => e.type)).toEqual(['character.castSpell', 'character.uncastSpell']);

    // The row opens the spell's rules, with Cast at their foot.
    await user.click(level.getByRole('button', { name: 'Glimmer, 2 of 2 left, 3 turns, 30 ft' }));
    const rules = within(await screen.findByRole('dialog', { name: 'Glimmer' }));
    expect(rules.getByText('A small steady light.')).toBeTruthy();
    await user.click(rules.getByRole('button', { name: 'Cast Glimmer' }));
    await vi.waitFor(() => expect(world.tables.character_play[0]!.spells_cast).toEqual({ '1:glimmer': 1 }));
    expect(screen.queryByRole('dialog', { name: 'Glimmer' })).toBeNull();
    // The last casting: crossed out, "Cast" in words, and no Cast left to tap.
    await user.click(await level.findByRole('button', { name: 'Cast Glimmer' }));
    expect(await level.findByRole('button', { name: 'Glimmer, cast' })).toBeTruthy();
    expect(level.queryByRole('button', { name: 'Cast Glimmer' })).toBeNull();
    expect(level.getByText('Cast')).toBeTruthy();
    // Its rules still open, without Cast: the way out is "Got it".
    await user.click(level.getByRole('button', { name: 'Glimmer, cast' }));
    const spent = within(await screen.findByRole('dialog', { name: 'Glimmer' }));
    expect(spent.queryByRole('button', { name: 'Cast Glimmer' })).toBeNull();
    await user.click(spent.getByRole('button', { name: 'Got it' }));
    // The log names the spell (piece A's Departure 5, filled by B): "You cast Glimmer for Reed", not "a level 1 spell".
    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect((await screen.findAllByText(/You cast Glimmer for Reed/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/a level 1 spell/)).toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Log' })).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Player' }));
    const abilities = within(screen.getByRole('region', { name: 'Abilities and traits' }));
    expect(abilities.queryByText('Lantern lore')).toBeNull();
    // The row's Use marks one (plan m5b-players-screens-standard B); the trait's sheet keeps the dots to give one back.
    expect(abilities.getByText('2 of 2 left, back each day')).toBeTruthy();
    await user.click(abilities.getByRole('button', { name: 'Use Ember ward' }));
    await vi.waitFor(() => expect(world.tables.character_play[0]!.uses_spent).toEqual({ 'Ember ward': 1 }));
    expect(await abilities.findByText('1 of 2 left, back each day')).toBeTruthy();
    await user.click(abilities.getByRole('button', { name: /^Ember ward/ }));
    const ward = within(await screen.findByRole('dialog', { name: 'Ember ward' }));
    expect(ward.getByRole('group', { name: 'Ember ward: 1 of 2 left' })).toBeTruthy();
    await user.click(ward.getByRole('button', { name: 'Give back a use of Ember ward' }));
    await vi.waitFor(() => expect(world.tables.character_play[0]!.uses_spent).toEqual({}));
    expect(world.tables.events.filter((e) => e.type === 'character.useAbility').map((e) => e.level)).toEqual(['verbose', 'verbose']);
  });

  // Prepare (dec-8 C; mp-1 to mp-4, mm-4; mockup magic/06). Purposes, in plain words:
  //   * a book caster's Prepare lists the spell book by level ("Level 1, 2 a day. 2 chosen"), a stepper a spell, and
  //     its first line tells what it chooses (the next rest) from what stays ready today;
  //   * with nothing chosen anew the steppers show today's ready set (the lead's answer 4);
  //   * + and − save at once as the choice for the next rest, and never change what is ready today (mp-2);
  //   * + on a full level answers "Level 1 is full" with why, and changes nothing (mp-1; never a disabled button);
  //   * Same as yesterday is one tap (Pick), with Undo giving back the choice before it (mm-4);
  //   * the foot says it saves as you go and how many slots are still empty.
  it('Prepare: a stepper a spell for the next rest, ready today untouched, a full level explains, Same as yesterday with Undo', async () => {
    const { me, campaign } = fillWorld();
    const warden = world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!;
    Object.assign(warden.data as Record<string, unknown>, {
      spellcasting: { listId: 'warden-list', type: 'book', castingType: 'arcane' },
      progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 }, spellSlots: [2, 1] }],
    });
    (world.tables.library_entries.find((e) => e.pack_entry_id === 'fill-level')!.data as Record<string, unknown>).target = ['hitDice', 'attack', 'saves', 'spellSlots'];
    world.tables.library_entries.push(
      { id: 'entry-lamp', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'mire-lamp', name: 'Mire lamp', data: { id: 'mire-lamp', name: 'Mire lamp', range: '30 ft', notes: 'A cold light over the water.' } },
      { id: 'entry-dart', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'thorn-dart', name: 'Thorn dart', data: { id: 'thorn-dart', name: 'Thorn dart', range: '60 ft' } },
      { id: 'entry-unread', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'unread', name: 'Unread page', data: { id: 'unread', name: 'Unread page' } },
      { id: 'entry-whisper', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'reed-whisper', name: 'Reed whisper', data: { id: 'reed-whisper', name: 'Reed whisper', range: '1 mile' } },
      { id: 'entry-warden-list', pack_id: 'pack-fen', kind: 'spellList', pack_entry_id: 'warden-list', name: 'Warden spells', data: { id: 'warden-list', name: 'Warden spells', levels: [{ level: 1, spells: ['mire-lamp', 'unread', 'thorn-dart'] }, { level: 2, spells: ['reed-whisper'] }] } },
    );
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: me });
    // Her book holds three of the list's four spells: Unread page isn't in it, so it isn't offered.
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }], spell_book: ['mire-lamp', 'thorn-dart', 'reed-whisper'] });
    world.tables.character_play.push({ actor_id: wren, campaign_id: campaign, prepared: [{ spell: 'mire-lamp', level: 1 }, { spell: 'reed-whisper', level: 2 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
    world.addMember(campaign, me, 'player', wren);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Magic' }));
    await user.click(await screen.findByRole('button', { name: 'Prepare, For your next rest' }));

    const prepare = within(await screen.findByRole('dialog', { name: 'Prepare' }));
    expect(prepare.getByText("For Wren's next rest. Ready today stays as it is: Mire lamp, Reed whisper.")).toBeTruthy();
    // Nothing chosen anew: the steppers show today's ready set.
    const one = within(prepare.getByRole('region', { name: 'Level 1' }));
    expect(one.getByText('Level 1, 2 a day. 1 chosen')).toBeTruthy();
    expect(one.getByRole('group', { name: 'Mire lamp' }).textContent).toContain('1');
    expect(one.queryByText('Unread page')).toBeNull();
    expect(prepare.getByText('Level 2, 1 a day. 1 chosen')).toBeTruthy();
    expect(prepare.getByText('Saved as you go. 1 slot still empty')).toBeTruthy();

    // + saves at once, as the choice for the next rest; today's ready set is untouched (mp-2).
    await user.click(one.getByRole('button', { name: 'More Mire lamp' }));
    await vi.waitFor(() => expect(world.tables.character_play[0]!.chosen).toEqual([{ spell: 'mire-lamp', level: 1 }, { spell: 'reed-whisper', level: 2 }, { spell: 'mire-lamp', level: 1 }]));
    expect(world.tables.character_play[0]!.prepared).toEqual([{ spell: 'mire-lamp', level: 1 }, { spell: 'reed-whisper', level: 2 }]);
    expect(await one.findByText('Level 1, 2 a day. 2 chosen')).toBeTruthy();
    expect(prepare.getByText('Saved as you go')).toBeTruthy();

    // A full level: + still answers, with why, and nothing changes (mp-1).
    await user.click(one.getByRole('button', { name: 'More Thorn dart' }));
    const full = within(await screen.findByRole('dialog', { name: 'Level 1 is full' }));
    expect(full.getByText('Wren has 2 a day at level 1 and both are chosen. Take one out first.')).toBeTruthy();
    await user.click(full.getByRole('button', { name: 'Close' }));
    expect(one.getByRole('group', { name: 'Thorn dart' }).textContent).toContain('0');

    // − takes one out, saved at once.
    await user.click(one.getByRole('button', { name: 'Less Mire lamp' }));
    await vi.waitFor(() => expect(world.tables.character_play[0]!.chosen).toEqual([{ spell: 'mire-lamp', level: 1 }, { spell: 'reed-whisper', level: 2 }]));
    await user.click(one.getByRole('button', { name: 'More Thorn dart' }));
    await vi.waitFor(() => expect(world.tables.character_play[0]!.chosen).toEqual([{ spell: 'mire-lamp', level: 1 }, { spell: 'reed-whisper', level: 2 }, { spell: 'thorn-dart', level: 1 }]));

    // Same as yesterday: one tap; Undo gives back the choice before it.
    expect(prepare.getByText('Same as yesterday')).toBeTruthy();
    await user.click(prepare.getByRole('button', { name: 'Pick the same as yesterday' }));
    expect(await screen.findByText('Picked Mire lamp, Reed whisper')).toBeTruthy();
    await vi.waitFor(() => expect(world.tables.character_play[0]!.chosen).toEqual([{ spell: 'mire-lamp', level: 1 }, { spell: 'reed-whisper', level: 2 }]));
    expect(await one.findByText('Level 1, 2 a day. 1 chosen')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(world.tables.character_play[0]!.chosen).toEqual([{ spell: 'mire-lamp', level: 1 }, { spell: 'reed-whisper', level: 2 }, { spell: 'thorn-dart', level: 1 }]));
    expect(world.tables.events.filter((e) => e.type === 'character.chooseSpells' || e.type === 'character.sameAsYesterday').map((e) => e.type)).toEqual([
      'character.chooseSpells',
      'character.chooseSpells',
      'character.chooseSpells',
      'character.sameAsYesterday',
      'character.chooseSpells',
    ]);
    // A name opens the spell's rules.
    await user.click(one.getByRole('button', { name: /^Mire lamp/ }));
    expect(within(await screen.findByRole('dialog', { name: 'Mire lamp' })).getByText('A cold light over the water.')).toBeTruthy();
  });

  // Prepare's − at nought and a refused save (dec-8 C, #925's two fixes). Purposes, in plain words:
  //   * − on a spell that isn't chosen stays tappable and says why in a pop-up, and saves nothing (CLAUDE.md rule 7:
  //     never a disabled button);
  //   * a refused save puts the steppers back to the choice as saved, read fresh from the database (here another
  //     device chose meanwhile), never to the stale set this screen held before the tap, and says why;
  //   * if that fresh read fails too, the steppers go back to the last choice this screen saw saved.
  it('Prepare: − at nought explains; a refused save goes back to the choice as saved, read fresh', async () => {
    const { me, campaign } = fillWorld();
    const warden = world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!;
    Object.assign(warden.data as Record<string, unknown>, {
      spellcasting: { listId: 'warden-list', type: 'book', castingType: 'arcane' },
      progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 }, spellSlots: [2] }],
    });
    (world.tables.library_entries.find((e) => e.pack_entry_id === 'fill-level')!.data as Record<string, unknown>).target = ['hitDice', 'attack', 'saves', 'spellSlots'];
    world.tables.library_entries.push(
      { id: 'entry-lamp', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'mire-lamp', name: 'Mire lamp', data: { id: 'mire-lamp', name: 'Mire lamp' } },
      { id: 'entry-dart', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'thorn-dart', name: 'Thorn dart', data: { id: 'thorn-dart', name: 'Thorn dart' } },
      { id: 'entry-warden-list', pack_id: 'pack-fen', kind: 'spellList', pack_entry_id: 'warden-list', name: 'Warden spells', data: { id: 'warden-list', name: 'Warden spells', levels: [{ level: 1, spells: ['mire-lamp', 'thorn-dart'] }] } },
    );
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }], spell_book: ['mire-lamp', 'thorn-dart'] });
    world.tables.character_play.push({ actor_id: wren, campaign_id: campaign, prepared: [{ spell: 'mire-lamp', level: 1 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
    world.addMember(campaign, me, 'player', wren);
    // The connection drops for character_play when told to: its saves (and, if asked, its reads) are refused.
    const refuse = { save: false, read: false };
    const dropped = { data: null, error: { message: "Couldn't save. Check your connection and try again." } };
    const realFrom = world.db.from.bind(world.db);
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = realFrom(table as never);
      if (table !== 'character_play') return query;
      return new Proxy(query, {
        get(target, key, receiver) {
          if (key === 'upsert' && refuse.save) return () => ({ select: async () => dropped });
          if (key === 'select' && refuse.read) return () => ({ eq: () => ({ maybeSingle: async () => dropped }) });
          return Reflect.get(target, key, receiver) as unknown;
        },
      });
    }) as unknown as typeof world.db.from);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Magic' }));
    await user.click(await screen.findByRole('button', { name: 'Prepare, For your next rest' }));
    const prepare = within(await screen.findByRole('dialog', { name: 'Prepare' }));
    const one = within(prepare.getByRole('region', { name: 'Level 1' }));

    // − at nought: tappable, says why, saves nothing.
    await user.click(one.getByRole('button', { name: 'Less Thorn dart' }));
    const none = within(await screen.findByRole('dialog', { name: "Thorn dart isn't chosen" }));
    expect(none.getByText("Wren hasn't chosen Thorn dart for the next rest, so there's none to take out.")).toBeTruthy();
    await user.click(none.getByRole('button', { name: 'Close' }));
    expect(world.tables.character_play[0]!.chosen).toBeUndefined();
    expect(world.tables.events.some((e) => e.type === 'character.chooseSpells')).toBe(false);

    // Another device chooses Thorn dart meanwhile; this screen still shows Mire lamp alone. A refused + goes back to
    // the choice as saved, read fresh: Mire lamp and Thorn dart, not the stale "Mire lamp alone".
    world.tables.character_play[0]!.chosen = [{ spell: 'mire-lamp', level: 1 }, { spell: 'thorn-dart', level: 1 }];
    refuse.save = true;
    await user.click(one.getByRole('button', { name: 'More Mire lamp' }));
    expect(await screen.findByText("Couldn't save. Check your connection and try again.")).toBeTruthy();
    await vi.waitFor(() => expect(one.getByRole('group', { name: 'Thorn dart' }).textContent).toContain('1'));
    expect(one.getByRole('group', { name: 'Mire lamp' }).textContent).toContain('1');
    expect(one.getByText('Level 1, 2 a day. 2 chosen')).toBeTruthy();
    expect(world.tables.character_play[0]!.chosen).toEqual([{ spell: 'mire-lamp', level: 1 }, { spell: 'thorn-dart', level: 1 }]);

    // The read fails too: − goes back to the last choice this screen saw saved (the fresh read above).
    refuse.read = true;
    await user.click(one.getByRole('button', { name: 'Less Thorn dart' }));
    await vi.waitFor(() => expect(one.getByRole('group', { name: 'Thorn dart' }).textContent).toContain('1'));
    expect(one.getByText('Level 1, 2 a day. 2 chosen')).toBeTruthy();
  });

  // Prepare for a caster who chooses from the whole list, and a yesterday that no longer fits. Purposes, in plain words:
  //   * the chosen spells come first and the rest are folded under "N more at level 1", their names in the summary (mp-1),
  //     the fold carrying the + square (fix 1, 2026-11-18);
  //   * Same as yesterday when yesterday's set no longer fits the slots: a tap picks nothing and says why (the lead's
  //     answer 2), never a disabled button.
  it('Prepare: the whole list folds the rest; Same as yesterday that no longer fits explains and picks nothing', async () => {
    const { me, campaign } = fillWorld();
    const warden = world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!;
    Object.assign(warden.data as Record<string, unknown>, {
      spellcasting: { listId: 'warden-list', type: 'divine', castingType: 'divine' },
      progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 }, spellSlots: [1] }],
    });
    (world.tables.library_entries.find((e) => e.pack_entry_id === 'fill-level')!.data as Record<string, unknown>).target = ['hitDice', 'attack', 'saves', 'spellSlots'];
    world.tables.library_entries.push(
      { id: 'entry-hands', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'mending-hands', name: 'Mending hands', data: { id: 'mending-hands', name: 'Mending hands', range: 'Touch' } },
      { id: 'entry-ward', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'candle-ward', name: 'Candle ward', data: { id: 'candle-ward', name: 'Candle ward' } },
      { id: 'entry-still', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'still-water', name: 'Still water', data: { id: 'still-water', name: 'Still water' } },
      { id: 'entry-warden-list', pack_id: 'pack-fen', kind: 'spellList', pack_entry_id: 'warden-list', name: 'Warden spells', data: { id: 'warden-list', name: 'Warden spells', levels: [{ level: 1, spells: ['candle-ward', 'mending-hands', 'still-water'] }] } },
    );
    const alder = world.addCharacter(campaign, 'Brother Alder', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === alder)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
    world.tables.character_play.push({ actor_id: alder, campaign_id: campaign, prepared: [{ spell: 'candle-ward', level: 1 }, { spell: 'still-water', level: 1 }], chosen: [{ spell: 'mending-hands', level: 1 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
    world.addMember(campaign, me, 'player', alder);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Magic' }));
    await user.click(await screen.findByRole('button', { name: 'Prepare, For your next rest' }));

    const prepare = within(await screen.findByRole('dialog', { name: 'Prepare' }));
    const one = within(prepare.getByRole('region', { name: 'Level 1' }));
    expect(one.getByRole('group', { name: 'Mending hands' })).toBeTruthy();
    expect(one.getByText('2 more at level 1')).toBeTruthy();
    expect(one.getByText('Candle ward, Still water')).toBeTruthy();
    // The fold's mark is the + square frame 06 draws, not creation's chevron (Francis's fix 1, 2026-11-18).
    const fold = one.getByText('2 more at level 1').closest('details')!;
    expect(fold.querySelector('.creation-fold__square')).not.toBeNull();
    expect(fold.querySelector('.creation-fold__mark')).toBeNull();

    // Yesterday's set no longer fits (two ready, one slot): Pick stays tappable, explains and picks nothing.
    await user.click(prepare.getByRole('button', { name: 'Pick the same as yesterday' }));
    const why = within(await screen.findByRole('dialog', { name: 'Same as yesterday' }));
    expect(why.getByText("Yesterday's spells no longer fit your slots. Choose again.")).toBeTruthy();
    expect(world.tables.character_play[0]!.chosen).toEqual([{ spell: 'mending-hands', level: 1 }]);
    expect(world.tables.events.some((e) => e.type === 'character.sameAsYesterday')).toBe(false);
  });

  // Prepare with an empty spell book (frame 06's note; the lead, 2026-11-14). Purpose, in plain words:
  //   * a book caster whose book is empty is told, in the note's own words, that there is nothing to choose yet and
  //     how a spell arrives; no stepper is offered from the class list; the note stands alone, with no level line and
  //     no "1 slot still empty" at the foot (Francis's fix 3, 2026-11-18).
  //   * on the Magic tab, with nothing ready and nothing chosen, "Nothing ready" says frame 04's sentence (B's
  //     Departure 2, back now that C and D are in).
  it('Prepare: an empty spell book says so in the note\'s words and offers no stepper', async () => {
    const { me, campaign } = fillWorld();
    const warden = world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!;
    Object.assign(warden.data as Record<string, unknown>, {
      spellcasting: { listId: 'warden-list', type: 'book', castingType: 'arcane' },
      progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 }, spellSlots: [1] }],
    });
    (world.tables.library_entries.find((e) => e.pack_entry_id === 'fill-level')!.data as Record<string, unknown>).target = ['hitDice', 'attack', 'saves', 'spellSlots'];
    world.tables.library_entries.push(
      { id: 'entry-lamp', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'mire-lamp', name: 'Mire lamp', data: { id: 'mire-lamp', name: 'Mire lamp' } },
      { id: 'entry-warden-list', pack_id: 'pack-fen', kind: 'spellList', pack_entry_id: 'warden-list', name: 'Warden spells', data: { id: 'warden-list', name: 'Warden spells', levels: [{ level: 1, spells: ['mire-lamp'] }] } },
    );
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }], spell_book: [] });
    world.addMember(campaign, me, 'player', wren);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Magic' }));
    expect(await screen.findByText("You haven't chosen since your last rest. Choose in Prepare; they're ready after you rest.")).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Prepare, For your next rest' }));

    const prepare = within(await screen.findByRole('dialog', { name: 'Prepare' }));
    expect(prepare.getByText('No spells in your book yet. Your GM adds one when you learn it.')).toBeTruthy();
    // The note stands alone (Francis's fix 3, 2026-11-18): no level line, and the foot counts no empty slot.
    expect(prepare.queryByText('Level 1, 1 a day. None chosen')).toBeNull();
    expect(prepare.queryByRole('region', { name: 'Level 1' })).toBeNull();
    expect(prepare.getByText('Saved as you go')).toBeTruthy();
    expect(prepare.queryByText(/still empty/)).toBeNull();
    expect(prepare.queryByRole('group', { name: 'Mire lamp' })).toBeNull();
  });

  // A spell chosen but not yet rested, and a book emptied since (round 3's review, 2026-11-18). Purposes, in plain words:
  //   * on the Magic tab, with a spell chosen and nothing ready yet, "Nothing ready" stands alone: the sentence "You
  //     haven't chosen since your last rest…" would be untrue, so it isn't shown (the automatic review's nit 5);
  //   * in Prepare, the GM having emptied the book since, the chosen spell is still shown under the book's note with
  //     its stepper, and − takes it out and saves (nothing chosen is ever hidden).
  it('Prepare: a spell chosen, not yet rested, shows "Nothing ready" alone and stays removable when the book is emptied', async () => {
    const { me, campaign } = fillWorld();
    const warden = world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!;
    Object.assign(warden.data as Record<string, unknown>, {
      spellcasting: { listId: 'warden-list', type: 'book', castingType: 'arcane' },
      progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 }, spellSlots: [1] }],
    });
    (world.tables.library_entries.find((e) => e.pack_entry_id === 'fill-level')!.data as Record<string, unknown>).target = ['hitDice', 'attack', 'saves', 'spellSlots'];
    world.tables.library_entries.push(
      { id: 'entry-lamp', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'mire-lamp', name: 'Mire lamp', data: { id: 'mire-lamp', name: 'Mire lamp' } },
      { id: 'entry-warden-list', pack_id: 'pack-fen', kind: 'spellList', pack_entry_id: 'warden-list', name: 'Warden spells', data: { id: 'warden-list', name: 'Warden spells', levels: [{ level: 1, spells: ['mire-lamp'] }] } },
    );
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }], spell_book: [] });
    world.tables.character_play.push({ actor_id: wren, campaign_id: campaign, prepared: [], chosen: [{ spell: 'mire-lamp', level: 1 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
    world.addMember(campaign, me, 'player', wren);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Magic' }));
    expect(await screen.findByText('Nothing ready')).toBeTruthy();
    expect(screen.queryByText("You haven't chosen since your last rest. Choose in Prepare; they're ready after you rest.")).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Prepare, For your next rest' }));

    const prepare = within(await screen.findByRole('dialog', { name: 'Prepare' }));
    expect(prepare.getByText('No spells in your book yet. Your GM adds one when you learn it.')).toBeTruthy();
    const one = within(prepare.getByRole('region', { name: 'Level 1' }));
    expect(one.getByText('Level 1, 1 a day. 1 chosen')).toBeTruthy();
    expect(one.getByRole('group', { name: 'Mire lamp' })).toBeTruthy();
    await user.click(one.getByRole('button', { name: 'Less Mire lamp' }));
    await vi.waitFor(() => expect(world.tables.character_play[0]!.chosen).toEqual([]));
  });

  // The Magic tab's opened spell in the book's format (dec-8 B; mm-12). Purposes, in plain words:
  //   * its head reads as the book writes a spell's: Level, Range and Duration each a labelled line, no "Rules" label;
  //   * its whole description shows as the pack sets it out: the paragraph, the bold lead-in, every item of the list;
  //   * its page is the last line, and Cast stays at its foot;
  //   * the tab's own content (Prepare, the spells) is in the book's faces, and so is Prepare's own screen (dec-8 C);
  //   * Prepare shows the spell book before its word with its chevron; Cast at the foot is the magic palm above its
  //     word, and a spent spell's "Got it" the tick above its word (ic-2).
  it('the Magic tab: the opened spell reads in the book’s format, its whole description set out as the pack gives it', async () => {
    const { me, campaign } = fillWorld();
    const warden = world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!;
    Object.assign(warden.data as Record<string, unknown>, {
      spellcasting: { listId: 'warden-list', type: 'divine', castingType: 'divine' },
      progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 }, spellSlots: [2] }],
    });
    (world.tables.library_entries.find((e) => e.pack_entry_id === 'fill-level')!.data as Record<string, unknown>).target = ['hitDice', 'attack', 'saves', 'spellSlots'];
    const notes = { blocks: [{ p: 'A green lantern hangs in the air beside the caster.' }, { lead: 'Snuffed', text: 'Water puts it out at once.' }, { list: ['It sheds no heat.', 'It drifts with the caster.'] }] };
    world.tables.library_entries.push(
      { id: 'entry-bog-lantern', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'bog-lantern', name: 'Bog lantern', data: { id: 'bog-lantern', name: 'Bog lantern', range: '30 ft', duration: '1 hour', notes, source: 'Fen rules p. 7' } },
      { id: 'entry-warden-list', pack_id: 'pack-fen', kind: 'spellList', pack_entry_id: 'warden-list', name: 'Warden spells', data: { id: 'warden-list', name: 'Warden spells', levels: [{ level: 1, spells: ['bog-lantern'] }] } },
    );
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
    world.tables.character_play.push({ actor_id: reed, campaign_id: campaign, prepared: [{ spell: 'bog-lantern', level: 1 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
    world.addMember(campaign, me, 'player', reed);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Magic' }));

    // The tab's own content is in the book's faces (the lead's rule under pq-1), and so is Prepare's screen (piece C).
    expect((await screen.findByRole('region', { name: 'Spells' })).closest('.book-type')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Prepare, For your next rest' }).closest('.book-type')).not.toBeNull();
    // Prepare is a row (ic-2): the spell book before its word, the chevron kept.
    const prepareRow = screen.getByRole('button', { name: 'Prepare, For your next rest' });
    const prepareIcons = [...prepareRow.querySelectorAll('svg')];
    expect(prepareIcons).toHaveLength(2);
    expect(prepareIcons[0]!.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['spell-book'].d);
    expect(prepareRow.querySelector('.list-row__title')!.firstElementChild!.tagName.toLowerCase()).toBe('svg');
    expect(prepareRow.querySelector('.list-row__chevron')).not.toBeNull();
    await user.click(prepareRow);
    const prepare = await screen.findByRole('dialog', { name: 'Prepare' });
    expect(prepare.closest('.book-type')).not.toBeNull();
    await user.click(within(prepare).getByRole('button', { name: 'Close' }));

    const one = within(await screen.findByRole('region', { name: 'Level 1, 2 a day' }));
    await user.click(one.getByRole('button', { name: 'Bog lantern, 1 hour, 30 ft' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bog lantern' });
    const spell = within(dialog);
    // The head: labelled lines in the book's way, "Range 30 ft", not a list of small-capital headings.
    const line = (label: string) => spell.getByText(label, { selector: '.book-label' }).parentElement!.textContent;
    expect(line('Level')).toBe('Level 1');
    expect(line('Range')).toBe('Range 30 ft');
    expect(line('Duration')).toBe('Duration 1 hour');
    expect(spell.queryByText('Rules')).toBeNull();
    expect(dialog.querySelector('dl')).toBeNull();
    // The whole description, as the pack sets it out.
    expect(spell.getByText('A green lantern hangs in the air beside the caster.')).toBeTruthy();
    expect(spell.getByText('Snuffed.', { selector: 'strong' })).toBeTruthy();
    expect(spell.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['It sheds no heat.', 'It drifts with the caster.']);
    // The page last, and Cast at the foot.
    expect(spell.getByText('From your setting’s rules: Fen rules p. 7.')).toBeTruthy();
    // Cast at the foot is the magic palm above its word (ic-2); once spent, the way out is the tick above "Got it".
    const footCast = spell.getByRole('button', { name: 'Cast Bog lantern' });
    expect(footCast.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['magic-palm'].d);
    expect(footCast.querySelector('span')!.textContent).toBe('Cast');
    await user.click(footCast);
    await vi.waitFor(() => expect(world.tables.character_play[0]!.spells_cast).toEqual({ '1:bog-lantern': 1 }));
    await user.click(await one.findByRole('button', { name: 'Bog lantern, cast' }));
    const spent = within(await screen.findByRole('dialog', { name: 'Bog lantern' }));
    const gotIt = spent.getByRole('button', { name: 'Got it' });
    expect(gotIt.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['check-mark'].d);
    expect(gotIt.querySelector('span')!.textContent).toBe('Got it');
  });

  // The Magic tab with messy data (the review of #787). Purposes, in plain words:
  //   * a level-0 spell is headed "Level 0", and its rules say "Level 0" and "0", never a game's word for it;
  //   * a ready spell whose pack is gone is named as the log names it ("A level 1 spell"), never by its raw id, and
  //     can still be cast.
  it('the Magic tab: level 0 says "Level 0" on the row and in its rules; a spell gone from the packs never shows its id', async () => {
    const { me, campaign } = fillWorld();
    const warden = world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!;
    Object.assign(warden.data as Record<string, unknown>, {
      spellcasting: { listId: 'warden-list', type: 'divine', castingType: 'divine' },
      progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 }, spellSlots: [2] }],
    });
    (world.tables.library_entries.find((e) => e.pack_entry_id === 'fill-level')!.data as Record<string, unknown>).target = ['hitDice', 'attack', 'saves', 'spellSlots'];
    world.tables.library_entries.push(
      { id: 'entry-spark', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'spark', name: 'Tinder spark', data: { id: 'spark', name: 'Tinder spark', range: 'Touch', notes: 'A wick catches.' } },
      { id: 'entry-warden-list', pack_id: 'pack-fen', kind: 'spellList', pack_entry_id: 'warden-list', name: 'Warden spells', data: { id: 'warden-list', name: 'Warden spells', levels: [{ level: 0, spells: ['spark'] }] } },
    );
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
    world.tables.character_play.push({ actor_id: reed, campaign_id: campaign, prepared: [{ spell: 'spark', level: 0 }, { spell: 'ex-gone-hex', level: 1 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
    world.addMember(campaign, me, 'player', reed);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Magic' }));

    const zero = within(await screen.findByRole('region', { name: 'Level 0' }));
    await user.click(zero.getByRole('button', { name: 'Tinder spark, Touch' }));
    const rules = within(await screen.findByRole('dialog', { name: 'Tinder spark' }));
    expect(rules.getByText('A wick catches.')).toBeTruthy();
    expect(rules.getByText('0')).toBeTruthy();
    expect(rules.queryByText(/cantrip/i)).toBeNull();
    expect(screen.queryByText(/cantrip/i)).toBeNull();
    await user.click(rules.getByRole('button', { name: 'Cast Tinder spark' }));
    await vi.waitFor(() => expect(world.tables.character_play[0]!.spells_cast).toEqual({ '0:spark': 1 }));

    const one = within(screen.getByRole('region', { name: 'Level 1, 2 a day' }));
    expect(one.getByRole('button', { name: 'A level 1 spell' })).toBeTruthy();
    expect(screen.queryByText(/ex-gone-hex/)).toBeNull();
    await user.click(one.getByRole('button', { name: 'Cast A level 1 spell' }));
    expect(await screen.findByText('A level 1 spell cast')).toBeTruthy();
    expect(screen.queryByText(/ex-gone-hex/)).toBeNull();
  });

  // The Magic tab on a list that names its levels (lv-1, pf-22; the review of #832). Purposes, in plain words:
  //   * a named level is headed by the list's plural ("Glimmers"), with a capital, as creation's group is;
  //   * its spell's pop-up reads the name's single form under "Level" ("Glimmer"), as creation's does;
  //   * a spell whose pack is gone is named in the list's words ("An ember rite"), "An" before a vowel.
  it('the Magic tab: a list naming its levels heads them with its words, in the pop-up too', async () => {
    const { me, campaign } = fillWorld();
    const warden = world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!;
    Object.assign(warden.data as Record<string, unknown>, {
      spellcasting: { listId: 'warden-list', type: 'divine', castingType: 'divine' },
      progression: [{ level: 1, hitDice: '1d8', thac0: 19, saves: { R: 12 }, spellSlots: [2] }],
    });
    (world.tables.library_entries.find((e) => e.pack_entry_id === 'fill-level')!.data as Record<string, unknown>).target = ['hitDice', 'attack', 'saves', 'spellSlots'];
    world.tables.library_entries.push(
      { id: 'entry-spark', pack_id: 'pack-fen', kind: 'spell', pack_entry_id: 'spark', name: 'Tinder spark', data: { id: 'spark', name: 'Tinder spark', range: 'Touch', notes: 'A wick catches.' } },
      {
        id: 'entry-warden-list',
        pack_id: 'pack-fen',
        kind: 'spellList',
        pack_entry_id: 'warden-list',
        name: 'Warden spells',
        data: { id: 'warden-list', name: 'Warden spells', levels: [{ level: 0, spells: ['spark'] }], levelNames: { '0': { one: 'glimmer', many: 'glimmers' }, '1': { one: 'ember rite', many: 'ember rites' } } },
      },
    );
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 10 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
    world.tables.character_play.push({ actor_id: reed, campaign_id: campaign, prepared: [{ spell: 'spark', level: 0 }, { spell: 'ex-gone-hex', level: 1 }], uses_spent: {}, ac_override: null, form_id: null, version: 1 });
    world.addMember(campaign, me, 'player', reed);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Magic' }));

    const glimmers = within(await screen.findByRole('region', { name: 'Glimmers' }));
    expect(screen.queryByRole('region', { name: 'Level 0' })).toBeNull();
    await user.click(glimmers.getByRole('button', { name: 'Tinder spark, Touch' }));
    const rules = within(await screen.findByRole('dialog', { name: 'Tinder spark' }));
    expect(rules.getByText('Glimmer')).toBeTruthy();
    expect(rules.queryByText('0')).toBeNull();
    await user.click(rules.getByRole('button', { name: 'Close' }));

    const rites = within(screen.getByRole('region', { name: 'Ember rites, 2 a day' }));
    expect(rites.getByRole('button', { name: 'An ember rite' })).toBeTruthy();
    expect(screen.queryByText(/ex-gone-hex/)).toBeNull();
  });

  it('the full sheet puts what the setting fills under its block: an ability tile opens its numbers; the rest is one tap away', async () => {
    const { me, campaign } = fillWorld();
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 3, fields: { STR: 5, saveR: 11 }, classes: [{ classRef: 'lantern-warden', level: 3, xp: 0 }] });
    world.addMember(campaign, me, 'player', reed);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Full character sheet' }));
    expect(await screen.findByRole('region', { name: 'Level' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'From your setting' })).toBeNull();
    // No "How it's worked out" link (ct3-9). Plan m5b-sheet-revised A3: the Combat block and its figure tiles (hit dice,
    // HP's breakdown) are gone; the left column's Attack tile has its breakdown.
    expect(screen.queryByRole('button', { name: "How it's worked out" })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Combat' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Hit dice/ })).toBeNull();
    const vitals = within(document.querySelector('.sheet__vitals') as HTMLElement);
    expect(vitals.getByRole('button', { name: "Attack 18: how it's worked out" }).querySelector('.stat-tile__value')?.textContent).toBe('18');
    // The save has its own field (River), so it isn't listed again.
    expect(screen.queryByText('Save vs river')).toBeNull();
    await user.click(vitals.getByRole('button', { name: "Attack 18: how it's worked out" }));
    expect(await screen.findByRole('dialog', { name: /^Attack/ })).toBeTruthy();
    // Every pop-up on the sheet is a Sheet, closed with its ✕ (plan m5b-players-screens-standard D).
    await user.click(within(screen.getAllByRole('dialog').at(-1)!).getAllByRole('button', { name: 'Close' })[0]!);
    // A score tile: the full name, the score, the modifier under it (a screen reader hears what it modifies); its
    // sheet has the full name and, under "Modifiers", each thing it changes with what it gives (plan D; sv-2a).
    await user.click(screen.getByRole('button', { name: /^Strength 5, −1 melee: where it comes from$/ }));
    expect(within(await screen.findByRole('dialog', { name: 'Strength' })).getByText('Melee: −1.')).toBeTruthy();
    await user.click(within(screen.getAllByRole('dialog').at(-1)!).getAllByRole('button', { name: 'Close' })[0]!);

    // Tap Level for how it's worked out (ruled 2026-10-26); HP's tap types a value now (hit points in place).
    await user.click(screen.getByRole('button', { name: /^Level \d+: how it's worked out$/ }));
    expect(await screen.findByRole('dialog', { name: 'Level' })).toBeTruthy();
  });

  // M4b re-test (2026-10-26): the sheet showed no class, a blank Race and blank filled fields, and two Combat headings.
  it('the full sheet names race and class and fills empty linked fields in Details, with no Combat heading', async () => {
    const { me, campaign } = fillWorld();
    world.tables.library_entries.push({ id: 'entry-marsh', pack_id: 'pack-fen', kind: 'race', pack_entry_id: 'marsh-folk', name: 'Marsh folk', data: { id: 'marsh-folk', name: 'Marsh folk' } });
    const more = (key: string, label: string, group: string, order: number, fill: string | null = null) =>
      world.tables.field_definitions.push({ id: `field-${key}`, campaign_id: campaign, applies_to: 'pc', key, label, type: 'text', choices: [], field_group: group, sort_order: order, show_on_card: false, hidden: false, fill, created_at: '2026-10-18T12:00:00Z' });
    more('race', 'Race', 'Identity', 5);
    more('MV', 'Movement', 'Combat', 6);
    more('hd', 'Hit dice', 'Identity', 7, 'hitDice');
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 3, race_ref: 'marsh-folk', fields: { STR: 12, MV: '90 ft' }, classes: [{ classRef: 'lantern-warden', level: 3, xp: 0 }] });
    world.addMember(campaign, me, 'player', reed);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Full character sheet' }));
    // The identity line (plan m5b-players-screens-standard D); the kindred and the calling each open their entry (ct3-11).
    expect((await screen.findAllByRole('button', { name: 'Marsh folk: open its entry' }))[0]!.parentElement?.textContent).toBe('Lantern Warden 3, Marsh folk');
    // Plan m5b-sheet-revised A1/A2: the name heads the left column on its own, the Identity group's fields are rows of
    // Details and backstory, and the Combat block is gone.
    expect(screen.getByRole('heading', { level: 1, name: 'Reed' })).toBeTruthy();
    const details = within(screen.getByRole('region', { name: 'Details and backstory' }));
    const valueOf = (label: string) => details.getByText(label).nextSibling?.textContent;
    expect(valueOf('Race')).toBe('Marsh folk');
    expect(valueOf('Hit dice')).toBe('3d8');
    expect(screen.queryByRole('region', { name: 'Combat' })).toBeNull();
  });

  // Ruled 2026-10-29 (B10), replacing the N30 guess: where the class is the race (no race picked), the Race row
  // shows the race the class names (its `race`), and without one it's left out; never a race named like the class.
  it("with no race picked, the sheet's Race reads the race the class names, and without one the row is left out", async () => {
    const { me, campaign } = fillWorld();
    world.tables.library_entries.push({ id: 'entry-marsh', pack_id: 'pack-fen', kind: 'race', pack_entry_id: 'marsh-folk', name: 'Marsh folk', data: { id: 'marsh-folk', name: 'Marsh folk' } });
    // A race named like the class: no longer taken to be its race.
    world.tables.library_entries.push({ id: 'entry-warden-kin', pack_id: 'pack-fen', kind: 'race', pack_entry_id: 'warden-kin', name: 'Lantern Warden', data: { id: 'warden-kin', name: 'Lantern Warden' } });
    world.tables.field_definitions.push({ id: 'field-race', campaign_id: campaign, applies_to: 'pc', key: 'race', label: 'Race', type: 'text', choices: [], field_group: 'Identity', sort_order: 5, show_on_card: false, hidden: false, fill: null, created_at: '2026-10-18T12:00:00Z' });
    world.tables.field_definitions.push({ id: 'field-motto', campaign_id: campaign, applies_to: 'pc', key: 'motto', label: 'Motto', type: 'text', choices: [], field_group: 'Identity', sort_order: 6, show_on_card: false, hidden: false, fill: null, created_at: '2026-10-18T12:00:00Z' });
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, race_ref: null, fields: { STR: 12 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
    world.addMember(campaign, me, 'player', reed);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    // The Player screen's header names no race either (ruled 2026-10-29: the same as the sheet).
    // dec-13 C2: the head's line is "the" kindred and the title; with neither (no race, no title here), no line at all.
    await screen.findByRole('heading', { name: 'Reed' });
    expect(document.querySelector('.player-head__line')).toBeNull();
    await openFullSheetFromMenu(user);
    // Plan m5b-sheet-revised A2: the Identity group's fields are Details and backstory rows.
    let identity = within(await screen.findByRole('region', { name: 'Details and backstory' }));
    expect(identity.getByText('Motto')).toBeTruthy();
    expect(identity.queryByText('Race')).toBeNull();
    cleanup();

    // The class names its race: the row shows it.
    (world.tables.library_entries.find((e) => e.pack_entry_id === 'lantern-warden')!.data as Record<string, unknown>).race = 'marsh-folk';
    const second = openApp();
    await second.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    // The Player screen's header shows the class's race too (ruled 2026-10-29).
    await screen.findByRole('heading', { name: 'Reed' });
    expect(document.querySelector('.player-head__line')?.textContent).toBe('the Marsh folk');
    await openFullSheetFromMenu(second);
    identity = within(await screen.findByRole('region', { name: 'Details and backstory' }));
    expect(identity.getByText('Race').nextSibling?.textContent).toBe('Marsh folk');
  });

  // Ruled 2026-10-29: B6 the GM's own label on an ability's field wins everywhere (it was dropped by the N3 fix);
  // B9 AC includes the ability modifier, tapping it lists the parts, and with no AC anywhere it's "—" and Set AC.
  // N24 (2026-10-28): with no max HP there's a quiet Set max.
  it("the GM's label names the ability, AC includes the modifier with its parts on a tap, and with no max HP a quiet Set max sets it", async () => {
    const { me, campaign } = fillWorld();
    const rules = world.tables.library_entries.find((e) => e.pack_entry_id === 'fen-rules')!.data as Record<string, unknown>;
    rules.attack = { unarmouredAC: { low: 8, high: 11 }, style: 'high' };
    rules.abilityModifiers = { STR: [{ range: '3-8', melee: -1, ac: -1 }, { range: '9-18', melee: 0, ac: 0 }] };
    rules.abilityModifierNotes = { STR: 'Adds to melee hits and to AC.' };
    rules.abilities = [{ key: 'STR', name: 'Muscle', blurb: 'Lifting, shoving and hitting hard.' }];
    world.tables.field_definitions.find((f) => f.key === 'STR')!.label = 'Brawn';
    world.tables.field_definitions.push({ id: 'field-ac', campaign_id: campaign, applies_to: 'pc', key: 'AC', label: 'AC', type: 'number', choices: [], field_group: 'Defense', sort_order: 3, show_on_card: false, hidden: false, fill: null, created_at: '2026-10-18T12:00:00Z' });
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 3, hp_current: 6, hp_max: null, fields: { STR: 5 }, classes: [{ classRef: 'lantern-warden', level: 3, xp: 0 }] });
    world.addMember(campaign, me, 'player', reed);
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));

    // AC at the top: the unarmoured value with the score's modifier in it; its pop-up lists both.
    const ac = await screen.findByRole('button', { name: "Armour class 10: how it's worked out" });
    await user.click(ac);
    const parts = within(await screen.findByRole('dialog', { name: 'Armour class' }));
    expect(parts.getByText('Unarmoured: 11')).toBeTruthy();
    expect(parts.getByText('Brawn: −1')).toBeTruthy();
    await user.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('button', { name: 'Set AC' })).toBeNull();

    // No max HP: the number, no bar, and Set max.
    expect(screen.getByRole('button', { name: 'Hit points 6. Type a value' })).toBeTruthy();
    expect(document.querySelector('.hp-bar')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Set max' }));
    await user.type(screen.getByLabelText('Max HP'), '0');
    await user.click(screen.getByRole('button', { name: 'Set' }));
    expect(await screen.findByText('Type a whole number of at least 1, like 8.')).toBeTruthy();
    await user.clear(screen.getByLabelText('Max HP'));
    await user.type(screen.getByLabelText('Max HP'), '9');
    await user.click(screen.getByRole('button', { name: 'Set' }));
    // Reed is approved, so the first Max HP waits for the GM like any Max HP change (Design on #567, ⚑ 3).
    expect(await screen.findByText('Sent to your GM: Max HP 9.')).toBeTruthy();
    expect(world.tables.actors.find((a) => a.id === reed)!.hp_max).toBeNull();
    expect(world.tables.sheet_changes.filter((c) => c.actor_id === reed).map((c) => [c.field, c.from_value, c.to_value, c.status])).toEqual([['hpMax', null, 9, 'waiting']]);

    // The sheet's tile reads the GM's label.
    await openFullSheetFromMenu(user);
    await screen.findByRole('region', { name: 'Level' });
    const tile = await screen.findByRole('button', { name: /^Brawn 5(, [^:]+)?: where it comes from$/ });
    expect(tile.textContent).toMatch(/^Brawn5/);
    expect(screen.getByRole('button', { name: "Armour class 10: how it's worked out" })).toBeTruthy();
    // The ability's pop-up: "Modifiers" first (sv-2a), then the setting's words, the blurb before the note (ruled 2026-10-29).
    await user.click(tile);
    const brawn = await screen.findByRole('dialog', { name: 'Brawn' });
    expect([...brawn.querySelectorAll('.breakdown-sheet__modifiers p.reading')].map((p) => p.textContent)).toEqual(['Melee: −1.', 'AC: −1.']);
    const lines = [...brawn.querySelectorAll('.breakdown-sheet__rule p.reading')].map((p) => p.textContent);
    expect(lines.slice(0, 2)).toEqual(['Lifting, shoving and hitting hard.', 'Adds to melee hits and to AC.']);
  });

  // fix-score-popup-repeats (Francis on his iPad, 2026-11-14: "Duplication."): a score's pop-up stacks the setting's
  // blurb, what the score affects and its note. Purpose: in the score pop-up, no line equals another line or is only
  // the start of another line ("Carrying" before "Carrying: …"), so each thing is said once, the fullest line kept;
  // and lines that differ all stay, even one that starts another's word ("Haul" before "Hauling").
  it('a score pop-up says each thing once: a repeated or cut-short line goes, lines that differ all stay', async () => {
    const openScorePopup = async (blurb: string, affects: string, note: string) => {
      world = createFakeDb();
      forgetCampaignSetting();
      sessionStorage.clear();
      localStorage.removeItem('grimoire.lastPlace');
      window.history.replaceState(null, '', '/');
      const { me, campaign } = fillWorld();
      const rules = world.tables.library_entries.find((e) => e.pack_entry_id === 'fen-rules')!.data as Record<string, unknown>;
      rules.abilityModifiers = { STR: [{ range: '3-8', melee: -1 }, { range: '9-18', melee: 0 }] };
      rules.abilityAffects = { STR: affects };
      rules.abilityModifierNotes = { STR: note };
      rules.abilities = [{ key: 'STR', name: 'Muscle', blurb }];
      const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
      Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 12 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
      world.addMember(campaign, me, 'player', reed);
      world.signInAs(me);
      const user = openApp();
      await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
      await openFullSheetFromMenu(user);
      await user.click(await screen.findByRole('button', { name: /^(Muscle|Strength) 12(, [^:]+)?: where it comes from$/ }));
      const dialog = await screen.findByRole('dialog', { name: /Muscle|Strength/ });
      // Its effects are under "Modifiers", said once there: a 12 is in the 9–18 row, which gives melee nothing (sv-2a).
      expect([...dialog.querySelectorAll('.breakdown-sheet__modifiers p.reading')].map((p) => p.textContent)).toEqual(['Melee: no change.']);
      // The setting's words on the score (the rule's lines, sv-2).
      const shown = [...dialog.querySelectorAll('.breakdown-sheet__rule p.reading')].map((p) => p.textContent);
      cleanup();
      return shown;
    };
    expect(await openScorePopup('Carrying', 'Carrying', 'Carrying: applies when hauling loads over rough ground.')).toEqual(['Carrying: applies when hauling loads over rough ground.']);
    // "What it affects" ("Melee hits") names the effects a second time where the score has a modifier table, so it
    // isn't shown (sv-2a: no effect named twice); "Haul" and "Hauling…" differ and both stay.
    expect(await openScorePopup('Haul', 'Melee hits', 'Hauling heavy loads is easier.')).toEqual(['Haul', 'Hauling heavy loads is easier.']);
  });

  // Ruled 2026-10-29 (Set AC): the AC typed is kept per character, with no campaign AC field, logged and undoable;
  // the breakdown says it was set by hand, and Clear brings the worked-out "—" back.
  it('with armour worn that the setting gives no AC for, AC is "—" with a quiet Set AC that keeps a per-character AC, cleared from its pop-up', async () => {
    const { me, campaign } = fillWorld();
    const rules = world.tables.library_entries.find((e) => e.pack_entry_id === 'fen-rules')!.data as Record<string, unknown>;
    rules.attack = { unarmouredAC: 11, style: 'ascending' };
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 12 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
    world.addMember(campaign, me, 'player', reed);
    world.tables.inventory_lines.push({ id: 'line-coat', campaign_id: campaign, actor_id: reed, location_id: null, library_entry_id: null, name: 'Moss coat', category: 'armour', weight_coin: null, slots: null, stack: 1, qty: 1, container_line_id: null, equipped: true, how_got: 'bought', cost: '', notes: '', item_data: { slot: 'armour', armour: { bulk: 'light' } }, source_pack_id: null, source_entry_id: null, charges_left: null, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null, pinned: false, at_hand_hidden: false, approval: 'approved', per_units: 1, created_at: '2026-10-23T10:00:00Z' });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));

    await user.click(await screen.findByRole('button', { name: "Armour class not known: how it's worked out" }));
    expect(within(await screen.findByRole('dialog', { name: 'Armour class' })).getByText('Moss coat: no AC in the setting rules')).toBeTruthy();
    await user.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Set AC' }));
    await user.type(screen.getByLabelText('AC'), '13');
    await user.click(screen.getByRole('button', { name: 'Set' }));
    await vi.waitFor(() => expect(world.tables.character_play.find((p) => p.actor_id === reed)?.ac_override).toBe(13));
    expect(await screen.findByRole('button', { name: "Armour class 13: how it's worked out" })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set AC' })).toBeNull();
    // Logged in the simple log; the character's fields are left alone.
    expect(world.tables.events.filter((e) => e.type === 'character.setAc').map((e) => e.level)).toEqual(['simple']);
    expect(world.tables.actors.find((a) => a.id === reed)!.fields).toEqual({ STR: 12 });
    // Undo on the toast takes it back to "—".
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(world.tables.character_play.find((p) => p.actor_id === reed)?.ac_override).toBeNull());
    expect(await screen.findByRole('button', { name: "Armour class not known: how it's worked out" })).toBeTruthy();

    // Set again; the pop-up says it was set by hand, and Clear brings the worked-out AC back (with Undo too).
    await user.click(screen.getByRole('button', { name: 'Set AC' }));
    await user.type(screen.getByLabelText('AC'), '-2');
    await user.click(screen.getByRole('button', { name: 'Set' }));
    await user.click(await screen.findByRole('button', { name: "Armour class −2: how it's worked out" }));
    const popup = within(await screen.findByRole('dialog', { name: 'Armour class' }));
    expect(popup.getByText('Set by hand: −2.')).toBeTruthy();
    expect(popup.getByText('Clear it to go back to "—".')).toBeTruthy();
    await user.click(popup.getByRole('button', { name: /^Clear the AC set by hand/ }));
    await vi.waitFor(() => expect(world.tables.character_play.find((p) => p.actor_id === reed)?.ac_override).toBeNull());
    expect(await screen.findByRole('button', { name: "Armour class not known: how it's worked out" })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(world.tables.character_play.find((p) => p.actor_id === reed)?.ac_override).toBe(-2));
  });

  // Ruled 2026-10-29 (armour.baseArmour: { choose }): until a base is chosen, AC reads "Choose base armour", not
  // "—"; a tap chooses it, AC is then the base's plus the magic bonus, and the choice is kept on the item and logged.
  it('worn magic armour with no base chosen reads "Choose base armour"; choosing one gives the real AC, kept on the item', async () => {
    const { me, campaign } = fillWorld();
    const rules = world.tables.library_entries.find((e) => e.pack_entry_id === 'fen-rules')!.data as Record<string, unknown>;
    rules.attack = { unarmouredAC: 10, style: 'ascending' };
    world.tables.library_entries.push({ id: 'entry-reed-coat', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'reed-coat', name: 'Reed coat', data: { id: 'reed-coat', name: 'Reed coat', slot: 'armour', armour: { base: 13 } } });
    world.tables.library_entries.push({ id: 'entry-bark-vest', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'bark-vest', name: 'Bark vest', data: { id: 'bark-vest', name: 'Bark vest', slot: 'armour', armour: { base: 12 } } });
    const reed = world.addCharacter(campaign, 'Reed', { ownerId: me });
    Object.assign(world.tables.actors.find((a) => a.id === reed)!, { level: 1, hp_current: 6, hp_max: 6, fields: { STR: 12 }, classes: [{ classRef: 'lantern-warden', level: 1, xp: 0 }] });
    world.addMember(campaign, me, 'player', reed);
    world.tables.inventory_lines.push({ id: 'line-glimmer', campaign_id: campaign, actor_id: reed, location_id: null, library_entry_id: null, name: 'Glimmer mail', category: 'armour', weight_coin: null, slots: null, stack: 1, qty: 1, container_line_id: null, equipped: true, how_got: 'found', cost: '', notes: '', item_data: { slot: 'armour', armour: { magicBonus: 1, baseArmour: { choose: ['reed-coat', 'bark-vest'] } } }, source_pack_id: null, source_entry_id: null, charges_left: null, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null, pinned: false, at_hand_hidden: false, approval: 'approved', per_units: 1, base_armour_id: null, version: 1, created_at: '2026-10-23T10:00:00Z' });
    world.signInAs(me);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));

    const tile = await screen.findByRole('button', { name: 'Armour class: choose the base armour for Glimmer mail' });
    expect(tile.textContent).toContain('Choose base armour');
    expect(screen.queryByRole('button', { name: 'Set AC' })).toBeNull();
    await user.click(tile);
    const choose = within(await screen.findByRole('dialog', { name: 'Base armour for Glimmer mail' }));
    expect(choose.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Reed coat', 'Bark vest']);
    await user.click(choose.getByRole('radio', { name: 'Reed coat' }));
    await vi.waitFor(() => expect(world.tables.inventory_lines.find((l) => l.id === 'line-glimmer')!.base_armour_id).toBe('reed-coat'));
    // 13 for the reed coat, +1 for the magic.
    expect(await screen.findByRole('button', { name: "Armour class 14: how it's worked out" })).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'inventory.setBaseArmour').map((e) => e.level)).toEqual(['simple']);
  });

  it('the GM sets "New characters need approval" and "New characters start at" on the Rules tab', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: /^Characters/ }));
    const approval = within(await screen.findByRole('group', { name: 'New characters need approval' }));
    expect(approval.getByRole('button', { name: 'Yes' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(approval.getByRole('button', { name: 'No' }));
    const start = within(screen.getByRole('radiogroup', { name: 'New characters start at' }));
    expect(start.getByRole('radio', { name: /^Player proposes, GM approves/ }).getAttribute('aria-checked')).toBe('true');
    await user.click(start.getByRole('radio', { name: /^Party's lowest/ }));
    await waitFor(() => expect(world.tables.campaigns.find((c) => c.id === campaign)!.settings).toMatchObject({ characterApproval: false, startLevel: 'lowest' }));
  });
});

describe('the single top row (2026-10-23)', () => {
  it("Your campaigns has the header with the app's wordmark and the account ⋯", async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.addCampaign('The Ash Barrows', gm);
    world.signInAs(gm);
    const user = openApp();
    expect(await screen.findByRole('heading', { name: 'Your campaigns' })).toBeTruthy();
    const header = screen.getByRole('banner');
    expect(within(header).getByText(BRAND.appName)).toBeTruthy();
    await user.click(within(header).getByRole('button', { name: 'Account and device options' }));
    expect(screen.getByText('This device')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rules library' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it("inside a GM's campaign: no header, the back link says Your campaigns (the heading names the campaign), ⋯ still has This device, Rules library and Sign out", async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.addCampaign('The Ash Barrows', gm);
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    expect(await screen.findByRole('button', { name: 'Invite a player' })).toBeTruthy();
    expect(screen.queryByRole('banner')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Account and device options' }));
    expect(screen.getByText('This device')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Rules library' }));
    expect(await screen.findByRole('heading', { name: 'Rules library' })).toBeTruthy();
    // Outside a campaign the back link says where it goes.
    expect(screen.queryByRole('banner')).toBeNull();
    await user.click(screen.getByRole('button', { name: '‹ Your campaigns' }));
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));

    await user.click(await screen.findByRole('button', { name: '‹ Your campaigns' }));
    expect(await screen.findByRole('heading', { name: 'Your campaigns' })).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();
  });

  it('starting a new campaign has a top row back to Your campaigns, without the header', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: '+ Start a new campaign (as GM)' }));
    expect(screen.queryByRole('banner')).toBeNull();
    await user.click(screen.getByRole('button', { name: '‹ Your campaigns' }));
    expect(await screen.findByRole('heading', { name: 'Your campaigns' })).toBeTruthy();
  });
});

describe('the ⋯ menu', () => {
  it('opens and closes with Escape or a tap outside, and offers Sign out only when signed in', async () => {
    const user = openApp();
    await screen.findByLabelText('Email');

    await openMenu(user);
    expect(screen.getByText('This device')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('This device')).toBeNull();

    await openMenu(user);
    await user.click(screen.getByText('Email'));
    expect(screen.queryByText('This device')).toBeNull();

    await signIn(user, 'wren@lantern.example');
    await screen.findByLabelText('Your name');
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Email me a code' })).toBeTruthy();
  });
});

describe('several characters, removing and restoring', () => {
  // Downloads: remember the file names instead of saving (the pretend browser can't save files).
  let downloaded: string[];
  beforeEach(() => {
    downloaded = [];
    URL.createObjectURL = vi.fn(() => 'blob:copy');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloaded.push(this.download);
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function playerWithCharacters() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: player });
    const tobin = world.addCharacter(campaign, 'Old Tobin', { ownerId: player });
    world.addMember(campaign, player, 'player', wren);
    return { gm, player, campaign, wren, tobin };
  }

  it('a player makes another character, and switches which approved one is active', async () => {
    const { player } = playerWithCharacters();
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await openYourCharacters(user);

    // A8 (ruled 2026-10-25): tapping a card makes that character active and goes to its Player screen.
    await user.click(await screen.findByRole('button', { name: 'Open Old Tobin' }));
    expect(await screen.findByRole('heading', { name: 'Old Tobin' })).toBeTruthy();
    await openYourCharacters(user);
    expect(await screen.findByRole('button', { name: 'Open Wren' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '+ Make another character' }));
    await user.type(await screen.findByLabelText('Name'), 'Hollis');
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    await user.click(await screen.findByRole('button', { name: 'Back to The Ash Barrows' }));
    // Back on Old Tobin's Player screen; the new character waits in the list.
    expect(await screen.findByRole('heading', { name: 'Old Tobin' })).toBeTruthy();
    await openYourCharacters(user);
    expect(await screen.findByText("Level 1, waiting for your GM's approval.")).toBeTruthy();
  });

  it('a player deletes a waiting character after downloading a copy', async () => {
    const { player, campaign } = playerWithCharacters();
    world.addCharacter(campaign, 'Hollis', { ownerId: player, approval: 'pending' });
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await openYourCharacters(user);

    await user.click(await screen.findByRole('button', { name: 'Delete… Hollis' }));
    expect(screen.getByText('They were never approved, so they are deleted for good.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Download a copy' }));
    expect(await screen.findByText('Copy of Hollis downloaded.')).toBeTruthy();
    expect(downloaded).toEqual([expect.stringMatching(/^hollis-\d{4}-\d{2}-\d{2}\.json$/)]);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Hollis was deleted.')).toBeTruthy();
    expect(world.tables.actors.some((a) => a.name === 'Hollis')).toBe(false);
  });

  it('removing the active character archives it, and the player is offered to make one again', async () => {
    const { player, campaign } = playerWithCharacters();
    world.tables.actors = world.tables.actors.filter((a) => a.name !== 'Old Tobin');
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await openYourCharacters(user);

    await user.click(await screen.findByRole('button', { name: 'Remove… Wren' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText(/Wren was removed from The Ash Barrows/)).toBeTruthy();
    // Archived characters sit in a collapsed section; opening it shows them with a download.
    const archivedSection = screen.getByText('Archived characters (1)').closest('details')!;
    expect(archivedSection.open).toBe(false);
    await user.click(screen.getByText('Archived characters (1)'));
    expect(archivedSection.open).toBe(true);
    expect(within(archivedSection).getByText('Archived, level 1')).toBeTruthy();
    await user.click(within(archivedSection).getByRole('button', { name: 'Download a copy of Wren' }));
    expect(await within(archivedSection).findByText('Copy of Wren downloaded.')).toBeTruthy();
    expect(downloaded).toEqual([expect.stringMatching(/^wren-/)]);
    expect(screen.getByRole('button', { name: 'Create your character' })).toBeTruthy();
    expect(world.tables.actors.find((a) => a.name === 'Wren')).toMatchObject({ status: 'archived' });
    expect(world.tables.members.find((m) => m.campaign_id === campaign && m.user_id === player)?.active_actor_id).toBeNull();

    // The player can delete it for good, after a plain "are you sure" (no typing).
    await user.click(within(archivedSection).getByRole('button', { name: 'Delete permanently… Wren' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(await screen.findByText('Wren was deleted.')).toBeTruthy();
    expect(world.tables.actors.some((a) => a.name === 'Wren')).toBe(false);
  });

  it('the GM restores an archived character, or deletes one permanently after a plain confirm', async () => {
    const { gm, tobin, wren } = playerWithCharacters();
    for (const id of [tobin, wren]) world.tables.actors.find((a) => a.id === id)!.status = 'archived';
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);

    expect(await screen.findByText('Archived characters')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Restore Wren' }));
    expect(await screen.findByText(/Wren is back in the campaign/)).toBeTruthy();
    expect(world.tables.actors.find((a) => a.id === wren)).toMatchObject({ status: 'active' });

    await user.click(await screen.findByRole('button', { name: 'Delete permanently… Old Tobin' }));
    expect(screen.getByText("This can't be undone. Download a copy first if you might want them again.")).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(await screen.findByText('Old Tobin was deleted.')).toBeTruthy();
    expect(world.tables.actors.some((a) => a.id === tobin)).toBe(false);
  });
});

describe('character fields', () => {
  function campaignWithFields() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, player, 'player');
    const add = (row: Record<string, unknown>) =>
      world.tables.field_definitions.push({
        id: `field-${String(row.key)}`,
        campaign_id: campaign,
        applies_to: 'pc',
        choices: [],
        field_group: '',
        show_on_card: false,
        hidden: false,
        created_at: '2026-10-19T12:00:00Z',
        ...row,
      });
    add({ key: 'path', label: 'Path', type: 'list', choices: ['Lantern Warden', 'Reedblade'], field_group: 'Calling', sort_order: 0, show_on_card: true });
    add({ key: 'might', label: 'Might', type: 'number', field_group: 'Calling', sort_order: 1 });
    add({ key: 'old_oath', label: 'Old oath', type: 'text', sort_order: 2, hidden: true });
    return { gm, player, campaign };
  }

  it('the GM adds a list field and a number field, reorders, hides, and deletes an unused one', async () => {
    world.signInAs(world.addPerson('priya@lantern.example', 'Priya'));
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: '+ Start a new campaign (as GM)' }));
    await user.type(screen.getByLabelText('Campaign name'), 'The Lantern Road');
    await user.click(screen.getByRole('button', { name: 'Create campaign now' }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    // A collapsible group in Rules for this campaign (N20); with no setting rules it's there to start the sheet.
    await user.click(await screen.findByRole('button', { name: 'Character fields, None yet' }));
    expect(await screen.findByText(/No fields yet/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '+ Add a field' }));
    await user.type(screen.getByLabelText('Name'), 'Path');
    await user.selectOptions(screen.getByLabelText('Type'), 'List');
    await user.type(screen.getByLabelText('Choices, one per line'), 'Lantern Warden{Enter}Reedblade');
    // A category is picked from those in use, or "New category…" to type one (ruled 2026-10-26).
    await user.selectOptions(screen.getByLabelText('Category (optional)'), 'New category…');
    await user.type(screen.getByLabelText('New category'), 'Calling');
    await user.click(screen.getByLabelText('Show on the character card'));
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    expect(await screen.findByText('List: Lantern Warden, Reedblade, Calling, on the card')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '+ Add a field' }));
    await user.type(screen.getByLabelText('Name'), 'Might');
    await user.selectOptions(screen.getByLabelText('Type'), 'Number');
    expect(within(screen.getByLabelText('Category (optional)')).getByRole('option', { name: 'Calling' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add field' }));
    expect(await screen.findByText('Might was added.')).toBeTruthy();

    // Tapping a field's row opens it, as Edit does (ruled 2026-10-26).
    await user.click(screen.getByText('List: Lantern Warden, Reedblade, Calling, on the card'));
    expect((screen.getByLabelText('Category (optional)') as HTMLSelectElement).value).toBe('Calling');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Moved by its row's control (the hold-to-move list's keyboard and screen-reader way; ruled 2026-10-25).
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Move Might' }), { key: 'ArrowUp' });
    await vi.waitFor(() => {
      const names = screen.getAllByText(/^(Path|Might)$/).map((el) => el.textContent);
      expect(names).toEqual(['Might', 'Path']);
    });

    await user.click(screen.getByRole('button', { name: 'Hide Might' }));
    expect(await screen.findByText('Hidden fields (1)')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Delete Might' }));
    expect(await screen.findByText('Might was deleted.')).toBeTruthy();
    expect(world.tables.field_definitions.map((f) => f.label)).toEqual(['Path']);
  });

  it("a player fills in the GM's fields; hidden ones aren't asked; the GM sees the values when approving", async () => {
    const { gm, player } = campaignWithFields();
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));

    expect(await screen.findByText('Calling')).toBeTruthy();
    expect(screen.queryByLabelText('Old oath')).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Hollis');
    await user.selectOptions(await screen.findByLabelText('Path'), 'Reedblade');
    await user.type(screen.getByLabelText('Might'), 'lots');
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Might must be a whole number (it can be negative).');
    await user.clear(screen.getByLabelText('Might'));
    await user.type(screen.getByLabelText('Might'), '-1');
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    expect(await screen.findByRole('heading', { name: 'Hollis is ready' })).toBeTruthy();
    expect(world.tables.actors.find((a) => a.name === 'Hollis')?.fields).toEqual({ path: 'Reedblade', might: -1 });

    // The GM's turn.
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    world.signInAs(gm);
    cleanup();
    const gmUser = openApp();
    await gmUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(gmUser);
    expect(await screen.findByText('Path: Reedblade')).toBeTruthy();
    expect(screen.getByText('Might: -1')).toBeTruthy();
  });

  it("a field a character has filled in can be hidden but not deleted", async () => {
    const { gm, campaign, player } = campaignWithFields();
    const hollis = world.addCharacter(campaign, 'Hollis', { ownerId: player });
    world.tables.actors.find((a) => a.id === hollis)!.fields = { might: 2 };
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: 'Character fields, 3 fields' }));
    expect(await screen.findByRole('button', { name: 'Hide Might' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete Might' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Path' })).toBeTruthy();
  });
});

describe('portraits', () => {
  const photo = () => new File(['a photo'], 'hollis.jpg', { type: 'image/jpeg' });
  const pictureIn = (element: HTMLElement) => element.querySelector('img.portrait__img')?.getAttribute('src');

  function joinedPlayer() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, player, 'player');
    return { gm, player, campaign };
  }

  it('a player adds a portrait under the name; it is uploaded with the character and shows on their card', async () => {
    const { player } = joinedPlayer();
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));

    await user.type(await screen.findByLabelText('Name'), 'Hollis');
    await user.upload(screen.getByLabelText('Add a portrait (optional)'), photo());
    expect(await screen.findByText('Change portrait')).toBeTruthy();
    expect(pictureIn(document.body)).toBe('blob:preview');

    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    expect(await screen.findByRole('heading', { name: 'Hollis is ready' })).toBeTruthy();
    const hollis = world.tables.actors.find((a) => a.name === 'Hollis')!;
    const path = `${String(hollis.campaign_id)}/${String(hollis.portrait_asset_id)}`;
    expect(world.files.has(path)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Back to The Ash Barrows' }));
    const card = (await screen.findByText("Level 1, waiting for your GM's approval.")).closest('.character-card') as HTMLElement;
    await vi.waitFor(() => expect(pictureIn(card)).toBe(`https://files.example/${path}?signed`));
  });

  it('a photo that cannot be read gets a plain message', async () => {
    const { player } = joinedPlayer();
    shrink.fail = "Couldn't read that picture. Try a JPEG or PNG.";
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Create your character' }));
    await user.upload(await screen.findByLabelText('Add a portrait (optional)'), photo());
    expect((await screen.findByRole('alert')).textContent).toBe("Couldn't read that picture. Try a JPEG or PNG.");
  });

  it("the GM sees the waiting character's portrait, and a player's picker row shows their active character's portrait", async () => {
    const { gm, player, campaign } = joinedPlayer();
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: player });
    world.tables.members.find((m) => m.user_id === player)!.active_actor_id = wren;
    world.tables.assets.push({ id: 'asset-wren', campaign_id: campaign, kind: 'portrait', uploaded_by: player, visibility: 'all' });
    world.files.set(`${campaign}/asset-wren`, new Blob(['wren']));
    world.tables.actors.find((a) => a.id === wren)!.portrait_asset_id = 'asset-wren';

    world.signInAs(player);
    const user = openApp();
    const row = (await screen.findByRole('button', { name: /The Ash Barrows/ })) as HTMLElement;
    await vi.waitFor(() => expect(pictureIn(row)).toBe(`https://files.example/${campaign}/asset-wren?signed`));

    // The GM's view of the same picture, on the player list.
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    cleanup();
    world.signInAs(gm);
    const gmUser = openApp();
    await gmUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(gmUser);
    const line = (await screen.findByText('Wren', { selector: '.gm__row-name' })).closest('.gm__character-row') as HTMLElement;
    await vi.waitFor(() => expect(pictureIn(line)).toBe(`https://files.example/${campaign}/asset-wren?signed`));
    // The character's own line names its player (ruled 2026-10-26: no player column).
    expect(line.textContent).toMatch(/, joined /);
  });

  it("a player changes an approved character's portrait from its card", async () => {
    const { player, campaign } = joinedPlayer();
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: player });
    world.tables.members.find((m) => m.user_id === player)!.active_actor_id = wren;
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await openYourCharacters(user);
    await user.upload(await screen.findByLabelText('Add a portrait for Wren'), photo());
    expect(await screen.findByText("Wren's portrait was saved.")).toBeTruthy();
    expect(world.tables.actors.find((a) => a.id === wren)?.portrait_asset_id).toBeTruthy();
  });

  // Purpose (review on #561): the busy guard covers buttons only, so a second picture picked on the card while the
  // first still saves must wait and say so, never upload twice.
  it('a second picture picked on the card while the first saves waits, and a sheet says why', async () => {
    const { player, campaign } = joinedPlayer();
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: player });
    world.tables.members.find((m) => m.user_id === player)!.active_actor_id = wren;
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await openYourCharacters(user);
    const input = await screen.findByLabelText('Add a portrait for Wren');
    fireEvent.change(input, { target: { files: [photo()] } });
    fireEvent.change(input, { target: { files: [photo()] } });
    const sheet = await screen.findByRole('dialog', { name: 'Still saving' });
    expect(sheet.textContent).toContain("Wren's last picture is still saving. Pick this one again in a moment.");
    expect(await screen.findByText("Wren's portrait was saved.")).toBeTruthy();
    expect(world.tables.assets.length).toBe(1);
  });
});


describe('campaign name and sigil', () => {
  const sigilFile = () => new File(['a sigil'], 'sigil.png', { type: 'image/png' });
  const pictureIn = (element: HTMLElement) => element.querySelector('img.portrait__img')?.getAttribute('src');

  it('the GM renames the campaign and adds a sigil; both show on the Campaign screen and the picker', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));

    await user.click(await screen.findByRole('button', { name: 'Change the campaign sigil' }));
    const name = screen.getByLabelText('Campaign name');
    await user.clear(name);
    await user.type(name, 'The Reedmouth Delve');
    await user.upload(screen.getByLabelText('Add a sigil (optional)'), sigilFile());
    expect(await screen.findByText('Change sigil')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Campaign saved.')).toBeTruthy();
    const heading = await screen.findByRole('heading', { name: 'The Reedmouth Delve' });
    const sigilId = world.tables.campaigns.find((c) => c.id === campaign)?.sigil_asset_id;
    expect(sigilId).toBeTruthy();
    const link = `https://files.example/${campaign}/${String(sigilId)}?signed`;
    await vi.waitFor(() => expect(pictureIn(heading.parentElement!)).toBe(link));
    // On the GM screen the back link just says where it goes; the heading carries the name (2026-10-23).
    await user.click(screen.getByRole('button', { name: '‹ Your campaigns' }));
    const row = (await screen.findByRole('button', { name: /The Reedmouth Delve/ })) as HTMLElement;
    await vi.waitFor(() => expect(pictureIn(row)).toBe(link));
  });

  it('a blank name is refused; removing the sigil brings back the letter and deletes the picture', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.assets.push({ id: 'asset-sigil', campaign_id: campaign, kind: 'sigil', uploaded_by: gm, visibility: 'all' });
    world.files.set(`${campaign}/asset-sigil`, new Blob(['sigil']));
    world.tables.campaigns.find((c) => c.id === campaign)!.sigil_asset_id = 'asset-sigil';
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));

    await user.click(await screen.findByRole('button', { name: 'The Ash Barrows' }));
    await user.clear(screen.getByLabelText('Campaign name'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Give the campaign a name.');

    await user.type(screen.getByLabelText('Campaign name'), 'The Ash Barrows');
    await user.click(screen.getByRole('button', { name: 'Remove sigil' }));
    expect(screen.getByText('Add a sigil (optional)')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const heading = await screen.findByRole('heading', { name: 'The Ash Barrows' });
    await vi.waitFor(() => expect(heading.parentElement!.querySelector('.portrait')?.textContent).toBe('A'));
    expect(world.tables.campaigns.find((c) => c.id === campaign)?.sigil_asset_id).toBeNull();
    expect(world.files.has(`${campaign}/asset-sigil`)).toBe(false);
  });

  it("a player sees the sigil on their campaign page and picker row (their portrait wins), but can't edit it", async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, player, 'player');
    world.tables.assets.push({ id: 'asset-sigil', campaign_id: campaign, kind: 'sigil', uploaded_by: gm, visibility: 'all' });
    world.files.set(`${campaign}/asset-sigil`, new Blob(['sigil']));
    world.tables.campaigns.find((c) => c.id === campaign)!.sigil_asset_id = 'asset-sigil';
    const link = `https://files.example/${campaign}/asset-sigil?signed`;
    world.signInAs(player);
    const user = openApp();

    const row = (await screen.findByRole('button', { name: /The Ash Barrows/ })) as HTMLElement;
    await vi.waitFor(() => expect(pictureIn(row)).toBe(link));
    await user.click(row);
    const heading = await screen.findByRole('heading', { name: 'The Ash Barrows' });
    await vi.waitFor(() => expect(pictureIn(heading.parentElement!)).toBe(link));
    expect(screen.queryByRole('button', { name: 'Change the campaign sigil' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'The Ash Barrows' })).toBeNull();
  });
});

describe('the GM’s sections (ruled 2026-10-23)', () => {
  it('are Scene, Players, Rules, opening on Scene (ruled 2026-10-29); Players holds players and characters, Companies and the Party stash; ⋯ holds This device, Rules library and Sign out', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.addCampaign('The Ash Barrows', gm);
    world.signInAs(gm);
    // The menu opened on this device before (mn-1: folded is the default for anyone who hasn't chosen).
    localStorage.setItem('grimoire.navCollapsed', 'no');
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const tabs = within(await screen.findByRole('navigation', { name: 'Campaign sections' }));
    // The fold is the divider handle beside the list (lr-4), not a row in it.
    expect(tabs.getAllByRole('button').map((b) => b.textContent)).toEqual(['Scene', 'Players', 'Rules']);
    // The divider handle folds the column (shown only on a landscape tablet) and the fold is remembered on this device.
    await user.click(screen.getByRole('button', { name: 'Fold the menu' }));
    expect(screen.getByRole('navigation', { name: 'Campaign sections' }).className).toContain('section-nav--collapsed');
    expect(localStorage.getItem('grimoire.navCollapsed')).toBe('yes');
    await user.click(screen.getByRole('button', { name: 'Show the menu' }));
    expect(localStorage.getItem('grimoire.navCollapsed')).toBe('no');
    // The GM's campaign opens on Scene, the console; Players is one tap away.
    expect(tabs.getByRole('button', { name: 'Scene' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('heading', { name: 'Players and characters' })).toBeNull();
    await gmPlayers(user);
    expect(await screen.findByRole('heading', { name: 'Players and characters' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Companies' })).toBeTruthy();
    // Nothing waits, so no count and no Waiting for you.
    expect(tabs.getByRole('button', { name: 'Players' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Waiting for you' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Inventory' }));
    expect(await screen.findByRole('heading', { name: 'Party stash' })).toBeTruthy();
    // One ⋯ menu everywhere in the campaign (N17): the stash's ⋯ has Companies too, and it goes back to Players.
    await user.click(screen.getByRole('button', { name: 'Account and device options' }));
    await user.click(screen.getByRole('button', { name: 'Companies' }));
    expect(await screen.findByRole('heading', { name: 'Players and characters' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Inventory' }));
    await user.click(await screen.findByRole('button', { name: '‹ Players' }));
    await screen.findByRole('heading', { name: 'Players and characters' });

    await user.click(screen.getByRole('button', { name: 'Account and device options' }));
    expect(screen.getByText('This device')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rules library' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    // The log opens from the top row, not a section.
    expect(screen.getByRole('button', { name: 'Log' })).toBeTruthy();
  });
});

describe('companies', () => {
  function party() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: player });
    world.addMember(campaign, player, 'player', wren);
    world.addCharacter(campaign, 'Hollis', { ownerId: player, approval: 'pending' });
    return { gm, player, campaign, wren };
  }

  async function openCompanies(user: ReturnType<typeof openApp>) {
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    await screen.findByRole('heading', { name: 'Companies' });
  }

  it('a player founds a company with a co-founder from the Company page; the co-founder accepts and becomes a founder', async () => {
    const { gm, player, campaign } = party();
    const jo = world.addPerson('jo@lantern.example', 'Jo');
    const ash = world.addCharacter(campaign, 'Ash', { ownerId: jo });
    world.addMember(campaign, jo, 'player', ash);
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(screen.getByRole('button', { name: 'Company' }));
    const found = within(await screen.findByRole('form', { name: 'Found a company' }));
    await user.type(found.getByLabelText('Name'), 'The Reed Cutters');
    await user.click(found.getByRole('checkbox', { name: 'Ash' }));
    await user.click(found.getByRole('button', { name: 'Found it' }));
    expect(await screen.findByRole('heading', { name: 'The Reed Cutters' })).toBeTruthy();
    expect(world.tables.company_invitations).toMatchObject([{ kind: 'cofounder', status: 'open' }]);

    cleanup();
    world.signInAs(jo);
    const joUser = openApp();
    await joUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await joUser.click(await screen.findByRole('button', { name: 'Character options' }));
    await joUser.click(screen.getByRole('button', { name: 'Company' }));
    const invitation = within(await screen.findByRole('group', { name: 'Invitation from The Reed Cutters' }));
    expect(invitation.getByText(/as a co-founder/)).toBeTruthy();
    await joUser.click(invitation.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.getAllByText('Ash').filter((el) => !el.closest('.top-row'))).not.toHaveLength(0));
    expect(world.tables.companies.find((c) => c.name === 'The Reed Cutters')?.founder_ids).toHaveLength(2);
    void gm;
  });

  // A12 (M4b gate 2026-10-25): a phone that was asleep missed the GM's change until a refresh.
  it('a change made while the app was in the background shows when it comes back, without a refresh', async () => {
    const { player, campaign } = party();
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    expect(screen.getByRole('button', { name: 'Company' })).toBeTruthy();
    await user.keyboard('{Escape}');
    // Switched off elsewhere while this device wasn't listening (no live message arrives).
    world.tables.campaigns.find((c) => c.id === campaign)!.settings = { companies: false };
    window.dispatchEvent(new Event('focus'));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Company' })).toBeNull());
  });

  it('with companies switched off, players have no Company page and the GM no Companies section', async () => {
    const { gm, player, campaign } = party();
    world.tables.campaigns.find((c) => c.id === campaign)!.settings = { companies: false };
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    expect(screen.queryByRole('button', { name: 'Company' })).toBeNull();
    cleanup();
    world.signInAs(gm);
    const gmUser = openApp();
    await gmUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(gmUser);
    await screen.findByRole('heading', { name: 'Players and characters' });
    expect(screen.queryByRole('heading', { name: 'Companies' })).toBeNull();
  });

  // Purpose (review on #561): the busy guard covers buttons only, so a company chosen while the last choice still
  // saves must wait and say so, never send two moves at once.
  it('a company chosen while the last choice saves waits, and a sheet says why', async () => {
    const { gm } = party();
    world.signInAs(gm);
    const user = openApp();
    await openCompanies(user);
    await user.click(await screen.findByRole('button', { name: 'Companies options' }));
    await user.click(screen.getByRole('button', { name: 'New company (GM)' }));
    await user.type(screen.getByLabelText('Company name'), 'The Sluice Gate Company');
    await user.click(screen.getByRole('button', { name: 'Create company' }));
    expect(await screen.findByText('The Sluice Gate Company was created.')).toBeTruthy();
    const select = await screen.findByLabelText('Company for Wren');
    const company = [...(select as HTMLSelectElement).options].find((o) => o.text === 'The Sluice Gate Company')!.value;
    fireEvent.change(select, { target: { value: company } });
    fireEvent.change(screen.getByLabelText('Company for Hollis'), { target: { value: company } });
    const sheet = await screen.findByRole('dialog', { name: 'Still saving' });
    expect(sheet.textContent).toContain("The last change is still saving. Choose Hollis's company again in a moment.");
    expect(await screen.findByText('Wren is now in The Sluice Gate Company.')).toBeTruthy();
    expect(screen.queryByText('Hollis is now in The Sluice Gate Company.')).toBeNull();
  });

  it('the GM makes a company and places characters, waiting ones too; the player sees it on their picker row and card', async () => {
    const { gm, player } = party();
    world.signInAs(gm);
    const user = openApp();
    await openCompanies(user);
    expect(await screen.findByText('No companies yet.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Companies options' }));
    await user.click(screen.getByRole('button', { name: 'New company (GM)' }));
    await user.click(screen.getByRole('button', { name: 'Create company' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Give the company a name.');
    await user.type(screen.getByLabelText('Company name'), 'The Sluice Gate Company');
    await user.click(screen.getByRole('button', { name: 'Create company' }));
    expect(await screen.findByText('The Sluice Gate Company was created.')).toBeTruthy();

    await user.selectOptions(await screen.findByLabelText('Company for Wren'), 'The Sluice Gate Company');
    expect(await screen.findByText('Wren is now in The Sluice Gate Company.')).toBeTruthy();
    await user.selectOptions(await screen.findByLabelText('Company for Hollis'), 'The Sluice Gate Company');
    expect(await screen.findByText('Hollis is now in The Sluice Gate Company.')).toBeTruthy();
    expect(await screen.findByText('Wren, Hollis')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Rename The Sluice Gate Company' }));
    const name = screen.getByLabelText('Company name');
    await user.clear(name);
    await user.type(name, 'The Reed Cutters');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Renamed to The Reed Cutters.')).toBeTruthy();

    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    cleanup();
    world.signInAs(player);
    const playerUser = openApp();
    const row = await screen.findByRole('button', { name: /The Ash Barrows/ });
    expect(row.textContent).toContain('Player, Wren, The Reed Cutters');
    await playerUser.click(row);
    // The company is the level block's since dec-13 C2.
    expect(await screen.findByText('The Reed Cutters')).toBeTruthy();
    await openYourCharacters(playerUser);
    const card = (await screen.findByText('Playing, level 1')).closest('.character-card') as HTMLElement;
    expect(within(card).getByText('The Reed Cutters')).toBeTruthy();
  });

  it('a company with characters in it offers no Delete; once they move out, the GM deletes it', async () => {
    const { gm, campaign, wren } = party();
    world.tables.companies.push({ id: 'company-reed', campaign_id: campaign, name: 'The Reed Cutters' });
    world.tables.actors.find((a) => a.id === wren)!.company_id = 'company-reed';
    world.signInAs(gm);
    const user = openApp();
    await openCompanies(user);

    expect(await screen.findByRole('button', { name: 'Rename The Reed Cutters' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete The Reed Cutters' })).toBeNull();
    await user.selectOptions(screen.getByLabelText('Company for Wren'), 'No company');
    expect(await screen.findByText('Wren is in no company now.')).toBeTruthy();

    await user.click(await screen.findByRole('button', { name: 'Delete The Reed Cutters' }));
    expect(await screen.findByText('The Reed Cutters was deleted.')).toBeTruthy();
    expect(world.tables.companies.some((c) => c.id === 'company-reed')).toBe(false);
    expect(await screen.findByText('No companies yet.')).toBeTruthy();
  });
});

describe('the Player screen', () => {
  function playing(hp: { current: number | null; max: number | null } = { current: null, max: 14 }) {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: player });
    world.addMember(campaign, player, 'player', wren);
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
      level: 3,
      hp_current: hp.current,
      hp_max: hp.max,
      fields: { folk: 'Marsh folk', might: 13, motto: 'Onward' },
    });
    const field = (key: string, label: string, type: string, sort: number, onCard: boolean) =>
      world.tables.field_definitions.push({
        id: `field-${key}`,
        campaign_id: campaign,
        applies_to: 'pc',
        key,
        label,
        type,
        choices: [],
        field_group: '',
        sort_order: sort,
        show_on_card: onCard,
        hidden: false,
        created_at: '2026-10-19T12:00:00Z',
      });
    field('folk', 'Folk', 'text', 1, true);
    field('might', 'Might', 'number', 2, true);
    field('motto', 'Motto', 'text', 3, false);
    world.signInAs(player);
    return { campaign, wren };
  }
  const hpOf = (id: string) => world.tables.actors.find((a) => a.id === id)?.hp_current;

  it('opening a campaign with an active character shows its Player screen; ⋯ → Your characters opens the list and back', async () => {
    playing();
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));

    expect(await screen.findByRole('heading', { name: 'Wren' })).toBeTruthy();
    expect(await screen.findByText('Marsh folk, Might 13, Level 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hit points 14 of 14. Type a value' })).toBeTruthy();

    await openYourCharacters(user);
    expect(await screen.findByText('Playing, level 3, 14 HP')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '‹ Back to Wren' }));
    expect(await screen.findByRole('heading', { name: 'Wren' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '‹ The Ash Barrows' }));
    expect(await screen.findByRole('heading', { name: 'Your campaigns' })).toBeTruthy();
  });

  it("one top row: no header with the app's name, the back link names the campaign, and ⋯ holds the character's options, This device, Rules library and Sign out", async () => {
    playing();
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    expect(await screen.findByRole('heading', { name: 'Wren' })).toBeTruthy();

    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByText(BRAND.appName)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Account and device options' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Character options' }));
    for (const name of ['Your characters', 'Full character sheet', 'Setting rules', 'Rules library', 'Sign out']) {
      expect(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name })).toBeTruthy();
    }
    // Ruling 3 (2026-10-26): Arrange this screen is hidden until the Player screen redesign.
    expect(screen.queryByRole('button', { name: 'Arrange this screen' })).toBeNull();
    expect(screen.getByText('This device')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Text size' })).toBeTruthy();
    // A switch keeps the menu open; an action closes it.
    await user.click(within(screen.getByRole('group', { name: 'Text size' })).getAllByRole('button')[0]!);
    expect(screen.getByText('This device')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Character options' }));

    await user.click(screen.getByRole('button', { name: '‹ The Ash Barrows' }));
    expect(await screen.findByRole('heading', { name: 'Your campaigns' })).toBeTruthy();
    expect(within(screen.getByRole('banner')).getByText(BRAND.appName)).toBeTruthy();
  });

  it('one ⋯ menu everywhere in the campaign (N17): the full sheet, Setting rules and the list keep the campaign items, and each goes straight there', async () => {
    playing();
    const menuItem = (name: string) => screen.getAllByRole('button', { name }).find((b) => b.classList.contains('more-menu__item'))!;
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Full character sheet' }));
    expect(await screen.findByRole('heading', { name: 'Wren', level: 1 })).toBeTruthy();
    // The sheet's ⋯: the campaign items, then This device and the account.
    await user.click(screen.getByRole('button', { name: 'Account and device options' }));
    for (const name of ['Your characters', 'Full character sheet', 'Setting rules', 'Rules library', 'Sign out']) expect(menuItem(name)).toBeTruthy();
    expect(screen.getByText('This device')).toBeTruthy();
    await user.click(menuItem('Setting rules'));
    expect(await screen.findByRole('heading', { name: 'Setting rules' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Account and device options' }));
    await user.click(menuItem('Your characters'));
    expect(await screen.findByRole('button', { name: '‹ Back to Wren' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Account and device options' }));
    expect(menuItem('Setting rules')).toBeTruthy();
  });

  // Hit points in place (ruled 2026-11-08, replacing the damage pad on the Player screen): − and + in the box, + stops
  // at the most and − at 0, each burst one change with an Undo toast (the burst itself: hpInPlace.test.tsx).
  it('hit points in place: + stops at the most, − stops at 0, Undo puts it back, and no Damage or heal pop-up', async () => {
    const { wren } = playing({ current: 1, max: 2 });
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));

    await changeHp(user, 5, true);
    await vi.waitFor(() => expect(hpOf(wren)).toBe(2));
    expect(await screen.findByText('Healed 1, 2 of 2, at the most')).toBeTruthy();

    await changeHp(user, 3);
    await vi.waitFor(() => expect(hpOf(wren)).toBe(0));
    expect(await screen.findByRole('button', { name: 'Hit points 0 of 2. Type a value' })).toBeTruthy();
    expect(await screen.findByText('Took 2 damage, 0 of 2, the lowest it goes')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(hpOf(wren)).toBe(2));
    expect(screen.queryByRole('dialog', { name: 'Damage or heal' })).toBeNull();

    // Still there after leaving and coming back.
    await user.click(screen.getByRole('button', { name: '‹ The Ash Barrows' }));
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    expect(await screen.findByRole('button', { name: 'Hit points 2 of 2. Type a value' })).toBeTruthy();
  });

  it('tapping the number lets you type any whole number, above max too; anything else gets a plain message', async () => {
    const { wren } = playing({ current: 9, max: 14 });
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));

    await user.click(await screen.findByRole('button', { name: 'Hit points 9 of 14. Type a value' }));
    const box = screen.getByLabelText('Current HP (max 14)');
    await user.clear(box);
    await user.click(screen.getByRole('button', { name: 'Set' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Type a whole number, like 7 or -2.');

    await user.type(box, '17');
    await user.click(screen.getByRole('button', { name: 'Set' }));
    expect(await screen.findByText('over max')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hit points 17 of 14, over max. Type a value' })).toBeTruthy();
    expect(hpOf(wren)).toBe(17);
  });

  it('a character with nothing the setting fills shows no Skills or Saves, and AC only when there is one', async () => {
    playing();
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    expect(await screen.findByRole('button', { name: /^Hit points .*Type a value$/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Skills' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Saves' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^AC / })).toBeNull();
  });

  it('the tabs are Player, Scene, Pack; Scene shows a few recent log lines and no full-log link; Player brings the screen back', async () => {
    playing();
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const tabs = within(await screen.findByRole('navigation', { name: 'Main' }));
    expect(tabs.getAllByRole('button').map((b) => b.textContent)).toEqual(['Player', 'Scene', 'Pack']);

    await user.click(tabs.getByRole('button', { name: 'Scene' }));
    expect(await screen.findByRole('heading', { name: 'Recently' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Full log/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Verbose/ })).toBeNull();
    await user.click(tabs.getByRole('button', { name: 'Pack' }));
    expect(await screen.findByRole('heading', { name: 'Wren’s pack' })).toBeTruthy();
    await user.click(tabs.getByRole('button', { name: 'Player' }));
    expect(screen.getByRole('heading', { name: 'Wren' })).toBeTruthy();
  });
});

/**
 * Edit's Backstory row (plan m5b-sheet-revised B5, B6): opens its sheet, writes the words, saves at once, then leaves
 * Edit. It stands in for the sheet's old Notes box in the tests that need one logged character.edit.
 */
async function writeBackstory(u: ReturnType<typeof userEvent.setup>, text: string) {
  await u.click(screen.getByRole('button', { name: /^Backstory:/ }));
  const sheet = within(await screen.findByRole('dialog', { name: 'Backstory' }));
  await u.type(sheet.getByLabelText('Backstory'), text);
  await u.click(sheet.getByRole('button', { name: 'Save' }));
  await screen.findByText('Backstory saved');
  await u.click(screen.getByRole('button', { name: 'Cancel' }));
}

describe('the full character sheet', () => {
  function sheetWorld() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: player });
    world.addMember(campaign, player, 'player', wren);
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, {
      level: 3,
      hp_current: 9,
      hp_max: 14,
      notes: '',
      backstory: 'Raised on the barges.',
      fields: { might: 13, folk: 'Marsh folk', old: 'Retired value' },
    });
    const field = (key: string, label: string, type: string, sort: number, extra: Record<string, unknown> = {}) =>
      world.tables.field_definitions.push({
        id: `field-${key}`,
        campaign_id: campaign,
        applies_to: 'pc',
        key,
        label,
        type,
        choices: [],
        field_group: '',
        sort_order: sort,
        show_on_card: false,
        hidden: false,
        created_at: '2026-10-19T12:00:00Z',
        ...extra,
      });
    field('might', 'Might', 'number', 1, { field_group: 'Abilities' });
    field('folk', 'Folk', 'text', 2, { show_on_card: true });
    field('old', 'Old oath', 'text', 3, { hidden: true });
    return { gm, player, wren };
  }
  const actor = (id: string) => world.tables.actors.find((a) => a.id === id)!;

  // Plan m5b-sheet-revised B5/B6: the sheet's Edit is one screen of rows; a field is a Details row whose sheet saves at
  // once; the old Notes box is the Notes sheet (tested in sheetRevised.test.tsx); the level is a line for a player.
  it("a player opens the full sheet from ⋯, edits a field, but leaves the level to the GM", async () => {
    const { player, wren } = sheetWorld();
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Full character sheet' }));

    expect(await screen.findByRole('region', { name: 'Level' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Hit points 9 of 14/ })).toBeTruthy();
    expect(screen.getByText('Raised on the barges.')).toBeTruthy();
    // Hidden fields are the GM's only.
    expect(screen.queryByText('Old oath')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Level 3, your GM changes it')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Might:/ }));
    let sheet = within(await screen.findByRole('dialog', { name: 'Might' }));
    await user.clear(sheet.getByLabelText('Might'));
    await user.type(sheet.getByLabelText('Might'), 'strong');
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    expect((await sheet.findByRole('alert')).textContent).toBe('Might must be a whole number (it can be negative).');

    await user.clear(sheet.getByLabelText('Might'));
    await user.type(sheet.getByLabelText('Might'), '14');
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Might saved')).toBeTruthy();
    expect(actor(wren).fields).toEqual({ might: 14, folk: 'Marsh folk', old: 'Retired value' });
    expect(actor(wren).level).toBe(3);
    sheet = within(screen.getByRole('form', { name: 'Edit Wren' }));
    await user.click(sheet.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Saved.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Back to Wren' }));
    expect(await screen.findByText('Marsh folk, Level 3')).toBeTruthy();
  });

  // Since page 32 (pg32-1) the GM's Edit is in the row's ⋯ and opens the sheet's form straight away, as the player's
  // Edit does; Save comes back to Players.
  it("the GM edits a player's sheet from the player list, hidden fields included, and changes the level", async () => {
    const { gm, wren } = sheetWorld();
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    await user.click(await screen.findByRole('button', { name: 'More for Wren' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText('Retired value')).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Level' }), 'Level 4');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(actor(wren).level).toBe(4);
    expect(await screen.findByRole('button', { name: 'Invite a player' })).toBeTruthy();
  });
});

describe('the party', () => {
  it("a player sees every approved character in Your characters, theirs marked, but not another player's waiting one", async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const jo = world.addPerson('jo@lantern.example', 'Jo');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam, companyName: 'The Reed Cutters' });
    const ash = world.addCharacter(campaign, 'Ash', { ownerId: jo });
    world.addCharacter(campaign, 'Bram', { ownerId: jo, approval: 'pending' });
    world.addMember(campaign, sam, 'player', wren);
    world.addMember(campaign, jo, 'player', ash);
    world.signInAs(sam);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await openYourCharacters(user);

    const party = (await screen.findByRole('heading', { name: 'The party' })).parentElement as HTMLElement;
    await within(party).findByText('Ash');
    expect(within(party).getByText('Jo, Level 1')).toBeTruthy();
    expect(within(party).getByText('Sam (you), Level 1, The Reed Cutters')).toBeTruthy();
    expect(within(party).queryByText('Bram')).toBeNull();
  });
});

describe('the log', () => {
  function party() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    world.addMember(campaign, sam, 'player', wren);
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { hp_current: 11, hp_max: 14 });
    return { gm, sam, campaign, wren };
  }

  it('an HP change shows in the verbose log, in plain words, but not in the simple one', async () => {
    const { sam } = party();
    world.signInAs(sam);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await changeHp(user, 1);
    await vi.waitFor(() => expect(world.tables.events.length).toBeGreaterThan(0));

    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect(await screen.findByText('The log is blank. What happens at the table is kept here.')).toBeTruthy();
    await user.click(screen.getByLabelText('Verbose: every change, like each HP tick'));
    expect(await screen.findByText("You set Wren's HP to 10 (was 11).")).toBeTruthy();
  });

  it("the GM's Log section shows the invite they made; a player's log never does", async () => {
    const { gm, sam } = party();
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    await user.click(await screen.findByRole('button', { name: 'Invite a player' }));
    await user.click(screen.getByRole('button', { name: 'Make invite link' }));
    await screen.findByRole('button', { name: 'Copy link' });
    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect(await screen.findByText('You made an invite.')).toBeTruthy();

    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    cleanup();
    world.signInAs(sam);
    const player = openApp();
    await player.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await player.click(screen.getByRole('button', { name: 'Log' }));
    expect(await screen.findByText('The log is blank. What happens at the table is kept here.')).toBeTruthy();
    expect(screen.queryByText(/made an invite/)).toBeNull();
  });
});


describe('undo', () => {
  function playing(hp = 11) {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    world.addMember(campaign, sam, 'player', wren);
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { hp_current: hp, hp_max: 14 });
    return { gm, sam, wren };
  }
  const hpOf = (id: string) => world.tables.actors.find((a) => a.id === id)?.hp_current;
  // The log opens from the top row; the other names are tabs.
  const tab = (user: ReturnType<typeof openApp>, name: string) =>
    name === 'Log' ? user.click(screen.getByRole('button', { name: 'Log' })) : user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name }));

  it('the M2 gate in miniature: change HP, undo it from the log, see both lines, and the Player screen shows the old HP', async () => {
    const { sam, wren } = playing();
    world.signInAs(sam);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await changeHp(user, 1);
    await vi.waitFor(() => expect(hpOf(wren)).toBe(10));

    await tab(user, 'Log');
    await user.click(await screen.findByLabelText('Verbose: every change, like each HP tick'));
    await openLine(user, "You set Wren's HP to 10 (was 11).");
    await user.click(await screen.findByRole('button', { name: "Undo: You set Wren's HP to 10 (was 11)." }));
    expect(await screen.findByText('Undone.')).toBeTruthy();
    expect(hpOf(wren)).toBe(11);
    expect(await screen.findByText("You undid a change to Wren's HP (back to 11).")).toBeTruthy();
    // The original line stays, marked undone, with no Undo left on it.
    expect(screen.getByText("You set Wren's HP to 10 (was 11).")).toBeTruthy();
    await openLine(user, "You set Wren's HP to 10 (was 11).");
    expect(await screen.findByRole('button', { name: "Add a note to: You set Wren's HP to 10 (was 11)." })).toBeTruthy();
    expect(screen.queryByRole('button', { name: "Undo: You set Wren's HP to 10 (was 11)." })).toBeNull();

    await tab(user, 'Player');
    // The log stays open over the Player screen, which shows the undone HP straight away.
    expect(await screen.findByRole('button', { name: 'Hit points 11 of 14. Type a value' })).toBeTruthy();
  });

  it('the GM undoes a campaign rename from the log; the heading behind goes back to the old name', async () => {
    const { gm } = playing();
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'The Ash Barrows' }));
    const name = await screen.findByLabelText('Campaign name');
    await user.clear(name);
    await user.type(name, 'The Drowned Marches');
    await user.click(within(screen.getByRole('form', { name: 'Edit the campaign' })).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'The Drowned Marches' })).toBeTruthy();

    await tab(user, 'Log');
    await openLine(user, 'You renamed the campaign to The Drowned Marches.');
    await user.click(await screen.findByRole('button', { name: 'Undo: You renamed the campaign to The Drowned Marches.' }));
    expect(await screen.findByText('Undone.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('button', { name: 'The Ash Barrows' })).toBeTruthy();
  });

  it("undo is refused in plain words when the thing changed since", async () => {
    const { sam, wren } = playing();
    world.signInAs(sam);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await changeHp(user, 1);
    await vi.waitFor(() => expect(hpOf(wren)).toBe(10));
    await changeHp(user, 1);
    await vi.waitFor(() => expect(hpOf(wren)).toBe(9));

    await tab(user, 'Log');
    await user.click(await screen.findByLabelText('Verbose: every change, like each HP tick'));
    await openLine(user, "You set Wren's HP to 10 (was 11).");
    await user.click(await screen.findByRole('button', { name: "Undo: You set Wren's HP to 10 (was 11)." }));
    expect((await screen.findByRole('alert')).textContent).toBe("That's changed since. Undo the later change first.");
    expect(hpOf(wren)).toBe(9);
  });

  it("a player sees no Undo on the GM's line, and nobody sees one on making or deleting things", async () => {
    const { gm, sam, wren } = playing();
    world.signInAs(gm);
    const gmUser = openApp();
    await gmUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(gmUser);
    await gmUser.click(await screen.findByRole('button', { name: 'More for Wren' }));
    await gmUser.click(await screen.findByRole('button', { name: 'Edit' }));
    await writeBackstory(gmUser, 'Owes the ferryman');
    await screen.findByText('Saved.');
    // Saved from the form, it comes back to Players (pg32-1: Edit in the row's ⋯, as the player's Edit).
    await screen.findByRole('heading', { name: 'Companies' });
    await gmUser.click(await screen.findByRole('button', { name: 'Companies options' }));
    await gmUser.click(screen.getByRole('button', { name: 'New company (GM)' }));
    await gmUser.type(screen.getByLabelText('Company name'), 'The Reed Cutters');
    await gmUser.click(screen.getByRole('button', { name: 'Create company' }));
    await screen.findByText('The Reed Cutters was created.');
    await gmUser.click(screen.getByRole('button', { name: 'Log' }));
    await openLine(gmUser, "You edited Wren's backstory.");
    expect(await screen.findByRole('button', { name: "Undo: You edited Wren's backstory." })).toBeTruthy();
    await openLine(gmUser, 'You made the company The Reed Cutters.');
    expect(await screen.findByRole('button', { name: 'Add a note to: You made the company The Reed Cutters.' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo: You made the company The Reed Cutters.' })).toBeNull();

    await openMenu(gmUser);
    await gmUser.click(screen.getByRole('button', { name: 'Sign out' }));
    cleanup();
    world.signInAs(sam);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await tab(user, 'Log');
    expect(await screen.findByText("Priya edited Wren's backstory.")).toBeTruthy();
    await openLine(user, "Priya edited Wren's backstory.");
    expect(await screen.findByRole('button', { name: "Add a note to: Priya edited Wren's backstory." })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();
    expect(world.tables.actors.find((a) => a.id === wren)?.backstory).toBe('Owes the ferryman');
  });
});

describe('notes', () => {
  function party() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    world.addMember(campaign, sam, 'player', wren);
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { hp_current: 11, hp_max: 14 });
    return { gm, sam };
  }
  const events = (user: ReturnType<typeof openApp>) =>
    user.click(screen.getByRole('button', { name: 'Log' }));
  async function signOutAndIn(user: ReturnType<typeof openApp>, who: string) {
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    cleanup();
    world.signInAs(who);
    return openApp();
  }

  it("closing the log keeps a note's unsaved words for next time; Cancel throws them away", async () => {
    const { sam } = party();
    world.signInAs(sam);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await events(user);
    await user.click(await screen.findByRole('button', { name: 'Write a note' }));
    await user.type(screen.getByLabelText('Note'), 'The ferryman wants');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Log' })).toBeNull();
    await events(user);
    expect((await screen.findByLabelText('Note') as HTMLTextAreaElement).value).toBe('The ferryman wants');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await events(user);
    expect(await screen.findByRole('button', { name: 'Write a note' })).toBeTruthy();
    expect(screen.queryByLabelText('Note')).toBeNull();
  });

  it('a player writes a note about a character, and the GM reads it in their log', async () => {
    const { gm, sam } = party();
    world.signInAs(sam);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await events(user);
    await user.click(await screen.findByRole('button', { name: 'Write a note' }));
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Write something first.');
    await user.type(screen.getByLabelText('Note'), 'The ferryman wants paying before dawn.');
    await user.click(screen.getByRole('button', { name: 'About…' }));
    await user.click(within(screen.getByRole('group', { name: 'About' })).getByRole('button', { name: 'Wren' }));
    expect(screen.getByText('About Wren')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText('Note saved.')).toBeTruthy();
    expect(await screen.findByText('You wrote a note about Wren.')).toBeTruthy();

    const gmUser = await signOutAndIn(user, gm);
    await gmUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(gmUser);
    await gmUser.click(await screen.findByRole('button', { name: 'Log' }));
    expect(await screen.findByText('Sam wrote a note about Wren.')).toBeTruthy();
    expect(screen.getByText('The ferryman wants paying before dawn.')).toBeTruthy();
  });

  it('a note added to a log line shows under it; its writer edits it and it says so; another player cannot', async () => {
    const { gm, sam } = party();
    world.signInAs(gm);
    const gmUser = openApp();
    await gmUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(gmUser);
    await gmUser.click(await screen.findByRole('button', { name: 'More for Wren' }));
    await gmUser.click(await screen.findByRole('button', { name: 'Edit' }));
    await writeBackstory(gmUser, 'Fever');
    await screen.findByText('Saved.');
    // Saved from the form, it comes back to Players (pg32-1: Edit in the row's ⋯, as the player's Edit).
    await gmUser.click(await screen.findByRole('button', { name: 'Log' }));
    await openLine(gmUser, "You edited Wren's backstory.");
    await gmUser.click(await screen.findByRole('button', { name: "Add a note to: You edited Wren's backstory." }));
    await gmUser.type(screen.getByLabelText("Note on: You edited Wren's backstory."), 'Caught in the marsh.');
    await gmUser.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Note added.')).toBeTruthy();
    expect(await screen.findByText('Caught in the marsh.')).toBeTruthy();

    await gmUser.click(screen.getByRole('button', { name: 'Edit note: Caught in the marsh.' }));
    const box = screen.getByLabelText('Edit note');
    await gmUser.clear(box);
    await gmUser.type(box, 'Caught in the marsh, day 3.');
    await gmUser.click(screen.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText('Caught in the marsh, day 3.')).toBeTruthy();
    expect(screen.getByText(', edited')).toBeTruthy();

    const user = await signOutAndIn(gmUser, sam);
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await events(user);
    expect(await screen.findByText('Caught in the marsh, day 3.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Edit note/ })).toBeNull();
  });
});

describe('fiat', () => {
  it("the GM edits a player's sheet as a ruling with a reason; the player sees the seal and reason but can't undo it", async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    world.addMember(campaign, sam, 'player', wren);
    world.signInAs(gm);
    const gmUser = openApp();
    await gmUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(gmUser);
    await gmUser.click(await screen.findByRole('button', { name: 'More for Wren' }));
    await gmUser.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByText("This is a player's character, so your changes are logged as a GM ruling (fiat).")).toBeTruthy();
    await gmUser.type(screen.getByLabelText('Reason (optional)'), 'Failed the marsh crossing');
    await writeBackstory(gmUser, 'Bitten by a bog lurker');
    await screen.findByText('Saved.');
    const event = world.tables.events.find((e) => e.type === 'character.edit');
    expect(event).toMatchObject({ fiat: true, reason: 'Failed the marsh crossing' });

    await openMenu(gmUser);
    await gmUser.click(screen.getByRole('button', { name: 'Sign out' }));
    cleanup();
    world.signInAs(sam);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect(await screen.findByText("Priya edited Wren's backstory.")).toBeTruthy();
    expect(document.querySelector('.log__fiat')?.textContent).toBe(',  Fiat');
    expect(screen.getByText('Reason: Failed the marsh crossing')).toBeTruthy();
    await openLine(user, "Priya edited Wren's backstory.");
    await screen.findByRole('button', { name: "Add a note to: Priya edited Wren's backstory." });
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();

    // The player's own edit is no ruling: no reason box.
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Player' }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Full character sheet' }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.queryByLabelText('Reason (optional)')).toBeNull();
  });
});

describe('the rules library', () => {
  const packJson = (version: string, items: { id: string; name: string; slots?: number }[], formatVersion = 2) =>
    new File(
      [
        JSON.stringify({
          format: 'tabletop-pack',
          formatVersion,
          meta: { name: 'River Rules', version, kind: 'setting' },
          items,
          races: [{ id: 'marsh-folk', name: 'Marsh folk' }],
        }),
      ],
      'river-rules.json',
      { type: 'application/json' },
    );
  async function openLibrary(user: ReturnType<typeof openApp>) {
    await screen.findByRole('heading', { name: 'Your campaigns' });
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Rules library' }));
    expect(await screen.findByRole('heading', { name: 'Rules library' })).toBeTruthy();
  }
  function signInAsAGm() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.addCampaign('The Ash Barrows', gm);
    world.signInAs(gm);
  }

  it('everyone has it in the ⋯ menu, players too: a library is your own', async () => {
    const gm = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const player = world.addPerson('priya@lantern.example', 'Priya');
    world.addMember(campaign, player, 'player');
    world.signInAs(player);
    const user = openApp();
    await screen.findByRole('heading', { name: 'Your campaigns' });
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Rules library' }));
    expect(await screen.findByRole('heading', { name: 'Rules library' })).toBeTruthy();
  });

  it('from the ⋯ menu, import a pack: the preview shows what is in it and a warning, then it is in your library', async () => {
    signInAsAGm();
    const user = openApp();
    await openLibrary(user);
    expect(screen.getByText('Nothing in your library yet.')).toBeTruthy();

    await user.upload(screen.getByLabelText('Import a file'), packJson('0.1', [{ id: 'rope-50ft', name: 'Rope, 50 ft' }, { id: 'lantern', name: 'Lantern' }], 1));
    expect(await screen.findByRole('heading', { name: 'Import River Rules?' })).toBeTruthy();
    expect(screen.getByText('1 race, 2 items.')).toBeTruthy();
    expect(screen.getByText('The file says format version 1 but uses version-2 parts (races); it was read as version 2.')).toBeTruthy();
    expect(world.tables.packs).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Save to your library' }));
    expect(await screen.findByText('River Rules was added to your library.')).toBeTruthy();
    expect(await screen.findByText('1 race, 2 items')).toBeTruthy();
    expect(screen.getByText(/Not used by a campaign, version 0\.1, updated/)).toBeTruthy();
    expect(world.tables.library_entries).toHaveLength(3);
  });

  it('Edit pack on a homebrew pack: says which campaigns use it, then an entry is edited in place (ruled 2026-10-25)', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-marsh', owner_user_id: gm, campaign_id: null, name: 'Marsh Homebrew', version: '1', kind: 'homebrew', format_version: 2, source: '', notes: 'Marsh things.', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({ id: 'entry-pipe', pack_id: 'pack-marsh', kind: 'item', pack_entry_id: 'reed-pipe', name: 'Reed pipe', data: { id: 'reed-pipe', name: 'Reed pipe', weightCoin: 2 } });
    world.tables.campaign_packs.push({ id: 'link-marsh', campaign_id: campaign, pack_id: 'pack-marsh', pack_name: 'Marsh Homebrew', option_choices: {}, priority: 1 });
    world.signInAs(gm);
    const user = openApp();
    await openLibrary(user);
    await user.click(await screen.findByRole('button', { name: 'More for Marsh Homebrew' }));
    await user.click(screen.getByRole('button', { name: /^Edit pack/ }));
    expect(await screen.findByText(/Used by 1 campaign: The Ash Barrows\./)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Reed pipe/ }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const form = within(await screen.findByRole('form', { name: 'Edit Reed pipe' }));
    await user.clear(form.getByLabelText('Name'));
    await user.type(form.getByLabelText('Name'), 'Reed whistle');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Saved\. The change applies in 1 campaign \(The Ash Barrows\)/)).toBeTruthy();
    expect(world.tables.library_entries.find((e) => e.pack_id === 'pack-marsh')).toMatchObject({ pack_entry_id: 'reed-pipe', name: 'Reed whistle' });
    expect(world.tables.packs.find((p) => p.id === 'pack-marsh')).toMatchObject({ notes: 'Marsh things.', kind: 'homebrew' });
  });

  it('a setting pack has no Edit pack (only homebrew is edited in the library)', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.tables.packs.push({ id: 'pack-river', owner_user_id: gm, campaign_id: null, name: 'River Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.signInAs(gm);
    const user = openApp();
    await openLibrary(user);
    expect(await screen.findByRole('button', { name: 'Browse River Rules' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'More for River Rules' }));
    expect(screen.queryByRole('button', { name: /^Edit pack/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Export as a pack file/ })).toBeTruthy();
  });

  it("a file that isn't a pack gets a plain message, and nothing is saved", async () => {
    signInAsAGm();
    const user = openApp();
    await openLibrary(user);
    await user.upload(screen.getByLabelText('Import a file'), new File(['{"hello": 1}'], 'notes.json', { type: 'application/json' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That file isn\'t a setting-rules pack (its "format" should be "tabletop-pack").');
    expect(world.tables.packs).toEqual([]);
  });

  it('updating from a newer file shows what will be added, changed and removed before anything changes', async () => {
    signInAsAGm();
    const user = openApp();
    await openLibrary(user);
    await user.upload(screen.getByLabelText('Import a file'), packJson('0.1', [{ id: 'rope-50ft', name: 'Rope, 50 ft', slots: 1 }, { id: 'lantern', name: 'Lantern' }]));
    await user.click(await screen.findByRole('button', { name: 'Save to your library' }));
    await screen.findByText('River Rules was added to your library.');

    await user.upload(
      screen.getByLabelText('Update River Rules from a file'),
      packJson('0.2', [{ id: 'rope-50ft', name: 'Rope, 50 ft', slots: 2 }, { id: 'pole-10ft', name: 'Pole, 10 ft' }]),
    );
    expect(await screen.findByRole('heading', { name: 'Update River Rules?' })).toBeTruthy();
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByText(/1 added/).parentElement?.textContent).toBe('1 added: Pole, 10 ft');
    expect(within(preview).getByText(/1 changed/).parentElement?.textContent).toBe('1 changed: Rope, 50 ft');
    expect(within(preview).getByText(/1 removed/).parentElement?.textContent).toBe('1 removed: Lantern');
    expect(world.tables.library_entries.some((e) => e.pack_entry_id === 'pole-10ft')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('River Rules was updated.')).toBeTruthy();
    expect(world.tables.library_entries.map((e) => e.pack_entry_id).sort()).toEqual(['marsh-folk', 'pole-10ft', 'rope-50ft']);
  });

  it('Convert with an AI shows the instructions from the pack spec, with a copy button', async () => {
    signInAsAGm();
    const user = openApp();
    await openLibrary(user);
    await user.click(screen.getByRole('button', { name: 'Convert a book with an AI…' }));
    expect(await screen.findByRole('heading', { name: 'Convert with an AI' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Copy the instructions' }));
    expect(await screen.findByText('Instructions copied.')).toBeTruthy();
    const copied = await navigator.clipboard.readText();
    expect(copied).toContain('tabletop-pack');
    expect(copied).toContain('## JSON format (version 1)');
    await user.click(screen.getByRole('button', { name: '‹ Rules library' }));
    expect(await screen.findByRole('heading', { name: 'Rules library' })).toBeTruthy();
  });

  it("what a file says about itself beyond the app's keys is kept and shown with the pack; hidden item fields are kept apart", async () => {
    signInAsAGm();
    const user = openApp();
    await openLibrary(user);
    const file = new File(
      [
        JSON.stringify({
          format: 'tabletop-pack',
          formatVersion: 2,
          meta: { name: 'River Rules', version: '0.1', author: 'Priya' },
          items: [{ id: 'moon-ring', name: 'Moon ring', cursed: true, gmOnly: ['cursed'] }],
        }),
      ],
      'river-rules.json',
      { type: 'application/json' },
    );
    await user.upload(screen.getByLabelText('Import a file'), file);
    await user.click(await screen.findByRole('button', { name: 'Save to your library' }));
    // About this file is behind Browse now (lr-2), not on the row.
    expect(screen.queryByText('About this file')).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Browse River Rules' }));
    await user.click(await screen.findByText('About this file'));
    expect(screen.getByText('Made by')).toBeTruthy();
    expect(screen.getByText('Priya')).toBeTruthy();
    expect(world.tables.library_entries[0]?.data).toEqual({ id: 'moon-ring', name: 'Moon ring' });
    expect(world.tables.library_entry_secrets[0]?.data).toEqual({ cursed: true, gmOnly: ['cursed'] });
  });

  it('a Markdown file imports the same way, with its warnings in the preview', async () => {
    signInAsAGm();
    const user = openApp();
    await openLibrary(user);
    const text = ['# Pack: Table gear', 'version: 0.1', '', '## item: Rope, 50 ft', 'weight: 50 coins', 'wt: 50', '', '## statblock: Bog lurker', 'hp: 3d8 (13)', 'AC: 6'];
    const markdown = new File([text.join('\n')], 'table-gear.md', { type: 'text/markdown' });
    await user.upload(screen.getByLabelText('Import a file'), markdown);
    expect(await screen.findByRole('heading', { name: 'Import Table gear?' })).toBeTruthy();
    expect(screen.getByText('1 item, 1 stat block.')).toBeTruthy();
    expect(screen.getByText(`item "Rope, 50 ft": "wt" isn't a key ${BRAND.appName} knows; it was left out.`)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save to your library' }));
    expect(await screen.findByText('Table gear was added to your library.')).toBeTruthy();
    expect(world.tables.library_entries.find((e) => e.pack_entry_id === 'bog-lurker')?.data).toMatchObject({ hp: '3d8', hpAverage: 13, fields: { AC: '6' } });
  });
});


describe('Campaign → Setting rules', () => {
  function gmWithLibrary() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-river', owner_user_id: gm, campaign_id: null, name: 'River Rules', version: '0.2', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown> = {}) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-river', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('class', 'lantern-warden', 'Lantern Warden');
    entry('item', 'rope-50ft', 'Rope, 50 ft');
    entry('option', 'lantern-oil', 'Lanterns need oil', { default: 'on', changeLater: 'allow', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] });
    entry('option', 'slow-healing', 'Slow healing', { default: 'off', changeLater: 'warn', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] });
    entry('option', 'ac-style', 'Armour class', {
      default: 'desc',
      changeLater: 'never',
      notes: 'Whether a better armour class is a higher number or a lower one.',
      choices: [{ id: 'asc', name: 'Ascending', notes: 'Higher is better.' }, { id: 'desc', name: 'Descending' }],
    });
    world.signInAs(gm);
    return gm;
  }
  async function openRules(user: ReturnType<typeof openApp>) {
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    expect(await screen.findByText('No setting rules yet. Add your setting to fill them in.')).toBeTruthy();
  }

  // B15 (ruled 2026-10-25), rebuilt 2026-11-02 (lr-7): one optional-rules group per source, set-up step 3's rows,
  // editable in place with Undo.
  it("Rules for this campaign: a pack's rules are one group with its count line; changed first; locked ones explain; warn ones ask; a change undoes", async () => {
    const gm = gmWithLibrary();
    const campaign = world.tables.members.find((m) => m.user_id === gm)!.campaign_id;
    world.tables.campaign_packs.push({ id: 'link-river', campaign_id: campaign, pack_id: 'pack-river', pack_name: 'River Rules', option_choices: { 'lantern-oil': 'off' }, priority: 1 });
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    const rules = within(await screen.findByRole('region', { name: 'Rules for this campaign' }));
    await user.click(await rules.findByRole('button', { name: 'Optional rules: River Rules, 3 rules, 1 changed' }));
    // The changed rule first, with its source, when it can change in words and "changed" (tf-2); every rule shows (tf-5).
    const oil = within(rules.getByRole('group', { name: 'Lanterns need oil' }));
    expect(oil.getByText(/^River Rules, can change at any time/)).toBeTruthy();
    expect(oil.getByText('changed')).toBeTruthy();
    expect(rules.getByRole('group', { name: 'Slow healing' })).toBeTruthy();
    expect([...document.querySelectorAll('.rule-group .rule-row')][0]!.getAttribute('aria-label')).toBe('Lanterns need oil');
    // A two-choice rule is a segmented control; its description waits behind ⓘ (tf-3).
    await user.click(within(rules.getByRole('group', { name: 'Armour class' })).getByRole('button', { name: 'About Armour class' }));
    const about = within(await screen.findByRole('dialog', { name: 'Armour class' }));
    expect(about.getByText('Whether a better armour class is a higher number or a lower one.')).toBeTruthy();
    await user.click(about.getByRole('button', { name: 'Close' }));
    expect(within(rules.getByRole('group', { name: 'Armour class' })).getByText("River Rules, can't change once the campaign starts")).toBeTruthy();
    // Locked: a tap says why and changes nothing.
    await user.click(within(rules.getByRole('group', { name: 'Choose Armour class' })).getByRole('button', { name: 'Ascending' }));
    expect(await screen.findByText("Armour class can't change once the campaign has started.")).toBeTruthy();
    // Warn: it asks first, then changes with Undo.
    await user.click(within(rules.getByRole('group', { name: 'Choose Slow healing' })).getByRole('button', { name: 'Yes' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Change Slow healing?' })).getByRole('button', { name: 'Change to Yes' }));
    await waitFor(() => expect(world.tables.campaign_packs[0]?.option_choices).toEqual({ 'lantern-oil': 'off', 'slow-healing': 'on' }));
    expect(await rules.findByRole('button', { name: 'Optional rules: River Rules, 3 rules, 2 changed' })).toBeTruthy();
    // Allow: at once, logged, with Undo.
    await user.click(within(rules.getByRole('group', { name: 'Choose Lanterns need oil' })).getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(world.tables.campaign_packs[0]?.option_choices).toEqual({ 'lantern-oil': 'on', 'slow-healing': 'on' }));
    expect(await screen.findByText('Lanterns need oil: Yes')).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'rules.setOptions')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.campaign_packs[0]?.option_choices).toEqual({ 'lantern-oil': 'off', 'slow-healing': 'on' }));
    // The undo is a new logged change, and the count line follows.
    expect(world.tables.events.filter((e) => e.type === 'rules.setOptions')).toHaveLength(3);
    expect(await rules.findByRole('button', { name: 'Optional rules: River Rules, 3 rules, 2 changed' })).toBeTruthy();
  });

  it('"Reset to the books\' defaults" asks first when it would change a rule that warns, then undoes', async () => {
    const gm = gmWithLibrary();
    const campaign = world.tables.members.find((m) => m.user_id === gm)!.campaign_id;
    world.tables.campaign_packs.push({ id: 'link-river', campaign_id: campaign, pack_id: 'pack-river', pack_name: 'River Rules', option_choices: { 'slow-healing': 'on', 'lantern-oil': 'off' }, priority: 1 });
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await screen.findByRole('button', { name: 'Optional rules: River Rules, 3 rules, 2 changed' });
    await user.click(screen.getByRole('button', { name: "Reset to the books' defaults" }));
    const ask = within(screen.getByRole('dialog', { name: "Reset to the books' defaults?" }));
    expect(ask.getByText(/This changes Slow healing\./)).toBeTruthy();
    await user.click(ask.getByRole('button', { name: 'Not now' }));
    expect(world.tables.campaign_packs[0]?.option_choices).toEqual({ 'slow-healing': 'on', 'lantern-oil': 'off' });
    await user.click(screen.getByRole('button', { name: "Reset to the books' defaults" }));
    await user.click(within(screen.getByRole('dialog', { name: "Reset to the books' defaults?" })).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(world.tables.campaign_packs[0]?.option_choices).toEqual({ 'slow-healing': 'off', 'lantern-oil': 'on' }));
    expect(await screen.findByRole('button', { name: 'Optional rules: River Rules, 3 rules, none changed' })).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.campaign_packs[0]?.option_choices).toEqual({ 'slow-healing': 'on', 'lantern-oil': 'off' }));
  });

  // lr-6, lr-7: two attached packs with the same ruleKey give one callout, and their rows read "Decided above".
  // tf-1: one list of every pack's choices under each pack's name; one tap is the campaign's answer.
  it('two packs with the same ruleKey: one card with every pack\'s choices, the one on top ticked, "Decided above" in the other group; one tap picks', async () => {
    const gm = gmWithLibrary();
    const campaign = world.tables.members.find((m) => m.user_id === gm)!.campaign_id;
    const byWeight = { default: 'weight', changeLater: 'warn', ruleKey: 'encumbrance', choices: [{ id: 'weight', name: 'By weight' }, { id: 'slots', name: 'By slots' }] };
    world.tables.library_entries.push({ id: 'entry-river-enc', pack_id: 'pack-river', kind: 'option', pack_entry_id: 'carrying', name: 'Carrying', data: { id: 'carrying', name: 'Carrying', ...byWeight } });
    world.tables.packs.push(
      { id: 'pack-zine', owner_user_id: gm, campaign_id: null, name: 'Reed Zine', version: '0.1', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' },
      { id: 'pack-abbey', owner_user_id: gm, campaign_id: null, name: 'The Drowned Abbey', version: '0.1', kind: 'adventure', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' },
    );
    world.tables.library_entries.push({ id: 'entry-zine-enc', pack_id: 'pack-zine', kind: 'option', pack_entry_id: 'load', name: 'Load', data: { id: 'load', name: 'Load', ...byWeight, default: 'slots' } });
    world.tables.campaign_packs.push(
      { id: 'link-river', campaign_id: campaign, pack_id: 'pack-river', pack_name: 'River Rules', option_choices: {}, priority: 1 },
      { id: 'link-zine', campaign_id: campaign, pack_id: 'pack-zine', pack_name: 'Reed Zine', option_choices: {}, priority: 2 },
      { id: 'link-abbey', campaign_id: campaign, pack_id: 'pack-abbey', pack_name: 'The Drowned Abbey', option_choices: {}, priority: 3 },
    );
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    const rules = within(await screen.findByRole('region', { name: 'Rules for this campaign' }));
    // The card folds while a choice counts (rc-fold, 2026-11-20): one fold line (one card, for one topic), then open it.
    expect(await rules.findAllByRole('button', { name: / \((Reed Zine|River Rules)\)$/ })).toHaveLength(1);
    await user.click(rules.getByRole('button', { name: /^Encumbrance, / }));
    const callout = within(await rules.findByRole('group', { name: 'Choice for encumbrance' }));
    expect(callout.getByText(/Two packs offer it; one choice counts/)).toBeTruthy();
    expect(rules.getAllByRole('group', { name: /^Choice for/ })).toHaveLength(1);
    // Every pack's choices under its name; the homebrew on top counts, so its choice is ticked and no other.
    expect(callout.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Reed Zine, By weight', 'Reed Zine, By slots', 'River Rules, By weight', 'River Rules, By slots']);
    expect(callout.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('aria-label'))).toEqual(['Reed Zine, By slots']);
    // The homebrew sits on top; the adventure without optional rules says none and opens nothing.
    expect(rules.getByRole('heading', { name: 'Optional rules: The Drowned Abbey, none' })).toBeTruthy();
    await user.click(rules.getByRole('button', { name: 'Optional rules: River Rules, 4 rules, none changed' }));
    expect(within(rules.getByRole('group', { name: 'Carrying' })).getByText('Decided above: Reed Zine, By slots')).toBeTruthy();
    // One tap on River Rules' By weight: River Rules now counts for the campaign, its choice ticked.
    await user.click(callout.getByRole('button', { name: 'River Rules, By weight' }));
    await waitFor(() => expect((world.tables.campaigns.find((c) => c.id === campaign)?.settings as { ruleGroups?: unknown }).ruleGroups).toEqual({ encumbrance: 'pack-river' }));
    await waitFor(() => expect(callout.getByRole('button', { name: 'River Rules, By weight' }).getAttribute('aria-pressed')).toBe('true'));
    expect(callout.getByRole('button', { name: 'Reed Zine, By slots' }).getAttribute('aria-pressed')).toBe('false');
  });

  // lr-7: any number of groups open on a tablet (the phone's one-at-a-time is in RulesForThisCampaign.test.tsx).
  it('on a tablet a topic group and a source group stay open together, each with its count line', async () => {
    const gm = gmWithLibrary();
    const campaign = world.tables.members.find((m) => m.user_id === gm)!.campaign_id;
    world.tables.campaign_packs.push({ id: 'link-river', campaign_id: campaign, pack_id: 'pack-river', pack_name: 'River Rules', option_choices: {}, priority: 1 });
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    const characters = await screen.findByRole('button', { name: /^Characters, \d+ settings?, \d+ changed$/ });
    const optional = screen.getByRole('button', { name: 'Optional rules: River Rules, 3 rules, none changed' });
    await user.click(characters);
    await user.click(optional);
    expect(characters.getAttribute('aria-expanded')).toBe('true');
    expect(optional.getAttribute('aria-expanded')).toBe('true');
  });

  it('the GM adds setting rules from their library, then changes optional rules: locked ones stay, "warn" ones say so', async () => {
    gmWithLibrary();
    const user = openApp();
    await openRules(user);
    await user.click(screen.getByRole('button', { name: 'From your library' }));
    await user.click(screen.getByRole('button', { name: 'Add River Rules to this campaign' }));
    // Its optional rules open first, every one open, even those locked once in the campaign.
    expect(await screen.findByRole('heading', { name: 'Optional rules for River Rules' })).toBeTruthy();
    expect(world.tables.campaign_packs).toEqual([]);
    await user.click(within(screen.getByRole('group', { name: 'Armour class' })).getByRole('button', { name: /Ascending/ }));
    await user.click(screen.getByRole('button', { name: 'Add to this campaign' }));
    expect(await screen.findByText('River Rules was added to this campaign.')).toBeTruthy();
    expect(screen.getByText('Version 0.2, 1 class, 1 item, 3 optional rules')).toBeTruthy();
    expect(world.tables.campaign_packs[0]?.option_choices).toEqual({ 'lantern-oil': 'on', 'slow-healing': 'off', 'ac-style': 'asc' });

    // Setting rules shows them read-only (ruled 2026-10-26); they're chosen in Rules for this campaign.
    await user.click(screen.getByRole('button', { name: 'Optional rules, 1 changed' }));
    const shown = within(screen.getByRole('group', { name: 'Optional rules for River Rules' }));
    expect(shown.getByText('Armour class').parentElement!.textContent).toBe('Armour class Ascending, changed from default');
    expect(shown.queryByRole('button', { name: /Descending/ })).toBeNull();
    await user.click(shown.getByRole('button', { name: 'Change rules for this campaign' }));
    const rules = within(screen.getByRole('region', { name: 'Rules for this campaign' }));
    await waitFor(() => expect(rules.getByRole('button', { name: 'Optional rules: River Rules, 3 rules, 1 changed' }).getAttribute('aria-expanded')).toBe('true'));
    // Each row says what it does and when it can change, in words (lr-6).
    const armour = within(rules.getByRole('group', { name: 'Armour class' }));
    expect(armour.getByRole('button', { name: 'About Armour class' })).toBeTruthy();
    expect(armour.getByText(/^River Rules, can't change once the campaign starts/)).toBeTruthy();
    // Changing one there is logged.
    await user.click(within(rules.getByRole('group', { name: 'Choose Lanterns need oil' })).getByRole('button', { name: 'No' }));
    await waitFor(() => expect(world.tables.campaign_packs[0]?.option_choices).toEqual({ 'lantern-oil': 'off', 'slow-healing': 'off', 'ac-style': 'asc' }));
    expect(world.tables.events.some((e) => e.type === 'rules.setOptions')).toBe(true);
  });

  it('setting rules with a sheet layout offer it after adding; using it adds the fields and keeps the GM’s own', async () => {
    const gm = gmWithLibrary();
    const campaign = world.tables.members.find((m) => m.user_id === gm)!.campaign_id;
    world.tables.field_definitions.push({ id: 'field-grit', campaign_id: campaign, applies_to: 'pc', key: 'grit', label: 'Grit', type: 'text', choices: [], field_group: '', sort_order: 0, show_on_card: false, hidden: false, created_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({
      id: 'entry-river-sheet',
      pack_id: 'pack-river',
      kind: 'fieldTemplate',
      pack_entry_id: 'river-sheet',
      name: 'river-sheet',
      data: { id: 'river-sheet', appliesTo: 'pc', fields: [{ key: 'GRIT', label: 'Grit', type: 'number' }, { key: 'LUCK', label: 'Luck', type: 'number', group: 'Abilities' }] },
    });
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: 'From your library' }));
    await user.click(screen.getByRole('button', { name: 'Add River Rules to this campaign' }));
    await user.click(await screen.findByRole('button', { name: 'Add to this campaign' }));
    const offer = within(await screen.findByRole('group', { name: 'Sheet layout of River Rules' }));
    expect(offer.getByText('Luck')).toBeTruthy();
    expect(offer.getByText(/already here/)).toBeTruthy();
    await user.click(offer.getByRole('button', { name: 'Use this sheet layout' }));
    expect(await screen.findByText("One field was added from River Rules's sheet layout.")).toBeTruthy();
    expect(world.tables.field_definitions.map((f) => f.label)).toEqual(['Grit', 'Luck']);
    expect(world.tables.events.filter((e) => e.type === 'field.useLayout')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Sheet layout…' })).toBeTruthy();
  });

  it('the GM imports a file straight into the campaign, then removes it from the campaign; it stays in the library', async () => {
    gmWithLibrary();
    const user = openApp();
    await openRules(user);
    const text = ['# Pack: Table gear', '## item: Lantern', 'weight: 30 coins'];
    await user.upload(screen.getByLabelText('Import a file'), new File([text.join('\n')], 'table-gear.md', { type: 'text/markdown' }));
    await user.click(await screen.findByRole('button', { name: 'Save to your library' }));
    expect(await screen.findByText('Table gear was added to your library and this campaign.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove Table gear from this campaign' }));
    expect(screen.getByText(/stays in your library/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Table gear was removed from this campaign.')).toBeTruthy();
    expect(world.tables.campaign_packs).toEqual([]);
    expect(world.tables.packs.some((p) => p.name === 'Table gear')).toBe(true);
  });
});

describe('starting a campaign', () => {
  function gmWithPack() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.tables.packs.push({ id: 'pack-river', owner_user_id: gm, campaign_id: null, name: 'River Rules', version: '0.2', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown> = {}) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-river', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('item', 'rope-50ft', 'Rope, 50 ft');
    entry('option', 'carry', 'Carrying', { default: 'armour', changeLater: 'warn', choices: [{ id: 'armour', name: 'By armour' }, { id: 'slots', name: 'By slots' }] });
    entry('option', 'ac-style', 'Armour class', { default: 'desc', changeLater: 'never', choices: [{ id: 'asc', name: 'Ascending' }, { id: 'desc', name: 'Descending' }] });
    entry('rulesSet', 'river-rules', 'River rules', {
      encumbrance: {
        mode: 'armour',
        armour: { movement: [{ armour: 'none', withoutTreasure: '100 ft', withTreasure: '70 ft' }] },
        slot: { baseSlots: 9, tiers: [{ label: 'Laden', maxSlots: 9, effect: 'Slowed' }] },
      },
      time: { roundSeconds: 10, turnMinutes: 10 },
      byOption: { 'carry=slots': { encumbrance: { mode: 'slot' } } },
    });
    world.signInAs(gm);
    return gm;
  }

  // M5 gate fix (gate item 1): after choosing a pack, the optional rules step opened scrolled to the bottom.
  it('moving to the optional rules step starts at the top of the page', async () => {
    gmWithPack();
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: '+ Start a new campaign (as GM)' }));
    await user.type(screen.getByLabelText('Campaign name'), 'The Lantern Road');
    await user.click(screen.getByRole('button', { name: 'Next: setting rules' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Pick River Rules' }));
    const scrolled = vi.fn();
    const before = window.scrollTo;
    window.scrollTo = scrolled as unknown as typeof window.scrollTo;
    try {
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(await screen.findByRole('heading', { name: 'Optional rules' })).toBeTruthy();
      expect(scrolled).toHaveBeenCalledWith({ top: 0 });
    } finally {
      window.scrollTo = before;
    }
  });

  it('goes through all five steps: setting rules, their optional rules (locked ones open), presets, then creates it all', async () => {
    gmWithPack();
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: '+ Start a new campaign (as GM)' }));
    expect(screen.getByText('New campaign, step 1 of 3')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next: setting rules' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Give the campaign a name.');
    await user.type(screen.getByLabelText('Campaign name'), 'The Lantern Road');
    await user.click(screen.getByRole('button', { name: 'Next: setting rules' }));

    expect(await screen.findByRole('heading', { name: 'Setting rules' })).toBeTruthy();
    await user.click(await screen.findByRole('checkbox', { name: 'Pick River Rules' }));
    expect(screen.getByRole('checkbox', { name: 'Pick River Rules' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // One folded group per source (lr-6), open first, every rule showing (tf-5).
    expect(screen.getByRole('button', { name: /River Rules, 2 rules, none changed/, expanded: true })).toBeTruthy();
    // While starting, even a rule that locks later can be chosen; when it can change is said in words.
    const armour = within(await screen.findByRole('group', { name: 'Armour class' }));
    expect(armour.getByText("River Rules, can't change once the campaign starts")).toBeTruthy();
    await user.click(armour.getByRole('button', { name: 'Ascending' }));
    await user.click(within(screen.getByRole('group', { name: 'Carrying' })).getByRole('button', { name: 'By slots' }));
    expect(screen.getByRole('button', { name: /River Rules, 2 rules, 2 changed/ })).toBeTruthy();

    // Encumbrance is one row (2026-10-24; gate check 4): the pack's Carrying moves the load method, so it is the one
    // switch and the app's own Encumbrance row isn't shown beside it; the choice made (slots) is the campaign's.
    expect(screen.queryByRole('group', { name: 'Encumbrance' })).toBeNull();
    expect(screen.queryByText(/^The app, /)).toBeNull();
    // No time-lengths step: they come from the rules set (a day falls back to the app's 24 hours).
    expect(screen.queryByLabelText('A round (seconds)')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Create campaign' }));

    expect(await screen.findByRole('heading', { name: 'The Lantern Road' })).toBeTruthy();
    const campaign = world.tables.campaigns.find((c) => c.name === 'The Lantern Road');
    expect(campaign?.settings).toEqual({
      encumbrance: { mode: 'slot' },
      startLevel: 'one',
      time: { roundSeconds: 10, turnMinutes: 10, dayHours: 24, roundsPerTurn: 60, turnsPerDay: 144 },
    });
    expect(world.tables.campaign_packs).toMatchObject([{ campaign_id: campaign?.id, pack_id: 'pack-river', option_choices: { carry: 'slots', 'ac-style': 'asc' } }]);
    expect(world.tables.events.some((e) => e.type === 'rules.attach')).toBe(true);
  });

  // Gate test 3 (2026-10-25): the starting settings were saved after the layout and wiped its "HP is asked".
  it('setting rules with a sheet layout offer it on the last step; left on, the campaign starts with its fields, and its required HP is asked', async () => {
    gmWithPack();
    world.tables.library_entries.push({
      id: 'entry-river-sheet',
      pack_id: 'pack-river',
      kind: 'fieldTemplate',
      pack_entry_id: 'river-sheet',
      name: 'river-sheet',
      data: { id: 'river-sheet', appliesTo: 'pc', fields: [{ key: 'GRIT', label: 'Grit', type: 'number' }, { key: 'LUCK', label: 'Luck', type: 'number' }, { key: 'hp', label: 'Hit points', type: 'number', required: true }] },
    });
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: '+ Start a new campaign (as GM)' }));
    await user.type(screen.getByLabelText('Campaign name'), 'The Lantern Road');
    await user.click(screen.getByRole('button', { name: 'Next: setting rules' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Pick River Rules' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    const offer = screen.getByRole('checkbox', { name: 'Use the sheet layout from River Rules for characters' }) as HTMLInputElement;
    expect(offer.checked).toBe(true);
    expect(screen.getByText('Grit, Luck, Hit points')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Create campaign' }));
    await waitFor(() => expect(world.tables.field_definitions.map((f) => f.label)).toEqual(['Grit', 'Luck']));
    await waitFor(() => expect(world.tables.campaigns.find((c) => c.name === 'The Lantern Road')?.settings).toMatchObject({ hpRequired: true }));
    // One field each, one action: a single line in the log.
    expect(new Set(world.tables.events.filter((e) => e.type === 'field.useLayout').map((e) => e.request_id)).size).toBe(1);
  });

  it('"Create campaign now" skips the rest with defaults; Back keeps what was typed', async () => {
    gmWithPack();
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: '+ Start a new campaign (as GM)' }));
    await user.type(screen.getByLabelText('Campaign name'), 'The Lantern Road');
    await user.click(screen.getByRole('button', { name: 'Next: setting rules' }));
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect((screen.getByLabelText('Campaign name') as HTMLInputElement).value).toBe('The Lantern Road');
    await user.click(screen.getByRole('button', { name: 'Next: setting rules' }));
    await user.click(await screen.findByRole('button', { name: 'Create campaign now' }));

    expect(await screen.findByRole('heading', { name: 'The Lantern Road' })).toBeTruthy();
    expect(world.tables.campaigns.find((c) => c.name === 'The Lantern Road')?.settings).toEqual({
      encumbrance: { mode: 'none' },
      startLevel: 'one',
      time: { roundSeconds: 6, turnMinutes: 10, dayHours: 24, roundsPerTurn: 100, turnsPerDay: 144 },
    });
    expect(world.tables.campaign_packs).toEqual([]);
  });

  it('a file imported while starting goes into the library and is picked for the campaign', async () => {
    gmWithPack();
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: '+ Start a new campaign (as GM)' }));
    await user.type(screen.getByLabelText('Campaign name'), 'The Lantern Road');
    await user.click(screen.getByRole('button', { name: 'Next: setting rules' }));
    const text = ['# Pack: Table gear', '## item: Lantern', 'weight: 30 coins'];
    await user.upload(await screen.findByLabelText('Import a file…'), new File([text.join('\n')], 'table-gear.md', { type: 'text/markdown' }));
    await user.click(await screen.findByRole('button', { name: 'Save to your library' }));
    expect((await screen.findByRole('checkbox', { name: 'Pick Table gear' })).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Create campaign now' }));

    expect(await screen.findByRole('heading', { name: 'The Lantern Road' })).toBeTruthy();
    const gear = world.tables.packs.find((p) => p.name === 'Table gear');
    expect(world.tables.campaign_packs.map((l) => l.pack_id)).toEqual([gear?.id]);
  });
});

describe('deleting setting rules', () => {
  function gmWithRiverRules() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.addCampaign('The Reed Ferry', gm);
    world.tables.packs.push({ id: 'pack-river', owner_user_id: gm, campaign_id: null, name: 'River Rules', version: '0.2', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown> = {}) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-river', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('class', 'lantern-warden', 'Lantern Warden');
    entry('item', 'rope-50ft', 'Rope, 50 ft');
    entry('statBlock', 'bog-lurker', 'Bog lurker');
    entry('option', 'lantern-oil', 'Lanterns need oil', { default: 'on', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] });
    world.signInAs(gm);
    return gm;
  }
  async function openLibrary(user: ReturnType<typeof openApp>) {
    await screen.findByRole('heading', { name: 'Your campaigns' });
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Rules library' }));
    await screen.findByText('River Rules');
  }
  /** Delete is never on the row: it's in the pack's ⋯ (lr-3). */
  async function deleteFromMenu(user: ReturnType<typeof openApp>) {
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More for River Rules' }));
    await user.click(screen.getByRole('button', { name: /^Delete from your library…/ }));
  }

  it('setting rules no campaign uses go after a plain confirm', async () => {
    gmWithRiverRules();
    const user = openApp();
    await openLibrary(user);
    await deleteFromMenu(user);
    const confirm = within(await screen.findByRole('group', { name: 'Delete River Rules' }));
    expect(confirm.getByText(/No campaign uses it/)).toBeTruthy();
    await user.click(confirm.getByRole('button', { name: 'Delete for good' }));
    expect(await screen.findByText('River Rules was deleted.')).toBeTruthy();
    expect(world.tables.packs).toEqual([]);
    expect(world.tables.library_entries).toEqual([]);
  });

  it('when campaigns use them: a warning names each campaign and what it loses, the name must be typed, and each log says so', async () => {
    const gm = gmWithRiverRules();
    for (const name of ['The Ash Barrows', 'The Reedmouth Delve']) {
      const campaign = world.addCampaign(name, gm);
      world.tables.campaign_packs.push({ id: `link-${campaign}`, campaign_id: campaign, pack_id: 'pack-river', pack_name: 'River Rules', option_choices: {}, priority: 1 });
    }
    const user = openApp();
    await openLibrary(user);
    await deleteFromMenu(user);
    const confirm = within(await screen.findByRole('group', { name: 'Delete River Rules' }));
    expect(confirm.getByText(/is used by 2 campaigns: The Ash Barrows, The Reedmouth Delve\./)).toBeTruthy();
    expect(confirm.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'its optional rules, and the choices made',
      "the rules behind characters' classes and races (characters keep their names)",
      'its items and monsters',
      'everything else in it',
    ]);
    expect(confirm.queryByRole('textbox')).toBeNull();
    await user.click(confirm.getByRole('button', { name: 'Delete for good' }));

    expect(await screen.findByText('River Rules was deleted.')).toBeTruthy();
    expect(world.tables.campaign_packs).toEqual([]);
    expect(world.tables.events.filter((e) => e.type === 'library.delete')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: '‹ Your campaigns' }));
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    await user.click(await screen.findByRole('button', { name: 'Log' }));
    expect(await screen.findByText('You deleted the setting rules River Rules from your library, so they’re no longer in this campaign.')).toBeTruthy();
  });

  it('Cancel leaves everything as it was', async () => {
    gmWithRiverRules();
    const user = openApp();
    await openLibrary(user);
    await deleteFromMenu(user);
    await user.click(within(await screen.findByRole('group', { name: 'Delete River Rules' })).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Delete River Rules' })).toBeNull();
    expect(world.tables.packs).toHaveLength(1);
  });
});

describe('retiring a campaign', () => {
  it('the GM retires it from the foot of Rules for this campaign (lr-8): it turns read only, folds away on the list, and the log says so', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.addCampaign('The Ash Barrows', gm);
    world.addCampaign('The Reed Ferry', gm);
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    expect(screen.getByRole('button', { name: 'Invite a player' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Rules' }));
    // Retire sits at the foot of Rules for this campaign, before the Setting rules heading (gone from Setting rules' foot).
    const retire = await screen.findByRole('button', { name: 'Retire campaign…' });
    expect(retire.closest('.campaign-rules__screen')).toBeTruthy();
    expect(retire.closest('.setting-rules')).toBeNull();
    const settingRules = screen.getByRole('heading', { name: 'Setting rules', level: 2 });
    expect(retire.compareDocumentPosition(settingRules) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(retire);
    expect(screen.getByText(/nothing in it can change and nobody can join/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retire' }));

    expect(await screen.findByRole('note', { name: 'Retired campaign' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retire campaign…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'From your library' })).toBeNull();
    expect(world.tables.campaigns.find((c) => c.name === 'The Ash Barrows')?.retired_at).toBeTruthy();
    expect(world.tables.events.some((e) => e.type === 'campaign.retire')).toBe(true);
    await user.click(screen.getByRole('button', { name: /^Players/ }));
    expect(screen.queryByRole('button', { name: 'Invite a player' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '‹ Your campaigns' }));
    const retired = (await screen.findByText('Retired: 1')).closest('details')!;
    expect(retired.open).toBe(false);
    expect(within(retired).getByRole('button', { name: /The Ash Barrows/ })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /The Reed Ferry/ })).toHaveLength(1);
  });

  it('a player sees the banner and can read, but can’t bring it back or make a character', async () => {
    const gm = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const player = world.addPerson('priya@lantern.example', 'Priya');
    world.addMember(campaign, player, 'player');
    world.tables.campaigns.find((c) => c.id === campaign)!.retired_at = '2026-10-22T09:00:00Z';
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByText('Retired: 1'));
    await user.click(screen.getByRole('button', { name: /The Ash Barrows/ }));
    expect(await screen.findByRole('note', { name: 'Retired campaign' })).toBeTruthy();
    expect(screen.getByText(/Everyone can still read it/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bring back' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create your character' })).toBeNull();
  });

  it('the GM brings it back, and it changes as usual again', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.campaigns.find((c) => c.id === campaign)!.retired_at = '2026-10-22T09:00:00Z';
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByText('Retired: 1'));
    await user.click(screen.getByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    await user.click(await screen.findByRole('button', { name: 'Bring back' }));
    await waitFor(() => expect(screen.queryByRole('note', { name: 'Retired campaign' })).toBeNull());
    expect(world.tables.campaigns.find((c) => c.id === campaign)?.retired_at).toBeNull();
    expect(world.tables.events.some((e) => e.type === 'campaign.restore')).toBe(true);
    expect(screen.getByRole('button', { name: 'Invite a player' })).toBeTruthy();
  });
});

describe('what the folded rail keeps (mn-2, ap-17; mockup december/16, frame T13)', () => {
  // Folded (the default since mn-1), the rail keeps the campaign's sigil, named with the campaign's name; a tap opens
  // the menu, where the name and its editing are. (Its 44 px is measured in a real browser: tests/layout.)
  it('folded, the sigil is shown, named with the campaign, and opens the menu', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.addCampaign('The Ash Barrows', gm);
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const sigil = await screen.findByRole('button', { name: 'The Ash Barrows: open the menu' });
    expect(screen.getByRole('button', { name: 'Show the menu' })).toBeTruthy();
    await user.click(sigil);
    expect(screen.getByRole('button', { name: 'Fold the menu' })).toBeTruthy();
    expect(localStorage.getItem('grimoire.navCollapsed')).toBe('no');
    // Opened, the rail's sigil gives way to the heading as before: the sigil and the name that edit the campaign.
    expect(screen.queryByRole('button', { name: 'The Ash Barrows: open the menu' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change the campaign sigil' })).toBeTruthy();
  });

  // A live campaign's folded rail has no Retired mark.
  it('a live campaign folded shows no Retired mark', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    world.addCampaign('The Ash Barrows', gm);
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await screen.findByRole('button', { name: 'The Ash Barrows: open the menu' });
    expect(screen.queryByRole('button', { name: /^Retired campaign/ })).toBeNull();
  });

  // A retired campaign folded carries the lock and the word "Retired"; a tap opens "Retired campaign" with the
  // banner's words, and its Bring back runs the banner's command and brings the campaign back.
  it('a retired campaign folded shows the Retired mark, whose pop-up has the banner’s words and brings it back', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.campaigns.find((c) => c.id === campaign)!.retired_at = '2026-10-22T09:00:00Z';
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByText('Retired: 1'));
    await user.click(screen.getByRole('button', { name: /The Ash Barrows/ }));
    const mark = await screen.findByRole('button', { name: 'Retired campaign: read more' });
    expect(mark.textContent).toBe('Retired');
    // The lock is drawn (the status symbols' lock), not an empty mark.
    expect(mark.querySelector('svg rect, svg path')).toBeTruthy();
    // Under the sigil, before the sections.
    const sigil = screen.getByRole('button', { name: 'The Ash Barrows: open the menu' });
    expect(sigil.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(mark);
    const popUp = await screen.findByRole('dialog', { name: 'Retired campaign' });
    const banner = screen.getByRole('note', { name: 'Retired campaign' });
    expect(within(popUp).getByText(/Everyone can still read it/).textContent).toBe(within(banner).getByText(/Everyone can still read it/).textContent);
    await user.click(within(popUp).getByRole('button', { name: 'Bring back' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Retired campaign' })).toBeNull());
    expect(world.tables.campaigns.find((c) => c.id === campaign)?.retired_at).toBeNull();
    expect(world.tables.events.filter((e) => e.type === 'campaign.restore')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retired campaign: read more' })).toBeNull());
    expect(screen.queryByRole('note', { name: 'Retired campaign' })).toBeNull();
  });
});

describe('browsing setting rules', () => {
  function riverRulesIn(campaign: string, gm: string) {
    world.tables.packs.push({ id: 'pack-river', owner_user_id: gm, campaign_id: null, name: 'River Rules', version: '0.2', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown> = {}) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-river', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('class', 'lantern-warden', 'Lantern Warden', { hitDie: 'd8', xpTableId: 'warden-xp', notes: 'Keeps the lamps lit.' });
    entry('xpTable', 'warden-xp', 'Warden XP', { levels: [{ level: 2, xp: 2000 }] });
    entry('item', 'rope-50ft', 'Rope, 50 ft', { weightCoin: 50 });
    entry('item', 'reed-mat', 'Reed mat');
    entry('statBlock', 'bog-lurker', 'Bog lurker', { hp: '3d8', fields: { Move: '60 ft' } });
    entry('option', 'lantern-oil', 'Lanterns need oil', { default: 'on', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] });
    world.tables.campaign_packs.push({ id: 'link-river', campaign_id: campaign, pack_id: 'pack-river', pack_name: 'River Rules', option_choices: {}, priority: 1 });
  }
  const groups = () => screen.getAllByText(/: \d+$/).map((summary) => summary.textContent);

  it('the GM browses the campaign’s rules: a group per kind, details in plain words, and a search', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    riverRulesIn(world.addCampaign('The Ash Barrows', gm), gm);
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: 'Browse these rules' }));

    expect(groups()).toEqual(['Classes: 1', 'Items: 2', 'Stat blocks: 1', 'XP tables: 1']);
    await user.click(screen.getByText('Classes: 1'));
    await user.click(screen.getByRole('button', { name: 'Lantern Warden' }));
    const detail = within(await screen.findByRole('article', { name: 'Lantern Warden' }));
    expect(detail.getByText('Keeps the lamps lit.')).toBeTruthy();
    expect(detail.getByText('Hit die').nextSibling?.textContent).toBe('d8');
    expect(detail.getByText('XP table').nextSibling?.textContent).toBe('Warden XP');

    await user.click(detail.getByRole('button', { name: '‹ Back to the list' }));
    await user.type(screen.getByLabelText('Search these rules'), 'rope');
    expect(groups()).toEqual(['Items: 1']);
    expect(screen.getByRole('button', { name: 'Rope, 50 ft' })).toBeTruthy();
    await user.clear(screen.getByLabelText('Search these rules'));
    await user.type(screen.getByLabelText('Search these rules'), 'griffin');
    expect(screen.getByText('Nothing called “griffin”.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '‹ Setting rules' }));
    expect(await screen.findByRole('button', { name: 'Browse these rules' })).toBeTruthy();
  });

  it('a player reads the player-facing parts from ⋯ → Setting rules; never stat blocks', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    riverRulesIn(campaign, gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: player });
    world.addMember(campaign, player, 'player', wren);
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(screen.getByRole('button', { name: 'Setting rules' }));

    expect(await screen.findByRole('heading', { name: 'Setting rules' })).toBeTruthy();
    await screen.findByText('Classes: 1');
    // XP tables too, from M4b (ruled 2026-10-23: hooks and XP tables reach players' devices).
    expect(groups()).toEqual(['Classes: 1', 'Items: 2', 'XP tables: 1']);
    expect(screen.queryByText('Bog lurker')).toBeNull();
    await user.click(screen.getByRole('button', { name: '‹ Wren' }));
    expect(await screen.findByRole('heading', { name: 'Wren' })).toBeTruthy();
  });

  it('a player without a character yet can still read them, from Your characters', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    riverRulesIn(campaign, gm);
    world.addMember(campaign, player, 'player');
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Setting rules' }));
    await screen.findByText('Classes: 1');
    await user.click(screen.getByRole('button', { name: '‹ Your characters' }));
    expect(await screen.findByText('No one is in the ledger yet. Make your first character.')).toBeTruthy();
  });

  it('the GM browses a pack in their library', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    riverRulesIn(world.addCampaign('The Ash Barrows', gm), gm);
    world.signInAs(gm);
    const user = openApp();
    await screen.findByRole('heading', { name: 'Your campaigns' });
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Rules library' }));
    await user.click(await screen.findByRole('button', { name: 'Browse River Rules' }));
    expect(await screen.findByRole('heading', { name: 'River Rules' })).toBeTruthy();
    expect(groups()).toEqual(['Classes: 1', 'Items: 2', 'Stat blocks: 1', 'XP tables: 1']);
    await user.click(screen.getByText('Stat blocks: 1'));
    await user.click(screen.getByRole('button', { name: 'Bog lurker' }));
    // A stat block is the shared part (December 5c): each label followed at once by its value.
    expect(within(await screen.findByRole('article', { name: 'Bog lurker' })).getByText('Move').parentElement?.textContent).toBe('Move 60 ft');
    await user.click(screen.getByRole('button', { name: '‹ Back to the list' }));
    await user.click(screen.getByRole('button', { name: '‹ Rules library' }));
    expect(await screen.findByRole('button', { name: 'Browse River Rules' })).toBeTruthy();
  });
});

describe('stacking setting rules', () => {
  // Two packs with the same class: Fen Rules (higher) and River Rules (lower). Invented content.
  function twoPacks() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.addMember(campaign, player, 'player');
    for (const [id, name, priority] of [['pack-river', 'River Rules', 1], ['pack-fen', 'Fen Rules', 2]] as const) {
      world.tables.packs.push({ id, owner_user_id: gm, campaign_id: null, name, version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: id, kind: 'class', pack_entry_id: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden', name: 'Lantern Warden', hitDie: id === 'pack-fen' ? 'd6' : 'd8' } });
      world.tables.campaign_packs.push({ id: `link-${id}`, campaign_id: campaign, pack_id: id, pack_name: name, option_choices: {}, overrides: {}, priority });
    }
    return { gm, player, campaign };
  }
  async function openRules(user: ReturnType<typeof openApp>) {
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await screen.findByText('When two have the same entry, the higher one wins.');
  }
  const packNames = () => [...document.querySelectorAll('.setting-rules__pack .setting-rules__name')].map((n) => n.textContent);
  const hitDie = (article: ReturnType<typeof within>) => article.getByText('Hit die').nextSibling?.textContent;

  it('the GM moves setting rules up and down the stack with drag handles (here, as a screen reader does); it’s logged', async () => {
    const { gm } = twoPacks();
    world.signInAs(gm);
    const user = openApp();
    await openRules(user);
    expect(packNames()).toEqual(['Fen Rules', 'River Rules']);
    const river = screen.getByRole('slider', { name: 'Move River Rules' });
    expect(river.getAttribute('aria-valuetext')).toBe('Position 2 of 2');
    river.focus();
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(packNames()).toEqual(['River Rules', 'Fen Rules']));
    expect(world.tables.events.some((e) => e.type === 'rules.reorder')).toBe(true);
  });

  it('the browser shows the winning version once; the GM reads the other and picks it for that entry, then goes back', async () => {
    const { gm } = twoPacks();
    world.signInAs(gm);
    const user = openApp();
    await openRules(user);
    await user.click(screen.getByRole('button', { name: 'Browse these rules' }));
    await user.click(screen.getByText('Classes: 1'));
    await user.click(screen.getByRole('button', { name: /Lantern Warden/ }));
    let article = within(await screen.findByRole('article', { name: 'Lantern Warden' }));
    expect(article.getByText('Also in River Rules. Fen Rules wins: it\'s higher in the stack.')).toBeTruthy();
    expect(hitDie(article)).toBe('d6');

    await user.click(article.getByRole('button', { name: 'See the River Rules version' }));
    expect(article.getByText('The River Rules version, not used')).toBeTruthy();
    expect(hitDie(article)).toBe('d8');
    await user.click(article.getByRole('button', { name: 'Use this version' }));
    article = within(await screen.findByRole('article', { name: 'Lantern Warden' }));
    expect(await article.findByText('Also in Fen Rules. River Rules wins for this one, by your choice.')).toBeTruthy();
    expect(hitDie(article)).toBe('d8');
    // The exception is the GM's alone (ruled 2026-10-29, A4): kept where players don't read.
    expect(world.tables.campaign_pack_secrets.find((cp) => cp.id === 'link-pack-river')?.overrides).toEqual({ 'class:lantern-warden': 'Lantern Warden' });
    expect(world.tables.campaign_packs.find((cp) => cp.id === 'link-pack-river')?.overrides).toEqual({});

    await user.click(article.getByRole('button', { name: 'Back to the stack order' }));
    expect(await article.findByText('Also in River Rules. Fen Rules wins: it\'s higher in the stack.')).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'rules.prefer').length).toBeGreaterThan(0);
  });

  it('a player sees the winning version, with no choosing', async () => {
    const { player } = twoPacks();
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Setting rules' }));
    await user.click(await screen.findByText('Classes: 1'));
    await user.click(screen.getByRole('button', { name: /Lantern Warden/ }));
    const article = within(await screen.findByRole('article', { name: 'Lantern Warden' }));
    expect(hitDie(article)).toBe('d6');
    await user.click(article.getByRole('button', { name: 'See the River Rules version' }));
    expect(article.queryByRole('button', { name: 'Use this version' })).toBeNull();
  });

  // Ruled 2026-10-29 (A4): the exceptions are the GM's; a player's device still gets the version the GM picked.
  it("a player's device shows the version the GM picked, though the exceptions themselves are the GM's", async () => {
    const { player, campaign } = twoPacks();
    world.tables.campaign_pack_secrets.push({ id: 'link-pack-river', campaign_id: campaign, overrides: { 'class:lantern-warden': 'Lantern Warden', 'statBlock:bog-lurker': 'Bog lurker' } });
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Setting rules' }));
    await user.click(await screen.findByText('Classes: 1'));
    await user.click(screen.getByRole('button', { name: /Lantern Warden/ }));
    const article = within(await screen.findByRole('article', { name: 'Lantern Warden' }));
    expect(hitDie(article)).toBe('d8');
    expect(screen.queryByText(/Bog lurker/)).toBeNull();
  });

  it('the list says how to reorder (N21); with setting rules and no character fields there is no Character fields group (N20)', async () => {
    const { gm } = twoPacks();
    world.signInAs(gm);
    const user = openApp();
    await openRules(user);
    expect(screen.getByText('Press and hold a row to move it.')).toBeTruthy();
    expect(await screen.findByRole('button', { name: /^Characters, / })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Character fields/ })).toBeNull();
  });

  it("the campaign's own homebrew is removed like any other, after asking, and stays on top of the setting packs", async () => {
    const { gm, campaign } = twoPacks();
    world.tables.packs.push({ id: 'pack-home', owner_user_id: gm, campaign_id: campaign, name: 'The Ash Barrows homebrew', version: '', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.campaign_packs.push({ id: 'link-home', campaign_id: campaign, pack_id: 'pack-home', pack_name: 'The Ash Barrows homebrew', option_choices: {}, overrides: {}, priority: 3 });
    world.signInAs(gm);
    const user = openApp();
    await openRules(user);
    expect(packNames()).toEqual(['The Ash Barrows homebrew', 'Fen Rules', 'River Rules']);
    expect(screen.getByRole('button', { name: 'Remove Fen Rules from this campaign' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remove The Ash Barrows homebrew from this campaign' }));
    const confirm = within(screen.getByRole('group', { name: 'Remove The Ash Barrows homebrew' }));
    expect(confirm.getByText(/Saving homebrew again brings it back/)).toBeTruthy();
    await user.click(confirm.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(world.tables.campaign_packs.some((l) => l.id === 'link-home')).toBe(false));
  });

  it("the homebrew opens to show its entries, then the character fields (read only) with Edit, and Use this sheet layout", async () => {
    const { gm, campaign } = twoPacks();
    world.tables.packs.push({ id: 'pack-home', owner_user_id: gm, campaign_id: campaign, name: 'The Ash Barrows homebrew', version: '', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.campaign_packs.push({ id: 'link-home', campaign_id: campaign, pack_id: 'pack-home', pack_name: 'The Ash Barrows homebrew', option_choices: {}, overrides: {}, priority: 3 });
    world.tables.library_entries.push(
      { id: 'entry-home-lurker', pack_id: 'pack-home', kind: 'statBlock', pack_entry_id: 'bog-lurker', name: 'Bog lurker', data: { id: 'bog-lurker', name: 'Bog lurker' } },
      { id: 'entry-fen-sheet', pack_id: 'pack-fen', kind: 'fieldTemplate', pack_entry_id: 'fen-sheet', name: 'fen-sheet', data: { id: 'fen-sheet', appliesTo: 'pc', fields: [{ key: 'LUCK', label: 'Luck', type: 'number', group: 'Abilities' }] } },
    );
    world.tables.field_definitions.push({ id: 'field-grit', campaign_id: campaign, applies_to: 'pc', key: 'grit', label: 'Grit', type: 'number', choices: [], field_group: 'Abilities', sort_order: 0, show_on_card: false, hidden: false, created_at: '2026-10-18T12:00:00Z' });
    world.signInAs(gm);
    const user = openApp();
    await openRules(user);

    const toggle = screen.getByRole('button', { name: "What's in it" });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const panel = within(screen.getByRole('region', { name: "What's in The Ash Barrows homebrew" }));
    expect(panel.getByText('Bog lurker')).toBeTruthy();
    expect(panel.getByText(/stat block/)).toBeTruthy();
    expect(panel.getByRole('heading', { name: 'Character fields' })).toBeTruthy();
    expect(within(await panel.findByRole('list', { name: 'Character fields' })).getByText('Grit')).toBeTruthy();
    expect(panel.getByText(/Number, Abilities/)).toBeTruthy();
    // Read only here: nothing to type into, no Delete or Hide.
    expect(panel.queryByRole('textbox')).toBeNull();
    expect(panel.queryByRole('button', { name: /Delete|Hide/ })).toBeNull();

    // The editor is the Character fields group in Rules for this campaign (N20): Edit opens it and goes there.
    await user.click(panel.getByRole('button', { name: 'Edit character fields' }));
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-expanded')).toBe('true'));
    expect(document.activeElement?.textContent).toMatch(/^.Character fields, 1 field$/);
    expect(document.activeElement?.closest('.setting-rules')).toBeNull();
    expect(screen.getByRole('button', { name: 'Hide Grit' })).toBeTruthy();

    await user.click(panel.getByRole('button', { name: 'Use this sheet layout' }));
    const offer = within(await panel.findByRole('group', { name: 'Sheet layout of Fen Rules' }));
    await user.click(offer.getByRole('button', { name: 'Use this sheet layout' }));
    expect(await screen.findByText("One field was added from Fen Rules's sheet layout.")).toBeTruthy();
    expect(world.tables.field_definitions.map((f) => f.label)).toEqual(['Grit', 'Luck']);
    expect(await panel.findByText('Luck')).toBeTruthy();

    // Tap an entry to edit it (ruled 2026-10-24).
    await user.click(panel.getByRole('button', { name: /Bog lurker/ }));
    expect(await screen.findByRole('form', { name: /Bog lurker/ })).toBeTruthy();
  });

  it("the homebrew's ⋯ copies it to the Rules library as an independent pack (ruled 2026-10-25)", async () => {
    const { gm, campaign } = twoPacks();
    world.tables.packs.push({ id: 'pack-home', owner_user_id: gm, campaign_id: campaign, name: 'The Ash Barrows homebrew', version: '', kind: 'homebrew', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.campaign_packs.push({ id: 'link-home', campaign_id: campaign, pack_id: 'pack-home', pack_name: 'The Ash Barrows homebrew', option_choices: {}, overrides: {}, priority: 3 });
    world.tables.library_entries.push({ id: 'entry-home-lurker', pack_id: 'pack-home', kind: 'statBlock', pack_entry_id: 'bog-lurker', name: 'Bog lurker', data: { id: 'bog-lurker', name: 'Bog lurker' } });
    world.signInAs(gm);
    const user = openApp();
    await openRules(user);
    expect(screen.queryByRole('button', { name: 'Export as pack file' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'The Ash Barrows homebrew options' }));
    expect(screen.getByRole('button', { name: 'Export as pack file' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Copy to Rules library' }));
    expect(await screen.findByText('Copied to your Rules library as “The Ash Barrows homebrew (copy)”.')).toBeTruthy();
    const copy = world.tables.packs.find((p) => p.name === 'The Ash Barrows homebrew (copy)');
    expect(copy).toMatchObject({ owner_user_id: gm, campaign_id: null, kind: 'homebrew' });
    expect(world.tables.library_entries.filter((e) => e.pack_id === copy!.id).map((e) => e.name)).toEqual(['Bog lurker']);
    // Independent: the campaign's own is untouched and still attached.
    expect(world.tables.library_entries.filter((e) => e.pack_id === 'pack-home')).toHaveLength(1);
  });

  it('without a homebrew yet, no pack opens to show what’s in it', async () => {
    const { gm } = twoPacks();
    world.signInAs(gm);
    const user = openApp();
    await openRules(user);
    expect(screen.queryByRole('button', { name: "What's in it" })).toBeNull();
  });
});

describe('formulas in the browser', () => {
  it("a player sees formulas worked out at their character's level, and can try another level", async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const player = world.addPerson('wren@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: player });
    world.addMember(campaign, player, 'player', wren);
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { level: 3 });
    world.tables.packs.push({ id: 'pack-river', owner_user_id: gm, campaign_id: null, name: 'River Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push(
      { id: 'entry-glimmer', pack_id: 'pack-river', kind: 'spell', pack_entry_id: 'glimmer', name: 'Glimmer', data: { id: 'glimmer', name: 'Glimmer', duration: { formula: '2 + level', unit: 'turn' } } },
      { id: 'entry-rope', pack_id: 'pack-river', kind: 'item', pack_entry_id: 'rope', name: 'Rope', data: { id: 'rope', name: 'Rope', weightCoin: 50 } },
    );
    world.tables.campaign_packs.push({ id: 'link-river', campaign_id: campaign, pack_id: 'pack-river', pack_name: 'River Rules', option_choices: {}, overrides: {}, priority: 1 });
    world.signInAs(player);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Character options' }));
    await user.click(screen.getByRole('button', { name: 'Setting rules' }));
    await user.click(await screen.findByText('Spells: 1'));
    await user.click(screen.getByRole('button', { name: 'Glimmer' }));
    const article = within(await screen.findByRole('article', { name: 'Glimmer' }));
    expect(article.getByText('Duration').nextSibling?.textContent).toBe('2 + level turns → 5 turns');
    await user.click(article.getByRole('button', { name: 'Higher level' }));
    expect(article.getByText('Duration').nextSibling?.textContent).toBe('2 + level turns → 6 turns');

    await user.click(article.getByRole('button', { name: '‹ Back to the list' }));
    await user.click(screen.getByText('Items: 1'));
    await user.click(screen.getByRole('button', { name: 'Rope' }));
    expect(within(await screen.findByRole('article', { name: 'Rope' })).queryByRole('group', { name: 'Work out at level' })).toBeNull();
  });
});

describe('the in-app editor', () => {
  function gmWithRope() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-river', owner_user_id: gm, campaign_id: null, name: 'River Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({ id: 'entry-rope', pack_id: 'pack-river', kind: 'item', pack_entry_id: 'rope', name: 'Rope', data: { id: 'rope', name: 'Rope', weightCoin: 50 } });
    world.tables.campaign_packs.push({ id: 'link-river', campaign_id: campaign, pack_id: 'pack-river', pack_name: 'River Rules', option_choices: {}, overrides: {}, priority: 1 });
    world.signInAs(gm);
    return { gm, campaign };
  }
  async function openRules(user: ReturnType<typeof openApp>) {
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await screen.findByText('River Rules');
  }
  const value = (article: ReturnType<typeof within>, label: string) => article.getByText(label).nextSibling?.textContent;

  it('the GM makes a stat block: checked first, then saved in the campaign’s homebrew, which starts on top', async () => {
    gmWithRope();
    const user = openApp();
    await openRules(user);
    await user.click(screen.getByRole('button', { name: '+ New homebrew entry' }));
    await user.click(within(screen.getByRole('group', { name: 'New homebrew entry' })).getByRole('button', { name: 'Stat block' }));
    const form = within(await screen.findByRole('form', { name: 'New stat block' }));
    await user.type(form.getByLabelText('Name'), 'Bog lurker');
    await user.type(form.getByLabelText('Hit points'), '3d8');
    await user.type(form.getByLabelText('Average hit points'), 'about 13');
    await user.click(form.getByRole('button', { name: '+ Add a line' }));
    await user.type(form.getByLabelText('Stat line 1: label'), 'AC');
    await user.type(form.getByLabelText('Stat line 1: value'), '6');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(form.getByText('Average hit points must be a whole number.')).toBeTruthy();

    await user.clear(form.getByLabelText('Average hit points'));
    await user.type(form.getByLabelText('Average hit points'), '13');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Bog lurker was saved in this campaign’s homebrew.')).toBeTruthy();
    expect([...document.querySelectorAll('.setting-rules__pack .setting-rules__name')].map((n) => n.textContent)).toEqual(['The Ash Barrows homebrew', 'River Rules']);
    expect(world.tables.library_entries.find((e) => e.pack_entry_id === 'bog-lurker')?.data).toEqual({ id: 'bog-lurker', name: 'Bog lurker', hp: '3d8', hpAverage: 13, fields: { AC: '6' } });
    expect(world.tables.events.some((e) => e.type === 'homebrew.save' && e.target_table === 'library_entries')).toBe(true);
  });

  it('editing a pack’s item makes a homebrew version that wins; deleting it brings the pack’s back', async () => {
    gmWithRope();
    const user = openApp();
    await openRules(user);
    await user.click(screen.getByRole('button', { name: 'Browse these rules' }));
    await user.click(screen.getByText('Items: 1'));
    await user.click(screen.getByRole('button', { name: 'Rope' }));
    await user.click(within(await screen.findByRole('article', { name: 'Rope' })).getByRole('button', { name: 'Edit as homebrew' }));
    const form = within(await screen.findByRole('form', { name: 'Edit Rope' }));
    await user.clear(form.getByLabelText('Weight (coins)'));
    await user.type(form.getByLabelText('Weight (coins)'), '40');
    await user.click(form.getByRole('button', { name: 'Save' }));

    let article = within(await screen.findByRole('article', { name: 'Rope' }));
    await waitFor(() => expect(value(article, 'Weight (coins)')).toBe('40'));
    expect(article.getByText(/^Also in River Rules\./)).toBeTruthy();
    await user.click(article.getByRole('button', { name: 'Delete from homebrew…' }));
    await user.click(within(article.getByRole('group', { name: 'Delete Rope from the homebrew' })).getByRole('button', { name: 'Delete' }));
    article = within(await screen.findByRole('article', { name: 'Rope' }));
    await waitFor(() => expect(value(article, 'Weight (coins)')).toBe('50'));
    expect(article.getByRole('button', { name: 'Edit as homebrew' })).toBeTruthy();
    expect(world.tables.library_entries.find((e) => e.pack_id === 'pack-river')?.data).toEqual({ id: 'rope', name: 'Rope', weightCoin: 50 });
  });

  it('an edit always takes effect: with an exception for River Rules, saving asks "Use your edit instead?"', async () => {
    gmWithRope();
    world.tables.campaign_pack_secrets.push({ id: 'link-river', campaign_id: world.tables.campaign_packs.find((l) => l.id === 'link-river')!.campaign_id, overrides: { 'item:rope': 'Rope' } });
    const user = openApp();
    await openRules(user);
    await user.click(screen.getByRole('button', { name: 'Browse these rules' }));
    await user.click(screen.getByText('Items: 1'));
    await user.click(screen.getByRole('button', { name: 'Rope' }));
    await user.click(within(await screen.findByRole('article', { name: 'Rope' })).getByRole('button', { name: 'Edit as homebrew' }));
    const form = within(await screen.findByRole('form', { name: 'Edit Rope' }));
    await user.clear(form.getByLabelText('Weight (coins)'));
    await user.type(form.getByLabelText('Weight (coins)'), '40');
    await user.click(form.getByRole('button', { name: 'Save' }));
    const ask = within(await screen.findByRole('dialog', { name: 'Make your edit count?' }));
    await user.click(ask.getByRole('button', { name: 'Use your edit' }));
    const article = within(await screen.findByRole('article', { name: 'Rope' }));
    await waitFor(() => expect(value(article, 'Weight (coins)')).toBe('40'));
    expect(article.getByText(/Your version \(The Ash Barrows homebrew\)/)).toBeTruthy();
  });

  it('a retired campaign offers no editing', async () => {
    const { campaign } = gmWithRope();
    world.tables.campaigns.find((c) => c.id === campaign)!.retired_at = '2026-10-20T12:00:00Z';
    const user = openApp();
    await user.click(await screen.findByText('Retired: 1'));
    await openRules(user);
    expect(screen.queryByRole('button', { name: '+ New homebrew entry' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Browse these rules' }));
    await user.click(screen.getByText('Items: 1'));
    await user.click(screen.getByRole('button', { name: 'Rope' }));
    expect(within(await screen.findByRole('article', { name: 'Rope' })).queryByRole('button', { name: 'Edit as homebrew' })).toBeNull();
  });
});

describe('the in-app editor: classes, races, spells, spell lists, starting kits', () => {
  function gmWithWarden() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-river', owner_user_id: gm, campaign_id: null, name: 'River Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown> = {}) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-river', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('class', 'lantern-warden', 'Lantern Warden', { hitDie: 'd8', progression: [{ level: 2, xp: 2000 }] });
    entry('spell', 'glimmer', 'Glimmer');
    entry('spell', 'mire-light', 'Mire light');
    world.tables.campaign_packs.push({ id: 'link-river', campaign_id: campaign, pack_id: 'pack-river', pack_name: 'River Rules', option_choices: {}, overrides: {}, priority: 1 });
    world.signInAs(gm);
  }
  async function newEntry(user: ReturnType<typeof openApp>, kind: string) {
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: '+ New homebrew entry' }));
    await user.click(within(screen.getByRole('group', { name: 'New homebrew entry' })).getByRole('button', { name: kind }));
  }
  const saved = (id: string) => world.tables.library_entries.find((e) => e.pack_entry_id === id && e.pack_id !== 'pack-river')?.data;

  it('a spell list takes spells by name, and says when a name isn’t found', async () => {
    gmWithWarden();
    const user = openApp();
    await newEntry(user, 'Spell list');
    const form = within(await screen.findByRole('form', { name: 'New spell list' }));
    await user.type(form.getByLabelText('Name'), 'Warden spells');
    await user.click(form.getByRole('button', { name: '+ Add a row' }));
    await user.type(form.getByLabelText('Levels 1: Level'), '1');
    await user.type(form.getByLabelText('Levels 1: Spells'), 'glimmer, Fog');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(form.getByText('Levels, row 1: Spells has a name that isn’t in these setting rules.')).toBeTruthy();
    await user.clear(form.getByLabelText('Levels 1: Spells'));
    await user.type(form.getByLabelText('Levels 1: Spells'), 'glimmer, Mire light');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Warden spells was saved in this campaign’s homebrew.')).toBeTruthy();
    expect(saved('warden-spells')).toEqual({ id: 'warden-spells', name: 'Warden spells', levels: [{ level: 1, spells: ['glimmer', 'mire-light'] }] });
  });

  it('a race lists the classes it can be, up to a level, and its ability changes', async () => {
    gmWithWarden();
    const user = openApp();
    await newEntry(user, 'Race');
    const form = within(await screen.findByRole('form', { name: 'New race' }));
    await user.type(form.getByLabelText('Name'), 'Marsh folk');
    await user.click(within(form.getByRole('group', { name: 'Ability changes' })).getByRole('button', { name: '+ Add a line' }));
    await user.type(form.getByLabelText('Ability changes 1: label'), 'DEX');
    await user.type(form.getByLabelText('Ability changes 1: value'), '+1');
    await user.click(form.getByRole('button', { name: '+ Add one' }));
    await user.selectOptions(form.getByLabelText('Classes it can be 1'), 'Lantern Warden');
    await user.type(form.getByLabelText('Classes it can be 1: Up to level'), '8');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Marsh folk was saved in this campaign’s homebrew.')).toBeTruthy();
    expect(saved('marsh-folk')).toEqual({ id: 'marsh-folk', name: 'Marsh folk', abilityMods: { DEX: 1 }, classes: { 'lantern-warden': 8 } });
  });

  it('editing a class keeps the parts its form doesn’t show, and says so', async () => {
    gmWithWarden();
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: 'Browse these rules' }));
    await user.click(screen.getByText('Classes: 1'));
    await user.click(screen.getByRole('button', { name: 'Lantern Warden' }));
    await user.click(within(await screen.findByRole('article', { name: 'Lantern Warden' })).getByRole('button', { name: 'Edit as homebrew' }));
    const form = within(await screen.findByRole('form', { name: 'Edit Lantern Warden' }));
    expect(form.getByText('Kept as it is (not in this form yet): progression.')).toBeTruthy();
    await user.clear(form.getByLabelText('Hit die'));
    await user.type(form.getByLabelText('Hit die'), 'd6');
    await user.click(form.getByRole('button', { name: 'Save' }));
    await screen.findByRole('article', { name: 'Lantern Warden' });
    await waitFor(() => expect(saved('lantern-warden')).toEqual({ id: 'lantern-warden', name: 'Lantern Warden', hitDie: 'd6', progression: [{ level: 2, xp: 2000 }] }));
  });
});

describe('the in-app editor: tables, treasure, rules sets, optional rules, hooks, sheet layouts', () => {
  function gmWithTables() {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    world.tables.packs.push({ id: 'pack-river', owner_user_id: gm, campaign_id: null, name: 'River Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    world.tables.library_entries.push({
      id: 'entry-hits',
      pack_id: 'pack-river',
      kind: 'table',
      pack_entry_id: 'hits',
      name: 'Hits',
      data: { id: 'hits', name: 'Hits', kind: 'matrix', columns: ['Near', 'Far'], rows: [{ level: '1', results: ['10', '12'] }] },
    });
    world.tables.campaign_packs.push({ id: 'link-river', campaign_id: campaign, pack_id: 'pack-river', pack_name: 'River Rules', option_choices: {}, overrides: {}, priority: 1 });
    world.signInAs(gm);
  }
  async function newEntry(user: ReturnType<typeof openApp>, kind: string) {
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: '+ New homebrew entry' }));
    await user.click(within(screen.getByRole('group', { name: 'New homebrew entry' })).getByRole('button', { name: kind }));
  }
  const saved = (id: string) => world.tables.library_entries.find((e) => e.pack_entry_id === id && e.pack_id !== 'pack-river')?.data;

  it('"For sale in shops" is two buttons: No saves false, and tapping it again leaves it unset', async () => {
    gmWithTables();
    const user = openApp();
    await newEntry(user, 'Item');
    const form = within(await screen.findByRole('form', { name: 'New item' }));
    await user.type(form.getByLabelText('Name'), 'Glass eye');
    const sale = within(form.getByRole('group', { name: 'For sale in shops' }));
    await user.click(sale.getByRole('button', { name: 'No' }));
    expect(sale.getByRole('button', { name: 'No' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(sale.getByRole('button', { name: 'Yes' }));
    await user.click(sale.getByRole('button', { name: 'Yes' }));
    expect(sale.getByRole('button', { name: 'Yes' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(sale.getByRole('button', { name: 'No' }));
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Glass eye was saved in this campaign’s homebrew.')).toBeTruthy();
    expect(saved('glass-eye')).toMatchObject({ name: 'Glass eye', forSale: false });
  });

  it('an optional rule: choices, a default among them, and whether it can change later; it then shows in Setting rules', async () => {
    gmWithTables();
    const user = openApp();
    await newEntry(user, 'Optional rule');
    const form = within(await screen.findByRole('form', { name: 'New optional rule' }));
    await user.type(form.getByLabelText('Name'), 'Slow healing');
    await user.click(form.getByRole('button', { name: '+ Add a row' }));
    await user.type(form.getByLabelText('Choices 1: Choice'), 'Yes');
    await user.click(form.getByRole('button', { name: '+ Add a row' }));
    await user.type(form.getByLabelText('Choices 2: Choice'), 'No');
    await user.selectOptions(form.getByLabelText('Default'), 'No');
    await user.selectOptions(form.getByLabelText('Once the campaign has started'), 'Can change, but asks first');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Slow healing was saved in this campaign’s homebrew.')).toBeTruthy();
    expect(saved('slow-healing')).toEqual({
      id: 'slow-healing',
      name: 'Slow healing',
      choices: [{ name: 'Yes', id: 'yes' }, { name: 'No', id: 'no' }],
      default: 'no',
      changeLater: 'warn',
    });
    expect(screen.getByRole('button', { name: 'Optional rules' })).toBeTruthy();
  });

  it('a table needs a result on each row', async () => {
    gmWithTables();
    const user = openApp();
    await newEntry(user, 'Table');
    const form = within(await screen.findByRole('form', { name: 'New table' }));
    await user.type(form.getByLabelText('Name'), 'Fen weather');
    await user.type(form.getByLabelText('Die'), 'd6');
    await user.click(form.getByRole('button', { name: '+ Add a row' }));
    await user.type(form.getByLabelText('Rows 1: From'), '1');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(form.getByText('Rows, row 1: Result is missing.')).toBeTruthy();
    await user.type(form.getByLabelText('Rows 1: Result'), 'Fog');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Fen weather was saved in this campaign’s homebrew.')).toBeTruthy();
    expect(saved('fen-weather')).toEqual({ id: 'fen-weather', name: 'Fen weather', die: 'd6', rows: [{ min: 1, result: 'Fog' }] });
  });

  it('a treasure type can do without a name; its letter gives the id', async () => {
    gmWithTables();
    const user = openApp();
    await newEntry(user, 'Treasure type');
    const form = within(await screen.findByRole('form', { name: 'New treasure type' }));
    await user.type(form.getByLabelText('Letter'), 'K');
    await user.click(form.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved('k')).toEqual({ id: 'k', letter: 'K' }));
  });

  it('editing a matrix table keeps its rows and says so', async () => {
    gmWithTables();
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: 'Browse these rules' }));
    await user.click(screen.getByText('Tables: 1'));
    await user.click(screen.getByRole('button', { name: 'Hits' }));
    await user.click(within(await screen.findByRole('article', { name: 'Hits' })).getByRole('button', { name: 'Edit as homebrew' }));
    const form = within(await screen.findByRole('form', { name: 'Edit Hits' }));
    expect(form.getByText('Kept as it is (not in this form yet): kind, columns, rows.')).toBeTruthy();
    await user.type(form.getByLabelText('Notes'), 'Read across.');
    await user.click(form.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(saved('hits')).toEqual({ id: 'hits', name: 'Hits', kind: 'matrix', columns: ['Near', 'Far'], rows: [{ level: '1', results: ['10', '12'] }], notes: 'Read across.' }),
    );
  });
});


describe('the Pack tab (M4 step 4)', () => {
  // Invented setting rules: a coin mode with three tiers, a slot mode, armour rows, and a few items.
  const COIN = {
    maxLoadCoin: 1000,
    tiers: [
      { label: 'Unhurried', max: 300, effect: 'Full pace' },
      { label: 'Loaded', max: 700, effect: 'Slower' },
      { label: 'Bowed', max: 1000, effect: 'Crawling' },
    ],
    overMax: 'Stuck',
  };
  const SLOT = {
    tiers: [
      { label: 'Light', maxSlots: 6, effect: 'Normal pace' },
      { label: 'Laden', maxSlots: 10, effect: 'Slowed' },
      { label: 'Straining', maxSlots: 14, effect: 'Crawling' },
    ],
  };

  function packWorld(mode: 'coin' | 'slot' | 'armour') {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('wren@lantern.example', 'Sam');
    const jo = world.addPerson('ash@lantern.example', 'Jo');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    const ash = world.addCharacter(campaign, 'Ash', { ownerId: jo });
    world.addMember(campaign, sam, 'player', wren);
    world.addMember(campaign, jo, 'player', ash);
    Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!, { settings: { encumbrance: { mode } } });
    world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown> = {}) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('rulesSet', 'fen-rules', 'Fen rules', {
      encumbrance: {
        mode,
        coin: COIN,
        slot: SLOT,
        armour: { maxLoadCoin: 500, movement: [{ armour: 'none', withoutTreasure: '100 ft', withTreasure: '70 ft' }] },
        treasureWeights: { gem: 1 },
      },
    });
    entry('item', 'rope', 'Coil of rope', { category: 'gear', weightCoin: 50, slots: 1, value: { gp: 1 } });
    entry('item', 'anvil', 'Small anvil', { category: 'gear', weightCoin: 400, slots: 3 });
    entry('item', 'cloak', 'Oiled cloak', { category: 'gear', weightCoin: 20, slots: 1, slot: 'armour', notes: 'Keeps the drizzle off.' });
    world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen Rules', option_choices: {}, priority: 1 });
    const line = (actorId: string | null, name: string, extra: Record<string, unknown> = {}) =>
      world.tables.inventory_lines.push({
        id: `line-${name.toLowerCase().replace(/\W+/g, '-')}`,
        campaign_id: campaign,
        actor_id: actorId,
        location_id: actorId ? null : `location-stash-${campaign}`,
        library_entry_id: null,
        name,
        category: 'gear',
        weight_coin: null,
        slots: null,
        stack: 1,
        qty: 1,
        container_line_id: null,
        equipped: false,
        how_got: 'found',
        cost: '',
        notes: '',
        item_data: {},
        source_pack_id: null,
        source_entry_id: null,
        charges_left: null,
        charges_hidden: false,
        charges_used: 0,
        spent_shown: false,
        last_roll: null,
        pinned: false,
        at_hand_hidden: false,
        approval: 'approved',
        per_units: 1,
        version: 1,
        created_at: `2026-10-23T10:00:0${world.tables.inventory_lines.length}Z`,
        ...extra,
      });
    world.signInAs(sam);
    return { gm, sam, jo, campaign, wren, ash, line };
  }

  /** Give through the item's Give sheet (B24): choose who, then the main button ("Give to …"). */
  async function giveTo(user: ReturnType<typeof openApp>, item: string, who: string) {
    await user.click(screen.getByRole('button', { name: 'Give to…' }));
    const give = within(await screen.findByRole('dialog', { name: `Give ${item}` }));
    await user.click(give.getByRole('radio', { name: new RegExp(`^${who}`) }));
    await user.click(give.getAllByRole('button', { name: new RegExp(`^Give( \\d+)? to ${who}`) })[0]!);
  }

  /** Move to… through the item's sheet (B19; ruled 2026-10-26): choose where, then the main button ("Put in Sack"). */
  async function moveTo(user: ReturnType<typeof openApp>, item: string, where: RegExp, verb: string) {
    await user.click(screen.getByRole('button', { name: 'Put in…' }));
    const move = within(await screen.findByRole('dialog', { name: `Move ${item}` }));
    await user.click(move.getByRole('radio', { name: where }));
    await user.click(move.getAllByRole('button', { name: verb })[0]!);
  }

  /** A fold row on the Pack (plan m5b-players-screens-standard C): Gear, Tiny things, the Party stash. */
  const fold = (label: string) => screen.getByText(label, { selector: '.creation-fold__label' }).closest('details')!;
  const foldNote = (label: string) => fold(label).querySelector('.creation-fold__note')!.textContent;
  async function toggleFold(user: ReturnType<typeof openApp>, label: string) {
    const was = fold(label).open;
    await user.click(fold(label).querySelector('summary')!);
    await waitFor(() => expect(fold(label).open).toBe(!was));
  }

  /** The Pack's "Party stash" row opens the stash's own screen (K11, pk-4). */
  async function openStash(user: ReturnType<typeof openApp>) {
    await user.click(screen.getByRole('button', { name: /^Party stash/ }));
    return within(await screen.findByRole('region', { name: 'Party stash' }));
  }

  async function openPack(user: ReturnType<typeof openApp>) {
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    expect(await screen.findByRole('heading', { name: 'Wren’s pack' })).toBeTruthy();
  }

  /** A Bog mage who can wear no armour or shield, and the setting's equip warnings (invented; ruled 2026-10-21). */
  function warningWorld() {
    const world2 = packWorld('coin');
    const entry = (kind: string, id: string, name: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind, pack_entry_id: id, name, data: { id, name, ...data } });
    entry('class', 'bog-mage', 'Bog mage', { armourAllowed: { types: [], shields: false } });
    entry('hook', 'warn-armour', 'warn-armour', { kind: 'warn', when: 'equip', test: 'item.slot == "armour" and not allows(character.class.armourAllowed, item)', message: "{character.class.name} can't wear {item.name}. The GM can allow it." });
    entry('hook', 'warn-two-handed', 'warn-two-handed', { kind: 'warn', when: 'equip', test: 'item.hands == 2 and equipped.shield != null', message: '{item.name} needs both hands.', offer: 'stowOther' });
    Object.assign(world.tables.actors.find((a) => a.id === world2.wren)!, { classes: [{ classRef: 'bog-mage', level: 1, xp: 0 }] });
    return world2;
  }

  // A10 (ruled 2026-10-25): against the class's rules is blocked, with the reason in a pop-up; no "Do it anyway".
  it("plate on a mage is blocked: Wear says why in a pop-up; nothing goes on", async () => {
    const { wren, line } = warningWorld();
    line(wren, 'Plate', { item_data: { slot: 'armour', armourType: 'plate' }, source_entry_id: 'plate' });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Plate/ }));
    // "Put it" became Wear / Hold on the item (ruled 2026-10-26); against the class it says why (A10).
    await user.click(screen.getByRole('button', { name: 'Wear' }));
    expect(await screen.findByText("Bog mage can't use Plate.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Do it anyway' })).toBeNull();
    expect(world.tables.inventory_lines[0]).toMatchObject({ equipped: false });
    expect(world.tables.events.some((e) => e.type === 'inventory.equipAnyway' || e.type === 'inventory.equip')).toBe(false);
  });

  // Gate test 6 (2026-10-25): Add item's "Wear it" skipped the checks; a pack already against the rules showed nothing.
  it('Add item straight to Wear it is blocked the same way; plate already worn is marked "Not allowed" with the reason', async () => {
    const { wren, line } = warningWorld();
    line(wren, 'Old plate', { equipped: true, item_data: { slot: 'armour', armourType: 'plate' } });
    world.tables.library_entries.push({ id: 'entry-plate', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'plate', name: 'Plate', data: { id: 'plate', name: 'Plate', category: 'armour', slot: 'armour', armourType: 'plate', forSale: true } });
    const user = openApp();
    await openPack(user);
    expect(await screen.findByText(/Not allowed/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Old plate/ }));
    expect(await screen.findByText("Bog mage can't use Old plate.")).toBeTruthy();

    // Add item opens at its top on a phone, wherever the Pack was scrolled (M4b re-test, 2026-10-26).
    const scrolled = vi.fn();
    window.scrollTo = scrolled as unknown as typeof window.scrollTo;
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(scrolled).toHaveBeenCalledWith({ top: 0 });
    await user.type(await screen.findByLabelText('Search items'), 'plate');
    await user.click(screen.getByRole('button', { name: /^Plate/ }));
    await user.click(screen.getByRole('radio', { name: /^Worn/ }));
    await user.click(screen.getByRole('button', { name: 'Add and wear it' }));
    const popup = await screen.findByRole('dialog', { name: "Bog mage can't use Plate" });
    await user.click(within(popup).getByRole('button', { name: 'OK' }));
    expect(world.tables.inventory_lines.map((l) => l.name)).toEqual(['Old plate']);
  });

  // B25 (ruled 2026-10-25): gear that stops casting can be worn; a toast says so with Undo, and the status shows.
  it("heavy armour on an Ember Keeper goes on, toasts \"Plate stops divine casting\" with Undo, and shows Can't kindle until taken off", async () => {
    const { wren, line } = warningWorld();
    world.tables.library_entries.push({
      id: 'entry-ember-keeper',
      pack_id: 'pack-fen',
      kind: 'class',
      pack_entry_id: 'ember-keeper',
      name: 'Ember Keeper',
      data: { id: 'ember-keeper', name: 'Ember Keeper', armourAllowed: { types: 'any', shields: true }, spellcasting: { castingType: 'divine', blockedBy: { armour: ['heavy'], shields: true }, statusName: "Can't kindle" } },
    });
    Object.assign(world.tables.actors.find((a) => a.id === wren)!, { classes: [{ classRef: 'ember-keeper', level: 1, xp: 0 }] });
    line(wren, 'Plate', { item_data: { slot: 'armour', armourType: 'heavy' }, source_entry_id: 'plate' });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Plate/ }));
    await user.click(screen.getByRole('button', { name: 'Wear' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ equipped: true }));
    expect(await screen.findByText('Plate stops divine casting')).toBeTruthy();
    // The Pack row says so, muted (words batch 1).
    expect(await screen.findByText(/Stops divine casting/)).toBeTruthy();
    // The status, on the Player screen: its words with the symbol, and why on tap.
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Player' }));
    await user.click(await screen.findByRole('button', { name: /Can't kindle/ }));
    expect(within(await screen.findByRole('dialog', { name: "Can't kindle" })).getByText('Plate stops divine casting.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    // Undo from the toast takes it off, and the status goes with it.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ equipped: false }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Can't kindle/ })).toBeNull());
  });

  it('Add item straight into the hand: a two-handed weapon with a shield held offers to stow the shield', async () => {
    const { wren, line } = warningWorld();
    line(wren, 'Reed shield', { equipped: true, item_data: { slot: 'shield' } });
    world.tables.library_entries.push({ id: 'entry-greatsword', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'greatsword', name: 'Greatsword', data: { id: 'greatsword', name: 'Greatsword', category: 'weapon', slot: 'hand', hands: 2, forSale: true } });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.type(await screen.findByLabelText('Search items'), 'greatsword');
    await user.click(screen.getByRole('button', { name: /^Greatsword/ }));
    await user.click(screen.getByRole('radio', { name: /^In hand/ }));
    await user.click(screen.getByRole('button', { name: 'Add and hold it' }));
    const popup = await screen.findByRole('dialog', { name: 'Put on Greatsword?' });
    expect(popup.textContent).toContain('Greatsword needs both hands.');
    await user.click(within(popup).getByRole('button', { name: 'Stow the Reed shield' }));
    await waitFor(() =>
      expect(world.tables.inventory_lines.map((l) => [l.name, l.equipped])).toEqual([
        ['Reed shield', false],
        ['Greatsword', true],
      ]),
    );
  });

  it('a two-handed weapon with a shield offers to stow the shield; "Keep things as they are" changes nothing', async () => {
    const { wren, line } = warningWorld();
    line(wren, 'Reed shield', { equipped: true, item_data: { slot: 'shield' } });
    line(wren, 'Greatsword', { item_data: { slot: 'hand', hands: 2 } });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Greatsword/ }));
    await user.click(screen.getByRole('button', { name: 'Hold' }));
    await screen.findByText('Greatsword needs both hands.');
    await user.click(screen.getByRole('button', { name: 'Keep things as they are' }));
    expect(screen.queryByText('Greatsword needs both hands.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Hold' }));
    await user.click(await screen.findByRole('button', { name: 'Stow the Reed shield' }));
    await waitFor(() =>
      expect(world.tables.inventory_lines.map((l) => [l.name, l.equipped])).toEqual([
        ['Reed shield', false],
        ['Greatsword', true],
      ]),
    );
  });

  // Ruled 2026-10-29 (armour.baseArmour: { choose }): Add item asks once which base; the choice is kept on the line.
  it('adding magic armour asks once which base armour; the choice is kept on its line', async () => {
    packWorld('coin');
    const entry = (id: string, name: string, data: Record<string, unknown>) =>
      world.tables.library_entries.push({ id: `entry-${id}`, pack_id: 'pack-fen', kind: 'item', pack_entry_id: id, name, data: { id, name, category: 'armour', slot: 'armour', ...data } });
    entry('reed-coat', 'Reed coat', { armour: { base: 13 }, value: { gp: 5 } });
    entry('bark-vest', 'Bark vest', { armour: { base: 12 }, value: { gp: 5 } });
    entry('glimmer-mail', 'Glimmer mail', { armour: { magicBonus: 1, baseArmour: { choose: ['reed-coat', 'bark-vest'] } }, forSale: true, value: { gp: 900 } });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.type(await screen.findByLabelText('Search items'), 'glimmer');
    await user.click(screen.getByRole('button', { name: /^Glimmer mail/ }));
    const bases = within(screen.getByRole('radiogroup', { name: 'Base armour' }));
    expect(bases.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Reed coat', 'Bark vest']);
    await user.click(bases.getByRole('radio', { name: 'Bark vest' }));
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Glimmer mail')?.base_armour_id).toBe('bark-vest'));
  });

  it('adds an item from the setting rules: search, how it was got, where it goes; the load and the log follow', async () => {
    packWorld('coin');
    const user = openApp();
    await openPack(user);
    expect(screen.getByRole('button', { name: 'Unhurried' })).toBeTruthy();
    expect(screen.getByText('0 of 1,000 coins')).toBeTruthy();
    expect(screen.getByText('Nothing carried yet. Add what you take on the road.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.type(await screen.findByLabelText('Search items'), 'rope');
    await user.click(screen.getByRole('button', { name: /Coil of rope/ }));
    await user.click(screen.getByRole('button', { name: 'Bought' }));
    expect((screen.getByLabelText('Cost') as HTMLInputElement).value).toBe('1 gp');
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));

    // The purse note shows where the screen lands, back on the Pack (until purses arrive in M7).
    expect(await screen.findByText('Cost noted; purses arrive later.')).toBeTruthy();
    const carried = within(await screen.findByRole('region', { name: 'Carried' }));
    expect(carried.getByRole('button', { name: /Coil of rope.*50 coins/ })).toBeTruthy();
    expect(screen.getByText('50 of 1,000 coins')).toBeTruthy();
    expect(world.tables.inventory_lines).toMatchObject([{ name: 'Coil of rope', weight_coin: 50, how_got: 'bought', cost: '1 gp', library_entry_id: 'entry-rope', source_entry_id: 'rope' }]);
    expect(world.tables.events.filter((e) => e.type === 'inventory.add')).toHaveLength(1);
  });

  it('crossing into a slower tier shows a banner at the top of the pack, in the warning colour', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Iron chest', { weight_coin: 290 });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.type(await screen.findByLabelText('Search items'), 'anvil');
    await user.click(screen.getByRole('button', { name: /Small anvil/ }));
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    const banner = await screen.findByText('Wren is now Loaded');
    expect(banner.className).toBe('pack__banner pack__banner--warn');
    expect(screen.getByRole('button', { name: 'Loaded' })).toBeTruthy();
  });

  it('Drop on a stack asks how many, from the whole stack; the item closes after and the toast offers Undo (B23, B24)', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Torch', { stack: 20, qty: 6, item_data: { unitName: 'torch', pluralName: 'torches' } });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Torch/ }));
    await user.click(screen.getByRole('button', { name: 'Drop' }));
    const drop = within(await screen.findByRole('dialog', { name: 'Drop Torch' }));
    expect(drop.getByText('all 6 torches')).toBeTruthy();
    await user.click(drop.getByRole('button', { name: 'Less how many' }));
    await user.click(drop.getByRole('button', { name: 'Less how many' }));
    await user.click(drop.getAllByRole('button', { name: 'Drop 4' })[0]!);
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ qty: 2 }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Torch' })).toBeNull());
    expect(await screen.findByText('Dropped 4 torches')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ qty: 6 }));
  });

  it('a dropped item is gone, and Undo from the log brings it back where it was (ruled 2026-10-25)', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Torch', { stack: 20, qty: 6 });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Torch/ }));
    await user.click(screen.getByRole('button', { name: 'Drop' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Drop Torch' })).getAllByRole('button', { name: 'Drop 6' })[0]!);
    await waitFor(() => expect(world.tables.inventory_lines).toEqual([]));

    await user.click(screen.getByRole('button', { name: 'Log' }));
    await openLine(user, "You dropped Torch ×6 from Wren's pack.");
    await user.click(await screen.findByRole('button', { name: "Undo: You dropped Torch ×6 from Wren's pack." }));
    expect(await screen.findByText('You undid a drop: Torch ×6 is back with Wren.')).toBeTruthy();
    expect(world.tables.inventory_lines).toMatchObject([{ name: 'Torch', qty: 6, actor_id: wren }]);
  });

  it('an At hand row offers the same actions: give it to the Party stash from the Player screen', async () => {
    const { wren, campaign, line } = packWorld('coin');
    line(wren, 'Moss potion', { pinned: true, category: 'potion' });
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const atHand = within(await screen.findByRole('region', { name: 'At hand' }));
    await user.click(atHand.getByRole('button', { name: /^Moss potion/ }));
    await giveTo(user, 'Moss potion', 'Party stash');
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ location_id: `location-stash-${campaign}` }));
  });

  it('Move to… puts an item in a container; an item with nowhere to go has no Move to… (ruled 2026-10-26)', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Sack', { id: 'line-sack', item_data: { container: { capacityCoin: 200 } } });
    line(wren, 'Chalk');
    const user = openApp();
    await openPack(user);
    // The Sack itself has nowhere else to go: no Move to….
    await user.click(screen.getByRole('button', { name: /^Sack/ }));
    expect(screen.queryByRole('button', { name: 'Put in…' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Sack/ }));
    await user.click(screen.getByRole('button', { name: /^Chalk/ }));
    await moveTo(user, 'Chalk', /^Sack/, 'Put in Sack');
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Chalk')).toMatchObject({ container_line_id: 'line-sack' }));
  });

  it("a container's explanation is one tap away, behind an ⓘ", async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Sack', { id: 'line-sack', item_data: { container: { capacityCoin: 200 } } });
    line(wren, 'Chalk', { container_line_id: 'line-sack' });
    const user = openApp();
    await openPack(user);
    const info = screen.getByRole('button', { name: 'About In the Sack' });
    expect(screen.queryByText(/holds things|adds capacity/)).toBeNull();
    await user.click(info);
    expect(screen.getByText(/holds things|adds capacity/)).toBeTruthy();
  });

  it('Empty… a container: everything inside goes to the Party stash in one logged change; Drop all asks once', async () => {
    const { wren, campaign, line } = packWorld('coin');
    line(wren, 'Sack', { id: 'line-sack', item_data: { container: { capacityCoin: 200 } } });
    line(wren, 'Chalk', { container_line_id: 'line-sack' });
    line(wren, 'Twine', { container_line_id: 'line-sack' });
    line(wren, 'Satchel', { id: 'line-satchel', item_data: { container: { capacityCoin: 100 } } });
    line(wren, 'Pebble', { container_line_id: 'line-satchel' });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Sack/ }));
    await user.click(screen.getByRole('button', { name: 'Empty…' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Empty the Sack' }));
    expect(dialog.getByText('2 items inside.')).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Party stash' }));
    await waitFor(() =>
      expect(world.tables.inventory_lines.filter((l) => ['Chalk', 'Twine'].includes(String(l.name)))).toMatchObject([
        { location_id: `location-stash-${campaign}`, container_line_id: null },
        { location_id: `location-stash-${campaign}`, container_line_id: null },
      ]),
    );
    expect(world.tables.events.filter((e) => e.type === 'inventory.empty')).toHaveLength(2);

    await user.click(await screen.findByRole('button', { name: /^Satchel/ }));
    await user.click(screen.getByRole('button', { name: 'Empty…' }));
    const second = within(screen.getByRole('dialog', { name: 'Empty the Satchel' }));
    await user.click(second.getByRole('button', { name: 'Drop all…' }));
    expect(second.getByText('Drop everything in the Satchel?')).toBeTruthy();
    await user.click(second.getByRole('button', { name: 'Drop all' }));
    await waitFor(() => expect(world.tables.inventory_lines.some((l) => l.name === 'Pebble')).toBe(false));
  });

  it('animals and vehicles sit in "Other", outside the load', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Mule', { category: 'animal', weight_coin: 900, item_data: { animal: { capacityCoin: 3000 } } });
    const user = openApp();
    await openPack(user);
    expect(screen.getByRole('heading', { name: /Other/ })).toBeTruthy();
    expect(screen.getByText('0 of 1,000 coins')).toBeTruthy();
  });

  it('giving part of a stack to someone in the party: the toast has Undo, which merges the part back (ruled 2026-10-26)', async () => {
    const { wren, ash, line } = packWorld('coin');
    line(wren, 'Torch', { stack: 20, qty: 6 });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Torch/ }));
    await user.click(screen.getByRole('button', { name: 'Give to…' }));
    const give = within(await screen.findByRole('dialog', { name: 'Give Torch' }));
    await user.click(give.getByRole('button', { name: 'Less how many' }));
    await user.click(give.getByRole('radio', { name: /^Ash/ }));
    await user.click(give.getAllByRole('button', { name: /^Give 5 to Ash/ })[0]!);
    await waitFor(() => expect(world.tables.inventory_lines.filter((l) => l.name === 'Torch').map((l) => [l.actor_id, l.qty])).toEqual([[wren, 1], [ash, 5]]));
    const toast = (await screen.findByText(/^Gave Torch ×5 to Ash/)).closest('[role="status"]') as HTMLElement;
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.inventory_lines.filter((l) => l.name === 'Torch').map((l) => [l.actor_id, l.qty])).toEqual([[wren, 6]]));
  });

  it('5b: when the receiver used some of the given part, Undo brings back what is left and the toast says how much was used', async () => {
    const { wren, ash, line } = packWorld('coin');
    line(wren, 'Torch', { stack: 20, qty: 6 });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Torch/ }));
    await user.click(screen.getByRole('button', { name: 'Give to…' }));
    const give = within(await screen.findByRole('dialog', { name: 'Give Torch' }));
    await user.click(give.getByRole('button', { name: 'Less how many' }));
    await user.click(give.getByRole('radio', { name: /^Ash/ }));
    await user.click(give.getAllByRole('button', { name: /^Give 5 to Ash/ })[0]!);
    await waitFor(() => expect(world.tables.inventory_lines.filter((l) => l.name === 'Torch').map((l) => [l.actor_id, l.qty])).toEqual([[wren, 1], [ash, 5]]));
    // Ash's player burns two of the five.
    world.tables.inventory_lines.find((l) => l.name === 'Torch' && l.actor_id === ash)!.qty = 3;
    const toast = (await screen.findByText(/^Gave Torch ×5 to Ash/)).closest('[role="status"]') as HTMLElement;
    await user.click(within(toast).getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText(/^3 of 5 Torch came back, Ash.* used 2$/)).toBeTruthy();
    await waitFor(() => expect(world.tables.inventory_lines.filter((l) => l.name === 'Torch').map((l) => [l.actor_id, l.qty])).toEqual([[wren, 4]]));
  });

  it('the how-many prompt starts at the whole stack as it is now (it used to keep an old number: "6 of 2")', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Torch', { stack: 20, qty: 6 });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Torch/ }));
    await user.click(screen.getByRole('button', { name: 'One fewer Torch' }));
    await user.click(screen.getByRole('button', { name: 'One fewer Torch' }));
    if (!screen.queryByRole('button', { name: 'Give to…' })) await user.click(await screen.findByRole('button', { name: /^Torch/ }));
    await user.click(await screen.findByRole('button', { name: 'Give to…' }));
    expect(within(await screen.findByRole('dialog', { name: 'Give Torch' })).getByText('all Torch ×4')).toBeTruthy();
  });

  it('a change made from an old copy is refused in plain words, the latest shows, and trying again works (M5 step 4)', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Torch', { stack: 20, qty: 6 });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Torch/ }));
    // Another device changes the stack after this one showed it.
    Object.assign(world.tables.inventory_lines.find((l) => l.name === 'Torch')!, { qty: 9, version: 2 });
    await user.click(screen.getByRole('button', { name: 'One fewer Torch' }));
    expect((await screen.findByRole('alert')).textContent).toBe("That's changed since. Here's the latest.");
    expect(world.tables.inventory_lines.find((l) => l.name === 'Torch')).toMatchObject({ qty: 9, version: 2 });
    // The pack now shows 9, so the next tap counts down from there.
    if (!screen.queryByRole('button', { name: 'One fewer Torch' })) await user.click(await screen.findByRole('button', { name: /^Torch/ }));
    await user.click(await screen.findByRole('button', { name: 'One fewer Torch' }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Torch')).toMatchObject({ qty: 8, version: 3 }));
  });

  it('Give opens one sheet: the Party stash first and chosen, then the other characters; the toast says who got it', async () => {
    const { wren, ash, campaign, line } = packWorld('coin');
    line(wren, 'Lucky pebble');
    line(wren, 'Reed flute');
    line(wren, 'Bone whistle');
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Lucky pebble/ }));
    await giveTo(user, 'Lucky pebble', 'Party stash');
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Lucky pebble')).toMatchObject({ location_id: `location-stash-${campaign}` }));
    expect(await screen.findByText('Gave Lucky pebble to Party stash')).toBeTruthy();

    await user.click(await screen.findByRole('button', { name: /^Reed flute/ }));
    await giveTo(user, 'Reed flute', 'Ash');
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Reed flute')).toMatchObject({ actor_id: ash }));
    expect(world.tables.events.filter((e) => e.type === 'inventory.move')).toHaveLength(2);
    // B19: the next time, the list starts on the last place used for that kind of item.
    await user.click(await screen.findByRole('button', { name: /^Bone whistle/ }));
    await user.click(screen.getByRole('button', { name: 'Give to…' }));
    const next = within(await screen.findByRole('dialog', { name: 'Give Bone whistle' }));
    expect(next.getByRole('radio', { name: /^Ash/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('"Someone outside the party…" gives an item away: it leaves, the toast and the log say to whom', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Silver tooth');
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Silver tooth/ }));
    await user.click(screen.getByRole('button', { name: 'Give to…' }));
    const give = within(await screen.findByRole('dialog', { name: 'Give Silver tooth' }));
    await user.click(give.getByRole('radio', { name: /Someone outside the party/ }));
    await user.type(give.getByLabelText('Who or what gets it'), 'Old Marsh');
    await user.click(give.getAllByRole('button', { name: 'Give it away' })[0]!);
    expect(await screen.findByText('Gave Silver tooth away to Old Marsh')).toBeTruthy();
    await waitFor(() => expect(world.tables.inventory_lines).toEqual([]));
    expect(world.tables.events.find((e) => e.type === 'inventory.giveAway' && e.after === null)?.before).toMatchObject({ given_to: 'Old Marsh' });
  });

  it("items in the Party stash have no Wear, Hold or Move to (nothing there is worn or held)", async () => {
    const { line } = packWorld('coin');
    line(null, 'Silver ewer');
    const user = openApp();
    await openPack(user);
    await openStash(user);
    await user.click(screen.getByRole('button', { name: /^Silver ewer/ }));
    expect(screen.queryByRole('button', { name: 'Put in…' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Wear|Hold)$/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Give to…' })).toBeTruthy();
  });

  it('slot mode: the hand-worked check reads 8 slots, Laden', async () => {
    const { wren, line } = packWorld('slot');
    line(wren, 'Iron pot', { slots: 2 });
    line(wren, 'Bedroll', { slots: 1 });
    line(wren, 'Rope', { slots: 1 });
    line(wren, 'Cloak', { slots: 1 });
    line(wren, 'Rations', { slots: 1, stack: 4, qty: 8 });
    line(wren, 'Candles', { slots: 1, stack: 10, qty: 10 });
    const user = openApp();
    await openPack(user);
    expect(screen.getByText('8 of 14 slots')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Laden' }));
    const burden = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(within(burden).getByRole('region', { name: 'Burden by slots' })).getByRole('row', { name: /^Straining/ }).textContent).toBe('Straining14 slots');
    // Each level is said once, in the table: its effect is not listed under it (fb-3, approved with this fix 2026-11-21).
    expect(burden.querySelectorAll('.book-line')).toHaveLength(0);
    expect(burden.textContent).not.toContain('Crawling');
    expect(screen.getByText('From your setting: Fen Rules')).toBeTruthy();
  });

  // Purpose (tfb-4, row C7): on the Pack tab a tap on the burden opens its levels in a pop-up, every level listed and
  // the character's own in bold, and nothing opens under the bar, so the page doesn't move; closing returns focus.
  it('slot mode: a tap on the burden opens its levels in a pop-up, not in place', async () => {
    const { wren, line } = packWorld('slot');
    line(wren, 'Iron pot', { slots: 2 });
    line(wren, 'Bedroll', { slots: 6 });
    const user = openApp();
    await openPack(user);
    const tier = screen.getByRole('button', { name: 'Laden' });
    await user.click(tier);
    const burden = screen.getByRole('dialog', { name: 'Burden' });
    expect(within(burden).getByText('Laden: 8 of 14 slots.')).toBeTruthy();
    const rows = within(within(burden).getByRole('region', { name: 'Burden by slots' })).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(['Light6 slots', 'Laden, yours10 slots', 'Straining14 slots']);
    // Each level is said once, in the table: no effect line under it, and the limit, already in the first line and the
    // table, is not said again (fb-3; approved from the built screen with this fix, 2026-11-21).
    expect(burden.querySelectorAll('.book-line')).toHaveLength(0);
    expect(within(burden).getByText('From your setting: Fen Rules')).toBeTruthy();
    expect(document.querySelector('.pack__explain')).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Burden' })).toBeNull();
    expect(document.activeElement).toBe(tier);
  });

  it('armour mode: treasure is counted; ordinary gear sits in a Gear group that starts open, then stays as left on this device', async () => {
    const { wren, line } = packWorld('armour');
    line(wren, 'Pearls', { category: 'gem', qty: 3 });
    line(wren, 'Rope');
    let user = openApp();
    await openPack(user);
    expect(screen.getByRole('button', { name: 'Move 70 ft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pearls.*Treasure.*3 coins’ weight, counted/ })).toBeTruthy();
    // Open the first time on a device (ruled 2026-10-26).
    expect(screen.getByRole('button', { name: /^Rope/ })).toBeTruthy();
    expect(fold('Gear').open).toBe(true);
    expect(foldNote('Gear')).toBe('1 item: Rope');
    expect(fold('Gear').querySelector('.creation-fold__detail')!.textContent).toBe('Not counted for speed');
    await toggleFold(user, 'Gear');
    expect(screen.queryByRole('button', { name: /^Rope/ })).toBeNull();
    // This device remembers it closed.
    cleanup();
    user = openApp();
    await openPack(user);
    expect(screen.queryByRole('button', { name: /^Rope/ })).toBeNull();
  });

  it('with something At hand, Gear starts collapsed; the device still remembers once it is opened (N19)', async () => {
    const { wren, line } = packWorld('armour');
    line(wren, 'Rope');
    line(wren, 'Reed spear', { equipped: true, category: 'weapon' });
    let user = openApp();
    await openPack(user);
    expect(screen.getByRole('button', { name: /^Reed spear/ })).toBeTruthy();
    expect(fold('Gear').open).toBe(false);
    expect(screen.queryByRole('button', { name: /^Rope/ })).toBeNull();
    await toggleFold(user, 'Gear');
    expect(await screen.findByRole('button', { name: /^Rope/ })).toBeTruthy();
    cleanup();
    user = openApp();
    await openPack(user);
    expect(screen.getByRole('button', { name: /^Rope/ })).toBeTruthy();
  });

  // Purpose: the stash is no longer a fold at the Pack's foot but a row that opens its own screen (pk-4, PK1): the row
  // says what is in it; the screen's bar names the stash; its lists have only "Loose" and its containers (N18, PK4).
  it('the Party stash is a row on the Pack that opens its own screen, with only Loose and its containers (pk-4, N18); anyone can take from it', async () => {
    const { wren, line } = packWorld('armour');
    line(null, 'Reed chest', { item_data: { container: { capacityCoin: 500 } } });
    line(null, 'Silver ewer', { weight_coin: 30 });
    line(null, 'Coil of twine', { container_line_id: 'line-reed-chest' });
    const user = openApp();
    await openPack(user);
    expect(screen.queryByText('Party stash', { selector: '.creation-fold__label' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Party stash/ }).textContent).toContain('3 things');
    const stash = await openStash(user);
    expect(document.querySelector('.top-row__title')!.textContent).toBe('Party stash');
    // No Worn, Carried, Gear or Other in the stash; its loose things under "Loose", its container its own group.
    expect(stash.queryByRole('button', { name: /^Gear/ })).toBeNull();
    expect(stash.queryByRole('heading', { name: /Carried|Worn|Other/ })).toBeNull();
    expect(stash.getByRole('heading', { name: 'Loose' })).toBeTruthy();
    expect(stash.getByRole('heading', { name: 'In the Reed chest' })).toBeTruthy();
    // The first fact counts what is in it; the foot counts it and offers Put in (no accent: nothing is the one next step).
    expect(stash.getByText('In it.').parentElement!.textContent).toBe('In it. 3 things.');
    expect(stash.getByText('3 items')).toBeTruthy();
    expect(stash.getByRole('button', { name: 'Put in' }).className).not.toContain('button-primary');
    expect(stash.queryAllByRole('button').filter((b) => b.className.includes('button-primary'))).toEqual([]);
    await user.click(screen.getByRole('button', { name: /^Silver ewer/ }));
    await giveTo(user, 'Silver ewer', 'Wren');
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Silver ewer')).toMatchObject({ actor_id: wren, location_id: null }));
  });

  // Purpose: the stash's screen reads who put each thing in and when, from the log (pk-4, K14): the row's line, the
  // last thing in, and a recent line; the player's own recent line keeps Undo, and Undo puts the thing back in the pack.
  it('the stash says who put a thing in and when, on its row, as the last in and in Recently; your own line keeps Undo (pk-4, PK4, PK9b)', async () => {
    const { wren, campaign, line } = packWorld('coin');
    line(wren, 'Silver ewer');
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Silver ewer/ }));
    await giveTo(user, 'Silver ewer', 'Party stash');
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Silver ewer')).toMatchObject({ location_id: `location-stash-${campaign}` }));
    const stash = await openStash(user);
    expect((await stash.findByText('Last in.')).parentElement!.textContent).toBe('Last in. Silver ewer. Wren, today.');
    expect(stash.getByText('Wren put it in, today.')).toBeTruthy();
    // Beside the lists: the taker's room (Wren's own load), and Recently with the player's own line and its Undo.
    expect(stash.getByRole('heading', { name: 'Wren’s room' })).toBeTruthy();
    const recent = within(stash.getByRole('region', { name: 'Recently' }));
    expect(recent.getByText('Wren put in Silver ewer.')).toBeTruthy();
    // One character only: no "You are taking for".
    expect(stash.queryByRole('group', { name: 'You are taking for' })).toBeNull();
    await user.click(recent.getByRole('button', { name: 'Undo: Wren put in Silver ewer.' }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Silver ewer')).toMatchObject({ actor_id: wren, location_id: null }));
    expect(await screen.findByText('Nothing in the Party stash yet.')).toBeTruthy();
  });

  // Purpose: another player's recent line has no Undo, and a player with two characters chooses whom they take for;
  // the room follows the choice (PK9b).
  it('another player’s recent line has no Undo; with two characters "You are taking for" chooses whose room shows (PK9b)', async () => {
    const { sam, ash, jo, campaign, line } = packWorld('coin');
    const sedge = world.addCharacter(campaign, 'Old Sedge', { ownerId: sam });
    world.addMember(campaign, sam, 'player', sedge);
    line(ash, 'Reed basket');
    // Ash's player puts the basket in the stash.
    world.signInAs(jo);
    const jos = { id: jo, roles: { [campaign]: 'player' as const } };
    const carrierOf = (actorId: string | null) => ({ campaignId: campaign, actorId, locationId: actorId ? null : `location-stash-${campaign}`, ownerUserId: actorId ? jo : null, archived: false });
    expect((await moveItem.run(world.db, jos, { line: { id: 'line-reed-basket', carrier: carrierOf(ash) }, to: carrierOf(null), qty: 1, of: 1 })).ok).toBe(true);
    world.signInAs(sam);
    const user = openApp();
    // Two characters in the campaign: open Wren's.
    const rows = await screen.findAllByRole('button', { name: /The Ash Barrows/ });
    await user.click(rows.find((b) => b.textContent?.includes('Wren')) ?? rows[0]!);
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    expect(await screen.findByRole('heading', { name: 'Wren’s pack' })).toBeTruthy();
    const stash = await openStash(user);
    const recent = within(await stash.findByRole('region', { name: 'Recently' }));
    expect(recent.getByText('Ash put in Reed basket.')).toBeTruthy();
    expect(recent.queryByRole('button', { name: /^Undo/ })).toBeNull();
    const takers = within(stash.getByRole('group', { name: 'You are taking for' }));
    expect(takers.getByRole('button', { name: 'Wren' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(takers.getByRole('button', { name: 'Old Sedge' }));
    expect(stash.getByRole('heading', { name: 'Old Sedge’s room' })).toBeTruthy();
  });

  // Purpose: when the pack can't be read again while the stash's screen is open (a reload that fails), the screen goes
  // back to the pack, so the bar never reads "Party stash" over something that isn't the stash (automatic review of #66,
  // nit 2, picked by Francis 2026-11-26).
  it.fails('a failed read while the stash is open goes back to the pack: the bar no longer reads "Party stash" (K11)', async () => {
    const { line } = packWorld('coin');
    line(null, 'Silver ewer', { weight_coin: 30 });
    const user = openApp();
    await openPack(user);
    await openStash(user);
    expect(document.querySelector('.top-row__title')!.textContent).toBe('Party stash');
    const from = world.db.from.bind(world.db);
    // The stash's place can't be read: the pack's read fails as a whole.
    const failed = () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
    const failing = () => {
      const query: Record<string, unknown> = { then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => failed().then(ok, bad), maybeSingle: failed, single: failed };
      for (const step of ['eq', 'neq', 'in', 'order']) query[step] = () => query;
      return query;
    };
    vi.spyOn(world.db, 'from').mockImplementation(((table: string) => {
      const query = from(table as never) as unknown as { select: (c: string) => unknown };
      if (table === 'locations') query.select = failing;
      return query;
    }) as typeof world.db.from);
    try {
      // Coming back to the app reads everything again.
      window.dispatchEvent(new Event('focus'));
      expect(await screen.findByText('Couldn’t open the pack. Check your connection and try again.')).toBeTruthy();
      await waitFor(() => expect(document.querySelector('.top-row__title')?.textContent).toBe('Wren’s pack'));
      expect(screen.queryByRole('region', { name: 'Party stash' })).toBeNull();
    } finally {
      vi.restoreAllMocks();
    }
  });

  // Purpose: a switch of character while the stash's screen is open lands on the other character's pack, its bar naming
  // that pack, never "Party stash" (automatic review of #66, nit 2, picked by Francis 2026-11-26).
  it('a switch of character while the stash is open lands on that character’s pack, not the stash (K11)', async () => {
    const { sam, campaign, line } = packWorld('coin');
    const sedge = world.addCharacter(campaign, 'Old Sedge', { ownerId: sam });
    world.addMember(campaign, sam, 'player', sedge);
    line(null, 'Silver ewer', { weight_coin: 30 });
    const user = openApp();
    const rows = await screen.findAllByRole('button', { name: /The Ash Barrows/ });
    await user.click(rows.find((b) => b.textContent?.includes('Wren')) ?? rows[0]!);
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    expect(await screen.findByRole('heading', { name: 'Wren’s pack' })).toBeTruthy();
    await openStash(user);
    expect(document.querySelector('.top-row__title')!.textContent).toBe('Party stash');
    await openYourCharacters(user);
    await user.click(await screen.findByRole('button', { name: 'Open Old Sedge' }));
    await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    expect(await screen.findByRole('heading', { name: 'Old Sedge’s pack' })).toBeTruthy();
    expect(document.querySelector('.top-row__title')!.textContent).toBe('Old Sedge’s pack');
    expect(screen.queryByRole('region', { name: 'Party stash' })).toBeNull();
  });

  // Purpose: a single thing in the stash is taken on the tap of its Take, loose into the taker's pack (pk-2, pk-3); the
  // toast says it in the log line's words with the taker's load, and its Undo puts the thing back in the stash (PK4b).
  it('Take on a single thing: at once, loose to the taker, the toast naming the load, and Undo (K12, PK4b)', async () => {
    const { wren, campaign, line } = packWorld('coin');
    line(wren, 'Coil of twine', { weight_coin: 100 });
    line(null, 'Silver ewer', { weight_coin: 30 });
    const user = openApp();
    await openPack(user);
    const stash = await openStash(user);
    // Every row ends in Take, a secondary button: nothing on the stash's screen is the accent.
    const take = stash.getByRole('button', { name: 'Take Silver ewer' });
    expect(take.className).not.toContain('button-primary');
    await user.click(take);
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Silver ewer')).toMatchObject({ actor_id: wren, location_id: null, container_line_id: null }));
    expect(await screen.findByText('Wren took Silver ewer. Load 130 of 1,000 coins’ weight.')).toBeTruthy();
    expect(world.tables.events.filter((e) => e.type === 'inventory.move' && e.target_id === 'line-silver-ewer')).toHaveLength(1);
    expect(await screen.findByText('Nothing in the Party stash yet.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Silver ewer')).toMatchObject({ actor_id: null, location_id: `location-stash-${campaign}` }));
    expect(await screen.findByRole('button', { name: 'Take Silver ewer' })).toBeTruthy();
  });

  // Purpose: a stack's Take asks how many on the sheet "Take" (what the stash has, a box, one accent naming the amount);
  // too many is refused in words under the row and nothing moves; a count it can take moves that many (pk-3, PK4b).
  it('Take on a stack asks how many: refuses more than the stash has, then takes the count typed (K12, PK4b)', async () => {
    const { wren, line } = packWorld('coin');
    line(null, 'Torches', { qty: 6, stack: 10, weight_coin: 10, item_data: { unitName: 'torch', pluralName: 'torches' } });
    const user = openApp();
    await openPack(user);
    const stash = await openStash(user);
    await user.click(stash.getByRole('button', { name: 'Take Torches' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Take' }));
    expect(sheet.getByText('The stash has 6.')).toBeTruthy();
    const box = sheet.getByLabelText('Torches');
    await user.type(box, '7');
    await user.click(sheet.getByRole('button', { name: 'Take' }));
    expect(sheet.getByRole('alert').textContent).toBe('The stash has 6.');
    expect(world.tables.inventory_lines.filter((l) => l.actor_id === wren)).toEqual([]);
    await user.clear(box);
    await user.type(box, '2');
    const go = sheet.getByRole('button', { name: 'Take 2 torches' });
    expect(go.className).toContain('button-primary');
    await user.click(go);
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.actor_id === wren)).toMatchObject({ qty: 2, location_id: null, container_line_id: null }));
    expect(world.tables.inventory_lines.find((l) => l.id === 'line-torches')).toMatchObject({ qty: 4 });
    expect(await screen.findByText('Wren took 2 torches. Load 20 of 1,000 coins’ weight.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Take' })).toBeNull();
  });

  // Purpose: a taker put over the limit is told in the toast, with the warning sign, and the take is not stopped (⚑ 18).
  it('Take past the limit warns in the toast and still takes (K12, PK4b)', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Small anvil', { weight_coin: 900 });
    line(null, 'Reed chest', { weight_coin: 200 });
    const user = openApp();
    await openPack(user);
    const stash = await openStash(user);
    await user.click(stash.getByRole('button', { name: 'Take Reed chest' }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Reed chest')).toMatchObject({ actor_id: wren }));
    const toast = await waitFor(() => document.querySelector('.toast')!);
    expect(toast.querySelector('.toast__text')!.firstChild!.textContent).toBe('Wren took Reed chest.');
    expect(toast.querySelector('.toast__warning')!.textContent).toBe('Over the limit: 1,100 of 1,000.');
    expect(toast.querySelector('.warning-sign')).toBeTruthy();
    expect(within(toast as HTMLElement).getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  // Purpose: offline, a tap on Take opens the blocked-action pop-up (BlockedSheet) saying why it waits, not a toast; the
  // button stays a button and nothing moves (⚑ 7, re-ruled "A" 25 Nov).
  it('offline, a tap on Take opens the blocked-action pop-up, not a toast; nothing moves (K12, ⚑ 7 A)', async () => {
    const { campaign, line } = packWorld('coin');
    line(null, 'Silver ewer', { weight_coin: 30 });
    const user = openApp();
    await openPack(user);
    const stash = await openStash(user);
    await stash.findByRole('button', { name: 'Take Silver ewer' });
    const offline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      window.dispatchEvent(new Event('offline'));
      await stash.findByText('As it was when you were last online.');
      const take = stash.getByRole('button', { name: 'Take Silver ewer' });
      await user.click(take);
      const why = within(await screen.findByRole('dialog', { name: 'You’re offline' }));
      expect(why.getByText('Taking from the stash needs the party’s latest, so it waits until you’re back.')).toBeTruthy();
      expect(document.querySelector('.toast')).toBeNull();
      expect(take.hasAttribute('disabled')).toBe(false);
      expect(world.tables.inventory_lines.find((l) => l.name === 'Silver ewer')).toMatchObject({ location_id: `location-stash-${campaign}` });
      expect(screen.queryByRole('dialog', { name: 'Take' })).toBeNull();
    } finally {
      offline.mockRestore();
    }
  });

  // Purpose: a Put in shows no Undo in Recently; a take does, a small stacked button with the turned-back arrow above
  // the word, and the take's toast has the same (review of #66, finding 1; ⚑ 4 and ⚑ 6, ruled 24 Nov).
  it('a Put in shows no Undo in Recently; a take does, with the turned-back arrow, as does its toast (K11, K12)', async () => {
    const { sam, wren, campaign, line } = packWorld('coin');
    line(null, 'Silver ewer', { weight_coin: 30 });
    const stashCarrier = { campaignId: campaign, actorId: null, locationId: `location-stash-${campaign}`, ownerUserId: null, archived: false };
    const sams = { id: sam, roles: { [campaign]: 'player' as const } };
    const item = { libraryEntryId: null, name: 'Reed basket', category: 'gear', weightCoin: 5, slots: null, stack: 1 };
    expect((await addItem.run(world.db, sams, { carrier: stashCarrier, item, qty: 1, howGot: 'found' })).ok).toBe(true);
    const user = openApp();
    await openPack(user);
    const stash = await openStash(user);
    await user.click(stash.getByRole('button', { name: 'Take Silver ewer' }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Silver ewer')).toMatchObject({ actor_id: wren }));
    const toast = await waitFor(() => document.querySelector<HTMLElement>('.toast')!);
    const toastUndo = within(toast).getByRole('button', { name: 'Undo' });
    expect(toastUndo.className).toContain('stacked-button');
    expect(toastUndo.querySelector('svg')).toBeTruthy();
    const recent = within(await stash.findByRole('region', { name: 'Recently' }));
    await recent.findByText('Wren took Silver ewer.');
    expect(recent.getByText('Wren put in Reed basket.')).toBeTruthy();
    expect(recent.queryByRole('button', { name: 'Undo: Wren put in Reed basket.' })).toBeNull();
    const undo = recent.getByRole('button', { name: 'Undo: Wren took Silver ewer.' });
    expect(undo.className).toContain('stacked-button');
    expect(undo.className).toContain('button-secondary');
    expect(undo.textContent).toBe('Undo');
    expect(undo.querySelector('svg')).toBeTruthy();
    await user.click(undo);
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Silver ewer')).toMatchObject({ actor_id: null, location_id: `location-stash-${campaign}` }));
  });

  // Purpose: offline (the network dropped while the sheet was open), the Take sheet's accent stays a button and a tap
  // opens the same blocked-action pop-up as a row's Take, not a toast; the sheet stays open under it and nothing is
  // written (review of #66, nit 3; Home Two's audit, finding 1, picked by Francis 2026-11-26).
  it('offline, the Take sheet’s accent opens the blocked-action pop-up, not a toast; nothing moves (K12, ⚑ 7 A)', async () => {
    const { wren, line } = packWorld('coin');
    line(null, 'Torches', { qty: 6, stack: 10, weight_coin: 10, item_data: { unitName: 'torch', pluralName: 'torches' } });
    const user = openApp();
    await openPack(user);
    const stash = await openStash(user);
    await user.click(stash.getByRole('button', { name: 'Take Torches' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Take' }));
    await user.type(sheet.getByLabelText('Torches'), '2');
    const offline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      window.dispatchEvent(new Event('offline'));
      await user.click(sheet.getByRole('button', { name: 'Take 2 torches' }));
      const why = within(await screen.findByRole('dialog', { name: 'You’re offline' }));
      expect(why.getByText('Taking from the stash needs the party’s latest, so it waits until you’re back.')).toBeTruthy();
      expect(document.querySelector('.toast')).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Take' })).toBeTruthy();
      expect(world.tables.inventory_lines.filter((l) => l.actor_id === wren)).toEqual([]);
      expect(world.tables.inventory_lines.find((l) => l.id === 'line-torches')).toMatchObject({ qty: 6 });
    } finally {
      offline.mockRestore();
    }
  });

  // Purpose: the Take sheet names the thing as everywhere else, its first letter a capital (`shownName`), whatever
  // case the line was saved in (review of #66, nit 5).
  it('the Take sheet names the thing as the rows do, a capital first (K12)', async () => {
    const { line } = packWorld('coin');
    line(null, 'reed arrows', { qty: 3, stack: 20 });
    const user = openApp();
    await openPack(user);
    const stash = await openStash(user);
    await user.click(stash.getByRole('button', { name: 'Take reed arrows' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Take' }));
    expect(sheet.getByLabelText('Reed arrows')).toBeTruthy();
    expect(sheet.queryByText('reed arrows')).toBeNull();
  });

  // Purpose: an empty stash says so in one sentence and keeps Put in; offline, the stash says it is shown as last read,
  // once, and the Pack's row says "as last seen" (PK7b).
  it('an empty stash says so and keeps Put in; offline it says it is as it was when last online (PK7b)', async () => {
    packWorld('coin');
    const user = openApp();
    await openPack(user);
    const offline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      window.dispatchEvent(new Event('offline'));
      expect(await screen.findByText('0 things, as last seen')).toBeTruthy();
      const stash = await openStash(user);
      expect(stash.getByText('Nothing in the Party stash yet.')).toBeTruthy();
      expect(stash.getByRole('button', { name: 'Put in' })).toBeTruthy();
      expect(stash.getByText('As it was when you were last online.')).toBeTruthy();
      expect(stash.queryByText('In it.')).toBeNull();
    } finally {
      offline.mockRestore();
    }
  });

  it('the Players count (the one allowed counter): plain words for the GM only, counting items and characters, none at zero', async () => {
    const gm = world.addPerson('priya@lantern.example', 'Priya');
    const sam = world.addPerson('sam@lantern.example', 'Sam');
    const campaign = world.addCampaign('The Ash Barrows', gm);
    const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    world.addMember(campaign, sam, 'player', wren);
    world.signInAs(gm);
    let user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    await screen.findByRole('heading', { name: 'Players and characters' });
    // Nothing waits: "Players", never "Players · 0".
    let tabs = within(screen.getByRole('navigation', { name: 'Campaign sections' }));
    // The fold is the divider handle beside the list (lr-4), not a row in it.
    expect(tabs.getAllByRole('button').map((b) => b.textContent)).toEqual(['Scene', 'Players', 'Rules']);
    expect(screen.queryByText(/· 0/)).toBeNull();

    // A one-off item and a new character wait: "Players · 2", plain text in the tab, no badge.
    cleanup();
    world.addCharacter(campaign, 'Hollis', { ownerId: sam, approval: 'pending' });
    world.tables.inventory_lines.push({
      ...{ id: 'line-idol', campaign_id: campaign, actor_id: wren, location_id: null, library_entry_id: null, name: 'Mossy idol', category: 'gear' },
      ...{ weight_coin: null, slots: null, stack: 1, qty: 1, container_line_id: null, equipped: false, how_got: 'found', cost: '', notes: '', item_data: {} },
      ...{ source_pack_id: null, source_entry_id: null, charges_left: null, charges_hidden: false, charges_used: 0, spent_shown: false, last_roll: null },
      ...{ pinned: false, at_hand_hidden: false, approval: 'pending', per_units: 1, created_at: '2026-10-23T09:00:00Z' },
    });
    user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const players = await screen.findByRole('button', { name: 'Players, 2 waiting: 2 to approve' });
    expect(players.textContent).toBe('Players, 2 waiting');
    expect(players.querySelector('.badge, [class*="badge"]')).toBeNull();
    tabs = within(screen.getByRole('navigation', { name: 'Campaign sections' }));
    expect(tabs.getByRole('button', { name: 'Rules' }).textContent).toBe('Rules');
    // The GM's ⋯ holds only what isn't a tab (ruled 2026-10-26): Companies, then This device.
    await user.click(tabs.getByRole('button', { name: 'Rules' }));
    await user.click(screen.getByRole('button', { name: 'Account and device options' }));
    expect(screen.queryByRole('button', { name: /Players' characters|Rules for this campaign|Setting rules/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Companies' }));
    expect(tabs.getByRole('button', { name: /^Players/ }).getAttribute('aria-current')).toBe('page');

    // The player, with the same things waiting, sees no count on any tab.
    cleanup();
    world.signInAs(sam);
    user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    const main = within(await screen.findByRole('navigation', { name: 'Main' }));
    expect(main.getAllByRole('button').map((b) => b.textContent)).toEqual(['Player', 'Scene', 'Pack']);
  });

  it("a player's one-off waits for the GM; the GM approves it from Waiting for you, also adding it to the homebrew", async () => {
    const { gm } = packWorld('coin');
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.click(await screen.findByRole('button', { name: 'Not listed? Make a one-off item (the GM approves it)' }));
    await user.type(screen.getByLabelText('Name'), 'Mossy idol');
    await user.type(screen.getByLabelText('Weight in coins (optional)'), '15');
    await user.click(screen.getByRole('button', { name: 'No cost' }));
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(world.tables.inventory_lines).toMatchObject([{ name: 'Mossy idol', approval: 'pending' }]));
    // It isn't in the pack and counts for nothing until approved; the player is told, and sees it waiting.
    expect(await screen.findByText('Sent to the GM for approval.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Carried' })).toBeNull();
    expect(screen.getByText('0 of 1,000 coins')).toBeTruthy();
    expect(screen.getByRole('button', { name: /1 item waiting for the GM/ })).toBeTruthy();

    cleanup();
    world.signInAs(gm);
    const gmUser = openApp();
    await gmUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(gmUser);
    // Players carries the count; what waits shows first inside it.
    expect(await screen.findByRole('button', { name: 'Players, 1 waiting: 1 to approve' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Waiting for you' })).toBeTruthy();
    const row = within(await screen.findByRole('group', { name: 'Mossy idol for Wren' }));
    await gmUser.click(row.getByRole('checkbox', { name: 'Also add to the campaign homebrew' }));
    await gmUser.click(row.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ approval: 'approved' }));
    expect(world.tables.library_entries.some((e) => e.kind === 'item' && e.name === 'Mossy idol')).toBe(true);
    expect(world.tables.events.some((e) => e.type === 'inventory.approve')).toBe(true);
  });

  it('the GM edits a waiting one-off before approving it; the player can cancel one of their own', async () => {
    const { gm, wren, line } = packWorld('coin');
    line(wren, 'Mossy idol', { weight_coin: 15, approval: 'pending' });
    line(wren, 'Bent nail', { approval: 'pending' });
    const user = openApp();
    await openPack(user);
    // A card with the warning sign that says how many wait and opens their list as a sheet (plan m5b-players-screens-standard C).
    expect(screen.getByRole('button', { name: /2 items waiting for the GM/ }).getAttribute('aria-haspopup')).toBe('dialog');
    expect(screen.queryByRole('button', { name: /^Bent nail/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /2 items waiting for the GM/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Waiting for the GM' })).getByRole('button', { name: /^Bent nail/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel it' }));
    await waitFor(() => expect(world.tables.inventory_lines.map((l) => l.name)).toEqual(['Mossy idol']));

    cleanup();
    world.signInAs(gm);
    const gmUser = openApp();
    await gmUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(gmUser);
    const row = within(await screen.findByRole('group', { name: 'Mossy idol for Wren' }));
    await gmUser.click(row.getByRole('button', { name: 'Edit first' }));
    const form = within(screen.getByRole('group', { name: 'Edit Mossy idol' }));
    await gmUser.clear(form.getByLabelText('Name'));
    await gmUser.type(form.getByLabelText('Name'), 'Mossy idol of the fen');
    await gmUser.clear(form.getByLabelText('Weight in coins'));
    await gmUser.type(form.getByLabelText('Weight in coins'), '40');
    await gmUser.click(row.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ name: 'Mossy idol of the fen', weight_coin: 40, approval: 'approved' }));
  });

  it('with "One-off items need approval" off, a player\'s one-off counts at once', async () => {
    const { campaign } = packWorld('coin');
    Object.assign(world.tables.campaigns.find((c) => c.id === campaign)!.settings as object, { oneOffApproval: false });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.click(await screen.findByRole('button', { name: 'Not listed? Make a one-off item (the GM approves it)' }));
    await user.type(screen.getByLabelText('Name'), 'Mossy idol');
    await user.type(screen.getByLabelText('Weight in coins (optional)'), '15');
    await user.click(screen.getByRole('button', { name: 'No cost' }));
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(world.tables.inventory_lines).toMatchObject([{ name: 'Mossy idol', approval: 'approved' }]));
    expect(await screen.findByText('15 of 1,000 coins')).toBeTruthy();
  });

  it('players see only items for sale, grouped by category; the GM sees everything and gives, with a note', async () => {
    const { gm } = packWorld('coin');
    world.tables.library_entries.push(
      { id: 'entry-glow-wand', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'glow-wand', name: 'Glow wand', data: { id: 'glow-wand', name: 'Glow wand', category: 'magic-wand' } },
      { id: 'entry-reed-torches', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'reed-torches', name: 'Reed torches (6)', data: { id: 'reed-torches', name: 'Reed torches (6)', category: 'light', weightCoin: 30, bundle: 6, unitName: 'Reed torch', value: { cp: 6 } } },
    );
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    // Collapsed by category; the magic wand isn't for sale.
    expect(await screen.findByRole('button', { name: /Gear.*3/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Glow wand/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Coil of rope/ })).toBeNull();
    await user.type(screen.getByLabelText('Search items'), 'torch');
    await user.click(screen.getByRole('button', { name: /^Reed torches \(6\)/ }));
    expect(screen.getByText(/6 × Reed torch each/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Found' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(world.tables.inventory_lines).toMatchObject([{ name: 'Reed torch', qty: 6, per_units: 6, how_got: 'bought' }]));

    cleanup();
    world.signInAs(gm);
    const gmUser = openApp();
    await gmUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(gmUser);
    await gmUser.click(await screen.findByRole('button', { name: "Open Wren's pack" }));
    await gmUser.click(await screen.findByRole('button', { name: 'Add item' }));
    await gmUser.type(screen.getByLabelText('Search items'), 'glow');
    await gmUser.click(screen.getByRole('button', { name: /^Glow wand/ }));
    await gmUser.type(screen.getByLabelText('Note (optional)'), 'From the drowned shrine');
    await gmUser.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Glow wand')).toMatchObject({ how_got: 'given', notes: 'From the drowned shrine' }));
  });

  it("the GM opens a character's pack from the console and reveals a hidden field; the holder then sees it", async () => {
    const { gm, wren, line, campaign } = packWorld('coin');
    world.tables.library_entries.push({
      id: 'entry-hum-blade',
      pack_id: 'pack-fen',
      kind: 'item',
      pack_entry_id: 'hum-blade',
      name: 'Humming blade',
      data: { id: 'hum-blade', name: 'Humming blade', category: 'weapon', fields: { Curse: 'Hums at the full moon' }, gmOnly: ['fields'] },
    });
    line(wren, 'Humming blade', { library_entry_id: 'entry-hum-blade', source_pack_id: 'pack-fen', source_entry_id: 'hum-blade', item_data: { id: 'hum-blade', name: 'Humming blade', category: 'weapon' } });
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    await user.click(await screen.findByRole('button', { name: 'Inventory' }));
    await user.click(within(await screen.findByRole('group', { name: 'Whose pack' })).getByRole('button', { name: 'Wren' }));
    await user.click(await screen.findByRole('button', { name: /Humming blade/ }));
    const hidden = within(screen.getByRole('group', { name: 'Hidden from players' }));
    expect(hidden.getByText('Hums at the full moon')).toBeTruthy();
    await user.click(hidden.getByRole('button', { name: /^Reveal/ }));
    await waitFor(() => expect(world.tables.inventory_lines[0]!.item_data).toMatchObject({ fields: { Curse: 'Hums at the full moon' } }));
    expect(world.tables.events.filter((e) => e.type === 'inventory.reveal' && e.campaign_id === campaign)).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Hidden from players' })).toBeNull();
  });

  function wandRules(hidden: boolean) {
    const rules = world.tables.library_entries.find((e) => e.id === 'entry-fen-rules')!;
    rules.data = { ...(rules.data as object), magicItems: { charges: { wand: '2d10', hidden, rechargeable: false } } };
  }
  const wandLine = (extra: Record<string, unknown> = {}) => ({ category: 'wand', weight_coin: 1, ...extra });

  it('visible charges: the holder enters the roll once, then spends one at a time, down to spent', async () => {
    const { wren, line } = packWorld('coin');
    wandRules(false);
    line(wren, 'Glow wand', wandLine());
    const user = openApp();
    await openPack(user);
    expect(screen.getByRole('button', { name: /Glow wand.*Charges not set/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Glow wand/ }));
    await user.type(screen.getByLabelText('Charges (2d10): enter the roll'), '25');
    await user.click(within(screen.getByRole('group', { name: 'Charges' })).getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('2d10 gives 2 to 20.');
    await user.clear(screen.getByLabelText('Charges (2d10): enter the roll'));
    await user.type(screen.getByLabelText('Charges (2d10): enter the roll'), '2');
    await user.click(within(screen.getByRole('group', { name: 'Charges' })).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ charges_left: 2 }));
    expect(world.tables.rolls).toMatchObject([{ expression: '2d10', result: 2, purpose: 'charges', gm_only: false }]);

    // On the Pack, Use a charge is a row on the item's sheet (plan m5b-players-screens-standard C).
    await user.click(screen.getByRole('button', { name: 'Use a charge' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ charges_left: 1 }));
    await user.click(screen.getByRole('button', { name: 'Use a charge' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ charges_left: 0 }));
    expect(screen.getByRole('button', { name: /Glow wand.*0 left, spent/ })).toBeTruthy();
    // Never a disabled button: with none left, the row says why.
    await user.click(screen.getByRole('button', { name: 'Use a charge' }));
    expect(await screen.findByText('Glow wand has no charges left.')).toBeTruthy();
    expect(world.tables.inventory_lines[0]).toMatchObject({ charges_left: 0 });
  });

  it("handing out a charged item from the GM's own pack pops up the charges prompt for the GM", async () => {
    const { gm } = packWorld('coin');
    wandRules(false);
    world.tables.library_entries.push({ id: 'entry-reed-wand', pack_id: 'pack-fen', kind: 'item', pack_entry_id: 'reed-wand', name: 'Reed wand', data: { id: 'reed-wand', name: 'Reed wand', category: 'wand', weightCoin: 1 } });
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    // The GM's own pack (Whose pack), not the view, which has no charges prompt (pg32-4, C15e).
    await user.click(await screen.findByRole('button', { name: 'Inventory' }));
    await user.click(within(await screen.findByRole('group', { name: 'Whose pack' })).getByRole('button', { name: 'Wren' }));
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    await user.type(await screen.findByLabelText('Search items'), 'reed');
    await user.click(screen.getByRole('button', { name: /Reed wand/ }));
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    const prompt = within(await screen.findByRole('dialog', { name: 'Charges of Reed wand' }));
    await user.type(prompt.getByLabelText('Charges (2d10): enter the roll'), '9');
    await user.click(prompt.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(world.tables.inventory_lines.find((l) => l.name === 'Reed wand')).toMatchObject({ charges_left: 9 }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Charges of Reed wand' })).toBeNull());
  });

  it('the GM sets "Charged items can be recharged" for the campaign; the other settings stay', async () => {
    const { gm, campaign } = packWorld('coin');
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    // Rules for this campaign, in topic groups (B15): this one is under Items and treasure.
    await user.click(await screen.findByRole('button', { name: /^Items and treasure/ }));
    const recharge = within(await screen.findByRole('group', { name: 'Charged items can be recharged' }));
    expect(recharge.getByRole('button', { name: 'No' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(recharge.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(world.tables.campaigns.find((c) => c.id === campaign)!.settings).toEqual({ encumbrance: { mode: 'coin' }, rechargeDefault: true }));
    expect(recharge.getByRole('button', { name: 'Yes' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Rules for this campaign no longer has "Any class can take any kit" (cw-9); the other Characters rules stay', async () => {
    const { gm, campaign } = packWorld('coin');
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await user.click(await screen.findByRole('button', { name: 'Rules' }));
    await user.click(await screen.findByRole('button', { name: /^Characters/ }));
    await screen.findByRole('group', { name: 'New characters need approval' });
    expect(screen.queryByRole('group', { name: 'Any class can take any kit' })).toBeNull();
    expect(world.tables.campaigns.find((c) => c.id === campaign)!.settings).toEqual({ encumbrance: { mode: 'coin' } });
  });

  it('hidden charges are found out in play: the last charge looks normal; used again, nothing happens and it shows Spent; the GM reveals the count', async () => {
    const { gm, wren, line } = packWorld('coin');
    wandRules(true);
    line(wren, 'Murky wand', wandLine({ charges_hidden: true }));
    world.tables.inventory_line_secrets.push({ id: 'line-murky-wand', campaign_id: world.tables.campaigns[0]!.id, charges_total: 1, spent: false });
    const user = openApp();
    await openPack(user);
    expect(screen.getByRole('button', { name: /Murky wand.*Charges: \?/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Murky wand/ }));
    await user.click(screen.getByRole('button', { name: 'Use a charge' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ charges_used: 1 }));
    expect(world.tables.inventory_line_secrets[0]).toMatchObject({ spent: true });
    // The last charge looks normal.
    expect(screen.getByRole('button', { name: /Murky wand.*Charges: \?/ }).textContent).not.toContain('Spent');
    expect(screen.queryByText(/Nothing happens/)).toBeNull();
    // Used again with none left: nothing happens, and now the holder knows.
    await user.click(screen.getByRole('button', { name: 'Use a charge' }));
    expect(await screen.findByText('Nothing happens. Murky wand seems spent.')).toBeTruthy();
    expect(world.tables.inventory_lines[0]).toMatchObject({ charges_used: 2, spent_shown: true });
    expect(await screen.findByRole('button', { name: /Murky wand.*Spent/ })).toBeTruthy();

    cleanup();
    world.signInAs(gm);
    const gmUser = openApp();
    await gmUser.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(gmUser);
    await gmUser.click(await screen.findByRole('button', { name: 'Inventory' }));
    await gmUser.click(within(await screen.findByRole('group', { name: 'Whose pack' })).getByRole('button', { name: 'Wren' }));
    await gmUser.click(await screen.findByRole('button', { name: /Murky wand.*Spent \(hidden\)/ }));
    // The GM's Reveal: the holder sees the count from now on, like visible charges.
    await gmUser.click(screen.getByRole('button', { name: 'Reveal the count' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ charges_hidden: false, charges_left: 0, spent_shown: false }));
    expect(world.tables.events.filter((e) => e.type === 'inventory.revealCharges')).toHaveLength(1);
  });

  it('crossing into another tier shows its player the banner, and the device writes no tier (the database does; M5 step 4)', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Iron chest', { weight_coin: 290 });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.type(await screen.findByLabelText('Search items'), 'anvil');
    await user.click(screen.getByRole('button', { name: /Small anvil/ }));
    await user.click(screen.getByRole('button', { name: 'Add to Wren’s pack' }));
    expect(await screen.findByText('Wren is now Loaded')).toBeTruthy();
    expect(world.tables.carrier_loads).toEqual([]);
    expect(world.tables.events.filter((e) => e.type === 'load.tier')).toEqual([]);
  });

  it("the GM opens a character's pack from Players' Inventory and recharges a wand through the roll prompt", async () => {
    const { gm, wren, line } = packWorld('coin');
    wandRules(false);
    line(wren, 'Glow wand', wandLine({ charges_left: 1, item_data: { recharge: { amount: '2d6', every: 'day' } } }));
    world.signInAs(gm);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await gmPlayers(user);
    // The GM's own pack (Whose pack), not the view, whose sheet is the player's (pg32-4, C15e).
    await user.click(await screen.findByRole('button', { name: 'Inventory' }));
    await user.click(within(await screen.findByRole('group', { name: 'Whose pack' })).getByRole('button', { name: 'Wren' }));
    await user.click(await screen.findByRole('button', { name: /^Glow wand/ }));
    // The pack says it can't be recharged, so the GM's button is "Recharge (fiat)"; it opens a prompt.
    await user.click(screen.getByRole('button', { name: 'Recharge (fiat)' }));
    const prompt = within(screen.getByRole('dialog', { name: 'Recharge Glow wand' }));
    expect((prompt.getByLabelText('Dice or a number') as HTMLInputElement).value).toBe('2d6');
    await user.type(prompt.getByLabelText('Recharge (2d6): enter the roll'), '7');
    await user.click(prompt.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ charges_left: 8, last_roll: '2d6 → 7' }));
    expect(world.tables.rolls).toMatchObject([{ expression: '2d6', result: 7, purpose: 'charges' }]);
    expect(world.tables.events.filter((e) => e.type === 'inventory.recharge')).toHaveLength(1);
  });

  it('an item’s sheet ends with its page reference: "From your setting: <short name>, <page>"', async () => {
    const { wren, line } = packWorld('coin');
    world.tables.packs.find((p) => p.id === 'pack-fen')!.extra_meta = { shortName: 'Fen' };
    line(wren, 'Coil of rope', { source_pack_id: 'pack-fen', source_entry_id: 'rope', item_data: { id: 'rope', name: 'Coil of rope', source: 'Book p. 9' } });
    line(wren, 'Lucky pebble');
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Coil of rope/ }));
    expect(screen.getByText('From your setting: Fen, Book p. 9')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Lucky pebble/ }));
    expect(screen.queryByText(/From your setting/)).toBeNull();
  });

  it('a pinned item shows under At hand on the Player screen; giving it away takes the pin with it', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Short sword', { category: 'weapon', weight_coin: 30 });
    const user = openApp();
    await openPack(user);
    await user.click(screen.getByRole('button', { name: /^Short sword/ }));
    await user.click(screen.getByRole('button', { name: 'Pin to top' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ pinned: true }));
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Player' }));
    const atHand = within(await screen.findByRole('region', { name: 'At hand' }));
    await user.click(atHand.getByRole('button', { name: /^Short sword/ }));
    expect(screen.getByRole('button', { name: 'Unpin' })).toBeTruthy();

    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    await user.click(await screen.findByRole('button', { name: /^Short sword/ }));
    await user.click(screen.getByRole('button', { name: 'Give to…' }));
    const giving = within(await screen.findByRole('dialog', { name: 'Give Short sword' }));
    await user.click(giving.getByRole('radio', { name: /^Ash/ }));
    await user.click(giving.getAllByRole('button', { name: 'Give to Ash' })[0]!);
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ pinned: false }));
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Player' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'At hand' })).toBeNull());
  });

  it('At hand fills itself with what’s in hand and worn things with charges, not worn armour; each can be hidden and shown again', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Short sword', { category: 'weapon', equipped: true });
    line(wren, 'Quilted coat', { category: 'armour', equipped: true, item_data: { slot: 'armour' } });
    line(wren, 'Glow ring', { category: 'gear', equipped: true, item_data: { slot: 'armour', charges: { initial: 3 } } });
    line(wren, 'Coil of rope');
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    // The sword in hand is its own block above At hand (dec-13 C14); the ring with charges is At hand's.
    const inHand = within(await screen.findByRole('region', { name: 'Weapon in hand' }));
    const atHand = within(await screen.findByRole('region', { name: 'At hand' }));
    expect(inHand.getAllByRole('button', { name: /^(Short sword|Quilted coat|Glow ring|Coil of rope)/ }).map((b) => b.textContent?.split(' ')[0])).toEqual(['Short']);
    expect(atHand.getAllByRole('button', { name: /^(Short sword|Quilted coat|Glow ring|Coil of rope)/ }).map((b) => b.textContent?.split(' ')[0])).toEqual(['Glow']);

    await user.click(inHand.getByRole('button', { name: /^Short sword/ }));
    await user.click(screen.getByRole('button', { name: 'Hide from At hand' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ at_hand_hidden: true }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Weapon in hand' })).toBeNull());
    expect(world.tables.events.filter((e) => e.type === 'inventory.atHand').map((e) => e.level)).toEqual(['verbose']);

    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Pack' }));
    await user.click(await screen.findByRole('button', { name: /^Short sword/ }));
    await user.click(screen.getByRole('button', { name: 'Show in At hand' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ at_hand_hidden: false }));
  });

  // M5 gate C3: a weapon at hand shows its figures; with no class attack bonus in the pack, the damage die alone.
  it('a weapon at hand shows its damage die from the item data when the pack gives no attack bonus', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Short sword', { category: 'weapon', equipped: true, item_data: { slot: 'hand', weapon: { damage: '1d6' }, weaponTags: ['Melee'] } });
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    // The weapon in hand's block (dec-13 C14): its roll lines carry the figures; here the damage alone, no to-hit.
    const inHand = within(await screen.findByRole('region', { name: 'Weapon in hand' }));
    expect(inHand.getByRole('button', { name: /^Short sword/ })).toBeTruthy();
    expect(inHand.getByText('d6')).toBeTruthy();
    expect(inHand.getByText('damage')).toBeTruthy();
    expect(inHand.queryByText(/to hit/)).toBeNull();
  });

  it('every At hand entry can be removed by its player: a pinned one in hand shows once, then Unpin and Hide take it away', async () => {
    const { wren, line } = packWorld('coin');
    line(wren, 'Short sword', { category: 'weapon', equipped: true, pinned: true });
    line(wren, 'Moss potion', { pinned: true, category: 'potion' });
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    // Pinned and in hand, the sword shows once: its block above At hand (dec-13 C14), not a row in At hand too.
    const inHand = within(await screen.findByRole('region', { name: 'Weapon in hand' }));
    const atHand = within(await screen.findByRole('region', { name: 'At hand' }));
    expect(screen.getAllByRole('button', { name: /^Short sword/ })).toHaveLength(1);
    expect(inHand.getByRole('button', { name: /^Short sword/ })).toBeTruthy();

    await user.click(atHand.getByRole('button', { name: /^Moss potion/ }));
    await user.click(screen.getByRole('button', { name: 'Unpin' }));
    // With the potion gone nothing else is at hand: the section goes, the sword's block stays.
    await waitFor(() => expect(screen.queryByRole('region', { name: 'At hand' })).toBeNull());
    await user.click(inHand.getByRole('button', { name: /^Short sword/ }));
    await user.click(screen.getByRole('button', { name: 'Unpin' }));
    await waitFor(() => expect(world.tables.inventory_lines[0]).toMatchObject({ pinned: false }));
    // After an action the item closes; open it again.
    await user.click(await inHand.findByRole('button', { name: /^Short sword/, expanded: false }));
    await user.click(screen.getByRole('button', { name: 'Hide from At hand' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Weapon in hand' })).toBeNull());
  });

  // Arrange this screen is removed in R1 (Player screen redesign, ruled 2026-10-26): a saved arrangement from before
  // is ignored, so every section shows, and the menu doesn't offer it.
  it('Arrange this screen is gone: a saved arrangement is ignored, and the menu has no Arrange', async () => {
    const { wren } = packWorld('coin');
    world.tables.character_layouts.push({ actor_id: wren, sections: [{ section: 'hp', shown: false }, { section: 'at-hand', shown: true }] } as never);
    const user = openApp();
    await user.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    expect(await screen.findByRole('button', { name: /^Hit points/ })).toBeTruthy();
    expect(screen.queryByText(/to arrange/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Character options' }));
    expect(screen.queryByRole('button', { name: 'Arrange this screen' })).toBeNull();
  });
});
