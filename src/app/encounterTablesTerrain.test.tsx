// @vitest-environment jsdom
// A row's next table by terrain (ga-2; docs/07 tables, "Slot bands, terrain tables, set chances, best-of skills"),
// clicked through on the encounter tables' full screens. Invented tables only.
//   A row that splits by terrain opens the current terrain's table; elsewhere (or nowhere known) its default.
//   The table it opened shows the row's other tables as chips at the top; the GM taps one to open it instead.
//   A plain row (no next) shows no such chips.
//   Table library › (for reading) lists every table the row may open.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readTable, type ReadTable, type TerrainKey } from '../modules/expedition/tables.ts';
import { EncounterTables, TablesLibrary } from './EncounterTables.tsx';

afterEach(() => cleanup());

const plainRows = (result: string) => ({ die: 'd6', rows: [{ min: 1, max: 6, result }] });
const tables = new Map<string, ReadTable>(
  [
    readTable('folk-met', 'Folk met', {
      die: 'd6',
      rows: [
        { min: 1, max: 3, result: 'Townsfolk', next: { byTerrain: { 'lantern-town': 'town-folk' }, default: 'farm-folk' } },
        { min: 4, max: 6, result: 'Bog lurkers' },
      ],
    })!,
    readTable('town-folk', 'Town folk', plainRows('Lamplighters'))!,
    readTable('farm-folk', 'Farm folk', plainRows('Hedge pedlars'))!,
  ].map((t) => [t.id, t]),
);

function open(terrain: TerrainKey | null) {
  const onTap = vi.fn();
  render(
    <EncounterTables
      title="Wandering things, Hit"
      list={[{ tableId: 'folk-met', pinned: false, likely: true, why: null }]}
      missing={[]}
      tables={tables}
      column={null}
      describe={() => null}
      terrain={terrain}
      onTap={onTap}
      onClose={() => {}}
    />,
  );
  return onTap;
}

describe("a row's next table by terrain (ga-2)", () => {
  // Purpose: in the city, the row that splits by terrain says it opens the city's table and, tapped, opens it.
  it("in the city, the split row opens the city's table", async () => {
    const user = userEvent.setup();
    const onTap = open({ id: 'lantern-town', classId: 'settled' });
    await user.click(screen.getByRole('button', { name: /Folk met/ }));
    await user.click(screen.getByRole('button', { name: /Townsfolk, opens Town folk ›/ }));
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Folk met › Town folk' })).toBeTruthy();
  });

  // Purpose: elsewhere the same row opens the settled (default) table.
  it('elsewhere, the split row opens its default table', async () => {
    const user = userEvent.setup();
    open({ id: 'mire', classId: 'wild' });
    await user.click(screen.getByRole('button', { name: /Folk met/ }));
    await user.click(screen.getByRole('button', { name: /Townsfolk, opens Farm folk ›/ }));
    expect(screen.getByRole('dialog', { name: 'Folk met › Farm folk' })).toBeTruthy();
  });

  // Purpose: the table it opened offers the other one at the top; the GM taps it and that table opens instead.
  it('the GM can pick the other table from the top of the one it opened', async () => {
    const user = userEvent.setup();
    open(null);
    await user.click(screen.getByRole('button', { name: /Folk met/ }));
    await user.click(screen.getByRole('button', { name: /Townsfolk/ }));
    const chips = screen.getByRole('group', { name: 'Table by terrain' });
    expect(within(chips).getByRole('button', { name: 'Farm folk' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(chips).getByRole('button', { name: 'Town folk' }));
    expect(screen.getByRole('dialog', { name: 'Folk met › Town folk' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Lamplighters/ })).toBeTruthy();
    // Back goes to the table the row was in, not to the other choice.
    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByRole('dialog', { name: 'Folk met' })).toBeTruthy();
  });

  // Purpose: a table opened straight from the list (no split row behind it) shows no table chips.
  it('a table opened from the list shows no table chips', async () => {
    const user = userEvent.setup();
    open(null);
    await user.click(screen.getByRole('button', { name: /Folk met/ }));
    expect(screen.queryByRole('group', { name: 'Table by terrain' })).toBeNull();
  });

  // Purpose: Table library › (for reading) lists both tables the split row may open, below the rows.
  it('Table library › lists every table the split row may open', async () => {
    const user = userEvent.setup();
    render(<TablesLibrary tables={tables} pinned={null} describe={() => null} />);
    await user.click(screen.getByRole('button', { name: 'Table library ›' }));
    await user.click(screen.getByRole('button', { name: /Folk met/ }));
    expect(screen.getByRole('button', { name: /Farm folk/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Town folk/ })).toBeTruthy();
  });
});
