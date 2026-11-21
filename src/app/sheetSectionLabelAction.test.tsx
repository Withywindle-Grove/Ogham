// @vitest-environment jsdom
// A name beside a sheet section's heading (the Patron section, Francis 2026-11-12): plain, with a small ⓘ after it.
// Purposes:
//   The name sits inside the heading, opens what it names on a tap, and is read aloud by its own label.
//   The name is plain (the underline was not chosen), with a small ⓘ after it that says it opens.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SheetSection } from './SheetSection.tsx';

describe('a sheet section with a name beside its heading', () => {
  // Purpose: the name sits inside the heading, opens what it names on a tap, and is read aloud by its own label.
  it('puts the name in the heading and opens it on a tap', async () => {
    const onTap = vi.fn();
    render(
      <SheetSection label="Patron" labelAction={{ text: 'The bell keeper', label: 'Patron The bell keeper: open its entry', onTap }}>
        <p>Holy symbol: a reed bell</p>
      </SheetSection>,
    );
    const heading = screen.getByRole('heading', { name: /Patron/ });
    const name = screen.getByRole('button', { name: 'Patron The bell keeper: open its entry' });
    expect(heading.contains(name)).toBe(true);
    await userEvent.setup().click(name);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  // Purpose: the name is plain (the underline was not chosen), with a small ⓘ after it that says it opens.
  it('draws the name plain, with a small ⓘ after it', () => {
    render(
      <SheetSection label="Patron" labelAction={{ text: 'The bell keeper', label: 'open', onTap: () => {} }}>
        <p>x</p>
      </SheetSection>,
    );
    const name = screen.getByRole('button', { name: 'open' });
    expect(name.className).toBe('sheet__label-tap');
    expect(name.textContent).toBe('The bell keeper');
    expect(name.lastElementChild?.tagName.toLowerCase()).toBe('svg');
  });
});
