// @vitest-environment jsdom
// Every row shape docs/07 allows shows its words on the table screens (fix-table-row-shapes; docs/07 "tables" and
// "tables (new shapes)"). One reader serves the GM's tables screen, the table pop-up, Table library › and the GM reference:
// they all draw rows through TableRows. Invented tables only, then the real packs read in place when present.
// (Plain rows, composite dice and a matrix's column are covered in src/modules/expedition/tables.test.ts.)
//   A lookup row { key, value } shows its key and its value.
//   A lookup row { key, values } shows its key and every value, each under its column's header, with no column chips.
//   A rolled row with cells shows one cell per column, each with its header, and no column chips (cells aren't a pick).
//   A row with items and no words shows its item list.
//   In the real packs, no table renders a row empty, and no row is left out (skipped when the packs aren't there).
import { cleanup, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readTable, type ReadTable } from '../modules/expedition/tables.ts';
import { TableRows } from './EncounterTables.tsx';

describe('every row shape shows its words', () => {
  const show = (table: ReadTable | null) => {
    cleanup();
    expect(table).not.toBeNull();
    render(<TableRows table={table!} trail={[table!.name]} column={null} lit={null} describe={() => null} leadsTo={() => null} />);
    return within(screen.getByRole('list', { name: table!.name }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
  };

  it('a lookup row { key, value }: its key and its value', () => {
    const rows = show(readTable('reed-tolls', 'Reed tolls', { kind: 'lookup', rows: [{ key: 'Footbridge', value: 'Two copper a crossing' }, { key: 'Ferry', value: 'A silver a head' }] }));
    expect(rows).toEqual(['FootbridgeTwo copper a crossing', 'FerryA silver a head']);
  });

  it('a lookup row { key, values }: its key and every value under its header', () => {
    const rows = show(
      readTable('lamp-goods', 'Lamp goods', { kind: 'lookup', columns: ['Cost', 'Weight'], rows: [{ key: 'Lantern oil', values: ['3 copper', 1] }, { key: 'Wick', values: ['1 copper', 0] }] }),
    );
    expect(rows).toEqual(['Lantern oilCost: 3 copper, Weight: 1', 'WickCost: 1 copper, Weight: 0']);
    expect(screen.queryByRole('group', { name: 'Column' })).toBeNull();
  });

  it('a rolled row with cells: one per column, with its header, and no column chips', () => {
    const rows = show(
      readTable('mire-names', 'Mire names', {
        die: 'd6',
        columns: ['First name', 'Surname'],
        rows: [
          { min: 1, max: 3, result: 'Brindle, Ashcombe', cells: ['Brindle', 'Ashcombe'] },
          { min: 4, max: 6, result: 'Tamsin, Reedlow', cells: ['Tamsin', 'Reedlow'] },
        ],
      }),
    );
    expect(rows).toEqual(['1–3First name: Brindle, Surname: Ashcombe', '4–6First name: Tamsin, Surname: Reedlow']);
    expect(screen.queryByRole('group', { name: 'Column' })).toBeNull();
  });

  it('a row with items and no words: its item list', () => {
    const rows = show(
      readTable('peat-finds', 'Peat finds', {
        die: 'd4',
        rows: [
          { min: 1, max: 2, items: [{ name: 'Reed lantern', qty: 2 }] },
          { min: 3, max: 4, items: [{ name: 'Bog-iron pot', qty: 1 }, { name: 'Wick', qty: 3 }] },
        ],
      }),
    );
    expect(rows).toEqual(['1–2Reed lantern ×2', '3–4Bog-iron pot, Wick ×3']);
  });
});

describe('the real packs', () => {
  it(
    'no table renders a row empty, and no row is left out',
    async ({ skip }) => {
      // Read in place, never copied: PACKS_DIR, else packs/_current here or in the main folder above a worktree.
      // (src has no Node types: the two Node calls used are typed here.)
      const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { existsSync: (p: string) => boolean; readdirSync: (p: string) => string[]; readFileSync: (p: string, e: 'utf8') => string };
      const node = (globalThis as unknown as { process: { env: Record<string, string | undefined>; cwd: () => string } }).process;
      const here = node.cwd().replace(/\\/g, '/');
      const packsDir = [node.env.PACKS_DIR, `${here}/packs/_current`, `${here}/../../../packs/_current`].find((d): d is string => !!d && fs.existsSync(d));
      if (!packsDir) return skip();
      const tables: { file: string; table: Record<string, unknown> }[] = [];
      const walk = (value: unknown, file: string): void => {
        if (Array.isArray(value)) return value.forEach((v) => walk(v, file));
        if (!value || typeof value !== 'object') return;
        for (const [key, inner] of Object.entries(value)) {
          if (key === 'tables' && Array.isArray(inner)) for (const t of inner) if (t && typeof t === 'object' && Array.isArray((t as { rows?: unknown }).rows)) tables.push({ file, table: t as Record<string, unknown> });
          walk(inner, file);
        }
      };
      for (const file of fs.readdirSync(packsDir).filter((f) => f.endsWith('.json'))) walk(JSON.parse(fs.readFileSync(`${packsDir}/${file}`, 'utf8')), file);
      expect(tables.length).toBeGreaterThan(0);
      const empty: string[] = [];
      for (const { file, table } of tables) {
        const raw = (table.rows as unknown[]).filter((r) => r && typeof r === 'object');
        if (raw.length === 0) continue;
        const read = readTable(String(table.id), String(table.name ?? table.id), table);
        const html = read ? renderToStaticMarkup(<TableRows table={read} trail={[read.name]} column={null} lit={null} describe={() => null} leadsTo={() => null} />) : '';
        const words = [...html.matchAll(/<span class="table-rows__result">([^<]*)<\/span>/g)].map((m) => m[1]!.trim());
        const shown = words.filter((w) => w !== '').length; // a printed dash ("—") is the book's own word, so it counts (Francis, 2026-11-05)
        if (shown !== raw.length) empty.push(`${file}: ${String(table.id)} (${shown} of ${raw.length} rows show words)`);
      }
      expect(empty).toEqual([]);
    },
    60_000,
  );
});
