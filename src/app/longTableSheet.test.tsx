// @vitest-environment jsdom
// A table in its sheet with the typed roll and the range bar (m5b-long-tables; mockup creation/final/13, B with C's
// field; ruled 2026-11-09, replacing R3-4b's folds of 25; Design's rounds 2 and 3 on #571). Every name is invented.
// Purposes:
//   Typing 37 and Show shows row 37, never row 3: the whole number is read, not its first digit.
//   Typing 37 on a table whose row covers 37–40 shows that row: ranged rows are honoured.
//   A number no row covers (140, 0) says so in a line under the strip, keeps the number in the box and leaves every
//   row there; anything but a whole number says "Whole numbers only."; with nothing wrong there is no line at all.
//   The typed box doesn't depend on the bar: any table with a die has it (a 15-row d30 too); a table with no die
//   has none.
//   The bar goes by the number of rows, never the die: none under 50 rows (they scroll fine); from 50, the rows split
//   evenly into bands of 25–40 rows, labelled by the die values they cover ("1–25" … "76–100" for a d100 with a row
//   per value; "1–50", "51–100" for 50 rows of two).
//   The range bar holds the bands; a tap marks one, empties the box and brings every row back so the sheet can
//   scroll there. (That it scrolls, stays at the top and scrolls sideways on a phone is the layout spec's.)
//   No folds: the rows sit in one block per band; two columns from 24 rows (a class the layout spec measures).
//   Opened on a pick, the picked row is the one the sheet starts at (it carries the mark the scroll looks for).
//   Since cts-2 and cts-8 (2026-11-19) a short table marks too, and Take it takes: a 12-row trinket table and a 4-row
//   roll at a level mark on a tap, take only on Take it, and say "Mark a row first." when nothing is marked.
//   A long name table has the same box and bar (one table sheet for both): 37 shows that row's cell of the open part.
import { cleanup, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rowBands, tableOf, typedRow } from '../modules/characters/kindredTables.ts';
import { NameTableSheet, OneTableSheet } from './KindredTables.tsx';
import { ToastHost } from '../ui/ToastHost.tsx';

afterEach(cleanup);

const finds = tableOf({
  packEntryId: 'marsh-finds',
  name: 'Marsh finds',
  data: { die: 'd100', rows: Array.from({ length: 100 }, (_, i) => ({ min: i + 1, max: i + 1, result: `Find ${i + 1}` })) },
})!;
// Twenty-five rows of four: 1–4, 5–8 … 97–100.
const fours = tableOf({
  packEntryId: 'reed-omens',
  name: 'Reed omens',
  data: { die: 'd100', rows: Array.from({ length: 25 }, (_, i) => ({ min: i * 4 + 1, max: i * 4 + 4, result: `Omen ${i + 1}` })) },
})!;
/** A table of `count` rows, each `width` values wide. */
const ofRows = (count: number, width: number, die = 'd100') =>
  tableOf({ packEntryId: `rows-${count}`, name: 'Reed rows', data: { die, rows: Array.from({ length: count }, (_, i) => ({ min: i * width + 1, max: i * width + width, result: `Reed ${i + 1}` })) } })!;
// A d30 of 15 rows of two, as a kindred's trinket table.
const trinkets = ofRows(15, 2, 'd30');

const field = () => screen.getByLabelText('What you rolled') as HTMLInputElement;
/** The table's rows: the book's tapped rows, radios (dec-10 F-a: a long table marks, then Take it). */
const picks = () => within(screen.getByRole('dialog')).getAllByRole('radio');
const bar = () => screen.queryByRole('group', { name: 'Go to rows' });
async function show(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.clear(field());
  await user.type(field(), text);
  await user.click(screen.getByRole('button', { name: 'Show' }));
}

describe('the typed roll', () => {
  it('reads the whole number: 37 is row 37, 3 is row 3; a match has no line', () => {
    expect(typedRow(finds, '37')).toEqual({ row: 36, line: '' });
    expect(typedRow(finds, '3').row).toBe(2);
    expect(typedRow(finds, ' 37 ').row).toBe(36);
    expect(typedRow(finds, '')).toEqual({ row: null, line: '' });
  });

  it('37 and Show shows row 37 alone, never row 3; typing alone changes nothing; Show every row brings them back', async () => {
    const user = userEvent.setup();
    render(<OneTableSheet table={finds} picked={undefined} onPick={() => {}} onClose={() => {}} />);
    expect(field().getAttribute('inputmode')).toBe('numeric');
    await user.type(field(), '37');
    expect(picks()).toHaveLength(100);
    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(picks().map((p) => p.textContent)).toEqual(['37 Find 37']);
    expect(screen.queryByRole('status')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show every row' }));
    expect(picks()).toHaveLength(100);
    expect(field().value).toBe('');
  });

  it('a ranged row holds the number: 37 lands on 37–40, and a tap there is the pick', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    expect(typedRow(fours, '37').row).toBe(9);
    render(<OneTableSheet table={fours} picked={undefined} onPick={onPick} onClose={() => {}} />);
    await show(user, '37');
    expect(picks().map((p) => p.textContent)).toEqual(['37 to 40 Omen 10']);
    await user.click(picks()[0]!);
    // The tap marks it; Take it takes it (cs-15).
    expect(onPick).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Take it' }));
    expect(onPick).toHaveBeenCalledWith('Omen 10', 37);
  });

  it('a number no row covers says so under the strip, keeps the number and every row; not a whole number says so too', async () => {
    const user = userEvent.setup();
    expect(typedRow(finds, '0')).toEqual({ row: null, line: 'No row has 0.' });
    expect(typedRow(finds, '3.5')).toEqual({ row: null, line: 'Whole numbers only.' });
    render(<OneTableSheet table={finds} picked={undefined} onPick={() => {}} onClose={() => {}} />);
    await show(user, '140');
    const line = screen.getByRole('status');
    expect(line.textContent).toBe('No row has 140.');
    // Under the strip, not inside it.
    expect(line.closest('.table-sheet__bar')).toBeNull();
    expect(field().value).toBe('140');
    expect(picks()).toHaveLength(100);
    await show(user, '3.5');
    expect(screen.getByRole('status').textContent).toBe('Whole numbers only.');
  });

  it('a 15-row d30 has the box (no bar): 7 shows 7–8', async () => {
    const user = userEvent.setup();
    render(<OneTableSheet table={trinkets} picked={undefined} onPick={() => {}} onClose={() => {}} />);
    expect(bar()).toBeNull();
    await show(user, '7');
    expect(picks().map((p) => p.textContent)).toEqual(['7 to 8 Reed 4']);
  });

  it('a table with no die has no box', () => {
    render(<OneTableSheet table={ofRows(15, 1, '')} picked={undefined} onPick={() => {}} onClose={() => {}} />);
    expect(screen.queryByLabelText('What you rolled')).toBeNull();
    expect(picks()).toHaveLength(15);
  });
});

describe('the range bar’s bands, by the number of rows', () => {
  const bands = (count: number, width: number) => rowBands(ofRows(count, width))!.map((b) => [b.heading, b.rows.length]);
  const sizes = (count: number) => rowBands(ofRows(count, 1))!.map((b) => b.rows.length);

  it('no bar under 50 rows (49, 40, 24, 23), whatever the die; 50 rows make two bands of 25', () => {
    expect(rowBands(ofRows(49, 1))).toBeNull();
    expect(rowBands(ofRows(40, 1))).toBeNull();
    expect(rowBands(ofRows(24, 4))).toBeNull();
    expect(rowBands(ofRows(23, 1, 'd30'))).toBeNull();
    expect(sizes(50)).toEqual([25, 25]);
  });

  it('a d100 with a row per value: four bands of 25, labelled 1–25 … 76–100', () => {
    expect(bands(100, 1)).toEqual([
      ['1–25', 25],
      ['26–50', 25],
      ['51–75', 25],
      ['76–100', 25],
    ]);
  });

  it('ranged rows: labelled by the values they cover, 1–50 and 51–100 for 50 rows of two; 1–50, 51–100, 101–150 for 75', () => {
    expect(bands(50, 2)).toEqual([
      ['1–50', 25],
      ['51–100', 25],
    ]);
    expect(bands(75, 2)).toEqual([
      ['1–50', 25],
      ['51–100', 25],
      ['101–150', 25],
    ]);
  });

  it('from 50 rows every band is 25–40 rows (50 to 1,000 rows)', () => {
    for (let count = 50; count <= 1000; count += 1) {
      const all = sizes(count);
      expect(Math.min(...all)).toBeGreaterThanOrEqual(25);
      expect(Math.max(...all)).toBeLessThanOrEqual(40);
    }
  });
});

describe('the bar and the rows', () => {
  it('the bar holds the bands; a tap marks one, empties the box and brings every row back', async () => {
    const user = userEvent.setup();
    render(<OneTableSheet table={finds} picked={undefined} onPick={() => {}} onClose={() => {}} />);
    const buttons = within(bar()!);
    expect(buttons.getAllByRole('button').map((b) => b.textContent)).toEqual(['1–25', '26–50', '51–75', '76–100']);
    await show(user, '37');
    expect(picks()).toHaveLength(1);
    await user.click(buttons.getByRole('button', { name: '51–75' }));
    expect(buttons.getByRole('button', { name: '51–75' }).getAttribute('aria-pressed')).toBe('true');
    expect(field().value).toBe('');
    expect(picks()).toHaveLength(100);
  });

  it('has no folds: one block of rows per band, all there at once, in two columns', () => {
    render(<OneTableSheet table={finds} picked={undefined} onPick={() => {}} onClose={() => {}} />);
    expect(document.querySelector('details')).toBeNull();
    const block = screen.getByRole('group', { name: 'Marsh finds, 26–50' });
    expect(within(block).getAllByRole('radio')).toHaveLength(25);
    expect(block.classList.contains('table-sheet__long--columns')).toBe(true);
    expect(picks()).toHaveLength(100);
  });

  it('a 30-row table: two columns, no bar; a 15-row one: one column', () => {
    render(<OneTableSheet table={ofRows(30, 1, 'd30')} picked={undefined} onPick={() => {}} onClose={() => {}} />);
    expect(bar()).toBeNull();
    expect(document.querySelector('.table-sheet__long--columns')).not.toBeNull();
    cleanup();
    render(<OneTableSheet table={trinkets} picked={undefined} onPick={() => {}} onClose={() => {}} />);
    expect(document.querySelector('.table-sheet__long--columns')).toBeNull();
  });

  it('opened on a pick, the picked row carries the mark the sheet scrolls to', () => {
    render(<OneTableSheet table={finds} picked="Find 62" onPick={() => {}} onClose={() => {}} />);
    const marked = document.querySelectorAll('[data-picked]');
    expect(marked).toHaveLength(1);
    expect(within(marked[0] as HTMLElement).getByRole('radio').getAttribute('aria-checked')).toBe('true');
  });
});

describe('a long name table: the same box and bar', () => {
  const surnames = tableOf({
    packEntryId: 'long-names',
    name: 'Long names',
    data: { die: 'd100', columns: ['First names', 'Family names'], rows: Array.from({ length: 50 }, (_, n) => ({ min: n * 2 + 1, max: n * 2 + 2, cells: [`Alder${n + 1}`, `Brack${n + 1}`] })) },
  })!;

  it('has the bar and no folds; 37 shows the open part’s cell on row 37–38, and the next part keeps it', async () => {
    const user = userEvent.setup();
    render(<NameTableSheet table={surnames} tapped={[]} onTap={() => {}} onUse={() => {}} onClose={() => {}} asSheet />);
    expect(document.querySelector('details')).toBeNull();
    const sheet = within(screen.getByRole('dialog'));
    expect(within(sheet.getByRole('group', { name: 'Go to rows' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['1–50', '51–100']);
    expect(sheet.getAllByRole('radio')).toHaveLength(50);
    await show(user, '37');
    expect(sheet.getAllByRole('radio').map((r) => r.querySelector('.option-row__range')?.textContent)).toEqual(['37–38']);
    expect(sheet.getByRole('radio', { name: /Alder19/ })).toBeTruthy();
    await user.click(sheet.getByRole('button', { name: 'Family names' }));
    expect(sheet.getByRole('radio', { name: /Brack19/ })).toBeTruthy();
    expect(sheet.getAllByRole('radio')).toHaveLength(1);
  });
});

describe('mark and confirm at any length (cs-15; cts-2 and cts-8, 2026-11-19)', () => {
  // Purpose: since cts-2 and cts-8 a short table works as a long one (until then it picked on the tap, with Done): a
  // tap marks and takes nothing, Take it is plain until a row is marked and then the accent, and there is no Done.
  it('a short table and a long one both mark, and Take it takes the accent once marked', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<OneTableSheet table={ofRows(6, 1, 'd6')} picked={undefined} onPick={onPick} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Take it' }).className).toContain('button-secondary');
    await user.click(picks()[0]!);
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Take it' }).className).toContain('button-primary');
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    cleanup();
    const onLong = vi.fn();
    render(<OneTableSheet table={finds} title="Trinket" picked={undefined} onPick={onLong} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Trinket' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    // With nothing taken before, no Clear: the X is the way out.
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Take it' }).className).toContain('button-secondary');
    await user.click(picks()[4]!);
    expect(onLong).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Take it' }).className).toContain('button-primary');
  });
});

describe("a long table's mark follows what is taken (#786's review)", () => {
  /** The sheet as a caller keeps it: what is taken in state, Clear and Take it changing it. */
  function Kept({ onPick }: { onPick: (words: string | null) => void }) {
    const [taken, setTaken] = useState<string | undefined>('Find 5');
    return (
      <OneTableSheet
        table={finds}
        title="Trinket"
        picked={taken}
        onPick={(words) => {
          onPick(words);
          setTaken(words ?? undefined);
        }}
        onClose={() => {}}
      />
    );
  }

  // Purpose: after Clear takes the trinket off, its row is no longer ticked and Clear goes; Take it then says "Mark a
  // row first." rather than putting the same trinket back.
  it('after Clear no row is ticked, Clear is gone, and Take it asks for a row', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <ToastHost>
        <Kept onPick={onPick} />
      </ToastHost>,
    );
    expect(picks()[4]!.getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onPick).toHaveBeenLastCalledWith(null);
    expect(picks().filter((p) => p.getAttribute('aria-checked') === 'true')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Take it' }));
    expect((await screen.findAllByText('Mark a row first.')).length).toBeGreaterThan(0);
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  // Purpose: Take it on the row already taken closes the sheet with no second event.
  it('Take it on the row already taken only closes the sheet', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<OneTableSheet table={finds} title="Trinket" picked="Find 5" onPick={onPick} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Take it' }));
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});


describe('a short trinket table and a roll at a level (cts-8, "Yes, same format")', () => {
  // Purpose: a trinket table of 12 rows or fewer marks on a tap and takes only on Take it, titled with what is picked,
  // with no Pick on a row and no Done; Take it with nothing marked says "Mark a row first." (no box for own words).
  it('a 12-row trinket table marks on a tap and takes only on Take it', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <ToastHost>
        <OneTableSheet table={ofRows(12, 1, 'd12')} title="Trinket" picked={undefined} onPick={onPick} onClose={onClose} />
      </ToastHost>,
    );
    expect(screen.getByRole('dialog', { name: 'Trinket' })).toBeTruthy();
    expect(within(screen.getByRole('dialog')).queryAllByRole('button', { name: /^Pick/ })).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Or type your own' })).toBeNull();
    expect(screen.getByText('Roll d12, then mark your row.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Take it' }));
    expect((await screen.findAllByText('Mark a row first.')).length).toBeGreaterThan(0);
    expect(onClose).not.toHaveBeenCalled();
    await user.click(picks()[6]!);
    expect(onPick).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Take it' }));
    expect(onPick).toHaveBeenCalledWith('Reed 7', 7);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // Purpose: a kindred's roll at a level (a short table with no words of the player's own) marks the same way; the ✕
  // takes nothing.
  it('a 4-row roll at a level marks on a tap; the ✕ takes nothing; Take it takes the row', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<OneTableSheet table={ofRows(4, 1, 'd4')} title="Moss" picked={undefined} onPick={onPick} onClose={onClose} />);
    await user.click(picks()[1]!);
    expect(picks()[1]!.getAttribute('aria-checked')).toBe('true');
    expect(onPick).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
    cleanup();
    render(<OneTableSheet table={ofRows(4, 1, 'd4')} title="Moss" picked={undefined} onPick={onPick} onClose={onClose} />);
    await user.click(picks()[1]!);
    await user.click(screen.getByRole('button', { name: 'Take it' }));
    expect(onPick).toHaveBeenCalledWith('Reed 2', 2);
  });
});
