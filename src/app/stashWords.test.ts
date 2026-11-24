// The party stash's screen in words (K11; mockup pack/08 PK1, PK4, PK9b). Invented names: Tam, Ash, a silver ewer,
// torches.
import { describe, expect, it } from 'vitest';
import type { InventoryLine } from '../modules/inventory/inventory.ts';
import type { StashMove } from '../modules/inventory/stashHistory.ts';
import { factWords, putInWords, recentWhen, recentWords, thingCount, thingWords } from './stashWords.ts';

const move = (over: Partial<StashMove> = {}): StashMove => ({
  lineId: 'line-ewer',
  direction: 'in',
  who: { gm: false, characterId: 'actor-tam' },
  when: { day: 2, date: '2026-11-14T10:00:00.000Z', today: false },
  qty: null,
  name: null,
  leftPlay: false,
  type: 'inventory.move',
  undoable: true,
  seq: 1,
  eventId: 'event-1',
  userId: 'user-tam',
  ...over,
});
const today = { day: 3, date: '2026-11-14T10:00:00.000Z', today: true };
const line = (over: Partial<InventoryLine> = {}) => ({ name: 'Silver ewer', details: {}, qty: 1, stack: 1, ...over }) as InventoryLine;

describe('the stash in words (K11)', () => {
  // Purpose: the Pack's row and the first fact count what is in the stash as things, one or many.
  it('counts things: "1 thing", "7 things"', () => {
    expect(thingCount(1)).toBe('1 thing');
    expect(thingCount(7)).toBe('7 things');
    expect(thingCount(0)).toBe('0 things');
  });

  // Purpose: a fact names the thing and how many as PK4 draws it ("Torches ×2"), then who and when; without a name for
  // who, the when alone, with a capital.
  it('a fact reads "Silver ewer. Tam, today." and "Torches ×2. Day 2." without who', () => {
    expect(factWords(thingWords(line(), 1), 'Tam', move({ when: today }))).toBe('Silver ewer. Tam, today.');
    expect(factWords(thingWords(line({ name: 'Torches' }), 2), null, move())).toBe('Torches ×2. Day 2.');
  });

  // Purpose: a row's line says it or them by the stack's count, "Your GM" for the GM, and the when alone without who.
  it('a row reads "Tam put it in, today.", "Ash put them in, day 2.", "Put in day 2."', () => {
    expect(putInWords(line(), 'Tam', move({ when: today }))).toBe('Tam put it in, today.');
    expect(putInWords(line({ name: 'Bundle of reeds', qty: 8, stack: 10 }), 'Ash', move())).toBe('Ash put them in, day 2.');
    expect(putInWords(line(), 'Your GM', move())).toBe('Your GM put it in, day 2.');
    expect(putInWords(line(), null, move())).toBe('Put in day 2.');
  });

  // Purpose: a recent line says put in or took; a thing that left play has none (the log says how it went); "Someone"
  // where the log can't say who; when, with a capital, under it.
  it('a recent line reads "Tam put in Silver ewer." or "Ash took Torches ×2."; none for a thing that left play', () => {
    expect(recentWords(move(), 'Tam', 'Silver ewer')).toBe('Tam put in Silver ewer.');
    expect(recentWords(move({ direction: 'out' }), 'Ash', 'Torches ×2')).toBe('Ash took Torches ×2.');
    expect(recentWords(move({ direction: 'out', leftPlay: true }), 'Ash', 'Torches ×2')).toBeNull();
    expect(recentWords(move(), null, 'Silver ewer')).toBe('Someone put in Silver ewer.');
    expect(recentWhen(move({ when: today }))).toBe('Today');
    expect(recentWhen(move())).toBe('Day 2');
  });

  // Messy data: a very long name is kept whole, and 999 of a thing reads as such.
  it('keeps a long name whole and reads 999', () => {
    const long = 'A very long name for a sack that was once a sail and is now mostly patches';
    expect(thingWords(line({ name: long }), 999)).toBe(`${long} ×999`);
  });
});
