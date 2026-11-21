// @vitest-environment jsdom
// The Magic section's look and taps (sr-4): pips per level, a tab per kind, rows opening entries, the fold. Invented data.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MagicBlock } from './MagicBlock.tsx';
import { magicOf } from '../modules/characters/magic.ts';
import type { SpellEntry } from '../modules/characters/firstSpells.ts';

const spells = Array.from({ length: 10 }, (_, i) => ({ packEntryId: `s${i}`, name: `Charm ${i}`, data: { range: 'touch' } }));
const lists: SpellEntry[] = [
  { packEntryId: 'book-list', name: 'Lamp lore', data: { levels: [{ level: 1, spells: spells.map((s) => s.packEntryId) }] } },
  { packEntryId: 'glamours', name: 'Glamours', data: { levels: [{ level: 1, spells: ['hush'] }] } },
];
const klass: SpellEntry = { packEntryId: 'warden', name: 'Lantern Warden', data: { spellcasting: { listId: 'book-list', type: 'book', fromLevel: 1, firstSpells: { given: ['s0'] } } } };
const all = [...spells, { packEntryId: 'hush', name: 'Heron hush', data: {} }];
const magic = (book: string[], slots = [3, 2]) => magicOf({ klass, race: null, level: 3, book, prepared: [], slots, spells: all, lists })!;

describe('MagicBlock', () => {
  afterEach(cleanup);

  it('shows the spells a day as pips per level, not numbers; a screen reader hears the list "Spells a day", then "Level 1, 3 a day"', () => {
    render(<MagicBlock magic={magic([])} onOpen={() => {}} />);
    const levels = screen.getAllByRole('listitem').filter((li) => li.closest('.magic__levels'));
    expect(screen.getByRole('list', { name: 'Spells a day' })).toBeTruthy();
    expect(levels.map((li) => li.textContent)).toEqual(['Level 1 ●●●, 3 a day', 'Level 2 ●●, 2 a day']);
    // The pips are hidden from a screen reader; the words say the same.
    for (const li of levels) expect(li.querySelector('.use-pips')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('leaves a spell level with no slots out ("never 1, 0, 0")', () => {
    render(<MagicBlock magic={magic([], [3, 2, 2, 0, 1, 1])} onOpen={() => {}} />);
    const levels = screen.getAllByRole('listitem').filter((li) => li.closest('.magic__levels'));
    expect(levels.map((li) => li.textContent!.split(' ')[1])).toEqual(['1', '2', '3', '5', '6']);
  });

  it('shows a tab per kind of magic, the first pressed; a tap on another shows its spells, and a row opens its spell', () => {
    const onOpen = vi.fn();
    render(<MagicBlock magic={magic(['s0', 'hush'])} onOpen={onOpen} />);
    expect(screen.getByRole('button', { name: 'Spell book: 1' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^Charm 0/ }).textContent).toContain('given');
    fireEvent.click(screen.getByRole('button', { name: 'Glamours: 1' }));
    expect(screen.queryByRole('button', { name: /^Charm 0/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Heron hush/ }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ name: 'Heron hush' }));
  });

  it('says so on an empty tab rather than showing nothing', () => {
    render(<MagicBlock magic={magic([])} onOpen={() => {}} />);
    expect(screen.getByText('No spells in your book yet.')).toBeTruthy();
  });

  it('folds a tab of more than eight after eight, "2 more" showing the rest in place', () => {
    render(<MagicBlock magic={magic(spells.map((s) => s.packEntryId))} onOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: /^Charm 9/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '2 more' }));
    expect(screen.getByRole('button', { name: /^Charm 9/ })).toBeTruthy();
  });

  it('shows a lone kind of magic as a heading, not a one-button tab row', () => {
    const glamourOnly = magicOf({ klass: { packEntryId: 'wisp-caller', name: 'Wisp Caller', data: { spellcasting: { listId: 'glamours', fromLevel: 1 } } }, race: null, level: 1, book: ['hush'], prepared: [], slots: [], spells: all, lists })!;
    render(<MagicBlock magic={glamourOnly} onOpen={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Glamours: 1' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Kinds of magic' })).toBeNull();
  });
});
