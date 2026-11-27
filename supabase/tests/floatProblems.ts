// Check 6 (hard rule 8, spec docs/specs/hard-rule-and-size-checks.md): what the float check says about the decimal and
// float columns it found, against the known list. Pure, so its cases run without a database (floatProblems.test.ts);
// the database half is supabase/tests/float-columns.test.ts.

/** A decimal or float column the database holds: `schema.table.column` and its type as declared. */
export interface FoundFloatColumn {
  column: string;
  type: string;
}

/** An old one the check lets pass (supabase/tests/float-columns.known.ts). */
export interface KnownFloatColumn {
  /** `schema.table.column` */
  column: string;
  reason: string;
}

/**
 * One message per problem: a column not on the known list (it breaks hard rule 8), and a known entry whose column no
 * longer exists (the list only gets shorter, atc-3). Empty when the database matches the list.
 */
export function floatProblems(found: FoundFloatColumn[], known: KnownFloatColumn[]): string[] {
  const listed = new Set(known.map((entry) => entry.column));
  const there = new Set(found.map((entry) => entry.column));
  return [
    ...found
      .filter((entry) => !listed.has(entry.column))
      .map(
        (entry) =>
          `${entry.column} is ${entry.type}; store whole numbers in an integer column (hard rule 8), or add it to supabase/tests/float-columns.known.ts with its reason`,
      ),
    ...known
      .filter((entry) => !there.has(entry.column))
      .map((entry) => `${entry.column} is on the known list (supabase/tests/float-columns.known.ts) but no longer exists: take it off the list`),
  ];
}
