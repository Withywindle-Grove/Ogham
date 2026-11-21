// A race's save bonus by CON, its skill targets that hold only in a situation, and its optional abilities behind an
// option (07 Races; the creation surveys' follow-up, 2026-11-03; fills.ts raceNotes, raceOptions.ts). Every name and
// number is invented.
//   A score range may read "6 or lower" or "16 or more", as well as "7-10" and "18".
//   The save bonus is the byCon row for the CON score, beside each save it names ("+2 to the roll"), and "vs <what>"
//   for a save named with a qualifier ("R(rot)"); a 0 bonus, no CON score or no matching row says nothing.
//   A skill target {value, when} is said beside the skill ("4 when wading"); a plain number isn't a note.
//   Optional abilities apply only when the named option has the named choice: the score changes add to the race's
//   own, the abilities join its own (no repeat by name); otherwise the race is returned as it was.
import { describe, expect, it } from 'vitest';
import { conSaveBonus, inRange, raceNotes, saveKeyOf } from './fills.ts';
import { raceInPlay, withRaceOptions } from './raceOptions.ts';

const byCon = [
  { con: '6 or lower', bonus: 0 },
  { con: '7-10', bonus: 1 },
  { con: '11-15', bonus: 2 },
  { con: '16 or more', bonus: 3 },
];
const mossKin = { id: 'moss-kin', name: 'Moss kin', saveBonusByCon: { saves: ['R(rot)', 'M', 'G'], byCon }, skillTargets: { hark: 5, delve: { value: 4, when: 'wading' } } };

describe('score ranges in words (inRange)', () => {
  it('reads "N or lower" and "N or more" as well as spans and single scores', () => {
    expect(inRange('6 or lower', 3)).toBe(true);
    expect(inRange('6 or lower', 7)).toBe(false);
    expect(inRange('16 or more', 19)).toBe(true);
    expect(inRange('16 or more', 15)).toBe(false);
    expect(inRange('7-10', 9)).toBe(true);
    expect(inRange('18', 18)).toBe(true);
  });
});

describe('a race’s save bonus by CON', () => {
  it('names the save and what it is against ("R(rot)": R, only against rot)', () => {
    expect(saveKeyOf('R(rot)')).toEqual({ key: 'R', against: 'rot' });
    expect(saveKeyOf('M')).toEqual({ key: 'M', against: null });
  });

  it('takes the row for the CON score', () => {
    expect(conSaveBonus(mossKin, { CON: 5 })).toBe(0);
    expect(conSaveBonus(mossKin, { CON: 12 })).toBe(2);
    expect(conSaveBonus(mossKin, { CON: 17 })).toBe(3);
    expect(conSaveBonus(mossKin, { MUS: 12 })).toBeNull();
    expect(conSaveBonus({ id: 'reed-folk' }, { CON: 12 })).toBeNull();
  });

  it('says the bonus beside each save it names, with "vs" for a qualified one', () => {
    const notes = raceNotes(mossKin, { CON: 12 });
    expect(notes['saves.R']).toBe('+2 to the roll vs rot');
    expect(notes['saves.M']).toBe('+2 to the roll');
    expect(notes['saves.G']).toBe('+2 to the roll');
  });

  it('says nothing for a 0 bonus or without a CON score', () => {
    expect(Object.keys(raceNotes(mossKin, { CON: 4 })).filter((k) => k.startsWith('saves.'))).toEqual([]);
    expect(Object.keys(raceNotes(mossKin, {})).filter((k) => k.startsWith('saves.'))).toEqual([]);
  });
});

describe('a skill target that holds only in a situation', () => {
  it('is said beside the skill; a plain target is not a note', () => {
    const notes = raceNotes(mossKin, { CON: 12 });
    expect(notes['skills.delve']).toBe('4 when wading');
    expect(notes['skills.hark']).toBeUndefined();
  });
});

describe('optional abilities behind an option', () => {
  const human = {
    id: 'lowlander',
    name: 'Lowlander',
    abilityModifiers: { MUS: 1 },
    abilities: [{ name: 'Steady' }],
    optionalAbilities: { whenOption: 'kin-limits=lifted', abilityModifiers: { MUS: 1, WIT: 1 }, abilities: [{ name: 'Lucky' }, { name: 'Steady' }] },
  };

  it('apply when the named option has the named choice', () => {
    const inPlay = raceInPlay(human, { 'kin-limits': 'lifted' });
    expect(inPlay.abilityModifiers).toEqual({ MUS: 2, WIT: 1 });
    expect((inPlay.abilities as { name: string }[]).map((a) => a.name)).toEqual(['Steady', 'Lucky']);
  });

  it('leave the race as it was with another choice, or none', () => {
    expect(raceInPlay(human, { 'kin-limits': 'kept' })).toBe(human);
    expect(raceInPlay(human, {})).toBe(human);
  });

  it('touch only races among the setting’s entries', () => {
    const entries: { kind: string; data: Record<string, unknown> }[] = [
      { kind: 'race', data: human },
      { kind: 'class', data: { id: 'reed-singer', optionalAbilities: human.optionalAbilities } },
    ];
    const out = withRaceOptions(entries, { 'kin-limits': 'lifted' });
    expect(out[0]!.data.abilityModifiers).toEqual({ MUS: 2, WIT: 1 });
    expect(out[1]).toBe(entries[1]);
  });
});
