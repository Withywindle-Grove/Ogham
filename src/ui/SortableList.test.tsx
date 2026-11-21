// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moved, SortableList } from './SortableList.tsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.useFakeTimers();
});

const rows = [
  { key: 'hp', label: 'Hit points' },
  { key: 'at-hand', label: 'At hand' },
  { key: 'party', label: 'The party' },
];

const laidOut = () => {
  const items = screen.getAllByRole('listitem');
  items.forEach((item, index) => {
    item.getBoundingClientRect = () => ({ top: index * 50, bottom: index * 50 + 50, height: 50, left: 0, right: 300, width: 300, x: 0, y: index * 50, toJSON: () => ({}) });
  });
  return items;
};

// Ruled 2026-10-25: no drag handles anywhere; hold a row (about half a second) to drag it, tap it to open it.
describe('reordering by holding a row', () => {
  it('moves an item from one place to another', () => {
    expect(moved(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moved(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moved(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('nothing shows as a handle; each row still has an adjustable control screen readers and keyboards move', () => {
    const onMove = vi.fn();
    render(<SortableList items={rows} label="Player screen sections" onMove={onMove} render={(row) => <span>{row.label}</span>} />);
    const control = screen.getByRole('slider', { name: 'Move At hand' });
    expect(control.className).toContain('visually-hidden');
    expect(control.getAttribute('aria-valuetext')).toBe('Position 2 of 3');
    fireEvent.keyDown(control, { key: 'ArrowUp' });
    expect(onMove).toHaveBeenLastCalledWith(1, 0);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Move Hit points' }), { key: 'ArrowUp' });
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('holding a row half a second lifts it; dragging it over another row drops it there, and the click after is eaten', () => {
    const onMove = vi.fn();
    const onTap = vi.fn();
    render(<SortableList items={rows} label="Player screen sections" onMove={onMove} render={(row) => <button onClick={onTap}>{row.label}</button>} />);
    const items = laidOut();
    fireEvent.pointerDown(items[0]!, { clientX: 10, clientY: 10, pointerId: 1 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerMove(items[0]!, { clientX: 10, clientY: 70, pointerId: 1 });
    const now = screen.getAllByRole('listitem');
    expect(now[0]!.style.transform).toBe('translateY(60px)');
    expect(now[1]!.style.transform).toBe('translateY(-50px)');
    fireEvent.pointerMove(items[0]!, { clientX: 10, clientY: 130, pointerId: 1 });
    fireEvent.pointerUp(items[0]!, { clientX: 10, clientY: 130, pointerId: 1 });
    expect(onMove).toHaveBeenCalledWith(0, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Hit points' }));
    expect(onTap).not.toHaveBeenCalled();
  });

  it('a quick tap reaches the row; moving before the hold is up scrolls instead of dragging', () => {
    const onMove = vi.fn();
    const onTap = vi.fn();
    render(<SortableList items={rows} label="Player screen sections" onMove={onMove} render={(row) => <button onClick={onTap}>{row.label}</button>} />);
    const items = laidOut();
    fireEvent.pointerDown(items[1]!, { clientX: 10, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(items[1]!, { clientX: 10, clientY: 60, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'At hand' }));
    expect(onTap).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(items[0]!, { clientX: 10, clientY: 10, pointerId: 2 });
    fireEvent.pointerMove(items[0]!, { clientX: 10, clientY: 40, pointerId: 2 });
    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerMove(items[0]!, { clientX: 10, clientY: 130, pointerId: 2 });
    fireEvent.pointerUp(items[0]!, { clientX: 10, clientY: 130, pointerId: 2 });
    expect(onMove).not.toHaveBeenCalled();
  });
});

// fix-pack-order-drag: with `tallRows` (the setting rules' packs only), a tall row dragged over a short one lands beyond
// it once its leading edge is past that row's middle; the props go in by a spread so this test is the same before
// and after the fix.
it('with tallRows, a tall row dragged down lands beyond a short row once its leading edge is past that row’s middle', () => {
  const onMove = vi.fn();
  const tallRows = { tallRows: true } as object;
  render(<SortableList items={rows} label="Setting rules, top first" onMove={onMove} render={(row) => <span>{row.label}</span>} {...tallRows} />);
  // A tall row (0 to 300), then two short ones (300 to 350, 350 to 400).
  const sizes = [[0, 300], [300, 50], [350, 50]] as const;
  const items = screen.getAllByRole('listitem');
  items.forEach((item, index) => {
    const [top, height] = sizes[index]!;
    item.getBoundingClientRect = () => ({ top, bottom: top + height, height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) });
  });
  // Held near its foot (y 290); its foot reaches 340, past the short row's middle (325).
  fireEvent.pointerDown(items[0]!, { clientX: 10, clientY: 290, pointerId: 1 });
  act(() => vi.advanceTimersByTime(500));
  fireEvent.pointerMove(items[0]!, { clientX: 10, clientY: 310, pointerId: 1 });
  fireEvent.pointerMove(items[0]!, { clientX: 10, clientY: 330, pointerId: 1 });
  fireEvent.pointerUp(items[0]!, { clientX: 10, clientY: 330, pointerId: 1 });
  expect(onMove).toHaveBeenCalledWith(0, 1);
});

// fix-pack-order-drag (4): once lifted, the row keeps the finger's movement for itself on a touch screen.
it('the lifted row has touch-action none, and only once lifted', () => {
  render(<SortableList items={rows} label="Player screen sections" onMove={vi.fn()} render={(row) => <span>{row.label}</span>} />);
  const items = laidOut();
  expect(items[0]!.style.touchAction).toBe('');
  fireEvent.pointerDown(items[0]!, { clientX: 10, clientY: 10, pointerId: 1 });
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getAllByRole('listitem')[0]!.style.touchAction).toBe('none');
});

// The landing box variant (the Player tab's pinned abilities and traits; page 28, frame M4e, approved 2026-11-20).
describe('the landing box variant', () => {
  // Rows 50 px tall, 8 px apart, as the pinned boxes sit.
  const spaced = () =>
    screen.getAllByRole('listitem').forEach((item, index) => {
      item.getBoundingClientRect = () => ({ top: index * 58, bottom: index * 58 + 50, height: 50, left: 0, right: 300, width: 300, x: 0, y: index * 58, toJSON: () => ({}) });
    });

  // Purpose: while a row is lifted a dashed box shows where it will land, the others making room by the row and the gap;
  // it goes when the row is dropped, and a list without the variant draws none.
  it('shows a dashed box where the lifted row will land, and moves the others by the row and the gap', () => {
    const onMove = vi.fn();
    const { container } = render(<SortableList items={rows} label="Pinned abilities and traits" onMove={onMove} render={(row) => <span>{row.label}</span>} landingBox />);
    spaced();
    const items = screen.getAllByRole('listitem');
    expect(container.querySelector('.sortable__landing')).toBeNull();
    fireEvent.pointerDown(items[0]!, { clientX: 10, clientY: 10, pointerId: 1 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerMove(items[0]!, { clientX: 10, clientY: 75, pointerId: 1 });
    const box = container.querySelector('.sortable__landing') as HTMLElement;
    expect(box).not.toBeNull();
    expect(box.getAttribute('aria-hidden')).toBe('true');
    expect([box.style.top, box.style.height]).toEqual(['58px', '50px']);
    expect(screen.getAllByRole('listitem')[1]!.style.transform).toBe('translateY(-58px)');
    fireEvent.pointerUp(items[0]!, { clientX: 10, clientY: 75, pointerId: 1 });
    expect(onMove).toHaveBeenLastCalledWith(0, 1);
    expect(container.querySelector('.sortable__landing')).toBeNull();
  });

  it('draws no landing box without the variant', () => {
    const { container } = render(<SortableList items={rows} label="Player screen sections" onMove={vi.fn()} render={(row) => <span>{row.label}</span>} />);
    spaced();
    const items = screen.getAllByRole('listitem');
    fireEvent.pointerDown(items[0]!, { clientX: 10, clientY: 10, pointerId: 1 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerMove(items[0]!, { clientX: 10, clientY: 75, pointerId: 1 });
    expect(container.querySelector('.sortable__landing')).toBeNull();
    expect(screen.getAllByRole('listitem')[1]!.style.transform).toBe('translateY(-50px)');
  });
});
