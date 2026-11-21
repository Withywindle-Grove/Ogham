// @vitest-environment jsdom
// A trait's note written in pf-18's blocks (tfb-5, 2026-11-19; plan test-feedback-2026-11-19 rows C9a and C9): the one
// reader reads a class's or kindred's `abilities[].note` as plain words or as blocks; the trait's entry sets a note in
// blocks out block by block, each on its own line; everywhere else the note is read (a class's entry's bullets, a trait
// with uses' row, a chip's trait) it reads as words. A note in plain words reads as today everywhere. Invented content
// only (hard rule 2).
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntryEditor } from '../app/EntryEditor.tsx';
import { traitsOf } from '../modules/characters/bonuses.ts';
import { abilitiesByKind } from '../modules/characters/creationRules.ts';
import { traitEntry } from '../modules/characters/listEntries.ts';
import { limitedAbilities } from '../modules/characters/playState.ts';
import { readTraitNote, traitNoteWords } from '../modules/library/ruleText.ts';
import { BookType, EntryPanel } from './creation.tsx';

afterEach(cleanup);

/** A trait note in blocks: a paragraph, two bold lead-ins, a list (M2a's shape, invented words). */
const bannerNote = () => ({
  blocks: [
    { p: 'A warden of the first two levels marches under another banner.' },
    { lead: 'Hearth-right', text: 'A bed and a meal at any hall that flies one.' },
    { lead: 'A banner lost.', text: 'Marches under another until it is won back.' },
    { list: ['No pay from its enemies.', 'No sworn companion left behind.'] },
  ],
});

const warden = (note: unknown, more: Record<string, unknown> = {}) => ({
  name: 'Lantern Warden',
  abilities: [{ name: 'Banner right', fromLevel: 3, note, ...more }],
});

describe('a trait note read (C9a)', () => {
  // Purpose: a note in plain words comes back exactly as before tfb-5: trimmed, its link marks untouched, no blocks.
  it('reads plain words as today', () => {
    expect(readTraitNote('  Stand fast; see [[rule:wall|the wall]].  ')).toEqual({ words: 'Stand fast; see [[rule:wall|the wall]].', blocks: null });
    expect(traitNoteWords('')).toBe('');
  });

  // Purpose: a note in blocks gives its blocks for the entry and its plain words on one line for everything else.
  it('reads blocks as blocks, and as words on one line', () => {
    const read = readTraitNote(bannerNote());
    expect(read.blocks?.blocks.map((b) => b.kind)).toEqual(['p', 'lead', 'lead', 'list']);
    expect(read.words).toBe(
      'A warden of the first two levels marches under another banner. Hearth-right. A bed and a meal at any hall that flies one. A banner lost. Marches under another until it is won back. No pay from its enemies. No sworn companion left behind.',
    );
  });

  // Purpose: a note the reader can't use (no blocks, only empty blocks, a bare list, a number) is no note: never the raw object.
  it('reads an unusable note as none', () => {
    for (const bad of [{ blocks: [] }, { blocks: [{ p: '' }, { lead: 'Alone' }] }, [{ p: 'A bare list.' }], 7, null, undefined]) {
      expect(readTraitNote(bad)).toEqual({ words: '', blocks: null });
    }
  });
});

describe('the traits and their entry (C9a)', () => {
  // Purpose: a trait whose note is in blocks carries its words as `note` and its blocks for its entry.
  it('keeps a note in blocks for its entry, its words for the rest', () => {
    const [trait] = traitsOf(null, warden(bannerNote()), () => true);
    expect(trait!.note).toMatch(/^A warden of the first two levels/);
    expect(trait!.noteBlocks?.blocks).toHaveLength(4);
    expect(traitEntry(trait!).lead).toEqual(trait!.noteBlocks);
  });

  // Purpose: a trait whose note is plain words is as before: no blocks, its entry's lead the words.
  it('leaves a plain note as it was', () => {
    const [trait] = traitsOf(null, warden('Marches under a banner.'), () => true);
    expect(trait).not.toHaveProperty('noteBlocks');
    expect(traitEntry(trait!).lead).toBe('Marches under a banner.');
  });

  // Purpose: a note in blocks the reader can't use falls back to the trait's `notes`, then its blurb, as a missing note did.
  it('falls back as a missing note does', () => {
    const [trait] = traitsOf(null, warden({ blocks: [{ p: ' ' }] }, { blurb: 'Carries a banner.' }), () => true);
    expect(trait!.note).toBe('Carries a banner.');
    expect(trait).not.toHaveProperty('noteBlocks');
  });
});

describe('a note in blocks with no words (review of #1076)', () => {
  // Purpose: a note whose only block is a table named by its id has no words: the trait keeps no blocks, so its entry
  // falls back with its rows instead of drawing nothing.
  it('keeps no blocks and falls back', () => {
    const [trait] = traitsOf(null, warden({ blocks: [{ tableRef: 'banner-colours' }] }, { blurb: 'Carries a banner.' }), () => true);
    expect(trait!.note).toBe('Carries a banner.');
    expect(trait).not.toHaveProperty('noteBlocks');
    expect(traitEntry(trait!).lead).toBe('Carries a banner.');
  });
});

describe('the pack editor and a note in blocks (review of #1076)', () => {
  // Purpose: in the Rules library's editor a trait note in blocks shows its words, kept as it is, never "[object
  // Object]"; editing the row's other cells saves the blocks untouched.
  it('shows its words, kept as it is, and saves it untouched', async () => {
    const onSave = vi.fn<(data: Record<string, unknown>) => Promise<string | null>>(async () => null);
    render(
      <EntryEditor
        kind="class"
        entry={{ kind: 'class', packEntryId: 'lantern-warden', name: 'Lantern Warden', data: { id: 'lantern-warden', name: 'Lantern Warden', abilities: [{ name: 'Banner right', fromLevel: 3, note: bannerNote() }] } }}
        entries={[]}
        usedIds={new Set(['lantern-warden'])}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByLabelText('Abilities 1: What it does').textContent).toMatch(/^“A warden of the first two levels marches under another banner\. Hearth-right\. .*”, kept as it is\.$/);
    expect(document.body.textContent).not.toContain('[object Object]');
    const name = screen.getByLabelText('Abilities 1: Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Banner of the fen');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0].abilities).toEqual([{ name: 'Banner of the fen', fromLevel: 3, note: bannerNote() }]);
  });
});

describe('elsewhere a note in blocks reads as words', () => {
  // Purpose: a class's or kindred's entry lists its traits as bullet lines; a note in blocks is one line of words there.
  it("in a class's or kindred's entry, as a bullet", () => {
    const { advantage } = abilitiesByKind(warden(bannerNote()));
    expect(advantage[0]!.note).toMatch(/^A warden of the first two levels marches under another banner\. Hearth-right\. A bed/);
    expect(abilitiesByKind(warden('Plain words.')).advantage[0]!.note).toBe('Plain words.');
  });

  // Purpose: a trait with uses shows its note as words on its row and pop-up, never the raw object.
  it('on a trait with uses', () => {
    const [power] = limitedAbilities(warden(bannerNote(), { fromLevel: 1, uses: { count: 1, per: 'day' } }), null, 1);
    expect(power!.note).toMatch(/^A warden of the first two levels/);
    expect(limitedAbilities(warden('Plain words.', { fromLevel: 1, uses: { count: 1, per: 'day' } }), null, 1)[0]!.note).toBe('Plain words.');
  });
});

describe("the trait's entry sets a note in blocks block by block (C9)", () => {
  const entryOf = (note: unknown) => traitEntry(traitsOf(null, warden(note), () => true)[0]!, 'Reed rules');

  // Purpose: in the book format (the Player tab's and the sheet's entries, creation's), each block is its own line:
  // the paragraph, each bold lead-in starting its own paragraph, the list's items; then the labelled lines.
  it('in the book format', () => {
    const entry = entryOf(bannerNote());
    const { container } = render(
      <BookType>
        <EntryPanel name={entry.name} meta={entry.meta} lead={entry.lead} headings={entry.headings} onClose={() => {}} backLabel="Got it" asSheet preview />
      </BookType>,
    );
    const text = container.querySelector('.rule-text--book')!;
    expect([...text.querySelectorAll(':scope > p')].map((p) => p.textContent)).toEqual([
      'A warden of the first two levels marches under another banner.',
      'Hearth-right. A bed and a meal at any hall that flies one.',
      'A banner lost. Marches under another until it is won back.',
    ]);
    expect([...text.querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['Hearth-right. ', 'A banner lost. ']);
    expect([...text.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['No pay from its enemies.', 'No sworn companion left behind.']);
    // The labelled lines follow the text, as before.
    expect(text.compareDocumentPosition(container.querySelector('.book-line')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.textContent).not.toContain('[object Object]');
  });

  // Purpose: outside the book format the entry sets the blocks out the same way.
  it('outside the book format', () => {
    const entry = entryOf(bannerNote());
    const { container } = render(<EntryPanel name={entry.name} lead={entry.lead} headings={entry.headings} onClose={() => {}} asSheet={false} />);
    expect([...container.querySelectorAll('.rule-text > p')]).toHaveLength(3);
    expect(container.querySelector('.entry-panel__lead')).toBeNull();
    expect(container.textContent).not.toContain('Your setting says nothing more');
  });

  // Purpose: a trait not yet rewritten (plain words) reads as today: one paragraph, its lead-ins running on inside it.
  it('a plain note reads as today', () => {
    const entry = entryOf('A warden marches under a banner. Hearth-right: a bed at any hall.');
    const { container } = render(
      <BookType>
        <EntryPanel name={entry.name} lead={entry.lead} headings={entry.headings} onClose={() => {}} asSheet preview />
      </BookType>,
    );
    expect(container.querySelector('.rule-text')).toBeNull();
    expect([...container.querySelectorAll('.book-paragraph')].map((p) => p.textContent)).toEqual(['A warden marches under a banner. Hearth-right: a bed at any hall.']);
  });
});
