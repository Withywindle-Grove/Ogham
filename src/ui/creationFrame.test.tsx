// @vitest-environment jsdom
// The step's frame in creation (dec-10 batch A; cs-3, cs-5, cs-9; pictures creation/final 16-A1, 16-A6, 16-A7). Invented
// names only. Inside creation a fold has one mark, the chevron; a pick row's short lines run under it at its full
// width, still said with its name; a tap anywhere on the row's text opens its entry. Outside creation both are as before.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { BookType, FitLine, FoldedGroup, PickRow, PrimeXpTable } from './creation.tsx';

afterEach(cleanup);

const fold = (open: boolean) => (
  <FoldedGroup label="Not open to Stone kin" open={open}>
    <p>Marsh Chaplain</p>
  </FoldedGroup>
);

describe('one fold mark in creation (cs-9)', () => {
  it('inside creation a fold shows the chevron, down when folded and up when open; outside, the + / − square', () => {
    // Purpose: "+" means add (cs-9), so creation's folds take the chevron; folds elsewhere (the Pack, the sheet) keep theirs.
    const { unmount } = render(<BookType>{fold(false)}</BookType>);
    expect(document.querySelector('.creation-fold__mark')).not.toBeNull();
    expect(document.querySelector('.creation-fold__mark--open')).toBeNull();
    expect(document.querySelector('.creation-fold__square')).toBeNull();
    unmount();
    const open = render(<BookType>{fold(true)}</BookType>);
    expect(document.querySelector('.creation-fold__mark--open')).not.toBeNull();
    open.unmount();
    render(fold(false));
    expect(document.querySelector('.creation-fold__square')).not.toBeNull();
    expect(document.querySelector('.creation-fold__mark')).toBeNull();
  });
});

describe("a pick row's lines in creation (cs-3, cs-5)", () => {
  const row = (onOpen: () => void, onPick: () => void) => (
    <PickRow name="Lantern Warden" blurb="Keeps the marsh lamps and holds the front." fit={[{ text: 'Might 15, d8, +5% experience' }]} source="River Rules, p. 31" picked={false} onPick={onPick} onOpen={onOpen} />
  );

  it('the blurb, fit and source run under the row, outside its name button, and are still said with the name', () => {
    // Purpose: a row's short line runs under the row at its full width (cs-5), not in a column beside the Pick button;
    // a screen reader still hears them with the name.
    render(<BookType>{row(() => {}, () => {})}</BookType>);
    const name = screen.getByRole('button', { name: /^Lantern Warden/ });
    expect(name.textContent).toBe('Lantern Warden');
    const lines = document.querySelector('.pick-row__lines')!;
    expect(lines.textContent).toContain('Keeps the marsh lamps');
    expect(name.contains(lines)).toBe(false);
    expect(name.getAttribute('aria-describedby')).toBe(lines.id);
  });

  it('a tap on the lines opens the entry; Pick picks and opens nothing', async () => {
    // Purpose: a tap anywhere on a row's text opens its entry (cs-3), as the whole text did before; Pick stays Pick.
    const done: string[] = [];
    render(<BookType>{row(() => done.push('open'), () => done.push('pick'))}</BookType>);
    const user = userEvent.setup();
    await user.click(screen.getByText('Keeps the marsh lamps and holds the front.'));
    await user.click(screen.getByRole('button', { name: /^Lantern Warden/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Pick Lantern Warden' }));
    expect(done).toEqual(['open', 'open', 'pick']);
  });

  it('outside creation (the play screen) the row keeps its lines inside its button', () => {
    // Purpose: only creation's rows change now; AtHandSheets' rows are as they were.
    render(row(() => {}, () => {}));
    expect(screen.getByRole('button', { name: /^Lantern Warden/ }).textContent).toContain('Keeps the marsh lamps');
    expect(document.querySelector('.pick-row__lines')).toBeNull();
  });
});

describe("a class's fit line (cs-5)", () => {
  it('draws the hit die with its glyph, the words unchanged', () => {
    // Purpose: "Might 15, d8, +5% experience": the die named in the line carries its glyph (ds-3), as in the pictures.
    render(<FitLine parts={[{ text: 'Might 15' }, { text: ', ' }, { text: 'd8' }, { text: ', ' }, { text: '+5% experience' }]} />);
    const line = document.querySelector('.pick-row__fit')!;
    expect(line.textContent).toBe('Might 15, d8, +5% experience');
    expect(line.querySelector('.die-glyph')?.getAttribute('data-die')).toBe('8');
  });
});

describe('a row with the takes mark in creation (pf-16)', () => {
  it('with ✓✓ its Pick may drop under the name, at the right, only when its ticks leave the name too little room', async () => {
    // Purpose: pf-16 as #671 has it: a row picked more than once lets its button drop under the name, at the right, only
    // once its ticks no longer leave the name room; a short name keeps "Picked ✓✓" beside it (#747's review). The
    // widths are checked in a real browser (tests/layout/takesRows.spec.ts).
    render(
      <BookType>
        <PickRow name="Keeper of the Nine Drowned Bells below the Old Lantern" blurb="Rings the drowned to their rest." picked pickedLabel="Picked ✓✓" pickedSpoken="picked twice" onPick={() => {}} onOpen={() => {}} />
      </BookType>,
    );
    expect(document.querySelector('.pick-row')!.className).toContain('pick-row--takes');
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    const css = fs.readFileSync('src/ui/creation.css', 'utf8').replace(/\s+/g, ' ');
    expect(document.querySelector('.pick-row__top .pick-row__picks')).not.toBeNull();
    expect(css).toContain('.pick-row--takes .pick-row__top { flex-wrap: wrap; }');
  });
});

describe('Adjust scores in the book format (dec-10 B; picture creation/final 17-B4)', () => {
  const bands = [
    { range: '9–12', xp: '+0%', you: false },
    { range: '13–15', xp: '+5%', you: true },
  ];
  it("inside creation the prime experience table is the book's table: its bar, the prime's name over its column, the character's band in bold", () => {
    // Purpose: Help me choose's experience table in the book's table style (ds-8), the character's band bold with no
    // "(you)" shown, still said to a screen reader.
    render(<BookType><PrimeXpTable bands={bands} prime="Wits" /></BookType>);
    const table = screen.getByRole('table', { name: 'Experience by prime score' });
    expect(table.className).toContain('book-table');
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Wits', 'Experience']);
    const marked = table.querySelector('tbody tr.book-table__marked')!;
    expect(marked.querySelector('.visually-hidden')?.textContent).toBe(', you');
    expect(marked.textContent).toBe('13–15, you+5%');
    expect(table.querySelectorAll('tbody tr.book-table__marked')).toHaveLength(1);
  });
  it('outside creation (the sheet) the table is as before', () => {
    // Purpose: the sheet's explanation keeps today's table.
    render(<PrimeXpTable bands={bands} prime="Wits" />);
    expect(screen.getByRole('table').className).toContain('prime-xp');
  });
  it("the Prime tag and creation's sheet titles take the book's parts", async () => {
    // Purpose: the "Prime" tag is a small-capitals mark (Alegreya Sans SC, B4); a sheet's title in creation is balanced
    // over its lines (B1).
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    const css = fs.readFileSync('src/ui/creation.css', 'utf8');
    const at = css.indexOf('.book-type :is(');
    expect(css.slice(at, css.indexOf('{', at))).toContain('.score-tile__prime');
    // dec-10 E (pictures 20-E1, 20-E3): "Given" on a given spell or language is the same small-capitals mark.
    expect(css.slice(at, css.indexOf('{', at))).toContain('.pick-row__given');
    expect(css.replace(/\s+/g, ' ')).toContain('.book-type .dialog__title { text-wrap: balance; }');
  });
});

describe("creation's section headings (dec-10 D; pictures creation/final 19-D1, 19-D4)", () => {
  it("a step's group headings (Hit points, Who they are, Body) take the book's sub-heading style inside creation", async () => {
    // Purpose: inside creation a pick group's title and a field group's legend read as the book's sub-headings (Bitter
    // 800, the sub-heading's colour), as the entries' do (S3); outside creation they are as before.
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    const css = fs.readFileSync('src/ui/creation.css', 'utf8').replace(/\s+/g, ' ');
    const at = css.indexOf('.book-type :is(.pick-group__title, .campaign-fields__legend)');
    expect(at).toBeGreaterThan(-1);
    const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
    for (const rule of ['font-family: var(--font-book-text);', 'font-weight: var(--weight-book-subhead);', 'color: var(--book-subhead);']) expect(body).toContain(rule);
  });
});

describe("creation's tapped tables in the book's style (dec-10 D, #759's review; picture creation/final 19-D2)", () => {
  const readCss = async (path: string) => {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    return fs.readFileSync(path, 'utf8').replace(/\s+/g, ' ');
  };
  it('every tapped table takes the book rows: option rows, pick rows, and a long table’s cells', async () => {
    // Purpose: the describing tables (Looks, the trinket, the long tables, trait lists) draw pick rows, and a long table
    // puts each row in a cell; the book's rules reach all of them, not only the name table's option rows.
    const css = await readCss('src/ui/creation.css');
    expect(css).toContain('.book-type :is(.table-sheet__rows, .table-sheet__long) > :nth-child(even) { background: var(--book-band); }');
    expect(css).toContain(".book-type :is(.table-sheet__rows, .table-sheet__long) :is(.option-row[aria-checked='true'], .pick-row--picked)");
    // The banding itself, a table's own rows and a cell's alike, is checked in a real browser: tests/layout/bookRows.spec.ts.
  });
  it('the parts switch wraps to a second row rather than running past a phone’s sheet', async () => {
    // Purpose: three or four parts, or long names at Large text, wrap (19-D2's caption), so nothing overflows 375 px.
    const css = await readCss('src/ui/parts.css');
    const at = css.indexOf('.button-row--switch {');
    expect(at).toBeGreaterThan(-1);
    const body = css.slice(at, css.indexOf('}', at));
    expect(body).toContain('flex-wrap: wrap;');
    expect(body).toContain('max-inline-size: 100%;');
  });
});

describe("Weapon skills' count heading (dec-10 E, picture creation/final 20-E4)", () => {
  it('sits right over its first group, with no empty band between them', async () => {
    // Purpose: "Pick 2" and the first group's heading ("Weapons") are one block: only the step's own gap between them,
    // not the count's margin and the group's margin as well.
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    const css = fs.readFileSync('src/ui/creation.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toContain('.weapon-skills__count { margin-block-end: 0; }');
    expect(css).toContain('.weapon-skills__count + .pick-group { margin-block-start: 0; }');
  });
});
