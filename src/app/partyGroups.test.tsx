// @vitest-environment jsdom
// The party's groups on Scene (M5 step 8; ruled 2026-10-30, DG14 and DG8), clicked through against the stand-in
// database. Invented characters.
//   With no split, the GM sees the one marching order, and a player the same circles front to back (S12; no "You" tag).
//   Split the party: a player picks a new group for their own character (others' characters only say where they are);
//   it happens at once with an Undo toast; their hireling goes with them; their marching order then shows their own group only.
//   The GM switches which group is in focus and sees that group's order, holding only its characters.
//   Join up with two groups: one tap, the party is together again (Undo puts the split back).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ICON_SET } from '../ui/iconSet.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { PartyGroups } from './PartyGroups.tsx';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

let world: FakeWorld;
beforeEach(() => {
  world = createFakeDb();
});
afterEach(() => cleanup());

function table() {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const jo = world.addPerson('jo@lantern.example', 'Jo');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const ash = world.addCharacter(campaign, 'Ash', { ownerId: jo });
  const moss = world.addCharacter(campaign, 'Moss', { ownerId: jo });
  // Sam's hireling, a lantern bearer.
  const bree = world.addCharacter(campaign, 'Bree the Lantern Bearer', { ownerId: sam });
  world.tables.actors.find((a) => a.id === bree)!.kind = 'hireling';
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, jo, 'player', ash);
  const users = {
    gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser,
    sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser,
    jo: { id: jo, roles: { [campaign]: 'player' } } as CurrentUser,
  };
  return { gm, sam, jo, campaign, wren, ash, moss, bree, users };
}

function show(t: ReturnType<typeof table>, who: 'gm' | 'sam' | 'jo') {
  world.signInAs(t[who]);
  const campaign = { id: t.campaign, name: 'The Ash Barrows', role: who === 'gm' ? ('gm' as const) : ('player' as const), line: null };
  return render(
    <ToastHost>
      <PartyGroups db={world.db} user={t.users[who]} campaign={campaign} />
    </ToastHost>,
  );
}

const rowsShown = () =>
  within(screen.getByRole('list', { name: 'Marching order, front to back' }))
    .getAllByRole('listitem')
    // Each circle's name: the start of what a screen reader hears (S12: circles for the GM and the players alike).
    .map((row) => within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label')?.split(/[,.]/)[0]));
const groupOf = (id: string) => world.tables.party_group_members.find((m) => m.actor_id === id)?.group_number;

describe('party groups on Scene', () => {
  it('with no split: the GM sees the one order; a player sees the same circles front to back, with no "You" tag', async () => {
    const t = table();
    const gmView = show(t, 'gm');
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Bree the Lantern Bearer'], ['Moss'], ['Wren']]));
    expect(screen.queryByRole('group', { name: 'Group in focus' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Marching order' })).toBeTruthy();
    gmView.unmount();
    show(t, 'sam');
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Bree the Lantern Bearer'], ['Moss'], ['Wren']]));
    expect(screen.getByRole('heading', { name: 'Marching order' })).toBeTruthy();
    expect(screen.queryByText(/\byou\b/i)).toBeNull();
  });

  it('Split the party: a player splits their own character off (their hireling follows), with Undo', async () => {
    const t = table();
    show(t, 'sam');
    const user = userEvent.setup();
    // ic-4 (S17): the button reads "Split party" with the parting arrows, as a stacked button.
    const splitButton = await screen.findByRole('button', { name: 'Split party' });
    expect(splitButton.className).toContain('stacked-button');
    expect(splitButton.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['split-arrows'].d);
    await user.click(splitButton);
    const dialog = await screen.findByRole('dialog', { name: 'Split the party' });
    // Sam picks for Wren and Bree; Ash and Moss (Jo's) only say where they are.
    expect(within(dialog).queryByRole('group', { name: "Ash's group" })).toBeNull();
    const wrens = within(dialog).getByRole('group', { name: "Wren’s group" });
    expect(within(wrens).getByRole('button', { name: '✓ Group 1' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(wrens).getByRole('button', { name: 'New group' }));
    expect(await screen.findByText('Wren is in Group 2')).toBeTruthy();
    await waitFor(() => expect(groupOf(t.wren)).toBe(2));
    expect(groupOf(t.bree)).toBe(2);
    expect(groupOf(t.ash)).toBe(1);
    expect(world.tables.events.some((e) => e.type === 'party.chooseGroup')).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    // Sam's marching order now shows their own group only.
    expect(await screen.findByRole('heading', { name: 'Marching order: Group 2' })).toBeTruthy();
    await waitFor(() => expect(rowsShown()).toEqual([['Bree the Lantern Bearer'], ['Wren']]));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(groupOf(t.wren)).toBe(1));
    expect(groupOf(t.bree)).toBe(1);
  });

  it("the GM switches which group is in focus and sees only that group's order; Join up brings them together", async () => {
    const t = table();
    world.signInAs(t.jo);
    await world.db.rpc('choose_party_group', { actor: t.ash });
    show(t, 'gm');
    const user = userEvent.setup();
    const focus = await screen.findByRole('group', { name: 'Group in focus' });
    await waitFor(() => expect(rowsShown()).toEqual([['Bree the Lantern Bearer'], ['Moss'], ['Wren']]));
    await user.click(within(focus).getByRole('button', { name: 'Group 2, 1' }));
    await waitFor(() => expect(rowsShown()).toEqual([['Ash']]));
    expect(screen.getByRole('heading', { name: 'Marching order: Group 2' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Join up' }));
    expect(await screen.findByText('Joined up: the party is together again')).toBeTruthy();
    await waitFor(() => expect(groupOf(t.ash)).toBe(1));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Group in focus' })).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(groupOf(t.ash)).toBe(2));
  });

  // Purpose (S17): once the party is split, the stacked button reads "Change groups" with the parting arrows, and "Join up" stands beside it; both are there to tap.
  it('split: the stacked button reads Change groups with its icon, and Join up stands beside it', async () => {
    const t = table();
    world.signInAs(t.jo);
    await world.db.rpc('choose_party_group', { actor: t.ash });
    show(t, 'gm');
    const change = await screen.findByRole('button', { name: 'Change groups' });
    expect(screen.queryByRole('button', { name: 'Split party' })).toBeNull();
    expect(change.className).toContain('stacked-button');
    expect(change.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['split-arrows'].d);
    const join = screen.getByRole('button', { name: 'Join up' });
    expect(join.hasAttribute('disabled')).toBe(false);
    expect(change.hasAttribute('disabled')).toBe(false);
    expect(change.parentElement).toBe(join.parentElement);
    await userEvent.setup().click(change);
    expect(await screen.findByRole('dialog', { name: 'Split the party' })).toBeTruthy();
  });

  it('moving a group order holds only its own characters, and a split-off order keeps its own moves', async () => {
    const t = table();
    world.signInAs(t.jo);
    await world.db.rpc('choose_party_group', { actor: t.ash });
    await world.db.rpc('choose_party_group', { actor: t.moss, to_group: 2 });
    show(t, 'jo');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Marching order: Group 2' })).toBeTruthy();
    (await screen.findByRole('slider', { name: 'Move Moss' })).focus();
    await user.keyboard('{ArrowUp}');
    expect(await screen.findByText('Moved Moss to the front')).toBeTruthy();
    const two = world.tables.marching_orders.find((m) => m.campaign_id === t.campaign && m.group_number === 2);
    expect(two?.rows).toEqual([[t.moss], [t.ash]]);
    // The party's own order is untouched.
    expect(world.tables.marching_orders.find((m) => m.campaign_id === t.campaign && m.group_number === 1)?.rows).toEqual([]);
  });
});
