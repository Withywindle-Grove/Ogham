// The Languages step's rules (M5b step 0c, slice 6; cr-15; 07 `languages`). Invented content only.
//   Purpose: Yours already holds the common tongue, the alignment tongue (only once an alignment is picked, and never
//   when the setting turns alignment tongues off), and the race's and class's languages by their names; the list to
//   pick from leaves those out; N comes from the named score's `extraLanguages`; a score giving 0 extra skips the step;
//   the count stops extra picks and Other… counts as a pick; Next says how many are left; the field keeps the names and
//   reads back; a setting without the languages section still works from its races' and classes' languages; the
//   derived line is the layout's field filled from the same score's row.
import { describe, expect, it } from 'vitest';
import {
  languagesLine,
  addOther,
  languageApprovals,
  languageDerived,
  languageRowName,
  languagesHint,
  languagesOfPlan,
  languagesPlan,
  languagesProblem,
  languagesStepExists,
  NO_LANGUAGE_PICKS,
  numberedBlurb,
  picksFromSaved,
  tapLanguage,
  type LanguagePicks,
  type LanguagesPlan,
} from './languagesStep.ts';

const rules = (extra: Record<string, unknown> = {}) => ({
  abilityModifiers: {
    WIT: [
      { range: '3-8', extraLanguages: 0, literacy: 'Reads slowly' },
      { range: '9-12', extraLanguages: 1, literacy: 'Reads' },
      { range: '13-18', extraLanguages: 2, literacy: 'Reads well' },
    ],
  },
  languages: {
    common: ['fen-common'],
    alignment: true,
    list: [
      { id: 'fen-common', name: 'Fen common', blurb: 'Everyone speaks it.' },
      { id: 'reedspeak', name: 'Reedspeak', blurb: 'Whispers.', source: 'p. 9' },
      { id: 'deep-croak', name: 'Deep croak' },
      { id: 'gull-sign', name: 'Gull-sign', note: 'Silent.' },
    ],
    extraFrom: 'WIT',
  },
  ...extra,
});
const bogFolk = { name: 'Bog folk', data: { languages: ['fen-common', 'deep-croak'] } };
const warden = { name: 'Lantern Warden', data: { languages: ['Alignment', 'Old lantern'] } };
const fields = [{ key: 'alignment', label: 'Alignment' }];

const plan = (over: Partial<Parameters<typeof languagesPlan>[0]> = {}): LanguagesPlan =>
  languagesPlan({ rulesSets: [rules()], race: bogFolk, klass: warden, scores: { WIT: 10 }, alignment: 'Reed', fields, legacy: [], ...over });

const tapped = (p: LanguagesPlan, picks: LanguagePicks, id: string) => {
  const r = tapLanguage(p, picks, id);
  if ('problem' in r) throw new Error(r.problem);
  return r.picks;
};

describe('Yours already', () => {
  it("holds the common tongue, the alignment tongue and the race's and class's languages, once each, by name", () => {
    expect(plan().given.map((g) => [g.name, g.from])).toEqual([
      ['Fen common', 'everyone'],
      ['Reed', 'alignment'],
      ['Deep croak', 'Bog folk'],
      ['Old lantern', 'Lantern Warden'],
    ]);
  });

  it('the alignment tongue follows the alignment picked, and waits until there is one', () => {
    expect(plan({ alignment: 'Mire' }).given.find((g) => g.from === 'alignment')?.name).toBe('Mire');
    expect(plan({ alignment: null }).given.some((g) => g.from === 'alignment')).toBe(false);
  });

  it('is hidden when the setting turns alignment tongues off', () => {
    const off = rules();
    (off.languages as { alignment: boolean }).alignment = false;
    expect(plan({ rulesSets: [off] }).given.some((g) => g.from === 'alignment')).toBe(false);
  });
});

describe('Pick N more', () => {
  it('offers the list without the given ones, N from the named score', () => {
    const p = plan();
    expect(p.offered.map((o) => o.name)).toEqual(['Reedspeak', 'Gull-sign']);
    expect(p.count).toBe(1);
    expect([p.ability, p.score]).toEqual(['WIT', 10]);
    expect(plan({ scores: { WIT: 14 } }).count).toBe(2);
  });

  it('a score giving 0 extra skips the step', () => {
    expect(languagesStepExists(plan({ scores: { WIT: 5 } }))).toBe(false);
    expect(languagesStepExists(plan())).toBe(true);
  });

  it('the count stops an extra pick and says so; Other… counts as a pick; a given one is already yours', () => {
    const p = plan();
    const one = tapped(p, NO_LANGUAGE_PICKS, 'reedspeak');
    expect(tapLanguage(p, one, 'gull-sign')).toEqual({ problem: '1 of 1 picked: take one off to pick another.' });
    expect(addOther(p, one, 'Heron-call')).toEqual({ problem: '1 of 1 picked: take one off to pick another.' });
    expect(addOther(p, NO_LANGUAGE_PICKS, 'deep croak')).toEqual({ problem: 'deep croak is already yours.' });
    expect(addOther(p, NO_LANGUAGE_PICKS, 'Heron-call')).toEqual({ picks: { chosen: [], others: ['Heron-call'] } });
    // Typing a listed one picks it from the list.
    expect(addOther(p, NO_LANGUAGE_PICKS, 'gull-sign')).toEqual({ picks: { chosen: ['gull-sign'], others: [] } });
    // A second tap unpicks.
    expect(tapped(p, one, 'reedspeak')).toEqual(NO_LANGUAGE_PICKS);
  });

  it('Next says how many are left, offering Decide later only when it is there; the hint counts', () => {
    const p = plan({ scores: { WIT: 14 } });
    expect(languagesProblem(p, NO_LANGUAGE_PICKS, true)).toBe('Pick 2 more, or Decide later.');
    expect(languagesProblem(p, NO_LANGUAGE_PICKS, false)).toBe('Pick 2 more.');
    const both = { chosen: ['reedspeak'], others: ['Heron-call'] };
    expect(languagesProblem(p, both, true)).toBeNull();
    expect(languagesHint(p, NO_LANGUAGE_PICKS)).toBe('0 of 2 picked');
    expect(languagesHint(p, both)).toBe('2 of 2 picked');
  });
});

describe('what the field keeps', () => {
  it('the given names, then the picks, then the typed ones; and reads back into picks', () => {
    const p = plan({ scores: { WIT: 14 } });
    const list = languagesOfPlan(p, { chosen: ['gull-sign'], others: ['Heron-call'] });
    expect(list).toEqual(['Fen common', 'Reed', 'Deep croak', 'Old lantern', 'Gull-sign', 'Heron-call']);
    expect(picksFromSaved(p, list.join(', '))).toEqual({ chosen: ['gull-sign'], others: ['Heron-call'] });
    expect(picksFromSaved(p, '')).toEqual(NO_LANGUAGE_PICKS);
  });
});

describe('a setting without the languages section (the older packs)', () => {
  it("the races' and classes' languages are the list; with no count as a number the step lets you pick freely", () => {
    const p = languagesPlan({ rulesSets: [{}], race: null, klass: warden, scores: {}, alignment: 'Reed', fields, legacy: ['Old lantern', 'Reedspeak'] });
    // The class's "Alignment" tongue reads the alignment picked (N7).
    expect(p.given.map((g) => g.name)).toEqual(['Reed', 'Old lantern']);
    expect(p.offered.map((o) => o.name)).toEqual(['Reedspeak']);
    expect(p.count).toBeNull();
    expect(languagesStepExists(p)).toBe(true);
    expect(languagesProblem(p, NO_LANGUAGE_PICKS, true)).toBeNull();
    expect(languagesHint(p, NO_LANGUAGE_PICKS)).toBe('Pick any your GM allows');
    // Nothing else to pick: no step.
    expect(languagesStepExists(languagesPlan({ rulesSets: [{}], race: null, klass: warden, scores: {}, alignment: null, fields, legacy: ['Old lantern'] }))).toBe(false);
  });
});

describe('the derived line', () => {
  it("is the layout's field filled from the same score's row, never the extra-languages count", () => {
    const layout = [
      { key: 'literacy', label: 'Literacy', fill: 'abilityModifiers.WIT.literacy', hidden: false },
      { key: 'extra', label: 'Extra', fill: 'abilityModifiers.WIT.extraLanguages', hidden: false },
      { key: 'ac', label: 'Armour', fill: 'abilityModifiers.NIM.ac', hidden: false },
    ];
    const rows = [
      { key: 'literacy', label: 'Literacy', value: 'Reads' },
      { key: 'extra', label: 'Extra', value: '1' },
      { key: 'ac', label: 'Armour', value: '7' },
    ];
    expect(languageDerived(layout, rows, 'WIT')).toEqual([{ label: 'Literacy', value: 'Reads' }]);
  });
});

// Creation survey PR 4 (cs-6, G-90, G-93; rc-5). Purposes:
//   An overlay's languages join its base's list; the base's common tongue and extras stay, and the overlay's own
//   language of the same id replaces the base's.
//   Rolled languages show their range first and come in the die's order, before those only chosen; the plan names the die.
//   A hard learnableBy leaves a language out for other kinds (and counts it); a soft one is offered with the GM's leave,
//   and picking it gives a special approval for the GM; a kindred with no creature type isn't limited.
describe('rolled, limited and overlay languages (cs-6)', () => {
  const rolledRules = () =>
    rules({
      languages: {
        common: ['fen-common'],
        alignment: false,
        list: [
          { id: 'fen-common', name: 'Fen common' },
          { id: 'gull-sign', name: 'Gull-sign', roll: { die: 'd6', min: 4, max: 6 } },
          { id: 'reedspeak', name: 'Reedspeak', roll: { die: 'd6', min: 1, max: 1 } },
          { id: 'deep-croak', name: 'Deep croak', roll: { die: 'd6', min: 2, max: 3 }, learnableBy: ['mortal'] },
          { id: 'moth-hum', name: 'Moth hum', learnableBy: { types: ['fae'], soft: true } },
          { id: 'old-lantern', name: 'Old lantern', learnableBy: { types: [], soft: true } },
        ],
        extraFrom: 'WIT',
      },
    });
  const plain = { name: 'Lantern Warden', data: {} };

  it("an overlay's languages join its base's list; the base's common tongue and extras stay", () => {
    const overlay = { languages: { list: [{ id: 'eel-click', name: 'Eel click', source: 'i2' }, { id: 'reedspeak', name: 'Reedspeak', blurb: 'The overlay’s words.' }] } };
    const p = plan({ rulesSets: [rules(), overlay], race: null, klass: plain });
    expect(p.given.map((g) => g.name)).toEqual(['Fen common', 'Reed']);
    expect(p.offered.map((o) => o.name)).toEqual(['Reedspeak', 'Deep croak', 'Gull-sign', 'Eel click']);
    expect(p.offered.find((o) => o.id === 'reedspeak')?.blurb).toBe('The overlay’s words.');
    expect(p.ability).toBe('WIT');
  });

  it("rolled languages show their range first, in the die's order, before those only chosen", () => {
    const p = plan({ rulesSets: [rolledRules()], race: null, klass: plain, creatureType: 'mortal' });
    expect(p.die).toBe('d6');
    expect(p.offered.map(languageRowName)).toEqual(['1: Reedspeak', '2–3: Deep croak', '4–6: Gull-sign', 'Moth hum', 'Old lantern']);
  });

  it('a hard limit leaves a language out for other kinds; a soft one asks the GM, and picking it is flagged', () => {
    const fae = plan({ rulesSets: [rolledRules()], race: null, klass: plain, creatureType: 'fae' });
    expect(fae.offered.map((o) => o.id)).not.toContain('deep-croak');
    expect(fae.closed).toBe(1);
    expect(fae.offered.find((o) => o.id === 'moth-hum')?.leave).toBe('');
    const mortal = plan({ rulesSets: [rolledRules()], race: null, klass: plain, creatureType: 'mortal' });
    expect(mortal.closed).toBe(0);
    expect(mortal.offered.find((o) => o.id === 'moth-hum')?.leave).toBe('Usually learnt only by fae kinds');
    expect(mortal.offered.find((o) => o.id === 'old-lantern')?.leave).toBe('Only with the GM’s leave');
    const picks = tapped(mortal, NO_LANGUAGE_PICKS, 'moth-hum');
    expect(languageApprovals(mortal, picks)).toEqual([{ step: 'languages', entryId: 'moth-hum', name: 'Moth hum', requirement: 'Usually learnt only by fae kinds' }]);
    expect(languageApprovals(mortal, tapped(mortal, NO_LANGUAGE_PICKS, 'reedspeak'))).toEqual([]);
  });

  // Purpose (final drafts D, P30): a number of the die is never silently missing; the left-out language keeps its
  // place, with why, and a rolled row's line starts with its number in words.
  it('a language the kind cannot learn keeps its number and its reason; a rolled line starts with its number', () => {
    const fae = plan({ rulesSets: [rolledRules()], race: { name: 'Moth kin', data: {} }, klass: plain, creatureType: 'fae' });
    expect(fae.closedRows).toEqual([{ id: 'deep-croak', name: 'Deep croak', range: '2–3', min: 2, reason: 'Not open to Moth kin' }]);
    expect(plan({ rulesSets: [rolledRules()], race: null, klass: plain, creatureType: 'fae' }).closedRows[0]?.reason).toBe('Not open to your kind');
    expect(numberedBlurb('2–3', 'The common speech')).toBe('2 to 3. The common speech');
    expect(numberedBlurb('4', '')).toBe('4.');
    expect(numberedBlurb('', 'Coded talk')).toBe('Coded talk');
  });

  // Purpose (review of #386): a hard limit naming no type would hide a language from everyone; it limits nothing instead.
  it('a hard limit naming no creature type limits nothing', () => {
    const r = rolledRules();
    (r.languages as { list: Record<string, unknown>[] }).list.push({ id: 'eel-click', name: 'Eel click', learnableBy: [] }, { id: 'heron-call', name: 'Heron-call', learnableBy: { types: [] } });
    const p = plan({ rulesSets: [r], race: null, klass: plain, creatureType: 'mortal' });
    expect(p.offered.filter((o) => ['eel-click', 'heron-call'].includes(o.id)).map((o) => o.leave)).toEqual(['', '']);
  });

  it('a kindred with no creature type is not limited', () => {
    const p = plan({ rulesSets: [rolledRules()], race: null, klass: plain });
    expect(p.closed).toBe(0);
    expect(p.offered.some((o) => o.id === 'deep-croak')).toBe(true);
  });
});

describe("the Languages step's line (dec-10 A, cs-2)", () => {
  // Purpose: the step's one line, then a second sentence only as a true fact: how many more tongues the character's
  // score gives, by the score's name as the pack writes it; silent when it gives none or the pack has no such table.
  const base = 'The tongues your character speaks.';
  it('a score that gives none, one or three more', () => {
    expect(languagesLine(base, { count: 0, score: 9 }, 'Wits')).toBe(base);
    expect(languagesLine(base, { count: 1, score: 13 }, 'Wits')).toBe('The tongues your character speaks. Wits 13 gives you one more.');
    expect(languagesLine(base, { count: 3, score: 18 }, 'Wits')).toBe('The tongues your character speaks. Wits 18 gives you 3 more.');
  });
  it('a pack with no such table, or no score yet, says the first sentence alone', () => {
    expect(languagesLine(base, { count: null, score: 13 }, 'Wits')).toBe(base);
    expect(languagesLine(base, { count: 2, score: null }, 'Wits')).toBe(base);
  });
});
