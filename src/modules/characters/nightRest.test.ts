// The GM's rest prompt as data (nightRest.ts; dec-8 piece D, mp-5). Invented spells and powers: Marsh light, Reed
// whisper; a Lantern Warden's Bird friend and Lantern ward, a Fen fury that comes back after a fight, a Tide call once a
// day and a Moon oath once a week.
import { describe, expect, it } from 'vitest';
import { castKey } from './magicState.ts';
import { restRows, type RestCharacter, type UsesPower } from './magicView.ts';
import { fullRestWords, restApply, restMarksStart, restRowPowers } from './nightRest.ts';
import type { PreparedSpell } from './playState.ts';

const p = (spell: string, level: number, times = 1): PreparedSpell[] => Array.from({ length: times }, () => ({ spell, level }));
const power = (name: string, refill: string, uses = 1): UsesPower => ({ name, uses, refill });

function character(id: string, over: Partial<RestCharacter['play']> = {}, powers: UsesPower[] = [], slots: number[] = []): RestCharacter {
  return { id, slots, powers, play: { prepared: [], chosen: null, spellsCast: {}, usesSpent: {}, ...over } };
}

const wren = character('wren', { prepared: p('marsh-light', 1, 2), chosen: [...p('reed-whisper', 1), ...p('marsh-light', 1)], spellsCast: { [castKey(1, 'marsh-light')]: 2 } }, [], [2]);
const alder = character('alder', { prepared: p('reed-whisper', 1), spellsCast: { [castKey(1, 'reed-whisper')]: 1 } }, [], [1]);
const pike = character('pike', { usesSpent: { 'Bird friend': 1 } }, [power('Bird friend', 'rest'), power('Tide call', 'day'), power('Fen fury', 'fight'), power('Moon oath', 'week')]);

describe('the rest prompt (piece D; mp-5)', () => {
  // Purpose: every listed character's mark starts on ✓; the GM changes it (the lead's answer 6).
  it('every mark starts on ✓', () => {
    expect(restMarksStart(restRows([wren, alder, pike]))).toEqual({ wren: true, alder: true, pike: true });
  });

  // Purpose: the switch carries the state (ds-1c), so a row's only line is its once-a-rest powers: none for a plain
  // caster, the mockup's "Bird friend, once a rest" for Pike, "2 a rest" for two uses, several joined with a full stop.
  it("a row's line is its once-a-rest powers", () => {
    expect(restRowPowers(restRows([wren])[0]!)).toBe('');
    expect(restRowPowers(restRows([pike])[0]!)).toBe('Bird friend, once a rest');
    const [two] = restRows([character('ash', {}, [power('Lantern ward', 'rest', 2), power('Reed step', 'rest')])]);
    expect(restRowPowers(two!)).toBe('Lantern ward, 2 a rest. Reed step, once a rest');
  });

  // Purpose: Apply rest makes a ✓ caster's chosen spells ready (casts cleared by the GM's set) and leaves a ✕ caster out.
  it('a ✓ caster gets the chosen spells; a ✕ caster is left as they were', () => {
    const applied = restApply([wren, alder], { wren: true, alder: false }, true);
    expect(applied.spells).toEqual([{ characterId: 'wren', ready: [...p('reed-whisper', 1), ...p('marsh-light', 1)] }]);
  });

  // Purpose: with nothing chosen anew, a caster's spells cast today come back as today's set; a caster with nothing
  // chosen and nothing cast isn't changed at all, so the log gets no empty line.
  it("nothing chosen anew: today's set back; nothing to change: no line", () => {
    expect(restApply([alder], { alder: true }, true).spells).toEqual([{ characterId: 'alder', ready: p('reed-whisper', 1) }]);
    const fresh = character('fresh', { prepared: p('reed-whisper', 1) }, [], [1]);
    expect(restApply([fresh], { fresh: true }, true).spells).toEqual([]);
  });

  // Purpose (fsr-5): a caster's first rest on ✓ is written even with nothing chosen and nothing cast, so it closes the
  // first spells; on ✕ it is not, and they stay open.
  it("a caster's first rest on ✓ is written even with nothing to change; on ✕ it is not", () => {
    const fen = character('fen', { prepared: p('reed-whisper', 1), restedOnce: false }, [], [1]);
    expect(restApply([fen], { fen: true }, true).spells).toEqual([{ characterId: 'fen', ready: p('reed-whisper', 1) }]);
    expect(restApply([fen], { fen: false }, true).spells).toEqual([]);
    const empty = character('moss', { restedOnce: false }, [], [1]);
    expect(restApply([empty], { moss: true }, true).spells).toEqual([{ characterId: 'moss', ready: [] }]);
  });

  // Purpose: rest uses come back only for those on ✓; day uses for everyone at a full rest (the new day); fight and
  // week uses never at a rest.
  it('uses come back by `per`: rest for ✓, day for everyone, others never', () => {
    expect(restApply([pike], { pike: true }, true).refills).toEqual({ pike: ['Bird friend', 'Tide call'] });
    expect(restApply([pike], { pike: false }, true).refills).toEqual({ pike: ['Tide call'] });
    expect(restApply([pike], { pike: true }, false).refills).toEqual({ pike: ['Bird friend'] });
  });

  // Purpose (mm-8): the summary's line stays as it was with everyone on ✓, and names who was left out: one, two, or
  // more with commas and "and".
  it("the full rest's line names who was left out", () => {
    expect(fullRestWords([])).toBe('Full rest: rest and day abilities are back.');
    expect(fullRestWords(['Wren'])).toBe('Full rest: rest and day abilities are back, except for Wren.');
    expect(fullRestWords(['Wren', 'Ash'])).toBe('Full rest: rest and day abilities are back, except for Wren and Ash.');
    expect(fullRestWords(['Wren', 'Ash', 'Tam'])).toBe('Full rest: rest and day abilities are back, except for Wren, Ash and Tam.');
  });

  // Purpose (#790 review): a caster whose spells were refused after the full rest is named, so the line never implies
  // everyone not left out got their magic back.
  it("the line names casters whose spells didn't come back", () => {
    expect(fullRestWords([], ['Ash'])).toBe("Full rest: rest and day abilities are back. Spells didn't come back for Ash.");
    expect(fullRestWords(['Wren'], ['Ash', 'Tam'])).toBe("Full rest: rest and day abilities are back, except for Wren. Spells didn't come back for Ash and Tam.");
  });

  // Purpose: a character the prompt doesn't list (no magic, no once-a-rest power) still gets its day uses at a full rest.
  it('a character not listed still gets day uses', () => {
    const tam = character('tam', {}, [power('Tide call', 'Day')]);
    expect(restRows([tam])).toEqual([]);
    expect(restApply([tam], {}, true)).toEqual({ spells: [], refills: { tam: ['Tide call'] } });
  });
});
