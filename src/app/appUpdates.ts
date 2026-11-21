// Keeping the installed app up to date. The browser only looks for a new version now and then, so an iPad
// kept the old one until the app was opened twice. Now the app looks each time it comes back on screen, and
// switches to a new version at a safe moment: right away if nothing is being typed or filled in, otherwise
// the next time the app goes off screen. Never in the middle of a form, and never while a character is being
// made (after-test A12): creation holds the new version until it's closed, even when the app goes off screen.
// One exception (ruled 2026-11-19): a standing form, always on its screen and never opened (Your campaigns'
// invite-code form, marked data-standing-form), doesn't hold the new version back while every text box in it is empty.
// F55 (ruled 2026-11-10, au-1 and au-2): the ⋯ menu shows this device's version and can check for a new one, and a
// version held back by the rule above is announced (AppUpdate.tsx); both switch only by the same rule.
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { keepPlaceForReload } from './placeOnReload.ts';

/** vite-plugin-pwa's registerSW, handed in by main.tsx (so the ⋯ menu and its tests never load the plugin's module). */
export type RegisterSW = (options: RegisterSWOptions) => (reload?: boolean) => Promise<void>;

/** The version on this device: the commit's short id and the day it was built (vite.config.ts), or "dev". */
export interface BuildInfo {
  id: string;
  /** The build's day (YYYY-MM-DD); null for a build made outside Vercel or CI. */
  date: string | null;
}

export const THIS_BUILD: BuildInfo = typeof __APP_BUILD__ === 'undefined' ? { id: 'dev', date: null } : __APP_BUILD__;

/** The menu's quiet line: "Version a1b2c3d, built 10 Nov 2026" (or "Version dev"). */
export function versionWords(build: BuildInfo): string {
  if (!build.date) return `Version ${build.id}`;
  const day = new Date(`${build.date}T12:00:00Z`);
  if (Number.isNaN(day.getTime())) return `Version ${build.id}`;
  return `Version ${build.id}, built ${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
}

/** Whether character creation is on screen (its step shell carries data-creation, ui/creation.tsx). */
export function creationOpen(doc: Document): boolean {
  return doc.querySelector('[data-creation]') !== null;
}

/**
 * The marker for a standing form: one always on its screen, never opened by a tap (Your campaigns' invite-code form).
 * Only a standing form that is empty lets a new version through (ruled 2026-11-19); every other form holds it.
 */
export const STANDING_FORM = 'data-standing-form';

// The input types that take no typing (a tap, a pick or nothing at all); every other input is a text box.
const NOT_TEXT_BOXES = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'hidden', 'file', 'image', 'range', 'color']);

/**
 * Whether a form could lose something on a reload: every form does, as before, except a standing form whose text
 * boxes are all empty. A standing form with no text box still holds. A box the browser can't read (a half-typed
 * number or date, validity.badInput) counts as filled.
 */
function formAtRisk(form: HTMLFormElement): boolean {
  if (!form.hasAttribute(STANDING_FORM)) return true;
  const boxes = Array.from(form.elements).filter(
    (field): field is HTMLInputElement | HTMLTextAreaElement =>
      field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && !NOT_TEXT_BOXES.has(field.type)),
  );
  return boxes.length === 0 || boxes.some((box) => box.value !== '' || box.validity.badInput);
}

/**
 * Whether reloading now would lose nothing: no form on screen (an empty standing form aside), no box being typed in,
 * and no creation open.
 */
export function safeToReload(doc: Document): boolean {
  const active = doc.activeElement;
  const typing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
  const formAtStake = Array.from(doc.querySelectorAll('form')).some(formAtRisk);
  return !typing && !formAtStake && !creationOpen(doc);
}

// What keepAppUpdated learnt: the switch (vite-plugin-pwa's), the service worker's registration, and whether a new
// version is installed and waiting.
let switchNow: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;
let waiting = false;

// A new version found and held back by the rule; and whether au-2's notice is still to show for it (once when it is
// held, and again each time the app comes back on screen while it still is).
let held = false;
let noticeDue = false;
const listeners = new Set<() => void>();
function setHeld(next: boolean) {
  if (held === next) return;
  held = next;
  noticeDue = next;
  for (const listener of listeners) listener();
}
/** Whether a new version is waiting, held back because switching now would lose something. */
export function isHeld(): boolean {
  return held;
}
/** For useSyncExternalStore: whether the notice for a held version is still to show. */
export function isNoticeDue(): boolean {
  return noticeDue;
}
/** The notice has shown (or the at-risk pop-up has said the same): not again until the app comes back on screen. */
export function noticeShown(): void {
  if (!noticeDue) return;
  noticeDue = false;
  for (const listener of listeners) listener();
}
// Francis (2026-11-10, on #613): the notice comes back each time the app returns to the screen while still held.
function noticeAgain(): void {
  if (!held || noticeDue) return;
  noticeDue = true;
  for (const listener of listeners) listener();
}
export function subscribeHeld(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function switchToNewVersion() {
  setHeld(false);
  // The reload comes back to the same screen and tab (placeOnReload.ts; M5b gate walk, overnight item 8).
  if (switchNow) keepPlaceForReload();
  void switchNow?.(true);
}

export function keepAppUpdated(registerSW: RegisterSW): void {
  if (!('serviceWorker' in navigator)) return;
  switchNow = registerSW({
    immediate: true,
    onNeedRefresh() {
      waiting = true;
      if ((document.visibilityState === 'hidden' && !creationOpen(document)) || safeToReload(document)) switchToNewVersion();
      else setHeld(true);
    },
    onRegisteredSW(_url, found) {
      registration = found;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          noticeAgain();
          void found?.update();
        }
        // Off screen: switch, unless a character is half made (it would lose the step's picks).
        else if (waiting && !creationOpen(document)) switchToNewVersion();
      });
    },
  });
}

/** What a tap on Reload or Check for a new version led to; AppUpdate.tsx says each in words. */
export type CheckOutcome = 'reloading' | 'current' | 'at-risk' | 'offline' | 'unreachable';

/**
 * For a tap (Check, the notice's Reload; ruling au-1): the rule above, and also no pop-up open. The ⋯ sheet or drawer
 * that held Check has closed by then (checkForNewVersion waits a tick first).
 */
export function safeForTap(doc: Document): boolean {
  return safeToReload(doc) && doc.querySelector('[role="dialog"]') === null;
}

/** Reload into the waiting version if that loses nothing (safeForTap); otherwise say it's at risk. */
export function reloadIntoNewVersion(doc: Document = document): 'reloading' | 'at-risk' {
  if (!safeForTap(doc)) {
    if (waiting) setHeld(true);
    return 'at-risk';
  }
  switchToNewVersion();
  return 'reloading';
}

// A new worker found by update() installs before it waits: wait for that (at most 10 seconds).
function settled(reg: ServiceWorkerRegistration): Promise<void> {
  const installing = reg.installing;
  if (!installing) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, 10_000);
    function done() {
      clearTimeout(timer);
      installing!.removeEventListener('statechange', onChange);
      resolve();
    }
    function onChange() {
      if (installing!.state !== 'installing') done();
    }
    installing.addEventListener('statechange', onChange);
  });
}

/**
 * The ⋯ menu's Check for a new version (au-1): asks the server now. A version waiting and nothing at risk: reload into
 * it. Nothing new: 'current'. A version waiting but something would be lost: 'at-risk' (no reload). No connection:
 * 'offline'. Online but the server wasn't asked or didn't answer (no service worker registered yet, a lost or captive
 * connection): 'unreachable', never 'current' (review 3 and Francis's answer 4 on #613).
 */
export async function checkForNewVersion(doc: Document = document): Promise<CheckOutcome> {
  // Let the menu that held Check close first, so it doesn't count as an open pop-up.
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (!waiting) {
    if (!navigator.onLine) return 'offline';
    if (!registration) return 'unreachable';
    try {
      await registration.update();
    } catch {
      return 'unreachable';
    }
    await settled(registration);
    if (registration.waiting) waiting = true;
  }
  if (!waiting) return 'current';
  return reloadIntoNewVersion(doc);
}

/** For tests: forget what keepAppUpdated learnt. */
export function resetAppUpdatesForTests(): void {
  switchNow = null;
  registration = undefined;
  waiting = false;
  held = false;
  noticeDue = false;
  listeners.clear();
}
