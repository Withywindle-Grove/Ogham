// The place page's head (5b; the lead, 2026-11-14): the actions sit beside the name only while its column keeps its floor.
import { describe, expect, it } from 'vitest';
import { headFits } from './placeHeadFit.ts';

describe('the place page head: beside the name or under it', () => {
  // Purpose: the actions fit beside the name exactly when the row holds the name's floor, the gap and the actions.
  it('fits when the row holds the floor, the gap and the actions, and not a pixel less', () => {
    expect(headFits(208 + 12 + 200, 208, 12, 200)).toBe(true);
    expect(headFits(208 + 12 + 200 - 1, 208, 12, 200)).toBe(false);
  });

  // Purpose: a card about 500 px wide (page 11's frames at 1024 px) fits a rule button and Move on beside a 13 rem name.
  it('fits the frames’ card and not a card squeezed to about 360 px', () => {
    const actions = 44 + 8 + 150;
    expect(headFits(500 - 32, 208, 12, actions)).toBe(true);
    expect(headFits(360 - 32, 208, 12, actions)).toBe(false);
  });
});
