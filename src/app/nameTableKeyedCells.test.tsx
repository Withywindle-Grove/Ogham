// @vitest-environment jsdom
// Roll for a name (R3-1, R3-2; mockup creation/final/10), with a name table whose rows key their cells by column name
// ({"First half": "Reed-"}) instead of a `cells` list (the shape a table-generator pack uses). Every name is invented.
// Purposes:
//   No name table: no button. One table: Roll for a name opens its sheet at once. Several: a list with Open, and ← in
//   a table's sheet goes back to the list.
//   The sheet's first line is the pack's rollPrompt when the table has one, else "Roll d<N>, then tap the rows.".
//   A tap only marks a row (and moves to the next part's tab); Use this name fills the field from that one table, in
//   the pack's part order and joined by its `join`, and closes; "From <table>, rolled …" shows under the field.
//   Editing the field takes the line off; a re-roll replaces the name and the line.
//   Use this name with nothing tapped says why and fills nothing (never a disabled button).
//   With a part unpicked, Use this name writes only the picked parts, never a dangling hyphen ("Reed", not "Reed-"),
//   and the line under the field says what's still to roll (Design on #564).
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { nameColumns, tableOf, type CreationTable } from '../modules/characters/kindredTables.ts';
import { NameRoll, NameTableSheet } from './KindredTables.tsx';

afterEach(cleanup);

const keyed = tableOf({
  packEntryId: 'marsh-surnames',
  name: 'Marsh surnames',
  data: {
    die: 'd4',
    columns: ['First half', 'Second half'],
    join: '',
    rows: [
      { min: 1, max: 2, 'First half': 'Reed-', 'Second half': '-wick', result: 'Reed- / -wick' },
      { min: 3, max: 4, 'First half': 'Mire-', 'Second half': '-ford', result: 'Mire- / -ford' },
    ],
  },
})!;
const prompted = { ...keyed, id: 'prompted', rollPrompt: 'Roll d4 twice: a first half, then a second half.' };
const heron = tableOf({ packEntryId: 'heron-names', name: 'Heron first names', data: { die: 'd4', rows: [{ min: 1, max: 2, result: 'Wren' }, { min: 3, max: 4, result: 'Teal' }] } })!;

function Harness({ tables }: { tables: CreationTable[] }) {
  const [name, setName] = useState('');
  return (
    <>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <NameRoll tables={tables} name={name} onName={setName} />
    </>
  );
}
const field = () => screen.getByLabelText('Name') as HTMLInputElement;

describe('Roll for a name', () => {
  it('reads each column of a keyed table from the row keys', () => {
    expect(nameColumns(keyed).map((c) => [c.heading, c.cells.map((x) => x.text)])).toEqual([
      ['First half', ['Reed-', 'Mire-']],
      ['Second half', ['-wick', '-ford']],
    ]);
  });

  it('draws no button without a name table', () => {
    render(<Harness tables={[]} />);
    expect(screen.queryByRole('button', { name: 'Roll for a name' })).toBeNull();
  });

  it('with one table opens its sheet at once; a tap marks, Use this name fills the field joined and says where it came from', async () => {
    const user = userEvent.setup();
    render(<Harness tables={[keyed]} />);
    // No fold row any more (R3-1).
    expect(document.querySelector('details')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    const sheet = await screen.findByRole('dialog', { name: 'Marsh surnames' });
    // No pack prompt: the die only (R3-2).
    expect(within(sheet).getByText('Roll d4, then tap the rows.')).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'First half' }).getAttribute('aria-pressed')).toBe('true');
    // The only box is the typed roll (any table with a die, #571 round 3); the row is still the tap.
    expect(within(sheet).getAllByRole('textbox').map((box) => box.id)).toEqual([within(sheet).getByLabelText('What you rolled').id]);
    const reed = within(sheet).getByRole('radio', { name: /^1–2 Reed-/ });
    expect(reed.querySelector('.option-row__range')?.textContent).toBe('1–2');
    expect(reed.textContent).not.toContain(':');
    await user.click(reed);
    // A tap marks the row and moves to the next tab; the field is untouched until Use this name.
    expect(field().value).toBe('');
    expect(within(sheet).getByText('Picked: Reed-, second half still to roll.')).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Second half' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(sheet).getByRole('radio', { name: /^3–4 -ford/ }));
    expect(field().value).toBe('');
    await user.click(within(sheet).getByRole('button', { name: 'Use this name' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(field().value).toBe('Reedford');
    expect(screen.getByText('From Marsh surnames, rolled 1–2 and 3–4. Edit the field to change it.')).toBeTruthy();
  });

  it('editing the field takes the line off; a re-roll replaces the name and the line', async () => {
    const user = userEvent.setup();
    render(<Harness tables={[keyed]} />);
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    let sheet = await screen.findByRole('dialog', { name: 'Marsh surnames' });
    await user.click(within(sheet).getByRole('radio', { name: /^1–2 Reed-/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Use this name' }));
    // Only the picked half, its seam's hyphen gone; the line says what's still to roll.
    expect(field().value).toBe('Reed');
    expect(screen.getByText('From Marsh surnames, rolled 1–2, second half still to roll. Edit the field to change it.')).toBeTruthy();
    await user.type(field(), 'y');
    expect(screen.queryByText(/^From Marsh surnames/)).toBeNull();
    // Roll for a name stays for a re-roll.
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    sheet = await screen.findByRole('dialog', { name: 'Marsh surnames' });
    await user.click(within(sheet).getByRole('button', { name: 'First half' }));
    await user.click(within(sheet).getByRole('radio', { name: /^3–4 Mire-/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Use this name' }));
    expect(field().value).toBe('Mire');
    expect(screen.getByText('From Marsh surnames, rolled 3–4, second half still to roll. Edit the field to change it.')).toBeTruthy();
  });

  it('a second half alone is written without its hyphen, and the line says the first half is still to roll', async () => {
    const user = userEvent.setup();
    render(<Harness tables={[keyed]} />);
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    const sheet = await screen.findByRole('dialog', { name: 'Marsh surnames' });
    await user.click(within(sheet).getByRole('button', { name: 'Second half' }));
    await user.click(within(sheet).getByRole('radio', { name: /^3–4 -ford/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Use this name' }));
    expect(field().value).toBe('ford');
    expect(screen.getByText('From Marsh surnames, rolled 3–4, first half still to roll. Edit the field to change it.')).toBeTruthy();
  });

  it('Use this name with nothing tapped says why and fills nothing', async () => {
    const user = userEvent.setup();
    render(<Harness tables={[keyed]} />);
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    const sheet = await screen.findByRole('dialog', { name: 'Marsh surnames' });
    expect(within(sheet).getByText('Nothing picked yet.')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Use this name' }));
    expect(within(sheet).getByText('Tap a row first: Use this name puts it in the Name field.')).toBeTruthy();
    expect(field().value).toBe('');
  });

  it('starts the sheet with the pack’s rollPrompt when the table has one', async () => {
    const user = userEvent.setup();
    render(<Harness tables={[prompted]} />);
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    const sheet = await screen.findByRole('dialog', { name: 'Marsh surnames' });
    expect(within(sheet).getByText('Roll d4 twice: a first half, then a second half.')).toBeTruthy();
    expect(within(sheet).queryByText('Roll d4, then tap the rows.')).toBeNull();
  });

  it('with several tables lists them with Open; ← goes back to the list; the name is that one table’s', async () => {
    const user = userEvent.setup();
    render(<Harness tables={[heron, keyed]} />);
    await user.click(screen.getByRole('button', { name: 'Roll for a name' }));
    const list = await screen.findByRole('dialog', { name: 'Roll for a name' });
    expect(within(list).getByText('Two tables give names: open one.')).toBeTruthy();
    await user.click(within(list).getByRole('button', { name: /^Open Marsh surnames/ }));
    let sheet = await screen.findByRole('dialog', { name: 'Marsh surnames' });
    await user.click(within(sheet).getByRole('button', { name: 'Back' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Roll for a name' })).getByRole('button', { name: /^Open Heron first names/ }));
    sheet = await screen.findByRole('dialog', { name: 'Heron first names' });
    // A one-part table: "the row".
    expect(within(sheet).getByText('Roll d4, then tap the row.')).toBeTruthy();
    await user.click(within(sheet).getByRole('radio', { name: /^3–4 Teal/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Use this name' }));
    // One table makes the name; the tables are never combined (R3-1).
    expect(field().value).toBe('Teal');
    expect(screen.getByText('From Heron first names, rolled 3–4. Edit the field to change it.')).toBeTruthy();
  });
});

// A d100 name table of 20 rows (m5b-long-tables round 2: the bands go by the number of rows, so under 24 it is one
// list; the folds of 25 are gone): every row at once, no bar, each row's roll in its own column.
const hundred = tableOf({ packEntryId: 'long-surnames', name: 'Long surnames', data: { die: 'd100', rows: Array.from({ length: 20 }, (_, n) => ({ min: n * 5 + 1, max: n * 5 + 5, result: `Reed${n + 1}` })) } })!;

describe('a d100 name table of 20 rows', () => {
  it('is one list with no folds and no bar, the roll in its own column', () => {
    render(<NameTableSheet table={hundred} tapped={[]} onTap={() => {}} onUse={() => {}} onClose={() => {}} asSheet={false} />);
    expect(document.querySelector('details')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Go to rows' })).toBeNull();
    const rows = within(screen.getByRole('radiogroup', { name: 'Name' }));
    expect(rows.getAllByRole('radio').slice(5, 10).map((r) => r.querySelector('.option-row__range')?.textContent)).toEqual(['26–30', '31–35', '36–40', '41–45', '46–50']);
  });
});
