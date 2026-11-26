import { describe, expect, it } from 'vitest';
import { raceDataAsPlayed } from './creation.ts';
import { saveModifierLines } from './play.ts';
import { saveWorking, type SaveWorkingInput } from './saveWorking.ts';

// Invented content only (hard rule 2): Bog folk, Lantern Warden, Lore, Fever (F), Wisps (W), Barrow (B).
const high = (die = 'd20') => [{ rolls: { save: { die, pass: 'atOrOver' } } }];
const low = (die = 'd20') => [{ rolls: { save: { die, pass: 'atOrUnder' } } }];
const warden = { name: 'Lantern Warden' };

const input = (over: Partial<SaveWorkingInput> = {}): SaveWorkingInput => ({
  filled: { 'saves.F': 15, 'saves.W': 14, 'saves.B': 13 },
  rulesSets: high(),
  race: null,
  raceName: 'Bog folk',
  klass: warden,
  className: 'Lantern Warden',
  scores: {},
  label: (k) => (k === 'LOR' ? 'Lore' : k),
  ...over,
});

describe("a save's working: the counting (plan dec-15-save-bonus, row 1)", () => {
  it('a bonus with no condition lowers the number where a high roll succeeds and raises it where a low roll succeeds', () => {
    const race = { saveBonus: 2 };
    const up = saveWorking('F', input({ race }))!;
    expect(up.base).toBe(15);
    expect(up.counted).toEqual([{ bonus: 2, from: 'Bog folk', kind: 'kindred', more: false, number: 13, held: null }]);
    expect(up.figure).toBe(13);
    const down = saveWorking('F', input({ race, rulesSets: low() }))!;
    expect(down.figure).toBe(17);
    expect(down.counted[0]!.number).toBe(17);
  });

  it('a bonus with a condition never changes the figure and gives its own number', () => {
    const w = saveWorking('F', input({ race: { saveBonus: { bonus: 4, vs: 'venom' } } }))!;
    expect(w.counted).toEqual([]);
    expect(w.figure).toBe(15);
    expect(w.atTimes).toEqual([{ condition: 'venom', parts: [{ bonus: 4, from: 'Bog folk', kind: 'kindred', more: false }], bonus: 4, number: 11, held: null }]);
  });

  it('the "otherwise" part of a list is counted and its conditional part gives the difference', () => {
    const w = saveWorking('F', input({ race: { saveBonus: [{ bonus: 4, vs: 'venom' }, { bonus: 2, vs: 'all other' }] } }))!;
    expect(w.counted.map((r) => [r.bonus, r.number])).toEqual([[2, 13]]);
    expect(w.figure).toBe(13);
    expect(w.atTimes).toEqual([{ condition: 'venom', parts: [{ bonus: 2, from: 'Bog folk', kind: 'kindred', more: true }], bonus: 2, number: 11, held: null }]);
  });

  it('a by-Constitution entry that names a whole save is counted; one written for part of a save holds at times', () => {
    const race = { saveBonusByCon: { saves: ['F(marsh-rot)', 'W'], byCon: [{ con: '7+', bonus: 3 }] } };
    const scores = { CON: 9 };
    const wisps = saveWorking('W', input({ race, scores }))!;
    expect(wisps.counted.map((r) => [r.bonus, r.from, r.number])).toEqual([[3, 'Bog folk', 11]]);
    expect(wisps.figure).toBe(11);
    expect(wisps.atTimes).toEqual([]);
    const fever = saveWorking('F', input({ race, scores }))!;
    expect(fever.figure).toBe(15);
    expect(fever.atTimes.map((r) => [r.condition, r.number])).toEqual([['marsh-rot', 12]]);
  });

  it('every saveModifiers entry holds at times, and one that gives nothing is left out', () => {
    const rulesSets = [
      {
        rolls: { save: { die: 'd20', pass: 'atOrOver' } },
        saveModifiers: [
          { id: 'ward', name: 'Spell ward', value: { from: 'LOR', plusRaceField: 'wardBonus' }, appliesWhen: 'magic' },
          { id: 'hexes', name: 'vs hexes', value: { raceField: 'hexBonus' }, appliesWhen: 'hexes' },
          { id: 'mist', name: 'Mist sense', value: { fill: 'abilityModifiers.LOR.mist' }, appliesWhen: 'mist' },
        ],
      },
    ];
    const filled = { 'saves.F': 15, 'abilityModifiers.LOR': { wardBonus: 1, mist: 0 } };
    const w = saveWorking('F', input({ rulesSets, filled, race: { wardBonus: 2 } }))!;
    expect(w.figure).toBe(15);
    expect(w.counted).toEqual([]);
    expect(w.atTimes).toEqual([]);
    expect(w.shared).toEqual([
      {
        id: 'ward',
        name: 'Spell ward',
        appliesWhen: 'magic',
        parts: [
          { bonus: 1, from: 'Lore', kind: 'score', more: false },
          { bonus: 2, from: 'Bog folk', kind: 'kindred', more: false },
        ],
        bonus: 3,
        number: 12,
        held: null,
      },
    ]);
  });

  it('a bonus of 0 gives no row', () => {
    const w = saveWorking('F', input({ race: { saveBonus: [0, { bonus: 0, vs: 'venom' }], saveBonusByCon: { saves: ['F'], byCon: [{ con: 9, bonus: 0 }] } }, scores: { CON: 9 } }))!;
    expect(w.counted).toEqual([]);
    expect(w.atTimes).toEqual([]);
    expect(w.figure).toBe(15);
  });

  it('with no rolls.save nothing is counted, and a save that is not a whole number gives nothing', () => {
    expect(saveWorking('F', input({ rulesSets: [{}], race: { saveBonus: 2 } }))).toBeNull();
    expect(saveWorking('F', input({ filled: { 'saves.F': '—' }, race: { saveBonus: 2 } }))).toBeNull();
    expect(saveWorking('X', input({ race: { saveBonus: 2 } }))).toBeNull();
  });

  it("a kindred-class's own bonus replaces its kindred's", () => {
    const kindred = { id: 'bog-folk', name: 'Bog folk', saveBonus: 4 };
    const kindredClass = { name: 'Bog folk wanderer', race: 'bog-folk', saveBonus: 1 };
    const race = raceDataAsPlayed(kindred, 'bog-folk', kindredClass);
    const w = saveWorking('F', input({ race, klass: kindredClass, className: 'Bog folk wanderer' }))!;
    expect(w.counted.map((r) => [r.bonus, r.kind])).toEqual([[1, 'class']]);
    expect(w.figure).toBe(14);
  });

  it('a penalty moves the number the other way', () => {
    expect(saveWorking('F', input({ race: { saveBonus: -2 } }))!.figure).toBe(17);
    expect(saveWorking('F', input({ race: { saveBonus: -2 }, rulesSets: low() }))!.figure).toBe(13);
  });

  it('three counted bonuses each give the number after them, in the order kindred by Constitution, kindred, class', () => {
    const race = { saveBonus: 1, saveBonusByCon: { saves: ['F'], byCon: [{ con: '9+', bonus: 2 }] } };
    const klass = { name: 'Lantern Warden', saveBonus: -1 };
    const w = saveWorking('F', input({ race, klass, scores: { CON: 12 } }))!;
    expect(w.counted.map((r) => [r.bonus, r.from, r.number])).toEqual([
      [2, 'Bog folk', 13],
      [1, 'Bog folk', 12],
      [-1, 'Lantern Warden', 13],
    ]);
    expect(w.figure).toBe(13);
  });

  it('a counted bonus and one at times on one save: the at-times number starts from the counted figure', () => {
    const w = saveWorking('F', input({ race: { saveBonus: [2, { bonus: 2, vs: 'venom' }] } }))!;
    expect(w.figure).toBe(13);
    expect(w.atTimes.map((r) => [r.condition, r.number])).toEqual([['venom', 11]]);
  });

  it('two conditions on one save are two at-times rows', () => {
    const w = saveWorking('F', input({ race: { saveBonus: [{ bonus: 2, vs: 'venom' }, { bonus: 1, vs: 'barrow-lights and will-o-the-wisps' }] } }))!;
    expect(w.atTimes.map((r) => [r.condition, r.number])).toEqual([
      ['venom', 13],
      ['barrow-lights and will-o-the-wisps', 14],
    ]);
  });

  it('two sources with the same condition are one row with both parts and one number (ruling 6)', () => {
    const w = saveWorking('F', input({ race: { saveBonus: { bonus: 2, vs: 'venom' } }, klass: { name: 'Lantern Warden', saveBonus: { bonus: 1, vs: 'Vs Venom' } } }))!;
    expect(w.atTimes).toEqual([
      {
        condition: 'venom',
        parts: [
          { bonus: 2, from: 'Bog folk', kind: 'kindred', more: false },
          { bonus: 1, from: 'Lantern Warden', kind: 'class', more: false },
        ],
        bonus: 3,
        number: 12,
        held: null,
      },
    ]);
  });

  it('a bonus that names other saves leaves this save alone', () => {
    const w = saveWorking('F', input({ race: { saveBonus: { bonus: 2, saves: ['W'] } } }))!;
    expect(w.counted).toEqual([]);
    expect(w.figure).toBe(15);
    expect(saveWorking('W', input({ race: { saveBonus: { bonus: 2, saves: ['W'] } } }))!.figure).toBe(12);
  });

  it('a character with no class has no class name in the working (ruling 11), and still counts', () => {
    const w = saveWorking('F', input({ klass: null, className: null, race: { saveBonus: 2 } }))!;
    expect(w).toMatchObject({ className: null, hasClass: false });
    expect(w.figure).toBe(13);
  });

  it('a saveModifiers entry with its own number holds at times with that number, and none at 0', () => {
    const rulesSets = [
      {
        rolls: { save: { die: 'd20', pass: 'atOrOver' } },
        saveModifiers: [
          { id: 'dusk', name: 'Dusk ward', value: 2, appliesWhen: 'at dusk' },
          { id: 'mire', name: 'Mire', modifier: -1, appliesWhen: 'in the mire' },
          { id: 'none', name: 'Nothing', value: 0, appliesWhen: 'never' },
        ],
      },
    ];
    const w = saveWorking('F', input({ rulesSets }))!;
    expect(w.figure).toBe(15);
    expect(w.shared).toEqual([
      { id: 'dusk', name: 'Dusk ward', appliesWhen: 'at dusk', parts: [{ bonus: 2, from: null, kind: 'rule', more: false }], bonus: 2, number: 13, held: null },
      { id: 'mire', name: 'Mire', appliesWhen: 'in the mire', parts: [{ bonus: -1, from: null, kind: 'rule', more: false }], bonus: -1, number: 16, held: null },
    ]);
  });

  it('a kindred or class with no name gives its rows with no name (no words of the app\'s own), and a class with no name keeps its row', () => {
    const rulesSets = [{ rolls: { save: { die: 'd20', pass: 'atOrOver' } }, saveModifiers: [{ id: 'hexes', name: 'vs hexes', value: { raceField: 'hexBonus' }, appliesWhen: 'hexes' }] }];
    const w = saveWorking('F', input({ rulesSets, race: { saveBonus: 2, hexBonus: 1 }, raceName: null, klass: { saveBonus: 1 }, className: null }))!;
    expect(w.counted.map((r) => [r.from, r.kind])).toEqual([
      [null, 'kindred'],
      [null, 'class'],
    ]);
    expect(w.shared[0]!.parts).toEqual([{ bonus: 1, from: null, kind: 'kindred', more: false }]);
    expect(w).toMatchObject({ className: null, hasClass: true });
    // A class whose name the caller did not pass is named from the class itself.
    const named = saveWorking('F', input({ klass: warden, className: null }))!;
    expect(named).toMatchObject({ className: 'Lantern Warden', hasClass: true });
  });

  it("a score's row that is not a whole number gives no part, in the working and in the Modifiers lines", () => {
    const rulesSets = [{ rolls: { save: { die: 'd20', pass: 'atOrOver' } }, saveModifiers: [{ id: 'ward', name: 'Spell ward', value: { from: 'LOR', plusRaceField: 'wardBonus' }, appliesWhen: 'magic' }] }];
    const fraction = input({ rulesSets, filled: { 'saves.F': 15, 'abilityModifiers.LOR': { wardBonus: 1.5 } } });
    expect(saveWorking('F', fraction)!.shared).toEqual([]);
    expect(saveModifierLines('F', fraction)).toEqual([]);
    const single = input({ rulesSets, filled: { 'saves.F': 15, 'abilityModifiers.LOR': { other: 0.5 } } });
    expect(saveModifierLines('F', single)).toEqual([]);
    // A whole number is read as before.
    const wholeRow = input({ rulesSets, filled: { 'saves.F': 15, 'abilityModifiers.LOR': { wardBonus: 1 } } });
    expect(saveModifierLines('F', wholeRow)).toEqual(['Spell ward: +1 from Lore.']);
  });
});

describe("a save's working: the stops without a pack flag (plan dec-15-save-bonus, row 2)", () => {
  it('a number never goes below the lowest face where a high roll succeeds, nor above the highest where a low roll succeeds', () => {
    const w = saveWorking('F', input({ filled: { 'saves.F': 3 }, race: { saveBonus: 5 } }))!;
    expect(w.figure).toBe(1);
    expect(w.stops).toEqual({ easy: 1, hard: null });
    const up = saveWorking('F', input({ filled: { 'saves.F': 18 }, race: { saveBonus: 5 }, rulesSets: low() }))!;
    expect(up.figure).toBe(20);
    expect(up.stops).toEqual({ easy: 20, hard: null });
  });

  it('the row that lands on the face exactly is not marked; the next one is (rows 3, 1, 1)', () => {
    const race = { saveBonus: 2, saveBonusByCon: { saves: ['F'], byCon: [{ con: '9+', bonus: 0 }] } };
    const w = saveWorking('F', input({ filled: { 'saves.F': 5 }, race, klass: { name: 'Lantern Warden', saveBonus: 2 }, scores: { CON: 9 } }))!;
    // 5, then +2 → 3, then +2 → 1: lands on the face, not marked.
    expect(w.counted.map((r) => [r.number, r.held])).toEqual([
      [3, null],
      [1, null],
    ]);
    const past = saveWorking('F', input({ filled: { 'saves.F': 5 }, race: { saveBonus: [2, 2] }, klass: { name: 'Lantern Warden', saveBonus: 1 } }))!;
    expect(past.counted.map((r) => [r.number, r.held])).toEqual([
      [3, null],
      [1, null],
      [1, 1],
    ]);
    expect(past.figure).toBe(1);
  });

  it('an at-times number past the easy face stops there and is marked', () => {
    const w = saveWorking('F', input({ filled: { 'saves.F': 4 }, race: { saveBonus: { bonus: 5, vs: 'venom' } } }))!;
    expect(w.atTimes.map((r) => [r.number, r.held])).toEqual([[1, 1]]);
  });

  it("an at-times number past the top face is given as worked, and so is a tile's own figure a penalty takes past it (ruling 1)", () => {
    const line = saveWorking('F', input({ filled: { 'saves.F': 19 }, race: { saveBonus: { bonus: -2, vs: 'venom' } } }))!;
    expect(line.atTimes.map((r) => [r.number, r.held])).toEqual([[21, null]]);
    const tile = saveWorking('F', input({ filled: { 'saves.F': 19 }, race: { saveBonus: -2 } }))!;
    expect(tile.figure).toBe(21);
    expect(tile.counted.map((r) => [r.number, r.held])).toEqual([[21, null]]);
  });

  it('with another stop passed in, the number stops there and the marks carry that number', () => {
    const w = saveWorking('F', input({ filled: { 'saves.F': 4 }, race: { saveBonus: [2, 1] }, stops: { easy: 2 } }))!;
    expect(w.counted.map((r) => [r.number, r.held])).toEqual([
      [2, null],
      [2, 2],
    ]);
    expect(w.stops).toEqual({ easy: 2, hard: null });
    const top = saveWorking('F', input({ filled: { 'saves.F': 19 }, race: { saveBonus: { bonus: -3, vs: 'venom' } }, stops: { hard: 20 } }))!;
    expect(top.atTimes.map((r) => [r.number, r.held])).toEqual([[20, 20]]);
  });

  it("a hard stop passed in holds back only the at-times and shared numbers, never a counted row or the tile's figure", () => {
    const rulesSets = [{ rolls: { save: { die: 'd20', pass: 'atOrOver' } }, saveModifiers: [{ id: 'mire', name: 'Mire', value: -1, appliesWhen: 'in the mire' }] }];
    const w = saveWorking('F', input({ rulesSets, filled: { 'saves.F': 19 }, race: { saveBonus: [-2, { bonus: -3, vs: 'venom' }] }, stops: { hard: 20 } }))!;
    expect(w.counted.map((r) => [r.number, r.held])).toEqual([[21, null]]);
    expect(w.figure).toBe(21);
    expect(w.atTimes.map((r) => [r.number, r.held])).toEqual([[20, 20]]);
    expect(w.shared.map((r) => [r.number, r.held])).toEqual([[20, 20]]);
  });

  it("a die other than twenty-sided stops at its own face", () => {
    const w = saveWorking('F', input({ filled: { 'saves.F': 10 }, rulesSets: low('d12'), race: { saveBonus: 4 } }))!;
    expect(w.figure).toBe(12);
    expect(w.counted[0]!.held).toBe(12);
    expect(w.die).toBe('d12');
    expect(w.sides).toBe(12);
  });
});
