// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceMenuSection, MenuItem, MenuItems, MoreMenu } from './MoreMenu.tsx';

afterEach(cleanup);

describe('the ⋯ menu', () => {
  it('closes after choosing an action, but stays open while switching a setting', async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    render(
      <MoreMenu label="Options">
        <button type="button" aria-pressed="false">
          Large
        </button>
        <button type="button" onClick={go}>
          Rules library
        </button>
      </MoreMenu>,
    );
    await user.click(screen.getByRole('button', { name: 'Options' }));
    await user.click(screen.getByRole('button', { name: 'Large' }));
    expect(screen.getByRole('button', { name: 'Rules library' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Rules library' }));
    expect(go).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Rules library' })).toBeNull();
  });

  it('each option is named by its words alone: the symbol beside it is hidden from screen readers (ruled 2026-10-26)', async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    const { container } = render(
      <MoreMenu label="Options">
        <MenuItems>
          <MenuItem icon="characters" onClick={go}>
            Your characters
          </MenuItem>
        </MenuItems>
        <DeviceMenuSection />
      </MoreMenu>,
    );
    await user.click(screen.getByRole('button', { name: 'Options' }));
    const option = screen.getByRole('button', { name: 'Your characters' });
    expect(option.className).toBe('more-menu__item');
    expect(option.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    // This device comes after the options, in its own section (the divider).
    const sections = [...container.querySelectorAll('.more-menu__section')];
    expect(sections.map((s) => s.textContent?.startsWith('This device'))).toEqual([false, true]);
    await user.click(option);
    expect(go).toHaveBeenCalled();
  });

  it('can start open, for the gallery', () => {
    render(
      <MoreMenu label="Options" startOpen>
        <MenuItem icon="scales" onClick={() => undefined}>
          Setting rules
        </MenuItem>
      </MoreMenu>,
    );
    expect(screen.getByRole('button', { name: 'Options' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Setting rules' })).toBeTruthy();
  });

  it('showing This device changes nothing on the page: the theme and text size change only when tapped (the gallery shows it open in dark)', async () => {
    const user = userEvent.setup();
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark');
    const sizeBefore = root.getAttribute('data-text-size');
    render(
      <MoreMenu label="Options" startOpen>
        <DeviceMenuSection />
      </MoreMenu>,
    );
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('data-text-size')).toBe(sizeBefore);
    await user.click(within(screen.getByRole('group', { name: 'Theme' })).getByRole('button', { name: 'Light' }));
    expect(root.getAttribute('data-theme')).toBe('light');
    root.removeAttribute('data-theme');
    localStorage.clear();
  });

  it.fails('A tap outside the ⋯ menu closes it and does not act on what lies beneath (fix-more-menu-tap)', async () => {
    const user = userEvent.setup();
    const beneath = vi.fn();
    render(
      <>
        <button type="button" onClick={beneath}>
          Bog lurker
        </button>
        <MoreMenu label="Options" startOpen>
          <MenuItem icon="scales" onClick={() => undefined}>
            Lantern Warden
          </MenuItem>
        </MoreMenu>
      </>,
    );
    // A mouse press and a finger's tap alike.
    await user.click(screen.getByRole('button', { name: 'Bog lurker' }));
    expect(screen.queryByRole('button', { name: 'Lantern Warden' })).toBeNull();
    expect(beneath).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Options' }));
    await user.pointer({ keys: '[TouchA]', target: screen.getByRole('button', { name: 'Bog lurker' }) });
    expect(screen.queryByRole('button', { name: 'Lantern Warden' })).toBeNull();
    expect(beneath).not.toHaveBeenCalled();
    // Once it's closed, the next tap acts as usual.
    await user.click(screen.getByRole('button', { name: 'Bog lurker' }));
    expect(beneath).toHaveBeenCalledTimes(1);
  });

  it.fails('A press outside that the browser cancels (a scroll) is forgotten: the menu stays open and the next click is not eaten', () => {
    const beneath = vi.fn();
    render(
      <>
        <button type="button" onClick={beneath}>
          Bog lurker
        </button>
        <MoreMenu label="Options" startOpen>
          <MenuItem icon="scales" onClick={() => undefined}>
            Lantern Warden
          </MenuItem>
        </MoreMenu>
      </>,
    );
    const outside = screen.getByRole('button', { name: 'Bog lurker' });
    fireEvent.pointerDown(outside);
    fireEvent.pointerCancel(outside);
    expect(screen.getByRole('button', { name: 'Lantern Warden' })).toBeTruthy();
    // A click with no press of its own (a key on a focused button) is not taken for the end of that tap.
    fireEvent.click(outside);
    expect(beneath).toHaveBeenCalledTimes(1);
  });
});
