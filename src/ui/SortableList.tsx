// A reorderable list with no drag handles (ruled 2026-10-25, replacing the handle on the right): hold a row about
// half a second to lift it, then drag; the row follows the finger and the others make room. A quick tap still
// reaches what's in the row, and moving before the hold lets the page scroll. Each row also has an invisible
// adjustable control (role "slider") that screen readers move with their own up and down gestures (VoiceOver:
// swipe up or down) and keyboards with the arrow keys. Used by Arrange this screen, the Setting rules order and
// the character fields.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';

// How long a hold lifts a row (ms), and how far a finger may wander before the hold becomes a scroll (px).
const HOLD = 500;
const WANDER = 8;
/** Controls a long press belongs to (never a move of the row). */
const CONTROLS = 'input, textarea, select, button, [contenteditable]:not([contenteditable="false"])';
import './SortableList.css';

/** The list with the item at `from` moved to `to`. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export function SortableList<T extends { key: string; label: string }>({
  items,
  label,
  onMove,
  render,
  blocked = false,
  onBlocked,
  tallRows = false,
}: {
  items: T[];
  /** What the list is, for screen readers ("Player screen sections"). */
  label: string;
  onMove: (from: number, to: number) => void;
  render: (item: T, index: number) => ReactNode;
  /** Moves can't happen now (never a disabled control, 06): a hold or an arrow key calls `onBlocked`, which says why. */
  blocked?: boolean;
  onBlocked?: () => void;
  /**
   * The tall-rows variant (the setting rules' packs; fix-pack-order-drag, the lead's ruling (b)): a row taller than the
   * one it passes lands beyond it once its leading edge is past that row's middle, so a tall row needn't travel its
   * own height. Without it, the dragged row's middle must pass the other row's middle.
   */
  tallRows?: boolean;
}) {
  const list = useRef<HTMLUListElement>(null);
  // The row being dragged, where it would land, how far the finger has moved, and the rows' places when it began.
  const [dragging, setDragging] = useState<{ from: number; over: number; by: number; height: number } | null>(null);
  const start = useRef<{ y: number; middles: number[]; heights: number[] } | null>(null);
  // A hold in progress: where it began and its timer; and whether the last pointer-up ended a drag (its click is eaten).
  const holding = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout>; index: number } | null>(null);
  const dragged = useRef(false);
  // Once a row is lifted, a finger's movement drags it instead of scrolling the page (touch screens).
  const lifted = dragging !== null;
  useEffect(() => {
    if (!lifted) return;
    const stay = (event: TouchEvent) => event.preventDefault();
    document.addEventListener('touchmove', stay, { passive: false });
    return () => document.removeEventListener('touchmove', stay);
  }, [lifted]);

  const rowsNow = () => [...(list.current?.querySelectorAll(':scope > li') ?? [])].map((row) => row.getBoundingClientRect());

  // Where the dragged row would land: the first row whose middle is below the dragged row's middle.
  const landing = (from: number, by: number): number => {
    const middles = start.current?.middles ?? [];
    const middle = (middles[from] ?? 0) + by;
    const below = middles.findIndex((m, i) => i !== from && m > middle);
    const index = below === -1 ? middles.length - 1 : below > from ? below - 1 : below;
    const plain = Math.max(0, Math.min(middles.length - 1, index));
    if (!tallRows) return plain;
    // The tall-rows variant: beyond that, a row taller than the next one passes it once its leading edge is past the
    // next row's middle (going down, its foot; going up, its top).
    const heights = start.current?.heights ?? [];
    const own = heights[from] ?? 0;
    let to = plain;
    if (to >= from) {
      while (to + 1 < middles.length && own > heights[to + 1]! && middle + own / 2 > middles[to + 1]!) to += 1;
    }
    if (to <= from) {
      while (to - 1 >= 0 && own > heights[to - 1]! && middle - own / 2 < middles[to - 1]!) to -= 1;
    }
    return to;
  };

  function key(event: KeyboardEvent, index: number) {
    const to = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? index - 1 : event.key === 'ArrowDown' || event.key === 'ArrowRight' ? index + 1 : null;
    if (to === null) return;
    event.preventDefault();
    if (blocked) return onBlocked?.();
    if (to >= 0 && to < items.length) onMove(index, to);
  }

  function lift(target: Element, pointerId: number, index: number, y: number) {
    (target as HTMLElement).setPointerCapture?.(pointerId);
    const rects = rowsNow();
    start.current = { y, middles: rects.map((r) => r.top + r.height / 2), heights: rects.map((r) => r.height) };
    setDragging({ from: index, over: index, by: 0, height: rects[index]?.height ?? 0 });
  }

  function down(event: PointerEvent, index: number) {
    if (event.button > 0) return;
    // While blocked, a long press on a control inside the row (an open editor's field, Save, Cancel) is that
    // control's, not an attempt to move the row: no "can't move" (review, #561).
    if (blocked && event.target instanceof Element && event.target.closest(CONTROLS)) return;
    const target = event.currentTarget;
    const { pointerId, clientX, clientY } = event;
    dragged.current = false;
    if (holding.current) clearTimeout(holding.current.timer);
    holding.current = { x: clientX, y: clientY, index, timer: setTimeout(() => (blocked ? onBlocked?.() : lift(target, pointerId, index, clientY)), HOLD) };
  }

  function cancelHold() {
    if (holding.current) clearTimeout(holding.current.timer);
    holding.current = null;
  }

  function move(event: PointerEvent) {
    if (!dragging || !start.current) {
      // Moving before the hold is up is a scroll, not a drag.
      const hold = holding.current;
      if (hold && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > WANDER) cancelHold();
      return;
    }
    const by = event.clientY - start.current.y;
    setDragging({ ...dragging, by, over: landing(dragging.from, by) });
  }

  function up(event: PointerEvent) {
    cancelHold();
    if (!dragging || !start.current) return;
    const to = landing(dragging.from, event.clientY - start.current.y);
    start.current = null;
    setDragging(null);
    dragged.current = true;
    if (to !== dragging.from) onMove(dragging.from, to);
  }

  // The click that follows a drag isn't a tap on what's in the row.
  function eatClick(event: MouseEvent) {
    if (!dragged.current) return;
    dragged.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  // The dragged row follows the finger; the rows it passes slide by one row's height to make room.
  const placeOf = (index: number): CSSProperties | undefined => {
    if (!dragging) return undefined;
    const { from, over, by, height } = dragging;
    // The lifted row keeps the finger's movement for itself (touch screens: no pan or scroll takes it over).
    if (index === from) return { transform: `translateY(${by}px)`, touchAction: 'none' };
    if (from < over && index > from && index <= over) return { transform: `translateY(${-height}px)` };
    if (from > over && index >= over && index < from) return { transform: `translateY(${height}px)` };
    return undefined;
  };

  return (
    <ul ref={list} className="sortable" aria-label={label}>
      {items.map((item, index) => (
        <li
          key={item.key}
          className={dragging?.from === index ? 'sortable__row sortable__row--lifted' : dragging ? 'sortable__row sortable__row--moving' : 'sortable__row'}
          style={placeOf(index)}
          onPointerDown={(event) => down(event, index)}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            cancelHold();
            start.current = null;
            setDragging(null);
          }}
          onClickCapture={eatClick}
          onContextMenu={(event) => holding.current && event.preventDefault()}
        >
          <div className="sortable__content">{render(item, index)}</div>
          <span
            role="slider"
            tabIndex={0}
            aria-label={`Move ${item.label}`}
            aria-orientation="vertical"
            aria-valuemin={1}
            aria-valuemax={items.length}
            aria-valuenow={index + 1}
            aria-valuetext={`Position ${index + 1} of ${items.length}`}
            className="sortable__handle visually-hidden"
            onKeyDown={(event) => key(event, index)}
          >
            Move
          </span>
        </li>
      ))}
    </ul>
  );
}
