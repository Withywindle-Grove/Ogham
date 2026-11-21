// @vitest-environment jsdom
// The dialog with no ✕ (cs-27: a pop-up has an X or buttons, never both; #794). Invented words.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog.tsx';

afterEach(cleanup);

describe('a dialog with no ✕ (noClose)', () => {
  it('draws no Close, and Escape still closes it', async () => {
    // Purpose: a two-answer dialog's buttons are its ways out, so it has no ✕; Escape still closes it, as every
    // dialog's does, so the keyboard is never trapped.
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog label="Start over?" onClose={onClose} noClose>
        <p>Everything you chose goes.</p>
        <div className="dialog__actions">
          <button type="button" className="button-secondary">
            Keep going
          </button>
        </div>
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Start over?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
