// @vitest-environment jsdom
// One spell level on the Magic tab (dec-8 B; mm-1, mockup magic/04). Invented spells.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntryPanel } from './creation.tsx';
import { ICON_SET } from './iconSet.ts';
import { ListRow, SpellLevel, type ReadySpellRow } from './parts.tsx';

afterEach(cleanup);

const row = (key: string, name: string, times: number, left: number, line = '6 turns, 30 ft'): ReadySpellRow => ({ key, name, line, times, left });

describe('the Magic tab: one spell level (mm-1)', () => {
  // Purpose: the level line says the spells a day in words ("Level 1, 2 a day"); a level the slots don't give says only
  // the level; level 0 reads "Level 0" like the others, never a word the app brings from a game (hard rule 2).
  it('heads the level with its spells a day, or the level alone', () => {
    const { unmount } = render(<SpellLevel level={1} slots={2} spells={[row('m', 'Mire lamp', 1, 1)]} onOpen={vi.fn()} onCast={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Level 1, 2 a day' })).toBeTruthy();
    unmount();
    render(<SpellLevel level={3} slots={0} spells={[row('m', 'Mire lamp', 1, 1)]} onOpen={vi.fn()} onCast={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Level 3' })).toBeTruthy();
    cleanup();
    render(<SpellLevel level={0} slots={0} spells={[row('m', 'Mire lamp', 1, 1)]} onOpen={vi.fn()} onCast={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Level 0' })).toBeTruthy();
    expect(screen.queryByText(/cantrip/i)).toBeNull();
  });

  // Purpose: a spell prepared once has no dots; one prepared more than once has a dot a casting, said in words ("1 of
  // 2 left"), the castings left filled first and the cast ones hollow (picture 04); both keep Cast.
  it('draws dots only for a spell prepared more than once, the left ones first', () => {
    render(<SpellLevel level={1} slots={3} spells={[row('m', 'Mire lamp', 2, 1), row('r', 'Reed whisper', 1, 1)]} onOpen={vi.fn()} onCast={vi.fn()} />);
    const lamp = screen.getByRole('button', { name: 'Mire lamp, 1 of 2 left, 6 turns, 30 ft' });
    expect(lamp.textContent).toContain('●○');
    const reed = screen.getByRole('button', { name: 'Reed whisper, 6 turns, 30 ft' });
    expect(reed.textContent).not.toMatch(/[●○]/);
    expect(screen.getByRole('button', { name: 'Cast Mire lamp' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cast Reed whisper' })).toBeTruthy();
  });

  // Purpose: a spell with no casting left is crossed out, says "Cast" in words (never colour alone), offers no Cast,
  // and sinks below the others; the rest keep the order they were given (the state's order, the lead's answer 1).
  it('crosses out a spent spell, says Cast, offers none, and puts it last', () => {
    const spells = [row('a', 'Ash lantern', 1, 0), row('b', 'Bog step', 1, 1), row('c', 'Cold mist', 2, 2)];
    render(<SpellLevel level={1} slots={4} spells={spells} onOpen={vi.fn()} onCast={vi.fn()} />);
    const names = within(screen.getByRole('region', { name: 'Level 1, 4 a day' }))
      .getAllByRole('button')
      .filter((b) => !b.textContent?.startsWith('Cast'))
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Bog step, 6 turns, 30 ft', 'Cold mist, 2 of 2 left, 6 turns, 30 ft', 'Ash lantern, cast']);
    const ash = screen.getByRole('button', { name: 'Ash lantern, cast' });
    expect(ash.querySelector('s')?.textContent).toBe('Ash lantern');
    expect(within(ash).getByText('Cast')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cast Ash lantern' })).toBeNull();
  });

  // Purpose: anywhere on the row but Cast opens the spell's rules; Cast acts on its own, by the row's key.
  it('opens the rules from the row and casts from the button', async () => {
    const person = userEvent.setup();
    const onOpen = vi.fn();
    const onCast = vi.fn();
    render(<SpellLevel level={1} slots={2} spells={[row('1:mire-lamp', 'Mire lamp', 2, 2), row('1:ash', 'Ash lantern', 1, 0)]} onOpen={onOpen} onCast={onCast} />);
    await person.click(screen.getByRole('button', { name: 'Mire lamp, 2 of 2 left, 6 turns, 30 ft' }));
    expect(onOpen).toHaveBeenLastCalledWith('1:mire-lamp');
    await person.click(screen.getByRole('button', { name: 'Ash lantern, cast' }));
    expect(onOpen).toHaveBeenLastCalledWith('1:ash');
    expect(onCast).not.toHaveBeenCalled();
    await person.click(screen.getByRole('button', { name: 'Cast Mire lamp' }));
    expect(onCast).toHaveBeenCalledWith('1:mire-lamp');
  });

  // Purpose: messy data holds: a very long name and 99 castings (the pips past five read "●×98 ○×1"), 999 a day.
  it('holds a very long name, 99 castings and 999 a day', () => {
    const long = 'Hush of the long fen at the hour before the tide turns and the herons wake';
    render(<SpellLevel level={9} slots={999} spells={[row('h', long, 99, 98, '')]} onOpen={vi.fn()} onCast={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Level 9, 999 a day' })).toBeTruthy();
    const hush = screen.getByRole('button', { name: `${long}, 98 of 99 left` });
    expect(hush.textContent).toContain('●×98');
    expect(hush.textContent).toContain('○×1');
  });
});

// The Magic tab's buttons as icons with their word (ic-1, ic-2, mm-11). Invented spells. In plain words:
//   * Cast on a ready spell's row is the shared stacked button: the magic palm above the word, named for the spell;
//   * a row with an action but no icon (Use, Fire) is drawn exactly as before: the small word button, no icon;
//   * an opened entry's own act (Cast) and its way out ("Got it") take an icon above their word when given one, and
//     stay the plain word buttons without.
describe('the Magic tab: Cast and Got it as icons with their word (ic-2)', () => {
  const stacked = (button: HTMLElement, icon: keyof typeof ICON_SET, word: string) => {
    expect(button.classList.contains('stacked-button')).toBe(true);
    expect([...button.children].map((child) => child.tagName.toLowerCase())).toEqual(['svg', 'span']);
    expect(button.querySelector('path')!.getAttribute('d')).toBe(ICON_SET[icon].d);
    expect(button.querySelector('span')!.textContent).toBe(word);
  };

  it('draws Cast on the row as the stacked button with the magic palm, named for the spell', async () => {
    const person = userEvent.setup();
    const onCast = vi.fn();
    render(<SpellLevel level={1} slots={2} spells={[row('1:mire-lamp', 'Mire lamp', 1, 1)]} onOpen={vi.fn()} onCast={onCast} />);
    const cast = screen.getByRole('button', { name: 'Cast Mire lamp' });
    stacked(cast, 'magic-palm', 'Cast');
    expect(cast.classList.contains('list-row__action')).toBe(true);
    expect(cast.classList.contains('button-secondary')).toBe(true);
    await person.click(cast);
    expect(onCast).toHaveBeenCalledWith('1:mire-lamp');
  });

  it('leaves a row with an action but no icon as it was', () => {
    render(<ListRow title="Ember ward" sub="1 of 2 left" onOpen={vi.fn()} action="Use" actionLabel="Use Ember ward" onAction={vi.fn()} />);
    const use = screen.getByRole('button', { name: 'Use Ember ward' });
    expect([...use.classList].sort()).toEqual(['button-secondary', 'button-secondary--small', 'list-row__action']);
    expect(use.querySelector('svg')).toBeNull();
    expect(use.textContent).toBe('Use');
  });

  it('puts an icon above the word of an entry’s act and its "Got it" when given one, and not without', () => {
    const { unmount } = render(<EntryPanel name="Mire lamp" headings={[]} onClose={vi.fn()} action={{ label: 'Cast', spoken: 'Cast Mire lamp', icon: 'magic-palm', onAction: vi.fn() }} asSheet />);
    stacked(screen.getByRole('button', { name: 'Cast Mire lamp' }), 'magic-palm', 'Cast');
    unmount();
    const second = render(<EntryPanel name="Mire lamp" headings={[]} onClose={vi.fn()} backLabel="Got it" backIcon="check-mark" asSheet />);
    stacked(screen.getByRole('button', { name: 'Got it' }), 'check-mark', 'Got it');
    second.unmount();
    render(<EntryPanel name="Mire lamp" headings={[]} onClose={vi.fn()} action={{ label: 'Cast', spoken: 'Cast Mire lamp', onAction: vi.fn() }} asSheet />);
    const plain = screen.getByRole('button', { name: 'Cast Mire lamp' });
    expect(plain.querySelector('svg')).toBeNull();
    expect(plain.textContent).toBe('Cast');
  });
});
