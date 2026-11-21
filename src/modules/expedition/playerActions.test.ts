// Something else… reference list (M5 step 11), pure: the pack's common player actions, read from the highest rules
// set that lists any, grouped, searched. Invented actions only.
import { describe, expect, it } from 'vitest';
import { groupActions, OTHER_GROUP, readPlayerActions, type PlayerAction } from './playerActions.ts';

const rules = (actions: unknown[]) => ({ exploration: { playerActions: actions } });

describe('readPlayerActions', () => {
  it('the highest rules set that lists any actions wins, and a higher set without any lets the lower one through', () => {
    const base = rules([{ id: 'a', name: 'Listen at a door', group: 'Doors', text: 'Hold still.' }]);
    const top = rules([{ id: 'b', name: 'Tap the walls', group: 'Searching', text: 'Knock.' }]);
    expect(readPlayerActions([base, top]).map((a) => a.name)).toEqual(['Tap the walls']);
    expect(readPlayerActions([base, { exploration: {} }]).map((a) => a.name)).toEqual(['Listen at a door']);
    expect(readPlayerActions([])).toEqual([]);
  });

  it('actions without a name are skipped, and a missing group becomes "Other"', () => {
    const found = readPlayerActions([rules([{ id: 'x', text: 'no name' }, { name: '  ' }, { id: 'y', name: 'Wave a lantern', text: 'Signal.', source: 'p. 12' }])]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: 'y', name: 'Wave a lantern', group: OTHER_GROUP, source: 'p. 12' });
  });
});

const list: PlayerAction[] = [
  { id: '1', name: 'Wave a lantern', group: OTHER_GROUP, text: 'Signal across the bog.', source: null },
  { id: '2', name: 'Listen at a door', group: 'Doors', text: 'Hold your breath.', source: null },
  { id: '3', name: 'Tap the walls', group: 'Searching', text: 'Knock for hollow places.', source: null },
  { id: '4', name: 'Force a door', group: 'Doors', text: 'Shoulder it.', source: null },
];

describe('groupActions', () => {
  it('groups keep the pack order of first appearance, with Other last even when it came first', () => {
    const groups = groupActions(list);
    expect(groups.map((g) => g.name)).toEqual(['Doors', 'Searching', OTHER_GROUP]);
    expect(groups[0]!.actions.map((a) => a.name)).toEqual(['Listen at a door', 'Force a door']);
  });

  it('search finds by name, by group and by text, ignoring case; an empty search keeps everything', () => {
    expect(groupActions(list, 'LANTERN').flatMap((g) => g.actions.map((a) => a.id))).toEqual(['1']);
    expect(groupActions(list, 'searching').flatMap((g) => g.actions.map((a) => a.id))).toEqual(['3']);
    expect(groupActions(list, 'shoulder').flatMap((g) => g.actions.map((a) => a.id))).toEqual(['4']);
    expect(groupActions(list, 'nothing like this')).toEqual([]);
    expect(groupActions(list, '   ').flatMap((g) => g.actions)).toHaveLength(4);
  });
});
