// Creation's Kindred and Class rows in alphabetical order (cs-38, dec-creation-order-and-closed-patrons-2026-11-13.md).
import { describe, expect, it } from 'vitest';
import { alphabetical } from './creationOrder.ts';

const row = (name: string, packId = 'pack-fen') => ({ name, packId });
const names = (rows: readonly { name: string }[]) => rows.map((r) => r.name);

describe('alphabetical rows (cs-38)', () => {
  it('orders by the name shown, whatever pack each comes from', () => {
    const rows = [row('Stone kin'), row('Bog folk'), row('Ash kin', 'pack-reed'), row('Moss kin', 'pack-reed')];
    expect(names(alphabetical(rows, ['pack-fen', 'pack-reed']))).toEqual(['Ash kin', 'Bog folk', 'Moss kin', 'Stone kin']);
  });

  it('ignores capitals', () => {
    expect(names(alphabetical([row('bog folk'), row('Ash kin'), row('Cinder Monk')]))).toEqual(['Ash kin', 'bog folk', 'Cinder Monk']);
  });

  it('sorts a name with a bracket by its whole text: the plain name first', () => {
    expect(names(alphabetical([row('Human (marsh)'), row('Hound'), row('Human')]))).toEqual(['Hound', 'Human', 'Human (marsh)']);
  });

  it('two of one name sit together, the campaign stack order deciding between them', () => {
    const fen = row('Bog folk', 'pack-fen');
    const reed = row('Bog folk', 'pack-reed');
    const rows = [reed, row('Ash kin', 'pack-reed'), fen, row('Stone kin')];
    expect(alphabetical(rows, ['pack-fen', 'pack-reed'])).toEqual([rows[1], fen, reed, rows[3]]);
    expect(alphabetical(rows, ['pack-reed', 'pack-fen'])).toEqual([rows[1], reed, fen, rows[3]]);
  });

  it('two of one name differing only in capitals still sit together in stack order', () => {
    const fen = row('Bog Folk', 'pack-fen');
    const reed = row('bog folk', 'pack-reed');
    expect(alphabetical([reed, fen], ['pack-fen', 'pack-reed'])).toEqual([fen, reed]);
  });

  it('leaves the rows given unchanged and keeps long names whole', () => {
    const long = 'Lantern Warden of the Drowned Causeway and the Thousand Reeds '.repeat(3);
    const rows = [row('Stone kin'), row(long)];
    const copy = [...rows];
    expect(names(alphabetical(rows))).toEqual([long, 'Stone kin']);
    expect(rows).toEqual(copy);
  });

  it('nothing to order is nothing', () => {
    expect(alphabetical([])).toEqual([]);
  });
});
