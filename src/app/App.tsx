import { useEffect, useRef, useState, type ReactNode } from 'react';
import { forgetAllKept } from './keptCreation.ts';
import { signOut, watchSession } from '../core/auth.ts';
import type { Db } from '../core/supabase.ts';
import { MoreMenu } from '../ui/MoreMenu.tsx';
import { db, missingSettings } from './connection.ts';
import { ShellMenuItems, ShellMenuProvider } from './shellMenu.tsx';
import { lazyScreen } from './lazyScreen.tsx';
import { SignIn } from './SignIn.tsx';
import './App.css';
import { BRAND } from '../brand.ts';
import { MenuItem } from '../ui/MoreMenu.tsx';
import { StickyProvider } from './stickyState.ts';
import { ToastHost } from '../ui/ToastHost.tsx';
import { AppUpdateProvider } from './AppUpdate.tsx';
import { AboutThisApp } from './AboutThisApp.tsx';

// Everything after sign-in loads in its own pieces, so the sign-in screen shows without waiting for it.
const SignedIn = lazyScreen(() => import('./SignedIn.tsx').then((m) => m.SignedIn), 'Opening');

export function App() {
  if (!db) {
    return (
      <Shell header>
        <SetupNotice missing={missingSettings} />
      </Shell>
    );
  }
  return <Root db={db} />;
}

/**
 * The wordmark (2026-11-07, mockup brand/01-tome, option A): the app's name in even capitals, EB Garamond 600, spaced
 * 0.12em. It shows on sign-in, the loading screen and Your campaigns; inside a campaign the name never appears. The
 * text stays the name as written (BRAND.appName), so a screen reader says the word, not the letters.
 */
export function Wordmark({ size }: { size: 'welcome' | 'loading' | 'head' }) {
  return <span className={`wordmark wordmark--${size}`}>{BRAND.appName}</span>;
}

/** The loading screen (while the device checks for a saved session): the wordmark and the dictionary entry. */
export function LoadingScreen() {
  const at = BRAND.dictionaryEntry.indexOf(BRAND.dictionaryItalic);
  return (
    <div className="loading-screen" role="status">
      <Wordmark size="loading" />
      <p className="loading-screen__entry">
        {at < 0 ? (
          BRAND.dictionaryEntry
        ) : (
          <>
            {BRAND.dictionaryEntry.slice(0, at)}
            <i>{BRAND.dictionaryItalic}</i>
            {BRAND.dictionaryEntry.slice(at + BRAND.dictionaryItalic.length)}
          </>
        )}
      </p>
    </div>
  );
}

// The header with the app's wordmark shows only on sign-in and Your campaigns (2026-10-23); every other screen
// has its own single top row (TopRow) with the same ⋯ items.
function Shell({ header, welcome = false, children }: { header: boolean; welcome?: boolean; children: ReactNode }) {
  return (
    <div className="shell">
      {/* Signing in: the wordmark a third of the way down, a short rule under it, then the tagline (brand/01-tome). */}
      {welcome && (
        <header className="shell__header shell__header--welcome">
          <div className="shell__welcome">
            <Wordmark size="welcome" />
            <span className="shell__rule" aria-hidden="true" />
            {BRAND.tagline && <span className="shell__tagline">{BRAND.tagline}</span>}
          </div>
          <div className="shell__corner">
            <MoreMenu label="Account and device options">
              <ShellMenuItems />
            </MoreMenu>
          </div>
        </header>
      )}
      {header && !welcome && (
        <header className="shell__header">
          <Wordmark size="head" />
          <MoreMenu label="Account and device options">
            <ShellMenuItems />
          </MoreMenu>
        </header>
      )}
      <main className={header ? 'shell__main' : 'shell__main shell__main--bare'}>{children}</main>
    </div>
  );
}

/** Shows sign-in until someone is signed in. People stay signed in until they sign out. */
export function Root({ db }: { db: Db }) {
  // undefined = still checking this device for a saved session
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(
    () =>
      watchSession(db, (id) => {
        // The device's stored setting rules (perf fix 2b) belong to one person at a time: sign-out deletes them all, and a
        // different person signing in deletes the one before's. Loaded lazily, so the sign-in screen never fetches it.
        void import('./packCache.ts').then((cache) => (id === null ? cache.releaseDevice() : cache.claimDevice(id)));
        setUserId(id);
      }),
    [db],
  );
  // Fetch the signed-in screens while the person types their email and code, so they're there when needed.
  useEffect(() => {
    if (userId === null) void SignedIn.preload();
  }, [userId]);
  // The signed-in screens register how to open "Rules library" from the ⋯ menu, and say when it can open.
  // Everyone has a library of their own (2026-10-22: players may import packs too).
  const openLibraryRef = useRef<(() => void) | null>(null);
  const [libraryReady, setLibraryReady] = useState(false);
  // The signed-in screens say when the header shows (only on Your campaigns).
  const [header, setHeader] = useState(true);
  // "About this app" (ds-6a), opened from the account's items.
  const [aboutOpen, setAboutOpen] = useState(false);

  const menu = userId ? (
    <>
      {libraryReady && (
        <MenuItem icon="library" onClick={() => openLibraryRef.current?.()}>
          Rules library
        </MenuItem>
      )}
      {/* ds-6a: just above Sign out, in every menu that shows the account's items (the ⋯, the drawer's foot, the
          rail's menu); its sheet opens here, outside the menu, so choosing the item can close the menu. */}
      <MenuItem icon="info" onClick={() => setAboutOpen(true)}>
        About this app
      </MenuItem>
      <MenuItem icon="sign-out" onClick={() => {
          // cw-13: picks kept on this device go with the session.
          forgetAllKept();
          void signOut(db);
        }}>
        Sign out
      </MenuItem>
    </>
  ) : null;

  return (
    // The GM's reminder card and the like, kept while moving between screens (DG2).
    <StickyProvider>
    <ShellMenuProvider account={menu}>
      <ToastHost>
        {/* The ⋯ menu's Check for a new version, and the notice when one is held back (F55). */}
        <AppUpdateProvider>
        {/* While the device checks for a saved session: the loading screen alone, no header (its wordmark is the name). */}
        <Shell header={userId === null || (!!userId && header)} welcome={userId === null}>
          {userId === undefined ? (
            <LoadingScreen />
          ) : userId === null ? (
            <SignIn db={db} />
          ) : (
            <SignedIn
              key={userId}
              db={db}
              userId={userId}
              libraryOpenerRef={openLibraryRef}
              onLibraryReady={setLibraryReady}
              onHeader={setHeader}
            />
          )}
        </Shell>
        {aboutOpen && <AboutThisApp onClose={() => setAboutOpen(false)} />}
        </AppUpdateProvider>
      </ToastHost>
    </ShellMenuProvider>
    </StickyProvider>
  );
}

function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <section className="setup-notice" role="alert">
      <p className="setup-notice__title">Setup needed</p>
      <p>
        Missing setting{missing.length > 1 ? 's' : ''}:{' '}
        {missing.map((name) => (
          <code key={name}>{name}</code>
        ))}
      </p>
      <p>
        Locally, copy <code>.env.example</code> to <code>.env</code> and fill in the values from Supabase, then
        restart <code>npm run dev</code>. On Vercel, add them under Project Settings → Environment Variables and
        redeploy.
      </p>
    </section>
  );
}
