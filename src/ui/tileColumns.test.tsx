// @vitest-environment jsdom
// Gate finding F8, the flaky layout check (Row: fix-F8): a row of tiles measures its labels before paint, and must
// measure again once the fonts arrive, since they change every word's width. WebKit (Safari's engine, the layout
// check's browser) fires `loading` on document.fonts but never `loadingdone`; the new widths are in place when
// `document.fonts.ready` resolves. jsdom lays nothing out, so the widths here are stand-ins: a label's longest word is
// `word` wide, its tile the row's width divided by the row's `--tile-columns`. Invented names only.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScoreRow } from './parts.tsx';

const scores = ['Muscle', 'Quickness', 'Lantern-sight', 'Bogwise', 'Steadiness', 'Mirecraft'].map((name, i) => ({ key: `S${i}`, name, value: '10' }));

const ROW = 300;
let word = 60;
const saved: [object, string, PropertyDescriptor | undefined][] = [];

function stub(target: object, key: string, value: PropertyDescriptor) {
  saved.push([target, key, Object.getOwnPropertyDescriptor(target, key)]);
  Object.defineProperty(target, key, { configurable: true, ...value });
}

const columnsOf = (el: Element) => Number((el.closest('.score-row') as HTMLElement).style.getPropertyValue('--tile-columns'));

/** A stand-in for WebKit's document.fonts: `loading` events and a `ready` promise, never `loadingdone`. */
function webkitFonts(loading: boolean) {
  const listeners = new Map<string, Set<() => void>>();
  let settle = () => {};
  let ready = loading ? new Promise<void>((done) => (settle = done)) : Promise.resolve();
  const fonts = {
    get status() {
      return loading ? 'loading' : 'loaded';
    },
    get ready() {
      return ready;
    },
    addEventListener: (type: string, fn: () => void) => listeners.set(type, (listeners.get(type) ?? new Set()).add(fn)),
    removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
    /** A font starts loading: a new `ready`, then the `loading` event. */
    startLoading() {
      loading = true;
      ready = new Promise<void>((done) => (settle = done));
      listeners.get('loading')?.forEach((fn) => fn());
    },
    /** The font arrives: the words take their new width, then `ready` resolves (and no `loadingdone`). */
    arrive(width: number) {
      word = width;
      loading = false;
      settle();
    },
  };
  stub(document, 'fonts', { value: fonts });
  return fonts;
}

beforeEach(() => {
  word = 60;
  stub(HTMLElement.prototype, 'clientWidth', {
    get(this: HTMLElement) {
      if (this.classList.contains('score-row')) return ROW;
      if (this.classList.contains('stat-tile__label')) return Math.floor(ROW / columnsOf(this));
      return 0;
    },
  });
  stub(HTMLElement.prototype, 'scrollWidth', {
    get(this: HTMLElement) {
      return this.classList.contains('stat-tile__label') ? Math.max(word, Math.floor(ROW / columnsOf(this))) : 0;
    },
  });
});

afterEach(() => {
  cleanup();
  for (const [target, key, before] of saved.reverse()) {
    if (before) Object.defineProperty(target, key, before);
    else delete (target as Record<string, unknown>)[key];
  }
  saved.length = 0;
});

const tileColumns = (root: HTMLElement) => (root.querySelector('.score-row') as HTMLElement).style.getPropertyValue('--tile-columns');

describe('a row of tiles measures again once the fonts arrive, in WebKit too (F8)', () => {
  // Purpose: when the fonts are still loading as the row first measures, and they arrive wider without a `loadingdone`
  // event (as in WebKit), the row measures again once `document.fonts.ready` resolves and steps down to two columns
  // rather than run a word past its tile.
  it.fails('re-measures when fonts loading at mount arrive, with no loadingdone', async () => {
    const fonts = webkitFonts(true);
    const { container } = render(<ScoreRow scores={scores} onOpen={() => {}} />);
    expect(tileColumns(container)).toBe('3');
    await act(async () => fonts.arrive(120));
    expect(tileColumns(container)).toBe('2');
  });

  // Purpose: when a font starts loading after the row was measured with the fonts already loaded (a `loading` event),
  // and it arrives wider without a `loadingdone` event, the row measures again and steps down to two columns.
  it.fails('re-measures when a later font load finishes, with no loadingdone', async () => {
    const fonts = webkitFonts(false);
    const { container } = render(<ScoreRow scores={scores} onOpen={() => {}} />);
    await act(async () => {});
    expect(tileColumns(container)).toBe('3');
    await act(async () => fonts.startLoading());
    await act(async () => fonts.arrive(120));
    expect(tileColumns(container)).toBe('2');
  });
});
