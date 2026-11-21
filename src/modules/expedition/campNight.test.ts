// Camp's night (M5b step 4, part 2; ruled 2026-10-30, D18–D20). Invented names only.
import { describe, expect, it } from 'vitest';
import { clockWords, morningLines, nightOf, offWatch, ordinal, putOnWatch, sleepRecords, splitEvenly, watchBoxCount, watchCountRange, watchesOf, watchNumberOf, watchTimeWords, type CampEntry } from './camp.ts';

let n = 0;
const entry = (kind: CampEntry['kind'], extra: Partial<CampEntry> = {}): CampEntry => ({
  id: `e${++n}`, campId: 'c', kind, actorId: 'reed', qty: 0, seconds: 0, at: 0, lineId: null, foodName: null, foodKind: null, fromPot: false, outcome: null, detail: [], createdBy: null, createdAt: '', ...extra,
});

describe('watches (D18)', () => {
  it('the newest order stands; each watch holds 1–3; moving someone closes up an emptied watch', () => {
    const entries = [entry('watches', { watches: [['reed']] }), entry('watches', { watches: [['reed', 'moss'], ['fern']] })];
    const watches = watchesOf(entries);
    expect(watches).toEqual([['reed', 'moss'], ['fern']]);
    expect(watchNumberOf(watches, 'fern')).toBe(2);
    expect(putOnWatch(watches, 'fern', 1)).toEqual([['reed', 'moss', 'fern']]);
    expect(putOnWatch([['reed', 'moss', 'fern']], 'ash', 1)).toBe('full');
    expect(putOnWatch(watches, 'reed', null)).toEqual([['moss'], ['fern']]);
    expect(putOnWatch([], 'reed', 3)).toEqual([['reed']]);
    expect(watchesOf([])).toEqual([]);
  });

  it("works out the night's length from the daylight and how many watches it takes", () => {
    expect(nightOf({ sunrise: 6 * 60, sunset: 18 * 60 }, 120)).toEqual({ minutes: 720, watches: 6 });
    expect(nightOf({ sunrise: 5 * 60, sunset: 20 * 60 }, 240)).toEqual({ minutes: 540, watches: 3 });
    expect(nightOf(null, 120)).toEqual({ minutes: null, watches: null });
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
});

describe('the Watches step by watch (fl-3)', () => {
  // Purpose: Split evenly fills every watch in marching order, the first watches taking the extra one.
  it('splits in marching order, the first watches taking one more (5 over 4: 2, 1, 1, 1)', () => {
    expect(splitEvenly(['ash', 'bram', 'fern', 'moss', 'reed'], 4, new Set())).toEqual([['ash', 'bram'], ['fern'], ['moss'], ['reed']]);
    expect(splitEvenly(['ash', 'bram', 'fern', 'moss'], 2, new Set())).toEqual([['ash', 'bram'], ['fern', 'moss']]);
  });

  // Purpose: a caster is kept off the last watch when a non-caster can take the place, and stays on it only when no one else can.
  it('keeps casters off the last watch where it can', () => {
    expect(splitEvenly(['ash', 'bram', 'fern', 'moss', 'reed'], 4, new Set(['reed']))).toEqual([['ash', 'bram'], ['fern'], ['reed'], ['moss']]);
    expect(splitEvenly(['ash', 'bram', 'fern', 'moss'], 2, new Set(['fern', 'moss']))).toEqual([['fern', 'moss'], ['ash', 'bram']]);
    expect(splitEvenly(['ash', 'bram'], 2, new Set(['ash', 'bram']))).toEqual([['ash'], ['bram']]);
  });

  // Purpose: the split never breaks the database's rule (each watch 1–3): fewer characters than watches, or more than they hold.
  it('never makes an empty watch or one of more than 3; with too many, the back of the order stays off watch', () => {
    expect(splitEvenly(['ash', 'bram'], 4, new Set())).toEqual([['ash'], ['bram']]);
    const big = splitEvenly(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 2, new Set());
    expect(big).toEqual([['a', 'b', 'c'], ['d', 'e', 'f']]);
    expect(splitEvenly([], 3, new Set())).toEqual([]);
    expect(splitEvenly(['ash'], 0, new Set())).toEqual([]);
  });

  // Purpose: with no night's length (bq3-4 C), the watches the group can ask for are only those it can fill: no watch
  // empty (no more watches than characters) and none over 3 (enough watches for everyone).
  it('limits "How many watches tonight?" so no watch is empty or holds more than 3', () => {
    expect(watchCountRange(5)).toEqual({ min: 2, max: 5 });
    expect(watchCountRange(3)).toEqual({ min: 1, max: 3 });
    expect(watchCountRange(1)).toEqual({ min: 1, max: 1 });
    expect(watchCountRange(10)).toEqual({ min: 4, max: 10 });
    expect(watchCountRange(0)).toEqual({ min: 0, max: 0 });
  });

  // Purpose: the boxes follow the pack's watches, or those set and one empty, never more than there are characters.
  it("shows the night's watches, or those set and one to add to", () => {
    expect(watchBoxCount(4, 2, 5)).toBe(4);
    expect(watchBoxCount(null, 2, 5)).toBe(3);
    expect(watchBoxCount(null, 0, 0)).toBe(1);
    expect(watchBoxCount(5, 0, 3)).toBe(3);
    expect(watchBoxCount(2, 3, 6)).toBe(3);
  });

  // Purpose: "Not on watch" names everyone on no watch; each watch's time of night runs from sunset by the watch's length.
  it('names who is off watch and gives each watch its time of night', () => {
    expect(offWatch(['ash', 'bram', 'fern'], [['bram']])).toEqual(['ash', 'fern']);
    expect(watchTimeWords(1, 18 * 60, 120)).toBe('18:00–20:00');
    expect(watchTimeWords(4, 18 * 60, 120)).toBe('00:00–02:00');
    expect(watchTimeWords(1, null, 120)).toBeNull();
    expect(watchTimeWords(1, 18 * 60, null)).toBeNull();
    expect(clockWords(-30)).toBe('23:30');
  });
});

describe('sleep records and the morning (D19, D20)', () => {
  it("keeps the GM's difficulty apart from how the character slept, newest first", () => {
    const records = sleepRecords([
      entry('sleep', { actorId: 'moss', detail: [{ name: '', qty: 0, difficulty: 'grim' }] }),
      entry('sleep', { actorId: 'moss', outcome: 'good', detail: [{ name: '', qty: 0, roll: '6' }] }),
      entry('sleep', { actorId: 'moss', outcome: 'bad', detail: [{ name: '', qty: 0, roll: '2' }] }),
    ]);
    expect(records.get('moss')).toEqual({ difficulty: 'grim', roll: '2', outcome: 'bad' });
  });

  it('the morning summary says the fire is out with its bundles, who did not eat and how they slept', () => {
    const entries = [
      entry('fuel', { qty: 2, seconds: 100, at: 0 }),
      entry('meal', { actorId: 'reed', fromPot: true }),
      entry('sleep', { actorId: 'reed', outcome: 'good' }),
      entry('sleep', { actorId: 'moss', outcome: 'bad' }),
    ];
    const names = (id: string) => ({ reed: 'Reed', moss: 'Moss' })[id] ?? id;
    expect(morningLines({ entries, now: 1000, names, members: ['reed', 'moss'], eating: true, sleeping: true })).toEqual([
      'fire out, 2 bundles used',
      "didn't eat: Moss",
      'slept well: Reed',
      'slept badly: Moss',
    ]);
    expect(morningLines({ entries: [], now: 0, names, members: ['reed'], eating: false, sleeping: false })).toEqual([]);
  });
});
