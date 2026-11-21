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
