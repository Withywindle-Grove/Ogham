// @vitest-environment jsdom
// A class's or kindred's `description` in its entry (ruled by Francis 2026-11-07): the book's descriptive paragraphs,
// plain text, after the one-line blurb, wherever the entry opens (the creation steps, the review, the sheet). Without
// one, the entry is as before. Invented content only (hard rule 2).
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { descriptionOf } from '../modules/characters/creationGuide.ts';
import { EntryPanel } from './creation.tsx';

afterEach(cleanup);

const wardenDescription = 'Lantern Wardens walk the causeways at dusk.\n\nThey are paid in oil and <b>gratitude</b>.';

describe('a class or kindred description in its entry', () => {
  it('shows each paragraph of the description after the blurb, as its own paragraph', () => {
    // Purpose: a player tapping a class reads the book's paragraphs under its one line, paragraphs kept apart.
    const { container } = render(<EntryPanel name="Lantern Warden" lead="Keeps the lights." description={descriptionOf({ description: wardenDescription })} headings={[]} onClose={() => {}} asSheet={false} />);
    const paragraphs = [...container.querySelectorAll('p.entry-panel__lead')].map((p) => p.textContent);
    expect(paragraphs).toEqual(['Keeps the lights.', 'Lantern Wardens walk the causeways at dusk.', 'They are paid in oil and <b>gratitude</b>.']);
  });

  it('renders the description as text, never as markup', () => {
    // Purpose: a pack's text can't inject HTML into the page; angle brackets show as written.
    const { container } = render(<EntryPanel name="Lantern Warden" description={descriptionOf({ description: wardenDescription })} headings={[]} onClose={() => {}} asSheet={false} />);
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('They are paid in oil and <b>gratitude</b>.')).toBeTruthy();
  });

  it('without a description the entry is as before', () => {
    // Purpose: packs that don't give one see no change: the blurb only, or the "says nothing more" line.
    const { container, rerender } = render(<EntryPanel name="Stone kin" lead="Slow and sure." description={descriptionOf({})} headings={[]} onClose={() => {}} asSheet={false} />);
    expect(container.querySelectorAll('.entry-panel__description')).toHaveLength(0);
    rerender(<EntryPanel name="Stone kin" description={descriptionOf({ description: 7 })} headings={[]} onClose={() => {}} asSheet={false} />);
    expect(screen.getByText('Your setting says nothing more about Stone kin.')).toBeTruthy();
  });

  it('reads a description into paragraphs, one per line, blank lines dropped; anything but text is none', () => {
    // Purpose: the pack's one or two paragraphs arrive as separate paragraphs, whatever line breaks they use.
    expect(descriptionOf({ description: 'First.\r\nSecond.\n\n\n  Third.  ' })).toEqual(['First.', 'Second.', 'Third.']);
    expect(descriptionOf({ description: '   ' })).toEqual([]);
    expect(descriptionOf({ description: ['First.'] })).toEqual([]);
    expect(descriptionOf({})).toEqual([]);
  });
});
