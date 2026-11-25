// @vitest-environment jsdom
// "Give to a player…" on the GM's Players page (page 13 of the December mockups, approved 2026-11-13 with gp-5), on
// the stand-in database. Invented names.
//   Purpose:
//   1. A GM-made character has its own row after the players' rows, its small line "Yours", with "Give to a player…"
//      in the row's ⋯ (page 32, pg32-1; before, a button between Pack and Remove…).
//   2. The sheet lists the players as option rows, each with the character they play or "no character yet"; a tap
//      gives at once: the toast says "Ash given to Sam." and the row now names Sam; Undo makes it the GM's again.
//   3. For a character a player has, the sheet names them in the line with the tick ("Sam has Wren now.") and offers
//      "You, the GM" first, not Sam; a tap takes it back ("Wren is yours again.") and it shows as "Yours".
//   4. No players: the page's own words and "Invite a player" in the sheet.
//   5. Refused (the player left as the GM tapped): "Ash wasn't given: Robin is no longer in this campaign. Nothing changed."
//   6. The player's Your characters says where it came from: "From your GM, today".
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { runCommand } from '../core/commands.ts';
import { reassignCharacter, toCharacterRef } from '../modules/characters/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { registry } from './services.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
let gm: string;
let sam: string;
let campaign: string;
let ash: string;
let wren: string;

beforeEach(() => {
  world = createFakeDb();
  forgetFileLinks();
  forgetCampaignSetting();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  campaign = world.addCampaign('The Reed Marches', gm);
  ash = world.addCharacter(campaign, 'Ash');
});

afterEach(() => {
  cleanup();
});

const actor = (id: string) => world.tables.actors.find((a) => a.id === id)!;
const rowOf = (name: string) => screen.getByRole('button', { name: `More for ${name}` }).closest('li') as HTMLElement;

async function openPlayers() {
  world.signInAs(gm);
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Reed Marches/ }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  await screen.findByRole('button', { name: 'More for Ash' });
  return user;
}

/** Give to a player…, from the row's ⋯ (page 32, pg32-1). */
async function openGive(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: `More for ${name}` }));
  await user.click(screen.getByRole('button', { name: 'Give to a player…' }));
}

describe('Give to a player… (page 13)', () => {
  it('gives a GM-made character to a player at once, with Undo', async () => {
    wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    world.addMember(campaign, sam, 'player', wren);
    const user = await openPlayers();
    const row = rowOf('Ash');
    expect(within(row).getByText('Yours')).toBeTruthy();
    expect(within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label') === 'More for Ash' ? '⋯' : b.textContent)).toEqual(['View sheet', 'Pack', 'Scene', '⋯']);

    await openGive(user, 'Ash');
    const sheet = await screen.findByRole('dialog', { name: /: Give to a player$/ });
    expect(within(sheet).queryByRole('radio', { name: /You, the GM/ })).toBeNull();
    await user.click(within(sheet).getByRole('radio', { name: 'Give Ash to Sam, plays Wren' }));
    await screen.findByText('Ash given to Sam.');
    expect(actor(ash)).toMatchObject({ owner_type: 'user', owner_user_id: sam, approval: 'approved' });
    await waitFor(() => expect(within(rowOf('Ash')).getByText(/^Sam, joined/)).toBeTruthy());

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(actor(ash).owner_type).toBe('gm'));
  });

  it("names the player who has it, offers You, the GM first, and takes it back", async () => {
    wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    world.addMember(campaign, sam, 'player', wren);
    const robin = world.addPerson('robin@lantern.example', 'Robin');
    world.addMember(campaign, robin, 'player');
    const user = await openPlayers();
    await openGive(user, 'Wren');
    const sheet = await screen.findByRole('dialog', { name: /: Give to a player$/ });
    expect(within(sheet).getByText('Sam has Wren now.')).toBeTruthy();
    expect(within(sheet).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Give Wren back to you, the GM',
      'Give Wren to Robin, no character yet',
    ]);
    await user.click(within(sheet).getByRole('radio', { name: 'Give Wren back to you, the GM' }));
    await screen.findByText('Wren is yours again.');
    expect(actor(wren)).toMatchObject({ owner_type: 'gm', owner_user_id: null });
    await waitFor(() => expect(within(rowOf('Wren')).getByText('Yours')).toBeTruthy());
  });

  it('with no players, says so and offers Invite a player', async () => {
    const user = await openPlayers();
    await openGive(user, 'Ash');
    const sheet = await screen.findByRole('dialog', { name: /: Give to a player$/ });
    expect(within(sheet).getByText('No players yet. Invite someone to get started.')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Invite a player' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /: Give to a player$/ })).toBeNull());
  });

  it('refused when the player has left: said plainly, nothing changed', async () => {
    const robin = world.addPerson('robin@lantern.example', 'Robin');
    world.addMember(campaign, robin, 'player');
    const user = await openPlayers();
    await openGive(user, 'Ash');
    const sheet = await screen.findByRole('dialog', { name: /: Give to a player$/ });
    // Robin leaves as the GM taps.
    world.tables.members = world.tables.members.filter((m) => m.user_id !== robin);
    await user.click(within(sheet).getByRole('radio', { name: 'Give Ash to Robin, no character yet' }));
    await screen.findByText("Ash wasn't given: Robin is no longer in this campaign. Nothing changed.");
    expect(actor(ash).owner_type).toBe('gm');
  });

  it("the player's Your characters says it came from the GM", async () => {
    wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    world.addMember(campaign, sam, 'player', wren);
    const user = await openPlayers();
    await openGive(user, 'Ash');
    await user.click(within(await screen.findByRole('dialog', { name: /: Give to a player$/ })).getByRole('radio', { name: 'Give Ash to Sam, plays Wren' }));
    await screen.findByText('Ash given to Sam.');
    cleanup();

    world.signInAs(sam);
    const player = userEvent.setup();
    render(<Root db={world.db} />);
    await player.click(await screen.findByRole('button', { name: /The Reed Marches/ }));
    // The player's list of characters, from the character's options.
    await player.click(await screen.findByRole('button', { name: 'Character options' }));
    await player.click(screen.getByRole('button', { name: 'Your characters' }));
    await screen.findByText('From your GM, today');
  });

  // Purpose: the toast's Undo acts on this give's own hand-over line, never on a newer give of the same character
  // that another tab made within the toast's seconds: with that newer give standing, it says "That's changed since"
  // and the newer give stays.
  it('Undo reaches this give only, never a newer one from another tab', async () => {
    wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
    world.addMember(campaign, sam, 'player', wren);
    const robin = world.addPerson('robin@lantern.example', 'Robin');
    world.addMember(campaign, robin, 'player');
    const user = await openPlayers();
    await openGive(user, 'Ash');
    await user.click(within(await screen.findByRole('dialog', { name: /: Give to a player$/ })).getByRole('radio', { name: 'Give Ash to Sam, plays Wren' }));
    await screen.findByText('Ash given to Sam.');
    const lines = () => world.tables.events.filter((e) => e.type === 'character.reassign' && e.target_id === ash);
    const toSam = String(lines()[0]!.id);
    // Another tab gives Ash on to Robin.
    const other = await runCommand(registry, world.db, { id: gm, roles: { [campaign]: 'gm' } }, reassignCharacter, {
      character: toCharacterRef(actor(ash) as never),
      to: { userId: robin, role: 'player' },
    });
    expect(other.ok).toBe(true);
    const toRobin = String(lines().find((e) => e.id !== toSam)!.id);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText("That's changed since. Undo the later change first.");
    expect(world.tables.events.some((e) => e.reverts_event_id === toSam || e.reverts_event_id === toRobin)).toBe(false);
    expect(actor(ash).owner_user_id).toBe(robin);
  });

  // Purpose: a refusal for another cause (here the character was removed as the GM tapped) says the app's own
  // not-allowed words, and never that a player who is still in the campaign has left.
  it('refused for another cause: the general words, not "no longer in this campaign"', async () => {
    const robin = world.addPerson('robin@lantern.example', 'Robin');
    world.addMember(campaign, robin, 'player');
    const user = await openPlayers();
    await openGive(user, 'Ash');
    const sheet = await screen.findByRole('dialog', { name: /: Give to a player$/ });
    // Ash is removed in another tab as the GM taps; Robin is still a player.
    world.tables.actors = world.tables.actors.filter((a) => a.id !== ash);
    await user.click(within(sheet).getByRole('radio', { name: 'Give Ash to Robin, no character yet' }));
    await screen.findByText("You don't have permission to do that.");
    expect(screen.queryByText(/no longer in this campaign/)).toBeNull();
  });
});
