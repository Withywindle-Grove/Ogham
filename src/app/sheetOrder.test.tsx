// @vitest-environment jsdom
// Sheet plan order 4 (sr-6, sr-7; Design's notes, 2026-11-05): the full sheet's sections fold to one fold row on a
// phone (the inventory's fold row, FoldedGroup: the name, the summary under it, + or − at the right edge; plan
// m5b-players-screens-standard D, Design on #558) and open in place; a tile caption that can't fit on one line puts
// each part on its own line without the separator dot; a field a trait list owns that the character never takes is left off the sheet. Invented names and
// figures only (hard rule 2).
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { countedSummary, joinSummary, labelledSummary, magicSummary, packLoadSummary, valuesSummary } from '../modules/characters/sheetSummaries.ts';
import { fieldsListLeavesOut, type LayoutHint, type TraitList } from '../modules/characters/traitLists.ts';
import type { FieldDefinition } from '../modules/characters/fields.ts';
import { StatRow, StatTile } from '../ui/parts.tsx';
import { SheetSection } from './SheetSection.tsx';

const realMatchMedia = window.matchMedia;
afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
});

/** A window this many pixels wide: matchMedia answers min-width and max-width queries for it. */
function windowOf(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (!min || width >= Number(min[1])) && (!max || width <= Number(max[1])) && Boolean(min || max);
    return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
  }) as typeof window.matchMedia;
}

describe('a sheet section on a phone and a tablet (sr-7)', () => {
  // On a phone a section starts as its fold row (the summary under the name, + at the right edge); a tap opens it in
  // place, the summary goes and the square shows −; another closes it.
  it('folds to its summary line on a phone and opens in place', async () => {
    windowOf(375);
    const user = userEvent.setup();
    const { container } = render(
      <SheetSection label="Saves" fold summary="Mire 12, Ward +2">
        <p>Save vs mire 12</p>
      </SheetSection>,
    );
    const fold = container.querySelector('details.creation-fold') as HTMLDetailsElement;
    const row = fold.querySelector('summary')!;
    expect(fold.open).toBe(false);
    expect(fold.querySelector('.creation-fold__note')?.textContent).toBe('Mire 12, Ward +2');
    expect(row.lastElementChild?.classList.contains('creation-fold__square')).toBe(true);
    expect(screen.queryByText('Save vs mire 12')).toBeNull();
    await user.click(row);
    expect(fold.open).toBe(true);
    expect(screen.getByText('Save vs mire 12')).toBeTruthy();
    expect(fold.querySelector('.creation-fold__note')).toBeNull();
    await user.click(row);
    expect(screen.queryByText('Save vs mire 12')).toBeNull();
  });

  // Design on #558: the sheet has one fold pattern. A folding section is the inventory's fold row, the very part the
  // Pack uses (FoldedGroup: its bold label, its summary, its square), never a small-caps heading; small caps are for
  // section headings only. And the summary reaches the row whole: only the row's width cuts it, with "…", never code.
  it("is the Pack's fold row, its label bold not small caps, its summary passed whole", () => {
    windowOf(375);
    const long = '7: Moon sight, Iron-shy, Lantern ward, Steady flame, Small, Second wind, Oath of light';
    const { container } = render(
      <SheetSection label="Traits" fold summary={long}>
        <p>Moon sight</p>
      </SheetSection>,
    );
    const fold = container.querySelector('section > details.creation-fold')!;
    expect(fold.querySelector('summary.creation-fold__summary')).not.toBeNull();
    expect(fold.querySelector('.creation-fold__label')?.textContent).toBe('Traits');
    expect(container.querySelector('.sheet__label')).toBeNull();
    expect(container.querySelector('[class*="sheet__fold"], [class*="sheet__summary"]')).toBeNull();
    expect(fold.querySelector('.creation-fold__note')?.textContent).toBe(long);
  });

  // On a tablet the same section is always open under a plain heading, with no fold button.
  it('is always open under its heading on a tablet', () => {
    windowOf(834);
    render(
      <SheetSection label="Saves" fold summary="Mire 12">
        <p>Save vs mire 12</p>
      </SheetSection>,
    );
    expect(screen.getByRole('heading', { name: 'Saves' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Save vs mire 12')).toBeTruthy();
  });

  // Combat never folds, even on a phone: its tiles stay in view.
  it('never folds a section not marked to fold', () => {
    windowOf(375);
    render(
      <SheetSection label="Combat">
        <p>11 of 14</p>
      </SheetSection>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('11 of 14')).toBeTruthy();
  });

  // This device remembers a section left open, by name, as the Pack tab remembers its folds: it opens so next time.
  it('remembers on this device which sections were left open', async () => {
    windowOf(375);
    localStorage.removeItem('grimoire.sheetOpen');
    const user = userEvent.setup();
    const section = (
      <SheetSection label="Skills" fold summary="1: Hark 6+">
        <p>Hark 6+</p>
      </SheetSection>
    );
    const first = render(section);
    await user.click(first.container.querySelector('details.creation-fold > summary')!);
    first.unmount();
    const again = render(section);
    expect((again.container.querySelector('details.creation-fold') as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByText('Hark 6+')).toBeTruthy();
    localStorage.removeItem('grimoire.sheetOpen');
  });
});

describe('a tile caption with parts (Design, 2026-11-05)', () => {
  // A caption that fits stays one line with its separators.
  it('stays on one line when it fits', () => {
    const { container } = render(<StatTile label="ac" value={12} caption="Quilted coat, NIM +1" />);
    expect(container.querySelector('.stat-tile__caption')!.textContent).toBe('Quilted coat, NIM +1');
  });

  // A caption wider than its tile puts each part on its own line and drops the dot, so no line starts with "·".
  it('puts each part on its own line, without the dot, when it runs past its tile', () => {
    const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
    const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 200 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 80 });
    try {
      const { container } = render(<StatTile label="ac" value={12} caption="Quilted coat, Barge-plank shield, NIM +1" />);
      const parts = [...container.querySelectorAll('.stat-tile__part')].map((p) => p.textContent);
      expect(parts).toEqual(['Quilted coat', 'Barge-plank shield', 'NIM +1']);
      expect(container.querySelector('.stat-tile__caption')!.textContent).not.toContain('·');
    } finally {
      if (scroll) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scroll);
      if (client) Object.defineProperty(HTMLElement.prototype, 'clientWidth', client);
    }
  });

  // The Combat row's wrap variant is its own class, so only the sheet's tiles go two by two; the plain row is unchanged.
  it('marks the wrap variant and leaves the plain row as it was', () => {
    const { container } = render(
      <>
        <StatRow wrap>
          <StatTile label="level" value={3} />
        </StatRow>
        <StatRow>
          <StatTile label="gold" value={0} />
        </StatRow>
      </>,
    );
    expect(container.querySelectorAll('.stat-row--wrap')).toHaveLength(1);
    expect(container.querySelectorAll('.stat-row')).toHaveLength(2);
  });
});

describe('the summary lines', () => {
  // Blanks and "—" say nothing, so they're left out of every summary.
  it('leaves out empty parts and dashes', () => {
    expect(joinSummary(['Speed 40', '', '—', null, 'Exploring 120'])).toBe('Speed 40, Exploring 120');
    expect(labelledSummary([{ label: 'Speed', value: 40 }, { label: 'Overland', value: '—' }])).toBe('Speed 40');
  });

  // Words read alone, but a bare number keeps its label ("Might 13", not "13").
  it('keeps the label beside a number in a section of words', () => {
    expect(valuesSummary([{ label: 'Leaning', value: 'Lantern' }, { label: 'Might', value: '13' }, { label: 'Motto', value: '—' }])).toBe('Lantern, Might 13');
  });

  // Traits and Skills: a count, a colon, then the names (no middle dot: a colon after a count, plan A2).
  it('counts, then names', () => {
    expect(countedSummary(['Lantern ward', 'Moon sight', 'Iron-shy'])).toBe('3: Lantern ward, Moon sight, Iron-shy');
    expect(countedSummary([])).toBe('');
  });

  // Magic: each kind with its count; the Pack load: its speed, then how many things (over the most, the setting's words).
  it('reads Magic and the Pack load', () => {
    expect(magicSummary([{ title: 'Spell book', count: 4 }, { title: 'Glamours', count: 2 }])).toBe('Spell book 4, Glamours 2');
    expect(packLoadSummary({ speed: 30, why: 'your load' }, 9)).toBe('Speed 30, 9 items');
    expect(packLoadSummary({ speed: null, why: 'stuck' }, 1)).toBe('Stuck, 1 item');
    expect(packLoadSummary(null, 0)).toBe('Nothing carried');
  });
});

describe('fields a trait list owns (sr-6, ct3-4b)', () => {
  const field = (key: string, from: string | null, type: FieldDefinition['type'] = 'list'): FieldDefinition => ({
    id: `f-${key}`,
    campaignId: 'c',
    key,
    label: key,
    type,
    choices: [],
    group: 'Who they are',
    order: 0,
    showOnCard: false,
    hidden: false,
    fill: null,
    required: false,
    from,
  });
  const list = (id: string, extra: Partial<TraitList> = {}): TraitList => ({ id, name: id, die: 'd6', notes: '', help: '', option: '', excludeRaces: [], source: '', rolls: 1, distinct: false, entries: [{ id: 'a', name: 'A', min: 1, max: 6, blurb: '', notes: '', source: '', items: [] }], ...extra });
  const lists = [list('fen-omens', { excludeRaces: ['bogling'] }), list('fen-oaths', { option: 'fen-oaths' }), list('fen-backgrounds-marsh-folk')];
  const fields = [field('omen', 'fen-omens'), field('oath', 'fen-oaths'), field('background', null, 'text'), field('motto', null, 'text')];
  const layout = new Map<string, LayoutHint>([['background', { from: 'fen-backgrounds-{race}', option: '' }]]);

  // A kindred the list leaves out never has the field; one it doesn't, does.
  it('leaves out a field whose list excludes the kindred', () => {
    expect([...fieldsListLeavesOut(fields, lists, layout, { raceRef: 'bogling', values: {} }, {})]).toContain('omen');
    expect([...fieldsListLeavesOut(fields, lists, layout, { raceRef: 'marsh-folk', values: {} }, {})]).not.toContain('omen');
  });

  // A list whose option is off takes its field with it; on, the field shows.
  it("follows the list's option", () => {
    expect([...fieldsListLeavesOut(fields, lists, layout, { raceRef: 'marsh-folk', values: {} }, { 'fen-oaths': 'off' })]).toContain('oath');
    expect([...fieldsListLeavesOut(fields, lists, layout, { raceRef: 'marsh-folk', values: {} }, { 'fen-oaths': 'on' })]).not.toContain('oath');
  });

  // A per-kindred field with no list for this kindred is left out while empty, and kept once something is written.
  it('leaves out an empty per-kindred field with no list for the kindred', () => {
    expect([...fieldsListLeavesOut(fields, lists, layout, { raceRef: 'bogling', values: {} }, {})]).toContain('background');
    expect([...fieldsListLeavesOut(fields, lists, layout, { raceRef: 'bogling', values: { background: 'Eel catcher' } }, {})]).not.toContain('background');
    expect([...fieldsListLeavesOut(fields, lists, layout, { raceRef: 'marsh-folk', values: {} }, {})]).not.toContain('background');
  });

  // A field no list owns is never touched here (its own option or class gate is fieldsOffFor's).
  it('never touches a field no list owns', () => {
    expect([...fieldsListLeavesOut(fields, lists, layout, { raceRef: 'bogling', values: {} }, {})]).not.toContain('motto');
  });
});
