// @vitest-environment jsdom
// The procedure pop-up at the M5 gate (B14, ruled 2026-11-01; invented steps only):
//   Each step says what it does in the pack's own words (its note), never "A check", "A reminder", "A roll" or
//   "Done by the app"; a step with no note shows its name alone.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Mode, Step } from '../modules/expedition/modes.ts';
import type { Pip } from '../modules/expedition/hourTrack.ts';
import { HourTrack, ProcedureList } from './SceneProcedure.tsx';

afterEach(() => cleanup());

const step = (id: string, name: string, kind: Step['kind'], note: string | null): Step => ({
  id,
  name,
  icon: 'note',
  kind,
  note,
  tableId: null,
  tableBySeason: {},
  checkId: null,
  watchLength: null,
  checkAbility: null,
  onGoodRest: [],
  onBadRest: [],
});

const creeping = {
  id: 'creep',
  name: 'Creeping',
  procedure: [step('lamps', 'Lamps gutter', 'auto', 'Lamps burn down one turn.'), step('listen', 'Listen', 'note', null), step('mist', 'Marsh mist', 'roll', 'Roll for how thick the mist is.')],
  checks: [],
} as unknown as Mode;

describe('the procedure pop-up (B14)', () => {
  it("says what each step does in the pack's words, never the kind of step", () => {
    render(<ProcedureList mode={creeping} card={[]} recorded={new Map()} gm={false} onClose={() => undefined} />);
    const list = within(screen.getByRole('dialog', { name: 'Creeping: the procedure' }));
    expect(list.getByText('Lamps burn down one turn.')).toBeTruthy();
    expect(list.getByText('Roll for how thick the mist is.')).toBeTruthy();
    expect(list.getByText('Listen')).toBeTruthy();
    for (const words of ['A check', 'A reminder', 'A roll', 'Done by the app']) expect(list.queryByText(words)).toBeNull();
  });
});

// The hour track's edge (B8 follow-up, ruled 2026-11-01): on the hour's last turn, what falls due as the hour turns
// over sits on a next-hour pip past the edge, said as the next hour (not as a turn of this one), and the GM's
// Encounter check button can sit on it.
describe('HourTrack, the next hour at the edge', () => {
  const pip = (turn: number, extra: Partial<Pip> = {}): Pip => ({ turn, current: false, done: turn < 3, events: [], ...extra });
  const pips: Pip[] = [pip(1), pip(2), pip(3, { current: true }), pip(1, { next: true, done: false, events: [{ at: 0, symbol: 'encounter', label: 'Wandering check', public: false }] })];

  it('says the edge pip is the next hour and counts only this hour’s turns', () => {
    render(<HourTrack pips={pips} stepWord="Turn" />);
    const labels = within(screen.getByRole('list', { name: 'This hour' })).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'));
    expect(labels).toEqual(['Turn 1 of 3, done', 'Turn 2 of 3, done', 'Turn 3 of 3, now', 'Next hour, turn 1: Wandering check']);
  });

  it("puts the GM's Encounter check button on the edge pip when the check is due there", () => {
    render(<HourTrack pips={pips} stepWord="Turn" onCheckNow={() => {}} />);
    const edge = within(screen.getByRole('list', { name: 'This hour' })).getAllByRole('listitem').at(-1)!;
    expect(within(edge).getByRole('button', { name: 'Encounter check' })).toBeTruthy();
  });
});
