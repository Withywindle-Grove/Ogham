// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DamagePad } from './parts.tsx';

afterEach(cleanup);

describe('the damage pad (M6-3; N25, ruled 2026-10-28)', () => {
  it('a step that would go below the minimum stops at it (−5 at 2 gives 1); no step is ever disabled', async () => {
    const person = userEvent.setup();
    const confirm = vi.fn();
    render(<DamagePad target="Wren" start={2} onConfirm={confirm} />);
    for (const name of ['−5', '−1', '+1', '+5']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false);
    await person.click(screen.getByRole('button', { name: '−5' }));
    expect(screen.getByRole('button', { name: 'Take 1 damage' })).toBeTruthy();
    await person.click(screen.getByRole('button', { name: '−1' }));
    expect(screen.getByRole('button', { name: 'Take 1 damage' })).toBeTruthy();
    await person.click(screen.getByRole('button', { name: '+5' }));
    await person.click(screen.getByRole('button', { name: 'Take 6 damage' }));
    expect(confirm).toHaveBeenCalledWith(6, false);
  });
});
