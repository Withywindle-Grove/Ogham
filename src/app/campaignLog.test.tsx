// @vitest-environment jsdom
// The log from the top row (ruled 2026-10-23; full screen everywhere, 2026-10-24): over the screen, which keeps
// its place; it follows a finger dragged down from its top and closes on a long enough drag. Live updates: a new
// log entry from any device reloads the screens behind, once per burst.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../core/commands.ts';
import type { Db } from '../core/supabase.ts';
import { CampaignLog, LogButton, useLogVersion } from './campaignLog.tsx';

// The log itself is tested elsewhere; here it's a stand-in that can report an undo.
vi.mock('./LogView.tsx', () => ({
  LogView: ({ onChanged }: { onChanged?: () => void }) => (
    <section aria-label="Log">
      <h2>Log</h2>
      <button type="button" onClick={onChanged}>
        Undo
      </button>
    </section>
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const user = { id: 'user-sam', roles: {} } as unknown as CurrentUser;
// A stand-in for the live connection: `arrive` plays a new log entry from another device.
const listeners = new Set<(payload: { new: Record<string, unknown> }) => void>();
const arrive = (targetTable = 'actors') => {
  for (const listener of listeners) listener({ new: { target_table: targetTable } });
};
const db = {
  channel: () => {
    let listener: ((payload: { new: Record<string, unknown> }) => void) | null = null;
    const channel = {
      on: (_kind: string, _filter: unknown, onNew: (payload: { new: Record<string, unknown> }) => void) => {
        listener = onNew;
        return channel;
      },
      subscribe: () => {
        if (listener) listeners.add(listener);
        return channel;
      },
      unsubscribe: () => listener && listeners.delete(listener),
    };
    return channel;
  },
  removeChannel: async (channel: { unsubscribe: () => void }) => channel.unsubscribe(),
} as unknown as Db;

/** A screen with something typed into it and its own count of undos, the way a real screen keeps its place. */
function Screen() {
  const [typed, setTyped] = useState('');
  const version = useLogVersion();
  return (
    <main>
      <LogButton />
      <label>
        Draft
        <input value={typed} onChange={(event) => setTyped(event.target.value)} />
      </label>
      <p>Reloaded {version} times</p>
    </main>
  );
}

function app() {
  return render(
    <CampaignLog db={db} user={user} campaignId="campaign-reedmouth">
      <Screen />
    </CampaignLog>,
  );
}

const drag = (handle: HTMLElement, from: number, to: number) => {
  fireEvent.pointerDown(handle, { clientY: from, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientY: to, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientY: to, pointerId: 1 });
};

describe('the Log button in the top row', () => {
  it('shows only inside a campaign', () => {
    render(<LogButton />);
    expect(screen.queryByRole('button', { name: 'Log' })).toBeNull();
    cleanup();
    app();
    expect(screen.getByRole('button', { name: 'Log' })).toBeTruthy();
  });

  it('opens full screen over the screen; closing it leaves the screen as it was', async () => {
    const person = userEvent.setup();
    app();
    await person.type(screen.getByLabelText('Draft'), 'Owes the ferryman');
    await person.click(screen.getByRole('button', { name: 'Log' }));
    expect(screen.getByRole('dialog', { name: 'Log' }).className).toBe('log-panel');
    // The screen behind is still there, untouched.
    expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('Owes the ferryman');

    await person.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Log' })).toBeNull();
    expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('Owes the ferryman');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Log' }));
  });

  it('follows a finger dragged down from its top; a short drag springs back, a long one closes it', async () => {
    const person = userEvent.setup();
    app();
    await person.click(screen.getByRole('button', { name: 'Log' }));
    const top = screen.getByTestId('log-sheet-handle');
    fireEvent.pointerDown(top, { clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(top, { clientY: 70, pointerId: 1 });
    expect(screen.getByRole('dialog', { name: 'Log' }).style.transform).toBe('translateY(30px)');
    fireEvent.pointerUp(top, { clientY: 70, pointerId: 1 });
    expect(screen.getByRole('dialog', { name: 'Log' }).style.transform).toBe('');
    // Dragging up does nothing: it's already full screen.
    drag(top, 300, 100);
    expect(screen.getByRole('dialog', { name: 'Log' })).toBeTruthy();
    drag(top, 40, 300);
    expect(screen.queryByRole('dialog', { name: 'Log' })).toBeNull();
  });

  it('tapping outside or Escape closes it; tapping inside doesn’t', async () => {
    const person = userEvent.setup();
    app();
    await person.click(screen.getByRole('button', { name: 'Log' }));
    await person.click(screen.getByRole('heading', { name: 'Log' }));
    expect(screen.getByRole('dialog', { name: 'Log' })).toBeTruthy();
    await person.click(screen.getByRole('dialog', { name: 'Log' }).parentElement!);
    expect(screen.queryByRole('dialog', { name: 'Log' })).toBeNull();

    await person.click(screen.getByRole('button', { name: 'Log' }));
    await person.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Log' })).toBeNull();
  });

  it('a new log entry from another device reloads the screen behind, once for a burst', async () => {
    vi.useFakeTimers();
    try {
      app();
      expect(screen.getByText('Reloaded 0 times')).toBeTruthy();
      act(() => {
        arrive();
        arrive();
        arrive();
      });
      expect(screen.getByText('Reloaded 0 times')).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByText('Reloaded 1 times')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('an undo in the log reloads the screen behind in place', async () => {
    const person = userEvent.setup();
    app();
    expect(screen.getByText('Reloaded 0 times')).toBeTruthy();
    await person.click(screen.getByRole('button', { name: 'Log' }));
    await person.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('Reloaded 1 times')).toBeTruthy();
  });

  it('after an undo, focus stays where it was in the log', async () => {
    const person = userEvent.setup();
    app();
    await person.click(screen.getByRole('button', { name: 'Log' }));
    await person.click(screen.getByRole('button', { name: 'Undo' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undo' }));
  });

  it('Tab moves round the log and doesn’t leave it while it’s open', async () => {
    const person = userEvent.setup();
    app();
    await person.click(screen.getByRole('button', { name: 'Log' }));
    await person.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    await person.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undo' }));
    await person.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    await person.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undo' }));
  });

  it('the page behind doesn’t scroll while the log is open, and scrolls again after', async () => {
    const person = userEvent.setup();
    app();
    await person.click(screen.getByRole('button', { name: 'Log' }));
    expect(document.body.style.overflow).toBe('hidden');
    await person.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.body.style.overflow).toBe('');
  });
});
