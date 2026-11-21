// Starting gear's money (docs/05 "Starting money"; ruled 2026-10-25). Invented coins and kits.
import { describe, expect, it } from 'vitest';
import {
  nextTakeWords, pickFootWords, pickNames, pickRowWords, takenLines, coinsOf, gearHint, gearSignature, gearProblem, kitContents, kitPrice, kitRolls, kitsFor, kitTaken, moneyCoin, moneyUsualOf, noRollPicks, priceOf, purchasesOf, rangeWords, kitsToPick, givenGearOf, readMoney, shopOpen, shortOf, showMoney, startingEquipment, rollMeta, rollTitle, rowTimes, tapRollGroupRow, tapRollRow, untappedRoll, weightWords } from './startingGear.ts';
import { resolveRules } from '../library/options.ts';

const coins = coinsOf([{ currency: [{ key: 'sp', label: 'Silver', valueInBase: 10 }, { key: 'gp', label: 'Gold', valueInBase: 100 }, { key: 'cp', label: 'Copper', valueInBase: 1 }] }]);
const gp = moneyCoin('3d6 × 10 gp', coins);

describe('starting money', () => {
  // Purpose: the review and the GM's card read one flag to say "the usual (not rolled)" (cw-11); a record from before has
  // no flag and was typed, so it reads as rolled.
  it('says the coin is the usual only when the record says so and holds a number', () => {
    expect(moneyUsualOf({ startingMoney: 100, moneyTouched: false })).toBe(true);
    expect(moneyUsualOf({ startingMoney: 110, moneyTouched: true })).toBe(false);
    expect(moneyUsualOf({ startingMoney: 100 })).toBe(false);
    expect(moneyUsualOf({ moneyTouched: false })).toBe(false);
    expect(moneyUsualOf(null)).toBe(false);
  });

  it("reads the setting's coins (biggest first) and the coin the starting money is counted in", () => {
    expect(coins.map((c) => c.key)).toEqual(['gp', 'sp', 'cp']);
    expect(gp.key).toBe('gp');
    expect(moneyCoin('2d6 × 10 Silver', coins).key).toBe('sp');
    expect(moneyCoin('3d6 × 10 shells', [])).toEqual({ key: 'shells', label: 'shells', valueInBase: 1 });
  });

  it('prices items and kits in base coins; an unknown coin means no price', () => {
    expect(priceOf({ gp: 1, sp: 5 }, coins, gp)).toBe(150);
    expect(priceOf(3, coins, gp)).toBe(300);
    expect(priceOf({ pearls: 2 }, coins, gp)).toBeNull();
    expect(priceOf(undefined, coins, gp)).toBeNull();
    expect(kitPrice({ costGp: 20 }, coins, gp)).toBe(2000);
  });

  it('shows amounts in the money’s coin, or broken down when not whole; over shows with a minus', () => {
    expect(showMoney(4500, coins, gp)).toBe('45 gp');
    expect(showMoney(1250, coins, gp)).toBe('12 gp 5 sp');
    expect(showMoney(-150, coins, gp)).toBe('−1 gp 5 sp');
  });

  it("offers the kits for the class, and the kits that name no class", () => {
    const kits = [
      { packEntryId: 'warden-kit', data: { classIds: ['lantern-warden'] } },
      { packEntryId: 'any-kit', data: {} },
      { packEntryId: 'mage-kit', data: { classIds: ['bog-mage'] } },
    ];
    expect(kitsFor(kits, 'lantern-warden').map((k) => k.packEntryId)).toEqual(['warden-kit', 'any-kit']);
    // Class kits only (cw-9): another class's kit is never offered.
    expect(kitsFor(kits, 'bog-mage').map((k) => k.packEntryId)).toEqual(['any-kit', 'mage-kit']);
  });

  it('reads a rolled kit: its rolls, ranges as words, and what the rows picked add to its own items', () => {
    const kit = {
      items: [{ itemId: 'reed-lamp', qty: 2 }, { itemId: 'rope' }, { qty: 3 }],
      rolls: [
        { name: 'Armour', die: 'd6', rows: [{ min: 1, max: 3, items: [] }, { min: 4, max: 6, items: [{ itemId: 'quilted-coat', qty: 1 }] }] },
        { name: 'Weapons', die: 'd4', times: 2, rows: [{ min: 1, max: 1, items: [{ itemId: 'hooked-staff' }] }, { min: 2, max: 4, items: [{ itemId: 'sling' }] }] },
        { name: 'Broken', rows: [] },
      ],
    };
    expect(kitContents(kit)).toEqual([
      { itemId: 'reed-lamp', qty: 2 },
      { itemId: 'rope', qty: 1 },
    ]);
    expect(kitRolls(kit).map((r) => [r.name, r.times, r.rows.map(rangeWords)])).toEqual([
      ['Armour', 1, ['1–3', '4–6']],
      ['Weapons', 2, ['1', '2–4']],
    ]);
    expect(kitTaken(kit, [[1], [0, 1]]).map((l) => l.itemId)).toEqual(['reed-lamp', 'rope', 'quilted-coat', 'hooked-staff', 'sling']);
    expect(kitTaken(kit, [[0], [1, 1]]).map((l) => l.itemId)).toEqual(['reed-lamp', 'rope', 'sling', 'sling']);
  });
});

describe('what the shopping bought', () => {
  it('reads each purchase with its price and lines; an older name-only entry is listed with nothing to refund', () => {
    expect(purchasesOf([{ label: "Warden's kit", price: 30, lines: [{ id: 'line-1', qty: 2 }, { id: 7, qty: 1 }] }, 'Eel spear', null, { price: 3 }])).toEqual([
      { label: "Warden's kit", price: 30, lines: [{ id: 'line-1', qty: 2 }] },
      { label: 'Eel spear', price: 0, lines: [] },
    ]);
    expect(purchasesOf(undefined)).toEqual([]);
  });

  it("keeps a kit's id and a rolled kit's tapped rows (the Gear step reads them back); bad picks are dropped", () => {
    expect(purchasesOf([{ label: "Fen walker's kit", price: 0, lines: [], kitId: 'fen-kit', picks: [[1], [0, 0]] }])).toEqual([{ label: "Fen walker's kit", price: 0, lines: [], kitId: 'fen-kit', picks: [[1], [0, 0]] }]);
    expect(purchasesOf([{ label: 'Odd', price: 0, lines: [], picks: [['x']] }])).toEqual([{ label: 'Odd', price: 0, lines: [] }]);
  });
});

// The Gear step (m5b-0c slice 5; cr-14). Invented coins, kits and weights.
describe('the Gear step', () => {
  const show = (base: number) => showMoney(base, coins, gp);

  it('reads the money typed as a whole number, or nothing', () => {
    expect(readMoney(' 120 ')).toBe(120);
    expect(readMoney('')).toBeNull();
    expect(readMoney('12.5')).toBeNull();
    expect(readMoney('-3')).toBeNull();
  });

  it('Next checks only overspending; with no money typed it goes on (the purse starts at 0, ruled 2026-11-02)', () => {
    expect(gearProblem({ moneyRoll: '3d6 × 10 gp', money: null, left: 0, show })).toBeNull();
    expect(gearProblem({ moneyRoll: '3d6 × 10 gp', money: 10, left: -1200, show })).toBe('12 gp short: put something back.');
    expect(gearProblem({ moneyRoll: '3d6 × 10 gp', money: 10, left: 0, show })).toBeNull();
    // A setting with no money roll: nothing to type; a character may set out with nothing.
    expect(gearProblem({ moneyRoll: '', money: null, left: 0, show })).toBeNull();
  });

  it('a paid thing answers what is short instead of being taken; a free one always fits', () => {
    expect(shortOf(0, -500, false, show)).toBeNull();
    expect(shortOf(300, 1000, false, show)).toBe('Type your starting money first.');
    expect(shortOf(1250, 1000, true, show)).toBe('2 gp 5 sp short.');
    expect(shortOf(1000, 1000, true, show)).toBeNull();
  });

  it('says what is taken in the hint, and weighs things in the campaign mode', () => {
    expect(gearHint(1, 0)).toBe('1 kit, nothing bought');
    // Purpose (cs-22, 21-F1 and 21-F2): no kit says "yet", things bought are "things", and a pick table's count sits between.
    expect(gearHint(0, 0)).toBe('No kit yet, nothing bought');
    expect(gearHint(1, 2, [{ taken: 1, upTo: 2 }])).toBe('1 kit, 1 of 2 picked, 2 things bought');
    expect(gearHint(2, 3)).toBe('2 kits, 3 things bought');
    expect(gearHint(1, 1)).toBe('1 kit, 1 thing bought');
    const lines = [
      { weightCoin: 30, slots: 1, qty: 1 },
      { weightCoin: 20, slots: 1, qty: 3 },
      { weightCoin: null, slots: null, qty: 1 },
    ];
    expect(weightWords(lines, 'coin')).toBe('90 coins');
    expect(weightWords(lines, 'slot')).toBe('4 slots');
    expect(weightWords(lines, 'none')).toBe('');
    expect(weightWords([{ weightCoin: null, slots: null, qty: 2 }], 'coin')).toBe('');
  });

  it("a rolled kit's rows are tapped one per roll and time: the first untapped roll is named; a second tap unpicks", () => {
    const kit = {
      rolls: [
        { name: 'Armour', die: 'd6', rows: [{ min: 1, max: 3, items: [] }, { min: 4, max: 6, items: [{ itemId: 'quilted-coat' }] }] },
        { name: 'Weapons', die: 'd4', times: 2, rows: [{ min: 1, max: 4, items: [{ itemId: 'hooked-staff' }] }] },
      ],
    };
    let picks = noRollPicks(kit);
    expect(picks).toEqual([[undefined], [undefined, undefined]]);
    expect(untappedRoll(kit, picks)).toBe('Armour');
    picks = tapRollRow(picks, 0, 0, 1);
    expect(untappedRoll(kit, picks)).toBe('Weapons');
    picks = tapRollRow(tapRollRow(picks, 1, 0, 0), 1, 1, 0);
    expect(untappedRoll(kit, picks)).toBeNull();
    expect(picks).toEqual([[1], [0, 0]]);
    // The same row again unpicks it.
    expect(tapRollRow(picks, 0, 0, 1)).toEqual([[undefined], [0, 0]]);
    expect(untappedRoll({}, [])).toBeNull();
  });

  it('two same-table rolls fill from one table: two rows tapped, the same row twice, a third tap explained (ct3-6)', () => {
    // Purpose: "Roll d4 twice · pick 2" is one table; each tap fills the next roll, a tapped row can be tapped again
    // while a roll is left (✓✓), and a full table says why instead of changing.
    const roll = { name: 'Weapons', die: 'd4', times: 2 };
    expect(rollTitle(roll)).toBe('Weapons: roll d4 twice, pick 2');
    expect(rollTitle({ ...roll, times: 1 })).toBe('Weapons: roll d4');
    expect(rollTitle({ ...roll, times: 3 })).toBe('Weapons: roll d4 3 times, pick 3');
    let picks: (number | undefined)[][] = [[undefined], [undefined, undefined]];
    expect(rollMeta(roll, picks[1])).toBe('tap your results');
    picks = tapRollGroupRow(picks, 1, 2).picks;
    expect(picks).toEqual([[undefined], [2, undefined]]);
    expect(rollMeta(roll, picks[1])).toBe('1 of 2 tapped');
    // Another row fills the second roll.
    const two = tapRollGroupRow(picks, 1, 0).picks;
    expect(two).toEqual([[undefined], [2, 0]]);
    expect(rollMeta(roll, two[1])).toBe('2 of 2 tapped');
    // Full: a third row isn't taken, and the tap says why.
    expect(tapRollGroupRow(two, 1, 1)).toEqual({ picks: two, problem: '2 of 2 tapped: untap one first.' });
    // A tapped row when full is untapped.
    expect(tapRollGroupRow(two, 1, 0).picks).toEqual([[undefined], [2, undefined]]);
    // The same row again while a roll is left: tapped twice (✓✓); once more, both untapped.
    const twice = tapRollGroupRow(picks, 1, 2).picks;
    expect(twice).toEqual([[undefined], [2, 2]]);
    expect(rowTimes(twice, 1, 2)).toBe(2);
    expect(tapRollGroupRow(twice, 1, 2).picks).toEqual([[undefined], [undefined, undefined]]);
    // A roll made once, as before: a second tap on its row untaps it; another row moves the tap.
    expect(tapRollGroupRow([[1], [undefined, undefined]], 0, 1).picks).toEqual([[undefined], [undefined, undefined]]);
    expect(tapRollGroupRow([[1], [undefined, undefined]], 0, 0)).toEqual({ picks: [[0], [undefined, undefined]], problem: null });
  });

  it('a roll marked distinct: a picked row tapped again untaps at once, with no message (bq-1, sq-3)', () => {
    // Purpose: where the book says two different ones, the same row can't be picked twice: a second tap untaps it
    // at once, while a roll is left or not; repeats stay allowed without `distinct`.
    const kit = { rolls: [{ name: 'Charms', die: 'd4', times: 2, distinct: true, rows: [{ min: 1, max: 2, items: [] }, { min: 3, max: 4, items: [] }] }] };
    expect(kitRolls(kit)[0]?.distinct).toBe(true);
    expect(kitRolls({ rolls: [{ ...kit.rolls[0], distinct: undefined }] })[0]?.distinct).toBeUndefined();
    const one = tapRollGroupRow([[undefined, undefined]], 0, 1, true).picks;
    expect(one).toEqual([[1, undefined]]);
    expect(tapRollGroupRow(one, 0, 1, true)).toEqual({ picks: [[undefined, undefined]], problem: null });
    expect(tapRollGroupRow(one, 0, 1, false).picks).toEqual([[1, 1]]);
    const both = tapRollGroupRow(one, 0, 0, true).picks;
    expect(both).toEqual([[1, 0]]);
    expect(tapRollGroupRow(both, 0, 1, true)).toEqual({ picks: [[undefined, 0]], problem: null });
  });
});

describe('no shop and given gear (follow-up A, cf-4)', () => {
  const rules = { startingMoney: '3d6 gp', byOption: { 'market=off': { startingGear: { shop: false }, startingEquipment: ['rope', 'lantern', 'rope'] } } };

  it("hides the shop only when the resolved startingGear.shop is false, read through the campaign's options", () => {
    expect(shopOpen([resolveRules(rules, {})])).toBe(true);
    expect(shopOpen([resolveRules(rules, { market: 'on' })])).toBe(true);
    expect(shopOpen([resolveRules(rules, { market: 'off' })])).toBe(false);
    expect(shopOpen([{ startingGear: { shop: false } }, { startingGear: { shop: true } }])).toBe(true);
    expect(shopOpen([])).toBe(true);
  });

  it('reads startingEquipment as item lines (a repeated id is two), the top rules set first; nothing without it', () => {
    expect(startingEquipment([resolveRules(rules, { market: 'off' })])).toEqual([{ itemId: 'rope', qty: 2 }, { itemId: 'lantern', qty: 1 }]);
    expect(startingEquipment([resolveRules(rules, {})])).toEqual([]);
    expect(startingEquipment([{ startingEquipment: 'a rope' }])).toEqual([]);
    expect(startingEquipment([{ startingEquipment: ['rope', 3, ''] }])).toEqual([{ itemId: 'rope', qty: 1 }]);
  });

  it('knows whether the given gear is already in the pack from the creation record', () => {
    expect(givenGearOf({})).toBeNull();
    expect(givenGearOf({ givenGear: [] })).toEqual([]);
    expect(givenGearOf({ givenGear: [{ id: 'line-1', qty: 2 }, { id: 3 }] })).toEqual([{ id: 'line-1', qty: 2 }]);
  });
});

// Purpose (Design, 2026-11-07): Gear's heading reads how many kits a character may take from the pack's
// `creation.kits.pick`; absent (every pack today) it is 1, and a value that isn't a positive whole number reads as 1.
describe('kits to pick (creation.kits.pick)', () => {
  it('is 1 when absent, the set value when there is one (the top rules set first), else 1', () => {
    expect(kitsToPick([])).toBe(1);
    expect(kitsToPick([{ startingGear: { shop: true } }])).toBe(1);
    expect(kitsToPick([{ creation: { kits: { pick: 2 } } }])).toBe(2);
    expect(kitsToPick([{ creation: { kits: { pick: 2 } } }, { creation: { kits: { pick: 3 } } }])).toBe(3);
    expect(kitsToPick([{ creation: { kits: { pick: 0 } } }])).toBe(1);
    expect(kitsToPick([{ creation: { kits: { pick: 'two' } } }])).toBe(1);
  });
});

describe('gearSignature (creation follow-up: Back to review while nothing changed)', () => {
  const kit = { label: "Warden's kit", price: 0, lines: [{ id: 'line-1', qty: 1 }], kitId: 'warden-kit', picks: [[2]] };
  const record = { bought: [kit], spentBase: 0, givenPicks: { 'fen-odds': [{ row: 1, lines: [{ id: 'line-9', qty: 1 }] }] }, trinket: { tableId: 't', lineId: 'line-5', text: 'A warm pebble', rolled: 11 } };
  const coin = { shown: '120', usual: false };

  // Purpose: the same decisions read the same, even when the pack lines behind them were renewed.
  it('reads the same for the same decisions, whatever the pack lines’ ids', () => {
    const renewed = { ...record, bought: [{ ...kit, lines: [{ id: 'line-77', qty: 1 }] }], givenPicks: { 'fen-odds': [{ row: 1, lines: [{ id: 'line-78', qty: 1 }] }] }, trinket: { ...record.trinket, lineId: 'line-79' } };
    expect(gearSignature(renewed, coin)).toBe(gearSignature(record, coin));
  });

  // Purpose: any decision the player can make on Gear changes it: the coin, a kit or purchase, a kit's rolls, a pick
  // row, the trinket, and the coin going from the untouched average to touched.
  it('changes with the coin, a purchase, a kit’s rolls, a pick row, the trinket or the coin’s touch', () => {
    const was = gearSignature(record, coin);
    expect(gearSignature(record, { shown: '130', usual: false })).not.toBe(was);
    expect(gearSignature(record, { shown: '120', usual: true })).not.toBe(was);
    expect(gearSignature({ ...record, bought: [] }, coin)).not.toBe(was);
    expect(gearSignature({ ...record, bought: [{ ...kit, picks: [[3]] }] }, coin)).not.toBe(was);
    expect(gearSignature({ ...record, givenPicks: {} }, coin)).not.toBe(was);
    expect(gearSignature({ ...record, trinket: undefined }, coin)).not.toBe(was);
  });
});

describe("Next's words for a pick table's marks (cs-42, the lead's words)", () => {
  // Purpose: the toast says what this Next did, in figures and the table's own name: taken only, put back only, or both.
  it('says taken, put back, or both', () => {
    expect(nextTakeWords('Odds and ends', 2, 0)).toBe('2 taken from Odds and ends.');
    expect(nextTakeWords('Odds and ends', 0, 1)).toBe('1 put back in Odds and ends.');
    expect(nextTakeWords('Odds and ends', 2, 1)).toBe('2 taken, 1 put back in Odds and ends.');
  });
});

describe("the words of a pick table's row and its sheet's foot (cts-1, cts-3; one summed list, the plan's ⚑ 4)", () => {
  // Invented things: a row of 2 eel hooks, single tallow candles (pieces), a one-off by name.
  const rows = [
    { items: [{ itemId: 'reed-rope', qty: 1 }] },
    { items: [{ itemId: 'eel-hooks', qty: 2 }] },
    { items: [{ itemId: 'tallow-candle', qty: 1, units: 3 }] },
    { items: [{ itemId: 'reed-rope', qty: 1 }, { itemId: 'storm-matches', qty: 1 }] },
    { items: [{ itemId: '', qty: 1, name: 'Lucky eel tooth' }] },
  ];
  const names: Record<string, string> = { 'reed-rope': 'Reed rope', 'eel-hooks': 'Eel hooks', 'tallow-candle': 'Tallow candles', 'storm-matches': 'Storm matches' };
  const nameOf = (l: { itemId: string; qty: number; units?: number; name?: string }) => {
    const name = l.itemId ? names[l.itemId] : l.name;
    if (!name) return undefined;
    const n = l.units ?? l.qty;
    return n > 1 ? `${name} ×${n}` : name;
  };
  const pick = { tableId: 'travelling-odds', upTo: 4 };
  const twenty = Array.from({ length: 20 }, (_, i) => rows[i % rows.length]!);

  // Purpose: with nothing taken the row reads "0 of 4 picked. 20 to choose from".
  it('reads "0 of 4 picked. 20 to choose from" with nothing taken', () => {
    expect(pickRowWords(pick, twenty, [], nameOf)).toBe('0 of 4 picked. 20 to choose from');
  });

  // Purpose: once something is taken the row names it ("4 of 4 picked: …") and no longer says "to choose from".
  it('names what was taken, with no "to choose from"', () => {
    const words = pickRowWords(pick, twenty, [0, 1, 1, 2], nameOf);
    expect(words).toBe('4 of 4 picked: Reed rope, Eel hooks ×4, Tallow candles ×3');
    expect(words).not.toContain('to choose from');
  });

  // Purpose: a row of 2 taken twice reads "×4", never "×2 ×2"; a thing two rows give is one name with its sum.
  it('sums a row of 2 taken twice to "×4", and a thing two rows give', () => {
    expect(pickRowWords(pick, rows, [1, 1], nameOf)).toBe('2 of 4 picked: Eel hooks ×4');
    expect(pickRowWords(pick, rows, [0, 3], nameOf)).toBe('2 of 4 picked: Reed rope ×2, Storm matches');
    expect(pickRowWords(pick, rows, [2, 2], nameOf)).toBe('2 of 4 picked: Tallow candles ×6');
    expect(takenLines(rows, [1, 1])).toEqual([{ itemId: 'eel-hooks', qty: 4 }]);
    // The rows themselves are left as they are.
    expect(rows[1]!.items[0]!.qty).toBe(2);
  });

  // Purpose: every name is listed, in the order taken: no "first three, then …" in the words (the row clamps on screen).
  it('lists every name, in the order taken', () => {
    expect(pickNames(rows, [4, 2, 0, 1, 3], nameOf)).toEqual(['Lucky eel tooth', 'Tallow candles ×3', 'Reed rope ×2', 'Eel hooks ×2', 'Storm matches']);
    expect(pickRowWords({ tableId: 'odds', upTo: 5 }, rows, [4, 2, 0, 1, 3], nameOf)).toBe(
      '5 of 5 picked: Lucky eel tooth, Tallow candles ×3, Reed rope ×2, Eel hooks ×2, Storm matches',
    );
  });

  // Purpose: the sheet's foot uses the same summed list: "0 of 4 marked", then "4 of 4 marked: …".
  it("words the sheet's foot from the same list", () => {
    expect(pickFootWords(pick, rows, [], nameOf)).toBe('0 of 4 marked');
    expect(pickFootWords(pick, rows, [0, 1, 1, 2], nameOf)).toBe('4 of 4 marked: Reed rope, Eel hooks ×4, Tallow candles ×3');
  });

  // Purpose: messy data reads plainly: 0 and 999 picks, a table of 0 rows, a row the table doesn't have, a thing the setting no longer has.
  it('reads 0 and 999 plainly', () => {
    expect(pickRowWords({ tableId: 'odds', upTo: 0 }, [], [], nameOf)).toBe('0 of 0 picked. 0 to choose from');
    const many = Array.from({ length: 999 }, () => 1);
    expect(pickRowWords({ tableId: 'odds', upTo: 999 }, rows, many, nameOf)).toBe('999 of 999 picked: Eel hooks ×1998');
    expect(pickFootWords({ tableId: 'odds', upTo: 999 }, rows, many, nameOf)).toBe('999 of 999 marked: Eel hooks ×1998');
    expect(pickRowWords({ tableId: 'odds', upTo: 999 }, Array.from({ length: 999 }, () => rows[0]!), [], nameOf)).toBe('0 of 999 picked. 999 to choose from');
    // A row the table doesn't have gives nothing; taken things the setting no longer has: the count alone.
    expect(pickRowWords(pick, rows, [9], nameOf)).toBe('1 of 4 picked');
    expect(pickRowWords(pick, rows, [0], () => undefined)).toBe('1 of 4 picked');
  });
});
