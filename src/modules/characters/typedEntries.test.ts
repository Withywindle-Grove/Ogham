// Other… typed at creation, for the GM's review (M5b step 0c, follow-up C; cf-6). Pure; invented names.
//   A language the plan neither gives nor offers is typed; the given and the list's are not.
//   A trait field whose value isn't an entry of its list is typed, with its note split off; an entry's name isn't.
//   The homebrew "Campaign languages" rules set keeps the top set's languages block and appends the new one with a
//   unique id; a trait list's homebrew version appends the entry with its note.
//   A slug is lowercase letters, digits and dashes; nothing left gives "other".
//   A weapon skill typed with Other… (PR G) is typed; a pick from the list isn't. Its homebrew item has a unique id,
//   the typed name, an empty weapon block, and the setting's one weapon category when there is just one.
import { describe, expect, it } from 'vitest';
import { languagesPlan } from './languagesStep.ts';
import { traitListsOf, traitSteps } from './traitLists.ts';
import { languageKnown, slugOf, traitKnown, typedEntries, weaponKnown, withLanguage, withTraitEntry, withWeapon } from './typedEntries.ts';

const rules = { languages: { common: ['fen-common'], alignment: true, list: [{ id: 'fen-common', name: 'Fen common' }, { id: 'reedspeak', name: 'Reedspeak' }, { id: 'deep-croak', name: 'Deep croak' }], extraFrom: 'WIT' }, scores: { dice: '2d8' } };
const race = { name: 'Bog folk', data: { languages: ['deep-croak'] } };
const klass = { name: 'Lantern Warden', data: {} };
const plan = languagesPlan({ rulesSets: [rules], race, klass, scores: { WIT: 12 }, alignment: null, fields: [], legacy: [] });
const languagesField = { key: 'languages', label: 'Languages', type: 'text', choices: [], group: '', sortOrder: 0, showOnCard: false, hidden: false, fill: null, required: false, from: null } as never;
const backgroundField = { key: 'background', label: 'Background', type: 'list', choices: [], group: '', sortOrder: 1, showOnCard: false, hidden: false, fill: null, required: false, from: 'fen-backgrounds' } as never;
const listEntry = { kind: 'traitList', packEntryId: 'fen-backgrounds', name: 'Backgrounds', data: { id: 'fen-backgrounds', name: 'Backgrounds', entries: [{ id: 'reed-cutter', name: 'Reed cutter' }] } };
const lists = traitListsOf([listEntry]);
const steps = traitSteps([backgroundField], lists);

describe('typedEntries', () => {
  it('finds a typed language and a typed trait entry with its note, and leaves the given, the offered and the list’s entries alone', () => {
    const fields = { languages: 'Fen common, Deep croak, Reedspeak, Heron-call', background: 'Mud diver — knows the flats' };
    expect(typedEntries({ fields, languagesField, languagePlan: plan, traitSteps: steps })).toEqual([
      { kind: 'language', name: 'Heron-call' },
      { kind: 'trait', name: 'Mud diver', note: 'knows the flats', listId: 'fen-backgrounds', listName: 'Backgrounds' },
    ]);
    expect(typedEntries({ fields: { languages: 'Fen common, Deep croak', background: 'reed-cutter' }, languagesField, languagePlan: plan, traitSteps: steps })).toEqual([]);
    expect(typedEntries({ fields, languagesField: null, languagePlan: null, traitSteps: [] })).toEqual([]);
  });
  it('knows what the setting already has, by id or name, so nothing is added twice', () => {
    expect(languageKnown([rules], 'reedspeak')).toBe(true);
    expect(languageKnown([rules], 'Deep Croak')).toBe(true);
    expect(languageKnown([rules], 'Heron-call')).toBe(false);
    expect(traitKnown(lists[0]!, 'reed cutter')).toBe(true);
    expect(traitKnown(lists[0]!, 'Mud diver')).toBe(false);
  });
});

describe('typed weapon skills (PR G)', () => {
  const items = [
    { packEntryId: 'reed-spear', name: 'Reed spear', data: { category: 'weapon', weapon: { damage: '1d6' } } },
    { packEntryId: 'eel-knife', name: 'Eel knife', data: { category: 'weapon', weapon: { damage: '1d4' } } },
    { packEntryId: 'heron-hook', name: 'Heron hook', data: { category: 'gear' } },
  ];
  it('a weapon typed with Other… is typed; a weapon picked from the list is not', () => {
    const weaponSkills = [{ itemId: 'reed-spear' }, { itemId: 'Heron hook', other: true, specialised: true }];
    expect(typedEntries({ fields: {}, languagesField: null, languagePlan: null, traitSteps: [], weaponSkills })).toEqual([{ kind: 'weapon', name: 'Heron hook' }]);
    expect(typedEntries({ fields: {}, languagesField: null, languagePlan: null, traitSteps: [], weaponSkills: [{ itemId: 'reed-spear' }] })).toEqual([]);
  });
  it('knows a weapon the setting has by id or name; an item that is not a weapon does not count', () => {
    expect(weaponKnown(items, 'Reed Spear')).toBe(true);
    expect(weaponKnown(items, 'eel-knife')).toBe(true);
    expect(weaponKnown(items, 'Heron hook')).toBe(false);
  });
  it('the homebrew item: a unique id among all items, the typed name, an empty weapon block, the one weapon category', () => {
    expect(withWeapon(items, ' Heron hook ')).toEqual({ id: 'heron-hook-2', name: 'Heron hook', category: 'weapon', weapon: {} });
    expect(withWeapon([...items, { packEntryId: 'bog-sling', name: 'Bog sling', data: { category: 'missile', weapon: {} } }], 'Mud flail')).toEqual({ id: 'mud-flail', name: 'Mud flail', weapon: {} });
  });
});

describe('the homebrew entries', () => {
  it('the Campaign languages rules set keeps the top languages block and appends the language with a unique id', () => {
    const made = withLanguage([{ languages: { list: [{ id: 'old', name: 'Old' }] } }, rules], 'Heron call');
    expect(made).toEqual({ id: 'campaign-languages', name: 'Campaign languages', languages: { ...rules.languages, list: [...rules.languages.list, { id: 'heron-call', name: 'Heron call' }] } });
    // Added again on top of itself (the second typed language): the list grows, and a clashing id gets a number.
    const again = withLanguage([rules, made!], 'Reedspeak!');
    expect((again!.languages as { list: unknown[] }).list).toHaveLength(5);
    expect((again!.languages as { list: { id: string }[] }).list.at(-1)).toEqual({ id: 'reedspeak-2', name: 'Reedspeak!' });
    expect(withLanguage([{ scores: {} }], 'Heron call')).toBeNull();
  });
  it('a trait list’s homebrew version appends the entry with its note and keeps the rest of the list', () => {
    expect(withTraitEntry(lists[0]!, listEntry.data, 'Mud diver', 'knows the flats')).toEqual({ id: 'fen-backgrounds', name: 'Backgrounds', entries: [{ id: 'reed-cutter', name: 'Reed cutter' }, { id: 'mud-diver', name: 'Mud diver', notes: 'knows the flats' }] });
    expect((withTraitEntry(lists[0]!, listEntry.data, 'Reed cutter', '').entries as { id: string }[]).at(-1)).toEqual({ id: 'reed-cutter-2', name: 'Reed cutter' });
  });
  it('a slug is lowercase letters, digits and dashes', () => {
    expect(slugOf('Heron call')).toBe('heron-call');
    expect(slugOf('  Élan — du   marais ')).toBe('elan-du-marais');
    expect(slugOf('!!!')).toBe('other');
  });
});
