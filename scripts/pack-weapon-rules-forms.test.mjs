// npm run pack:check on a rules set's weaponRules (eq-7, mb-4) and classes' forms (eq-8), ruled 2026-11-04
// (scripts/pack-equipment.mjs; area 3 order 10). Warnings only; the ruled shapes pass. Every name is made up.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { equipmentNotes } from './pack-equipment.mjs';
import { formatNotes } from './pack-format.mjs';

const classes = [
  { id: 'reed-warden', name: 'Reed warden', weaponProficiencyCategory: 'martial' },
  { id: 'bog-witch', name: 'Bog witch', weaponProficiencyCategory: 'gentle' },
];
const rules = (weaponRules) => ({ classes, rulesSets: [{ id: 'fen-rules', name: 'Fen rules', weaponRules }] });

describe('weaponRules (eq-7, mb-4)', () => {
  // Purpose: the ruled shape, with exceptClasses and a note, passes without a word.
  it('passes the ruled shape', () => {
    expect(equipmentNotes(rules([{ category: 'Thunder-tube', classCategories: ['martial'], exceptClasses: ['bog-witch'], note: 'The referee decides.' }]))).toEqual([]);
    expect(equipmentNotes(rules([{ category: 'Thunder-tube', classCategories: ['martial'] }]))).toEqual([]);
  });

  // Purpose: an entry the app can't read (no category, categories not a list, the whole field not a list) is noted,
  // since the app leaves it out without a word.
  it('notes entries the app leaves out', () => {
    expect(equipmentNotes(rules([{ classCategories: ['martial'] }, { category: 'Pike', classCategories: 'martial' }, 'nope']))).toEqual([
      'rulesSets: "fen-rules", weaponRules 1 needs a text category and classCategories as a list of class categories; the app leaves the rule out.',
      'rulesSets: "fen-rules", weaponRules 2 needs a text category and classCategories as a list of class categories; the app leaves the rule out.',
      'rulesSets: "fen-rules", weaponRules 3 needs a text category and classCategories as a list of class categories; the app leaves the rule out.',
    ]);
    expect(equipmentNotes(rules({ category: 'Pike' }))).toEqual(['rulesSets: "fen-rules", weaponRules should be a list of { category, classCategories }; the app reads none of it.']);
  });

  // Purpose: with classes in the file, a class category nobody carries and an exceptClasses id that isn't a class
  // are noted (the rule would reach or except nobody); a malformed exceptClasses or note too. Without classes, the
  // category and id checks keep quiet.
  it('checks class categories and exceptClasses against the file’s classes', () => {
    expect(equipmentNotes(rules([{ category: 'Thunder-tube', classCategories: ['martial', 'semi-martial'], exceptClasses: ['knight'], note: 3 }]))).toEqual([
      'rulesSets: "fen-rules", weaponRules 1 ("Thunder-tube"): note should be text; the app shows none.',
      'rulesSets: "fen-rules", weaponRules 1 ("Thunder-tube") names the class category "semi-martial", which no class here carries as weaponProficiencyCategory.',
      'rulesSets: "fen-rules", weaponRules 1 ("Thunder-tube"): exceptClasses names "knight", which isn\'t a class here.',
    ]);
    expect(equipmentNotes(rules([{ category: 'Thunder-tube', classCategories: ['martial'], exceptClasses: 'bog-witch' }]))).toEqual([
      'rulesSets: "fen-rules", weaponRules 1 ("Thunder-tube"): exceptClasses should be a list of class ids; the app excepts no class.',
    ]);
    expect(equipmentNotes({ rulesSets: [{ id: 'overlay', weaponRules: [{ category: 'Thunder-tube', classCategories: ['semi-martial'], exceptClasses: ['knight'] }] }] })).toEqual([]);
  });
});

const forms = (list) => ({ classes: [{ id: 'phase-kin', name: 'Phase kin', forms: list }] });

describe('classes[].forms (eq-8)', () => {
  // Purpose: the ruled shape passes; a form may carry only one of the two limits.
  it('passes the ruled shape', () => {
    expect(
      equipmentNotes(
        forms([
          { id: 'dawn-phase', name: 'Dawn phase', weaponsAllowed: { mode: 'any' }, armourAllowed: { types: 'any', shields: true }, note: 'Anything.' },
          { id: 'dusk-phase', name: 'Dusk phase', weaponsAllowed: { mode: 'list', ids: ['eel-knife'] }, note: 'Knives.' },
        ]),
      ),
    ).toEqual([]);
  });

  // Purpose: a form without an id is left out by the app, so it's noted; a repeated id, a missing name, a limit that
  // isn't a rule and a form that changes nothing are noted too; a `forms` that isn't a list is one note.
  it('notes forms the app leaves out or that change nothing', () => {
    expect(
      equipmentNotes(
        forms([
          { name: 'No id', weaponsAllowed: { mode: 'any' } },
          { id: 'dusk-phase', weaponsAllowed: 'knives' },
          { id: 'dusk-phase', name: 'Dusk again', armourAllowed: { types: [] } },
          { id: 'bare-phase', name: 'Bare phase' },
        ]),
      ),
    ).toEqual([
      'classes: "phase-kin", forms 1 has no id; the app leaves the form out.',
      'classes: "phase-kin", forms 2 ("dusk-phase") has no name; the switch shows its id.',
      'classes: "phase-kin", forms 2 ("dusk-phase"): weaponsAllowed should be a rule like the class\'s; the app reads the class\'s instead.',
      'classes: "phase-kin", forms 2 ("dusk-phase") has neither weaponsAllowed nor armourAllowed; it changes nothing but the name.',
      'classes: "phase-kin", forms 3 ("dusk-phase") repeats an earlier form\'s id; only the first can be the current form.',
      'classes: "phase-kin", forms 4 ("bare-phase") has neither weaponsAllowed nor armourAllowed; it changes nothing but the name.',
    ]);
    expect(equipmentNotes(forms('dusk'))).toEqual(['classes: "phase-kin", forms should be a list of { id, name, weaponsAllowed?, armourAllowed?, note }; the app reads none of it.']);
  });
});

describe('the area-3 fixture', () => {
  // Purpose: the fixture's weapon rules and forms pass, and its one deliberate oddity (a rule naming a class
  // category no class carries) is the only new note, so the checker's output stays readable.
  it('gets the expected notes from the fixture', () => {
    const file = JSON.parse(readFileSync('scripts/fixtures/m5b-review-area-3.fixture.json', 'utf8'));
    const notes = formatNotes(file).filter((n) => n.includes('weaponRules') || n.includes('forms'));
    expect(notes).toEqual(['rulesSets: "fen-gear-rules", weaponRules 2 ("Hand-cannon") names the class category "iron-born", which no class here carries as weaponProficiencyCategory.']);
  });
});
