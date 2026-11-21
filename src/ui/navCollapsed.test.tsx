// @vitest-environment jsdom
// mn-1 (Francis, 2026-11-14): the menu starts folded to its icon rail; a person's own choice is kept per device.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DividerHandle } from './DividerHandle.tsx';
import { getNavCollapsed, useNavCollapsed } from './navCollapsed.ts';

const KEY = 'grimoire.navCollapsed';

// The owner as GmCampaign and PlayerScreen use it: the hook's fold drives the handle.
function Owner() {
  const [collapsed, setCollapsed] = useNavCollapsed();
  return (
    <div data-testid="menu" data-folded={collapsed ? 'yes' : 'no'}>
      <DividerHandle collapsed={collapsed} onToggle={setCollapsed} />
    </div>
  );
}

beforeEach(() => localStorage.removeItem(KEY));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem(KEY);
});

describe('the menu starts folded (mn-1)', () => {
  it('a new person, with nothing kept on the device, gets the menu folded', () => {
    expect(getNavCollapsed()).toBe(true);
    render(<Owner />);
    expect(screen.getByTestId('menu').dataset.folded).toBe('yes');
  });

  it("a kept choice is respected: 'no' opens the menu and 'yes' folds it", () => {
    localStorage.setItem(KEY, 'no');
    expect(getNavCollapsed()).toBe(false);
    localStorage.setItem(KEY, 'yes');
    expect(getNavCollapsed()).toBe(true);
  });

  it('the handle opens the menu and folds it again, and each choice is kept on the device', async () => {
    const person = userEvent.setup();
    render(<Owner />);
    await person.click(screen.getByRole('button', { name: 'Show the menu' }));
    expect(screen.getByTestId('menu').dataset.folded).toBe('no');
    expect(localStorage.getItem(KEY)).toBe('no');
    await person.click(screen.getByRole('button', { name: 'Fold the menu' }));
    expect(screen.getByTestId('menu').dataset.folded).toBe('yes');
    expect(localStorage.getItem(KEY)).toBe('yes');
  });

  it('the handle’s name states its state: Show the menu when folded, Fold the menu when open', () => {
    render(<Owner />);
    expect(screen.getByRole('button', { name: 'Show the menu' }).getAttribute('aria-expanded')).toBe('false');
    cleanup();
    localStorage.setItem(KEY, 'no');
    render(<Owner />);
    expect(screen.getByRole('button', { name: 'Fold the menu' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('when browser storage is blocked the menu starts folded, and the handle still opens it', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getNavCollapsed()).toBe(true);
    const person = userEvent.setup();
    render(<Owner />);
    expect(screen.getByTestId('menu').dataset.folded).toBe('yes');
    await person.click(screen.getByRole('button', { name: 'Show the menu' }));
    expect(screen.getByTestId('menu').dataset.folded).toBe('no');
  });
});
