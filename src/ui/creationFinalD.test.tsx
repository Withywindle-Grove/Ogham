// @vitest-environment jsdom
// Creation's final drafts, slices D and F: the parts the steps share (mockups creation/final/04–08).
//   A given row (what the kindred or class gives) is marked Given and has no Pick button; its text still opens the entry.
//   Offline, a step that saves shows the sign and what it means at its top; Next is plain, and a tap repeats the line
//   instead of moving on (never disabled). A step kept on the device shows nothing.
//   Back online, the line goes and Next moves on.
//   Loading shows the line and skeleton rows the screen reader doesn't read as content.
//   A step opened from the review says "From the review"; with nothing changed both foot buttons read Back to review.
//   When picks were kept reads "today", "yesterday", the weekday within the week, else the date.
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keptWhen } from '../app/keptCreation.ts';
import { CreationLeave, CreationLoading, CreationStep, OFFLINE_LINE, PickRow, useBackWord } from './creation.tsx';
import { ToastHost } from './ToastHost.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a given row (final drafts D)', () => {
  it('reads Given where the Pick would be, has no Pick button, and its text opens the entry', async () => {
    const open = vi.fn();
    render(<PickRow name="Marsh light" blurb="A floating glow" picked given onPick={() => {}} onOpen={open} />);
    expect(screen.getByText('Given')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: /Marsh light/ }));
    expect(open).toHaveBeenCalledOnce();
  });
});

const step = (onNext: () => void, waitsOnline: boolean) => (
  <ToastHost>
    <CreationStep title="Languages" counter={{ at: 7, of: 9 }} why="The tongues you speak." help={null} onBack={() => {}} hint="0 of 1 picked" onNext={onNext} waitsOnline={waitsOnline}>
      <p>Rows</p>
    </CreationStep>
  </ToastHost>
);

describe('offline (final drafts F)', () => {
  it('shows the line at the top, makes Next plain, and a tap repeats the line instead of going on', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const onNext = vi.fn();
    render(step(onNext, true));
    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toContain('Offline. Next waits for the connection');
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next.className).not.toContain('button-primary');
    await userEvent.setup().click(next);
    expect(onNext).not.toHaveBeenCalled();
    expect((await screen.findAllByText(OFFLINE_LINE)).length).toBeGreaterThan(1);
  });

  it('back online, the line goes and Next moves on; a step kept on the device never shows it', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const onNext = vi.fn();
    const { rerender } = render(step(onNext, true));
    online.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.queryByText("You're offline")).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledOnce();
    online.mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event('offline')));
    rerender(step(onNext, false));
    expect(screen.queryByText("You're offline")).toBeNull();
  });
});

describe('loading (final drafts F)', () => {
  it('says what is loading, the skeleton rows hidden from a screen reader', () => {
    const { container } = render(<CreationLoading line="Loading your setting's rules…" delay={0} />);
    expect(screen.getByRole('status').textContent).toBe("Loading your setting's rules…");
    expect(container.querySelector('[aria-hidden="true"] .skeleton')).not.toBeNull();
  });

  // Purpose (final drafts F, creation follow-up): a quick load never flashes a skeleton: nothing shows for 300 ms,
  // then the line and the rows.
  it('waits 300 ms before the line and the skeleton show', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<CreationLoading line="Opening the review…" />);
      expect(screen.queryByRole('status')).toBeNull();
      expect(container.querySelector('.skeleton')).toBeNull();
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
      act(() => void vi.advanceTimersByTime(299));
      expect(screen.queryByRole('status')).toBeNull();
      act(() => void vi.advanceTimersByTime(1));
      expect(screen.getByRole('status').textContent).toBe('Opening the review…');
      expect(container.querySelector('.skeleton')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

function FromReview({ unchanged }: { unchanged: boolean }) {
  useBackWord('Back to review');
  return (
    <CreationStep title="Details" why="Touches that help the table picture them." help={null} onBack={() => {}} hint="Nothing filled yet" onNext={() => {}} nextLabel="Done" unchanged={unchanged}>
      <p>Rows</p>
    </CreationStep>
  );
}

describe('a step opened from the review (final drafts D, P22)', () => {
  // Purpose (22-G4, a fix): with nothing changed the foot has ONE Back to review (two buttons with one meaning became one)
  // and says "Nothing changed"; changed, Back (Back to review) and Next keeps its word.
  it('says From the review; with nothing changed one foot button reads Back to review, else Next keeps its word', () => {
    const { rerender } = render(
      <CreationLeave onLeave={() => {}}>
        <FromReview unchanged />
      </CreationLeave>,
    );
    expect(screen.getByText('From the review')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Back to review' })).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Step status' }).textContent).toBe('Nothing changed');
    rerender(
      <CreationLeave onLeave={() => {}}>
        <FromReview unchanged={false} />
      </CreationLeave>,
    );
    expect(screen.getAllByRole('button', { name: 'Back to review' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });
});

describe('when picks were kept (final drafts F)', () => {
  it('reads today, yesterday, the weekday within the week, else the date; nothing when unknown', () => {
    const now = new Date(2026, 10, 7, 10, 0);
    expect(keptWhen(new Date(2026, 10, 7, 8, 0).toISOString(), now)).toBe('today');
    expect(keptWhen(new Date(2026, 10, 6, 23, 0).toISOString(), now)).toBe('yesterday');
    expect(keptWhen(new Date(2026, 10, 5, 12, 0).toISOString(), now)).toBe('on Thursday');
    expect(keptWhen(new Date(2026, 9, 20, 12, 0).toISOString(), now)).toBe('on 20 October');
    expect(keptWhen(undefined, now)).toBe('');
    expect(keptWhen('not a date', now)).toBe('');
  });
});
