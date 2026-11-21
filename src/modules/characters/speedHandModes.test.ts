// A hand-marked speed drives the movement modes (the speed cure's follow-up, the lead's, 2026-11-14): where a speed is
// marked as typed by hand, every figure the rules work out from speed is worked out from it, by the pack's own rule
// for that mode and the same rounding as today. On invented rules.
import { describe, expect, it } from 'vitest';
import { movementOf } from './movement.ts';

describe('a hand-marked speed drives the modes', () => {
  it('a hand speed of 35 gives every mode worked out from 35, by the pack’s own rule and rounding; words stay words', () => {
    // Purpose: a player who writes their own speed sees In a fight, Exploring, Overland and the folded modes worked
    // out from it (whole, rounded down), with or without a load; a mode in words stays out of the figures; a mode
    // field marked by hand still wins; a hand value that is not a whole number leaves the modes to the rules.
    const rulesSets = [
      {
        movement: { exploration: 'speed * 3', overland: 'floor(speed / 5)', combat: { formula: 'speed / 3', unit: 'ft' }, swimming: 'speed / 2', partySpeed: 'slowest member' },
        unencumberedMovement: { speed: 90 },
      },
    ];
    const fields = [
      { key: 'mv', label: 'Movement', fill: 'movement.speed' },
      { key: 'fight', label: 'In a fight', fill: 'movement.combat' },
    ];
    const sheet = (typed: Record<string, unknown>, edited: string[], load: { speed: number | null; why: string } | null = null) =>
      movementOf({ rulesSets, race: null, raceName: null, filled: {}, load, fields, typed, edited });
    for (const load of [null, { speed: 60, why: 'Laden (your load)' }]) {
      const m = sheet({ mv: '35' }, ['mv'], load);
      expect(m.rows.map((r) => `${r.label} ${r.value}`)).toEqual(['Movement 35', 'In a fight 11 ft', 'Exploring 105', 'Overland 7']);
      expect(m.more.map((r) => `${r.label} ${r.value}`)).toEqual(['Swimming 17']);
      expect(m.rows[1]!.lines).toEqual(['35 is written on the sheet.', 'In a fight: speed / 3 = 11 ft (rounded down).']);
    }
    // A mode field typed by hand and marked still wins over the worked-out figure.
    expect(sheet({ mv: '35', fight: '9' }, ['mv', 'fight']).rows[1]!.value).toBe('9');
    // Not a whole number: the speed shows as written, the modes follow the rules.
    const words = sheet({ mv: '35 ft' }, ['mv']);
    expect(words.rows[0]!.value).toBe('35 ft');
    expect(words.rows[1]!.value).toBe('30 ft');
  });

  it('removing the hand mark returns the rules’ figures', () => {
    // Purpose: Undo, or a cleared mark, puts every mode back exactly as the rules give it.
    const rulesSets = [{ movement: { exploration: 'speed * 3', overland: 'floor(speed / 5)', combat: { formula: 'speed / 3', unit: 'ft' } }, unencumberedMovement: { speed: 90 } }];
    const fields = [{ key: 'mv', label: 'Movement', fill: 'movement.speed' }];
    const at = (edited: string[]) => movementOf({ rulesSets, race: null, raceName: null, filled: {}, load: null, fields, typed: { mv: '35' }, edited });
    expect(at(['mv']).rows.find((r) => r.key === 'movement.combat')!.value).toBe('11 ft');
    const rules = movementOf({ rulesSets, race: null, raceName: null, filled: {}, load: null, fields, typed: {}, edited: [] });
    expect(at([])).toEqual(rules);
  });

  it('an unmarked speed changes nothing: the modes follow the rules', () => {
    // Purpose: only a speed marked as typed by hand moves the modes; a stored speed with no mark is the fill's.
    const rulesSets = [{ movement: { exploration: 'speed * 3', combat: { formula: 'speed / 3', unit: 'ft' } }, unencumberedMovement: { speed: 90 } }];
    const fields = [{ key: 'mv', label: 'Movement', fill: 'movement.speed' }];
    const m = movementOf({ rulesSets, race: null, raceName: null, filled: {}, load: null, fields, typed: { mv: '35' }, edited: [] });
    expect(m.rows.map((r) => `${r.label} ${r.value}`)).toEqual(['Movement 90', 'Exploring 270', 'In a fight 30 ft']);
  });
});
