// Tests for the usage report (scripts/usage-report.mjs): how one line of a session record is read, how replies are
// weighed and grouped, and how a brief's "Row:" line is found. Reading the real session folders is not tested here.
import { describe, expect, it } from 'vitest';
import { bandOf, countsOf, inDates, readLine, rowOf, summarise, tableFor, textOf, weightOf } from './usage-report.mjs';

const usage = (more = {}) => ({
  input_tokens: 10,
  cache_creation_input_tokens: 100,
  cache_read_input_tokens: 1000,
  output_tokens: 20,
  ...more,
});
const assistantLine = (more = {}) =>
  JSON.stringify({
    type: 'assistant',
    requestId: 'req-1',
    timestamp: '2026-11-19T09:30:00Z',
    message: { id: 'msg-1', model: 'claude-opus-5-5', usage: usage() },
    ...more,
  });
const reply = (more = {}) => ({
  day: '2026-11-19',
  model: 'opus-5-5',
  folder: 'lantern',
  worker: false,
  row: null,
  counts: countsOf(usage()),
  ...more,
});

describe('weighing a reply', () => {
  it('reads missing token fields as zero', () => {
    expect(countsOf({ output_tokens: 5 })).toEqual({ input: 0, cacheWrite: 0, cacheRead: 0, output: 5 });
  });

  it('counts output five times, a cache write one and a quarter, a cache read a tenth', () => {
    expect(weightOf(countsOf(usage()))).toBe(10 + 125 + 100 + 100);
  });

  it('puts a reply in a band by the history it carried, not by what it wrote', () => {
    expect(bandOf(countsOf(usage({ output_tokens: 900_000 })))).toBe('under 100k');
    expect(bandOf(countsOf(usage({ cache_read_input_tokens: 150_000 })))).toBe('100k to 200k');
    expect(bandOf(countsOf(usage({ cache_read_input_tokens: 400_000 })))).toBe('400k and over');
  });
});

describe('finding a plan row in a brief', () => {
  it('finds a row named on a line of its own', () => {
    expect(rowOf('Build the lantern tile.\nRow: C4\nStop before the screen.')).toBe('C4');
  });

  // A batch's brief names its rows joined by "+", and the batch's cost is reported under one joined key.
  it('reads a batch of two or three rows as one joined key', () => {
    expect(rowOf('Row: B6 + B7\nBuild both.')).toBe('B6+B7');
    expect(rowOf('Row: B6+B7+B8')).toBe('B6+B7+B8');
  });

  // A batch holds at most three rows, and a "+" with no row after it is not a row line.
  it('finds nothing for a batch of four rows or a dangling plus', () => {
    expect(rowOf('Row: B6 + B7 + B8 + B9')).toBeNull();
    expect(rowOf('Row: B6 +')).toBeNull();
  });

  it('finds nothing when the word sits inside a sentence or no row is named', () => {
    expect(rowOf('See the table. Row: the third one is wrong.')).toBeNull();
    expect(rowOf('')).toBeNull();
    expect(rowOf(undefined)).toBeNull();
  });

  it('reads the text of a message made of parts and leaves tool results out', () => {
    const message = { content: [{ type: 'tool_result', content: 'Row: X9' }, { type: 'text', text: 'Row: K7' }] };
    expect(rowOf(textOf(message))).toBe('K7');
  });
});

describe('reading one line of a session record', () => {
  it('reads an assistant reply: its day, its model without the prefix, and its counts', () => {
    expect(readLine(assistantLine()).reply).toEqual({
      id: 'msg-1|req-1',
      day: '2026-11-19',
      model: 'opus-5-5',
      worker: false,
      counts: countsOf(usage()),
    });
  });

  it('marks a reply written by a worker', () => {
    expect(readLine(assistantLine({ isSidechain: true })).reply.worker).toBe(true);
  });

  it('reads the row from a user message and keeps none of its words', () => {
    const line = JSON.stringify({ type: 'user', message: { content: 'Row: W11b\nBuild the Undo on a purchase.' } });
    expect(readLine(line)).toEqual({ row: 'W11b' });
  });

  it('skips a line that is not JSON, a reply without counts and a user message without a row', () => {
    expect(readLine('not json')).toBeNull();
    expect(readLine(JSON.stringify({ type: 'assistant', message: { id: 'msg-2' } }))).toBeNull();
    expect(readLine(JSON.stringify({ type: 'user', message: { content: 'hello' } }))).toBeNull();
  });
});

describe('keeping to the asked dates', () => {
  it('includes both ends and treats an empty bound as open', () => {
    expect(inDates('2026-11-19', '2026-11-19', '2026-11-25')).toBe(true);
    expect(inDates('2026-11-25', '2026-11-19', '2026-11-25')).toBe(true);
    expect(inDates('2026-11-26', '2026-11-19', '2026-11-25')).toBe(false);
    expect(inDates('2026-11-18', '2026-11-19', '')).toBe(false);
    expect(inDates('2026-01-01', '', '')).toBe(true);
  });
});

describe('summing replies', () => {
  const replies = [
    reply(),
    reply({ worker: true, row: 'C4' }),
    reply({ day: '2026-11-20', model: 'sonnet-5-5', worker: true, row: 'C4' }),
  ];
  const { total, groups } = summarise(replies);

  it('adds every reply to the total', () => {
    expect(total.replies).toBe(3);
    expect(total.weight).toBe(3 * 335);
    expect(total.cacheRead).toBe(3000);
  });

  it('groups by day, by model, by row, and by the session folder with who replied', () => {
    expect(groups.day['2026-11-19'].replies).toBe(2);
    expect(groups.model['sonnet-5-5'].replies).toBe(1);
    expect(groups.row.C4.replies).toBe(2);
    expect(groups.row['no row named'].replies).toBe(1);
    expect(groups.session['lantern, itself'].replies).toBe(1);
    expect(groups.session['lantern, workers'].replies).toBe(2);
    expect(groups.history['workers, under 100k'].replies).toBe(2);
  });

  it('gives each group its share of the whole, biggest first, and days in date order', () => {
    const rows = tableFor('Plan row', groups.row, total);
    expect(rows[2]).toMatch(/^\| C4 \| 66\.7 \| 2 \|/);
    expect(rows[3]).toMatch(/^\| no row named \| 33\.3 \| 1 \|/);
    const days = tableFor('Day', groups.day, total, { byName: true });
    expect(days[2]).toMatch(/^\| 2026-11-19 /);
    expect(days[3]).toMatch(/^\| 2026-11-20 /);
  });

  it('shows 0.0 and does not divide by zero when there is nothing to sum', () => {
    const empty = summarise([]);
    expect(tableFor('Day', { none: empty.total }, empty.total)[2]).toMatch(/^\| none \| 0\.0 \| 0 \|/);
  });
});
