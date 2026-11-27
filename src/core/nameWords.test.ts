// A name in a sentence's words (words rule 13, docs/06; Francis, 26 Nov, #50 audit finding 7). Invented names only.
import { describe, expect, it } from 'vitest';
import { possessive, withoutThe, withThe, withTheStart } from './nameWords.ts';

describe('a name in a sentence (words rule 13)', () => {
  // Purpose: a possessive takes ’s, and after a final s (either case) the mark alone.
  it('a possessive takes ’s, and after a final s the mark alone', () => {
    expect(possessive('Wren')).toBe('Wren’s');
    expect(possessive('Lantern Wardens')).toBe('Lantern Wardens’');
    expect(possessive('MOSS')).toBe('MOSS’');
    expect(possessive('your race')).toBe('your race’s');
  });

  // Purpose: "the" goes before a name, but a name that starts with "The" keeps its own article, never "the The".
  it('a name starting with "The" keeps its own article', () => {
    expect(withThe('Sack')).toBe('the Sack');
    expect(withThe('The Old Satchel')).toBe('The Old Satchel');
    expect(withThe('the reed basket')).toBe('the reed basket');
    expect(withThe('Theodric’s pole')).toBe('the Theodric’s pole');
  });

  // Purpose: at a sentence's start the article is a capital, and a "The" name is not doubled.
  it('at a sentence’s start: "The Sack", "The Old Satchel"', () => {
    expect(withTheStart('Sack')).toBe('The Sack');
    expect(withTheStart('The Old Satchel')).toBe('The Old Satchel');
    expect(withTheStart('the reed basket')).toBe('The reed basket');
  });

  // Purpose: after a determiner ("Each") a name drops its own "The", and only a whole-word "The".
  it('after a determiner a name drops its own "The"', () => {
    expect(withoutThe('The Drowned Crown')).toBe('Drowned Crown');
    expect(withoutThe('the reed basket')).toBe('reed basket');
    expect(withoutThe('Sack')).toBe('Sack');
    expect(withoutThe('Theodric’s pole')).toBe('Theodric’s pole');
  });
});
