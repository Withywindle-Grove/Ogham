// Tests for the long-conversation warning (scripts/context-warn.mjs): how the history a session carries is read from
// the end of its record, and when the warning is given. Reading the real file and stdin is not tested here.
import { describe, expect, it } from 'vitest';
import { LIMIT, carriedBy, messageFor } from './context-warn.mjs';

const reply = (usage, more = {}) => JSON.stringify({ type: 'assistant', message: { id: 'msg-1', usage }, ...more });

describe('reading the history a session carries', () => {
  it('adds new input, what was read from the cache and what was written to it, from the last reply', () => {
    const lines = [
      reply({ input_tokens: 1, cache_read_input_tokens: 10, cache_creation_input_tokens: 100, output_tokens: 9999 }),
      reply({ input_tokens: 5, cache_read_input_tokens: 120_000, cache_creation_input_tokens: 2_000, output_tokens: 50 }),
    ];
    expect(carriedBy(lines)).toBe(122_005);
  });

  it('skips a worker’s reply inside the record and takes the session’s own', () => {
    const lines = [
      reply({ cache_read_input_tokens: 180_000 }),
      reply({ cache_read_input_tokens: 20_000 }, { isSidechain: true }),
    ];
    expect(carriedBy(lines)).toBe(180_000);
  });

  it('skips a line cut in half, a user message and a reply without counts', () => {
    const lines = [
      '"usage":{"input_tokens":5}}}',
      reply({ cache_read_input_tokens: 60_000 }),
      JSON.stringify({ type: 'user', message: { content: 'the "usage" page says 40%' } }),
      JSON.stringify({ type: 'assistant', message: { id: 'msg-2' } }),
      '',
    ];
    expect(carriedBy(lines)).toBe(60_000);
  });

  it('finds nothing in a record with no reply yet', () => {
    expect(carriedBy([])).toBeNull();
    expect(carriedBy(['not json', ''])).toBeNull();
  });
});

describe('giving the warning', () => {
  it('says nothing under the limit or when nothing could be read', () => {
    expect(messageFor(LIMIT - 1)).toBe('');
    expect(messageFor(0)).toBe('');
    expect(messageFor(null)).toBe('');
  });

  it('warns from 250,000 tokens on, and says how long the conversation is', () => {
    expect(LIMIT).toBe(250_000);
    expect(messageFor(249_999)).toBe('');
    expect(messageFor(LIMIT)).toMatch(/about 250,000 tokens of history; the limit is 250,000/);
    const message = messageFor(412_300);
    expect(message).toMatch(/about 412,000 tokens/);
    expect(message).toMatch(/handover/);
    expect(message).toMatch(/fresh session/);
  });

  it('tells a worker started from a brief, cloud sessions included, to finish its task and not stop', () => {
    const message = messageFor(LIMIT);
    expect(message).toMatch(/worker started from a brief .*any cloud session.* carries on and finishes its task/);
    expect(message).toMatch(/does not stop, hand over or start a fresh session because of this line/);
  });

  it('tells only the driver, or a session Francis talks to directly, to bring its handover up to date', () => {
    expect(messageFor(LIMIT)).toMatch(
      /Only the driver, or another session Francis talks to directly, brings its handover up to date .* time for a fresh session/,
    );
  });
});
