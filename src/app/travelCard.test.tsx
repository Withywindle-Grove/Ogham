// @vitest-environment jsdom
// The travel card (M5b step 1; docs/05 "Movement", "Lost"; ruled 2026-10-30, S1–S7, D4, D7–D10, S4-6), clicked through
// against the stand-in database with invented wilderness rules (a travel budget of points worked out from the
// slowest member, routes, terrain and a forced march that counts once).
//   The GM's Scene shows "<name> N of M" from the slowest member, and the day starts by itself.
//   Move… previews the cost, writes the move with an Undo toast, and a short move leaves points owed tomorrow.
//   A player sees the points left, the ground around them and Force march (counts once); Lost is secret unless Open.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { typePlace } from '../testing/pickPlace.ts';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetFileLinks } from '../core/files.ts';
import { mireRules } from '../modules/expedition/fixtures.ts';
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

/** The GM Priya, the player Sam (with Wren), and Ash (the GM's own character) in The Ash Barrows. */
function table(options: { gettingLost?: 'open' | 'secret' } = {}) {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Ash Barrows', gm);
  const wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  const ash = world.addCharacter(campaign, 'Ash');
  world.addMember(campaign, sam, 'player', wren);
  // Load tracked in coins, and whether Lost is shown to the players.
  world.tables.campaigns[0]!.settings = { encumbrance: { mode: 'coin' }, ...(options.gettingLost ? { gettingLost: options.gettingLost } : {}) };
  return { gm, sam, campaign, wren, ash };
}

/** The invented wilderness rules, with load tiers whose movement sets the pace (115 ft is 11 points, 95 ft is 9). */
function withRules(campaign: string, gm: string) {
  world.tables.packs.push({ id: 'pack-mire', owner_user_id: gm, campaign_id: null, name: 'Mirewalk Rules', version: '1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-10-18T12:00:00Z' });
  const data = {
    ...mireRules,
    encumbrance: {
      mode: 'coin',
      coin: {
        tiers: [
          { label: 'Light', max: 450, effect: 'Nothing slows you', movement: '115 ft' },
          { label: 'Heavy', max: 900, effect: 'You labour', movement: '95 ft' },
        ],
      },
    },
  };
  world.tables.library_entries.push({ id: 'entry-mire', pack_id: 'pack-mire', kind: 'rulesSet', pack_entry_id: 'mire-rules', name: 'Mirewalk rules', data });
  world.tables.campaign_packs.push({ id: 'link-mire', campaign_id: campaign, pack_id: 'pack-mire', pack_name: 'Mirewalk Rules', option_choices: {}, overrides: {}, priority: 1 });
}

/** Which load tier each character stands in (the database keeps it in carrier_loads). */
function carry(campaign: string, tiers: Record<string, string>) {
  for (const [actor, tier] of Object.entries(tiers)) world.tables.carrier_loads.push({ actor_id: actor, campaign_id: campaign, tier, load: 0, version: 1 });
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
const card = async () => within(await screen.findByRole('region', { name: "The party's travel" }));
const rowOf = () => world.tables.travel_groups[0]!;
/** The rest condition Push on marks on a character, still on. */
const wearyOn = (actor: string) => world.tables.character_statuses.filter((st) => st.actor_id === actor && st.source === 'rest' && st.ended_at === null && !st.undone);

/** The GM starts the expedition and the card starts day 1 by itself. */
async function startTrip(user: ReturnType<typeof userEvent.setup>) {
  // The band's Next turn / Next day and the count need a running session (st-1): start one first.
  const start = screen.queryByRole('button', { name: 'Start session' });
  if (start) await user.click(start);
  await startExpedition(user);
  await waitFor(() => expect(world.tables.travel_groups).toHaveLength(1));
}

describe('The travel card (M5b step 1)', () => {
  // Purpose: the GM's budget card counts from the slowest member (95 ft beats 115 ft), says so in the breakdown, and
  // the day starts by itself with no tap.
  it('shows "<name> N of M" from the slowest member and starts the day by itself', async () => {
    const { gm, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const user = await openScene(gm, true);
    await startTrip(user);
    expect(await screen.findByRole('button', { name: /^Strides 9 of 9/ })).toBeTruthy();
    expect(rowOf()).toMatchObject({ group_number: 1, total: 9, spent: 0, pace: 'foot', forced: 0 });

    await user.click(screen.getByRole('button', { name: /^Strides 9 of 9/ }));
    const why = within(await screen.findByRole('dialog', { name: 'Strides today' }));
    expect(why.getByText('Slowest: Ash (speed 95)')).toBeTruthy();
  });

  // Purpose: the expedition's first day is stored as day 0 (the card says "Day 1" by adding one).
  // KNOWN BUG, reported to the builder: travelView.ts counts the day with elapsedSteps, which starts at 1, so the first
  // day is stored as 1 and the toasts say "Day 2". Remove `.fails` once travelView.ts subtracts one.
  it('stores the first day as day 0', async () => {
    const { gm, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const user = await openScene(gm, true);
    await startTrip(user);
    expect(rowOf().day).toBe(0);
  });

  // Purpose: Move… previews the cost and what is left as the GM picks a terrain and a route, writes the move with one tap
  // on Move, and the toast's Undo takes it back (the points, the ground and the place it made).
  it('Move… previews the cost, writes the move with an Undo toast, and Undo reverses it', async () => {
    const { gm, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const user = await openScene(gm, true);
    await startTrip(user);
    await user.click(await screen.findByRole('button', { name: 'Move…' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Move the party' }));

    await user.click(within(dialog.getByRole('group', { name: 'Terrain' })).getByRole('button', { name: /Bog, 3/ }));
    expect(dialog.getByText('Cost 3, 6 of 9 left after')).toBeTruthy();
    // A route's own cost wins over the terrain's; tapping the route again lets go of it.
    await user.click(within(dialog.getByRole('group', { name: 'Route' })).getByRole('button', { name: /Causeway, 1/ }));
    expect(dialog.getByText('Cost 1, 8 of 9 left after')).toBeTruthy();
    await user.click(within(dialog.getByRole('group', { name: 'Route' })).getByRole('button', { name: /Causeway, 1/ }));
    expect(dialog.getByText('Cost 3, 6 of 9 left after')).toBeTruthy();

    await typePlace(user, 'Moss Landing', 'Place (optional)', dialog);
    await user.click(dialog.getByRole('button', { name: 'Move' }));
    const undo = await toastUndo('Moved into Moss Landing, 3 points');
    await waitFor(() => expect(rowOf()).toMatchObject({ spent: 3, terrain_id: 'bog', route_id: null, pending_owed: null }));
    expect(await screen.findByRole('button', { name: /^Strides 6 of 9/ })).toBeTruthy();
    const landing = world.tables.places.find((p) => p.name === 'Moss Landing');
    expect(landing).toBeTruthy();
    expect(world.tables.group_places.some((g) => g.place_id === landing!.id && g.moved_on === false && g.undone === false)).toBe(true);

    await user.click(undo);
    await waitFor(() => expect(rowOf()).toMatchObject({ spent: 0, terrain_id: null }));
    expect(await screen.findByRole('button', { name: /^Strides 9 of 9/ })).toBeTruthy();
  });

  // Purpose: a move that costs more than what is left spends what is left, shows "Entering <place> · N more tomorrow"
  // on the card, and keeps the group where it was until the rest is paid.
  it('a cost above what is left shows "Entering <place>, N more tomorrow" on the card', async () => {
    const { gm, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const user = await openScene(gm, true);
    await startTrip(user);
    await user.click(await screen.findByRole('button', { name: 'Move…' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Move the party' }));
    await user.type(dialog.getByLabelText('Other cost'), '13');
    await typePlace(user, 'Reed Hollow', 'Place (optional)', dialog);
    expect(dialog.getByText('Entering Reed Hollow, 4 more tomorrow')).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Move' }));

    // The GM's own name for the place is kept in the GM's part of the row (fm-1); the row the players read has none
    // until the place has been shown to them.
    await waitFor(() => expect(rowOf()).toMatchObject({ spent: 9, pending_owed: 4, pending_place_name: null, pending_place_id: null, terrain_id: null }));
    expect(world.tables.travel_group_secrets.find((s) => s.id === rowOf().id)).toMatchObject({ pending_place_name: 'Reed Hollow' });
    const travel = await card();
    expect(await travel.findByText('Entering Reed Hollow, 4 more tomorrow')).toBeTruthy();
    expect(travel.getByRole('button', { name: /^Strides 0 of 9/ })).toBeTruthy();
    // Not there yet: no place was made for the group.
    expect(world.tables.places.some((p) => p.name === 'Reed Hollow')).toBe(false);
    cleanup();

    // A player of the group (fm-1): the place hasn't been shown to them, so their card doesn't name it.
    world.signInAs(world.tables.members.find((m) => m.base_role === 'player')!.user_id as string);
    const asPlayer = userEvent.setup();
    render(<Root db={world.db} />);
    await asPlayer.click(await screen.findByRole('button', { name: /The Ash Barrows/ }));
    await asPlayer.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
    const theirs = await card();
    expect(await theirs.findByText('Entering the next place, 4 more tomorrow')).toBeTruthy();
    expect(screen.queryByText(/Reed Hollow/)).toBeNull();
  });

  // Purpose: a player sees the points left and the ground around them after the GM's move, can Force march (the pack's
  // 1.5 of the base: 4 more points), no rest prompt opens at the march (it waits for camp, SC-4-3 A), and a second tap
  // says it counts only once.
  it("a player sees the points left and the ground, and Force march adds the pack's points once", async () => {
    const { gm, sam, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const gmUser = await openScene(gm, true);
    await startTrip(gmUser);
    await gmUser.click(await screen.findByRole('button', { name: 'Move…' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Move the party' }));
    await gmUser.click(within(dialog.getByRole('group', { name: 'Terrain' })).getByRole('button', { name: /Bog, 3/ }));
    await gmUser.click(dialog.getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(rowOf()).toMatchObject({ spent: 3, terrain_id: 'bog' }));
    cleanup();

    const user = await openScene(sam, false, /^Trekking/);
    const travel = await card();
    expect(await travel.findByRole('button', { name: /^Strides 6 of 9/ })).toBeTruthy();
    expect(travel.getByText('Around you: Bog')).toBeTruthy();
    // A player has none of the GM's controls.
    expect(travel.queryByRole('button', { name: 'Move…' })).toBeNull();

    await user.click(travel.getByRole('button', { name: 'Force march' }));
    await screen.findByText('Forced march, +4 points, rest due this evening');
    await waitFor(() => expect(rowOf()).toMatchObject({ total: 13, forced: 1, spent: 3 }));
    expect(await travel.findByRole('button', { name: /^Strides 10 of 13/ })).toBeTruthy();
    // No rest is called and no rest prompt opens at the march: rest falls due in camp's Sleep step (ruled 2026-11-03).
    expect(world.tables.character_rests.filter((r) => r.called_at !== null)).toEqual([]);
    expect(screen.queryByRole('region', { name: 'Rest day' })).toBeNull();
    expect(screen.queryByText('Rest due (forced march)')).toBeNull();

    await user.click(travel.getByRole('button', { name: 'Force march' }));
    await screen.findByText(/already forced the march today: the pack lets it count once/);
    expect(rowOf()).toMatchObject({ total: 13, forced: 1 });
  });

  // Purpose (fm-1): the player who forced the march reads it as their own line (the group's line: its players and the
  // GM), and the toast's Undo takes it back at once, with no confirm.
  it('the player who forced the march reads it in their log and takes it back from the toast', async () => {
    const { gm, sam, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    await openScene(gm, true);
    await startTrip(userEvent.setup());
    cleanup();

    const user = await openScene(sam, false, /^Trekking/);
    await user.click((await card()).getByRole('button', { name: 'Force march' }));
    await waitFor(() => expect(rowOf()).toMatchObject({ total: 13, forced: 1 }));
    expect(world.tables.events.find((e) => e.type === 'travel.forceMarch')).toMatchObject({ audience: 'group', group_number: 1, group_user_ids: [sam] });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Recently' }).textContent).toContain('You forced the march with the party: +4 points, rest due this evening.'));
    await user.click(await toastUndo('Forced march, +4 points, rest due this evening'));
    await waitFor(() => expect(rowOf()).toMatchObject({ total: 9, forced: 0 }));
    expect(await (await card()).findByRole('button', { name: /^Strides 9 of 9/ })).toBeTruthy();
  });

  // Purpose (fm-1): from the log line, the same Undo; once the GM has spent the march's points the database refuses,
  // and the player is told why in plain words (the march stays).
  it("the log line's Undo of a forced march says why it can't once the points are spent", async () => {
    const { gm, sam, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const gmUser = await openScene(gm, true);
    await startTrip(gmUser);
    cleanup();

    let user = await openScene(sam, false, /^Trekking/);
    await user.click((await card()).getByRole('button', { name: 'Force march' }));
    await waitFor(() => expect(rowOf()).toMatchObject({ total: 13, forced: 1 }));
    cleanup();

    // The GM moves the party on the march's points.
    const again = await openScene(gm, true, /^The Mustering Field, /);
    await again.click(await screen.findByRole('button', { name: 'Move…' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Move the party' }));
    await again.click(within(dialog.getByRole('group', { name: 'Terrain' })).getByRole('button', { name: /Bog, 3/ }));
    await again.click(dialog.getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(rowOf()).toMatchObject({ spent: 3 }));
    cleanup();

    user = await openScene(sam, false, /^Trekking/);
    await user.click(screen.getByRole('button', { name: 'Log' }));
    const log = within(await screen.findByRole('dialog', { name: 'Log' }));
    const line = 'You forced the march with the party: +4 points, rest due this evening.';
    await user.click(await log.findByRole('button', { name: new RegExp(`^${line.replace(/[.+]/g, '\\$&')}`) }));
    await user.click(await log.findByRole('button', { name: `Undo: ${line}` }));
    expect(await screen.findByText("That's changed since. Undo the later change first.")).toBeTruthy();
    expect(rowOf()).toMatchObject({ total: 13, forced: 1, spent: 3 });
  });

  // Purpose: a group that forced the march today and is in camp tonight gets "Rest due (forced march)" in camp's Sleep
  // step and the rest prompt asks Rest or Push on (ruled 2026-11-03, SC-4-3 A); a group that didn't march gets none;
  // undoing the march takes it away again.
  it("a forced march makes rest due in camp's Sleep step, and its Undo takes it away", async () => {
    const { gm, sam, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    await openScene(gm, true);
    await startTrip(userEvent.setup());
    const expeditionId = String(world.tables.expeditions[0]!.id);
    // The group makes camp for the evening (the camp's own functions aren't in the stand-in: the row as they leave it).
    world.tables.camps.push({ id: 'camp-1', campaign_id: campaign, expedition_id: expeditionId, group_number: 1, day: 0, quick: false, fire_type_id: null, fire_name: null, fuel_item: null, applied_at: null, undone: false, created_by: gm });
    cleanup();

    // No forced march: camp's Sleep step has no rest line and no rest prompt opens.
    let user = await openScene(sam, false, /^Trekking/);
    await screen.findByRole('region', { name: "The party's travel" });
    expect(await screen.findByText('Sleep')).toBeTruthy();
    expect(screen.queryByText('Rest due (forced march)')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Rest day' })).toBeNull();

    // Forced march: the Sleep step says the rest is due, and the rest prompt asks.
    await user.click((await card()).getByRole('button', { name: 'Force march' }));
    cleanup();
    await openScene(sam, false, /^Trekking/);
    await screen.findByText('Sleep');
    const prompt = await screen.findByRole('region', { name: 'Rest day' });
    expect(within(prompt).getByText('Rest due (forced march)')).toBeTruthy();
    expect(within(prompt).getByRole('button', { name: 'Rest' })).toBeTruthy();
    expect(screen.getAllByText('Rest due (forced march)')).toHaveLength(2);
    cleanup();

    // The GM undoes the march: the forced count goes back, and with it the rest due.
    world.signInAs(gm);
    const march = world.tables.events.find((e) => e.type === 'travel.forceMarch')!;
    expect((await world.db.rpc('undo_request_said', { event_id: String(march.id) })).error).toBeNull();
    expect(rowOf()).toMatchObject({ forced: 0 });
    user = await openScene(sam, false, /^Trekking/);
    await screen.findByRole('region', { name: "The party's travel" });
    expect(await screen.findByText('Sleep')).toBeTruthy();
    expect(screen.queryByText('Rest due (forced march)')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Rest day' })).toBeNull();
    void user;
  });

  // Purpose (ruled B 2026-11-03, camp follow-up ⚑): a group that forced the march and comes to Next day with no camp
  // that evening gets the pack's condition (Push on, unanswered), and Undo of Next day takes it off again.
  it('a forced march with no camp: Next day gives the condition, unanswered; Undo takes it back', async () => {
    const { gm, sam, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    await openScene(gm, true);
    await startTrip(userEvent.setup());
    cleanup();
    await (async () => {
      const user = await openScene(sam, false, /^Trekking/);
      await user.click((await card()).getByRole('button', { name: 'Force march' }));
      await waitFor(() => expect(rowOf()).toMatchObject({ forced: 1 }));
    })();
    cleanup();

    const user = await openScene(gm, true, /^The Mustering Field, /);
    await card();
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(wearyOn(wren)).toHaveLength(1));
    expect(wearyOn(ash)).toHaveLength(1);
    expect(world.tables.character_statuses.filter((st) => st.source === 'rest' && !st.undone).map((st) => st.actor_id).sort()).toEqual([ash, wren].sort());
    expect(world.tables.events.filter((e) => e.type === 'rest.applied' && e.target_table === 'character_rests')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(wearyOn(wren)).toEqual([]));
    expect(wearyOn(ash)).toEqual([]);
  });

  // Purpose (#807 review; undoClock's dayStartsAfter): two days into a trek, the second Next day's toast Undo takes back
  // the clock and the second travel day the card started with it, so the party is on its first day again.
  it('two days on, the toast’s Undo takes back the second day’s travel day with the clock', async () => {
    const { gm, campaign } = table();
    withRules(campaign, gm);
    const user = await openScene(gm, true);
    await startTrip(user);
    const clockAt = () => Number(world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)?.seconds ?? 0);
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(rowOf()).toMatchObject({ day: 1 }));
    const afterOne = clockAt();
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(rowOf()).toMatchObject({ day: 2 }));
    const secondDay = world.tables.events.filter((e) => e.type === 'travel.dayStart').at(-1)!;
    await user.click(screen.getAllByRole('button', { name: 'Undo' }).at(-1)!);
    await waitFor(() => expect(rowOf()).toMatchObject({ day: 1 }));
    expect(clockAt()).toBe(afterOne);
    expect(world.tables.events.some((e) => e.reverts_event_id === secondDay.id)).toBe(true);
  });

  // Purpose (gate walk, finding 1a): Undo of Next day takes back the travel day the card started after it, so a forced
  // march on the first day comes back with its points and its rest due after Next day and its toast's Undo; and Next
  // day again then starts the second day afresh. (Rewritten for st-1: the strip's Undo is gone and one toast shows at a
  // time, so "twice and twice" is no longer reachable from the screen; the one day back and again is kept.)
  it('Undo of Next day brings back the first day as it was: the forced march and its rest due', async () => {
    const { gm, sam, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    await openScene(gm, true);
    await startTrip(userEvent.setup());
    const expeditionId = String(world.tables.expeditions[0]!.id);
    world.tables.camps.push({ id: 'camp-1', campaign_id: campaign, expedition_id: expeditionId, group_number: 1, day: 0, quick: false, fire_type_id: null, fire_name: null, fuel_item: null, applied_at: null, undone: false, created_by: gm });
    cleanup();
    await (async () => {
      const user = await openScene(sam, false, /^Trekking/);
      await user.click((await card()).getByRole('button', { name: 'Force march' }));
      await waitFor(() => expect(rowOf()).toMatchObject({ day: 0, total: 13, forced: 1 }));
    })();
    cleanup();

    let user = await openScene(gm, true, /^The Mustering Field, /);
    await card();
    // The strip has no Undo of its own now (st-1): the newest toast carries it.
    const stripUndo = () => screen.getAllByRole('button', { name: 'Undo' }).at(-1)!;
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(rowOf()).toMatchObject({ day: 1, forced: 0 }));
    // Undo: only the newest toast holds it, so one Next day at a time (a second day's toast replaces the first's).
    await user.click(stripUndo());
    await waitFor(() => expect(rowOf()).toMatchObject({ day: 0, total: 13, spent: 0, forced: 1 }));
    expect(await (await card()).findByRole('button', { name: /^Strides 13 of 13/ })).toBeTruthy();
    cleanup();

    // The player sees the rest due again in camp's Sleep step.
    await openScene(sam, false, /^Trekking/);
    await screen.findByText('Sleep');
    expect((await screen.findAllByText('Rest due (forced march)')).length).toBeGreaterThan(0);
    cleanup();

    // Next day again starts the second day afresh: its own points, no forced march.
    user = await openScene(gm, true, /^The Mustering Field, /);
    await card();
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(rowOf()).toMatchObject({ day: 1, total: 9, spent: 0, forced: 0 }));
  });

  // Purpose (review of #617, finding 1): Undo of a day passed in Downtime, with a trek started since, puts the clock back
  // but keeps the trek's first travel day (a first day is made, not moved on, so it isn't the move's to take back).
  it("Undo of a Downtime day keeps a trek's first travel day started after it", async () => {
    const { gm, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const user = await openScene(gm, true);
    const clockAt = () => Number(world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)?.seconds ?? 0);
    // Downtime's one band button is Next day (st-1), which does what "+1 day" did; it needs a running session.
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(clockAt()).toBeGreaterThan(0));
    await startTrip(user);
    const firstDay = world.tables.events.find((e) => e.type === 'travel.dayStart' && e.target_table === 'travel_groups')!;

    await user.click(screen.getByRole('button', { name: 'Log' }));
    const log = within(await screen.findByRole('dialog', { name: 'Log' }));
    // The strip has no Undo of its own now and the passing day's toast is long gone: the log line's Undo takes it back.
    const line = 'You let 1 day pass in downtime.';
    await user.click(await log.findByRole('button', { name: new RegExp(`^${line.replace(/[.+]/g, '\\$&')}`) }));
    await user.click(await log.findByRole('button', { name: `Undo: ${line}` }));
    await waitFor(() => expect(clockAt()).toBe(0));
    expect(world.tables.events.some((e) => e.reverts_event_id === firstDay.id)).toBe(false);
    expect(world.tables.travel_groups.filter((t) => !t.undone)).toHaveLength(1);
    expect(world.tables.travel_groups[0]).toMatchObject({ day: 0, undone: false });
  });

  // Purpose (review of #617, finding 4; ruled ud-1, 2026-11-12): Next day starts the travel day in its own request, so
  // when that day can't go back (a move was made on it since) the Undo is refused whole: the clock and the day both
  // stay, and the toast says why. (Before, the clock went back alone and the toast named whose travel stayed.)
  it("a travel day that can't go back keeps the clock too: the toast says to undo the later change first", async () => {
    const { gm, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const user = await openScene(gm, true);
    await startTrip(user);
    // A move on each day: the second day's start puts the points spent back to 0, and its move spends them again.
    const moveIntoBog = async () => {
      await user.click(await screen.findByRole('button', { name: 'Move…' }));
      const dialog = within(await screen.findByRole('dialog', { name: 'Move the party' }));
      await user.click(within(dialog.getByRole('group', { name: 'Terrain' })).getByRole('button', { name: /Bog, 3/ }));
      await user.click(dialog.getByRole('button', { name: 'Move' }));
    };
    await moveIntoBog();
    await waitFor(() => expect(rowOf()).toMatchObject({ day: 0, spent: 3 }));
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(rowOf()).toMatchObject({ day: 1, spent: 0 }));
    // The strip has no Undo of its own now (st-1) and a move's own toast would replace Next day's, so the move on the
    // second day is made from another device (a row and an event written as the move writes them) while Next day's
    // toast, with its Undo, is still up.
    const row = rowOf();
    const seq = Math.max(...world.tables.events.map((e) => Number(e.seq))) + 1;
    world.tables.events.push({ id: `event-${seq}`, seq, campaign_id: campaign, type: 'travel.move', level: 'simple', actor_user_id: gm, target_table: 'travel_groups', target_id: row.id, before: { spent: 0 }, after: { spent: 3 }, fiat: false, reason: null, reverts_event_id: null, audience: 'table', owner_user_id: null, reveal_at: 'now', request_id: null, created_at: new Date().toISOString() });
    row.spent = 3;
    await user.click(screen.getAllByRole('button', { name: 'Undo' }).at(-1)!);
    expect(await screen.findByText("That's changed since. Undo the later change first.")).toBeTruthy();
    expect(rowOf()).toMatchObject({ day: 1, spent: 3 });
    expect(Number(world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds)).toBeGreaterThan(0);
  });

  // Purpose: with a camp that evening, camp's Sleep step flow applies as before (an answered Rest rests; the one left
  // unanswered pushes on); a group that didn't force the march gets nothing at Next day.
  it("with a camp the Sleep step's answers apply; with no forced march Next day gives nothing", async () => {
    const { gm, sam, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    await openScene(gm, true);
    await startTrip(userEvent.setup());
    cleanup();

    // No forced march, no camp: Next day applies no rest.
    let user = await openScene(gm, true, /^The Mustering Field, /);
    await card();
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(rowOf().day).toBe(1));
    expect(world.tables.character_statuses.filter((st) => st.source === 'rest')).toEqual([]);
    expect(world.tables.events.filter((e) => e.type === 'rest.applied')).toEqual([]);
    cleanup();

    // Day 2: Sam forces the march, the group makes camp, and Sam answers Rest for Wren in the Sleep step's prompt.
    const expeditionId = String(world.tables.expeditions[0]!.id);
    world.tables.camps.push({ id: 'camp-2', campaign_id: campaign, expedition_id: expeditionId, group_number: 1, day: 1, quick: false, fire_type_id: null, fire_name: null, fuel_item: null, applied_at: null, undone: false, created_by: gm });
    user = await openScene(sam, false, /^Trekking/);
    await user.click((await card()).getByRole('button', { name: 'Force march' }));
    await waitFor(() => expect(rowOf()).toMatchObject({ forced: 1 }));
    cleanup();
    user = await openScene(sam, false, /^Trekking/);
    const prompt = within(await screen.findByRole('region', { name: 'Rest day' }));
    await user.click(prompt.getByRole('button', { name: 'Rest' }));
    await waitFor(() => expect(world.tables.character_rests.find((r) => r.actor_id === wren)?.chosen_at).not.toBeNull());
    cleanup();

    user = await openScene(gm, true, /^The Mustering Field, /);
    await card();
    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(wearyOn(ash)).toHaveLength(1));
    expect(wearyOn(wren)).toEqual([]);
  });

  // Purpose: the GM marks a group lost and gets the Lost card with Found the way and Still lost; Still lost counts the
  // morning, Found the way ends it and the card goes away.
  it('Mark lost shows the Lost card to the GM, with Found the way and Still lost', async () => {
    const { gm, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const user = await openScene(gm, true);
    await startTrip(user);
    await user.click(await screen.findByRole('button', { name: 'Mark lost' }));
    const lostCard = within(await screen.findByRole('group', { name: 'Lost' }));
    await screen.findByText('The party is lost');
    expect(world.tables.group_lost).toHaveLength(1);
    expect(lostCard.getByRole('button', { name: 'Found the way' })).toBeTruthy();

    await user.click(lostCard.getByRole('button', { name: 'Still lost' }));
    await waitFor(() => expect(world.tables.group_lost[0]).toMatchObject({ attempts: 1, found_day: null }));
    expect(await lostCard.findByText(/still lost one morning/)).toBeTruthy();

    await user.click(lostCard.getByRole('button', { name: 'Found the way' }));
    await waitFor(() => expect(world.tables.group_lost[0]!.found_day).not.toBeNull());
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Lost' })).toBeNull());
  });

  // Purpose: the lost check's modifiers keyed to the party (ex-2, ga-3) read who is in the group: with a Reed Witch
  // in it, Move… names her beside the chance and the Lost card's chance of finding the way counts her modifier.
  it("with a Reed Witch in the party the Lost card's chance counts her modifier", async () => {
    const { gm, campaign, wren, ash } = table();
    withRules(campaign, gm);
    const entry = world.tables.library_entries.find((e) => e.id === 'entry-mire')!;
    const data = structuredClone(entry.data) as { exploration: { modes: { checks: { id: string; modifiers: unknown[] }[] }[] } };
    data.exploration.modes[0]!.checks.find((c) => c.id === 'trek-astray')!.modifiers.push({ ifPartyHas: { class: 'reed-witch' }, add: 1 });
    entry.data = data;
    world.tables.library_entries.push({ id: 'entry-witch', pack_id: 'pack-mire', kind: 'class', pack_entry_id: 'reed-witch', name: 'Reed Witch', data: { name: 'Reed Witch' } });
    world.tables.actors.find((a) => a.id === wren)!.classes = [{ classRef: 'reed-witch', level: 1, xp: 0 }];
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const user = await openScene(gm, true);
    await startTrip(user);
    // Move… names her as the reason beside the chance.
    await user.click(await screen.findByRole('button', { name: 'Move…' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Move the party' }));
    await user.click(within(dialog.getByRole('group', { name: 'Terrain' })).getByRole('button', { name: /Bog, 3/ }));
    expect(dialog.getByText('Going astray: 1–3 on d6, a Reed Witch in the party')).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Mark lost' }));
    expect(await screen.findByText(/finding the way: 1–2 on d6/)).toBeTruthy();
  });

  // Purpose: while Getting lost is Secret (the default) a player never receives, or sees, their group's Lost; hidden
  // means hidden (hard rule 5).
  it('a player sees no Lost while Getting lost is secret', async () => {
    const { gm, sam, campaign, wren, ash } = table();
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const gmUser = await openScene(gm, true);
    await startTrip(gmUser);
    await gmUser.click(await screen.findByRole('button', { name: 'Mark lost' }));
    await waitFor(() => expect(world.tables.group_lost).toHaveLength(1));
    cleanup();

    await openScene(sam, false, /^Trekking/);
    await card();
    expect(screen.queryByRole('group', { name: 'Lost' })).toBeNull();
    expect(screen.queryByText(/Lost since day/)).toBeNull();
    expect((await world.db.from('group_lost').select('*').eq('campaign_id', campaign)).data).toEqual([]);
  });

  // Purpose: when the GM opens Getting lost, the player sees Lost for their group and can enter the recovery roll,
  // which the GM then sees as rolled.
  it('a player sees Lost, and can enter the roll, when Getting lost is open', async () => {
    const { gm, sam, campaign, wren, ash } = table({ gettingLost: 'open' });
    withRules(campaign, gm);
    carry(campaign, { [wren]: 'Light', [ash]: 'Heavy' });
    const gmUser = await openScene(gm, true);
    await startTrip(gmUser);
    await gmUser.click(await screen.findByRole('button', { name: 'Mark lost' }));
    await waitFor(() => expect(world.tables.group_lost).toHaveLength(1));
    cleanup();

    const user = await openScene(sam, false, /^Trekking/);
    const lostCard = within(await screen.findByRole('group', { name: 'Lost' }));
    // A player cannot resolve it; only the roll is theirs.
    expect(lostCard.queryByRole('button', { name: 'Found the way' })).toBeNull();
    await user.type(lostCard.getByLabelText('Roll'), '4');
    await user.click(lostCard.getByRole('button', { name: 'Enter roll' }));
    await screen.findByText('Recovery roll: 4');
    await waitFor(() => expect(world.tables.group_lost[0]).toMatchObject({ roll: '4' }));
    expect(await lostCard.findByText('Rolled 4')).toBeTruthy();
    cleanup();

    await openScene(gm, true, /^The Mustering Field, /);
    expect(await within(await screen.findByRole('group', { name: 'Lost' })).findByText('Rolled 4')).toBeTruthy();
  });
});
