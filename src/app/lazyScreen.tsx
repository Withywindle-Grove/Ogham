// Screens that load the first time they open (perf report 2026-11-06, fix 1): the sign-in screen no longer waits for
// the whole app. While a screen's code arrives it shows skeleton rows (docs/06, Skeleton rows); if it can't arrive
// (offline before the app was ever stored, or a file from an older version that a new deploy replaced) it says so in
// plain words with a way to try again, never a blank page. The service worker stores every piece after the first
// visit (vite.config.ts, globPatterns), so once installed the app opens offline as before.
import { Component, Suspense, createElement, lazy, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { SkeletonRows } from '../ui/parts.tsx';
import './SignIn.css';

/** A screen whose code loads when it first shows; `preload` starts the download early (and never fails). */
export type LazyScreen<P extends object> = ComponentType<P> & { preload: () => Promise<void> };

const everyScreen = new Set<() => Promise<void>>();

/** Loads every lazy screen made so far, and the ones their code makes in turn. The tests use it (the test runner's
 * setup, src/testing/setupLazyScreens.ts) so the screens show at once there, as they do in the app once fetched. */
export async function preloadEveryScreen(): Promise<void> {
  const done = new Set<() => Promise<void>>();
  for (;;) {
    const fresh = [...everyScreen].filter((preload) => !done.has(preload));
    if (fresh.length === 0) return;
    for (const preload of fresh) done.add(preload);
    await Promise.all(fresh.map((preload) => preload()));
  }
}

/** Wraps a screen loader: skeleton rows while it loads, plain words and Try again if it fails. */
export function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>, label = 'Opening'): LazyScreen<P> {
  let pending: Promise<{ default: ComponentType<P> }> | null = null;
  // Once the code has arrived (often by a preload), the screen shows at once, with no loading flash.
  let ready: ComponentType<P> | null = null;
  const fetchOnce = () => {
    // A failed load is forgotten, so Try again asks for the file again.
    pending ??= load().then(
      (screen) => {
        ready = screen;
        return { default: screen };
      },
      (error: unknown) => {
        pending = null;
        throw error;
      },
    );
    return pending;
  };
  const makeLazy = () => lazy(fetchOnce);
  let Loaded: LazyExoticComponent<ComponentType<P>> = makeLazy();

  function Screen(props: P) {
    const [, setTries] = useState(0);
    // Which way this screen shows is fixed when it first appears: switching later (the code arriving while it's
    // open) would swap what's on screen for a fresh copy and lose whatever was picked or typed in it.
    const [readyAtFirst] = useState(() => ready);
    if (readyAtFirst) return createElement(readyAtFirst, props);
    return (
      <LoadBoundary
        loaded={() => ready !== null}
        onRetry={() => {
          // React keeps a failed lazy screen failed, so a retry needs a fresh one.
          Loaded = makeLazy();
          setTries((n) => n + 1);
        }}
      >
        <Suspense fallback={<SkeletonRows rows={3} label={label} />}>
          <Loaded {...props} />
        </Suspense>
      </LoadBoundary>
    );
  }
  const preload = () => fetchOnce().then(
    () => undefined,
    () => undefined,
  );
  everyScreen.add(preload);
  return Object.assign(Screen, { preload });
}

interface BoundaryState {
  failed: boolean;
  error?: unknown;
  /** How many times the screen has failed to load. A second failure while online most likely means a file from an
   * older version (a new deploy replaced it), so a reload is offered instead. */
  failures: number;
}

/**
 * What shows when a screen's code couldn't load. Only then: once the code has arrived, an error from the screen
 * itself passes on as it did before the split (`loaded`), so these words and their Reload never cover a screen
 * that was open, with picks or typing in it. A screen's code is all there before it first shows (no screen loads
 * another piece from inside it; lazyScreen.test.tsx pins that for creation), so nothing open can fail to load.
 */
export class LoadBoundary extends Component<{ onRetry: () => void; loaded: () => boolean; children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false, failures: 0 };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { failed: true, error };
  }

  componentDidCatch() {
    this.setState((s) => ({ failures: s.failures + 1 }));
  }

  render() {
    if (!this.state.failed) return this.props.children;
    // Not a load failure: the screen's own error, handed on unchanged.
    if (this.props.loaded()) throw this.state.error;
    const offline = !navigator.onLine;
    if (this.state.failures > 1 && !offline) {
      return (
        <section className="auth">
          <p className="form-error" role="alert">
            The app has probably been updated since you opened it. Reload to get the new version.
          </p>
          <button type="button" className="button-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </section>
      );
    }
    return (
      <section className="auth">
        <p className="form-error" role="alert">
          {offline
            ? "Couldn't open this screen: you're offline. Check your connection and try again."
            : "Couldn't open this screen. Check your connection and try again."}
        </p>
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            this.setState({ failed: false });
            this.props.onRetry();
          }}
        >
          Try again
        </button>
      </section>
    );
  }
}
