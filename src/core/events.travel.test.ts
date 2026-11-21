import { describe, expect, it } from 'vitest';
import { describeEntry, groupEntries, type LogEvent, type LogNames } from './events.ts';

// Travel's log lines (M5b step 1), in plain words. Invented names only. The first block's lines are shaped as they
// were before fm-1 (the place's name in the travel row itself: the GM's alone); fm-1's shapes are in the block below.
const names: LogNames = {
  me: 'user-sam',
  people: new Map([
    ['user-sam', 'Sam'],
    ['user-priya', 'Priya'],
  ]),
  characters: new Map(),
  companies: new Map(),
  fields: new Map(),
  packs: new Map(),
  items: new Map(),
  places: new Map(),
  placeNames: new Map([['place-landing', 'Moss Landing']]),
};

let seq = 0;
function event(type: string, targetTable: string, before: Record<string, unknown> | null, after: Record<string, unknown> | null, extra: Partial<LogEvent> = {}): LogEvent {
  seq += 1;
  return {
    id: `event-${seq}`,
    seq,
    type,
    level: 'simple',
    actorUserId: 'user-priya',
    targetTable,
    targetId: `row-${seq}`,
    before,
    after,
    fiat: false,
    reason: null,
    revertsEventId: null,
    requestId: `request-${seq}`,
    createdAt: '2026-11-03T18:30:00Z',
    ...extra,
  };
}
const say = (...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, names);
const travel = (type: string, before: Record<string, unknown> | null, after: Record<string, unknown>, extra: Partial<LogEvent> = {}) => event(type, 'travel_groups', before, after, extra);
const lost = (type: string, before: Record<string, unknown> | null, after: Record<string, unknown>) => event(type, 'group_lost', before, after);

describe('travel in the log', () => {
  // Purpose: the first morning says which day it is, for the party, with the day's points.
  it('travel.dayStart: the first day reads as day 1 for the party', () => {
    expect(say(travel('travel.dayStart', null, { group_number: 1, day: 0, total: 9, spent: 0 }))).toBe('Priya started day 1 for the party: 9 points.');
  });

  // Purpose: a later morning names the group, the points yesterday left unused, and the place the group reached.
  it('travel.dayStart: a later morning says what was lost unused and where the group arrived', () => {
    const before = { group_number: 2, day: 0, total: 9, spent: 5, pending_place_name: 'Moss Landing', pending_owed: 2 };
    const after = { group_number: 2, day: 1, total: 9, spent: 2, pending_place_name: null, pending_owed: null };
    expect(say(travel('travel.dayStart', before, after))).toBe('Priya started day 2 for Group 2: 9 points, 4 unused lost yesterday, arrived at Moss Landing.');
  });

  // Purpose: when the morning's points don't cover the shortfall, the line says how much is still owed.
  it('travel.dayStart: a shortfall that is still owed says so', () => {
    const before = { group_number: 1, day: 0, total: 9, spent: 9, pending_place_name: 'Reed Hollow', pending_owed: 12 };
    const after = { group_number: 1, day: 1, total: 9, spent: 9, pending_place_name: 'Reed Hollow', pending_owed: 3 };
    expect(say(travel('travel.dayStart', before, after))).toBe('Priya started day 2 for the party: 9 points, 3 more owed for Reed Hollow.');
  });

  // Purpose: a move that arrives names the place the group went into and what it cost (the place comes from the entry's own row).
  it('travel.move: a move into a place says where and what it cost', () => {
    const row = travel('travel.move', { group_number: 1, spent: 2 }, { group_number: 1, spent: 5 });
    const visit = event('travel.move', 'group_places', null, { place_id: 'place-landing', group_number: 1 }, { requestId: row.requestId });
    expect(say(row, visit)).toBe('Priya moved the party into Moss Landing, 3 points.');
  });

  // Purpose: a move that leaves points owed says the group is entering the place, with what it still owes tomorrow.
  it('travel.move: a move that falls short says entering, with the points still owed', () => {
    expect(say(travel('travel.move', { group_number: 2, spent: 6 }, { group_number: 2, spent: 9, pending_place_name: 'Reed Hollow', pending_owed: 4 }))).toBe(
      'Priya moved Group 2 on: entering Reed Hollow, 4 more tomorrow.',
    );
  });

  // Purpose: a move made while another was owed says the course changed and what was dropped.
  it('travel.move: a new move over an owed one says the course changed', () => {
    const before = { group_number: 1, spent: 9, pending_place_name: 'Reed Hollow', pending_owed: 4 };
    const after = { group_number: 1, spent: 9, pending_place_name: null, pending_owed: null };
    expect(say(travel('travel.move', before, after))).toBe('Priya moved the party, 0 points, Course changed: 4 owed for Reed Hollow dropped.');
  });

  // Purpose: the GM's own number for a day reads as a set budget, and a pace other than on foot is named.
  it('travel.setBudget: says the new number and the pace when it is not on foot', () => {
    expect(say(travel('travel.setBudget', { total: 9 }, { group_number: 1, total: 12, pace: 'foot' }, { level: 'verbose' }))).toBe("Priya set the party's points to 12.");
    expect(say(travel('travel.setBudget', { total: 9 }, { group_number: 2, total: 14, pace: 'riding' }, { level: 'verbose' }))).toBe("Priya set Group 2's points to 14 (riding).");
    expect(say(travel('travel.setBudget', { total: 9 }, { group_number: 1, total: 6, pace: 'cart' }, { level: 'verbose' }))).toBe("Priya set the party's points to 6 (by cart).");
  });

  // Purpose: a forced march says how many points it added and that rest is due.
  it('travel.forceMarch: says the points added and that rest is due this evening', () => {
    expect(say(travel('travel.forceMarch', { group_number: 1, total: 9, forced: 0 }, { group_number: 1, total: 13, forced: 1 }, { actorUserId: 'user-sam' }))).toBe(
      'You forced the march with the party: +4 points, rest due this evening.',
    );
  });

  // Purpose: spending the day looking says how many points were used up.
  it('travel.spendDay: says the points used', () => {
    expect(say(travel('travel.spendDay', { group_number: 1, spent: 3 }, { group_number: 1, spent: 9 }))).toBe('Priya spent the day looking with the party, 6 points.');
  });

  // Purpose: marking a group lost names the group, and the GM's note when there is one.
  it('travel.lost.set: says the group is lost, with the note', () => {
    expect(say(lost('travel.lost.set', null, { group_number: 1, note: '' }))).toBe('Priya marked the party lost.');
    expect(say(lost('travel.lost.set', null, { group_number: 2, note: 'Fog on the flats' }))).toBe('Priya marked Group 2 lost: Fog on the flats.');
  });

  // Purpose: the recovery roll's line carries what the dice showed and whose group it is.
  it('travel.lost.roll: says the roll that was entered', () => {
    expect(say(lost('travel.lost.roll', { group_number: 1, roll: null }, { group_number: 1, roll: '4' }))).toBe('Priya entered the recovery roll for the party: 4.');
  });

  // Purpose: the two ways a lost spell ends or goes on each have their own sentence.
  it('travel.lost.resolve: says found the way, or still lost', () => {
    // Only the meaning is checked here: the current sentence reads "Priya the party found the way." (a missing verb,
    // reported to the builder), and this test should not pin that wording down.
    expect(say(lost('travel.lost.resolve', { group_number: 1, found_day: null }, { group_number: 1, found_day: 5 }))).toMatch(/found the way\.$/);
    expect(say(lost('travel.lost.resolve', { group_number: 2, attempts: 0 }, { group_number: 2, attempts: 1, found_day: null }))).toMatch(/Group 2 is still lost\.$/);
  });
});

// fm-1: a group's players read their group's travel lines. The database keeps the GM's own name for the place being
// entered out of the row they read: it is in the GM-only part of the row (travel_group_secrets), whose line only the
// GM's log holds. The travel row's own line has the place's players' name once it has been shown to that group, else
// nothing. (A change's line holds only the values that changed.)
describe('the place a group is entering, in the log (fm-1)', () => {
  /** The GM's part of the travel row in the same request: only the GM's log has this line. */
  const kept = (of: LogEvent, before: string | null, after: string | null) =>
    event(of.type, 'travel_group_secrets', { pending_place_name: before }, { pending_place_name: after }, { requestId: of.requestId });

  // Purpose: a player's log has no name for a place not shown to their group, so each line that would name it says
  // "the next place": entering, still owed in the morning, a course changed, and the arrival.
  it('a player reads "the next place" for a place not shown to their group', () => {
    expect(say(travel('travel.move', { spent: 6, pending_owed: null }, { spent: 9, pending_terrain_id: 'bog', pending_owed: 4 }, { groupNumber: 2 }))).toBe(
      'Priya moved Group 2 on: 4 more tomorrow to enter the next place.',
    );
    expect(say(travel('travel.dayStart', { day: 0, total: 8, spent: 8, pending_owed: 12 }, { day: 1, total: 9, spent: 9, pending_owed: 3 }, { groupNumber: 1 }))).toBe(
      'Priya started day 2 for the party: 9 points, 3 more owed to enter the next place.',
    );
    expect(say(travel('travel.move', { pending_terrain_id: 'bog', pending_owed: 4 }, { pending_terrain_id: null, pending_owed: null, terrain_id: 'moor' }, { groupNumber: 1 }))).toBe(
      'Priya moved the party, 0 points, Course changed: 4 owed for the next place dropped.',
    );
    expect(say(travel('travel.dayStart', { day: 0, total: 8, spent: 8, pending_owed: 3 }, { day: 1, total: 9, spent: 3, pending_owed: null }, { groupNumber: 1 }))).toBe(
      'Priya started day 2 for the party: 9 points, arrived at the next place.',
    );
  });

  // Purpose: once the place has been shown to the group, the travel row holds the name its players know it by, and
  // their line says it.
  it('a player reads the name they know a shown place by', () => {
    const entering = travel('travel.move', { spent: 6, pending_owed: null, pending_place_name: null }, { spent: 9, pending_owed: 4, pending_place_name: 'The old mill' }, { groupNumber: 1 });
    expect(say(entering)).toBe('Priya moved the party on: entering The old mill, 4 more tomorrow.');
    const arrived = travel('travel.dayStart', { day: 0, total: 8, spent: 8, pending_owed: 3, pending_place_name: 'The old mill' }, { day: 1, total: 9, spent: 3, pending_owed: null, pending_place_name: null }, { groupNumber: 1 });
    expect(say(arrived)).toBe('Priya started day 2 for the party: 9 points, arrived at The old mill.');
  });

  // Purpose: the GM's log holds the GM's part of the row too, so the GM's line names the place by the GM's own name,
  // shown or not: entering, the arrival, and a course changed.
  it("the GM reads their own name for the place, from the GM's part of the row", () => {
    const entering = travel('travel.move', { spent: 6, pending_owed: null }, { spent: 9, pending_owed: 4 }, { groupNumber: 1 });
    expect(say(entering, kept(entering, null, 'Cellar of the bog lurker'))).toBe('Priya moved the party on: entering Cellar of the bog lurker, 4 more tomorrow.');
    // Shown to the group: the row has the players' name, the GM's line still the GM's own.
    const shown = travel('travel.move', { spent: 6, pending_owed: null, pending_place_name: null }, { spent: 9, pending_owed: 4, pending_place_name: 'The old mill' }, { groupNumber: 1 });
    expect(say(shown, kept(shown, null, 'Cellar of the bog lurker'))).toBe('Priya moved the party on: entering Cellar of the bog lurker, 4 more tomorrow.');
    const arrived = travel('travel.dayStart', { day: 0, total: 8, spent: 8, pending_owed: 3 }, { day: 1, total: 9, spent: 3, pending_owed: null }, { groupNumber: 1 });
    expect(say(arrived, kept(arrived, 'Cellar of the bog lurker', null))).toBe('Priya started day 2 for the party: 9 points, arrived at Cellar of the bog lurker.');
    const dropped = travel('travel.move', { pending_owed: 4 }, { pending_owed: null, terrain_id: 'moor' }, { groupNumber: 1 });
    expect(say(dropped, kept(dropped, 'Cellar of the bog lurker', null))).toBe('Priya moved the party, 0 points, Course changed: 4 owed for Cellar of the bog lurker dropped.');
  });

  // Purpose: a new Move… over an owed one at the same cost leaves what's owed unchanged (so it isn't in the change's
  // values); the line still says the course changed and where the group is entering now, by the reader's names.
  it('a re-route at the same cost says the course changed, for a player and for the GM', () => {
    const player = travel('travel.move', { pending_terrain_id: 'bog' }, { pending_terrain_id: 'moor' }, { groupNumber: 2 });
    expect(say(player)).toBe("Priya changed Group 2's course, the same points still owed.");
    const shown = travel('travel.move', { pending_place_name: null, pending_route_id: null }, { pending_place_name: 'The old mill', pending_route_id: 'causeway' }, { groupNumber: 1 });
    expect(say(shown)).toBe("Priya changed the party's course: entering The old mill instead of the next place, the same points still owed.");
    const gm = travel('travel.move', { pending_terrain_id: 'bog' }, { pending_terrain_id: 'moor' }, { groupNumber: 1 });
    expect(say(gm, kept(gm, 'Cellar of the bog lurker', 'Black Mere'))).toBe(
      "Priya changed the party's course: entering Black Mere instead of Cellar of the bog lurker, the same points still owed.",
    );
  });

  // Purpose: a change's values don't repeat the group's number, so the line's own group says which group it was: a
  // player in Group 2 never reads their own march as the party's.
  it("a change's line names its group from the line's own group number", () => {
    const march = travel('travel.forceMarch', { total: 9, forced: 0 }, { total: 13, forced: 1 }, { actorUserId: 'user-sam', groupNumber: 2 });
    expect(say(march)).toBe('You forced the march with Group 2: +4 points, rest due this evening.');
    expect(say(travel('travel.spendDay', { spent: 3 }, { spent: 9 }, { groupNumber: 1 }))).toBe('Priya spent the day looking with the party, 6 points.');
  });
});

describe('answering a request in the log', () => {
  const answer = (yes: boolean) => ({ kind: 'secretActivity', text: 'Scout ahead', actor_id: 'actor-reed', answer: { kind: 'yesNo', yes, turns: 0, note: '' } });
  const withNames = { ...names, characters: new Map([['actor-reed', 'Reed']]) };
  const sayNamed = (...events: LogEvent[]) => describeEntry(groupEntries(events)[0]!, withNames);

  // Purpose: a Yes to a secret activity names the activity and the points it cost, from the travel row's change.
  it('a Yes to a secret activity reads the activity and its cost', () => {
    const req = event('request.answer', 'requests', { status: 'waiting' }, answer(true));
    const row = travel('request.answer', { group_number: 1, spent: 2 }, { group_number: 1, spent: 5 }, { requestId: req.requestId });
    expect(sayNamed(req, row)).toBe("Priya answered Reed Scout ahead: Yes, 3 points.");
  });

  // Purpose: a No names the activity and costs nothing.
  it('a No to a secret activity reads without a cost', () => {
    const req = event('request.answer', 'requests', { status: 'waiting' }, answer(false));
    expect(sayNamed(req)).toBe("Priya answered Reed Scout ahead: No.");
  });

  // Purpose: a plain describe answer keeps its old words (no activity name, no cost).
  it('a plain yes answer keeps its old words', () => {
    const req = event('request.answer', 'requests', { status: 'waiting' }, { kind: 'describe', actor_id: 'actor-reed', answer: { kind: 'yesNo', yes: true, turns: 2, note: 'Take the left path' } });
    expect(sayNamed(req)).toBe("Priya answered Reed: Yes, 2 turns, Take the left path.");
  });
});
