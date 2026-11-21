// @vitest-environment jsdom
// A pop-up closes with a tap outside it (the M4b re-test found the Sack's sheet had no way out), never with a tap
// inside it. It never opens the keyboard by itself (M5 gate A4): focus goes to the card, not a text field.
// It opens on the page itself, so a column that scrolls on its own can't clip it (M5 gate fix).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog.tsx';

afterEach(cleanup);

describe('the pop-up', () => {
  it('closes on a tap on the dimmed page, not on one inside the card', () => {
    const onClose = vi.fn();
    render(
      <Dialog label="Sack" onClose={onClose}>
        <p>Inside the sack</p>
      </Dialog>,
    );
    fireEvent.pointerDown(screen.getByText('Inside the sack'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.querySelector('.dialog__backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // One Close everywhere (tf-8): a bare ✕ at the top right named "Close"; a tap closes, and focus still starts on the content.
  it('has one Close, named Close, that closes it; focus starts on the first control, not on Close', () => {
    const onClose = vi.fn();
    render(
      <Dialog label="Sack" onClose={onClose}>
        <button type="button">Take</button>
      </Dialog>,
    );
    const close = screen.getAllByRole('button', { name: 'Close' });
    expect(close).toHaveLength(1);
    expect(close[0]!.textContent).toBe('✕');
    expect(close[0]!.closest('.dialog__head')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Take' }));
    fireEvent.click(close[0]!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Dialog label="Sack" onClose={onClose}>{null}</Dialog>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Purpose (plan dec-9 piece B; review of #797): the Side variant closes as every pop-up does (Escape, a tap on the
  // dimmed page, never a tap inside), focus starts on its first control, and its content sits in its own scrolling body.
  it('side: Escape and a tap outside close it, focus starts on its first control, its content in its own body', () => {
    const onClose = vi.fn();
    render(
      <Dialog label="About this app" onClose={onClose} side>
        <button type="button">Licence</button>
        <p>Inside the panel</p>
      </Dialog>,
    );
    const card = screen.getByRole('dialog', { name: 'About this app' });
    expect(card.classList.contains('dialog--side')).toBe(true);
    expect(document.querySelector('.dialog__backdrop--side')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Licence' }));
    expect(screen.getByText('Inside the panel').closest('.dialog__side-body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' }).closest('.dialog__side-body')).toBeNull();
    fireEvent.pointerDown(screen.getByText('Inside the panel'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.querySelector('.dialog__backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  // Opening a pop-up with a text field doesn't put the cursor in it (A4): the card itself takes focus.
  it('opening on a text field puts focus on the card, not the field', () => {
    render(
      <Dialog label="Hit points" onClose={() => undefined}>
        <label htmlFor="typed">Current HP</label>
        <input id="typed" type="number" />
        <textarea aria-label="Note" />
        <button type="button">Set</button>
      </Dialog>,
    );
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Hit points' }));
    expect(document.activeElement).not.toBe(screen.getByLabelText('Current HP'));
  });

  // A pop-up that starts with a button or a switch still moves focus there, for keyboards and screen readers.
  it('opening on a button puts focus on that button', () => {
    render(
      <Dialog label="Recharge" onClose={() => undefined}>
        <button type="button">Recharge</button>
        <input aria-label="Charges" />
      </Dialog>,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Recharge' }));
  });

  // From the card itself, Shift+Tab goes round to the pop-up's last control instead of leaving it.
  it('Shift+Tab from the card goes to the last control', () => {
    render(
      <Dialog label="Note" onClose={() => undefined}>
        <input aria-label="Text" />
        <button type="button">Save</button>
      </Dialog>,
    );
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }));
  });

  it('opens on the page itself, outside the part of the screen that opened it', () => {
    render(
      <div className="column">
        <Dialog label="Sack" onClose={() => {}}>
          <p>Inside the sack</p>
        </Dialog>
      </div>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Sack' });
    expect(dialog.closest('.column')).toBeNull();
    expect(dialog.parentElement!.parentElement).toBe(document.body);
  });

  // Purpose (ruled B 2026-11-03, tf-8's scope check): a full-screen pop-up closes with the same ✕ at the top right as
  // every other pop-up, never with a Back ‹ that closes it.
  it('full screen: the ✕ at the right closes it, and there is no Back', () => {
    const onClose = vi.fn();
    render(
      <Dialog full label="Tables" meta="4 in this setting" onClose={onClose}>
        <button type="button">Abbey</button>
      </Dialog>,
    );
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.textContent).toBe('✕');
    expect(close.closest('.dialog__bar')).toBeTruthy();
    // The ✕ is the bar's last control (top right).
    expect(close.parentElement!.lastElementChild).toBe(close);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abbey' }));
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Purpose: a full screen that is a step inside another (a table opened from a list) keeps Back ‹ for that step, and
  // its ✕ closes the whole thing; Escape is the ✕.
  it('full screen with a step back: Back goes back a step, the ✕ and Escape close', () => {
    const onClose = vi.fn();
    const onBack = vi.fn();
    render(
      <Dialog full label="Abbey › Mortal" onBack={onBack} onClose={onClose}>
        <p>Pilgrims</p>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
