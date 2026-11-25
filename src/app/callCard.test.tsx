// @vitest-environment jsdom
// The call card and its folded row (P7; page 18's PL4b, page 40's 40A to 40C, approved 2026-11-24). Invented words.
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callsInSlot, type CallSend } from '../modules/library/callCards.ts';
import { CallCard, CallsInPromptSlot } from './CallCard.tsx';

afterEach(cleanup);

const send = (id: string, createdAt: string, extra: Partial<CallSend> = {}): CallSend => ({
  id,
  campaignId: 'c',
  kind: 'hook',
  actorId: null,
  actorName: null,
  playerUserId: null,
  body: '“The harbour office wants the manifest of the cog on the bar.”',
  pays: '',
  createdAt,
  ...extra,
});

describe('the call card (40A)', () => {
  // Purpose: the card shows its heading, its words, one "Pays" line when the send pays, and one plain "Got it".
  it('shows the heading, the words, "Pays" and Got it', async () => {
    const onGotIt = vi.fn();
    render(<CallCard send={send('a', 't', { pays: '50 crowns.' })} onGotIt={onGotIt} />);
    expect(screen.getByRole('heading', { name: 'A call to adventure, for the party' })).toBeTruthy();
    expect(screen.getByText(/manifest of the cog/)).toBeTruthy();
    expect(screen.getByText('Pays').parentElement!.textContent).toBe('Pays50 crowns.');
    const button = screen.getByRole('button', { name: 'Got it: A call to adventure, for the party' });
    expect(button.className).not.toContain('button-primary');
    await userEvent.click(button);
    expect(onGotIt).toHaveBeenCalledTimes(1);
  });

  // Purpose: a call with no pays shows no "Pays" line (p7-5), and neither does a rumour (40A); no source line (p7-6).
  it('shows no "Pays" line without one, nor for a rumour, and no source line', () => {
    render(
      <>
        <CallCard send={send('a', 't')} onGotIt={() => {}} />
        <CallCard send={send('b', 't', { kind: 'rumour', pays: 'stray words' })} onGotIt={() => {}} />
      </>,
    );
    expect(screen.queryByText('Pays')).toBeNull();
    expect(screen.queryByText('stray words')).toBeNull();
    expect(screen.getByRole('heading', { name: 'A rumour, for the party' })).toBeTruthy();
    expect(screen.queryByText(/^From /)).toBeNull();
  });
});

describe('the slot’s calls (40B, 40C)', () => {
  const three = [send('a', '2026-11-24T19:00:00Z'), send('b', '2026-11-24T19:10:00Z', { kind: 'rumour' }), send('c', '2026-11-24T19:20:00Z')];

  // Purpose: one card at a time, "1 of 3" on its quiet line, and Got it names the card it is on.
  it('shows the oldest card with its count', async () => {
    const onGotIt = vi.fn();
    render(<CallsInPromptSlot calls={callsInSlot(three, new Map())} onGotIt={onGotIt} />);
    expect(screen.getAllByRole('button', { name: /^Got it/ })).toHaveLength(1);
    expect(screen.getByText('1 of 3')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /^Got it/ }));
    expect(onGotIt).toHaveBeenCalledWith(three[0]);
  });

  // Purpose: after Got it the call folds to one row under the card; a tap reads it again with no button, a tap folds it.
  // The row's name stays the same open or folded (its state is said once, by aria-expanded; audit finding 3), and it
  // names the card it opens; the reopened card is not a live region, so reading it again announces nothing (finding 2).
  it('folds a seen call to a row that reads it again and folds it again', async () => {
    render(<CallsInPromptSlot calls={callsInSlot(three, new Map([['a', '2026-11-24T20:00:00Z']]))} onGotIt={() => {}} />);
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    const row = screen.getByRole('button', { name: 'A call to adventure, for the party' });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'A call to adventure, for the party' })).toBe(row);
    const card = document.getElementById(row.getAttribute('aria-controls') ?? '');
    expect(card?.textContent).toContain('manifest of the cog');
    expect(card?.getAttribute('role')).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    // The reopened card has no Got it of its own (p7-10): still only the unseen card's.
    expect(screen.getAllByRole('button', { name: /^Got it/ })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'A call to adventure, for the party' })).toHaveLength(1);
    await userEvent.click(row);
    expect(screen.queryByRole('heading', { name: 'A call to adventure, for the party' })).toBeNull();
  });

  // Purpose (audit finding 1): after Got it by keyboard, focus goes to the next card's Got it, so the player keeps their
  // place; with no card left, to the row the seen call folded to. Never to the page's top.
  it('moves focus to the next Got it, then to the folded row', async () => {
    function Slot() {
      const [seen, setSeen] = useState(new Map<string, string>());
      return <CallsInPromptSlot calls={callsInSlot(three.slice(0, 2), seen)} onGotIt={(s) => setTimeout(() => setSeen((m) => new Map(m).set(s.id, '2026-11-24T20:00:00Z')), 0)} />;
    }
    render(<Slot />);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Got it: A call to adventure, for the party' }));
    await user.keyboard('{Enter}');
    const next = await screen.findByRole('button', { name: 'Got it: A rumour, for the party' });
    await vi.waitFor(() => expect(document.activeElement).toBe(next));
    await user.keyboard('{Enter}');
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: /^Got it/ })).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'A rumour, for the party' })));
  });
});

describe('the second audit (Home Two, findings 1 to 4, picked 24 Nov)', () => {
  // Purpose (finding 1): the card reads heading, then Got it, then the words, so a screen reader meets the heading first
  // and once; the live region's text starts with the heading.
  it('reads the heading first, then Got it, then the words', () => {
    render(<CallsInPromptSlot calls={callsInSlot([send('a', '2026-11-24T19:00:00Z', { pays: '50 crowns.' })], new Map())} onGotIt={() => {}} />);
    const heading = screen.getByRole('heading', { name: 'A call to adventure, for the party' });
    const button = screen.getByRole('button', { name: /^Got it/ });
    const words = screen.getByText(/manifest of the cog/);
    expect(heading.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.compareDocumentPosition(words) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('status').textContent?.startsWith('A call to adventure, for the party')).toBe(true);
  });

  // Purpose (finding 3): after Got it the next card's words go into the live region that stood before it, so a touch
  // screen reader announces the second call; focus still goes to the next Got it.
  it('announces the next call in the live region that stood before it', async () => {
    const two = [send('a', '2026-11-24T19:00:00Z'), send('b', '2026-11-24T19:10:00Z', { kind: 'rumour', body: '“A light was seen on the wreck.”' })];
    function Slot() {
      const [seen, setSeen] = useState(new Map<string, string>());
      return <CallsInPromptSlot calls={callsInSlot(two, seen)} onGotIt={(s) => setSeen((m) => new Map(m).set(s.id, '2026-11-24T20:00:00Z'))} />;
    }
    render(<Slot />);
    const live = screen.getByRole('status');
    expect(live.textContent).toContain('manifest of the cog');
    await userEvent.click(screen.getByRole('button', { name: 'Got it: A call to adventure, for the party' }));
    const next = await screen.findByRole('button', { name: 'Got it: A rumour, for the party' });
    expect(screen.getByRole('status')).toBe(live);
    expect(live.textContent).toContain('A light was seen on the wreck.');
    expect(live.textContent).not.toContain('manifest of the cog');
    await vi.waitFor(() => expect(document.activeElement).toBe(next));
  });

  // Purpose (finding 4): the folded row names the card it opens in aria-controls only while that card is open; folded,
  // there is no card to name.
  it('sets aria-controls only while the row is open', async () => {
    render(<CallsInPromptSlot calls={callsInSlot([send('a', '2026-11-24T19:00:00Z')], new Map([['a', '2026-11-24T20:00:00Z']]))} onGotIt={() => {}} />);
    const row = screen.getByRole('button', { name: 'A call to adventure, for the party' });
    expect(row.hasAttribute('aria-controls')).toBe(false);
    await userEvent.click(row);
    expect(document.getElementById(row.getAttribute('aria-controls') ?? '')?.textContent).toContain('manifest of the cog');
    await userEvent.click(row);
    expect(row.hasAttribute('aria-controls')).toBe(false);
  });
});

describe('the last audit (Home Two, new finding 1, the driver’s call 25 Nov)', () => {
  // Purpose: with no calls the slot's live region is already on the page, empty, so the session's first call is a change
  // inside a region the screen reader already watches: after the call arrives its words are inside that same element.
  it('keeps the empty live region mounted, and the first call arrives inside it', () => {
    const { rerender } = render(<CallsInPromptSlot calls={callsInSlot([], new Map())} onGotIt={() => {}} />);
    const live = document.querySelector('.calls-slot__live');
    expect(live).not.toBeNull();
    expect(live!.textContent).toBe('');
    expect(live!.getAttribute('role')).toBe('status');
    rerender(<CallsInPromptSlot calls={callsInSlot([send('a', '2026-11-24T19:00:00Z')], new Map())} onGotIt={() => {}} />);
    expect(document.querySelector('.calls-slot__live')).toBe(live);
    expect(live!.textContent).toContain('manifest of the cog');
  });
});
