// @vitest-environment jsdom
// M5 step 11, clicked through like a person would (invented words only):
//   PlaceLine (a player's "where you are", M5b g2): nothing before the GM shows a piece; then the name with the shown
//   pieces, in the order shown. (The Send sheet's tests went with it: Messaging replaced Send, M5b g4; see
//   Messages.test.tsx.)
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ScenePlace } from '../modules/expedition/placePlay.ts';
import { PlaceLine } from './PlaceCard.tsx';

afterEach(() => {
  cleanup();
});

const scene = (texts: string[]): ScenePlace => ({ group: 1, name: 'The Moth Gallery', pieces: texts.map((text, i) => ({ id: `piece-${i}`, kind: 'exit', text })), pictureAssetId: null });

describe('PlaceLine', () => {
  it('shows nothing before the GM shows a piece, then the name with the shown pieces in the order shown', () => {
    const { container, rerender } = render(<PlaceLine place={null} />);
    expect(container.innerHTML).toBe('');
    rerender(<PlaceLine place={scene([])} />);
    expect(container.innerHTML).toBe('');
    rerender(<PlaceLine place={scene(['Stairs up, to the north', 'Dusty frames and a draught.'])} />);
    expect(screen.getByRole('heading', { name: 'The Moth Gallery' })).toBeTruthy();
    expect([...container.querySelectorAll('.place-line__text')].map((p) => p.textContent)).toEqual(['Stairs up, to the north', 'Dusty frames and a draught.']);
  });

  // Purpose (2c, pf-3): a shown aspect reaches a player with its lead-in bold before its words.
  it("shows a shown aspect's lead-in bold", () => {
    const { container } = render(<PlaceLine place={{ ...scene([]), pieces: [{ id: 'a', kind: 'other', text: 'Low beams and a long hearth.', lead: 'Common room' }] }} />);
    expect(container.querySelector('.place-line__text')?.textContent).toBe('Common room. Low beams and a long hearth.');
    expect(screen.getByText('Common room.').tagName).toBe('STRONG');
  });
});
