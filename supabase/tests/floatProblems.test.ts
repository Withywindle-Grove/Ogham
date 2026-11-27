// Cases for what the float check (check 6, hard rule 8) says, without a database: floatProblems.ts. The names are
// invented. The database half is float-columns.test.ts.
import { describe, expect, it } from 'vitest';
import { floatProblems } from './floatProblems.ts';

const weight = { column: 'public.bog_lurkers.weight', type: 'numeric' };
const share = { column: 'private.lantern_wardens.share', type: 'real[]' };

describe('check 6: what the float check says (hard rule 8)', () => {
  // Purpose: a database with no decimal or float column and an empty known list passes.
  it('passes a clean database', () => {
    expect(floatProblems([], [])).toEqual([]);
  });

  // Purpose: a column not on the known list fails, with a message that names the column, its type, the rule and the fix.
  it('fails a column not on the known list, naming the rule and the fix', () => {
    expect(floatProblems([weight, share], [])).toEqual([
      'public.bog_lurkers.weight is numeric; store whole numbers in an integer column (hard rule 8), or add it to supabase/tests/float-columns.known.ts with its reason',
      'private.lantern_wardens.share is real[]; store whole numbers in an integer column (hard rule 8), or add it to supabase/tests/float-columns.known.ts with its reason',
    ]);
  });

  // Purpose: the known list only gets shorter: a listed column that is there passes, and a listed one that is gone fails.
  it('passes a listed column that is there, and fails a listed one that no longer exists', () => {
    const known = [
      { column: weight.column, reason: 'a planted old case' },
      { column: 'public.bog_lurkers.ratio', reason: 'fixed since' },
    ];
    expect(floatProblems([weight], known)).toEqual([
      'public.bog_lurkers.ratio is on the known list (supabase/tests/float-columns.known.ts) but no longer exists: take it off the list',
    ]);
  });
});
