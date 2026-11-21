// The database sends at most 1,000 rows per request (Supabase's max_rows), and a real pack can hold more
// entries than that. Reads that may be that long go a page at a time, in a fixed order, until a short page.
// After a full first page the next pages are asked for side by side, a few at once (perf report 2026-11-06,
// fix 2a): the same query for each page as before, only not waiting for one page before asking for the next.

const PAGE = 1000;
/** Pages asked for at once after the first. A few: a pack of 3,000 rows takes two waits instead of four. */
export const PAGES_AT_ONCE = 3;

type Page<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;

/** Every row a query matches, in page order; null if any page couldn't be read. Order the query by a unique column. */
export async function allRows<T>(page: Page<T>): Promise<T[] | null> {
  const first = await page(0, PAGE - 1);
  if (first.error || !first.data) return null;
  const rows: T[] = [...first.data];
  if (first.data.length < PAGE) return rows;
  for (let next = 1; ; next += PAGES_AT_ONCE) {
    const batch = await Promise.all(Array.from({ length: PAGES_AT_ONCE }, (_, i) => page((next + i) * PAGE, (next + i + 1) * PAGE - 1)));
    // Taken in order up to the first short page; any page asked for past it is left unread.
    for (const { data, error } of batch) {
      if (error || !data) return null;
      rows.push(...data);
      if (data.length < PAGE) return rows;
    }
  }
}
