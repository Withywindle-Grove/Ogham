// @vitest-environment jsdom
// The die glyphs, the Roll row and the warning sign (plan m5b-creation-final-drafts A2, A3, A4).
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DieGlyph, dieOf, RollRow } from './dice.tsx';
import { Note, OptionRow, WarningLine } from './parts.tsx';

afterEach(cleanup);

describe('die glyphs (A3)', () => {
  // Purpose: the die named in a roll's words is the one drawn ("3d6 x 10 gp" is a d6); a die the app has no glyph for draws none.
  it('reads the die from a roll’s words', () => {
    expect(dieOf('3d6')).toBe(6);
    expect(dieOf('3d6 x 10 gp')).toBe(6);
    expect(dieOf('d100')).toBe(100);
    expect(dieOf('1d8 + 2')).toBe(8);
    expect(dieOf('2d4 + 1d6')).toBe(4);
    expect(dieOf('d3')).toBeNull();
    expect(dieOf('12')).toBeNull();
    expect(dieOf('')).toBeNull();
  });

  // Purpose: each die is its solid's outline at 2 px and its inner edges at 1 px, nothing filled, decorative only; d100 is two d10s side by side.
  it('draws the outline at 2 px, the inner edges at 1 px, and d100 as two d10s', () => {
    const { container } = render(
      <>
        <DieGlyph die={6} />
        <DieGlyph die={100} />
      </>,
    );
    const [d6, d100] = [...container.querySelectorAll('svg')];
    expect(d6!.getAttribute('aria-hidden')).toBe('true');
    expect(d6!.getAttribute('fill')).toBe('none');
    expect([...d6!.querySelectorAll('path')].map((p) => p.getAttribute('stroke-width'))).toEqual(['2', '1']);
    expect(d6!.classList.contains('die-glyph--d6')).toBe(true);
    expect(d100!.getAttribute('width')).toBe('48');
    expect(d100!.querySelectorAll('path')).toHaveLength(4);
  });
});

describe('the Roll row (A2)', () => {
  // Purpose: the Roll row is the die's glyph and the instruction as body text in bold (a paragraph, never a caption).
  it('shows the die and the instruction', () => {
    const { container } = render(<RollRow die={6}>Roll 3d6 at the table for each score, then enter what you rolled.</RollRow>);
    const row = screen.getByText('Roll 3d6 at the table for each score, then enter what you rolled.').closest('.roll-row')!;
    expect(row.tagName).toBe('P');
    expect(row.querySelector('.die-glyph--d6')).not.toBeNull();
    expect(container.textContent).toBe('Roll 3d6 at the table for each score, then enter what you rolled.');
  });

  // Purpose: with no die the app draws, the instruction stands alone.
  it('keeps the words when there is no glyph', () => {
    const { container } = render(<RollRow die={null}>Roll for each at the table, or type them.</RollRow>);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('Roll for each at the table, or type them.');
  });
});

describe('the warning sign (A4)', () => {
  // Purpose: a warning carries the sign (a triangle with "!") and its words, and never the plain ▲ any more.
  it('draws the sign with the words, on a line, a note and a not-allowed row', () => {
    const { container } = render(
      <>
        <WarningLine>Not open to stone kin</WarningLine>
        <Note tone="warning">Over the limit</Note>
        <OptionRow name="Eel knife" summary="" notAllowed="Already rolled" notAllowedLabel="" onPick={() => {}} />
      </>,
    );
    expect(container.querySelectorAll('.warning-sign')).toHaveLength(3);
    expect(container.textContent).not.toContain('▲');
    expect(screen.getByText('Not open to stone kin').closest('.warning-line')).not.toBeNull();
  });
});
