// @vitest-environment jsdom
// The call card and its folded row (P7; page 18's PL4b, page 40's 40A to 40C, approved 2026-11-24). Invented words.
import { cleanup, render, screen } from '@testing-library/react';
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
  it('folds a seen call to a row that reads it again and folds it again', async () => {
    render(<CallsInPromptSlot calls={callsInSlot(three, new Map([['a', '2026-11-24T20:00:00Z']]))} onGotIt={() => {}} />);
    expect(screen.getByText('1 of 2')).toBeTruthy();
    const row = screen.getByRole('button', { name: 'A call to adventure, for the party: read it again' });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(row.getAttribute('aria-label')).toBe('A call to adventure, for the party: fold away');
    // The reopened card has no Got it of its own (p7-10): still only the unseen card's.
    expect(screen.getAllByRole('button', { name: /^Got it/ })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'A call to adventure, for the party' })).toHaveLength(1);
    await userEvent.click(row);
    expect(screen.queryByRole('heading', { name: 'A call to adventure, for the party' })).toBeNull();
  });

  // Purpose: with no calls the slot takes no room.
  it('draws nothing with no calls', () => {
    const { container } = render(<CallsInPromptSlot calls={callsInSlot([], new Map())} onGotIt={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});
