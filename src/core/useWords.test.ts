import { describe, expect, it } from 'vitest';
import { oneOf, usedWords } from './useWords.ts';

describe('use one up: the words', () => {
  // Purpose: a unit name that starts with a vowel takes "an", any other takes "a", so the log never reads "a Arrow".
  it('puts "an" before a vowel and "a" before a consonant', () => {
    expect(oneOf('Arrows', { unitName: 'Arrow' })).toBe('an Arrow');
    expect(oneOf('Arrows', { unitName: 'arrow' })).toBe('an arrow');
    expect(oneOf('Bolts', { unitName: 'bolt' })).toBe('a bolt');
    expect(oneOf('Ember arrows', { unitName: 'ember arrow' })).toBe('an ember arrow');
    expect(oneOf('Moss draughts', { unitName: 'Moss draught' })).toBe('a Moss draught');
  });

  // Purpose: with no unit name the item's own name is said as written, and the fired line keeps the name as written.
  it('says the fired line with the right article and keeps the name as written', () => {
    expect(usedWords('Fire', 'Arrows', { unitName: 'Arrow' }, 19)).toBe('fired an Arrow, 19 left');
    expect(usedWords('Fire', 'Arrows', { unitName: 'bolt' }, 3)).toBe('fired a bolt, 3 left');
    expect(usedWords('Fire', 'Arrows', {}, 3)).toBe('fired Arrows, 3 left');
    // The last one is singular: the unit name when there is one, else the item's name.
    expect(usedWords('Fire', 'Arrows', { unitName: 'Arrow' }, 0)).toBe('fired the last Arrow');
    expect(usedWords('Fire', 'Arrows', {}, 0)).toBe('fired the last Arrows');
  });
});
