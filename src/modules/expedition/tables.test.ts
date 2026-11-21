// Reading a row from a roll made at the table (M5 step 6; D30). Invented tables only.
//   Plain rows read by range; composite dice ("d4/d10") by both dice typed as "3/7"; a matrix by its column.
//   A matrix needs a column picked first; a roll no row has, or a typo, says so plainly.
//   Odd rows are left out, and a table with none that can be read isn't a table.
//   A result can lead to one more table (by pattern, or by naming one), or by terrain (a row's next, ga-2).
import { describe, expect, it } from 'vitest';
import { linkedTables, nextTableId, rangeOf, readTable, rowFor, rowLabel, rowLeadsTo, rowNextChoices, rowText, tableLookup } from './tables.ts';

const plain = readTable('bog-things', 'Bog things', {
  die: 'd8',
  rows: [
    { min: 1, max: 2, result: 'Bog lurkers', count: '1d4' },
    { min: 3, max: 7, result: 'Nothing stirs' },
    { min: 8, max: 8, result: 'wild-marsh' },
    { oops: true },
  ],
  nextTablePattern: 'wild-{result}',
})!;

const composite = readTable('deep-things', 'Deep things', {
  die: 'd4/d10',
  rows: [
    { min: 1, max: 1, key: '1/1', result: 'Lantern eels', count: '2d4' },
    { min: 2, max: 2, key: '1/2', result: 'Reed wraith' },
  ],
})!;

const matrix = readTable('fen-kinds', 'Fen kinds', {
  die: 'd8',
  kind: 'matrix',
  columns: ['Road', 'Wild'],
  rows: [
    { level: '1-4', results: ['Pedlars', 'Bog lurkers'] },
    { level: '5+', results: ['Toll keepers', 'Mist hounds'] },
  ],
})!;

describe('reading the row', () => {
  it('a plain table by its range, with how many', () => {
    const read = rowFor(plain, '2');
    expect(read).toMatchObject({ ok: true, index: 0, result: 'Bog lurkers', count: '1d4' });
    expect(plain.rows).toHaveLength(3);
  });

  it('composite dice by both dice', () => {
    expect(rowFor(composite, '1 / 2')).toMatchObject({ ok: true, result: 'Reed wraith' });
    expect(rowFor(composite, '3')).toEqual({ ok: false, message: 'Type both dice, like 3/7 (d4/d10).' });
  });

  it('a matrix by the column picked; a column first', () => {
    expect(rowFor(matrix, '6')).toEqual({ ok: false, message: 'Pick a column first.' });
    expect(rowFor(matrix, '6', 'Wild')).toMatchObject({ ok: true, result: 'Mist hounds', column: 'Wild' });
    expect(rowFor(matrix, '99', 'Road')).toMatchObject({ ok: true, result: 'Toll keepers' });
  });

  it('says plainly when the roll fits no row, or is not a number', () => {
    expect(rowFor(plain, '9')).toEqual({ ok: false, message: 'No row of Bog things has 9. Check the roll.' });
    expect(rowFor(plain, 'two')).toEqual({ ok: false, message: 'Type a whole number, like 4.' });
    expect(rowFor(plain, ' ')).toEqual({ ok: false, message: 'Type what the dice showed.' });
  });

  it('a table with no rows that can be read is no table', () => {
    expect(readTable('x', 'X', { rows: [{ nothing: 1 }] })).toBeNull();
  });
});

describe('labels, ranges and one more table', () => {
  it('reads ranges written as text', () => {
    expect(rangeOf('3–4')).toEqual({ min: 3, max: 4 });
    expect(rangeOf('2')).toEqual({ min: 2, max: 2 });
    expect(rangeOf('8+')!.min).toBe(8);
    expect(rangeOf('lots')).toBeNull();
    expect(rowLabel(plain.rows[0]!)).toBe('1–2');
    expect(rowLabel(matrix.rows[1]!)).toBe('5+');
    expect(rowLabel(composite.rows[0]!)).toBe('1/1');
  });

  // Purpose: a row written "≤N" (N or less) reads as everything up to N, so a roll of N or lower (a modified one
  // below the die's lowest too) finds it, and its label stays "≤N".
  it('reads "≤N" as N or less', () => {
    expect(rangeOf('≤2')).toEqual({ min: Number.MIN_SAFE_INTEGER, max: 2 });
    expect(rangeOf('≤ 12')).toEqual({ min: Number.MIN_SAFE_INTEGER, max: 12 });
    expect(rangeOf('≤')).toBeNull();
    const low = readTable('fen-luck', 'Fen luck', { die: '1d6', rows: [{ roll: '≤2', result: 'Mud to the knees' }, { roll: '3-5', result: 'Dry going' }, { roll: '6+', result: 'A found path' }] })!;
    expect(low.rows.map(rowLabel)).toEqual(['≤2', '3–5', '6+']);
    expect(rowFor(low, '1')).toMatchObject({ ok: true, result: 'Mud to the knees' });
    expect(rowFor(low, '2')).toMatchObject({ ok: true, result: 'Mud to the knees' });
    expect(rowFor(low, '0')).toMatchObject({ ok: true, result: 'Mud to the knees' });
    expect(rowFor(low, '3')).toMatchObject({ ok: true, result: 'Dry going' });
  });

  it('a result leads to one more table by the pattern or by naming it, only when that table exists', () => {
    const known = tableLookup(['wild-marsh', 'bog-things']);
    expect(nextTableId(plain, 'marsh', known)).toBe('wild-marsh');
    expect(nextTableId(plain, 'bog-things', known)).toBe('bog-things');
    expect(nextTableId(plain, 'Nothing stirs', known)).toBeNull();
  });

  // Purpose (pack review area 2, 2026-11-03): a matrix cell 'B-Animal' with pattern 'wild-{result}' opens the table
  // 'wild-b-animal': ids match whatever their case, and a trailing marker such as "*" on the cell is trimmed.
  it("a matrix cell 'B-Animal' with pattern 'wild-{result}' opens the table 'wild-b-animal'", () => {
    const kinds = readTable('wild-kinds', 'Wild kinds', {
      die: 'd8',
      columns: ['Road', 'Wild'],
      rows: [
        { level: '1-4', results: ['B-Animal', 'C-Flyer*'] },
        { level: '5+', results: ['Toll keepers', 'Mist hounds'] },
      ],
      nextTablePattern: 'wild-{result}',
    })!;
    const known = tableLookup(['wild-b-animal', 'Wild-C-Flyer']);
    expect(rowLeadsTo(kinds, kinds.rows[0]!, 'Road', known)).toBe('wild-b-animal');
    expect(rowLeadsTo(kinds, kinds.rows[0]!, 'Wild', known)).toBe('Wild-C-Flyer');
    expect(rowLeadsTo(kinds, kinds.rows[1]!, 'Road', known)).toBeNull();
  });

  // Purpose (G-114, docs/11): a pattern table whose result "Fen-Beast*" leads to the table with id "next-fen-beast":
  // the book's capitals and its footnote star don't stop the lower-case id from matching.
  it('a pattern table whose result "Fen-Beast*" leads to the table "next-fen-beast"', () => {
    const fen = readTable('fen-roll', 'Fen roll', {
      die: 'd6',
      rows: [{ min: 1, max: 6, result: 'Fen-Beast*' }],
      nextTablePattern: 'next-{result}',
    })!;
    expect(rowLeadsTo(fen, fen.rows[0]!, null, tableLookup(['next-fen-beast', 'fen-roll']))).toBe('next-fen-beast');
  });
});

describe("a row's next table by terrain (ga-2)", () => {
  const folk = readTable('folk-met', 'Folk met', {
    die: 'd6',
    rows: [
      { min: 1, max: 3, result: 'Townsfolk', next: { byTerrain: { 'lantern-town': 'town-folk', settled: 'Farm-Folk' }, default: 'farm-folk' } },
      { min: 4, max: 6, result: 'Bog lurkers' },
    ],
  })!;
  const known = tableLookup(['town-folk', 'farm-folk', 'folk-met']);
  const split = folk.rows[0]!;

  // Purpose: a result that splits by terrain opens the city table in a city and the settled table elsewhere.
  it('opens the city table in the city, the settled one in settled country and elsewhere', () => {
    expect(rowLeadsTo(folk, split, null, known, { id: 'lantern-town', classId: 'settled' })).toBe('town-folk');
    expect(rowLeadsTo(folk, split, null, known, { id: 'hedge-lane', classId: 'settled' })).toBe('farm-folk');
    expect(rowLeadsTo(folk, split, null, known, { id: 'mire', classId: 'wild' })).toBe('farm-folk');
    expect(rowLeadsTo(folk, split, null, known)).toBe('farm-folk');
  });

  // Purpose: a terrain table the rules don't have falls back to the default.
  it('a missing terrain table falls back to the default', () => {
    const gap = tableLookup(['farm-folk']);
    expect(rowLeadsTo(folk, split, null, gap, { id: 'lantern-town', classId: 'settled' })).toBe('farm-folk');
  });

  // Purpose: the GM's choices in the header list every table the row may open, this terrain's first, each once.
  it("lists this terrain's table first, then the others, each once", () => {
    expect(rowNextChoices(split, { id: 'lantern-town', classId: null }, known)).toEqual(['town-folk', 'farm-folk']);
    expect(rowNextChoices(split, null, known)).toEqual(['farm-folk', 'town-folk']);
    expect(rowNextChoices(folk.rows[1]!, null, known)).toEqual([]);
    expect(linkedTables(folk, known)).toEqual(['farm-folk', 'town-folk']);
  });

  // Purpose: a row's next with nothing readable is a plain row (it still leads by name).
  it('a next with nothing readable is a plain row', () => {
    const odd = readTable('odd', 'Odd', { die: 'd6', rows: [{ min: 1, max: 6, result: 'farm-folk', next: { byTerrain: { mire: 7 } } }] })!;
    expect(odd.rows[0]!.next).toBeNull();
    expect(rowLeadsTo(odd, odd.rows[0]!, null, known)).toBe('farm-folk');
  });
});

// A name table says how its columns join (ct-7, G-192): in the GM's Tables a row reads as one name.
describe("a name table's join in the GM's Tables (ct-7)", () => {
  const halves = (extra: Record<string, unknown>) => readTable('fen-names', 'Fen names', { die: 'd4', columns: ['First half', 'Second half'], rows: [{ min: 1, max: 4, cells: ['Adder', 'ley'] }], ...extra })!;

  it('with join "" the row reads as one word; with join " " as two; without join each cell keeps its header', () => {
    const joined = halves({ join: '' });
    const spaced = halves({ join: ' ' });
    const plain = halves({});
    expect(rowText(joined, joined.rows[0]!, null)).toBe('Adderley');
    expect(rowText(spaced, spaced.rows[0]!, null)).toBe('Adder ley');
    expect(rowText(plain, plain.rows[0]!, null)).toBe('First half: Adder, Second half: ley');
    const hyphens = readTable('fen-names', 'Fen names', { die: 'd4', join: '', columns: ['First half', 'Second half'], rows: [{ min: 1, max: 4, cells: ['Adder-', '-bald'] }] })!;
    expect(rowText(hyphens, hyphens.rows[0]!, null)).toBe('Adderbald');
  });

  it('a rolled number reads the joined name', () => {
    const read = rowFor(halves({ join: '' }), '3');
    expect(read.ok && read.result).toBe('Adderley');
  });
});
