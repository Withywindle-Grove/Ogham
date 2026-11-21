// The creation review's words (M5b step 0c, slice 7; cr-18, ca-3). Every name and number is invented.
import { describe, expect, it } from 'vitest';
import { cantUseLine, coinRolled, firstProblem, gearGroups, moneyOf, scoresLine, specialLines, spellSources } from './creationReview.ts';

const gp = { key: 'gp', label: 'Gold', valueInBase: 10 };
const coins = [gp, { key: 'sp', label: 'Silver', valueInBase: 1 }];

describe('the creation review’s words', () => {
  it('Send lands on the first failing step in the order walked, with what its Next would say', () => {
    expect(firstProblem([{ step: 'who', problem: null }, { step: 'gear', problem: '2 gp short: put something back.' }, { step: 'languages', problem: 'Pick 1 more.' }])).toEqual({ step: 'gear', message: '2 gp short: put something back.' });
    expect(firstProblem([{ step: 'who', problem: null }])).toBeNull();
    expect(firstProblem([])).toBeNull();
  });

  it('the scores show once, each changed one with its roll', () => {
    const label = (key: string) => key.toUpperCase();
    expect(scoresLine({ scores: { mus: 14, wit: 9 }, rolled: { mus: 13, wit: 9 } }, label)).toBe('MUS 14 (rolled 13), WIT 9');
    expect(scoresLine(null, label)).toBe('');
  });

  it('a special-approval pick is said in bold with the requirement it misses (ca-3)', () => {
    expect(specialLines({ specialApprovals: [{ step: 'race', entryId: 'stone-kin', name: 'Stone kin', requirement: 'Stone kin needs GRT 9, you have 8' }] })).toEqual([
      { text: "Stone kin: Needs the GM's special approval", strong: true, why: 'Stone kin needs GRT 9, you have 8' },
    ]);
    expect(specialLines({})).toEqual([]);
  });

  // Purpose (rc-2, cw-11): a background giving 50 adds it to starting money: the coin line counts it in what's left and
  // names the pick that gave it.
  it('the money: an entry’s coins join the roll, named by the pick (rc-2, cw-11)', () => {
    const record = { startingMoney: 100, moneyCoin: { key: 'gp', valueInBase: 10 }, spentBase: 1200, traitMoney: { 'fen-backgrounds': 50 } };
    const named = (listId: string) => (listId === 'fen-backgrounds' ? 'Reed cutter' : null);
    expect(moneyOf(record, coins, named)).toEqual({ text: '100 rolled, +50 gp from Reed cutter, 120 gp spent: 30 gp left', problem: null });
    // A pick that can't be named still says where the coins came from.
    expect(moneyOf(record, coins).text).toBe('100 rolled, +50 gp from your picks, 120 gp spent: 30 gp left');
    // Not typed, but a background gave coins: those are what there is (no "+" with nothing before it).
    expect(moneyOf({ moneyCoin: { key: 'gp', valueInBase: 10 }, traitMoney: { 'fen-backgrounds': 50 } }, coins, named).text).toBe('50 gp from Reed cutter: 50 gp left');
  });

  // Purpose (cw-11, Design's answer 2): a coin the player never touched reads as the usual, not rolled; a record without
  // the flag (made before it) still reads as rolled.
  // Design on #564: "usual" is out of the app's words (ruled 2026-11-07); an untouched coin is "the average".
  it('the money: the average (not rolled) only when the record says the coin was left untouched', () => {
    const base = { startingMoney: 100, moneyCoin: { key: 'gp', valueInBase: 10 }, spentBase: 600 };
    expect(moneyOf({ ...base, moneyTouched: false }, coins).text).toBe('100, the average (not rolled), 60 gp spent: 40 gp left');
    expect(moneyOf({ ...base, moneyTouched: true }, coins).text).toBe('100 rolled, 60 gp spent: 40 gp left');
    expect(moneyOf(base, coins).text).toBe('100 rolled, 60 gp spent: 40 gp left');
    expect(coinRolled({})).toBe(true);
    expect(coinRolled({ moneyTouched: false })).toBe(false);
  });

  // Purpose (cs-45, cs-44): one form everywhere, Gear's: the rolled figure alone, the coins on spent and left; over the
  // coin "…: 2 gp over." in the same line, with no separate "Over by".
  it('the money: what’s left, over (in the line, and the Gear step’s check), or not typed (the purse starts at 0)', () => {
    expect(moneyOf({ startingMoney: 100, moneyCoin: { key: 'gp', valueInBase: 10 }, spentBase: 220 }, coins)).toEqual({ text: '100 rolled, 22 gp spent: 78 gp left', problem: null });
    expect(moneyOf({ startingMoney: 10, moneyCoin: { key: 'gp', valueInBase: 10 }, spentBase: 120 }, coins)).toEqual({ text: '10 rolled, 12 gp spent: 2 gp over.', problem: '2 gp short: put something back.' });
    expect(moneyOf({}, coins)).toEqual({ text: 'Starting money not typed, so the purse starts at 0', problem: null });
    // 0 typed is typed: nothing left, nothing over; nothing spent says no "spent". 999 reads whole, in mixed coins.
    expect(moneyOf({ startingMoney: 0, moneyCoin: { key: 'gp', valueInBase: 10 } }, coins).text).toBe('0 rolled: 0 gp left');
    expect(moneyOf({ startingMoney: 999, moneyCoin: { key: 'gp', valueInBase: 10 }, spentBase: 5 }, coins).text).toBe('999 rolled, 5 sp spent: 998 gp 5 sp left');
  });

  // Purpose (cw-11, mockup creation/12): the Gear card reads as lines: each kit with what it gave, what was bought, what a
  // pick gave under its list's name, the given gear apart and counted, and the count with the load.
  it('the gear: a row per kit and per pick, the given gear apart, the count and the load', () => {
    const lines = [
      { id: 'l-coat', name: 'Ring coat', qty: 1 },
      { id: 'l-spear', name: 'Reed spear', qty: 1 },
      { id: 'l-torch', name: 'Torch', qty: 8 },
      { id: 'l-sweets', name: 'A bag of sticky sweets.', qty: 1 },
      { id: 'l-rope', name: 'Rope', qty: 1 },
      { id: 'l-odd', name: 'Odd stone', qty: 1 },
    ];
    const record = {
      bought: [
        { label: "Warden's kit", price: 0, kitId: 'k-warden', lines: [{ id: 'l-coat', qty: 1 }, { id: 'l-spear', qty: 1 }, { id: 'l-torch', qty: 2 }] },
        { label: 'Rope', price: 10, lines: [{ id: 'l-rope', qty: 1 }] },
      ],
      traitGear: { 'fen-keepsakes': [{ id: 'l-sweets', qty: 1 }] },
      givenGear: [{ id: 'l-torch', qty: 6 }],
    };
    expect(gearGroups(record, lines, 'Unencumbered', (id) => (id === 'fen-keepsakes' ? 'Keepsake' : '?'))).toEqual({
      rows: [
        { label: "Warden's kit", items: 'Ring coat, Reed spear, Torch ×2', ids: ['l-coat', 'l-spear', 'l-torch'], kit: true },
        { label: 'Bought', items: 'Rope', ids: ['l-rope'] },
        { label: 'Keepsake', items: 'A bag of sticky sweets', ids: ['l-sweets'] },
        // What none of them put in the pack.
        { label: 'Also in the pack', items: 'Odd stone', ids: ['l-odd'] },
      ],
      given: ['Torch ×6'],
      givenCount: '6 items',
      summary: '13 items, Unencumbered',
    });
  });

  // Purpose (cs-23, picture creation/final 22-G1): the trinket has its own row, "Trinket", never under "Also in the
  // pack"; a pack's pick table is named by the pack on its own row, never in the Given fold.
  it('the gear: the trinket on its own row, and a pick table named by the pack', () => {
    const lines = [
      { id: 'l-pebble', name: 'A pebble that is always warm', qty: 1 },
      { id: 'l-eel', name: 'Eel line', qty: 1 },
      { id: 'l-rope', name: 'Reed rope', qty: 1 },
    ];
    const record = { trinket: { tableId: 'reed-trinkets', text: 'A pebble that is always warm', lineId: 'l-pebble' }, givenPicks: { 'odds-and-ends': [{ row: 2, lines: [{ id: 'l-eel', qty: 1 }] }] }, givenGear: [{ id: 'l-rope', qty: 1 }] };
    const groups = gearGroups(record, lines, '', () => '?', (tableId) => (tableId === 'odds-and-ends' ? 'Odds and ends' : '?'));
    expect(groups.rows).toEqual([
      { label: 'Odds and ends', items: 'Eel line', ids: ['l-eel'] },
      { label: 'Trinket', items: 'A pebble that is always warm', ids: ['l-pebble'] },
    ]);
    expect(groups.given).toEqual(['Reed rope']);
  });

  it('the gear: a line gone from the pack is left out; an empty pack says "Nothing yet"', () => {
    const record = { bought: [{ label: "Warden's kit", price: 0, kitId: 'k', lines: [{ id: 'gone', qty: 1 }] }] };
    expect(gearGroups(record, [], '', () => '')).toEqual({ rows: [], given: [], givenCount: '0 items', summary: 'Nothing yet' });
    expect(gearGroups({}, [{ id: 'a', name: 'Eel bones.', qty: 1 }], '', () => '').summary).toBe('1 item');
  });

  // Purpose (cw-11, Design 2026-11-06): a kit's thing the class can't wear or use says so on the review, in words.
  it('a kit’s thing the class can’t wear or use: "Ring coat: a Reed Witch can’t wear it; carried"', () => {
    expect(cantUseLine('Ring coat', 'Reed Witch', false)).toBe("Ring coat: a Reed Witch can't wear it; carried");
    expect(cantUseLine('Heavy pike.', 'Eel-catcher', true)).toBe("Heavy pike: an Eel-catcher can't use it; carried");
  });

  // Purpose (cw-11): the Magic card says where each spell came from.
  it('the spells by source: a kindred’s grant says so, the rest are the class’s', () => {
    expect(spellSources(['marsh-light', 'reed-whisper'], { given: [{ id: 'marsh-light' }], rolled: [] })).toEqual([
      { id: 'marsh-light', from: 'From your kindred' },
      { id: 'reed-whisper', from: 'From your class' },
    ]);
    expect(spellSources(['reed-whisper'], null)).toEqual([{ id: 'reed-whisper', from: 'From your class' }]);
  });
});
