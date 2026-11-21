// @vitest-environment jsdom
// The Roll sequence's row rolled more than once (R3-8, retest 4 T3; Francis's phone test, 2026-11-09). What these
// check, in plain words:
//   * a row landed on twice shows two ✓ at the right (✓✓), and no count in words ("twice", "Picked ×2"); its − stays;
//   * three times shows three ✓; a row landed on once shows one;
//   * the foot keeps its list of what was tapped;
//   * a screen reader hears the count ("… picked twice", "… picked three times"), read aloud only (Design on #574).
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RollSequence, timesInWords, type RollSequenceRow } from './creation.tsx';

afterEach(cleanup);

const none = () => undefined;

function sequence(rows: RollSequenceRow[]) {
  render(<RollSequence label="Dredger's kit" line="Step 2 of 3: Tools, twice" rows={rows} status="Eel knife, Eel knife" last={false} onBack={none} onNext={none} onClose={none} preview />);
}

const marks = (el: HTMLElement) => (el.textContent ?? '').split('✓').length - 1;

describe('Roll sequence, a row rolled more than once', () => {
  // Purpose: a row landed on twice shows ✓✓ and says nothing about the count in words; its − to put one back stays.
  it('shows two marks and no "twice", with the − beside it', () => {
    sequence([
      { key: '0', text: '1–2: Eel knife', picked: true, times: 2, onPutBack: none, onPick: none },
      { key: '1', text: '3: Bog sling', picked: false, onPick: none },
    ]);
    const knife = screen.getByRole('radio', { name: /^1–2: Eel knife/ });
    expect(knife.querySelector('.row-check')?.textContent).toBe('✓✓');
    expect(marks(knife)).toBe(2);
    expect(knife.textContent).not.toMatch(/twice|Picked ×/);
    expect(screen.getByRole('button', { name: 'Put back one 1–2: Eel knife' })).toBeTruthy();
    // The foot's list is left as it is.
    expect(screen.getByRole('status', { name: 'Roll status' }).textContent).toBe('Eel knife, Eel knife');
  });

  // Purpose: three times shows three marks; a row landed on once shows one; an untapped row none.
  it('shows three marks for three times, one for once, none untapped', () => {
    sequence([
      { key: '0', text: '1–2: Eel knife', picked: true, times: 3, onPutBack: none, onPick: none },
      { key: '1', text: '3: Bog sling', picked: true, onPick: none },
      { key: '2', text: '4: Reed spear', picked: false, onPick: none },
    ]);
    const knife = screen.getByRole('radio', { name: /^1–2: Eel knife/ });
    expect(marks(knife)).toBe(3);
    expect(knife.textContent).not.toMatch(/three times/);
    expect(marks(screen.getByRole('radio', { name: /^3: Bog sling/ }))).toBe(1);
    expect(marks(screen.getByRole('radio', { name: /^4: Reed spear/ }))).toBe(0);
  });

  // Purpose: a screen reader hears how many times a row was rolled ("picked twice", "picked three times"), while
  // nothing of it is drawn; a row rolled once keeps its own words as its name.
  it('names a row rolled twice "… picked twice" and three times "… picked three times", read aloud only', () => {
    sequence([
      { key: '0', text: '1–2: Eel knife', picked: true, times: 2, onPutBack: none, onPick: none },
      { key: '1', text: '3: Bog sling', picked: true, times: 3, taken: 'Already rolled', onPutBack: none, onPick: none },
      { key: '2', text: '4: Reed spear', picked: true, onPick: none },
    ]);
    const knife = screen.getByRole('radio', { name: '1–2: Eel knife picked twice' });
    expect(knife.textContent).not.toContain('picked');
    expect(screen.getByRole('radio', { name: '3: Bog sling picked three times, Already rolled' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '4: Reed spear' })).toBeTruthy();
  });

  // Purpose: the counts read as a person says them, up to ten, then digits.
  it('says once, twice, three times … ten times, then 11 times', () => {
    expect([1, 2, 3, 10, 11].map(timesInWords)).toEqual(['once', 'twice', 'three times', 'ten times', '11 times']);
  });
});

describe("a kit's roll in the book's table (dec-10 F-a, picture creation/final 21-F3)", () => {
  // Purpose: a roll step's rows are the book's tapped table: its bar names what is rolled, the head row the die over
  // the column's word; each row's range in words in its own column; ✓✓ and − kept; the count line "Roll 2 of 3".
  it('draws the bar, the die over the column, the ranges in words, and keeps ✓✓ with its −', () => {
    render(
      <RollSequence
        label="Dredger's kit"
        line="Roll 2 of 3"
        roll={{ die: 'd4', words: 'Roll d4 twice, then tap each result.' }}
        table={{ title: 'Tools', column: 'Result' }}
        rows={[
          { key: '0', text: 'Eel knife', range: '1–2', picked: true, times: 2, onPutBack: none, onPick: none },
          { key: '1', text: 'Bog sling', range: '3', picked: false, onPick: none },
        ]}
        status="Eel knife, eel knife"
        last={false}
        onBack={none}
        onNext={none}
        onClose={none}
        preview
      />,
    );
    expect(screen.getByText('Roll 2 of 3')).toBeTruthy();
    expect(document.querySelector('.book-tap-head__bar')?.textContent).toBe('Tools');
    expect(document.querySelector('.book-tap-head__row')?.textContent).toBe('d4Result');
    const knife = screen.getByRole('radio', { name: /^1 to 2 Eel knife, picked twice/ });
    expect(marks(knife)).toBe(2);
    expect(screen.getByRole('button', { name: 'Put back one 1 to 2: Eel knife' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^3 Bog sling/ }).getAttribute('aria-checked')).toBe('false');
  });
});
