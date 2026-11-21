// K21's logic half: coin in a hoard and on the find card (docs/plans/dec-6-the-whole-pack-tab.md, row K21; pf-6,
// pf-24, pf-24a, pk-11, pu-3, pu-5; frames PK3 and PK5 of pack/08). Invented coins (crowns, herons, bits), things and
// places only.
//   Purposes:
//   1. A hoard with coin of one kind gives that coin, as a purse holds it, with the row's words as printed.
//   2. A hoard with coin of several kinds, over several rows, adds each coin up, in the setting's order.
//   3. A hoard with coin and things counts the coin only: a thing, and a thing's worth (`value`), are never coin.
//   4. A hoard with no coin gives nothing: never a "0" line, a coin at 0 included.
//   5. Big amounts stay whole numbers (999999); past the database's limit a coin is refused, not cut or guessed.
//   6. The book's words are kept as printed, with the pack's own note where it reads an odd coin word (pk-11).
//   7. What no ruling settles is refused by its reason, never guessed: a key that isn't one of the setting's coins, an
//      amount that isn't a whole number of 0 or more.
//   8. A find card names the coin received in the setting's words, one line a coin, and counts as one; a reader who
//      doesn't read the purse's line gets no card coin at all, so no amount.
//   9. The coin received is read from the find's purse line (after less before), never from anywhere else, and an
//      undone find received nothing.
//   10. Nothing here imports a component.
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../core/events.ts';
import type { Denomination } from '../inventory/coinWords.ts';
import { findCoinOf } from './findSend.ts';
import { findCardCoin, hoardCoin, hoardRows, MOST_COIN, type HoardRow } from './hoard.ts';

const COINS: Denomination[] = [
  { key: 'crown', label: 'crowns', unitName: 'crown', pluralName: 'crowns' },
  { key: 'heron', label: 'herons', unitName: 'heron', pluralName: 'herons' },
  { key: 'bit', label: 'bits' },
];
const ITEMS = new Set(['moon-opal']);
const piece = (text: string) => ({ kind: 'treasure', text });
/** The rows of the hoard a piece opens, at a place with this treasure. */
const rowsAt = (treasure: unknown[], tapped: string): HoardRow[] => hoardRows(piece(tapped), { treasure }, COINS, ITEMS).rows;
const NOTE = 'The book prints hn. once and defines no such coin; read as herons.';

describe("a hoard's coin (K21)", () => {
  it('one kind of coin: the amount as a purse holds it, the words as printed', () => {
    const coin = hoardCoin(rowsAt([{ text: '40 herons in a sock', coins: { heron: 40 } }], '40 herons in a sock'), COINS);
    expect(coin).toEqual({
      coins: { heron: 40 },
      amounts: [{ key: 'heron', amount: 40, words: '40 herons' }],
      printed: [{ entry: 0, text: '40 herons in a sock', readAs: null }],
      refused: [],
    });
  });

  it("several kinds over several rows: each coin added up, in the setting's order", () => {
    const treasure = [
      { text: 'A purse of bits and herons', coins: { bit: 7, heron: 3 }, hoard: 'Under the stair' },
      { text: '12 crowns', coins: { crown: 12 }, hoard: 'Under the stair' },
      { text: '40 herons in a sock', coins: { heron: 40 }, hoard: 'Under the stair' },
    ];
    const coin = hoardCoin(rowsAt(treasure, '12 crowns'), COINS)!;
    expect(coin.coins).toEqual({ crown: 12, heron: 43, bit: 7 });
    expect(coin.amounts.map((a) => a.words)).toEqual(['12 crowns', '43 herons', '7 bits']);
    expect(coin.printed.map((p) => p.text)).toEqual(['A purse of bits and herons', '12 crowns', '40 herons in a sock']);
  });

  it("coin and things: the coin only; a thing's worth is never coin (pf-24)", () => {
    const treasure = [
      { text: 'Two moon opals', itemId: 'moon-opal', value: { heron: 30 }, hoard: 'Shelf' },
      { text: 'A reed chest and the herons in it', coins: { heron: 12 }, value: { crown: 1 }, hoard: 'Shelf' },
      { text: 'A tin cup', value: { bit: 2 }, hoard: 'Shelf' },
    ];
    const coin = hoardCoin(rowsAt(treasure, 'A tin cup'), COINS)!;
    expect(coin.coins).toEqual({ heron: 12 });
    expect(coin.printed).toEqual([{ entry: 1, text: 'A reed chest and the herons in it', readAs: null }]);
  });

  it('no coin gives nothing, never a "0" line, a coin at 0 included', () => {
    expect(hoardCoin(rowsAt([{ text: 'A tin cup', value: { bit: 2 } }], 'A tin cup'), COINS)).toBeNull();
    expect(hoardCoin(rowsAt([{ text: 'An empty purse', coins: { heron: 0 } }], 'An empty purse'), COINS)).toBeNull();
    const some = hoardCoin(rowsAt([{ text: 'Herons, no bits', coins: { heron: 5, bit: 0 } }], 'Herons, no bits'), COINS)!;
    expect(some.amounts.map((a) => a.words)).toEqual(['5 herons']);
    expect(Object.keys(some.coins)).toEqual(['heron']);
    expect(hoardCoin([], COINS)).toBeNull();
  });

  it('big amounts stay whole; past the database limit a coin is refused, not cut', () => {
    const big = hoardCoin(rowsAt([{ text: 'A sunken strongbox', coins: { heron: 999999 } }], 'A sunken strongbox'), COINS)!;
    expect(big.coins).toEqual({ heron: 999999 });
    expect(Number.isInteger(big.coins.heron)).toBe(true);
    expect(big.amounts[0]!.words).toBe('999,999 herons');
    const treasure = [
      { text: 'A vault of herons', coins: { heron: MOST_COIN, bit: 3 }, hoard: 'Vault' },
      { text: 'One more heron', coins: { heron: 1 }, hoard: 'Vault' },
    ];
    const over = hoardCoin(rowsAt(treasure, 'One more heron'), COINS)!;
    expect(over.coins).toEqual({ bit: 3 });
    expect(over.refused).toEqual([{ entry: null, key: 'heron', why: 'tooMuch' }]);
  });

  it("keeps the book's words as printed, with the pack's own note (pk-11, pf-24a)", () => {
    const treasure = [{ text: '200 hn.', coins: { heron: 200 }, coinsReadAs: { printed: 'hn.', note: NOTE } }];
    const coin = hoardCoin(rowsAt(treasure, '200 hn.'), COINS)!;
    expect(coin.printed).toEqual([{ entry: 0, text: '200 hn.', readAs: { printed: 'hn.', note: NOTE } }]);
    expect(coin.amounts).toEqual([{ key: 'heron', amount: 200, words: '200 herons' }]);
  });

  it('refuses, by its reason, what no ruling settles: an unknown coin, an amount not whole', () => {
    const treasure = [{ text: 'A purse of mixed coin', coins: { crown: 2, zz: 9, heron: 1.5, bit: -4 } }];
    const coin = hoardCoin(rowsAt(treasure, 'A purse of mixed coin'), COINS)!;
    expect(coin.coins).toEqual({ crown: 2 });
    expect(coin.refused).toEqual(
      expect.arrayContaining([
        { entry: 0, key: 'zz', why: 'notACoin' },
        { entry: 0, key: 'heron', why: 'notWhole' },
        { entry: 0, key: 'bit', why: 'notWhole' },
      ]),
    );
    expect(coin.refused).toHaveLength(3);
    // A hoard whose only coin is refused still says so, with nothing to hand out.
    const none = hoardCoin(rowsAt([{ text: 'Odd coins', coins: { zz: 9 } }], 'Odd coins'), COINS)!;
    expect(none).toMatchObject({ coins: {}, amounts: [], refused: [{ entry: 0, key: 'zz', why: 'notACoin' }] });
  });
});

describe('the coin on a find card (K21, PK3)', () => {
  it("names each coin received in the setting's words, counting as one; none for a reader of no purse line", () => {
    expect(findCardCoin({ bit: 4, heron: 40, crown: 0 }, COINS)).toEqual({ lines: ['40 herons', '4 bits'], countsAs: 1, refused: [] });
    expect(findCardCoin(null, COINS)).toBeNull();
    expect(findCardCoin({}, COINS)).toBeNull();
    expect(findCardCoin({ heron: 0 }, COINS)).toBeNull();
    expect(findCardCoin({ zz: 3, heron: 2 }, COINS)).toEqual({ lines: ['2 herons'], countsAs: 1, refused: ['zz'] });
    expect(findCardCoin({ zz: 3 }, COINS)).toEqual({ lines: [], countsAs: 0, refused: ['zz'] });
  });
});

describe('the coin a find put in a purse, from its log lines (K21)', () => {
  let seq = 0;
  const line = (part: Partial<LogEvent>): LogEvent => {
    seq += 1;
    return { id: `e${seq}`, seq, type: 'find.give', level: 'simple', actorUserId: 'user-gm', targetTable: 'purses', targetId: 'purse-wren', before: null, after: null, fiat: false, reason: null, revertsEventId: null, requestId: 'r1', createdAt: '2026-11-15T10:00:00Z', ...part };
  };

  it("reads after less before on the find's purse line, and nothing without it", () => {
    const purse = line({ before: { coins: { heron: 5, bit: 2 } }, after: { coins: { heron: 45, bit: 2, crown: 1 } } });
    const thing = line({ targetTable: 'inventory_lines', before: null, after: { name: 'Moon opal', qty: 2 } });
    expect(findCoinOf([thing, purse])).toEqual({ heron: 40, crown: 1 });
    // Another player reads the thing's line only: no purse line, so no amount.
    expect(findCoinOf([thing])).toBeNull();
    // A purse line of another kind is not a find's.
    expect(findCoinOf([line({ type: 'purse.add', before: { coins: {} }, after: { coins: { heron: 9 } } })])).toBeNull();
  });

  it('an undone find received nothing', () => {
    const purse = line({ before: { coins: {} }, after: { coins: { heron: 40 } } });
    const undo = line({ type: 'find.undo', revertsEventId: purse.id, before: { coins: { heron: 40 } }, after: { coins: {} } });
    expect(findCoinOf([purse, undo])).toBeNull();
  });
});

describe('the module', () => {
  it('imports no component', () => {
    const sources = import.meta.glob<string>(['./hoard.ts', './findSend.ts'], { query: '?raw', import: 'default', eager: true });
    expect(Object.keys(sources)).toHaveLength(2);
    for (const source of Object.values(sources)) {
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
      for (const path of imports) expect(path).not.toMatch(/\.tsx$|\/app\/|\/ui\/|^react/);
    }
  });
});
