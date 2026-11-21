// Guided creation revisited (M5b step 0): the pure parts. Invented content only.
import { describe, expect, it } from 'vitest';
import {
  abilityBlurb,
  APP_WHY,
  blurbOf,
  languageList,
  languageText,
  laterSteps,
  requiredSteps,
  settingLanguages,
  stepGuide,
  toFinishName,
  toFinishOf,
  withToFinish,
} from './creationGuide.ts';

const fen = { creationGuide: { languages: 'Words you can speak in the fens.', scores: { why: 'Your scores shape what you do well.', help: 'Roll in order.' } }, creation: { require: ['languages'] } };

describe('creation guide', () => {
  it('every step has a why-line: the pack’s when it has one, else the app’s own', () => {
    expect(stepGuide([fen], 'languages')).toEqual({ why: 'Words you can speak in the fens.', help: null });
    expect(stepGuide([fen], 'scores')).toEqual({ why: 'Your scores shape what you do well.', help: 'Roll in order.' });
    expect(stepGuide([fen], 'race')).toEqual({ why: APP_WHY.race, help: null });
    expect(stepGuide([], 'gear').why).toBe(APP_WHY.gear);
    // An empty pack line falls back to the app's, never a blank.
    expect(stepGuide([{ creationGuide: { class: '  ' } }], 'class').why).toBe(APP_WHY.class);
  });

  it('the top rules set wins when packs stack', () => {
    expect(stepGuide([fen, { creationGuide: { languages: 'Tongues of the reed folk.' } }], 'languages').why).toBe('Tongues of the reed folk.');
  });

  it('only the steps the pack names in creation.require are required', () => {
    expect([...requiredSteps([fen])]).toEqual(['languages']);
    expect(requiredSteps([{}]).size).toBe(0);
    expect(requiredSteps([{ creation: { require: 'languages' } }]).size).toBe(0);
  });

  it('a choice’s line is its blurb, else the older summary, else nothing (never a placeholder or the rules text)', () => {
    expect(blurbOf({ blurb: 'Carries a lantern into the dark.', summary: 'Old line' })).toBe('Carries a lantern into the dark.');
    expect(blurbOf({ summary: 'Old line' })).toBe('Old line');
    expect(blurbOf({ notes: 'A long rules text. With two sentences.' })).toBe('');
  });

  it('an ability’s blurb comes from the rules set’s abilities', () => {
    expect(abilityBlurb([{ abilities: [{ key: 'MUS', name: 'Muscle', blurb: 'Lifting and shoving.' }, 'WIT'] }], 'MUS')).toBe('Lifting and shoving.');
    expect(abilityBlurb([{ abilities: ['WIT'] }], 'WIT')).toBe('');
  });

  it('the steps after Who are they? follow the pack’s order, then the app’s', () => {
    expect(laterSteps([{}], ['languages', 'gear'])).toEqual(['gear', 'languages']);
    expect(laterSteps([{ creationGuide: { languages: 'x', gear: 'y' } }], ['gear', 'languages'])).toEqual(['languages', 'gear']);
    // Named ones first in the pack's order; unnamed ones after, in the app's order.
    expect(laterSteps([{ creationGuide: { languages: 'x' } }], ['gear', 'languages'])).toEqual(['languages', 'gear']);
    // Only the steps present.
    expect(laterSteps([fen], ['gear'])).toEqual(['gear']);
  });

  it('Decide later puts exactly one line in To finish, and finishing takes it off', () => {
    const later = withToFinish({ method: 'split' }, 'languages', true);
    expect(toFinishOf(later)).toEqual(['languages']);
    expect(toFinishOf(withToFinish(later, 'languages', true))).toEqual(['languages']);
    const done = withToFinish(later, 'languages', false);
    expect(done).toEqual({ method: 'split' });
    expect(toFinishOf(null)).toEqual([]);
    expect(toFinishName('languages')).toBe('Languages');
    expect(toFinishName('weaponSkills')).toBe('Weapon skills');
    // A trait list's id (M5b step 0b) reads as words until the setting gives its name.
    expect(toFinishName('fen-backgrounds')).toBe('Fen backgrounds');
  });

  it('the setting’s languages are its races’ and classes’, once each, without ones named after a field', () => {
    const entries = [{ data: { languages: ['Common', 'Reedspeak'] } }, { data: { languages: ['common', 'Alignment', 'Mirefolk'] } }, { data: {} }];
    expect(settingLanguages(entries, ['Alignment'])).toEqual(['Common', 'Reedspeak', 'Mirefolk']);
    expect(languageList('Common, Reedspeak,, Common')).toEqual(['Common', 'Reedspeak']);
    expect(languageText(['Common', ' Reedspeak '])).toBe('Common, Reedspeak');
  });
});

describe("the app's own step lines (dec-10 A, cs-2, cs-31)", () => {
  // Purpose: each step keeps one instruction sentence in the ruled words; a pack's own line still wins (stepGuide).
  it('are the ruled sentences, one each', () => {
    expect(APP_WHY).toMatchObject({
      method: 'Pick the way your table builds a character.',
      race: 'The people your character was born to.',
      class: 'Your trade as an adventurer.',
      who: 'A name the table will remember.',
      spells: 'The spells your character starts with.',
      gear: 'What you carry into your first adventure.',
      languages: 'The tongues your character speaks.',
      weaponSkills: 'The weapons your character has trained with.',
      details: 'None of these change the rules.',
    });
    for (const [step, line] of Object.entries(APP_WHY)) expect(line.split(/(?<=[.!?])\s+(?=[A-Z])/), step).toHaveLength(1);
  });
});
