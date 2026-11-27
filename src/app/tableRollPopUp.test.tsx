// @vitest-environment jsdom
// "Roll…"'s pop-up (sf-5 of docs/plans/dec-scene-feedback.md; page 44, EN2, EN4 B, EN7 D to F, approved 2026-11-26).
// Invented tables only. In plain words:
//   * a tap on a row is the answer, once, with the row's range; the X records nothing;
//   * opened from "Change…" the row picked before is ticked and named as picked (a checked radio);
//   * a d100 table has "Go to number": the row found is marked (its own class), takes focus and is not picked; a row both
//     picked and found is drawn as picked only; a d20 table of a few rows has no "Go to number";
//   * loading shows nothing for 300 ms, then "Loading the table…" and skeleton rows;
//   * "Change…" picks a second time: check.setRoll takes a second row for the same result (no migration).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCommand, type CurrentUser } from '../core/commands.ts';
import { setCheckRoll, toCheckResult } from '../modules/expedition/reminderPlay.ts';
import { readTable } from '../modules/expedition/tables.ts';
import { createFakeDb } from '../testing/fakeDb.ts';
import { createAppRegistry } from './commandRegistry.ts';
import { TableRollPopUp, type TableTap } from './EncounterTables.tsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const harbour = readTable('harbour', 'Encounters in the harbour', {
  die: 'd20',
  rows: [
    { min: 1, max: 8, result: 'Nothing stirs' },
    { min: 9, max: 14, result: 'Gulls mob the boat' },
    { min: 15, max: 20, result: 'Two bog lurkers rise from the weed' },
  ],
})!;
const deep = readTable('deep', 'What the deep sends', {
  die: 'd100',
  rows: Array.from({ length: 11 }, (_, i) => ({ min: i * 9 + 1, max: i === 10 ? 100 : i * 9 + 9, result: `Deep thing ${i + 1}` })),
})!;
const tablesOf = (...list: (typeof harbour)[]) => new Map(list.map((t) => [t.id, t]));

function pop(props: Partial<Parameters<typeof TableRollPopUp>[0]> = {}) {
  const onRow = vi.fn<(tap: TableTap) => void>();
  const onClose = vi.fn();
  render(<TableRollPopUp title="Encounters in the harbour" table={harbour} tables={tablesOf(harbour, deep)} describe={() => null} onRow={onRow} onClose={onClose} {...props} />);
  return { onRow, onClose };
}

describe('"Roll…"\'s pop-up (sf-5)', () => {
  // Purpose: a tap on a row is the answer at once, recorded once with the row's own range (never a number nobody
  // entered); the X closes it with nothing recorded.
  it('takes a tapped row as the answer, and the X records nothing', () => {
    const { onRow, onClose } = pop();
    const dialog = screen.getByRole('dialog', { name: 'Encounters in the harbour' });
    expect(dialog.textContent).toContain('Roll d20, then tap the row.');
    fireEvent.click(screen.getByRole('radio', { name: /Gulls mob the boat/ }));
    expect(onRow).toHaveBeenCalledOnce();
    expect(onRow.mock.calls[0]![0].roll).toBe('9–14');
    expect(onRow.mock.calls[0]![0].words).toBe('Gulls mob the boat');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onRow).toHaveBeenCalledOnce();
  });

  // Purpose: opened from "Change…", the row picked before is ticked and named as picked; no other row is.
  it('ticks the row picked before when opened from "Change…"', () => {
    pop({ picked: 2 });
    const picked = screen.getByRole('radio', { name: /Two bog lurkers/ });
    expect(picked.getAttribute('aria-checked')).toBe('true');
    expect(picked.textContent).toContain('✓');
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
  });

  // Purpose: a d100 table has "Go to number"; the row it finds is marked as found (the rule, N2), takes focus, and is
  // not marked as picked; a d20 table of three rows has no "Go to number".
  it('finds a row on a d100 table without picking it', () => {
    const { onRow } = pop({ table: deep, title: 'What the deep sends' });
    fireEvent.change(screen.getByLabelText('Go to number'), { target: { value: '64' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    const found = screen.getByRole('radio', { name: /Deep thing 8/ });
    expect(found.closest('.book-tap-table__cell--found')).not.toBeNull();
    expect(found.getAttribute('aria-checked')).toBe('false');
    expect(document.activeElement).toBe(found);
    expect(document.querySelectorAll('.book-tap-table__cell--found')).toHaveLength(1);
    expect(onRow).not.toHaveBeenCalled();
    cleanup();
    pop();
    expect(screen.queryByLabelText('Go to number')).toBeNull();
  });

  // Purpose: a row both picked and found is drawn as picked (its wash and tick), never with the found rule as well.
  it('draws a row both picked and found as picked', () => {
    pop({ table: deep, title: 'What the deep sends', picked: 7 });
    fireEvent.change(screen.getByLabelText('Go to number'), { target: { value: '64' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByRole('radio', { name: /Deep thing 8/ }).getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('.book-tap-table__cell--found')).toBeNull();
  });

  // Purpose: while the table loads nothing shows for 300 ms, so a quick load never flashes; then one line and skeleton
  // rows, under the title given.
  it('shows the loading line and skeleton only after 300 ms', () => {
    vi.useFakeTimers();
    pop({ table: null });
    expect(screen.getByRole('dialog', { name: 'Encounters in the harbour' })).toBeTruthy();
    expect(screen.queryByText('Loading the table…')).toBeNull();
    expect(document.querySelector('.skeleton')).toBeNull();
    act(() => void vi.advanceTimersByTime(300));
    expect(screen.getByText('Loading the table…')).toBeTruthy();
    expect(document.querySelector('.skeleton')).not.toBeNull();
  });
});

describe('"Change…" picks a second time (sf-5)', () => {
  // Purpose: check.setRoll takes a second row for the same result, as "Change…" needs, with no new command or
  // migration: the result then holds the second row.
  it('lets check.setRoll set a second row on the same result', async () => {
    const world = createFakeDb();
    const gmId = world.addPerson('priya@lantern.example', 'Priya');
    const campaign = world.addCampaign('The Ash Barrows', gmId);
    world.tables.check_results.push({ id: 'result-1', campaign_id: campaign, check_key: 'check:mode:wander', name: 'Wandering things', source: 'mode', outcome: 'hit', undone: false, secret: true, revealed: false, version: 1 });
    const gm: CurrentUser = { id: gmId, roles: { [campaign]: 'gm' } };
    world.signInAs(gmId);
    const registry = createAppRegistry();
    const first = await runCommand(registry, world.db, gm, setCheckRoll, { campaignId: campaign, result: toCheckResult(world.tables.check_results[0]!), tableId: 'harbour', roll: '9–14', rowText: 'Gulls mob the boat' });
    expect(first.ok).toBe(true);
    const second = await runCommand(registry, world.db, gm, setCheckRoll, { campaignId: campaign, result: first.ok ? first.value : toCheckResult({}), tableId: 'harbour', roll: '15–20', rowText: 'Two bog lurkers rise from the weed' });
    expect(second.ok).toBe(true);
    expect(world.tables.check_results[0]).toMatchObject({ roll: '15–20', row_text: 'Two bog lurkers rise from the weed' });
  });
});
