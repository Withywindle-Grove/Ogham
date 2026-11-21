// @vitest-environment jsdom
// The app switches to a new version only when that loses nothing (docs/09-decisions-log.md, 2026-10-22), and the ⋯
// menu's Check for a new version (F55, au-1, 2026-11-10) follows the same rule.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Options = { onNeedRefresh?: () => void; onRegisteredSW?: (url: string, reg: ServiceWorkerRegistration | undefined) => void };
// A stand-in for vite-plugin-pwa's registerSW: it keeps the options and hands back the switch.
const pwa = { options: null as Options | null, updateSW: vi.fn<(reload?: boolean) => Promise<void>>(() => Promise.resolve()) };
const registerSW = (options: Options) => {
  pwa.options = options;
  return pwa.updateSW;
};
const { checkForNewVersion, creationOpen, isHeld, isNoticeDue, keepAppUpdated, noticeShown, resetAppUpdatesForTests, safeToReload, versionWords } =
  await import('./appUpdates.ts');

/** A stand-in service worker registration: update() finds a new version when `next` is set. */
function fakeRegistration(next = false) {
  const reg = { installing: null, waiting: null as object | null, update: vi.fn(async () => {
    if (next) reg.waiting = {};
  }) };
  return reg;
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

/** Starts the app's updater against a fake registration. */
function start(reg = fakeRegistration()) {
  keepAppUpdated(registerSW);
  pwa.options!.onRegisteredSW?.('/sw.js', reg as unknown as ServiceWorkerRegistration);
  return reg;
}

beforeEach(() => {
  pwa.updateSW = vi.fn<(reload?: boolean) => Promise<void>>(() => Promise.resolve());
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
  setOnline(true);
  setVisibility('visible');
});

afterEach(() => {
  document.body.innerHTML = '';
  resetAppUpdatesForTests();
});

describe('switching to a new version of the app', () => {
  it('is safe when no form is on screen and nothing is being typed', () => {
    document.body.innerHTML = '<main><p>Player screen</p><button>Undo</button></main>';
    expect(safeToReload(document)).toBe(true);
  });

  it('waits while a form is open, so nothing typed is lost', () => {
    document.body.innerHTML = '<form><input id="name"></form>';
    expect(safeToReload(document)).toBe(false);
  });

  // After-test A12: a half-made character would lose the step's picks, so creation holds the new version.
  it('waits while character creation is on screen, and says creation is open', () => {
    document.body.innerHTML = '<section class="creation-step" data-creation="open"><h1>Scores</h1></section>';
    expect(safeToReload(document)).toBe(false);
    expect(creationOpen(document)).toBe(true);
    document.body.innerHTML = '<section class="creation-step"><h1>New campaign</h1></section>';
    expect(creationOpen(document)).toBe(false);
  });

  // Purpose: an empty standing form (Your campaigns' invite-code form, always on its screen) loses nothing, so it no
  // longer holds the new version (ruled 2026-11-19).
  it('is safe with an empty standing form on screen', () => {
    document.body.innerHTML = '<form data-standing-form><input aria-label="Invite code"><button>Look up</button></form>';
    expect(safeToReload(document)).toBe(true);
  });

  // Purpose: a standing form with something typed in its box holds the new version, typed or opened already filled in.
  it('waits while a standing form has something in its box', () => {
    document.body.innerHTML = '<form data-standing-form><input id="code"></form>';
    (document.getElementById('code') as HTMLInputElement).value = 'BOG-42';
    expect(safeToReload(document)).toBe(false);
    document.body.innerHTML = '<form data-standing-form><input value="BOG-42"></form>';
    expect(safeToReload(document)).toBe(false);
  });

  // Purpose: a standing form whose box is being typed in holds the new version, even before anything is in it.
  it('waits while a standing form is being typed in', () => {
    document.body.innerHTML = '<form data-standing-form><input id="code"></form>';
    (document.getElementById('code') as HTMLInputElement).focus();
    expect(safeToReload(document)).toBe(false);
  });

  // Purpose: a standing form with no text box at all still holds the new version.
  it('waits while a standing form has no text box', () => {
    document.body.innerHTML = '<form data-standing-form><input type="checkbox"><button>Go</button></form>';
    expect(safeToReload(document)).toBe(false);
  });

  // Purpose: an ordinary form someone opened holds the new version even with its text boxes empty, as on main.
  it('waits while an ordinary form is open with its boxes empty', () => {
    document.body.innerHTML = '<form><input aria-label="Note"><textarea></textarea></form>';
    expect(safeToReload(document)).toBe(false);
  });

  // Purpose: an ordinary form holding only picks made by tapping (a tick, a list choice) holds the new version, so the
  // picks aren't lost.
  it('waits while an ordinary form holds only picks', () => {
    document.body.innerHTML =
      '<form><input type="checkbox" checked><select><option>North</option><option selected>South</option></select></form>';
    expect(safeToReload(document)).toBe(false);
  });

  // Purpose: character creation still holds the new version even with only an empty standing form in it.
  it('waits while creation is open, even beside an empty standing form', () => {
    document.body.innerHTML =
      '<section data-creation="open"></section><form data-standing-form><input aria-label="Invite code"></form>';
    expect(safeToReload(document)).toBe(false);
  });

  it('waits while a box outside a form is being typed in', () => {
    document.body.innerHTML = '<input id="search">';
    (document.getElementById('search') as HTMLInputElement).focus();
    expect(safeToReload(document)).toBe(false);
  });
});

describe('the automatic switch (unchanged by F55)', () => {
  // Purpose: a new version found while nothing is at risk is switched to at once, and nothing is held.
  it('switches at once when the new version arrives and nothing is at risk', () => {
    start();
    pwa.options!.onNeedRefresh!();
    expect(pwa.updateSW).toHaveBeenCalledWith(true);
    expect(isHeld()).toBe(false);
  });

  // Purpose: a new version found while a form is open is held (the notice's cue), then switched to when the app goes
  // off screen.
  it('holds the new version while a form is open, and switches when the app goes off screen', () => {
    start();
    document.body.innerHTML = '<form><input></form>';
    pwa.options!.onNeedRefresh!();
    expect(pwa.updateSW).not.toHaveBeenCalled();
    expect(isHeld()).toBe(true);
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pwa.updateSW).toHaveBeenCalledWith(true);
    expect(isHeld()).toBe(false);
  });

  // Purpose: creation open holds the new version even when the app goes off screen (after-test A12).
  it('keeps holding while creation is open, even off screen', () => {
    start();
    document.body.innerHTML = '<section data-creation="open"></section>';
    pwa.options!.onNeedRefresh!();
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pwa.updateSW).not.toHaveBeenCalled();
    expect(isHeld()).toBe(true);
  });

  // Purpose: coming back on screen while a version is still held makes the notice due again (Francis's answer 2 on #613).
  it('makes the notice due again when the app comes back on screen while still held', () => {
    start();
    document.body.innerHTML = '<section data-creation="open"></section>';
    pwa.options!.onNeedRefresh!();
    noticeShown();
    expect(isNoticeDue()).toBe(false);
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(isNoticeDue()).toBe(true);
  });

  // Purpose: coming back on screen with nothing held brings no notice.
  it('makes no notice due on return when nothing is held', () => {
    start();
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(isNoticeDue()).toBe(false);
  });

  // Purpose: coming back on screen asks the server for a new version.
  it('looks for a new version when the app comes back on screen', () => {
    const reg = start();
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(reg.update).toHaveBeenCalled();
  });
});

describe('Check for a new version (au-1)', () => {
  // Purpose: with nothing new on the server, the check says the device is current and reloads nothing.
  it('says current when the server has nothing new', async () => {
    const reg = start(fakeRegistration(false));
    await expect(checkForNewVersion(document)).resolves.toBe('current');
    expect(reg.update).toHaveBeenCalled();
    expect(pwa.updateSW).not.toHaveBeenCalled();
  });

  // Purpose: a new version found by the check, with nothing at risk, is reloaded into at once.
  it('reloads into a version it finds when nothing is at risk', async () => {
    start(fakeRegistration(true));
    await expect(checkForNewVersion(document)).resolves.toBe('reloading');
    expect(pwa.updateSW).toHaveBeenCalledWith(true);
  });

  // Purpose: a version already waiting (held by a form) is not reloaded while the form is open; the check says at risk.
  it('does not reload while something would be lost, and says so', async () => {
    const reg = start();
    document.body.innerHTML = '<form><input></form>';
    pwa.options!.onNeedRefresh!();
    await expect(checkForNewVersion(document)).resolves.toBe('at-risk');
    expect(pwa.updateSW).not.toHaveBeenCalled();
    // The version is already known: no need to ask the server again.
    expect(reg.update).not.toHaveBeenCalled();
  });

  // Purpose: a version held earlier, with only an empty standing form on screen now, is reloaded into by Check
  // (Francis's iPad, 2026-11-19: Your campaigns always shows the invite-code form).
  it('reloads into a waiting version with an empty standing form on screen', async () => {
    start();
    document.body.innerHTML = '<input id="search">';
    (document.getElementById('search') as HTMLInputElement).focus();
    pwa.options!.onNeedRefresh!();
    expect(isHeld()).toBe(true);
    document.body.innerHTML = '<form data-standing-form><input aria-label="Invite code"><button>Look up</button></form>';
    await expect(checkForNewVersion(document)).resolves.toBe('reloading');
    expect(pwa.updateSW).toHaveBeenCalledWith(true);
  });

  // Purpose: a version waiting while a pop-up is open is not reloaded (ruling au-1's at-risk row).
  it('does not reload while a pop-up is open', async () => {
    start(fakeRegistration(true));
    document.body.innerHTML = '<div role="dialog" aria-label="Give"></div>';
    await expect(checkForNewVersion(document)).resolves.toBe('at-risk');
    expect(pwa.updateSW).not.toHaveBeenCalled();
  });

  // Purpose: offline, the check says so without asking the server.
  it('says offline without asking the server', async () => {
    const reg = start();
    setOnline(false);
    await expect(checkForNewVersion(document)).resolves.toBe('offline');
    expect(reg.update).not.toHaveBeenCalled();
  });

  // Purpose: online but the server can't be reached, the check says it couldn't check (Francis's answer 4 on #613), never
  // offline and never current.
  it('says it could not check when the server cannot be reached while online', async () => {
    const reg = start();
    reg.update.mockRejectedValueOnce(new Error('network'));
    await expect(checkForNewVersion(document)).resolves.toBe('unreachable');
  });

  // Purpose: with no service worker registered yet, the check never says "current" without asking the server (review 3
  // on #613); it says it couldn't check.
  it('says it could not check, not current, before any registration', async () => {
    keepAppUpdated(registerSW);
    await expect(checkForNewVersion(document)).resolves.toBe('unreachable');
    expect(pwa.updateSW).not.toHaveBeenCalled();
  });

  // Purpose: with no registration and no connection, offline is still said as offline.
  it('says offline before any registration when the device is offline', async () => {
    setOnline(false);
    await expect(checkForNewVersion(document)).resolves.toBe('offline');
  });
});

describe('the version line', () => {
  // Purpose: the menu's line reads the commit's short id and the build day in words, or the id alone without a day.
  it('reads the id and the day it was built', () => {
    expect(versionWords({ id: 'abc1234', date: '2026-11-10' })).toBe('Version abc1234, built 10 Nov 2026');
    expect(versionWords({ id: 'dev', date: null })).toBe('Version dev');
  });
});
