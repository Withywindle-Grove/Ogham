// @vitest-environment jsdom
// The gallery's creation pictures in the book's type (dec-10 S2, the round on #728). Purpose: every creation specimen
// is drawn inside creation's book-type scope, as a player sees it, so its pictures show the book's faces; the few
// specimens of things outside creation (a New campaign step, the sheet's Patron section and identity line, the GM's
// approval card) stay outside it.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Gallery } from './Gallery.tsx';

afterEach(cleanup);

const CREATION = ['creation-shell', 'creation-review', 'creation-who', 'creation-gear', 'creation-final', 'creation-final-d', 'creation-long-tables', 'creation-trait-list', 'patron', 'same-name-source'];
/** Specimens of things outside creation, by the start of their caption. */
const OUTSIDE = ['Creation step shell outside creation (New campaign)', 'Full sheet, the Patron section', "The sheet's identity line", "The soft patron's reason on the GM's approval card"];

describe('the gallery draws creation in the book type', () => {
  it('every creation specimen sits in the book-type scope, and only those', () => {
    render(<Gallery />);
    const wrong: string[] = [];
    for (const id of CREATION) {
      const section = document.getElementById(id);
      expect(section, id).not.toBeNull();
      for (const figure of section!.querySelectorAll('.gallery__specimen')) {
        const caption = figure.querySelector('.gallery__caption')?.textContent ?? '';
        const stage = figure.querySelector('.gallery__stage')!;
        const inside = !!stage.closest('.book-type') || !!stage.firstElementChild?.classList.contains('book-type');
        const outside = OUTSIDE.some((start) => caption.startsWith(start));
        if (inside === outside) wrong.push(`${id}: ${outside ? 'should stay out' : 'not in the book type'}: ${caption.slice(0, 70)}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
