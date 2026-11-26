// @vitest-environment jsdom
// A11 (ruled 2026-10-25): messages are pop-ups, not boxes in the page. A screen's error shows as an error toast
// (announced at once), a confirmation as a plain one; neither leaves anything in the page itself.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorToast, NoticeToast, SAVED_DELAY_MS, ToastHost, useSavedToast } from './ToastHost.tsx';

afterEach(cleanup);

describe('message toasts', () => {
  it('an error shows as an alert toast above the page, and the page itself holds nothing', () => {
    render(
      <ToastHost>
        <main>
          <ErrorToast message="That name is taken." />
        </main>
      </ToastHost>,
    );
    const toast = screen.getByRole('alert');
    expect(toast.textContent).toBe('That name is taken.');
    expect(toast.closest('main')).toBeNull();
  });

  it('a confirmation shows as a polite toast; no message shows nothing', () => {
    const { rerender } = render(
      <ToastHost>
        <NoticeToast message={null} />
      </ToastHost>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    rerender(
      <ToastHost>
        <NoticeToast message="Moved Oath." />
      </ToastHost>,
    );
    expect(screen.getByRole('status').textContent).toBe('Moved Oath.');
  });
});

// Ruled 2026-10-26 (amends B23): settings screens say "Saved" once, about 1.5 seconds after the last change.
function Settings({ onReady }: { onReady: (saved: () => void) => void }) {
  onReady(useSavedToast());
  return null;
}

describe('the delayed Saved toast', () => {
  afterEach(() => vi.useRealTimers());

  it('a run of changes gets one "Saved", 1.5 seconds after the last one', () => {
    vi.useFakeTimers();
    let saved = () => undefined as void;
    render(
      <ToastHost>
        <Settings onReady={(s) => (saved = s)} />
      </ToastHost>,
    );
    act(() => saved());
    act(() => vi.advanceTimersByTime(SAVED_DELAY_MS - 500));
    act(() => saved());
    act(() => vi.advanceTimersByTime(SAVED_DELAY_MS - 1));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });

  it('leaving the screen before then still says "Saved"', () => {
    vi.useFakeTimers();
    let saved = () => undefined as void;
    const { rerender } = render(
      <ToastHost>
        <Settings onReady={(s) => (saved = s)} />
      </ToastHost>,
    );
    act(() => saved());
    rerender(<ToastHost>{null}</ToastHost>);
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });
});

describe('how long a toast lasts', () => {
  afterEach(() => vi.useRealTimers());

  // Purpose: a toast is app-wide 6 seconds (ruled mm-6, 2026-11-10): still there at 5.9, gone at 6.
  it('is still there at 5.9 seconds and gone at 6', () => {
    vi.useFakeTimers();
    render(
      <ToastHost>
        <NoticeToast message="Moved Oath." />
      </ToastHost>,
    );
    act(() => vi.advanceTimersByTime(5900));
    expect(screen.getByRole('status').textContent).toBe('Moved Oath.');
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// K22d (pick 10; page 33, K22i 3): over an open pop-up that asks for it, on a phone, the toast sits just above the
// sheet's top edge; elsewhere, and on a tablet, at the screen's foot as before.
describe('the toast over an open pop-up', () => {
  function Sheet({ asks }: { asks: boolean }) {
    return (
      <div role="dialog" aria-modal="true" className="dialog dialog--sheet">
        {asks && <p data-toast-above>Bronze ring, in Wren’s pack</p>}
      </div>
    );
  }
  const host = () => screen.getByRole('status').closest('.toast-host') as HTMLElement;
  afterEach(() => vi.restoreAllMocks());

  it('on a phone it is lifted above a sheet that asks for it, and not above one that does not', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375);
    const { rerender } = render(
      <ToastHost>
        <Sheet asks />
        <NoticeToast message="Told Wren: the Bronze ring is cursed." />
      </ToastHost>,
    );
    expect(host().classList.contains('toast-host--lifted')).toBe(true);
    expect(host().style.getPropertyValue('--toast-lift-top')).toMatch(/^\d+px$/);
    rerender(
      <ToastHost>
        <Sheet asks={false} />
        <NoticeToast message="Told Wren: the Bronze ring is cursed." />
      </ToastHost>,
    );
    // The host watches the page for pop-ups opening and closing (a change it hears a moment later).
    await act(async () => undefined);
    expect(host().classList.contains('toast-host--lifted')).toBe(false);
  });

  // Purpose: on a phone, a sheet that asks for the toast above gives up the toast's own height at its top while the
  // toast shows, so a long list can never push the sheet up under the toast and its title and ✕ out of sight (Home
  // Two's audit of #50, finding 1).
  it.fails('on a phone the sheet that asks for it leaves the toast’s height free at its top', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375);
    const real = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('toast') ? ({ x: 0, y: 0, top: 0, left: 0, width: 343, height: 140, right: 343, bottom: 140, toJSON: () => ({}) } as DOMRect) : real.call(this);
    });
    render(
      <ToastHost>
        <Sheet asks />
        <NoticeToast message="Told Wren of the Lantern Wardens everything about The Old Lantern of the Drowned and of the Nine Tides." />
      </ToastHost>,
    );
    expect(screen.getByRole('dialog').style.getPropertyValue('--toast-above-height')).toBe('140px');
  });

  it('on a tablet it stays at the screen’s foot', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1180);
    render(
      <ToastHost>
        <Sheet asks />
        <NoticeToast message="Told Wren: the Bronze ring is cursed." />
      </ToastHost>,
    );
    expect(host().classList.contains('toast-host--lifted')).toBe(false);
  });
});
