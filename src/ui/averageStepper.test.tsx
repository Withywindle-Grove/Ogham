// @vitest-environment jsdom
// The average stepper (plan m5b-creation-final-drafts A5; mockup creation/final/01).
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { diceAverage, diceTimes } from '../modules/characters/creationRules.ts';
import { AVERAGE_LINE, AverageStepper, useAverageField } from './creation.tsx';

function Field({ dice, caption }: { dice: string; caption: string }) {
  const field = useAverageField({ average: diceAverage(dice)!, step: diceTimes(dice) });
  return <AverageStepper id="f" label="Might" text={field.text} touched={field.touched} caption={caption} onChange={field.onChange} onStep={field.onStep} />;
}

const box = () => screen.getByRole('textbox', { name: 'Might' }) as HTMLInputElement;

afterEach(cleanup);

describe('the average stepper (A5)', () => {
  // Purpose: the average is one the dice can make (rounded down, whole) and the step is the dice's multiplier.
  it('prefills a value the dice can make and steps by the multiplier', () => {
    for (const [dice, avg, low, high] of [
      ['3d6', 10, 3, 18],
      ['1d8', 4, 1, 8],
      ['1d6 + 18', 21, 19, 24],
      ['3d6 x 10 gp', 100, 30, 180],
    ] as const) {
      const a = diceAverage(dice)!;
      expect(a).toBe(avg);
      expect(a).toBeGreaterThanOrEqual(low);
      expect(a).toBeLessThanOrEqual(high);
      expect(a % diceTimes(dice)).toBe(0);
    }
    expect(diceTimes('3d6 x 10 gp')).toBe(10);
    expect(diceTimes('3d6')).toBe(1);
  });

  // Purpose: untouched, the field shows the average in the lighter weight with the line; the line is the box's description.
  it('shows the average and its line until touched', () => {
    render(<Field dice="3d6" caption="+1 to hit and damage up close" />);
    expect(box().value).toBe('10');
    expect(box().classList.contains('typed-stepper__input--average')).toBe(true);
    expect(screen.getByText(AVERAGE_LINE)).toBeTruthy();
    expect(box().getAttribute('aria-describedby')).toBe('f-line');
  });

  // Purpose: stepping and stepping back to the average keeps the line gone (touched is a flag, never a comparison of values).
  it('stays touched after stepping back to the average', async () => {
    const user = userEvent.setup();
    render(<Field dice="3d6 x 10 gp" caption="Rolled" />);
    expect(box().value).toBe('100');
    await user.click(screen.getByRole('button', { name: 'Raise Might' }));
    expect(box().value).toBe('110');
    await user.click(screen.getByRole('button', { name: 'Lower Might' }));
    expect(box().value).toBe('100');
    expect(screen.queryByText(AVERAGE_LINE)).toBeNull();
    expect(screen.getByText('Rolled')).toBeTruthy();
    expect(box().classList.contains('typed-stepper__input--average')).toBe(false);
  });

  // Purpose: typing touches it too, even typing the average itself.
  it('is touched by typing', async () => {
    const user = userEvent.setup();
    render(<Field dice="3d6" caption="" />);
    await user.clear(box());
    await user.type(box(), '10');
    expect(box().value).toBe('10');
    expect(screen.queryByText(AVERAGE_LINE)).toBeNull();
  });
});
