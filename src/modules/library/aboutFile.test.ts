// "About this file" reads in plain words for a GM, not as the file's raw keys and values. Invented content.
import { describe, expect, it } from 'vitest';
import { aboutFile } from './aboutFile.ts';

describe('About this file', () => {
  it('gives known keys friendly labels, yes/no for switches, and sums up notes for pack makers in one line', () => {
    expect(
      aboutFile({
        built: '2026-10-22',
        author: 'Priya',
        private: true,
        openContent: 'The warden class is open content.',
        proposedExtensions: ['items[].charm', 'classes[].lamps'],
        gameSystem: 'River Rules',
      }),
    ).toEqual([
      { label: 'Made by', text: 'Priya' },
      { label: 'Made on', text: '2026-10-22' },
      { label: 'Open content', text: 'The warden class is open content.' },
      { label: 'Private', text: 'Yes: keep it to your own table' },
      { label: 'Game system', text: 'River Rules' },
      { label: 'For pack makers', text: expect.stringContaining('2 notes for whoever builds packs') },
    ]);
  });

  it("never shows raw structures: a nested value counts as a note for pack makers", () => {
    expect(aboutFile({ tooling: { version: 3 } })).toEqual([{ label: 'For pack makers', text: expect.stringContaining('one note') }]);
    expect(aboutFile({})).toEqual([]);
  });
});
