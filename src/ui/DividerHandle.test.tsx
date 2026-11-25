// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DividerHandle, dragOutcome } from './DividerHandle.tsx';

afterEach(cleanup);

// A column of the given width with the handle on its edge, folding as the owner would.
function Column({ width, onToggle }: { width: number; onToggle?: (collapsed: boolean) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div
      data-testid="column"
      ref={(el) => {
        if (el) el.getBoundingClientRect = () => ({ width: collapsed ? width / 4 : width }) as DOMRect;
      }}
    >
      <DividerHandle
        collapsed={collapsed}
        onToggle={(next) => {
          onToggle?.(next);
          setCollapsed(next);
        }}
      />
    </div>
  );
}

const drag = (handle: HTMLElement, from: number, to: number) => {
  fireEvent.pointerDown(handle, { clientX: from, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: to, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientX: to, pointerId: 1 });
  // The browser ends a press with a click on the same button.
  fireEvent.click(handle);
};

describe('the divider is the handle (lr-4)', () => {
  it('is reached by the keyboard with its name, and Enter folds the menu, the name turning to Show the menu', async () => {
    const person = userEvent.setup();
    const toggle = vi.fn();
    render(<Column width={280} onToggle={toggle} />);
    await person.tab();
    const handle = screen.getByRole('button', { name: 'Fold the menu' });
    expect(document.activeElement).toBe(handle);
    expect(handle.getAttribute('aria-expanded')).toBe('true');
    await person.keyboard('{Enter}');
    expect(toggle).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('button', { name: 'Show the menu' }).getAttribute('aria-expanded')).toBe('false');
    await person.keyboard(' ');
    expect(toggle).toHaveBeenLastCalledWith(false);
  });

  it('shows no words on screen, only its triangle: the name is for assistive tech only', () => {
    render(<Column width={280} />);
    expect(screen.getByRole('button', { name: 'Fold the menu' }).textContent).toBe('\u25C0\uFE0E');
  });

  // P32 (2026-11-06): the handle says which way it folds by a shape. Plan dec-14 row 1 (frame 38-1): the shape sits
  // inside the grip, ◀ while open and ▶ once folded.
  it('points the way it folds, inside the grip: ◀ while open, ▶ once folded', async () => {
    const user = userEvent.setup();
    render(<Column width={280} />);
    const handle = () => screen.getByRole('button', { name: /the menu$/ });
    const grip = () => handle().querySelector('.divider-handle__pill');
    expect(handle().children).toHaveLength(1);
    expect(grip()?.textContent).toBe('\u25C0\uFE0E');
    await user.click(handle());
    expect(screen.getByRole('button', { name: 'Show the menu' })).toBeTruthy();
    expect(grip()?.textContent).toBe('\u25B6\uFE0E');
  });

  // Approval fix (25 Nov): iOS draws a bare ◀ or ▶ as a colour emoji. Each triangle must carry the text-presentation
  // selector U+FE0E straight after it, folded and open, so it stays a plain shape in Ink.
  it('asks for the text form of each triangle (U+FE0E), so no device draws it as a colour emoji', async () => {
    const user = userEvent.setup();
    render(<Column width={280} />);
    const arrow = () => screen.getByRole('button', { name: /the menu$/ }).querySelector('.divider-handle__arrow');
    expect([...(arrow()?.textContent ?? '')].map((c) => c.codePointAt(0))).toEqual([0x25c0, 0xfe0e]);
    await user.click(screen.getByRole('button', { name: 'Fold the menu' }));
    expect([...(arrow()?.textContent ?? '')].map((c) => c.codePointAt(0))).toEqual([0x25b6, 0xfe0e]);
  });

  it('a tap folds the menu and a second tap unfolds it', async () => {
    const person = userEvent.setup();
    render(<Column width={280} />);
    await person.click(screen.getByRole('button', { name: 'Fold the menu' }));
    await person.click(screen.getByRole('button', { name: 'Show the menu' }));
    expect(screen.getByRole('button', { name: 'Fold the menu' })).toBeTruthy();
  });

  it('a drag short of half changes nothing, and the click that ends it is not taken as a tap', () => {
    const toggle = vi.fn();
    render(<Column width={280} onToggle={toggle} />);
    drag(screen.getByRole('button', { name: 'Fold the menu' }), 300, 200);
    expect(toggle).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Fold the menu' })).toBeTruthy();
  });

  it('a drag left past half folds the menu, and a drag right past half unfolds it', () => {
    const toggle = vi.fn();
    render(<Column width={280} onToggle={toggle} />);
    drag(screen.getByRole('button', { name: 'Fold the menu' }), 300, 150);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenLastCalledWith(true);
    drag(screen.getByRole('button', { name: 'Show the menu' }), 80, 200);
    expect(toggle).toHaveBeenCalledTimes(2);
    expect(toggle).toHaveBeenLastCalledWith(false);
  });

  it('works out a drag from the open and folded widths: half the way, either way', () => {
    // Open, 280 wide: folding needs more than 140 to the left; a drag right does nothing.
    expect(dragOutcome(false, -141, 280, 280)).toBe(true);
    expect(dragOutcome(false, -140, 280, 280)).toBeNull();
    expect(dragOutcome(false, 200, 280, 280)).toBeNull();
    // Folded, 70 wide, 280 when open: it grows by 210, so unfolding needs more than 105 to the right.
    expect(dragOutcome(true, 106, 70, 280)).toBe(false);
    expect(dragOutcome(true, 105, 70, 280)).toBeNull();
    expect(dragOutcome(true, -200, 70, 280)).toBeNull();
    // Opened folded, the open width unknown: it's taken to grow by twice its folded width.
    expect(dragOutcome(true, 71, 70, null)).toBe(false);
    expect(dragOutcome(true, 69, 70, null)).toBeNull();
  });
});
