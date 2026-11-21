// @vitest-environment jsdom
// Prepare as drawn (PrepareSheet; dec-8 C, mockup magic/06): Francis's three fixes of 2026-11-18. Invented names: Wren,
// Brother Alder; Mire lamp, Mending hands, Candle ward, Still water.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareView } from '../modules/characters/magicView.ts';
import { PrepareSheet } from './PrepareScreen.tsx';

afterEach(() => cleanup());

const NAMES = new Map([
  ['lamp', 'Mire lamp'],
  ['hands', 'Mending hands'],
  ['ward', 'Candle ward'],
  ['still', 'Still water'],
]);
const at = (spell: string, level: number) => ({ spell, level });
const nothing = () => {};

function draw(who: string, view: ReturnType<typeof prepareView>, emptyBook = false) {
  render(
    <PrepareSheet
      who={who}
      view={view}
      nameOf={(spell) => NAMES.get(spell) ?? spell}
      lineOf={() => ''}
      levelTitle={(level) => `Level ${level}`}
      emptyBook={emptyBook}
      onMore={nothing}
      onFewer={nothing}
      onPick={nothing}
      onOpen={nothing}
      onClose={nothing}
    />,
  );
  return within(screen.getByRole('dialog', { name: 'Prepare' }));
}

describe('Prepare as drawn: the three fixes of 2026-11-18', () => {
  // Purpose (fix 1; frame 06, pl-1 as amended 2026-11-18): the fold "2 more at level 1" carries the square with +
  // while folded and − once open, never creation's chevron, though Prepare is in the book's type.
  it('the fold carries the + square, − once open, not the chevron', async () => {
    const user = userEvent.setup();
    const view = prepareView({ prepared: [], chosen: [at('hands', 1)] }, [2], new Map([[1, ['hands', 'ward', 'still']]]), undefined, { wholeList: true });
    const prepare = draw('Brother Alder', view);
    const fold = prepare.getByText('2 more at level 1').closest('details')!;
    // The square's drawing: the plus's path while folded, the minus's once open (as the fold's own test reads it).
    const square = () => fold.querySelector('.creation-fold__square svg path')?.getAttribute('d');
    expect(fold.querySelector('.creation-fold__mark')).toBeNull();
    expect(square()).toBe('M5 12h14M12 5v14');
    await user.click(prepare.getByText('2 more at level 1'));
    expect(fold.open).toBe(true);
    expect(square()).toBe('M5 12h14');
    expect(fold.querySelector('.creation-fold__mark')).toBeNull();
  });

  // Purpose (fix 2): a level with slots and nothing to choose says so in one short line under its level line, with no
  // stepper and no second line; a level that has spells doesn't say it.
  it('a level with nothing to choose says so in one line', () => {
    const view = prepareView({ prepared: [], chosen: null }, [1, 1], new Map([[1, ['lamp']], [2, []]]));
    const prepare = draw('Wren', view);
    const two = prepare.getByRole('region', { name: 'Level 2' });
    expect(within(two).getByText('Level 2, 1 a day. None chosen')).toBeTruthy();
    expect(within(two).getByText('Nothing to choose at level 2.')).toBeTruthy();
    expect(within(two).queryAllByRole('group')).toEqual([]);
    expect(two.querySelectorAll('p')).toHaveLength(1);
    const one = prepare.getByRole('region', { name: 'Level 1' });
    expect(within(one).getByRole('group', { name: 'Mire lamp' })).toBeTruthy();
    expect(within(one).queryByText(/Nothing to choose/)).toBeNull();
  });

  // Purpose (fix 3): an empty spell book shows its note alone: no level line, no "Nothing to choose" line, and the
  // foot says "Saved as you go" without counting slots still empty.
  it('an empty book shows its note with no level line and no "slot still empty"', () => {
    const view = prepareView({ prepared: [], chosen: null }, [1], new Map([[1, []]]));
    const prepare = draw('Wren', view, true);
    expect(prepare.getByText('No spells in your book yet. Your GM adds one when you learn it.')).toBeTruthy();
    expect(prepare.queryByRole('region', { name: 'Level 1' })).toBeNull();
    expect(prepare.queryByText(/a day\./)).toBeNull();
    expect(prepare.queryByText(/Nothing to choose/)).toBeNull();
    expect(prepare.getByText('Saved as you go')).toBeTruthy();
    expect(prepare.queryByText(/still empty/)).toBeNull();
  });

  // Purpose (round 3's review, Important): a book emptied while a spell is still chosen never hides that spell. The
  // note shows, and under it the chosen spell's level with its stepper, so the player sees what the next rest makes
  // ready and − can take it out; a level with nothing in it is left out, as the note already says the book is empty.
  it('an empty book with a spell still chosen keeps that spell, its level line and its stepper', () => {
    const view = prepareView({ prepared: [], chosen: [at('lamp', 1)] }, [2, 1], new Map([[1, []], [2, []]]));
    const prepare = draw('Wren', view, true);
    expect(prepare.getByText('No spells in your book yet. Your GM adds one when you learn it.')).toBeTruthy();
    const one = within(prepare.getByRole('region', { name: 'Level 1' }));
    expect(one.getByText('Level 1, 2 a day. 1 chosen')).toBeTruthy();
    const stepper = within(one.getByRole('group', { name: 'Mire lamp' }));
    expect(stepper.getByText('1')).toBeTruthy();
    expect(stepper.getByRole('button', { name: 'Less Mire lamp' })).toBeTruthy();
    expect(prepare.queryByRole('region', { name: 'Level 2' })).toBeNull();
    expect(prepare.queryByText(/Nothing to choose/)).toBeNull();
  });

  // Purpose (round 3's review, nit 2; the driver's call): the foot counts only the slots of levels that have something
  // to tap, so "Nothing to choose at level 2." is never followed by "2 slots still empty".
  it('the foot leaves out the slots of a level with nothing to choose', () => {
    const levels = new Map([[1, ['lamp']], [2, []]]);
    const open = draw('Wren', prepareView({ prepared: [], chosen: null }, [1, 2], levels));
    expect(open.getByText('Nothing to choose at level 2.')).toBeTruthy();
    expect(open.getByText('Saved as you go. 1 slot still empty')).toBeTruthy();
    cleanup();
    const full = draw('Wren', prepareView({ prepared: [], chosen: [at('lamp', 1)] }, [1, 2], levels));
    expect(full.getByText('Nothing to choose at level 2.')).toBeTruthy();
    expect(full.getByText('Saved as you go')).toBeTruthy();
    expect(full.queryByText(/still empty/)).toBeNull();
  });
});
