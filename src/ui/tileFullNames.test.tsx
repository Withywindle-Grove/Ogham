// @vitest-environment jsdom
// Gate finding F8 (gate check 69), delivering the 2026-11-09 ruling "Tiles name things in full": a Save tile shows the
// pack's short name, else the first word of the save's name, never the bare key; a Score tile shows the ability's full
// name, never its short label. A label never breaks inside a word: the row takes fewer columns instead (the CSS rule is
// checked in creationRetest3.test.tsx; one height per row and whole words in tests/layout/fullSheet.spec.ts, a real
// browser). Invented names only.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { savesOf } from '../modules/characters/play.ts';
import { SaveRow, ScoreRow, tileColumnSteps } from './parts.tsx';

afterEach(cleanup);

const labels = (root: HTMLElement) => [...root.querySelectorAll('.stat-tile__label')].map((l) => l.textContent);

describe('Save tiles: the short name, else the first word (the 2026-11-09 ruling, F8)', () => {
  // Purpose: a save with a short name in the pack shows that short name on its tile, not its key.
  it("shows the pack's short name, not the key", () => {
    const saves = savesOf({ 'saves.D': 12 }, [{ saveCategories: [{ key: 'D', name: "Save against the bog lurker's mire breath", short: 'Mire' }] }]);
    const { container } = render(<SaveRow saves={saves} onOpen={() => {}} />);
    expect(labels(container)).toEqual(['Mire']);
  });

  // Purpose: a save with no short name shows the first word of its name (the fae-woodland bug: it showed "D").
  it('without a short name, shows the first word of the name, never the key', () => {
    const saves = savesOf({ 'saves.D': 12, 'saves.W': 13 }, [
      {
        saveCategories: [
          { key: 'D', name: 'Drowning or the mire breath' },
          { key: 'W', name: 'Wands, rods and staves' },
        ],
      },
    ]);
    const { container } = render(<SaveRow saves={saves} onOpen={() => {}} />);
    expect(labels(container)).toEqual(['Drowning', 'Wands']);
    expect(labels(container)).not.toContain('D');
    expect(labels(container)).not.toContain('W');
  });

  // Purpose: an abbreviation no longer than the key (a one-letter "D") is passed over for the name's first word; a
  // longer one is used.
  it('passes over a one-letter abbreviation, keeps a longer one', () => {
    const saves = savesOf({ 'saves.D': 12, 'saves.W': 13 }, [
      {
        saveCategories: [
          { key: 'D', name: 'Drowning or the mire breath', abbreviation: 'D' },
          { key: 'W', name: 'Wands, rods and staves', abbreviation: 'Wnd' },
        ],
      },
    ]);
    const { container } = render(<SaveRow saves={saves} onOpen={() => {}} />);
    expect(labels(container)).toEqual(['Drowning', 'Wnd']);
  });

  // Purpose: a save the pack doesn't name at all reads "Save <key>", never the bare key.
  it('a save with no name and no short name reads "Save <key>"', () => {
    const { container } = render(<SaveRow saves={savesOf({ 'saves.X': 14 }, [])} onOpen={() => {}} />);
    expect(labels(container)).toEqual(['Save X']);
  });

  // Purpose: a long label reaches its tile whole: nothing in the code cuts it or adds "…".
  it('keeps a long label whole, with no "…"', () => {
    const long = "Breath of the bog lurker's mire";
    const { container } = render(<SaveRow saves={[{ key: 'D', short: long, name: long, value: '999' }]} onOpen={() => {}} />);
    expect(container.querySelector('.stat-tile__label')!.textContent).toBe(long);
  });
});

describe('Score tiles: the full name (the 2026-11-09 ruling, F8)', () => {
  // Purpose: a score tile shows the ability's full name, and a score with no modifier line still gets its tile.
  it('shows the full name over the score, with or without a modifier', () => {
    const { container } = render(
      <ScoreRow
        scores={[
          { key: 'MUS', name: 'Muscle', value: '13', modifier: '+1' },
          { key: 'STD', name: 'Steadfastness of the drowned bells', value: '9' },
        ]}
        onOpen={() => {}}
      />,
    );
    expect(labels(container)).toEqual(['Muscle', 'Steadfastness of the drowned bells']);
    expect(container.querySelectorAll('.score-row > .stat-tile')).toHaveLength(2);
  });
});

describe('fewer columns rather than a broken word (Design on F8)', () => {
  // Purpose: when a word doesn't fit, five saves step down to even rows (three and two), and six scores from three
  // across to two columns of three rows; never 4 + 1.
  it('steps down through even column counts', () => {
    expect(tileColumnSteps(5, 5)).toEqual([5, 3, 2, 1]);
    expect(tileColumnSteps(6, 3)).toEqual([3, 2, 1]);
    expect(tileColumnSteps(6, 5)).toEqual([5, 3, 2, 1]);
    expect(tileColumnSteps(2, 5)).toEqual([2, 1]);
    expect(tileColumnSteps(0, 5)).toEqual([1]);
  });
});
