// Join up only for groups in the same place (M5 step 11, B1), pure: which pairs of groups may be joined, given the
// "who meets whom" map (group number to the lowest group in the same place).
import { describe, expect, it } from 'vitest';
import type { CurrentUser } from '../../core/commands.ts';
import type { Db } from '../../core/supabase.ts';
import { editPlace, meetingPairs, together, type Place } from './placePlay.ts';

describe('place.edit saves the description and the notes in two writes (M5 review fix 6)', () => {
  // A database whose places write goes in and whose place_notes write fails (a lost connection, say).
  function halfFailingDb() {
    const chain = (table: string) => {
      const result =
        table === 'places'
          ? { data: [{ id: 'place-1', campaign_id: 'c1', name: 'The Moth Gallery', description: 'Moths cover the walls.', version: 2 }], error: null }
          : { data: null, error: { code: '08006', message: 'connection lost', details: '', hint: '', name: 'PostgrestError' } };
      const step = { update: () => step, eq: () => step, select: () => Promise.resolve(result) };
      return step;
    };
    return { from: (table: string) => chain(table) } as unknown as Db;
  }
  const gm: CurrentUser = { id: 'gm', displayName: 'The GM', roles: { c1: 'gm' } } as CurrentUser;
  const place: Place = { id: 'place-1', campaignId: 'c1', name: 'The Moth Gallery', description: '', notes: { traps: '', puzzles: '', encounters: '', treasure: '', doors: '' }, version: 1, notesVersion: 1 };

  it("when the notes write fails after the description went in, the person is told the description was saved, not that the whole save failed", async () => {
    const result = await editPlace.run(halfFailingDb(), gm, { campaignId: 'c1', place, description: 'Moths cover the walls.', notes: { traps: 'A tripwire by the door.' } });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toBe("The description was saved. The notes weren't: connection lost");
  });

  it('when only the notes were being saved and that fails, the failure is reported as it is', async () => {
    const result = await editPlace.run(halfFailingDb(), gm, { campaignId: 'c1', place, notes: { traps: 'A tripwire by the door.' } });
    expect(!result.ok && result.message).toBe('connection lost');
  });
});

describe('together and meetingPairs', () => {
  it('two groups in the same place are a pair to join (the higher joins the lower); in different places there is none', () => {
    expect(together(new Map([[1, 1], [2, 1]]), 2, 1)).toBe(true);
    expect(meetingPairs([1, 2], new Map([[1, 1], [2, 1]]))).toEqual([{ from: 2, into: 1 }]);
    expect(together(new Map([[1, 1], [2, 2]]), 2, 1)).toBe(false);
    expect(meetingPairs([1, 2], new Map([[1, 1], [2, 2]]))).toEqual([]);
  });

  it('with three groups only the two that share a place pair up; a group nobody is in never pairs', () => {
    expect(meetingPairs([1, 2, 3], new Map([[1, 1], [2, 2], [3, 2]]))).toEqual([{ from: 3, into: 2 }]);
    expect(meetingPairs([1, 2, 3], new Map([[1, 1], [2, 1], [3, 1]])).length).toBe(3);
    expect(meetingPairs([1, 2], new Map([[1, 1]]))).toEqual([]);
  });
});
