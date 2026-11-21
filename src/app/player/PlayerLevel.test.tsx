// @vitest-environment jsdom
// dec-13 C3 (docs/plans/dec-13-the-player-screen.md; ps-8, frame P1, approved ps-9 2026-11-14): the level block on the
// Player screen's left reads the class beside the level, the experience and its bar, and the company, as one row that
// opens how the level is worked out. Invented names only.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListRow, RowList } from '../../ui/parts.tsx';
import { levelTitle, PlayerLevel, PlayerLevelBlock } from './PlayerLevel.tsx';

afterEach(cleanup);

const block = (over: Partial<Parameters<typeof PlayerLevelBlock>[0]> = {}) => {
  const onOpen = vi.fn();
  const view = render(
    <PlayerLevelBlock className="Lantern Warden" level={2} experience="2,400 of 4,000 experience" fraction={0.6} company="The Lantern Company" onOpen={onOpen} {...over} />,
  );
  return { onOpen, view };
};

describe('the level block (dec-13 C3)', () => {
  // Purpose: the row reads the class beside the level, then the experience, the bar and the company, and a tap opens
  // how the level is worked out.
  it('reads the class beside the level, the experience, the bar and the company; a tap opens the level', () => {
    const { onOpen, view } = block();
    const row = screen.getByRole('button', { name: "Lantern Warden, level 2, 2,400 of 4,000 experience, The Lantern Company: how it's worked out" });
    expect(row.textContent).toBe('Lantern Warden, level 22,400 of 4,000 experienceThe Lantern Company');
    expect(view.container.querySelector('.advancement__fill')?.getAttribute('style')).toContain('inline-size: 60%');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  // Purpose (tfr-2, C6): the experience row has no chevron and a tap still opens how the level is worked out; a list
  // row (a skill's) keeps its chevron.
  it('has no chevron and still opens the level on a tap; a list row keeps its chevron', () => {
    const { onOpen, view } = block();
    const row = screen.getByRole('button', { name: /: how it's worked out$/ });
    expect(row.querySelector('.list-row__chevron')).toBeNull();
    expect(view.container.querySelector('.list-row__chevron')).toBeNull();
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledOnce();
    cleanup();
    render(
      <RowList>
        <ListRow title="Listen" value="5+" figure onOpen={() => undefined} />
      </RowList>,
    );
    expect(screen.getByRole('button', { name: 'Listen, 5+' }).querySelector('.list-row__chevron')).not.toBeNull();
  });

  // Purpose: with no class shown the row reads "Level N"; with no experience, no next level and no company it is the
  // title alone, with no empty line and no bar.
  it('reads "Level N" with no class, and leaves out what the character has not got', () => {
    const { view } = block({ className: '', experience: '', fraction: null, company: null });
    expect(screen.getByRole('button', { name: "Level 2: how it's worked out" }).textContent).toBe('Level 2');
    expect(view.container.querySelector('.list-row__sub')).toBeNull();
    expect(view.container.querySelector('.advancement__bar')).toBeNull();
  });

  // Purpose: each part shows on its own: the experience without a bar (no next level), the company without experience.
  it('shows each part only when it is there', () => {
    const { view } = block({ fraction: null, company: '' });
    expect(view.container.querySelector('.advancement__bar')).toBeNull();
    expect(view.container.querySelector('.player-level__company')).toBeNull();
    cleanup();
    const second = block({ experience: '', fraction: null });
    expect(second.view.container.querySelector('.player-level__company')?.textContent).toBe('The Lantern Company');
  });

  // Purpose: the edges: level 0 and 999 read as numbers, an empty bar is drawn at 0 % and a full one never runs past
  // 100 %.
  it('reads level 0 and 999, and keeps the bar between empty and full', () => {
    expect(levelTitle('Lantern Warden', 0)).toBe('Lantern Warden, level 0');
    expect(levelTitle('  ', 999)).toBe('Level 999');
    const { view } = block({ level: 999, experience: '0 experience', fraction: 0 });
    expect(screen.getByText('Lantern Warden, level 999')).toBeTruthy();
    expect(view.container.querySelector('.advancement__fill')?.getAttribute('style')).toContain('inline-size: 0%');
    cleanup();
    const over = block({ fraction: 1.4 });
    expect(over.view.container.querySelector('.advancement__fill')?.getAttribute('style')).toContain('inline-size: 100%');
  });

  // Purpose: a long class name and company are kept whole (the row wraps them; nothing is cut).
  it('keeps a long class and company whole', () => {
    const longClass = 'Keeper of the Drowned Lanterns of the Western Reed Marches';
    const longCompany = 'The Company of the Lantern, the Reed and the Long Night Under the Barrow';
    block({ className: longClass, company: longCompany });
    expect(screen.getByText(`${longClass}, level 2`)).toBeTruthy();
    expect(screen.getByText(longCompany)).toBeTruthy();
  });

  // Purpose: a class with forms keeps its form switch under the row.
  it('keeps the form switch under the row', () => {
    block({ formSwitch: <p>Form switch here</p> });
    expect(screen.getByText('Form switch here')).toBeTruthy();
  });

  // Purpose: the hosted sheet hands the level over as figures and the Player screen draws the block from them (the
  // shared sheet imports nothing from the Player screen); no figures, no block.
  it('draws the block from the figures the sheet hands over, and nothing without them', () => {
    const onOpen = vi.fn();
    render(<PlayerLevel part={{ className: 'Lantern Warden', level: 3, experience: '3,400 of 6,000 experience', fraction: 0.57, company: null, onOpen, formSwitch: null }} />);
    fireEvent.click(screen.getByRole('button', { name: "Lantern Warden, level 3, 3,400 of 6,000 experience: how it's worked out" }));
    expect(onOpen).toHaveBeenCalledOnce();
    cleanup();
    expect(render(<PlayerLevel part={null} />).container.innerHTML).toBe('');
  });

  // Purpose: a fraction that isn't a number draws no bar rather than a width of "NaN%".
  it('draws no bar for a fraction that is not a number', () => {
    const { view } = block({ fraction: Number.NaN });
    expect(view.container.querySelector('.advancement__bar')).toBeNull();
  });

  // Purpose: the company reads as frame P1 draws it, its name alone under the bar (no campaign before it); the lead,
  // 2026-11-15.
  it('reads the company as its name alone, under the bar', () => {
    const { view } = block({ company: 'The Lantern Company' });
    const company = view.container.querySelector('.player-level__company');
    expect(company?.textContent).toBe('The Lantern Company');
    const bar = view.container.querySelector('.player-level__bar')!;
    expect(bar.compareDocumentPosition(company!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Purpose: a character with no company shows no company line at all (nothing empty, no stand-in words).
  it('shows no company line for a character with no company', () => {
    for (const company of [null, '']) {
      const { view } = block({ company });
      expect(view.container.querySelector('.player-level__company')).toBeNull();
      expect(view.container.querySelector('.list-row__sub')?.textContent).toBe('2,400 of 4,000 experience');
      cleanup();
    }
  });
});
