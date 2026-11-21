// Creation rules as data (M5b step 0c, slice 1; docs/07 "Creation rules as data"), read from the invented fixture
// pack scripts/fixtures/m5b-creation.fixture.json and from small invented snippets. Every name and number is invented.
import { describe, expect, it } from 'vitest';
import fixture from '../../../scripts/fixtures/m5b-creation.fixture.json?raw';
import {
  abilitiesByKind,
  abilityKind,
  adjustmentRule,
  alignmentVisibility,
  askedFields,
  derivedFields,
  diceAverage,
  diceRange,
  diceTimes,
  outsideDice,
  extraLanguages,
  findLanguage,
  languagesRule,
  scoresRule,
  startOverTriggered,
} from './creationRules.ts';

const pack = JSON.parse(fixture) as { rulesSets: Record<string, unknown>[]; races: Record<string, unknown>[]; classes: Record<string, unknown>[]; fieldTemplates: { fields: { key: string; fill?: string; hidden?: boolean }[] }[] };
const rules = pack.rulesSets;

describe('the scores rule (cr-19)', () => {
  it('reads the dice, the range and the start-over rule, and starts the tiles at the dice average', () => {
    expect(scoresRule(rules)).toEqual({ dice: '2d8', average: 9, min: 2, max: 16, startOver: { everyAtMost: 7, countAtMost: { count: 3, value: 5 }, option: 'fen-cruel-dice', note: 'If the dice were cruel, you may start over.' } });
  });

  it('works out a dice average, rounded down (ruled 2026-11-02: 3d6 gives 10, not 11)', () => {
    expect(diceAverage('2d8')).toBe(9);
    expect(diceAverage('3d6')).toBe(10);
    expect(diceAverage('d4')).toBe(2);
    expect(diceAverage('2d6+1')).toBe(8);
    expect(diceAverage('3d6-1')).toBe(9);
    expect(diceAverage('two dice')).toBeNull();
  });

  // Purpose: starting coin starts at the setting's usual amount (cw-11), so the money rolls packs write must be read:
  // a "× 10" multiplies the rounded average, a coin word after the dice is read past, and words still give nothing.
  it('reads a money roll: "3d6 x 10 gp" is 100, "3d6 × 10" is 100, "3d6 gp" is 10, and its step is the × number', () => {
    expect(diceAverage('3d6 x 10 gp')).toBe(100);
    expect(diceAverage('3d6 × 10')).toBe(100);
    expect(diceAverage('3d6*10 sp')).toBe(100);
    expect(diceAverage('3d6 gp')).toBe(10);
    expect(diceAverage('2d4 × 5 cp')).toBe(25);
    expect(diceAverage('3d6 x 0 gp')).toBeNull();
    expect(diceAverage('3d6 times ten')).toBeNull();
    expect(diceTimes('3d6 x 10 gp')).toBe(10);
    expect(diceTimes('3d6 gp')).toBe(1);
    expect(diceTimes('a handful')).toBe(1);
  });

  it('gives no rule when the pack has none, or the numbers are missing, so the checker (not the app) says what to add', () => {
    expect(scoresRule([{}])).toBeNull();
    expect(scoresRule([{ scores: { dice: '2d8' } }])).toBeNull();
    expect(scoresRule([{ scores: { dice: '2d8', min: 9, max: 3 } }])).toBeNull();
  });

  it('the last rules set that says wins, as the packs stack', () => {
    expect(scoresRule([...rules, { scores: { dice: '3d4', min: 3, max: 12 } }])?.dice).toBe('3d4');
  });

  it('says when the start-over rule triggers: every score low, or enough scores very low; never without a rule, nor with its option off', () => {
    const rule = scoresRule(rules);
    expect(startOverTriggered(rule, { MUS: 7, NIM: 6, GRT: 5, WIT: 7, LORE: 4, CHARM: 7 })).toBe(true);
    expect(startOverTriggered(rule, { MUS: 12, NIM: 5, GRT: 5, WIT: 4, LORE: 12, CHARM: 10 })).toBe(true);
    expect(startOverTriggered(rule, { MUS: 12, NIM: 5, GRT: 5, WIT: 9, LORE: 12, CHARM: 10 })).toBe(false);
    expect(startOverTriggered(null, { MUS: 2 })).toBe(false);
    const gated = scoresRule([{ scores: { dice: '2d8', min: 2, max: 16, startOver: { everyAtMost: 7, option: 'kind-dice' } } }]);
    expect(startOverTriggered(gated, { MUS: 3 }, () => false)).toBe(false);
    expect(startOverTriggered(gated, { MUS: 3 }, () => true)).toBe(true);
  });
});

describe('the ability adjustment rule (cr-20)', () => {
  it('reads the trade as data, with its exceptions', () => {
    expect(adjustmentRule(rules)).toEqual({
      lowerBy: 2,
      raiseBy: 1,
      lowerable: 'nonPrime',
      raise: 'prime',
      floor: 7,
      cap: 15,
      classExceptions: [{ classId: 'lantern-warden', cannotLower: ['GRT'] }],
      note: 'Lower a score that isn\'t your prime by 2 to raise your prime by 1. Nothing goes under 7.',
      source: 'Fen rules p. 4',
    });
  });

  it('a prose rule, or one without the numbers, gives no rule (so no Adjust scores step)', () => {
    expect(adjustmentRule([{ abilityAdjustment: 'Lower one score by 2 to raise your prime by 1.' }])).toBeNull();
    expect(adjustmentRule([{ abilityAdjustment: { text: 'Lower one score by 2 to raise your prime by 1.' } }])).toBeNull();
    expect(adjustmentRule([{ abilityAdjustment: { lowerBy: 2, raiseBy: 1, lowerable: [], floor: 7 } }])).toBeNull();
    expect(adjustmentRule([{ abilityAdjustment: { lowerBy: 2, raiseBy: 1, lowerable: ['MUS'], floor: 7 } }])).toMatchObject({ lowerable: ['MUS'], cap: null, classExceptions: [] });
  });
});

describe('the languages rule (cr-21)', () => {
  it('reads the common tongue, the alignment switch, the list and the score that gives extras', () => {
    const rule = languagesRule(rules);
    expect(rule).toMatchObject({ common: ['fen-common'], alignment: true, extraFrom: 'WIT' });
    expect(rule?.list.map((l) => l.id)).toEqual(['fen-common', 'reedspeak', 'deep-croak', 'old-lantern']);
    expect(rule?.list[3]).toEqual({ id: 'old-lantern', name: 'Old lantern', blurb: "The wardens' chant, half sung.", note: 'Only wardens learn it.', source: '' });
    expect(languagesRule([{}])).toBeNull();
  });

  it('matches a language a race names by id, else by name (the checker warns), else not at all', () => {
    const rule = languagesRule(rules);
    expect(findLanguage(rule, 'deep-croak')).toEqual({ language: expect.objectContaining({ id: 'deep-croak' }), byName: false });
    expect(findLanguage(rule, 'Reedspeak')).toEqual({ language: expect.objectContaining({ id: 'reedspeak' }), byName: true });
    expect(findLanguage(rule, 'Marsh cant')).toBeNull();
    expect(findLanguage(null, 'deep-croak')).toBeNull();
  });

  it('gives the extra languages as the whole number on the score\'s row, never more than 0 below it, and null when the pack says it in words', () => {
    expect(extraLanguages(rules, { WIT: 3 })).toBe(0);
    expect(extraLanguages(rules, { WIT: 9 })).toBe(1);
    expect(extraLanguages(rules, { WIT: 16 })).toBe(3);
    expect(extraLanguages(rules, {})).toBeNull();
    const words = [{ ...rules[0], abilityModifiers: { WIT: [{ range: '2-16', extraLanguages: 'Native + 1' }] } }];
    expect(extraLanguages(words, { WIT: 9 })).toBeNull();
    const negative = [{ ...rules[0], abilityModifiers: { WIT: [{ range: '2-16', extraLanguages: -1 }] } }];
    expect(extraLanguages(negative, { WIT: 9 })).toBe(0);
  });

  it('reads the score from INT when the rule names none', () => {
    expect(extraLanguages([{ abilityModifiers: { INT: [{ range: '3-18', extraLanguages: 2 }] } }], { INT: 10 })).toBe(2);
  });
});

describe('alignment visibility (cr-22)', () => {
  it('is "owner" only when the pack says so; "all" by default and for anything else', () => {
    expect(alignmentVisibility(rules)).toBe('owner');
    expect(alignmentVisibility([{}])).toBe('all');
    expect(alignmentVisibility([{ alignmentVisibility: 'gm' }])).toBe('all');
    expect(alignmentVisibility([{ alignmentVisibility: 'owner' }, { alignmentVisibility: 'all' }])).toBe('all');
  });
});

describe("abilities' kind (cr-24)", () => {
  it('is disadvantage only when said; advantage otherwise', () => {
    expect(abilityKind({ name: 'Heavy', kind: 'disadvantage' })).toBe('disadvantage');
    expect(abilityKind({ name: 'Stone sense' })).toBe('advantage');
    expect(abilityKind({ name: 'Odd', kind: 'bonus' })).toBe('advantage');
  });

  it('splits an entry\'s abilities under the two headings', () => {
    const stoneKin = pack.races.find((r) => r.id === 'stone-kin')!;
    expect(abilitiesByKind(stoneKin)).toEqual({
      advantage: [{ name: 'Stone sense', note: 'Finds worked stone in the dark.', blurb: 'Knows a causeway from a bog by touch.' }],
      disadvantage: [{ name: 'Heavy', note: "Can't swim.", blurb: "Sinks like what they're named for." }],
    });
  });
});

describe('derived fields (cr-23)', () => {
  const fields = pack.fieldTemplates[0]!.fields;

  it('are the layout fields with a fill, and nothing else', () => {
    expect(derivedFields(fields).map((f) => f.key)).toEqual(['ac', 'movement', 'attack', 'saveMire', 'title', 'literacy', 'hark', 'spellWard']);
  });

  // Affiliation is left out too: it comes from play (the third test, ct3-3).
  it('the fields creation asks on Who they are leave out the derived ones, hidden ones, those other steps own, and an affiliation', () => {
    // Hit points are the app's own (07: rolled from the class's die), never a free field; the fixture's layout lists it since slice 3.
    const owned = new Set(['MUS', 'NIM', 'GRT', 'WIT', 'LORE', 'CHARM', 'languages', 'background', 'omen', 'hp']);
    expect(askedFields([...fields, { key: 'secret', hidden: true }], owned).map((f) => f.key)).toEqual(['alignment', 'motto']);
  });
});

// Purpose (final drafts D): the coin's warning needs the least and the most the dice can give, and the words name the
// dice without the coin word; a value inside the range, or a roll that isn't dice, warns about nothing.
describe('the range of a money roll (final drafts D)', () => {
  it('gives the least and the most, and says which limit a value passes', () => {
    expect(diceRange('3d6 × 10 gp')).toEqual({ min: 30, max: 180 });
    expect(diceRange('2d6+1')).toEqual({ min: 3, max: 13 });
    expect(diceRange('a handful')).toBeNull();
    // 23-H4's words: the value, then what the dice can roll.
    expect(outsideDice('3d6 × 10 gp', 190)).toBe('190 is above what 3d6 × 10 can roll');
    expect(outsideDice('3d6 × 10 gp', 20)).toBe('20 is below what 3d6 × 10 can roll');
    expect(outsideDice('3d6 × 10 gp', 180)).toBeNull();
    expect(outsideDice('a handful', 999)).toBeNull();
  });
});
