// A move of the clock that starts the travel day with it (fix F86/F87, ruled ud-1; the stand-in database's
// advance_clock with `days`, as supabase/migrations/20261112100000_fix_travel_day_with_clock.sql gives it), and what
// stands in the way of its Undo (ud-2's mechanism, `standsInTheWay`: read only, no screen says it yet). Invented names.
import { beforeEach, describe, expect, it } from 'vitest';
import { encodeEventTag } from '../core/eventTags.ts';
import type { Db } from '../core/supabase.ts';
import { standsInTheWay } from '../modules/expedition/play.ts';
import { createFakeDb, type FakeWorld } from './fakeDb.ts';

let world: FakeWorld;
let gm: string;
let campaign: string;

type Row = Record<string, unknown>;
const DAY = 24 * 3600;

const send = async (name: string, args: Row, type: string, requestId: string = crypto.randomUUID()) => {
  const tag = encodeEventTag({ type, level: 'simple', requestId });
  return (await world.db.rpc(name as never, args as never).setHeader('x-grimoire-command', tag)) as unknown as { data: Row | null; error: { message: string; code?: string } | null };
};
const travel = () => world.tables.travel_groups[0]!;
const clock = () => world.tables.campaign_clocks.find((c) => c.campaign_id === campaign)!;
const latest = (type: string) => world.tables.events.filter((e) => e.type === type).sort((a, b) => Number(b.seq) - Number(a.seq))[0]!;
const nextDay = (days: Row[], requestId?: string) => send('advance_clock', { campaign, by_seconds: DAY, days }, 'time.advance', requestId);
const way = () => standsInTheWay(world.db as unknown as Db, campaign, String(latest('time.advance').id));

beforeEach(async () => {
  world = createFakeDb();
  gm = world.addPerson('priya@lantern.example', 'Priya');
  const sam = world.addPerson('sam@lantern.example', 'Sam');
  campaign = world.addCampaign('The Ash Barrows', gm);
  world.addMember(campaign, sam, 'player', world.addCharacter(campaign, 'Wren', { ownerId: sam }));
  world.signInAs(gm);
  await send('start_expedition', { campaign, mode_id: 'trek' }, 'expedition.start');
  await send('start_travel_day', { campaign, group_no: 1, day: 0, total: 12, pace: 'foot', gm_per_day: null }, 'travel.dayStart');
});

describe('a move of the clock that starts the travel day (ud-1)', () => {
  // Purpose: the day starts in the move's own request, yesterday's shortfall paid first, and one Undo of the move
  // takes the clock and the day back together.
  it('starts the day with the move, pays what was owed, and one Undo takes both back', async () => {
    await send('travel_move', { campaign, group_no: 1, cost: 15, place_name: 'Black Mere' }, 'travel.move');
    expect(travel()).toMatchObject({ day: 0, spent: 12, pending_owed: 3 });

    await nextDay([{ group: 1, day: 1, total: 12, pace: 'foot', gmPerDay: null }]);
    expect(Number(clock().seconds)).toBe(DAY);
    expect(travel()).toMatchObject({ day: 1, total: 12, spent: 3, forced: 0, pending_owed: null });
    const start = latest('travel.dayStart');
    expect(start.request_id).toBe(latest('time.advance').request_id);

    const undone = await send('undo_request', { event_id: latest('time.advance').id }, 'event.undo');
    expect(undone.error).toBeNull();
    expect(Number(clock().seconds)).toBe(0);
    expect(travel()).toMatchObject({ day: 0, spent: 12, pending_owed: 3 });
  });

  // Purpose: the same request sent twice starts nothing twice; a group with no row and a day already started are
  // left alone; a malformed day refuses the move before the clock moves.
  it('starts nothing twice, leaves a first day and a started day alone, and refuses a malformed day', async () => {
    const requestId = crypto.randomUUID();
    const days = [{ group: 1, day: 1, total: 12, pace: 'foot', gmPerDay: null }, { group: 2, day: 1, total: 9, pace: 'foot', gmPerDay: null }];
    await nextDay(days, requestId);
    await send('travel_move', { campaign, group_no: 1, cost: 2 }, 'travel.move');
    await nextDay(days, requestId);
    expect(Number(clock().seconds)).toBe(DAY);
    expect(travel()).toMatchObject({ day: 1, spent: 2 });
    expect(world.tables.travel_groups).toHaveLength(1);

    const bad = await nextDay([{ group: 1, day: 2, total: -1, pace: 'foot' }]);
    expect(bad.error?.message).toBe('A day, a budget and a pace are needed.');
    expect(Number(clock().seconds)).toBe(DAY);
  });
});

describe("the next day's arrival and the GM's part of the travel row (fm-1 met ud-1)", () => {
  // Purpose: a group that overspent entering a place the GM named arrives there on Next day; the GM's part of the row
  // (where that name is kept) is cleared with the arrival, in the move's own request, and one Undo puts it back.
  it("arrives at the GM's place, clears the GM's part of the row, and one Undo of the move puts it back", async () => {
    await send('travel_move', { campaign, group_no: 1, cost: 15, place_name: 'The Sunken Causeway' }, 'travel.move');
    const secret = () => world.tables.travel_group_secrets.find((s) => s.id === travel().id)!;
    const here = () => world.tables.group_places.find((g) => Number(g.group_number) === 1 && !g.undone && !g.moved_on);
    expect(travel()).toMatchObject({ pending_owed: 3, pending_place_name: null, pending_place_id: null });
    expect(secret()).toMatchObject({ pending_place_name: 'The Sunken Causeway', pending_place_id: null });

    await nextDay([{ group: 1, day: 1, total: 12, pace: 'foot', gmPerDay: null }]);
    expect(travel()).toMatchObject({ day: 1, spent: 3, pending_owed: null, pending_place_name: null });
    expect(world.tables.places.find((p) => p.id === here()?.place_id)?.name).toBe('The Sunken Causeway');
    expect(secret()).toMatchObject({ pending_place_name: null, pending_place_id: null });

    const undone = await send('undo_request', { event_id: latest('time.advance').id }, 'event.undo');
    expect(undone.error).toBeNull();
    expect(travel()).toMatchObject({ day: 0, spent: 12, pending_owed: 3, pending_place_name: null });
    expect(secret()).toMatchObject({ pending_place_name: 'The Sunken Causeway', pending_place_id: null });
  });
});

describe('what stands in the way of undoing that move (ud-2, the mechanism only)', () => {
  const started = () => nextDay([{ group: 1, day: 1, total: 12, pace: 'foot', gmPerDay: null }]);

  // Purpose: with nothing done on the new day, nothing stands in the way.
  it('is nothing when the new day is untouched', async () => {
    await started();
    expect(await way()).toBeNull();
  });

  // Purpose: a later move is named with its place, whether the group is still entering it or has arrived.
  it('is the later move, with its place (entering or arrived)', async () => {
    await started();
    await send('travel_move', { campaign, group_no: 1, cost: 20, place_name: 'Heron Rise' }, 'travel.move');
    expect(await way()).toEqual({ kind: 'move', group: 1, place: 'Heron Rise' });
  });

  it('is the later move that arrived, with its place', async () => {
    await started();
    await send('travel_move', { campaign, group_no: 1, cost: 4, place_name: 'Black Mere' }, 'travel.move');
    expect(await way()).toEqual({ kind: 'move', group: 1, place: 'Black Mere' });
  });

  // Purpose: a forced march is named as one; and once the later change is undone, nothing stands in the way again.
  it('is the forced march; and nothing again once that is undone', async () => {
    await started();
    await send('force_march', { campaign, group_no: 1, added: 6 }, 'travel.forceMarch');
    expect(await way()).toEqual({ kind: 'forcedMarch', group: 1, place: null });
    await send('undo_request', { event_id: latest('travel.forceMarch').id }, 'event.undo');
    expect(await way()).toBeNull();
    const undone = await send('undo_request', { event_id: latest('time.advance').id }, 'event.undo');
    expect(undone.error).toBeNull();
    expect(travel()).toMatchObject({ day: 0 });
  });
});
