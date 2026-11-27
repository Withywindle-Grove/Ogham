// @vitest-environment jsdom
// K18b of docs/plans/dec-6-the-whole-pack-tab.md: the find card as a part (page 45, FD1, FD1c, FD3, FD3b, FD3c, FD4b,
// FD5c, FD9, FD11, approved 2026-11-26; PK2, PK2b, PK3, approved 2026-11-14). It draws what it is given (K20a's entries
// and the words K18a needs) and reads nothing. The sizes, the 44 px targets and the height in a real browser are
// tests/layout/findCardPart.spec.ts's. Invented names only.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FindCardWords } from '../modules/characters/findCard.ts';
import type { CoinFind, FindEntry, ThingFind } from '../modules/characters/findsSeen.ts';
import { FindCard } from './FindCard.tsx';

afterEach(cleanup);

const NOW = '2026-12-06T20:00:00.000Z';
const AGO = '2026-12-06T19:59:00.000Z';
const words: FindCardWords = {
  names: new Map([['tam', 'Tam']]), // words: names
  coinWords: (coins) => Object.entries(coins).map(([k, v]) => `${v.toLocaleString('en-GB')} ${k}`).join(', '),
  when: () => 'today',
  now: NOW,
};
let seq = 0;
const thing = (name: string, o: Partial<ThingFind> = {}): ThingFind => ({
  kind: 'thing', lineId: `l${++seq}`, name, arrived: 1, now: null, who: { kind: 'gm' }, at: AGO, takenBack: null, ...o,
});
const coin = (o: Partial<CoinFind> = {}): CoinFind => ({
  kind: 'coin', purseId: 'p', coins: { herons: 240 }, who: { kind: 'gm' }, at: AGO, takenBack: null, ...o,
});
const BACK = { byGm: true, at: NOW };
const none = () => {};
const draw = (entries: FindEntry[], extra: { offlineBox?: boolean; onGotIt?: () => void; onMore?: () => void } = {}) =>
  render(<FindCard entries={entries} words={words} onGotIt={extra.onGotIt ?? none} onMore={extra.onMore ?? none} offlineBox={extra.offlineBox} />);

describe('the find card (K18b)', () => {
  // Purpose: with nothing new the part draws nothing at all.
  it('draws nothing for no finds', () => {
    const { container } = draw([]);
    expect(container.innerHTML).toBe('');
  });

  // Purpose: one thing reads as FD1 draws it: the head, the thing's name, who and when under it, and "Got it" beside
  // that one line (p45-14), not at a foot of its own.
  it('one thing: the head, its line, and "Got it" beside the line', () => {
    const { container } = draw([thing('Bronze ring')]);
    expect(screen.getByRole('heading', { name: 'New in your pack' })).toBeTruthy();
    expect(screen.getByText('Bronze ring')).toBeTruthy();
    expect(screen.getByText('From your GM, just now.')).toBeTruthy();
    const one = container.querySelector('.find-card__one')!;
    expect(one).not.toBeNull();
    expect(within(one as HTMLElement).getByRole('button', { name: /Got it/ })).toBeTruthy();
    expect(container.querySelector('.find-card__foot')).toBeNull();
  });

  // Purpose: "Got it" is one plain stacked button, never the screen's accent (p45-4), and a tap on it calls onGotIt.
  it('"Got it" is plain, never the accent, and its tap is handed up', async () => {
    const onGotIt = vi.fn();
    draw([thing('Bronze ring'), thing('Moon opals', { arrived: 2 })], { onGotIt });
    const got = screen.getByRole('button', { name: /Got it/ });
    expect(got.className).toContain('button-secondary');
    expect(got.className).not.toContain('button-primary');
    expect(document.querySelectorAll('.button-primary')).toHaveLength(0);
    await userEvent.click(got);
    expect(onGotIt).toHaveBeenCalledTimes(1);
  });

  // Purpose: a card of several keeps "Got it" on a row of its own at the foot (p45-27).
  it('several things: "Got it" at the foot', () => {
    const { container } = draw([thing('Bronze ring'), thing('Moon opals', { arrived: 2 })]);
    expect(container.querySelector('.find-card__one')).toBeNull();
    expect(within(container.querySelector('.find-card__foot') as HTMLElement).getByRole('button', { name: /Got it/ })).toBeTruthy();
  });

  // Purpose: from five, "and N more" is a button with its own name, apart from "Got it"'s; its tap calls onMore only
  // (p45-16: it opens the Pack at the new rows and clears nothing).
  it('"and N more" is its own button, and its tap clears nothing', async () => {
    const onGotIt = vi.fn();
    const onMore = vi.fn();
    draw(['A', 'B', 'C', 'D', 'E'].map((x) => thing(`Boat hook ${x}`)), { onGotIt, onMore });
    expect(screen.getByRole('heading', { name: '5 new things' })).toBeTruthy();
    const more = screen.getByRole('button', { name: /^and 2 more/ });
    expect(more.getAttribute('aria-label')).not.toBe(screen.getByRole('button', { name: /Got it/ }).getAttribute('aria-label'));
    await userEvent.click(more);
    expect(onMore).toHaveBeenCalledTimes(1);
    expect(onGotIt).not.toHaveBeenCalled();
  });

  // Purpose: the card is a status region, so its arrival and its changes are read out (06, Find card).
  it('is a status region holding the card', () => {
    draw([thing('Bronze ring')]);
    const live = screen.getByRole('status');
    expect(within(live).getByRole('heading', { name: 'New in your pack' })).toBeTruthy();
  });

  // Purpose: a giver and time every line shares are said once under the head, and not again on the lines (p45-7).
  it('a shared giver and time: said once', () => {
    draw([coin(), thing('Moon opals', { arrived: 2 })]);
    expect(screen.getAllByText(/From your GM, just now\./)).toHaveLength(1);
    expect(screen.getByText('In your coin.')).toBeTruthy();
  });

  // Purpose: a find that joins a stack reads what arrived in the name's bold and ", now 8" in the plain weight (p45-22).
  it('the stack line: what arrived in bold, the new count plain', () => {
    const { container } = draw([thing('River pearls', { arrived: 2, now: 8 })]);
    const bold = container.querySelector('.find-card__name')!;
    expect(bold.textContent).toBe('River pearls ×2');
    expect(bold.parentElement!.textContent).toBe('River pearls ×2, now 8');
    expect(container.querySelector('.find-card__now')!.textContent).toBe(', now 8');
  });

  // Purpose: coin alone heads "New in your coin" with its amount in the setting's words (FD4b).
  it('coin alone', () => {
    draw([coin({ coins: { crowns: 3, herons: 999_999_999 } })]);
    expect(screen.getByRole('heading', { name: 'New in your coin' })).toBeTruthy();
    expect(screen.getByText('3 crowns, 999,999,999 herons')).toBeTruthy();
  });

  // Purpose: a find taken back is a quiet line in its own place, the words p45-25 gives, and not a tap.
  it('one taken back of two: its line turns quiet in the same place, not a tap', () => {
    const { container } = draw([thing('Bronze ring', { takenBack: BACK, lineId: null }), thing('Moon opals', { arrived: 2 })]);
    const lines = [...container.querySelectorAll('.find-card__line')];
    expect(lines).toHaveLength(2);
    const quiet = lines[0]!.querySelector('.find-card__back')!;
    expect(quiet.textContent).toBe('Your GM took back the Bronze ring.');
    expect(quiet.closest('button')).toBeNull();
    expect(lines[1]!.textContent).toContain('Moon opals ×2');
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  // Purpose: a quiet line holds the room its find took (p45-25): the find's line stays under it, hidden from sight and
  // from a screen reader, so the line is never shorter than it was and "Got it" does not move.
  it('a quiet line keeps its find line as a hidden ghost, so its height holds', () => {
    const { container } = draw([
      thing('Bronze ring', { takenBack: BACK, lineId: null }),
      thing('Silver key', { who: { kind: 'character', characterId: 'tam' }, at: '2026-12-04T10:00:00.000Z' }),
    ]);
    const ghost = container.querySelector('.find-card__line .find-card__ghost')!;
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(ghost.textContent).toBe('Bronze ringFrom your GM, just now.');
  });

  // Purpose: when both are taken back the card is still drawn, with its head and two quiet lines, and "Got it" (F8).
  it('both taken back: the card stays, two quiet lines and "Got it"', () => {
    draw([thing('Bronze ring', { takenBack: BACK, lineId: null }), thing('Moon opals', { arrived: 2, takenBack: BACK, lineId: null })]);
    expect(screen.getByRole('heading', { name: 'New in your pack' })).toBeTruthy();
    expect(screen.getByText('Your GM took back the Bronze ring.')).toBeTruthy();
    expect(screen.getByText('Your GM took back the Moon opals ×2.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Got it/ })).toBeTruthy();
  });

  // Purpose: when the things under "and N more" are all taken back the row's room stays, empty and hidden, so "Got it"
  // does not move (p45-25); no "and 0 more" is ever said.
  it('"and N more" at none: its room is held, nothing said', () => {
    const entries = [
      thing('A'), thing('B'), thing('C'),
      thing('D', { takenBack: BACK, lineId: null }), thing('E', { takenBack: BACK, lineId: null }),
    ];
    const { container } = draw(entries);
    expect(screen.queryByRole('button', { name: /more/ })).toBeNull();
    expect(container.textContent).not.toMatch(/and 0 more/);
    const held = container.querySelector('.find-card__more-held')!;
    expect(held.getAttribute('aria-hidden')).toBe('true');
  });

  // Purpose: offline, after a tap, the box under the card says why "Got it" waits (FD9, p45-12), inside the status region.
  it('the offline box', () => {
    draw([thing('Bronze ring')], { offlineBox: true });
    const live = screen.getByRole('status');
    expect(within(live).getByText('You’re offline. Got it waits until you’re back. Your new things are in your pack all the same.')).toBeTruthy();
  });

  // Purpose: with no offline tap there is no box.
  it('no box until it is asked for', () => {
    draw([thing('Bronze ring')]);
    expect(screen.queryByText(/You’re offline/)).toBeNull();
  });
});
