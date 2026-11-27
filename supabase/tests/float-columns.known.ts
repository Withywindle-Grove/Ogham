// Old decimal or float columns the float check (float-columns.test.ts, hard rule 8) lets pass, each with its reason.
// The list only gets shorter (atc-3): the check fails on a new column, and on an entry here that no longer exists.
// A real future need goes here with its reason, in a reviewed change. Empty when the check was switched on
// (2026-11-27): the migrations had no `real`, `double precision` or `numeric` column.

export interface KnownFloatColumn {
  /** `schema.table.column` */
  column: string;
  reason: string;
}

export const KNOWN_FLOAT_COLUMNS: KnownFloatColumn[] = [];
