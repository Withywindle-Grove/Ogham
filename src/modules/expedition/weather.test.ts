// Today's weather (M5b; ruled 2026-10-30: D1, S2-1, A8–A12): which step's weather is due, the table and season it
// reads, the tags in plain words, and who may enter it. Invented fixtures only.
import { describe, expect, it } from 'vitest';
import { timeUnits } from './clock.ts';
import { readExploration, readWeather } from './modes.ts';
import { weatherNow, type Expedition } from './procedure.ts';
import { budgetNameOf, mayEnterWeather, weatherRolledByOf, weatherTagLines } from './weatherPlay.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24 });
const DAY = 86400;
const tags = { wet: { name: 'Wet', note: 'Lighting a campfire is hard' }, mired: { name: 'Mired', budget: -2 }, fog: { name: 'Fog', warn: 'Hard to keep your bearings' } };

/** A wading mode (a day a step) under rules with the given weather and procedure. */
function wading(mode: Record<string, unknown> = {}, rules: Record<string, unknown> = {}): Pick<Expedition, 'rules' | 'mode' | 'units' | 'startedAt' | 'now'> {
  const read = readExploration([{ seasons: [{ id: 'spring', name: 'Spring' }, { id: 'summer', name: 'Summer' }], ...rules, exploration: { modes: [{ id: 'wade', name: 'Wading', step: { value: 1, unit: 'day' }, procedure: [], ...mode }] } }]);
  return { rules: read, mode: read.modes[0]!, units, startedAt: 2 * DAY, now: 2 * DAY };
}

describe("which step's weather is due (A12: it lasts until the next rollEvery step)", () => {
  it('the first day of an expedition is step 0; each day after is the next step; rollEvery of 2 days spans two', () => {
    const daily = wading({}, { weather: { tables: { any: 'fen-sky' }, tags } });
    expect(weatherNow(daily)).toMatchObject({ period: 0, startsAt: 2 * DAY, endsAt: 3 * DAY, tableId: 'fen-sky', waitingForSeason: false });
    expect(weatherNow({ ...daily, now: 3 * DAY + 5 })).toMatchObject({ period: 1, startsAt: 3 * DAY });
    const every2 = wading({}, { weather: { tables: { any: 'fen-sky' }, rollEvery: { value: 2, unit: 'day' } } });
    expect(weatherNow({ ...every2, now: 3 * DAY + 5 })).toMatchObject({ period: 0, endsAt: 4 * DAY });
    expect(weatherNow({ ...every2, now: 4 * DAY })).toMatchObject({ period: 1 });
  });

  it('a season-keyed table waits for the season ("Waiting for the GM to set the season"), offering the tables to pick from; a season reads its own', () => {
    const bySeason = wading({}, { weather: { tables: { spring: 'spring-sky', summer: 'summer-sky' } } });
    expect(weatherNow(bySeason)).toMatchObject({ tableId: null, tableChoices: ['spring-sky', 'summer-sky'], waitingForSeason: true });
    expect(weatherNow({ ...bySeason, situation: { season: 'summer' } })).toMatchObject({ tableId: 'summer-sky', waitingForSeason: false, season: 'summer' });
  });

  it("a mode's weather roll step without a weather block comes every step; no weather, or its optional rule off, means nothing is due", () => {
    const stepOnly = wading({ procedure: [{ id: 'sky', name: 'Sky', kind: 'roll', icon: 'weather', tableId: 'reed-sky' }] });
    expect(weatherNow({ ...stepOnly, now: 4 * DAY })).toMatchObject({ period: 2, tableId: 'reed-sky' });
    expect(weatherNow(wading())).toBeNull();
    const optional = wading({}, { weather: { tables: { any: 'fen-sky' }, onlyWithOption: 'weather-rules' } });
    expect(weatherNow(optional)).toBeNull();
    expect(weatherNow({ ...optional, situation: { choices: { 'weather-rules': 'on' } } })).toMatchObject({ tableId: 'fen-sky' });
  });

  it("a mode's own weather tags join the rules set's (the mode's win)", () => {
    const both = wading({ weather: { tables: { any: 'reed-sky' }, tags: { mired: { name: 'Deep mire', budget: -3 } } } }, { weather: { tables: { any: 'fen-sky' }, tags } });
    const now = weatherNow(both)!;
    expect(now.tableId).toBe('reed-sky');
    expect(now.tags.mired).toEqual({ name: 'Deep mire', note: null, budget: -3, warn: null });
    expect(now.tags.wet?.name).toBe('Wet');
  });
});

describe('each tag in plain words (A11)', () => {
  const known = readWeather({ tables: {}, tags: { ...tags, squall: { name: 'Squall', effect: 'Boats stay ashore', budget: 1 } } })!.tags;

  it("the tag's name, then the pack's note, then any number it changes on the travel budget, named as the pack names it", () => {
    expect(weatherTagLines(['wet', 'mired'], known, 'travel points')).toEqual(['Wet, Lighting a campfire is hard', 'Mired, −2 travel points']);
    expect(weatherTagLines(['mired'], known)).toEqual(['Mired, −2 to the travel budget']);
  });

  it("never shows the GM's movement warning; an undescribed tag shows its id, tidied; repeats show once", () => {
    expect(weatherTagLines(['fog', 'poor-visibility', 'fog'], known)).toEqual(['Fog', 'Poor visibility']);
  });

  it('a provisional `effect` is read when there is no note (07, A11)', () => {
    expect(weatherTagLines(['squall'], known, 'travel points')).toEqual(['Squall, Boats stay ashore, +1 travel points']);
  });

  it("the budget's name comes from a budget mode's movement, in lower case", () => {
    expect(budgetNameOf({ kind: 'budget', name: 'Travel points', unit: 'points' })).toBe('travel points');
    expect(budgetNameOf({ kind: 'budget', unit: 'miles' })).toBe('miles');
    expect(budgetNameOf({ kind: 'perStep', formula: 'x' })).toBeNull();
    expect(budgetNameOf(null)).toBeNull();
  });
});

describe('who enters it (D1, 03 "Weather roll")', () => {
  const gm = { id: 'gm', roles: { c: 'gm' as const } };
  const player = { id: 'p', roles: { c: 'player' as const } };
  const outsider = { id: 'o', roles: {} };

  it('"Weather rolled by" is Players unless the campaign says GM', () => {
    expect(weatherRolledByOf({})).toBe('players');
    expect(weatherRolledByOf(null)).toBe('players');
    expect(weatherRolledByOf({ weatherRolledBy: 'gm' })).toBe('gm');
    expect(weatherRolledByOf({ weatherRolledBy: 'someone' })).toBe('players');
  });

  it('any player while players roll it; the GM always; never someone outside the campaign', () => {
    expect(mayEnterWeather(player, { campaignId: 'c', rolledBy: 'players' })).toBe(true);
    expect(mayEnterWeather(player, { campaignId: 'c', rolledBy: 'gm' })).toBe(false);
    expect(mayEnterWeather(gm, { campaignId: 'c', rolledBy: 'gm' })).toBe(true);
    expect(mayEnterWeather(outsider, { campaignId: 'c', rolledBy: 'players' })).toBe(false);
  });
});
