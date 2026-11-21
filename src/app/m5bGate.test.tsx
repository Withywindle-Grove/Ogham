// @vitest-environment jsdom
// The M5b gate's regression spine (build order 1 of docs/plans/m5b-5-gate.md): the gate's mock 3-day trek (08: weather,
// a lost check, a forage and a camp), clicked through the stand-in database at three devices (the GM's, Sam's and
// Jo's), in the play order of docs/testing.md "M5b — gate run, in play order" (checks 17–28 and 40). The rules are the
// invented fixture pack's Fen trek (scripts/fixtures/m5b-creation.fixture.json); every name is invented.
// Purpose: prove, in one run, that the pieces of M5b work together, and fail if any step's budget, place, statuses or
// log drift:
//   day 1: a player rolls the weather; Move… on the causeway (no lost check) with Undo; Cut reeds with a yield, its
//          Undo, and its Undo refused once the bundles burn; camp with the fire, cooking, eating, watches and an easy
//          sleep; Next day stops at the night check first (a quiet night), then applies the camp, and its Undo;
//   day 2: Move… leaving the causeway sets off Going astray on the card (its Hit, then Mark lost, unseen by players); a move beyond the
//          day's leagues ("Entering <place> · N more tomorrow"); a player's Force march (its rest due in camp's Sleep
//          step, SC-4-3 A); camp, then Next day's night check a hit → Which watch? → Encounter waiting (SC-5-1 B);
//   day 3: the arrival paid first, the forced march's rest applied, the Lost card's Found the way, End expedition
//          (the campaign stays in Adventure, dt-2), then Start downtime and End downtime (checks 45 and 51, M5b step 6a).
import { cleanup, configure, render, screen, waitFor, within } from '@testing-library/react';
import { typePlace } from '../testing/pickPlace.ts';
import { notWaiting, openDue, openWaiting } from '../testing/openWaiting.ts';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { forgetFileLinks } from '../core/files.ts';
import { createFakeDb, type FakeWorld } from '../testing/fakeDb.ts';
import { Root } from './App.tsx';
import { forgetCampaignSetting } from './campaignSetting.ts';
import { startExpedition } from '../testing/depart.ts';

vi.mock('./services.ts', async () => {
  const { createAppRegistry } = await import('./commandRegistry.ts');
  return { db: null, missingSettings: [], registry: createAppRegistry() };
});

// A long journey on a slower machine (CI): give each wait three seconds, not one.
configure({ asyncUtilTimeout: 3000 });

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
const HOUR = 3600;
const DAY = 24 * HOUR;
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

async function open(who: string, gm: boolean) {
  cleanup();
  world.signInAs(who);
  forgetCampaignSetting();
  const user = userEvent.setup();
  render(<Root db={world.db} />);
  await user.click(await screen.findByRole('button', { name: /The Long Fen Road/ }));
  if (!gm) await user.click(within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Scene' }));
  // The GM's band names the place (or the mode) and the count, or "No session yet" (st-1, st-2); players keep the strip's.
  await screen.findByRole('heading', { name: /^(Fen trek|Downtime|No session yet|.+, day \d+)/ });
  return user;
}

/** S2/S3 (page 16, T6b): Make camp and Encounter check are icon buttons in the band's Quick actions, not in ⋯. */
const quick = async (name: string) => within(await screen.findByRole('group', { name: 'Quick actions' })).getByRole('button', { name });
/** The toast saying `text` (the same words may also stand on a card). */
const toast = async (text: string | RegExp) =>
  (await waitFor(() => {
    const found = screen.getAllByText(text).map((el) => el.closest('.toast')).find(Boolean);
    if (!found) throw new Error(`No toast says ${String(text)}`);
    return found;
  })) as HTMLElement;
const undoOn = async (text: string | RegExp) => within(await toast(text)).getByRole('button', { name: 'Undo' });
const travelCard = async () => within(await screen.findByRole('region', { name: "The party's travel" }));
const recent = () => screen.getByRole('region', { name: 'Recently' }).textContent ?? '';
const live = (rows: Record<string, unknown>[]) => rows.filter((r) => r.undone !== true);
/** How many actions of a command were logged (one action's changes share a request id). */
const actions = (type: string) => new Set(world.tables.events.filter((e) => e.type === type && !e.reverts_event_id).map((e) => e.request_id)).size;

it('a 3-day trek: weather, a lost check, a forage and a camp, each step checked', async () => {
  // The table: Priya runs it; Sam plays Reed, Jo plays Moss. Both travel light (125 ft: 12 leagues a day).
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const jo = world.addPerson('jo@lantern.example', 'Jo');
  const campaign = world.addCampaign('The Long Fen Road', gm);
  const reed = world.addCharacter(campaign, 'Reed', { ownerId: sam });
  const moss = world.addCharacter(campaign, 'Moss', { ownerId: jo });
  world.addMember(campaign, sam, 'player', reed);
  world.addMember(campaign, jo, 'player', moss);
  world.tables.campaigns[0]!.settings = { encumbrance: { mode: 'coin' } };
  for (const actor of [reed, moss]) world.tables.carrier_loads.push({ actor_id: actor, campaign_id: campaign, tier: 'Light', load: 0, version: 1 });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-11-03T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  for (const [list, kind] of [['rulesSets', 'rulesSet'], ['items', 'item'], ['lightTypes', 'lightType'], ['tables', 'table']] as const) {
    for (const data of pack[list] ?? []) world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  }
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  // Reed carries an eel to cook; Moss carries dry rations.
  const item = (id: string) => pack.items!.find((i) => i.id === id)!;
  const carry = (lineId: string, actor: string, id: string, qty: number) =>
    world.tables.inventory_lines.push({
      id: lineId, campaign_id: campaign, actor_id: actor, location_id: null, name: String(item(id).name), category: String(item(id).category), qty, stack: Number(item(id).stack ?? 1),
      approval: 'approved', item_data: item(id), source_entry_id: id, container_line_id: null, version: 1,
    });
  carry('line-eel', reed, 'bog-eel', 1);
  carry('line-rations', moss, 'dry-rations', 2);
  const clock = () => Number(world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!.seconds);
  const travelRow = () => live(world.tables.travel_groups)[0]!;

  // ── Day 1 (gate run 17–26) ───────────────────────────────────────────────────────────────────────────────────────
  // 17. The GM starts a session and the expedition in the day-by-day mode; the travel card starts day 1 by itself.
  let user = await open(gm, true);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Started session 1');
  await startExpedition(user);
  await screen.findByRole('heading', { name: /^The Mustering Field, day 1/ });
  await waitFor(() => expect(travelRow()).toMatchObject({ day: 0, total: 12, spent: 0, forced: 0, pace: 'foot' }));
  expect(await (await travelCard()).findByRole('button', { name: /^Leagues 12 of 12/ })).toBeTruthy();

  // 18. Sam sees the weather due and enters it; everyone sees the card.
  user = await open(sam, false);
  const due = within(await screen.findByRole('region', { name: /weather/i }));
  await user.type(due.getByLabelText('Roll d6 for the weather'), '5');
  await user.click(due.getByRole('button', { name: 'Enter roll' }));
  await screen.findAllByText("Today's weather: Clear");
  expect(live(world.tables.weather_rolls)).toHaveLength(1);

  // 19. The GM moves on the causeway into the sedge, to Heron Rise: the causeway costs 1, and no lost check is set
  // off. Undo takes the move back; then the GM moves again.
  user = await open(gm, true);
  // The head's folded weather icon is the Weather fact in the facts row now (st-1).
  expect(await screen.findByRole('button', { name: /^Weather:\s*Clear/ })).toBeTruthy();
  const moveTo = async (choice: { route?: RegExp; terrain?: RegExp; place?: string; cost?: string }) => {
    await user.click((await travelCard()).getByRole('button', { name: 'Move…' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Move the party' }));
    // A chip already picked (the dialog starts from where the party is) isn't tapped again: a tap lets go of it.
    const pick = async (group: string, name: RegExp) => {
      const chip = within(dialog.getByRole('group', { name: group })).getByRole('button', { name });
      if (chip.getAttribute('aria-pressed') !== 'true') await user.click(chip);
    };
    if (choice.route) await pick('Route', choice.route);
    if (choice.terrain) await pick('Terrain', choice.terrain);
    if (choice.cost) await user.type(dialog.getByLabelText(/cost/), choice.cost);
    if (choice.place) await typePlace(user, choice.place, 'Place (optional)', dialog);
    return dialog;
  };
  let move = await moveTo({ route: /Causeway/, terrain: /Sedge meadow/, place: 'Heron Rise' });
  expect(move.getByText('Cost 1, 11 of 12 left after')).toBeTruthy();
  expect(move.queryByText(/Going astray \(/)).toBeNull();
  await user.click(move.getByRole('button', { name: 'Move' }));
  await user.click(await undoOn(/^Moved into Heron Rise, 1 / ));
  await waitFor(() => expect(travelRow()).toMatchObject({ spent: 0, terrain_id: null }));
  move = await moveTo({ route: /Causeway/, terrain: /Sedge meadow/, place: 'Heron Rise' });
  await user.click(move.getByRole('button', { name: 'Move' }));
  await toast(/^Moved into Heron Rise, 1 / );
  await waitFor(() => expect(travelRow()).toMatchObject({ spent: 1, terrain_id: 'sedge', route_id: 'causeway' }));
  expect(await (await travelCard()).findByRole('button', { name: /^Leagues 11 of 12/ })).toBeTruthy();
  expect(actions('travel.move')).toBe(2);
  // The log: the day's start and the move. (Gate findings, not asserted: the undone move reads "undid a change to
  // something", and the count reads "1 points".)
  await waitFor(() => expect(recent()).toMatch(/You started day 1 for the party: 12 points\./));
  await waitFor(() => expect(recent()).toMatch(/You moved the party into Heron Rise, 1 point/));

  // 20. Sam cuts reeds in the sedge (the pack allows it there): two leagues, and the bundles go into Reed's pack. Undo
  // takes them back and gives the leagues back; Sam cuts again.
  user = await open(sam, false);
  let card = await travelCard();
  expect(card.getByText('Around you: Sedge meadow')).toBeTruthy();
  const cutReeds = async () => {
    await user.click((await travelCard()).getByRole('button', { name: 'Cut reeds' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Cut reeds' }));
    await user.type(sheet.getByRole('textbox', { name: 'Rolled' }), '9');
    await user.click(sheet.getByRole('button', { name: 'It worked' }));
  };
  await cutReeds();
  await user.click(await undoOn(/^Cut reeds, 2 /));
  await waitFor(() => expect(travelRow()).toMatchObject({ spent: 1 }));
  expect(world.tables.inventory_lines.some((l) => l.name === 'Reed bundle')).toBe(false);
  await cutReeds();
  await toast(/^Cut reeds, 2 /);
  await waitFor(() => expect(travelRow()).toMatchObject({ spent: 3 }));
  const bundles = world.tables.inventory_lines.find((l) => l.name === 'Reed bundle')!;
  expect(bundles).toMatchObject({ actor_id: reed });
  card = await travelCard();
  expect(await card.findByRole('button', { name: /^Leagues 9 of 12/ })).toBeTruthy();
  // What we know (gate run 22): the place the GM named isn't shown yet, so nothing is shared.
  expect(await screen.findByRole('button', { name: 'What we know: Nothing shared yet' })).toBeTruthy();

  // 24. The GM makes camp from the time strip's ⋯; on the players' screens the Camp card takes the buttons' place.
  user = await open(gm, true);
  const timeMenu = async () => {
    await user.click(await screen.findByRole('button', { name: 'Time options' }));
    return within(document.querySelector('.more-menu__panel') as HTMLElement);
  };
  await user.click(await quick('Make camp'));
  await toast('Camp made');
  await waitFor(() => expect(recent()).toMatch(/Sam did Cut reeds \(Reed\), 2 points, \d Reed bundle → Reed's pack\./));
  await waitFor(() => expect(recent()).toMatch(/Sam undid an activity\./));
  await waitFor(() => expect(live(world.tables.camps)).toHaveLength(1));
  expect(live(world.tables.camps)[0]).toMatchObject({ day: 0, group_number: 1, applied_at: null });

  // Sam puts two bundles on the fire, cooks the eel (two portions) and Reed eats one from the pot.
  user = await open(sam, false);
  let camp = within(await screen.findByRole('region', { name: /^Camp/ }));
  expect(screen.queryByRole('button', { name: 'Cut reeds' })).toBeNull();
  await user.click(camp.getByRole('button', { name: 'Add firewood from packs' }));
  let sheet = within(await screen.findByRole('dialog', { name: 'Add firewood from packs' }));
  await user.click(await sheet.findByRole('button', { name: 'Put on the fire' }));
  await toast(/on the fire/);
  await waitFor(() => expect(live(world.tables.camp_entries).filter((e) => e.kind === 'fuel')).toHaveLength(1));
  await user.click(camp.getByRole('button', { name: 'Cook' }));
  sheet = within(await screen.findByRole('dialog', { name: 'Cook' }));
  await user.click(await sheet.findByRole('button', { name: 'More Bog eel to cook' }));
  await user.click(sheet.getByRole('button', { name: 'Cook' }));
  await waitFor(() => expect(live(world.tables.camp_entries).filter((e) => e.kind === 'cook')).toHaveLength(1));
  expect(world.tables.inventory_lines.some((l) => l.id === 'line-eel')).toBe(false);
  camp = within(await screen.findByRole('region', { name: /^Camp/ }));
  expect(await camp.findByText('The pot: 2 of 2 portions left')).toBeTruthy();
  await user.click(camp.getByRole('button', { name: 'Eat' }));
  sheet = within(await screen.findByRole('dialog', { name: 'What does Reed eat?' }));
  await user.click(await sheet.findByRole('button', { name: /^A portion from the pot/ }));
  expect(await camp.findByText('✓ Ate a portion')).toBeTruthy();

  // The reeds Sam cut are burning now: the activity's Undo is refused (yu-1).
  const run = live(world.tables.activity_runs)[0]!;
  world.signInAs(sam);
  const refused = await world.db.rpc('undo_activity', { run_id: String(run.id) });
  expect(refused.error?.message).toMatch(/changed since/);

  // 25. Watches: Sam puts Reed on the 1st; Jo eats the second portion and puts Moss on the 2nd. Sleep by the fire is
  // Easy: a good rest with no roll.
  // The Watches step by watch (fl-3): a watch's + Add lists who's free; one tap puts them on.
  const putOnWatch = async (name: string, watch: string) => {
    await user.click(camp.getByRole('button', { name: `Add to the ${watch} watch` }));
    await user.click(within(await screen.findByRole('dialog', { name: `Add to the ${watch} watch` })).getByRole('button', { name }));
  };
  // The Fen trek has no daylight table, so Split evenly asks how many watches (bq3-4 C): 2 characters, at most 2.
  const howMany = within(camp.getByRole('group', { name: 'How many watches tonight?' }));
  expect(howMany.getByText('2')).toBeTruthy();
  expect(camp.getByRole('button', { name: 'Split evenly' })).toBeTruthy();
  await putOnWatch('Reed', '1st');
  await waitFor(() => expect(live(world.tables.camp_entries).filter((e) => e.kind === 'watches')).toHaveLength(1));
  user = await open(jo, false);
  camp = within(await screen.findByRole('region', { name: /^Camp/ }));
  await user.click(camp.getByRole('button', { name: 'Eat' }));
  sheet = within(await screen.findByRole('dialog', { name: 'What does Moss eat?' }));
  await user.click(await sheet.findByRole('button', { name: /^A portion from the pot/ }));
  expect(await camp.findByText('✓ Ate a portion')).toBeTruthy();
  await putOnWatch('Moss', '2nd');
  await waitFor(() => expect(live(world.tables.camp_entries).filter((e) => e.kind === 'watches').at(-1)!.detail).toEqual([[reed], [moss]]));
  expect(camp.getByText(/Moss, Easy/)).toBeTruthy();
  expect(camp.queryByText('Rest due (forced march)')).toBeNull();

  // 26 (a quiet night). The GM's Next day stops first at the night check (SC-5-1, ruled B 2026-11-03): only Prowlers
  // goes on the card, the clock stays and the camp stays open; a miss. The next Next day moves the clock a day and
  // applies the camp with the move (its line on the card), without Prowlers again. The strip's Undo takes the day back
  // and the camp opens again; Next day then moves straight on (the night was answered).
  user = await open(gm, true);
  await user.click(await screen.findByRole('button', { name: 'Next day' }));
  await toast('The night check first, then Next day again');
  let dueNow = within(await screen.findByRole('region', { name: 'Due' }));
  expect(dueNow.queryByRole('button', { name: 'Miss, Going astray' })).toBeNull();
  expect(clock()).toBe(0);
  expect(live(world.tables.camps)[0]!.applied_at).toBeNull();
  await user.click(dueNow.getByRole('button', { name: 'Miss, Prowlers' }));
  await waitFor(() => expect(live(world.tables.check_results).map((r) => [r.name, r.outcome])).toEqual([['Prowlers', 'miss']]));
  await user.click(await screen.findByRole('button', { name: 'Next day' }));
  await screen.findByRole('heading', { name: /^The Mustering Field, day 2/ });
  await waitFor(() => expect(live(world.tables.camps)[0]!.applied_at).not.toBeNull());
  expect(clock()).toBe(DAY);
  // S8b: each line of the card is its own item of "Waiting for you": Prowlers is none of them (what "N more" holds
  // included), and the camp's line is opened to be read.
  expect(await notWaiting(user, /^Prowlers( ×\d+)?$/)).toBe(true);
  dueNow = await openDue(user, 'Camp, fire out, 1 bundle used');
  expect(dueNow.getByText('Camp, fire out, 1 bundle used')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^(Miss|Hit), Prowlers$/ })).toBeNull();
  // The strip has no Undo of its own (st-1): the last day's toast carries it.
  await user.click((await screen.findAllByRole('button', { name: 'Undo' })).at(-1)!);
  await screen.findByRole('heading', { name: /^The Mustering Field, day 1/ });
  await waitFor(() => expect(live(world.tables.camps)[0]!.applied_at).toBeNull());
  expect(clock()).toBe(0);
  await user.click(await screen.findByRole('button', { name: 'Next day' }));
  await screen.findByRole('heading', { name: /^The Mustering Field, day 2/ });
  await waitFor(() => expect(live(world.tables.camps)[0]!.applied_at).not.toBeNull());
  // S8b: Prowlers is not among what waits ("N more" included); the line is opened in "Waiting for you" to be answered.
  expect(await notWaiting(user, /^Prowlers( ×\d+)?$/)).toBe(true);
  dueNow = await openDue(user, 'Going astray');
  expect(screen.queryByRole('button', { name: /^(Miss|Hit), Prowlers$/ })).toBeNull();
  await user.click(dueNow.getByRole('button', { name: 'Miss, Going astray' }));
  await waitFor(() => expect(live(world.tables.check_results).map((r) => [r.name, r.outcome])).toEqual([['Prowlers', 'miss'], ['Going astray', 'miss']]));
  expect(live(world.tables.waiting_encounters)).toEqual([]);
  // The Camp card has left every screen; the day's row starts at 12 again.
  await waitFor(() => expect(screen.queryByRole('region', { name: /^Camp/ })).toBeNull());

  // ── Day 2 (gate run 27–28 and 23–26 again) ───────────────────────────────────────────────────────────────────────
  // 27. The GM leaves the causeway into the bog: the preview and the toast name the lost check it sets off.
  move = await moveTo({ route: /Wild/, terrain: /Bog/ });
  expect(move.getByText('Left the Causeway: Going astray (1–2 on d6)')).toBeTruthy();
  await user.click(move.getByRole('button', { name: 'Move' }));
  await toast('Moved into Bog (unnamed), 3 points, On the card: Going astray');
  await waitFor(() => expect(travelRow()).toMatchObject({ day: 1, spent: 3, terrain_id: 'bog', route_id: 'wild' }));
  // S8b: the move's check is its own item of "Waiting for you", opened to be answered.
  await user.click((await openDue(user, 'Going astray, Left the Causeway')).getByRole('button', { name: 'Hit, Going astray, Left the Causeway' }));
  await toast('Going astray, Left the Causeway: a hit');
  await waitFor(() => expect(live(world.tables.check_results).at(-1)).toMatchObject({ check_key: 'move:fen-astray', outcome: 'hit', secret: true }));
  // Its table opens (Gone astray, likely); the GM reads it at the table and closes it. A lost check queues no encounter.
  expect(await screen.findByRole('dialog', { name: 'Going astray, Left the Causeway, Hit' })).toBeTruthy();
  for (let i = 0; i < 3 && screen.queryByRole('dialog'); i++) await user.keyboard('{Escape}');
  expect(live(world.tables.waiting_encounters)).toEqual([]);
  // The hit means the party is lost: the GM's Mark lost (Getting lost is secret).
  await user.click((await travelCard()).getByRole('button', { name: 'Mark lost' }));
  await toast('The party is lost');
  expect(await screen.findByRole('group', { name: 'Lost' })).toBeTruthy();
  await waitFor(() => expect(live(world.tables.group_lost)).toHaveLength(1));
  expect(live(world.tables.group_lost)[0]).toMatchObject({ since_day: 1, found_day: null });

  // 28. A move beyond the day's leagues: 20 to reach Black Mere spends the 9 left and owes 11 tomorrow; the group
  // isn't there yet.
  move = await moveTo({ cost: '20', place: 'Black Mere' });
  expect(move.getByText('Entering Black Mere, 11 more tomorrow')).toBeTruthy();
  await user.click(move.getByRole('button', { name: 'Move' }));
  // The GM's name for the place is in the GM's part of the row (fm-1); the players' part has none until it's shown.
  await waitFor(() => expect(travelRow()).toMatchObject({ spent: 12, pending_owed: 11, pending_place_name: null }));
  expect(world.tables.travel_group_secrets.find((s) => s.id === travelRow().id)).toMatchObject({ pending_place_name: 'Black Mere' });
  expect(await (await travelCard()).findByText('Entering Black Mere, 11 more tomorrow')).toBeTruthy();
  expect(world.tables.places.some((p) => p.name === 'Black Mere')).toBe(false);

  // The players see nothing of Lost (hidden means hidden).
  user = await open(sam, false);
  await travelCard();
  expect(screen.queryByRole('group', { name: 'Lost' })).toBeNull();
  expect((await world.db.from('group_lost').select('*').eq('campaign_id', campaign)).data).toEqual([]);

  // 23. Jo forces the march: half again of 12 is 6 more, paid toward Black Mere (5 still owed); the rest falls due
  // this evening, with no prompt yet.
  user = await open(jo, false);
  await user.click((await travelCard()).getByRole('button', { name: 'Force march' }));
  await toast('Forced march, +6 points, rest due this evening');
  // Jo's log never says the party is lost.
  await waitFor(() => expect(recent()).not.toMatch(/lost/));
  await waitFor(() => expect(travelRow()).toMatchObject({ total: 18, forced: 1, pending_owed: 5 }));
  expect(screen.queryByRole('region', { name: 'Rest day' })).toBeNull();

  // 24–25. Camp again: the Sleep step and the rest prompt say the forced march's rest is due; both answer Rest. The
  // watches: Reed 1st, Moss 2nd.
  user = await open(gm, true);
  await user.click(await quick('Make camp'));
  await toast('Camp made');
  await waitFor(() => expect(recent()).toContain('Jo forced the march with the party: +6 points, rest due this evening.'));
  await waitFor(() => expect(recent()).toContain('You moved the party on: entering Black Mere, 11 more tomorrow.'));
  await waitFor(() => expect(recent()).toContain('You marked the party lost.'));
  await waitFor(() => expect(live(world.tables.camps).filter((c) => c.day === 1)).toHaveLength(1));
  for (const [who, name, watch] of [[sam, 'Reed', '1st'], [jo, 'Moss', '2nd']] as const) {
    user = await open(who, false);
    camp = within(await screen.findByRole('region', { name: /^Camp/ }));
    expect(await camp.findByText('Rest due (forced march)')).toBeTruthy();
    const prompt = within(await screen.findByRole('region', { name: 'Rest day' }));
    await user.click(prompt.getByRole('button', { name: 'Rest' }));
    await putOnWatch(name, watch);
    await waitFor(() => expect(live(world.tables.camp_entries).filter((e) => e.kind === 'watches' && e.created_by === who).length).toBeGreaterThan(0));
  }
  await waitFor(() => expect(world.tables.character_rests.filter((r) => r.chosen_at !== null)).toHaveLength(2));

  // 26. Next day stops first at the night check (SC-5-1, ruled B 2026-11-03): the camp is still open; a hit; the GM
  // reads the row, and its Encounter waiting card asks Which watch? with the watch order (2nd: Moss was awake).
  user = await open(gm, true);
  await user.click(await screen.findByRole('button', { name: 'Next day' }));
  await toast('The night check first, then Next day again');
  expect(live(world.tables.camps).find((c) => c.day === 1)!.applied_at).toBeNull();
  const readRow = async (name: string, key: string) => {
    const pick = within(await screen.findByRole('dialog', { name: /^Prowlers.*, Hit$/ }));
    await user.click(pick.getByRole('button', { name: /^Fen prowlers/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Fen prowlers' })).getByRole('button', { name: /Bog lurkers/ }));
    await waitFor(() => expect(live(world.tables.check_results).at(-1)).toMatchObject({ name, check_key: key, outcome: 'hit', row_text: 'Fen prowlers: Bog lurkers (1d4)' }));
    // Escape closes the tables (the same before and after the full screen's ✕, PR #326).
    for (let i = 0; i < 3 && screen.queryByRole('dialog'); i++) await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  };
  // S8b: the night's check is opened in "Waiting for you"; after the hit, the hit is open first, and the encounter it
  // queued is opened from its row; "Who is awake…" (T2) opens its watches.
  await user.click((await openDue(user, 'Prowlers')).getByRole('button', { name: 'Hit, Prowlers' }));
  await readRow('Prowlers', 'check:mode:fen-prowl');
  await openWaiting(user, 'Fen prowlers: Bog lurkers (1d4)');
  const waiting = within(await screen.findByRole('region', { name: 'Encounter waiting, Prowlers, Fen prowlers: Bog lurkers (1d4)' }));
  await user.click(waiting.getByRole('button', { name: 'Who is awake…' }));
  expect(within(screen.getByRole('group', { name: 'Which watch?' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['1st: Reed', '2nd: Moss']);
  const which = within(screen.getByRole('group', { name: 'Which watch?' }));
  await user.click(which.getByRole('button', { name: '2nd: Moss' }));
  await toast('Awake: 2nd watch: Moss');
  expect(await waiting.findByText('Awake: 2nd watch: Moss')).toBeTruthy();
  expect(live(world.tables.waiting_encounters)).toHaveLength(1);
  // Saved in its old form (" · " kept, #561); shown "2nd watch: Moss".
  expect(live(world.tables.waiting_encounters)[0]).toMatchObject({ state: 'waiting', watch: '2nd watch · Moss' });
  // While the camp is still up, the GM's own Encounter check (the band's icon) in the night: its hit asks Which watch? too (departure 3).
  await user.click(await quick('Encounter check'));
  await user.click((await openDue(user, 'Prowlers, now')).getByRole('button', { name: 'Hit, Prowlers, now' }));
  await readRow('Prowlers, now', 'now:check:mode:fen-prowl');
  // The newer encounter first among the encounters (newest first), opened from its row; its watches asked the same way.
  // Both are named by their row; the older one is still open, so the newer one is the row of that name.
  await user.click(within(screen.getByRole('region', { name: 'Waiting for you' })).getByRole('button', { name: 'Open: Fen prowlers: Bog lurkers (1d4)' }));
  const nowCard = within(await screen.findByRole('region', { name: 'Encounter waiting, Prowlers, now, Fen prowlers: Bog lurkers (1d4)' }));
  await user.click(nowCard.getByRole('button', { name: 'Who is awake…' }));
  await user.click(within(screen.getByRole('group', { name: 'Which watch?' })).getByRole('button', { name: '1st: Reed' }));
  await toast('Awake: 1st watch: Reed');
  await waitFor(() => expect(live(world.tables.waiting_encounters).map((w) => w.watch)).toEqual(['2nd watch · Moss', '1st watch · Reed']));
  // A player never receives it.
  world.signInAs(sam);
  expect((await world.db.from('waiting_encounters').select('*').eq('campaign_id', campaign)).data ?? []).toEqual([]);

  // Next day again applies the camp and the forced march's rest (both rested); the camp's line names who didn't eat;
  // Prowlers doesn't come due twice.
  user = await open(gm, true);
  await user.click(await screen.findByRole('button', { name: 'Next day' }));
  await screen.findByRole('heading', { name: /^The Mustering Field, day 3/ });
  await toast('Day 3, Leagues 12, the party arrived at Black Mere');
  // S8b: each line is its own item of "Waiting for you", opened to be read; Prowlers is not among them, what "N more"
  // holds included.
  expect(await notWaiting(user, /^Prowlers( ×\d+)?$/)).toBe(true);
  dueNow = await openDue(user, 'Rest, rested: Moss, Reed');
  expect(screen.queryByRole('button', { name: /^(Miss|Hit), Prowlers$/ })).toBeNull();
  expect(dueNow.getByText('Rest, rested: Moss, Reed')).toBeTruthy();
  expect((await openDue(user, "Camp, didn't eat: Moss, Reed")).getByText("Camp, didn't eat: Moss, Reed")).toBeTruthy();
  await waitFor(() => expect(live(world.tables.camps).every((c) => c.applied_at !== null)).toBe(true));
  expect(world.tables.character_rests.filter((r) => r.rested_at !== null).map((r) => r.actor_id).sort()).toEqual([reed, moss].sort());
  await user.click((await openDue(user, 'Going astray')).getByRole('button', { name: 'Miss, Going astray' }));

  // ── Day 3 (gate run 27 and 40) ───────────────────────────────────────────────────────────────────────────────────
  // The day starts by paying what's owed first: the party arrives at Black Mere (5 of today's 12); its toast came
  // with Next day (the strip reloads the rest of Scene at once since gate-bugs-7), before the Miss.
  await waitFor(() => expect(travelRow()).toMatchObject({ day: 2, total: 12, spent: 5, forced: 0, pending_owed: null }));
  expect(world.tables.places.some((p) => p.name === 'Black Mere')).toBe(true);
  // The Lost card: the GM's Found the way ends it.
  const lostCard = within(await screen.findByRole('group', { name: 'Lost' }));
  await user.click(lostCard.getByRole('button', { name: 'Found the way' }));
  await toast('The party found the way');
  await waitFor(() => expect(live(world.tables.group_lost)[0]!.found_day).toBe(2));
  await waitFor(() => expect(screen.queryByRole('group', { name: 'Lost' })).toBeNull());
  await waitFor(() => expect(recent()).toContain('Rest, rested: everyone, next rest due day 8'));
  await waitFor(() => expect(recent()).toContain('You rolled 1–3 for a hit: Fen prowlers: Bog lurkers (1d4).'));

  // 40. End expedition: the summary; the waiting encounter no longer shows.
  await user.click((await timeMenu()).getByRole('button', { name: 'End expedition' }));
  expect(await screen.findByText('Expedition ended')).toBeTruthy();
  expect(world.tables.expeditions[0]!.ended_at).toBe(clock());
  expect(screen.queryByRole('region', { name: /^Encounter waiting/ })).toBeNull();
  // 45 (M5b step 6a, dt-2): the campaign stays in Adventure, no expedition running.
  expect(world.tables.campaigns[0]!.mode).toBe('adventure');

  // 51. Start downtime: a full rest, then Downtime; End downtime: back to Adventure.
  await user.click((await timeMenu()).getByRole('button', { name: /Start downtime/ }));
  expect(await screen.findByText('Downtime began')).toBeTruthy();
  await waitFor(() => expect(world.tables.campaigns[0]!.mode).toBe('downtime'));
  await user.click((await timeMenu()).getByRole('button', { name: /End downtime/ }));
  expect(await screen.findByText('Downtime ended, back to adventure time')).toBeTruthy();
  expect(world.tables.campaigns[0]!.mode).toBe('adventure');
}, 120000);

// Purpose (gate walk, the night encounter, 2026-11-10): while the party travels, an encounter check by terrain
// (Encounter check from ⋯) shows the odds of the ground the party is on, as the Move sheet does, not the check's own
// fallback odds; before any move (no ground yet) it keeps the check's own odds, as before. Prowlers: its own 1 on d6;
// the Bog's wander chance 1–2 on d6.
it("an encounter check by terrain shows the odds of the party's ground", async () => {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Long Fen Road', gm);
  const reed = world.addCharacter(campaign, 'Reed', { ownerId: sam });
  world.addMember(campaign, sam, 'player', reed);
  world.tables.campaigns[0]!.settings = { encumbrance: { mode: 'coin' } };
  world.tables.carrier_loads.push({ actor_id: reed, campaign_id: campaign, tier: 'Light', load: 0, version: 1 });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-11-03T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  for (const [list, kind] of [['rulesSets', 'rulesSet'], ['items', 'item'], ['lightTypes', 'lightType'], ['tables', 'table']] as const) {
    for (const data of pack[list] ?? []) world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  }
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const user = await open(gm, true);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Started session 1');
  await startExpedition(user);
  await screen.findByRole('heading', { name: /^The Mustering Field, day 1/ });
  await waitFor(() => expect(live(world.tables.travel_groups)).toHaveLength(1));
  const encounterCheck = async () => {
    await user.click(await quick('Encounter check'));
    return within(await screen.findByRole('region', { name: 'Due' }));
  };
  // No ground yet: the check's own odds.
  let due = await encounterCheck();
  expect(due.getByText('Roll 1d6, on 1')).toBeTruthy();
  await user.click(due.getByRole('button', { name: 'Miss, Prowlers, now' }));
  await waitFor(() => expect(live(world.tables.check_results)).toHaveLength(1));
  // Into the Bog, off the causeway.
  await user.click(within(await screen.findByRole('region', { name: "The party's travel" })).getByRole('button', { name: 'Move…' }));
  const move = within(await screen.findByRole('dialog', { name: 'Move the party' }));
  for (const [group, name] of [['Route', /Wild/], ['Terrain', /Bog/]] as const) {
    const chip = within(move.getByRole('group', { name: group })).getByRole('button', { name });
    if (chip.getAttribute('aria-pressed') !== 'true') await user.click(chip);
  }
  await user.click(move.getByRole('button', { name: 'Move' }));
  await waitFor(() => expect(live(world.tables.travel_groups)[0]).toMatchObject({ terrain_id: 'bog', route_id: 'wild' }));
  // The Bog's odds now, on the same screen (no reload).
  due = await encounterCheck();
  expect(await due.findByText('Roll 1d6, on 1–2')).toBeTruthy();
}, 60000);

// Purpose (gate walk, the night encounter, 2026-11-10): a camp's night check the GM already answered with Encounter
// check (⋯), recorded under a "now:" key, isn't asked again: Next day moves straight on to the next day instead of
// stopping at the night check.
it('a night check answered with Encounter check is not due again at Next day', async () => {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Long Fen Road', gm);
  world.addMember(campaign, sam, 'player', world.addCharacter(campaign, 'Reed', { ownerId: sam }));
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-11-03T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  for (const [list, kind] of [['rulesSets', 'rulesSet'], ['items', 'item'], ['lightTypes', 'lightType'], ['tables', 'table']] as const) {
    for (const data of pack[list] ?? []) world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  }
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const user = await open(gm, true);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Started session 1');
  await startExpedition(user);
  await screen.findByRole('heading', { name: /^The Mustering Field, day 1/ });
  await user.click(await quick('Make camp'));
  await waitFor(() => expect(live(world.tables.camps)).toHaveLength(1));
  await user.click(await quick('Encounter check'));
  await user.click(within(await screen.findByRole('region', { name: 'Due' })).getByRole('button', { name: 'Miss, Prowlers, now' }));
  await waitFor(() => expect(live(world.tables.check_results).map((r) => [r.check_key, r.outcome])).toEqual([['now:check:mode:fen-prowl', 'miss']]));
  await user.click(await screen.findByRole('button', { name: 'Next day' }));
  await screen.findByRole('heading', { name: /^The Mustering Field, day 2/ });
  expect(screen.queryByText('The night check first, then Next day again')).toBeNull();
}, 60000);

// Purpose (#619 review): an Encounter check rolled at midday, before the camp was made, isn't the night's: Next day
// still stops at the camp's night check.
it("a midday Encounter check doesn't answer the night check", async () => {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Long Fen Road', gm);
  world.addMember(campaign, sam, 'player', world.addCharacter(campaign, 'Reed', { ownerId: sam }));
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-11-03T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  for (const [list, kind] of [['rulesSets', 'rulesSet'], ['items', 'item'], ['lightTypes', 'lightType'], ['tables', 'table']] as const) {
    for (const data of pack[list] ?? []) world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  }
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const user = await open(gm, true);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Started session 1');
  await startExpedition(user);
  await screen.findByRole('heading', { name: /^The Mustering Field, day 1/ });
  await user.click(await quick('Encounter check'));
  await user.click(within(await screen.findByRole('region', { name: 'Due' })).getByRole('button', { name: 'Miss, Prowlers, now' }));
  await waitFor(() => expect(live(world.tables.check_results)).toHaveLength(1));
  await user.click(await quick('Make camp'));
  await waitFor(() => expect(live(world.tables.camps)).toHaveLength(1));
  await user.click(await screen.findByRole('button', { name: 'Next day' }));
  await toast('The night check first, then Next day again');
  expect(within(await screen.findByRole('region', { name: 'Due' })).getByRole('button', { name: 'Miss, Prowlers' })).toBeTruthy();
}, 60000);

// Purpose (#619 review): the time strip follows the party's ground both ways. After a move into a terrain with its own
// encounter table, a hit offers that table in Which table?; after a move's Undo, the checks go back to the ground the
// party is on again, on the same screen (no reload). Prowlers: the Bog's 1–2 on d6 (here with the Reed folk table),
// the Sedge's 1 on d6.
it("the time strip follows a move's Undo, and a hit offers the terrain's table", async () => {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Long Fen Road', gm);
  const reed = world.addCharacter(campaign, 'Reed', { ownerId: sam });
  world.addMember(campaign, sam, 'player', reed);
  world.tables.campaigns[0]!.settings = { encumbrance: { mode: 'coin' } };
  world.tables.carrier_loads.push({ actor_id: reed, campaign_id: campaign, tier: 'Light', load: 0, version: 1 });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-11-03T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  // This test's Bog names its own encounter table (Reed folk).
  const fen = structuredClone(pack) as { rulesSets: { exploration?: { modes?: { terrain?: { id: string; encounterTableId?: string }[] }[] } }[] } & Record<string, Record<string, unknown>[]>;
  for (const rs of fen.rulesSets) for (const m of rs.exploration?.modes ?? []) for (const t of m.terrain ?? []) if (t.id === 'bog') t.encounterTableId = 'reed-folk';
  for (const [list, kind] of [['rulesSets', 'rulesSet'], ['items', 'item'], ['lightTypes', 'lightType'], ['tables', 'table']] as const) {
    for (const data of (fen[list] ?? []) as Record<string, unknown>[]) world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  }
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const user = await open(gm, true);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Started session 1');
  await startExpedition(user);
  await screen.findByRole('heading', { name: /^The Mustering Field, day 1/ });
  await waitFor(() => expect(live(world.tables.travel_groups)).toHaveLength(1));
  const encounterCheck = async () => {
    await user.click(await quick('Encounter check'));
    // S8b: the check's line is an item of "Waiting for you"; after a hit, the hit is open first, so the line is opened.
    return openDue(user, /^Prowlers, now( ×\d+)?$/);
  };
  const moveTo = async (terrain: RegExp) => {
    await user.click(await within(await screen.findByRole('region', { name: "The party's travel" })).findByRole('button', { name: 'Move…' }));
    const move = within(await screen.findByRole('dialog', { name: 'Move the party' }));
    for (const [group, name] of [['Route', /Wild/], ['Terrain', terrain]] as const) {
      const chip = within(move.getByRole('group', { name: group })).getByRole('button', { name });
      if (chip.getAttribute('aria-pressed') !== 'true') await user.click(chip);
    }
    await user.click(move.getByRole('button', { name: 'Move' }));
  };
  // Into the Bog: the Bog's odds; a hit offers the Bog's own table.
  await moveTo(/Bog/);
  await waitFor(() => expect(live(world.tables.travel_groups)[0]).toMatchObject({ terrain_id: 'bog', route_id: 'wild' }));
  let due = await encounterCheck();
  expect(await due.findByText('Roll 1d6, on 1–2')).toBeTruthy();
  await user.click(due.getByRole('button', { name: 'Hit, Prowlers, now' }));
  const pick = within(await screen.findByRole('dialog', { name: /^Prowlers.*, Hit$/ }));
  expect(pick.getByRole('button', { name: /^Reed folk/ })).toBeTruthy();
  for (let i = 0; i < 3 && screen.queryByRole('dialog'); i++) await user.keyboard('{Escape}');
  // A move on into the Sedge, then its Undo: back in the Bog, and the Bog's odds again, without a reload.
  await moveTo(/Sedge meadow/);
  await waitFor(() => expect(live(world.tables.travel_groups)[0]).toMatchObject({ terrain_id: 'sedge' }));
  await user.click(await undoOn(/^Moved into Sedge meadow/));
  await waitFor(() => expect(live(world.tables.travel_groups)[0]).toMatchObject({ terrain_id: 'bog' }));
  await waitFor(() => expect(recent()).toMatch(/undid/));
  due = await encounterCheck();
  expect(await due.findByText('Roll 1d6, on 1–2')).toBeTruthy();
}, 60000);

// Purpose (F86, gate walk 2026-11-11): when the GM taps Next day away from Scene (the compact strip on another screen,
// so no travel card is up to start the day), the new day's travel record still starts with the clock, so a player's
// forced march that day lands on that day's record and its rest falls due at that evening's camp.
// The cause: Next day didn't start the day's travel row (the GM's travel card did, lazily), so the march landed on
// yesterday's row while camp was today's.
it("a forced march on a day the GM started away from Scene still makes the forced march's rest due at camp", async () => {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const jo = world.addPerson('jo@lantern.example', 'Jo');
  const campaign = world.addCampaign('The Long Fen Road', gm);
  const reed = world.addCharacter(campaign, 'Reed', { ownerId: sam });
  const moss = world.addCharacter(campaign, 'Moss', { ownerId: jo });
  world.addMember(campaign, sam, 'player', reed);
  world.addMember(campaign, jo, 'player', moss);
  world.tables.campaigns[0]!.settings = { encumbrance: { mode: 'coin' } };
  for (const actor of [reed, moss]) world.tables.carrier_loads.push({ actor_id: actor, campaign_id: campaign, tier: 'Light', load: 0, version: 1 });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-11-03T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  for (const [list, kind] of [['rulesSets', 'rulesSet'], ['items', 'item'], ['lightTypes', 'lightType'], ['tables', 'table']] as const) {
    for (const data of pack[list] ?? []) world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  }
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const clockRow = () => world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!;
  const row = () => live(world.tables.travel_groups)[0]!;

  let user = await open(gm, true);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Started session 1');
  await startExpedition(user);
  await screen.findByRole('heading', { name: /^The Mustering Field, day 1/ });
  await waitFor(() => expect(row()).toMatchObject({ day: 0, total: 12, spent: 0, forced: 0 }));
  // Day 1: a move beyond the day's points owes 11 tomorrow.
  await user.click(await (await travelCard()).findByRole('button', { name: 'Move…' }));
  const dialog = within(await screen.findByRole('dialog', { name: 'Move the party' }));
  await user.type(dialog.getByLabelText(/cost/), '23');
  await typePlace(user, 'Black Mere', 'Place (optional)', dialog);
  expect(dialog.getByText('Entering Black Mere, 11 more tomorrow')).toBeTruthy();
  await user.click(dialog.getByRole('button', { name: 'Move' }));
  await waitFor(() => expect(row()).toMatchObject({ day: 0, spent: 12, pending_owed: 11 }));

  // The GM goes to Players and taps Next day on the compact strip there: no travel card is on that screen.
  await user.click(within(screen.getByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  await waitFor(() => expect(screen.queryByRole('region', { name: "The party's travel" })).toBeNull());
  await user.click(await within(await screen.findByRole('region', { name: 'Time' })).findByRole('button', { name: 'Next day' }));
  await waitFor(() => expect(Number(clockRow().seconds)).toBe(DAY));

  // Jo forces the march on day 2: it lands on day 2's record (yesterday's shortfall already paid by the morning).
  user = await open(jo, false);
  await user.click(await (await travelCard()).findByRole('button', { name: 'Force march' }));
  await waitFor(() => expect(Number(row().forced)).toBeGreaterThan(0));
  expect(row()).toMatchObject({ day: 1, forced: 1, pending_owed: null });

  // The GM makes camp that evening.
  user = await open(gm, true);
  await user.click(await quick('Make camp'));
  await waitFor(() => expect(live(world.tables.camps)).toHaveLength(1));
  expect(live(world.tables.camps)[0]).toMatchObject({ day: 1 });

  // The players see the forced march's rest due.
  await open(jo, false);
  expect((await screen.findAllByText('Rest due (forced march)')).length).toBeGreaterThan(0);
  expect(await screen.findByRole('region', { name: 'Rest day' })).toBeTruthy();
}, 60000);

// Purpose (F87, gate walk 2026-11-11): after the GM taps Next day away from Scene (the compact strip on another
// screen), a player's travel card shows the new day and its points, though no GM travel card started the day (the
// same lag as F86, seen from the players' side). The cause: the day's travel row stayed on yesterday.
it("after Next day tapped away from Scene, a player's travel card shows the new day's points", async () => {
  const gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  const campaign = world.addCampaign('The Long Fen Road', gm);
  const reed = world.addCharacter(campaign, 'Reed', { ownerId: sam });
  world.addMember(campaign, sam, 'player', reed);
  world.tables.campaigns[0]!.settings = { encumbrance: { mode: 'coin' } };
  world.tables.carrier_loads.push({ actor_id: reed, campaign_id: campaign, tier: 'Light', load: 0, version: 1 });
  world.tables.packs.push({ id: 'pack-fen', owner_user_id: gm, campaign_id: null, name: 'Fen sample', version: '0.1', kind: 'setting', format_version: 2, source: '', notes: '', updated_at: '2026-11-03T12:00:00Z', extra_meta: { shortName: 'Fen sample' } });
  for (const [list, kind] of [['rulesSets', 'rulesSet'], ['items', 'item'], ['lightTypes', 'lightType'], ['tables', 'table']] as const) {
    for (const data of pack[list] ?? []) world.tables.library_entries.push({ id: `entry-${kind}-${String(data.id)}`, pack_id: 'pack-fen', kind, pack_entry_id: String(data.id), name: String(data.name ?? data.id), data });
  }
  world.tables.campaign_packs.push({ id: 'link-fen', campaign_id: campaign, pack_id: 'pack-fen', pack_name: 'Fen sample', option_choices: {}, overrides: {}, priority: 1 });
  const clockRow = () => world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!;
  const row = () => live(world.tables.travel_groups)[0]!;

  const user = await open(gm, true);
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await screen.findByText('Started session 1');
  await startExpedition(user);
  await screen.findByRole('heading', { name: /^The Mustering Field, day 1/ });
  await waitFor(() => expect(row()).toMatchObject({ day: 0, total: 12, spent: 0 }));
  // Day 1: a move of 5.
  await user.click(await (await travelCard()).findByRole('button', { name: 'Move…' }));
  const dialog = within(await screen.findByRole('dialog', { name: 'Move the party' }));
  await user.type(dialog.getByLabelText(/cost/), '5');
  await user.click(dialog.getByRole('button', { name: 'Move' }));
  await waitFor(() => expect(row()).toMatchObject({ day: 0, spent: 5 }));

  // The GM goes to Players and taps Next day on the compact strip there: no travel card is on that screen.
  await user.click(within(screen.getByRole('navigation', { name: 'Campaign sections' })).getByRole('button', { name: /^Players/ }));
  await waitFor(() => expect(screen.queryByRole('region', { name: "The party's travel" })).toBeNull());
  await user.click(await within(await screen.findByRole('region', { name: 'Time' })).findByRole('button', { name: 'Next day' }));
  await waitFor(() => expect(Number(clockRow().seconds)).toBe(DAY));

  // Sam's Scene: the record is on the clock's day, and the card says the new day's points.
  await open(sam, false);
  expect(row()).toMatchObject({ day: 1, total: 12, spent: 0 });
  expect(await (await travelCard()).findByRole('button', { name: /^Leagues 12 of 12/ })).toBeTruthy();
}, 60000);
