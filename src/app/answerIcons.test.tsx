// @vitest-environment jsdom
// S17 (plan dec-9-the-whole-scene; ic-6, page 21 frame SI2; page 16, T2): the answers of a line that came due carry
// their icons, as the row's one button in "Waiting for you" and as stacked buttons in its open card; ±1 and
// + Modifier keep their words (no icon is ruled for them).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardLine } from '../modules/expedition/card.ts';
import { readTable } from '../modules/expedition/tables.ts';
import { ICON_SET, type SetIconName } from '../ui/iconSet.ts';
import { ANSWER_ICON, firstAnswer, ReminderCard, type CardActions } from './ReminderCard.tsx';

afterEach(cleanup);

const line = (decision: CardLine['decision'], extra: Partial<CardLine> = {}): CardLine => ({
  key: `k-${decision}`,
  group: 'procedure',
  decision,
  name: 'Bog lurkers',
  icon: 'encounter',
  count: 1,
  stepId: null,
  note: null,
  check: null,
  tableId: null,
  recharge: null,
  nextAt: null,
  ...extra,
});

const check: CardLine['check'] = {
  checkId: 'c1',
  source: 'mode',
  chance: null,
  always: true,
  ruledOut: false,
  modifiers: [],
  hit: { tables: [], tableFrom: null, pick: false, column: null, columns: [], regionTable: null, regionTables: false, swap: null, noteOnly: true, candidates: [], note: null },
  encounter: true,
  secret: false,
  again: false,
};

const actions = (): CardActions => ({
  onHit: vi.fn(),
  onMiss: vi.fn(),
  onDone: vi.fn(),
  onAllDone: vi.fn(),
  onModifier: vi.fn(),
  onRecharge: vi.fn(),
  onRoll: vi.fn(),
  onCheckAgain: vi.fn(),
});

/** The button is a stacked button: the set's icon above its word. */
function stacked(button: HTMLElement, icon: SetIconName, word: string) {
  expect(button.className).toContain('stacked-button');
  expect(button.querySelector('path')!.getAttribute('d')).toBe(ICON_SET[icon].d);
  expect(button.textContent).toBe(word);
}

function card(l: CardLine, accent = true) {
  const a = actions();
  render(<ReminderCard title={null} card={[l]} stepSeconds={null} startedAt={null} stepWord="turn" pace="turn" single={{ accent, clearable: false }} {...a} />);
  return a;
}

describe('the answers’ icons (S17)', () => {
  // Purpose: each line's first answer, its row's one button in Waiting for you, names its icon: Hit the bullseye,
  // Check again the dice cup, Recharge the crystal wand (ic-6), Enter roll… the rolling dice and Done the tick (T2).
  it('gives every first answer its icon', () => {
    expect(firstAnswer(line('check', { check }))).toEqual({ id: 'hit', label: 'Hit', icon: 'bullseye' });
    expect(firstAnswer(line('again', { check }))).toEqual({ id: 'again', label: 'Check again', icon: 'rolling-dice-cup' });
    expect(firstAnswer(line('recharge', { recharge: { lineId: 'l1', amount: '1' } }))).toEqual({ id: 'recharge', label: 'Recharge', icon: 'crystal-wand' });
    expect(firstAnswer(line('roll', { tableId: 't1' }))).toEqual({ id: 'roll', label: 'Enter roll…', icon: 'rolling-dices' });
    expect(firstAnswer(line('done'))).toEqual({ id: 'done', label: 'Done', icon: 'check-mark' });
    expect(ANSWER_ICON.miss).toBe('shield-bounces');
  });

  // Purpose (B9; p2p-19, page 24 WY1b): a check with a table and no chance is a roll on the table: its first answer is
  // Enter roll… with the rolling dice, never Hit; with a chance, or with no table, it stays Hit. Its card draws one
  // Enter roll… and no Hit, Miss or faces; with no tables to open in the card, Enter roll… takes the hit's way.
  it('gives a roll on its table Enter roll…, and no Hit or Miss in its card', () => {
    const rolls = { ...check!, hit: { ...check!.hit, tables: ['harbour-encounters'], noteOnly: false } };
    expect(firstAnswer(line('check', { check: rolls }))).toEqual({ id: 'rollCheck', label: 'Enter roll…', icon: 'rolling-dices' });
    expect(firstAnswer(line('check', { check: { ...rolls, always: false, chance: { die: 'd6', on: [1] } } })).id).toBe('hit');
    const a = card(line('check', { check: rolls, name: 'Encounters in the harbour' }));
    const enter = screen.getByRole('button', { name: 'Enter roll, Encounters in the harbour' });
    stacked(enter, 'rolling-dices', 'Enter roll…');
    expect(enter.className).toContain('button-primary');
    for (const name of [/^Hit/, /^Miss/, /face/, /Modifier/]) expect(screen.queryByRole('button', { name })).toBeNull();
    fireEvent.click(enter);
    expect(a.onHit).toHaveBeenCalledOnce();
  });

  // Purpose (#1086's review, findings 2 and 3): a check's table opened in its card names its die's column by the
  // table's own column ("Encounter" only when it has none), and a row that leads to another table says so in its line
  // ("opens Harbour beasts ›"), as the full screen's rows do.
  it('opens the check’s table with its own column’s name and each row’s next table', () => {
    const harbour = readTable('harbour-encounters', 'Encounters in the harbour', {
      die: 'd20',
      columns: ['By day', 'By night'],
      rows: [
        { min: 1, max: 10, results: ['Nothing stirs', 'Fog'] },
        { min: 11, max: 20, results: ['Gulls', 'A seal'], tableId: 'harbour-beasts' },
      ],
    })!;
    const beasts = readTable('harbour-beasts', 'Harbour beasts', { die: 'd6', rows: [{ min: 1, max: 6, result: 'A seal, curious' }] })!;
    const plain = readTable('plain', 'Plain', { die: 'd6', rows: [{ min: 1, max: 6, result: 'Mist' }] })!;
    const tables = new Map([harbour, beasts, plain].map((t) => [t.id, t]));
    const rolls = (id: string) => line('check', { check: { ...check!, hit: { ...check!.hit, tables: [id], noteOnly: false } }, name: 'Encounters in the harbour' });
    const open = (l: CardLine) =>
      render(<ReminderCard title={null} card={[l]} stepSeconds={null} startedAt={null} stepWord="turn" pace="turn" single={{ accent: true, clearable: false }} roll={{ openKey: l.key, tables, describe: () => null }} {...actions()} />);
    open(rolls('harbour-encounters'));
    expect(document.querySelector('.book-tap-head__row')!.textContent).toContain('By day');
    expect(document.querySelector('.book-tap-head__row')!.textContent).not.toContain('Encounter');
    expect(screen.getByRole('radio', { name: /Gulls/ }).textContent).toContain('opens Harbour beasts ›');
    expect(screen.getByRole('radio', { name: /Nothing stirs/ }).textContent).not.toContain('opens');
    cleanup();
    open(rolls('plain'));
    expect(document.querySelector('.book-tap-head__row')!.textContent).toContain('Encounter');
  });

  // Purpose: in the open card a check's Hit (the accent) and Miss are stacked buttons with their icons, told apart by
  // their shapes; −1, +1 and + Modifier keep their words; a tap still answers.
  it('draws a check’s Hit and Miss stacked with their icons, the faces in words', () => {
    const a = card(line('check', { check }));
    const hit = screen.getByRole('button', { name: 'Hit, Bog lurkers' });
    stacked(hit, 'bullseye', 'Hit');
    expect(hit.className).toContain('button-primary');
    const miss = screen.getByRole('button', { name: 'Miss, Bog lurkers' });
    stacked(miss, 'shield-bounces', 'Miss');
    expect(miss.className).toContain('button-secondary');
    for (const name of ['−1 face, Bog lurkers', '+1 face, Bog lurkers', '+ Modifier, Bog lurkers']) {
      expect(screen.getByRole('button', { name }).querySelector('svg')).toBeNull();
    }
    fireEvent.click(miss);
    expect(a.onMiss).toHaveBeenCalledTimes(1);
  });

  // Purpose (the approval's fix 2, 2026-11-18): Hit and Miss stand on a row of their own, and −1, +1 and + Modifier on
  // the row below it, in that order.
  it('puts Hit and Miss on their own row, and the faces on the row below', () => {
    card(line('check', { check }));
    const answers = screen.getByRole('group', { name: 'Answer, Bog lurkers' });
    const faces = screen.getByRole('group', { name: 'Change the chance, Bog lurkers' });
    const names = (group: HTMLElement) => [...group.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(names(answers)).toEqual(['Hit, Bog lurkers', 'Miss, Bog lurkers']);
    expect(names(faces)).toEqual(['−1 face, Bog lurkers', '+1 face, Bog lurkers', '+ Modifier, Bog lurkers']);
    expect(answers.compareDocumentPosition(faces) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Purpose: Check again, Recharge, Enter roll… and Done are stacked buttons with their icons in the open card.
  it('draws Check again, Recharge, Enter roll… and Done with their icons', () => {
    card(line('again', { check }));
    stacked(screen.getByRole('button', { name: 'Check again, Bog lurkers' }), 'rolling-dice-cup', 'Check again');
    cleanup();
    const a = card(line('recharge', { recharge: { lineId: 'l1', amount: '1' } }));
    const recharge = screen.getByRole('button', { name: 'Recharge, Bog lurkers' });
    stacked(recharge, 'crystal-wand', 'Recharge');
    fireEvent.click(recharge);
    expect(a.onRecharge).toHaveBeenCalledTimes(1);
    cleanup();
    card(line('roll', { tableId: 't1' }), false);
    stacked(screen.getByRole('button', { name: 'Enter roll, Bog lurkers' }), 'rolling-dices', 'Enter roll…');
    stacked(screen.getByRole('button', { name: 'Done, Bog lurkers' }), 'check-mark', 'Done');
  });
});
