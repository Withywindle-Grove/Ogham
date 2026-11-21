// The GM's queue of proposed ways (dec-7 piece 4, logic only; mc-42a, dp-4). Invented ids only.
import { describe, expect, it } from 'vitest';
import { EMPTY_PROPOSAL_QUEUE, proposalCount, proposalQueue, waitingRows, type ProposalQueue, type ProposalQueueEvent } from './proposalQueue.ts';

const arrive = (id: string, group: number): ProposalQueueEvent => ({ type: 'arrived', proposal: { id, group } });
const run = (events: ProposalQueueEvent[], from: ProposalQueue = EMPTY_PROPOSAL_QUEUE): ProposalQueue => events.reduce(proposalQueue, from);
const ids = (state: ProposalQueue) => state.proposals.map((p) => p.id);

describe('the GM queue of proposed ways', () => {
  it('an empty queue has nothing open and no count', () => {
    expect(EMPTY_PROPOSAL_QUEUE.openId).toBeNull();
    expect(proposalCount(EMPTY_PROPOSAL_QUEUE)).toBeNull();
    expect(waitingRows(EMPTY_PROPOSAL_QUEUE)).toEqual([]);
  });

  it('a proposal that arrives while nothing is open becomes the open one', () => {
    const state = run([arrive('a', 1)]);
    expect(state.openId).toBe('a');
    expect(proposalCount(state)).toEqual({ place: 1, total: 1 });
  });

  it('a proposal that arrives while a proposal is open joins the end of the queue, does not displace it, and the count updates', () => {
    const one = run([arrive('a', 1), arrive('b', 2)]);
    expect(one.openId).toBe('a');
    expect(ids(one)).toEqual(['a', 'b']);
    expect(proposalCount(one)).toEqual({ place: 1, total: 2 });
    const two = proposalQueue(one, arrive('c', 3));
    expect(two.openId).toBe('a');
    expect(ids(two)).toEqual(['a', 'b', 'c']);
    expect(proposalCount(two)).toEqual({ place: 1, total: 3 });
  });

  it('a proposal that arrives while some other sheet is open waits, and opens when that sheet closes', () => {
    const waiting = run([{ type: 'otherSheetOpened' }, arrive('a', 1)]);
    expect(waiting.openId).toBeNull();
    expect(ids(waiting)).toEqual(['a']);
    expect(proposalCount(waiting)).toBeNull();
    const opened = proposalQueue(waiting, { type: 'otherSheetClosed' });
    expect(opened.openId).toBe('a');
    expect(proposalCount(opened)).toEqual({ place: 1, total: 1 });
  });

  it('an answer (Yes or No) on the open one removes it and opens the next in line', () => {
    const yes = run([arrive('a', 1), arrive('b', 2), { type: 'answered', id: 'a' }]);
    expect(ids(yes)).toEqual(['b']);
    expect(yes.openId).toBe('b');
    expect(proposalCount(yes)).toEqual({ place: 1, total: 1 });
    const last = proposalQueue(yes, { type: 'answered', id: 'b' });
    expect(last.openId).toBeNull();
    expect(proposalCount(last)).toBeNull();
  });

  it('three proposals that arrive in order are opened and answered in that order', () => {
    let state = run([arrive('a', 1), arrive('b', 2), arrive('c', 3)]);
    const opened: string[] = [];
    while (state.openId) {
      opened.push(state.openId);
      state = proposalQueue(state, { type: 'answered', id: state.openId });
    }
    expect(opened).toEqual(['a', 'b', 'c']);
    expect(state.proposals).toEqual([]);
  });

  it('Not now keeps the open one as a waiting row in arrival order, never reopens it by itself, and opens the next not put off', () => {
    const state = run([arrive('a', 1), arrive('b', 2), arrive('c', 3), { type: 'notNow', id: 'a' }]);
    expect(state.openId).toBe('b');
    expect(ids(state)).toEqual(['a', 'b', 'c']);
    expect(waitingRows(state).map((p) => p.id)).toEqual(['a']);
    // Counted as described in the status file: the open one's place in arrival order among all not yet answered.
    expect(proposalCount(state)).toEqual({ place: 2, total: 3 });
    const next = run([{ type: 'answered', id: 'b' }], state);
    expect(next.openId).toBe('c');
    const done = proposalQueue(next, { type: 'answered', id: 'c' });
    expect(done.openId).toBeNull();
    expect(waitingRows(done).map((p) => p.id)).toEqual(['a']);
  });

  it('Not now on the only proposal leaves nothing open and the proposal as a waiting row', () => {
    const state = run([arrive('a', 1), { type: 'notNow', id: 'a' }]);
    expect(state.openId).toBeNull();
    expect(waitingRows(state).map((p) => p.id)).toEqual(['a']);
    expect(proposalCount(state)).toBeNull();
  });

  it('a proposal put off is not opened by itself when a new one arrives; the new one opens', () => {
    const state = run([arrive('a', 1), { type: 'notNow', id: 'a' }, arrive('b', 2)]);
    expect(state.openId).toBe('b');
    expect(proposalCount(state)).toEqual({ place: 2, total: 2 });
  });

  it('a tap on a waiting row makes it the open one; Not now on it puts it off again', () => {
    const tapped = run([arrive('a', 1), arrive('b', 2), { type: 'notNow', id: 'a' }, { type: 'answered', id: 'b' }, { type: 'tapped', id: 'a' }]);
    expect(tapped.openId).toBe('a');
    expect(waitingRows(tapped)).toEqual([]);
    expect(proposalCount(tapped)).toEqual({ place: 1, total: 1 });
    const again = proposalQueue(tapped, { type: 'notNow', id: 'a' });
    expect(again.openId).toBeNull();
    expect(waitingRows(again).map((p) => p.id)).toEqual(['a']);
  });

  it('a tap on a waiting row while another proposal or another sheet is open changes nothing (question in the status file)', () => {
    const busy = run([arrive('a', 1), { type: 'notNow', id: 'a' }, arrive('b', 2)]);
    expect(proposalQueue(busy, { type: 'tapped', id: 'a' })).toBe(busy);
    const other = run([arrive('a', 1), { type: 'notNow', id: 'a' }, { type: 'otherSheetOpened' }]);
    expect(proposalQueue(other, { type: 'tapped', id: 'a' })).toBe(other);
  });

  it('a withdrawn proposal leaves wherever it is; if it was open, the next in line opens', () => {
    const queued = run([arrive('a', 1), arrive('b', 2), arrive('c', 3), { type: 'withdrawn', id: 'b' }]);
    expect(ids(queued)).toEqual(['a', 'c']);
    expect(queued.openId).toBe('a');
    const putOff = run([arrive('a', 1), { type: 'notNow', id: 'a' }, arrive('b', 2), { type: 'withdrawn', id: 'a' }]);
    expect(ids(putOff)).toEqual(['b']);
    expect(putOff.openId).toBe('b');
    const open = run([arrive('a', 1), arrive('b', 2), { type: 'withdrawn', id: 'a' }]);
    expect(open.openId).toBe('b');
  });

  it('a new proposal from the same group replaces its last one wherever it was, and joins the end of the queue', () => {
    const queued = run([arrive('a', 1), arrive('b', 2), arrive('c', 3), arrive('b2', 2)]);
    expect(ids(queued)).toEqual(['a', 'c', 'b2']);
    expect(queued.openId).toBe('a');
    const wasOpen = run([arrive('a', 1), arrive('b', 2), arrive('a2', 1)]);
    expect(ids(wasOpen)).toEqual(['b', 'a2']);
    expect(wasOpen.openId).toBe('b');
    const alone = run([arrive('a', 1), arrive('a2', 1)]);
    expect(alone.openId).toBe('a2');
  });

  it('an answer for a proposal that has already left changes nothing', () => {
    const state = run([arrive('a', 1), arrive('b', 2), { type: 'answered', id: 'a' }]);
    expect(proposalQueue(state, { type: 'answered', id: 'a' })).toBe(state);
    const withdrawn = run([arrive('a', 1), arrive('b', 2), { type: 'withdrawn', id: 'b' }]);
    expect(proposalQueue(withdrawn, { type: 'answered', id: 'b' })).toBe(withdrawn);
  });

  it('an answer for a proposal that is waiting but not open changes nothing', () => {
    const state = run([arrive('a', 1), arrive('b', 2)]);
    expect(proposalQueue(state, { type: 'answered', id: 'b' })).toBe(state);
  });

  it('the same event twice changes nothing the second time', () => {
    const events: ProposalQueueEvent[] = [
      arrive('a', 1),
      arrive('b', 2),
      { type: 'notNow', id: 'a' },
      { type: 'otherSheetOpened' },
      { type: 'otherSheetClosed' },
      { type: 'answered', id: 'b' },
      { type: 'tapped', id: 'a' },
      { type: 'withdrawn', id: 'a' },
    ];
    let state = EMPTY_PROPOSAL_QUEUE;
    for (const event of events) {
      state = proposalQueue(state, event);
      expect(proposalQueue(state, event)).toEqual(state);
    }
  });

  it('a proposal that arrives again after it has left (a late copy) is not brought back', () => {
    const state = run([arrive('a', 1), { type: 'answered', id: 'a' }]);
    expect(proposalQueue(state, arrive('a', 1))).toBe(state);
  });

  it('a withdrawal that arrives before its proposal is kept, so the late arrival never opens', () => {
    const state = run([{ type: 'withdrawn', id: 'a' }, arrive('a', 1)]);
    expect(state.openId).toBeNull();
    expect(state.proposals).toEqual([]);
    expect(proposalCount(state)).toBeNull();
  });

  it('with two other sheets stacked, proposals wait until both have closed', () => {
    const one = run([{ type: 'otherSheetOpened', sheet: 'rest' }, { type: 'otherSheetOpened', sheet: 'pack' }, arrive('a', 1), { type: 'otherSheetClosed', sheet: 'pack' }]);
    expect(one.openId).toBeNull();
    const both = proposalQueue(one, { type: 'otherSheetClosed', sheet: 'rest' });
    expect(both.openId).toBe('a');
    expect(proposalQueue(both, { type: 'otherSheetClosed', sheet: 'rest' })).toBe(both);
  });

  it('a proposal from the whole party (no group) is a group of its own: a second one replaces the first', () => {
    const state = run([{ type: 'arrived', proposal: { id: 'p1', group: null } }, arrive('b', 1), { type: 'arrived', proposal: { id: 'p2', group: null } }]);
    expect(ids(state)).toEqual(['b', 'p2']);
    expect(state.openId).toBe('b');
  });

  it('dp-4: a second proposal that arrives while one sheet is open does not displace it, and the count reads 1 of 2', () => {
    const state = run([arrive('a', 1), arrive('b', 2)]);
    expect(state.openId).toBe('a');
    expect(proposalCount(state)).toEqual({ place: 1, total: 2 });
  });

  it('dp-4 exactly: a proposal arriving while the GM has another sheet open over the open proposal joins the queue; the open one is not displaced and the count reads 1 of 2', () => {
    const state = run([arrive('a', 1), { type: 'otherSheetOpened', sheet: 'rest' }, arrive('b', 2)]);
    expect(state.openId).toBe('a');
    expect(proposalCount(state)).toEqual({ place: 1, total: 2 });
  });
});
