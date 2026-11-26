import { describe, expect, it } from 'vitest';
import { combineEncumbrance } from './encumbrance.ts';
import type { InventoryLine } from './inventory.ts';
import { amountText, atHandAction, atHandLines, oneUpVerb, countWords, groupPack, markerOf, possessive, roomLeft, shownName, stackable, wornText } from './packView.ts';

// Invented items only (hard rule 2).
let next = 0;
const line = (name: string, extra: Partial<InventoryLine> = {}): InventoryLine => ({
  id: `line-${++next}`,
  campaignId: 'campaign-reedmouth',
  actorId: 'actor-wren',
  locationId: null,
  libraryEntryId: null,
  name,
  category: 'gear',
  weightCoin: null,
  slots: null,
  stack: 1,
  qty: 1,
  containerLineId: null,
  version: 1,
  equipped: false,
  howGot: 'found',
  cost: '',
  notes: '',
  details: {},
  sourcePackId: null,
  sourceEntryId: null,
  chargesLeft: null,
  chargesHidden: false,
  chargesUsed: 0,
  spentShown: false,
  pinned: false,
  atHandHidden: false,
  approval: 'approved',
  perUnits: 1,
  baseArmourId: null,
  ...extra,
});
const rules = combineEncumbrance([{ treasureWeights: { gem: 1, trinket: null } }]);

describe('words for some of a stack (words batch 1, ruled 2026-10-26)', () => {
  it("uses the pack's unitName and pluralName, else the name and ×N", () => {
    const torch = line('Torch', { details: { unitName: 'torch', pluralName: 'torches' } });
    expect(countWords(torch, 1)).toBe('torch');
    expect(countWords(torch, 3)).toBe('3 torches');
    expect(countWords(line('Reed arrow'), 3)).toBe('Reed arrow ×3');
    expect(countWords(line('Lantern'), 1)).toBe('Lantern');
  });

  it('a name stored in lower case shows with a capital first letter; the unit words stay as the pack wrote them', () => {
    // Purpose: the display guard: "bog candle" reads "Bog candle", and "Bog candle ×3" for more, never "bog candle ×3".
    expect(shownName('bog candle')).toBe('Bog candle');
    expect(shownName('Eel trap')).toBe('Eel trap');
    expect(shownName('')).toBe('');
    expect(countWords(line('bog candle'), 3)).toBe('Bog candle ×3');
    expect(countWords(line('bog candle'), 1)).toBe('Bog candle');
    expect(countWords(line('Torch', { details: { unitName: 'torch' } }), 1)).toBe('torch');
  });
});

describe('room left in a container (B19)', () => {
  const sack = line('Sack', { details: { container: { capacityCoin: 200, capacitySlots: 4 } } });
  const inside = [line('Rope', { containerLineId: sack.id, weightCoin: 10, slots: 1, qty: 3, stack: 1 }), line('Chalk', { containerLineId: sack.id, weightCoin: 1, slots: 1, qty: 5, stack: 10 })];
  it('subtracts what is inside, in coins or slots; nothing in other modes or without a capacity', () => {
    expect(roomLeft(sack, [sack, ...inside], 'coin')).toEqual({ left: 165, of: 200 });
    expect(roomLeft(sack, [sack, ...inside], 'slot')).toEqual({ left: 0, of: 4 });
    expect(roomLeft(sack, [sack, ...inside], 'armour')).toBeNull();
    expect(roomLeft(line('Basket', { details: { container: {} } }), [], 'coin')).toBeNull();
  });
});

describe('the Pack screen’s groups (05: by where things are carried)', () => {
  const sack = line('Sack', { details: { container: { capacityCoin: 200 } } });
  const satchel = line('Satchel', { details: { container: { capacityCoin: 100 } } });
  const lines = [
    line('Quilted coat', { equipped: true, details: { slot: 'armour' } }),
    sack,
    line('Pearls', { category: 'gem', qty: 3, containerLineId: sack.id }),
    line('Chalk', { containerLineId: satchel.id }),
    satchel,
    line('Rope'),
  ];

  it('worn and in hand, then one group per container, then everything carried loose; A–Z in each group', () => {
    const groups = groupPack(lines, 'coin', combineEncumbrance([{ ...rules, containers: 'add' }]));
    expect(groups.map((g) => [g.title, g.note ?? '', g.lines.map((l) => l.name)])).toEqual([
      ['Worn and in hand', '', ['Quilted coat']],
      ['In the Sack', 'adds capacity', ['Pearls']],
      ['In the Satchel', 'adds capacity', ['Chalk']],
      ['Carried', '', ['Rope', 'Sack', 'Satchel']],
    ]);
    expect(groupPack(lines, 'coin', rules)[1]!.note).toBe('holds things; doesn’t add capacity');
  });

  it('armour mode: treasure stays where it is, marked counted; ordinary gear goes in a collapsed Gear group', () => {
    const groups = groupPack(lines, 'armour', rules);
    expect(groups.map((g) => [g.title, g.collapsible ?? false, g.lines.map((l) => l.name)])).toEqual([
      ['Worn and in hand', false, ['Quilted coat']],
      ['In the Sack', false, ['Pearls']],
      ['Gear', true, ['Chalk', 'Rope', 'Sack', 'Satchel']],
    ]);
  });

  it('things that are not carried go in an "Other" section, one group per category; with no list, animal and vehicle blocks count', () => {
    const mule = { ...line('Mule'), category: 'animal' };
    const cart = { ...line('Cart'), category: 'vehicle', details: { vehicle: { capacityCoin: 4000 } } };
    const listed = combineEncumbrance([{ ...rules, separateCategories: ['animal', 'vehicle'] }]);
    expect(groupPack([line('Rope'), mule, cart], 'coin', listed, (id) => (id === 'animal' ? 'Animals' : 'Vehicles')).map((g) => [g.title, g.other ?? false, g.lines.map((l) => l.name)])).toEqual([
      ['Carried', false, ['Rope']],
      ['Animals', true, ['Mule']],
      ['Vehicles', true, ['Cart']],
    ]);
    // No list in the rules set: only the vehicle block marks it.
    expect(groupPack([line('Rope'), mule, cart], 'coin', rules).map((g) => g.title)).toEqual(['Carried', 'vehicle']);
  });

  it('the Party stash has only its containers: loose things in one plain list first, then "In the …" per container (N18)', () => {
    const mule = { ...line('Mule'), category: 'animal' };
    const listed = combineEncumbrance([{ ...rules, separateCategories: ['animal'] }]);
    const stash = [...lines.map((l) => ({ ...l, equipped: false })), mule];
    for (const mode of ['coin', 'armour', 'slot', 'none'] as const) {
      expect(groupPack(stash, mode, listed, (id) => id, { stash: true }).map((g) => [g.title, g.collapsible ?? false, g.other ?? false, g.lines.map((l) => l.name)])).toEqual([
        ['', false, false, ['Mule', 'Quilted coat', 'Rope', 'Sack', 'Satchel']],
        ['In the Sack', false, false, ['Pearls']],
        ['In the Satchel', false, false, ['Chalk']],
      ]);
    }
    expect(groupPack([], 'coin', rules, (id) => id, { stash: true })).toEqual([]);
  });

  it('leaves out empty groups', () => {
    expect(groupPack([line('Rope')], 'coin', rules).map((g) => g.title)).toEqual(['Carried']);
    expect(groupPack([], 'coin', rules)).toEqual([]);
  });
});

describe('a row', () => {
  it('marks magic and treasure, from the category', () => {
    expect(markerOf(line('Pearls', { category: 'gem' }), rules)).toBe('treasure');
    expect(markerOf(line('Glow wand', { category: 'magic-wand' }), rules)).toBe('magic');
    expect(markerOf(line('Rope'), rules)).toBeNull();
  });

  // Purpose: an item marked `treasure: true` is treasure whatever its category (bq3-9): the row's marker says so.
  it('marks an item that says treasure: true as treasure', () => {
    expect(markerOf(line('Heron idol', { category: 'art', details: { treasure: true } }), rules)).toBe('treasure');
  });

  it('shows weight or slots in the campaign’s mode, and a dash for nothing', () => {
    expect(amountText(line('Arrows', { weightCoin: 1, qty: 20, stack: 20 }), 'coin', rules)).toBe('20 coins');
    expect(amountText(line('Rations', { slots: 1, stack: 4, qty: 5 }), 'slot', rules)).toBe('2 slots');
    expect(amountText(line('Rope', { slots: 1 }), 'slot', rules)).toBe('1 slot');
    expect(amountText(line('Ring'), 'coin', rules)).toBe('—');
    expect(amountText(line('Pearls', { category: 'gem', qty: 3 }), 'armour', rules)).toBe('3 coins’ weight, counted');
    expect(amountText(line('Rope', { weightCoin: 10 }), 'armour', rules)).toBe('');
    expect(amountText(line('Rope', { weightCoin: 10 }), 'none', rules)).toBe('');
  });

  // Purpose: a bag that weighs by fill (eq-5) shows what it weighs of its full weight and how full it is
  // ("Bag, 300 of 600, half full"); equal weights show as a fixed weight.
  it('shows a bag by fill as "300 of 600, half full"', () => {
    const bag = line('Heron satchel', { weightCoin: 600, details: { container: { capacityCoin: 1000, weightEmpty: 0, weightFull: 600 } } });
    const stones = line('River stones', { weightCoin: 500, containerLineId: bag.id });
    expect(amountText(bag, 'coin', rules, [bag, stones])).toBe('300 of 600, half full');
    expect(amountText(bag, 'coin', rules, [bag])).toBe('0 of 600, empty');
    const fixed = line('Lead box', { weightCoin: 40, details: { container: { capacityCoin: 100, weightEmpty: 40, weightFull: 40 } } });
    expect(amountText(fixed, 'coin', rules, [fixed])).toBe('40 coins');
    expect(amountText(bag, 'armour', rules, [bag, stones])).toBe('');
  });

  it('says worn or in hand, and shows a count only for stackable things', () => {
    expect(wornText(line('Coat', { equipped: true, details: { slot: 'armour' } }))).toBe('Worn');
    expect(wornText(line('Sword', { equipped: true, details: { slot: 'hand' } }))).toBe('In hand');
    expect(wornText(line('Sword'))).toBe('');
    expect(stackable(line('Arrows', { stack: 20 }))).toBe(true);
    expect(stackable(line('Torch', { qty: 3 }))).toBe(true);
    expect(stackable(line('Rope'))).toBe(false);
  });
});

describe('At hand (ruled 2026-10-23)', () => {
  const charges = { dice: {}, rechargeable: false, hidden: false };
  it('fills itself with what’s in hand and worn things with charges; worn armour and loose gear stay on the Pack tab', () => {
    const lines = [
      line('Reed spear', { equipped: true, details: { weapon: { damage: '1d6' } } }),
      line('Quilted coat', { equipped: true, details: { slot: 'armour' } }),
      line('Glow ring', { equipped: true, details: { slot: 'armour', charges: { initial: 3 } } }),
      line('Coil of rope'),
    ];
    expect(atHandLines(lines, charges).map((l) => l.name)).toEqual(['Reed spear', 'Glow ring']);
  });

  it('adds pins, each once; leaves out what the player hid, unless it is pinned', () => {
    const lines = [
      line('Reed spear', { equipped: true, pinned: true, details: { weapon: { damage: '1d6' } } }),
      line('Moss potion', { pinned: true, category: 'potion' }),
      line('Bone knife', { equipped: true, atHandHidden: true, details: { weapon: { damage: '1d4' } } }),
    ];
    expect(atHandLines(lines, charges).map((l) => l.name)).toEqual(['Reed spear', 'Moss potion']);
  });

  // Purpose (Francis, 2026-11-07, on #552): At hand holds only what has an action; a thing with nothing to do (in hand
  // or pinned) stays in its own group.
  it('holds only what has an action: an in-hand lantern with no light and a pinned rope stay out', () => {
    const lines = [
      line('Plain lantern', { equipped: true, details: { slot: 'hand' } }),
      line('Coil of rope', { pinned: true }),
      line('Reed spear', { equipped: true, details: { weapon: { damage: '1d6' } } }),
    ];
    expect(atHandLines(lines, charges).map((l) => l.name)).toEqual(['Reed spear']);
  });

  // Purpose (Design on #552: the category guess accepted): each known category id gives its verb, a `food` field gives
  // Eat, and any other stack falls back to Use; a single thing of no such kind has none.
  it.each([
    ['ammunition', 'Fire'], ['ammo', 'Fire'], ['arrows', 'Fire'], ['bolts', 'Fire'], ['quarrels', 'Fire'], ['shot', 'Fire'], ['bullets', 'Fire'], ['sling-bullets', 'Fire'],
    ['potion', 'Drink'], ['potions', 'Drink'], ['draught', 'Drink'], ['drink', 'Drink'], ['elixir', 'Drink'], ['tonic', 'Drink'], ['philtre', 'Drink'], ['magic-potions', 'Drink'],
    ['food', 'Eat'], ['rations', 'Eat'], ['provisions', 'Eat'],
  ] as const)('category %s says %s', (category, verb) => {
    expect(oneUpVerb({ category, details: {}, stack: 1, qty: 1 })).toBe(verb);
  });
  it('a food field says Eat; any other stack says Use; a single plain thing says nothing', () => {
    expect(oneUpVerb({ category: 'gear', details: { food: 'fresh' }, stack: 1, qty: 1 })).toBe('Eat');
    expect(oneUpVerb({ category: 'gear', details: {}, stack: 12, qty: 6 })).toBe('Use');
    expect(oneUpVerb({ category: 'gear', details: {}, stack: 1, qty: 3 })).toBe('Use');
    expect(oneUpVerb({ category: 'gear', details: {}, stack: 1, qty: 1 })).toBeNull();
    // A kind's word inside another word isn't that kind ("gemstones" is no ammunition).
    expect(oneUpVerb({ category: 'gemstones', details: {}, stack: 1, qty: 1 })).toBeNull();
  });

  // Purpose: each row's action word by kind: Use a charge, Light, Fire for ammunition, Drink for a draught, Eat for food,
  // Use for another stack, for a weapon with nothing to count Wield while it isn't in hand and Attack once it is (ah-2),
  // none for a plain thing.
  it('names each At hand action by the item’s kind', () => {
    const glow = line('Glow ring', { details: { charges: { initial: 3 } } });
    expect(atHandAction(glow, charges)).toBe('charge');
    expect(atHandAction(line('Rushlight', { qty: 3, stack: 10, details: { lightTypeId: 'rush' } }), charges)).toBe('light');
    expect(atHandAction(line('Reed arrows', { category: 'ammunition', qty: 18, stack: 20 }), charges)).toBe('Fire');
    expect(atHandAction(line('Moss draught', { category: 'potion' }), charges)).toBe('Drink');
    expect(atHandAction(line('Dried eel', { details: { food: 'preserved' } }), charges)).toBe('Eat');
    expect(atHandAction(line('Iron spikes', { qty: 6, stack: 12 }), charges)).toBe('Use');
    expect(atHandAction(line('Reed spear', { category: 'weapon' }), charges)).toBe('Wield');
    expect(atHandAction(line('Reed spear', { category: 'weapon', equipped: true, details: { slot: 'hand' } }), charges)).toBe('Attack');
    // A weapon worn (a blade on the worn slot) is ready too: Attack, since Wield would have nothing to do.
    expect(atHandAction(line('Spur blade', { category: 'weapon', equipped: true, details: { slot: 'worn' } }), charges)).toBe('Attack');
    expect(atHandAction(line('Coil of rope'), charges)).toBeNull();
  });
});

describe('a name’s possessive (Home Two’s audit of #50, finding 7; Francis, 26 Nov)', () => {
  // Purpose: a name takes ’s, and a name that ends in s takes the mark alone, so it never reads "Wardens’s".
  it('adds ’s, and after a final s only ’', () => {
    expect(possessive('Wren')).toBe('Wren’s');
    expect(possessive('Wren of the Lantern Wardens')).toBe('Wren of the Lantern Wardens’');
    expect(possessive('the Reed Boots')).toBe('the Reed Boots’');
    expect(possessive('MOSS')).toBe('MOSS’');
  });
});
