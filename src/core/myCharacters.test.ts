import { describe, expect, it } from 'vitest';
import { parseHpMax } from './myCharacters.ts';

describe('typing HP max', () => {
  it('leaves it empty when nothing is typed', () => {
    expect(parseHpMax('')).toBeUndefined();
    expect(parseHpMax('   ')).toBeUndefined();
  });

  it('accepts a whole number of at least 1', () => {
    expect(parseHpMax('5')).toBe(5);
    expect(parseHpMax(' 12 ')).toBe(12);
  });

  it('refuses anything else, so the screen can say why', () => {
    for (const bad of ['0', '-3', '2.5', 'five', '5 hp']) {
      expect(parseHpMax(bad), bad).toBeNull();
    }
  });
});
