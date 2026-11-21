// @vitest-environment jsdom
// An entry in the book format inside creation (dec-10 S3; cs-4, ds-8; pictures creation/final 16-A2, 16-A2b, 18-C3,
// 20-E2, 21-F6). Invented names only. Inside creation's book type an entry reads as the book prints it: the name as the
// heading, a small-capitals line, coloured labelled lines gathered before the lists, sub-headings over lists with bold
// lead-ins, the source last, an X and one "Pick" at the right. Outside creation (the character sheet) it is unchanged.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BookTable, BookType, EntryPanel, type EntrySection } from './creation.tsx';

afterEach(cleanup);

const headings: EntrySection[] = [
  { label: 'Requirement', text: 'Needs Grit 9, you have 13 ✓' },
  { label: 'Advantages', bullets: [{ name: 'Steady flame', effect: 'Relights a dying light once a day.' }, { name: 'Lamp-wise!', effect: 'Knows how long any light has left.' }] },
  { label: 'Disadvantages', bullets: [{ name: 'Oath of light', effect: 'May never douse a light on purpose.' }] },
  { label: 'Languages', text: 'Old Lantern' },
  { label: 'Holy garb', bullets: [{ name: 'At creation', effect: 'A grey hood' }], lines: true },
];

const entry = (props: Partial<Parameters<typeof EntryPanel>[0]> = {}) => (
  <EntryPanel name="Lantern Warden" meta="River Rules, p. 31" lead="Keeps the marsh lamps and holds the front." headings={headings} onPick={() => {}} onClose={() => {}} asSheet {...props} />
);

const sheet = () => screen.getByRole('dialog');

describe('an entry in the book format, inside creation (S3)', () => {
  it('the name is the heading in the book style, and the source comes last in words', () => {
    // Purpose: the entry opens as the book prints it (cs-4): the name as its heading, the source as the last line,
    // "From your setting's rules: <book, page>." rather than a line under the name.
    render(<BookType>{entry()}</BookType>);
    expect(within(sheet()).getByRole('heading', { name: 'Lantern Warden' }).className).toContain('book-heading');
    const last = sheet().querySelector('.book-source');
    expect(last?.textContent).toBe('From your setting’s rules: River Rules, p. 31.');
    expect(sheet().querySelector('.dialog__meta')).toBeNull();
  });

  it('a small-capitals line sits under the heading when the entry has one', () => {
    // Purpose: a patron's title line (C3) is the book's small-capitals descriptor, before its paragraphs.
    render(<BookType>{entry({ tagline: 'Light in the dark water' })}</BookType>);
    expect(sheet().querySelector('.book-tagline')?.textContent).toBe('Light in the dark water');
  });

  it('labelled lines are gathered before the lists, each label coloured on the same line as its value', () => {
    // Purpose: single values read as the book's labelled lines (A2), and they come before the lists, whatever order
    // the build gives them in (ruled 2026-11-12, A2).
    render(<BookType>{entry()}</BookType>);
    const lines = [...sheet().querySelectorAll('.book-line')].map((l) => [l.querySelector('.book-label')?.textContent, l.textContent]);
    expect(lines.slice(0, 2)).toEqual([
      ['Requirement', 'Requirement Needs Grit 9, you have 13 ✓'],
      ['Languages', 'Languages Old Lantern'],
    ]);
    const order = [...sheet().querySelectorAll('.book-line, .book-subhead')].map((n) => n.textContent?.split(' ')[0]);
    expect(order.indexOf('Languages')).toBeLessThan(order.indexOf('Advantages'));
  });

  it('a list sits under its sub-heading, each item a bold lead-in ending in a full stop', () => {
    // Purpose: Advantages and Disadvantages read as the book's lists (A2): "Steady flame. Relights…", no dash; a
    // lead-in that already ends in punctuation gets no second stop.
    render(<BookType>{entry()}</BookType>);
    expect(within(sheet()).getByRole('heading', { name: 'Advantages' }).className).toContain('book-subhead');
    const items = [...sheet().querySelectorAll('.book-list li')].map((li) => [li.querySelector('b')?.textContent, li.textContent]);
    expect(items[0]).toEqual(['Steady flame.', 'Steady flame. Relights a dying light once a day.']);
    expect(items[1]).toEqual(['Lamp-wise!', 'Lamp-wise! Knows how long any light has left.']);
    expect(sheet().textContent).not.toContain('—');
  });

  it('a ladder of lines (a patron’s garb and marks) stays a labelled line with its tiers as lines under it', () => {
    // Purpose: a patron's Holy garb is a labelled line with a tier a line under it (C3), not a list under a heading.
    render(<BookType>{entry()}</BookType>);
    const garb = [...sheet().querySelectorAll('.book-line')].find((l) => l.querySelector('.book-label')?.textContent === 'Holy garb');
    expect(garb).toBeTruthy();
    expect([...sheet().querySelectorAll('.book-line--sub')].map((l) => l.textContent)).toEqual(['At creation A grey hood']);
  });

  it('the foot has one button at the right, "Pick", said with the name; picked reads "Picked ✓"', () => {
    // Purpose: one button, "Pick", the sheet's one accent (cs-4); a screen reader still hears what it picks.
    const { unmount } = render(<BookType>{entry()}</BookType>);
    const pick = within(sheet()).getByRole('button', { name: 'Pick Lantern Warden' });
    expect(pick.textContent).toBe('Pick');
    expect(pick.className).toContain('button-primary');
    unmount();
    render(<BookType>{entry({ picked: true })}</BookType>);
    expect(within(sheet()).getByRole('button', { name: 'Picked Lantern Warden' }).textContent).toBe('Picked ✓');
  });

  it('an entry opened only to read has "Back to <entry>" at its top as a quiet link; another way out stays at the foot', async () => {
    // Purpose: C3: a class read from a kindred's chip has its way back at the top, a plain link (fl-1 allows "Back to");
    // the review's "Got it" is not a way back, so it keeps its place at the foot (#738's review).
    const closed: string[] = [];
    const { unmount } = render(<BookType>{entry({ onPick: undefined, backTo: 'Stone kin', onClose: () => closed.push('back') })}</BookType>);
    const back = within(sheet()).getByRole('button', { name: 'Back to Stone kin' });
    expect(back.className).toContain('book-back');
    expect(back.className).not.toContain('button-secondary');
    expect(sheet().querySelector('.book-back')).toBe(sheet().querySelector('button:not(.close-button):not(.dialog__close)'));
    back.click();
    expect(closed).toEqual(['back']);
    unmount();
    render(<BookType>{entry({ onPick: undefined, backLabel: 'Got it' })}</BookType>);
    const got = within(sheet()).getByRole('button', { name: 'Got it' });
    expect(got.className).not.toContain('book-back');
    expect(got.closest('.entry-panel__foot')).not.toBeNull();
  });

  it('drawn in place (the gallery), a read-only entry still has its way back at its top', () => {
    // Purpose: the gallery's specimen shows what a player gets: the sheet open in place (preview), "Back to <entry>"
    // first in it, before the entry's words (#738's review).
    render(<BookType>{entry({ onPick: undefined, backTo: 'Stone kin', preview: true })}</BookType>);
    const card = screen.getByRole('group', { name: 'Lantern Warden (preview)' });
    const back = within(card).getByRole('button', { name: 'Back to Stone kin' });
    const body = [...card.children].filter((el) => !el.classList.contains('dialog__head'));
    expect(body[0]).toBe(back);
  });

  it('outside creation (the character sheet) an entry keeps today’s format', () => {
    // Purpose: only creation's entries change now (cs-1); the sheet's keep their headings and their foot's words.
    render(entry());
    expect(sheet().querySelector('.book-heading, .book-line, .book-source')).toBeNull();
    expect(within(sheet()).getByRole('button', { name: 'Pick Lantern Warden' }).textContent).toBe('Pick Lantern Warden');
    expect(sheet().querySelector('dl.entry-panel__list')).not.toBeNull();
  });
});

describe('a table in the book style (ds-8)', () => {
  it('a filled title bar with its name, a head row, and the rows banded', () => {
    // Purpose: a table set from a book takes the book's form (ds-8): the title bar, the head row over its rule, rows
    // banded alternately, so the class's level table (cs-16) and any other entry table read as the book's.
    render(
      <BookTable
        title="Lantern wardens by level"
        head={['Level', 'Experience', 'Hit dice']}
        rows={[
          ['1', '0', '1d8'],
          ['2', '1,500', '2d8'],
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Lantern wardens by level' });
    expect(table.className).toContain('book-table');
    expect(table.querySelector('caption')?.textContent).toBe('Lantern wardens by level');
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Level', 'Experience', 'Hit dice']);
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    // Its own box scrolls when it truly cannot fit; a keyboard can reach it and a screen reader names it (#756's review).
    const box = screen.getByRole('region', { name: 'Lantern wardens by level' });
    expect(box.getAttribute('tabindex')).toBe('0');
    expect(box.contains(table)).toBe(true);
  });

  it('keeps every figure on one line; only the named words column may wrap', () => {
    // Purpose: a cell never wraps its value (cs-40a, F8; the night run of 2026-11-14 found "9d8 + 15" three lines tall at
    // 375 px): every column but the words column keeps one line, and a table of figures alone keeps all of them.
    const head = ['Level', 'Title', 'Hit dice'];
    const rows = [['14', 'Keeper of the Long Causeway', '9d8 + 15']];
    const { unmount } = render(<BookTable title="With titles" head={head} rows={rows} wordsColumn={1} />);
    const cells = (name: string) => [...screen.getByRole('table', { name }).querySelectorAll('th, td')].map((cell) => cell.classList.contains('book-table__figure'));
    expect(cells('With titles')).toEqual([true, false, true, true, false, true]);
    unmount();
    render(<BookTable title="Figures alone" head={head} rows={rows} />);
    expect(cells('Figures alone')).toEqual([true, true, true, true, true, true]);
  });
});
