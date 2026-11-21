// @vitest-environment jsdom
// Fix 1 of the perf report (2026-11-06): the sign-in screen loads without the rest of the app, the signed-in screens
// load when first opened, and a screen that can't load says so instead of leaving a blank page.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Component, useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import viteConfig from '../../vite.config.ts?raw';
import { lazyScreen } from './lazyScreen.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A loader the test settles by hand. */
function controlledLoader() {
  const calls: { resolve: (v: (p: { name: string }) => React.ReactNode) => void; reject: (e: unknown) => void }[] = [];
  const load = vi.fn(
    () =>
      new Promise<(p: { name: string }) => React.ReactNode>((resolve, reject) => {
        calls.push({ resolve, reject });
      }),
  );
  const call = (i: number) => {
    const found = calls[i];
    if (!found) throw new Error(`load ${i + 1} wasn't asked for`);
    return found;
  };
  return { load, call };
}

const Hello = ({ name }: { name: string }) => <p>Hello {name}</p>;

describe('a lazy screen', () => {
  it('shows skeleton rows while its code loads, then the screen with its props', async () => {
    const { load, call } = controlledLoader();
    const Screen = lazyScreen(load, 'Opening the campaign');
    render(<Screen name="Bog lurker" />);
    expect(screen.getByRole('status', { name: 'Opening the campaign' })).toBeTruthy();
    await act(async () => call(0).resolve(Hello));
    expect(await screen.findByText('Hello Bog lurker')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('starts loading on preload and loads only once', async () => {
    const { load, call } = controlledLoader();
    const Screen = lazyScreen(load);
    Screen.preload();
    Screen.preload();
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => call(0).resolve(Hello));
    render(<Screen name="Lantern Warden" />);
    expect(await screen.findByText('Hello Lantern Warden')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a failed load shows plain words and Try again, never a blank page; Try again loads it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { load, call } = controlledLoader();
    const Screen = lazyScreen(load);
    render(<Screen name="Reed Witch" />);
    await act(async () => call(0).reject(new TypeError('Failed to fetch dynamically imported module')));
    expect((await screen.findByRole('alert')).textContent).toBe("Couldn't open this screen. Check your connection and try again.");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => call(1).resolve(Hello));
    expect(await screen.findByText('Hello Reed Witch')).toBeTruthy();
  });

  it('a failed preload is forgotten, so opening the screen asks for its code again', async () => {
    const { load, call } = controlledLoader();
    const Screen = lazyScreen(load);
    Screen.preload();
    await act(async () => call(0).reject(new TypeError('offline')));
    render(<Screen name="Stone kin" />);
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => call(1).resolve(Hello));
    expect(await screen.findByText('Hello Stone kin')).toBeTruthy();
  });

  it('says so when offline', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { load, call } = controlledLoader();
    const Screen = lazyScreen(load);
    render(<Screen name="x" />);
    await act(async () => call(0).reject(new TypeError('offline')));
    expect((await screen.findByRole('alert')).textContent).toBe(
      "Couldn't open this screen: you're offline. Check your connection and try again.",
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('when a retry fails too while online (a file a new version replaced), it offers Reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { load, call } = controlledLoader();
    const Screen = lazyScreen(load);
    render(<Screen name="x" />);
    await act(async () => call(0).reject(new TypeError('gone')));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await act(async () => call(1).reject(new TypeError('gone')));
    expect((await screen.findByRole('alert')).textContent).toBe('The app has probably been updated since you opened it. Reload to get the new version.');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
});

// Every module the sign-in screen's code reaches through plain (non-lazy) imports, starting from the app's entry.
const RAW = import.meta.glob<string>('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
/** The sources by their path from the repo root ("src/app/App.tsx"). */
const SOURCES: Record<string, string> = Object.fromEntries(Object.entries(RAW).map(([key, text]) => [key.replace(/^\.\.\//, 'src/').replace(/^\.\//, 'src/app/'), text]));
function reachedFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const walk = (path: string) => {
    const text = SOURCES[path];
    if (seen.has(path) || text === undefined) return;
    seen.add(path);
    // `import x from '…'` and `export … from '…'`, but not `import type` (erased) or `import('…')` (lazy).
    for (const match of text.matchAll(/^(?:import|export)\s+(?!type\s)[^'";]*?from\s+'(\.{1,2}\/[^']+)'|^import\s+'(\.{1,2}\/[^']+)'/gm)) {
      const out = path.split('/').slice(0, -1);
      for (const part of (match[1] ?? match[2] ?? '').split('/')) {
        if (part === '..') out.pop();
        else if (part !== '.') out.push(part);
      }
      walk(out.join('/'));
    }
  };
  walk(entry);
  return seen;
}

/** Counts taps, so a test can see whether a screen kept its state or was swapped for a fresh copy. */
function Tally({ name }: { name: string }) {
  const [taps, setTaps] = useState(0);
  return (
    <button type="button" onClick={() => setTaps((n) => n + 1)}>
      {name} {taps}
    </button>
  );
}

/** Stands in for whatever is above a screen: shows that an error reached it. */
class Above extends Component<{ children: ReactNode }, { caught: boolean }> {
  state = { caught: false };
  static getDerivedStateFromError() {
    return { caught: true };
  }
  render() {
    return this.state.caught ? <p>Caught above</p> : this.props.children;
  }
}

describe('an open screen is never lost to the loading parts (Design, 2026-11-07)', () => {
  it('a screen whose code arrived while it was showing keeps what was done in it when the screen above redraws', async () => {
    const { load, call } = controlledLoader();
    const Screen = lazyScreen(load);
    const { rerender } = render(<Screen name="Picks" />);
    await act(async () => call(0).resolve(Tally));
    fireEvent.click(await screen.findByRole('button', { name: 'Picks 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Picks 1' }));
    rerender(<Screen name="Picks" />);
    expect(screen.getByRole('button', { name: 'Picks 2' })).toBeTruthy();
  });

  it("an error from a screen that loaded passes on as before: no Couldn't open and no Reload over an open screen", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { load, call } = controlledLoader();
    const Screen = lazyScreen(load);
    function Breaks() {
      const [broken, setBroken] = useState(false);
      if (broken) throw new Error('a bug in the screen');
      return (
        <button type="button" onClick={() => setBroken(true)}>
          Pick
        </button>
      );
    }
    render(
      <Above>
        <Screen name="x" />
      </Above>,
    );
    await act(async () => call(0).resolve(Breaks));
    fireEvent.click(await screen.findByRole('button', { name: 'Pick' }));
    expect(screen.getByText('Caught above')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
  });
});

describe('the sign-in screen loads on its own', () => {
  const reached = reachedFrom('src/main.tsx');

  it('reaches the sign-in screen itself', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
    expect(reached.has('src/main.tsx'), Object.keys(SOURCES).slice(0, 3).join(', ')).toBe(true);
    expect(reached.has('src/app/SignIn.tsx')).toBe(true);
    expect(reached.has('src/app/App.tsx')).toBe(true);
  });

  it("doesn't reach the signed-in screens or the command registry except through a lazy import", () => {
    for (const heavy of ['SignedIn.tsx', 'Characters.tsx', 'GmCampaign.tsx', 'LibraryScreen.tsx', 'NewCampaign.tsx', 'commandRegistry.ts']) {
      expect(reached.has(`src/app/${heavy}`), heavy).toBe(false);
    }
  });
});

describe('nothing loads from inside character creation', () => {
  it("creation's code reaches no lazy screen and asks for no piece at run time, so a load can't fail while picks are open", () => {
    const reached = reachedFrom('src/app/Characters.tsx');
    expect(reached.has('src/app/GuidedCreation.tsx')).toBe(true);
    expect(reached.has('src/app/StartingGear.tsx')).toBe(true);
    for (const path of reached) {
      expect(SOURCES[path], path).not.toMatch(/\bimport\(|lazyScreen\(/);
    }
  });
});

describe('fonts and the offline store', () => {
  it('the fonts stay declared as the approved pictures were drawn (Fontsource per-subset files, in this order)', async () => {
    // Letter ranges would keep the extended-Latin files off the sign-in screen (the report's cost 3), but they change
    // which file draws each letter and what 1ch measures (the 65ch reading width): every picture moves. Not without
    // Design's say-so (perf-lazy-and-fetch, 2026-11-07).
    // Read from disk: the test runner hands back CSS imports empty. Tests run from the repo's root.
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    const fontsCss = fs.readFileSync('src/ui/fonts.css', 'utf8');
    expect(fontsCss.match(/@import '[^']+'/g)).toEqual([
      "@import '@fontsource/eb-garamond/latin-600.css'",
      "@import '@fontsource/eb-garamond/latin-ext-600.css'",
      "@import '@fontsource/atkinson-hyperlegible/latin-400.css'",
      "@import '@fontsource/atkinson-hyperlegible/latin-ext-400.css'",
      "@import '@fontsource/atkinson-hyperlegible/latin-700.css'",
      "@import '@fontsource/atkinson-hyperlegible/latin-ext-700.css'",
      "@import '@fontsource/caveat/latin-500.css'",
      "@import '@fontsource/caveat/latin-ext-500.css'",
      // Book text for the stat block (December 5c; Francis said yes to both packages, 2026-11-12), after the rest.
      "@import '@fontsource/bitter/latin-400.css'",
      "@import '@fontsource/bitter/latin-ext-400.css'",
      "@import '@fontsource/bitter/latin-700.css'",
      "@import '@fontsource/bitter/latin-ext-700.css'",
      // The entry's name (900) and sub-headings (800) in the book format (dec-10 S3, the lead's ruling 2026-11-13).
      "@import '@fontsource/bitter/latin-800.css'",
      "@import '@fontsource/bitter/latin-ext-800.css'",
      "@import '@fontsource/bitter/latin-900.css'",
      "@import '@fontsource/bitter/latin-ext-900.css'",
      "@import '@fontsource/alegreya-sans-sc/latin-700.css'",
      "@import '@fontsource/alegreya-sans-sc/latin-ext-700.css'",
    ]);
    expect(fontsCss).not.toContain('@font-face');
  });

  it("shared rules that used to win by coming last still win now the screens' styles load later (#542's layout run)", async () => {
    // Each pair: an element carries both classes and both set a property; the first rule won before the split.
    // Found by listing every such pair across the app's stylesheets and comparing the old and new load order.
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync: (p: string, e: 'utf8') => string };
    const css = (file: string) => fs.readFileSync(file, 'utf8').replace(/\s+/g, ' ');
    expect(css('src/app/SignIn.css')).toContain('.auth, .auth.new-campaign {');
    expect(css('src/app/SignIn.css')).toContain(
      '.field__input, .field__input:is(.field__textarea, .field__input--name, .field__input--short-select, .companies__select, .pack__select) {',
    );
    expect(css('src/app/App.css')).toContain('.label, .label.scene-card__title {');
    expect(css('src/ui/ruleRows.css')).toContain('.rule-key, .creation-callout.rule-key {');
  });

  it('the service worker stores every script, style and font piece, so the app opens offline after one visit', () => {
    const patterns = /globPatterns:\s*\[([^\]]*)\]/.exec(viteConfig)?.[1] ?? '';
    expect(patterns).toContain("'**/*.{js,css,html,woff2,png}'");
    // The app decides when to switch to a new version (appUpdates.ts).
    expect(viteConfig).toContain("registerType: 'prompt'");
  });
});
