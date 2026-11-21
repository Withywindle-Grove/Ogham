// Guided creation's words (A5; words batch 1, ruled 2026-10-26). Invented setting.
import { describe, expect, it } from 'vitest';
import { alignmentAbout, extraLanguagesHint, hpModifierOf, hpPromptLine, literacyAbout, startingLanguages } from './guidance.ts';

describe('the HP prompt (words batch 1, §2)', () => {
  it('the roll first, then what to add; per die and "(at least 1)" only when the pack says; zero is left out', () => {
    expect(hpPromptLine({ hitDice: '1d8', level: 1, modifier: { value: 1, ability: 'CON' } })).toBe('Roll 1d8, then add 1 for CON');
    expect(hpPromptLine({ hitDice: '2d8', level: 2, modifier: { value: 1, ability: 'CON' }, perDie: true })).toBe('Roll 2d8 for level 2, then add 1 for CON to each die');
    expect(hpPromptLine({ hitDice: '1d6', level: 1, modifier: { value: -1, ability: 'CON' }, atLeastOne: true })).toBe('Roll 1d6, then subtract 1 for CON (at least 1)');
    expect(hpPromptLine({ hitDice: '1d6', level: 1, modifier: { value: 0, ability: 'CON' } })).toBe('Roll 1d6');
    expect(hpPromptLine({ hitDice: null, level: 1 })).toBe('Enter the hit points your GM gives you.');
  });

  it('finds the HP modifier in the filled ability rows', () => {
    expect(hpModifierOf({ 'abilityModifiers.STR': { melee: 1 }, 'abilityModifiers.CON': { hp: -1 } })).toEqual({ value: -1, ability: 'CON' });
    expect(hpModifierOf({ attack: 19 })).toBeNull();
  });
});

describe('the ⓘ texts (words batch 1, §3)', () => {
  it("uses the pack's alignment and literacy notes, else the fallbacks", () => {
    expect(alignmentAbout([{ alignmentNotes: { general: 'Your outlook.', Lawful: 'Order first.' } }])).toBe('Your outlook. Lawful: Order first.');
    expect(alignmentAbout([])).toMatch(/^Alignment is your character's broad outlook/);
    expect(literacyAbout([{ literacyNote: { Illiterate: "Can't read." } }])).toBe("Illiterate: Can't read.");
    expect(literacyAbout([])).toMatch(/^Literacy is whether your character can read and write/);
  });

  it('names extra languages when the scores give a number', () => {
    expect(extraLanguagesHint({ 'abilityModifiers.INT': { extraLanguages: 2 } })).toBe('Additional languages: 2 to choose, as your setting allows.');
    expect(extraLanguagesHint({ 'abilityModifiers.INT': { languages: 'Native' } })).toBeNull();
  });
});

describe("a new character's languages (N7, M4b re-test 2026-10-28)", () => {
  const fields = [
    { key: 'oath', label: 'Oath' },
    { key: 'languages', label: 'Languages' },
  ];
  it('lists the race and class languages once each; one named after a field is left out until it is chosen, then reads its value', () => {
    const lists = [['Reedspeak', 'Common'], ['Oath', 'Common']];
    expect(startingLanguages(lists, fields, {})).toBe('Reedspeak, Common');
    expect(startingLanguages(lists, fields, { oath: '' })).toBe('Reedspeak, Common');
    expect(startingLanguages(lists, fields, { oath: 'Lantern' })).toBe('Reedspeak, Common, Lantern');
    expect(startingLanguages([undefined, 'not a list'], fields, {})).toBe('');
  });
});
