// @vitest-environment jsdom
// Creation's final drafts, slices D and F: the parts the steps share (mockups creation/final/04–08).
//   A given row (what the kindred or class gives) is marked Given and has no Pick button; its text still opens the entry.
//   Offline, a step that saves shows the sign and what it means at its top; Next is plain, and a tap repeats the line
//   instead of moving on (never disabled). A step kept on the device shows nothing.
//   Back online, the line goes and Next moves on.
//   Loading shows the line and skeleton rows the screen reader doesn't read as content.
//   A step opened from the review says "From the review"; with nothing changed both foot buttons read Back to review.
//   When picks were kept reads "today", "yesterday", the weekday within the week, else the date.
//   Sent back with one part ticked, the review shows that card with the warning sign and its line, the foot reads
//   "1 part marked" with Back and "Send to the GM" and no "Start over"; with none ticked, no card is marked; "Your GM
//   asks for a change" and the author line stay (clo-2, frame 22-G5).
//   Sent back, a marked card and an unmarked card each keep their own "Change", which opens that part's step; the card
//   itself is not a button, so no button sits inside another.
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keptWhen } from '../app/keptCreation.ts';
import { CreationLeave, CreationLoading, CreationStep, OFFLINE_LINE, PickRow, useBackWord } from './creation.tsx';
import { PinnedNote, ReviewScreen, type ReviewSection } from './organisms.tsx';
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

const sentBack = (sections: ReviewSection[], onBack: () => void, onAction: () => void, onOpenStep: (id: string) => void = () => {}) => (
  <ReviewScreen
    heading="Oswin Adderbald"
    note={
      <PinnedNote from="your GM" title="Your GM asks for a change" by="Maren, your GM, today">
        <p>Croak is not for a Stone kin in this campaign. Pick another tongue.</p>
      </PinnedNote>
    }
    sections={sections}
    action="Send to the GM"
    onOpenStep={onOpenStep}
    onAction={onAction}
    onBack={onBack}
  />
);

describe('the sent-back review (clo-2, frame 22-G5)', () => {
  // Purpose: sent back with one part ticked, the review shows that card with the warning sign and its line, the foot
  // reads "1 part marked" with Back and "Send to the GM" and no "Start over"; with none ticked, no card is marked;
  // "Your GM asks for a change" and the author line stay.
  it('marks the ticked card with the sign and its line; the foot reads 1 part marked, Back and Send to the GM, no Start over', async () => {
    const onBack = vi.fn();
    const onAction = vi.fn();
    const parts: ReviewSection[] = [
      { id: 'who', title: 'Kindred and class', lines: [{ text: 'Kindred: Stone kin' }] },
      { id: 'languages', title: 'Languages', flagged: true, lines: [{ text: 'Marsh-common, Stone-speech, Croak' }] },
      { id: 'skills', title: 'Weapon skills', lines: [{ text: 'Spear, sling' }] },
    ];
    const { container, rerender } = render(sentBack(parts, onBack, onAction));
    const note = screen.getByRole('complementary', { name: 'Note from your GM' });
    expect(note.textContent).toContain('Your GM asks for a change');
    expect(note.textContent).toContain('Maren, your GM, today');
    const marked = [...container.querySelectorAll('.review__section--flagged')];
    expect(marked).toHaveLength(1);
    expect(marked[0]!.textContent).toContain('Languages');
    expect(marked[0]!.querySelector('.review__flag .warning-sign')).not.toBeNull();
    expect(marked[0]!.querySelector('.review__flag')?.textContent?.trim()).toBe('Your GM asks for a change');
    const foot = container.querySelector('.review__foot') as HTMLElement;
    expect(foot.querySelector('.review__foot-state')?.textContent).toBe('1 part marked');
    expect([...foot.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Back', 'Send to the GM']);
    expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull();
    // One Send on the screen, in the foot: not also at the top.
    expect(screen.getAllByRole('button', { name: 'Send to the GM' })).toHaveLength(1);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Send to the GM' }));
    expect(onAction).toHaveBeenCalledOnce();
    // All three ticked: "3 parts marked". None ticked: no card marked, and no count.
    rerender(sentBack(parts.map((p) => ({ ...p, flagged: true })), onBack, onAction));
    expect(container.querySelector('.review__foot-state')?.textContent).toBe('3 parts marked');
    rerender(sentBack(parts.map((p) => ({ ...p, flagged: false })), onBack, onAction));
    expect(container.querySelectorAll('.review__section--flagged')).toHaveLength(0);
    expect(container.querySelector('.review__foot-state')).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Note from your GM' }).textContent).toContain('Maren, your GM, today');
  });

  // Purpose: sent back, a marked card and an unmarked card each keep their own "Change", which opens that part's step;
  // the card itself is not a button, so no button sits inside another.
  it('gives each card, marked or not, its own Change that opens its step; the cards are not buttons', async () => {
    const onOpenStep = vi.fn();
    const parts: ReviewSection[] = [
      { id: 'who', title: 'Kindred and class', lines: [{ text: 'Kindred: Stone kin' }] },
      { id: 'languages', title: 'Languages', flagged: true, lines: [{ text: 'Marsh-common, Stone-speech, Croak' }] },
    ];
    const { container } = render(sentBack(parts, () => {}, () => {}, onOpenStep));
    expect(container.querySelectorAll('button.review__section')).toHaveLength(0);
    expect(container.querySelectorAll('.review__section button')).toHaveLength(2);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Change Languages' }));
    expect(onOpenStep).toHaveBeenLastCalledWith('languages');
    await user.click(screen.getByRole('button', { name: 'Change Kindred and class' }));
    expect(onOpenStep).toHaveBeenLastCalledWith('who');
    expect(onOpenStep).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Change Languages' }).textContent).toBe('Change');
  });
});
