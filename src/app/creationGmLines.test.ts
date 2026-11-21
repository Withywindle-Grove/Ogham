// Character creation keeps its lines about the GM (tfw-2, 2026-11-19: "keep them for character creation where i want
// more explicit tutorials, drop them elsewhere"). Invented rules and names only. Purposes:
//   Creation's Armour class pop-up (bq-2; creationAcLines in fromSetting.ts): tfw-1 took "Your GM checks it at the
//   table." out of the sheet's pop-up; it is kept in creation (Francis, 2026-11-19): under a worked figure creation
//   still ends with the line, the sheet's pop-up (acLines) does not, and with no figure to show
//   neither has it.
//   Creation's three other lines stay word for word: the hit points prompt of a class with no hit dice, and alignment's
//   and literacy's ⓘ when the pack gives no note.
import { describe, expect, it } from 'vitest';
import { alignmentAbout, hpPromptLine, literacyAbout } from '../modules/characters/guidance.ts';
import { acLines, workOutAc } from '../modules/characters/play.ts';
import type { CampaignSetting } from './campaignSetting.ts';
import { CREATION_AC_CHECKED, creationAcLines } from './fromSetting.ts';

const settingOf = (rulesSets: Record<string, unknown>[]) => ({ rulesSets, ruleGroups: [], all: [] }) as unknown as CampaignSetting;
const MIRE = settingOf([{ id: 'mire-rules', attack: { unarmouredAC: 10, style: 'ascending' }, abilities: [{ key: 'NIM', name: 'Nimbleness' }] }]);
const nimble = { 'abilityModifiers.NIM': { ac: 1 } };

describe('creation’s Armour class pop-up (tfw-1; kept in creation, Francis, 2026-11-19)', () => {
  it('ends with "Your GM checks it at the table." under a worked figure, where the sheet’s pop-up has no such line', () => {
    const creation = creationAcLines(MIRE, nimble, []);
    expect(creation.at(-1)).toBe(CREATION_AC_CHECKED);
    expect(CREATION_AC_CHECKED).toBe('Your GM checks it at the table.');
    // The sheet's lines for the same figure: the same lines, without the GM's.
    const sheet = acLines(null, workOutAc({ rulesSets: MIRE.rulesSets, chosenStyle: null, worn: [], filled: nimble, abilityName: (k) => (k === 'NIM' ? 'Nimbleness' : k) }));
    expect(creation).toEqual([...sheet, CREATION_AC_CHECKED]);
    expect(sheet).not.toContain(CREATION_AC_CHECKED);
  });

  it('with no figure to show, says so and adds no line about the GM', () => {
    const creation = creationAcLines(settingOf([{ id: 'bare-rules' }]), {}, []);
    expect(creation.at(-1)).toBe("There's no number to show, so enter it by hand.");
    expect(creation).not.toContain(CREATION_AC_CHECKED);
  });
});

describe('creation’s other lines about the GM stay (tfw-2, lines 2 to 4)', () => {
  it('keeps the hit points prompt, and alignment’s and literacy’s ⓘ, with their words about the GM', () => {
    expect(hpPromptLine({ hitDice: null, level: 1 })).toBe('Enter the hit points your GM gives you.');
    expect(alignmentAbout([])).toMatch(/ Your GM decides what it means at your table\.$/);
    expect(literacyAbout([])).toMatch(/ Ask your GM how yours works\.$/);
  });
});
