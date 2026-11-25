// The divider is the handle (ruled 2026-11-02, lr-4; mockup design/mockups/library/02-menu-fold.html, option A): on a
// landscape tablet the line between the menu column and the page folds the column to its icons and back. A grip
// (24 × 44, the Surface fill with the Control edge, the arrow inside in Ink; plan dec-14 row 1) sits on the line at
// mid-height; the whole line is a 44 px-wide tap zone. A tap
// folds or unfolds; a sideways drag past half does the same, and a drag short of half changes nothing (nothing in
// between is kept). No words on screen: the names "Fold the menu" / "Show the menu" are for assistive tech. The
// owner places it inside its column (a positioned element) and remembers the fold per device (`useNavCollapsed`).
// It shows only where the column does (the CSS hides it under 1024 px).
import { useRef, type PointerEvent } from 'react';
import './DividerHandle.css';

/** The triangles, each with the text-presentation selector (U+FE0E): iOS would otherwise draw them as colour emoji. */
const ARROW_LEFT = '\u25C0\uFE0E';
const ARROW_RIGHT = '\u25B6\uFE0E';

/** How far a press may wander and still count as a tap, in CSS pixels. */
const TAP_SLOP = 8;

// The open column's width, kept from the last time it was measured on this page, so a drag on the folded column
// knows how far "half" is. Before any measure (the page opened folded) the column is taken to grow by twice its
// folded width.
let lastOpenWidth: number | null = null;

/**
 * What a sideways drag of `dx` pixels does to the fold: `true` to fold, `false` to unfold, `null` for nothing.
 * Folding needs a drag left past half the open column's width; unfolding a drag right past half the distance the
 * column grows by (from its folded width to its open width). Exported for the tests.
 */
export function dragOutcome(collapsed: boolean, dx: number, columnWidth: number, openWidth: number | null): boolean | null {
  if (!collapsed) return dx < -columnWidth / 2 ? true : null;
  const grows = Math.max((openWidth ?? columnWidth * 3) - columnWidth, columnWidth);
  return dx > grows / 2 ? false : null;
}

export function DividerHandle({ collapsed, onToggle }: { collapsed: boolean; onToggle: (collapsed: boolean) => void }) {
  const press = useRef<{ x: number; width: number; moved: boolean } | null>(null);
  // A drag ends with a click on the same button; this swallows it so a drag short of half changes nothing.
  const swallowClick = useRef(false);

  const columnWidth = (button: HTMLElement) => button.parentElement?.getBoundingClientRect().width ?? 0;

  const down = (event: PointerEvent<HTMLButtonElement>) => {
    const width = columnWidth(event.currentTarget);
    if (!collapsed && width > 0) lastOpenWidth = width;
    press.current = { x: event.clientX, width, moved: false };
    swallowClick.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers (and test DOMs) have no pointer capture; the drag then ends where the pointer is let go.
    }
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (press.current && Math.abs(event.clientX - press.current.x) > TAP_SLOP) press.current.moved = true;
  };
  const up = (event: PointerEvent<HTMLButtonElement>) => {
    const started = press.current;
    press.current = null;
    if (!started?.moved) return;
    swallowClick.current = true;
    const outcome = dragOutcome(collapsed, event.clientX - started.x, started.width, lastOpenWidth);
    if (outcome !== null) onToggle(outcome);
  };

  return (
    <button
      type="button"
      className="divider-handle"
      aria-label={collapsed ? 'Show the menu' : 'Fold the menu'}
      aria-expanded={!collapsed}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        press.current = null;
      }}
      onClick={() => {
        if (swallowClick.current) {
          swallowClick.current = false;
          return;
        }
        onToggle(!collapsed);
      }}
    >
      {/* The grip (plan dec-14 row 1, frame 38-1), with a triangle inside it pointing the way it folds (P32,
          2026-11-06): ◀ while open, ▶ once folded. A shape, never colour alone; the button's name says it in words.
          Each triangle carries U+FE0E so iOS draws it as text in Ink, never as a colour emoji (approval fix, 25 Nov). */}
      <span className="divider-handle__pill" aria-hidden="true">
        <span className={`divider-handle__arrow divider-handle__arrow--${collapsed ? 'right' : 'left'}`}>
          {collapsed ? ARROW_RIGHT : ARROW_LEFT}
        </span>
      </span>
    </button>
  );
}
