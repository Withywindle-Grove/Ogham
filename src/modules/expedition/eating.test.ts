// Eating in camp, per player, and cooking portions (ruled 2026-10-30, D14 and D15; cooked → fresh → preserved
// confirmed the same day). Invented fixtures only.
import { describe, expect, it } from 'vitest';
import { mireRules } from './fixtures.ts';
import { readExploration } from './modes.ts';
import { cookPortions, eatingStatus, foodChoices, type Eater } from './eating.ts';
import { foodKindOf, readYields } from './wildPack.ts';
import { usableActivities, yieldCounted, yieldPieces } from './activities.ts';
import { timeUnits } from './clock.ts';

const units = timeUnits({ roundSeconds: 6, turnMinutes: 10, dayHours: 24, turnsPerHour: 6 });

const trek = readExploration([mireRules]).modes[0]!;
const cooking = trek.wild.cooking!;
const smoked = { lineId: 'l1', itemId: 'smoked-eel', name: 'Smoked eel', qty: 2, kind: 'preserved' as const };
const berries = { lineId: 'l2', itemId: 'bog-berries', name: 'Bog berries', qty: 1, kind: 'fresh' as const };
const stew = { lineId: 'l3', itemId: 'eel-stew', name: 'Eel stew', qty: 1, kind: 'cooked' as const };
const lurker: Eater = { id: 'a', name: 'Bog lurker', food: [smoked, berries], eaten: false };
const warden: Eater = { id: 'b', name: 'Lantern Warden', food: [], eaten: false };
const witch: Eater = { id: 'c', name: 'Reed witch', food: [stew], eaten: true };

describe('what to eat', () => {
  it('suggests fresh before preserved, whatever order the pack holds them in', () => {
    expect(foodChoices(lurker).map((c) => [c.name, c.kind, c.suggested])).toEqual([
      ['Bog berries', 'fresh', true],
      ['Smoked eel', 'preserved', false],
    ]);
  });

  it("cooked food comes first, counts as the day's food and carries the pack's bonus; other food has none", () => {
    const choices = foodChoices({ ...lurker, food: [smoked, berries, stew] }, cooking);
    expect(choices.map((c) => [c.kind, c.suggested, c.bonus])).toEqual([
      ['cooked', true, [{ heal: 1 }]],
      ['fresh', false, []],
      ['preserved', false, []],
    ]);
  });

  it('a line with none left is not offered, and someone with nothing has no choices', () => {
    expect(foodChoices({ ...lurker, food: [{ ...berries, qty: 0 }, smoked] }).map((c) => c.name)).toEqual(['Smoked eel']);
    expect(foodChoices(warden)).toEqual([]);
  });
});

describe('the GM view of eating', () => {
  it("lists who hasn't eaten, warns about anyone with nothing, and names who could give them food", () => {
    const status = eatingStatus([lurker, warden, witch]);
    expect(status.notEaten.map((e) => e.name)).toEqual(['Bog lurker', 'Lantern Warden']);
    expect(status.nothingToEat.map((n) => [n.eater.name, n.givers.map((g) => g.name)])).toEqual([['Lantern Warden', ['Bog lurker', 'Reed witch']]]);
    expect(status.allEaten).toBe(false);
  });

  it('is done when everyone has eaten', () => {
    expect(eatingStatus([{ ...lurker, eaten: true }, witch])).toMatchObject({ notEaten: [], nothingToEat: [], allEaten: true });
  });
});

describe('cooking', () => {
  it('reads the cooking rule', () => {
    expect(cooking).toEqual({ ingredients: ['eel'], portions: 2, bonus: [{ heal: 1 }], note: 'A hot meal mends.' });
  });

  it('a whole number of portions per ingredient gives a count; dice give the roll to make at the table; portions are cooked food', () => {
    expect(cookPortions(cooking, 3)).toEqual({ portions: 6, roll: null, kind: 'cooked' });
    const dice = { ...cooking, portions: '1d4' };
    expect(cookPortions(dice, 1)).toMatchObject({ portions: null, roll: '1d4' });
    expect(cookPortions(dice, 2)).toMatchObject({ portions: null, roll: '2 × 1d4' });
    expect(cookPortions(dice, 0)).toMatchObject({ portions: 0, roll: null });
  });

  it("an item's food kind is read from the pack, and anything else isn't food", () => {
    expect(foodKindOf({ food: 'fresh' })).toBe('fresh');
    expect(foodKindOf({ food: 'preserved' })).toBe('preserved');
    expect(foodKindOf({ food: 'cooked' })).toBe('cooked');
    expect(foodKindOf({ food: 'tasty' })).toBeNull();
  });

  it("an activity's yields names the item and dice it gives, and the season's bySeason dice replace the dice", () => {
    expect(trek.activities[0]!.yields).toEqual({ item: 'eel', dice: '1d3', units: false });
    const yieldsIn = (season: string | null) => usableActivities(trek, units, { season })[0]!.yields;
    expect(yieldsIn(null)).toEqual({ item: 'eel', dice: '1d3', units: false });
    expect(yieldsIn('frost')).toEqual({ item: 'eel', dice: '1d2', units: false });
    // A season whose bySeason is text (not dice) keeps the yields' own dice.
    expect(yieldsIn('thaw')).toEqual({ item: 'eel', dice: '1d3', units: false });
  });

  // Purpose (G-108, ga-5): a yield may count `units`, single days of a week's bundled rations, as dice or a number;
  // the season's dice still replace the count and it stays single days.
  it("a yield's units count single pieces of a bundle, as dice or a number, and a season's dice keep them single", () => {
    expect(readYields({ item: 'fen-rations', units: '1d3' })).toEqual({ item: 'fen-rations', dice: '1d3', units: true });
    expect(readYields({ item: 'fen-rations', units: 2 })).toEqual({ item: 'fen-rations', dice: '2', units: true });
    expect(readYields({ item: 'fen-rations', units: 0 })).toBeNull();
    expect(readYields({ item: 'fen-rations' })).toBeNull();
    const mode = { ...trek, activities: [{ ...trek.activities[0]!, yields: { item: 'fen-rations', dice: '1d3', units: true } }] };
    expect(usableActivities(mode, units, { season: 'frost' })[0]!.yields).toEqual({ item: 'fen-rations', dice: '1d2', units: true });
  });

  // Purpose (G-108 with G-92's rule): a count of units goes into the pack as it is; a count of whole items of a
  // bundled item goes in times the bundle, as buying one does; the words name the single piece and its bundle.
  it('a count of units goes in as single pieces, a count of whole items times the bundle, and the words say which', () => {
    expect(yieldPieces({ item: 'fen-rations', units: true }, 3, 7)).toBe(3);
    expect(yieldPieces({ item: 'fen-rations', units: false }, 3, 7)).toBe(21);
    expect(yieldPieces({ item: 'eel', units: false }, 3, 1)).toBe(3);
    expect(yieldCounted({ units: true }, 'Fen rations (1 week)', 'Ration day')).toBe('Ration day (Fen rations (1 week))');
    expect(yieldCounted({ units: true }, 'Fen rations (1 week)', null)).toBe('single Fen rations (1 week)');
    expect(yieldCounted({ units: false }, 'Eel', 'Ration day')).toBe('Eel');
  });
});
