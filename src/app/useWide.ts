import { useEffect, useState } from 'react';

// A landscape tablet or wider (docs/06-screens-and-design.md, Layouts). Follows the window, so rotating the
// iPad or using Split View switches layouts. Without matchMedia (the pretend browser in tests) it's narrow.
const WIDE = '(min-width: 1024px)';

export function useWide(): boolean {
  return useMedia(WIDE);
}

/**
 * Creation's two columns (final drafts A10, 2026-11-07): from 700 px the list and the open entry sit side by side
 * (Race and Class, Spells, Languages, Weapon skills); under it the entry is a sheet. Matches `creation.css`.
 */
export const CREATION_SPLIT = '(min-width: 700px)';

export function useCreationSplit(): boolean {
  return useMedia(CREATION_SPLIT);
}

/** A phone's width: under 600 px (docs/06, Layouts). Narrow-but-not-phone without matchMedia, as in tests. */
export const PHONE = '(max-width: 599px)';

export function usePhone(): boolean {
  return useMedia(PHONE);
}

/** Whether the window matches a media query (narrow when there's no matchMedia, as in tests). */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const found = window.matchMedia(query);
    const update = () => setOn(found.matches);
    found.addEventListener('change', update);
    return () => found.removeEventListener('change', update);
  }, [query]);
  return on;
}
