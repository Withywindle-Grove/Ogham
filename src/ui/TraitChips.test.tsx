// @vitest-environment jsdom
// The trait chips' spent uses (Design on PR #446): rings as the use dots draw them, and the words a screen reader hears.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TraitChips, UsePips } from './parts.tsx';

afterEach(cleanup);

describe('use pips on a trait chip (tc-2)', () => {
  // Purpose: a spent use shows as a ring after the filled dots (shape, not colour alone), in the muted part.
  it('draws a filled dot per use left, then a ring per spent one', () => {
    const { container } = render(<UsePips uses={3} spent={2} />);
    expect(container.textContent).toBe(' ●○○');
    expect(container.querySelector('.use-pips__spent')?.textContent).toBe('○○');
    expect(container.querySelector('.use-pips')?.getAttribute('aria-hidden')).toBe('true');
  });

  // Purpose: past five uses the marks turn to counts, so a long chip stays short, and nothing spent shows no ring.
  it('counts past five and shows no ring with nothing spent', () => {
    expect(render(<UsePips uses={7} spent={3} />).container.textContent).toBe(' ●×4 ○×3');
    cleanup();
    expect(render(<UsePips uses={7} spent={7} />).container.textContent).toBe(' ○×7');
    cleanup();
    const none = render(<UsePips uses={2} spent={0} />).container;
    expect(none.textContent).toBe(' ●●');
    expect(none.querySelector('.use-pips__spent')).toBeNull();
  });

  // Purpose: the screen reader hears the chip's label (what's left in words), never the dots themselves.
  it('names the chip with what is left, the dots hidden', () => {
    render(
      <TraitChips
        groups={[{ id: 'class', title: 'Calling, Lantern keeper', chips: [{ key: 'c1', name: 'Ward the light', uses: 3, spent: 2, drawback: false, laterLevel: null, label: 'Ward the light, 3 uses each rest, 1 of 3 left' }] }]}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Ward the light, 3 uses each rest, 1 of 3 left: open its entry' })).toBeTruthy();
  });
});
