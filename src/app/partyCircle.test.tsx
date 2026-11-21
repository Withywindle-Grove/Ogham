// @vitest-environment jsdom
// The party circle (S12; page 16 T10). Purposes:
//   The hit-point bar under a circle keeps the app's rule at every size, as T10's does (one segment a point to 12, one
//   a 5 above, past 20 segments one continuous bar): 1 point is 1 segment, 14 is 3, 30 is 6, 999 one whole bar.
//   Hit points not set read "— of N", with an empty bar.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../core/supabase.ts';
import { PartyCircle } from './PartyCircle.tsx';

afterEach(() => cleanup());

const circle = (current: number | null, max: number) =>
  render(<PartyCircle db={{} as Db} campaignId="campaign-1" name="Bram" initials="B" portraitAssetId={null} light={null} dark={false} hp={{ current, max }} statuses={[]} label="Bram" onOpen={() => undefined} />);

describe('the party circle', () => {
  it('draws the hit-point bar by the app rule at 1, 14, 30 and 999 points', () => {
    for (const [max, segments] of [
      [1, 1],
      [14, 3],
      [30, 6],
      [999, 1],
    ] as const) {
      const { container, unmount } = circle(max, max);
      expect(container.querySelectorAll('.hp-bar__segment')).toHaveLength(segments);
      expect(container.querySelector('.hp-bar')!.className).toContain('hp-bar--small');
      if (max === 999) expect(container.querySelector('.hp-bar')!.className).toContain('hp-bar--whole');
      unmount();
    }
  });

  it('reads "— of 9" when the hit points are not set, with every segment empty', () => {
    const { container } = circle(null, 9);
    expect(container.textContent).toContain('— of 9');
    expect(container.querySelectorAll('.hp-bar__segment--lost')).toHaveLength(9);
  });
});
