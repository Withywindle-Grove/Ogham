// @vitest-environment jsdom
// The book's tapped table (dec-10 E; pictures creation/final 20-E1, 20-E2, 20-E3): the shared part Magic's rolls and
// Languages' rolled list draw, and the name sheet's head.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookTapTable, type BookTapRow } from './creation.tsx';

afterEach(cleanup);

const rows = (over: Partial<Record<string, Partial<BookTapRow>>> = {}): BookTapRow[] =>
  [
    { key: 'a', range: '1', name: 'Bird Friend', line: 'Talks with birds', picked: false, onPick: vi.fn() },
    { key: 'b', range: '2–3', name: 'Lock Singer', line: 'Sings locks open', picked: true, onPick: vi.fn() },
    { key: 'c', range: '4', name: 'Old Marsh', warn: 'Not open to Stone kin', picked: false, onPick: vi.fn() },
  ].map((row) => ({ ...row, ...over[row.key] }));

describe('the book’s tapped table (dec-10 E)', () => {
  it('is one group named for its table, each row a radio reached by Tab that says its range in words and its state', async () => {
    // Purpose: every row is reachable and pickable from the keyboard and says aloud its number, its name and whether it
    // is picked; the head (the bar, the die, the column) is for the eye, so a reader hears the rows' group instead.
    const user = userEvent.setup();
    const list = rows();
    render(<BookTapTable title="Stone kin knacks" die="d6" column="Knack" label="Stone kin knacks" rows={list} />);
    // A plain group, not a radio group: a row's ⓘ may sit beside it, and a radio group holds only radios (#780's review).
    const group = screen.getByRole('group', { name: 'Stone kin knacks' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(radios[1]!.textContent).toMatch(/^2 to 3 ?Lock Singer/);
    expect(document.querySelector('.book-tap-head')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.book-tap-head__bar')?.textContent).toBe('Stone kin knacks');
    expect(document.querySelector('.book-tap-head__row')?.textContent).toBe('d6Knack');
    await user.tab();
    expect(document.activeElement).toBe(radios[0]);
    await user.keyboard('{Enter}');
    expect(list[0]!.onPick).toHaveBeenCalledOnce();
  });

  it('keeps a closed row in its place with its ▲ reason, still a tap that the caller answers', async () => {
    // Purpose: nothing closed opens and nothing is greyed out or disabled: the row stays, says why, and its tap explains.
    const user = userEvent.setup();
    const list = rows();
    render(<BookTapTable die="d6" column="Language" label="Pick 1 more" rows={list} />);
    const closed = screen.getByRole('radio', { name: /^4 ?Old Marsh/ });
    expect(closed.hasAttribute('disabled')).toBe(false);
    // A space after the sign, as the frame has it (#780's review).
    expect(closed.querySelector('.option-row__not-allowed')?.textContent).toContain('Not open to Stone kin');
    expect(closed.querySelector('.option-row__not-allowed > strong')?.nextSibling?.textContent).toMatch(/^ /);
    await user.click(closed);
    expect(list[2]!.onPick).toHaveBeenCalledOnce();
    // With no table name, no bar: nothing invented.
    expect(document.querySelector('.book-tap-head__bar')).toBeNull();
  });

  it('is checkboxes when more than one is taken, and an entry is its own 44 px ⓘ beside the row', async () => {
    // Purpose: a list taking two or more says each row is one of several (checkbox), and the ⓘ the build had stays a
    // separate tap named for its row, so picking and reading never share a target.
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<BookTapTable die="d6" column="Language" label="Pick 2 more" rows={rows({ a: { onOpen } })} multiple />);
    expect(screen.getByRole('group', { name: 'Pick 2 more' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Bird Friend: read it' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
