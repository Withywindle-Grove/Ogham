// @vitest-environment jsdom
// The map card and the map pop-up (plan dec-7 piece 5a; mc-32, mc-43, mc-43a, mc-44, mc-44a; mockup december/01): pure
// parts on an invented picture address. jsdom measures nothing, so the frame's and the picture's sizes are given here:
// a 1,200 by 800 picture in a 400 by 300 frame (fitted, one third: 33%).
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { firstTwoWords, MapCard, MapPopup, type MapSource } from './MapParts.tsx';

// Purpose (#851, the lead): beside the tools a map's title is never cut shorter than its first two words; this is the
// shortest cut it may show, measured against the room the row has.
describe("a map title's shortest cut", () => {
  it('is its first two words and the ellipsis; a title of two words or fewer is whole', () => {
    expect(firstTwoWords('The Drowned Harbour, the harbour chart')).toBe('The Drowned…');
    expect(firstTwoWords('  Saltwick   Breakwater at dusk ')).toBe('Saltwick Breakwater…');
    expect(firstTwoWords('The jetty')).toBe('The jetty');
    expect(firstTwoWords('Fenwick')).toBe('Fenwick');
  });
});

const HARBOUR: MapSource = { src: '/invented-harbour.svg', alt: 'The Drowned Harbour, its map' };

const restore: (() => void)[] = [];
function fake<T extends object>(proto: T, key: string, get: (this: HTMLElement) => number) {
  const before = Object.getOwnPropertyDescriptor(proto, key);
  Object.defineProperty(proto, key, { configurable: true, get });
  restore.push(() => (before ? Object.defineProperty(proto, key, before) : delete (proto as Record<string, unknown>)[key]));
}
beforeAll(() => {
  fake(HTMLElement.prototype, 'clientWidth', function () {
    return this.classList.contains('map-picture') ? 400 : 0;
  });
  fake(HTMLElement.prototype, 'clientHeight', function () {
    return this.classList.contains('map-picture') ? 300 : 0;
  });
  fake(HTMLImageElement.prototype, 'naturalWidth', () => 1200);
  fake(HTMLImageElement.prototype, 'naturalHeight', () => 800);
});
afterAll(() => restore.forEach((undo) => undo()));
afterEach(cleanup);

/** The picture has come. */
function loaded(container: HTMLElement | Document = document) {
  const img = container.querySelector('img.map-picture__img');
  if (!img) throw new Error('no picture');
  act(() => {
    fireEvent.load(img);
  });
  return img as HTMLImageElement;
}

const percent = () => document.querySelector('.map-popup__percent')?.textContent;
const fit = () => screen.getByRole('button', { name: 'Fit' });

describe('the map card (mc-44, mc-44a)', () => {
  // Purpose: the card is the picture alone (no heading, no caption); under it the title at the left, then zoom out,
  // zoom in and the caller's tool (the GM's eye), in that order.
  it('shows the picture alone, then the title and the tools in one row', () => {
    render(<MapCard source={HARBOUR} title="The Drowned Harbour" tools={<button type="button">Eye</button>} onOpen={() => undefined} />);
    loaded();
    const card = screen.getByRole('region', { name: 'The map' });
    expect(within(card).queryByRole('heading')).toBeNull();
    const row = card.querySelector('.map-tools')!;
    expect(row.querySelector('.map-tools__title')?.textContent).toBe('The Drowned Harbour');
    expect([...row.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Zoom out', 'Zoom in', 'Eye']);
  });

  // Purpose: without a title the row holds the tools alone (where the title would repeat the heading, dp-8).
  it('leaves the title out when none is given', () => {
    render(<MapCard source={HARBOUR} onOpen={() => undefined} />);
    loaded();
    expect(document.querySelector('.map-tools__title')).toBeNull();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
  });

  // Purpose: a tap (a click) on the picture opens the map whole, and so does Enter on it: there is no button for that.
  it('opens the map whole on a tap or Enter', async () => {
    const onOpen = vi.fn();
    render(<MapCard source={HARBOUR} onOpen={onOpen} />);
    loaded();
    const picture = screen.getByRole('button', { name: 'The Drowned Harbour, its map: show the map whole' });
    await userEvent.click(picture);
    expect(onOpen).toHaveBeenCalledTimes(1);
    picture.focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  // Purpose: a touch that travels further than about 10 px is a drag: it moves the picture and does not open it (dp-1).
  it('moves the picture on a drag and does not open it', () => {
    const onOpen = vi.fn();
    render(<MapCard source={HARBOUR} onOpen={onOpen} />);
    const img = loaded();
    const picture = screen.getByRole('button', { name: /show the map whole/ });
    // Zoomed in first, so there is room to move.
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const before = img.style.transform;
    fireEvent.pointerDown(picture, { pointerId: 1, clientX: 200, clientY: 150, button: 0 });
    fireEvent.pointerMove(picture, { pointerId: 1, clientX: 240, clientY: 150 });
    fireEvent.pointerUp(picture, { pointerId: 1, clientX: 240, clientY: 150 });
    fireEvent.click(picture);
    expect(onOpen).not.toHaveBeenCalled();
    expect(img.style.transform).not.toBe(before);
  });

  // Purpose: the pressed look shows while a finger is down, and ends the moment the touch starts to travel (14c).
  it('looks pressed under the finger until the touch travels', () => {
    render(<MapCard source={HARBOUR} onOpen={() => undefined} />);
    loaded();
    const picture = screen.getByRole('button', { name: /show the map whole/ });
    fireEvent.pointerDown(picture, { pointerId: 1, clientX: 200, clientY: 150, button: 0 });
    expect(picture.hasAttribute('data-pressed')).toBe(true);
    fireEvent.pointerMove(picture, { pointerId: 1, clientX: 230, clientY: 150 });
    expect(picture.hasAttribute('data-pressed')).toBe(false);
  });

  // Purpose: while the picture is on its way, and when it fails, there are no tools under the card (dp-3), and a failed
  // picture says so plainly with Try again, which asks the caller again.
  it('shows no tools while loading or failed, and Try again on a failure', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<MapCard source={{ ...HARBOUR, src: null }} onOpen={() => undefined} onRetry={onRetry} />);
    expect(screen.getByText('The picture is on its way.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
    rerender(<MapCard source={{ ...HARBOUR, src: null, failed: true }} onOpen={() => undefined} onRetry={onRetry} />);
    expect(screen.getByText('The map’s picture couldn’t load.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // Purpose: a picture whose address fails to load shows the failed frame, not a broken picture.
  it('shows the failed frame when the picture itself fails', () => {
    render(<MapCard source={HARBOUR} onOpen={() => undefined} />);
    act(() => {
      fireEvent.error(document.querySelector('img.map-picture__img')!);
    });
    expect(screen.getByText('The map’s picture couldn’t load.')).toBeTruthy();
    expect(document.querySelector('img.map-picture__img')).toBeNull();
  });
});

describe('the map pop-up (mc-43, mc-43a)', () => {
  // Purpose: the pop-up names the place over "The map", opens fitted (Fit marked as the current view), and shows the
  // figure to the left of the two magnifiers, then Fit; the ✕ is its only way to close (no Close button).
  it('opens fitted, the figure left of the magnifiers, and only the ✕ to close', () => {
    render(<MapPopup source={HARBOUR} place="The Drowned Harbour" onClose={() => undefined} />);
    loaded();
    const dialog = screen.getByRole('dialog', { name: 'The Drowned Harbour: The map' });
    expect(within(dialog).getByText('The Drowned Harbour')).toBeTruthy();
    expect(percent()).toBe('33%');
    expect(fit().getAttribute('aria-pressed')).toBe('true');
    const zoom = within(dialog).getByRole('group', { name: 'Zoom' });
    expect([...zoom.children].map((el) => el.getAttribute('aria-label') ?? el.textContent)).toEqual(['33%', 'Zoom out', 'Zoom in', 'Fit']);
    expect(within(dialog).getAllByRole('button', { name: /close/i })).toHaveLength(1);
  });

  // Purpose: nothing is drawn over the picture (mc-32): the frame holds the picture and nothing else.
  it('draws nothing over the picture', () => {
    render(<MapPopup source={HARBOUR} place="The Drowned Harbour" onClose={() => undefined} />);
    loaded();
    const frame = document.querySelector('.map-popup__body .map-picture')!;
    expect([...frame.children].map((el) => el.tagName)).toEqual(['IMG']);
    expect(screen.getByRole('img', { name: 'The Drowned Harbour, its map' })).toBeTruthy();
  });

  // Purpose: zoom in makes the picture larger and lifts the Fit mark; Fit brings back the whole picture and the mark.
  it('zooms in with the magnifier and back with Fit', async () => {
    render(<MapPopup source={HARBOUR} place="The Drowned Harbour" onClose={() => undefined} />);
    loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(percent()).toBe('50%');
    expect(fit().getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(fit());
    expect(percent()).toBe('33%');
    expect(fit().getAttribute('aria-pressed')).toBe('true');
  });

  // Purpose: zoomed out as far as it goes, the map is fitted again and Fit is marked (never smaller than whole).
  it('stops at the whole picture when zoomed out', async () => {
    render(<MapPopup source={HARBOUR} place="The Drowned Harbour" onClose={() => undefined} />);
    loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(percent()).toBe('33%');
    expect(fit().getAttribute('aria-pressed')).toBe('true');
  });

  // Purpose: on a PC, + zooms in, − zooms out, an arrow moves the picture, and 0 is Fit (M5).
  it('answers the keys', () => {
    render(<MapPopup source={HARBOUR} place="The Drowned Harbour" onClose={() => undefined} />);
    const img = loaded();
    fireEvent.keyDown(window, { key: '+' });
    fireEvent.keyDown(window, { key: '+' });
    expect(percent()).toBe('75%');
    const before = img.style.transform;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(img.style.transform).not.toBe(before);
    fireEvent.keyDown(window, { key: '-' });
    expect(percent()).toBe('50%');
    fireEvent.keyDown(window, { key: '0' });
    expect(percent()).toBe('33%');
  });

  // Purpose: the wheel zooms about the pointer (M5).
  it('zooms with the mouse wheel', () => {
    render(<MapPopup source={HARBOUR} place="The Drowned Harbour" onClose={() => undefined} />);
    loaded();
    fireEvent.wheel(document.querySelector('.map-popup__body .map-picture')!, { deltaY: -400, clientX: 100, clientY: 100 });
    expect(percent()).not.toBe('33%');
  });

  // Purpose: the eye goes beside the ✕ in the head, where the caller puts it.
  it('puts the caller’s head tool beside the ✕', () => {
    render(<MapPopup source={HARBOUR} place="The Drowned Harbour" headTools={<button type="button">Eye</button>} onClose={() => undefined} />);
    const head = document.querySelector('.dialog__head')!;
    expect([...head.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Eye', 'Close']);
  });

  // Purpose: loading shows a still block and one line; a failed picture one plain sentence, Try again and the line
  // that the place still works; neither shows the zoom tools (frames 5 and 6).
  it('shows the loading and failed frames without tools', () => {
    const { rerender } = render(<MapPopup source={{ ...HARBOUR, src: null }} place="The Drowned Harbour" onClose={() => undefined} />);
    expect(screen.getByText('The picture is on its way.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Zoom' })).toBeNull();
    rerender(<MapPopup source={{ ...HARBOUR, src: null, failed: true }} place="The Drowned Harbour" onClose={() => undefined} />);
    expect(screen.getByText('The map’s picture couldn’t load.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.getByText('Everything else about the place still works: the locations are in the list.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Zoom' })).toBeNull();
  });

  // Purpose: Escape closes it, as every pop-up.
  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<MapPopup source={HARBOUR} place="The Drowned Harbour" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
