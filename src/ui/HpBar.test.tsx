// @vitest-environment jsdom
// The hit-point bar's look (plan m5b-sheet-revised 13): pips up to 20 segments, one continuous bar beyond. Invented figures.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HpBar } from './parts.tsx';

afterEach(cleanup);

describe('the HP bar', () => {
  // Purpose: up to 20 segments the bar draws one pip each, the last part-filled.
  it('draws one segment per fill up to 20', () => {
    const { container } = render(<HpBar fills={[1, 1, 0.5, 0]} />);
    expect(container.querySelectorAll('.hp-bar__segment')).toHaveLength(4);
    expect(container.querySelector('.hp-bar--whole')).toBeNull();
    expect(container.querySelectorAll('.hp-bar__segment--lost')).toHaveLength(1);
    const twenty = render(<HpBar fills={Array.from({ length: 20 }, () => 1)} />);
    expect(twenty.container.querySelectorAll('.hp-bar__segment')).toHaveLength(20);
  });

  // Purpose: more than 20 fills would be a crowd of slivers, so it draws one segment filled to the share left.
  it('draws one continuous segment when there are more than 20 fills', () => {
    const fills = [...Array.from({ length: 15 }, () => 1), ...Array.from({ length: 15 }, () => 0)];
    const { container } = render(<HpBar fills={fills} />);
    expect(container.querySelectorAll('.hp-bar__segment')).toHaveLength(1);
    expect(container.querySelector('.hp-bar--whole')).not.toBeNull();
    expect((container.querySelector('.hp-bar__fill') as HTMLElement).style.inlineSize).toBe('50%');
  });

  // Purpose: the single continuous fill that hpSegments gives above 100 HP is drawn as it is, a whole bar part filled.
  it('draws the one fill hpSegments gives for a big most as it is', () => {
    const { container } = render(<HpBar fills={[0.25]} />);
    expect(container.querySelectorAll('.hp-bar__segment')).toHaveLength(1);
    expect((container.querySelector('.hp-bar__fill') as HTMLElement).style.inlineSize).toBe('25%');
  });

  // Purpose: with no maximum there is no bar at all.
  it('draws nothing without fills', () => {
    const { container } = render(<HpBar fills={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
