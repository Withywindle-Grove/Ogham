// @vitest-environment jsdom
// Where the destination list starts (B19): the last place used for that kind of item, else the first with room.
import { beforeEach, describe, expect, it } from 'vitest';
import { rememberPlace, startingPlace } from './lastPlace.ts';

const places = [
  { id: 'stash' },
  { id: 'satchel', blocked: 'Full' },
  { id: 'wren' },
];

beforeEach(() => localStorage.clear());

describe('the starting place', () => {
  it('is the first place with room when nothing is remembered', () => {
    expect(startingPlace('give', 'gear', places)).toBe('stash');
    expect(startingPlace('put', 'gear', [{ id: 'satchel', blocked: 'Full' }, { id: 'carried' }])).toBe('carried');
  });

  it('is the last place used for that kind of item, per action', () => {
    rememberPlace('give', 'ammunition', 'wren');
    expect(startingPlace('give', 'ammunition', places)).toBe('wren');
    expect(startingPlace('give', 'gear', places)).toBe('stash');
    expect(startingPlace('put', 'ammunition', places)).toBe('stash');
  });

  it("falls back to the first with room when the remembered place is full or gone", () => {
    rememberPlace('put', 'gear', 'satchel');
    expect(startingPlace('put', 'gear', places)).toBe('stash');
    rememberPlace('put', 'gear', 'old-sack');
    expect(startingPlace('put', 'gear', places)).toBe('stash');
  });

  it('is null when every place is blocked', () => {
    expect(startingPlace('put', 'gear', [{ id: 'satchel', blocked: 'Full' }])).toBeNull();
  });
});
