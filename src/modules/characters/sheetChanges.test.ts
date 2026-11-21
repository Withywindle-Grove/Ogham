import { describe, expect, it } from 'vitest';
import { answerWords, changeWords, newlyAnswered, type SheetChange } from './sheetChanges.ts';

// The words and the "was it answered" check of a sheet change (plan m5b-sheet-revised B6). Invented figures.
function change(extra: Partial<SheetChange> = {}): SheetChange {
  return {
    id: 'change-1',
    campaignId: 'campaign-1',
    actorId: 'actor-wren',
    requesterId: 'user-sam',
    field: 'MUS',
    label: 'Muscle',
    from: 16,
    to: 17,
    status: 'waiting',
    reason: '',
    answeredAt: null,
    createdAt: '2026-11-08T10:00:00Z',
    version: 1,
    ...extra,
  };
}

describe('changeWords', () => {
  // Purpose: the line names the figure and both numbers with an arrow.
  it('reads "Muscle 16 → 17"', () => {
    expect(changeWords(change())).toBe('Muscle 16 → 17');
  });

  // Purpose: with no figure before there is nothing to arrow from.
  it('leaves the figure before out when there was none', () => {
    expect(changeWords(change({ from: null }))).toBe('Muscle 17');
  });
});

describe('newlyAnswered', () => {
  // Purpose: a change that waited at the first load and is approved at the next is the one the player is told of.
  it('finds a change that waited before and is approved now', () => {
    const before = [change()];
    const now = [change({ status: 'approved', answeredAt: '2026-11-08T11:00:00Z' })];
    expect(newlyAnswered(before, now)?.status).toBe('approved');
  });

  // Purpose: a refusal is told of the same way.
  it('finds one that was refused', () => {
    expect(newlyAnswered([change()], [change({ status: 'refused', reason: 'Not yet' })])?.status).toBe('refused');
  });

  // Purpose: a change still waiting, or one the player took back, is nothing to be told of.
  it('finds nothing while it waits or when it was taken back', () => {
    expect(newlyAnswered([change()], [change()])).toBeNull();
    expect(newlyAnswered([change()], [change({ status: 'withdrawn' })])).toBeNull();
  });

  // Purpose: an answer already there at the first load was told of before; only a change that waited counts.
  it('ignores an answer that was already there before', () => {
    const answered = change({ status: 'approved' });
    expect(newlyAnswered([answered], [answered])).toBeNull();
  });

  // Purpose: with several changes only the one that moved from waiting is picked.
  it('picks the one that moved out of waiting among several', () => {
    const other = change({ id: 'change-0', field: 'hpMax', label: 'Max HP', from: 6, to: 8, status: 'approved' });
    const before = [change()];
    const now = [other, change({ status: 'approved' })];
    expect(newlyAnswered(before, now)?.id).toBe('change-1');
  });
});

describe('answerWords', () => {
  // Purpose: an approval says the figure now.
  it('says the GM approved the figure', () => {
    expect(answerWords(change({ status: 'approved' }))).toBe('Your GM approved Muscle 17.');
  });

  // Purpose: a refusal gives the reason after a colon when there is one.
  it('says the GM refused it, with the reason when given', () => {
    expect(answerWords(change({ status: 'refused', reason: 'Wait for the next level' }))).toBe('Your GM refused Muscle 17: Wait for the next level');
  });

  // Purpose: without a reason the refusal ends with a full stop.
  it('ends a refusal without a reason with a full stop', () => {
    expect(answerWords(change({ status: 'refused' }))).toBe('Your GM refused Muscle 17.');
  });
});
