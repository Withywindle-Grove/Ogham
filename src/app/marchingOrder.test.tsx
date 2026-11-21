// @vitest-environment jsdom
// Marching order on Scene (M5 step 8), clicked through against the stand-in database. Invented characters.
//   Everyone sees the rows front to back, a lit light's symbol first; a newly approved character joins at the back.
//   A row moves at once (here with the arrow keys, as a screen reader would; a finger holds and drags), with an Undo
//   toast that puts it back.
//   Two devices move it from the same copy: the late one is told "That's changed since. Here's the latest." and shows
//   the first device's move: nothing is lost silently.
//   Tapping a character opens the character overview: HP (per "Show each other's HP"; always your own), the
//   light with Keep lit for whoever may light it, what's at hand, and the marching moves (walk beside the row ahead, a
//   row of their own).
//   No lock (B11; p2p-21 and flag 5, ruled 2026-11-18): no lock switch for the GM or a player; in a campaign locked
//   before the lock went, a player still moves it, logged, with Undo. "Players can reorder marching order" off still
//   stops players: the rows stay holdable and a hold says why in a pop-up; the GM always may.
//   Saved orders: Save as… keeps the order; using it puts the party back in it; Delete removes one (Undo brings it back).
//   As circles (S12): each character's hit points under their own circle, a player seeing another's only where "Show
//   each other's HP" is on (the GM always); no "You" tag; initials with no portrait; the lights lit over the ranks.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { ICON_SET } from '../ui/iconSet.ts';
import { MarchingOrder } from './MarchingOrder.tsx';

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
  world.addMember(campaign, sam, 'player', wren);
  world.addMember(campaign, jo, 'player', ash);
  for (const [id, hp] of [[wren, 7], [ash, 9]] as const) Object.assign(world.tables.actors.find((a) => a.id === id)!, { hp_current: hp, hp_max: 12 });
  const users = {
    gm: { id: gm, roles: { [campaign]: 'gm' } } as CurrentUser,
    sam: { id: sam, roles: { [campaign]: 'player' } } as CurrentUser,
    jo: { id: jo, roles: { [campaign]: 'player' } } as CurrentUser,
  };
  return { gm, sam, jo, campaign, wren, ash, users };
}

function show(t: ReturnType<typeof table>, who: 'gm' | 'sam' | 'jo') {
  world.signInAs(t[who]);
  const campaign = { id: t.campaign, name: 'The Ash Barrows', role: who === 'gm' ? ('gm' as const) : ('player' as const), line: null };
  return render(
    <ToastHost>
      <MarchingOrder db={world.db} user={t.users[who]} campaign={campaign} />
    </ToastHost>,
  );
}

const rowsShown = () =>
  within(screen.getByRole('list', { name: 'Marching order, front to back' }))
    .getAllByRole('listitem')
    // Each circle's name: the start of what a screen reader hears ("Ash, 9 of 12 hit points. Details").
    .map((row) => within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label')?.split(/[,.]/)[0]));

describe('marching order', () => {
  it('shows everyone front to back, moves a row at once with Undo, and logs the move', async () => {
    const t = table();
    show(t, 'sam');
    // Nothing saved yet: the party by name, each in a row of their own.
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
    const user = userEvent.setup();
    screen.getByRole('slider', { name: 'Move Wren' }).focus();
    await user.keyboard('{ArrowUp}');
    expect(await screen.findByText('Moved Wren to the front')).toBeTruthy();
    await waitFor(() => expect(rowsShown()).toEqual([['Wren'], ['Ash']]));
    expect(world.tables.events.some((e) => e.type === 'marching.set')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
  });

  it('two devices move it from the same copy: the late one is told and shows the latest', async () => {
    const t = table();
    show(t, 'sam');
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
    // Jo's device moved it first (from the same copy, version 1).
    world.signInAs(t.jo);
    const first = await world.db.rpc('set_marching_order', { campaign: t.campaign, new_rows: [[t.wren, t.ash]], seen_version: 1 });
    expect(first.error).toBeNull();
    world.signInAs(t.sam);
    const user = userEvent.setup();
    screen.getByRole('slider', { name: 'Move Wren' }).focus();
    await user.keyboard('{ArrowUp}');
    expect(await screen.findByText("That's changed since. Here's the latest.")).toBeTruthy();
    await waitFor(() => expect(rowsShown()).toEqual([['Wren', 'Ash']]));
  });

  it('the overview: HP per the setting (always your own), Keep lit for your own light only, and the marching moves', async () => {
    const t = table();
    world.tables.campaigns.find((c) => c.id === t.campaign)!.settings = { playersSeeHp: false };
    show(t, 'sam');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ash. Details' }));
    let card = await screen.findByRole('dialog', { name: 'Ash' });
    expect(within(card).queryByText('HP')).toBeNull();
    expect(within(card).queryByRole('switch', { name: 'Keep lit' })).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Wren, 7 of 12 hit points. Details' }));
    card = await screen.findByRole('dialog', { name: 'Wren' });
    expect(within(card).getByText('7 / 12')).toBeTruthy();
    // Walk beside the row ahead: Wren joins Ash's row.
    await user.click(within(card).getByRole('button', { name: 'Walk beside Ash' }));
    expect(await screen.findByText('Put Wren beside Ash')).toBeTruthy();
    await waitFor(() => expect(rowsShown()).toEqual([['Ash', 'Wren']]));
    await user.click(screen.getByRole('button', { name: 'Wren, 7 of 12 hit points. Details' }));
    card = await screen.findByRole('dialog', { name: 'Wren' });
    await user.click(within(card).getByRole('button', { name: 'A row of their own' }));
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
  });

  it("Keep lit sits in the overview for the light's owner, with Undo", async () => {
    const t = table();
    world.tables.inventory_lines.push({ id: 'line-rush', campaign_id: t.campaign, actor_id: t.wren, location_id: null, name: 'Rushlights', category: 'light', qty: 2, stack: 10, approval: 'approved', item_data: { lightTypeId: 'rushlight' }, source_entry_id: null, version: 1 });
    world.signInAs(t.sam);
    await world.db.rpc('light_light', { actor: t.wren, line: 'line-rush', light_type: 'rushlight', light_name: 'Rushlight', burn_seconds: 3600, warn_seconds: 600, consumed: true, fuel_item: null });
    show(t, 'sam');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^Wren, Rushlight lit/ }));
    const card = await screen.findByRole('dialog', { name: 'Wren' });
    const keep = within(card).getByRole('switch', { name: 'Keep lit' });
    expect(keep.getAttribute('aria-checked')).toBe('false');
    await user.click(keep);
    await waitFor(() => expect(world.tables.character_lights.find((l) => l.actor_id === t.wren)?.keep_lit).toBe(true));
    expect(await screen.findByText('Rushlight will be kept lit')).toBeTruthy();
  });

  // Purpose (B11, p2p-21): the marching order has no lock switch, for the GM or for a player, and its "about" pop-up
  // no longer tells the GM to lock it.
  it('shows no lock switch, to the GM or to a player, and the GM is not told to lock it', async () => {
    const t = table();
    const gmView = show(t, 'gm');
    const user = userEvent.setup();
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/lock/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: /about the marching order/i }));
    const about = await screen.findByRole('dialog', { name: 'Marching order' });
    expect(within(about).getByText('You can always move it.')).toBeTruthy();
    expect(within(about).queryByText(/lock/i)).toBeNull();
    gmView.unmount();
    show(t, 'sam');
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/lock/i)).toBeNull();
  });

  // Purpose (flag 5, ruled 2026-11-18): in a campaign locked before the lock went, with "Players can reorder marching
  // order" on, a player still moves the order at once; the move is logged, Undo puts it back, and the stored lock is
  // left as it was.
  it('a campaign locked today: a player still moves it, logged, and Undo puts it back; the stored lock stays', async () => {
    const t = table();
    // "Locked today": the GM's old lock function wrote it, as it did while the switch was there.
    world.signInAs(t.gm);
    expect((await world.db.rpc('lock_marching_order', { campaign: t.campaign, lock_it: true })).error).toBeNull();
    const stored = () => world.tables.marching_orders.find((m) => m.campaign_id === t.campaign)?.locked;
    expect(stored()).toBe(true);
    show(t, 'sam');
    const user = userEvent.setup();
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
    expect(screen.queryByText('The GM has locked the marching order.')).toBeNull();
    screen.getByRole('slider', { name: 'Move Wren' }).focus();
    await user.keyboard('{ArrowUp}');
    expect(await screen.findByText('Moved Wren to the front')).toBeTruthy();
    await waitFor(() => expect(rowsShown()).toEqual([['Wren'], ['Ash']]));
    expect(world.tables.events.filter((e) => e.type === 'marching.set')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
    expect(stored()).toBe(true);
  });

  // Purpose (flag 5): the setting "Players can reorder marching order" still decides. Off, a player's rows stay
  // holdable (never a disabled control) and trying to move one opens a pop-up with the plain reason; nothing moves and
  // nothing is logged.
  it('"Players can reorder marching order" off: a player\'s try opens a pop-up with the plain reason, and nothing moves', async () => {
    const t = table();
    world.tables.campaigns.find((c) => c.id === t.campaign)!.settings = { playersReorderMarching: false };
    show(t, 'sam');
    const user = userEvent.setup();
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
    const slider = screen.getByRole('slider', { name: 'Move Wren' });
    expect(slider.hasAttribute('disabled')).toBe(false);
    expect(slider.getAttribute('aria-disabled')).not.toBe('true');
    slider.focus();
    await user.keyboard('{ArrowUp}');
    const popUp = await screen.findByRole('dialog', { name: "Can't move them now" });
    expect(within(popUp).getByText('Only the GM sets the marching order in this campaign.')).toBeTruthy();
    await act(async () => {});
    expect(rowsShown()).toEqual([['Ash'], ['Wren']]);
    expect(world.tables.events.some((e) => e.type === 'marching.set')).toBe(false);
  });

  // Purpose (flag 5): the GM always may, with the setting off and a lock stored; the move is logged, with Undo.
  it('the GM always may: with the setting off and a lock stored, the GM moves it, logged, with Undo', async () => {
    const t = table();
    world.tables.campaigns.find((c) => c.id === t.campaign)!.settings = { playersReorderMarching: false };
    world.signInAs(t.gm);
    expect((await world.db.rpc('lock_marching_order', { campaign: t.campaign, lock_it: true })).error).toBeNull();
    show(t, 'gm');
    const user = userEvent.setup();
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
    screen.getByRole('slider', { name: 'Move Wren' }).focus();
    await user.keyboard('{ArrowUp}');
    expect(await screen.findByText('Moved Wren to the front')).toBeTruthy();
    await waitFor(() => expect(rowsShown()).toEqual([['Wren'], ['Ash']]));
    expect(world.tables.events.filter((e) => e.type === 'marching.set')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
  });

  it('Save as… keeps the order; using it later puts the party back in it', async () => {
    const t = table();
    show(t, 'jo');
    const user = userEvent.setup();
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
    screen.getByRole('slider', { name: 'Move Wren' }).focus();
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(rowsShown()).toEqual([['Wren'], ['Ash']]));
    // ic-4 (S17): Saved orders is a stacked button with the unrolled scroll.
    const savedButton = screen.getByRole('button', { name: 'Saved orders' });
    expect(savedButton.className).toContain('stacked-button');
    expect(savedButton.querySelector('path')!.getAttribute('d')).toBe(ICON_SET['scroll-unfurled'].d);
    await user.click(savedButton);
    let saved = await screen.findByRole('dialog', { name: 'Saved orders' });
    await user.type(within(saved).getByRole('textbox', { name: 'Save as…' }), 'Tunnel');
    await user.click(within(saved).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved as “Tunnel”')).toBeTruthy();
    screen.getByRole('slider', { name: 'Move Ash' }).focus();
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(rowsShown()).toEqual([['Ash'], ['Wren']]));
    await user.click(screen.getByRole('button', { name: 'Saved orders' }));
    saved = await screen.findByRole('dialog', { name: 'Saved orders' });
    await user.click(within(saved).getByRole('button', { name: 'Tunnel' }));
    expect(await screen.findByText('Marching as “Tunnel”')).toBeTruthy();
    await waitFor(() => expect(rowsShown()).toEqual([['Wren'], ['Ash']]));
  });

  // As circles (S12, page 16 T10): hit points under each circle by "Show each other's HP"; no "You" tag; the lights lit.
  it("shows each character's hit points under their own circle; with Show each other's HP off a player sees only their own", async () => {
    const t = table();
    const first = show(t, 'sam');
    expect(await screen.findByRole('button', { name: 'Ash, 9 of 12 hit points. Details' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wren, 7 of 12 hit points. Details' })).toBeTruthy();
    first.unmount();
    world.tables.campaigns.find((c) => c.id === t.campaign)!.settings = { playersSeeHp: false };
    const second = show(t, 'sam');
    const ash = await screen.findByRole('button', { name: 'Ash. Details' });
    expect(ash.textContent).not.toContain('of 12');
    expect(screen.getByRole('button', { name: 'Wren, 7 of 12 hit points. Details' }).textContent).toContain('7 of 12');
    second.unmount();
    // The GM always sees them.
    show(t, 'gm');
    expect(await screen.findByRole('button', { name: 'Ash, 9 of 12 hit points. Details' })).toBeTruthy();
  });

  // "Show each other's HP" hides on screen only until M6's HP table (docs/03, docs/04): the documented state, not a new gap.
  it.todo("the database sends a player another character's hit points only where Show each other's HP is on (needs M6's own HP table: today every member reads them)");

  it('the player\'s own circle carries no "You" tag, and a circle with no portrait shows the initial', async () => {
    const t = table();
    show(t, 'sam');
    const wren = await screen.findByRole('button', { name: /^Wren/ });
    expect(wren.textContent).not.toMatch(/you/i);
    expect(within(wren).getByText('W')).toBeTruthy();
  });

  it("says which light is lit over the ranks, and the light's words under its circle", async () => {
    const t = table();
    world.tables.inventory_lines.push({ id: 'line-rush', campaign_id: t.campaign, actor_id: t.wren, location_id: null, name: 'Rushlights', category: 'light', qty: 2, stack: 10, approval: 'approved', item_data: { lightTypeId: 'rushlight' }, source_entry_id: null, version: 1 });
    world.signInAs(t.sam);
    await world.db.rpc('light_light', { actor: t.wren, line: 'line-rush', light_type: 'rushlight', light_name: 'Rushlight', burn_seconds: 3600, warn_seconds: 600, consumed: true, fuel_item: null });
    show(t, 'gm');
    expect(await screen.findByText(/^One light lit: Wren’s rushlight, /)).toBeTruthy();
    const wren = screen.getByRole('button', { name: /^Wren, Rushlight lit/ });
    expect(within(wren).getByText(/^Rushlight, /)).toBeTruthy();
    expect(screen.queryByText(/^No light$/)).toBeNull();
  });

  // The caller's banner (mc-76; page 04 C3, C5, C8), kept in the campaign's settings (the lead, 2026-11-14).
  it('the GM presses the banner, picks the caller from the circles at once with Undo, and the log names them', async () => {
    const t = table();
    show(t, 'gm');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Caller: No caller. Change the caller' }));
    const choose = screen.getByRole('group', { name: 'Choose the caller' });
    expect(within(choose).getByRole('button', { name: 'No caller, the caller now' })).toBeTruthy();
    await user.click(within(choose).getByRole('button', { name: 'Wren' }));
    expect(await screen.findByText('Wren is the caller')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Caller: Wren. Change the caller' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Choose the caller' })).toBeNull();
    expect((world.tables.campaigns.find((c) => c.id === t.campaign)!.settings as { caller?: string }).caller).toBe(t.wren);
    expect(world.tables.events.some((e) => e.type === 'campaign.update')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: 'Caller: No caller. Change the caller' })).toBeTruthy();
  });

  it('the pop-up marks the caller now, "No caller" clears it, and ✕ closes it with nothing changed', async () => {
    const t = table();
    world.tables.campaigns.find((c) => c.id === t.campaign)!.settings = { caller: t.ash };
    show(t, 'gm');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Caller: Ash. Change the caller' }));
    let choose = screen.getByRole('group', { name: 'Choose the caller' });
    expect(within(choose).getByRole('button', { name: 'Ash, the caller now' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('group', { name: 'Choose the caller' })).toBeNull();
    expect((world.tables.campaigns.find((c) => c.id === t.campaign)!.settings as { caller?: string }).caller).toBe(t.ash);
    await user.click(screen.getByRole('button', { name: 'Caller: Ash. Change the caller' }));
    choose = screen.getByRole('group', { name: 'Choose the caller' });
    await user.click(within(choose).getByRole('button', { name: 'No caller' }));
    expect(await screen.findByText('No caller now')).toBeTruthy();
    await waitFor(() => expect((world.tables.campaigns.find((c) => c.id === t.campaign)!.settings as { caller?: string | null }).caller).toBeNull());
  });

  it('picking the caller who is already the caller writes nothing', async () => {
    const t = table();
    world.tables.campaigns.find((c) => c.id === t.campaign)!.settings = { caller: t.wren };
    show(t, 'gm');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Caller: Wren. Change the caller' }));
    await user.click(within(screen.getByRole('group', { name: 'Choose the caller' })).getByRole('button', { name: 'Wren, the caller now' }));
    expect(screen.queryByRole('group', { name: 'Choose the caller' })).toBeNull();
    expect(world.tables.events.some((e) => e.type === 'campaign.update')).toBe(false);
  });

  it('a character whose hit points are not set shows "—" of the most, not 0', async () => {
    const t = table();
    Object.assign(world.tables.actors.find((a) => a.id === t.ash)!, { hp_current: null, hp_max: 12 });
    show(t, 'gm');
    const ash = await screen.findByRole('button', { name: 'Ash, not set of 12 hit points. Details' });
    expect(ash.textContent).toContain('— of 12');
    expect(ash.textContent).not.toContain('0 of 12');
  });

  it("a player sees the same banner; their press says the GM changes the caller, and nothing is written", async () => {
    const t = table();
    world.tables.campaigns.find((c) => c.id === t.campaign)!.settings = { caller: t.wren };
    show(t, 'jo');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Caller: Wren. Change the caller' }));
    expect(await screen.findByText('The GM chooses the caller in this campaign.')).toBeTruthy();
    expect(world.tables.events.some((e) => e.type === 'campaign.update')).toBe(false);
  });

  it('a saved order can be deleted at once, and Undo puts it back', async () => {
    const t = table();
    world.signInAs(t.jo);
    await world.db.rpc('set_marching_order', { campaign: t.campaign, new_rows: [[t.wren], [t.ash]] });
    await world.db.rpc('save_marching_preset', { campaign: t.campaign, preset_name: 'Ford' });
    show(t, 'jo');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Saved orders' }));
    const saved = await screen.findByRole('dialog', { name: 'Saved orders' });
    await user.click(within(saved).getByRole('button', { name: 'Delete Ford' }));
    expect(await screen.findByText('Deleted “Ford”')).toBeTruthy();
    await waitFor(() => expect(within(saved).queryByRole('button', { name: 'Ford' })).toBeNull());
    expect(world.tables.events.some((e) => e.type === 'marching.deletePreset')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await within(saved).findByRole('button', { name: 'Ford' })).toBeTruthy();
  });
});
