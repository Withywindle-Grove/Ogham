// @vitest-environment jsdom
// The three-position stock toggle (town row TC9, carried from the stack's W9a; tn-4; page 19 frame TW8f, ap-13). In
// plain words:
//   * it rests on "?" until flipped, spoken as "not decided", with neither choice taken;
//   * the right half sets in and the left half sets out, from anywhere; a tap on the side it is already on does nothing;
//   * each state has its own mark (the "?", the cross, the tick), never colour alone;
//   * one stop in the tab order; the arrow keys move between the halves without choosing; Space chooses;
//   * it draws the Switch's own track and knob (one look, the stack's review);
//   * it writes nothing itself: a choice is only handed to the caller.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StockToggle } from './parts.tsx';

afterEach(cleanup);

describe('the stock toggle (TW8f)', () => {
  // Purpose (tn-4): a thing not decided today rests on "?", says so, and has neither choice taken.
  it.fails('rests on "?" until flipped', () => {
    render(<StockToggle thing="Lamp oil" state="undecided" onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Lamp oil, stocked today: not decided' });
    expect(group.textContent).toBe('?');
    expect(screen.getByRole('radio', { name: 'In stock' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('radio', { name: 'Not in stock' }).getAttribute('aria-checked')).toBe('false');
  });

  // Purpose (TW8f): the right half always means in and the left half always means out, from "?" or from the other side.
  it.fails('sets in from the right half and out from the left', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<StockToggle thing="Lamp oil" state="undecided" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'In stock' }));
    expect(onChange).toHaveBeenLastCalledWith('in');
    await user.click(screen.getByRole('radio', { name: 'Not in stock' }));
    expect(onChange).toHaveBeenLastCalledWith('out');
    rerender(<StockToggle thing="Lamp oil" state="out" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'In stock' }));
    expect(onChange).toHaveBeenLastCalledWith('in');
  });

  // Purpose (TW8f): a tap on the side it is already on does nothing (no write, no second log line).
  it.fails('does nothing on the side it is already on', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<StockToggle thing="Lamp oil" state="in" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'In stock' }));
    rerender(<StockToggle thing="Lamp oil" state="out" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Not in stock' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  // Purpose (TW8f, never colour alone): each state carries its own mark and its spoken state.
  it.fails('marks each state', () => {
    const { container, rerender } = render(<StockToggle thing="Lamp oil" state="in" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'Lamp oil, stocked today' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'In stock' }).getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('.stock-toggle')!.getAttribute('data-state')).toBe('in');
    expect(container.querySelector('.switch__thumb svg')).toBeTruthy();
    rerender(<StockToggle thing="Lamp oil" state="out" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Not in stock' }).getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('.stock-toggle')!.getAttribute('data-state')).toBe('out');
    expect(container.querySelector('.switch__thumb svg')).toBeTruthy();
  });

  // Purpose (the radio group's keys, the stack's review): one tab stop (the chosen half, else the left), the arrow keys move
  // between the halves without choosing (a choice writes the day's stock), and Space chooses the focused half.
  it.fails('moves between the halves by the arrow keys without choosing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StockToggle thing="Lamp oil" state="undecided" onChange={onChange} />);
    const out = screen.getByRole('radio', { name: 'Not in stock' });
    const inn = screen.getByRole('radio', { name: 'In stock' });
    expect([out.tabIndex, inn.tabIndex]).toEqual([0, -1]);
    await user.tab();
    expect(document.activeElement).toBe(out);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(inn);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(out);
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{ArrowRight}');
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith('in');
  });

  // Purpose (the stack's review): the toggle draws the Switch's own track and knob, so the two never drift apart.
  it.fails('uses the Switch’s own track and knob', () => {
    const { container } = render(<StockToggle thing="Lamp oil" state="in" onChange={vi.fn()} />);
    expect(container.querySelector('.stock-toggle .switch__track .switch__thumb')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'In stock' }).tabIndex).toBe(0);
  });
});
