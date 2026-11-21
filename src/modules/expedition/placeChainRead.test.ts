// The strip's place chain through a failed read (plan dec-9-the-whole-scene S7; review of #855).
//   Purpose: a read of where the party is that fails is told apart from "no pack place there", and the strip keeps the
//   last chain it read well through a failed read (so a network blip never swaps the place's own steps for the
//   mode's), while a good read of no place clears it.
import { describe, expect, it } from 'vitest';
import type { Db } from '../../core/supabase.ts';
import { chainAfterRead, readPlaceRulesNow, type ChainEntry } from './placeRules.ts';

/** A stand-in database whose every read answers `answer`. */
function dbAnswering(answer: { data: unknown; error: unknown }): Db {
  const query: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'order']) query[name] = () => query;
  query.maybeSingle = () => Promise.resolve(answer);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(answer).then(resolve);
  return { from: () => query } as unknown as Db;
}

const harbour: ChainEntry = { packId: 'pack-reed', entryId: 'drowned-harbour', name: 'The Drowned Harbour', data: { procedure: [{ id: 'tide', name: 'Mind the tide' }] } };

describe("the strip's place chain (S7)", () => {
  it('reads a failure as unread, and no place as none', async () => {
    expect(await readPlaceRulesNow(dbAnswering({ data: null, error: { message: 'offline' } }), 'c', 'e')).toBe('unread');
    expect(await readPlaceRulesNow(dbAnswering({ data: [], error: null }), 'c', 'e')).toBeNull();
  });

  it('keeps the last good chain through a failed read, and clears it on a good read of no place', () => {
    expect(chainAfterRead([harbour], 'unread')).toEqual([harbour]);
    expect(chainAfterRead([harbour], null)).toEqual([]);
    expect(chainAfterRead([], { chain: [harbour] })).toEqual([harbour]);
  });
});
