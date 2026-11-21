// @vitest-environment jsdom
// The Roll row guard (creation retest 4 S1, 2026-11-09). Invented tables and lists only. Purpose: every roll on a
// pack-driven creation step sits in a Roll row with its die's glyph, never as loose words: the trait-list step, the
// Details step (its tables with one die or several, and Body's typed boxes), a kindred's table opened, a name table
// opened, and a kit's roll sequence. The guard fails on "Roll" words outside a Roll row (src/testing/rollRowGuard.ts).
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { physicalOf, tableOf, type CreationTable } from '../modules/characters/kindredTables.ts';
import { traitLines, traitListsOf } from '../modules/characters/traitLists.ts';
import { rollWordsOutsideRollRows } from '../testing/rollRowGuard.ts';
import { CreationLeave, DetailRow, RollSequence } from '../ui/creation.tsx';
import { ToastHost } from '../ui/ToastHost.tsx';
import { DetailsStep, NameTableSheet, OneTableSheet } from './KindredTables.tsx';
import { TraitListStep } from './TraitListStep.tsx';

afterEach(cleanup);

const table = (id: string, name: string, die: string, rows: Record<string, unknown>[], extra: Record<string, unknown> = {}): CreationTable => tableOf({ packEntryId: id, name, data: { die, rows, ...extra } })!;

/** Every die glyph in the page, by its sides. */
const glyphs = () => [...document.querySelectorAll('.roll-row .die-glyph')].map((g) => g.getAttribute('data-die'));

describe('every roll in its Roll row (S1)', () => {
  it('the trait-list step: the die in the step’s Roll row, with its glyph', () => {
    const [list] = traitListsOf([{ kind: 'traitList', packEntryId: 'fen-trades', name: 'Fen trades', data: { die: 'd6', notes: 'Roll 1d6 for your trade.', entries: [{ id: 'eel', name: 'Eel catcher', min: 1, max: 6 }] } }]);
    render(
      <ToastHost>
        <TraitListStep list={list!} chosen={[]} {...traitLines(list!)} help={null} onSave={async () => true} onBack={() => {}} />
      </ToastHost>,
    );
    expect(rollWordsOutsideRollRows(document.body)).toEqual([]);
    expect(glyphs()).toContain('6');
  });

  it('the Details step: one die or several, and Body’s typed boxes', () => {
    const mixed = [table('face', 'Face', 'd12', [{ min: 1, max: 12, result: 'A crooked nose' }]), table('voice', 'Voice', 'd8', [{ min: 1, max: 8, result: 'Hoarse' }])];
    render(
      <ToastHost>
        <CreationLeave onLeave={() => {}}>
          <DetailsStep
            tables={{ names: null, trinket: null, details: mixed, growth: null }}
            kindred="Bog folk"
            physical={physicalOf({ data: { age: '2d6 + 10 years', height: '4 ft + 1d6 in' } })}
            details={{ tables: {} }}
            title="Details"
            why="None of this changes the rules."
            help={null}
            counter={{ at: 8, of: 9 }}
            onBack={() => {}}
            onSave={() => {}}
          />
        </CreationLeave>
      </ToastHost>,
    );
    expect(rollWordsOutsideRollRows(document.body)).toEqual([]);
    expect(glyphs()).toContain('12');
  });

  it('a kindred’s table and a name table opened, and a table’s row before it’s rolled', () => {
    const looks = table('looks', 'Bog folk looks', 'd6', [{ min: 1, max: 6, result: 'Mossy hair' }]);
    const names = table('names', 'Bog folk names', 'd20', [{ min: 1, max: 20, cells: ['Alder', 'Brack'] }], { columns: ['First names', 'Family names'] });
    render(
      <ToastHost>
        <CreationLeave onLeave={() => {}}>
          <OneTableSheet table={looks} kindred="Bog folk" picked={undefined} onPick={() => {}} onClose={() => {}} />
          <NameTableSheet table={names} tapped={[]} onTap={() => {}} onUse={() => {}} onClose={() => {}} asSheet />
          {/* A kindred's or class's table on Who they are, before it's rolled. */}
          <DetailRow label="Bog folk looks" value="" roll="Roll d8" onOpen={() => {}} />
        </CreationLeave>
      </ToastHost>,
    );
    expect(rollWordsOutsideRollRows(document.body)).toEqual([]);
    expect(glyphs()).toEqual(expect.arrayContaining(['6', '20']));
    expect(document.querySelector('.detail-row__action .die-glyph--d8')).not.toBeNull();
  });

  it('a kit’s roll sequence', () => {
    render(
      <RollSequence
        label="Dredger's kit"
        line="Step 1 of 2: Tools, twice"
        roll={{ die: 'd4', words: 'Roll d4 twice at the table, then tap each result.' }}
        rows={[{ key: '0', text: '1–4: Eel knife', picked: true, times: 2, onPutBack: () => {}, onPick: () => {} }]}
        status="Eel knife, Eel knife"
        last={false}
        onBack={() => {}}
        onNext={() => {}}
        onClose={() => {}}
      />,
    );
    expect(rollWordsOutsideRollRows(document.body)).toEqual([]);
    expect(glyphs()).toContain('4');
  });

  // Purpose: the guard itself finds loose roll words, so it would have caught the missed steps.
  it('finds "Roll" words outside a Roll row', () => {
    render(
      <div>
        <p>Roll 1d6 at the table, then tap — or pick.</p>
        <p className="roll-row">Roll 1d8 for your looks.</p>
      </div>,
    );
    expect(rollWordsOutsideRollRows(document.body)).toEqual(['Roll 1d6 at the table, then tap — or pick.']);
  });
});
