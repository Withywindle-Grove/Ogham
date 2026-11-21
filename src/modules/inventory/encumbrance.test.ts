import { describe, expect, it } from 'vitest';
import { bagFill, carriedLoad, combineEncumbrance, fillWords, isTreasure, modesOffered, speedOf, speedUnitOf, toLoadLine, type CarriedLoad, type LoadLine } from './encumbrance.ts';

const loadOf = (carried: CarriedLoad) => ('load' in carried ? carried.load : null);

// Invented numbers only (hard rule 2).
let next = 0;
const line = (name: string, extra: Partial<LoadLine> = {}): LoadLine => ({
  id: `line-${++next}`,
  name,
  category: 'gear',
  qty: 1,
  weightCoin: null,
  slots: null,
  stack: 1,
  containerLineId: null,
  equipped: false,
  container: null,
  armourType: null,
  ...extra,
});

const slotSection = {
  baseSlots: 10,
  tiers: [
    { label: 'Light', maxSlots: 6, effect: 'Normal pace' },
    { label: 'Laden', maxSlots: 10, effect: 'Slowed' },
    { label: 'Straining', maxSlots: 14, effect: 'Crawling' },
  ],
  overMax: "Can't move",
};
const slotRules = combineEncumbrance([{ mode: 'slot', slot: slotSection }]);

const coinRules = combineEncumbrance([
  {
    mode: 'coin',
    coin: {
      maxLoadCoin: 1000,
      miscGearCoin: 50,
      miscGearCategories: ['gear', 'light'],
      tiers: [
        { label: 'Easy', max: 300, effect: 'Full pace' },
        { label: 'Loaded', max: 700, effect: 'Slower' },
        { label: 'Bowed', max: 1000, effect: 'Crawling' },
      ],
      overMax: 'Stuck',
    },
    treasureWeights: { gem: 1, trinket: null },
    containers: 'hold-only',
  },
]);

describe('slot mode', () => {
  const kit = () => [
    line('Iron pot', { slots: 2 }),
    line('Bedroll', { slots: 1 }),
    line('Rope', { slots: 1 }),
    line('Cloak', { slots: 1 }),
    line('Rations', { slots: 1, stack: 4, qty: 8 }),
    line('Candles', { slots: 1, stack: 10, qty: 10 }),
  ];

  it('counts slots per stack and finds the tier: the hand-worked check (8 slots → Laden, 11 → Straining)', () => {
    expect(carriedLoad(kit(), slotRules, 'slot')).toMatchObject({ mode: 'slot', load: 8, capacity: 14, tier: { label: 'Laden', effect: 'Slowed' }, over: false });
    expect(carriedLoad([...kit(), line('Lead ingot', { slots: 3 })], slotRules, 'slot')).toMatchObject({ load: 11, tier: { label: 'Straining' } });
  });

  it('the bar is full at the last tier, whatever baseSlots says (kept for later modifiers)', () => {
    expect(carriedLoad([], combineEncumbrance([{ slot: { ...slotSection, baseSlots: 9 } }]), 'slot')).toMatchObject({ capacity: 14 });
  });

  it('past the last tier is over the max, with the pack’s words', () => {
    expect(carriedLoad([line('Anvil', { slots: 15 })], slotRules, 'slot')).toMatchObject({ load: 15, over: true, overMax: "Can't move", tier: null });
  });

  it('a part-used stack still takes a whole slot; items with no slots count nothing', () => {
    expect(loadOf(carriedLoad([line('Rations', { slots: 1, stack: 4, qty: 5 }), line('Ring')], slotRules, 'slot'))).toBe(2);
  });
});

describe('coin mode', () => {
  it('adds up weights and finds the tier', () => {
    const load = carriedLoad([line('Sword', { weightCoin: 60 }), line('Shield', { weightCoin: 100 }), line('Arrows', { weightCoin: 1, qty: 20 })], coinRules, 'coin');
    expect(load).toMatchObject({ load: 180, capacity: 1000, tier: { label: 'Easy' }, over: false });
  });

  it('adds the flat allowance once for weightless gear of the listed kinds, and nothing for other weightless things', () => {
    const tools = [line('Chalk'), line('Twine'), line('Lantern', { category: 'light' })];
    expect(loadOf(carriedLoad(tools, coinRules, 'coin'))).toBe(50);
    expect(loadOf(carriedLoad([line('Glowing orb', { category: 'magic' })], coinRules, 'coin'))).toBe(0);
  });

  it('over the max load is over, with the pack’s words', () => {
    expect(carriedLoad([line('Boulder', { weightCoin: 1200 })], coinRules, 'coin')).toMatchObject({ over: true, overMax: 'Stuck', tier: null });
  });
});

describe('containers', () => {
  const bag = line('Sack', { weightCoin: 5, container: { capacityCoin: 200, capacitySlots: 2 } });
  const inBag = line('Gold bars', { weightCoin: 100, containerLineId: bag.id });

  it('hold-only: what a container holds still counts, and the max stays put', () => {
    expect(carriedLoad([bag, inBag], coinRules, 'coin')).toMatchObject({ load: 105, capacity: 1000 });
  });

  it('add: a container raises the max and every tier by what it holds', () => {
    const adding = combineEncumbrance([{ ...coinRules, containers: 'add' }]);
    expect(carriedLoad([bag, inBag, line('Anvil', { weightCoin: 300 })], adding, 'coin')).toMatchObject({
      load: 405,
      capacity: 1200,
      tier: { label: 'Easy' },
    });
  });

  it('a bag with a fixed weight always weighs that, and what’s in it never counts', () => {
    const magicBag = line('Bottomless satchel', { weightCoin: 5, container: { fixedWeightCoin: 15 } });
    const deep = line('Statue', { weightCoin: 900, containerLineId: magicBag.id });
    const deeper = line('Pebble', { weightCoin: 1, containerLineId: deep.id });
    expect(loadOf(carriedLoad([magicBag, deep, deeper], coinRules, 'coin'))).toBe(15);
  });
});

describe('armour mode', () => {
  const armourSection = {
    mode: 'armour',
    armour: {
      maxLoadCoin: 500,
      movement: [
        { armour: 'none', withoutTreasure: '100 ft', withTreasure: '70 ft' },
        { armour: 'light', withoutTreasure: '80 ft', withTreasure: '60 ft' },
        { armour: 'heavy', withoutTreasure: '50 ft', withTreasure: '30 ft' },
      ],
    },
    treasureWeights: { gem: 1, trinket: null },
  };
  const armourRules = combineEncumbrance([armourSection]);

  it('only treasure counts: by the pack’s categories, at the item’s weight or else the category’s', () => {
    const load = carriedLoad(
      [line('Pearls', { category: 'gem', qty: 10 }), line('Idol', { category: 'trinket', weightCoin: 40 }), line('Rope', { weightCoin: 10 })],
      armourRules,
      'armour',
      { armour: 'none' },
    );
    expect(load).toMatchObject({ mode: 'armour', load: 50, capacity: 500, carriesTreasure: true, movement: '70 ft', over: false });
  });

  it('the armour worn is read from the equipped armour through the pack’s map; the heaviest counts', () => {
    const mapped = combineEncumbrance([{ ...armourSection, armour: { ...armourSection.armour, armourTypes: { quilted: 'light', 'iron-scale': 'heavy' } } }]);
    const quilt = line('Quilted coat', { equipped: true, armourType: 'quilted' });
    const scale = line('Iron scale', { armourType: 'iron-scale' });
    expect(carriedLoad([quilt, scale], mapped, 'armour')).toMatchObject({ movement: '80 ft' });
    expect(carriedLoad([quilt, { ...scale, equipped: true }], mapped, 'armour')).toMatchObject({ movement: '50 ft' });
    expect(carriedLoad([line('Odd mail', { equipped: true, armourType: 'unknown' })], mapped, 'armour')).toMatchObject({ movement: '100 ft' });
  });

  // Purpose: treasure is a category treasureWeights names or an item marked `treasure: true` (bq3-9), so a marked
  // item in an unnamed category counts (at its own weight) and turns on "carrying treasure".
  it('an item marked treasure: true counts as treasure whatever its category', () => {
    const marked = toLoadLine({ ...line('Heron idol', { category: 'art', weightCoin: 30 }), details: { treasure: true } });
    expect(marked.treasure).toBe(true);
    expect(carriedLoad([marked, line('Rope', { weightCoin: 10 })], armourRules, 'armour', { armour: 'none' })).toMatchObject({ load: 30, carriesTreasure: true, movement: '70 ft' });
    expect(isTreasure({ category: 'art' }, armourRules)).toBe(false);
    expect(isTreasure({ category: 'gem' }, armourRules)).toBe(true);
  });

  it('movement comes from the armour worn and whether any treasure is carried', () => {
    expect(carriedLoad([line('Rope', { weightCoin: 10 })], armourRules, 'armour', { armour: 'heavy' })).toMatchObject({ carriesTreasure: false, movement: '50 ft' });
  });

  // Purpose: a gem in the load suggests Carrying treasure, and the movement is the with-treasure row.
  it('one gem in the load suggests Carrying treasure and the with-treasure movement', () => {
    const load = carriedLoad([line('Marsh pearl', { category: 'gem' })], armourRules, 'armour', { armour: 'none' });
    expect(load).toMatchObject({ treasureSuggested: true, carriesTreasure: true, movement: '70 ft' });
  });

  // Purpose: the GM's switch off restores the without-treasure movement (and speed) while the pack still suggests on.
  it('the GM’s switch off restores the without-treasure movement; the suggestion stays on', () => {
    const load = carriedLoad([line('Marsh pearl', { category: 'gem' })], armourRules, 'armour', { armour: 'none', carryingTreasure: false });
    expect(load).toMatchObject({ treasureSuggested: true, carriesTreasure: false, movement: '100 ft' });
    expect(speedOf(load)).toBe(100);
  });

  // Purpose: the GM's switch on counts as carrying treasure even with none in the load.
  it('the GM’s switch on makes the character carry treasure with none in the load', () => {
    const load = carriedLoad([line('Rope', { weightCoin: 10 })], armourRules, 'armour', { armour: 'none', carryingTreasure: true });
    expect(load).toMatchObject({ treasureSuggested: false, carriesTreasure: true, movement: '70 ft' });
  });

  // Purpose: null means "follow the pack", the same as no switch at all.
  it('a null switch follows the pack', () => {
    const gem = [line('Marsh pearl', { category: 'gem' })];
    expect(carriedLoad(gem, armourRules, 'armour', { armour: 'none', carryingTreasure: null })).toMatchObject({ carriesTreasure: true, movement: '70 ft' });
    expect(carriedLoad([], armourRules, 'armour', { armour: 'none', carryingTreasure: null })).toMatchObject({ carriesTreasure: false, movement: '100 ft' });
  });
});

describe('which modes a campaign can use', () => {
  it('"not tracked" always; the others only when the setting rules give their data', () => {
    expect(modesOffered(combineEncumbrance([]))).toEqual(['none']);
    expect(modesOffered(coinRules)).toEqual(['none', 'coin']);
    expect(modesOffered(combineEncumbrance([{ armour: { movement: [{ armour: 'none', withoutTreasure: '1', withTreasure: '1' }] } }, { slot: slotSection }]))).toEqual([
      'none',
      'armour',
      'slot',
    ]);
  });

  it('setting rules higher in the stack fill in only what they say', () => {
    const combined = combineEncumbrance([{ mode: 'coin', coin: { maxLoadCoin: 1000, tiers: [] } }, { coin: { maxLoadCoin: 1500 } }]);
    expect(combined).toMatchObject({ mode: 'coin', coin: { maxLoadCoin: 1500, tiers: [] } });
  });

  it('not tracked carries no load', () => {
    expect(carriedLoad([line('Anvil', { weightCoin: 900 })], coinRules, 'none')).toEqual({ mode: 'none' });
  });
});

describe('reading a stored line', () => {
  it('takes the container block from the item’s details, and a bag’s fixed weight wherever the pack puts it', () => {
    const base = { id: 'line-x', name: 'Satchel', category: 'gear', qty: 1, weightCoin: 5, slots: 1, stack: 1, containerLineId: null, equipped: false };
    expect(toLoadLine({ ...base, details: { container: { capacityCoin: 300, capacitySlots: 'six' } } }).container).toEqual({ capacityCoin: 300 });
    expect(toLoadLine({ ...base, details: { armourType: 'quilted' } }).armourType).toBe('quilted');
    expect(toLoadLine({ ...base, details: { armourType: 'chosen' } }).armourType).toBeNull();
    expect(toLoadLine({ ...base, details: { container: { capacityCoin: 300 }, fixedWeightCoin: 15 } }).container).toEqual({ capacityCoin: 300, fixedWeightCoin: 15 });
    expect(toLoadLine({ ...base, details: { fixedWeightCoin: 15 } }).container).toEqual({ fixedWeightCoin: 15 });
    expect(toLoadLine({ ...base, details: {} }).container).toBeNull();
  });
});

describe('bundles (2026-10-23)', () => {
  it('units share the bundle’s weight, rounded once to a whole number', () => {
    expect(loadOf(carriedLoad([line('Reed torch', { weightCoin: 30, qty: 6, perUnits: 6 })], coinRules, 'coin'))).toBe(30);
    expect(loadOf(carriedLoad([line('Reed torch', { weightCoin: 30, qty: 4, perUnits: 6 })], coinRules, 'coin'))).toBe(20);
    expect(loadOf(carriedLoad([line('Reed torch', { weightCoin: 10, qty: 1, perUnits: 6 })], coinRules, 'coin'))).toBe(2);
  });
});

describe('speed for the travel budget (M5b; plan m5b-engine-reconcile §2.6)', () => {
  // Purpose: the day's travel budget needs each traveller's speed as a whole number; it comes from the load tier's
  // movement (or the armour row's), and when that can't be told the speed is unknown so the GM is asked.
  const tier = (movement?: string) => ({ label: 'Laden', max: 10, effect: 'Slowed', ...(movement === undefined ? {} : { movement }) });
  const slot = (t: ReturnType<typeof tier> | null, over = false): CarriedLoad => ({ mode: 'slot', load: 4, capacity: 14, tier: t, over, overMax: '' });

  it("reads the tier's movement as a whole number", () => {
    expect(speedOf(slot(tier('120 ft')))).toBe(120);
    expect(speedOf({ mode: 'coin', load: 300, capacity: 1500, tier: tier('90'), over: false, overMax: '' })).toBe(90);
  });

  it("in armour mode, reads the armour row's movement", () => {
    expect(speedOf({ mode: 'armour', load: 0, capacity: 1500, carriesTreasure: true, movement: '60 ft', over: false, overMax: '' })).toBe(60);
    expect(speedOf({ mode: 'armour', load: 0, capacity: 1500, carriesTreasure: false, movement: null, over: false, overMax: '' })).toBeNull();
  });

  it('is unknown with no tracking, no movement on the tier, no number in it, or over the max', () => {
    expect(speedOf({ mode: 'none' })).toBeNull();
    expect(speedOf(slot(tier()))).toBeNull();
    expect(speedOf(slot(tier('Crawling')))).toBeNull();
    expect(speedOf(slot(null, true))).toBeNull();
    expect(speedOf(slot(tier('40 ft'), true))).toBeNull();
  });

  // Purpose (pack review area 2, 2026-11-03): a setting whose weight tiers give movement as the number 30 gives the
  // travel budget a speed of 30; the same for the armour rows' numbers. Text stays the preferred way to write it.
  it('a setting whose weight tiers give movement as the number 30 gives the travel budget a speed of 30', () => {
    const rules = combineEncumbrance([
      {
        slot: { baseSlots: 10, tiers: [{ label: 'Light', maxSlots: 10, effect: '', movement: 30 }], overMax: '' },
        armour: { maxLoadCoin: 500, movement: [{ armour: 'none', withoutTreasure: 40, withTreasure: 20 }] },
      },
    ]);
    expect(rules.slot!.tiers[0]!.movement).toBe('30');
    expect(speedOf(carriedLoad([line('Rope', { slots: 1 })], rules, 'slot'))).toBe(30);
    expect(rules.armour!.movement[0]).toEqual({ armour: 'none', withoutTreasure: '40', withTreasure: '20' });
    expect(speedOf(carriedLoad([], rules, 'armour'))).toBe(40);
  });
});

describe('a bag that weighs by how full it is (eq-5)', () => {
  const satchel = (extra: Partial<LoadLine> = {}) => line('Heron satchel', { weightCoin: 600, container: { capacityCoin: 1000, weightEmpty: 0, weightFull: 600 }, ...extra });

  // Purpose: a half-full bag weighs half-way between empty and full, and what's in it doesn't count.
  it('a half-full bag weighs half-way, and its contents never count', () => {
    const bag = satchel();
    const stones = line('River stones', { weightCoin: 500, containerLineId: bag.id });
    expect(loadOf(carriedLoad([bag, stones], coinRules, 'coin'))).toBe(300);
    expect(bagFill(bag, [bag, stones], 'coin')).toEqual({ weight: 300, full: 600, fill: 0.5 });
  });

  // Purpose: an empty bag weighs its empty weight; a bag past its capacity weighs no more than full.
  it('empty weighs the empty weight; overfull weighs full', () => {
    const bag = satchel({ container: { capacityCoin: 1000, weightEmpty: 20, weightFull: 600 } });
    expect(loadOf(carriedLoad([bag], coinRules, 'coin'))).toBe(20);
    const anvil = line('Anvil', { weightCoin: 5000, containerLineId: bag.id });
    expect(loadOf(carriedLoad([bag, anvil], coinRules, 'coin'))).toBe(600);
  });

  // Purpose: what's inside a sack inside the bag fills the bag too, and none of it counts on its own.
  it('fills from everything inside it, at any depth', () => {
    const bag = satchel();
    const sack = line('Sack', { weightCoin: 50, container: { capacityCoin: 200 }, containerLineId: bag.id });
    const bars = line('Gold bars', { weightCoin: 200, containerLineId: sack.id });
    expect(loadOf(carriedLoad([bag, sack, bars], coinRules, 'coin'))).toBe(150);
  });

  // Purpose: equal empty and full weights mean the bag always weighs that.
  it('equal values are a fixed weight', () => {
    const bag = satchel({ container: { capacityCoin: 1000, weightEmpty: 40, weightFull: 40 } });
    const stones = line('River stones', { weightCoin: 700, containerLineId: bag.id });
    expect(loadOf(carriedLoad([bag, stones], coinRules, 'coin'))).toBe(40);
  });

  // Purpose: a bag with no capacity can't tell how full it is, so it weighs full (the safe side).
  it('with no capacity it weighs full', () => {
    const bag = satchel({ container: { weightEmpty: 0, weightFull: 600 } });
    expect(loadOf(carriedLoad([bag], coinRules, 'coin'))).toBe(600);
  });

  // Purpose: the weights by fill come before a fixed weight the pack also gives (for older readers).
  it('beats a fixed weight on the same bag', () => {
    const bag = satchel({ container: { capacityCoin: 1000, weightEmpty: 0, weightFull: 600, fixedWeightCoin: 600 } });
    expect(loadOf(carriedLoad([bag], coinRules, 'coin'))).toBe(0);
  });

  // Purpose: in slot mode the same reading uses slots: the contents' slots over the bag's slot capacity.
  it('slot mode: weighs in slots by the slots inside', () => {
    const bag = line('Reed creel', { slots: 4, container: { capacitySlots: 6, weightEmpty: 1, weightFull: 4 } });
    const pots = line('Clay pots', { slots: 1, qty: 2, containerLineId: bag.id });
    expect(loadOf(carriedLoad([bag, pots], slotRules, 'slot'))).toBe(2);
  });

  // Purpose: a bag by fill adds no room under "containers add", since its contents already don't count.
  it('adds no room under containers add', () => {
    const adding = combineEncumbrance([{ ...coinRules, containers: 'add' }]);
    expect(carriedLoad([satchel()], adding, 'coin')).toMatchObject({ capacity: 1000 });
  });

  // Purpose: the pack may write the weights next to the container block, as it may a fixed weight.
  it('reads the weights inside the container block or next to it', () => {
    const base = { id: 'line-y', name: 'Satchel', category: 'gear', qty: 1, weightCoin: 600, slots: 1, stack: 1, containerLineId: null, equipped: false };
    expect(toLoadLine({ ...base, details: { container: { capacityCoin: 900, weightEmpty: 0, weightFull: 600 } } }).container).toEqual({ capacityCoin: 900, weightEmpty: 0, weightFull: 600 });
    expect(toLoadLine({ ...base, details: { container: { capacityCoin: 900 }, weightEmpty: 5, weightFull: 60 } }).container).toEqual({ capacityCoin: 900, weightEmpty: 5, weightFull: 60 });
  });

  // Purpose: the row's words for how full the bag is.
  it('says how full in words', () => {
    expect([0, 0.05, 0.25, 0.5, 0.75, 0.95, 1].map(fillWords)).toEqual(['empty', 'nearly empty', 'a quarter full', 'half full', 'three quarters full', 'nearly full', 'full']);
  });
});

describe('an item that raises the carry limit (eq-6)', () => {
  const grips = (equipped: boolean) => line('Ogre grips', { weightCoin: 10, equipped, carryBonus: 200 });

  // Purpose: gauntlets raise the limit only while worn, and the load names them.
  it('raises the max and every tier only while worn or held, and names the item', () => {
    const anvil = line('Anvil', { weightCoin: 400 });
    expect(carriedLoad([grips(false), anvil], coinRules, 'coin')).toMatchObject({ capacity: 1000, tier: { label: 'Loaded' } });
    expect(carriedLoad([grips(false), anvil], coinRules, 'coin')).not.toHaveProperty('bonuses');
    expect(carriedLoad([grips(true), anvil], coinRules, 'coin')).toMatchObject({ capacity: 1200, tier: { label: 'Easy' }, bonuses: [{ name: 'Ogre grips', amount: 200 }] });
  });

  // Purpose: in slot mode the bonus is slots, and in armour mode it raises the treasure limit.
  it('works in slot and armour modes too', () => {
    const strap = line('Bearer strap', { slots: 1, equipped: true, carryBonus: 2 });
    expect(carriedLoad([strap], slotRules, 'slot')).toMatchObject({ capacity: 16 });
    const armourRules = combineEncumbrance([{ mode: 'armour', armour: { maxLoadCoin: 500, movement: [{ armour: 'none', withoutTreasure: '100 ft', withTreasure: '70 ft' }] }, treasureWeights: { gem: 1 } }]);
    expect(carriedLoad([grips(true)], armourRules, 'armour')).toMatchObject({ capacity: 700, bonuses: [{ name: 'Ogre grips', amount: 200 }] });
  });

  // Purpose: the item's carryBonus is read from its details, whole numbers above 0 only.
  it('reads carryBonus from the item, whole and above 0', () => {
    const base = { id: 'line-z', name: 'Ogre grips', category: 'magic-misc', qty: 1, weightCoin: 10, slots: 1, stack: 1, containerLineId: null, equipped: true };
    expect(toLoadLine({ ...base, details: { carryBonus: 200 } }).carryBonus).toBe(200);
    expect(toLoadLine({ ...base, details: { carryBonus: 'lots' } })).not.toHaveProperty('carryBonus');
    expect(toLoadLine({ ...base, details: { carryBonus: 0 } })).not.toHaveProperty('carryBonus');
  });
});

describe('the speed’s unit (dec-13 C10, the Player screen’s Movement card)', () => {
  const armoured = (movement: string): CarriedLoad => ({ mode: 'armour', load: 0, capacity: null, carriesTreasure: false, movement, over: false, overMax: '' });

  // Purpose: the unit is the one short word after the speed, in the pack's words ("120 paces" gives "paces").
  it('reads the one word after the speed', () => {
    expect(speedUnitOf(armoured('120 paces'))).toBe('paces');
    expect(speedUnitOf(armoured('125 ft'))).toBe('ft');
    expect(speedUnitOf(armoured('40 paces (in a fight)'))).toBe('paces');
  });

  // Purpose: the unit stops at "/", so a movement written as two figures ("125 ft / 41 ft") gives "ft", not "ft /".
  it('stops at a "/"', () => {
    expect(speedUnitOf(armoured('125 ft / 41 ft'))).toBe('ft');
  });

  // Purpose: words after the unit are never taken as the unit: "30 per round" gives none, and so does a long word.
  it('takes no trailing words and no long word as the unit', () => {
    expect(speedUnitOf(armoured('30 per round'))).toBe('');
    expect(speedUnitOf(armoured('30 squaresandsquaresandsquares'))).toBe('');
  });

  // Purpose: a figure with a comma or a point gives no unit (it fails safe), and so does a bare number.
  it('gives none for a figure with a comma or a point, or a bare number', () => {
    expect(speedUnitOf(armoured('1,200 ft'))).toBe('');
    expect(speedUnitOf(armoured('2.5 mi'))).toBe('');
    expect(speedUnitOf(armoured('30'))).toBe('');
  });
});
