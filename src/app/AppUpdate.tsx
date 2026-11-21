// F55 (ruled 2026-11-10): the version on this device and Check for a new version at the ⋯ menu's foot (au-1), and the
// notice when a new version is held back (au-2). Both switch only by appUpdates.ts's rule: never while something would
// be lost. Built from listed parts: MenuItem, the quiet line under an item (.more-menu__sub), the toast's action
// variant and a Sheet with Keep working.
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Dialog, SheetScope } from '../ui/Dialog.tsx';
import { MenuItem, MenuItems } from '../ui/MoreMenu.tsx';
import { useToast, useToastShowing, useToastSwap } from '../ui/ToastHost.tsx';
import {
  THIS_BUILD,
  checkForNewVersion,
  creationOpen,
  isNoticeDue,
  noticeShown,
  reloadIntoNewVersion,
  subscribeHeld,
  versionWords,
  type BuildInfo,
  type CheckOutcome,
} from './appUpdates.ts';

export const CURRENT_WORDS = "You're on the latest version.";
export const OFFLINE_WORDS = "You're offline. Try again when you're back online.";
export const UNREACHABLE_WORDS = "Couldn't check just now. Try again in a moment.";
export const CHECKING_WORDS = 'Checking for a new version…';
export const KEEP_WORKING = 'Keep working';
export const READY_WORDS = 'A new version is ready.';
export const AT_RISK_TITLE = 'A new version is ready';
export const AT_RISK_WHY = "Finish or leave what you're typing first, then check again.";

/** The version the menu shows. The gallery and the layout harness give a fixed stand-in, so pictures don't change each build. */
export const BuildContext = createContext<BuildInfo>(THIS_BUILD);
/** The gallery's and the layout harness's stand-in version. */
export const STAND_IN_BUILD: BuildInfo = { id: 'a1b2c3d', date: '2026-01-15' };

const CheckContext = createContext<() => void>(() => undefined);

// While a pop-up or creation is open, the notice waits: it would sit over a sheet's or a step's foot buttons, and
// Reload there could only say "finish first".
function busyScreen(doc: Document): boolean {
  return creationOpen(doc) || doc.querySelector('[role="dialog"]') !== null;
}

/**
 * Inside the ToastHost, around the app: gives the ⋯ menu its Check, shows the at-risk pop-up, and puts up the notice
 * (the toast's action variant, "A new version is ready. · Reload") when a version is held, and again each time the
 * app comes back on screen while it still is; only when no toast, pop-up or creation is on screen. It goes with the
 * toast's time, never staying on screen.
 */
export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const show = useToast();
  const { show: showWaiting, take, replace } = useToastSwap();
  const toastShowing = useToastShowing();
  const noticeDue = useSyncExternalStore(subscribeHeld, isNoticeDue, () => false);
  const [atRisk, setAtRisk] = useState(false);

  // Each answer replaces "Checking for a new version…" (its toast, by id): a toast answer takes its place, or is dropped
  // if another toast has taken over meanwhile (never knocking out that toast's Undo); the at-risk pop-up takes it down.
  // Offline is a state, not an error (06, Offline and sync states): a plain toast. The pop-up has said what the notice
  // would, so the notice waits until the app next comes back on screen (review 1 on #613).
  const say = useCallback(
    (outcome: CheckOutcome, checking?: number) => {
      const answer = (toast: { text: string; error?: boolean }) => {
        if (checking === undefined) show(toast);
        else replace(checking, toast);
      };
      if (outcome === 'at-risk') {
        if (checking !== undefined) take(checking);
        noticeShown();
        setAtRisk(true);
      } else if (outcome === 'current') answer({ text: CURRENT_WORDS });
      else if (outcome === 'offline') answer({ text: OFFLINE_WORDS });
      else if (outcome === 'unreachable') answer({ text: UNREACHABLE_WORDS, error: true });
    },
    [show, take, replace],
  );
  const check = useCallback(() => {
    const checking = showWaiting({ text: CHECKING_WORDS });
    void checkForNewVersion(document).then((outcome) => say(outcome, checking));
  }, [say, showWaiting]);

  useEffect(() => {
    if (!noticeDue || toastShowing || atRisk) return;
    const tryNotice = () => {
      if (busyScreen(document)) return false;
      noticeShown();
      show({ text: READY_WORDS, action: { label: 'Reload', run: () => say(reloadIntoNewVersion(document)) } });
      return true;
    };
    if (tryNotice()) return;
    // A pop-up or creation is open: look again each second until it closes.
    const timer = window.setInterval(() => {
      if (tryNotice()) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [noticeDue, toastShowing, atRisk, show, say]);

  return (
    <CheckContext.Provider value={check}>
      {children}
      {atRisk && (
        <SheetScope.Provider value>
          <Dialog label={AT_RISK_TITLE} onClose={() => setAtRisk(false)}>
            <p className="blocked-sheet__why">{AT_RISK_WHY}</p>
            <div className="dialog__actions">
              <button type="button" className="button-primary" onClick={() => setAtRisk(false)}>
                {KEEP_WORKING}
              </button>
            </div>
          </Dialog>
        </SheetScope.Provider>
      )}
    </CheckContext.Provider>
  );
}

/** The ⋯ menu's foot (au-1): the version on this device, as a quiet line, and Check for a new version. */
export function AppVersionSection() {
  const build = useContext(BuildContext);
  const check = useContext(CheckContext);
  return (
    <div className="more-menu__section">
      <p className="more-menu__sub">{versionWords(build)}</p>
      <MenuItems>
        <MenuItem icon="refresh" onClick={check}>
          Check for a new version
        </MenuItem>
      </MenuItems>
    </div>
  );
}
