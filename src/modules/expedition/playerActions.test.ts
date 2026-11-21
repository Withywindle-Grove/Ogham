// Something else… reference list (M5 step 11), pure: the pack's common player actions, read from the highest rules
// set that lists any, grouped, searched. Invented actions only.
import { describe, expect, it } from 'vitest';
import { activitiesWithRules, groupActions, OTHER_GROUP, readPlayerActions, type PlayerAction } from './playerActions.ts';

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

describe("an action's rule in words or in blocks (d5-16)", () => {
  // Purpose: a rule in plain words reads exactly as before d5-16: its words trimmed, no blocks.
  it('reads plain words as before', () => {
    const [action] = readPlayerActions([rules([{ id: 'a', name: 'Listen', text: '  Hold still.\n\nListen.  ' }])]);
    expect(action).toMatchObject({ text: 'Hold still.\n\nListen.', blocks: null });
  });

  // Purpose: a rule in pf-18's blocks keeps its blocks for its sheet, and its plain words for a search and a line.
  it('keeps a rule in blocks, with its words', () => {
    const text = { blocks: [{ p: 'One at a time.' }, { table: { title: 'Modifiers', columns: ['When', 'Opens on'], rows: [['With a crowbar', '1 to 3']] } }, { lead: 'Noise', text: 'Each try is loud.' }] };
    const [action] = readPlayerActions([rules([{ id: 'force', name: 'Force a door', text }])]);
    expect(action!.text).toBe('One at a time. Modifiers Noise. Each try is loud.');
    expect(action!.blocks?.blocks.map((b) => b.kind)).toEqual(['p', 'table', 'lead']);
    expect(groupActions([action!], 'loud').flatMap((g) => g.actions.map((a) => a.id))).toEqual(['force']);
  });

  // Purpose: a rule that can't be read (a number, a bare list, no blocks, nothing usable) gives no words, so the action is not an Activity.
  it('leaves an unreadable rule out of the Activities', () => {
    const found = activitiesWithRules([
      rules([
        { id: 'n', name: 'Count', text: 7 },
        { id: 'l', name: 'Bare list', text: [{ p: 'A bare list.' }] },
        { id: 'e', name: 'Empty', text: { blocks: [] } },
        { id: 'b', name: 'Broken', text: { blocks: [{ lead: 'No text' }] } },
        { id: 'ok', name: 'Fine', text: { blocks: [{ p: 'Fine.' }] } },
      ]),
    ]);
    expect(found.map((a) => a.id)).toEqual(['ok']);
  });
});

const list: PlayerAction[] = [
  { id: '1', name: 'Wave a lantern', group: OTHER_GROUP, text: 'Signal across the bog.', blocks: null, source: null },
  { id: '2', name: 'Listen at a door', group: 'Doors', text: 'Hold your breath.', blocks: null, source: null },
  { id: '3', name: 'Tap the walls', group: 'Searching', text: 'Knock for hollow places.', blocks: null, source: null },
  { id: '4', name: 'Force a door', group: 'Doors', text: 'Shoulder it.', blocks: null, source: null },
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
