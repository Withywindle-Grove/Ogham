// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rememberOpen, startsOpen, wasOpen } from './packOpen.ts';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the Pack's folding groups (ruled 2026-10-28, N19)", () => {
  it('with something At hand every folding group starts collapsed; with nothing At hand only Gear starts open', () => {
    expect(startsOpen('gear', true)).toBe(false);
    expect(startsOpen('stash', true)).toBe(false);
    expect(startsOpen('waiting', true)).toBe(false);
    expect(startsOpen('gear', false)).toBe(true);
    expect(startsOpen('stash', false)).toBe(false);
    expect(startsOpen('waiting', false)).toBe(false);
  });

  it('say nothing until toggled on this device, then remember how each was left', () => {
    expect(wasOpen('gear')).toBeUndefined();
    rememberOpen('gear', true);
    expect(wasOpen('gear')).toBe(true);
    expect(wasOpen('stash')).toBeUndefined();
    rememberOpen('gear', false);
    expect(wasOpen('gear')).toBe(false);
  });

  it('with storage blocked (private browsing) nothing is remembered, without an error', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => rememberOpen('waiting', true)).not.toThrow();
    expect(wasOpen('waiting')).toBeUndefined();
  });
});
