// Camp's steps, campfire, pot and meals (M5b step 4; ruled 2026-10-30, D13–D17, WA1). Invented rules only.
import { describe, expect, it } from 'vitest';
import { campFire, campFlags, campSteps, mealWords, mealsOf, potOf, type CampEntry } from './camp.ts';
import { campOf, readExploration } from './modes.ts';

const step = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({ id, name: id, icon: 'camp', kind, ...extra });
const rules = (camp: Record<string, unknown>, other: Record<string, unknown> = {}) =>
  readExploration([
    {
      exploration: {
        modes: [
          { id: 'trek', name: 'Trekking', step: { value: 1, unit: 'day' }, camp },
          { id: 'creep', name: 'Creeping', step: { value: 1, unit: 'turn' }, camp: { sameAs: 'trek', note: 'Quietly.' }, ...other },
        ],
      },
    },
  ]);
const stepsOf = (camp: Record<string, unknown>, options: { choices?: Record<string, string>; food?: boolean } = {}, mode = 'trek') => {
  const r = rules(camp);
  const m = r.modes.find((x) => x.id === mode)!;
  return campSteps(campOf(m, r.modes)!, { choices: options.choices ?? {}, food: options.food });
};

let n = 0;
const entry = (kind: CampEntry['kind'], extra: Partial<CampEntry> = {}): CampEntry => ({
  id: `e${++n}`,
  campId: 'c',
  kind,
  actorId: 'reed',
  qty: 0,
  seconds: 0,
  at: 0,
  lineId: null,
  foodName: null,
  foodKind: null,
  fromPot: false,
  outcome: null,
  detail: [],
  createdBy: null,
  createdAt: '',
  ...extra,
});

describe('the camp steps (D13)', () => {
  it("follow the pack's order and skip what the pack doesn't define", () => {
    const steps = stepsOf({ procedure: [step('setup', 'note'), step('watches', 'watches'), step('night', 'check', { checkId: 'x' }), step('sleep', 'roll', { icon: 'rest' })] });
    expect(steps.map((s) => s.part)).toEqual(['setup', 'watches', 'night', 'sleep']);
  });

  it("put the camp's own fire, cooking, campfire talk and eating in D13's place when the procedure doesn't list them", () => {
    const steps = stepsOf({
      procedure: [step('setup', 'note'), step('tales', 'note'), step('watches', 'watches'), step('night', 'check'), step('sleep', 'roll', { icon: 'rest' })],
      fire: { lightTypeId: 'campfire', note: 'Wet wood smokes.' },
      cooking: { portions: 2 },
      sleep: { difficulties: [{ id: 'easy', name: 'Easy', result: 'good' }], rows: [], modifiers: [{ when: 'campfire-talk', add: 1 }] },
    });
    expect(steps.map((s) => s.id)).toEqual(['setup', 'tales', 'fire', 'cooking', 'talk', 'eat', 'watches', 'night', 'sleep']);
    expect(steps.find((s) => s.part === 'fire')).toMatchObject({ name: 'Campfire', note: 'Wet wood smokes.', step: null });
  });

  it("keep the pack's own place for a step it names, and leave out a step whose optional rule is off (WA1)", () => {
    const camp = { procedure: [step('setup', 'note'), step('eat', 'note'), step('fire', 'note'), step('smoke', 'note', { option: 'smoking' }), step('watches', 'watches')], fire: { lightTypeId: 'campfire' } };
    expect(stepsOf(camp).map((s) => s.id)).toEqual(['setup', 'eat', 'fire', 'watches']);
    expect(stepsOf(camp, { choices: { smoking: 'on' } }).map((s) => s.id)).toEqual(['setup', 'eat', 'fire', 'smoke', 'watches']);
  });

  it('offer eating when the setting has food, even with no cooking rule', () => {
    expect(stepsOf({ procedure: [step('watches', 'watches')] }, { food: true }).map((s) => s.part)).toEqual(['eat', 'watches']);
    expect(stepsOf({ procedure: [step('watches', 'watches')] }).map((s) => s.part)).toEqual(['watches']);
  });

  it("sameAs reuses another mode's camp, its fire and cooking with it", () => {
    const steps = stepsOf({ procedure: [step('watches', 'watches')], fire: { lightTypeId: 'campfire' }, cooking: { portions: 1 } }, {}, 'creep');
    expect(steps.map((s) => s.part)).toEqual(['fire', 'cooking', 'eat', 'watches']);
  });
});

describe('the campfire on the light engine (D16)', () => {
  it('burns from the first bundle, longer for each one added while lit, and starts again after going out', () => {
    const fire = campFire([entry('fuel', { qty: 1, seconds: 100, at: 0 }), entry('fuel', { qty: 2, seconds: 200, at: 50 })], 250);
    expect([fire.lit?.litAt, fire.lit?.seconds, fire.burning, fire.bundles]).toEqual([0, 300, true, 3]);
    expect(campFire([entry('fuel', { qty: 1, seconds: 100, at: 0 })], 100).burning).toBe(false);
    const again = campFire([entry('fuel', { qty: 1, seconds: 100, at: 0 }), entry('fuel', { qty: 1, seconds: 100, at: 500 })], 550);
    expect([again.lit?.litAt, again.burning]).toEqual([500, true]);
    expect(campFire([], 0)).toMatchObject({ lit: null, burning: false, bundles: 0 });
  });
});

describe('the pot and meals (D14, D15)', () => {
  it('a portion eaten comes out of the pot; who ate is known; campfire talk that worked is a sleep fact', () => {
    const entries = [entry('cook', { qty: 3 }), entry('meal', { actorId: 'moss', fromPot: true, foodKind: 'cooked' }), entry('meal', { actorId: 'reed', foodName: 'Fen-bread', foodKind: 'preserved', lineId: 'l' }), entry('talk', { outcome: 'worked' })];
    expect(potOf(entries)).toEqual({ made: 3, left: 2 });
    expect([...mealsOf(entries).keys()]).toEqual(['moss', 'reed']);
    expect(mealWords(mealsOf(entries).get('reed')!)).toBe('Ate Fen-bread (preserved)');
    expect(mealWords(mealsOf(entries).get('moss')!)).toBe('Ate a portion');
    expect(campFlags(entries)).toEqual(['campfire-talk']);
    expect(campFlags([...entries, entry('talk', { outcome: 'failed' })])).toEqual([]);
  });
});
