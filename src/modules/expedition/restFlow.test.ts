// The forced march's rest in camp (ruled 2026-11-03 by Francis, SC-4-3 A; docs/plans/m5b-4-camp.md, Departures):
//   A group that forced the march today and has an open camp for that evening has its rest flow open ("forced").
//   A group that didn't march, or whose camp is for another day or already applied, has none.
//   Undoing the march (the forced count back to 0) closes the flow again.
// With no camp that evening (ruled B 2026-11-03, camp follow-up ⚑): Next day applies the rest as unanswered.
import { describe, expect, it } from 'vitest';
import { forcedRestGroups, forcedWithoutCamp, restFlows, restToApply, withForcedOpen } from './restFlow.ts';

const groups = [
  { number: 1, members: ['reed', 'moss'] },
  { number: 2, members: ['wren'] },
];
const flowsWith = (forcedGroups: ReadonlySet<number>) => restFlows({ groups, rests: [], startedAt: 0, now: 86400, every: 6 * 86400, step: 86400, forcedGroups });

describe("a forced march's rest in camp (SC-4-3 A)", () => {
  // Purpose: only a group that forced the march today and camps that same evening has its rest due.
  it('opens the flow of a force-marched group in camp tonight, and no other', () => {
    const rows = [
      { group: 1, day: 1, forced: 1 },
      { group: 2, day: 1, forced: 0 },
    ];
    const camps = [
      { group: 1, day: 1, appliedAt: null },
      { group: 2, day: 1, appliedAt: null },
    ];
    const forced = forcedRestGroups(rows, camps);
    expect([...forced]).toEqual([1]);
    const flows = flowsWith(forced);
    expect(flows.map((f) => [f.group, f.forced, f.open])).toEqual([
      [1, true, true],
      [2, false, false],
    ]);
  });

  // Purpose: no camp yet, a camp for another evening, or a camp Next day already applied asks for no rest.
  it('asks nothing before camp, for another evening, or once the camp is applied', () => {
    const rows = [{ group: 1, day: 1, forced: 1 }];
    expect(forcedRestGroups(rows, []).size).toBe(0);
    expect(forcedRestGroups(rows, [{ group: 1, day: 0, appliedAt: null }]).size).toBe(0);
    expect(forcedRestGroups(rows, [{ group: 1, day: 1, appliedAt: 86400 }]).size).toBe(0);
  });

  // Purpose: undoing the march brings the forced count back to 0, and the rest due goes with it.
  it('closes again when the march is undone', () => {
    const camps = [{ group: 1, day: 1, appliedAt: null }];
    expect(flowsWith(forcedRestGroups([{ group: 1, day: 1, forced: 0 }], camps))[0]).toMatchObject({ forced: false, open: false });
  });
});

describe('a forced march with no camp that evening (ruled B 2026-11-03)', () => {
  const rows = [
    { group: 1, day: 1, forced: 1 },
    { group: 2, day: 1, forced: 0 },
  ];

  // Purpose: Next day picks the group that forced the march today and has no camp tonight, and no other.
  it('picks a force-marched group with no camp at Next day; not one that camps, nor one that did not march', () => {
    expect([...forcedWithoutCamp(rows, [], 1, 2)]).toEqual([1]);
    expect(forcedWithoutCamp(rows, [{ group: 1, day: 1 }], 1, 2).size).toBe(0);
    // A camp for another evening doesn't count as tonight's.
    expect([...forcedWithoutCamp(rows, [{ group: 1, day: 0 }], 1, 2)]).toEqual([1]);
  });

  // Purpose: only a move that reaches a new day applies it, and a row from a day already past never applies again.
  it('waits for the move into a new day, and never applies a past day again', () => {
    expect(forcedWithoutCamp(rows, [], 1, 1).size).toBe(0);
    expect(forcedWithoutCamp(rows, [], 2, 3).size).toBe(0);
    expect(forcedWithoutCamp(rows, [], -1, -1).size).toBe(0);
  });

  // Purpose: Next day sends the group's members in the rest it applies, unanswered, with the pack's condition.
  it("sends the group's members, unanswered, with the condition", () => {
    const flows = withForcedOpen(flowsWith(new Set()), forcedWithoutCamp(rows, [], 1, 2));
    expect(flows.map((f) => [f.group, f.open])).toEqual([
      [1, true],
      [2, false],
    ]);
    const weary = { id: 'weary', name: 'Weary', icon: null, stacks: true, levels: null, defaultRounds: null, note: null };
    expect(restToApply(flows, weary)).toMatchObject({ actors: ['reed', 'moss'], condition: { name: 'Weary', stacks: true } });
    // No forced march and no due rest: nothing to apply.
    expect(restToApply(withForcedOpen(flowsWith(new Set()), new Set()), weary)).toBeNull();
  });
});
