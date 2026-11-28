// @vitest-environment jsdom
// The encounter tables' pages in the book's tapped table (sf-14, sf-5 and its ⚑ 2, N2; page 44, frame 44-16 ET1,
// approved 2026-11-26). Invented tables only. In plain words:
//   * the toast names the row's range, a colon and the row's words, never "Rolled:" and never a number nobody entered;
//   * a table's page draws the roll row, the table's name on its bar, and one tappable row per row of the table;
//   * a tap on a row is the answer, once; the tapped row is ticked (a checked radio), and Undo unticks it;
//   * "Go to number" as the pop-up has it (more than 20 numbers or more than 20 rows): the row found is marked and
//     takes the focus, never picked; a d20 table of a few rows has none;
//   * every row shape 07 allows still shows its words (a lookup's key, cells, items), and a row's other table and its
//     description stay under its words.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readTable, type ReadTable } from '../modules/expedition/tables.ts';
import { EncounterTables, tapOf, tapToast, type TableTap } from './EncounterTables.tsx';

afterEach(() => cleanup());

const harbour = readTable('harbour', 'Encounters in the harbour', {
  die: 'd20',
  rows: [
    { min: 1, max: 8, result: 'Nothing stirs' },
    { min: 9, max: 14, result: 'Gulls mob the boat', note: 'Anyone standing must sit or be knocked down.' },
    { min: 15, max: 16, result: 'Two bog lurkers rise from the weed' },
    { min: 17, max: 20, result: 'Tide', tableId: 'tide' },
  ],
})!;
const tide = readTable('tide', 'What the tide brings', { die: 'd6', rows: [{ min: 1, max: 3, result: 'Driftwood' }, { min: 4, max: 6, result: 'A drowned sheep', count: '1' }] })!;
const deep = readTable('deep', 'What the deep sends', {
  die: 'd100',
  rows: Array.from({ length: 11 }, (_, i) => ({ min: i * 9 + 1, max: i === 10 ? 100 : i * 9 + 9, result: `Deep thing ${i + 1}` })),
})!;

/** Opens one table's page from the list, as the GM does from "Encounter tables". */
function openPage(table: ReadTable, extra: ReadTable[] = []) {
  const tables = new Map([table, ...extra].map((t) => [t.id, t]));
  const unlights: (() => void)[] = [];
  const onTap = vi.fn<(tap: TableTap, unlight: () => void) => void>((_, unlight) => unlights.push(unlight));
  render(
    <EncounterTables
      title="Encounter tables"
      context="Rolled by hand"
      list={[{ tableId: table.id, likely: false, why: null, pinned: false }]}
      missing={[]}
      tables={tables}
      column={null}
      describe={(row) => row.note}
      onTap={onTap}
      onClose={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${table.name}`) }));
  return { onTap, unlights, page: within(screen.getByRole('dialog', { name: table.name })) };
}

describe("the toast's words (sf-14)", () => {
  // Purpose: the toast says the tapped row's range, a colon and its words, as the pop-up's does, never "Rolled:".
  it('names the range and the row\'s words: "15–16: Two bog lurkers rise from the weed"', () => {
    const tap = tapOf(harbour, [harbour.name], harbour.rows[2]!, null);
    expect(tapToast(tap)).toBe('15–16: Two bog lurkers rise from the weed');
    expect(tapToast(tap)).not.toMatch(/Rolled/);
  });

  // Purpose: a row with its count keeps the count in the words.
  it('keeps the count', () => {
    expect(tapToast(tapOf(tide, [tide.name], tide.rows[1]!, null))).toBe('4–6: A drowned sheep, 1');
  });
});

describe("a table's page, the book's tapped table (sf-14)", () => {
  // Purpose: the page draws the roll row and the table under its name, one row per row of the table, each a tap.
  it('draws the roll row, the table on its bar and every row as a tap', () => {
    const { page } = openPage(harbour, [tide]);
    expect(page.getByText('Roll d20, then tap the row.')).toBeTruthy();
    const rows = within(page.getByRole('group', { name: 'Encounters in the harbour' })).getAllByRole('radio');
    expect(rows).toHaveLength(4);
    expect(document.querySelector('.book-tap-head__bar')?.textContent).toBe('Encounters in the harbour');
    // A row's description and the table it opens stay under its words.
    expect(page.getByRole('radio', { name: /Gulls mob the boat/ }).textContent).toContain('Anyone standing must sit or be knocked down.');
    expect(page.getByRole('radio', { name: /Tide/ }).textContent).toContain('opens What the tide brings ›');
  });

  // Purpose: a tap is the answer, once, with the row's range; the row is ticked; Undo (unlight) unticks it.
  it('takes a tap as the answer, ticks the row, and Undo unticks it', () => {
    const { onTap, unlights, page } = openPage(harbour, [tide]);
    fireEvent.click(page.getByRole('radio', { name: /Two bog lurkers/ }));
    expect(onTap).toHaveBeenCalledOnce();
    expect(onTap.mock.calls[0]![0].roll).toBe('15–16');
    expect(page.getByRole('radio', { name: /Two bog lurkers/ }).getAttribute('aria-checked')).toBe('true');
    expect(page.getByRole('radio', { name: /Gulls/ }).getAttribute('aria-checked')).toBe('false');
    act(() => unlights[0]!());
    expect(page.getByRole('radio', { name: /Two bog lurkers/ }).getAttribute('aria-checked')).toBe('false');
  });

  // Purpose: a d100 table of 11 rows has "Go to number"; the row found is marked and focused, never picked.
  it('a d100 table has Go to number: the row found is marked, focused and not picked', () => {
    const { onTap, page } = openPage(deep);
    fireEvent.change(page.getByLabelText('Go to number'), { target: { value: '50' } });
    fireEvent.click(page.getByRole('button', { name: 'Go' }));
    const found = page.getByRole('radio', { name: /Deep thing 6/ });
    expect(found.closest('.book-tap-table__cell--found')).not.toBeNull();
    expect(document.activeElement).toBe(found);
    expect(found.getAttribute('aria-checked')).toBe('false');
    expect(onTap).not.toHaveBeenCalled();
  });

  // Purpose: a d20 table of a few rows has no "Go to number".
  it('a short d20 table has no Go to number', () => {
    const { page } = openPage(harbour, [tide]);
    expect(page.queryByLabelText('Go to number')).toBeNull();
  });
});

describe('every row shape still shows its words on the page (sf-14, 07)', () => {
  const words = (table: ReadTable) => {
    const { page } = openPage(table);
    return page.getAllByRole('radio').map((r) => r.textContent);
  };

  // Purpose: a lookup row { key, value } shows its key and its value.
  it('a lookup row: its key and its value', () => {
    expect(words(readTable('reed-tolls', 'Reed tolls', { kind: 'lookup', rows: [{ key: 'Footbridge', value: 'Two copper a crossing' }] })!)).toEqual(['Footbridge Two copper a crossing']);
  });

  // Purpose: a lookup row { key, values } shows every value under its header.
  it('a lookup row with values: each under its header', () => {
    expect(words(readTable('lamp-goods', 'Lamp goods', { kind: 'lookup', columns: ['Cost', 'Weight'], rows: [{ key: 'Lantern oil', values: ['3 copper', 1] }] })!)).toEqual([
      'Lantern oil Cost: 3 copper, Weight: 1',
    ]);
  });

  // Purpose: a rolled row with cells shows one cell per column, with its header.
  it('a rolled row with cells: one per column', () => {
    const table = readTable('mire-names', 'Mire names', { die: 'd6', columns: ['First name', 'Surname'], rows: [{ min: 1, max: 6, result: 'Brindle, Ashcombe', cells: ['Brindle', 'Ashcombe'] }] })!;
    expect(words(table)).toEqual(['1 to 6 First name: Brindle, Surname: Ashcombe']);
  });

  // Purpose: a row with items and no words shows its item list.
  it('a row with items: its item list', () => {
    expect(words(readTable('peat-finds', 'Peat finds', { die: 'd4', rows: [{ min: 1, max: 4, items: [{ name: 'Reed lantern', qty: 2 }] }] })!)).toEqual(['1 to 4 Reed lantern ×2']);
  });
});
