// Checking rule hooks against the spec (docs/07, "Rule hooks"): what can't run, and what's only worth knowing.
// Invented hooks throughout.
import { describe, expect, it } from 'vitest';
import { checkHook, hookContext } from './hooks.ts';
import { readPackJson } from './packFile.ts';

const warnArmour = {
  id: 'warn-warden-armour',
  kind: 'warn',
  when: 'equip',
  test: 'item.slot == "armour" and not allows(character.class.armourAllowed, item)',
  message: "{character.class.name} can't wear {item.name}. The GM can allow it.",
};

describe('checkHook', () => {
  it("the spec's own examples are fine (campaign flags are readable from any event)", () => {
    expect(checkHook(warnArmour)).toEqual({ problems: [], warnings: [] });
    expect(checkHook({ id: 'f', kind: 'factor', when: 'wageDue', appliesTo: 'mercenary', test: 'campaign.flags.flooding == true', target: 'wage', multiplier: 2 })).toEqual({ problems: [], warnings: [] });
    expect(checkHook({ id: 'r', kind: 'remind', when: 'turnAdvanced', every: { value: 3, unit: 'turn' }, test: 'expedition.setting == "dungeon"', message: 'Check for bog lurkers.' })).toEqual({ problems: [], warnings: [] });
    expect(checkHook({ id: 'm', kind: 'fill', when: 'abilityScoreChanged', target: 'abilityModifiers', from: 'abilityModifiers' })).toEqual({ problems: [], warnings: [] });
  });

  it('a reminder can come every few hours or weeks (the hour unit, 07 routes), not only rounds, turns and days', () => {
    expect(checkHook({ id: 'h', kind: 'remind', when: 'turnAdvanced', every: { value: 2, unit: 'hour' }, message: 'Rest the mules.' }).problems).toEqual([]);
    expect(checkHook({ id: 'w', kind: 'remind', when: 'turnAdvanced', every: { value: 1, unit: 'week' }, message: 'Pay the boatman.' }).problems).toEqual([]);
    expect(checkHook({ id: 'x', kind: 'remind', when: 'turnAdvanced', every: { value: 1, unit: 'aeon' }, message: 'Never.' }).problems).not.toEqual([]);
  });

  it("can't run: unknown kind or event, a broken test, an unknown function, a warn without a message", () => {
    expect(checkHook({ ...warnArmour, kind: 'block' }).problems).toEqual([expect.stringMatching(/kind must be one of/)]);
    expect(checkHook({ ...warnArmour, when: 'onSneeze' }).problems).toEqual([expect.stringMatching(/"onSneeze" isn't an event/)]);
    expect(checkHook({ ...warnArmour, test: 'item.slot == ' }).problems).toEqual([expect.stringMatching(/test can't be read/)]);
    expect(checkHook({ ...warnArmour, test: 'roll(item) > 3' }).problems).toEqual([expect.stringMatching(/calls roll\(\)/)]);
    expect(checkHook({ ...warnArmour, message: undefined }).problems).toEqual(['It needs a message to show.']);
    expect(checkHook({ ...warnArmour, test: 'x'.repeat(301) }).problems).toContainEqual(expect.stringMatching(/longer than 300/));
    expect(checkHook({ id: 'f', kind: 'fill', when: 'levelUp', target: 'saves', value: '1', from: 'classProgression' }).problems).toEqual([
      'A fill needs either a value or a from, not both.',
    ]);
  });

  it('worth knowing: a name the event lacks, a blank placeholder, an unknown target, a GM-only lookup on a player’s device', () => {
    expect(checkHook({ ...warnArmour, test: 'hireling.level > 2' }).warnings).toEqual([expect.stringMatching(/equip doesn't provide "hireling"/)]);
    expect(checkHook({ ...warnArmour, message: '{light.name} is heavy.' }).warnings).toEqual([expect.stringMatching(/\{light.name\}.*show blank/)]);
    expect(checkHook({ id: 'f', kind: 'fill', when: 'levelUp', target: 'luck', from: 'classProgression' }).warnings).toEqual([expect.stringMatching(/"luck" isn't a fill target/)]);
    expect(checkHook({ id: 'f', kind: 'fill', when: 'levelUp', target: 'luck', from: 'classProgression' }, { fieldKeys: ['luck'] }).warnings).toEqual([]);
    expect(checkHook({ ...warnArmour, test: 'lookup("monsters.lurker", 1) > 2' }).warnings).toEqual([expect.stringMatching(/only the GM can read/)]);
    expect(checkHook({ id: 'r', kind: 'remind', when: 'turnAdvanced', test: 'lookup("monsters.lurker", 1) > 2', message: 'Hm.' }).warnings).toEqual([]);
  });

  it('finds sheet-layout field keys, tables and GM-only sections in the rest of the pack', () => {
    expect(
      hookContext([
        { kind: 'fieldTemplate', packEntryId: 'six', data: { fields: [{ key: 'luck' }] } },
        { kind: 'table', packEntryId: 'bog-encounters', data: {} },
        { kind: 'rulesSet', packEntryId: 'fen', data: { secrets: { gmOnly: true }, time: {} } },
      ]),
    ).toEqual({ fieldKeys: ['luck'], gmSections: ['secrets'], tableIds: ['bog-encounters'] });
  });
});

describe('the import preview', () => {
  it('lists what a hook check finds, and still imports the pack', () => {
    const read = readPackJson(
      JSON.stringify({ format: 'tabletop-pack', formatVersion: 2, meta: { name: 'Fen Rules' }, hooks: [warnArmour, { ...warnArmour, id: 'odd', when: 'onSneeze' }] }),
    );
    if (!read.ok) throw new Error(read.message);
    expect(read.pack.entries).toHaveLength(2);
    expect(read.pack.warnings).toEqual([expect.stringMatching(/^hooks: "odd": "onSneeze" isn't an event/)]);
  });
});
