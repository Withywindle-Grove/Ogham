// The creation hotfix of 2026-11-06 (before the players' test), pure. Every name is invented.
//   A sheet layout field marked atCreation: false is left out under both forms of its key, so a campaign holding it in
//   lower case ("Use this sheet layout") still leaves it out; the weapon skills step's field is known in both forms.
//   A language a race or class names by id reads by its name from the setting's list, an overlay's list included, in
//   the race and class headings, a new character's languages and the setting's languages; an id the list lacks reads
//   as written.
import { describe, expect, it } from 'vitest';
import { languageNamer } from './creationRules.ts';
import { settingLanguages } from './creationGuide.ts';
import { classHeadings, raceHeadings } from './creationSteps.ts';
import { startingLanguages } from './guidance.ts';
import { notAskedAtCreation } from './traitLists.ts';
import { isWeaponSkillsField } from './weaponSkills.ts';

describe('field keys in both forms', () => {
  it('a field marked atCreation: false is left out under its lower-case key too', () => {
    const out = notAskedAtCreation([{ kind: 'fieldTemplate', data: { fields: [{ key: 'reedOath', label: 'Reed oath', atCreation: false }, { key: 'Motto', label: 'Motto' }] } }]);
    expect(out.has('reedOath')).toBe(true);
    expect(out.has('reedoath')).toBe(true);
    expect(out.has('motto')).toBe(false);
  });

  it("the weapon skills step's field is known as the layout writes it and in lower case, and no other is", () => {
    expect(isWeaponSkillsField('weaponProficiencies')).toBe(true);
    expect(isWeaponSkillsField('weaponproficiencies')).toBe(true);
    expect(isWeaponSkillsField('languages')).toBe(false);
  });
});

describe('language names, not ids', () => {
  const base = { languages: { common: ['fen-common'], list: [{ id: 'fen-common', name: 'Fen common' }] } };
  const overlay = { languages: { list: [{ id: 'zz-reedspeak', name: 'Reedspeak' }] } };
  const rulesSets = [base, overlay];
  const label = (k: string) => k;

  it("reads an id by its name from the merged list (an overlay's too); one the list lacks reads as written", () => {
    const name = languageNamer(rulesSets);
    expect([name('fen-common'), name('zz-reedspeak'), name('Moss cant')]).toEqual(['Fen common', 'Reedspeak', 'Moss cant']);
    expect(languageNamer([])('zz-reedspeak')).toBe('zz-reedspeak');
  });

  it('the race and class headings name the languages', () => {
    const race = { packEntryId: 'bog-folk', name: 'Bog folk', data: { languages: ['fen-common', 'zz-reedspeak', 'Moss cant'] } };
    const klass = { packEntryId: 'lantern-warden', name: 'Lantern Warden', data: { languages: ['zz-reedspeak'] } };
    const languages = (headings: { label: string; text?: string }[]) => headings.find((h) => h.label === 'Languages')?.text;
    expect(languages(raceHeadings(race as never, {}, label, () => undefined, undefined, rulesSets))).toBe('Fen common, Reedspeak, Moss cant');
    expect(languages(classHeadings(klass as never, null, {}, rulesSets, label))).toBe('Reedspeak');
  });

  it("a new character's languages and the setting's languages use the names", () => {
    const name = languageNamer(rulesSets);
    expect(startingLanguages([['fen-common'], ['zz-reedspeak']], [], {}, name)).toBe('Fen common, Reedspeak');
    expect(settingLanguages([{ data: { languages: ['zz-reedspeak', 'Reedspeak', 'fen-common'] } }], [], name)).toEqual(['Reedspeak', 'Fen common']);
  });
});
