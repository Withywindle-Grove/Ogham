// @vitest-environment jsdom
// The To finish card's notice variant (the Player tab's notices sheet, frame M1e of page M1; Francis's fix of
// 2026-11-20). Purposes, in plain words:
//   In the notices sheet "You can play now." is a plain line, not a heading, and each step is a row with its chevron
//   (never "›"), a tap on it opening that step.
//   The full sheet's card keeps its heading and its boxed lines with "›".
// Invented words only.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToFinishCard } from './organisms.tsx';

afterEach(cleanup);

const STEPS = [
  { id: 'weaponSkills', name: 'Weapon skills: 1 to pick' },
  { id: 'trinket', name: 'Trinket' },
];

describe('the To finish card in the notices sheet (frame M1e)', () => {
  // Purpose: a plain line and rows with chevrons, each opening its step.
  it('reads "You can play now." as a plain line and each step as a row with its chevron', async () => {
    const onOpen = vi.fn();
    render(<ToFinishCard steps={STEPS} onOpen={onOpen} notice />);
    const card = screen.getByRole('region', { name: 'To finish' });
    expect(within(card).queryByRole('heading')).toBeNull();
    expect(within(card).getByText('You can play now.').tagName).toBe('P');
    expect(card.textContent).not.toContain('›');
    expect(card.querySelectorAll('.row-list--dotted .list-row')).toHaveLength(2);
    expect(card.querySelectorAll('.list-row__chevron svg')).toHaveLength(2);
    await userEvent.click(within(card).getByRole('button', { name: 'Trinket' }));
    expect(onOpen).toHaveBeenCalledWith('trinket');
  });

  // Purpose: off the notices sheet the card is as it was (its heading, its boxed lines with "›").
  it('keeps the full sheet’s card as it was', () => {
    render(<ToFinishCard steps={STEPS} onOpen={() => {}} />);
    const card = screen.getByRole('region', { name: 'To finish' });
    expect(within(card).getByRole('heading', { name: 'You can play now.' })).toBeTruthy();
    expect(card.querySelectorAll('.to-finish__line')).toHaveLength(2);
    expect(card.textContent).toContain('›');
  });
});
