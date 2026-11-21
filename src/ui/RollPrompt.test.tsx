// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RollPrompt } from './RollPrompt.tsx';

afterEach(cleanup);

describe('the roll prompt', () => {
  it('shows the dice, refuses a roll they can’t give, and passes on one they can', async () => {
    const user = userEvent.setup();
    const onRolled = vi.fn();
    render(<RollPrompt label="Charges" expression="2d10" onRolled={onRolled} />);
    const box = screen.getByLabelText('Charges (2d10): enter the roll');
    await user.type(box, '25');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('2d10 gives 2 to 20.');
    expect(onRolled).not.toHaveBeenCalled();
    await user.clear(box);
    await user.type(box, '14');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onRolled).toHaveBeenCalledWith(14);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
