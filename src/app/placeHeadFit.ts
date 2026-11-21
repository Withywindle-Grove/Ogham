// The place page's head (5b; the lead's ruling of 2026-11-14 on #841's follow-up): the rule's icon button and Move on
// sit beside the place's name only while the name's column keeps its floor (`--place-name-floor`, 13 rem at the
// device's text size), as page 11's frames 1a, 1b and 6 and page 16's T1, T2 and T6b draw them. Below that card width
// they go on a line of their own under the name and its line, at the right (page 16, T12 A, approved 2026-11-14,
// ap-16). Switched on the CARD's width, measured, not on the device's. A phone keeps its drawn bar (frame 4b, T8a).
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Whether the actions fit beside the name: the row holds the name's floor, the gap and the actions' own width. */
export function headFits(row: number, floor: number, gap: number, actions: number): boolean {
  return row >= floor + gap + actions;
}

/**
 * Measures the head's row (`row`, holding `.place-page__title-words` and, while beside, `.place-page__head-actions`)
 * and says whether the actions fit beside the name. The actions' width is the one last measured while they showed, so
 * the answer doesn't flip back and forth as they leave the row. Off (always fits) where `active` is false (a phone,
 * which has its bar anyway). `buttons` (how many rule buttons the head holds) measures again, before paint, when they
 * load, so the head never shows a frame in the wrong arrangement.
 */
export function useHeadFits(row: RefObject<HTMLElement | null>, active: boolean, buttons = 0): boolean {
  const [fits, setFits] = useState(true);
  const actionsWidth = useRef(0);
  const floorWidth = useRef(0);
  useLayoutEffect(() => {
    const el = row.current;
    if (!active || !el) return;
    let watched: HTMLElement | null = null;
    const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    const measure = () => {
      // Not laid out (hidden, or not yet in the page): nothing to measure.
      if (el.clientWidth === 0) return;
      const actions = el.querySelector<HTMLElement>('.place-page__head-actions');
      // The actions change width as their rule buttons load: watched too, not only the row.
      if (actions && actions !== watched && watch) {
        if (watched) watch.unobserve(watched);
        watch.observe(actions);
        watched = actions;
      }
      if (actions) actionsWidth.current = actions.getBoundingClientRect().width;
      const words = el.querySelector<HTMLElement>('.place-page__title-words');
      // The name's column asks for its floor as its flex basis while beside (GmPlacePage.css); under the name it has
      // none, so the floor last read stands.
      const basis = words ? parseFloat(getComputedStyle(words).flexBasis) : NaN;
      if (basis > 0) floorWidth.current = basis;
      const floor = floorWidth.current;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      setFits(headFits(el.clientWidth, floor, gap, actionsWidth.current));
    };
    measure();
    watch?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      watch?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [row, active, buttons]);
  return !active || fits;
}
