// Party groups, worked out (M5 step 8; ruled 2026-10-30, DG14). Pure; invented characters.
//   With no split there is exactly one group, the party, holding everyone.
//   Groups are listed by number with their characters in the order given; empty groups aren't listed.
//   Someone the database hasn't placed yet (no member row) is with the party.
import { describe, expect, it } from 'vitest';
import { groupName, groupsOf, isSplit } from './partyGroups.ts';

describe('party groups', () => {
  it('with no split there is one group, the party, with everyone', () => {
    const groups = groupsOf(new Map([['wren', 1], ['ash', 1]]), ['ash', 'wren']);
    expect(groups).toEqual([{ number: 1, ids: ['ash', 'wren'] }]);
    expect(isSplit(groups)).toBe(false);
  });

  it('a split lists each group in play by number; an empty group (here 2) is left out', () => {
    const groups = groupsOf(new Map([['wren', 3], ['ash', 1], ['moss', 3]]), ['ash', 'moss', 'wren']);
    expect(groups).toEqual([
      { number: 1, ids: ['ash'] },
      { number: 3, ids: ['moss', 'wren'] },
    ]);
    expect(isSplit(groups)).toBe(true);
    expect(groupName(3)).toBe('Group 3');
  });

  it('a character with no member row yet is with the party; no characters at all is the party, empty', () => {
    expect(groupsOf(new Map(), ['bree'])).toEqual([{ number: 1, ids: ['bree'] }]);
    expect(groupsOf(new Map(), [])).toEqual([{ number: 1, ids: [] }]);
  });
});
