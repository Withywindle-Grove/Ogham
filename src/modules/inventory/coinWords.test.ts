// The coin line's words (December step 6, piece c, the words only; docs/plans/dec-6-purse.md, "Words").
// Invented coins only: crowns, herons, bits.
import { describe, expect, it } from 'vitest';
import { coinsOf } from '../characters/startingGear.ts';
import { amountWords, coinLine, denominationsOf, type Denomination } from './coinWords.ts';

const crowns: Denomination = { key: 'cr', label: 'crowns' };
const herons: Denomination = { key: 'he', label: 'herons' };
const bits: Denomination = { key: 'bi', label: 'bits' };
const fen = [crowns, herons, bits];
const heron: Denomination = { key: 'he', label: 'herons', unitName: 'heron', pluralName: 'herons' };
const named: Denomination[] = [{ key: 'cr', label: 'crowns', unitName: 'crown', pluralName: 'crowns' }, heron];

describe('the coin line', () => {
  // Purpose: three denominations with amounts read in the setting's order, joined by commas.
  it('names each coin the purse holds, in the setting’s order', () => {
    expect(coinLine(fen, { bi: 4, cr: 12, he: 30 })).toBe('12 crowns, 30 herons, 4 bits');
  });

  // Purpose: a denomination the purse has none of is left out of the line.
  it('leaves out a coin at zero or missing', () => {
    expect(coinLine(fen, { cr: 12, he: 0, bi: 4 })).toBe('12 crowns, 4 bits');
    expect(coinLine(fen, { he: 30 })).toBe('30 herons');
  });

  // Purpose: a purse with nothing in it reads "No coin".
  it('reads "No coin" when every amount is zero, or the purse is empty', () => {
    expect(coinLine(fen, { cr: 0, he: 0, bi: 0 })).toBe('No coin');
    expect(coinLine(fen, {})).toBe('No coin');
  });

  // Purpose: with no purse at all (none given, or not the shape a purse has), the line reads "No coin".
  it('reads "No coin" with no purse', () => {
    expect(coinLine(fen, null)).toBe('No coin');
    expect(coinLine(fen, undefined)).toBe('No coin');
    expect(coinLine(fen, [12, 30])).toBe('No coin');
    expect(coinLine(fen, 'twelve crowns')).toBe('No coin');
  });

  // Purpose: one coin reads in the singular where the setting gives a singular.
  it('uses the setting’s singular for one coin', () => {
    expect(coinLine(named, { cr: 1, he: 2 })).toBe('1 crown, 2 herons');
  });

  // Purpose: a setting that lists its coins in an unusual order (smallest first) keeps that order.
  it('keeps an unusual order as the setting lists it', () => {
    expect(coinLine([bits, crowns, herons], { cr: 12, he: 30, bi: 4 })).toBe('4 bits, 12 crowns, 30 herons');
  });

  // Purpose: a long coin name is printed whole, never cut.
  it('never cuts a long coin name', () => {
    const long: Denomination = { key: 'lw', label: 'Lantern Warden’s silver-rimmed marsh tokens of the Old Fen Toll' };
    expect(coinLine([long, bits], { lw: 999, bi: 1 })).toBe('999 Lantern Warden’s silver-rimmed marsh tokens of the Old Fen Toll, 1 bits');
  });

  // Purpose: a setting that names no coins invents none; its purse's coin shows under its keys as written, and an empty purse reads "No coin" (lead's ruling, 2026-11-13).
  it('shows coin as written when the setting names no coins, and "No coin" only for an empty purse', () => {
    expect(coinLine([], { cr: 12 })).toBe('12 cr');
    expect(coinLine([], {})).toBe('No coin');
  });

  // Purpose: coin under a key the setting doesn't list shows after the listed coins, as written (lead's ruling, 2026-11-13).
  it('shows listed and unlisted coin together, the unlisted after', () => {
    expect(coinLine(fen, { zz: 7, cr: 12 })).toBe('12 crowns, 7 zz');
  });

  // Purpose: a purse holding only unlisted coin never reads empty.
  it('shows unlisted coin alone rather than "No coin"', () => {
    expect(coinLine(fen, { zz: 7 })).toBe('7 zz');
  });

  // Purpose: an unlisted coin at zero is left out like any other.
  it('leaves out an unlisted coin at zero', () => {
    expect(coinLine(fen, { cr: 2, zz: 0 })).toBe('2 crowns');
    expect(coinLine(fen, { zz: 0 })).toBe('No coin');
  });

  // Purpose: thousands print with a comma, as the Pack tab prints "1,200".
  it('prints thousands with a comma', () => {
    expect(coinLine(fen, { cr: 12000, bi: 1200 })).toBe('12,000 crowns, 1,200 bits');
  });

  // Purpose: a key the setting lists twice is printed once.
  it('prints a key the setting lists twice once', () => {
    expect(coinLine([crowns, herons, { key: 'cr', label: 'crowns again' }], { cr: 3, he: 1 })).toBe('3 crowns, 1 herons');
  });

  // Purpose: a fraction, a negative or a non-number is never printed: that coin is left out as if none (hard rule 8).
  it('leaves out an amount that isn’t a whole number from 0', () => {
    expect(coinLine(fen, { cr: 2.5, he: -3, bi: 4 })).toBe('4 bits');
    expect(coinLine(fen, { cr: '12', he: Number.NaN, bi: Infinity })).toBe('No coin');
  });
});

describe('an amount’s words', () => {
  // Purpose: an amount reads as the number and the setting's own words, singular for one where it gives one.
  it('reads "2 herons", "10 herons", "1 heron" with the setting’s singular and plural', () => {
    expect(amountWords(heron, 2)).toBe('2 herons');
    expect(amountWords(heron, 10)).toBe('10 herons');
    expect(amountWords(heron, 1)).toBe('1 heron');
  });

  // Purpose: with one name only, that name is used as given for every amount: no plural is invented.
  it('uses the one name as given when the setting gives one name only', () => {
    expect(amountWords(herons, 1)).toBe('1 herons');
    expect(amountWords({ key: 'g', label: 'Gold' }, 12)).toBe('12 Gold');
    expect(amountWords({ key: 'g', label: 'Gold' }, 1)).toBe('1 Gold');
  });

  // Purpose: the singular and plural are used only when both are given; otherwise the label as given, whatever the amount (lead's ruling, 2026-11-13).
  it('uses the label for every amount unless both unitName and pluralName are given', () => {
    expect(amountWords({ key: 'he', label: 'herons', unitName: 'heron' }, 3)).toBe('3 herons');
    expect(amountWords({ key: 'he', label: 'herons', unitName: 'heron' }, 1)).toBe('1 herons');
    expect(amountWords({ key: 'gp', label: 'gp' }, 1)).toBe('1 gp');
  });

  // Purpose: an amount's thousands print with a comma.
  it('prints an amount’s thousands with a comma', () => {
    expect(amountWords(heron, 12000)).toBe('12,000 herons');
  });

  // Purpose: a fraction, a negative or a non-number is refused (null), never printed (hard rule 8).
  it('refuses an amount that isn’t a whole number from 0', () => {
    expect(amountWords(herons, 2.5)).toBeNull();
    expect(amountWords(herons, -1)).toBeNull();
    expect(amountWords(herons, Number.NaN)).toBeNull();
    expect(amountWords(herons, Infinity)).toBeNull();
    expect(amountWords(herons, 0)).toBe('0 herons');
  });
});

describe('the setting’s coins as listed', () => {
  // Purpose: the coins are read from the top rules set that names any, in the order it lists them (not sorted by value).
  it('reads the top rules set’s currency in its own order', () => {
    const lower = { currency: [{ key: 'xx', label: 'shells', valueInBase: 1 }] };
    const top = {
      currency: [
        { key: 'bi', label: 'bits', valueInBase: 1 },
        { key: 'cr', label: 'crowns', valueInBase: 100 },
        { key: 'he', label: 'herons', valueInBase: 10 },
      ],
    };
    expect(denominationsOf([lower, top])).toEqual([
      { key: 'bi', label: 'bits' },
      { key: 'cr', label: 'crowns' },
      { key: 'he', label: 'herons' },
    ]);
  });

  // Purpose: the setting's unitName and pluralName are read when it gives both, so one coin reads in the singular.
  it('reads a coin’s unitName and pluralName when both are given', () => {
    const rules = { currency: [{ key: 'cr', label: 'crowns', valueInBase: 10, unitName: 'crown', pluralName: 'crowns' }, { key: 'he', label: 'herons', valueInBase: 1, unitName: 'heron' }] };
    const coins = denominationsOf([rules]);
    expect(coins).toEqual([{ key: 'cr', label: 'crowns', unitName: 'crown', pluralName: 'crowns' }, { key: 'he', label: 'herons' }]);
    expect(coinLine(coins, { cr: 1, he: 1 })).toBe('1 crown, 1 herons');
    expect(coinLine(coins, { cr: 30 })).toBe('30 crowns');
  });

  // Purpose: a coin is valid only with a whole valueInBase, as coinsOf counts it, so the two agree.
  it('skips a coin whose valueInBase isn’t a whole number, as coinsOf does', () => {
    const rules = { currency: [{ key: 'cr', label: 'crowns', valueInBase: 10 }, { key: 'he', label: 'herons', valueInBase: 0.5 }, { key: 'bi', label: 'bits' }] };
    expect(denominationsOf([rules])).toEqual([{ key: 'cr', label: 'crowns' }]);
    expect(coinsOf([rules]).map((c) => c.key)).toEqual(['cr']);
    expect(denominationsOf([{ currency: [{ key: 'bi', label: 'bits' }] }])).toEqual([]);
  });

  // Purpose: a key the setting lists twice is read once, the first time it's listed.
  it('reads a key listed twice once', () => {
    expect(denominationsOf([{ currency: [{ key: 'cr', label: 'crowns', valueInBase: 10 }, { key: 'cr', label: 'again', valueInBase: 10 }] }])).toEqual([{ key: 'cr', label: 'crowns' }]);
  });

  // Purpose: a coin with no label is named by its key; an entry with no key is skipped; a set naming none gives none.
  it('names a coin by its key when it has no label, and invents nothing when no set names coins', () => {
    expect(denominationsOf([{ currency: [{ key: 'he', valueInBase: 1 }, { label: 'nameless', valueInBase: 1 }, 'cr'] }])).toEqual([{ key: 'he', label: 'he' }]);
    expect(denominationsOf([{ time: {} }, { currency: [] }])).toEqual([]);
    expect(denominationsOf([])).toEqual([]);
  });
});
