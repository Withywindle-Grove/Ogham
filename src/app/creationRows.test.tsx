// @vitest-environment jsdom
// The second test's rows and entry (M5b step 0c, PR E; design/rulings/m5b-0c-creation-test-2-2026-11-02.md ct-1, ct-7;
// mockup creation/10-test-2-alternatives), on the invented fixture pack scripts/fixtures/m5b-creation.fixture.json.
//   A spell book's entry is one row per spell, and a spell row opens that spell's full rules, with a way back (ct-7).
//   A rolled book that is the step's only choice is one-of-many: its Pick writes the book and moves on with
//   "<row> picked · Undo"; Undo puts the picks back and returns to the step (ct-1).
//   Where the step has more to pick (two tables), a Pick never moves on.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../scripts/fixtures/m5b-creation.fixture.json?raw';
import { NO_PICKS, firstSpellsPlan, type FirstSpellsPicks, type FirstSpellsPlan } from '../modules/characters/firstSpells.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { FirstSpellsStep } from './FirstSpellsStep.tsx';

afterEach(() => cleanup());

const pack = JSON.parse(fixture) as Record<string, Record<string, unknown>[]>;
const entry = (e: Record<string, unknown>) => ({ packEntryId: String(e.id), name: String(e.name), data: e });
// The Fen Cantor rolls on two shared tables: First whispers (d4) and First charms (d2, a whole-book row).
const cantor = firstSpellsPlan(entry(pack.classes!.find((c) => c.id === 'fen-cantor')!), 1, {
  spells: pack.spells!.map(entry),
  lists: pack.spellLists!.map(entry),
  tables: pack.tables!.map(entry),
  choices: {},
})!;
// The same class with First charms as its only choice: a rolled book, one of many.
const charmsOnly: FirstSpellsPlan = { ...cantor, given: [], choose: null, cantrips: null, rolls: cantor.rolls.filter((g) => g.tableId === 'first-charms') };

function Step({ plan, onSave, onReturn }: { plan: FirstSpellsPlan; onSave: (book: string[]) => Promise<boolean>; onReturn?: () => void }) {
  const [picks, setPicks] = useState<FirstSpellsPicks>(NO_PICKS);
  return (
    <ToastHost>
      <FirstSpellsStep plan={plan} picks={picks} onPicks={setPicks} title="First spells" counter={{ at: 7, of: 9 }} why="Why" help={null} level={1} onBack={() => undefined} onSave={onSave} onReturn={onReturn} />
    </ToastHost>
  );
}

describe('a spell book’s entry (ct-7)', () => {
  it('lists one row per spell; a spell row opens its full rules, and Back returns to the book', async () => {
    const user = userEvent.setup();
    render(<Step plan={cantor} onSave={async () => true} />);
    await user.click(screen.getByRole('button', { name: 'Light and dark: read it' }));
    const book = within(await screen.findByRole('dialog', { name: '1: Light and dark' }));
    const rows = within(book.getByRole('list', { name: 'In 1: Light and dark' })).getAllByRole('button');
    expect(rows.map((r) => r.querySelector('.entry-panel__book-name')?.textContent)).toEqual(['Glimmer', 'Damp wick']);
    // Each row: the name, the line under it, the facts small.
    expect(rows[0]!.querySelector('.entry-panel__book-facts')?.textContent).toMatch(/^Level 1/);
    await user.click(rows[0]!);
    const spell = within(await screen.findByRole('dialog', { name: 'Glimmer' }));
    // A spell opened from its book is to read: the pick is the book's.
    expect(spell.queryByRole('button', { name: /^Pick/ })).toBeNull();
    await user.click(spell.getByRole('button', { name: 'Back to 1: Light and dark' }));
    expect(await screen.findByRole('dialog', { name: '1: Light and dark' })).toBeTruthy();
  });
});

describe('Pick → Next on a rolled book (ct-1)', () => {
  it('the only choice: Pick writes the book and moves on with a toast; Undo puts the picks back and returns to the step', async () => {
    const saved: string[][] = [];
    const onReturn = vi.fn();
    const user = userEvent.setup();
    render(<Step plan={charmsOnly} onSave={async (b) => (saved.push(b), true)} onReturn={onReturn} />);
    await user.click(screen.getByRole('radio', { name: /^1 Light and dark/ }));
    expect(saved).toEqual([['glimmer', 'damp-wick']]);
    expect(await screen.findByText('1: Light and dark picked')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onReturn).toHaveBeenCalledOnce();
    expect(screen.getByRole('radio', { name: /^1 Light and dark/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('with two tables to roll, a Pick stays on the step until Next', async () => {
    const saved: string[][] = [];
    const user = userEvent.setup();
    render(<Step plan={cantor} onSave={async (b) => (saved.push(b), true)} onReturn={() => undefined} />);
    await user.click(screen.getByRole('radio', { name: /^1 Light and dark/ }));
    expect(saved).toEqual([]);
    expect(screen.getByRole('radio', { name: /^1 Light and dark/ }).getAttribute('aria-checked')).toBe('true');
  });
});
