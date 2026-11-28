import { useEffect, useState } from 'react';

/** Where a scrolling column has something cut from view: above (it is scrolled) and below (more lies beyond). */
export type CutEdges = { above: boolean; below: boolean };
const NOTHING_CUT: CutEdges = { above: false, below: false };

/**
 * A scrolling column's cut edges (plan dec-14 row 5, frame 38-5): measured again as it scrolls, as it or any of its
 * parts changes size (the text size, a picture loading), and as its parts change (the first open, a row added), once a
 * frame at most. A column that doesn't scroll has none.
 */
export function useCutEdges(column: HTMLElement | null): CutEdges {
  const [cut, setCut] = useState<CutEdges>(NOTHING_CUT);
  useEffect(() => {
    if (!column) return;
    // Cleared by the cleanup, so a late measure (the fonts' promise) sets nothing once the column has gone.
    let live = true;
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!live) return;
      // A pixel's leeway each way: a zoomed screen scrolls by fractions of one.
      const above = column.scrollTop > 1;
      const below = column.scrollHeight - column.clientHeight - column.scrollTop > 1;
      setCut((was) => (was.above === above && was.below === below ? was : { above, below }));
    };
    const soon = () => {
      if (live && !frame) frame = requestAnimationFrame(measure);
    };
    // Not in every runner (the unit tests' page has none); the scroll and the changed parts still measure it.
    const resized = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(soon) : null;
    // The column and each of its parts: a part can grow with nothing in it changing, and the column's own box not. A
    // wrapper with no box of its own (`display: contents`, as the Player tab's opened parts) is looked through.
    const watch = (parent: Element) => {
      for (const part of parent.children) {
        if (getComputedStyle(part).display === 'contents') watch(part);
        else resized?.observe(part);
      }
    };
    const watchParts = () => {
      if (!resized) return;
      resized.disconnect();
      resized.observe(column);
      watch(column);
    };
    watchParts();
    soon();
    column.addEventListener('scroll', soon, { passive: true });
    const changed = new MutationObserver(() => {
      watchParts();
      soon();
    });
    changed.observe(column, { childList: true, subtree: true, characterData: true, attributes: true });
    void document.fonts?.ready.then(soon);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      column.removeEventListener('scroll', soon);
      resized?.disconnect();
      changed.disconnect();
    };
  }, [column]);
  return column ? cut : NOTHING_CUT;
}
