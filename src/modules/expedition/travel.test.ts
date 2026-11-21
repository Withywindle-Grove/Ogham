// The day's travel budget and Move… (rulings of 2026-10-30: S1–S5, D4, D8). Invented fixtures only.
import { describe, expect, it } from 'vitest';
import { fenRules, mireRules } from './fixtures.ts';
import { readExploration } from './modes.ts';
import { applyMove, budgetText, dayBudget, endDay, forceMarch, perDayFor, previewMove, remaining, spendTheDay, startDay, weatherTagsFor, withTotal, type Traveller, type TravelDay } from './travel.ts';

const mire = readExploration([mireRules]);
const trek = mire.modes[0]!;
const travel = trek.wild.travel!;
const tags = weatherTagsFor(trek, mire);
const party: Traveller[] = [
  { id: 'a', name: 'Bog lurker', speed: 40 },
  { id: 'b', name: 'Lantern Warden', speed: 30 },
  { id: 'c', name: 'Reed witch', speed: null },
];
const fresh = (total: number): TravelDay => ({ total, spent: 0, pending: null, forced: 0 });

describe('reading the travel budget', () => {
  it('reads the movement budget, its routes and forced march, and leaves out a route with no id', () => {
    expect(travel).toMatchObject({ name: 'Strides', unit: 'points', perDay: 'floor(speed / 10)', mounted: 60, vehicle: null, forced: { factor: 1.5, add: null, stack: 'once' } });
    expect(travel.routes.map((r) => [r.id, r.cost])).toEqual([
      ['wild', null],
      ['causeway', 1],
      ['channel-down', 1],
    ]);
  });

  it('a mode whose movement is not a budget has no travel', () => {
    expect(readExploration([fenRules]).modes.find((m) => m.id === 'creep')!.wild.travel).toBeNull();
  });

  // Purpose: travel reads weather tags through the one weather reader (modes.ts readWeather, 07 weather.tags), so the
  // budget, the warning and the old `effect` alias (ruled 2026-11-01, reconcile ⚑ 4) all come from the same place.
  it("takes the weather tags from the rules set's weather (or the mode's own) through the one weather reader", () => {
    expect(tags.mired).toMatchObject({ name: 'Mired', budget: -2, warn: null });
    expect(tags.murk).toMatchObject({ budget: null, warn: 'Hard to keep your bearings' });
    expect(weatherTagsFor({ ...trek, weather: { tables: {}, rollEvery: { value: 1, unit: 'day' }, onlyWithOption: null, tags: { soak: { name: 'Soak', note: null, budget: -1, warn: null } } } }, mire)).toEqual({
      soak: { name: 'Soak', note: null, budget: -1, warn: null },
    });
    expect(weatherTagsFor({ ...trek, pace: 'turn' }, mire)).toEqual({});
    const old = readExploration([{ ...mireRules, weather: { tables: {}, tags: { damp: { name: 'Damp', effect: 'Fires are hard to light' } } } }]);
    expect(weatherTagsFor(old.modes[0]!, old).damp).toMatchObject({ note: 'Fires are hard to light' });
  });
});

describe('the day budget', () => {
  it('perDay is worked out from a speed and rounded down; an unreadable formula gives null', () => {
    expect(perDayFor('floor(speed / 10)', 35)).toBe(3);
    expect(perDayFor('speed / 4', 10)).toBe(2);
    expect(perDayFor('speed +', 10)).toBeNull();
    expect(perDayFor('"text"', 10)).toBeNull();
  });

  it('a perDay formula that comes out below nothing gives 0, and one just under a whole number stays whole', () => {
    // Purpose: perDayFor uses the sheet's one rounding helper (wholeDown): a negative day's budget is 0, and the
    // computer's 28.999999999999996 for 100 × 0.29 counts as 29.
    expect(perDayFor('speed - 40', 30)).toBe(0);
    expect(perDayFor('speed * 0.29', 100)).toBe(29);
  });

  it('on foot, the slowest member with a known speed sets the pace, and the breakdown says who', () => {
    const budget = dayBudget(travel, tags, { travellers: party });
    expect(budget).toMatchObject({ perDay: 3, total: 3, ask: null, slowest: { name: 'Lantern Warden' } });
    expect(budget.lines).toEqual([{ kind: 'base', label: 'Slowest: Lantern Warden (speed 30)', amount: 3 }]);
  });

  it("riding uses the pack's mounted speed; a cart with no vehicle speed asks the GM", () => {
    expect(dayBudget(travel, tags, { travellers: party, pace: 'riding' })).toMatchObject({ perDay: 6, total: 6, lines: [{ label: 'Riding (speed 60)' }] });
    expect(dayBudget(travel, tags, { travellers: party, pace: 'cart' })).toMatchObject({ perDay: null, ask: 'vehicle', total: 0, lines: [] });
  });

  it("with no known speed the GM is asked, and the GM's own number replaces the worked-out one", () => {
    expect(dayBudget(travel, tags, { travellers: [{ id: 'x', name: 'Bog lurker', speed: null }] })).toMatchObject({ ask: 'speed', total: 0 });
    expect(dayBudget(travel, tags, { travellers: party, gmPerDay: 5 })).toMatchObject({ perDay: 5, total: 5, lines: [{ label: 'Set by the GM', amount: 5 }] });
  });

  it("today's weather changes the budget, shown on its own line, and never takes it below 0", () => {
    const budget = dayBudget(travel, tags, { travellers: party, weatherTags: ['mired', 'murk', 'unknown'] });
    expect(budget.total).toBe(1);
    expect(budget.lines.map((l) => [l.label, l.amount])).toEqual([
      ['Slowest: Lantern Warden (speed 30)', 3],
      ['Weather: Mired', -2],
    ]);
    expect(dayBudget(travel, tags, { travellers: [{ id: 'x', name: 'Bog lurker', speed: 10 }], weatherTags: ['mired'] }).total).toBe(0);
  });

  it('a forced march adds the factor once when the pack says it does not stack', () => {
    expect(dayBudget(travel, tags, { travellers: party, pace: 'riding', forced: 2 })).toMatchObject({ total: 9, lines: [{ amount: 6 }, { label: 'Forced march', amount: 3 }] });
  });

  it('the budget card reads "<name> left of total", with the shortfall line when the party is still entering', () => {
    const day: TravelDay = { total: 8, spent: 5, pending: null, forced: 0 };
    expect(budgetText(day, { name: 'Strides' })).toEqual({ line: 'Strides 3 of 8', shortfall: null });
    expect(budgetText({ ...day, pending: { placeName: 'Bog (unnamed)', placeId: null, routeId: null, terrainId: 'bog', owed: 2 } }, { name: 'Strides' }).shortfall).toBe('Entering Bog (unnamed), 2 more tomorrow');
  });

  it('working the budget out again keeps what was spent', () => {
    expect(withTotal({ total: 3, spent: 2, pending: null, forced: 0 }, { total: 1 })).toEqual({ total: 1, spent: 2, pending: null, forced: 0 });
    expect(remaining({ total: 1, spent: 2, pending: null, forced: 0 })).toBe(0);
  });
});

describe('Move…', () => {
  it("costs the terrain's cost off the wild, names an unnamed place by its terrain, and shows the place's check chances", () => {
    const preview = previewMove(trek, mire, fresh(5), { routeId: 'wild', terrainId: 'bog' });
    expect(preview).toMatchObject({ placeName: 'Bog (unnamed)', cost: 3, costFrom: 'terrain', remainingBefore: 5, remainingAfter: 2, shortfall: 0, shortfallLine: null, column: null });
    expect(preview.checks.map((c) => [c.checkId, c.chanceText, c.ruledOut])).toEqual([
      ['trek-astray', '1–2 on d6', false],
      ['trek-prowl', '1–2 on d6', false],
    ]);
  });

  it("a route with its own cost replaces the terrain's, suggests its table column, and on a causeway there's no lost roll", () => {
    const preview = previewMove(trek, mire, fresh(5), { routeId: 'causeway', terrainId: 'bog', placeName: 'Heron Steps' });
    expect(preview).toMatchObject({ placeName: 'Heron Steps', cost: 1, costFrom: 'route', column: 'causeway' });
    expect(preview.checks.find((c) => c.checkId === 'trek-astray')!.ruledOut).toBe(true);
  });

  it("with no cost known the GM sets it; the GM's cost replaces any other", () => {
    expect(previewMove(trek, mire, fresh(5), { routeId: 'wild', terrainId: 'reedbed' })).toMatchObject({ cost: null, costFrom: null, remainingAfter: 5 });
    expect(previewMove(trek, mire, fresh(5), { routeId: 'causeway', terrainId: 'bog', gmCost: 4 })).toMatchObject({ cost: 4, costFrom: 'gm', remainingAfter: 1 });
  });

  it('a move costing more than is left is never blocked: it says how much more tomorrow', () => {
    const preview = previewMove(trek, mire, { total: 4, spent: 2, pending: null, forced: 0 }, { routeId: 'wild', terrainId: 'bog' });
    expect(preview).toMatchObject({ remainingAfter: 0, shortfall: 1, shortfallLine: 'Entering Bog (unnamed), 1 more tomorrow' });
  });

  it('warns the GM of the weather and of mounts or carts the terrain will not take, and blocks nothing', () => {
    expect(previewMove(trek, mire, fresh(5), { routeId: 'wild', terrainId: 'bog' }, { weatherTags: ['murk'], pace: 'riding' }).warnings).toEqual(['Hard to keep your bearings', "Mounts can't go into Bog"]);
    expect(previewMove(trek, mire, fresh(5), { routeId: 'wild', terrainId: 'reedbed' }, { pace: 'riding' }).warnings).toEqual(['Mounts must be led in Reedbed']);
    expect(previewMove(trek, mire, fresh(5), { routeId: 'wild', terrainId: 'bog' }, { pace: 'cart' }).warnings).toEqual(["Carts can't go into Bog"]);
  });

  it('murk adds a face to the lost chance shown for the destination', () => {
    const astray = previewMove(trek, mire, fresh(5), { routeId: 'wild', terrainId: 'sedge' }, { weatherTags: ['murk'] }).checks[0]!;
    expect(astray.chanceText).toBe('1–2 on d6');
  });

  it('applying a move spends its cost; a shortfall spends what is left and owes the rest', () => {
    const preview = previewMove(trek, mire, fresh(4), { routeId: 'wild', terrainId: 'bog' });
    const first = applyMove(fresh(4), preview, 3);
    expect(first).toMatchObject({ arrived: true, day: { spent: 3, pending: null } });
    const second = applyMove(first.day, preview, 3);
    expect(second).toMatchObject({ arrived: false, day: { spent: 4, pending: { placeName: 'Bog (unnamed)', terrainId: 'bog', routeId: 'wild', owed: 2 } } });
  });

  // Purpose: when the GM picks an existing place, its id rides with the preview and the owed move, so the arrival can
  // set the group's place (D10); a new place has no id yet (plan m5b-engine-reconcile §2.3).
  it("carries the picked place's id through the preview into what's owed; a new place has none", () => {
    const picked = previewMove(trek, mire, fresh(1), { routeId: 'wild', terrainId: 'bog', placeName: 'Heron Steps', placeId: 'place-heron' });
    expect(picked).toMatchObject({ placeName: 'Heron Steps', placeId: 'place-heron' });
    expect(applyMove(fresh(1), picked, 3).day.pending).toMatchObject({ placeName: 'Heron Steps', placeId: 'place-heron', owed: 2 });
    const unnamed = previewMove(trek, mire, fresh(1), { routeId: 'wild', terrainId: 'bog' });
    expect(unnamed.placeId).toBeNull();
    expect(applyMove(fresh(1), unnamed, 3).day.pending?.placeId).toBeNull();
  });

  it('a move made while another is still owed replaces it, and the log line says what was dropped', () => {
    const owing: TravelDay = { total: 4, spent: 4, pending: { placeName: 'Bog (unnamed)', placeId: null, routeId: 'wild', terrainId: 'bog', owed: 2 }, forced: 0 };
    const preview = previewMove(trek, mire, owing, { routeId: 'causeway', terrainId: 'sedge', placeName: 'Heron Steps' });
    const moved = applyMove(owing, preview, 1);
    expect(moved.replaced?.placeName).toBe('Bog (unnamed)');
    expect(moved.logLine).toBe('Course changed: 2 owed for Bog (unnamed) dropped');
    expect(moved.day.pending).toMatchObject({ placeName: 'Heron Steps', owed: 1 });
    expect(applyMove(fresh(4), preview, 1).logLine).toBeNull();
  });

  it("a route's id is what checks' routeType modifiers name: the channel route doesn't rule out the lost roll", () => {
    const astray = (routeId: string) => previewMove(trek, mire, fresh(5), { routeId, terrainId: 'bog' }).checks.find((c) => c.checkId === 'trek-astray')!;
    expect(astray('causeway').ruledOut).toBe(true);
    expect(astray('channel-down').ruledOut).toBe(false);
  });
});

describe('the day turning over', () => {
  it("the shortfall is paid first from the next day's points, and the party arrives", () => {
    const carried = { placeName: 'Bog (unnamed)', placeId: null, routeId: 'wild', terrainId: 'bog', owed: 2 };
    expect(startDay({ total: 5 }, carried)).toEqual({ day: { total: 5, spent: 2, pending: null, forced: 0 }, arrived: carried, paid: 2 });
  });

  it('a shortfall bigger than the next day stays owed, never blocked', () => {
    const carried = { placeName: 'Bog (unnamed)', placeId: null, routeId: 'wild', terrainId: 'bog', owed: 7 };
    expect(startDay({ total: 5 }, carried)).toMatchObject({ day: { spent: 5, pending: { owed: 2 } }, arrived: null, paid: 5 });
  });

  it('unused points are lost at day end, with the count in words', () => {
    expect(endDay({ total: 5, spent: 2, pending: null, forced: 0 }, 'points')).toEqual({ unused: 3, line: '3 unused points lost', carried: null });
    expect(endDay({ total: 5, spent: 4, pending: null, forced: 0 }, 'points').line).toBe('1 unused point lost');
    expect(endDay({ total: 5, spent: 5, pending: null, forced: 0 }, 'miles').line).toBeNull();
  });

  it('spending the day looking uses the remaining points and says how many', () => {
    expect(spendTheDay({ total: 6, spent: 2, pending: null, forced: 0 })).toEqual({ day: { total: 6, spent: 6, pending: null, forced: 0 }, used: 4 });
  });
});

describe('forced march', () => {
  // Purpose: a forced march adds the pack's points and says rest is due that evening (ruled 2026-11-01, reconcile ⚑ 2),
  // rather than setting a rest reminder of its own; the command marks it through the shared rest flow (g6).
  it("adds the pack's factor, makes rest due that evening and gives the pack's note", () => {
    const march = forceMarch(trek, fresh(6), { perDay: 6 })!;
    expect(march).not.toHaveProperty('rest');
    expect(march).toMatchObject({ added: 3, paidOwed: 0, arrived: null, restDue: true, note: 'Everyone is weary tomorrow.', day: { total: 9, forced: 1 } });
  });

  it('pays what is owed first, so the party can arrive today', () => {
    const owing: TravelDay = { total: 6, spent: 6, pending: { placeName: 'Bog (unnamed)', placeId: null, routeId: 'wild', terrainId: 'bog', owed: 2 }, forced: 0 };
    expect(forceMarch(trek, owing, { perDay: 6 })).toMatchObject({ added: 3, paidOwed: 2, arrived: { placeName: 'Bog (unnamed)' }, day: { total: 9, spent: 8, pending: null } });
  });

  // Purpose: with the party split, one group's forced march pays only its own shortfall; the other group's owed
  // points stay owed (ruled 2026-11-01, reconcile ⚑ 3: per group).
  it("one group's forced march leaves another group's shortfall untouched", () => {
    const north: TravelDay = { total: 6, spent: 6, pending: null, forced: 0 };
    const south: TravelDay = { total: 6, spent: 6, pending: { placeName: 'Bog (unnamed)', placeId: null, routeId: 'wild', terrainId: 'bog', owed: 2 }, forced: 0 };
    const southBefore = structuredClone(south);
    const march = forceMarch(trek, north, { perDay: 6 })!;
    expect(march).toMatchObject({ paidOwed: 0, arrived: null, day: { total: 9, spent: 6, pending: null } });
    expect(south).toEqual(southBefore);
  });

  it('a second forced march the same day adds nothing when the pack says it does not stack, but still counts', () => {
    const once = forceMarch(trek, fresh(6), { perDay: 6 })!;
    expect(forceMarch(trek, once.day, { perDay: 6 })).toMatchObject({ added: 0, day: { total: 9, forced: 2 } });
  });

  it('a factor multiplies the base and rounds down', () => {
    expect(forceMarch(trek, fresh(5), { perDay: 5 })!.added).toBe(2);
    expect(forceMarch(trek, fresh(1), { perDay: 1 })!.added).toBe(0);
  });

  it('stacks when the pack says so, and a whole-number add works in place of a factor', () => {
    const stacking = { ...trek, wild: { ...trek.wild, travel: { ...travel, forced: { factor: null, add: 2, stack: 'add' as const, note: null } } } };
    const once = forceMarch(stacking, fresh(6), { perDay: 6 })!;
    expect(forceMarch(stacking, once.day, { perDay: 6 })).toMatchObject({ added: 2, day: { total: 10, forced: 2 } });
  });

  it('a mode with no forced march gives nothing to apply', () => {
    const fen = readExploration([fenRules]).modes.find((m) => m.id === 'roam')!;
    expect(forceMarch(fen, fresh(6), { perDay: 6 })).toBeNull();
  });
});
