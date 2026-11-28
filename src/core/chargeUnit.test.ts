// Tests for a count's words (G-233, piece C of docs/specs/dec5-gaps.md; dg-5, dg-6, dg-8, dg-18, dgb-2): the unit an
// item's `charges` names, its plural, "a" or "an", a full count of 1, and "charges" when the line names no unit.
// Every item is made up (hard rule 2).
import { describe, expect, it } from 'vitest';
import { aUnit, capitalised, chargeUnitOf, countOf, fullCountOf } from './chargeUnit.ts';

const charges = (extra: Record<string, unknown>) => ({ charges: { initial: 3, ...extra } });

describe('the unit an item counts in', () => {
  // Purpose: a pack's `unit` gives the singular, and `units` defaults to the unit plus "s" (dg-5).
  it('reads the unit and defaults the plural to the unit plus "s"', () => {
    expect(chargeUnitOf(charges({ unit: 'portion' }))).toEqual({ one: 'portion', many: 'portions', named: true });
    expect(chargeUnitOf(charges({ unit: ' dose ' }))).toEqual({ one: 'dose', many: 'doses', named: true });
    expect(chargeUnitOf(charges({ unit: 'mouse', units: 'mice' }))).toEqual({ one: 'mouse', many: 'mice', named: true });
  });

  // Purpose: with no unit, or a unit that isn't words, the words are today's "charge" and "charges" (dg-5, US 49).
  it('says "charge" and "charges" with no unit, or a unit that is not words', () => {
    const plain = { one: 'charge', many: 'charges', named: false };
    expect(chargeUnitOf(charges({}))).toEqual(plain);
    expect(chargeUnitOf({})).toEqual(plain);
    expect(chargeUnitOf(charges({ unit: '' }))).toEqual(plain);
    expect(chargeUnitOf(charges({ unit: '   ' }))).toEqual(plain);
    expect(chargeUnitOf(charges({ unit: 3 }))).toEqual(plain);
    expect(chargeUnitOf(charges({ unit: '3 cups' }))).toEqual(plain);
    expect(chargeUnitOf(charges({ units: 'portions' }))).toEqual(plain);
  });

  // Purpose: a plural that isn't words falls back to the unit plus "s", so a typo never shows.
  it('falls back to the unit plus "s" when the plural is not words', () => {
    expect(chargeUnitOf(charges({ unit: 'ounce', units: 4 }))).toEqual({ one: 'ounce', many: 'ounces', named: true });
    expect(chargeUnitOf(charges({ unit: 'ounce', units: ' ' }))).toEqual({ one: 'ounce', many: 'ounces', named: true });
  });
});

describe('"a" or "an" before a unit (dg-18 finding 2; dgb-2)', () => {
  // Purpose: "an" before a vowel, "a" before any other letter, as the spec's test cases name them.
  it('takes "an" before a vowel and "a" before a consonant', () => {
    expect(aUnit('portion')).toBe('a portion');
    expect(aUnit('dose')).toBe('a dose');
    expect(aUnit('ounce')).toBe('an ounce');
    expect(aUnit('arrow')).toBe('an arrow');
    expect(aUnit('ember')).toBe('an ember');
    expect(aUnit('charge')).toBe('a charge');
  });

  // Purpose: the built-in list (B2 = B): "uni…", "use…", "eu…", "one…" take "a"; "hour" and "honour" take "an".
  it('keeps the built-in exceptions', () => {
    expect(aUnit('unit')).toBe('a unit');
    expect(aUnit('user')).toBe('a user');
    expect(aUnit('eucharist wafer')).toBe('a eucharist wafer');
    expect(aUnit('one-shot')).toBe('a one-shot');
    expect(aUnit('hour')).toBe('an hour');
    expect(aUnit('honour')).toBe('an honour');
    expect(aUnit('Ounce')).toBe('an Ounce');
  });
});

describe('a count in its unit', () => {
  // Purpose: one is the singular, every other count the plural, 0 and 999 included.
  it('says "1 portion", "2 portions", "0 portions" and "999 doses"', () => {
    const portion = chargeUnitOf(charges({ unit: 'portion' }));
    expect(countOf(1, portion)).toBe('1 portion');
    expect(countOf(2, portion)).toBe('2 portions');
    expect(countOf(0, portion)).toBe('0 portions');
    expect(countOf(999, chargeUnitOf(charges({ unit: 'dose' })))).toBe('999 doses');
  });

  // Purpose: a label takes the plural with its first letter in upper case ("Portions: 2 of 3 left").
  it('capitalises a label', () => {
    expect(capitalised('portions')).toBe('Portions');
    expect(capitalised('charges')).toBe('Charges');
    expect(capitalised('')).toBe('');
  });
});

describe('the full count', () => {
  // Purpose: the full count is the pack's `initial` when it is a whole number, never a roll's dice (finding 3).
  it('reads a whole-number initial, and nothing for dice', () => {
    expect(fullCountOf(charges({}))).toBe(3);
    expect(fullCountOf({ charges: { initial: 1 } })).toBe(1);
    expect(fullCountOf({ charges: { initial: '4' } })).toBe(4);
    expect(fullCountOf({ charges: { initial: '2d4' } })).toBeNull();
    expect(fullCountOf({ charges: { initial: 0 } })).toBeNull();
    expect(fullCountOf({ charges: { initial: 2.5 } })).toBeNull();
    expect(fullCountOf({})).toBeNull();
  });
});
