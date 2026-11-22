// The app's one toast (docs/06 "Toasts with Undo"; ruled 2026-10-25): one at a time, above the tab bar, 6 seconds
// with a draining bar and Undo. Any screen shows one through useToast(); a new toast replaces the one showing.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SHEET_PHONE } from './Dialog.tsx';
import { Toast } from './parts.tsx';

export interface ToastRequest {
  text: string;
  /** Present when the change can be undone from here (the same Undo as the log). */
  onUndo?: () => void;
  /** The action variant: the obvious next thing in one tap ("Light another"), for a toast with no Undo. */
  action?: { label: string; run: () => void };
  /** Something went wrong or can't be done (A11: messages are pop-ups, not boxes in the page). */
  error?: boolean;
}

type Show = (toast: ToastRequest) => void;

/**
 * For a waiting word ("Checking for a new version…", AppUpdate.tsx) and its answer, acting only on that toast by its
 * id: `show` shows it and gives back its id; `take` takes it down if it is still showing; `replace` puts the answer in
 * its place, or shows the answer if no toast is showing, and drops it if another toast has taken over (never knocking
 * out another toast's Undo).
 */
interface Swap {
  show: (toast: ToastRequest) => number;
  take: (id: number) => void;
  replace: (id: number, toast: ToastRequest) => void;
}

const ToastContext = createContext<Show>(() => undefined);
const ToastShowing = createContext(false);
const ToastSwap = createContext<Swap>({ show: () => 0, take: () => undefined, replace: () => undefined });

/** Shows a toast: past tense, what moved ("Dropped 3 torches"), and Undo where it can be undone. */
export function useToast(): Show {
  return useContext(ToastContext);
}

/** Whether a toast is on screen now: a notice that waits its turn (the new version's, AppUpdate.tsx) never covers one. */
export function useToastShowing(): boolean {
  return useContext(ToastShowing);
}

/** Take down or replace one toast by its id (see `Swap`). */
export function useToastSwap(): Swap {
  return useContext(ToastSwap);
}

/**
 * For a screen's error messages (A11, ruled 2026-10-25): a drop-in for an error state's setter. A message shows as
 * an error toast; null (clearing it) does nothing, since the toast goes by itself.
 */
export function useErrorToast(): (message: string | null) => void {
  const show = useToast();
  return useCallback((message: string | null) => {
    if (message) show({ text: message, error: true });
  }, [show]);
}

/** How long after the last change a settings screen says "Saved" (ruled 2026-10-26). */
export const SAVED_DELAY_MS = 1500;

/**
 * For settings screens that save on every tap (ruled 2026-10-26, amending B23): call it after each save; "Saved"
 * shows once, about 1.5 seconds after the last change, so a run of taps gets one toast. Leaving the screen before
 * then shows it at once.
 */
export function useSavedToast(): () => void {
  const show = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current === null) return;
      clearTimeout(timer.current);
      show({ text: 'Saved' });
    },
    [show],
  );
  return useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      show({ text: 'Saved' });
    }, SAVED_DELAY_MS);
  }, [show]);
}

/** Shows a screen's error message as an error toast whenever it changes to a new one; renders nothing in the page. */
export function ErrorToast({ message }: { message: string | null | undefined }) {
  const show = useErrorToast();
  useEffect(() => {
    if (message) show(message);
  }, [message, show]);
  return null;
}

/** Shows a screen's confirmation ("Moved Oath.") as a toast whenever it changes to a new one; nothing in the page. */
export function NoticeToast({ message }: { message: string | null | undefined }) {
  const show = useToast();
  useEffect(() => {
    if (message) show({ text: message });
  }, [message, show]);
  return null;
}

export function ToastHost({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(ToastRequest & { id: number }) | null>(null);
  const lastId = useRef(0);
  const show = useCallback((toast: ToastRequest) => {
    lastId.current += 1;
    const id = lastId.current;
    setCurrent({ ...toast, id });
    return id;
  }, []);
  // useToast's show returns nothing, so `useEffect(() => show(...))` stays a valid effect.
  const showToast = useCallback<Show>((toast) => {
    show(toast);
  }, [show]);
  const done = useCallback(() => setCurrent(null), []);
  // Over an open pop-up that asks for it (the Reveal pop-up, K22d; pick 10): on a phone, where that pop-up is the sheet
  // from the foot, the toast sits just above the sheet's top edge, so it never covers a row or the foot; with the sheet
  // at full height, as low as keeps it on screen (over the title). Elsewhere, and on a tablet, the screen's foot.
  const host = useRef<HTMLDivElement>(null);
  const [lift, setLift] = useState<{ top: number; height: number } | null>(null);
  useLayoutEffect(() => {
    if (!current) return;
    const place = () => {
      const open = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
      const card = open[open.length - 1];
      const above = card && window.innerWidth < SHEET_PHONE && card.classList.contains('dialog--sheet') && card.querySelector('[data-toast-above]');
      // offsetTop, not the box: it leaves out the sheet's rising transform while it opens.
      const next = above ? { top: card.offsetTop, height: host.current?.firstElementChild?.getBoundingClientRect().height ?? 0 } : null;
      setLift((was) => (was?.top === next?.top && was?.height === next?.height ? was : next));
    };
    place();
    const watch = typeof MutationObserver !== 'undefined' ? new MutationObserver(place) : null;
    watch?.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', place);
    return () => {
      watch?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [current]);
  const swap = useMemo<Swap>(
    () => ({
      show,
      take: (id) => setCurrent((showing) => (showing?.id === id ? null : showing)),
      replace: (id, toast) => {
        lastId.current += 1;
        const next = { ...toast, id: lastId.current };
        setCurrent((showing) => (showing === null || showing.id === id ? next : showing));
      },
    }),
    [show],
  );
  return (
    <ToastContext.Provider value={showToast}>
      <ToastSwap.Provider value={swap}>
        <ToastShowing.Provider value={current !== null}>{children}</ToastShowing.Provider>
      </ToastSwap.Provider>
      {current && (
        <div
          ref={host}
          className={`toast-host${lift ? ' toast-host--lifted' : ''}`}
          style={lift ? ({ '--toast-lift-top': `${lift.top}px`, '--toast-height': `${lift.height}px` } as CSSProperties) : undefined}
        >
          <Toast
            key={current.id}
            text={current.text}
            error={current.error}
            onDone={done}
            onUndo={
              current.onUndo
                ? () => {
                    current.onUndo!();
                    setCurrent(null);
                  }
                : undefined
            }
            action={
              current.action
                ? {
                    label: current.action.label,
                    run: () => {
                      current.action!.run();
                      setCurrent(null);
                    },
                  }
                : undefined
            }
          />
        </div>
      )}
    </ToastContext.Provider>
  );
}
