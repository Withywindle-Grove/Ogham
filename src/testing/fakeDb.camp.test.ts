// The stand-in database's activity and camp functions (M5b steps 3 and 4), called directly the way the app's commands
// call them. They must give what supabase/migrations/…_m5b_3_*.sql and …_m5b_4_*.sql give, so the journey tests that
// click through the app stand on the same ground. Invented rules only.
import { beforeEach, describe, expect, it } from 'vitest';
import { encodeEventTag } from '../core/eventTags.ts';
import { createFakeDb, type FakeWorld } from './fakeDb.ts';

let world: FakeWorld;
let gm: string;
let sam: string;
let campaign: string;
let wren: string;
let moss: string;

type Row = Record<string, unknown>;

/** One command's request: a tag with its own request id (or the one given, to share a request). */
const send = async (name: string, args: Row, type: string, requestId: string = crypto.randomUUID()) => {
  const tag = encodeEventTag({ type, level: 'simple', requestId });
  return (await world.db.rpc(name as never, args as never).setHeader('x-grimoire-command', tag)) as unknown as { data: Row | Row[] | null; error: { message: string; code?: string } | null };
};
const data = (result: { data: Row | Row[] | null }) => result.data as Row;
const lineOf = (name: string) => world.tables.inventory_lines.find((l) => l.name === name);
const undoOf = async (type: string) => {
  const event = world.tables.events.filter((e) => e.type === type).sort((a, b) => Number(b.seq) - Number(a.seq))[0]!;
  return send('undo_request', { event_id: event.id }, 'event.undo');
};

beforeEach(() => {
  world = createFakeDb();
  gm = world.addPerson('priya@lantern.example', 'Priya');
  sam = world.addPerson('sam@lantern.example', 'Sam');
  campaign = world.addCampaign('The Ash Barrows', gm);
  wren = world.addCharacter(campaign, 'Wren', { ownerId: sam });
  moss = world.addCharacter(campaign, 'Moss', { ownerId: sam });
  world.addMember(campaign, sam, 'player', wren);
  const pack = { pack_id: 'pack-fen', kind: 'item' };
  world.tables.library_entries.push({ id: 'entry-lichen', ...pack, pack_entry_id: 'lichen', name: 'Pale lichen', data: { category: 'forage' } });
  const line = (name: string, qty: number, extra: Row = {}) =>
    world.tables.inventory_lines.push({ id: `line-${name}`, campaign_id: campaign, actor_id: wren, location_id: null, name, qty, approval: 'approved', container_line_id: null, item_data: {}, source_entry_id: null, version: 1, ...extra });
  line('Firewood', 3, { source_entry_id: 'firewood' });
  line('Marsh herbs', 2);
  line('Hard biscuit', 2, { item_data: { food: 'preserved' } });
});

/** The GM starts a trek and the day's travel row (budget 12). */
const trekking = async () => {
  world.signInAs(gm);
  await send('start_expedition', { campaign, mode_id: 'trek' }, 'expedition.start');
  await send('start_travel_day', { campaign, group_no: 1, day: 0, total: 12, pace: 'foot', gm_per_day: null }, 'travel.dayStart');
};
const travel = () => world.tables.travel_groups[0]!;

const forage = (extra: Row = {}) => ({
  campaign, group_no: 1, activity_id: 'forage', activity_name: 'Forage', actors: [wren], finder: wren, rolls: [{ actorId: wren, roll: 4 }], outcome: 'worked', spend: 4,
  yield_entry: 'entry-lichen', yield_name: 'Pale lichen', yield_category: 'forage', yield_weight: 1, yield_slots: null, yield_stack: 5, yield_qty: 3, ...extra,
});

const campFire = async () => {
  const made = data(await send('open_camp', { campaign, group_no: 1, day: 0, quick: false, fire_type_id: 'fire', fire_name: 'Campfire', fuel_item: 'firewood' }, 'camp.open'));
  return String(made.id);
};

describe('activities (M5b step 3)', () => {
  // Purpose: doing an activity spends its points off today's budget and puts the yield in the finder's pack as one found line.
  it('apply makes the yield line and spends the points', async () => {
    await trekking();
    const run = data(await send('apply_activity', forage(), 'activity.apply'));
    expect(run).toMatchObject({ spent: 4, yield_qty: 3, yield_name: 'Pale lichen', outcome: 'worked', undone: false });
    expect(travel().spent).toBe(4);
    expect(lineOf('Pale lichen')).toMatchObject({ actor_id: wren, qty: 3, how_got: 'found', source_entry_id: 'lichen' });
    // One request: the run, the budget and the line are all in it.
    const tables = world.tables.events.filter((e) => e.type === 'activity.apply').map((e) => e.target_table);
    expect(tables.sort()).toEqual(['activity_runs', 'inventory_lines', 'travel_groups']);
  });

  // Purpose: Undo takes the yield out and gives the points back, and the run is marked undone, never removed.
  it('undo puts the points and the yield back', async () => {
    await trekking();
    const run = data(await send('apply_activity', forage(), 'activity.apply'));
    expect((await send('undo_activity', { run_id: run.id }, 'activity.undo')).error).toBeNull();
    expect(travel().spent).toBe(0);
    expect(lineOf('Pale lichen')).toBeUndefined();
    expect(world.tables.activity_runs[0]!.undone).toBe(true);
    expect(world.tables.events.filter((e) => e.type === 'activity.undo').every((e) => e.reverts_event_id)).toBe(true);
    expect((await send('undo_activity', { run_id: run.id }, 'activity.undo')).error?.message).toBe('That was already undone.');
  });

  // Purpose: once the yield has been used, the undo is refused, in the database's words, and nothing changes.
  it('undo is refused once the yield was used', async () => {
    await trekking();
    const run = data(await send('apply_activity', forage(), 'activity.apply'));
    lineOf('Pale lichen')!.qty = 2;
    const refused = await send('undo_activity', { run_id: run.id }, 'activity.undo');
    expect(refused.error?.message).toBe("That's changed since: the Pale lichen was used or moved. Undo the later change first.");
    expect(travel().spent).toBe(4);
    expect(world.tables.activity_runs[0]!.undone).toBe(false);
  });
});

describe('camp (M5b step 4)', () => {
  // Purpose: making camp twice for the same evening gives one camp; a player of the group may, an outsider may not.
  it('opens one camp per evening for the group', async () => {
    await trekking();
    const first = await campFire();
    expect(await campFire()).toBe(first);
    expect(world.tables.camps).toHaveLength(1);
    const stranger = world.addPerson('ola@lantern.example', 'Ola');
    world.addMember(campaign, stranger, 'player');
    world.signInAs(stranger);
    expect((await send('open_camp', { campaign, group_no: 1, day: 1 }, 'camp.open')).error?.code).toBe('42501');
    world.signInAs(sam);
    expect((await send('open_camp', { campaign, group_no: 1, day: 1 }, 'camp.open')).error).toBeNull();
  });

  // Purpose: firewood put on the fire is used up (the line goes with the last), the burn time is recorded, and Undo brings the line back.
  it('fuel uses the line up and undo puts it back', async () => {
    await trekking();
    const camp = await campFire();
    const entry = data(await send('add_camp_fuel', { camp, actor: wren, line: 'line-Firewood', qty: 3, seconds_each: 3600 }, 'camp.fuel'));
    expect(entry).toMatchObject({ kind: 'fuel', qty: 3, seconds: 10800 });
    expect(lineOf('Firewood')).toBeUndefined();
    expect((await undoOf('camp.fuel')).error).toBeNull();
    expect(lineOf('Firewood')?.qty).toBe(3);
    expect(world.tables.camp_entries[0]!.undone).toBe(true);
    // Something that isn't the camp's firewood is refused.
    expect((await send('add_camp_fuel', { camp, actor: wren, line: 'line-Marsh herbs', qty: 1, seconds_each: 60 }, 'camp.fuel')).error?.message).toBe("That isn't firewood.");
  });

  // Purpose: cooking turns the ingredients into portions in the pot, and one meal each may be taken from it.
  it('cook makes portions, the pot feeds each person once, and a second meal is refused', async () => {
    await trekking();
    const camp = await campFire();
    const cooked = data(await send('cook_at_camp', { camp, cook: wren, ingredients: [{ line: 'line-Marsh herbs', qty: 2 }], portions: 1 }, 'camp.cook'));
    expect(cooked).toMatchObject({ kind: 'cook', qty: 1, detail: [{ name: 'Marsh herbs', qty: 2 }] });
    expect(lineOf('Marsh herbs')).toBeUndefined();
    expect(data(await send('eat_at_camp', { camp, actor: wren, from_pot: true }, 'camp.eat'))).toMatchObject({ kind: 'meal', from_pot: true, food_kind: 'cooked' });
    expect((await send('eat_at_camp', { camp, actor: wren, from_pot: true }, 'camp.eat')).error?.message).toBe('They have eaten already.');
    expect((await send('eat_at_camp', { camp, actor: moss, from_pot: true }, 'camp.eat')).error?.message).toBe('The pot is empty.');
  });

  // Purpose: eating from your own pack uses one of the line up, and nobody may eat from another's pack.
  it('eating from a pack takes one off the line', async () => {
    await trekking();
    const camp = await campFire();
    const meal = data(await send('eat_at_camp', { camp, actor: wren, from_pot: false, line: 'line-Hard biscuit' }, 'camp.eat'));
    expect(meal).toMatchObject({ food_name: 'Hard biscuit', food_kind: 'preserved', from_pot: false });
    expect(lineOf('Hard biscuit')?.qty).toBe(1);
    expect((await send('eat_at_camp', { camp, actor: moss, from_pot: false, line: 'line-Hard biscuit' }, 'camp.eat')).error?.message).toBe("That isn't in their pack.");
  });

  // Purpose: undoing the cooking is refused while its portions were eaten, and undoing the camp is refused while steps stand.
  it('refuses to undo cooking that was eaten, or a camp with steps done', async () => {
    await trekking();
    const camp = await campFire();
    await send('cook_at_camp', { camp, cook: wren, ingredients: [{ line: 'line-Marsh herbs', qty: 1 }], portions: 1 }, 'camp.cook');
    await send('eat_at_camp', { camp, actor: wren, from_pot: true }, 'camp.eat');
    expect((await undoOf('camp.cook')).error?.message).toBe('Some of those portions were eaten: undo the meals first.');
    expect((await undoOf('camp.open')).error?.message).toBe("Undo the camp's steps first.");
    expect((await undoOf('camp.eat')).error).toBeNull();
    expect((await undoOf('camp.cook')).error).toBeNull();
    expect(lineOf('Marsh herbs')?.qty).toBe(2);
    expect((await undoOf('camp.open')).error).toBeNull();
    expect(world.tables.camps[0]!.undone).toBe(true);
  });

  // Purpose: the watch order is the group's, each watch 1 to 3 of its own characters, each once; the newest entry stands.
  it('sets watches and refuses a character twice', async () => {
    await trekking();
    const camp = await campFire();
    const set = await send('set_camp_watches', { camp, actor: wren, watches: [[wren], [moss]] }, 'camp.watches');
    expect(data(set)).toMatchObject({ kind: 'watches', detail: [[wren], [moss]] });
    expect((await send('set_camp_watches', { camp, actor: wren, watches: [[wren, moss], [moss]] }, 'camp.watches')).error?.message).toBe("Each watch is the group's own characters, each once.");
    expect((await send('set_camp_watches', { camp, actor: wren, watches: [[]] }, 'camp.watches')).error?.message).toBe('Each watch holds 1 to 3 characters.');
  });

  // Purpose: a sleep is recorded with the roll and how they slept; only the GM changes the difficulty (a permission refusal).
  it('records sleep and keeps the difficulty to the GM', async () => {
    await trekking();
    const camp = await campFire();
    world.signInAs(sam);
    const slept = data(await send('camp_sleep', { camp, actor: wren, roll: '14', outcome: 'good' }, 'camp.sleep'));
    expect(slept).toMatchObject({ kind: 'sleep', outcome: 'good', detail: [{ roll: '14' }] });
    const hard = await send('camp_sleep', { camp, actor: wren, difficulty: 'hard' }, 'camp.sleep');
    expect(hard.error).toMatchObject({ message: 'Only the GM changes how hard sleep is.', code: '42501' });
    expect((await send('camp_sleep', { camp, actor: wren }, 'camp.sleep')).error?.message).toBe('Say how they slept.');
    world.signInAs(gm);
    expect(data(await send('camp_sleep', { camp, actor: wren, difficulty: 'hard' }, 'camp.sleep'))).toMatchObject({ detail: [{ difficulty: 'hard' }] });
  });

  // Purpose: Next day applies the camps in the clock move's own request, so the move's one Undo un-applies them; an applied camp takes no more steps.
  it('apply_camps marks the camp applied and the clock move undo takes it back', async () => {
    await trekking();
    const camp = await campFire();
    const request = crypto.randomUUID();
    const clock = world.tables.campaign_clocks[0]!;
    expect((await send('advance_clock', { campaign, by_seconds: 600, seen_version: clock.version }, 'time.advance', request)).error).toBeNull();
    expect((await send('apply_camps', { campaign, camps: [camp] }, 'time.advance', request)).error).toBeNull();
    expect(world.tables.camps[0]!.applied_at).toBe(600);
    expect((await send('camp_talk', { camp, actor: wren, outcome: 'worked' }, 'camp.talk')).error?.message).toBe('That camp is over.');
    expect((await undoOf('time.advance')).error).toBeNull();
    expect(world.tables.camps[0]!.applied_at).toBeNull();
    expect(world.tables.campaign_clocks[0]!.seconds).toBe(0);
    // A player may not apply.
    world.signInAs(sam);
    expect((await send('apply_camps', { campaign, camps: [camp] }, 'camp.apply')).error?.code).toBe('42501');
  });

  // Purpose: Which watch? writes the waiting encounter's watch (the GM's), and a player can't.
  it('set_encounter_watch writes the waiting card\'s watch', async () => {
    await trekking();
    world.tables.waiting_encounters.push({ id: 'waiting-1', campaign_id: campaign, expedition_id: null, check_result_id: 'r', watch: null, state: 'waiting', undone: false, version: 1 });
    expect(data(await send('set_encounter_watch', { encounter: 'waiting-1', watch: 'Watch 2 · Wren', seen_version: 1 }, 'encounter.watch'))).toMatchObject({ watch: 'Watch 2 · Wren' });
    expect((await send('set_encounter_watch', { encounter: 'waiting-1', watch: 'Late', seen_version: 1 }, 'encounter.watch')).error?.code).toBeDefined();
    world.signInAs(sam);
    expect((await send('set_encounter_watch', { encounter: 'waiting-1', watch: 'Mine' }, 'encounter.watch')).error?.code).toBe('42501');
  });
});

describe('What we know (M5b step 3)', () => {
  // Purpose: a player reads only the places shown to their own group, the current expedition's first, hidden pieces left out.
  it('known_places_campaign returns the shown pieces of the reader\'s groups', async () => {
    await trekking();
    const trip = world.tables.expeditions[0]!;
    world.tables.places.push({ id: 'place-mere', campaign_id: campaign, name: 'Gull Mere', undone: false });
    world.tables.group_places.push({ id: 'visit-1', campaign_id: campaign, expedition_id: trip.id, group_number: 1, place_id: 'place-mere', undone: false, created_at: '2026-11-03T10:00:00Z' });
    world.tables.place_pieces.push(
      { id: 'piece-a', place_id: 'place-mere', kind: 'text', body: 'Reeds and a cold smell.', undone: false },
      { id: 'piece-b', place_id: 'place-mere', kind: 'text', body: 'A hidden hatch.', undone: false },
    );
    world.tables.piece_shows.push(
      { id: 'show-a', group_place_id: 'visit-1', piece_id: 'piece-a', shown: true, shown_at: '2026-11-03T10:05:00Z', undone: false },
      { id: 'show-b', group_place_id: 'visit-1', piece_id: 'piece-b', shown: false, shown_at: '2026-11-03T10:06:00Z', undone: false },
    );
    world.signInAs(sam);
    const known = (await world.db.rpc('known_places_campaign', { campaign })).data as Row[];
    expect(known).toHaveLength(1);
    expect(known[0]).toMatchObject({ current: true, place_name: 'Gull Mere', piece_id: 'piece-a', body: 'Reeds and a cold smell.' });
    // The GM has the place cards, not this list.
    world.signInAs(gm);
    expect((await world.db.rpc('known_places_campaign', { campaign })).data).toEqual([]);
  });
});
