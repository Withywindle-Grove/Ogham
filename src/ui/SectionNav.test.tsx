// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionNav } from './SectionNav.tsx';

afterEach(cleanup);

describe('a role’s sections', () => {
  it('shows each section in order with its icon and name; the current one is marked', async () => {
    const person = userEvent.setup();
    const pick = vi.fn();
    render(
      <SectionNav
        label="Main"
        tabs={[
          { id: 'player', name: 'Player', icon: 'crown' },
          { id: 'scene', name: 'Scene', icon: 'scene' },
          { id: 'pack', name: 'Pack', icon: 'sack' },
        ]}
        current="scene"
        onSelect={pick}
      />,
    );
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getAllByRole('button').map((b) => b.textContent)).toEqual(['Player', 'Scene', 'Pack']);
    expect(nav.getAllByRole('button').map((b) => b.querySelector('svg[aria-hidden="true"]') !== null)).toEqual([true, true, true]);
    expect(nav.getByRole('button', { name: 'Scene' }).getAttribute('aria-current')).toBe('page');
    await person.click(nav.getByRole('button', { name: 'Pack' }));
    expect(pick).toHaveBeenCalledWith('pack');
  });

  it('a count shows as quiet words beside the name, and is read out; none when nothing waits', () => {
    const { rerender } = render(
      <SectionNav
        label="Campaign sections"
        tabs={[
          { id: 'players', name: 'Players', icon: 'players', count: 2, countLabel: 'waiting for you' },
          { id: 'rules', name: 'Rules', icon: 'scales' },
        ]}
        current="players"
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Players, 2 waiting for you' }).textContent).toBe('Players, 2');
    rerender(
      <SectionNav
        label="Campaign sections"
        tabs={[
          { id: 'players', name: 'Players', icon: 'players', count: 0, countLabel: 'waiting for you' },
          { id: 'rules', name: 'Rules', icon: 'scales' },
        ]}
        current="players"
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Players' }).textContent).toBe('Players');
  });

  // Purpose (plan m5b-sheet-revised PR 2, step 9): a tab with something to act on is lit and says what waits in its
  // name ("Players, 1 waiting: 1 to approve" on a tablet, its shown words first); a tab with nothing waiting is not lit and keeps its plain name.
  it('lights a tab with something waiting and names what waits; leaves the others unlit', () => {
    render(
      <SectionNav
        label="Campaign sections"
        tabs={[
          { id: 'scene', name: 'Scene', icon: 'scene' },
          { id: 'players', name: 'Players', icon: 'players', count: 1, countLabel: 'waiting for you', countWord: 'waiting', waits: '1 to approve' },
          { id: 'rules', name: 'Rules', icon: 'scales', waits: '' },
        ]}
        current="scene"
        onSelect={() => undefined}
      />,
    );
    const players = screen.getByRole('button', { name: 'Players, 1 waiting: 1 to approve' });
    expect(players.classList.contains('section-nav__tab--lit')).toBe(true);
    expect(players.textContent).toBe('Players, 1 waiting');
    for (const name of ['Scene', 'Rules']) expect(screen.getByRole('button', { name }).classList.contains('section-nav__tab--lit')).toBe(false);
  });

  // Purpose (step 11): the selected tab keeps its glow while something waits on it; opening it doesn't put it out.
  it('keeps the glow on the selected tab while something waits', () => {
    const tabs = (waits: string) => [
      { id: 'scene' as const, name: 'Scene', icon: 'scene' as const },
      { id: 'players' as const, name: 'Players', icon: 'players' as const, waits },
    ];
    const { rerender } = render(<SectionNav label="Campaign sections" tabs={tabs('2 to approve')} current="players" onSelect={() => undefined} />);
    const players = screen.getByRole('button', { name: 'Players: 2 to approve' });
    expect(players.getAttribute('aria-current')).toBe('page');
    expect(players.classList.contains('section-nav__tab--lit')).toBe(true);
    // The list empties: the glow goes out and the name is plain again.
    rerender(<SectionNav label="Campaign sections" tabs={tabs('')} current="players" onSelect={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Players' }).classList.contains('section-nav__tab--lit')).toBe(false);
  });

  // B15 (M5 gate), lr-4 (2026-11-02): folded, the column shows its icons; each tab still says its name. The fold
  // itself is the owner's divider handle (DividerHandle.test.tsx), so the list has no row of its own for it.
  it('folds to icons, each tab keeping its name for screen readers, with no chevron row or words in the column', () => {
    const tabs = [
      { id: 'scene' as const, name: 'Scene', icon: 'scene' as const },
      { id: 'rules' as const, name: 'Rules', icon: 'scales' as const },
    ];
    render(<SectionNav label="Campaign sections" tabs={tabs} current="scene" onSelect={() => undefined} collapsed />);
    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('section-nav--collapsed');
    expect(within(nav).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Scene', 'Rules']);
    expect(screen.queryByRole('button', { name: /Fold the menu|Show the menu/ })).toBeNull();
    expect(nav.textContent).not.toMatch(/menu/);
  });
});
