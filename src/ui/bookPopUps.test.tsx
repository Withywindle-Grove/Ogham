// @vitest-environment jsdom
// The Player tab's pop-ups in the book's format (tfb-1, tfb-2, 2026-11-19; plan test-feedback-2026-11-19 row C8; page
// M2, approved 2026-11-19 with fixes: "Got it" is the plain button). Invented words. Purposes, in plain words:
//   1. A pop-up you only read takes the book's red heading and ends with "Got it" at the right, a plain button that
//      closes it; its ✕ stays.
//   2. A pop-up you act in, opened from the Player tab, takes the red heading and keeps its own buttons, with no
//      "Got it".
//   3. The same pop-up opened anywhere else keeps the Sheet's own heading: the book's pop-ups are the Player tab's.
//   4. A figure's pop-up (the breakdown sheet) is a pop-up to read wherever it opens, the full sheet's page too.
//   5. The red heading reads on the pop-up's ground at the figures page M2 measured: 5.35 to 1 in light, 5.26 to 1 in
//      dark (both over 4.5).
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookPopUpScope, Dialog } from './Dialog.tsx';
import { BreakdownSheet } from './BreakdownSheet.tsx';

afterEach(cleanup);

const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
const tokensCss = fs.readFileSync('./src/ui/tokens.css', 'utf8');

function colours(theme: 'light' | 'dark'): Record<string, string> {
  const read = (block: string) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
  if (theme === 'light') return read(tokensCss.slice(tokensCss.indexOf(':root {'), tokensCss.indexOf('/* Spacing scale')));
  const darkAt = tokensCss.indexOf(":root[data-theme='dark'] {");
  return read(tokensCss.slice(darkAt, tokensCss.indexOf('}', darkAt)));
}

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const hitPoints = (onClose = () => {}) => (
  <Dialog label="Hit points" onClose={onClose}>
    <div className="dialog__actions">
      <button type="button" className="button-primary">
        Set
      </button>
      <button type="button" className="button-secondary">
        Cancel
      </button>
    </div>
  </Dialog>
);

describe('the book format of the Player tab’s pop-ups', () => {
  it('a pop-up you only read has the red heading and ends with "Got it", which closes it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog label="Weapon skills" onClose={onClose} reading>
        <p>Reed spear.</p>
      </Dialog>,
    );
    const pop = screen.getByRole('dialog', { name: 'Weapon skills' });
    expect(within(pop).getByRole('heading', { name: 'Weapon skills' }).className).toContain('book-heading');
    const got = within(pop).getByRole('button', { name: 'Got it' });
    // The plain button (approved 2026-11-19), at the foot, after the words.
    expect(got.className).toBe('button-secondary');
    expect(got.closest('.dialog__actions')?.classList.contains('dialog__got-it')).toBe(true);
    expect(pop.lastElementChild?.contains(got)).toBe(true);
    expect(within(pop).getByRole('button', { name: 'Close' })).toBeTruthy();
    await user.click(got);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a pop-up you act in, from the Player tab, has the red heading and its own buttons, no "Got it"', () => {
    render(<BookPopUpScope.Provider value>{hitPoints()}</BookPopUpScope.Provider>);
    const pop = screen.getByRole('dialog', { name: 'Hit points' });
    expect(pop.classList.contains('dialog--book')).toBe(true);
    expect(within(pop).getByRole('heading', { name: 'Hit points' }).className).toContain('book-heading');
    expect(within(pop).queryByRole('button', { name: 'Got it' })).toBeNull();
    expect(within(pop).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Set', 'Cancel']);
  });

  it('the same pop-up opened elsewhere keeps the Sheet’s own heading', () => {
    render(hitPoints());
    const pop = screen.getByRole('dialog', { name: 'Hit points' });
    expect(pop.classList.contains('dialog--book')).toBe(false);
    expect(within(pop).getByRole('heading', { name: 'Hit points' }).className).not.toContain('book-heading');
  });

  it('a figure’s pop-up is a pop-up to read wherever it opens, the full sheet’s page too', () => {
    render(<BreakdownSheet title="Ward" figure="16" figureHead rule={['A save halves the wound.']} source="Fen sample" onClose={() => {}} />);
    const pop = screen.getByRole('dialog', { name: 'Ward' });
    expect(within(pop).getByRole('heading', { name: 'Ward' }).className).toContain('book-heading');
    expect(within(pop).getByRole('button', { name: 'Got it' })).toBeTruthy();
    // The figure keeps its place beside the title (tfb-3).
    expect(pop.querySelector('.dialog__head .dialog__figure')?.textContent).toBe('16');
  });

  it('the red heading reads on the pop-up’s ground: 5.35 to 1 in light, 5.26 to 1 in dark', () => {
    const light = colours('light');
    const dark = colours('dark');
    expect(contrast(light['book-label']!, light.popup!)).toBeCloseTo(5.35, 2);
    expect(contrast(dark['book-label']!, dark.popup!)).toBeCloseTo(5.26, 2);
  });
});
