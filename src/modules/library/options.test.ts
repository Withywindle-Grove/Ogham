import { describe, expect, it } from 'vitest';
import { topicOf, campaignPresets, changeRule, defaultChoices, entryOptionOn, readOptions, resolveRules } from './options.ts';

// Invented options and rules (hard rule 2).
const options = readOptions([
  { kind: 'option', packEntryId: 'lantern-oil', name: 'Lanterns need oil', data: { id: 'lantern-oil', name: 'Lanterns need oil', default: 'on', changeLater: 'allow', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] } },
  { kind: 'option', packEntryId: 'slow-healing', name: 'Slow healing', data: { id: 'slow-healing', name: 'Slow healing', default: 'off', changeLater: 'warn', choices: [{ id: 'on', name: 'Yes' }, { id: 'off', name: 'No' }] } },
  { kind: 'option', packEntryId: 'ac-style', name: 'Armour class', data: { id: 'ac-style', name: 'Armour class', default: 'desc', changeLater: 'never', choices: [{ id: 'asc', name: 'Ascending' }, { id: 'desc', name: 'Descending' }] } },
  { kind: 'item', packEntryId: 'rope', name: 'Rope', data: { id: 'rope', name: 'Rope' } },
]);

describe('optional rules', () => {
  it('reads each optional rule with its choices, default and whether it can change later', () => {
    expect(options.map((o) => [o.id, o.defaultChoice, o.changeLater, o.choices.map((c) => c.id)])).toEqual([
      ['lantern-oil', 'on', 'allow', ['on', 'off']],
      ['slow-healing', 'off', 'warn', ['on', 'off']],
      ['ac-style', 'desc', 'lock', ['asc', 'desc']],
    ]);
  });

  it("keeps a rule's notes and each choice's notes, to explain them on request", () => {
    const [rule] = readOptions([
      { kind: 'option', packEntryId: 'fog', name: 'Thick fog', data: { notes: 'Fog hides the far bank.', choices: [{ id: 'on', name: 'Yes', notes: 'Sight ends at the water.' }, { id: 'off', name: 'No' }] } },
    ]);
    expect(rule?.notes).toBe('Fog hides the far bank.');
    expect(rule?.choices).toEqual([{ id: 'on', name: 'Yes', notes: 'Sight ends at the water.' }, { id: 'off', name: 'No', notes: '' }]);
  });

  it('starts every optional rule at its default', () => {
    expect(defaultChoices(options)).toEqual({ 'lantern-oil': 'on', 'slow-healing': 'off', 'ac-style': 'desc' });
  });

  it('a locked rule can be chosen when attaching but not changed later; a "warn" rule changes with a warning', () => {
    const current = defaultChoices(options);
    expect(changeRule(options, current, 'lantern-oil', 'off', { attaching: false })).toEqual({ ok: true, warn: false, choices: { ...current, 'lantern-oil': 'off' } });
    expect(changeRule(options, current, 'slow-healing', 'on', { attaching: false })).toMatchObject({ ok: true, warn: true });
    expect(changeRule(options, current, 'ac-style', 'asc', { attaching: false })).toEqual({ ok: false, message: 'Armour class is locked once the campaign has started.' });
    expect(changeRule(options, current, 'ac-style', 'asc', { attaching: true })).toMatchObject({ ok: true });
    expect(changeRule(options, current, 'lantern-oil', 'maybe', { attaching: true })).toEqual({ ok: false, message: '"maybe" isn\'t one of the choices for Lanterns need oil.' });
  });
});

describe('the rules a campaign ends up with', () => {
  const rulesSet = {
    id: 'river-rules',
    time: { roundSeconds: 6, turnMinutes: 10 },
    light: { lanternFuel: true, burnTurns: 24 },
    healing: { perDay: 1 },
    byOption: {
      'lantern-oil=off': { light: { lanternFuel: false } },
      'slow-healing=on': { healing: { perDay: 0, note: 'Rest a week' } },
    },
  };

  it('merges the overrides of the choices made over the defaults, deeply, and leaves the rest alone', () => {
    expect(resolveRules(rulesSet, { 'lantern-oil': 'off', 'slow-healing': 'off' })).toEqual({
      id: 'river-rules',
      time: { roundSeconds: 6, turnMinutes: 10 },
      light: { lanternFuel: false, burnTurns: 24 },
      healing: { perDay: 1 },
    });
    expect(resolveRules(rulesSet, { 'lantern-oil': 'on', 'slow-healing': 'on' })).toMatchObject({ healing: { perDay: 0, note: 'Rest a week' }, light: { lanternFuel: true } });
  });
});

describe('optional rules inside a section (byOption next to what it changes)', () => {
  const rulesSet = {
    id: 'river-load',
    byOption: { 'load=none': { encumbrance: { mode: 'none' } } },
    encumbrance: {
      mode: 'coin',
      coin: { maxLoadCoin: 900 },
      byOption: { 'load=heavy': { mode: 'armour' }, 'load=none': { mode: 'slot' } },
      containers: { default: 'hold-only', byOption: { 'bags=add': 'add' } },
    },
  };

  it("merges a section's own overrides into that section; a plain-value section takes its default or the override", () => {
    expect(resolveRules(rulesSet, {})).toEqual({ id: 'river-load', encumbrance: { mode: 'coin', coin: { maxLoadCoin: 900 }, containers: 'hold-only' } });
    expect(resolveRules(rulesSet, { load: 'heavy', bags: 'add' })).toMatchObject({ encumbrance: { mode: 'armour', containers: 'add' } });
  });

  it('the top-level overrides apply first, then the section’s own: the more specific wins', () => {
    expect(resolveRules(rulesSet, { load: 'none' })).toMatchObject({ encumbrance: { mode: 'slot' } });
  });
});

describe('what setting rules preset for a new campaign', () => {
  const river = {
    entries: [
      {
        kind: 'rulesSet' as const,
        packEntryId: 'river-rules',
        name: 'River rules',
        data: { encumbrance: { mode: 'armour' }, time: { roundSeconds: 10, turnMinutes: 10 }, byOption: { 'carry=slots': { encumbrance: { mode: 'slot' } } } },
      },
    ],
    choices: { carry: 'armour' },
  };
  const marsh = {
    entries: [{ kind: 'rulesSet' as const, packEntryId: 'marsh-rules', name: 'Marsh rules', data: { time: { dayHours: 20 } } }],
    choices: {},
  };

  it('takes encumbrance and time lengths from the rules set, after the optional rules chosen', () => {
    expect(campaignPresets([river])).toEqual({ encumbranceMode: 'armour', time: { roundSeconds: 10, turnMinutes: 10 } });
    expect(campaignPresets([{ ...river, choices: { carry: 'slots' } }])).toMatchObject({ encumbranceMode: 'slot' });
  });

  // Purpose (of-1): an overlay's rules set keyed on its base's option ("carry=counts") applies at set-up when the base
  // pack holds that choice, so a new campaign starts with the overlay's method.
  it("reads an overlay's byOption on its base's option with the base pack's choice", () => {
    const reed = {
      entries: [{ kind: 'rulesSet' as const, packEntryId: 'reed-rules', name: 'Reed rules', data: { byOption: { 'carry=counts': { time: { turnMinutes: 5 } } } } }],
      choices: {},
    };
    expect(campaignPresets([{ ...river, choices: { carry: 'counts' } }, reed]).time.turnMinutes).toBe(5);
    expect(campaignPresets([river, reed]).time.turnMinutes).toBe(10);
  });

  // Purpose (of-1): an option that extends another has no default of its own to store; the base's choice counts.
  it('stores no default for an option that extends another', () => {
    const rules = readOptions([{ kind: 'option', packEntryId: 'reed-counts', name: 'Item counts', data: { id: 'reed-counts', extends: 'carry', choices: [{ id: 'counts', name: 'Item counts' }] } }]);
    expect(rules[0]!.extends).toBe('carry');
    expect(defaultChoices(rules)).toEqual({});
  });

  it('later setting rules sit on top, filling in only what they say', () => {
    expect(campaignPresets([river, marsh])).toEqual({ encumbranceMode: 'armour', time: { roundSeconds: 10, turnMinutes: 10, dayHours: 20 } });
  });

  it('presets nothing without a rules set, and ignores modes and lengths it doesn’t understand', () => {
    expect(campaignPresets([])).toEqual({ time: {} });
    const odd = { entries: [{ kind: 'rulesSet' as const, packEntryId: 'odd', name: 'Odd', data: { encumbrance: { mode: 'stones' }, time: { roundSeconds: 2.5, turnMinutes: '10' } } }], choices: {} };
    expect(campaignPresets([odd])).toEqual({ time: {} });
  });
});

// B15 (ruled 2026-10-25): one screen, in fixed topic groups; a pack's category decides the group.
describe('the topic group of an optional rule', () => {
  it('maps a pack category by its words, and anything else to Other', () => {
    expect(topicOf('Character creation')).toBe('Characters');
    expect(topicOf('Combat')).toBe('Combat');
    expect(topicOf('Encumbrance')).toBe('Items and treasure');
    expect(topicOf('Weather and seasons')).toBe('Time and calendar');
    expect(topicOf('Dungeon exploration')).toBe('Adventuring');
    expect(topicOf('Retainers')).toBe('Table and players');
    expect(topicOf('Odd things')).toBe('Other');
  });
});

// An entry gated by an optional rule (ct-10, 2026-11-02): read the same way for classes, kits and lists, every
// shape the packs write, with no option ids in the app.
describe('entryOptionOn', () => {
  const choices = { 'kin-callings': 'on', 'quick-kit': 'off', 'gear-mode': 'roll' };
  it('an entry that names no option is always in play', () => {
    expect(entryOptionOn({}, choices)).toBe(true);
    expect(entryOptionOn({ option: '  ' }, choices)).toBe(true);
  });
  it('a bare option id needs its on choice; "=" and ":" name another choice', () => {
    expect(entryOptionOn({ option: 'kin-callings' }, choices)).toBe(true);
    expect(entryOptionOn({ option: 'quick-kit' }, choices)).toBe(false);
    expect(entryOptionOn({ option: 'kin-callings=on' }, choices)).toBe(true);
    expect(entryOptionOn({ option: 'quick-kit=off' }, choices)).toBe(true);
    expect(entryOptionOn({ option: 'gear-mode:roll' }, choices)).toBe(true);
    expect(entryOptionOn({ option: 'gear-mode=buy' }, choices)).toBe(false);
  });
  it('the older onlyWithOption is read when there is no option; option wins when both are given', () => {
    expect(entryOptionOn({ onlyWithOption: 'quick-kit' }, choices)).toBe(false);
    expect(entryOptionOn({ onlyWithOption: 'kin-callings:on' }, choices)).toBe(true);
    expect(entryOptionOn({ option: 'kin-callings', onlyWithOption: 'quick-kit' }, choices)).toBe(true);
  });
  it('an option the campaign has no choice for (and no default) keeps the entry out', () => {
    expect(entryOptionOn({ option: 'unknown-rule' }, choices)).toBe(false);
  });
});
