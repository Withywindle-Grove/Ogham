// @vitest-environment jsdom
// The ⋯ menu's two rules together (the merge of #72 and #85): keyboard focus goes into the menu and back to ⋯, and a
// finger's tap outside only closes it.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuItem, MoreMenu } from './MoreMenu.tsx';

afterEach(cleanup);

function renderWithBeneath(beneath: () => void) {
  render(
    <>
      <button type="button" onClick={beneath}>
        Bog lurker
      </button>
      <MoreMenu label="Options">
        <MenuItem icon="scales" onClick={() => undefined}>
          Lantern Warden
        </MenuItem>
      </MoreMenu>
    </>,
  );
  return { more: screen.getByRole('button', { name: 'Options' }), outside: screen.getByRole('button', { name: 'Bog lurker' }) };
}

describe('the ⋯ menu, from the keyboard and by touch', () => {
  // Purpose: a ⋯ menu opened from the keyboard puts focus on its first item; a finger's tap outside then only closes
  // it, acting on nothing beneath; opened again from the keyboard, Escape puts focus back on ⋯.
  it('opened from the keyboard, focus goes in; a tap outside only closes it; Escape puts focus back on ⋯', async () => {
    const user = userEvent.setup();
    const beneath = vi.fn();
    const { more, outside } = renderWithBeneath(beneath);
    more.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Lantern Warden' }));
    await user.pointer({ keys: '[TouchA]', target: outside });
    expect(screen.queryByRole('button', { name: 'Lantern Warden' })).toBeNull();
    expect(beneath).not.toHaveBeenCalled();
    more.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Lantern Warden' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Lantern Warden' })).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  // Purpose: Escape after a stray touch outside closes the menu and puts focus back on ⋯, and the next click outside
  // is not swallowed by the forgotten touch.
  it('Escape after a stray touch outside closes it, focus back on ⋯, and the next click is not eaten', async () => {
    const user = userEvent.setup();
    const beneath = vi.fn();
    const { more, outside } = renderWithBeneath(beneath);
    more.focus();
    await user.keyboard('{Enter}');
    fireEvent.pointerDown(outside, { pointerType: 'touch' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Lantern Warden' })).toBeNull();
    expect(document.activeElement).toBe(more);
    fireEvent.click(outside);
    expect(beneath).toHaveBeenCalledTimes(1);
  });
});
