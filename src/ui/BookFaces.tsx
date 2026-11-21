// The book's faces alone (po-3, the lead 2026-11-14): what it holds, and the pop-ups opened from it, are drawn in
// Bitter with Alegreya Sans SC for small capitals (`.book-faces`, bookFaces.css). It changes faces only, never a part's
// behaviour: that is the difference from creation's `BookType`. It adds no box of its own.
import type { ReactNode } from 'react';
import { BookFacesScope } from './Dialog.tsx';
import './bookFaces.css';

export function BookFaces({ children }: { children: ReactNode }) {
  return (
    <BookFacesScope.Provider value>
      <div className="book-faces book-faces--host">{children}</div>
    </BookFacesScope.Provider>
  );
}
