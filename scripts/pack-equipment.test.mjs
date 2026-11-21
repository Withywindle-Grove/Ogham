// Tests for the pack checker's equipment notes from the independent re-check of pack review area 3 (equipment and
// encumbrance, 2026-11-03; scripts/pack-equipment.mjs): a kit roll the app leaves out, an item named as a bundle
// with no bundle field, and treasure whose category treasureWeights lacks. Warnings only. Every name is made up.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatNotes } from './pack-format.mjs';
import { equipmentNotes } from './pack-equipment.mjs';

const items = [{ id: 'reed-cloak', name: 'Reed cloak', category: 'gear' }];
const kit = (rolls) => ({ items, startingKits: [{ id: 'fen-kit', name: 'Fen kit', items: [], rolls }] });

describe('startingKits rolls the app leaves out', () => {
  // Purpose: a kit roll without a name, a die or rows is dropped by the app without a word, so the checker names
  // each missing part; a whole roll gets no note.
  it('notes a roll missing its name, die or rows, and leaves a whole one alone', () => {
    const whole = { name: 'Cloak', die: 'd6', rows: [{ min: 1, max: 6, items: [{ itemId: 'reed-cloak', qty: 1 }] }] };
    expect(equipmentNotes(kit([whole]))).toEqual([]);
    expect(equipmentNotes(kit([{ die: 'd6', rows: whole.rows }, { name: 'Hat', rows: whole.rows }, { name: 'Boots', die: 'd4' }]))).toEqual([
      'startingKits: "fen-kit", roll 1 has no name; the app leaves the roll out (a roll needs a name, a die and rows [{ min, max, items }]).',
      'startingKits: "fen-kit", roll 2 ("Hat") has no die; the app leaves the roll out (a roll needs a name, a die and rows [{ min, max, items }]).',
      'startingKits: "fen-kit", roll 3 ("Boots") has no rows; the app leaves the roll out (a roll needs a name, a die and rows [{ min, max, items }]).',
    ]);
  });

  // Purpose: a row without whole-number min and max is dropped too, and a roll whose rows are all dropped is left out.
  it('notes rows without whole min and max, and a roll left with none', () => {
    expect(equipmentNotes(kit([{ name: 'Cloak', die: 'd6', rows: [{ min: 1, max: 3, items: [] }, { min: '4', max: 6 }] }]))).toEqual([
      'startingKits: "fen-kit", roll 1 ("Cloak"), row 2 needs whole-number min and max; the app leaves the row out.',
    ]);
    expect(equipmentNotes(kit([{ name: 'Cloak', die: 'd6', rows: [{ items: [] }] }]))).toEqual([
      'startingKits: "fen-kit", roll 1 ("Cloak"), row 1 needs whole-number min and max; the app leaves the row out.',
      'startingKits: "fen-kit", roll 1 ("Cloak") has no row the app can read; the app leaves the roll out.',
    ]);
  });
});

describe('items named as a bundle', () => {
  // Purpose: an item whose name says "(N)" or "bag, pouch or case of N" but has no bundle field gets a note (buying
  // one would add one unit, not N); with a bundle, or a count that isn't a bundle ("(50 ft)", "(1)"), none.
  it('notes "(N)" and "bag/pouch/case of N" names without a bundle', () => {
    const pack = {
      items: [
        { id: 'reed-darts', name: 'Reed darts (12)' },
        { id: 'bog-beads', name: 'Pouch of 20 bog beads' },
        { id: 'tallow', name: 'Case of 6 tallow stubs' },
        { id: 'moss-bag', name: 'Bag of 3 moss cakes' },
        { id: 'fen-torches', name: 'Fen torches (6)', bundle: 6, unitName: 'Fen torch' },
        { id: 'line', name: 'Fishing line (50 ft)' },
        { id: 'one', name: 'Lone candle (1)' },
      ],
    };
    expect(equipmentNotes(pack)).toEqual([
      'items: "reed-darts": the name says 12 ("Reed darts (12)") but there is no bundle; give "bundle": 12 and a unitName, so buying one adds 12.',
      'items: "bog-beads": the name says 20 ("Pouch of 20 bog beads") but there is no bundle; give "bundle": 20 and a unitName, so buying one adds 20.',
      'items: "tallow": the name says 6 ("Case of 6 tallow stubs") but there is no bundle; give "bundle": 6 and a unitName, so buying one adds 6.',
      'items: "moss-bag": the name says 3 ("Bag of 3 moss cakes") but there is no bundle; give "bundle": 3 and a unitName, so buying one adds 3.',
    ]);
  });
});

describe('placed treasure the app would not count (bq3-9)', () => {
  const rulesSets = [{ id: 'r', encumbrance: { mode: 'armour', treasureWeights: { gem: 1, jewel: null } } }];
  const treasureItems = [
    { id: 'marsh-pearl', name: 'Marsh pearl', category: 'gem' },
    { id: 'heron-idol', name: 'Heron idol', category: 'art' },
    { id: 'eel-crown', name: 'Eel crown', category: 'art' },
    { id: 'plain-rope', name: 'Plain rope', category: 'gear' },
  ];
  const locations = [
    { id: 'fen-1', name: 'Sunken hut', type: 'room', treasure: [{ text: 'A pearl', itemId: 'marsh-pearl' }, { text: 'An idol', itemId: 'heron-idol' }] },
    { id: 'fen-2', name: 'Reed shrine', type: 'room', treasure: [{ text: 'A crown', itemId: 'eel-crown' }, { text: 'Coins' }] },
  ];

  // Purpose: when an item placed as treasure (a location's treasure[].itemId) has a category that the rules set's
  // treasureWeights doesn't name, the app wouldn't count it as treasure, so the checker names the category once
  // with its items; a category that's named, and gear never placed as treasure, get no note.
  it('notes a category of placed treasure that treasureWeights lacks, once', () => {
    expect(equipmentNotes({ rulesSets, items: treasureItems, locations })).toEqual([
      'rulesSets: "r": encumbrance.treasureWeights has no "art", but the pack places items of that category as treasure (Heron idol, Eel crown); the app won\'t count them as treasure. Name the category there, or give each item "treasure": true.',
    ]);
  });

  // Purpose: treasure is a category treasureWeights names or an item's `treasure: true` (bq3-9), not where it's
  // placed: a placed item that says `treasure: true` already counts, so it gets no note, even in an unnamed category.
  it('says nothing for a placed item marked treasure: true', () => {
    const marked = treasureItems.map((i) => (i.id === 'heron-idol' || i.id === 'eel-crown' ? { ...i, treasure: true } : i));
    expect(equipmentNotes({ rulesSets, items: marked, locations })).toEqual([]);
  });

  // Purpose: without a treasureWeights map in this file (an adventure pack whose rules set is elsewhere), nothing is said.
  it('says nothing when this file has no treasureWeights', () => {
    expect(equipmentNotes({ items: treasureItems, locations })).toEqual([]);
  });
});

describe("kit rolls' forClasses (eq-9)", () => {
  const roll = { name: 'Cloak', die: 'd6', rows: [{ min: 1, max: 6, items: [{ itemId: 'reed-cloak', qty: 1 }] }] };
  const classes = [{ id: 'lantern-warden', name: 'Lantern Warden' }, { id: 'reed-witch', name: 'Reed witch' }];

  // Purpose: forClasses that names this pack's classes as a list gets no note.
  it('says nothing for a list of the pack\'s class ids', () => {
    expect(equipmentNotes({ ...kit([{ ...roll, forClasses: ['lantern-warden', 'reed-witch'] }]), classes })).toEqual([]);
  });

  // Purpose: forClasses that isn't a list of class ids (one id alone, an empty list, a number) gets a note on its shape.
  it('notes a forClasses that is not a list of class ids', () => {
    const shape = 'startingKits: "fen-kit", roll 1 ("Cloak"): forClasses should be a list of class ids, such as ["<class id>"].';
    for (const forClasses of ['lantern-warden', [], [3]]) expect(equipmentNotes({ ...kit([{ ...roll, forClasses }]), classes })).toEqual([shape]);
  });

  // Purpose: a class id the pack doesn't have is named, since no character would see that roll; a file with no
  // classes (an adventure pack) isn't checked for ids.
  it('names a class id the pack does not have, only when the file has classes', () => {
    expect(equipmentNotes({ ...kit([{ ...roll, forClasses: ['lantern-warden', 'bog-knight'] }]), classes })).toEqual([
      'startingKits: "fen-kit", roll 1 ("Cloak"): forClasses names "bog-knight", which isn\'t a class in this pack; no character of that class will see the roll.',
    ]);
    expect(equipmentNotes(kit([{ ...roll, forClasses: ['bog-knight'] }]))).toEqual([]);
  });
});

describe("kit rolls' distinct (bq-1)", () => {
  const roll = { name: 'Charms', die: 'd4', times: 2, rows: [{ min: 1, max: 4, items: [{ itemId: 'reed-cloak', qty: 1 }] }] };

  // Purpose: distinct as true or false gets no note.
  it('says nothing for true or false', () => {
    expect(equipmentNotes(kit([{ ...roll, distinct: true }, { ...roll, distinct: false }]))).toEqual([]);
  });

  // Purpose: a distinct the app can't read (a word, a number) is named, since repeats would stay allowed.
  it('notes a distinct that is not true or false', () => {
    for (const distinct of ['yes', 1]) {
      expect(equipmentNotes(kit([{ ...roll, distinct }]))).toEqual(['startingKits: "fen-kit", roll 1 ("Charms"): distinct should be true or false; the app reads only true, so the same row can still be picked twice.']);
    }
  });
});

describe('containers by fill and carry bonuses (eq-5, eq-6)', () => {
  // Purpose: a bag by fill is read only as a whole-number pair with a capacity, so the checker names each way it
  // would be misread; a whole pair with a capacity, or equal values, gets no note.
  it('notes a lone, odd or backwards weight pair, and a pair with no capacity', () => {
    const bag = (container, extra = {}) => ({ items: [{ id: 'heron-satchel', name: 'Heron satchel', category: 'gear', container, ...extra }] });
    expect(equipmentNotes(bag({ capacityCoin: 1000, weightEmpty: 0, weightFull: 600 }))).toEqual([]);
    expect(equipmentNotes(bag({ weightEmpty: 40, weightFull: 40 }))).toEqual([]);
    expect(equipmentNotes(bag({ capacityCoin: 900 }, { weightEmpty: 5, weightFull: 60 }))).toEqual([]);
    expect(equipmentNotes(bag({ capacityCoin: 1000, weightFull: 600 }))).toEqual([
      'items: "heron-satchel" gives weightFull but not weightEmpty; the app weighs a bag by fill only with both (equal values for a fixed weight).',
    ]);
    expect(equipmentNotes(bag({ capacityCoin: 1000, weightEmpty: 'none', weightFull: 600 }))).toEqual([
      'items: "heron-satchel": weightEmpty should be a whole number (in the encumbrance unit); the app doesn\'t weigh the bag by fill.',
    ]);
    expect(equipmentNotes(bag({ capacityCoin: 1000, weightEmpty: 600, weightFull: 0 }))).toEqual([
      'items: "heron-satchel": weightFull (0) is less than weightEmpty (600), so the bag gets lighter as it fills.',
    ]);
    expect(equipmentNotes(bag({ weightEmpty: 0, weightFull: 600 }))).toEqual([
      'items: "heron-satchel" weighs by fill but gives no capacityCoin or capacitySlots, so the app can\'t tell how full it is and always counts weightFull.',
    ]);
  });

  // Purpose: a carry bonus counts only while worn or held, so the checker names one that isn't a whole number above 0
  // or sits on an item with no slot; a held item with a whole bonus gets no note.
  it('notes an odd carryBonus, and one on an item that cannot be worn or held', () => {
    const grips = (extra) => ({ items: [{ id: 'ogre-grips', name: 'Ogre grips', category: 'magic-misc', ...extra }] });
    expect(equipmentNotes(grips({ slot: 'hand', carryBonus: 200 }))).toEqual([]);
    expect(equipmentNotes(grips({ slot: 'hand', carryBonus: -5 }))).toEqual([
      'items: "ogre-grips": carryBonus should be a whole number above 0 (in the encumbrance unit); the app leaves it out.',
    ]);
    expect(equipmentNotes(grips({ slot: 'worn', carryBonus: 200 }))).toEqual([]);
    expect(equipmentNotes(grips({ carryBonus: 200 }))).toEqual([
      'items: "ogre-grips" has a carryBonus but no slot (armour, shield, hand or worn), so it can\'t be worn or held in the app and the bonus never counts; "slot": "worn" puts it on without taking a hand.',
    ]);
  });

  // Purpose: the checker accepts the four slots the app knows, `worn` among them (mb-5), and names any other.
  it('accepts slot "worn" and notes a slot the app does not know', () => {
    const ring = (slot) => ({ items: [{ id: 'reed-ring', name: 'Reed ring', category: 'gear', slot }] });
    for (const slot of ['armour', 'shield', 'hand', 'worn']) expect(equipmentNotes(ring(slot))).toEqual([]);
    expect(equipmentNotes(ring('finger'))).toEqual(['items: "reed-ring": slot "finger" isn\'t one the app knows (armour, shield, hand or worn), so it can\'t be put on.']);
  });
});

describe('the manual check pack', () => {
  // Purpose: scripts/fixtures/m5b-review-area-3.fixture.json (the manual check's pack) gives exactly the four
  // equipment notes, so the check in docs/testing.md stays true.
  it('gives one note for each of the five checks', () => {
    const notes = formatNotes(JSON.parse(readFileSync('scripts/fixtures/m5b-review-area-3.fixture.json', 'utf8')));
    expect(notes).toEqual([
      'startingKits: "fen-kit", roll 1 ("Darts") has no die; the app leaves the roll out (a roll needs a name, a die and rows [{ min, max, items }]).',
      'startingKits: "fen-kit", roll 2 ("Coat"): forClasses names "mist-caller", which isn\'t a class in this pack; no character of that class will see the roll.',
      'items: "reed-darts": the name says 12 ("Reed darts (12)") but there is no bundle; give "bundle": 12 and a unitName, so buying one adds 12.',
      'rulesSets: "fen-gear-rules": encumbrance.treasureWeights has no "art", but the pack places items of that category as treasure (Heron idol); the app won\'t count them as treasure. Name the category there, or give each item "treasure": true.',
      // Area 3 order 10 (eq-7): the fixture's second weapon rule names a class category nobody carries, on purpose.
      'rulesSets: "fen-gear-rules", weaponRules 2 ("Hand-cannon") names the class category "iron-born", which no class here carries as weaponProficiencyCategory.',
    ]);
  });
});

describe('wired into the checker', () => {
  // Purpose: the notes reach npm run pack:check through formatNotes, and odd input never throws.
  it('formatNotes carries them, and odd shapes are safe', () => {
    expect(formatNotes({ items: [{ id: 'reed-darts', name: 'Reed darts (12)' }] })).toContain(
      'items: "reed-darts": the name says 12 ("Reed darts (12)") but there is no bundle; give "bundle": 12 and a unitName, so buying one adds 12.',
    );
    for (const odd of [null, 4, 'pack', [], { items: 'x', startingKits: [{ rolls: 'x' }, { rolls: [null, 3] }], locations: [{ treasure: 'x' }], rulesSets: [{ encumbrance: { treasureWeights: 'x' } }] }]) {
      expect(() => equipmentNotes(odd)).not.toThrow();
    }
  });
});

describe('weapon.improvised (R3-12)', () => {
  // Purpose: an improvised weapon isn't a weapon type (no skill pick); the flag is true or false, anything else named.
  it('accepts true and false, and names anything else', () => {
    const pack = (improvised) => ({ items: [{ id: 'reed-pole', name: 'Reed pole', category: 'gear', weapon: { damage: 'd4', improvised } }] });
    expect(equipmentNotes(pack(true))).toEqual([]);
    expect(equipmentNotes(pack(false))).toEqual([]);
    expect(equipmentNotes(pack('yes'))).toEqual(['items: "reed-pole": weapon.improvised should be true or false; it\'s read as not improvised.']);
  });
});
