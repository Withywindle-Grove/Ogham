// Long reads come a page at a time (the database's 1,000-row limit). Fix 2a of the perf report (2026-11-06): after
// a full first page the next pages are asked for side by side, and the rows still arrive complete and in order.
import { describe, expect, it } from 'vitest';
import { allRows, PAGES_AT_ONCE } from './allRows.ts';

/** A pretend query over `total` numbered rows. Each page answers after `delay(index)` ms; the log records asks and answers. */
function source(total: number, options: { delay?: (pageIndex: number) => number; failPage?: number } = {}) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const log: string[] = [];
  const asked: [number, number][] = [];
  const page = (from: number, to: number) => {
    const index = from / 1000;
    asked.push([from, to]);
    log.push(`ask ${index}`);
    return new Promise<{ data: { id: number }[] | null; error: unknown }>((resolve) =>
      setTimeout(() => {
        log.push(`answer ${index}`);
        resolve(index === options.failPage ? { data: null, error: 'broken' } : { data: rows.slice(from, to + 1), error: null });
      }, options.delay?.(index) ?? 0),
    );
  };
  return { page, log, asked, rows };
}

describe('allRows', () => {
  it('reads a short query in one request', async () => {
    const { page, asked } = source(825);
    expect((await allRows(page))?.length).toBe(825);
    expect(asked).toEqual([[0, 999]]);
  });

  it('asks for the pages after the first side by side, and the rows arrive complete and in order even when later pages answer first', async () => {
    // The last page answers first, the second page last.
    const { page, log, rows } = source(3085, { delay: (i) => (i === 0 ? 0 : 40 - i * 10) });
    const got = await allRows(page);
    expect(got).toEqual(rows);
    // Pages 1–3 are all asked for before any of them answers: one wait after the first page, not three.
    expect(log.slice(0, 5)).toEqual(['ask 0', 'answer 0', 'ask 1', 'ask 2', 'ask 3']);
    expect(PAGES_AT_ONCE).toBe(3);
  });

  it('a query of exactly two full pages stops at the first empty one', async () => {
    const { page, rows } = source(2000);
    expect(await allRows(page)).toEqual(rows);
  });

  it('keeps going in further batches until a short page', async () => {
    const { page, asked, rows } = source(4500);
    expect(await allRows(page)).toEqual(rows);
    expect(asked.map(([from]) => from)).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000]);
  });

  it('a page that fails makes the whole read fail, as before', async () => {
    const { page } = source(2500, { failPage: 1 });
    expect(await allRows(page)).toBeNull();
  });

  it('a page asked for past the last one may fail without spoiling the rows', async () => {
    const { page, rows } = source(1500, { failPage: 3 });
    expect(await allRows(page)).toEqual(rows);
  });
});
