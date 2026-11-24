// Same-name purchases as one row on the Gear step (plan dec-15 row 2; caf-1 to caf-3, caf-10). Invented names and prices.
import { describe, expect, it } from 'vitest';
import { boughtRows, purchaseCount, purchasesOf, shopPurchase, takeOneOut, withoutEntry, type Purchase } from './startingGear.ts';

const sling = (id: string): Purchase => ({ label: 'Bog sling', price: 15, lines: [{ id, qty: 1 }] });
const rope: Purchase = { label: 'Reed rope', price: 10, lines: [{ id: 'l-rope', qty: 1 }] };

/** Put back one from a row, as the row's button does: the last entry of the row, one taken out of it. */
function putBackOne(bought: Purchase[], name: string): { bought: Purchase[]; refund: number; taken: number } {
  const row = boughtRows(bought).find((r) => r.name === name)!;
  const last = row.entries[row.entries.length - 1]!;
  const part = takeOneOut(last);
  return { bought: withoutEntry(bought, last, part.left), refund: part.refund, taken: part.lines.reduce((n, l) => n + l.qty, 0) };
}

describe('same-name purchases as one row', () => {
  // Purpose: three buys of one name show as one row with "×3" and the sum of their prices, in the order first bought.
  it('groups three buys of one name into one row, summing the price', () => {
    const rows = boughtRows([sling('a'), rope, sling('b'), sling('c')]);
    expect(rows.map((r) => [r.name, r.count, r.price])).toEqual([
      ['Bog sling', 3, 45],
      ['Reed rope', 1, 10],
    ]);
  });

  // Purpose: the row's button puts back one: the row reads "×2", the coin gains one price, the pack loses one; putting
  // back the last one removes the row.
  it('puts back one at a time from a row of three, then removes the row', () => {
    let bought = [sling('a'), sling('b'), sling('c')];
    const first = putBackOne(bought, 'Bog sling');
    expect([first.refund, first.taken]).toEqual([15, 1]);
    expect(boughtRows(first.bought).map((r) => [r.name, r.count, r.price])).toEqual([['Bog sling', 2, 30]]);
    // The last one bought goes back first.
    expect(first.bought.map((p) => p.lines[0]?.id)).toEqual(['a', 'b']);
    bought = putBackOne(first.bought, 'Bog sling').bought;
    bought = putBackOne(bought, 'Bog sling').bought;
    expect(boughtRows(bought)).toEqual([]);
  });

  // Purpose: two single buys of a stackable that joined one stack share a label and a pack line; putting one back leaves
  // one entry (and so one in the pack and one row), not none.
  it('two single buys of a stackable: putting one back leaves the other', () => {
    const one: Purchase = { label: 'Dry rations', price: 10, lines: [{ id: 'l-stack', qty: 1 }] };
    const two: Purchase = { label: 'Dry rations', price: 10, lines: [{ id: 'l-stack', qty: 1 }] };
    const after = putBackOne([one, two], 'Dry rations');
    expect(after.taken).toBe(1);
    expect(after.bought).toEqual([one]);
    // Matched by its look when the entry itself is a copy (a record read back from the database).
    expect(withoutEntry([one, two], { ...two, lines: [...two.lines] })).toHaveLength(1);
  });

  // Purpose: what the shop records for a buy is as many as that buy added, never the joined stack's count the add reads
  // back (a store that joins stacks answers with the whole stack; at creation the real one keeps a draft's lines apart).
  it('a buy that joins a stack records only what it added', () => {
    const joined = { id: 'l-stack', qty: 5 };
    expect(shopPurchase('Dry rations', 1, 10, joined, 1)).toEqual({ label: 'Dry rations', price: 10, lines: [{ id: 'l-stack', qty: 1 }] });
    expect(shopPurchase('Dry rations', 3, 30, joined, 3)).toEqual({ label: 'Dry rations ×3', price: 30, lines: [{ id: 'l-stack', qty: 3 }] });
    // A bundle (a line of six for one bought) adds its units.
    expect(shopPurchase('Torches', 1, 10, { id: 'l-t', qty: 6 }, 6).lines).toEqual([{ id: 'l-t', qty: 6 }]);
  });

  // Purpose: two things of one name at two prices stay two rows (caf-3).
  it('keeps one name at two prices as two rows', () => {
    const cheap: Purchase = { label: 'Bog sling', price: 10, lines: [{ id: 'x', qty: 1 }] };
    expect(boughtRows([sling('a'), cheap, sling('b')]).map((r) => [r.name, r.count, r.price])).toEqual([
      ['Bog sling', 2, 30],
      ['Bog sling', 1, 10],
    ]);
  });

  // Purpose: a purchase of three at once shows in its name's row; putting one back leaves two in the pack and in the
  // record, refunds the price of one, and over the three put-backs the coin comes out even, never a coin more or less.
  it('a purchase of three at once joins its row and goes back one at a time', () => {
    const three: Purchase = { label: 'Dry rations ×3', price: 30, lines: [{ id: 'l-r', qty: 3 }] };
    const single: Purchase = { label: 'Dry rations', price: 10, lines: [{ id: 'l-r2', qty: 1 }] };
    expect(boughtRows([three, single]).map((r) => [r.name, r.count, r.price])).toEqual([['Dry rations', 4, 40]]);
    const after = putBackOne([three], 'Dry rations');
    expect(after).toEqual({ bought: [{ label: 'Dry rations ×2', price: 20, lines: [{ id: 'l-r', qty: 2 }] }], refund: 10, taken: 1 });
  });

  it('a price that does not divide evenly comes out even over all the put-backs', () => {
    // A bundle sold as one thing at one price, bought three at once: 10 does not divide by 3.
    let bought: Purchase[] = [{ label: 'Eel hooks ×3', price: 10, lines: [{ id: 'l-h', qty: 12 }] }];
    let refunds = 0;
    let taken = 0;
    for (let i = 0; i < 3; i++) {
      const step = putBackOne(bought, 'Eel hooks');
      bought = step.bought;
      refunds += step.refund;
      taken += step.taken;
      expect(Number.isInteger(step.refund)).toBe(true);
    }
    expect([bought, refunds, taken]).toEqual([[], 10, 12]);
  });

  // Purpose: a record written before the change opens and reads as before: its labels and prices untouched, a
  // "×3" label read as three, and a plain string entry listed with no lines (nothing to put back).
  it('reads a record written before the change as before', () => {
    const old = purchasesOf([{ label: 'Dry rations ×3', price: 30, lines: [{ id: 'l-r', qty: 3 }] }, 'Reed rope']);
    expect(old).toEqual([
      { label: 'Dry rations ×3', price: 30, lines: [{ id: 'l-r', qty: 3 }] },
      { label: 'Reed rope', price: 0, lines: [] },
    ]);
    expect(purchaseCount(old[0]!)).toEqual({ name: 'Dry rations', count: 3 });
    expect(purchaseCount({ label: 'Rope ×1' })).toEqual({ name: 'Rope ×1', count: 1 });
    expect(boughtRows(old).map((r) => [r.name, r.count])).toEqual([
      ['Dry rations', 3],
      ['Reed rope', 1],
    ]);
  });
});
