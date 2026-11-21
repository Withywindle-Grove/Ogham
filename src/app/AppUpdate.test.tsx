// @vitest-environment jsdom
// F55 (ruled 2026-11-10): the version and Check for a new version at the ⋯ menu's foot (au-1), and the notice when a
// new version is held back (au-2). registerSW and navigator.onLine are stand-ins: this proves the words and the rule,
// not that an installed app on a real iPad reloads (that is a manual check).
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useState, type ReactNode } from 'react';

type Options = { onNeedRefresh?: () => void; onRegisteredSW?: (url: string, reg: ServiceWorkerRegistration | undefined) => void };
// A stand-in for vite-plugin-pwa's registerSW: it keeps the options and hands back the switch.
const pwa = { options: null as Options | null, updateSW: vi.fn<(reload?: boolean) => Promise<void>>(() => Promise.resolve()) };
const registerSW = (options: Options) => {
  pwa.options = options;
  return pwa.updateSW;
};
const { keepAppUpdated, resetAppUpdatesForTests } = await import('./appUpdates.ts');
const { AppUpdateProvider, AppVersionSection, BuildContext } = await import('./AppUpdate.tsx');
const { ToastHost, useToast } = await import('../ui/ToastHost.tsx');
const { MoreSheet } = await import('../ui/MoreMenu.tsx');
const { ShellDrawer } = await import('./shellMenu.tsx');
const { InviteCodeBox } = await import('./Campaigns.tsx');

function fakeRegistration(next = false) {
  const reg = {
    installing: null,
    waiting: null as object | null,
    update: vi.fn(async () => {
      if (next) reg.waiting = {};
    }),
  };
  return reg;
}

function start(reg = fakeRegistration()) {
  keepAppUpdated(registerSW);
  pwa.options!.onRegisteredSW?.('/sw.js', reg as unknown as ServiceWorkerRegistration);
  return reg;
}

/** The app's frame as App.tsx builds it, with the menu's foot on screen and anything else a test needs. */
function Frame({ children }: { children?: ReactNode }) {
  return (
    <ToastHost>
      <AppUpdateProvider>
        <BuildContext.Provider value={{ id: 'abc1234', date: '2026-11-10' }}>
          <AppVersionSection />
        </BuildContext.Provider>
        {children}
      </AppUpdateProvider>
    </ToastHost>
  );
}

const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check for a new version' }));

beforeEach(() => {
  pwa.updateSW = vi.fn<(reload?: boolean) => Promise<void>>(() => Promise.resolve());
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetAppUpdatesForTests();
});

describe('the ⋯ menu foot (au-1)', () => {
  // Purpose: the menu's quiet line shows the version given at build time: its short id and the day it was built.
  it('shows the injected version', () => {
    render(<Frame />);
    expect(screen.getByText('Version abc1234, built 10 Nov 2026')).toBeTruthy();
  });

  // Purpose: Check with nothing new on the server says so in a toast and reloads nothing.
  it('says "You\'re on the latest version." when current', async () => {
    start(fakeRegistration(false));
    render(<Frame />);
    check();
    expect(await screen.findByText("You're on the latest version.")).toBeTruthy();
    expect(pwa.updateSW).not.toHaveBeenCalled();
  });

  // Purpose: Check that finds a new version, with nothing at risk, reloads into it at once.
  it('reloads at once when a version is waiting and nothing is at risk', async () => {
    start(fakeRegistration(true));
    render(<Frame />);
    check();
    await waitFor(() => expect(pwa.updateSW).toHaveBeenCalledWith(true));
  });

  // Purpose: Check with a form on screen doesn't reload; a pop-up says to finish first, and Keep working closes it.
  it('at risk, opens the pop-up and does not reload', async () => {
    start(fakeRegistration(true));
    render(
      <Frame>
        <form>
          <input aria-label="Name" />
        </form>
      </Frame>,
    );
    check();
    const popUp = await screen.findByRole('dialog', { name: 'A new version is ready' });
    expect(popUp.textContent).toContain("Finish or leave what you're typing first, then check again.");
    expect(pwa.updateSW).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep working' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // Purpose: Check with Your campaigns' real invite-code form on screen and nothing typed reloads into the new version,
  // with no pop-up (ruled 2026-11-19): the form carries the standing-form marker.
  it('reloads at once with the empty invite-code form on screen', async () => {
    start(fakeRegistration(true));
    render(
      <Frame>
        <InviteCodeBox onCode={() => undefined} />
      </Frame>,
    );
    expect(screen.getByLabelText('Have an invite code?').closest('form')!.hasAttribute('data-standing-form')).toBe(true);
    check();
    await waitFor(() => expect(pwa.updateSW).toHaveBeenCalledWith(true));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // Purpose: with a code typed in the invite-code form, Check doesn't reload; the pop-up says to finish first.
  it('holds with a code typed in the invite-code form', async () => {
    start(fakeRegistration(true));
    render(
      <Frame>
        <InviteCodeBox onCode={() => undefined} />
      </Frame>,
    );
    fireEvent.change(screen.getByLabelText('Have an invite code?'), { target: { value: 'BOG-42' } });
    check();
    expect(await screen.findByRole('dialog', { name: 'A new version is ready' })).toBeTruthy();
    expect(pwa.updateSW).not.toHaveBeenCalled();
  });

  // Purpose: Check while offline says so in a plain toast (offline is a state, not an error), and doesn't ask the server.
  it('offline, says to try again when back online, as a plain toast', async () => {
    const reg = start();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<Frame />);
    check();
    const words = await screen.findByText("You're offline. Try again when you're back online.");
    expect(words.closest('.toast')!.getAttribute('role')).toBe('status');
    expect(reg.update).not.toHaveBeenCalled();
  });

  // Purpose: online but the server can't be reached, Check says it couldn't check, not that the device is offline.
  it("says it couldn't check when the server can't be reached", async () => {
    const reg = start();
    reg.update.mockRejectedValueOnce(new Error('network'));
    render(<Frame />);
    check();
    expect(await screen.findByText("Couldn't check just now. Try again in a moment.")).toBeTruthy();
    expect(screen.queryByText("You're offline. Try again when you're back online.")).toBeNull();
  });

  // Purpose: with no service worker registered yet, Check never says "You're on the latest version." without asking.
  it("says it couldn't check, not current, before any registration", async () => {
    keepAppUpdated(registerSW);
    render(<Frame />);
    check();
    expect(await screen.findByText("Couldn't check just now. Try again in a moment.")).toBeTruthy();
    expect(screen.queryByText("You're on the latest version.")).toBeNull();
  });

  // Purpose: while the check runs, a brief "Checking for a new version…" shows, and the answer replaces it.
  it('says "Checking for a new version…" until the answer replaces it', async () => {
    const reg = start();
    let answer = () => undefined as void;
    reg.update.mockImplementationOnce(() => new Promise<void>((resolve) => (answer = resolve)));
    render(<Frame />);
    check();
    expect(screen.getByText('Checking for a new version…')).toBeTruthy();
    await waitFor(() => expect(reg.update).toHaveBeenCalled());
    await act(async () => answer());
    expect(await screen.findByText("You're on the latest version.")).toBeTruthy();
    expect(screen.queryByText('Checking for a new version…')).toBeNull();
  });

  // Purpose: when the answer is the at-risk pop-up, "Checking for a new version…" goes as the pop-up opens.
  it('takes "Checking…" down when the pop-up answers', async () => {
    start(fakeRegistration(true));
    render(
      <Frame>
        <form />
      </Frame>,
    );
    check();
    await screen.findByRole('dialog', { name: 'A new version is ready' });
    expect(screen.queryByText('Checking for a new version…')).toBeNull();
  });

  // Purpose: another toast that arrives during a slow check keeps its Undo: the check's answer replaces only its own
  // "Checking…" toast, and is dropped when another has taken over.
  it("never knocks out another toast's Undo", async () => {
    const reg = start();
    let answer = () => undefined as void;
    reg.update.mockImplementationOnce(() => new Promise<void>((resolve) => (answer = resolve)));
    function Drop() {
      const show = useToast();
      return (
        <button type="button" onClick={() => show({ text: 'Dropped 3 torches', onUndo: () => undefined })}>
          Drop
        </button>
      );
    }
    render(
      <Frame>
        <Drop />
      </Frame>,
    );
    check();
    await waitFor(() => expect(reg.update).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Drop' }));
    await act(async () => answer());
    expect(screen.getByText('Dropped 3 torches')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.queryByText("You're on the latest version.")).toBeNull();
  });

  // Purpose: if "Checking…" has gone by itself before a slow answer, the answer still shows (no toast to knock out).
  it('shows the answer when "Checking…" has already gone', async () => {
    const reg = start();
    let answer = () => undefined as void;
    reg.update.mockImplementationOnce(() => new Promise<void>((resolve) => (answer = resolve)));
    vi.useFakeTimers();
    render(<Frame />);
    check();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(reg.update).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(screen.queryByText('Checking for a new version…')).toBeNull();
    await act(async () => answer());
    expect(screen.getByText("You're on the latest version.")).toBeTruthy();
  });
});

describe('Check from inside the menus that hold it (review 2 on #613)', () => {
  // A version already waiting, held earlier by a box being typed in; the box has since been left.
  async function versionWaiting() {
    const box = document.createElement('input');
    document.body.appendChild(box);
    box.focus();
    act(() => pwa.options!.onNeedRefresh!());
    box.blur();
    box.remove();
    expect(pwa.updateSW).not.toHaveBeenCalled();
  }

  // Purpose: Check tapped inside the ⋯ Sheet, which closes on the tap, reloads into the waiting version (the Sheet
  // closing first doesn't count as an open pop-up).
  it('reloads from inside the MoreSheet', async () => {
    start();
    render(
      <ToastHost>
        <AppUpdateProvider>
          <MoreSheet label="More options">
            <AppVersionSection />
          </MoreSheet>
        </AppUpdateProvider>
      </ToastHost>,
    );
    await versionWaiting();
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('dialog', { name: 'More' })).toBeTruthy();
    check();
    await waitFor(() => expect(pwa.updateSW).toHaveBeenCalledWith(true));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // Purpose: Check tapped inside the phone's drawer (its foot unfolded), which closes on the tap, reloads into the
  // waiting version.
  it('reloads from inside the drawer', async () => {
    start();
    function Drawer() {
      const [open, setOpen] = useState(true);
      return open ? <ShellDrawer title="Reedmouth" onYourCampaigns={() => undefined} onClose={() => setOpen(false)} /> : null;
    }
    render(
      <ToastHost>
        <AppUpdateProvider>
          <Drawer />
        </AppUpdateProvider>
      </ToastHost>,
    );
    await versionWaiting();
    fireEvent.click(screen.getByRole('button', { name: /App settings, sign out/ }));
    check();
    await waitFor(() => expect(pwa.updateSW).toHaveBeenCalledWith(true));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the notice (au-2)', () => {
  // Purpose: a new version that arrives while nothing is at risk switches at once, with no notice.
  it('does not appear when the version switched at once', () => {
    start();
    render(<Frame />);
    act(() => pwa.options!.onNeedRefresh!());
    expect(pwa.updateSW).toHaveBeenCalledWith(true);
    expect(screen.queryByText('A new version is ready.')).toBeNull();
  });

  // Purpose: a version held back by an open form brings the notice; its Reload, with the form still open, brings the
  // pop-up and doesn't reload.
  it('appears only when the version is held, and its Reload obeys the rule', async () => {
    start();
    render(
      <Frame>
        <form>
          <input aria-label="Name" />
        </form>
      </Frame>,
    );
    expect(screen.queryByText('A new version is ready.')).toBeNull();
    act(() => pwa.options!.onNeedRefresh!());
    expect(await screen.findByText('A new version is ready.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(await screen.findByRole('dialog', { name: 'A new version is ready' })).toBeTruthy();
    expect(pwa.updateSW).not.toHaveBeenCalled();
  });

  // Purpose: once the form is gone, the notice's Reload switches to the new version.
  it('Reload switches once nothing is at risk', async () => {
    start();
    const { rerender } = render(
      <Frame>
        <form>
          <input aria-label="Name" />
        </form>
      </Frame>,
    );
    act(() => pwa.options!.onNeedRefresh!());
    await screen.findByText('A new version is ready.');
    rerender(<Frame />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(pwa.updateSW).toHaveBeenCalledWith(true);
  });

  // Purpose: the notice never covers a toast already showing; it waits for that toast to go.
  it('waits for a showing toast to go first', () => {
    vi.useFakeTimers();
    start();
    function Dropped() {
      const show = useToast();
      useEffect(() => show({ text: 'Dropped 3 torches', onUndo: () => undefined }), [show]);
      return <form />;
    }
    render(
      <Frame>
        <Dropped />
      </Frame>,
    );
    act(() => pwa.options!.onNeedRefresh!());
    expect(screen.getByText('Dropped 3 torches')).toBeTruthy();
    expect(screen.queryByText('A new version is ready.')).toBeNull();
    act(() => vi.advanceTimersByTime(8_000));
    expect(screen.getByText('A new version is ready.')).toBeTruthy();
  });

  // Purpose: after Keep working on the at-risk pop-up, the notice doesn't follow at once (the pop-up has said it).
  it('does not follow the pop-up with the same news', async () => {
    start(fakeRegistration(true));
    render(
      <Frame>
        <form />
      </Frame>,
    );
    check();
    await screen.findByRole('dialog', { name: 'A new version is ready' });
    expect(screen.queryByText('A new version is ready.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Keep working' }));
    await act(async () => undefined);
    expect(screen.queryByText('A new version is ready.')).toBeNull();
  });

  // Purpose: the notice comes back each time the app returns to the screen while the version is still held (creation
  // open holds it even off screen), shows once creation closes, and goes again with the toast's time (never stays).
  it('comes back on each return to the screen while held, and never stays', () => {
    vi.useFakeTimers();
    start();
    const creation = <section data-creation="open" />;
    const { rerender } = render(<Frame>{creation}</Frame>);
    act(() => pwa.options!.onNeedRefresh!());
    for (let pass = 0; pass < 3; pass += 1) {
      rerender(<Frame>{creation}</Frame>);
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      // Creation still open: held, and the notice waits.
      expect(pwa.updateSW).not.toHaveBeenCalled();
      expect(screen.queryByText('A new version is ready.')).toBeNull();
      rerender(<Frame />);
      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.getByText('A new version is ready.')).toBeTruthy();
      act(() => vi.advanceTimersByTime(8_000));
      expect(screen.queryByText('A new version is ready.')).toBeNull();
    }
  });

  // Purpose: the notice waits while a pop-up or creation is open (it would sit over their foot buttons).
  it('waits while a pop-up is open', () => {
    vi.useFakeTimers();
    start();
    const { rerender } = render(
      <Frame>
        <form />
        <div role="dialog" aria-label="Give" />
      </Frame>,
    );
    act(() => pwa.options!.onNeedRefresh!());
    expect(screen.queryByText('A new version is ready.')).toBeNull();
    rerender(
      <Frame>
        <form />
      </Frame>,
    );
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText('A new version is ready.')).toBeTruthy();
  });
});
