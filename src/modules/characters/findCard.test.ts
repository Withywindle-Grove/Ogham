import { describe, expect, it } from 'vitest';
import { findCard, JUST_NOW_MS, type FindCardWords } from './findCard.ts';
import type { CoinFind, FindEntry, ThingFind } from './findsSeen.ts';

const NOW = '2026-12-06T20:00:00.000Z';
const ago = (ms: number) => new Date(Date.parse(NOW) - ms).toISOString();
const words: FindCardWords = {
  names: new Map([['tam', 'Tam'], ['fenna', 'Fenna of the Long Causeway below the Old Lantern']]),
  coinWords: (coins) => Object.entries(coins).map(([k, v]) => `${v.toLocaleString('en-GB')} ${k}`).join(', '),
  when: (at) => (at.startsWith('2026-12-06') ? 'today' : 'day 3'),
  now: NOW,
};
let seq = 0;
const thing = (name: string, o: Partial<ThingFind> = {}): ThingFind => ({
  kind: 'thing', lineId: `l${++seq}`, name, arrived: 1, now: null, who: { kind: 'gm' }, at: ago(60_000), takenBack: null, ...o,
});
const coin = (o: Partial<CoinFind> = {}): CoinFind => ({
  kind: 'coin', purseId: 'p', coins: { herons: 240 }, who: { kind: 'gm' }, at: ago(60_000), takenBack: null, ...o,
});
const back = { byGm: true, at: NOW };
const names = (c: ReturnType<typeof findCard>) => c!.lines.map((l) => (l.kind === 'find' ? l.name : l.words));

describe('findCard', () => {
  // Purpose: with nothing new there is no card at all.
  it('makes no card for no finds', () => {
    expect(findCard([], words)).toBeNull();
  });

  // Purpose: one thing reads "New in your pack", its giver and time on its own line, nothing said once.
  it('one thing: its own line with its giver and time', () => {
    expect(findCard([thing('Bronze ring')], words)).toEqual({
      head: 'New in your pack', once: null, more: 0,
      lines: [{ kind: 'find', name: 'Bronze ring', now: null, quiet: 'From your GM, just now.', entry: expect.anything() }],
    });
  });

  // Purpose: four things are all listed under "New in your pack", with no "and N more".
  it('four things: four lines and the plain head', () => {
    const c = findCard([thing('Silver key', { who: { kind: 'character', characterId: 'tam' } }), thing('Hooded lantern'), thing('Moon opals', { arrived: 2 }), thing('Bronze ring')], words)!;
    expect(c.head).toBe('New in your pack');
    expect(names(c)).toEqual(['Silver key', 'Hooded lantern', 'Moon opals ×2', 'Bronze ring']);
    expect(c.more).toBe(0);
  });

  // Purpose: from five, the head counts and the card shows three lines and "and 2 more".
  it('five things: a counting head, three lines and "and 2 more"', () => {
    const c = findCard(['A', 'B', 'C', 'D', 'E'].map((x) => thing(`Boat hook ${x}`)), words)!;
    expect(c.head).toBe('5 new things');
    expect(c.lines).toHaveLength(3);
    expect(c.more).toBe(2);
  });

  // Purpose: fourteen things count as fourteen, three lines and "and 11 more".
  it('fourteen things', () => {
    const c = findCard(Array.from({ length: 14 }, (_, i) => thing(`Reed ${i}`)), words)!;
    expect(c.head).toBe('14 new things');
    expect(c.more).toBe(11);
  });

  // Purpose: coin alone is headed "New in your coin" and does not add "In your coin.".
  it('coin alone', () => {
    const c = findCard([coin()], words)!;
    expect(c.head).toBe('New in your coin');
    expect(c.lines[0]).toMatchObject({ kind: 'find', name: '240 herons', quiet: 'From your GM, just now.' });
  });

  // Purpose: coin comes first, then the things newest first, and coin among things says "In your coin.".
  it('coin first, then the newest', () => {
    const c = findCard([thing('Silver key', { who: { kind: 'character', characterId: 'tam' }, at: ago(2 * JUST_NOW_MS) }), coin(), thing('Bronze ring')], words)!;
    expect(names(c)).toEqual(['240 herons', 'Silver key', 'Bronze ring']);
    expect(c.lines[0]).toMatchObject({ quiet: 'From your GM, just now. In your coin.' });
    expect(c.head).toBe('New in your pack');
  });

  // Purpose: one giver and one time for every line is said once under the head, and the lines carry none.
  it('one giver: said once', () => {
    const c = findCard([coin(), thing('Moon opals', { arrived: 2 }), thing('Hooded lantern')], words)!;
    expect(c.once).toBe('From your GM, just now.');
    expect(c.lines.map((l) => (l.kind === 'find' ? l.quiet : null))).toEqual(['In your coin.', null, null]);
  });

  // Purpose: two givers: each line says its own, with K14's words past the hour (⚑ F3's lean).
  it('two givers: each line its own', () => {
    const c = findCard([thing('Bronze ring'), thing('Silver key', { who: { kind: 'character', characterId: 'tam' }, at: '2026-12-01T10:00:00.000Z' })], words)!;
    expect(c.once).toBeNull();
    expect(c.lines.map((l) => (l.kind === 'find' ? l.quiet : null))).toEqual(['From your GM, just now.', 'Tam gave it to you, day 3.']);
  });

  // Purpose: one giver whose finds are hidden under "and N more" still decides "said once": the key under it is Tam's (FD3).
  it('a different giver under "and N more" keeps each line its own', () => {
    const c = findCard([coin(), thing('A'), thing('B'), thing('C'), thing('D'), thing('Silver key', { who: { kind: 'character', characterId: 'tam' } })], words)!;
    expect(c.once).toBeNull();
    expect(c.head).toBe('6 new things');
    expect(c.more).toBe(3);
  });

  // Purpose: "just now" is under an hour, a server time a little ahead of the device too; an hour on, K14's words.
  it('just now for under an hour, then K14 words', () => {
    expect(findCard([thing('Bronze ring', { at: ago(JUST_NOW_MS - 1) })], words)!.lines[0]).toMatchObject({ quiet: 'From your GM, just now.' });
    expect(findCard([thing('Bronze ring', { at: ago(-5_000) })], words)!.lines[0]).toMatchObject({ quiet: 'From your GM, just now.' });
    expect(findCard([thing('Bronze ring', { at: ago(JUST_NOW_MS) })], words)!.lines[0]).toMatchObject({ quiet: 'From your GM, today.' });
  });

  // Purpose: a long name and a long giver's name come back whole, never cut, with 999 written out.
  it('never cuts a long name', () => {
    const long = 'The Old Lantern of the Drowned and of the Nine Tides';
    const c = findCard([thing(long, { arrived: 999, who: { kind: 'character', characterId: 'fenna' } })], words)!;
    expect(c.lines[0]).toMatchObject({ name: `${long} ×999`, quiet: 'Fenna of the Long Causeway below the Old Lantern gave them to you, just now.' });
  });

  // Purpose: a find onto a stack says what arrived and the stack's new count apart, for their two weights (p45-22).
  it('the stack line', () => {
    expect(findCard([thing('River pearls', { arrived: 2, now: 8 })], words)!.lines[0]).toMatchObject({ name: 'River pearls ×2', now: '8' });
    expect(findCard([thing('River pearls', { arrived: 1, now: 1998 })], words)!.lines[0]).toMatchObject({ name: 'River pearls ×1', now: '1,998' });
  });

  // Purpose: one of two taken back turns into the quiet words in its own place, and the line said once stays.
  it('one of two taken back', () => {
    const ring = thing('Bronze ring');
    const opals = thing('Moon opals', { arrived: 2 });
    const before = findCard([opals, ring], words)!;
    const after = findCard([opals, { ...ring, takenBack: back }], words)!;
    expect(after.once).toBe(before.once);
    expect(after.head).toBe(before.head);
    expect(after.lines.map((l) => l.entry.kind === 'thing' && l.entry.lineId)).toEqual(before.lines.map((l) => l.entry.kind === 'thing' && l.entry.lineId));
    expect(after.lines[1]).toEqual({ kind: 'back', words: 'Your GM took back the Bronze ring.', entry: expect.anything() });
  });

  // Purpose: both taken back still makes a card, headed as before, with two quiet lines (⚑ F8, kept as drawn).
  it('both taken back', () => {
    const c = findCard([thing('Moon opals', { arrived: 2, takenBack: back }), thing('Bronze ring', { takenBack: back })], words)!;
    expect(c.head).toBe('New in your pack');
    expect(c.once).toBe('From your GM, just now.');
    expect(names(c)).toEqual(['Your GM took back the Moon opals ×2.', 'Your GM took back the Bronze ring.']);
  });

  // Purpose: coin and a name starting with "The" take no "the"; a giver's own Undo names the giver (⚑ F8's lean).
  it('taken-back words', () => {
    const c = findCard([
      coin({ takenBack: back }),
      thing('The Old Lantern', { takenBack: back }),
      thing('Silver key', { who: { kind: 'character', characterId: 'tam' }, takenBack: { byGm: false, at: NOW } }),
      thing('Reed flute', { who: { kind: 'unknown' }, takenBack: { byGm: false, at: NOW } }),
    ], words)!;
    expect(names(c)).toEqual(['Your GM took back 240 herons.', 'Your GM took back The Old Lantern.', 'Tam took back the Silver key.', 'Taken back: the Reed flute.']);
  });

  // Purpose: past five, a take-back lowers the counting head; one under "and N more" lowers N and adds no line.
  it('a take-back under "and N more"', () => {
    const all: FindEntry[] = ['A', 'B', 'C', 'D', 'E', 'F'].map((x) => thing(x));
    const c = findCard([...all.slice(0, 5), { ...(all[5] as ThingFind), takenBack: back }], words)!;
    expect(c.head).toBe('5 new things');
    expect(names(c)).toEqual(['A', 'B', 'C']);
    expect(c.more).toBe(2);
  });

  // Purpose: a gift whose giver the device can't name reads "Given to you" (K20a's ⚑ 4, not drawn).
  it('a giver with no name', () => {
    expect(findCard([thing('Reed flute', { who: { kind: 'unknown' } })], words)!.lines[0]).toMatchObject({ quiet: 'Given to you, just now.' });
  });

  // Purpose: an unidentified thing is named only as its row reads it, in the find line and the quiet line alike (p45-8).
  it('names an unidentified thing as it appears', () => {
    const face = thing('Bronze ring');
    const c = findCard([face, { ...thing('Bronze ring'), takenBack: back }], words)!;
    expect(names(c)).toEqual(['Bronze ring', 'Your GM took back the Bronze ring.']);
  });
});
